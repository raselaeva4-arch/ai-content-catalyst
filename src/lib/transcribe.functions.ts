import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

const InputSchema = z.object({
  path: z.string().min(1),
  mime: z.string().min(1),
  name: z.string().min(1),
});

async function fileToBase64(client: SupabaseClient, path: string): Promise<string | null> {
  const { data, error } = await client.storage.from("uploads").download(path);
  if (error || !data) return null;
  const buf = await data.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export const transcribeMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    if (!/^(audio|video)\//.test(data.mime)) {
      throw new Error("Hanya file audio atau video yang bisa di-transcribe.");
    }

    const b64 = await fileToBase64(context.supabase, data.path);
    if (!b64) throw new Error("Gagal memuat file dari storage.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Kamu adalah transcriber profesional. Tulis transkrip kata-kata yang diucapkan secara verbatim dalam bahasa aslinya (Indonesia/Inggris). Jangan menambahkan komentar, intro, atau penjelasan. Jika tidak ada speech, balas: [TIDAK ADA SUARA].",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Transkripsikan konten ${data.mime} berikut secara lengkap:` },
              { type: "image_url", image_url: { url: `data:${data.mime};base64,${b64}` } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("Rate limit AI tercapai. Coba lagi sebentar.");
      if (res.status === 402) throw new Error("Kredit AI habis. Top up di Settings > Workspace > Usage.");
      throw new Error(`Transcribe gagal (${res.status}): ${t.slice(0, 200)}`);
    }

    const json = await res.json();
    const transcript: string = json.choices?.[0]?.message?.content ?? "";
    return { transcript: transcript.trim(), name: data.name };
  });
