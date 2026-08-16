import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ARS_TONE_RULES } from "@/lib/articles.prompt";
import { callAi, fileToBase64, EXTRACT_SCHEMA, REWORK_SCHEMA } from "@/lib/rework.shared";

const ARS_MASTER_PLAYBOOK = `
ARSJAD RASJID MASTER NARRATIVE & PLAYBOOK:
- KONTEKS UTAMA: Arsjad Rasjid adalah tokoh bisnis, investor (Sriwijaya Capital), mentor, dan pemimpin institusi (Indika, XLSmart, IBC, Endeavor, dll). Beliau BUKAN lagi Ketua Kadin.
- ESSENCE: "Calm leadership that builds long-term value through people, collaboration, and clarity."
- TONE & STYLE: Thoughtful, composed, reflective, calm authority, inclusive, strategic, non-technical, non-promotional.
- PRINSIP UTAMA:
  1. Praktis, Kredibel, Membumi, Optimistis. Berbicara dari pengalaman nyata (bukan teori/akademis).
  2. Macro to Practical: Selalu tarik isu makro ke dampak nyata bagi pengusaha, UMKM, pekerja, dan generasi muda.
  3. Mentor, Bukan Motivator: Berbagi pembelajaran dan keputusan sulit, bukan motivasi kosong.
- NARRATIVE RED LINE (WAJIB DIPATUHI):
  - DILARANG politik praktis/partisan, menyerang/menyalahkan pihak tertentu, klaim data/finansial spesifik, atau isu SARA.
  - Dilarang menggunakan bahasa absolut: "harus", "wajib", "gagal", "salah". Gunakan: "perlu dipertimbangkan", "tantangan yang perlu dikelola".
  - Dilarang menggunakan gaya "AI banget" atau metaforis berlebihan ("kompas", "lanskap dinamis", "perjalanan transformatif").
- STRUKTUR BERPIKIR: Problem -> Perspective -> Experience -> Solution -> Hope.
- READABILITY: Kalimat pendek hingga menengah, aktif, mudah dicerna (easy to digest), hindari jargon akademis atau birokratis.
`;

export const extractArticleFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ path: z.string().min(1), name: z.string().min(1), mime: z.string().min(1) }).parse(d),
  )
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
          function: {
            name: "extract_article",
            description: "Hasil ekstraksi artikel + catatan revisi",
            parameters: EXTRACT_SCHEMA,
          },
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
      revision_notes: Array.isArray(parsed.revision_notes) ? parsed.revision_notes.map((rn: any) => ({
        ...rn,
        ai_recommendation: rn.ai_recommendation || "",
        ai_result: rn.ai_result || "",
      })) : [],
    };
  });

