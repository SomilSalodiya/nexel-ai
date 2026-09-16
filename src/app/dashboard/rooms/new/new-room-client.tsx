"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  FileText,
  X,
  Users,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";

type Pdf = {
  name: string;
  fullPath: string;
  displayName: string;
};

export default function NewRoomClient({ pdfs }: { pdfs: Pdf[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [selectedPdf, setSelectedPdf] = useState<Pdf | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [createdRoom, setCreatedRoom] = useState<{
    code: string;
    name: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Room name must be at least 2 characters");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          filePath: selectedPdf?.fullPath || null,
          fileName: selectedPdf?.displayName || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");

      setCreatedRoom(data.room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setCreating(false);
    }
  }

  async function copyCode() {
    if (!createdRoom) return;
    try {
      await navigator.clipboard.writeText(createdRoom.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  // Success state
  if (createdRoom) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-green-500/20 to-cyan-500/20 border border-green-500/30 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-green-300" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Room created!</h2>
        <p className="text-sm text-gray-400 mb-8">
          Share this code with your classmates to let them join.
        </p>

        <div className="inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30 mb-6">
          <span className="text-2xl font-bold font-mono tracking-widest text-white">
            {createdRoom.code}
          </span>
          <button
            onClick={copyCode}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
            title="Copy code"
          >
            {copied ? (
              <Check className="w-5 h-5 text-green-400" />
            ) : (
              <Copy className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push(`/dashboard/rooms/${createdRoom.code}`)}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            Enter Room
          </button>
        </div>
      </div>
    );
  }

  // Form
  return (
    <form onSubmit={handleCreate} className="space-y-6">
      <div className="glass rounded-2xl p-6">
        <label className="text-sm text-gray-300 mb-2 block font-medium">
          Room name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Web Tech Revision Session"
          maxLength={60}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
          autoFocus
        />
        <p className="text-xs text-gray-500 mt-2">
          This is how the room appears to you and your classmates.
        </p>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm text-gray-300 font-medium flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-300" />
            Attach a PDF (optional)
          </label>
          {selectedPdf && (
            <button
              type="button"
              onClick={() => setSelectedPdf(null)}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {selectedPdf ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/30">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-purple-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white font-medium truncate">
                {selectedPdf.displayName}
              </div>
              <div className="text-xs text-gray-500">
                Selected for this room
              </div>
            </div>
          </div>
        ) : pdfs.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">
            No PDFs uploaded yet. Upload one from the dashboard.
          </p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {pdfs.map((pdf) => (
              <button
                key={pdf.name}
                type="button"
                onClick={() => setSelectedPdf(pdf)}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-purple-300" />
                </div>
                <span className="text-sm text-gray-200 truncate">
                  {pdf.displayName}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={creating || name.trim().length < 2}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {creating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <Users className="w-5 h-5" />
            Create Room
          </>
        )}
      </button>
    </form>
  );
}