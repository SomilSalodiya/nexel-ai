import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

type Language = "english" | "hindi" | "hinglish";

function getLanguageInstruction(lang: Language): string {
  if (lang === "hindi") {
    return `IMPORTANT: Write ALL narration in HINDI (Devanagari script).
Example: "आज हम HTTP के बारे में सीखेंगे। यह एक प्रोटोकॉल है जिसका उपयोग वेब पर किया जाता है।"
- Titles and bullets in Devanagari too
- Keep technical terms (HTTP, HTML, CSS) in English
- Sound like a Hindi professor teaching`;
  }
  if (lang === "hinglish") {
    return `IMPORTANT: Write ALL narration in HINGLISH — natural mix of Hindi and English.
Example: "Aaj hum HTTP ke baare mein seekhenge. Yeh ek protocol hai jiska use web par hota hai. Client aur server ke beech communication ka kaam karta hai."
- Use Roman script for Hindi words
- You MAY use Devanagari for emphasis
- Keep technical terms (HTTP, HTML, CSS) in English
- Sound casual and friendly, like explaining to a friend`;
  }
  return "LANGUAGE: Write all narration in clear, natural English.";
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

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content: `You are an expert educational video scriptwriter. Given content from a PDF, create a short 6-scene study video script.

Respond ONLY with valid JSON in this exact format:
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

SCENE REQUIREMENTS:
- EXACTLY 6 scenes
- Scene 1: title
- Scene 2: teach
- Scene 3: bullets
- Scene 4: pie (3-4 categories summing to 100)
- Scene 5: bullets
- Scene 6: recap

PIE CHART RULES:
- 3-4 categories, values sum to 100
- Labels short (< 15 chars)

NARRATION RULES:
- 60-90 words per scene (30-45 seconds spoken)
- Natural and conversational
- For Hindi/Hinglish use "hum", "aap", "chaliye"

Do not include any text outside the JSON.`,
        },
        {
          role: "user",
          content: `Create a 6-scene study video script from this PDF content titled "${fileName}" in ${language}:\n\n${combinedContent}`,
        },
      ],
      temperature: 0.6,
      max_tokens: 2500,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(content);
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