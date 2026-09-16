import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Groq from "groq-sdk";
import { extractText, getDocumentProxy } from "unpdf";

export const runtime = "nodejs";
export const maxDuration = 300;

async function callGroq(
  groq: Groq,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 3000
): Promise<string> {
  // Try 20b first
  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    });
    return completion.choices[0]?.message?.content || "{}";
  } catch (err) {
    console.log("20b failed:", err instanceof Error ? err.message.slice(0, 80) : "unknown");
  }

  // Try 120b
  await new Promise((r) => setTimeout(r, 1000));
  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
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

    const body = await req.json();
    const { filePaths, fileNames, title } = body as {
      filePaths: string[];
      fileNames: string[];
      title?: string;
    };

    if (!filePaths || filePaths.length < 2) {
      return NextResponse.json(
        { error: "Upload at least 2 exam papers to analyze" },
        { status: 400 }
      );
    }

    if (filePaths.length > 8) {
      return NextResponse.json(
        { error: "Maximum 8 papers at once" },
        { status: 400 }
      );
    }

    console.log(`📝 Analyzing ${filePaths.length} exam papers...`);

    // Extract text from each PDF
    const paperTexts: { name: string; text: string }[] = [];

    for (let i = 0; i < filePaths.length; i++) {
      const path = filePaths[i];
      const name = fileNames[i] || `Paper ${i + 1}`;

      console.log(`  [${i + 1}/${filePaths.length}] Reading "${name}"...`);

      const { data: fileData, error: downloadError } = await supabase.storage
        .from("pdfs")
        .download(path);

      if (downloadError || !fileData) {
        console.log(`    ⚠️ Download failed: ${downloadError?.message}`);
        continue;
      }

      try {
        const buffer = new Uint8Array(await fileData.arrayBuffer());
        const pdf = await getDocumentProxy(buffer);
        const { text: extracted } = await extractText(pdf, { mergePages: true });
        const text = Array.isArray(extracted) ? extracted.join("\n") : extracted;

        // Trim each paper to ~4000 chars to fit in context
        const trimmed = text.slice(0, 4000);
        paperTexts.push({ name, text: trimmed });
        console.log(`    ✅ ${trimmed.length} chars`);
      } catch (err) {
        console.log(`    ⚠️ Extraction failed:`, err instanceof Error ? err.message : "");
      }
    }

    if (paperTexts.length < 2) {
      return NextResponse.json(
        { error: "Could not extract text from at least 2 papers" },
        { status: 400 }
      );
    }

    // Build combined content
    const combined = paperTexts
      .map((p, i) => `=== PAPER ${i + 1}: ${p.name} ===\n${p.text}`)
      .join("\n\n")
      .slice(0, 20000);

    console.log(`📊 Combined ${combined.length} chars from ${paperTexts.length} papers`);

    // Ask AI to analyze patterns
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const systemPrompt = `You are an expert exam pattern analyzer. Given text from multiple past exam papers, identify:

1. TOPICS that repeat across papers (highest priority)
2. Question types (MCQ, short answer, long answer, numerical)
3. Topic frequency and importance
4. PREDICTED questions for the next exam

Respond ONLY with valid JSON in this exact format:
{
  "totalPapersAnalyzed": 3,
  "summary": "Brief 1-2 sentence overview of the pattern",
  "topics": [
    {
      "rank": 1,
      "topic": "Topic name (3-6 words, Title Case)",
      "frequency": "4 out of 5 papers",
      "confidence": 92,
      "avgMarks": 8,
      "questionTypes": ["Long Answer", "Short Answer"],
      "reasoning": "Why this topic is important (1 sentence)",
      "exampleQuestions": [
        "Example question that has appeared",
        "Another example"
      ]
    }
  ],
  "predictedQuestions": [
    {
      "topic": "Related topic",
      "question": "AI-predicted likely question",
      "confidence": 85,
      "suggestedAnswer": "Brief 2-3 sentence outline of how to answer"
    }
  ],
  "studyStrategy": [
    "Focus on X first — it's in every paper",
    "Practice Y numerical problems",
    "Don't skip Z — appeared 4/5 years"
  ]
}

RULES:
- List 5-8 topics sorted by confidence (highest first)
- confidence: 0-100 based on frequency + importance
- avgMarks: estimated average marks this topic carries
- Generate 5-7 predictedQuestions based on patterns
- studyStrategy: 3-5 actionable tips
- All content must be grounded in the provided papers
- Do not invent topics not present in the papers
- Be specific — "HTTP Methods and Status Codes" not just "HTTP"`;

    const userPrompt = `Analyze these ${paperTexts.length} exam papers and predict the important topics for the next exam.

${combined}

Generate a comprehensive exam prediction report.`;

    const rawResponse = await callGroq(groq, systemPrompt, userPrompt, 3500);

    let parsed;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid JSON. Please try again." },
        { status: 500 }
      );
    }

    if (!parsed.topics || !Array.isArray(parsed.topics)) {
      return NextResponse.json(
        { error: "AI response missing topics" },
        { status: 500 }
      );
    }

    // Save prediction to database
    const reportTitle =
      title || `Exam Prediction — ${new Date().toLocaleDateString()}`;

    const { data: saved, error: saveError } = await supabase
      .from("exam_predictions")
      .insert({
        user_id: user.id,
        title: reportTitle,
        paper_paths: filePaths,
        paper_names: fileNames,
        total_papers: paperTexts.length,
        total_questions: parsed.totalQuestions || null,
        predictions: parsed,
      })
      .select()
      .single();

    if (saveError) {
      console.log("⚠️ Save failed:", saveError.message);
    }

    console.log(`✅ Generated prediction with ${parsed.topics.length} topics`);

    return NextResponse.json({
      success: true,
      predictionId: saved?.id,
      title: reportTitle,
      prediction: parsed,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Exam predict error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}