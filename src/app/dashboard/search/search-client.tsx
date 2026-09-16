"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  FileText,
  StickyNote,
  Brain,
  GraduationCap,
  Target,
  Loader2,
  ArrowRight,
  X,
  TrendingUp,
  Clock,
  Sparkles,
} from "lucide-react";

type Result = {
  type: "note" | "chunk" | "prediction" | "quiz" | "flashcard";
  id: string;
  title: string;
  snippet: string;
  meta: string;
  link: string;
  score: number;
};

const TYPE_CONFIG: Record<
  string,
  { icon: typeof FileText; color: string; bgColor: string; label: string }
> = {
  note: {
    icon: StickyNote,
    color: "text-yellow-300",
    bgColor: "from-yellow-500/20 to-orange-500/20",
    label: "Note",
  },
  chunk: {
    icon: FileText,
    color: "text-purple-300",
    bgColor: "from-purple-500/20 to-cyan-500/20",
    label: "PDF Content",
  },
  prediction: {
    icon: Target,
    color: "text-pink-300",
    bgColor: "from-pink-500/20 to-purple-500/20",
    label: "Prediction",
  },
  flashcard: {
    icon: GraduationCap,
    color: "text-cyan-300",
    bgColor: "from-cyan-500/20 to-blue-500/20",
    label: "Flashcard",
  },
  quiz: {
    icon: Brain,
    color: "text-orange-300",
    bgColor: "from-orange-500/20 to-red-500/20",
    label: "Quiz",
  },
};

const SUGGESTIONS = [
  "HTTP methods",
  "malware",
  "session management",
  "CSS layout",
  "JavaScript",
];

export default function SearchClient() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [sort, setSort] = useState<"relevance" | "type">("relevance");
  const [history, setHistory] = useState<string[]>([]);

  // Load history from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("nexel-search-history");
    if (stored) {
      try {
        setHistory(JSON.parse(stored).slice(0, 8));
      } catch {}
    }
  }, []);

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Perform search
  const performSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setResults(data.results || []);

      // Save to history
      if (q.trim().length >= 3) {
        const updated = [q.trim(), ...history.filter((h) => h !== q.trim())].slice(0, 8);
        setHistory(updated);
        localStorage.setItem("nexel-search-history", JSON.stringify(updated));
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [history]);

  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  // Filter + sort
  const filtered = results
    .filter((r) => filter === "all" || r.type === filter)
    .sort((a, b) => {
      if (sort === "relevance") return b.score - a.score;
      return a.type.localeCompare(b.type);
    });

  // Counts by type
  const counts = results.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem("nexel-search-history");
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="glass rounded-2xl p-2 flex items-center gap-3">
        <Search className="w-5 h-5 text-gray-500 ml-3 flex-shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes, PDFs, flashcards, predictions..."
          className="flex-1 bg-transparent text-white text-base placeholder-gray-500 focus:outline-none py-3"
          autoFocus
        />
        {loading && <Loader2 className="w-5 h-5 text-purple-300 animate-spin mr-2" />}
        {query && !loading && (
          <button
            onClick={() => setQuery("")}
            className="text-gray-500 hover:text-white p-2 mr-2"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Empty state - suggestions + history */}
      {query.trim().length < 2 && (
        <div className="space-y-6">
          {history.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-semibold text-white">
                    Recent searches
                  </span>
                </div>
                <button
                  onClick={clearHistory}
                  className="text-xs text-gray-500 hover:text-red-400"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => setQuery(h)}
                    className="px-3 py-1.5 rounded-lg glass text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-all"
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-purple-300" />
              <span className="text-sm font-semibold text-white">
                Try searching for
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(s)}
                  className="px-3 py-1.5 rounded-lg glass text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
                >
                  <TrendingUp className="w-3 h-3" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {query.trim().length >= 2 && (
        <>
          {/* Filters */}
          <div className="glass rounded-2xl p-3 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === "all"
                  ? "bg-gradient-to-r from-purple-600 to-cyan-500 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              All ({results.length})
            </button>
            {Object.entries(counts).map(([type, count]) => {
              const cfg = TYPE_CONFIG[type];
              if (!cfg) return null;
              return (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                    filter === type
                      ? "bg-gradient-to-r from-purple-600 to-cyan-500 text-white"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <cfg.icon className={`w-3 h-3 ${filter === type ? "" : cfg.color}`} />
                  {cfg.label} ({count})
                </button>
              );
            })}

            <div className="flex-1" />

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "relevance" | "type")}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500/50 cursor-pointer"
            >
              <option value="relevance" className="bg-slate-900">
                Sort: Relevance
              </option>
              <option value="type" className="bg-slate-900">
                Sort: Type
              </option>
            </select>
          </div>

          {/* No results */}
          {!loading && filtered.length === 0 && (
            <div className="glass rounded-2xl p-12 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-gray-500" />
              </div>
              <h3 className="text-white font-medium mb-1">No results found</h3>
              <p className="text-sm text-gray-500">
                Try different keywords or check the filter
              </p>
            </div>
          )}

          {/* Result cards */}
          <div className="space-y-3">
            <AnimatePresence>
              {filtered.map((r, i) => {
                const cfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.chunk;
                const Icon = cfg.icon;
                return (
                  <motion.div
                    key={`${r.type}-${r.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  >
                    <Link
                      href={r.link}
                      className="block glass rounded-2xl p-5 hover:bg-white/[0.08] transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-11 h-11 rounded-xl bg-gradient-to-br ${cfg.bgColor} border border-white/10 flex items-center justify-center flex-shrink-0`}
                        >
                          <Icon className={`w-5 h-5 ${cfg.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-xs font-semibold ${cfg.color}`}
                            >
                              {cfg.label}
                            </span>
                            <span className="text-xs text-gray-500 truncate">
                              {r.meta}
                            </span>
                          </div>
                          <h3 className="text-base text-white font-medium mb-1 line-clamp-1">
                            {r.title}
                          </h3>
                          <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">
                            {r.snippet}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-purple-300 transition-colors flex-shrink-0 mt-3" />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Results count */}
          {filtered.length > 0 && (
            <div className="text-center text-xs text-gray-500 pt-2">
              Showing {filtered.length} of {results.length} results
            </div>
          )}
        </>
      )}
    </div>
  );
}