"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  Sparkles,
  User,
  Bot,
  Brain,
  Plus,
  FileText,
  ChevronRight,
  StopCircle,
  BookOpen,
  Lightbulb,
  GraduationCap,
  Microscope,
  MessageSquare,
  Mic,
  MicOff,
  ChevronDown,
  Volume2,
  VolumeX,
  Paperclip,
  X,
} from "lucide-react";
import { initVoices, speakText as speak, stopSpeaking as stop } from "@/lib/voice";

type Attachment = {
  fileName: string;
  fileType: "image" | "pdf";
  fileSize: number;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: { file_name: string; snippet: string; similarity: number }[];
  attachment?: Attachment;
  previewUrl?: string;
};

type LangCode = "auto" | "en-IN" | "hi-IN";

const LANGUAGES: { code: LangCode; label: string; flag: string }[] = [
  { code: "auto", label: "Auto", flag: "🌐" },
  { code: "en-IN", label: "English", flag: "🇬🇧" },
  { code: "hi-IN", label: "हिंदी", flag: "🇮🇳" },
];

const SUGGESTIONS = [
  { icon: Lightbulb, title: "Explain a concept", prompt: "Explain the most important concept from my PDFs in simple terms" },
  { icon: MessageSquare, title: "Summarize a topic", prompt: "Summarize the main topics covered across all my PDFs" },
  { icon: GraduationCap, title: "Help me study", prompt: "Quiz me on the key concepts from my PDFs" },
  { icon: Microscope, title: "Ask me anything", prompt: "Explain quantum physics in simple terms" },
];

type SpeechRecognitionEvent = Event & {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
  resultIndex: number;
};

