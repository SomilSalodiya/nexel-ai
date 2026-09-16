import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const JINA_API = "https://api.jina.ai/v1/embeddings";
const JINA_MODEL = "jina-embeddings-v2-base-en";

async function getQueryEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) throw new Error("JINA_API_KEY not configured");

  const res = await fetch(JINA_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: JINA_MODEL,
      input: [text],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Jina error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response("Not authenticated", { status: 401 });
    }

    const { question, filePath, fileName } = await req.json();
    if (!question || !filePath) {
      return new Response("Missing question or filePath", { status: 400 });
    }

    const queryEmbedding = await getQueryEmbedding(question);

    const { data: matches, error: matchError } = await supabase.rpc("match_pdf_chunks", {
      query_embedding: queryEmbedding,
      match_user_id: user.id,
      match_file_path: filePath,
      match_count: 5,
    });

    if (matchError) {
      return new Response(`Search error: ${matchError.message}`, { status: 500 });
    }

    if (!matches || matches.length === 0) {
      return new Response("No content found in this PDF. Please process it first.", {
        status: 404,
      });
    }

    const context = matches
      .map((m: { content: string }, i: number) =>
        `[Source ${i + 1}]\n${m.content}`
      )
      .join("\n\n");

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const stream = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content: `You are a helpful study assistant. Answer the user's question using ONLY the provided context from their PDF "${fileName}". If the answer isn't in the context, say so honestly. Be concise and clear. When useful, mention which source(s) you used.`,
        },
        {
          role: "user",
          content: `Context from the PDF:\n\n${context}\n\n---\n\nQuestion: ${question}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 800,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) controller.enqueue(encoder.encode(text));
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Chat error:", message);
    return new Response(message, { status: 500 });
  }
}