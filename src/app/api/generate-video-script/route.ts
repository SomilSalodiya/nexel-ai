import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    const { filePath, fileName } = body as {
      filePath: string;
      fileName: string;
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

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content: `You are an expert educational video scriptwriter. Given content from a PDF, create a 7-scene study video script.

Respond ONLY with valid JSON in this exact format:
{
  "title": "Overall video title",
  "scenes": [
    { "type": "title", "title": "...", "subtitle": "...", "narration": "..." },
    { "type": "bullets", "title": "...", "bullets": ["..."], "narration": "..." },
    { "type": "pie", "title": "...", "data": [{"label": "...", "value": 40}], "narration": "..." },
    { "type": "bar", "title": "...", "data": [{"label": "...", "value": 80}], "narration": "..." },
    { "type": "diagram", "title": "...", "mermaid": "graph TD\\n  A[Start] --> B[Step]\\n  B --> C[End]", "narration": "..." },
    { "type": "quote", "text": "...", "narration": "..." },
    { "type": "quote", "text": "...", "narration": "..." }
  ]
}

Scene type rules:
- EXACTLY 7 scenes
- First scene MUST be "title"
- Include ONE "pie", ONE "bar", ONE "bullets", ONE "diagram"
- Last 2 scenes MUST be "quote" (summary/conclusion)
- Order: title → bullets → pie → bar → diagram → quote → quote

Mermaid syntax rules (CRITICAL — must be valid Mermaid):
- Use "graph TD" (top-down) or "graph LR" (left-right)
- Node format: A[Label] for rectangles, B{Label} for diamonds, C(Label) for rounded
- Arrows: A --> B for straight, A -->|text| B for labeled
- Use \\n for newlines IN THE JSON STRING
- Node IDs: single letters A, B, C, D, E, F
- Labels: keep short (< 20 chars)
- NO special characters like quotes, colons, or parens inside labels
- Example valid: "graph TD\\n  A[Start] --> B{Check}\\n  B -->|Yes| C[Done]\\n  B -->|No| D[Retry]"

Data rules:
- "pie": 3-4 categories, values sum to 100
- "bar": 3-5 items, values 10-100

Other rules:
- Narration: 2-3 natural conversational sentences
- Bullets: max 12 words each
- Do NOT include text outside the JSON`,
        },
        {
          role: "user",
          content: `Create a 7-scene study video script from this PDF content titled "${fileName}":\n\n${combinedContent}`,
        },
      ],
      temperature: 0.6,
      max_tokens: 3000,
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
      scenes: parsed.scenes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Generate video script error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}