import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  urls: z.array(z.string().url()).max(10).default([]),
  files: z.array(z.object({
    path: z.string().min(1),
    mime: z.string().min(1),
    name: z.string().min(1),
  })).max(10).default([]),
  notes: z.string().max(5000).optional().default(""),
});

const SYSTEM_PROMPT = `Kamu adalah AI SEO & Content Strategist berbahasa Indonesia.
Tugas: dari konten yang diberikan (caption, transkrip, teks, gambar, dokumen, hashtag, komentar),
hasilkan rekomendasi keyword & judul artikel yang HIGH POTENTIAL.

Aturan output:
- main_keywords: 3-5 keyword utama (frase pendek, niat search jelas, Bahasa Indonesia)
- secondary_keywords: 8-12 long-tail / turunan
- article_titles: 5 judul artikel siap pakai, click-worthy, mengandung main keyword
- category: pilih SATU dari ["Mentor","Investor","Leader"] yang paling cocok
- summary: ringkasan 2-3 kalimat tentang konten sumber
- extracted: { captions, hashtags, comments_themes, key_topics } yang berhasil diekstrak

Gunakan playbook & persona dari knowledge base sebagai konteks brand voice.`;

const TOOL_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    main_keywords: {
      type: "array",
      items: {
        type: "object",
        properties: {
          keyword: { type: "string" },
          rationale: { type: "string" },
          intent: { type: "string", enum: ["informational","commercial","transactional","navigational"] },
        },
        required: ["keyword","rationale","intent"],
      },
    },
    secondary_keywords: { type: "array", items: { type: "string" } },
    article_titles: { type: "array", items: { type: "string" } },
    category: { type: "string", enum: ["Mentor","Investor","Leader"] },
    extracted: {
      type: "object",
      properties: {
        captions: { type: "array", items: { type: "string" } },
        hashtags: { type: "array", items: { type: "string" } },
        comments_themes: { type: "array", items: { type: "string" } },
        key_topics: { type: "array", items: { type: "string" } },
      },
      required: ["captions","hashtags","comments_themes","key_topics"],
    },
  },
  required: ["summary","main_keywords","secondary_keywords","article_titles","category","extracted"],
  additionalProperties: false,
};

async function scrapeUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ContentBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return `[Failed to fetch ${url}: ${res.status}]`;
    const html = await res.text();
    // Strip scripts/styles then tags
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    // Limit length
    return `[URL: ${url}]\n${cleaned.slice(0, 8000)}`;
  } catch (e) {
    return `[Error scraping ${url}: ${(e as Error).message}]`;
  }
}

async function fileToBase64(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.storage.from("uploads").download(path);
    if (error || !data) return null;
    const buf = await data.arrayBuffer();
    // Convert to base64 in chunks
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  } catch {
    return null;
  }
}

export const analyzeContent = createServerFn({ method: "POST" })
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // 1. Load knowledge base for context
    const { data: kb } = await supabaseAdmin
      .from("knowledge_base")
      .select("type,title,content")
      .order("created_at", { ascending: false })
      .limit(50);

    const kbContext = (kb ?? [])
      .map((k) => `### ${k.type.toUpperCase()} — ${k.title}\n${k.content}`)
      .join("\n\n");

    // 2. Scrape URLs in parallel
    const scraped = await Promise.all(data.urls.map(scrapeUrl));

    // 3. Build multimodal message parts
    const userParts: any[] = [];
    let textBlock = "";

    if (kbContext) textBlock += `=== KNOWLEDGE BASE ===\n${kbContext}\n\n`;
    if (data.notes) textBlock += `=== USER NOTES ===\n${data.notes}\n\n`;
    if (scraped.length) textBlock += `=== SCRAPED URL CONTENT ===\n${scraped.join("\n\n")}\n\n`;

    // 4. Process files — attach images/PDFs/audio/video as base64 to Gemini
    const supportedInline = /^(image|application\/pdf|audio|video)/;
    for (const f of data.files) {
      const b64 = await fileToBase64(f.path);
      if (!b64) {
        textBlock += `[File ${f.name}: failed to load]\n`;
        continue;
      }
      if (supportedInline.test(f.mime)) {
        userParts.push({
          type: "image_url",
          image_url: { url: `data:${f.mime};base64,${b64}` },
        });
      } else {
        // text-like: docx/html/md/txt — decode as utf-8
        try {
          const decoded = atob(b64);
          textBlock += `=== FILE: ${f.name} ===\n${decoded.slice(0, 8000)}\n\n`;
        } catch {
          textBlock += `[File ${f.name}: binary, skipped]\n`;
        }
      }
    }

    if (!textBlock && userParts.length === 0) {
      throw new Error("Tidak ada konten untuk dianalisis. Tambahkan URL, file, atau catatan.");
    }

    userParts.unshift({
      type: "text",
      text: textBlock + "\n\nAnalisis semua konten di atas dan hasilkan rekomendasi keyword & judul.",
    });

    // 5. Call Lovable AI Gateway
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userParts },
        ],
        tools: [{
          type: "function",
          function: {
            name: "produce_recommendations",
            description: "Output structured keyword & title recommendations",
            parameters: TOOL_SCHEMA,
          },
        }],
        tool_choice: { type: "function", function: { name: "produce_recommendations" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      if (aiRes.status === 429) throw new Error("Rate limit AI tercapai. Coba lagi sebentar.");
      if (aiRes.status === 402) throw new Error("Kredit AI habis. Top up di Settings > Workspace > Usage.");
      throw new Error(`AI error ${aiRes.status}: ${errText.slice(0, 200)}`);
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI tidak mengembalikan output terstruktur.");
    }
    const result = JSON.parse(toolCall.function.arguments);

    // 6. Persist analysis
    const { data: row } = await supabaseAdmin
      .from("analyses")
      .insert({
        inputs: { urls: data.urls, files: data.files.map((f) => f.name), notes: data.notes },
        result,
        status: "done",
      })
      .select()
      .single();

    return { id: row?.id, result };
  });

export const listAnalyses = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("analyses")
    .select("id,inputs,result,created_at")
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(20);
  return { items: data ?? [] };
});
