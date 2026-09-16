import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Sparkles, ArrowLeft, Calendar } from "lucide-react";
import LogoutButton from "../logout-button";
import RoadmapClient from "./roadmap-client";

export default async function RoadmapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: files } = await supabase.storage.from("pdfs").list(user.id, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });

  const pdfs = (files ?? [])
    .filter((f) => f.name.endsWith(".pdf"))
    .map((f) => ({
      name: f.name,
      fullPath: `${user.id}/${f.name}`,
      displayName: f.name.replace(/^\d+-/, ""),
    }));

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-purple-500/20 blur-3xl animate-float" />
      <div
        className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl animate-float"
        style={{ animationDelay: "2s" }}
      />

      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Nexel AI</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 hidden sm:block">{user.email}</span>
          <LogoutButton />
        </div>
      </nav>

      <section className="relative z-10 max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-center gap-3 mb-3">
          <Calendar className="w-8 h-8 text-purple-300" />
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            AI Study <span className="glow-text">Roadmap</span>
          </h1>
        </div>
        <p className="text-gray-400 mb-12 max-w-2xl">
          Tell us when your exam is, and AI will build a personalized day-by-day
          study plan covering every topic in your PDF.
        </p>

        <RoadmapClient pdfs={pdfs} />
      </section>
    </main>
  );
}