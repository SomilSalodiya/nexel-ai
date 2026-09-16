"use client";

import { useState } from "react";
import { Sparkles, Loader2, Lightbulb, ListChecks, BookOpen, GraduationCap, X } from "lucide-react";

type Note = {
  id: number;
  selected_text: string;
  summary: string;
  bullets: string[];
  simplified: string;
  flashcard: { question: string; answer: string } | null;
  created_at: string;
};

export default function NotePanel({
  filePath,
  fileName,
}: {
  filePath: string;
  fileName: string;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState<Note | null>(null);
  const [saved, setSaved] = useState(false);

  async function generateNote() {
    if (text.trim().length < 20) {
      setError("Please paste at least 20 characters");
      return;
    }

    setLoading(true);
    setError("");
    setNote(null);
    setSaved(false);

    try {
      const res = await fetch("/api/generate-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedText: text, filePath, fileName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setNote(data.note);
      setSaved(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setText("");
    setNote(null);
    setError("");
    setSaved(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-purple-300" />
          <h2 className="text-sm font-semibold text-white">AI Notes</h2>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Paste text from the PDF → get instant study notes
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!note && !loading && (
          <div className="space-y-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste text from your PDF here (or type it). The AI will generate a summary, key points, simplified explanation, and a flashcard."
              className="w-full h-40 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 resize-none"
              maxLength={5000}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{text.length}/5000 characters</span>
              <button
                onClick={generateNote}
                disabled={loading || text.trim().length < 20}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Generate AI Note
              </button>
            </div>
            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                {error}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-4">
              <Loader2 className="w-6 h-6 text-purple-300 animate-spin" />
            </div>
            <p className="text-sm text-gray-400">Generating your study notes...</p>
            <p className="text-xs text-gray-500 mt-1">This takes ~5 seconds</p>
          </div>
        )}

        {note && (
          <div className="space-y-4 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-green-400">✓ Saved to your notes</span>
              <button
                onClick={reset}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                New note
              </button>
            </div>

            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-purple-300" />
                <h3 className="text-sm font-semibold text-white">Summary</h3>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{note.summary}</p>
            </div>

            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <ListChecks className="w-4 h-4 text-cyan-300" />
                <h3 className="text-sm font-semibold text-white">Key Points</h3>
              </div>
              <ul className="space-y-2">
                {note.bullets.map((b, i) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-purple-400 mt-0.5">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-yellow-300" />
                <h3 className="text-sm font-semibold text-white">Simplified</h3>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{note.simplified}</p>
            </div>

            {note.flashcard && (
              <div className="glass rounded-xl p-4 border-purple-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap className="w-4 h-4 text-pink-300" />
                  <h3 className="text-sm font-semibold text-white">Flashcard</h3>
                </div>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-gray-500">Q: </span>
                    <span className="text-white">{note.flashcard.question}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">A: </span>
                    <span className="text-gray-300">{note.flashcard.answer}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}