import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Groq from "groq-sdk";
import { kmeans } from "ml-kmeans";

export const runtime = "nodejs";
export const maxDuration = 300;

type ChunkRow = {
  id: number;
  chunk_index: number;
  content: string;
  embedding: number[] | string;
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

function parseEmbedding(raw: number[] | string): number[] {
  if (Array.isArray(raw)) return raw;
  const cleaned = raw.replace(/^\[|\]$/g, "");
  return cleaned.split(",").map((n) => parseFloat(n));
}

function fallbackTitle(content: string): string {
  const text = content.slice(0, 300).replace(/\s+/g, " ");
  const sentences = text.split(/[.!?]\s+/);
  const first = sentences[0] || text;
  const words = first.split(" ").filter((w) => w.length > 0);
  const skip = new Set([
    "the", "a", "an", "in", "on", "at", "of", "to", "for", "is", "are",
    "was", "were", "this", "that", "and", "or", "but",
  ]);
  let startIdx = 0;
  while (startIdx < words.length - 5 && skip.has(words[startIdx].toLowerCase()))
    startIdx++;
  const picked = words.slice(startIdx, startIdx + 5).join(" ");
  const cleaned = picked.replace(/[^a-zA-Z0-9\s-]/g, "").trim();
  if (cleaned.length < 8) return "Study Topics";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// ============================================================
// ROBUST JSON EXTRACTOR — handles Hindi, Hinglish, unicode, fences
// ============================================================
function extractJSON(text: string): unknown {
  if (!text) return null;

  let cleaned = text.trim();
  // Remove markdown code fences
  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");
  cleaned = cleaned.trim();

  // Direct parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // continue
  }

  // Find first { and last }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonStr);
    } catch {
      // continue
    }

    // Aggressive cleanup: replace unescaped newlines inside strings
    try {
      const fixed = jsonStr.replace(
        /"((?:[^"\\]|\\.)*)"/g,
        (match) =>
          match
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r")
            .replace(/\t/g, "\\t")
      );
      return JSON.parse(fixed);
    } catch {
      // continue
    }

    // Try replacing smart quotes
    try {
      const fixed = jsonStr
        .replace(/[\u201C\u201D]/g, '\\"')
        .replace(/[\u2018\u2019]/g, "'");
      return JSON.parse(fixed);
    } catch {
      // continue
    }
  }

  return null;
}

function getLanguageInstruction(lang: Language): string {
  if (lang === "hindi") {
    return `LANGUAGE: Write ALL narration in HINDI (Devanagari script).
Example: "आज हम HTTP के बारे में सीखेंगे। यह एक प्रोटोकॉल है जिसका उपयोग वेब पर किया जाता है।"
- Titles and bullets also in Devanagari
- The "content" field also in Hindi
- Keep technical terms (HTTP, HTML, CSS) in English`;
  }
  if (lang === "hinglish") {
    return `LANGUAGE: Write ALL narration in HINGLISH — natural mix of Hindi and English.
Example: "Aaj hum HTTP ke baare mein seekhenge. Yeh ek protocol hai jiska use web par hota hai."
- Use ROMAN script only (no Devanagari)
- Do NOT use double quotes inside text — use single quotes or none
- Keep technical terms (HTTP, HTML, CSS) in English`;
  }
  return "LANGUAGE: Write all narration in clear English.";
}

async function callGroq(
  groq: Groq,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 3500
): Promise<string> {
  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: maxTokens,
    });
    return completion.choices[0]?.message?.content || "";
  } catch (err) {
    console.log("20b failed:", err instanceof Error ? err.message.slice(0, 80) : "");
  }
  await new Promise((r) => setTimeout(r, 1200));
  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: maxTokens,
    });
    return completion.choices[0]?.message?.content || "";
  } catch (err) {
    console.log("120b failed:", err instanceof Error ? err.message.slice(0, 80) : "");
    throw err;
  }
}

