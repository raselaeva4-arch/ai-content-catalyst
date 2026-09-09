import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPortalTool } from "@/lib/tools.functions";

export const Route = createFileRoute("/t/$slug")({
  ssr: false,
  component: EmbeddedToolPage,
  head: () => ({
    meta: [
      { title: "Tool Terhubung — Ebran Portal" },
      { name: "description", content: "Buka tool eksternal langsung di dalam portal Ebran." },
      { property: "og:title", content: "Tool Terhubung — Ebran Portal" },
      { property: "og:description", content: "Buka tool eksternal langsung di dalam portal Ebran." },
    ],
  }),
});

type Tool = { id: string; name: string; url: string; description: string | null };

function EmbeddedToolPage() {
  const { slug } = Route.useParams();
  const getFn = useServerFn(getPortalTool);
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await getFn({ data: { slug } });
        if (!active) return;
        setTool((res.item as Tool) ?? null);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, getFn]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Memuat tool…
      </div>
    );
  }

  if (error || !tool) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-lg font-semibold">Tool tidak ditemukan</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {error ?? "Tool ini belum terdaftar di portal Anda."}
        </p>
        <Link to="/tools">
          <Button variant="outline" size="sm">Kelola Tool</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-3 border-b bg-card/50 px-4 py-2 backdrop-blur">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight">{tool.name}</h1>
          {tool.description && (
            <p className="truncate text-xs text-muted-foreground">{tool.description}</p>
          )}
        </div>
        <a href={tool.url} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            <ExternalLink className="size-4" /> Buka tab baru
          </Button>
        </a>
      </header>
      <iframe
        key={tool.id}
        src={tool.url}
        title={tool.name}
        className="h-full w-full flex-1 border-0 bg-background"
        allow="clipboard-write; microphone; camera; fullscreen"
      />
    </div>
  );
}
