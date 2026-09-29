import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Workspace lama (sebelum login diaktifkan) — dipakai untuk memindahkan data lama.
export const SHARED_WORKSPACE_USER_ID = "b101f229-3cbf-4be2-bec8-d62753bf17ef";

// Setiap server function kini terikat ke pengguna yang login: token diverifikasi
// dan semua query difilter berdasarkan userId pengguna tersebut.
export const publicAccess = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Response("Unauthorized", { status: 401 });
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Response("Unauthorized", { status: 401 });
  const userId = data.user.id;
  return next({
    context: {
      supabase: supabaseAdmin,
      userId,
      claims: { sub: userId, email: data.user.email } as Record<string, unknown>,
    },
  });
});
