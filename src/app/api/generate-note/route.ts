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
  maxTokens = 800
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
          temperature: 0.4,
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

    const { selectedText, filePath, fileName } = (await req.json()) as {
      selectedText: string;
      filePath: string;
      fileName: string;
    };

    if (!selectedText || selectedText.trim().length < 20) {
      return NextResponse.json({ error: "Please paste at least 20 characters" }, { status: 400 });
    }
    if (selectedText.length > 5000) {
      return NextResponse.json({ error: "Text too long (max 5000 chars)" }, { status: 400 });
    }

    const systemPrompt = `You are an expert study assistant. Generate study materials from text.

Respond ONLY with valid JSON:
{
  "summary": "2-3 sentence summary",
  "bullets": ["Key point 1", "Key point 2", "Key point 3", "Key point 4"],
  "simplified": "Simple beginner-friendly explanation",
  "flashcard": {
    "question": "A quiz-style question",
    "answer": "The concise answer"
  }
}

Rules:
- No unescaped double quotes inside strings
- No newlines inside string values
- Start with { and end with }`;

    const userPrompt = `Text from PDF "${fileName}":\n\n${selectedText}`;

    const raw = await callGroqWithRotation(systemPrompt, userPrompt, 800);

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

    const { data: inserted, error: insertError } = await supabase
      .from("pdf_notes")
      .insert({
        user_id: user.id,
        file_path: filePath,
        file_name: fileName,
        selected_text: selectedText,
        summary: parsed.summary || "",
        bullets: parsed.bullets || [],
        simplified: parsed.simplified || "",
        flashcard: parsed.flashcard || null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: `Save failed: ${insertError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, note: inserted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Generate note error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}