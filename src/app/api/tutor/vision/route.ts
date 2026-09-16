import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

async function callGemini(
  prompt: string,
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1500,
    },
  };

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("🔴 Gemini error:", res.status, err.slice(0, 300));
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGeminiText(prompt: string, text: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const body = {
    contents: [
      {
        parts: [
          {
            text: `${prompt}\n\n---\n\nDocument content:\n\n${text.slice(0, 30000)}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1500,
    },
  };

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("🔴 Gemini error:", res.status, err.slice(0, 300));
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const question = (formData.get("question") as string) || "Analyze this and explain what's in it.";
    const conversationId = formData.get("conversationId") as string | null;

    if (!file) {
      return new Response("No file provided", { status: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return new Response("File too large (max 10MB)", { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf";

    if (!isImage && !isPdf) {
      return new Response("Only images and PDFs are supported", { status: 400 });
    }

    console.log(`📎 Attachment: ${file.name} (${mimeType}, ${Math.round(file.size / 1024)}KB)`);
    console.log(`   Question: "${question.slice(0, 60)}"`);

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const storagePath = `${user.id}/${fileName}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("chat-attachments")
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.log("  ⚠️ Upload failed (continuing anyway):", uploadError.message);
    }

    let aiResponse = "";

    if (isImage) {
      console.log("  📸 Analyzing image with Gemini...");
      const base64 = fileBuffer.toString("base64");
      aiResponse = await callGemini(question, base64, mimeType);
    } else if (isPdf) {
      console.log("  📄 Extracting text from PDF...");
      try {
        const pdfText = await extractPdfText(fileBuffer);
        console.log(`  PDF text: ${pdfText.length} chars`);
        aiResponse = await callGeminiText(question, pdfText);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "PDF extraction failed";
        console.log("  PDF error:", msg);
        aiResponse = `I couldn't read this PDF: ${msg}`;
      }
    }

    try {
      let convId = conversationId ? parseInt(conversationId) : null;

      if (!convId) {
        const title = question.slice(0, 50) || `Attachment: ${file.name}`;
        const { data: newConv } = await supabase
          .from("tutor_conversations")
          .insert({ user_id: user.id, title })
          .select()
          .single();
        convId = newConv?.id;
      }

      if (convId) {
        const userMsgContent = `[Attached: ${file.name}]\n${question}`;
        const { data: userMsg } = await supabase
          .from("tutor_messages")
          .insert({
            conversation_id: convId,
            role: "user",
            content: userMsgContent,
          })
          .select()
          .single();

        await supabase.from("tutor_messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: aiResponse,
        });

        if (userMsg) {
          await supabase.from("tutor_attachments").insert({
            user_id: user.id,
            conversation_id: convId,
            message_id: userMsg.id,
            file_name: file.name,
            file_type: isImage ? "image" : "pdf",
            file_size: file.size,
            storage_path: storagePath,
          });
        }

        await supabase
          .from("tutor_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", convId);
      }
    } catch (err) {
      console.log("Save error:", err);
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        const meta = JSON.stringify({
          type: "attachment",
          fileName: file.name,
          fileType: isImage ? "image" : "pdf",
          fileSize: file.size,
        });
        controller.enqueue(encoder.encode(`__META__${meta}__META__`));

        const chunkSize = 60;
        for (let i = 0; i < aiResponse.length; i += chunkSize) {
          controller.enqueue(encoder.encode(aiResponse.slice(i, i + chunkSize)));
        }
        controller.close();
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
    console.error("Vision error:", message);
    return new Response(message, { status: 500 });
  }
}