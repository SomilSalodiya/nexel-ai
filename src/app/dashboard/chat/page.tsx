import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Sparkles, ArrowLeft } from "lucide-react";
import ChatInterface from "./chat-interface";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const { path } = await searchParams;
  const decodedPath = path ? decodeURIComponent(path) : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!decodedPath || !decodedPath.startsWith(user.id + "/")) {
    redirect("/dashboard");
  }

  const fileName =
    decodedPath.split("/").pop()?.replace(/^\d+-/, "") || "document.pdf";

  const { data: signedData } = await supabase.storage
    .from("pdfs")
    .createSignedUrl(decodedPath, 3600);

  const pdfUrl = signedData?.signedUrl || "";

  return (
    <main className="relative h-screen flex flex-col overflow-hidden">
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-50" />

      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-white truncate max-w-md">
              {fileName}
            </span>
          </div>
        </div>
      </nav>

      <div className="relative z-10 flex-1 grid lg:grid-cols-2 overflow-hidden">
        <div className="border-r border-white/5 overflow-hidden bg-black/20">
          {pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=1&navpanes=0`}
              className="w-full h-full"
              title="PDF Viewer"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Could not load PDF
            </div>
          )}
        </div>

        <div className="overflow-hidden">
          <ChatInterface filePath={decodedPath} fileName={fileName} />
        </div>
      </div>
    </main>
  );
}