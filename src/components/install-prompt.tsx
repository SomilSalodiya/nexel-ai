"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already dismissed
    if (localStorage.getItem("pwa-dismissed") === "1") {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setShow(false);
    setDismissed(true);
    localStorage.setItem("pwa-dismissed", "1");
  }

  if (!show || dismissed || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 glass rounded-2xl p-4 shadow-2xl shadow-purple-500/20 max-w-sm animate-in slide-in-from-bottom">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-gray-500 hover:text-white p-1"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">
            Install Nexel AI
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Get the app on your device for faster access
          </p>
          <button
            onClick={handleInstall}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white text-xs font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            Install App
          </button>
        </div>
      </div>
    </div>
  );
}