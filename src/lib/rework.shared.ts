import type { SupabaseClient } from "@supabase/supabase-js";

export const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export async function fileToBase64(client: SupabaseClient, path: string): Promise<string | null> {
  const { data, error } = await client.storage.from("uploads").download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export async function callAi(apiKey: string, body: unknown) {
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

export const EXTRACT_SCHEMA = {
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
          type: {
            type: "string",
            enum: ["comment", "strikethrough", "highlight", "handwriting", "instruction", "other"],
          },
        },
        required: ["note", "type"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "article_markdown", "revision_notes"],
  additionalProperties: false,
};

export const REWORK_SCHEMA = {
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
};

export type RevisionNote = { location?: string; note: string; type?: string };
export type ChangeItem = { section: string; before?: string; after: string; reason: string; kind: string };
export type CrosscheckItem = { note: string; status: "done" | "partial" | "not_done" | "not_applicable"; evidence: string };
export type Crosscheck = { score: number; verdict: string; items: CrosscheckItem[] };
