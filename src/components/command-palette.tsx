"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  Command,
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
  { icon: typeof FileText; color: string; label: string }
> = {
  note: { icon: StickyNote, color: "text-yellow-300", label: "Note" },
  chunk: { icon: FileText, color: "text-purple-300", label: "PDF Content" },
  prediction: { icon: Target, color: "text-pink-300", label: "Prediction" },
  flashcard: { icon: GraduationCap, color: "text-cyan-300", label: "Flashcard" },
  quiz: { icon: Brain, color: "text-orange-300", label: "Quiz" },
};

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ============ KEYBOARD SHORTCUT ============
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      // Escape
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  // Focus on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // ============ SEARCH (debounced) ============
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
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => performSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  // ============ KEYBOARD NAVIGATION ============
  function handleArrowDown() {
    if (results.length === 0) return;
    setSelectedIndex((i) => (i + 1) % results.length);
  }
  function handleArrowUp() {
    if (results.length === 0) return;
    setSelectedIndex((i) => (i - 1 + results.length) % results.length);
  }
  function handleEnter() {
    const r = results[selectedIndex];
    if (!r) return;
    router.push(r.link);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      handleArrowDown();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      handleArrowUp();
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleEnter();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[10vh] left-1/2 -translate-x-1/2 z-[101] w-[92vw] max-w-2xl"
          >
            <div className="glass rounded-2xl border border-white/10 shadow-2xl shadow-purple-500/20 overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5">
                <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Search notes, PDFs, flashcards, predictions..."
                  className="flex-1 bg-transparent text-white text-base placeholder-gray-500 focus:outline-none"
                />
                {loading && (
                  <Loader2 className="w-4 h-4 text-purple-300 animate-spin flex-shrink-0" />
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-500 hover:text-white p-1 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto">
                {query.trim().length < 2 && (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-3">
                      <Search className="w-6 h-6 text-purple-300" />
                    </div>
                    <p className="text-sm text-white font-medium mb-1">
                      Search across your workspace
                    </p>
                    <p className="text-xs text-gray-500">
                      Type 2+ characters to search notes, PDFs, flashcards, and more
                    </p>
                    <div className="mt-6 flex items-center justify-center gap-4 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-400 font-mono">
                          ↑↓
                        </kbd>
                        navigate
                      </span>
                      <span className="flex items-center gap-1.5">
                        <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-400 font-mono">
                          ↵
                        </kbd>
                        open
                      </span>
                      <span className="flex items-center gap-1.5">
                        <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-400 font-mono">
                          esc
                        </kbd>
                        close
                      </span>
                    </div>
                  </div>
                )}

                {query.trim().length >= 2 && !loading && results.length === 0 && (
                  <div className="p-8 text-center">
                    <p className="text-sm text-gray-400">
                      No results for &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-xs text-gray-600 mt-2">
                      Try different keywords
                    </p>
                  </div>
                )}

                {results.length > 0 && (
                  <div className="py-2">
                    {results.map((r, i) => {
                      const cfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.chunk;
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={`${r.type}-${r.id}`}
                          onMouseEnter={() => setSelectedIndex(i)}
                          onClick={() => {
                            router.push(r.link);
                            setOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                            i === selectedIndex
                              ? "bg-gradient-to-r from-purple-500/15 to-cyan-500/15"
                              : "hover:bg-white/5"
                          }`}
                        >
                          <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                            <Icon className={`w-4 h-4 ${cfg.color}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-xs font-semibold ${cfg.color}`}>
                                {cfg.label}
                              </span>
                              <span className="text-xs text-gray-500 truncate">
                                {r.meta}
                              </span>
                            </div>
                            <p className="text-sm text-white font-medium truncate">
                              {r.title}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                              {r.snippet}
                            </p>
                          </div>
                          {i === selectedIndex && (
                            <ArrowRight className="w-4 h-4 text-purple-300 flex-shrink-0 mt-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Command className="w-3 h-3" />
                  <span>K</span>
                  <span className="ml-2">to toggle</span>
                </div>
                <div>
                  {results.length > 0 ? `${results.length} results` : ""}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}