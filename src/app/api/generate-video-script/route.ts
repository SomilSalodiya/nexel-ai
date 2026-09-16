import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

type Language = "english" | "hindi" | "hinglish";

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
  maxTokens = 2500
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
          temperature: 0.6,
          max_tokens: maxTokens,
        });
        return completion.choices[0]?.message?.content || "";
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (
          msg.includes("429") ||
          msg.includes("rate_limit") ||
          msg.includes("Rate limit")
        ) {
          console.log(`  ⚠️ Key rate-limited, next...`);
          continue;
        }
        console.log(`  ❌ Key failed: ${msg.slice(0, 100)}`);
        continue;
      }
    }
  }
  throw new Error("All Groq keys exhausted");
}

function getLanguageInstruction(lang: Language): string {
  if (lang === "hindi") {
    return `IMPORTANT: Write ALL narration in HINDI (Devanagari script).
Example: "आज हम HTTP के बारे में सीखेंगे। यह एक प्रोटोकॉल है जिसका उपयोग वेब पर किया जाता है।"
- Titles and bullets in Devanagari too
- Keep technical terms (HTTP, HTML, CSS) in English`;
  }
  if (lang === "hinglish") {
    return `IMPORTANT: Write ALL narration in HINGLISH — natural Hindi-English mix.
Example: "Aaj hum HTTP ke baare mein seekhenge. Yeh ek protocol hai jiska use web par hota hai."
- Use Roman script only
- NO double quotes inside text
- Keep technical terms in English`;
  }
  return "LANGUAGE: Write all narration in clear English.";
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
    const { filePath, fileName, language: rawLang } = body as {
      filePath: string;
      fileName: string;
      language?: string;
    };

    const language: Language =
      rawLang === "hindi" || rawLang === "hinglish" ? rawLang : "english";

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
      return NextResponse.json(
        { error: `Failed to load content: ${chunkError.message}` },
        { status: 500 }
      );
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json(
        {
          error:
            "This PDF hasn't been processed yet. Open it and click 'Analyze this PDF' first.",
        },
        { status: 400 }
      );
    }

    const combinedContent = chunks
      .map((c) => c.content)
      .join("\n\n")
      .slice(0, 6000);

    const langInstruction = getLanguageInstruction(language);

    const systemPrompt = `You are an expert educational video scriptwriter. Given content from a PDF, create a 6-scene study video script.

Respond ONLY with valid JSON in this format:
{
  "title": "Overall video title",
  "scenes": [
    { "type": "title", "title": "...", "subtitle": "...", "narration": "..." },
    { "type": "teach", "title": "...", "content": "150-250 word explanation", "narration": "60-90 word spoken version" },
    { "type": "bullets", "title": "...", "bullets": ["Point 1", "Point 2", "Point 3"], "narration": "..." },
    { "type": "pie", "title": "...", "data": [{"label": "...", "value": 40}, {"label": "...", "value": 35}, {"label": "...", "value": 25}], "narration": "..." },
    { "type": "bullets", "title": "...", "bullets": ["A", "B", "C"], "narration": "..." },
    { "type": "recap", "title": "...", "bullets": ["Recap 1", "Recap 2"], "narration": "..." }
  ]
}

${langInstruction}

RULES:
- EXACTLY 6 scenes: title, teach, bullets, pie, bullets, recap
- Pie data: 3-4 categories summing to 100
- Narrations: 60-90 words each
- No unescaped double quotes inside strings
- No newlines inside string values`;

    const userPrompt = `Create a 6-scene study video script from this PDF content titled "${fileName}" in ${language}:\n\n${combinedContent}`;

    const content = await callGroqWithRotation(systemPrompt, userPrompt, 2500);

    let parsed;
    try {
      const cleaned = content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } else {
        parsed = JSON.parse(cleaned);
      }
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid JSON. Please try again." },
        { status: 500 }
      );
    }

    if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
      return NextResponse.json(
        { error: "AI response missing scenes. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      title: parsed.title || fileName,
      language,
      scenes: parsed.scenes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Generate video script error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}