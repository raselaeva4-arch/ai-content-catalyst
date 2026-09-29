import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Profile = { display_name: string | null; email: string | null; avatar_url: string | null };

export function UserBadge() {
  const [p, setP] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, email, avatar_url")
        .eq("id", u.user.id)
        .maybeSingle();
      if (active) setP(data ?? { display_name: null, email: u.user.email ?? null, avatar_url: null });
    })();
    return () => { active = false; };
  }, []);

  if (!p) return null;
  const name = p.display_name || p.email || "User";
  return (
    <div className="flex min-w-0 items-center gap-2" title={p.email ?? name}>
      {p.avatar_url ? (
        <img src={p.avatar_url} alt="" className="size-7 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="hidden max-w-[140px] truncate text-xs text-muted-foreground md:inline">{name}</span>
    </div>
  );
}
