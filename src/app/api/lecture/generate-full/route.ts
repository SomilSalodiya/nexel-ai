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

function getLanguageInstruction(lang: Language): string {
  if (lang === "hindi") {
    return `IMPORTANT LANGUAGE RULE: Write ALL narration in HINDI (Devanagari script). 
Example narration: "आज हम HTTP के बारे में सीखेंगे। यह एक प्रोटोकॉल है जिसका उपयोग वेब पर किया जाता है।"
- Titles and bullets can be in Devanagari too
- The "content" field (detailed explanation) should also be in Hindi
- Keep technical terms like "HTTP", "HTML", "CSS" in English
- Speak like a Hindi professor teaching in a classroom`;
  }
  if (lang === "hinglish") {
    return `IMPORTANT LANGUAGE RULE: Write ALL narration in HINGLISH — a natural mix of Hindi and English as spoken by Indian students.
Example narration: "Aaj hum HTTP ke baare mein seekhenge. Yeh ek protocol hai jiska use web par hota hai. Basically yeh client aur server ke beech communication का काम करता है."
- Use Roman script for Hindi words (e.g. "samjhenge", "hai", "kaam")
- You MAY use Devanagari for emphasis (like "काम")
- Keep it natural — how you'd explain to a friend
- Keep technical terms like "HTTP", "HTML", "CSS" in English
- Do NOT be overly formal — use casual Hinglish`;
  }
  return `LANGUAGE: Write all narration in clear, natural English.`;
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
      response_format: { type: "json_object" },
    });
    return completion.choices[0]?.message?.content || "{}";
  } catch (err) {
    console.log("20b failed, trying 120b:", err instanceof Error ? err.message.slice(0, 60) : "");
  }
  await new Promise((r) => setTimeout(r, 1200));
  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.5,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  });
  return completion.choices[0]?.message?.content || "{}";
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
    langRule = "Output ONLY a 3-5 word title in HINGLISH (Roman Hindi script, mixed with English technical terms). Example: 'HTTP Methods aur Status Codes'.";
  }

  for (const model of ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"]) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: `You name textbook chapters. ${langRule} No quotes, no period.`,
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

Respond ONLY with valid JSON in this exact format:
{
  "scenes": [
    { "type": "title", "title": "...", "subtitle": "Unit ${topicIdx + 1}", "narration": "..." },
    { "type": "teach", "title": "...", "content": "150-250 word explanation", "narration": "60-90 word spoken version" },
    { "type": "bullets", "title": "...", "bullets": ["Point 1", "Point 2", "Point 3"], "narration": "..." },
    { "type": "pie", "title": "...", "data": [{"label": "...", "value": 40}, {"label": "...", "value": 35}, {"label": "...", "value": 25}], "narration": "..." },
    { "type": "bullets", "title": "...", "bullets": ["Point A", "Point B"], "narration": "..." },
    { "type": "recap", "title": "...", "bullets": ["Recap 1", "Recap 2"], "narration": "..." }
  ]
}

${langInstruction}

SCENE REQUIREMENTS:
- EXACTLY 6 scenes
- Scene 1: title
- Scene 2: teach (deep concept explanation)
- Scene 3: bullets
- Scene 4: pie (3-4 categories summing to 100)
- Scene 5: bullets
- Scene 6: recap

PIE CHART RULES:
- 3-4 categories with values summing to 100
- Labels: short (< 15 chars)
- May be in English even if narration is Hindi/Hinglish

NARRATION RULES:
- 60-90 words per scene (30-45 seconds spoken)
- Natural, conversational
- Use "we", "you", "let's" (or Hindi equivalents: "hum", "aap", "chaliye")

Do not include any text outside the JSON.`;

  const userPrompt = `Topic: "${title}" (Unit ${topicIdx + 1} of ${totalTopics})\n\nContent:\n${content}\n\nGenerate 6 scenes in ${language}.`;

  const raw = await callGroq(groq, systemPrompt, userPrompt, 3500);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [
      {
        type: "title",
        title,
        subtitle: `Unit ${topicIdx + 1}`,
        narration: language === "english"
          ? `Let's begin this section on ${title}.`
          : language === "hindi"
          ? `चलिए इस सेक्शन को शुरू करते हैं - ${title}।`
          : `Chaliye is section ko start karte hain - ${title}.`,
      },
      {
        type: "teach",
        title,
        content: content.slice(0, 500),
        narration: language === "english"
          ? `Here's an overview of ${title}.`
          : language === "hindi"
          ? `यहाँ ${title} का एक overview है।`
          : `Yahan ${title} ka ek overview hai.`,
      },
      {
        type: "recap",
        title: "Recap",
        bullets: ["Study the key concepts"],
        narration: language === "english"
          ? `That covers the basics of ${title}.`
          : language === "hindi"
          ? `यह ${title} की basics थीं।`
          : `Yeh ${title} ki basics thi.`,
      },
    ];
  }

  const scenes = (parsed.scenes || []).filter(
    (s: Record<string, unknown>) =>
      s && typeof s === "object" && s.type && s.narration
  );

  return scenes.length > 0
    ? scenes
    : [
        {
          type: "title",
          title,
          subtitle: `Unit ${topicIdx + 1}`,
          narration: language === "english" ? `Let's explore ${title}.` : `${title} ko explore karte hain.`,
        },
      ];
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
      title: language === "english" ? "Full Lecture Recap" : language === "hindi" ? "पूरा Lecture Recap" : "Full Lecture Recap",
      bullets: chapters.map((c) => c.title),
      narration: finalRecap,
    });

    console.log(`✅ Generated ${allScenes.length} scenes across ${chapters.length} chapters in ${language}`);

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