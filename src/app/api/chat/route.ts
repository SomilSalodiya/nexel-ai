import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const HF_API = `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_MODEL}`;

async function getQueryEmbedding(text: string): Promise<number[]> {
  const res = await fetch(HF_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
  });
  if (!res.ok) throw new Error(await res.text());
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
      return new Response("Not authenticated", { status: 401 });
    }

    const { question, filePath, fileName } = await req.json();
    if (!question || !filePath) {
      return new Response("Missing question or filePath", { status: 400 });
    }

    // Get embedding for the question via HuggingFace
    const queryEmbedding = await getQueryEmbedding(question);

    // Find relevant chunks
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