"use client";

import { motion } from "framer-motion";
import { FileText, Brain, GraduationCap, TrendingUp, ChevronRight } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: FileText,
    title: "Upload any PDF",
    desc: "Drop your textbook, notes, question bank, or research paper. Any size, any subject.",
    gradient: "from-purple-500/20 to-cyan-500/20",
    iconColor: "text-purple-300",
  },
  {
    number: "02",
    icon: Brain,
    title: "AI analyzes it",
    desc: "Our AI reads your document, splits it into topics, and creates embeddings for smart search.",
    gradient: "from-cyan-500/20 to-blue-500/20",
    iconColor: "text-cyan-300",
  },
  {
    number: "03",
    icon: GraduationCap,
    title: "Study with AI tools",
    desc: "Chat, generate notes, quizzes, flashcards, lectures — or study together in rooms.",
    gradient: "from-pink-500/20 to-purple-500/20",
    iconColor: "text-pink-300",
  },
  {
    number: "04",
    icon: TrendingUp,
    title: "Track & improve",
    desc: "Follow your roadmap, get exam predictions, and see your progress analytics.",
    gradient: "from-emerald-500/20 to-cyan-500/20",
    iconColor: "text-emerald-300",
  },
];

export default function HowItWorks() {
  return (
    <section className="relative z-10 max-w-7xl mx-auto px-8 py-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-cyan-300 font-medium mb-6">
          <ChevronRight className="w-4 h-4" />
          How It Works
        </div>
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          From PDF to{" "}
          <span className="glow-text">mastery in 4 steps</span>
        </h2>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          No signup hassle, no complex setup. Upload a PDF and let AI do the
          heavy lifting.
        </p>
      </motion.div>

      {/* Steps */}
      <div className="relative">
        {/* Connecting line (desktop only) */}
        <div className="hidden lg:block absolute top-[120px] left-[12%] right-[12%] h-0.5">
          <div className="h-full bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="relative"
              >
                <div className="glass rounded-2xl p-6 hover:bg-white/[0.08] transition-all h-full group">
                  {/* Big number badge */}
                  <div className="flex items-start justify-between mb-6">
                    <div
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.gradient} border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                    >
                      <Icon className={`w-6 h-6 ${step.iconColor}`} />
                    </div>
                    <div className="text-4xl font-bold text-white/10 group-hover:text-white/20 transition-colors">
                      {step.number}
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {step.desc}
                  </p>

                  {/* Arrow indicator (mobile hidden, desktop shown between cards) */}
                  {i < STEPS.length - 1 && (
                    <div className="hidden lg:flex absolute top-[100px] -right-3 w-6 h-6 rounded-full bg-gradient-to-br from-purple-500/40 to-cyan-500/40 items-center justify-center z-10">
                      <ChevronRight className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Bottom info banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5 }}
        className="mt-16 glass rounded-2xl p-8 text-center"
      >
        <div className="flex items-center justify-center gap-6 md:gap-12 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center">
              <span className="text-lg">⚡</span>
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-white">~2 minutes</div>
              <div className="text-xs text-gray-500">PDF to AI-ready</div>
            </div>
          </div>

          <div className="hidden md:block w-px h-8 bg-white/10" />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center">
              <span className="text-lg">🧠</span>
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-white">16 AI tools</div>
              <div className="text-xs text-gray-500">Ready instantly</div>
            </div>
          </div>

          <div className="hidden md:block w-px h-8 bg-white/10" />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
              <span className="text-lg">🎓</span>
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-white">Works anywhere</div>
              <div className="text-xs text-gray-500">Desktop, mobile, tablet</div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}