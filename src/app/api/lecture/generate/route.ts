import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";
export const maxDuration = 300;

type Scene =
  | { type: "title"; title: string; subtitle?: string; narration: string }
  | { type: "teach"; title: string; content: string; narration: string }
  | { type: "bullets"; title: string; bullets: string[]; narration: string }
  | { type: "diagram"; title: string; mermaid: string; narration: string }
  | { type: "recap"; title: string; bullets: string[]; narration: string };

async function callGroq(
  groq: Groq,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2500
): Promise<string> {
  // Try gpt-oss-20b first
  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    });
    return completion.choices[0]?.message?.content || "{}";
  } catch (err) {
    console.log("20b failed, trying 120b:", err instanceof Error ? err.message.slice(0, 60) : "unknown");
  }

  // Try gpt-oss-120b
  await new Promise((r) => setTimeout(r, 1000));
  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.5,
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
    const { filePath, topic } = body as {
      filePath: string;
      topic: {
        id: number;
        title: string;
        summary?: string;
        chunkIds: number[];
        chunkCount: number;
      };
    };

    if (!filePath || !topic || !topic.chunkIds) {
      return NextResponse.json({ error: "Missing filePath or topic" }, { status: 400 });
    }

    console.log(`📖 Generating lecture for: "${topic.title}" (${topic.chunkCount} chunks)`);

    // Load chunks for this topic
    const { data: chunks, error: chunkError } = await supabase
      .from("pdf_chunks")
      .select("id, chunk_index, content")
      .eq("user_id", user.id)
      .in("id", topic.chunkIds.slice(0, 30))
      .order("chunk_index", { ascending: true });

    if (chunkError || !chunks || chunks.length === 0) {
      return NextResponse.json(
        { error: `Failed to load chunks: ${chunkError?.message || "empty"}` },
        { status: 500 }
      );
    }

    // Build content sample — up to 8000 chars
    const fullContent = chunks
      .map((c) => c.content)
      .join("\n\n---\n\n")
      .slice(0, 8000);

    console.log(`  Content: ${fullContent.length} chars from ${chunks.length} chunks`);

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const systemPrompt = `You are an expert college professor creating a lecture video script. Given textbook content, generate a complete lecture section as JSON.

Respond ONLY with valid JSON in this exact format:
{
  "scenes": [
    {
      "type": "title",
      "title": "Topic Title",
      "subtitle": "Unit number or short tagline",
      "narration": "Welcome to this section on..."
    },
    {
      "type": "teach",
      "title": "Concept Name",
      "content": "Deep explanation (150-250 words) written as a professor would teach it. Include definitions, mechanics, why it matters, and examples where possible.",
      "narration": "A natural spoken version of the explanation (60-90 words, conversational, as if speaking aloud)"
    },
    {
      "type": "bullets",
      "title": "Key Points",
      "bullets": ["Point 1 (max 15 words)", "Point 2", "Point 3", "Point 4"],
      "narration": "Let me summarize the key points..."
    },
    {
      "type": "diagram",
      "title": "Diagram Title",
      "mermaid": "graph LR\\n  A[Start] --> B[Step]\\n  B --> C[End]",
      "narration": "This diagram shows how..."
    },
    {
      "type": "recap",
      "title": "Section Recap",
      "bullets": ["Recap point 1", "Recap point 2", "Recap point 3"],
      "narration": "To summarize what we covered in this section..."
    }
  ]
}

SCENE REQUIREMENTS:
- EXACTLY 5-6 scenes
- Scene 1: MUST be "title"
- Scene 2: MUST be "teach" (deep concept explanation)
- Scene 3: Either "teach" (2nd concept) or "bullets" (key points)
- Scene 4: Either "diagram" (if content shows process/flow) or "bullets"
- Scene 5: "recap"
- Optional Scene 6: additional "teach" scene if content is rich

MERMAID RULES (for diagram scenes):
- Use "graph TD" (top-down) or "graph LR" (left-right)
- Node format: A[Label], B{Decision}, C(Start)
- Arrows: A --> B or A -->|label| B
- Use \\n for line breaks in JSON strings
- Keep labels under 20 chars
- NO special characters inside labels (no colons, quotes, parens)
- Example: "graph LR\\n  A[User] --> B[Browser]\\n  B --> C[Server]\\n  C --> D[Database]"

NARRATION RULES:
- Natural, conversational, like a teacher explaining
- 60-90 words per scene (30-45 seconds spoken)
- No bullet-style; speak in full sentences
- Use "we", "you", "let's" — engaging tone

CONTENT RULES:
- Base everything on the provided PDF content
- Do NOT add facts not in the source
- If content is thin, create shorter scenes but keep all 5 types
- Keep "teach" content factual and accurate

Do not include any text outside the JSON.`;

    const userPrompt = `Textbook content for topic "${topic.title}" (${topic.chunkCount} chunks):

${fullContent}

Generate a 5-6 scene lecture section for this topic.`;

    const rawResponse = await callGroq(groq, systemPrompt, userPrompt, 3000);

    let parsed;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      console.error("Invalid JSON from AI");
      return NextResponse.json(
        { error: "AI returned invalid JSON" },
        { status: 500 }
      );
    }

    if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
      return NextResponse.json(
        { error: "AI response missing scenes" },
        { status: 500 }
      );
    }

    // Validate + fill in defaults
    const scenes: Scene[] = parsed.scenes
      .map((s: Record<string, unknown>) => {
        if (!s || typeof s !== "object") return null;
        if (!s.type || !s.narration) return null;
        return s as unknown as Scene;
      })
      .filter((s: Scene | null): s is Scene => s !== null);

    if (scenes.length < 3) {
      return NextResponse.json(
        { error: "Not enough scenes generated" },
        { status: 500 }
      );
    }

    console.log(`  ✅ Generated ${scenes.length} scenes`);

    return NextResponse.json({
      success: true,
      topicId: topic.id,
      topicTitle: topic.title,
      scenes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Generate lecture error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}