async function nameCluster(
  groq: Groq,
  chunks: ChunkRow[],
  language: Language
): Promise<string> {
  const sorted = [...chunks].sort((a, b) => a.chunk_index - b.chunk_index);
  const mid = Math.floor(sorted.length / 2);
  const samples = [0, mid, sorted.length - 1].filter(
    (i, idx, arr) => arr.indexOf(i) === idx && i >= 0 && i < sorted.length
  );
  const content = samples
    .map((i) => sorted[i].content.slice(0, 400))
    .join("\n\n")
    .slice(0, 1400);

  let langRule = "Output ONLY a 3-5 word title in Title Case.";
  if (language === "hindi") {
    langRule = "Output ONLY a 3-5 word title in HINDI (Devanagari script).";
  } else if (language === "hinglish") {
    langRule =
      "Output ONLY a 3-5 word title in HINGLISH (Roman Hindi + English terms).";
  }

  for (const model of ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: `You name textbook chapters. ${langRule} No quotes, no period. Output ONLY the title text.`,
          },
          { role: "user", content },
        ],
        temperature: 0.3,
        max_tokens: 80,
      });
      const raw = (completion.choices[0]?.message?.content || "").trim();
      const title = raw.replace(/^["'\s.]+|["'\s.]+$/g, "").split("\n")[0].trim();
      if (title.length >= 3 && title.length <= 80) return title;
    } catch {
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  return fallbackTitle(chunks[0].content);
}

async function generateTopicScenes(
  groq: Groq,
  title: string,
  content: string,
  topicIdx: number,
  totalTopics: number,
  language: Language
): Promise<Scene[]> {
  const langInstruction = getLanguageInstruction(language);

  const systemPrompt = `You are an expert educational video scriptwriter. Given content from a PDF, create a 6-scene study lecture section.

${langInstruction}

RETURN ONLY VALID JSON. No markdown. No code fences. No explanation before or after.

Structure:
{
  "scenes": [
    { "type": "title", "title": "Title", "subtitle": "Unit ${topicIdx + 1}", "narration": "Welcome narration" },
    { "type": "teach", "title": "Concept", "content": "150-250 word explanation", "narration": "60-90 word spoken version" },
    { "type": "bullets", "title": "Key Points", "bullets": ["P1", "P2", "P3"], "narration": "Summary" },
    { "type": "pie", "title": "Distribution", "data": [{"label": "A", "value": 40}, {"label": "B", "value": 35}, {"label": "C", "value": 25}], "narration": "Chart narration" },
    { "type": "bullets", "title": "More Points", "bullets": ["A", "B"], "narration": "More narration" },
    { "type": "recap", "title": "Recap", "bullets": ["R1", "R2"], "narration": "Recap narration" }
  ]
}

CRITICAL RULES:
- EXACTLY 6 scenes: title, teach, bullets, pie, bullets, recap
- Pie data: 3-4 categories summing to 100
- Narrations: 60-90 words each
- Never use unescaped double quotes inside string values — use single quotes or omit
- Never include newlines inside string values
- Start response with { and end with }`;

  const userPrompt = `Topic: "${title}" (Unit ${topicIdx + 1} of ${totalTopics})

Content:
${content}

Return the JSON now in ${language}.`;

  const raw = await callGroq(groq, systemPrompt, userPrompt, 3500);

  console.log(`    Raw response (first 150 chars): ${raw.slice(0, 150)}`);

  const parsed = extractJSON(raw) as { scenes?: Scene[] } | null;

  if (!parsed || !parsed.scenes || !Array.isArray(parsed.scenes)) {
    console.log(`    ⚠️ JSON parse failed for "${title}", using fallback`);
    return [
      {
        type: "title",
        title,
        subtitle: `Unit ${topicIdx + 1}`,
        narration:
          language === "english"
            ? `Let's begin this section on ${title}.`
            : language === "hindi"
            ? `चलिए इस सेक्शन को शुरू करते हैं - ${title}।`
            : `Chaliye is section ko start karte hain - ${title}.`,
      },
      {
        type: "teach",
        title,
        content: content.slice(0, 500),
        narration:
          language === "english"
            ? `Here's an overview of ${title}.`
            : language === "hindi"
            ? `यहाँ ${title} का एक overview है।`
            : `Yahan ${title} ka ek overview hai.`,
      },
      {
        type: "recap",
        title: "Recap",
        bullets: ["Study the key concepts"],
        narration:
          language === "english"
            ? `That covers the basics of ${title}.`
            : language === "hindi"
            ? `यह ${title} की basics थीं।`
            : `Yeh ${title} ki basics thi.`,
      },
    ];
  }

  const scenes = parsed.scenes.filter(
    (s) => s && typeof s === "object" && "type" in s && "narration" in s
  );

  if (scenes.length === 0) {
    return [
      {
        type: "title",
        title,
        subtitle: `Unit ${topicIdx + 1}`,
        narration: `Let's explore ${title}.`,
      },
    ];
  }

  return scenes;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { filePath, fileName, language: rawLang } = (await req.json()) as {
      filePath: string;
      fileName: string;
      language?: string;
    };

    const language: Language =
      rawLang === "hindi" || rawLang === "hinglish" ? rawLang : "english";

    if (!filePath) {
      return NextResponse.json({ error: "Missing filePath" }, { status: 400 });
    }

    console.log(`🎓 Generating lecture for ${fileName} in ${language}`);

    const { data: chunks, error: chunkError } = await supabase
      .from("pdf_chunks")
      .select("id, chunk_index, content, embedding")
      .eq("user_id", user.id)
      .eq("file_path", filePath)
      .order("chunk_index", { ascending: true });

    if (chunkError || !chunks || chunks.length < 6) {
      return NextResponse.json(
        { error: "PDF not processed. Please analyze it first." },
        { status: 400 }
      );
    }

    const typedChunks = chunks as ChunkRow[];
    const vectors = typedChunks.map((c) => parseEmbedding(c.embedding));

    const k = Math.min(10, Math.max(6, Math.round(typedChunks.length / 30)));
    console.log(`  Clustering ${typedChunks.length} chunks into ${k} topics`);

    const result = kmeans(vectors, k, {
      initialization: "kmeans++",
      maxIterations: 200,
    });

    const clusters: Record<number, ChunkRow[]> = {};
    for (let i = 0; i < typedChunks.length; i++) {
      const cid = result.clusters[i];
      if (!clusters[cid]) clusters[cid] = [];
      clusters[cid].push(typedChunks[i]);
    }

    const sortedClusters = Object.values(clusters).sort(
      (a, b) => a[0].chunk_index - b[0].chunk_index
    );

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const allScenes: Scene[] = [];
    const chapters: Chapter[] = [];

    const introNarration =
      language === "english"
        ? `Welcome to this full lecture on ${fileName.replace(/\.pdf$/i, "")}. Over the next ${sortedClusters.length} sections, we'll explore every major topic. Let's begin.`
        : language === "hindi"
        ? `आज हम ${fileName.replace(/\.pdf$/i, "")} पर एक पूरा lecture करेंगे। इसमें ${sortedClusters.length} मुख्य topics होंगे। चलिए शुरू करते हैं।`
        : `Aaj hum ${fileName.replace(/\.pdf$/i, "")} par ek pura lecture karenge. Isme ${sortedClusters.length} main topics honge. Chaliye shuru karte hain.`;

    allScenes.push({
      type: "title",
      title: fileName.replace(/\.pdf$/i, ""),
      subtitle:
        language === "english"
          ? `A ${sortedClusters.length}-part lecture`
          : language === "hindi"
          ? `${sortedClusters.length} भागों का lecture`
          : `${sortedClusters.length}-part lecture`,
      narration: introNarration,
    });

    for (let i = 0; i < sortedClusters.length; i++) {
      const cluster = sortedClusters[i];
      console.log(`  Topic ${i + 1}/${sortedClusters.length}: naming...`);
      const title = await nameCluster(groq, cluster, language);
      console.log(`    → "${title}"`);

      const content = cluster
        .sort((a, b) => a.chunk_index - b.chunk_index)
        .map((c) => c.content)
        .join("\n\n")
        .slice(0, 7000);

      console.log(`    Generating 6 scenes in ${language}...`);
      const scenes = await generateTopicScenes(
        groq,
        title,
        content,
        i,
        sortedClusters.length,
        language
      );

      const startIdx = allScenes.length;
      allScenes.push(...scenes);
      chapters.push({
        topicId: i,
        title,
        startSceneIndex: startIdx,
        sceneCount: scenes.length,
      });

      console.log(`    ✅ ${scenes.length} scenes`);

      if (i < sortedClusters.length - 1) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    const finalRecap =
      language === "english"
        ? `That completes this full lecture on ${fileName.replace(/\.pdf$/i, "")}. We covered ${chapters.length} major topics. Good luck with your studies.`
        : language === "hindi"
        ? `यह ${fileName.replace(/\.pdf$/i, "")} का पूरा lecture था। हमने ${chapters.length} मुख्य topics cover किए। आपकी पढ़ाई के लिए शुभकामनाएँ।`
        : `Yeh ${fileName.replace(/\.pdf$/i, "")} ka pura lecture tha. Humne ${chapters.length} main topics cover kiye. Aapki padhai ke liye shubhkamnaayein.`;

    allScenes.push({
      type: "recap",
      title:
        language === "english"
          ? "Full Lecture Recap"
          : language === "hindi"
          ? "पूरा Lecture Recap"
          : "Full Lecture Recap",
      bullets: chapters.map((c) => c.title),
      narration: finalRecap,
    });

    console.log(
      `✅ Generated ${allScenes.length} scenes across ${chapters.length} chapters in ${language}`
    );

    return NextResponse.json({
      success: true,
      title: fileName.replace(/\.pdf$/i, ""),
      language,
      scenes: allScenes,
      chapters,
      totalScenes: allScenes.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Generate full error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}