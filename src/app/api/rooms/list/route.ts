import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get rooms user is a member of
    const { data: memberships, error } = await supabase
      .from("room_members")
      .select(
        `
        room_id,
        joined_at,
        study_rooms:room_id (
          id,
          code,
          name,
          host_id,
          file_name,
          created_at,
          updated_at
        )
      `
      )
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get member counts per room
    const roomIds = (memberships ?? []).map((m) => m.room_id);
    const memberCounts: Record<string, number> = {};

    if (roomIds.length > 0) {
      const { data: allMembers } = await supabase
        .from("room_members")
        .select("room_id")
        .in("room_id", roomIds);

      (allMembers ?? []).forEach((m) => {
        memberCounts[m.room_id] = (memberCounts[m.room_id] || 0) + 1;
      });
    }

    const rooms = (memberships ?? [])
      .filter((m) => m.study_rooms)
      .map((m) => {
        const r = m.study_rooms as unknown as {
          id: string;
          code: string;
          name: string;
          host_id: string;
          file_name: string | null;
          created_at: string;
          updated_at: string;
        };
        return {
          id: r.id,
          code: r.code,
          name: r.name,
          isHost: r.host_id === user.id,
          fileName: r.file_name,
          memberCount: memberCounts[r.id] || 0,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

    return NextResponse.json({ success: true, rooms });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("List rooms error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}