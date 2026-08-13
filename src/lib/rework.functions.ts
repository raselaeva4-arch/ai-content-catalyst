import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ARS_TONE_RULES } from "@/lib/articles.prompt";
import type { SupabaseClient } from "@supabase/supabase-js";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function fileToBase64(client: SupabaseClient, path: string): Promise<string | null> {
  const { data, error } = await client.storage.from("uploads").download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

async function callAi(apiKey: string, body: unknown) {
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("Rate limit AI tercapai. Coba lagi sebentar.");
    if (res.status === 402) throw new Error("Kredit AI habis. Top up di Settings > Workspace > Usage.");
    throw new Error(`AI error ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Judul artikel yang terdeteksi" },
    article_markdown: {
      type: "string",
      description:
        "Isi artikel LENGKAP dalam markdown, bersih dari komentar/anotasi revisi. Pertahankan seluruh paragraf apa adanya.",
    },
    revision_notes: {
      type: "array",
      description:
        "Semua catatan revisi yang terdeteksi: komentar, coretan, highlight, tracked changes, catatan kaki, tulisan tangan, atau instruksi revisi apapun.",
      items: {
        type: "object",
        properties: {
          location: { type: "string", description: "Bagian/kalimat yang dirujuk catatan ini" },
          note: { type: "string", description: "Isi catatan revisi" },
          type: { type: "string", enum: ["comment", "strikethrough", "highlight", "handwriting", "instruction", "other"] },
        },
        required: ["note", "type"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "article_markdown", "revision_notes"],
  additionalProperties: false,
} as const;

const REWORK_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    content: { type: "string", description: "Artikel versi terbaru LENGKAP dalam markdown" },
    summary: { type: "string", description: "Ringkasan singkat rework yang dilakukan" },
    changes: {
      type: "array",
      description: "Daftar poin perubahan yang dilakukan",
      items: {
        type: "object",
        properties: {
          section: { type: "string" },
          before: { type: "string" },
          after: { type: "string" },
          reason: { type: "string" },
          kind: { type: "string", enum: ["rewrite", "edit", "add", "delete", "tone", "seo", "structure"] },
        },
        required: ["section", "after", "reason", "kind"],
        additionalProperties: false,
      },
    },
    crosscheck: {
      type: "object",
      description: "Crosscheck tiap catatan revisi terhadap hasil terbaru",
      properties: {
        score: { type: "number", description: "0-100 tingkat pemenuhan catatan revisi" },
        verdict: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              note: { type: "string" },
              status: { type: "string", enum: ["done", "partial", "not_done", "not_applicable"] },
              evidence: { type: "string", description: "Kutipan/penjelasan bukti dari artikel baru" },
            },
            required: ["note", "status", "evidence"],
            additionalProperties: false,
          },
        },
      },
      required: ["score", "verdict", "items"],
      additionalProperties: false,
    },
  },
  required: ["title", "content", "summary", "changes", "crosscheck"],
  additionalProperties: false,
} as const;

const ExtractSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  mime: z.string().min(1),
});

export const extractArticleFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ExtractSchema.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const b64 = await fileToBase64(context.supabase, data.path);
    if (!b64) throw new Error("Gagal membaca file dari storage");

    const isImage = data.mime.startsWith("image/");
    const parts: any[] = [
      {
        type: "text",
        text: `Ekstrak artikel dan SEMUA catatan revisi dari file: ${data.name} (${data.mime}). Sertakan komentar dokumen, tracked changes, coretan, highlight, catatan tulisan tangan, dan instruksi revisi apapun.`,
      },
    ];
    if (isImage) parts.push({ type: "image_url", image_url: { url: `data:${data.mime};base64,${b64}` } });
    else parts.push({ type: "file", file: { filename: data.name, file_data: `data:${data.mime};base64,${b64}` } });

    const json = await callAi(apiKey, {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Kamu AI ekstraktor dokumen artikel. Pisahkan isi artikel bersih dari catatan revisi (komentar, coretan, highlight, anotasi, tulisan tangan). Jangan mengarang isi. Pertahankan bahasa asli dokumen.",
        },
        { role: "user", content: parts },
      ],
      tools: [
        {
          type: "function",
          function: { name: "extract_article", description: "Hasil ekstraksi artikel + catatan revisi", parameters: EXTRACT_SCHEMA },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_article" } },
    });

    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI gagal mengekstrak isi file.");
    const parsed = JSON.parse(args);
    return {
      title: String(parsed.title ?? data.name),
      content: String(parsed.article_markdown ?? ""),
      revision_notes: Array.isArray(parsed.revision_notes) ? parsed.revision_notes : [],
    };
  });

const ReviewSchema = z.object({
  content: z.string().min(20).max(200000),
  extra_context: z.string().max(10000).optional().default(""),
});

export const reviewRevisionNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ReviewSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const json = await callAi(apiKey, {
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "Kamu AI reviewer artikel SEO. Deteksi catatan revisi yang tertulis di dalam teks (komentar, [rev: ...], coretan, TODO, highlight, instruksi editor). Jika tidak ada catatan eksplisit, buat catatan revisi berbasis audit kualitas: struktur SEO, keyword, kejelasan bahasa, jargon berlebih, kalimat panjang, dan tone.\n\n" +
            ARS_TONE_RULES,
        },
        { role: "user", content: `${data.extra_context ? data.extra_context + "\n\n" : ""}=== ARTIKEL ===\n${data.content.slice(0, 120000)}` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_article",
            description: "Catatan revisi hasil review",
            parameters: EXTRACT_SCHEMA,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_article" } },
    });

    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI tidak mengembalikan catatan revisi.");
    const parsed = JSON.parse(args);
    return { revision_notes: Array.isArray(parsed.revision_notes) ? parsed.revision_notes : [] };
  });

const RunSchema = z.object({
  project_id: z.string().uuid(),
  content: z.string().min(20).max(200000),
  title: z.string().max(300).optional().default(""),
  revision_notes: z
    .array(z.object({ location: z.string().optional().default(""), note: z.string(), type: z.string().optional().default("other") }))
    .default([]),
  manual_prompt: z.string().max(10000).optional().default(""),
  scope: z.enum(["full", "partial"]).optional().default("full"),
});

export const runRework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RunSchema.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { data: kb } = await context.supabase
      .from("knowledge_base")
      .select("type,title,content")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: false })
      .limit(15);

    const kbContext = (kb ?? [])
      .map((k) => `### ${String(k.type).toUpperCase()} — ${k.title}\n${String(k.content).slice(0, 4000)}`)
      .join("\n\n");

    const notesText = data.revision_notes.length
      ? data.revision_notes.map((n, i) => `${i + 1}. [${n.type}]${n.location ? ` (${n.location})` : ""} ${n.note}`).join("\n")
      : "(tidak ada catatan revisi terstruktur)";

    let userText = "";
    if (kbContext) userText += `=== KNOWLEDGE BASE (persona & style guide) ===\n${kbContext}\n\n`;
    userText += `=== ARTIKEL ASLI ===\n${data.content.slice(0, 120000)}\n\n`;
    userText += `=== CATATAN REVISI ===\n${notesText}\n\n`;
    if (data.manual_prompt) userText += `=== PERINTAH MANUAL DARI USER (prioritas tertinggi) ===\n${data.manual_prompt}\n\n`;
    userText += data.scope === "partial"
      ? "Ubah HANYA bagian yang disebut catatan revisi / perintah manual. Bagian lain pertahankan persis.\n"
      : "Rework menyeluruh, tetap pertahankan fakta, data, dan struktur inti artikel.\n";
    userText += `\n${ARS_TONE_RULES}\n\nHasilkan artikel versi terbaru, daftar poin perubahan, dan crosscheck tiap catatan revisi.`;

    const json = await callAi(apiKey, {
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "Kamu editor senior artikel SEO berbahasa Indonesia. Tugasmu merework artikel sesuai catatan revisi dan perintah manual, lalu melakukan crosscheck jujur apakah setiap catatan sudah dipenuhi. Jangan menghapus data faktual tanpa alasan. Output harus markdown rapi (H1/H2/H3, paragraf pendek).",
        },
        { role: "user", content: userText },
      ],
      tools: [
        { type: "function", function: { name: "produce_rework", description: "Hasil rework artikel", parameters: REWORK_SCHEMA } },
      ],
      tool_choice: { type: "function", function: { name: "produce_rework" } },
    });

    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI tidak mengembalikan hasil rework.");
    const out = JSON.parse(args);
    return {
      title: String(out.title || data.title || "Artikel hasil rework"),
      content: String(out.content ?? ""),
      summary: String(out.summary ?? ""),
      changes: Array.isArray(out.changes) ? out.changes : [],
      crosscheck: out.crosscheck ?? { score: 0, verdict: "", items: [] },
    };
  });

const SaveSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  source_type: z.string().max(30).default("paste"),
  source_path: z.string().max(500).nullable().optional(),
  source_name: z.string().max(300).nullable().optional(),
  source_mime: z.string().max(200).nullable().optional(),
  original_content: z.string().max(200000).default(""),
  revision_notes: z.array(z.any()).default([]),
  revision_notes_text: z.string().max(20000).default(""),
  manual_prompt: z.string().max(10000).default(""),
  reworked_content: z.string().max(200000).default(""),
  reworked_title: z.string().max(300).nullable().optional(),
  changes: z.array(z.any()).default([]),
  crosscheck: z.any().default({}),
  status: z.enum(["draft", "final"]).default("draft"),
});

const UpdateSchema = SaveSchema.partial().extend({ id: z.string().uuid() });

export const listReworks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("article_reworks")
      .select("*")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const saveRework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SaveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("article_reworks").insert(data).select().single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const updateRework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("article_reworks")
      .update(rest)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const deleteRework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("article_reworks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
