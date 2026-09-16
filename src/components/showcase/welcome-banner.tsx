"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Play, ChevronRight, Rocket } from "lucide-react";
import Link from "next/link";

const STORAGE_KEY = "nexel-welcome-dismissed";
const TOUR_KEY = "nexel-tour-completed";

export default function WelcomeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      // Small delay so it doesn't flash on load
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  function handleDismiss() {
    setVisible(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
  }

  function startTour() {
    handleDismiss();
    // Trigger the tour via custom event
    window.dispatchEvent(new CustomEvent("start-feature-tour"));
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.98 }}
          transition={{ duration: 0.4 }}
          className="relative glass rounded-2xl p-5 mb-8 border border-purple-500/30 overflow-hidden"
        >
          {/* Animated gradient glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-cyan-500/10 to-purple-500/10 animate-pulse" />

          <div className="relative flex items-start gap-4">
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/30">
              <Rocket className="w-6 h-6 text-white" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Welcome to Nexel AI
                  <Sparkles className="w-4 h-4 text-purple-300" />
                </h2>
                <button
                  onClick={handleDismiss}
                  className="text-gray-500 hover:text-white p-1 flex-shrink-0 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm text-gray-300 mb-4 max-w-2xl">
                Upload any PDF and unlock{" "}
                <span className="text-purple-300 font-semibold">
                  16 AI-powered study tools
                </span>{" "}
                — notes, flashcards, quizzes, lectures, a personal AI tutor,
                and real-time study rooms.
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={startTour}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                >
                  <Play className="w-3 h-3" />
                  Take a quick tour
                </button>
                <Link
                  href="#features"
                  onClick={handleDismiss}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg glass text-gray-300 text-sm hover:text-white hover:bg-white/10 transition-all"
                >
                  See all features
                  <ChevronRight className="w-3 h-3" />
                </Link>
                <button
                  onClick={handleDismiss}
                  className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2 transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}