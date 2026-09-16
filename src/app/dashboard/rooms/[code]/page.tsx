import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import RoomClient from "./room-client";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cleanCode = code.toUpperCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Find the room
  const { data: room } = await supabase
    .from("study_rooms")
    .select("id, code, name, host_id, file_path, file_name")
    .eq("code", cleanCode)
    .maybeSingle();

  if (!room) notFound();

  // Check membership
  const { data: member } = await supabase
    .from("room_members")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  // Auto-join if not a member
  if (!member) {
    await supabase.from("room_members").insert({
      room_id: room.id,
      user_id: user.id,
    });
  }

  // Generate signed URL using service_role for shared access
  let pdfUrl = "";
  if (room.file_path) {
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: signed, error: signError } = await adminClient.storage
      .from("pdfs")
      .createSignedUrl(room.file_path, 3600 * 4); // 4 hours

    if (signError) {
      console.log("Sign error:", signError.message);
    }
    pdfUrl = signed?.signedUrl || "";
  }

  return (
    <RoomClient
      room={{
        id: room.id,
        code: room.code,
        name: room.name,
        hostId: room.host_id,
        fileName: room.file_name,
        pdfUrl,
      }}
      currentUserId={user.id}
    />
  );
}