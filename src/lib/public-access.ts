import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Workspace lama (sebelum login diaktifkan) — dipakai untuk memindahkan data lama.
export const SHARED_WORKSPACE_USER_ID = "b101f229-3cbf-4be2-bec8-d62753bf17ef";

// Server functions authenticate the caller, then use a user-scoped Supabase
// client so Postgres RLS is enforced for every query. The admin client is used
// only to validate the bearer token and must never be exposed to the browser.
export const publicAccess = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const authHeader = getRequest()?.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) throw new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Response("Unauthorized", { status: 401 });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
  }

  const userId = data.user.id;
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  return next({
    context: {
      supabase,
      userId,
      claims: { sub: userId, email: data.user.email } as Record<string, unknown>,
    },
  });
});
