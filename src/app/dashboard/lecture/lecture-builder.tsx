"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  GraduationCap,
  ListChecks,
  Globe,
  ChevronDown,
  Languages,
} from "lucide-react";

type Pdf = {
  name: string;
  fullPath: string;
  displayName: string;
};

type Scene =
  | { type: "title"; title: string; subtitle?: string; narration: string }
  | { type: "teach"; title: string; content: string; narration: string }
  | { type: "bullets"; title: string; bullets: string[]; narration: string }
  | { type: "pie"; title: string; data: { label: string; value: number }[]; narration: string }
  | { type: "recap"; title: string; bullets: string[]; narration: string };

type Chapter = {
  topicId: number;
  title: string;
  startSceneIndex: number;
  sceneCount: number;
};

type Language = "english" | "hindi" | "hinglish";

const LANGUAGES: { code: Language; label: string; native: string; flag: string }[] = [
  { code: "english", label: "English", native: "English", flag: "🌐" },
  { code: "hindi", label: "Hindi", native: "हिंदी", flag: "🇮🇳" },
  { code: "hinglish", label: "Hinglish", native: "Hinglish", flag: "🗣️" },
];

type Phase = "idle" | "analyzing" | "generating" | "done" | "error";

// ============================================================
// VOICE HELPERS
// ============================================================
function detectLanguageFromText(text: string): "hindi" | "english" | "hinglish" {
  // Devanagari script → Hindi
  if (/[\u0900-\u097F]/.test(text)) return "hindi";

  // Check for common Hinglish words (Roman Hindi)
  const hinglishWords = [
    " hai", " hain", " ka ", " ki ", " ke ", " ko ", " mein ", " me ", " se ",
    " aap", " hum", " yeh", " kya", " aaj ", " kaise", " chaliye", " samjhenge",
    " karte", " karenge", " hoga", " hota", " nahi", " matlab", " basically",
  ];
  const lowerText = " " + text.toLowerCase() + " ";
  const matches = hinglishWords.filter((w) => lowerText.includes(w)).length;
  if (matches >= 2) return "hinglish";

  return "english";
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function LectureBuilder({ pdfs }: { pdfs: Pdf[] }) {
  const [selectedPdf, setSelectedPdf] = useState<Pdf | null>(null);
  const [language, setLanguage] = useState<Language>("english");
  const [showLangMenu, setShowLangMenu] = useState(false);
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
  const chosenVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // ============ VOICE SELECTION ============
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;

    function pickVoice() {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;

      // Pick preferred English voice by default; we'll override per-scene
      const preferred =
        voices.find((v) => v.name === "Google US English") ||
        voices.find((v) => v.name.includes("Microsoft Aria")) ||
        voices.find((v) => v.lang === "en-US" && v.localService) ||
        voices.find((v) => v.lang === "en-US") ||
        voices[0];

      if (preferred) chosenVoiceRef.current = preferred;
    }

    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // ============ VOICE PER LANGUAGE ============
  const getVoiceForLanguage = useCallback((lang: "hindi" | "english" | "hinglish"): SpeechSynthesisVoice | null => {
    if (typeof window === "undefined") return null;
    if (!("speechSynthesis" in window)) return null;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return chosenVoiceRef.current;

    if (lang === "hindi") {
      // Prefer Hindi voices
      return (
        voices.find((v) => v.name.includes("Swara")) ||
        voices.find((v) => v.name.includes("Madhur")) ||
        voices.find((v) => v.lang === "hi-IN") ||
        voices.find((v) => v.lang.startsWith("hi")) ||
        chosenVoiceRef.current
      );
    }

    if (lang === "hinglish") {
      // Hinglish: use Hindi voice if available (better for Hindi words), else English
      return (
        voices.find((v) => v.name.includes("Swara")) ||
        voices.find((v) => v.name.includes("Madhur")) ||
        voices.find((v) => v.lang === "hi-IN") ||
        voices.find((v) => v.name === "Google US English") ||
        voices.find((v) => v.lang === "en-IN") ||
        chosenVoiceRef.current
      );
    }

    // English
    return (
      voices.find((v) => v.name === "Google US English") ||
      voices.find((v) => v.name.includes("Microsoft Aria")) ||
      voices.find((v) => v.lang === "en-US" && v.localService) ||
      voices.find((v) => v.lang === "en-US") ||
      chosenVoiceRef.current
    );
  }, []);

  // ============ SPEAK ============
  const stopSpeaking = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speakText = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!voiceEnabled) {
        if (onEnd) setTimeout(onEnd, 6000);
        return;
      }
      if (typeof window === "undefined") return;
      if (!("speechSynthesis" in window)) return;

      window.speechSynthesis.cancel();

      const detected = detectLanguageFromText(text);
      const voice = getVoiceForLanguage(detected);

      const u = new SpeechSynthesisUtterance(text);
      u.rate = detected === "english" ? 0.95 : 0.9; // slightly slower for Hindi
      u.pitch = 1.0;
      u.volume = 1.0;
      u.lang = voice?.lang || (detected === "english" ? "en-US" : "hi-IN");
      if (voice) u.voice = voice;

      console.log(`🔊 Speaking (${detected}) with voice: ${voice?.name || "default"}`);

      u.onstart = () => setSpeaking(true);
      u.onend = () => {
        setSpeaking(false);
        onEnd?.();
      };
      u.onerror = () => {
        setSpeaking(false);
        onEnd?.();
      };
      utteranceRef.current = u;
      window.speechSynthesis.speak(u);
    },
    [voiceEnabled, getVoiceForLanguage]
  );

  // ============ AUTO-PLAY SCENES ============
  useEffect(() => {
    if (!isPlaying || scenes.length === 0) return;
    const scene = scenes[currentScene];
    if (!scene) return;
    const isLast = currentScene >= scenes.length - 1;

    const cleanup = speakText(scene.narration, () => {
      if (isLast) setIsPlaying(false);
      else setCurrentScene((s) => s + 1);
    });

    return () => {
      cleanup?.();
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentScene, scenes]);

  useEffect(() => {
    return () => stopSpeaking();
  }, [stopSpeaking]);

  // ============ LANGUAGE MENU CLOSE ============
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

  // ============ GENERATE ============
  async function generateFullLecture(pdf: Pdf) {
    setSelectedPdf(pdf);
    setPhase("analyzing");
    setError("");
    setScenes([]);
    setChapters([]);
    setCurrentScene(0);
    setProgress({ current: 0, total: 0, label: `Analyzing your PDF...` });

    try {
      setPhase("generating");
      setProgress({
        current: 1,
        total: 1,
        label: `Generating lecture in ${LANGUAGES.find((l) => l.code === language)?.native}... (takes ~5 min)`,
      });

      const res = await fetch("/api/lecture/generate-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: pdf.fullPath,
          fileName: pdf.displayName,
          language,
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
    stopSpeaking();
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
      stopSpeaking();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
    }
  }

  function goToScene(i: number) {
    stopSpeaking();
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

  // ============ PDF PICKER PHASE ============
  if (phase === "idle" && !selectedPdf) {
    const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

    return (
      <div className="space-y-6">
        {/* Language picker */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Languages className="w-4 h-4 text-purple-300" />
            <span className="text-sm font-semibold text-white">
              Choose lecture language
            </span>
          </div>
          <div className="relative" data-lang-menu>
            <button
              onClick={() => setShowLangMenu((v) => !v)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl glass hover:bg-white/10 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{currentLang.flag}</span>
                <div>
                  <div className="text-sm text-white font-medium">
                    {currentLang.native}
                  </div>
                  <div className="text-xs text-gray-500">
                    {currentLang.label} narration
                  </div>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            <AnimatePresence>
              {showLangMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -5, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full mt-2 left-0 right-0 glass rounded-xl overflow-hidden shadow-2xl z-20"
                >
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => {
                        setLanguage(l.code);
                        setShowLangMenu(false);
                      }}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-all ${
                        language === l.code
                          ? "bg-gradient-to-r from-purple-500/20 to-cyan-500/20"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <span className="text-2xl">{l.flag}</span>
                      <div className="flex-1">
                        <div className="text-sm text-white font-medium">
                          {l.native}
                        </div>
                        <div className="text-xs text-gray-500">
                          {l.label} narration
                        </div>
                      </div>
                      {language === l.code && (
                        <div className="w-2 h-2 rounded-full bg-purple-400" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {language === "hindi"
              ? "AI will generate the entire lecture in Hindi with Devanagari script and Hindi voice."
              : language === "hinglish"
              ? "AI will generate a mix of Hindi and English — natural Hinglish, like explaining to a friend."
              : "Standard English lecture with native English voice."}
          </p>
        </div>

        {/* PDF picker */}
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
                <span className="text-sm text-white font-medium truncate">
                  {pdf.displayName}
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-purple-300 transition-colors flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ============ PROGRESS PHASE ============
  if (phase === "analyzing" || phase === "generating") {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-6">
          <Loader2 className="w-10 h-10 text-purple-300 animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">
          Building your lecture
        </h2>
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

  // ============ ERROR PHASE ============
  if (phase === "error") {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <X className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Couldn&apos;t build lecture
        </h2>
        <p className="text-sm text-red-400 mb-6">{error}</p>
        <button
          onClick={reset}
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg transition-all"
        >
          Try another PDF
        </button>
      </div>
    );
  }

  // ============ PLAYER PHASE ============
  const scene = scenes[currentScene];
  if (!scene) return null;

  const progressPercent = ((currentScene + 1) / scenes.length) * 100;
  const isLast = currentScene === scenes.length - 1;
  const chapter = currentChapter();
  const sceneLang = detectLanguageFromText(scene.narration);
  const sceneVoice = getVoiceForLanguage(sceneLang);

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
            <span className="text-sm font-semibold text-white">
              {chapters.length} chapters
            </span>
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
                    <div
                      className={`text-xs font-medium truncate ${
                        isActive ? "text-white" : "text-gray-300"
                      }`}
                    >
                      {c.title}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {c.sceneCount} scenes
                    </div>
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

          {/* Scene language badge */}
          {speaking && (
            <div className="absolute top-4 right-20 px-3 py-1.5 rounded-full glass text-xs text-purple-300">
              {sceneLang === "hindi"
                ? "🇮🇳 हिंदी"
                : sceneLang === "hinglish"
                ? "🗣️ Hinglish"
                : "🌐 English"}
            </div>
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
                    <h2 className="text-xl md:text-3xl font-bold glow-text mb-4">
                      {scene.title}
                    </h2>
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
                      <h2 className="text-xl md:text-3xl font-bold text-white">
                        {scene.title}
                      </h2>
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
            {chapter && (
              <span className="text-gray-500 ml-2">
                · {chapter.title.slice(0, 20)}
              </span>
            )}
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
              if (voiceEnabled) stopSpeaking();
              setVoiceEnabled((v) => !v);
            }}
            className={`p-3 rounded-lg glass hover:bg-white/10 ${
              voiceEnabled ? "text-cyan-300" : "text-gray-500"
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Current voice info */}
          <div className="text-xs text-gray-500 ml-2 flex items-center gap-2">
            <Globe className="w-3 h-3" />
            {sceneVoice?.name?.slice(0, 30) || "Default voice"}
          </div>
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