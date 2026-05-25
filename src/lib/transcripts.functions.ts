import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CreateSchema = z.object({
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

export const listTranscripts = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("transcripts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { items: data ?? [] };
});

export const getTranscriptById = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("transcripts")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const createTranscript = createServerFn({ method: "POST" })
  .inputValidator((d) => CreateSchema.parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("transcripts")
      .insert(data as any)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const updateTranscript = createServerFn({ method: "POST" })
  .inputValidator((d) => UpdateSchema.parse(d))
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await supabaseAdmin
      .from("transcripts")
      .update(rest as any)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const deleteTranscript = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("transcripts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
