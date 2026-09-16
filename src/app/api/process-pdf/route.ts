import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractText, getDocumentProxy } from "unpdf";

export const runtime = "nodejs";
export const maxDuration = 300;

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const HF_API = `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_MODEL}`;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const cleaned = text.replace(/\s+/g, " ").trim();
  let i = 0;
  while (i < cleaned.length) {
    const chunk = cleaned.slice(i, i + CHUNK_SIZE);
    if (chunk.trim().length > 50) chunks.push(chunk.trim());
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(HF_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: text,
      options: { wait_for_model: true },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HuggingFace error: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  if (Array.isArray(data[0])) return data[0];
  return data;
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
    const { filePath, fileName } = body as { filePath: string; fileName: string };

    if (!filePath || !fileName) {
      return NextResponse.json({ error: "Missing filePath or fileName" }, { status: 400 });
    }

    // Check if already processed
    const { count } = await supabase
      .from("pdf_chunks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("file_path", filePath);

    if (count && count > 0) {
      return NextResponse.json({ success: true, chunks: count, cached: true });
    }

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("pdfs")
      .download(filePath);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: `Download failed: ${downloadError?.message}` },
        { status: 500 }
      );
    }

    const buffer = new Uint8Array(await fileData.arrayBuffer());

    console.log("📥 Extracting text...");
    const pdf = await getDocumentProxy(buffer);
    const { text: extracted, totalPages } = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(extracted) ? extracted.join("\n") : extracted;

    if (!text || text.length < 50) {
      return NextResponse.json({ error: "PDF has no extractable text" }, { status: 400 });
    }

    const chunks = chunkText(text);
    console.log(`✂️ Created ${chunks.length} chunks from ${totalPages} pages`);

    if (chunks.length === 0) {
      return NextResponse.json({ error: "No chunks created" }, { status: 400 });
    }

    console.log("🤖 Getting embeddings via HuggingFace API...");

    const records = [];
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await getEmbedding(chunks[i]);
      records.push({
        user_id: user.id,
        file_path: filePath,
        file_name: fileName,
        chunk_index: i,
        content: chunks[i],
        embedding: embedding,
      });

      if ((i + 1) % 5 === 0 || i === chunks.length - 1) {
        console.log(`   Embedded ${i + 1}/${chunks.length}`);
      }

      // Small delay to respect HF rate limits
      if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 150));
    }

    console.log("💾 Inserting into database...");
    const { error: insertError } = await supabase
      .from("pdf_chunks")
      .insert(records);

    if (insertError) {
      return NextResponse.json(
        { error: `Insert failed: ${insertError.message}` },
        { status: 500 }
      );
    }

    console.log("✅ Done!");
    return NextResponse.json({
      success: true,
      chunks: chunks.length,
      pages: totalPages,
      cached: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Process PDF error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}