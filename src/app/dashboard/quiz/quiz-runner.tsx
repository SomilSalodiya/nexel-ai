"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  Loader2,
  Check,
  X,
  Trophy,
  RefreshCw,
  ChevronRight,
  FileText,
  Sparkles,
} from "lucide-react";

type Pdf = {
  name: string;
  fullPath: string;
  displayName: string;
};

type Question = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export default function QuizRunner({ pdfs }: { pdfs: Pdf[] }) {
  const router = useRouter();
  const [selectedPdf, setSelectedPdf] = useState<Pdf | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  async function generateQuiz(pdf: Pdf) {
    setSelectedPdf(pdf);
    setLoading(true);
    setError("");
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setAnswered(false);
    setScore(0);
    setFinished(false);

    try {
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: pdf.fullPath,
          fileName: pdf.displayName,
          numQuestions: 5,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate quiz");

      setQuestions(data.questions);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleAnswer(index: number) {
    if (answered) return;
    setSelectedAnswer(index);
    setAnswered(true);
    if (index === questions[currentIndex].correctIndex) {
      setScore((s) => s + 1);
    }
  }

  function nextQuestion() {
    if (currentIndex + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setAnswered(false);
    }
  }

  function reset() {
    setSelectedPdf(null);
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setAnswered(false);
    setScore(0);
    setFinished(false);
    setError("");
  }

  // --- SCREEN 1: PICK PDF ---
  if (!selectedPdf) {
    return (
      <div className="space-y-3">
        {pdfs.map((pdf) => (
          <button
            key={pdf.name}
            onClick={() => generateQuiz(pdf)}
            className="w-full glass rounded-2xl p-5 text-left hover:bg-white/[0.08] transition-all group flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-purple-300" />
              </div>
              <span className="text-sm text-white font-medium truncate">
                {pdf.displayName}
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-purple-300 transition-colors flex-shrink-0" />
          </button>
        ))}
      </div>
    );
  }

  // --- SCREEN 2: GENERATING ---
  if (loading) {
    return (
      <div className="glass rounded-2xl p-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-4">
          <Loader2 className="w-8 h-8 text-purple-300 animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Generating your quiz...
        </h2>
        <p className="text-sm text-gray-400">
          AI is reading "{selectedPdf.displayName}" and creating questions
        </p>
        <p className="text-xs text-gray-500 mt-2">This takes ~10 seconds</p>
      </div>
    );
  }

  // --- SCREEN 3: ERROR ---
  if (error) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <X className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Couldn't generate quiz
        </h2>
        <p className="text-sm text-red-400 mb-6">{error}</p>
        <button
          onClick={reset}
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
        >
          Try another PDF
        </button>
      </div>
    );
  }

  // --- SCREEN 4: FINISHED ---
  if (finished) {
    const percentage = Math.round((score / questions.length) * 100);
    const emoji =
      percentage >= 80 ? "🏆" : percentage >= 60 ? "👍" : percentage >= 40 ? "📚" : "💪";

    return (
      <div className="space-y-6">
        <div className="glass rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8 text-yellow-300" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Quiz complete! {emoji}
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            You scored {score} out of {questions.length}
          </p>

          <div className="inline-block px-8 py-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 mb-6">
            <div className="text-5xl font-bold glow-text">{percentage}%</div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                if (selectedPdf) generateQuiz(selectedPdf);
              }}
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              New quiz
            </button>
            <button
              onClick={reset}
              className="px-6 py-3 rounded-lg glass text-white font-semibold hover:bg-white/10 transition-all"
            >
              Choose another PDF
            </button>
          </div>
        </div>

        {/* Question review */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">
            Review your answers
          </h3>
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div
                key={i}
                className="p-4 rounded-lg bg-white/5 border border-white/5"
              >
                <div className="flex items-start gap-3 mb-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                      q.correctIndex === q.correctIndex
                        ? "bg-green-500/20 text-green-300"
                        : "bg-red-500/20 text-red-300"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <p className="text-sm text-white">{q.question}</p>
                </div>
                <p className="text-xs text-green-300 ml-9">
                  ✓ {q.options[q.correctIndex]}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- SCREEN 5: TAKING QUIZ ---
  const q = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
          <span>
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span>Score: {score}</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
          <Brain className="w-3 h-3" />
          <span className="truncate">{selectedPdf.displayName}</span>
        </div>
        <h2 className="text-lg md:text-xl text-white font-medium leading-relaxed mb-6">
          {q.question}
        </h2>

        <div className="space-y-2">
          {q.options.map((option, i) => {
            const isCorrect = i === q.correctIndex;
            const isSelected = i === selectedAnswer;
            let style =
              "glass hover:bg-white/10 border border-white/10 text-gray-200";
            if (answered) {
              if (isCorrect) {
                style =
                  "bg-green-500/10 border border-green-500/30 text-green-200";
              } else if (isSelected && !isCorrect) {
                style = "bg-red-500/10 border border-red-500/30 text-red-200";
              } else {
                style = "glass opacity-50 border border-white/5 text-gray-400";
              }
            }
            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={answered}
                className={`w-full text-left p-4 rounded-xl transition-all flex items-center justify-between gap-3 ${style} ${
                  !answered ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {String.fromCharCode(65 + i)}
                  </div>
                  <span className="text-sm">{option}</span>
                </div>
                {answered && isCorrect && (
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                )}
                {answered && isSelected && !isCorrect && (
                  <X className="w-5 h-5 text-red-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="mt-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-300" />
              <span className="text-xs font-semibold text-purple-300">
                {selectedAnswer === q.correctIndex ? "CORRECT!" : "EXPLANATION"}
              </span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              {q.explanation}
            </p>
          </div>
        )}
      </div>

      {answered && (
        <button
          onClick={nextQuestion}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all flex items-center justify-center gap-2"
        >
          {currentIndex + 1 >= questions.length ? (
            <>
              See Results
              <Trophy className="w-4 h-4" />
            </>
          ) : (
            <>
              Next Question
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}