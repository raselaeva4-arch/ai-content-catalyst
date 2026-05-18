import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SaveSchema = z.object({
  title: z.string().min(1).max(300),
  category: z.string().max(50).nullable().optional(),
  summary: z.string().max(5000).nullable().optional(),
  main_keywords: z.array(z.any()).default([]),
  secondary_keywords: z.array(z.any()).default([]),
  article_titles: z.array(z.any()).default([]),
  extracted: z.record(z.string(), z.any()).default({}),
  notes: z.string().max(10000).nullable().optional(),
  source_inputs: z.record(z.string(), z.any()).default({}),
});

const UpdateSchema = SaveSchema.partial().extend({ id: z.string().uuid() });

export const listHistory = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("saved_generations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { items: data ?? [] };
});

export const saveHistory = createServerFn({ method: "POST" })
  .inputValidator((d) => SaveSchema.parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("saved_generations")
      .insert(data as any)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const updateHistory = createServerFn({ method: "POST" })
  .inputValidator((d) => UpdateSchema.parse(d))
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await supabaseAdmin
      .from("saved_generations")
      .update(rest as any)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const deleteHistory = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("saved_generations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
