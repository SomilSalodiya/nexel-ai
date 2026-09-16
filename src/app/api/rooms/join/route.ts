import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
    const { code } = body as { code: string };

    if (!code) {
      return NextResponse.json({ error: "Room code required" }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();

    // Find room by code
    const { data: room, error: roomError } = await supabase
      .from("study_rooms")
      .select("id, code, name")
      .eq("code", cleanCode)
      .maybeSingle();

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Check if already member
    const { data: existingMember } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", room.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingMember) {
      const { error: joinError } = await supabase.from("room_members").insert({
        room_id: room.id,
        user_id: user.id,
      });

      if (joinError) {
        return NextResponse.json(
          { error: `Join failed: ${joinError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Join room error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}