import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const KbSchema = z.object({
  type: z.enum(["playbook", "persona", "knowledge"]),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
});

export const listKb = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("knowledge_base")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { items: data ?? [] };
});

export const saveKb = createServerFn({ method: "POST" })
  .inputValidator((d) => KbSchema.parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("knowledge_base")
      .insert({ type: data.type, title: data.title, content: data.content })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const deleteKb = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("knowledge_base").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
