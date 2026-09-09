import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutGrid,
  FileText,
  Mic,
  ListChecks,
  History,
  FolderKanban,
  Settings2,
  ExternalLink,
  Sparkles,
  Menu,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Tool = {
  id: string;
  name: string;
  slug: string;
  url: string;
  open_in_new_tab: boolean;
};

const internalLinks = [
  { to: "/", label: "Keyword Explorer", icon: Sparkles },
  { to: "/articles", label: "Artikel SEO", icon: FileText },
  { to: "/rework", label: "Rework Artikel", icon: ListChecks },
  { to: "/transcripts", label: "Transkrip", icon: Mic },
  { to: "/history", label: "Riwayat", icon: History },
  { to: "/projects", label: "Projects", icon: FolderKanban },
] as const;

const HIDDEN_PREFIXES = ["/auth", "/.lovable", "/.mcp", "/.well-known", "/mcp"];

export function PortalSidebar({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [tools, setTools] = useState<Tool[]>([]);
  const [open, setOpen] = useState(false);

  const hidden = HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (hidden) return;
    let active = true;
    void (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return;
      const { data } = await supabase
        .from("portal_tools")
        .select("id,name,slug,url,open_in_new_tab")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (active && data) setTools(data as Tool[]);
    })();
    return () => {
      active = false;
    };
  }, [hidden, location.pathname]);

  if (hidden) return <>{children}</>;

  const itemClass = (active: boolean) =>
    cn(
      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
      active
        ? "bg-primary/10 text-primary font-medium"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const nav = (
    <nav className="flex h-full w-60 shrink-0 flex-col gap-1 border-r bg-card/40 p-3">
      <div className="mb-3 flex items-center gap-2 px-2">
        <div
          className="flex size-8 items-center justify-center rounded-lg text-primary-foreground"
          style={{ background: "var(--gradient-brand)" }}
        >
          <LayoutGrid className="size-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Ebran Portal</span>
      </div>

      <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Tools
      </p>
      {internalLinks.map((l) => {
        const Icon = l.icon;
        const active = location.pathname === l.to;
        return (
          <Link key={l.to} to={l.to} className={itemClass(active)} onClick={() => setOpen(false)}>
            <Icon className="size-4" />
            {l.label}
          </Link>
        );
      })}

      {tools.length > 0 && (
        <>
          <p className="px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Tool Terhubung
          </p>
          {tools.map((t) =>
            t.open_in_new_tab ? (
              <a
                key={t.id}
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                className={itemClass(false)}
              >
                <ExternalLink className="size-4" />
                {t.name}
              </a>
            ) : (
              <Link
                key={t.id}
                to="/t/$slug"
                params={{ slug: t.slug }}
                className={itemClass(location.pathname === `/t/${t.slug}`)}
                onClick={() => setOpen(false)}
              >
                <LayoutGrid className="size-4" />
                {t.name}
              </Link>
            ),
          )}
        </>
      )}

      <div className="mt-auto pt-3">
        <Link to="/tools" className={itemClass(location.pathname === "/tools")} onClick={() => setOpen(false)}>
          <Settings2 className="size-4" />
          Kelola Tool
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="h-full bg-background">{nav}</div>
          <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 left-4 z-40 rounded-full border bg-card p-3 shadow-lg md:hidden"
          aria-label="Buka menu"
        >
          <Menu className="size-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