export const reviewRevisionNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ 
        content: z.string().min(1).max(200000), 
        extra_context: z.string().max(10000).optional().default("") 
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const json = await callAi(apiKey, {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Kamu adalah Narrative Intelligence Assistant & Editor Senior untuk Arsjad Rasjid.\n" +
            ARS_MASTER_PLAYBOOK +
            "\nTugasmu: Buat Action Plan / Rekomendasi taktis yang membumi, tenang, praktikal, dan mudah dicerna (easy to digest) untuk menjawab instruksi editor. Hindari bahasa akademis atau gaya 'AI banget'.\n\n" +
            ARS_TONE_RULES,
        },
        {
          role: "user",
          content: `${data.extra_context ? data.extra_context + "\n\n" : ""}=== ARTIKEL ===\n${data.content.slice(0, 120000)}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: { name: "extract_article", description: "Catatan revisi & rekomendasi AI", parameters: EXTRACT_SCHEMA },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_article" } },
    });

    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI tidak mengembalikan catatan revisi.");
    const parsed = JSON.parse(args);
    return { 
      revision_notes: Array.isArray(parsed.revision_notes) ? parsed.revision_notes.map((rn: any) => ({
        ...rn,
        ai_recommendation: rn.ai_recommendation || rn.note || "",
        ai_result: rn.ai_result || "",
      })) : [] 
    };
  });

export const generateReplacementSentence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      article_content: z.string().max(100000),
      location: z.string().optional().default(""),
      note: z.string(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `
    === MASTER PLAYBOOK (ARSJAD RASJID) ===
    ${ARS_MASTER_PLAYBOOK}

    === KUTIPAN TEKS ASLI ===
    "${data.location}"

    === INSTRUKSI EDITOR ===
    "${data.note}"

    TUGAS: Buat HANYA 1-2 kalimat pengganti yang singkat, padat, membumi, dan langsung menjawab instruksi editor sesuai tone Arsjad Rasjid. Jangan kembalikan artikel penuh atau penjelasan panjang, berikan HANYA teks kalimat penggantinya saja (maksimal 2 kalimat pendek).
    `;

    const json = await callAi(apiKey, {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "Kamu adalah copywriter profesional Arsjad Rasjid. Berikan HANYA kalimat pengganti yang singkat dan padat (1-2 kalimat), tanpa pengantar, tanpa basa-basi, dan tanpa penjelasan lain.",
        },
        { role: "user", content: prompt },
      ],
    });

    const text = json.choices?.[0]?.message?.content?.trim() || "";
    return { replacement: text };
  });

export const runRework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        content: z.string().min(1).max(200000),
        title: z.string().max(300).optional().default(""),
        revision_notes: z
          .array(
            z.object({
              location: z.string().optional().default(""),
              note: z.string(),
              type: z.string().optional().default("other"),
              author: z.string().nullable().optional(),
              commented_at: z.string().nullable().optional(),
              ai_recommendation: z.string().optional().nullable(),
              ai_result: z.string().optional().nullable(),
            }),
          )
          .default([]),
        manual_prompt: z.string().max(10000).optional().default(""),
        scope: z.enum(["full", "partial"]).optional().default("full"),
      })
      .parse(d),
  )
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
      ? data.revision_notes
          .map((n, i) => {
            const meta = [n.author ? `oleh ${n.author}` : "", n.commented_at ? `pada ${n.commented_at}` : ""]
              .filter(Boolean)
              .join(" ");
            const section = n.location ? `\n   BAGIAN YANG DIREVISI (TEKS ASLI): "${n.location.slice(0, 1500)}"` : "";
            const recommendation = n.ai_recommendation ? `\n   REKOMENDASI AI / ACTION PLAN: ${n.ai_recommendation}` : "";
            const presetResult = n.ai_result ? `\n   HASIL SCRIPT / KALIMAT PENGGANTI AI: ${n.ai_result}` : "";
            return `${i + 1}. [${n.type}]${meta ? ` (${meta})` : ""} APA YANG HARUS DIREVISI: ${n.note}${section}${recommendation}${presetResult}`;
          })
          .join("\n\n")
      : "(tidak ada catatan revisi terstruktur)";

    let userText = "";
    userText += `=== MASTER PLAYBOOK (ARSJAD RASJID PERSONA & TONE) ===\n${ARS_MASTER_PLAYBOOK}\n\n`;
    if (kbContext) userText += `=== KNOWLEDGE BASE TAMBAHAN ===\n${kbContext}\n\n`;
    userText += `=== ARTIKEL ASLI ===\n${data.content.slice(0, 120000)}\n\n`;
    userText += `=== CATATAN REVISI & INSTRUKSI ITEMISASI ===\n${notesText}\n\n`;
    if (data.manual_prompt)
      userText += `=== PERINTAH MANUAL DARI USER (prioritas tertinggi) ===\n${data.manual_prompt}\n\n`;
    
    userText +=
      data.scope === "partial"
        ? "Ubah HANYA bagian yang disebut catatan revisi / perintah manual. Terapkan tone Arsjad Rasjid (membumi, praktikal, easy to digest). Integrasikan hasil kalimat pengganti dengan mulus agar nyambung dengan bagian artikel lainnya.\n"
        : "Rework menyeluruh berdasarkan catatan revisi di atas dengan menerapkan tone Arsjad Rasjid secara utuh (praktis, kredibel, membumi, optimis, tanpa istilah akademis/birokratis yang kaku). Jaga agar alur baca tetap runtut, padu, dan easy to digest.\n";
    
    userText += `\n${ARS_TONE_RULES}\n\nHasilkan artikel versi terbaru, daftar poin perubahan, dan crosscheck tiap catatan revisi, termasuk penilaian kesesuaian tone.`;

    const json = await callAi(apiKey, {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Kamu adalah ghostwriter dan editor senior profesional untuk Arsjad Rasjid. Tugasmu merework artikel agar sepenuhnya mematuhi Master Playbook Arsjad Rasjid: membumi, praktikal, berpengalaman, mudah dicerna (easy to digest), dan sama sekali tidak akademis atau 'AI banget'. Pastikan hasil akhir akurat, faktual, dan bernada kepemimpinan yang tenang. Output harus markdown rapi (H1/H2/H3, paragraf pendek).",
        },
        { role: "user", content: userText },
      ],
      tools: [
        {
          type: "function",
          function: { name: "produce_rework", description: "Hasil rework artikel", parameters: REWORK_SCHEMA },
        },
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
  .inputValidator((d) =>
    z
      .object({
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
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("article_reworks").insert(data).select().single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const updateRework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(300).optional(),
        original_content: z.string().max(200000).optional(),
        revision_notes: z.array(z.any()).optional(),
        revision_notes_text: z.string().max(20000).optional(),
        manual_prompt: z.string().max(10000).optional(),
        reworked_content: z.string().max(200000).optional(),
        reworked_title: z.string().max(300).nullable().optional(),
        changes: z.array(z.any()).optional(),
        crosscheck: z.any().optional(),
        status: z.enum(["draft", "final"]).optional(),
      })
      .parse(d),
  )
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
