"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  Loader2,
  ChevronRight,
  Crown,
  FileText,
  Clock,
  Plus,
  LogIn,
} from "lucide-react";

type Room = {
  id: string;
  code: string;
  name: string;
  isHost: boolean;
  fileName: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export default function RoomsClient() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  async function loadRooms() {
    try {
      const res = await fetch("/api/rooms/list");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRooms(data.rooms || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRooms();
  }, []);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinError("");

    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not join");

      router.push(`/dashboard/rooms/${data.room.code}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Unknown error");
      setJoining(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Join by code */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <LogIn className="w-4 h-4 text-cyan-300" />
          <h2 className="text-sm font-semibold text-white">Join with a code</h2>
        </div>
        <form onSubmit={handleJoin} className="flex gap-2 flex-wrap">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="STUDY-XXXX"
            maxLength={20}
            className="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-500 focus:outline-none focus:border-purple-500/50 tracking-wider"
          />
          <button
            type="submit"
            disabled={joining || !joinCode.trim()}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Join Room
          </button>
        </form>
        {joinError && (
          <p className="text-sm text-red-400 mt-3">{joinError}</p>
        )}
      </div>

      {/* Room list */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-300" />
          Your rooms ({rooms.length})
        </h2>

        {loading && (
          <div className="glass rounded-2xl p-12 text-center">
            <Loader2 className="w-6 h-6 text-purple-300 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading rooms...</p>
          </div>
        )}

        {!loading && rooms.length === 0 && (
          <div className="glass rounded-2xl p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-purple-300" />
            </div>
            <h3 className="text-white font-semibold mb-2">No rooms yet</h3>
            <p className="text-sm text-gray-500 mb-6">
              Create a room or join one with a code.
            </p>
            <Link
              href="/dashboard/rooms/new"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
            >
              <Plus className="w-4 h-4" />
              Create your first room
            </Link>
          </div>
        )}

        {!loading && rooms.length > 0 && (
          <div className="space-y-3">
            {rooms.map((room, i) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href={`/dashboard/rooms/${room.code}`}
                  className="glass rounded-2xl p-5 hover:bg-white/[0.08] transition-all flex items-center gap-4 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-purple-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-base text-white font-semibold truncate">
                        {room.name}
                      </h3>
                      {room.isHost && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 flex items-center gap-1 flex-shrink-0">
                          <Crown className="w-3 h-3" />
                          Host
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      <span className="font-mono text-purple-300">
                        {room.code}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {room.memberCount}{" "}
                        {room.memberCount === 1 ? "member" : "members"}
                      </span>
                      {room.fileName && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1 truncate">
                            <FileText className="w-3 h-3" />
                            {room.fileName.replace(/^\d+-/, "").slice(0, 40)}
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(room.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-purple-300 transition-colors flex-shrink-0" />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}