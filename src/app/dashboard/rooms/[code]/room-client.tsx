"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  ArrowLeft,
  Send,
  Loader2,
  Crown,
  Copy,
  Check,
  LogOut,
  FileText,
  Sparkles,
  Circle,
  ChevronLeft,
  ChevronRight,
  Link2,
  Link2Off,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Volume2,
  VolumeX,
  Tv,
  X,
  ListChecks,
  GraduationCap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { initVoices, speakText as speak, stopSpeaking as stop } from "@/lib/voice";

type Room = {
  id: string;
  code: string;
  name: string;
  hostId: string;
  fileName: string | null;
  pdfUrl: string;
};

type Member = {
  user_id: string;
  joined_at: string;
  last_seen: string;
};

type Message = {
  id: number;
  user_id: string;
  content: string;
  created_at: string;
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

type RoomEvent = {
  id: number;
  user_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export default function RoomClient({
  room,
  currentUserId,
}: {
  room: Room;
  currentUserId: string;
}) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [following, setFollowing] = useState(true);
  const [lastEventTime, setLastEventTime] = useState(0);

  const [lectureMode, setLectureMode] = useState(false);
  const [lectureLoading, setLectureLoading] = useState(false);
  const [lectureError, setLectureError] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentScene, setCurrentScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const isHost = room.hostId === currentUserId;

  // Init voices once
  useEffect(() => {
    const cleanup = initVoices();
    return cleanup;
  }, []);

  const scrollChatToBottom = useCallback(() => {
    setTimeout(() => {
      chatRef.current?.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  }, []);

  // ============ LOAD INITIAL DATA ============
  useEffect(() => {
    async function load() {
      const { data: memberData } = await supabase
        .from("room_members")
        .select("user_id, joined_at, last_seen")
        .eq("room_id", room.id);
      setMembers(memberData ?? []);

      const { data: msgData } = await supabase
        .from("room_messages")
        .select("id, user_id, content, created_at")
        .eq("room_id", room.id)
        .order("created_at", { ascending: true })
        .limit(200);
      setMessages(msgData ?? []);
      scrollChatToBottom();

      const { data: pageEvents } = await supabase
        .from("room_events")
        .select("payload")
        .eq("room_id", room.id)
        .eq("event_type", "page_change")
        .order("created_at", { ascending: false })
        .limit(1);
      if (pageEvents?.[0]) {
        const p = pageEvents[0].payload as { page?: number };
        if (p.page) setCurrentPage(p.page);
      }

      const { data: lectureEvents } = await supabase
        .from("room_events")
        .select("event_type, payload")
        .eq("room_id", room.id)
        .in("event_type", ["lecture_start", "lecture_stop", "lecture_scene"])
        .order("created_at", { ascending: false })
        .limit(5);

      if (lectureEvents && lectureEvents.length > 0) {
        const latest = lectureEvents[0];
        if (latest.event_type === "lecture_start") {
          const p = latest.payload as {
            scenes?: Scene[];
            chapters?: Chapter[];
            sceneIndex?: number;
          };
          if (p.scenes) {
            setScenes(p.scenes);
            setChapters(p.chapters || []);
            setLectureMode(true);
            setCurrentScene(p.sceneIndex ?? 0);
          }
        } else if (latest.event_type === "lecture_scene") {
          const p = latest.payload as { sceneIndex?: number };
          if (typeof p.sceneIndex === "number") setCurrentScene(p.sceneIndex);
        }
      }

      await supabase
        .from("room_members")
        .update({ last_seen: new Date().toISOString() })
        .eq("room_id", room.id)
        .eq("user_id", currentUserId);
    }
    load();
  }, [room.id, currentUserId, supabase, scrollChatToBottom]);

  // ============ REALTIME ============
  useEffect(() => {
    const channel = supabase
      .channel(`room-${room.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          scrollChatToBottom();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_members", filter: `room_id=eq.${room.id}` },
        () => {
          supabase
            .from("room_members")
            .select("user_id, joined_at, last_seen")
            .eq("room_id", room.id)
            .then(({ data }) => setMembers(data ?? []));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "room_members", filter: `room_id=eq.${room.id}` },
        () => {
          supabase
            .from("room_members")
            .select("user_id, joined_at, last_seen")
            .eq("room_id", room.id)
            .then(({ data }) => setMembers(data ?? []));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_events", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const evt = payload.new as RoomEvent;
          if (evt.user_id === currentUserId) return;

          if (evt.event_type === "page_change" && following) {
            const newPage = (evt.payload as { page?: number }).page;
            if (typeof newPage === "number") {
              setCurrentPage(newPage);
              setLastEventTime(Date.now());
            }
          } else if (evt.event_type === "lecture_start") {
            const p = evt.payload as { scenes?: Scene[]; chapters?: Chapter[]; sceneIndex?: number };
            if (p.scenes) {
              setScenes(p.scenes);
              setChapters(p.chapters || []);
              setLectureMode(true);
              setCurrentScene(p.sceneIndex ?? 0);
              setIsPlaying(false);
            }
          } else if (evt.event_type === "lecture_stop") {
            stop();
            setSpeaking(false);
            setLectureMode(false);
            setIsPlaying(false);
          } else if (evt.event_type === "lecture_scene") {
            const p = evt.payload as { sceneIndex?: number };
            if (typeof p.sceneIndex === "number") {
              stop();
              setSpeaking(false);
              setCurrentScene(p.sceneIndex);
            }
          } else if (evt.event_type === "lecture_play") {
            setIsPlaying(true);
          } else if (evt.event_type === "lecture_pause") {
            stop();
            setSpeaking(false);
            setIsPlaying(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, currentUserId, supabase, scrollChatToBottom, following]);

  // Heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      supabase
        .from("room_members")
        .update({ last_seen: new Date().toISOString() })
        .eq("room_id", room.id)
        .eq("user_id", currentUserId);
    }, 30000);
    return () => clearInterval(interval);
  }, [room.id, currentUserId, supabase]);

  // ============ SPEAK SCENE WHEN PLAYING ============
  useEffect(() => {
    if (!isPlaying || scenes.length === 0) return;
    const scene = scenes[currentScene];
    if (!scene) return;
    const isLast = currentScene >= scenes.length - 1;
    const MIN_SCENE_DURATION = 10000;
    const sceneStartTime = Date.now();
    let cancelled = false;

    const safetyTimeout = setTimeout(() => {
      if (cancelled) return;
      handleAdvance();
    }, 90000);

    function handleAdvance() {
      if (cancelled) return;
      const elapsed = Date.now() - sceneStartTime;
      const remaining = Math.max(0, MIN_SCENE_DURATION - elapsed);

      setTimeout(() => {
        if (cancelled) return;
        if (isLast) {
          setIsPlaying(false);
        } else if (isHost) {
          const nextIdx = currentScene + 1;
          setCurrentScene(nextIdx);
          broadcastLectureScene(nextIdx);
        } else {
          setIsPlaying(false);
        }
      }, remaining + 1200);
    }

    if (!voiceEnabled) {
      const t = setTimeout(() => {
        clearTimeout(safetyTimeout);
        handleAdvance();
      }, 6000);
      return () => {
        cancelled = true;
        clearTimeout(t);
        clearTimeout(safetyTimeout);
      };
    }

    const u = speak(scene.narration, {
      rate: 0.95,
      onStart: () => setSpeaking(true),
      onEnd: () => {
        setSpeaking(false);
        clearTimeout(safetyTimeout);
        handleAdvance();
      },
      onError: () => {
        setSpeaking(false);
        clearTimeout(safetyTimeout);
        handleAdvance();
      },
    });
    utteranceRef.current = u;

    return () => {
      cancelled = true;
      clearTimeout(safetyTimeout);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentScene, scenes, voiceEnabled, isHost]);

  // ============ BROADCAST ============
  const broadcastEvent = useCallback(
    async (type: string, payload: Record<string, unknown>) => {
      await supabase.from("room_events").insert({
        room_id: room.id,
        user_id: currentUserId,
        event_type: type,
        payload,
      });
    },
    [room.id, currentUserId, supabase]
  );

  const broadcastPage = useCallback(
    (page: number) => broadcastEvent("page_change", { page }),
    [broadcastEvent]
  );

  const broadcastLectureScene = useCallback(
    (sceneIndex: number) => broadcastEvent("lecture_scene", { sceneIndex }),
    [broadcastEvent]
  );

  const changePage = useCallback(
    (newPage: number) => {
      if (newPage < 1 || newPage > 999) return;
      setCurrentPage(newPage);
      broadcastPage(newPage);
    },
    [broadcastPage]
  );

  // ============ CHAT ============
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    const optimistic: Message = {
      id: Date.now(),
      user_id: currentUserId,
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollChatToBottom();
    const { error } = await supabase.from("room_messages").insert({
      room_id: room.id,
      user_id: currentUserId,
      content: text,
    });
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
    setSending(false);
  }

  // ============ LECTURE CONTROLS ============
  async function startLecture() {
    if (!isHost) return;
    if (!room.fileName || !room.pdfUrl) {
      setLectureError("Room needs a PDF to start a lecture");
      return;
    }

    setLectureLoading(true);
    setLectureError("");

    try {
      const { data: roomData } = await supabase
        .from("study_rooms")
        .select("file_path, file_name")
        .eq("id", room.id)
        .single();

      if (!roomData?.file_path) {
        setLectureError("Room has no PDF attached");
        setLectureLoading(false);
        return;
      }

      const res = await fetch("/api/lecture/generate-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: roomData.file_path,
          fileName: roomData.file_name || "Lecture",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate lecture");

      setScenes(data.scenes);
      setChapters(data.chapters || []);
      setCurrentScene(0);
      setLectureMode(true);

      await broadcastEvent("lecture_start", {
        scenes: data.scenes,
        chapters: data.chapters,
        sceneIndex: 0,
      });
    } catch (err) {
      setLectureError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLectureLoading(false);
    }
  }

  async function stopLecture() {
    if (!isHost) return;
    stop();
    setSpeaking(false);
    setIsPlaying(false);
    setLectureMode(false);
    setScenes([]);
    setChapters([]);
    setCurrentScene(0);
    await broadcastEvent("lecture_stop", {});
  }

  async function togglePlay() {
    if (!isHost) return;
    if (isPlaying) {
      stop();
      setSpeaking(false);
      setIsPlaying(false);
      await broadcastEvent("lecture_pause", {});
    } else {
      setIsPlaying(true);
      await broadcastEvent("lecture_play", {});
    }
  }

  async function gotoScene(idx: number) {
    if (!isHost) return;
    stop();
    setSpeaking(false);
    setIsPlaying(false);
    setCurrentScene(idx);
    await broadcastLectureScene(idx);
  }

  async function nextScene() {
    if (!isHost) return;
    if (currentScene < scenes.length - 1) await gotoScene(currentScene + 1);
  }

  async function prevScene() {
    if (!isHost) return;
    if (currentScene > 0) await gotoScene(currentScene - 1);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function leaveRoom() {
    if (!confirm("Leave this room?")) return;
    stop();
    setSpeaking(false);
    await supabase
      .from("room_members")
      .delete()
      .eq("room_id", room.id)
      .eq("user_id", currentUserId);
    router.push("/dashboard/rooms");
  }

  const activeMembers = members.filter((m) => {
    const lastSeen = new Date(m.last_seen).getTime();
    return Date.now() - lastSeen < 120000;
  });

  const pdfSrc = room.pdfUrl ? `${room.pdfUrl}#page=${currentPage}&toolbar=0&navpanes=0` : "";
  const scene = scenes[currentScene];

  return (
    <main className="relative h-screen flex flex-col overflow-hidden">
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-50" />

      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/dashboard/rooms" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
            Rooms
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-white truncate">{room.name}</span>
            {isHost && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 flex items-center gap-1 flex-shrink-0">
                <Crown className="w-3 h-3" />
                Host
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {room.pdfUrl && !lectureMode && (
            <button
              onClick={isHost ? startLecture : undefined}
              disabled={lectureLoading || !isHost}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {lectureLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Tv className="w-3 h-3" />}
              {lectureLoading ? "Generating..." : "Start Lecture"}
            </button>
          )}
          {lectureMode && (
            <button
              onClick={isHost ? stopLecture : undefined}
              disabled={!isHost}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30"
            >
              <X className="w-3 h-3" />
              {isHost ? "End Lecture" : "Following"}
            </button>
          )}
          <button
            onClick={copyCode}
            className="flex items-center gap-2 text-xs font-mono text-purple-300 hover:text-white px-3 py-2 rounded-lg glass hover:bg-white/10 transition-all"
          >
            {room.code}
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>
          <button
            onClick={leaveRoom}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-400 px-3 py-2 rounded-lg glass hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-3 h-3" />
            Leave
          </button>
        </div>
      </nav>

      {room.pdfUrl && !lectureMode && (
        <div className="relative z-10 flex items-center gap-3 px-6 py-2 border-b border-white/5 bg-black/20">
          <button
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-2 rounded-lg glass hover:bg-white/10 text-gray-300 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-white">Page {currentPage}</span>
          {lastEventTime > 0 && following && !isHost && (
            <span className="text-xs text-cyan-400 flex items-center gap-1">
              <Link2 className="w-3 h-3" />
              Following host
            </span>
          )}
          <button
            onClick={() => changePage(currentPage + 1)}
            className="p-2 rounded-lg glass hover:bg-white/10 text-gray-300 hover:text-white"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setFollowing((f) => !f)}
            className={`ml-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
              following
                ? "bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/40 text-white"
                : "glass text-gray-400 hover:text-white"
            }`}
          >
            {following ? <Link2 className="w-3 h-3" /> : <Link2Off className="w-3 h-3" />}
            {following ? "Following" : "Free scroll"}
          </button>
        </div>
      )}

      <div className="relative z-10 flex-1 grid lg:grid-cols-[1fr_340px] overflow-hidden">
        <div className="overflow-hidden bg-black/20 border-r border-white/5 flex flex-col">
          {lectureError && (
            <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-sm text-red-300 flex items-center justify-between">
              <span>{lectureError}</span>
              <button onClick={() => setLectureError("")} className="text-red-400 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {lectureMode && scene ? (
            <>
              <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-[#05060f] to-[#0a0d20]">
                <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

                {speaking && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full glass z-10">
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
                  </div>
                )}

                {!isHost && (
                  <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full glass text-xs text-purple-300 flex items-center gap-1 z-10">
                    <Link2 className="w-3 h-3" />
                    Following host
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
                      {(scene.type === "teach" || scene.type === "definition" || scene.type === "example") && (
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
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-300"
                    style={{ width: `${((currentScene + 1) / scenes.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="glass border-t border-white/5 p-3 flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={isHost ? () => gotoScene(0) : undefined}
                  disabled={!isHost}
                  className="p-2.5 rounded-lg glass hover:bg-white/10 text-gray-300 hover:text-white disabled:opacity-30"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={isHost ? prevScene : undefined}
                  disabled={!isHost || currentScene === 0}
                  className="p-2.5 rounded-lg glass hover:bg-white/10 text-gray-300 hover:text-white disabled:opacity-30"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  onClick={isHost ? togglePlay : undefined}
                  disabled={!isHost}
                  className="p-3 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 text-white hover:shadow-lg disabled:opacity-50"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
                <button
                  onClick={isHost ? nextScene : undefined}
                  disabled={!isHost || currentScene >= scenes.length - 1}
                  className="p-2.5 rounded-lg glass hover:bg-white/10 text-gray-300 hover:text-white disabled:opacity-30"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    if (voiceEnabled) stop();
                    setSpeaking(false);
                    setVoiceEnabled((v) => !v);
                  }}
                  className={`p-2.5 rounded-lg glass hover:bg-white/10 ${
                    voiceEnabled ? "text-cyan-300" : "text-gray-500"
                  }`}
                >
                  {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <span className="text-xs text-gray-500 ml-2">
                  Scene {currentScene + 1}/{scenes.length}
                  {!isHost && " · host controls"}
                </span>
              </div>
            </>
          ) : room.pdfUrl ? (
            <iframe key={pdfSrc} src={pdfSrc} className="w-full h-full" title="Room PDF" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <FileText className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">No PDF attached to this room</p>
            </div>
          )}
        </div>

        <div className="flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-purple-300" />
              <span className="text-xs font-semibold text-white">Members ({members.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {members.slice(0, 8).map((m) => {
                const isActive = activeMembers.find((a) => a.user_id === m.user_id);
                const isMe = m.user_id === currentUserId;
                return (
                  <div
                    key={m.user_id}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${
                      isMe
                        ? "bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/40 text-white"
                        : "glass text-gray-300"
                    }`}
                  >
                    <Circle
                      className={`w-2 h-2 ${
                        isActive ? "fill-green-400 text-green-400" : "fill-gray-500 text-gray-500"
                      }`}
                    />
                    <span className="font-mono">{isMe ? "you" : m.user_id.slice(0, 6)}</span>
                    {m.user_id === room.hostId && <Crown className="w-3 h-3 text-yellow-300" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-white/5">
              <span className="text-xs font-semibold text-white">Chat</span>
            </div>
            <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <Sparkles className="w-6 h-6 mx-auto text-purple-300/50 mb-2" />
                  <p className="text-xs text-gray-500">Start chatting</p>
                </div>
              )}
              <AnimatePresence initial={false}>
                {messages.map((m) => {
                  const isMe = m.user_id === currentUserId;
                  const time = new Date(m.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div className="max-w-[85%]">
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] text-gray-500">
                          {!isMe && <span className="font-mono">{m.user_id.slice(0, 6)}</span>}
                          <span>{time}</span>
                        </div>
                        <div
                          className={`rounded-2xl px-3 py-2 text-sm break-words ${
                            isMe
                              ? "bg-gradient-to-r from-purple-600 to-cyan-500 text-white"
                              : "glass text-gray-200"
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            <form onSubmit={handleSend} className="px-4 py-3 border-t border-white/5">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  maxLength={500}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="px-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white hover:shadow-lg disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}