import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { ArrowLeft, LayoutGrid, Plus, Trash2, Loader2, Save, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  listPortalTools,
  createPortalTool,
  updatePortalTool,
  deletePortalTool,
} from "@/lib/tools.functions";

export const Route = createFileRoute("/tools")({
  ssr: false,
  component: ToolsPage,
  head: () => ({
    meta: [
      { title: "Kelola Tool — Ebran Portal" },
      { name: "description", content: "Gabungkan tool dari aplikasi lain ke dalam satu portal dengan satu login." },
      { property: "og:title", content: "Kelola Tool — Ebran Portal" },
      { property: "og:description", content: "Gabungkan tool dari aplikasi lain ke dalam satu portal dengan satu login." },
    ],
  }),
});

type Tool = {
  id: string;
  name: string;
  slug: string;
  url: string;
  description: string | null;
  sort_order: number;
  open_in_new_tab: boolean;
};

function ToolsPage() {
  const listFn = useServerFn(listPortalTools);
  const createFn = useServerFn(createPortalTool);
  const updateFn = useServerFn(updatePortalTool);
  const deleteFn = useServerFn(deletePortalTool);

  const [items, setItems] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [desc, setDesc] = useState("");

  const refresh = async () => {
    try {
      const res = await listFn();
      setItems(res.items as Tool[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCreate = async () => {
    if (!name.trim() || !url.trim()) return toast.error("Nama dan alamat tool wajib diisi");
    setSaving(true);
    try {
      await createFn({
        data: {
          name: name.trim(),
          url: url.trim(),
          slug: slug.trim() || undefined,
          description: desc.trim() || null,
          sort_order: items.length,
        },
      });
      toast.success("Tool ditambahkan");
      setName(""); setUrl(""); setSlug(""); setDesc("");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onPatch = async (id: string, patch: Partial<Tool>) => {
    try {
      await updateFn({ data: { id, ...patch } });
      toast.success("Tersimpan");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteFn({ data: { id } });
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Tool dihapus");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="sticky top-0 z-10 border-b bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="size-4" /></Button></Link>
          <div
            className="flex size-9 items-center justify-center rounded-lg text-primary-foreground"
            style={{ background: "var(--gradient-brand)" }}
          >
            <LayoutGrid className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Kelola Tool</h1>
            <p className="text-xs text-muted-foreground">
              Satu login, satu menu — tool dari aplikasi lain tampil di dalam portal ini
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Tambah tool baru</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Nama tool (misal: Tool B)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="https://tool-b.lovable.app" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Input placeholder="Alamat menu (opsional, misal: tool-b)" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <Textarea placeholder="Deskripsi singkat (opsional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <Button onClick={onCreate} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Tambah Tool
          </Button>
        </Card>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Memuat…
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada tool tambahan.</p>
        ) : (
          <div className="space-y-3">
            {items.map((t) => (
              <Card key={t.id} className="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    defaultValue={t.name}
                    onBlur={(e) => e.target.value !== t.name && onPatch(t.id, { name: e.target.value })}
                  />
                  <Input
                    defaultValue={t.url}
                    onBlur={(e) => e.target.value !== t.url && onPatch(t.id, { url: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <code className="rounded bg-muted px-2 py-1 text-xs">/t/{t.slug}</code>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={t.open_in_new_tab}
                      onChange={(e) => onPatch(t.id, { open_in_new_tab: e.target.checked })}
                    />
                    Buka di tab baru
                  </label>
                  <div className="ml-auto flex gap-2">
                    <Link to="/t/$slug" params={{ slug: t.slug }}>
                      <Button variant="outline" size="sm"><ExternalLink className="size-4" /> Buka</Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(t.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <Textarea
                  defaultValue={t.description ?? ""}
                  placeholder="Deskripsi singkat"
                  onBlur={(e) =>
                    e.target.value !== (t.description ?? "") && onPatch(t.id, { description: e.target.value })
                  }
                />
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          <Save className="mr-1 inline size-3" />
          Sebagian situs menolak ditampilkan di dalam halaman lain. Jika halaman tool tampak kosong,
          aktifkan "Buka di tab baru".
        </p>
      </main>
    </div>
  );
}
