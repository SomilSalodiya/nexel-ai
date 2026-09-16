import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { selectedText, filePath, fileName } = body as {
      selectedText: string;
      filePath: string;
      fileName: string;
    };

    if (!selectedText || selectedText.trim().length < 20) {
      return NextResponse.json(
        { error: "Please select or paste at least 20 characters" },
        { status: 400 }
      );
    }

    if (selectedText.length > 5000) {
      return NextResponse.json(
        { error: "Text too long. Please keep it under 5000 characters." },
        { status: 400 }
      );
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content: `You are an expert study assistant. Given a piece of text from a PDF, generate study materials. Respond ONLY with valid JSON in this exact format:

{
  "summary": "A 2-3 sentence summary of the key idea",
  "bullets": ["Key point 1", "Key point 2", "Key point 3", "Key point 4"],
  "simplified": "Explain this concept in simple, beginner-friendly language (2-3 sentences)",
  "flashcard": {
    "question": "A single quiz-style question about this content",
    "answer": "The concise answer"
  }
}

Do not include any text outside the JSON. Do not use markdown code fences.`,
        },
        {
          role: "user",
          content: `Text from PDF "${fileName}":\n\n${selectedText}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 800,
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
      return NextResponse.json(
        { error: `Save failed: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, note: inserted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Generate note error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}