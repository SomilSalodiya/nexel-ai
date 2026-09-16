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

function parseEmbedding(raw: number[] | string): number[] {
  if (Array.isArray(raw)) return raw;
  const cleaned = raw.replace(/^\[|\]$/g, "");
  return cleaned.split(",").map((n) => parseFloat(n));
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
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

        const topMatches = scored
          .filter((c) => c.similarity > 0.3)
          .slice(0, 6);

        if (topMatches.length > 0) {
          console.log(
            `  Found ${topMatches.length} relevant PDF chunks (best: ${(topMatches[0].similarity * 100).toFixed(0)}%)`
          );

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
        } else {
          console.log(
            `  No relevant PDF context (best: ${(scored[0]?.similarity * 100).toFixed(0)}%)`
          );
        }
      }
    } catch (err) {
      console.log("  ⚠️ Skipping PDF context (embedding failed)");
    }

    let history: { role: string; content: string }[] = [];
    if (conversationId) {
      const { data: prevMsgs } = await supabase
        .from("tutor_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(6);

      if (prevMsgs) {
        history = prevMsgs.map((m) => ({ role: m.role, content: m.content }));
      }
    }

    const hasContext = context.length > 0;

    const systemPrompt = `You are Nexel AI — a smart, friendly AI assistant and study companion.

${hasContext
  ? `You have access to excerpts from the user's uploaded PDFs (see "Sources" below). You may use them when relevant.`
  : `The user does NOT have relevant PDF content for this question, OR their PDFs don't cover it. Answer from your general knowledge.`}

BEHAVIOR:
- If the question relates to the PDFs → use the sources, cite "According to [PDF name]..."
- If the question is general knowledge → answer directly from your training
- If both apply → combine PDF insights with your broader knowledge
- NEVER say "not in your documents" or "not in my context"
- NEVER refuse to answer — you're a full AI assistant
- If you genuinely don't know → say so honestly
- Be warm, patient, and conversational — like a helpful tutor

FORMAT:
- Use markdown when helpful (bold, bullets, code blocks)
- Keep answers focused (150-400 words for most questions)

LANGUAGE HANDLING (IMPORTANT):
- If the question is in English → respond in English
- If the question is in Hindi (Devanagari) → respond in Hindi
- If the question is in Hinglish → respond in Hinglish
- Mirror the user's language`;

    const userMessage = hasContext
      ? `Sources from my PDFs:\n\n${context}\n\n---\n\nMy question: ${question}`
      : question;

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const stream = await groq.chat.completions.create({
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

    const encoder = new TextEncoder();
    let fullAnswer = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
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
        "X-Sources": JSON.stringify(sources),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Tutor error:", message);
    return new Response(message, { status: 500 });
  }
}