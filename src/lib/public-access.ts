import { createMiddleware } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Aplikasi ini berjalan tanpa login (di-embed di dalam portal SEO OS yang sudah
// mewajibkan login). Semua server function memakai satu workspace bersama.
export const SHARED_WORKSPACE_USER_ID = "b101f229-3cbf-4be2-bec8-d62753bf17ef";

export const publicAccess = createMiddleware({ type: "function" }).server(
  async ({ next }) =>
    next({
      context: {
        supabase: supabaseAdmin,
        userId: SHARED_WORKSPACE_USER_ID,
        claims: { sub: SHARED_WORKSPACE_USER_ID } as Record<string, unknown>,
      },
    }),
);
