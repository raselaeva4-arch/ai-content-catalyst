import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  Copy,
  Code2,

  Pencil,
  X,
  Import,
  FileClock,
  Mic2,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  listArticleImportSources,
  saveArticle,
  updateArticle,
  deleteArticle,
} from "@/lib/articles.functions";
import { useActiveProject } from "@/hooks/use-active-project";
import { listKb } from "@/lib/kb.functions";
import { KnowledgeBaseList, type KnowledgeBaseItem } from "@/components/knowledge-base-list";
import { HtmlExportDialog } from "@/components/html-export-dialog";
import { RichArticleEditor, copyRichTextFromHtml, markdownToRichHtml } from "@/components/rich-article-editor";


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
  notes: string | null;
  knowledge_base_ids: string[];
  knowledge_base_sources: { id: string; title: string; type: string; source_name?: string | null; source_path?: string | null }[];
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
  knowledge_base_ids?: string[];
  knowledge_base_sources?: { id: string; title: string; type: string; source_name?: string | null; source_path?: string | null }[];
};

type ImportHistoryItem = {
  id: string;
  title: string;
  summary: string | null;
  main_keywords: any[];
  secondary_keywords: any[];
  article_titles: any[];
  notes: string | null;
  extracted: Record<string, any>;
  created_at: string;
};

type ImportTranscriptItem = {
  id: string;
  title: string;
  transcript: string;
  notes: string | null;
  platform: string | null;
  source_type: string;
  created_at: string;
};

type ImportMode = "topic" | "main" | "secondary" | "title";

