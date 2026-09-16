"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  StickyNote,
  GraduationCap,
  Target,
  Flame,
  TrendingUp,
  BarChart3,
  Loader2,
  Award,
  Layers,
} from "lucide-react";

type Stats = {
  pdfs: number;
  notes: number;
  chunks: number;
  flashcards: number;
  predictions: number;
  streak: number;
};

type ActivityPoint = { date: string; count: number };
type TopFile = { name: string; count: number };
type Breakdown = { label: string; value: number };

type AnalyticsData = {
  stats: Stats;
  activity: ActivityPoint[];
  topFiles: TopFile[];
  contentBreakdown: Breakdown[];
};

const COLORS = ["#a855f7", "#22d3ee", "#f472b6", "#facc15", "#34d399"];

export default function AnalyticsClient() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/analytics");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setData(json);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="glass rounded-2xl p-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-4">
          <Loader2 className="w-8 h-8 text-purple-300 animate-spin" />
        </div>
        <p className="text-gray-400 text-sm">Loading your analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <p className="text-sm text-red-400">{error || "Could not load analytics"}</p>
      </div>
    );
  }

  const { stats, activity, topFiles, contentBreakdown } = data;
  const maxActivity = Math.max(...activity.map((a) => a.count), 1);
  const totalContent = contentBreakdown.reduce((s, b) => s + b.value, 0);

  // Stat cards config
  const statCards = [
    {
      label: "PDFs Uploaded",
      value: stats.pdfs,
      icon: FileText,
      color: "from-purple-500/20 to-cyan-500/20",
      iconColor: "text-purple-300",
    },
    {
      label: "Notes Created",
      value: stats.notes,
      icon: StickyNote,
      color: "from-yellow-500/20 to-orange-500/20",
      iconColor: "text-yellow-300",
    },
    {
      label: "PDF Chunks",
      value: stats.chunks,
      icon: Layers,
      color: "from-cyan-500/20 to-blue-500/20",
      iconColor: "text-cyan-300",
    },
    {
      label: "Flashcards",
      value: stats.flashcards,
      icon: GraduationCap,
      color: "from-pink-500/20 to-purple-500/20",
      iconColor: "text-pink-300",
    },
    {
      label: "Predictions",
      value: stats.predictions,
      icon: Target,
      color: "from-pink-500/20 to-red-500/20",
      iconColor: "text-pink-300",
    },
    {
      label: "Day Streak",
      value: stats.streak,
      icon: Flame,
      color: "from-orange-500/20 to-red-500/20",
      iconColor: "text-orange-300",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="glass rounded-2xl p-4 hover:bg-white/[0.08] transition-all"
            >
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} border border-white/10 flex items-center justify-center mb-3`}
              >
                <Icon className={`w-5 h-5 ${s.iconColor}`} />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-white">
                {s.value}
              </div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Activity chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-5 h-5 text-purple-300" />
          <h2 className="text-lg font-semibold text-white">
            Activity — Last 14 Days
          </h2>
        </div>

        <div className="flex items-end justify-between gap-2 h-40">
          {activity.map((a, i) => {
            const heightPct = (a.count / maxActivity) * 100;
            const dayLabel = new Date(a.date).toLocaleDateString("en-US", {
              weekday: "short",
            }).slice(0, 2);
            const dateNum = a.date.slice(8, 10);
            return (
              <div key={i} className="flex flex-col items-center flex-1 gap-2">
                <div className="w-full flex-1 flex items-end relative group">
                  <motion.div
                    className={`w-full rounded-t-lg ${
                      a.count > 0
                        ? "bg-gradient-to-t from-purple-600 to-cyan-500"
                        : "bg-white/5"
                    }`}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(heightPct, a.count > 0 ? 8 : 2)}%` }}
                    transition={{ delay: 0.4 + i * 0.03, duration: 0.5 }}
                  />
                  {a.count > 0 && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded bg-black/90 text-white text-xs whitespace-nowrap pointer-events-none">
                      {a.count} actions
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 leading-tight text-center">
                  <div>{dayLabel}</div>
                  <div className="text-gray-600">{dateNum}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 text-xs text-gray-500">
          Total actions: {activity.reduce((s, a) => s + a.count, 0)}
        </div>
      </motion.div>

      {/* Two-column: Content breakdown + Top files */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Content breakdown (donut) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-5 h-5 text-cyan-300" />
            <h2 className="text-lg font-semibold text-white">
              Content Breakdown
            </h2>
          </div>

          {contentBreakdown.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No content yet — upload a PDF to get started
            </p>
          ) : (
            <div className="flex items-center gap-6">
              {/* Donut */}
              <div className="relative flex-shrink-0">
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <circle
                    cx="70"
                    cy="70"
                    r="50"
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="20"
                  />
                  {(() => {
                    let offset = 0;
                    const circumference = 2 * Math.PI * 50;
                    return contentBreakdown.map((b, i) => {
                      const pct = b.value / totalContent;
                      const dash = pct * circumference;
                      const gap = circumference - dash;
                      const el = (
                        <motion.circle
                          key={i}
                          cx="70"
                          cy="70"
                          r="50"
                          fill="none"
                          stroke={COLORS[i % COLORS.length]}
                          strokeWidth="20"
                          strokeDasharray={`${dash} ${gap}`}
                          strokeDashoffset={-offset}
                          transform="rotate(-90 70 70)"
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{ delay: 0.6 + i * 0.15, duration: 0.6 }}
                          strokeLinecap="butt"
                        />
                      );
                      offset += dash;
                      return el;
                    });
                  })()}
                  <text
                    x="70"
                    y="70"
                    textAnchor="middle"
                    dy="0.35em"
                    className="fill-white"
                    style={{ fontSize: "22px", fontWeight: "bold" }}
                  >
                    {totalContent}
                  </text>
                </svg>
              </div>

              {/* Legend */}
              <div className="space-y-2 flex-1 min-w-0">
                {contentBreakdown.map((b, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-sm text-gray-200 truncate">
                      {b.label}
                    </span>
                    <span className="text-xs text-gray-500 ml-auto">
                      {b.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Top active files */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Award className="w-5 h-5 text-yellow-300" />
            <h2 className="text-lg font-semibold text-white">
              Most Studied PDFs
            </h2>
          </div>

          {topFiles.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No activity yet
            </p>
          ) : (
            <div className="space-y-3">
              {topFiles.map((f, i) => {
                const maxCount = topFiles[0].count;
                const pct = (f.count / maxCount) * 100;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-gray-200 truncate pr-2">
                        {f.name}
                      </span>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {f.count} {f.count === 1 ? "note" : "notes"}
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 1) % COLORS.length]})`,
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.8 + i * 0.1, duration: 0.6 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Motivational card */}
      {stats.streak > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="glass rounded-2xl p-6 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/30 to-red-500/30 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <Flame className="w-7 h-7 text-orange-300" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white mb-1">
                {stats.streak} {stats.streak === 1 ? "day" : "days"} in a row!
              </h3>
              <p className="text-sm text-gray-300">
                {stats.streak >= 7
                  ? "Amazing consistency! Keep it up. 🏆"
                  : stats.streak >= 3
                  ? "You're building a great habit! 🔥"
                  : "Every day counts. Keep going! 💪"}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}