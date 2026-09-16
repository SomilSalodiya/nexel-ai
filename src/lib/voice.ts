// Shared TTS voice selection logic
// Prefers Edge Neural voices (Microsoft), falls back to Chrome's best

let cachedVoice: SpeechSynthesisVoice | null = null;

const PREFERRED_VOICE_NAMES = [
  // Edge Neural (best quality, Windows/Edge only)
  "Microsoft Aria Online (Natural) - English (United States)",
  "Microsoft Aria Online (Natural)",
  "Microsoft Aria Online",
  "Microsoft Jenny Online (Natural) - English (United States)",
  "Microsoft Jenny Online (Natural)",
  "Microsoft Guy Online (Natural) - English (United States)",
  "Microsoft Guy Online (Natural)",
  "Microsoft Ryan Online (Natural) - English (United States)",
  "Microsoft Sonia Online (Natural) - English (United Kingdom)",
  // Chrome's best
  "Google US English",
  "Google UK English Female",
  "Google UK English Male",
  // macOS
  "Samantha",
  "Alex",
  // Generic fallbacks
];

export function pickBestVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  if (typeof window === "undefined") return null;
  if (!("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  // Try exact name matches first
  for (const name of PREFERRED_VOICE_NAMES) {
    const v = voices.find((voice) => voice.name === name);
    if (v) {
      cachedVoice = v;
      console.log("🎙️ Voice selected (exact):", v.name);
      return v;
    }
  }

  // Try partial match for Microsoft Neural
  const msNeural = voices.find(
    (v) => v.name.includes("Microsoft") && v.name.includes("Online") && v.name.includes("Natural")
  );
  if (msNeural) {
    cachedVoice = msNeural;
    console.log("🎙️ Voice selected (MS Neural):", msNeural.name);
    return msNeural;
  }

  // Try any Microsoft Online voice
  const msAny = voices.find((v) => v.name.includes("Microsoft") && v.name.includes("Online"));
  if (msAny) {
    cachedVoice = msAny;
    console.log("🎙️ Voice selected (MS):", msAny.name);
    return msAny;
  }

  // Try Google US English
  const google = voices.find((v) => v.name.includes("Google US English"));
  if (google) {
    cachedVoice = google;
    console.log("🎙️ Voice selected (Google):", google.name);
    return google;
  }

  // Try any en-US voice
  const enUS = voices.find((v) => v.lang === "en-US");
  if (enUS) {
    cachedVoice = enUS;
    console.log("🎙️ Voice selected (en-US fallback):", enUS.name);
    return enUS;
  }

  // Any voice
  cachedVoice = voices[0] || null;
  console.log("🎙️ Voice selected (default):", cachedVoice?.name);
  return cachedVoice;
}

// Wait for voices to load (Chrome loads async)
export function initVoices(): () => void {
  if (typeof window === "undefined") return () => {};
  if (!("speechSynthesis" in window)) return () => {};

  pickBestVoice();

  const handler = () => {
    cachedVoice = null; // reset cache
    pickBestVoice();
  };

  window.speechSynthesis.addEventListener("voiceschanged", handler);

  return () => {
    window.speechSynthesis.removeEventListener("voiceschanged", handler);
  };
}

// Speak text with the best voice
export function speakText(
  text: string,
  opts: {
    rate?: number;
    pitch?: number;
    volume?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  } = {}
): SpeechSynthesisUtterance | null {
  if (typeof window === "undefined") return null;
  if (!("speechSynthesis" in window)) return null;

  const voice = pickBestVoice();

  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts.rate ?? 1.0;
  u.pitch = opts.pitch ?? 1.0;
  u.volume = opts.volume ?? 1.0;
  u.lang = voice?.lang || "en-US";
  if (voice) u.voice = voice;

  if (opts.onStart) u.onstart = opts.onStart;
  if (opts.onEnd) u.onend = opts.onEnd;
  if (opts.onError) u.onerror = opts.onError;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return u;
}

export function stopSpeaking() {
  if (typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}