function ArticlesPage() {
  const { projectId, mounted } = useActiveProject();
  const genFn = useServerFn(generateArticle);
  const listFn = useServerFn(listArticles);
  const importFn = useServerFn(listArticleImportSources);
  const listKbFn = useServerFn(listKb);
  const saveFn = useServerFn(saveArticle);
  const updateFn = useServerFn(updateArticle);
  const deleteFn = useServerFn(deleteArticle);

  const [topic, setTopic] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [mainKeyword, setMainKeyword] = useState("");
  const [secondary, setSecondary] = useState("");
  const [category, setCategory] = useState<"Mentor" | "Investor" | "Leader">("Leader");

  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("topic");
  const [importTab, setImportTab] = useState<"history" | "transcript">("history");
  const [importLoading, setImportLoading] = useState(false);
  const [historySources, setHistorySources] = useState<ImportHistoryItem[]>([]);
  const [transcriptSources, setTranscriptSources] = useState<ImportTranscriptItem[]>([]);
  const [wordTarget, setWordTarget] = useState("900");
  const [notes, setNotes] = useState("");
  const [knowledgeBase, setKnowledgeBase] = useState<{ id: string; type: string; title: string; content: string; source_name?: string | null; source_path?: string | null }[]>([]);
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>([]);
  const [kbLoading, setKbLoading] = useState(true);
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
    setHistorySources([]);
    setTranscriptSources([]);
    setImportOpen(false);
    setKbLoading(true);
    if (!mounted) return;
    Promise.all([
      refresh(),
      listKbFn({ data: { project_id: projectId } }).then((res) => {
        const rows = (res.items ?? []) as any[];
        setKnowledgeBase(rows);
        const stored = typeof window !== "undefined" ? window.localStorage.getItem(`kb-ai-selection:${projectId}`) : null;
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              setSelectedKnowledgeIds(parsed.filter((id) => rows.some((row) => row.id === id)));
            } else {
              setSelectedKnowledgeIds(rows.map((x) => x.id));
            }
          } catch {
            setSelectedKnowledgeIds(rows.map((x) => x.id));
          }
        } else {
          setSelectedKnowledgeIds(rows.map((x) => x.id));
        }
      }),
    ])
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setKbLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, projectId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`kb-ai-selection:${projectId}`, JSON.stringify(selectedKnowledgeIds));
    }
  }, [projectId, selectedKnowledgeIds]);

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
          title: articleTitle.trim(),
          main_keyword: mainKeyword.trim(),
          secondary_keywords: secondary.trim(),
          category,
          word_target: Number(wordTarget) || 900,
          extra_notes: notes.trim(),
          knowledge_base_ids: selectedKnowledgeIds,
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
        notes: notes.trim() || null,
        knowledge_base_ids: draft.knowledge_base_ids ?? selectedKnowledgeIds,
        knowledge_base_sources: draft.knowledge_base_sources ?? knowledgeBase
          .filter((kb) => (draft.knowledge_base_ids ?? selectedKnowledgeIds).includes(kb.id))
          .map((kb) => ({ id: kb.id, title: kb.title, type: kb.type, source_name: kb.source_name ?? null, source_path: kb.source_path ?? null })),
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
    setArticleTitle(row.title ?? "");
    setMainKeyword(row.main_keyword ?? "");
    setSecondary((row.secondary_keywords ?? []).join(", "));
    setNotes(row.notes ?? "");
    const savedKbIds = Array.isArray(row.knowledge_base_ids) ? row.knowledge_base_ids : [];
    if (savedKbIds.length) setSelectedKnowledgeIds(savedKbIds);
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
      knowledge_base_ids: savedKbIds,
      knowledge_base_sources: Array.isArray(row.knowledge_base_sources) ? row.knowledge_base_sources : [],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function openImport(mode: ImportMode, tab: "history" | "transcript" = "history") {
    setImportMode(mode);
    setImportTab(tab);
    setImportOpen(true);
    if (historySources.length || transcriptSources.length) return;

    setImportLoading(true);
    try {
      const res = await importFn({ data: { project_id: projectId } });
      setHistorySources((res.history ?? []) as ImportHistoryItem[]);
      setTranscriptSources((res.transcripts ?? []) as ImportTranscriptItem[]);
    } catch (e) {
      toast.error((e as Error).message);
      setImportOpen(false);
    } finally {
      setImportLoading(false);
    }
  }

  function historyMainKeywords(item: ImportHistoryItem) {
    return (item.main_keywords ?? [])
      .map((k: any) => typeof k === "string" ? k : k?.keyword)
      .filter(Boolean)
      .map(String);
  }

  function historySecondaryKeywords(item: ImportHistoryItem) {
    return (item.secondary_keywords ?? [])
      .map((k: any) => typeof k === "string" ? k : k?.keyword)
      .filter(Boolean)
      .map(String);
  }

  function historyTopic(item: ImportHistoryItem) {
    const note = item.notes?.trim();
    if (note) return note;
    const keyTopics = Array.isArray(item.extracted?.key_topics) ? item.extracted.key_topics.filter(Boolean).join(", ") : "";
    return (item.summary?.trim() || keyTopics || item.title || "").slice(0, 2000);
  }

  function applyHistoryImport(item: ImportHistoryItem, mode: ImportMode, value?: string) {
    if (mode === "topic") setTopic(historyTopic(item));
    if (mode === "main") setMainKeyword(value || historyMainKeywords(item)[0] || "");
    if (mode === "secondary") setSecondary(historySecondaryKeywords(item).join(", "));
    if (mode === "title") setArticleTitle(value || String(item.article_titles?.[0] ?? ""));
    setImportOpen(false);
    toast.success("Data history diimpor ke form artikel.");
  }

  function applyTranscriptImport(item: ImportTranscriptItem) {
    const value = (item.transcript?.trim() || item.notes?.trim() || item.title || "").slice(0, 2000);
    setTopic(value);
    setImportOpen(false);
    toast.success("Transcript diimpor sebagai ide / topik.");
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
                        <div className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-primary-foreground sm:flex" style={{ background: "var(--gradient-brand)" }}>
              <FileText className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">Artikel SEO</h1>
              <p className="truncate text-xs text-muted-foreground">{items.length} artikel tersimpan di project ini</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="topic">Ide / Topik</Label>
              <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => openImport("topic")}>
                <Import className="size-3.5 mr-1.5" />Impor
              </Button>
            </div>
            <Textarea id="topic" rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Contoh: Kebangkitan industri kreatif Indonesia menuju panggung global" maxLength={2000} />
            <p className="text-[10px] text-muted-foreground">Bisa mengambil Catatan dari Keyword Explorer, History, atau isi transcript.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="article-title">Judul Artikel</Label>
              <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => openImport("title")}>
                <Import className="size-3.5 mr-1.5" />Impor dari History
              </Button>
            </div>
            <Input id="article-title" value={articleTitle} onChange={(e) => setArticleTitle(e.target.value)} placeholder="Opsional — AI akan memakai judul ini persis" maxLength={300} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="mk">Main Keyword</Label>
              <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => openImport("main")}>
                <Import className="size-3.5 mr-1.5" />Impor dari History
              </Button>
            </div>
            <Input id="mk" value={mainKeyword} onChange={(e) => setMainKeyword(e.target.value)} placeholder="industri kreatif indonesia" maxLength={200} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="sk">Secondary Keywords</Label>
              <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => openImport("secondary")}>
                <Import className="size-3.5 mr-1.5" />Impor dari History
              </Button>
            </div>
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
            <div className="flex items-center justify-between gap-2">
              <Label className="flex items-center gap-1.5"><BookOpen className="size-3.5" />Knowledge yang dipakai AI</Label>
              <span className="text-[10px] text-muted-foreground">{selectedKnowledgeIds.length}/{knowledgeBase.length} dipilih</span>
            </div>
            {kbLoading ? (
              <div className="rounded-md border p-3 text-xs text-muted-foreground"><Loader2 className="inline size-3 mr-1 animate-spin" />Memuat Knowledge Base…</div>
            ) : knowledgeBase.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Belum ada Knowledge Base. Tambahkan file/knowledge di Dashboard sebelum generate artikel.
              </div>
            ) : (
              <KnowledgeBaseList
                projectId={projectId}
                items={knowledgeBase as KnowledgeBaseItem[]}
                selectedIds={selectedKnowledgeIds}
                onSelectionChange={setSelectedKnowledgeIds}
                onUpdated={(updated) => setKnowledgeBase((rows) => rows.map((row) => row.id === updated.id ? { ...row, ...updated } : row))}
                emptyText="Belum ada Knowledge Base. Tambahkan file/knowledge di Dashboard sebelum generate artikel."
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Catatan tambahan (opsional)</Label>
            <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Angle khusus, data yang harus disebut, dsb." maxLength={5000} />
          </div>

          <Button className="w-full" onClick={onGenerate} disabled={loading || kbLoading || knowledgeBase.length === 0 || selectedKnowledgeIds.length === 0}>
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await copyRichTextFromHtml(markdownToRichHtml(draft.content));
                        toast.success("Artikel disalin dengan format rich text.");
                      } catch {
                        await navigator.clipboard.writeText(draft.content);
                        toast.success("Artikel disalin sebagai teks.");
                      }
                    }}
                  >
                    <Copy className="size-3.5 mr-1.5" />Salin Rich Text
                  </Button>
                  <HtmlExportDialog article={draft} />
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

              {draft.knowledge_base_sources && draft.knowledge_base_sources.length > 0 && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold"><BookOpen className="size-3.5" />Sumber Knowledge yang dipakai AI</div>
                  <div className="flex flex-wrap gap-1.5">
                    {draft.knowledge_base_sources.map((source) => (
                      <Badge key={source.id} variant="outline" className="text-[10px]">
                        {source.title}{source.source_name ? ` · ${source.source_name}` : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {draft.secondary_keywords?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {draft.main_keyword && <Badge>{draft.main_keyword}</Badge>}
                  {draft.secondary_keywords.map((k, i) => <Badge key={i} variant="outline" className="text-[11px]">{k}</Badge>)}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Isi Artikel — Rich Text</Label>
                  <span className="text-[10px] text-muted-foreground">Format visual akan ikut saat Copy ke Google Docs / Word</span>
                </div>
                <RichArticleEditor
                  value={draft.content}
                  onChange={(content) => setDraft({ ...draft, content })}
                  minHeight={520}
                />
                <p className="text-[11px] text-muted-foreground">
                  Gunakan toolbar seperti Google Docs untuk heading, bold, italic, underline, list, quote, link, alignment, undo/redo, dan hapus format.
                  Paste langsung dari Google Docs juga akan dipertahankan sebagai rich text.
                </p>
              </div>

              <div className="border-t pt-5">
                <p className="text-xs font-medium text-muted-foreground mb-3">Preview Artikel</p>
                <article
                  className="prose prose-sm max-w-none leading-7 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-3 [&_ul]:my-3 [&_ol]:my-3 [&_li]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:italic"
                  dangerouslySetInnerHTML={{ __html: markdownToRichHtml(draft.content) }}
                />
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
                    <HtmlExportDialog
                      article={row}
                      trigger={
                        <Button variant="ghost" size="icon" title="Export HTML">
                          <Code2 className="size-4" />
                        </Button>
                      }
                    />
                    <Button variant="ghost" size="icon" onClick={() => loadForEdit(row)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(row.id)}><Trash2 className="size-4 text-destructive" /></Button>

                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {importMode === "topic" ? "Impor Ide / Topik" :
               importMode === "main" ? "Impor Main Keyword" :
               importMode === "secondary" ? "Impor Secondary Keyword" :
               "Impor Judul Artikel"}
            </DialogTitle>
            <DialogDescription>
              Ambil data yang sudah tersimpan di History atau Transcript untuk mengisi form Artikel SEO.
            </DialogDescription>
          </DialogHeader>

          {importMode === "topic" && (
            <div className="flex gap-2 border-b pb-3">
              <Button size="sm" variant={importTab === "history" ? "default" : "outline"} onClick={() => setImportTab("history")}>
                <FileClock className="size-3.5 mr-1.5" />History / Catatan
              </Button>
              <Button size="sm" variant={importTab === "transcript" ? "default" : "outline"} onClick={() => setImportTab("transcript")}>
                <Mic2 className="size-3.5 mr-1.5" />Transcript
              </Button>
            </div>
          )}

          <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
            {importLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="size-5 mx-auto mb-2 animate-spin" />Memuat sumber import…</div>
            ) : importMode === "topic" && importTab === "transcript" ? (
              transcriptSources.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Belum ada transcript di project ini.</p>
              ) : transcriptSources.map((item) => (
                <Card key={item.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{item.notes || item.transcript || "Transcript kosong."}</p>
                      <p className="text-[10px] text-muted-foreground mt-2">{item.platform || item.source_type || "Transcript"} · {new Date(item.created_at).toLocaleString("id-ID")}</p>
                    </div>
                    <Button size="sm" onClick={() => applyTranscriptImport(item)}>Pakai</Button>
                  </div>
                </Card>
              ))
            ) : historySources.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Belum ada History tersimpan di project ini.</p>
            ) : historySources.map((item) => {
              const main = historyMainKeywords(item);
              const secondary = historySecondaryKeywords(item);
              const titles = (item.article_titles ?? []).map(String).filter(Boolean);
              return (
                <Card key={item.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(item.created_at).toLocaleString("id-ID")}</p>
                      {importMode === "topic" && <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{item.notes || item.summary || item.title}</p>}
                      {importMode === "main" && <div className="flex flex-wrap gap-1 mt-2">{main.length ? main.map((k) => <Badge key={k} variant="outline">{k}</Badge>) : <span className="text-xs text-muted-foreground">Tidak ada main keyword.</span>}</div>}
                      {importMode === "secondary" && <div className="flex flex-wrap gap-1 mt-2">{secondary.length ? secondary.map((k) => <Badge key={k} variant="secondary">{k}</Badge>) : <span className="text-xs text-muted-foreground">Tidak ada secondary keyword.</span>}</div>}
                      {importMode === "title" && <div className="space-y-1 mt-2">{titles.length ? titles.map((t, i) => <div key={i} className="flex items-center gap-2"><span className="text-xs flex-1">{t}</span><Button size="sm" variant="outline" onClick={() => applyHistoryImport(item, "title", t)}>Pakai</Button></div>) : <span className="text-xs text-muted-foreground">Tidak ada judul artikel.</span>}</div>}
                    </div>
                    {importMode !== "title" && (
                      <Button size="sm" onClick={() => applyHistoryImport(item, importMode)}>Pakai</Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      </main>
    </div>
  );
}
