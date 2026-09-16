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

type Topic = {
  id: number;
  title: string;
  summary: string;
  keyTerms: string[];
  chunkCount: number;
  chunkIds: number[];
  firstChunkIndex: number;
};

function parseEmbedding(raw: number[] | string): number[] {
  if (Array.isArray(raw)) return raw;
  const cleaned = raw.replace(/^\[|\]$/g, "");
  return cleaned.split(",").map((n) => parseFloat(n));
}

// Smart fallback: look for technical terms first, then first words
function fallbackTitle(content: string): string {
  const text = content.slice(0, 400).replace(/\s+/g, " ");

  // Look for capitalized technical terms
  const techTerms = text.match(
    /\b(HTML|CSS|JavaScript|HTTP|HTTPS|XML|JSON|DOM|AJAX|jQuery|Servlet|PHP|MySQL|URL|URI|REST|API|SSL|TLS|Web|Server|Client|Session|Cookie|Form|Protocol|Encryption|Security|Database|Malware|Firewall|Proxy|DNS|TCP|IP|Email|FTP|SMTP|WWW|Browser|Tag|Element|Attribute|Style|Function|Object|Array|Loop|Class|Method)\b/gi
  );

  if (techTerms && techTerms.length >= 2) {
    const unique = Array.from(new Set(techTerms.map((t) => t.toUpperCase())));
    const top = unique.slice(0, 3);
    return `${top.join(" and ")} Concepts`;
  }

  // Extract first 5 meaningful words
  const words = text.split(" ").filter((w) => w.length > 0);
  const skip = new Set([
    "the", "a", "an", "in", "on", "at", "of", "to", "for", "is", "are", "was",
    "were", "this", "that", "these", "those", "and", "or", "but", "as", "it",
    "be", "can", "will", "with", "has", "have", "had",
  ]);
  let startIdx = 0;
  while (startIdx < words.length - 5 && skip.has(words[startIdx].toLowerCase())) {
    startIdx++;
  }
  const picked = words.slice(startIdx, startIdx + 5).join(" ");
  const cleaned = picked.replace(/[^a-zA-Z0-9\s-]/g, "").trim();

  if (cleaned.length < 8) return "Study Concepts";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

async function tryTitle(
  groq: Groq,
  model: string,
  sampleContent: string
): Promise<string> {
  const completion = await groq.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You name textbook chapters. Given content, output ONLY a 3-5 word chapter title in Title Case.

Examples:
- HTML headings content → HTML Heading Elements
- CSS flexbox content → CSS Flexbox Layout
- HTTP methods content → HTTP Request Methods
- Security content → Web Security Basics

Output ONLY the title. No quotes. No period. No explanation.`,
      },
      { role: "user", content: sampleContent },
    ],
    temperature: 0.3,
    max_tokens: 120,
  });

  const raw = (completion.choices[0]?.message?.content || "").trim();
  console.log(`    [${model}] → "${raw.slice(0, 80)}"`);

  const title = raw
    .replace(/^["'\s]+|["'\s.]+$/g, "")
    .replace(/^(Title|Chapter|Topic|Answer):?\s*/i, "")
    .split("\n")[0]
    .trim();

  if (title.length < 3 || title.length > 70) {
    throw new Error(`Bad title: "${title}"`);
  }
  return title;
}

async function nameCluster(
  groq: Groq,
  clusterChunks: ChunkRow[]
): Promise<string> {
  const sorted = [...clusterChunks].sort((a, b) => a.chunk_index - b.chunk_index);
  const mid = Math.floor(sorted.length / 2);
  const sampleIndices = [0, mid, sorted.length - 1];
  const uniqueIndices = Array.from(new Set(sampleIndices)).filter(
    (i) => i >= 0 && i < sorted.length
  );
  const sampleContent = uniqueIndices
    .map((i) => sorted[i].content.slice(0, 400))
    .join("\n\n")
    .slice(0, 1400);

  // Attempt 1: gpt-oss-20b (fast)
  try {
    return await tryTitle(groq, "openai/gpt-oss-20b", sampleContent);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.log(`    20b failed: ${msg.slice(0, 60)}`);
  }

  // Attempt 2: gpt-oss-120b (smarter, slower)
  await new Promise((r) => setTimeout(r, 800));
  try {
    return await tryTitle(groq, "openai/gpt-oss-120b", sampleContent);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.log(`    120b failed: ${msg.slice(0, 60)}`);
  }

  // Attempt 3: gpt-oss-20b again (transient failures)
  await new Promise((r) => setTimeout(r, 800));
  try {
    return await tryTitle(groq, "openai/gpt-oss-20b", sampleContent);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.log(`    retry failed: ${msg.slice(0, 60)}`);
  }

  // All attempts failed → smart fallback
  const fallback = fallbackTitle(clusterChunks[0].content);
  console.log(`    → Fallback: "${fallback}"`);
  return fallback;
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

    const body = await req.json();
    const { filePath } = body as { filePath: string };

    if (!filePath) {
      return NextResponse.json({ error: "Missing filePath" }, { status: 400 });
    }

    const { data: chunks, error: chunkError } = await supabase
      .from("pdf_chunks")
      .select("id, chunk_index, content, embedding")
      .eq("user_id", user.id)
      .eq("file_path", filePath)
      .order("chunk_index", { ascending: true });

    if (chunkError) {
      return NextResponse.json(
        { error: `Failed to load chunks: ${chunkError.message}` },
        { status: 500 }
      );
    }

    if (!chunks || chunks.length < 6) {
      return NextResponse.json(
        { error: "Not enough content (need 6+ chunks)." },
        { status: 400 }
      );
    }

    const typedChunks: ChunkRow[] = chunks as ChunkRow[];
    const vectors = typedChunks.map((c) => parseEmbedding(c.embedding));

    const k = Math.min(10, Math.max(6, Math.round(typedChunks.length / 30)));
    console.log(`📊 Clustering ${typedChunks.length} chunks into k=${k} topics`);

    const result = kmeans(vectors, k, {
      initialization: "kmeans++",
      maxIterations: 200,
    });

    const clusters: Record<number, ChunkRow[]> = {};
    for (let i = 0; i < typedChunks.length; i++) {
      const clusterId = result.clusters[i];
      if (!clusters[clusterId]) clusters[clusterId] = [];
      clusters[clusterId].push(typedChunks[i]);
    }

    const avgSize = typedChunks.length / k;
    const splitThreshold = avgSize * 2;
    const finalClusters: ChunkRow[][] = [];

    for (const clusterChunks of Object.values(clusters)) {
      if (clusterChunks.length > splitThreshold && clusterChunks.length >= 20) {
        console.log(`  Splitting cluster (${clusterChunks.length} chunks)`);
        const subVectors = clusterChunks.map((c) => parseEmbedding(c.embedding));
        const subResult = kmeans(subVectors, 2, {
          initialization: "kmeans++",
          maxIterations: 100,
        });
        const sub1: ChunkRow[] = [];
        const sub2: ChunkRow[] = [];
        for (let i = 0; i < clusterChunks.length; i++) {
          if (subResult.clusters[i] === 0) sub1.push(clusterChunks[i]);
          else sub2.push(clusterChunks[i]);
        }
        if (sub1.length >= 5) finalClusters.push(sub1);
        if (sub2.length >= 5) finalClusters.push(sub2);
      } else {
        finalClusters.push(clusterChunks);
      }
    }

    console.log(`  → Final topic count: ${finalClusters.length}`);

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const topics: Topic[] = [];

    for (let i = 0; i < finalClusters.length; i++) {
      const clusterChunks = finalClusters[i];
      clusterChunks.sort((a, b) => a.chunk_index - b.chunk_index);
      console.log(`  Topic ${i + 1}/${finalClusters.length}...`);

      const title = await nameCluster(groq, clusterChunks);
      console.log(`    ✅ Final: "${title}"`);

      topics.push({
        id: i,
        title,
        summary: "",
        keyTerms: [],
        chunkCount: clusterChunks.length,
        chunkIds: clusterChunks.map((c) => c.id),
        firstChunkIndex: clusterChunks[0].chunk_index,
      });

      if (i < finalClusters.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    topics.sort((a, b) => a.firstChunkIndex - b.firstChunkIndex);

    return NextResponse.json({
      success: true,
      totalChunks: typedChunks.length,
      topicCount: topics.length,
      topics,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Analyze error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}