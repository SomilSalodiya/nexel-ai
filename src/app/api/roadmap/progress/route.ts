import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// GET — load user's roadmaps with progress
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get all roadmaps
    const { data: roadmaps, error: rmError } = await supabase
      .from("study_roadmaps")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (rmError) {
      return NextResponse.json({ error: rmError.message }, { status: 500 });
    }

    if (!roadmaps || roadmaps.length === 0) {
      return NextResponse.json({ roadmaps: [] });
    }

    // Get progress for all roadmaps
    const roadmapIds = roadmaps.map((r) => r.id);
    const { data: progress } = await supabase
      .from("roadmap_progress")
      .select("*")
      .in("roadmap_id", roadmapIds);

    // Attach progress to each roadmap
    const enriched = roadmaps.map((r) => {
      const rProgress = (progress ?? []).filter((p) => p.roadmap_id === r.id);
      const completed = rProgress.filter((p) => p.completed).length;
      return {
        ...r,
        progress: rProgress,
        completedDays: completed,
        totalDays: rProgress.length,
        percentComplete:
          rProgress.length > 0
            ? Math.round((completed / rProgress.length) * 100)
            : 0,
      };
    });

    return NextResponse.json({ roadmaps: enriched });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — mark a day complete or incomplete
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { roadmapId, dayNumber, completed, notes } = (await req.json()) as {
      roadmapId: number;
      dayNumber: number;
      completed: boolean;
      notes?: string;
    };

    if (!roadmapId || !dayNumber) {
      return NextResponse.json({ error: "Missing roadmapId or dayNumber" }, { status: 400 });
    }

    // Verify ownership
    const { data: rm } = await supabase
      .from("study_roadmaps")
      .select("id")
      .eq("id", roadmapId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!rm) {
      return NextResponse.json({ error: "Roadmap not found" }, { status: 404 });
    }

    // Update progress
    const { error: updError } = await supabase
      .from("roadmap_progress")
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        notes: notes !== undefined ? notes : null,
      })
      .eq("roadmap_id", roadmapId)
      .eq("day_number", dayNumber);

    if (updError) {
      return NextResponse.json({ error: updError.message }, { status: 500 });
    }

    // Also update roadmap's updated_at
    await supabase
      .from("study_roadmaps")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", roadmapId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — remove a roadmap
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const roadmapId = searchParams.get("id");

    if (!roadmapId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const { error: delError } = await supabase
      .from("study_roadmaps")
      .delete()
      .eq("id", parseInt(roadmapId))
      .eq("user_id", user.id);

    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}