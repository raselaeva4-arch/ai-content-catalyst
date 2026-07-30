import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  Copy,
  Pencil,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  generateArticle,
  listArticles,
  saveArticle,
  updateArticle,
  deleteArticle,
} from "@/lib/articles.functions";
import { useActiveProject } from "@/hooks/use-active-project";
import { ProjectSwitcher } from "@/components/project-switcher";

function ErrorComponent({ error, reset }: { error: any; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-xl font-semibold">Terjadi kesalahan</h1>
        <p className="text-sm text-muted-foreground">{error?.message ?? "Gagal memuat halaman."}</p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => reset()}>Coba lagi</Button>
          <Link to="/"><Button variant="outline">Ke Beranda</Button></Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/articles")({
  component: ArticlesPage,
  errorComponent: ErrorComponent,
  head: () => ({
    meta: [
      { title: "Artikel SEO — KeywordForge" },
      { name: "description", content: "Tulis artikel SEO otomatis dari ide/topik dan keyword, memakai persona dari knowledge base." },
      { property: "og:title", content: "Artikel SEO — KeywordForge" },
      { property: "og:description", content: "Generate artikel SEO berbahasa Indonesia dari ide, keyword, dan knowledge base project Anda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type ArticleRow = {
  id: string;
  title: string;
  topic: string | null;
  main_keyword: string | null;
  secondary_keywords: string[];
  category: string | null;
  meta_description: string | null;
  slug: string | null;
  outline: string[];
  content: string;
  word_count: number;
  status: string;
  created_at: string;
};

type Draft = {
  title: string;
  slug: string;
  meta_description: string;
  main_keyword: string;
  secondary_keywords: string[];
  outline: string[];
  category: string;
  content: string;
  word_count: number;
};

function ArticlePreview({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => markdown.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean), [markdown]);
  return (
    <article className="space-y-4">
      {blocks.map((b, i) => {
        if (b.startsWith("## ")) return <h2 key={i} className="text-lg font-semibold tracking-tight pt-2">{b.slice(3)}</h2>;
        if (b.startsWith("# ")) return <h1 key={i} className="text-2xl font-bold tracking-tight">{b.slice(2)}</h1>;
        return <p key={i} className="text-sm leading-7 text-foreground/90">{b}</p>;
      })}
    </article>
  );
}

function ArticlesPage() {
  const { projectId, mounted } = useActiveProject();
  const genFn = useServerFn(generateArticle);
  const listFn = useServerFn(listArticles);
  const saveFn = useServerFn(saveArticle);
  const updateFn = useServerFn(updateArticle);
  const deleteFn = useServerFn(deleteArticle);

  const [topic, setTopic] = useState("");
  const [mainKeyword, setMainKeyword] = useState("");
  const [secondary, setSecondary] = useState("");
  const [category, setCategory] = useState<"Mentor" | "Investor" | "Leader">("Leader");
  const [wordTarget, setWordTarget] = useState("900");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [items, setItems] = useState<ArticleRow[]>([]);
  const [listLoading, setListLoading] = useState(true);

  async function refresh() {
    setListLoading(true);
    try {
      const res = await listFn({ data: { project_id: projectId } });
      setItems((res.items ?? []) as unknown as ArticleRow[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    if (mounted) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, projectId]);

  async function onGenerate() {
    if (topic.trim().length < 3) {
      toast.error("Isi ide / topik artikel dulu.");
      return;
    }
    setLoading(true);
    setDraft(null);
    setEditingId(null);
    try {
      const res = await genFn({
        data: {
          project_id: projectId,
          topic: topic.trim(),
          main_keyword: mainKeyword.trim(),
          secondary_keywords: secondary.trim(),
          category,
          word_target: Number(wordTarget) || 900,
          extra_notes: notes.trim(),
        },
      });
      setDraft(res.article as Draft);
      toast.success("Artikel berhasil dibuat.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    if (!draft) return;
    setSaving(true);
    try {
      const payload = {
        title: draft.title,
        topic: topic.trim() || null,
        main_keyword: draft.main_keyword || null,
        secondary_keywords: draft.secondary_keywords ?? [],
        category: draft.category || null,
        meta_description: draft.meta_description || null,
        slug: draft.slug || null,
        outline: draft.outline ?? [],
        content: draft.content,
        word_count: draft.content.trim().split(/\s+/).filter(Boolean).length,
        status: "draft" as const,
      };
      if (editingId) {
        await updateFn({ data: { id: editingId, ...payload } });
        toast.success("Artikel diperbarui.");
      } else {
        const res = await saveFn({ data: { project_id: projectId, ...payload } });
        setEditingId((res.item as any)?.id ?? null);
        toast.success("Artikel disimpan.");
      }
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function loadForEdit(row: ArticleRow) {
    setEditingId(row.id);
    setTopic(row.topic ?? "");
    setMainKeyword(row.main_keyword ?? "");
    setSecondary((row.secondary_keywords ?? []).join(", "));
    setDraft({
      title: row.title,
      slug: row.slug ?? "",
      meta_description: row.meta_description ?? "",
      main_keyword: row.main_keyword ?? "",
      secondary_keywords: row.secondary_keywords ?? [],
      outline: row.outline ?? [],
      category: row.category ?? "Leader",
      content: row.content,
      word_count: row.word_count,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onDelete(id: string) {
    if (!confirm("Hapus artikel ini?")) return;
    try {
      await deleteFn({ data: { id } });
      if (editingId === id) { setEditingId(null); setDraft(null); }
      toast.success("Artikel dihapus.");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const liveWordCount = draft ? draft.content.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />

      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link to="/"><Button variant="ghost" size="icon" className="size-8 shrink-0"><ArrowLeft className="size-4" /></Button></Link>
            <div className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-primary-foreground sm:flex" style={{ background: "var(--gradient-brand)" }}>
              <FileText className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">Artikel SEO</h1>
              <p className="truncate text-xs text-muted-foreground">{items.length} artikel tersimpan di project ini</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ProjectSwitcher />
            <Link to="/history"><Button variant="outline" size="sm" className="hidden h-8 sm:inline-flex">History</Button></Link>
          </div>
        </div>
      </header>


      <main className="max-w-6xl mx-auto px-6 py-8 grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="p-6 space-y-4 h-fit lg:sticky lg:top-24">
          <div className="space-y-1">
            <h2 className="font-semibold flex items-center gap-2"><Sparkles className="size-4 text-primary" />Brief Artikel</h2>
            <p className="text-xs text-muted-foreground">AI membaca knowledge base project untuk persona & sudut pandang penulis.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="topic">Ide / Topik</Label>
            <Textarea id="topic" rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Contoh: Kebangkitan industri kreatif Indonesia menuju panggung global" maxLength={2000} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mk">Main Keyword</Label>
            <Input id="mk" value={mainKeyword} onChange={(e) => setMainKeyword(e.target.value)} placeholder="industri kreatif indonesia" maxLength={200} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sk">Secondary Keywords</Label>
            <Textarea id="sk" rows={2} value={secondary} onChange={(e) => setSecondary(e.target.value)} placeholder="pisahkan dengan koma" maxLength={2000} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mentor">Mentor</SelectItem>
                  <SelectItem value="Investor">Investor</SelectItem>
                  <SelectItem value="Leader">Leader</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Kata</Label>
              <Select value={wordTarget} onValueChange={setWordTarget}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="600">± 600</SelectItem>
                  <SelectItem value="900">± 900</SelectItem>
                  <SelectItem value="1200">± 1200</SelectItem>
                  <SelectItem value="1800">± 1800</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Catatan tambahan (opsional)</Label>
            <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Angle khusus, data yang harus disebut, dsb." maxLength={5000} />
          </div>

          <Button className="w-full" onClick={onGenerate} disabled={loading}>
            {loading ? <><Loader2 className="size-4 mr-2 animate-spin" />Menulis artikel…</> : <><Sparkles className="size-4 mr-2" />Generate Artikel</>}
          </Button>
        </Card>

        <div className="space-y-6 min-w-1">
          {draft && (
            <Card className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{draft.category}</Badge>
                  <Badge variant="outline">{liveWordCount} kata</Badge>
                  {editingId && <Badge variant="outline">Mode edit</Badge>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(draft.content); toast.success("Artikel disalin."); }}>
                    <Copy className="size-3.5 mr-1.5" />Salin
                  </Button>
                  <Button size="sm" onClick={onSave} disabled={saving}>
                    {saving ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Save className="size-3.5 mr-1.5" />}
                    {editingId ? "Update" : "Simpan"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setDraft(null); setEditingId(null); }}><X className="size-4" /></Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Judul (H1)</Label>
                  <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Meta Description ({draft.meta_description.length} karakter)</Label>
                <Textarea rows={2} value={draft.meta_description} onChange={(e) => setDraft({ ...draft, meta_description: e.target.value })} />
              </div>

              {draft.secondary_keywords?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {draft.main_keyword && <Badge>{draft.main_keyword}</Badge>}
                  {draft.secondary_keywords.map((k, i) => <Badge key={i} variant="outline" className="text-[11px]">{k}</Badge>)}
                </div>
              )}

              <div className="space-y-2">
                <Label>Isi Artikel (Markdown)</Label>
                <Textarea rows={18} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} className="font-mono text-xs leading-6" />
              </div>

              <div className="border-t pt-5">
                <p className="text-xs font-medium text-muted-foreground mb-3">Preview</p>
                <ArticlePreview markdown={draft.content} />
              </div>
            </Card>
          )}

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Artikel Tersimpan</h2>
            {listLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Memuat…</div>
            ) : items.length === 0 ? (
              <Card className="p-6 text-sm text-muted-foreground">Belum ada artikel. Buat artikel pertama dari panel brief.</Card>
            ) : (
              items.map((row) => (
                <Card key={row.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-1 space-y-1">
                    <p className="font-medium leading-snug">{row.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{row.meta_description}</p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {row.category && <Badge variant="secondary" className="text-[10px]">{row.category}</Badge>}
                      {row.main_keyword && <Badge variant="outline" className="text-[10px]">{row.main_keyword}</Badge>}
                      <span className="text-[10px] text-muted-foreground">{row.word_count} kata · {new Date(row.created_at).toLocaleDateString("id-ID")}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => loadForEdit(row)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(row.id)}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
