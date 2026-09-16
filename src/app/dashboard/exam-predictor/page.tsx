import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Sparkles, ArrowLeft, Target } from "lucide-react";
import LogoutButton from "../logout-button";
import ExamPredictor from "./predictor";

export default async function ExamPredictorPage() {
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
      <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl animate-float" style={{ animationDelay: "2s" }} />

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
          <Target className="w-8 h-8 text-purple-300" />
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            Exam <span className="glow-text">Predictor</span>
          </h1>
        </div>
        <p className="text-gray-400 mb-12 max-w-2xl">
          Upload 3-5 past exam papers. AI will analyze patterns and predict
          the most important topics and questions for your next exam.
        </p>

        {pdfs.length < 2 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-4">
              <Target className="w-8 h-8 text-purple-300" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Need at least 2 PDFs
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Upload 2 or more previous exam papers to enable predictions.
            </p>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
            >
              Upload PDFs
            </Link>
          </div>
        ) : (
          <ExamPredictor pdfs={pdfs} />
        )}
      </section>
    </main>
  );
}