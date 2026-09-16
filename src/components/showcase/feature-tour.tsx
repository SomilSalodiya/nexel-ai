"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileText,
  MessageSquare,
  Bot,
  StickyNote,
  GraduationCap,
  Brain,
  Tv,
  Video,
  Target,
  Users,
  BarChart3,
  Search,
  Command,
  Mic,
  Image as ImageIcon,
  Calendar,
  Rocket,
} from "lucide-react";

type TourStep = {
  icon: typeof FileText;
  title: string;
  tagline: string;
  desc: string;
  gradient: string;
  iconColor: string;
  category: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    icon: Rocket,
    title: "Welcome to Nexel AI",
    tagline: "Your AI-powered study companion",
    desc: "Let's walk through everything this app can do. In 30 seconds, you'll know exactly how to use it.",
    gradient: "from-purple-500 to-cyan-500",
    iconColor: "text-white",
    category: "Intro",
  },
  {
    icon: FileText,
    title: "Upload any PDF",
    tagline: "Textbooks, notes, papers — anything",
    desc: "Drag and drop your PDF. Max 50MB. We support any subject — from DSA to Web Tech to Biology.",
    gradient: "from-purple-500/20 to-blue-500/20",
    iconColor: "text-purple-300",
    category: "Step 1",
  },
  {
    icon: MessageSquare,
    title: "Chat with your PDF",
    tagline: "Ask questions, get answers with sources",
    desc: "Ask anything about your document. AI answers with citations — which page, which PDF, exactly where.",
    gradient: "from-purple-500/20 to-cyan-500/20",
    iconColor: "text-purple-300",
    category: "AI Tools",
  },
  {
    icon: StickyNote,
    title: "AI Notes from Highlights",
    tagline: "Highlight text → instant study notes",
    desc: "Select any text in your PDF and get a summary, bullet points, simplified explanation, and a flashcard.",
    gradient: "from-yellow-500/20 to-orange-500/20",
    iconColor: "text-yellow-300",
    category: "AI Tools",
  },
  {
    icon: GraduationCap,
    title: "Flashcard Review",
    tagline: "Study with flip cards + scoring",
    desc: "Review all your flashcards in one place. Flip, mark as known or review again, and track your score.",
    gradient: "from-cyan-500/20 to-blue-500/20",
    iconColor: "text-cyan-300",
    category: "Study Tools",
  },
  {
    icon: Brain,
    title: "Quiz Generator",
    tagline: "5 MCQs from any PDF",
    desc: "AI generates multiple-choice questions on the fly. Get instant feedback and explanations per question.",
    gradient: "from-pink-500/20 to-red-500/20",
    iconColor: "text-pink-300",
    category: "Study Tools",
  },
  {
    icon: Tv,
    title: "Full Lecture",
    tagline: "45-minute AI-narrated lecture",
    desc: "Turn any textbook into a full lecture with chapters, diagrams, and voice narration. Perfect for deep study.",
    gradient: "from-purple-500/20 to-pink-500/20",
    iconColor: "text-purple-300",
    category: "AI Tools",
  },
  {
    icon: Video,
    title: "Quick Study Video",
    tagline: "6-scene video with charts",
    desc: "A fast overview video with key points, pie charts, and voice — great for last-minute revision.",
    gradient: "from-cyan-500/20 to-purple-500/20",
    iconColor: "text-cyan-300",
    category: "AI Tools",
  },
  {
    icon: Target,
    title: "Exam Predictor",
    tagline: "Predicts important topics",
    desc: "Upload past exam papers. AI analyzes patterns and predicts which topics are most likely to appear.",
    gradient: "from-pink-500/20 to-purple-500/20",
    iconColor: "text-pink-300",
    category: "Insights",
  },
  {
    icon: Calendar,
    title: "Study Roadmap",
    tagline: "Personal day-by-day plan",
    desc: "Tell us your exam date and daily hours. AI builds a personalized study schedule covering every topic.",
    gradient: "from-emerald-500/20 to-cyan-500/20",
    iconColor: "text-emerald-300",
    category: "Study Tools",
  },
  {
    icon: Bot,
    title: "AI Tutor",
    tagline: "Your personal AI chatbot",
    desc: "Ask anything — general knowledge or PDF-specific. Voice input in English or Hindi. Image analysis too.",
    gradient: "from-pink-500/20 to-purple-500/20",
    iconColor: "text-pink-300",
    category: "AI Tools",
  },
  {
    icon: Mic,
    title: "Voice Input + Replies",
    tagline: "Speak in Hindi or English",
    desc: "Talk to the AI instead of typing. AI can also speak its replies aloud — perfect for hands-free study.",
    gradient: "from-red-500/20 to-pink-500/20",
    iconColor: "text-red-300",
    category: "AI Tools",
  },
  {
    icon: ImageIcon,
    title: "Image Analysis",
    tagline: "Upload photos of your notes",
    desc: "Take a picture of a whiteboard or handwritten notes. AI reads it and answers questions about it.",
    gradient: "from-pink-500/20 to-purple-500/20",
    iconColor: "text-pink-300",
    category: "AI Tools",
  },
  {
    icon: Users,
    title: "Study Rooms",
    tagline: "Study with classmates in real-time",
    desc: "Create a room, share a code, study together. Same PDF, same page, chat, and synced lectures.",
    gradient: "from-cyan-500/20 to-blue-500/20",
    iconColor: "text-cyan-300",
    category: "Collaboration",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    tagline: "Track your progress + streaks",
    desc: "See how many PDFs, notes, and quizzes you've made. Track your day streak and stay motivated.",
    gradient: "from-purple-500/20 to-cyan-500/20",
    iconColor: "text-purple-300",
    category: "Insights",
  },
  {
    icon: Search,
    title: "Global Search",
    tagline: "Find anything instantly",
    desc: "Search across all PDFs, notes, flashcards, and predictions in one place. Results with source snippets.",
    gradient: "from-purple-500/20 to-pink-500/20",
    iconColor: "text-purple-300",
    category: "Insights",
  },
  {
    icon: Command,
    title: "Ctrl+K Command Palette",
    tagline: "Jump anywhere in 1 keystroke",
    desc: "Press Ctrl+K (or ⌘K) anywhere to open the command palette. Search across everything without clicking.",
    gradient: "from-cyan-500/20 to-emerald-500/20",
    iconColor: "text-cyan-300",
    category: "Power User",
  },
  {
    icon: Sparkles,
    title: "You're all set!",
    tagline: "Time to study smarter",
    desc: "Upload your first PDF and try any of these tools. Everything is free, fast, and works on any device.",
    gradient: "from-purple-500 to-cyan-500",
    iconColor: "text-white",
    category: "Done",
  },
];

