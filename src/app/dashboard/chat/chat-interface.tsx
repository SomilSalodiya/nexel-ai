"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles, User, Bot, MessageSquare, Lightbulb } from "lucide-react";
import NotePanel from "./note-panel";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatInterface({
  filePath,
  fileName,
}: {
  filePath: string;
  fileName: string;
}) {
  const [tab, setTab] = useState<"chat" | "notes">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [processed, setProcessed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function processPdf() {
    setStatus("Analyzing your PDF...");
    setLoading(true);
    try {
      const res = await fetch("/api/process-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath, fileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Processing failed");
      setStatus("");
      setProcessed(true);
      setMessages([
        {
          role: "assistant",
          content: `I've analyzed "${fileName}". Ask me anything about this document!`,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setStatus(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading || !processed) return;

    const question = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, filePath, fileName }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Chat failed");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: accumulated };
          return next;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: `Error: ${msg}` };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-white/5">
        <button
          onClick={() => setTab("chat")}
          className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2 ${
            tab === "chat"
              ? "text-white border-purple-500"
              : "text-gray-400 border-transparent hover:text-white"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Chat
        </button>
        <button
          onClick={() => setTab("notes")}
          className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2 ${
            tab === "notes"
              ? "text-white border-purple-500"
              : "text-gray-400 border-transparent hover:text-white"
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          AI Notes
        </button>
      </div>

      {tab === "chat" ? (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.length === 0 && !loading && (
              <div className="text-center py-12">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-purple-300" />
                </div>
                <h3 className="text-white font-medium mb-2">Ready to chat with your PDF</h3>
                <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
                  Click below to process this document first. Then ask anything.
                </p>
                <button
                  onClick={processPdf}
                  className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                >
                  Analyze this PDF
                </button>
                {status && <p className="text-sm text-purple-300 mt-4">{status}</p>}
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-purple-300" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-purple-600 to-cyan-500 text-white"
                      : "glass text-gray-200"
                  }`}
                >
                  {m.content || (
                    <span className="inline-flex items-center gap-2 text-gray-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Thinking...
                    </span>
                  )}
                </div>
                {m.role === "user" && (
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-300" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={sendMessage} className="px-6 py-4 border-t border-white/5">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  processed ? "Ask about this document..." : "Analyze the PDF first"
                }
                disabled={!processed || loading}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!processed || loading || !input.trim()}
                className="px-4 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </form>
        </>
      ) : (
        <NotePanel filePath={filePath} fileName={fileName} />
      )}
    </div>
  );
}