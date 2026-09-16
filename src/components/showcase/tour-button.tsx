"use client";

import { Sparkles } from "lucide-react";

export default function TourButton() {
  function handleClick() {
    window.dispatchEvent(new CustomEvent("start-feature-tour"));
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 text-sm text-white px-3 py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 hover:shadow-lg hover:shadow-yellow-500/50 transition-all"
      title="Take a tour of Nexel AI"
    >
      <Sparkles className="w-4 h-4" />
      Tour
    </button>
  );
}