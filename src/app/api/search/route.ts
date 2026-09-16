import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type SearchResult = {
  type: "note" | "chunk" | "prediction" | "quiz" | "flashcard";
  id: string;
  title: string;
  snippet: string;
  meta: string;
  link: string;
  score: number;
};

function escapeForLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
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

    const { query } = (await req.json()) as { query: string };
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    const q = query.trim();
    const qLower = q.toLowerCase();
    const pattern = `%${escapeForLike(q)}%`;

    const results: SearchResult[] = [];

    // ============ 1. SEARCH NOTES ============
    const { data: notes } = await supabase
      .from("pdf_notes")
      .select("id, file_name, summary, simplified, selected_text, bullets, flashcard")
      .eq("user_id", user.id)
      .or(
        `summary.ilike.${pattern},simplified.ilike.${pattern},selected_text.ilike.${pattern}`
      )
      .limit(10);

    for (const note of notes ?? []) {
      const text = note.summary || note.simplified || note.selected_text || "";
      const idx = text.toLowerCase().indexOf(qLower);
      const snippet =
        idx >= 0
          ? "..." + text.slice(Math.max(0, idx - 40), idx + 100) + "..."
          : text.slice(0, 120) + "...";

      results.push({
        type: "note",
        id: String(note.id),
        title: `Note: ${note.file_name?.replace(/^\d+-/, "") || "Untitled"}`,
        snippet,
        meta: `From ${note.file_name?.replace(/^\d+-/, "") || "unknown"}`,
        link: "/dashboard/notes",
        score: 100,
      });
    }

    // ============ 2. SEARCH CHUNKS (PDF content) ============
    const { data: chunks } = await supabase
      .from("pdf_chunks")
      .select("id, file_path, file_name, content")
      .eq("user_id", user.id)
      .ilike("content", pattern)
      .limit(15);

    for (const chunk of chunks ?? []) {
      const text = chunk.content || "";
      const idx = text.toLowerCase().indexOf(qLower);
      const snippet =
        idx >= 0
          ? "..." + text.slice(Math.max(0, idx - 40), idx + 120) + "..."
          : text.slice(0, 140) + "...";

      const cleanName = chunk.file_name?.replace(/^\d+-/, "") || "PDF";
      results.push({
        type: "chunk",
        id: `${chunk.id}`,
        title: cleanName,
        snippet,
        meta: `From PDF: ${cleanName}`,
        link: `/dashboard/chat?path=${encodeURIComponent(chunk.file_path)}`,
        score: 80,
      });
    }

    // ============ 3. SEARCH EXAM PREDICTIONS ============
    const { data: predictions } = await supabase
      .from("exam_predictions")
      .select("id, title, predictions")
      .eq("user_id", user.id)
      .ilike("title", pattern)
      .limit(5);

    for (const pred of predictions ?? []) {
      results.push({
        type: "prediction",
        id: String(pred.id),
        title: `Prediction: ${pred.title}`,
        snippet: `Click to view the full exam prediction report`,
        meta: `Exam prediction`,
        link: "/dashboard/exam-predictor",
        score: 90,
      });
    }

    // ============ 4. SEARCH FLASHCARDS (inside notes) ============
    const { data: flashNotes } = await supabase
      .from("pdf_notes")
      .select("id, file_name, flashcard")
      .eq("user_id", user.id)
      .not("flashcard", "is", null)
      .limit(50);

    for (const fn of flashNotes ?? []) {
      const fc = fn.flashcard as { question?: string; answer?: string } | null;
      if (!fc) continue;
      const q1 = (fc.question || "").toLowerCase();
      const a1 = (fc.answer || "").toLowerCase();
      if (q1.includes(qLower) || a1.includes(qLower)) {
        results.push({
          type: "flashcard",
          id: `fc-${fn.id}`,
          title: `Flashcard: ${fc.question?.slice(0, 60) || "Untitled"}`,
          snippet: fc.answer?.slice(0, 120) || "",
          meta: `From ${fn.file_name?.replace(/^\d+-/, "") || "unknown"}`,
          link: "/dashboard/flashcards",
          score: 70,
        });
      }
    }

    // ============ SORT + DEDUPE + LIMIT ============
    // Dedupe by id
    const seen = new Set<string>();
    const deduped: SearchResult[] = [];
    for (const r of results.sort((a, b) => b.score - a.score)) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      deduped.push(r);
    }

    return NextResponse.json({
      results: deduped.slice(0, 20),
      total: deduped.length,
      query: q,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Search error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}