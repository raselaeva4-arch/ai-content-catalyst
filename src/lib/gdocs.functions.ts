import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { searchDocs, fetchDocComments, fetchDocContent, fetchDocMeta, parseDocId } from "@/lib/gdocs.shared";

export const searchGoogleDocs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ query: z.string().max(200).optional().default("") }).parse(d))
  .handler(async ({ data }) => ({ items: await searchDocs(data.query) }));

export const importGoogleDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid(), doc_id: z.string().min(5).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const docId = parseDocId(data.doc_id);
    const [meta, content, comments] = await Promise.all([
      fetchDocMeta(docId),
      fetchDocContent(docId),
      fetchDocComments(docId),
    ]);

    await context.supabase.from("doc_revision_notes").delete().eq("project_id", data.project_id).eq("doc_id", meta.id);

    const rows = comments.map((c, i) => ({
      project_id: data.project_id,
      doc_id: meta.id,
      doc_name: meta.name,
      doc_url: meta.webViewLink,
      section: c.section,
      note: c.note,
      author: c.author,
      commented_at: c.commented_at,
      resolved: c.resolved,
      position: i,
      ai_recommendation: null,
      ai_result: null,
    }));

    let saved: any[] = [];
    if (rows.length) {
      const { data: inserted, error } = await context.supabase.from("doc_revision_notes").insert(rows).select();
      if (error) throw new Error(error.message);
      saved = inserted ?? [];
    }

    return { doc: meta, content, notes: saved };
  });

export const listDocRevisionNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid(), doc_id: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("doc_revision_notes")
      .select("*")
      .eq("project_id", data.project_id)
      .order("position", { ascending: true });
    if (data.doc_id) q = q.eq("doc_id", data.doc_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const createDocRevisionNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        doc_id: z.string().max(200).nullable().optional(),
        doc_name: z.string().max(300).nullable().optional(),
        doc_url: z.string().max(500).nullable().optional(),
        section: z.string().max(20000).default(""),
        note: z.string().max(20000).default(""),
        author: z.string().max(200).nullable().optional(),
        commented_at: z.string().nullable().optional(),
        position: z.number().int().default(0),
        ai_recommendation: z.string().max(20000).nullable().optional(),
        ai_result: z.string().max(20000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("doc_revision_notes").insert(data).select().single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const updateDocRevisionNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        section: z.string().max(20000).optional(),
        note: z.string().max(20000).optional(),
        author: z.string().max(200).nullable().optional(),
        commented_at: z.string().nullable().optional(),
        resolved: z.boolean().optional(),
        ai_recommendation: z.string().max(20000).nullable().optional(),
        ai_result: z.string().max(20000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("doc_revision_notes")
      .update(rest)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const deleteDocRevisionNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("doc_revision_notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
