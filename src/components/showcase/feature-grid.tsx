"use client";

import { motion } from "framer-motion";
import {
  MessageSquare,
  StickyNote,
  GraduationCap,
  Brain,
  Tv,
  Video,
  Target,
  Users,
  Bot,
  Calendar,
  BarChart3,
  Search,
  Command,
  Mic,
  Image as ImageIcon,
  FileText,
  Sparkles,
  Zap,
  BookOpen,
  Layers,
} from "lucide-react";

type Feature = {
  icon: typeof MessageSquare;
  title: string;
  desc: string;
  gradient: string;
  category: "AI" | "Study" | "Collab" | "Insights";
};

const FEATURES: Feature[] = [
  {
    icon: MessageSquare,
    title: "Chat with PDFs",
    desc: "Ask questions, get answers with source citations",
    gradient: "from-purple-500/20 to-cyan-500/20",
    category: "AI",
  },
  {
    icon: Bot,
    title: "AI Tutor",
    desc: "Your personal AI — voice, text, images, PDFs",
    gradient: "from-pink-500/20 to-purple-500/20",
    category: "AI",
  },
  {
    icon: StickyNote,
    title: "AI Notes",
    desc: "Highlight text → instant summary, bullets, flashcards",
    gradient: "from-yellow-500/20 to-orange-500/20",
    category: "AI",
  },
  {
    icon: GraduationCap,
    title: "Flashcards",
    desc: "Review cards with flip animation + scoring",
    gradient: "from-cyan-500/20 to-blue-500/20",
    category: "Study",
  },
  {
    icon: Brain,
    title: "Quiz Generator",
    desc: "5 MCQs from any PDF with instant feedback",
    gradient: "from-pink-500/20 to-red-500/20",
    category: "Study",
  },
  {
    icon: Tv,
    title: "Full Lecture",
    desc: "45-min AI-generated lecture with chapters",
    gradient: "from-purple-500/20 to-pink-500/20",
    category: "AI",
  },
  {
    icon: Video,
    title: "Study Video",
    desc: "Quick 6-scene video with charts + voice",
    gradient: "from-cyan-500/20 to-purple-500/20",
    category: "AI",
  },
  {
    icon: Target,
    title: "Exam Predictor",
    desc: "Analyze past papers → predict hot topics",
    gradient: "from-pink-500/20 to-purple-500/20",
    category: "Insights",
  },
  {
    icon: Calendar,
    title: "Study Roadmap",
    desc: "Day-by-day plan tailored to your exam date",
    gradient: "from-emerald-500/20 to-cyan-500/20",
    category: "Study",
  },
  {
    icon: Users,
    title: "Study Rooms",
    desc: "Real-time study with classmates + sync",
    gradient: "from-cyan-500/20 to-blue-500/20",
    category: "Collab",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    desc: "Track your study progress + streaks",
    gradient: "from-purple-500/20 to-cyan-500/20",
    category: "Insights",
  },
  {
    icon: Search,
    title: "Global Search",
    desc: "Find anything across PDFs, notes, quizzes",
    gradient: "from-purple-500/20 to-pink-500/20",
    category: "Insights",
  },
  {
    icon: Command,
    title: "Quick Actions",
    desc: "⌘K command palette for instant navigation",
    gradient: "from-cyan-500/20 to-emerald-500/20",
    category: "Insights",
  },
  {
    icon: Mic,
    title: "Voice Input",
    desc: "Ask questions in English or Hindi",
    gradient: "from-red-500/20 to-pink-500/20",
    category: "AI",
  },
  {
    icon: ImageIcon,
    title: "Image Analysis",
    desc: "Upload photos of notes → AI understands",
    gradient: "from-pink-500/20 to-purple-500/20",
    category: "AI",
  },
  {
    icon: FileText,
    title: "PDF Processing",
    desc: "Upload any PDF → instant RAG indexing",
    gradient: "from-purple-500/20 to-blue-500/20",
    category: "AI",
  },
];

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  AI: { label: "AI-Powered", color: "text-purple-300" },
  Study: { label: "Study Tools", color: "text-cyan-300" },
  Collab: { label: "Collaboration", color: "text-blue-300" },
  Insights: { label: "Insights", color: "text-pink-300" },
};

export default function FeatureGrid() {
  return (
    <section
      id="features"
      className="relative z-10 max-w-7xl mx-auto px-8 py-24"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-purple-300 font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          16 Powerful Features
        </div>
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
          Everything you need to{" "}
          <span className="glow-text">master your studies</span>
        </h2>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          From AI-generated lectures to real-time collaboration — a complete
          toolkit built for the modern student.
        </p>
      </motion.div>

      {/* Feature grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(i * 0.04, 0.6), duration: 0.4 }}
              className="glass rounded-2xl p-5 hover:bg-white/[0.08] transition-all group relative overflow-hidden"
            >
              {/* Glow effect on hover */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
              />

              <div className="relative">
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.gradient} border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5 text-gray-500">
                  {CATEGORY_LABELS[f.category].label}
                </div>
                <h3 className="text-sm md:text-base font-semibold text-white mb-1.5 leading-tight">
                  {f.title}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Stats strip */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
        className="mt-16 glass rounded-2xl p-8 grid grid-cols-2 md:grid-cols-4 gap-6"
      >
        <div className="text-center">
          <div className="text-3xl md:text-4xl font-bold glow-text mb-1">
            16+
          </div>
          <div className="text-xs text-gray-400">Features</div>
        </div>
        <div className="text-center">
          <div className="text-3xl md:text-4xl font-bold glow-text mb-1">
            4
          </div>
          <div className="text-xs text-gray-400">AI Providers</div>
        </div>
        <div className="text-center">
          <div className="text-3xl md:text-4xl font-bold glow-text mb-1">
            2
          </div>
          <div className="text-xs text-gray-400">Languages</div>
        </div>
        <div className="text-center">
          <div className="text-3xl md:text-4xl font-bold glow-text mb-1">
            100%
          </div>
          <div className="text-xs text-gray-400">Free</div>
        </div>
      </motion.div>
    </section>
  );
}