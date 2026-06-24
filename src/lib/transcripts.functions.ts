import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  source_type: z.enum(["url", "file", "manual"]).default("url"),
  source_url: z.string().max(2048).nullable().optional(),
  source_path: z.string().max(1024).nullable().optional(),
  platform: z.string().max(50).nullable().optional(),
  mime: z.string().max(100).nullable().optional(),
  transcript: z.string().default(""),
  notes: z.string().max(10000).nullable().optional(),
});

const UpdateSchema = CreateSchema.partial().extend({ id: z.string().uuid() });

export const listTranscripts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("transcripts")
      .select("*")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const getTranscriptById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("transcripts")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const createTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("transcripts")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const updateTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("transcripts")
      .update(rest)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const deleteTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("transcripts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
