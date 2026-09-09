import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "tool";

const toolInput = z.object({
  name: z.string().min(1).max(80),
  url: z.string().url(),
  slug: z.string().optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  open_in_new_tab: z.boolean().optional(),
});

export const listPortalTools = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("portal_tools")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const getPortalTool = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("portal_tools")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { item: row ?? null };
  });

export const createPortalTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => toolInput.parse(d))
  .handler(async ({ context, data }) => {
    const slug = slugify(data.slug || data.name);
    const { data: row, error } = await context.supabase
      .from("portal_tools")
      .insert({
        user_id: context.userId,
        name: data.name,
        url: data.url,
        slug,
        description: data.description ?? null,
        icon: data.icon ?? null,
        sort_order: data.sort_order ?? 0,
        open_in_new_tab: data.open_in_new_tab ?? false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const updatePortalTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    toolInput.partial().extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { id, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest };
    if (typeof rest.slug === "string") patch.slug = slugify(rest.slug);
    const { data: row, error } = await context.supabase
      .from("portal_tools")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const deletePortalTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("portal_tools").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
