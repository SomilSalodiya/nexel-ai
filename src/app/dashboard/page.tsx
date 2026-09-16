import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Sparkles,
  Upload,
  StickyNote,
  GraduationCap,
  Brain,
  Video,
  Target,
  Search,
  BarChart3,
  Users,
  Calendar,
} from "lucide-react";
import LogoutButton from "./logout-button";
import UploadButton from "./upload-button";
import PdfList from "./pdf-list";
import WelcomeBanner from "@/components/showcase/welcome-banner";
import TourButton from "@/components/showcase/tour-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: files } = await supabase.storage.from("pdfs").list(user.id, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });
  const pdfs = (files ?? []).filter((f) => f.name.endsWith(".pdf"));

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="absolute top-20 right-10 w-72 h-72 rounded-full bg-purple-500/20 blur-3xl animate-float" />
      <div
        className="absolute bottom-20 left-10 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl animate-float"
        style={{ animationDelay: "2s" }}
      />

      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto gap-4">
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Nexel AI</span>
        </Link>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Link
            href="/dashboard/tutor"
            className="flex items-center gap-2 text-sm text-white px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 hover:shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            <Brain className="w-4 h-4" />
            Tutor
          </Link>
          <Link
            href="/dashboard/roadmap"
            className="flex items-center gap-2 text-sm text-white px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-500 hover:shadow-lg hover:shadow-emerald-500/50 transition-all"
          >
            <Calendar className="w-4 h-4" />
            Roadmap
          </Link>
          <Link
            href="/dashboard/rooms"
            className="flex items-center gap-2 text-sm text-white px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-500 hover:shadow-lg hover:shadow-cyan-500/50 transition-all"
          >
            <Users className="w-4 h-4" />
            Rooms
          </Link>
          <Link
            href="/dashboard/lecture"
            className="flex items-center gap-2 text-sm text-white px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 hover:shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            <GraduationCap className="w-4 h-4" />
            Lecture
          </Link>
          <Link
            href="/dashboard/exam-predictor"
            className="flex items-center gap-2 text-sm text-white px-3 py-2 rounded-lg bg-gradient-to-r from-pink-600 to-purple-500 hover:shadow-lg hover:shadow-pink-500/50 transition-all"
          >
            <Target className="w-4 h-4" />
            Predictor
          </Link>
          <Link
            href="/dashboard/search"
            className="flex items-center gap-2 text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg glass hover:bg-white/10 transition-all"
          >
            <Search className="w-4 h-4" />
            Search
          </Link>
          <Link
            href="/dashboard/analytics"
            className="flex items-center gap-2 text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg glass hover:bg-white/10 transition-all"
          >
            <BarChart3 className="w-4 h-4" />
            Stats
          </Link>
          <Link
            href="/dashboard/notes"
            className="flex items-center gap-2 text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg glass hover:bg-white/10 transition-all"
          >
            <StickyNote className="w-4 h-4" />
            Notes
          </Link>
          <Link
            href="/dashboard/flashcards"
            className="flex items-center gap-2 text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg glass hover:bg-white/10 transition-all"
          >
            <GraduationCap className="w-4 h-4" />
            Study
          </Link>
          <Link
            href="/dashboard/quiz"
            className="flex items-center gap-2 text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg glass hover:bg-white/10 transition-all"
          >
            <Brain className="w-4 h-4" />
            Quiz
          </Link>
          <Link
            href="/dashboard/video"
            className="flex items-center gap-2 text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg glass hover:bg-white/10 transition-all"
          >
            <Video className="w-4 h-4" />
            Video
          </Link>
          <TourButton />
          <LogoutButton />
        </div>
      </nav>

      <section className="relative z-10 max-w-7xl mx-auto px-8 py-12">
        <WelcomeBanner />

        <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
          Welcome to your <span className="glow-text">workspace</span>
        </h1>
        <p className="text-gray-400 mb-12">
          Upload a PDF to get started with AI-powered notes, chat, and more.
        </p>

        <div className="glass rounded-2xl p-12 text-center mb-8 border-dashed border-2 border-white/10">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-purple-300" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Upload your first PDF
          </h2>
          <p className="text-gray-400 text-sm mb-6">Max 50MB. Only PDF files.</p>
          <div className="flex justify-center">
            <UploadButton />
          </div>
        </div>

        <PdfList pdfs={pdfs} userId={user.id} />
      </section>
    </main>
  );
}