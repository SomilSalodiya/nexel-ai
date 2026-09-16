import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

function getGroqKeys(): string[] {
  return [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5,
  ].filter((k): k is string => !!k && k.startsWith("gsk_"));
}

async function callGroqWithRotation(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000
): Promise<string> {
  const keys = getGroqKeys();
  if (keys.length === 0) throw new Error("No Groq API keys configured");

  const models = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"];

  for (const model of models) {
    for (const key of keys) {
      try {
        const groq = new Groq({ apiKey: key });
        const completion = await groq.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.5,
          max_tokens: maxTokens,
        });
        return completion.choices[0]?.message?.content || "";
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("429") || msg.includes("rate_limit")) continue;
        continue;
      }
    }
  }
  throw new Error("All Groq keys exhausted");
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

    const { filePath, fileName, numQuestions = 5 } = (await req.json()) as {
      filePath: string;
      fileName: string;
      numQuestions?: number;
    };

    if (!filePath) {
      return NextResponse.json({ error: "Missing filePath" }, { status: 400 });
    }

    const { data: chunks, error: chunkError } = await supabase
      .from("pdf_chunks")
      .select("content")
      .eq("user_id", user.id)
      .eq("file_path", filePath)
      .order("chunk_index", { ascending: true })
      .limit(15);

    if (chunkError) {
      return NextResponse.json({ error: `Failed to load: ${chunkError.message}` }, { status: 500 });
    }
    if (!chunks || chunks.length === 0) {
      return NextResponse.json(
        { error: "This PDF hasn't been processed yet. Analyze it first." },
        { status: 400 }
      );
    }

    const combinedContent = chunks.map((c) => c.content).join("\n\n").slice(0, 6000);

    const systemPrompt = `You are an expert quiz generator. Generate ${numQuestions} multiple-choice questions from the given content.

Respond ONLY with valid JSON:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this is correct"
    }
  ]
}

Rules:
- Exactly 4 options per question
- correctIndex 0-3
- No unescaped double quotes inside strings
- No newlines inside strings`;

    const userPrompt = `Generate ${numQuestions} quiz questions from:\n\n${combinedContent}`;

    const raw = await callGroqWithRotation(systemPrompt, userPrompt, 2000);

    let parsed;
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      parsed = JSON.parse(
        firstBrace !== -1 && lastBrace > firstBrace
          ? cleaned.slice(firstBrace, lastBrace + 1)
          : cleaned
      );
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      return NextResponse.json({ error: "AI response missing questions" }, { status: 500 });
    }

    const valid = parsed.questions.every(
      (q: { question?: string; options?: unknown; correctIndex?: unknown }) =>
        q.question &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        typeof q.correctIndex === "number" &&
        q.correctIndex >= 0 &&
        q.correctIndex < 4
    );

    if (!valid) {
      return NextResponse.json({ error: "AI generated invalid questions" }, { status: 500 });
    }

    return NextResponse.json({ questions: parsed.questions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Generate quiz error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}