import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `STUDY-${code}`;
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
    const { name, filePath, fileName } = body as {
      name: string;
      filePath?: string;
      fileName?: string;
    };

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: "Room name required (min 2 chars)" }, { status: 400 });
    }

    // Try up to 5 times to generate a unique code
    let code = "";
    let roomId = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateCode();
      const { data: existing } = await supabase
        .from("study_rooms")
        .select("id")
        .eq("code", code)
        .maybeSingle();

      if (!existing) break;
    }

    // Create room
    const { data: room, error: roomError } = await supabase
      .from("study_rooms")
      .insert({
        code,
        name: name.trim(),
        host_id: user.id,
        file_path: filePath || null,
        file_name: fileName || null,
      })
      .select()
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: `Create failed: ${roomError?.message}` },
        { status: 500 }
      );
    }

    roomId = room.id;

    // Add host as member
    const { error: memberError } = await supabase.from("room_members").insert({
      room_id: roomId,
      user_id: user.id,
    });

    if (memberError) {
      console.log("Member insert warning:", memberError.message);
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
    console.error("Create room error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}