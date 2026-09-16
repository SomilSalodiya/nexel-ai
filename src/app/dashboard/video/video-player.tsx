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
  Languages,
  ChevronDown,
  Globe,
} from "lucide-react";
import dynamic from "next/dynamic";

const MermaidDiagram = dynamic(() => import("./mermaid-diagram"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 text-purple-300 animate-spin" />
    </div>
  ),
});

type Pdf = {
  name: string;
  fullPath: string;
  displayName: string;
};

type ChartData = { label: string; value: number }[];

type Scene =
  | { type: "title"; title: string; subtitle?: string; narration: string }
  | { type: "teach"; title: string; content: string; narration: string }
  | { type: "bullets"; title: string; bullets: string[]; narration: string }
  | { type: "diagram"; title: string; mermaid: string; narration: string }
  | { type: "pie"; title: string; data: ChartData; narration: string }
  | { type: "bar"; title: string; data: ChartData; narration: string }
  | { type: "recap"; title: string; bullets: string[]; narration: string };

type Script = {
  title: string;
  scenes: Scene[];
};

type Language = "english" | "hindi" | "hinglish";

const LANGUAGES: { code: Language; label: string; native: string; flag: string }[] = [
  { code: "english", label: "English", native: "English", flag: "🌐" },
  { code: "hindi", label: "Hindi", native: "हिंदी", flag: "🇮🇳" },
  { code: "hinglish", label: "Hinglish", native: "Hinglish", flag: "🗣️" },
];

const COLORS = ["#a855f7", "#22d3ee", "#f472b6", "#facc15", "#34d399"];

// ============ LANGUAGE DETECTION ============
function detectLanguageFromText(text: string): "hindi" | "english" | "hinglish" {
  if (/[\u0900-\u097F]/.test(text)) return "hindi";

  const hinglishWords = [
    " hai", " hain", " ka ", " ki ", " ke ", " ko ", " mein ", " me ", " se ",
    " aap", " hum", " yeh", " kya", " aaj ", " kaise", " chaliye", " samjhenge",
    " karte", " karenge", " hoga", " hota", " nahi", " matlab",
  ];
  const lowerText = " " + text.toLowerCase() + " ";
  const matches = hinglishWords.filter((w) => lowerText.includes(w)).length;
  if (matches >= 2) return "hinglish";

  return "english";
}

// ============ PIE CHART ============
function PieChart({ data }: { data: ChartData }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const size = 220;
  const radius = 90;
  const cx = size / 2;
  const cy = size / 2;

  let cumulative = 0;
  const slices = data.map((d, i) => {
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += d.value;
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { path, color: COLORS[i % COLORS.length], ...d };
  });

  return (
    <div className="flex flex-col md:flex-row items-center gap-8">
      <motion.svg
        width={size}
        height={size}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {slices.map((s, i) => (
          <motion.path
            key={i}
            d={s.path}
            fill={s.color}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 + i * 0.15, duration: 0.5 }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          />
        ))}
        <circle cx={cx} cy={cy} r={50} fill="#05060f" />
      </motion.svg>
      <div className="space-y-2">
        {slices.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.12 }}
            className="flex items-center gap-3"
          >
            <div className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
            <span className="text-sm text-gray-200">{s.label}</span>
            <span className="text-sm text-gray-500 ml-auto">
              {Math.round((s.value / total) * 100)}%
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ============ BAR CHART ============
function BarChart({ data }: { data: ChartData }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-24 text-right text-sm text-gray-300 truncate">{d.label}</div>
          <div className="flex-1 h-8 bg-white/5 rounded-lg overflow-hidden relative">
            <motion.div
              className="h-full rounded-lg"
              style={{
                background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 1) % COLORS.length]})`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${(d.value / max) * 100}%` }}
              transition={{ delay: 0.4 + i * 0.15, duration: 0.7 }}
            />
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 + i * 0.15 }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-white"
            >
              {d.value}
            </motion.span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ MAIN PLAYER ============
