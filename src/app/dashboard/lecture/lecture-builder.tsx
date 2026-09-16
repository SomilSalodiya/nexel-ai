"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  FileText,
  ChevronRight,
  X,
  Volume2,
  VolumeX,
  BookOpen,
  Brain,
  StickyNote,
  GraduationCap,
  ListChecks,
} from "lucide-react";
import { initVoices, speakText as speak, stopSpeaking as stop } from "@/lib/voice";

type Pdf = {
  name: string;
  fullPath: string;
  displayName: string;
};

type Scene =
  | { type: "title"; title: string; subtitle?: string; narration: string }
  | { type: "teach"; title: string; content: string; narration: string }
  | { type: "example"; title: string; content: string; narration: string }
  | { type: "definition"; title: string; content: string; narration: string }
  | { type: "bullets"; title: string; bullets: string[]; narration: string }
  | { type: "recap"; title: string; bullets: string[]; narration: string };

type Chapter = {
  topicId: number;
  title: string;
  startSceneIndex: number;
  sceneCount: number;
};

type Phase = "idle" | "analyzing" | "generating" | "done" | "error";

export default function LectureBuilder({ pdfs }: { pdfs: Pdf[] }) {
  const router = useRouter();
  const [selectedPdf, setSelectedPdf] = useState<Pdf | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [error, setError] = useState("");

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentScene, setCurrentScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Init voices
  useEffect(() => {
    const cleanup = initVoices();
    return cleanup;
  }, []);

  // Play current scene when isPlaying changes
  useEffect(() => {
    if (!isPlaying || scenes.length === 0) return;
    const scene = scenes[currentScene];
    if (!scene) return;
    const isLast = currentScene >= scenes.length - 1;

    if (!voiceEnabled) {
      const t = setTimeout(() => {
        if (isLast) setIsPlaying(false);
        else setCurrentScene((s) => s + 1);
      }, 6000);
      return () => clearTimeout(t);
    }

    const u = speak(scene.narration, {
      rate: 0.95,
      onStart: () => setSpeaking(true),
      onEnd: () => {
        setSpeaking(false);
        if (isLast) setIsPlaying(false);
        else setCurrentScene((s) => s + 1);
      },
      onError: () => {
        setSpeaking(false);
        if (isLast) setIsPlaying(false);
        else setCurrentScene((s) => s + 1);
      },
    });
    utteranceRef.current = u;

    return () => {
      stop();
    };
  }, [isPlaying, currentScene, scenes, voiceEnabled]);

  useEffect(() => {
    return () => stop();
  }, []);

  // ============ GENERATE FULL LECTURE ============
  async function generateFullLecture(pdf: Pdf) {
    setSelectedPdf(pdf);
    setPhase("analyzing");
    setError("");
    setScenes([]);
    setChapters([]);
    setCurrentScene(0);
    setProgress({ current: 0, total: 0, label: "Analyzing your PDF..." });

    try {
      setPhase("generating");
      setProgress({ current: 1, total: 1, label: "Generating lecture content (this takes ~5 min)..." });

      const res = await fetch("/api/lecture/generate-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: pdf.fullPath,
          fileName: pdf.displayName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setScenes(data.scenes);
      setChapters(data.chapters);
      setCurrentScene(0);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setPhase("error");
    }
  }

  function reset() {
    stop();
    setSpeaking(false);
    setSelectedPdf(null);
    setScenes([]);
    setChapters([]);
    setCurrentScene(0);
    setPhase("idle");
    setError("");
    setProgress({ current: 0, total: 0, label: "" });
  }

  function togglePlay() {
    if (scenes.length === 0) return;
    if (currentScene >= scenes.length - 1 && !isPlaying) {
      setCurrentScene(0);
      setIsPlaying(true);
      return;
    }
    if (isPlaying) {
      stop();
      setSpeaking(false);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
    }
  }

  function goToScene(i: number) {
    stop();
    setSpeaking(false);
    setIsPlaying(false);
    setCurrentScene(Math.max(0, Math.min(i, scenes.length - 1)));
  }

  function goToChapter(chapter: Chapter) {
    goToScene(chapter.startSceneIndex);
    setShowSidebar(false);
  }

  function currentChapter() {
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (chapters[i].startSceneIndex <= currentScene) return chapters[i];
    }
    return null;
  }

  // ============ PHASE: PDF PICKER ============
  if (phase === "idle" && !selectedPdf) {
    return (
      <div className="space-y-3">
        {pdfs.map((pdf) => (
          <button
            key={pdf.name}
            onClick={() => generateFullLecture(pdf)}
            className="w-full glass rounded-2xl p-5 text-left hover:bg-white/[0.08] transition-all group flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-purple-300" />
              </div>
              <span className="text-sm text-white font-medium truncate">{pdf.displayName}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-purple-300 transition-colors flex-shrink-0" />
          </button>
        ))}
      </div>
    );
  }

  // ============ PHASE: PROGRESS ============
  if (phase === "analyzing" || phase === "generating") {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-6">
          <Loader2 className="w-10 h-10 text-purple-300 animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Building your lecture</h2>
        <p className="text-gray-400 mb-8">{progress.label}</p>
        <div className="max-w-md mx-auto">
          <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-3">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
              animate={{ width: "95%" }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-8">
          This takes about 4-6 minutes. Don&apos;t close this tab.
        </p>
      </div>
    );
  }

  // ============ PHASE: ERROR ============
  if (phase === "error") {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <X className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Couldn&apos;t build lecture</h2>
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

  // ============ PHASE: PLAYER ============
  const scene = scenes[currentScene];
  if (!scene) return null;

  const progressPercent = ((currentScene + 1) / scenes.length) * 100;
  const isLast = currentScene === scenes.length - 1;
  const chapter = currentChapter();

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-6">
      <aside
        className={`${
          showSidebar ? "block" : "hidden lg:block"
        } glass rounded-2xl p-4 max-h-[80vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-300" />
            <span className="text-sm font-semibold text-white">{chapters.length} chapters</span>
          </div>
          <button
            onClick={() => setShowSidebar(false)}
            className="lg:hidden text-gray-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1">
          {chapters.map((c, i) => {
            const isActive = chapter?.topicId === c.topicId;
            return (
              <button
                key={c.topicId}
                onClick={() => goToChapter(c)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30"
                    : "hover:bg-white/5 border border-transparent"
                }`}
              >
                <div className="flex items-start gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                      isActive
                        ? "bg-gradient-to-br from-purple-500 to-cyan-500 text-white"
                        : "bg-white/5 text-gray-400"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-medium truncate ${isActive ? "text-white" : "text-gray-300"}`}>
                      {c.title}
                    </div>
                    <div className="text-[10px] text-gray-500">{c.sceneCount} scenes</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="space-y-6 min-w-0">
        <button
          onClick={() => setShowSidebar(true)}
          className="lg:hidden flex items-center gap-2 text-sm text-gray-300 hover:text-white px-4 py-2 rounded-lg glass"
        >
          <BookOpen className="w-4 h-4" />
          Chapters
        </button>

        <div className="relative aspect-video rounded-2xl overflow-hidden glass border border-white/10 bg-gradient-to-br from-[#05060f] to-[#0a0d20]">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />
          </div>
          <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

          {speaking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full glass z-10"
            >
              <div className="flex items-end gap-0.5 h-3">
                {[0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-cyan-400 rounded-full"
                    animate={{ height: ["30%", "100%", "30%"] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-300">Speaking</span>
            </motion.div>
          )}

          <div className="relative h-full flex items-center justify-center p-6 md:p-10 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentScene}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="w-full"
              >
                {scene.type === "title" && (
                  <div className="text-center">
                    <div className="text-xs text-purple-300 font-semibold tracking-[0.3em] mb-4">
                      {scene.subtitle || "NEXEL AI · LECTURE"}
                    </div>
                    <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
                      {scene.title}
                    </h1>
                  </div>
                )}

                {scene.type === "teach" && (
                  <div className="max-w-3xl mx-auto">
                    <h2 className="text-xl md:text-3xl font-bold glow-text mb-4">{scene.title}</h2>
                    <p className="text-sm md:text-base text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {scene.content}
                    </p>
                  </div>
                )}

                {scene.type === "definition" && (
                  <div className="max-w-3xl mx-auto">
                    <h2 className="text-xl md:text-3xl font-bold glow-text mb-4">{scene.title}</h2>
                    <p className="text-sm md:text-base text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {scene.content}
                    </p>
                  </div>
                )}

                {scene.type === "example" && (
                  <div className="max-w-3xl mx-auto">
                    <h2 className="text-xl md:text-3xl font-bold glow-text mb-4">{scene.title}</h2>
                    <p className="text-sm md:text-base text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {scene.content}
                    </p>
                  </div>
                )}

                {scene.type === "bullets" && (
                  <div className="max-w-2xl mx-auto">
                    <h2 className="text-xl md:text-3xl font-bold glow-text mb-5 text-center">
                      {scene.title}
                    </h2>
                    <div className="space-y-2">
                      {scene.bullets.map((b, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + i * 0.1 }}
                          className="flex items-start gap-3 glass rounded-lg p-3"
                        >
                          <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                            {i + 1}
                          </div>
                          <span className="text-sm md:text-base text-gray-200">{b}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {scene.type === "recap" && (
                  <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-center gap-2 mb-5">
                      <GraduationCap className="w-6 h-6 text-purple-300" />
                      <h2 className="text-xl md:text-3xl font-bold text-white">{scene.title}</h2>
                    </div>
                    <div className="space-y-2">
                      {scene.bullets.map((b, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2 + i * 0.1 }}
                          className="flex items-start gap-3 glass rounded-lg p-3"
                        >
                          <ListChecks className="w-4 h-4 text-cyan-300 mt-0.5 flex-shrink-0" />
                          <span className="text-sm md:text-base text-gray-200">{b}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full glass text-xs text-gray-300">
            {currentScene + 1} / {scenes.length}
            {chapter && <span className="text-gray-500 ml-2">· {chapter.title.slice(0, 20)}</span>}
          </div>
        </div>

        <div className="glass rounded-2xl p-4 flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={() => goToScene(0)}
            className="p-3 rounded-lg glass hover:bg-white/10 text-gray-300 hover:text-white"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => goToScene(currentScene - 1)}
            disabled={currentScene === 0}
            className="p-3 rounded-lg glass hover:bg-white/10 text-gray-300 hover:text-white disabled:opacity-30"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            onClick={togglePlay}
            className="p-4 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 text-white hover:shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </button>
          <button
            onClick={() => goToScene(currentScene + 1)}
            disabled={isLast}
            className="p-3 rounded-lg glass hover:bg-white/10 text-gray-300 hover:text-white disabled:opacity-30"
          >
            <SkipForward className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              if (voiceEnabled) stop();
              setVoiceEnabled((v) => !v);
            }}
            className={`p-3 rounded-lg glass hover:bg-white/10 ${
              voiceEnabled ? "text-cyan-300" : "text-gray-500"
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <div className="w-px h-6 bg-white/10 mx-2" />
          <button
            onClick={() => {
              navigator.clipboard.writeText(scene.narration);
              alert("Narration copied to clipboard!");
            }}
            className="p-3 rounded-lg glass hover:bg-white/10 text-yellow-300"
            title="Copy narration"
          >
            <StickyNote className="w-4 h-4" />
          </button>
          <button
            onClick={() => router.push("/dashboard/quiz")}
            className="p-3 rounded-lg glass hover:bg-white/10 text-pink-300"
            title="Take a quiz"
          >
            <Brain className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 py-3 rounded-lg glass text-white font-medium hover:bg-white/10 transition-all"
          >
            Choose another PDF
          </button>
        </div>
      </div>
    </div>
  );
}