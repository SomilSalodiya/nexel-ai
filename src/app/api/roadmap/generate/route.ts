import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Groq from "groq-sdk";
import { kmeans } from "ml-kmeans";

export const runtime = "nodejs";
export const maxDuration = 300;

type ChunkRow = {
  id: number;
  chunk_index: number;
  content: string;
  embedding: number[] | string;
};

type DayPlan = {
  day: number;
  date: string;
  focus: string;
  topics: string[];
  tasks: string[];
  estimatedMinutes: number;
  resources: {
    type: "read" | "notes" | "quiz" | "flashcards" | "lecture" | "review";
    description: string;
  }[];
  isReviewDay: boolean;
};

function parseEmbedding(raw: number[] | string): number[] {
  if (Array.isArray(raw)) return raw;
  const cleaned = raw.replace(/^\[|\]$/g, "");
  return cleaned.split(",").map((n) => parseFloat(n));
}

async function callGroq(
  groq: Groq,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 4000
): Promise<string> {
  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    });
    return completion.choices[0]?.message?.content || "{}";
  } catch (err) {
    console.log("20b failed, trying 120b:", err instanceof Error ? err.message.slice(0, 60) : "");
  }
  await new Promise((r) => setTimeout(r, 1000));
  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.6,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  });
  return completion.choices[0]?.message?.content || "{}";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { filePath, fileName, examDate, hoursPerDay } = (await req.json()) as {
      filePath: string;
      fileName: string;
      examDate: string;
      hoursPerDay: number;
    };

    if (!filePath || !examDate || !hoursPerDay) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log(`📅 Generating roadmap for ${fileName}`);
    console.log(`   Exam: ${examDate} · ${hoursPerDay}h/day`);

    // Calculate days available
    const examDateObj = new Date(examDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalDays = Math.max(
      1,
      Math.ceil((examDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    );

    console.log(`   Days until exam: ${totalDays}`);

    // Load chunks
    const { data: chunks, error: chunkError } = await supabase
      .from("pdf_chunks")
      .select("id, chunk_index, content, embedding")
      .eq("user_id", user.id)
      .eq("file_path", filePath)
      .order("chunk_index", { ascending: true });

    if (chunkError || !chunks || chunks.length < 6) {
      return NextResponse.json(
        { error: "PDF not processed. Please analyze it first." },
        { status: 400 }
      );
    }

    const typedChunks = chunks as ChunkRow[];
    const vectors = typedChunks.map((c) => parseEmbedding(c.embedding));

    // Cluster into topics
    const k = Math.min(12, Math.max(6, Math.round(typedChunks.length / 30)));
    console.log(`  Clustering ${typedChunks.length} chunks into ${k} topics`);

    const result = kmeans(vectors, k, {
      initialization: "kmeans++",
      maxIterations: 200,
    });

    const clusters: Record<number, ChunkRow[]> = {};
    for (let i = 0; i < typedChunks.length; i++) {
      const cid = result.clusters[i];
      if (!clusters[cid]) clusters[cid] = [];
      clusters[cid].push(typedChunks[i]);
    }

    const sortedClusters = Object.values(clusters).sort(
      (a, b) => a[0].chunk_index - b[0].chunk_index
    );

    // Get topic names for each cluster
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const topics: { name: string; summary: string; chunkCount: number }[] = [];

    for (let i = 0; i < sortedClusters.length; i++) {
      const cluster = sortedClusters[i];
      const sorted = [...cluster].sort((a, b) => a.chunk_index - b.chunk_index);
      const mid = Math.floor(sorted.length / 2);
      const samples = [0, mid, sorted.length - 1].filter(
        (i, idx, arr) => arr.indexOf(i) === idx && i >= 0 && i < sorted.length
      );
      const content = samples
        .map((i) => sorted[i].content.slice(0, 350))
        .join("\n\n")
        .slice(0, 1200);

      try {
        const completion = await groq.chat.completions.create({
          model: "openai/gpt-oss-20b",
          messages: [
            {
              role: "system",
              content: `Name this textbook chapter. Return ONLY JSON: {"title": "3-5 word Title Case", "summary": "one sentence"}`,
            },
            { role: "user", content },
          ],
          temperature: 0.3,
          max_tokens: 120,
          response_format: { type: "json_object" },
        });
        const raw = (completion.choices[0]?.message?.content || "").trim();
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { title: raw.replace(/^["'\s.]+|["'\s.]+$/g, "").slice(0, 60), summary: "" };
        }
        topics.push({
          name: parsed.title || `Topic ${i + 1}`,
          summary: parsed.summary || "",
          chunkCount: cluster.length,
        });
      } catch {
        topics.push({
          name: `Topic ${i + 1}`,
          summary: "",
          chunkCount: cluster.length,
        });
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log(`  Named ${topics.length} topics:`);
    topics.forEach((t) => console.log(`    · ${t.name}`));

    // Now generate the day-by-day plan
    const topicList = topics
      .map((t, i) => `${i + 1}. ${t.name} (${t.chunkCount} chunks) - ${t.summary}`)
      .join("\n");

    const systemPrompt = `You are an expert study planner. Create a day-by-day study roadmap for exam preparation.

Respond ONLY with valid JSON:
{
  "overview": "1-2 sentence overview of the plan",
  "strategy": "Brief strategy note about the approach",
  "days": [
    {
      "day": 1,
      "focus": "Topic name being studied",
      "topics": ["Subtopic 1", "Subtopic 2"],
      "tasks": ["Task 1", "Task 2", "Task 3"],
      "estimatedMinutes": 120,
      "resources": [
        {"type": "read", "description": "Read pages covering X"},
        {"type": "notes", "description": "Generate AI notes on X"},
        {"type": "quiz", "description": "Take a quiz on X"}
      ],
      "isReviewDay": false
    }
  ]
}

CRITICAL RULES:
- Generate EXACTLY ${totalDays} days
- Each day has 3-5 realistic tasks
- Total daily minutes must be approximately ${hoursPerDay * 60} (±20 min)
- Every 4-5 days, include a REVIEW day (isReviewDay: true) that consolidates prior topics
- Last 2 days before exam: focus on full-review and mock tests
- Day 1 starts with foundational topics first
- Spread ALL ${topics.length} topics across the days

Available topics:
${topicList}

Resource types available:
- "read" — read the PDF
- "notes" — generate AI notes from highlights
- "quiz" — take a quiz (quiz generator)
- "flashcards" — review flashcards
- "lecture" — watch AI-generated lecture
- "review" — review past notes

Keep tasks specific and actionable. Use topic names.

Do not include any text outside the JSON.`;

    const userPrompt = `Create a ${totalDays}-day study roadmap for the exam on ${examDate}.

Constraints:
- ${hoursPerDay} hours available per day
- ${totalDays} days total
- Cover all ${topics.length} topics
- Include review days every 4-5 days
- Final 2 days: comprehensive review

Generate the complete day-by-day plan.`;

    const raw = await callGroq(groq, systemPrompt, userPrompt, 5000);

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid JSON. Please try again." },
        { status: 500 }
      );
    }

    if (!parsed.days || !Array.isArray(parsed.days)) {
      return NextResponse.json(
        { error: "AI response missing days" },
        { status: 500 }
      );
    }

    // Attach actual dates to each day
    const plan: DayPlan[] = parsed.days.map((d: Record<string, unknown>, i: number) => {
      const dayDate = new Date(today);
      dayDate.setDate(dayDate.getDate() + i);
      return {
        day: i + 1,
        date: dayDate.toISOString().slice(0, 10),
        focus: (d.focus as string) || `Day ${i + 1}`,
        topics: (d.topics as string[]) || [],
        tasks: (d.tasks as string[]) || [],
        estimatedMinutes: (d.estimatedMinutes as number) || hoursPerDay * 60,
        resources: (d.resources as DayPlan["resources"]) || [],
        isReviewDay: (d.isReviewDay as boolean) || false,
      };
    });

    // Save roadmap
    const { data: saved, error: saveError } = await supabase
      .from("study_roadmaps")
      .insert({
        user_id: user.id,
        file_path: filePath,
        file_name: fileName,
        exam_date: examDate,
        hours_per_day: hoursPerDay,
        total_days: totalDays,
        plan,
      })
      .select()
      .single();

    if (saveError) {
      console.log("Save error:", saveError.message);
      return NextResponse.json(
        { error: `Save failed: ${saveError.message}` },
        { status: 500 }
      );
    }

    // Create progress rows (all incomplete)
    const progressRows = plan.map((d) => ({
      roadmap_id: saved.id,
      day_number: d.day,
      completed: false,
    }));

    await supabase.from("roadmap_progress").insert(progressRows);

    console.log(`✅ Roadmap created with ${plan.length} days`);

    return NextResponse.json({
      success: true,
      roadmap: {
        id: saved.id,
        overview: parsed.overview || "",
        strategy: parsed.strategy || "",
        plan,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Roadmap error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}