export default function FeatureTour() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  // Listen for the "start-feature-tour" event from welcome banner
  useEffect(() => {
    function handleStart() {
      setIndex(0);
      setOpen(true);
    }
    window.addEventListener("start-feature-tour", handleStart);
    return () => window.removeEventListener("start-feature-tour", handleStart);
  }, []);

  // Keyboard navigation
  const next = useCallback(() => {
    setDirection(1);
    setIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1));
  }, []);

  const prev = useCallback(() => {
    setDirection(-1);
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("nexel-tour-completed", "true");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, close, next, prev]);

  const step = TOUR_STEPS[index];
  const Icon = step.icon;
  const progress = ((index + 1) / TOUR_STEPS.length) * 100;
  const isLast = index === TOUR_STEPS.length - 1;
  const isFirst = index === 0;

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 60 : -60,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -60 : 60,
      opacity: 0,
    }),
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md"
            onClick={close}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-2xl glass rounded-3xl p-8 md:p-10 pointer-events-auto overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={close}
                className="absolute top-4 right-4 text-gray-500 hover:text-white p-2 z-10 transition-colors"
                aria-label="Close tour"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Progress bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>

              {/* Counter */}
              <div className="text-xs text-gray-500 mb-6 font-mono">
                {String(index + 1).padStart(2, "0")} / {String(TOUR_STEPS.length).padStart(2, "0")}
              </div>

              {/* Animated content */}
              <div className="relative min-h-[280px] flex items-center justify-center">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={index}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="w-full text-center"
                  >
                    {/* Icon */}
                    <div
                      className={`w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br ${step.gradient} border border-white/10 flex items-center justify-center mb-6 shadow-2xl`}
                    >
                      <Icon className={`w-10 h-10 ${step.iconColor}`} />
                    </div>

                    {/* Category badge */}
                    <div className="inline-block px-3 py-1 rounded-full glass text-[10px] uppercase tracking-wider font-semibold text-purple-300 mb-3">
                      {step.category}
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                      {step.title}
                    </h2>

                    {/* Tagline */}
                    <p className="text-sm md:text-base text-cyan-300 font-medium mb-4">
                      {step.tagline}
                    </p>

                    {/* Description */}
                    <p className="text-sm md:text-base text-gray-400 leading-relaxed max-w-md mx-auto">
                      {step.desc}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Controls */}
              <div className="mt-8 flex items-center justify-between gap-3 flex-wrap">
                <button
                  onClick={close}
                  className="text-sm text-gray-500 hover:text-gray-300 px-3 py-2 transition-colors"
                >
                  Skip tour
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={prev}
                    disabled={isFirst}
                    className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white px-4 py-2 rounded-lg glass hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </button>

                  {isLast ? (
                    <button
                      onClick={close}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                    >
                      Let&apos;s go!
                      <Sparkles className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={next}
                      className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Keyboard hints */}
              <div className="mt-4 flex items-center justify-center gap-3 text-[10px] text-gray-600">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-500">
                    ←
                  </kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-500">
                    →
                  </kbd>
                  navigate
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-500">
                    Esc
                  </kbd>
                  close
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}