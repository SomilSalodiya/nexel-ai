"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Loader2,
  X,
  Check,
  TrendingUp,
  Award,
  Brain,
  Lightbulb,
  FileText,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

type Pdf = {
  name: string;
  fullPath: string;
  displayName: string;
};

type Topic = {
  rank: number;
  topic: string;
  frequency: string;
  confidence: number;
  avgMarks: number;
  questionTypes: string[];
  reasoning: string;
  exampleQuestions: string[];
};

type PredictedQuestion = {
  topic: string;
  question: string;
  confidence: number;
  suggestedAnswer: string;
};

type Prediction = {
  totalPapersAnalyzed: number;
  summary: string;
  topics: Topic[];
  predictedQuestions: PredictedQuestion[];
  studyStrategy: string[];
};

type Phase = "select" | "analyzing" | "report" | "error";

export default function ExamPredictor({ pdfs }: { pdfs: Pdf[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>("select");
  const [error, setError] = useState("");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [reportTitle, setReportTitle] = useState("");
  const [activeTab, setActiveTab] = useState<"topics" | "questions" | "strategy">("topics");

  function toggle(filePath: string) {
    const next = new Set(selected);
    if (next.has(filePath)) next.delete(filePath);
    else if (next.size < 8) next.add(filePath);
    setSelected(next);
  }

  async function analyze() {
    if (selected.size < 2) {
      setError("Select at least 2 papers");
      return;
    }

    setPhase("analyzing");
    setError("");

    const paths = Array.from(selected);
    const names = paths.map(
      (p) => pdfs.find((pdf) => pdf.fullPath === p)?.displayName || "Paper"
    );

    try {
      const res = await fetch("/api/exam/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePaths: paths,
          fileNames: names,
          title: `Exam Prediction — ${new Date().toLocaleDateString()}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");

      setPrediction(data.prediction);
      setReportTitle(data.title);
      setPhase("report");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setPhase("error");
    }
  }

  function reset() {
    setSelected(new Set());
    setPhase("select");
    setPrediction(null);
    setError("");
  }

  // ==== SELECT PHASE ====
  if (phase === "select") {
    return (
      <div>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="text-sm font-semibold text-white">
              Select exam papers to analyze
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {selected.size} of 8 selected · min 2, max 8
            </div>
          </div>
          <button
            onClick={analyze}
            disabled={selected.size < 2}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Target className="w-4 h-4" />
            Generate Prediction
          </button>
        </div>

        <div className="space-y-2">
          {pdfs.map((pdf) => {
            const isSelected = selected.has(pdf.fullPath);
            return (
              <button
                key={pdf.name}
                onClick={() => toggle(pdf.fullPath)}
                className={`w-full glass rounded-xl p-4 text-left transition-all flex items-center gap-3 ${
                  isSelected
                    ? "bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/40"
                    : "hover:bg-white/5 border border-white/5"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected
                      ? "bg-gradient-to-br from-purple-500 to-cyan-500"
                      : "bg-white/5 border border-white/10"
                  }`}
                >
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </div>
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-purple-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white font-medium truncate">
                    {pdf.displayName}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            {error}
          </div>
        )}
      </div>
    );
  }

  // ==== ANALYZING PHASE ====
  if (phase === "analyzing") {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-6">
          <Loader2 className="w-10 h-10 text-purple-300 animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">
          Analyzing exam patterns
        </h2>
        <p className="text-gray-400 mb-6">
          Reading {selected.size} papers and detecting repeated topics...
        </p>
        <p className="text-xs text-gray-500">
          This takes 30-60 seconds. Don&apos;t close this tab.
        </p>
      </div>
    );
  }

  // ==== ERROR PHASE ====
  if (phase === "error") {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <X className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Prediction failed
        </h2>
        <p className="text-sm text-red-400 mb-6">{error}</p>
        <button
          onClick={reset}
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
        >
          Try again
        </button>
      </div>
    );
  }

  // ==== REPORT PHASE ====
  if (!prediction) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-2xl p-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-5 h-5 text-yellow-300" />
            <span className="text-xs text-yellow-300 font-semibold tracking-wider">
              PREDICTION REPORT
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white">
            {reportTitle}
          </h2>
          <p className="text-sm text-gray-400 mt-2 max-w-2xl">
            {prediction.summary}
          </p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-2 text-sm text-gray-300 hover:text-white px-4 py-2 rounded-lg glass hover:bg-white/10 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          New analysis
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-2xl md:text-3xl font-bold glow-text">
            {prediction.totalPapersAnalyzed}
          </div>
          <div className="text-xs text-gray-400 mt-1">Papers analyzed</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-2xl md:text-3xl font-bold glow-text">
            {prediction.topics.length}
          </div>
          <div className="text-xs text-gray-400 mt-1">Hot topics detected</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-2xl md:text-3xl font-bold glow-text">
            {prediction.predictedQuestions.length}
          </div>
          <div className="text-xs text-gray-400 mt-1">Predicted questions</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass rounded-2xl p-1 flex gap-1">
        <button
          onClick={() => setActiveTab("topics")}
          className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === "topics"
              ? "bg-gradient-to-r from-purple-600 to-cyan-500 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Hot Topics
        </button>
        <button
          onClick={() => setActiveTab("questions")}
          className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === "questions"
              ? "bg-gradient-to-r from-purple-600 to-cyan-500 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Brain className="w-4 h-4" />
          Predicted Questions
        </button>
        <button
          onClick={() => setActiveTab("strategy")}
          className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === "strategy"
              ? "bg-gradient-to-r from-purple-600 to-cyan-500 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          Study Strategy
        </button>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {/* TOPICS TAB */}
          {activeTab === "topics" && (
            <div className="space-y-3">
              {prediction.topics.map((topic, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="glass rounded-2xl p-5 hover:bg-white/[0.08] transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold glow-text">
                        #{topic.rank}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-white">
                          {topic.topic}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="px-2.5 py-1 rounded-md bg-green-500/15 border border-green-500/30 text-green-300 text-xs font-semibold">
                            {topic.confidence}% confidence
                          </div>
                          <div className="px-2.5 py-1 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
                            ~{topic.avgMarks} marks
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-400 mb-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {topic.frequency}
                        </span>
                        {topic.questionTypes && topic.questionTypes.length > 0 && (
                          <span>· {topic.questionTypes.join(", ")}</span>
                        )}
                      </div>

                      <p className="text-sm text-gray-300 mb-3">
                        {topic.reasoning}
                      </p>

                      {/* Confidence bar */}
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-4">
                        <motion.div
                          className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${topic.confidence}%` }}
                          transition={{ delay: 0.3 + i * 0.1, duration: 0.8 }}
                        />
                      </div>

                      {/* Example questions */}
                      {topic.exampleQuestions && topic.exampleQuestions.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                            Previously asked:
                          </div>
                          {topic.exampleQuestions.slice(0, 3).map((q, qi) => (
                            <div
                              key={qi}
                              className="text-xs text-gray-300 bg-white/5 border border-white/5 rounded-lg px-3 py-2 flex items-start gap-2"
                            >
                              <ChevronRight className="w-3 h-3 mt-0.5 text-purple-400 flex-shrink-0" />
                              <span>{q}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* QUESTIONS TAB */}
          {activeTab === "questions" && (
            <div className="space-y-3">
              {prediction.predictedQuestions.map((pq, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="glass rounded-2xl p-5"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                      <Brain className="w-5 h-5 text-pink-300" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs text-purple-300 font-semibold">
                          {pq.topic}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-pink-500/15 text-pink-300 font-semibold">
                          {pq.confidence}% likely
                        </span>
                      </div>
                      <p className="text-base text-white font-medium leading-relaxed">
                        {pq.question}
                      </p>
                    </div>
                  </div>

                  <div className="ml-13 pl-13" style={{ marginLeft: "52px" }}>
                    <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">
                      Suggested answer outline:
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {pq.suggestedAnswer}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* STRATEGY TAB */}
          {activeTab === "strategy" && (
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Lightbulb className="w-6 h-6 text-yellow-300" />
                <h3 className="text-lg font-semibold text-white">
                  Your study strategy
                </h3>
              </div>
              <div className="space-y-3">
                {prediction.studyStrategy.map((tip, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-yellow-500/5 to-transparent border border-yellow-500/10"
                  >
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-yellow-500/30 to-orange-500/30 border border-yellow-500/30 flex items-center justify-center flex-shrink-0 text-xs font-bold text-yellow-300">
                      {i + 1}
                    </div>
                    <p className="text-sm text-gray-200 leading-relaxed pt-1">
                      {tip}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}