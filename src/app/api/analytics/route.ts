import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // ==== 1. Total PDFs ====
    const { data: files } = await supabase.storage
      .from("pdfs")
      .list(user.id, { limit: 1000 });

    const pdfCount = (files ?? []).filter((f) => f.name.endsWith(".pdf")).length;

    // ==== 2. Total notes ====
    const { count: notesCount } = await supabase
      .from("pdf_notes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    // ==== 3. Total chunks (indicates PDFs processed) ====
    const { count: chunksCount } = await supabase
      .from("pdf_chunks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    // ==== 4. Total exam predictions ====
    const { count: predictionsCount } = await supabase
      .from("exam_predictions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    // ==== 5. Flashcards (notes with flashcard) ====
    const { data: flashNotes } = await supabase
      .from("pdf_notes")
      .select("id")
      .eq("user_id", user.id)
      .not("flashcard", "is", null);

    const flashcardsCount = (flashNotes ?? []).length;

    // ==== 6. Activity timeline (last 30 days) ====
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentNotes } = await supabase
      .from("pdf_notes")
      .select("created_at")
      .eq("user_id", user.id)
      .gte("created_at", thirtyDaysAgo.toISOString());

    const { data: recentChunks } = await supabase
      .from("pdf_chunks")
      .select("created_at")
      .eq("user_id", user.id)
      .gte("created_at", thirtyDaysAgo.toISOString());

    // Group by date
    const activityByDate: Record<string, number> = {};
    const addActivity = (date: string) => {
      const day = date.slice(0, 10);
      activityByDate[day] = (activityByDate[day] || 0) + 1;
    };
    (recentNotes ?? []).forEach((n) => addActivity(n.created_at));
    // Chunks are bulk-created; count as 1 event per unique day
    const chunkDays = new Set((recentChunks ?? []).map((c) => c.created_at.slice(0, 10)));
    chunkDays.forEach((day) => {
      activityByDate[day] = (activityByDate[day] || 0) + 3; // weight chunks as 3
    });

    // Build last 14 days array (most recent activity)
    const last14Days: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      last14Days.push({ date: key, count: activityByDate[key] || 0 });
    }

    // ==== 7. Study streak ====
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (activityByDate[key] && activityByDate[key] > 0) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    // ==== 8. Top active files ====
    const { data: allNotes } = await supabase
      .from("pdf_notes")
      .select("file_name")
      .eq("user_id", user.id);

    const fileCounts: Record<string, number> = {};
    (allNotes ?? []).forEach((n) => {
      const name = n.file_name?.replace(/^\d+-/, "") || "Unknown";
      fileCounts[name] = (fileCounts[name] || 0) + 1;
    });

    const topFiles = Object.entries(fileCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // ==== 9. Content breakdown (for pie chart) ====
    const contentBreakdown = [
      { label: "PDFs", value: pdfCount },
      { label: "Notes", value: notesCount || 0 },
      { label: "Flashcards", value: flashcardsCount },
      { label: "Predictions", value: predictionsCount || 0 },
    ].filter((x) => x.value > 0);

    return NextResponse.json({
      success: true,
      stats: {
        pdfs: pdfCount,
        notes: notesCount || 0,
        chunks: chunksCount || 0,
        flashcards: flashcardsCount,
        predictions: predictionsCount || 0,
        streak,
      },
      activity: last14Days,
      topFiles,
      contentBreakdown,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Analytics error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}