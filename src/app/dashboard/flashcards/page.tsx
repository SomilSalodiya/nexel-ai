import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Sparkles, ArrowLeft, GraduationCap } from "lucide-react";
import LogoutButton from "../logout-button";
import FlashcardReview from "./flashcard-review";

export default async function FlashcardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: notes } = await supabase
    .from("pdf_notes")
    .select("id, file_name, flashcard, created_at")
    .eq("user_id", user.id)
    .not("flashcard", "is", null)
    .order("created_at", { ascending: false });

  const cards = (notes ?? [])
    .filter((n) => n.flashcard && n.flashcard.question && n.flashcard.answer)
    .map((n) => ({
      id: n.id,
      fileName: n.file_name,
      question: n.flashcard.question,
      answer: n.flashcard.answer,
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

      <section className="relative z-10 max-w-3xl mx-auto px-8 py-12">
        <div className="flex items-center gap-3 mb-3">
          <GraduationCap className="w-8 h-8 text-purple-300" />
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            Flashcard <span className="glow-text">Review</span>
          </h1>
        </div>
        <p className="text-gray-400 mb-12">
          Study mode — flip through your flashcards and track what you know.
        </p>

        {cards.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-4">
              <GraduationCap className="w-8 h-8 text-purple-300" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No flashcards yet</h2>
            <p className="text-gray-400 text-sm mb-6">
              Generate AI notes with flashcards to start reviewing.
            </p>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <FlashcardReview cards={cards} />
        )}
      </section>
    </main>
  );
}