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
    const { filePath, fileName, numQuestions = 5 } = body as {
      filePath: string;
      fileName: string;
      numQuestions?: number;
    };

    if (!filePath) {
      return NextResponse.json({ error: "Missing filePath" }, { status: 400 });
    }

    // Fetch chunks for this PDF
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

    // Combine chunks (cap at ~6000 chars to stay within model context)
    const combinedContent = chunks
      .map((c) => c.content)
      .join("\n\n")
      .slice(0, 6000);

    // Ask Groq for quiz questions
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content: `You are an expert quiz generator. Given content from a PDF, generate ${numQuestions} multiple-choice questions that test understanding of the material.

Respond ONLY with valid JSON in this exact format:
{
  "questions": [
    {
      "question": "The question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}

Rules:
- Every question must have exactly 4 options
- correctIndex must be 0, 1, 2, or 3 (index of the correct option)
- Questions should test understanding, not just memorization
- Make wrong answers plausible
- Do not include any text outside the JSON`,
        },
        {
          role: "user",
          content: `Generate ${numQuestions} quiz questions from this content:\n\n${combinedContent}`,
        },
      ],
      temperature: 0.5,
      max_tokens: 2000,
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

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      return NextResponse.json(
        { error: "AI response missing questions. Please try again." },
        { status: 500 }
      );
    }

    // Validate structure
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
      return NextResponse.json(
        { error: "AI generated invalid questions. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ questions: parsed.questions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Generate quiz error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}