export default function VideoPlayer({ pdfs }: { pdfs: Pdf[] }) {
  const [selectedPdf, setSelectedPdf] = useState<Pdf | null>(null);
  const [language, setLanguage] = useState<Language>("english");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [script, setScript] = useState<Script | null>(null);
  const [currentScene, setCurrentScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const chosenVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // ============ VOICE INIT ============
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;

    function pickVoice() {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;
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

  const getVoiceForLanguage = useCallback(
    (lang: "hindi" | "english" | "hinglish"): SpeechSynthesisVoice | null => {
      if (typeof window === "undefined") return null;
      if (!("speechSynthesis" in window)) return null;

      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return chosenVoiceRef.current;

      if (lang === "hindi") {
        return (
          voices.find((v) => v.name.includes("Swara")) ||
          voices.find((v) => v.name.includes("Madhur")) ||
          voices.find((v) => v.lang === "hi-IN") ||
          voices.find((v) => v.lang.startsWith("hi")) ||
          chosenVoiceRef.current
        );
      }

      if (lang === "hinglish") {
        return (
          voices.find((v) => v.name.includes("Swara")) ||
          voices.find((v) => v.name.includes("Madhur")) ||
          voices.find((v) => v.lang === "hi-IN") ||
          voices.find((v) => v.name === "Google US English") ||
          voices.find((v) => v.lang === "en-IN") ||
          chosenVoiceRef.current
        );
      }

      return (
        voices.find((v) => v.name === "Google US English") ||
        voices.find((v) => v.name.includes("Microsoft Aria")) ||
        voices.find((v) => v.lang === "en-US" && v.localService) ||
        voices.find((v) => v.lang === "en-US") ||
        chosenVoiceRef.current
      );
    },
    []
  );

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
      u.rate = detected === "english" ? 0.95 : 0.9;
      u.pitch = 1.0;
      u.volume = 1.0;
      u.lang = voice?.lang || (detected === "english" ? "en-US" : "hi-IN");
      if (voice) u.voice = voice;

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

  // ============ AUTO-PLAY ============
  useEffect(() => {
    if (!isPlaying || !script) return;
    const scene = script.scenes[currentScene];
    if (!scene) return;
    const isLast = currentScene >= script.scenes.length - 1;

    speakText(scene.narration, () => {
      if (isLast) setIsPlaying(false);
      else setCurrentScene((s) => Math.min(s + 1, script.scenes.length - 1));
    });

    return () => {
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentScene, script]);

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

  async function generateScript(pdf: Pdf) {
    stopSpeaking();
    setSelectedPdf(pdf);
    setLoading(true);
    setError("");
    setScript(null);
    setCurrentScene(0);
    setIsPlaying(false);
    try {
      const res = await fetch("/api/generate-video-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: pdf.fullPath,
          fileName: pdf.displayName,
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate video");
      setScript({ title: data.title, scenes: data.scenes });
      setCurrentScene(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    stopSpeaking();
    setSelectedPdf(null);
    setScript(null);
    setCurrentScene(0);
    setIsPlaying(false);
    setError("");
  }

  function togglePlay() {
    if (!script) return;
    if (currentScene >= script.scenes.length - 1 && !isPlaying) {
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

  function nextScene() {
    stopSpeaking();
    if (!script) return;
    setIsPlaying(false);
    setCurrentScene((s) => Math.min(s + 1, script.scenes.length - 1));
  }

  function prevScene() {
    stopSpeaking();
    if (!script) return;
    setIsPlaying(false);
    setCurrentScene((s) => Math.max(s - 1, 0));
  }

  function restart() {
    stopSpeaking();
    setCurrentScene(0);
    setIsPlaying(false);
  }

  // ============ PDF PICKER ============
  if (!selectedPdf) {
    const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

    return (
      <div className="space-y-6">
        {/* Language picker */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Languages className="w-4 h-4 text-purple-300" />
            <span className="text-sm font-semibold text-white">
              Choose video language
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
                  <div className="text-sm text-white font-medium">{currentLang.native}</div>
                  <div className="text-xs text-gray-500">{currentLang.label} narration</div>
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
                        <div className="text-sm text-white font-medium">{l.native}</div>
                        <div className="text-xs text-gray-500">{l.label} narration</div>
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
        </div>

        {/* PDF picker */}
        <div className="space-y-3">
          {pdfs.map((pdf) => (
            <button
              key={pdf.name}
              onClick={() => generateScript(pdf)}
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

  if (loading) {
    return (
      <div className="glass rounded-2xl p-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-4">
          <Loader2 className="w-8 h-8 text-purple-300 animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Writing your video script...
        </h2>
        <p className="text-sm text-gray-400">
          AI is analyzing &quot;{selectedPdf.displayName}&quot;
        </p>
        <p className="text-xs text-gray-500 mt-2">This takes ~15 seconds</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <X className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Couldn&apos;t generate video
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

  if (!script) return null;

  const scene = script.scenes[currentScene];
  const progress = ((currentScene + 1) / script.scenes.length) * 100;
  const isLast = currentScene === script.scenes.length - 1;
  const sceneLang = detectLanguageFromText(scene.narration);
  const sceneVoice = getVoiceForLanguage(sceneLang);

  return (
    <div className="space-y-6">
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

        {/* Language badge while speaking */}
        {speaking && (
          <div className="absolute top-4 right-20 px-3 py-1.5 rounded-full glass text-xs text-purple-300">
            {sceneLang === "hindi" ? "🇮🇳 हिंदी" : sceneLang === "hinglish" ? "🗣️ Hinglish" : "🌐 English"}
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
                    NEXEL AI · STUDY VIDEO
                  </div>
                  <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
                    {scene.title}
                  </h1>
                  {scene.subtitle && (
                    <p className="text-base md:text-lg text-gray-400 mt-3">
                      {scene.subtitle}
                    </p>
                  )}
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

              {scene.type === "bullets" && (
                <div className="max-w-2xl mx-auto">
                  <h2 className="text-xl md:text-3xl font-bold glow-text mb-5 text-center">{scene.title}</h2>
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
                  <h2 className="text-xl md:text-3xl font-bold glow-text mb-5 text-center">
                    {scene.title}
                  </h2>
                  <div className="space-y-2">
                    {scene.bullets.map((b, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 + i * 0.1 }}
                        className="flex items-start gap-3 glass rounded-lg p-3"
                      >
                        <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0 text-xs">
                          ✓
                        </div>
                        <span className="text-sm md:text-base text-gray-200">{b}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {scene.type === "diagram" && (
                <div>
                  <h2 className="text-lg md:text-2xl font-bold glow-text mb-4 text-center">{scene.title}</h2>
                  <div className="glass rounded-xl p-4 max-h-[300px] overflow-auto">
                    <MermaidDiagram code={scene.mermaid} />
                  </div>
                </div>
              )}

              {scene.type === "pie" && (
                <div>
                  <h2 className="text-lg md:text-2xl font-bold glow-text mb-4 text-center">{scene.title}</h2>
                  <PieChart data={scene.data} />
                </div>
              )}

              {scene.type === "bar" && (
                <div>
                  <h2 className="text-lg md:text-2xl font-bold glow-text mb-4 text-center">{scene.title}</h2>
                  <BarChart data={scene.data} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full glass text-xs text-gray-300">
          Scene {currentScene + 1} / {script.scenes.length}
        </div>
      </div>

      <div className="glass rounded-2xl p-4 flex items-center justify-center gap-3 flex-wrap">
        <button
          onClick={restart}
          className="p-3 rounded-lg glass hover:bg-white/10 text-gray-300 hover:text-white"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={prevScene}
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
          onClick={nextScene}
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

        <div className="text-xs text-gray-500 ml-2 flex items-center gap-2">
          <Globe className="w-3 h-3" />
          {sceneVoice?.name?.slice(0, 30) || "Default voice"}
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">
          Scenes ({script.scenes.length})
        </h3>
        <div className="space-y-2">
          {script.scenes.map((s, i) => (
            <button
              key={i}
              onClick={() => {
                stopSpeaking();
                setIsPlaying(false);
                setCurrentScene(i);
              }}
              className={`w-full text-left p-3 rounded-lg transition-all flex items-center gap-3 ${
                i === currentScene
                  ? "bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30"
                  : "bg-white/5 hover:bg-white/10 border border-white/5"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  i === currentScene
                    ? "bg-gradient-to-br from-purple-500 to-cyan-500 text-white"
                    : "bg-white/5 text-gray-400"
                }`}
              >
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white truncate">
                  {s.type === "title" && s.title}
                  {s.type === "teach" && s.title}
                  {s.type === "bullets" && s.title}
                  {s.type === "recap" && s.title}
                  {s.type === "pie" && s.title}
                  {s.type === "bar" && s.title}
                  {s.type === "diagram" && s.title}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {s.type.toUpperCase()} · {s.narration.slice(0, 50)}...
                </div>
              </div>
              {i === currentScene && (
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => selectedPdf && generateScript(selectedPdf)}
          className="flex-1 py-3 rounded-lg glass text-white font-medium hover:bg-white/10 transition-all"
        >
          Regenerate
        </button>
        <button
          onClick={reset}
          className="flex-1 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg transition-all"
        >
          Choose another PDF
        </button>
      </div>
    </div>
  );
}