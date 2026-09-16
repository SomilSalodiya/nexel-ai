"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Check,
  X,
  Trophy,
  RefreshCw,
  FileText,
} from "lucide-react";

type Card = {
  id: number;
  fileName: string;
  question: string;
  answer: string;
};

export default function FlashcardReview({ cards }: { cards: Card[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Record<number, "got" | "review">>({});
  const [done, setDone] = useState(false);

  const card = cards[index];
  const total = cards.length;
  const progress = ((index + 1) / total) * 100;

  const handleKnow = useCallback(() => {
    setResults((r) => ({ ...r, [card.id]: "got" }));
    if (index + 1 >= total) {
      setDone(true);
    } else {
      setIndex(index + 1);
      setFlipped(false);
    }
  }, [card, index, total]);

  const handleReview = useCallback(() => {
    setResults((r) => ({ ...r, [card.id]: "review" }));
    if (index + 1 >= total) {
      setDone(true);
    } else {
      setIndex(index + 1);
      setFlipped(false);
    }
  }, [card, index, total]);

  const goPrev = useCallback(() => {
    if (index > 0) {
      setIndex(index - 1);
      setFlipped(false);
    }
  }, [index]);

  const goNext = useCallback(() => {
    if (index + 1 < total) {
      setIndex(index + 1);
      setFlipped(false);
    }
  }, [index, total]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (done) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowLeft") {
        goPrev();
      } else if (e.key === "ArrowRight") {
        goNext();
      } else if (e.key === "1" && flipped) {
        handleReview();
      } else if (e.key === "2" && flipped) {
        handleKnow();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flipped, done, goPrev, goNext, handleKnow, handleReview]);

  // --- DONE SCREEN ---
  if (done) {
    const gotCount = Object.values(results).filter((r) => r === "got").length;
    const reviewCards = cards.filter((c) => results[c.id] === "review");
    const percentage = Math.round((gotCount / total) * 100);

    return (
      <div className="space-y-6">
        <div className="glass rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8 text-yellow-300" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Session complete! 🎉</h2>
          <p className="text-gray-400 text-sm mb-6">
            You reviewed {total} {total === 1 ? "card" : "cards"}
          </p>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="glass rounded-xl p-4">
              <div className="text-3xl font-bold text-green-400">{gotCount}</div>
              <div className="text-xs text-gray-400 mt-1">Got it</div>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="text-3xl font-bold text-orange-400">{reviewCards.length}</div>
              <div className="text-xs text-gray-400 mt-1">Review</div>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="text-3xl font-bold text-purple-300">{percentage}%</div>
              <div className="text-xs text-gray-400 mt-1">Score</div>
            </div>
          </div>

          <button
            onClick={() => {
              setIndex(0);
              setFlipped(false);
              setResults({});
              setDone(false);
            }}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Review again
          </button>
        </div>

        {reviewCards.length > 0 && (
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-orange-300" />
              Cards to review again ({reviewCards.length})
            </h3>
            <div className="space-y-3">
              {reviewCards.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-lg bg-white/5 border border-white/5"
                >
                  <p className="text-sm text-white mb-1">{c.question}</p>
                  <p className="text-xs text-gray-400">{c.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => router.push("/dashboard")}
          className="w-full text-sm text-gray-400 hover:text-white py-3"
        >
          ← Back to dashboard
        </button>
      </div>
    );
  }

  // --- REVIEW SCREEN ---
  return (
    <div className="space-y-6">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
          <span>
            Card {index + 1} of {total}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div
        className="glass rounded-2xl p-8 min-h-[320px] flex flex-col cursor-pointer select-none"
        onClick={() => setFlipped(!flipped)}
      >
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
          <FileText className="w-3 h-3" />
          <span className="truncate">{card.fileName.replace(/^\d+-/, "")}</span>
        </div>

        <div className="flex-1 flex items-center justify-center">
          {!flipped ? (
            <div className="text-center">
              <div className="text-xs text-purple-300 font-semibold mb-3 tracking-wider">
                QUESTION
              </div>
              <p className="text-xl md:text-2xl text-white font-medium leading-relaxed">
                {card.question}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-xs text-cyan-300 font-semibold mb-3 tracking-wider">
                ANSWER
              </div>
              <p className="text-lg md:text-xl text-gray-200 leading-relaxed">
                {card.answer}
              </p>
            </div>
          )}
        </div>

        {!flipped && (
          <div className="text-center text-xs text-gray-500 mt-6 flex items-center justify-center gap-2">
            <RotateCw className="w-3 h-3" />
            Click to reveal answer
          </div>
        )}
      </div>

      {/* Controls */}
      {flipped ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleReview}
            className="py-4 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-300 font-semibold hover:bg-orange-500/20 transition-all flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            Review again
          </button>
          <button
            onClick={handleKnow}
            className="py-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300 font-semibold hover:bg-green-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            Got it
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={goPrev}
            disabled={index === 0}
            className="py-4 rounded-xl glass text-gray-300 font-semibold hover:bg-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>
          <button
            onClick={goNext}
            disabled={index + 1 >= total}
            className="py-4 rounded-xl glass text-gray-300 font-semibold hover:bg-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Keyboard hints */}
      <div className="text-center text-xs text-gray-600">
        <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">Space</kbd> flip ·{" "}
        <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">←</kbd>{" "}
        <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">→</kbd> navigate
      </div>
    </div>
  );
}