type SpeechRecognitionErrorEvent = Event & { error: string };

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function detectLanguage(text: string): "hi-IN" | "en-IN" {
  return /[\u0900-\u097F]/.test(text) ? "hi-IN" : "en-IN";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function TutorClient({ pdfCount }: { pdfCount: number }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState<LangCode>("auto");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceError, setVoiceError] = useState("");
  const [speakReplies, setSpeakReplies] = useState(false);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<number | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string>("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const cleanup = initVoices();
    return cleanup;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition ||
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition;
    if (!SR) setVoiceSupported(false);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-lang-menu]")) setShowLangMenu(false);
    }
    if (showLangMenu) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showLangMenu]);

  useEffect(() => {
    return () => {
      stop();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  // ============ VOICE INPUT ============
  const startListening = useCallback(() => {
    setVoiceError("");
    const SR =
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition ||
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition;

    if (!SR) {
      setVoiceError("Voice input not supported in this browser");
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    const recognition = new SR();
    recognition.lang = lang === "auto" ? "en-IN" : lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = "";
    const startInput = input;

    recognition.onstart = () => {
      setListening(true);
      setVoiceError("");
    };

    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += transcript + " ";
        else interim += transcript;
      }
      setInput((startInput + " " + finalTranscript + interim).trim());
    };

    recognition.onerror = (e) => {
      let msg = "Voice input failed";
      if (e.error === "not-allowed") msg = "Microphone permission denied";
      else if (e.error === "no-speech") msg = "No speech detected";
      else if (e.error === "audio-capture") msg = "No microphone found";
      setVoiceError(msg);
      setListening(false);
    };

    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setListening(false);
      setVoiceError("Could not start voice input");
    }
  }, [input, lang]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) stopListening();
    else startListening();
  }, [listening, startListening, stopListening]);

  // ============ VOICE REPLY ============
  const speakMessage = useCallback((text: string, messageId: number) => {
    stop();
    setCurrentlySpeakingId(messageId);
    const detectedLang = detectLanguage(text);
    console.log(`🔊 Speaking in ${detectedLang}`);
    speak(text, {
      rate: 1.0,
      onStart: () => setCurrentlySpeakingId(messageId),
      onEnd: () => setCurrentlySpeakingId(null),
      onError: () => setCurrentlySpeakingId(null),
    });
  }, []);

  const stopSpeakingMessage = useCallback(() => {
    stop();
    setCurrentlySpeakingId(null);
  }, []);

  // ============ ATTACHMENT ============
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File too large (max 10MB)");
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      alert("Only images and PDFs are supported");
      return;
    }

    setPendingFile(file);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPendingPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPendingPreview("");
    }
  }

  function clearPendingFile() {
    setPendingFile(null);
    setPendingPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ============ PARSE __META__ PREFIX ============
  function parseMeta(chunk: string): { cleanText: string; meta: Record<string, unknown> | null } {
    if (chunk.startsWith("__META__")) {
      const end = chunk.indexOf("__META__", 8);
      if (end > 8) {
        try {
          const meta = JSON.parse(chunk.slice(8, end));
          return { cleanText: chunk.slice(end + 8), meta };
        } catch {
          return { cleanText: chunk, meta: null };
        }
      }
    }
    return { cleanText: chunk, meta: null };
  }

  // ============ SEND ============
  async function sendMessage(text: string) {
    if ((!text.trim() && !pendingFile) || loading) return;
    if (listening) stopListening();
    if (currentlySpeakingId !== null) stopSpeakingMessage();

    const question = text.trim() || "Analyze this and explain what's in it.";
    const fileToSend = pendingFile;
    const previewToSend = pendingPreview;

    setInput("");
    clearPendingFile();

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: question,
        attachment: fileToSend
          ? {
              fileName: fileToSend.name,
              fileType: fileToSend.type.startsWith("image/") ? "image" : "pdf",
              fileSize: fileToSend.size,
            }
          : undefined,
        previewUrl: previewToSend || undefined,
      },
    ]);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    setLoading(true);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let res: Response;

      if (fileToSend) {
        const formData = new FormData();
        formData.append("file", fileToSend);
        formData.append("question", question);
        if (conversationId) formData.append("conversationId", String(conversationId));

        res = await fetch("/api/tutor/vision", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
      } else {
        res = await fetch("/api/tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, conversationId }),
          signal: controller.signal,
        });
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Request failed");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      let accumulated = "";
      let sources: { file_name: string; snippet: string; similarity: number }[] = [];
      let metaParsed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        let text = decoder.decode(value, { stream: true });

        // Parse __META__ prefix if we haven't yet
        if (!metaParsed && text.startsWith("__META__")) {
          const end = text.indexOf("__META__", 8);
          if (end > 8) {
            try {
              const meta = JSON.parse(text.slice(8, end));
              if (meta.sources) {
                sources = meta.sources;
              }
            } catch {}
            text = text.slice(end + 8);
            metaParsed = true;
          }
        } else if (metaParsed === false) {
          metaParsed = true;
        }

        accumulated += text;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: accumulated,
            sources,
          };
          return next;
        });
      }

      if (speakReplies && accumulated.trim()) {
        const messageId = messages.length + 1;
        setTimeout(() => speakMessage(accumulated, messageId), 200);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last.content === "") {
            next[next.length - 1] = { role: "assistant", content: "_(stopped)_" };
          }
          return next;
        });
      } else {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: `Error: ${msg}` };
          return next;
        });
      }
    } finally {
      setLoading(false);
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function stopGeneration() {
    if (abortRef.current) abortRef.current.abort();
  }

  function newChat() {
    if (messages.length > 0 && !confirm("Start a new conversation?")) return;
    if (listening) stopListening();
    if (currentlySpeakingId !== null) stopSpeakingMessage();
    setMessages([]);
    setConversationId(null);
    setInput("");
    clearPendingFile();
    inputRef.current?.focus();
  }

  const currentLang = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        {messages.length === 0 ? (
          <div className="max-w-3xl mx-auto text-center pt-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center mb-6 shadow-2xl shadow-purple-500/30"
            >
              <Brain className="w-10 h-10 text-white" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-4xl font-bold text-white mb-3"
            >
              Your Personal <span className="glow-text">AI Assistant</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-gray-400 mb-8 max-w-lg mx-auto"
            >
              Ask anything by text or voice. Upload images or PDFs. I can answer
              general questions and use your{" "}
              {pdfCount > 0 ? (
                <span className="text-purple-300 font-semibold">
                  {pdfCount} {pdfCount === 1 ? "PDF" : "PDFs"}
                </span>
              ) : (
                "PDFs"
              )}{" "}
              when relevant.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="grid md:grid-cols-2 gap-3 max-w-3xl mx-auto text-left"
            >
              {SUGGESTIONS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <button
                    key={i}
                    onClick={() => sendMessage(s.prompt)}
                    disabled={loading}
                    className="glass rounded-xl p-4 text-left hover:bg-white/[0.08] transition-all group disabled:opacity-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <Icon className="w-4 h-4 text-purple-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white font-medium mb-1">{s.title}</div>
                        <div className="text-xs text-gray-400 line-clamp-2">{s.prompt}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-purple-300 transition-colors flex-shrink-0 mt-2" />
                    </div>
                  </button>
                );
              })}
            </motion.div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" && (
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}

                  <div className={`max-w-[85%] min-w-0 ${m.role === "user" ? "order-first" : ""}`}>
                    {m.attachment && m.previewUrl && (
                      <div className="mb-2 rounded-xl overflow-hidden border border-white/20 max-w-xs ml-auto">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.previewUrl} alt="attachment" className="max-h-48 w-auto" />
                      </div>
                    )}

                    {m.attachment && !m.previewUrl && (
                      <div className="mb-2 glass rounded-xl p-3 flex items-center gap-3 ml-auto max-w-xs">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-red-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-white font-medium truncate">
                            {m.attachment.fileName}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {formatFileSize(m.attachment.fileSize)}
                          </div>
                        </div>
                      </div>
                    )}

                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
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

                    {m.role === "assistant" && m.content && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            if (currentlySpeakingId === i) stopSpeakingMessage();
                            else speakMessage(m.content, i);
                          }}
                          className={`text-[10px] px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
                            currentlySpeakingId === i
                              ? "bg-purple-500/30 text-purple-200 border border-purple-500/50"
                              : "glass text-gray-400 hover:text-white"
                          }`}
                        >
                          {currentlySpeakingId === i ? (
                            <>
                              <VolumeX className="w-3 h-3" />
                              Stop
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" />
                              Speak
                            </>
                          )}
                        </button>

                        {m.sources && m.sources.length > 0 && (
                          <>
                            {m.sources.slice(0, 3).map((src, si) => (
                              <div
                                key={si}
                                className="text-[10px] px-2 py-1 rounded-md glass text-gray-400 flex items-center gap-1"
                                title={src.snippet}
                              >
                                <FileText className="w-3 h-3" />
                                <span className="truncate max-w-[140px]">{src.file_name}</span>
                                <span className="text-purple-400">{src.similarity}%</span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {m.role === "user" && (
                    <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-gray-300" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="border-t border-white/5 bg-black/20 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-4">
          {messages.length > 0 && (
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <button
                onClick={newChat}
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg glass hover:bg-white/10 transition-all"
              >
                <Plus className="w-3 h-3" />
                New chat
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (speakReplies) stopSpeakingMessage();
                    setSpeakReplies((v) => !v);
                  }}
                  className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-all ${
                    speakReplies
                      ? "bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/40 text-white"
                      : "glass text-gray-400 hover:text-white"
                  }`}
                >
                  {speakReplies ? (
                    <>
                      <Volume2 className="w-3 h-3" />
                      Voice ON
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-3 h-3" />
                      Voice OFF
                    </>
                  )}
                </button>

                {streaming && (
                  <button
                    onClick={stopGeneration}
                    className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg glass hover:bg-red-500/10 transition-all"
                  >
                    <StopCircle className="w-3 h-3" />
                    Stop
                  </button>
                )}
              </div>
            </div>
          )}

          {listening && (
            <div className="mb-2 flex items-center gap-2 text-xs text-red-300 glass rounded-lg px-3 py-2">
              <div className="flex items-end gap-0.5 h-3">
                {[0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-red-400 rounded-full"
                    animate={{ height: ["30%", "100%", "30%"] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
              <span>Listening... Speak now</span>
            </div>
          )}

          {voiceError && (
            <div className="mb-2 text-xs text-red-400 glass rounded-lg px-3 py-2">
              {voiceError}
            </div>
          )}

          <AnimatePresence>
            {pendingFile && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mb-2 glass rounded-xl p-2 flex items-center gap-3"
              >
                {pendingPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pendingPreview}
                    alt="preview"
                    className="w-12 h-12 rounded-lg object-cover border border-white/10"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-red-300" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-white font-medium truncate">
                    {pendingFile.name}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {formatFileSize(pendingFile.size)} · Ready to send
                  </div>
                </div>
                <button
                  onClick={clearPendingFile}
                  className="text-gray-400 hover:text-red-400 p-1 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className={`p-3 rounded-2xl transition-all flex-shrink-0 ${
                pendingFile
                  ? "bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/40 text-purple-200"
                  : "glass text-gray-300 hover:text-white hover:bg-white/10"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title="Attach image or PDF"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <div className="relative flex-shrink-0" data-lang-menu>
              <button
                type="button"
                onClick={() => setShowLangMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3 h-11 rounded-2xl glass hover:bg-white/10 transition-all text-sm text-gray-300"
              >
                <span className="text-base">{currentLang.flag}</span>
                <span className="hidden sm:inline text-xs">{currentLang.label}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              <AnimatePresence>
                {showLangMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full mb-2 left-0 w-40 glass rounded-xl overflow-hidden shadow-2xl shadow-purple-500/20 z-20"
                  >
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => {
                          setLang(l.code);
                          setShowLangMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 transition-all ${
                          lang === l.code
                            ? "bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-white"
                            : "text-gray-300 hover:bg-white/5"
                        }`}
                      >
                        <span className="text-base">{l.flag}</span>
                        <span className="flex-1">{l.label}</span>
                        {lang === l.code && (
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                pendingFile
                  ? "Ask about this file..."
                  : listening
                  ? "Listening..."
                  : "Ask anything or attach a file..."
              }
              disabled={loading}
              rows={1}
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 resize-none disabled:opacity-50 max-h-40"
              style={{ minHeight: "44px", maxHeight: "160px" }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 160) + "px";
              }}
            />

            {voiceSupported && (
              <button
                type="button"
                onClick={toggleListening}
                disabled={loading}
                className={`p-3 rounded-2xl transition-all flex-shrink-0 ${
                  listening
                    ? "bg-red-500/20 border-2 border-red-500 text-red-400 animate-pulse"
                    : "glass text-gray-300 hover:text-white hover:bg-white/10"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            )}

            <button
              type="submit"
              disabled={loading || (!input.trim() && !pendingFile)}
              className="p-3 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </form>

          <p className="text-[10px] text-gray-500 text-center mt-2">
            📎 Attach files · 🎤 Voice input · 🔊 Voice replies · Auto language
          </p>
        </div>
      </div>
    </div>
  );
}