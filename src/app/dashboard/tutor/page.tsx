import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Sparkles, ArrowLeft, Brain } from "lucide-react";
import LogoutButton from "../logout-button";
import TutorClient from "./tutor-client";

export default async function TutorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch user's PDFs
  const { data: files } = await supabase.storage.from("pdfs").list(user.id, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });

  const pdfCount = (files ?? []).filter((f) => f.name.endsWith(".pdf")).length;

  return (
    <main className="relative h-screen flex flex-col overflow-hidden">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-purple-500/20 blur-3xl animate-float" />
      <div
        className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl animate-float"
        style={{ animationDelay: "2s" }}
      />

      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">AI Tutor</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 hidden sm:block">
            {pdfCount} {pdfCount === 1 ? "PDF" : "PDFs"} in your library
          </span>
          <LogoutButton />
        </div>
      </nav>

      <div className="relative z-10 flex-1 overflow-hidden">
        <TutorClient pdfCount={pdfCount} />
      </div>
    </main>
  );
}