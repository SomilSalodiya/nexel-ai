"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  FileText,
  ChevronRight,
  X,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  Sparkles,
  Target,
  Trash2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Award,
  Lightbulb,
  GraduationCap,
} from "lucide-react";

type Pdf = {
  name: string;
  fullPath: string;
  displayName: string;
};

type DayPlan = {
  day: number;
  date: string;
  focus: string;
  topics: string[];
  tasks: string[];
  estimatedMinutes: number;
  resources: {
    type: "read" | "notes" | "quiz" | "flashcards" | "lecture" | "review";
    description: string;
  }[];
  isReviewDay: boolean;
};

type Progress = {
  day_number: number;
  completed: boolean;
  notes?: string;
};

type Roadmap = {
  id: number;
  file_name: string;
  exam_date: string;
  hours_per_day: number;
  total_days: number;
  plan: DayPlan[];
  progress: Progress[];
  completedDays: number;
  totalDays: number;
  percentComplete: number;
  created_at: string;
};

type Phase = "list" | "creating" | "generating" | "viewing" | "error";

const RESOURCE_ICONS: Record<string, typeof BookOpen> = {
  read: BookOpen,
  notes: Sparkles,
  quiz: Target,
  flashcards: GraduationCap,
  lecture: Lightbulb,
  review: RotateCcw,
};

const RESOURCE_LABELS: Record<string, string> = {
  read: "Read PDF",
  notes: "AI Notes",
  quiz: "Quiz",
  flashcards: "Flashcards",
  lecture: "Lecture",
  review: "Review",
};

