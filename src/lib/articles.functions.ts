import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GenerateSchema = z.object({
  project_id: z.string().uuid(),
  topic: z.string().min(3).max(2000),
  main_keyword: z.string().max(200).optional().default(""),
  secondary_keywords: z.string().max(2000).optional().default(""),
  category: z.enum(["Mentor", "Investor", "Leader"]).optional().default("Leader"),
  word_target: z.number().int().min(400).max(2500).optional().default(900),
  extra_notes: z.string().max(5000).optional().default(""),
});

const SaveSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  topic: z.string().max(2000).nullable().optional(),
  main_keyword: z.string().max(200).nullable().optional(),
  secondary_keywords: z.array(z.string()).default([]),
  category: z.string().max(50).nullable().optional(),
  meta_description: z.string().max(500).nullable().optional(),
  slug: z.string().max(300).nullable().optional(),
  outline: z.array(z.string()).default([]),
  content: z.string().max(120000).default(""),
  word_count: z.number().int().min(0).default(0),
  status: z.enum(["draft", "final"]).default("draft"),
  notes: z.string().max(10000).nullable().optional(),
});

const UpdateSchema = SaveSchema.partial().extend({ id: z.string().uuid() });

const SYSTEM_PROMPT = `Kamu adalah penulis artikel SEO profesional berbahasa Indonesia untuk media bisnis/ekonomi.

FORMAT WAJIB (mengikuti contoh artikel referensi brand):
- H1: judul utama, click-worthy, mengandung main keyword, gaya Title Case.
- Paragraf pembuka (lead): 2 paragraf. Paragraf pertama menjelaskan fenomena/konteks dan HARUS memuat main keyword secara natural di kalimat pertama atau kedua. Paragraf kedua memperkenalkan tokoh/persona sebagai sumber perspektif.
- 3-5 sub-bagian dengan heading H2 yang deskriptif dan mengandung keyword turunan.
- Setiap sub-bagian terdiri dari 2 paragraf (masing-masing 3-5 kalimat). TIDAK ada bullet list di badan artikel — semua narasi paragraf mengalir, gaya jurnalistik feature.
- Boleh menyisipkan 1 kutipan langsung dari tokoh (dalam tanda kutip) bila relevan.
- Penutup: 2-3 paragraf berisi kesimpulan, pesan utama, dan ajakan/aspirasi. Tanpa heading "Kesimpulan".

KAIDAH SEO:
- Kepadatan main keyword ~1-1.5%, tersebar natural (judul, lead, minimal satu H2, penutup).
- Gunakan secondary keywords/LSI secara alami.
- Kalimat aktif, maksimal ~20-25 kata per kalimat, paragraf pendek (3-5 kalimat).
- Meta description 140-158 karakter, mengandung main keyword.
- Slug pendek, huruf kecil, dipisah tanda hubung.

PERSONA & SUDUT PANDANG:
- Gunakan knowledge base (playbook, persona, style guide, red line) sebagai sumber sudut pandang, brand voice, dan batasan. Jangan melanggar red line.
- Tulis dengan sudut pandang orang ketiga yang menghormati tokoh (mis. "Beliau menekankan...").
- Jangan mengarang data statistik, angka, atau kutipan yang tidak ada di konteks. Jika tidak ada data, tulis kualitatif.

Output HARUS lewat function call. Isi 'content' dalam Markdown: '# Judul', paragraf, '## Sub-judul', paragraf.`;

const TOOL_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    slug: { type: "string" },
    meta_description: { type: "string" },
    main_keyword: { type: "string" },
    secondary_keywords: { type: "array", items: { type: "string" } },
    outline: { type: "array", items: { type: "string" } },
    category: { type: "string", enum: ["Mentor", "Investor", "Leader"] },
    content: { type: "string" },
  },
  required: [
    "title",
    "slug",
    "meta_description",
    "main_keyword",
    "secondary_keywords",
    "outline",
    "category",
    "content",
  ],
  additionalProperties: false,
};

export const generateArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GenerateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { data: kb } = await context.supabase
      .from("knowledge_base")
      .select("type,title,content")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: false })
      .limit(30);

    const kbContext = (kb ?? [])
      .map((k) => `### ${String(k.type).toUpperCase()} — ${k.title}\n${String(k.content).slice(0, 6000)}`)
      .join("\n\n");

    const secondary = data.secondary_keywords
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    let userText = "";
    if (kbContext) userText += `=== KNOWLEDGE BASE (persona, playbook, style guide) ===\n${kbContext}\n\n`;
    userText += `=== BRIEF ARTIKEL ===\n`;
    userText += `Ide / Topik: ${data.topic}\n`;
    if (data.main_keyword) userText += `Main Keyword: ${data.main_keyword}\n`;
    if (secondary.length) userText += `Secondary Keywords: ${secondary.join(", ")}\n`;
    userText += `Kategori: ${data.category}\n`;
    userText += `Target panjang: sekitar ${data.word_target} kata\n`;
    if (data.extra_notes) userText += `Catatan tambahan: ${data.extra_notes}\n`;
    userText += `\nTulis artikel SEO lengkap sesuai format dan kaidah di atas.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userText },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "produce_article",
              description: "Output artikel SEO terstruktur",
              parameters: TOOL_SCHEMA,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "produce_article" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      if (aiRes.status === 429) throw new Error("Rate limit AI tercapai. Coba lagi sebentar.");
      if (aiRes.status === 402) throw new Error("Kredit AI habis. Top up di Settings > Workspace > Usage.");
      throw new Error(`AI error ${aiRes.status}: ${errText.slice(0, 200)}`);
    }

    const aiJson = await aiRes.json();
    const args = aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI tidak mengembalikan artikel terstruktur.");
    const article = JSON.parse(args);
    const word_count = String(article.content ?? "").trim().split(/\s+/).filter(Boolean).length;

    return { article: { ...article, word_count } };
  });

export const listArticles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("articles")
      .select("*")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const saveArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SaveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("articles")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const updateArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("articles")
      .update(rest)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const deleteArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("articles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
