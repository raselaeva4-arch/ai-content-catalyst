import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

const KbSchema = z.object({
  project_id: z.string().uuid(),
  type: z.enum(["playbook", "persona", "knowledge"]),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
});

const KbFileSchema = z.object({
  project_id: z.string().uuid(),
  path: z.string().min(1),
  name: z.string().min(1),
  mime: z.string().min(1),
  type: z.enum(["playbook", "persona", "knowledge"]).default("knowledge"),
});

export const listKb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("knowledge_base")
      .select("*")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const saveKb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => KbSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("knowledge_base")
      .insert({
        project_id: data.project_id,
        type: data.type,
        title: data.title,
        content: data.content,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const deleteKb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("knowledge_base").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function fileToBase64(client: SupabaseClient, path: string): Promise<string | null> {
  const { data, error } = await client.storage.from("uploads").download(path);
  if (error || !data) return null;
  const buf = await data.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

const EXTRACT_PROMPT = `Kamu adalah AI ekstraktor konten. Ekstrak SEMUA teks, poin penting, data, tabel, dan insight dari file yang diberikan (PDF/DOC/PPT/gambar). 
Format output: teks bersih terstruktur (gunakan heading, bullet, list). 
Jangan berikan opini — hanya ekstrak isi. Bahasa: pertahankan bahasa asli dokumen.`;

export const saveKbFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => KbFileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const b64 = await fileToBase64(context.supabase, data.path);
    if (!b64) throw new Error("Gagal membaca file dari storage");

    const isImage = data.mime.startsWith("image/");
    const isPdf = data.mime === "application/pdf";
    const isTextLike = /^(text\/|application\/(json|xml|csv))/.test(data.mime);

    let extracted = "";

    if (isTextLike) {
      try {
        extracted = atob(b64).slice(0, 40000);
      } catch {
        extracted = "";
      }
    }

    if (!extracted) {
      const userParts: any[] = [{ type: "text", text: `Ekstrak isi file: ${data.name} (${data.mime})` }];
      if (isImage) {
        userParts.push({ type: "image_url", image_url: { url: `data:${data.mime};base64,${b64}` } });
      } else if (isPdf) {
        userParts.push({ type: "file", file: { filename: data.name, file_data: `data:${data.mime};base64,${b64}` } });
      } else {
        // Office docs (docx/pptx/xlsx) — try sending as file part; Gemini accepts many mimes
        userParts.push({ type: "file", file: { filename: data.name, file_data: `data:${data.mime};base64,${b64}` } });
      }

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: EXTRACT_PROMPT },
            { role: "user", content: userParts },
          ],
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        if (aiRes.status === 429) throw new Error("Rate limit AI. Coba lagi.");
        if (aiRes.status === 402) throw new Error("Kredit AI habis.");
        throw new Error(`AI ekstraksi gagal [${aiRes.status}]: ${errText.slice(0, 200)}`);
      }

      const aiJson = await aiRes.json();
      extracted = aiJson.choices?.[0]?.message?.content ?? "";
      if (!extracted) throw new Error("AI tidak berhasil mengekstrak isi file.");
    }

    const content = extracted.slice(0, 50000);
    const { data: row, error } = await context.supabase
      .from("knowledge_base")
      .insert({
        project_id: data.project_id,
        type: data.type,
        title: data.name,
        content,
        source_path: data.path,
        source_name: data.name,
        source_mime: data.mime,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });
