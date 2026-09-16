import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const JINA_API = "https://api.jina.ai/v1/embeddings";
const JINA_MODEL = "jina-embeddings-v2-base-en";

function getGroqKeys(): string[] {
  return [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5,
  ].filter((k): k is string => !!k && k.startsWith("gsk_"));
}

async function getQueryEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) throw new Error("JINA_API_KEY not configured");

  const res = await fetch(JINA_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: JINA_MODEL, input: [text] }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Jina error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.data[0].embedding;
}

function parseEmbedding(raw: number[] | string): number[] {
  if (Array.isArray(raw)) return raw;
  const cleaned = raw.replace(/^\[|\]$/g, "");
  return cleaned.split(",").map((n) => parseFloat(n));
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
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

    const { question, conversationId } = await req.json();
    if (!question || question.trim().length < 2) {
      return new Response("Question required", { status: 400 });
    }

    console.log(`🎓 Tutor query: "${question.slice(0, 60)}"`);

    let sources: { file_name: string; snippet: string; similarity: number }[] = [];
    let context = "";

    try {
      const queryEmbedding = await getQueryEmbedding(question);
      const { data: chunksWithEmb } = await supabase
        .from("pdf_chunks")
        .select("id, content, file_name, file_path, chunk_index, embedding")
        .eq("user_id", user.id)
        .not("embedding", "is", null)
        .limit(500);

      if (chunksWithEmb && chunksWithEmb.length > 0) {
        const scored = chunksWithEmb.map((c) => ({
          id: c.id,
          content: c.content,
          file_name: c.file_name,
          similarity: cosineSim(queryEmbedding, parseEmbedding(c.embedding)),
        }));

        scored.sort((a, b) => b.similarity - a.similarity);
        const topMatches = scored.filter((c) => c.similarity > 0.3).slice(0, 6);

        if (topMatches.length > 0) {
          console.log(`  Found ${topMatches.length} relevant PDF chunks`);
          sources = topMatches.slice(0, 4).map((m) => ({
            file_name: m.file_name?.replace(/^\d+-/, "") || "Unknown",
            snippet: m.content.slice(0, 150),
            similarity: Math.round(m.similarity * 100),
          }));
          context = topMatches
            .map(
              (m, i) =>
                `[Source ${i + 1} — from "${m.file_name?.replace(/^\d+-/, "") || "PDF"}"]\n${m.content}`
            )
            .join("\n\n---\n\n");
        }
      }
    } catch (err) {
      console.log("  ⚠️ Skipping PDF context");
    }

    let history: { role: string; content: string }[] = [];
    if (conversationId) {
      const { data: prevMsgs } = await supabase
        .from("tutor_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(8);
      if (prevMsgs) {
        history = prevMsgs.map((m) => ({ role: m.role, content: m.content }));
      }
    }

    const hasContext = context.length > 0;

    const systemPrompt = `You are Nexel AI — a smart, friendly AI assistant and study companion. You're as capable as ChatGPT.

${hasContext
  ? `You have access to excerpts from the user's uploaded PDFs (see "Sources" below).`
  : `The user's PDFs don't cover this question. Answer from general knowledge.`}

BEHAVIOR:
- If PDF-related → use sources, cite "According to [PDF name]..."
- If general knowledge → answer directly
- NEVER refuse to answer
- Be warm, clear, thorough

FORMAT: Use markdown. 150-500 words.

LANGUAGE: Mirror the user's language (English → English, Hindi → Hindi, Hinglish → Hinglish)`;

    const userMessage = hasContext
      ? `Sources from my PDFs:\n\n${context}\n\n---\n\nMy question: ${question}`
      : question;

    const keys = getGroqKeys();
    if (keys.length === 0) throw new Error("No Groq API keys configured");

    let stream: AsyncIterable<Groq.Chat.Completions.ChatCompletionChunk> | null = null;
    let lastError: unknown;

    // Try rotation for streaming
    outer: for (const key of keys) {
      try {
        const groq = new Groq({ apiKey: key });
        stream = await groq.chat.completions.create({
          model: "openai/gpt-oss-20b",
          messages: [
            { role: "system", content: systemPrompt },
            ...history.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
            { role: "user", content: userMessage },
          ],
          temperature: 0.6,
          max_tokens: 1500,
          stream: true,
        });
        console.log(`  Using key ...${key.slice(-6)}`);
        break outer;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("429") || msg.includes("rate_limit")) {
          console.log(`  ⚠️ Key rate-limited, next...`);
          continue;
        }
        console.log(`  ❌ Key failed: ${msg.slice(0, 100)}`);
        continue;
      }
    }

    if (!stream) throw lastError || new Error("All keys failed");

    const encoder = new TextEncoder();
    let fullAnswer = "";

    const readable = new ReadableStream({
      async start(controller) {
        const meta = JSON.stringify({ sources });
        controller.enqueue(encoder.encode(`__META__${meta}__META__`));

        try {
          for await (const chunk of stream!) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              fullAnswer += text;
              controller.enqueue(encoder.encode(text));
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          try {
            let convId = conversationId;
            if (!convId) {
              const title = question.slice(0, 50);
              const { data: newConv } = await supabase
                .from("tutor_conversations")
                .insert({ user_id: user.id, title })
                .select()
                .single();
              convId = newConv?.id;
            }
            if (convId) {
              await supabase.from("tutor_messages").insert([
                { conversation_id: convId, role: "user", content: question },
                {
                  conversation_id: convId,
                  role: "assistant",
                  content: fullAnswer,
                  sources: sources.length > 0 ? sources : null,
                },
              ]);
              await supabase
                .from("tutor_conversations")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", convId);
            }
          } catch (err) {
            console.log("Save failed:", err);
          }
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
    console.error("Tutor error:", message);
    return new Response(message, { status: 500 });
  }
}