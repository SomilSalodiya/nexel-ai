"use client";
import HowItWorks from "@/components/showcase/how-it-works";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Zap, MessageSquare, Network } from "lucide-react";
import Link from "next/link";
import FeatureGrid from "@/components/showcase/feature-grid";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 grid-bg pointer-events-none" />

      {/* Floating orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-purple-500/20 blur-3xl animate-float" />
      <div
        className="absolute top-40 right-20 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl animate-float"
        style={{ animationDelay: "2s" }}
      />
      <div
        className="absolute bottom-20 left-1/3 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl animate-float"
        style={{ animationDelay: "4s" }}
      />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Nexel AI</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          <Link
            href="/login"
            className="text-sm text-gray-300 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="text-sm px-5 py-2 rounded-lg bg-white text-black font-medium hover:bg-gray-200 transition-all"
          >
            Get Started
          </Link>
        </motion.div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 pt-20 pb-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full text-sm text-gray-300 mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Introducing AI-Powered Workspaces
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tight leading-tight"
        >
          Transform PDFs into
          <br />
          <span className="glow-text">Interactive Knowledge.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-8 text-lg md:text-xl text-gray-400 max-w-2xl mx-auto"
        >
          Upload a PDF. Get AI notes, flashcards, quizzes, lectures, and a
          personal AI tutor. Study alone or with classmates — in real time.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/signup"
            className="group flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            Start Learning Free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="#features"
            className="px-8 py-4 rounded-xl glass text-white font-medium hover:bg-white/10 transition-all"
          >
            Explore Features
          </Link>
        </motion.div>

        {/* Quick highlights row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-3 text-xs text-gray-500"
        >
          <span className="flex items-center gap-1.5 glass px-3 py-1.5 rounded-full">
            <Zap className="w-3 h-3 text-purple-300" />
            AI-powered
          </span>
          <span className="flex items-center gap-1.5 glass px-3 py-1.5 rounded-full">
            <MessageSquare className="w-3 h-3 text-cyan-300" />
            Multi-modal
          </span>
          <span className="flex items-center gap-1.5 glass px-3 py-1.5 rounded-full">
            <Network className="w-3 h-3 text-pink-300" />
            Real-time
          </span>
        </motion.div>
      </section>

      {/* Feature Grid */}
      <FeatureGrid />
            {/* How It Works */}
      <HowItWorks />


      {/* CTA Section */}
      <section className="relative z-10 max-w-4xl mx-auto px-8 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass rounded-3xl p-12 md:p-16 border border-purple-500/20"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center mb-6 shadow-2xl shadow-purple-500/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to <span className="glow-text">study smarter?</span>
          </h2>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">
            Join and upload your first PDF. Get AI-powered notes, quizzes, and a
            full lecture in minutes.
          </p>
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            Start Free — No Credit Card
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-sm text-gray-500">
        <p>© 2025 Nexel AI — Built for learning.</p>
        <p className="text-xs text-gray-600 mt-2">
          AI-powered study workspace with 16+ features
        </p>
      </footer>
    </main>
  );
}