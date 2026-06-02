import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const DEFAULT_PROJECT_ID = "00000000-0000-0000-0000-000000000001";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
});

const UpdateSchema = CreateSchema.partial().extend({ id: z.string().uuid() });

export const listProjects = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return { items: data ?? [] };
});

export const createProject = createServerFn({ method: "POST" })
  .inputValidator((d) => CreateSchema.parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("projects")
      .insert({ name: data.name, description: data.description ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const updateProject = createServerFn({ method: "POST" })
  .inputValidator((d) => UpdateSchema.parse(d))
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await supabaseAdmin
      .from("projects")
      .update(rest)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    if (data.id === DEFAULT_PROJECT_ID) {
      throw new Error("Project default tidak bisa dihapus.");
    }
    const { error } = await supabaseAdmin.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