export default function RoadmapClient({ pdfs }: { pdfs: Pdf[] }) {
  const [phase, setPhase] = useState<Phase>("list");
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentRoadmap, setCurrentRoadmap] = useState<Roadmap | null>(null);

  const [selectedPdf, setSelectedPdf] = useState<Pdf | null>(null);
  const [examDate, setExamDate] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState(2);
  const [generating, setGenerating] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(1);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/roadmap/progress");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setRoadmaps(data.roadmaps || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setExamDate(d.toISOString().slice(0, 10));
  }, []);

  async function generateRoadmap() {
    if (!selectedPdf || !examDate) return;

    const exam = new Date(examDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (exam <= today) {
      setError("Exam date must be in the future");
      return;
    }

    setGenerating(true);
    setError("");
    setPhase("generating");

    try {
      const res = await fetch("/api/roadmap/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: selectedPdf.fullPath,
          fileName: selectedPdf.displayName,
          examDate,
          hoursPerDay,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      const listRes = await fetch("/api/roadmap/progress");
      const listData = await listRes.json();
      setRoadmaps(listData.roadmaps || []);

      const newRm = (listData.roadmaps || []).find(
        (r: Roadmap) => r.id === data.roadmap.id
      );
      if (newRm) {
        setCurrentRoadmap(newRm);
        setPhase("viewing");
      } else {
        setPhase("list");
      }

      setSelectedPdf(null);
      setExpandedDay(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setPhase("error");
    } finally {
      setGenerating(false);
    }
  }

  async function toggleDay(roadmapId: number, dayNumber: number, current: boolean) {
    try {
      const res = await fetch("/api/roadmap/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roadmapId,
          dayNumber,
          completed: !current,
        }),
      });

      if (!res.ok) throw new Error("Update failed");

      setRoadmaps((prev) =>
        prev.map((r) => {
          if (r.id !== roadmapId) return r;
          const newProgress = r.progress.map((p) =>
            p.day_number === dayNumber ? { ...p, completed: !current } : p
          );
          const completed = newProgress.filter((p) => p.completed).length;
          return {
            ...r,
            progress: newProgress,
            completedDays: completed,
            percentComplete: Math.round((completed / newProgress.length) * 100),
          };
        })
      );

      setCurrentRoadmap((prev) => {
        if (!prev || prev.id !== roadmapId) return prev;
        const newProgress = prev.progress.map((p) =>
          p.day_number === dayNumber ? { ...p, completed: !current } : p
        );
        const completed = newProgress.filter((p) => p.completed).length;
        return {
          ...prev,
          progress: newProgress,
          completedDays: completed,
          percentComplete: Math.round((completed / newProgress.length) * 100),
        };
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteRoadmap(id: number) {
    if (!confirm("Delete this roadmap?")) return;
    try {
      const res = await fetch(`/api/roadmap/progress?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setRoadmaps((prev) => prev.filter((r) => r.id !== id));
      if (currentRoadmap?.id === id) {
        setCurrentRoadmap(null);
        setPhase("list");
      }
    } catch (err) {
      console.error(err);
    }
  }

  function daysUntil(dateStr: string): number {
    const target = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  if (loading) {
    return (
      <div className="glass rounded-2xl p-16 text-center">
        <Loader2 className="w-8 h-8 text-purple-300 animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-400">Loading roadmaps...</p>
      </div>
    );
  }

  if (phase === "generating") {
    return (
      <div className="glass rounded-2xl p-16 text-center">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-6">
          <Loader2 className="w-10 h-10 text-purple-300 animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">
          Building your roadmap
        </h2>
        <p className="text-gray-400 mb-8">
          AI is analyzing your PDF and creating a personalized study plan...
        </p>
        <p className="text-xs text-gray-500">This takes 1-2 minutes</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <X className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Couldn&apos;t generate roadmap
        </h2>
        <p className="text-sm text-red-400 mb-6">{error}</p>
        <button
          onClick={() => {
            setPhase("list");
            setError("");
          }}
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg transition-all"
        >
          Try again
        </button>
      </div>
    );
  }

  if (phase === "creating" || (!currentRoadmap && roadmaps.length === 0)) {
    return (
      <div className="space-y-6">
        {pdfs.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-500 mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No PDFs yet</h2>
            <p className="text-gray-400 text-sm mb-6">
              Upload a PDF first to create a study roadmap.
            </p>
          </div>
        ) : (
          <>
            <div className="glass rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-300" />
                Which PDF do you want to study?
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pdfs.map((pdf) => (
                  <button
                    key={pdf.name}
                    onClick={() => setSelectedPdf(pdf)}
                    className={`w-full text-left p-3 rounded-lg transition-all flex items-center gap-3 ${
                      selectedPdf?.name === pdf.name
                        ? "bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/40"
                        : "bg-white/5 hover:bg-white/10 border border-white/5"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-purple-300" />
                    </div>
                    <span className="text-sm text-gray-200 truncate">
                      {pdf.displayName}
                    </span>
                    {selectedPdf?.name === pdf.name && (
                      <CheckCircle2 className="w-4 h-4 text-purple-400 ml-auto flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass rounded-2xl p-6 space-y-5">
              <div>
                <label className="text-sm text-gray-300 mb-2 block font-medium flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-purple-300" />
                  Exam date
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 [color-scheme:dark]"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {examDate && daysUntil(examDate) > 0
                    ? `${daysUntil(examDate)} days from today`
                    : "Pick a future date"}
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-300 mb-2 block font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-300" />
                  Hours available per day
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6].map((h) => (
                    <button
                      key={h}
                      onClick={() => setHoursPerDay(h)}
                      className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all ${
                        hoursPerDay === h
                          ? "bg-gradient-to-r from-purple-600 to-cyan-500 text-white"
                          : "bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5"
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              onClick={generateRoadmap}
              disabled={!selectedPdf || !examDate || generating}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Study Roadmap
                </>
              )}
            </button>
          </>
        )}
      </div>
    );
  }

  if (currentRoadmap) {
    const daysLeft = daysUntil(currentRoadmap.exam_date);

    return (
      <div className="space-y-6">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {currentRoadmap.file_name.replace(/^\d+-/, "")}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  Exam in {daysLeft} {daysLeft === 1 ? "day" : "days"}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {currentRoadmap.hours_per_day}h/day
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white">
                Your Study Plan
              </h2>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  if (confirm("Start a new roadmap?")) {
                    setCurrentRoadmap(null);
                    setPhase("creating");
                    setSelectedPdf(null);
                  }
                }}
                className="text-xs text-gray-300 hover:text-white px-3 py-2 rounded-lg glass hover:bg-white/10 transition-all"
              >
                New Plan
              </button>
              <button
                onClick={() => deleteRoadmap(currentRoadmap.id)}
                className="text-xs text-gray-400 hover:text-red-400 px-3 py-2 rounded-lg glass hover:bg-red-500/10 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">
                {currentRoadmap.completedDays} of {currentRoadmap.totalDays} days
                completed
              </span>
              <span className="text-purple-300 font-semibold">
                {currentRoadmap.percentComplete}%
              </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
                initial={{ width: 0 }}
                animate={{ width: `${currentRoadmap.percentComplete}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {currentRoadmap.plan.map((day) => {
            const progress = currentRoadmap.progress.find(
              (p) => p.day_number === day.day
            );
            const isCompleted = progress?.completed || false;
            const isExpanded = expandedDay === day.day;
            const dayDate = new Date(day.date);
            const isPast = dayDate < new Date();
            const isToday =
              dayDate.toDateString() === new Date().toDateString();

            return (
              <motion.div
                key={day.day}
                layout
                className={`glass rounded-2xl overflow-hidden transition-all ${
                  isCompleted ? "border border-green-500/30" : ""
                } ${isToday ? "border border-purple-500/40" : ""}`}
              >
                <div
                  onClick={() => setExpandedDay(isExpanded ? null : day.day)}
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-white/[0.04] transition-all cursor-pointer"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDay(currentRoadmap.id, day.day, isCompleted);
                    }}
                    className="flex-shrink-0"
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-500 hover:text-purple-400 transition-colors" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold text-purple-300">
                        Day {day.day}
                      </span>
                      {day.isReviewDay && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">
                          REVIEW
                        </span>
                      )}
                      {isToday && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                          TODAY
                        </span>
                      )}
                      {!isCompleted && isPast && !isToday && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-sm font-medium truncate ${
                        isCompleted
                          ? "text-green-300 line-through"
                          : "text-white"
                      }`}
                    >
                      {day.focus}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-gray-500">
                      {day.estimatedMinutes} min
                    </div>
                    <div className="text-[10px] text-gray-600 mt-0.5">
                      {dayDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  )}
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-4">
                        {day.topics.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                              Topics
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {day.topics.map((t, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-1 rounded-md bg-purple-500/10 text-purple-200 border border-purple-500/20"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {day.tasks.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                              Tasks
                            </div>
                            <ul className="space-y-1.5">
                              {day.tasks.map((t, i) => (
                                <li
                                  key={i}
                                  className="text-sm text-gray-300 flex items-start gap-2"
                                >
                                  <span className="text-purple-400 mt-1 text-xs">
                                    ▸
                                  </span>
                                  <span>{t}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {day.resources.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                              Actions in Nexel AI
                            </div>
                            <div className="space-y-1.5">
                              {day.resources.map((r, i) => {
                                const Icon = RESOURCE_ICONS[r.type] || Sparkles;
                                return (
                                  <div
                                    key={i}
                                    className="text-xs text-gray-300 flex items-center gap-2 glass rounded-lg px-3 py-2"
                                  >
                                    <Icon className="w-3.5 h-3.5 text-cyan-300" />
                                    <span className="font-medium text-cyan-300">
                                      {RESOURCE_LABELS[r.type] || r.type}:
                                    </span>
                                    <span className="truncate">
                                      {r.description}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        <div className="glass rounded-2xl p-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Award className="w-5 h-5 text-yellow-300" />
            <span className="text-sm font-semibold text-white">
              {currentRoadmap.percentComplete >= 75
                ? "You're crushing it! 💪"
                : currentRoadmap.percentComplete >= 50
                ? "Great progress — keep going! 🔥"
                : currentRoadmap.percentComplete >= 25
                ? "Building momentum! 🚀"
                : currentRoadmap.percentComplete > 0
                ? "Every day counts! ⭐"
                : "Ready when you are! 🎯"}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {daysLeft > 0
              ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left until your exam.`
              : "Exam day is here — good luck!"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setPhase("creating")}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all flex items-center justify-center gap-2"
      >
        <Sparkles className="w-5 h-5" />
        Create New Roadmap
      </button>

      {roadmaps.map((rm) => {
        const daysLeft = daysUntil(rm.exam_date);
        return (
          <motion.div
            key={rm.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-5 hover:bg-white/[0.08] transition-all cursor-pointer group"
            onClick={() => {
              setCurrentRoadmap(rm);
              setPhase("viewing");
              setExpandedDay(1);
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-500 mb-1">
                  {rm.file_name.replace(/^\d+-/, "")}
                </div>
                <div className="text-sm font-semibold text-white mb-1">
                  {rm.total_days}-day study plan
                </div>
                <div className="text-xs text-gray-400">
                  Exam in {daysLeft} {daysLeft === 1 ? "day" : "days"} ·{" "}
                  {rm.hours_per_day}h/day
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-purple-300 transition-colors flex-shrink-0 mt-2" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  {rm.completedDays}/{rm.totalDays} days
                </span>
                <span className="text-purple-300 font-semibold">
                  {rm.percentComplete}%
                </span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
                  style={{ width: `${rm.percentComplete}%` }}
                />
              </div>
            </div>
          </motion.div>
        );
      })}

      {roadmaps.length === 0 && (
        <div className="glass rounded-2xl p-12 text-center">
          <CalendarIcon className="w-12 h-12 mx-auto text-gray-500 mb-4" />
          <h3 className="text-white font-semibold mb-2">
            No roadmaps yet
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            Create your first personalized study plan above.
          </p>
        </div>
      )}
    </div>
  );
}