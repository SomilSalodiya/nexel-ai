"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 text-sm text-gray-300 hover:text-white px-4 py-2 rounded-lg glass hover:bg-white/10 transition-all"
    >
      <LogOut className="w-4 h-4" />
      Sign out
    </button>
  );
}