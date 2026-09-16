// Shared TTS voice selection logic
// Supports English, Hindi, Hinglish
// Prefers Microsoft Edge Neural voices (best quality, Windows/Edge)

let cachedVoice: SpeechSynthesisVoice | null = null;
let cachedHindiVoice: SpeechSynthesisVoice | null = null;

// ============================================================
// VOICE NAME PREFERENCES
// ============================================================

// English voices (best quality first)
const PREFERRED_ENGLISH_VOICES = [
  // Edge Neural (best quality)
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
];

// Hindi voices (best quality first)
const PREFERRED_HINDI_VOICES = [
  // Edge Neural Hindi
  "Microsoft Swara Online (Natural) - Hindi (India)",
  "Microsoft Swara Online (Natural)",
  "Microsoft Swara Online",
  "Microsoft Madhur Online (Natural) - Hindi (India)",
  "Microsoft Madhur Online (Natural)",
  "Microsoft Madhur Online",
  // Chrome Hindi
  "Google हिन्दी",
  "Google Hindi",
  // Fallback
  "hi-IN",
];

// ============================================================
// DETECT LANGUAGE FROM TEXT
// ============================================================
export function detectLanguage(text: string): "hindi" | "english" | "hinglish" {
  // Devanagari script → definitely Hindi
  if (/[\u0900-\u097F]/.test(text)) return "hindi";

  // Check for common Hinglish words (Roman Hindi)
  const hinglishWords = [
    " hai", " hain", " ka ", " ki ", " ke ", " ko ", " mein ", " me ",
    " se ", " aap", " hum", " yeh", " kya", " aaj ", " kaise",
    " chaliye", " samjhenge", " karte", " karenge", " hoga", " hota",
    " nahi", " matlab", " basically", " basically ", " iske", " iska",
    " uske", " uski", " wala", " wali", " kuch", " bahut", " zyada",
  ];

  const lowerText = " " + text.toLowerCase() + " ";
  const matches = hinglishWords.filter((w) => lowerText.includes(w)).length;

  if (matches >= 2) return "hinglish";

  return "english";
}

// ============================================================
// PICK ENGLISH VOICE
// ============================================================
export function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  if (typeof window === "undefined") return null;
  if (!("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  // Try exact name matches first
  for (const name of PREFERRED_ENGLISH_VOICES) {
    const v = voices.find((voice) => voice.name === name);
    if (v) {
      cachedVoice = v;
      console.log("🎙️ English voice selected:", v.name);
      return v;
    }
  }

  // Try partial match for Microsoft Neural
  const msNeural = voices.find(
    (v) => v.name.includes("Microsoft") && v.name.includes("Online") && v.name.includes("Natural")
  );
  if (msNeural) {
    cachedVoice = msNeural;
    console.log("🎙️ English voice selected (MS Neural):", msNeural.name);
    return msNeural;
  }

  // Try Google US English
  const google = voices.find((v) => v.name.includes("Google US English"));
  if (google) {
    cachedVoice = google;
    console.log("🎙️ English voice selected (Google):", google.name);
    return google;
  }

  // Any en-IN voice (Indian English)
  const enIN = voices.find((v) => v.lang === "en-IN");
  if (enIN) {
    cachedVoice = enIN;
    return enIN;
  }

  // Any en-US voice
  const enUS = voices.find((v) => v.lang === "en-US");
  if (enUS) {
    cachedVoice = enUS;
    return enUS;
  }

  cachedVoice = voices[0] || null;
  return cachedVoice;
}

// ============================================================
// PICK HINDI VOICE
// ============================================================
export function pickHindiVoice(): SpeechSynthesisVoice | null {
  if (cachedHindiVoice) return cachedHindiVoice;
  if (typeof window === "undefined") return null;
  if (!("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  // Try exact name matches
  for (const name of PREFERRED_HINDI_VOICES) {
    if (name.length <= 3) continue; // skip lang codes
    const v = voices.find((voice) => voice.name === name);
    if (v) {
      cachedHindiVoice = v;
      console.log("🇮🇳 Hindi voice selected:", v.name);
      return v;
    }
  }

  // Try partial match for Swara/Madhur (Edge Neural Hindi voices)
  const swara = voices.find((v) => v.name.includes("Swara"));
  if (swara) {
    cachedHindiVoice = swara;
    console.log("🇮🇳 Hindi voice selected (Swara):", swara.name);
    return swara;
  }

  const madhur = voices.find((v) => v.name.includes("Madhur"));
  if (madhur) {
    cachedHindiVoice = madhur;
    console.log("🇮🇳 Hindi voice selected (Madhur):", madhur.name);
    return madhur;
  }

  // Any voice with lang hi-IN or hi-*
  const hindi = voices.find((v) => v.lang === "hi-IN" || v.lang.startsWith("hi"));
  if (hindi) {
    cachedHindiVoice = hindi;
    console.log("🇮🇳 Hindi voice selected (by lang):", hindi.name);
    return hindi;
  }

  // Try Google हिन्दी
  const googleHindi = voices.find((v) => v.name.includes("हिन्दी") || v.name.includes("Hindi"));
  if (googleHindi) {
    cachedHindiVoice = googleHindi;
    return googleHindi;
  }

  // Fallback: English voice (better than nothing)
  console.log("⚠️ No Hindi voice found — falling back to English");
  return pickEnglishVoice();
}

// ============================================================
// MAIN VOICE PICKER (by language)
// ============================================================
export function pickVoiceForLanguage(
  lang: "hindi" | "english" | "hinglish"
): SpeechSynthesisVoice | null {
  if (lang === "hindi") {
    return pickHindiVoice();
  }
  if (lang === "hinglish") {
    // For Hinglish, prefer Hindi voice (handles both Hindi words and English fine)
    const hindi = pickHindiVoice();
    if (hindi && (hindi.lang === "hi-IN" || hindi.lang.startsWith("hi"))) {
      return hindi;
    }
    // Or use English voice
    return pickEnglishVoice();
  }
  return pickEnglishVoice();
}

// ============================================================
// INIT — Wait for voices to load (Chrome/Edge async)
// ============================================================
export function initVoices(): () => void {
  if (typeof window === "undefined") return () => {};
  if (!("speechSynthesis" in window)) return () => {};

  // Initial pick
  pickEnglishVoice();
  pickHindiVoice();

  const handler = () => {
    cachedVoice = null;
    cachedHindiVoice = null;
    pickEnglishVoice();
    pickHindiVoice();
  };

  window.speechSynthesis.addEventListener("voiceschanged", handler);

  return () => {
    window.speechSynthesis.removeEventListener("voiceschanged", handler);
  };
}

// ============================================================
// SPEAK TEXT — auto-selects voice based on detected language
// ============================================================
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

  // Detect language from text
  const detected = detectLanguage(text);
  const voice = pickVoiceForLanguage(detected);

  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts.rate ?? (detected === "english" ? 1.0 : 0.9); // slower for Hindi
  u.pitch = opts.pitch ?? 1.0;
  u.volume = opts.volume ?? 1.0;
  u.lang = voice?.lang || (detected === "english" ? "en-US" : "hi-IN");
  if (voice) u.voice = voice;

  if (opts.onStart) u.onstart = opts.onStart;
  if (opts.onEnd) u.onend = opts.onEnd;
  if (opts.onError) u.onerror = opts.onError;

  console.log(`🔊 Speaking (${detected}) with:`, voice?.name);

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return u;
}

// ============================================================
// STOP
// ============================================================
export function stopSpeaking() {
  if (typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}