import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import { ArrowLeft, Pencil, Trash2, Save, X, Sparkles, FileText, Hash, TrendingUp, Calendar, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listHistory, updateHistory, deleteHistory } from "@/lib/history.functions";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  loader: async () => {
    const res = await listHistory();
    return { items: res.items };
  },
  head: () => ({
    meta: [
      { title: "History — KeywordForge" },
      { name: "description", content: "Riwayat hasil generate keyword & judul artikel yang sudah disimpan." },
    ],
  }),
});

type Item = {
  id: string;
  title: string;
  category: string | null;
  summary: string | null;
  main_keywords: any[];
  secondary_keywords: any[];
  article_titles: any[];
  extracted: any;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function HistoryPage() {
  const router = useRouter();
  const { items } = Route.useLoaderData() as { items: Item[] };
  const updateFn = useServerFn(updateHistory);
  const deleteFn = useServerFn(deleteHistory);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />

      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon"><ArrowLeft className="size-4" /></Button>
            </Link>
            <div className="size-9 rounded-lg flex items-center justify-center text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
              <Sparkles className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Riwayat Hasil Generate</h1>
              <p className="text-xs text-muted-foreground">{items.length} hasil tersimpan</p>
            </div>
          </div>
          <Link to="/"><Button variant="outline" size="sm">+ Generate Baru</Button></Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-4">
        {items.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="size-10 mx-auto mb-3 text-muted-foreground" />
            <h2 className="font-semibold mb-1">Belum ada riwayat</h2>
            <p className="text-sm text-muted-foreground mb-4">Generate keyword & simpan dari halaman utama.</p>
            <Link to="/"><Button>Mulai Generate</Button></Link>
          </Card>
        ) : (
          items.map((item) => (
            <HistoryCard
              key={item.id}
              item={item}
              editing={editingId === item.id}
              onEdit={() => setEditingId(item.id)}
              onCancel={() => setEditingId(null)}
              onSave={async (patch) => {
                try {
                  await updateFn({ data: { id: item.id, ...patch } });
                  toast.success("Perubahan disimpan");
                  setEditingId(null);
                  router.invalidate();
                } catch (e) { toast.error((e as Error).message); }
              }}
              onDelete={async () => {
                if (!confirm(`Hapus "${item.title}"?`)) return;
                try {
                  await deleteFn({ data: { id: item.id } });
                  toast.success("Dihapus");
                  router.invalidate();
                } catch (e) { toast.error((e as Error).message); }
              }}
            />
          ))
        )}
      </main>
    </div>
  );
}

function HistoryCard({ item, editing, onEdit, onCancel, onSave, onDelete }: {
  item: Item;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: Partial<Item>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState(item.category ?? "");
  const [summary, setSummary] = useState(item.summary ?? "");
  const [secondary, setSecondary] = useState((item.secondary_keywords ?? []).join(", "));
  const [titles, setTitles] = useState((item.article_titles ?? []).join("\n"));
  const [notes, setNotes] = useState(item.notes ?? "");

  if (editing) {
    return (
      <Card className="p-6 shadow-[var(--shadow-elevated)] space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Judul</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Kategori</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Mentor">Mentor</SelectItem>
                <SelectItem value="Investor">Investor</SelectItem>
                <SelectItem value="Leader">Leader</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Ringkasan</label>
          <Textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Secondary keywords (pisah koma)</label>
          <Textarea rows={2} value={secondary} onChange={(e) => setSecondary(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Judul artikel (1 per baris)</label>
          <Textarea rows={5} value={titles} onChange={(e) => setTitles(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Catatan</label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel}><X className="size-4 mr-1.5" />Batal</Button>
          <Button onClick={() => onSave({
            title: title.trim(),
            category: category || null,
            summary: summary || null,
            secondary_keywords: secondary.split(",").map((s) => s.trim()).filter(Boolean),
            article_titles: titles.split("\n").map((s) => s.trim()).filter(Boolean),
            notes: notes || null,
          })}><Save className="size-4 mr-1.5" />Simpan</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-lg leading-tight">{item.title}</h3>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3" />
            <span>{new Date(item.created_at).toLocaleString("id-ID")}</span>
            {item.category && <Badge variant="outline" className="text-[10px]">{item.category}</Badge>}
          </div>
        </div>
        <div className="flex gap-1">
          <Link to="/history/$id" params={{ id: item.id }}>
            <Button variant="ghost" size="icon" title="Lihat detail"><Eye className="size-4" /></Button>
          </Link>
          <Button variant="ghost" size="icon" onClick={onEdit}><Pencil className="size-4" /></Button>
          <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="size-4 text-destructive" /></Button>
        </div>
      </div>

      {item.summary && <p className="text-sm text-muted-foreground mb-4">{item.summary}</p>}

      {item.main_keywords?.length > 0 && (
        <section className="mb-3">
          <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5"><TrendingUp className="size-3" />Main Keywords</div>
          <div className="flex flex-wrap gap-1.5">
            {item.main_keywords.map((k: any, i: number) => (
              <Badge key={i} variant="secondary" className="font-normal">{typeof k === "string" ? k : k.keyword}</Badge>
            ))}
          </div>
        </section>
      )}

      {item.secondary_keywords?.length > 0 && (
        <section className="mb-3">
          <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5"><Hash className="size-3" />Secondary</div>
          <div className="flex flex-wrap gap-1.5">
            {item.secondary_keywords.map((k: any, i: number) => (
              <Badge key={i} variant="outline" className="font-normal text-xs">{String(k)}</Badge>
            ))}
          </div>
        </section>
      )}

      {item.article_titles?.length > 0 && (
        <section>
          <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5"><FileText className="size-3" />Judul Artikel</div>
          <ul className="space-y-1">
            {item.article_titles.map((t: any, i: number) => (
              <li key={i} className="text-sm flex gap-2"><span className="text-muted-foreground tabular-nums">{i + 1}.</span><span>{String(t)}</span></li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}
