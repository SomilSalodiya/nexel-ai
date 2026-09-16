import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Sparkles, ArrowLeft, BarChart3 } from "lucide-react";
import LogoutButton from "../logout-button";
import AnalyticsClient from "./analytics-client";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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

      <section className="relative z-10 max-w-6xl mx-auto px-8 py-12">
        <div className="flex items-center gap-3 mb-3">
          <BarChart3 className="w-8 h-8 text-purple-300" />
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            Your <span className="glow-text">Analytics</span>
          </h1>
        </div>
        <p className="text-gray-400 mb-12 max-w-2xl">
          Track your study activity, learning progress, and content you&apos;ve created.
        </p>

        <AnalyticsClient />
      </section>
    </main>
  );
}