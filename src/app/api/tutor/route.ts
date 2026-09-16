import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const HF_API = `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_MODEL}`;

async function getQueryEmbedding(text: string): Promise<number[]> {
  console.log("🔵 Calling HF for query embedding...");
  try {
    const res = await fetch(HF_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
    });
    console.log("🟢 HF status:", res.status);
    if (!res.ok) {
      const err = await res.text();
      console.log("🔴 HF error:", err.slice(0, 200));
      throw new Error(`HF ${res.status}`);
    }
    const data = await res.json();
    if (Array.isArray(data[0])) return data[0];
    return data;
  } catch (err) {
    const e = err as Error & { cause?: unknown };
    console.log("🔴 HF fetch error:", e.message);
    throw err;
  }
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

    // 1. Try to find relevant PDF context (best-effort)
    //    If HF fails, we skip PDF context and just use general knowledge.
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

        // Only use chunks with reasonable similarity (> 0.3)
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
            `  No relevant PDF context (best similarity: ${(scored[0]?.similarity * 100).toFixed(0)}%)`
          );
        }
      }
    } catch (err) {
      console.log("  ⚠️ Skipping PDF context (embedding failed)");
    }

    // 2. Load conversation history
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

    // 3. Build system prompt
    const hasContext = context.length > 0;

    const systemPrompt = `You are Nexel AI — a smart, friendly AI assistant and study companion.

${hasContext
  ? `You have access to excerpts from the user's uploaded PDFs (see "Sources" below). You may use them when relevant.`
  : `The user does NOT have relevant PDF content for this question, OR their PDFs don't cover it. Answer from your general knowledge.`}

BEHAVIOR:
- If the question relates to the PDFs → use the sources, cite "According to [PDF name]..."
- If the question is general knowledge → answer directly from your training (this is fine!)
- If both apply → combine PDF insights with your broader knowledge
- NEVER say "not in your documents" or "not in my context"
- NEVER refuse to answer — you're a full AI assistant
- If you genuinely don't know (e.g. current events, private info) → say so honestly
- Be warm, patient, and conversational — like a helpful tutor

FORMAT:
- Use markdown when helpful (bold, bullets, code blocks)
- Keep answers focused (150-400 words for most questions)
- For code → use \`\`\`language ... \`\`\` blocks
- For math → explain step by step
- For lists → numbered or bulleted

LANGUAGE HANDLING (IMPORTANT):
- Detect the language of the user's question
- If the question is in English → respond in English
- If the question is in Hindi (Devanagari script) → respond in Hindi
- If the question is in Hinglish (Hindi written in English letters) → respond in Hinglish
- If the question mixes languages → match the mix
- Never switch languages arbitrarily — always mirror the user

Remember: You are as capable as any AI chatbot. The PDFs just give you extra context when available.`;

    // 4. Build user message
    const userMessage = hasContext
      ? `Sources from my PDFs:\n\n${context}\n\n---\n\nMy question: ${question}`
      : question;

    // 5. Stream from Groq
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

    // 6. Stream response + save
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