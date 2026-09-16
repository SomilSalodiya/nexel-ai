"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Trash2, Loader2, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";


type Pdf = {
  name: string;
  id: string | null;
  created_at: string | null;
  updated_at?: string | null;
  last_accessed_at?: string | null;
  metadata: { size?: number; mimetype?: string; cacheControl?: string } | null;
};
export default function PdfList({
  pdfs,
  userId,
}: {
  pdfs: Pdf[];
  userId: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(e: React.MouseEvent, fileName: string) {
    e.preventDefault();
    e.stopPropagation();

    setDeleting(fileName);
    setError(null);

    const supabase = createClient();
    const fullPath = `${userId}/${fileName}`;
    const { error: deleteError } = await supabase.storage
      .from("pdfs")
      .remove([fullPath]);

    if (deleteError) {
      setError(deleteError.message);
      setDeleting(null);
      return;
    }

    setDeleting(null);
    router.refresh();
  }

  if (pdfs.length === 0) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-5 h-5 text-purple-300" />
          <h3 className="text-lg font-semibold text-white">Your documents</h3>
        </div>
        <p className="text-gray-400 text-sm">
          No documents yet. Upload one to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-5 h-5 text-purple-300" />
        <h3 className="text-lg font-semibold text-white">
          Your documents ({pdfs.length})
        </h3>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          Delete failed: {error}
        </div>
      )}

      <div className="grid gap-3">
        {pdfs.map((pdf) => {
          const fullPath = `${userId}/${pdf.name}`;
       const chatUrl = `/dashboard/chat?path=${encodeURIComponent(fullPath)}`;

          return (
            <div
              key={pdf.id}
              className="flex items-center justify-between gap-4 p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
            >
              <Link
                href={chatUrl}
                className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-purple-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-medium truncate">
                    {pdf.name.replace(/^\d+-/, "")}
                  </p>
                  <p className="text-xs text-gray-500">
                    {pdf.metadata?.size
                      ? `${(pdf.metadata.size / 1024 / 1024).toFixed(2)} MB`
                      : ""}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-1">
                <Link
                  href={chatUrl}
                  className="text-gray-400 hover:text-purple-300 transition-colors p-2 rounded-lg hover:bg-purple-500/10"
                  title="Chat with this PDF"
                >
                  <MessageSquare className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, pdf.name)}
                  disabled={deleting === pdf.name}
                  className="text-gray-400 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/10 disabled:opacity-50 cursor-pointer"
                  title="Delete"
                >
                  {deleting === pdf.name ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}