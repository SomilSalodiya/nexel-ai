"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2, Loader2, X, BookOpen, ListChecks, Lightbulb, GraduationCap, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Note = {
  id: number;
  file_path: string;
  file_name: string;
  selected_text: string;
  summary: string;
  bullets: string[];
  simplified: string;
  flashcard: { question: string; answer: string } | null;
  created_at: string;
};

export default function NotesList({ notes }: { notes: Note[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [fileFilter, setFileFilter] = useState<string>("all");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const uniqueFiles = useMemo(() => {
    const set = new Set(notes.map((n) => n.file_name));
    return Array.from(set);
  }, [notes]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return notes.filter((n) => {
      const matchesSearch =
        !q ||
        n.summary.toLowerCase().includes(q) ||
        n.simplified.toLowerCase().includes(q) ||
        n.selected_text.toLowerCase().includes(q) ||
        n.bullets.some((b) => b.toLowerCase().includes(q));
      const matchesFile = fileFilter === "all" || n.file_name === fileFilter;
      return matchesSearch && matchesFile;
    });
  }, [notes, search, fileFilter]);

  async function handleDelete(id: number) {
    if (!confirm("Delete this note?")) return;
    setDeleting(id);
    const supabase = createClient();
    await supabase.from("pdf_notes").delete().eq("id", id);
    setDeleting(null);
    if (selectedNote?.id === id) setSelectedNote(null);
    router.refresh();
  }

  if (notes.length === 0) {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-purple-300" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">No notes yet</h2>
        <p className="text-gray-400 text-sm mb-6">
          Open a PDF and use the AI Notes tab to generate your first study note.
        </p>
        <a
          href="/dashboard"
          className="inline-block px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
        >
          Go to Dashboard
        </a>
      </div>
    );
  }

  return (
    <>
      {/* Search + Filter bar */}
      <div className="glass rounded-2xl p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes by keyword..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
          />
        </div>
        <select
          value={fileFilter}
          onChange={(e) => setFileFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
        >
          <option value="all" className="bg-slate-900">All PDFs</option>
          {uniqueFiles.map((f) => (
            <option key={f} value={f} className="bg-slate-900">
              {f.replace(/^\d+-/, "")}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        {filtered.length} {filtered.length === 1 ? "note" : "notes"} found
      </p>

      {/* Grid of notes */}
      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((note) => (
          <div
            key={note.id}
            className="glass rounded-2xl p-5 hover:bg-white/[0.08] transition-all cursor-pointer group"
            onClick={() => setSelectedNote(note)}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-purple-300 flex-shrink-0" />
                <span className="text-xs text-gray-400 truncate">
                  {note.file_name.replace(/^\d+-/, "")}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(note.id);
                }}
                disabled={deleting === note.id}
                className="text-gray-500 hover:text-red-400 p-1 rounded transition-colors flex-shrink-0"
              >
                {deleting === note.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>

            <h3 className="text-sm font-medium text-white mb-2 line-clamp-2">
              {note.summary}
            </h3>

            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                {new Date(note.created_at).toLocaleDateString()}
              </span>
              <span>·</span>
              <span>{note.bullets.length} points</span>
              {note.flashcard && (
                <>
                  <span>·</span>
                  <span>🎓 flashcard</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-gray-400 text-sm">No notes match your search.</p>
        </div>
      )}

      {/* Modal */}
      {selectedNote && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedNote(null)}
        >
          <div
            className="glass rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-purple-300 flex-shrink-0" />
                <span className="text-sm text-gray-400 truncate">
                  {selectedNote.file_name.replace(/^\d+-/, "")}
                </span>
              </div>
              <button
                onClick={() => setSelectedNote(null)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="glass rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-purple-300" />
                  <h3 className="text-sm font-semibold text-white">Summary</h3>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {selectedNote.summary}
                </p>
              </div>

              <div className="glass rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks className="w-4 h-4 text-cyan-300" />
                  <h3 className="text-sm font-semibold text-white">Key Points</h3>
                </div>
                <ul className="space-y-2">
                  {selectedNote.bullets.map((b, i) => (
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
                <p className="text-sm text-gray-300 leading-relaxed">
                  {selectedNote.simplified}
                </p>
              </div>

              {selectedNote.flashcard && (
                <div className="glass rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <GraduationCap className="w-4 h-4 text-pink-300" />
                    <h3 className="text-sm font-semibold text-white">Flashcard</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-gray-500">Q: </span>
                      <span className="text-white">{selectedNote.flashcard.question}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">A: </span>
                      <span className="text-gray-300">{selectedNote.flashcard.answer}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="glass rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase">
                  Original Text
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">
                  {selectedNote.selected_text}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}