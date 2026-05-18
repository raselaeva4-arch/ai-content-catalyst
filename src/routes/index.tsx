import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast, Toaster } from "sonner";
import { Sparkles, Link2, Upload, BookOpen, Trash2, Plus, Loader2, TrendingUp, Hash, FileText, Lightbulb, Tag, Mic, CheckCircle2, Save, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { analyzeContent } from "@/lib/analysis.functions";
import { getTrends } from "@/lib/trends.functions";
import { listKb, saveKb, deleteKb } from "@/lib/kb.functions";
import { transcribeMedia } from "@/lib/transcribe.functions";
import { saveHistory } from "@/lib/history.functions";

export const Route = createFileRoute("/")({
  component: Dashboard,
  loader: async () => {
    const kb = await listKb();
    return { kb: kb.items };
  },
  head: () => ({
    meta: [
      { title: "KeywordForge — AI Keyword & Title Generator" },
      { name: "description", content: "Tools otomasi AI: ekstrak konten dari link & file lalu generate keyword potensial, judul artikel, dan kategori." },
    ],
  }),
});

type AnalysisResult = {
  summary: string;
  category: string;
  main_keywords: { keyword: string; rationale: string; intent: string }[];
  secondary_keywords: string[];
  article_titles: string[];
  extracted: { captions: string[]; hashtags: string[]; comments_themes: string[]; key_topics: string[] };
};

type TrendRow = { keyword: string; global: number | null; indonesia: number | null };

function Dashboard() {
  const router = useRouter();
  const { kb } = Route.useLoaderData();
  const analyze = useServerFn(analyzeContent);
  const trends = useServerFn(getTrends);
  const saveKbFn = useServerFn(saveKb);
  const deleteKbFn = useServerFn(deleteKb);
  const transcribeFn = useServerFn(transcribeMedia);
  const saveFn = useServerFn(saveHistory);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const [urls, setUrls] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<{ path: string; name: string; mime: string; transcript?: string; transcribing?: boolean }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [trendData, setTrendData] = useState<TrendRow[] | null>(null);
  const [loadingTrends, setLoadingTrends] = useState(false);

  const runTranscribe = useCallback(async (path: string, name: string, mime: string) => {
    setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, transcribing: true } : f)));
    try {
      const res = await transcribeFn({ data: { path, name, mime } });
      setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, transcript: res.transcript, transcribing: false } : f)));
      toast.success(`Transkrip ${name} selesai`);
    } catch (e) {
      setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, transcribing: false } : f)));
      toast.error(`Transkrip ${name} gagal: ${(e as Error).message}`);
    }
  }, [transcribeFn]);

  const onUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setUploading(true);
    try {
      const uploaded: typeof files = [];
      for (const f of Array.from(fileList)) {
        if (f.size > 20 * 1024 * 1024) {
          toast.error(`${f.name} terlalu besar (max 20MB)`);
          continue;
        }
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name}`;
        const { error } = await supabase.storage.from("uploads").upload(path, f);
        if (error) { toast.error(`Gagal upload ${f.name}: ${error.message}`); continue; }
        const mime = f.type || "application/octet-stream";
        uploaded.push({ path, name: f.name, mime });
      }
      setFiles((prev) => [...prev, ...uploaded]);
      if (uploaded.length) toast.success(`${uploaded.length} file berhasil diupload`);
      // Auto-transcribe audio/video
      for (const u of uploaded) {
        if (/^(audio|video)\//.test(u.mime)) {
          void runTranscribe(u.path, u.name, u.mime);
        }
      }
    } finally { setUploading(false); }
  }, [runTranscribe]);

  const onAnalyze = useCallback(async () => {
    const cleanUrls = urls.map((u) => u.trim()).filter(Boolean);
    if (!cleanUrls.length && !files.length && !notes.trim()) {
      toast.error("Tambahkan minimal 1 URL, file, atau catatan.");
      return;
    }
    if (files.some((f) => f.transcribing)) {
      toast.error("Tunggu sampai transkrip video/audio selesai.");
      return;
    }
    setAnalyzing(true); setResult(null); setTrendData(null); setSavedId(null);
    try {
      // Inject transcripts into notes so AI sees them
      const transcriptBlock = files
        .filter((f) => f.transcript)
        .map((f) => `=== TRANSKRIP ${f.name} ===\n${f.transcript}`)
        .join("\n\n");
      const mergedNotes = [notes.trim(), transcriptBlock].filter(Boolean).join("\n\n");
      const payloadFiles = files.map(({ path, name, mime }) => ({ path, name, mime }));
      const res = await analyze({ data: { urls: cleanUrls, files: payloadFiles, notes: mergedNotes } });
      setResult(res.result);
      toast.success("Analisis selesai!");
      // Auto-fetch trends for main keywords
      setLoadingTrends(true);
      try {
        const t = await trends({ data: { keywords: res.result.main_keywords.map((k: any) => k.keyword) } });
        setTrendData(t.trends);
      } catch (e) {
        toast.warning("Google Trends tidak tersedia saat ini.");
      } finally { setLoadingTrends(false); }
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setAnalyzing(false); }
  }, [urls, files, notes, analyze, trends]);

  const onSave = useCallback(async () => {
    if (!result) return;
    setSaving(true);
    try {
      const cleanUrls = urls.map((u) => u.trim()).filter(Boolean);
      const res = await saveFn({ data: {
        title: result.article_titles[0] ?? result.summary.slice(0, 80) ?? "Untitled",
        category: result.category,
        summary: result.summary,
        main_keywords: result.main_keywords,
        secondary_keywords: result.secondary_keywords,
        article_titles: result.article_titles,
        extracted: result.extracted,
        notes: notes || null,
        source_inputs: { urls: cleanUrls, files: files.map((f) => f.name) },
      } });
      setSavedId(res.item.id);
      toast.success("Tersimpan ke History");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  }, [result, urls, files, notes, saveFn]);

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />

      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg flex items-center justify-center text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
              <Sparkles className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">KeywordForge</h1>
              <p className="text-xs text-muted-foreground">AI Keyword & Content Strategy</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/history">
              <Button variant="outline" size="sm"><History className="size-3.5 mr-1.5" />History</Button>
            </Link>
            <Badge variant="secondary" className="font-mono text-xs">v0.1 MVP</Badge>
          </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid lg:grid-cols-[1fr_360px] gap-6">
        {/* Left: Input + Results */}
        <div className="space-y-6 min-w-0">
          <Card className="p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="size-4 text-primary" />
              <h2 className="font-semibold">Sumber Konten</h2>
            </div>

            <Tabs defaultValue="urls">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="urls"><Link2 className="size-3.5 mr-1.5" />Links</TabsTrigger>
                <TabsTrigger value="files"><Upload className="size-3.5 mr-1.5" />Files</TabsTrigger>
                <TabsTrigger value="notes"><FileText className="size-3.5 mr-1.5" />Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="urls" className="space-y-2 mt-4">
                {urls.map((u, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="https://instagram.com/p/..., https://tiktok.com/..., atau URL website"
                      value={u}
                      onChange={(e) => setUrls((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
                    />
                    {urls.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => setUrls((p) => p.filter((_, j) => j !== i))}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setUrls((p) => [...p, ""])}>
                  <Plus className="size-3.5 mr-1.5" />Tambah Link
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Tip: IG/TikTok mungkin terbatas karena anti-scraping. Untuk hasil terbaik, paste caption manual di tab Notes.
                </p>
              </TabsContent>

              <TabsContent value="files" className="mt-4 space-y-3">
                <label className="block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-accent/30 transition-colors">
                  <Upload className="size-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Klik untuk upload file</p>
                  <p className="text-xs text-muted-foreground mt-1">Image, PDF, Audio, Video, DOCX, MD, TXT, HTML (max 20MB)</p>
                  <p className="text-[11px] text-primary mt-1">✨ Video & audio otomatis di-transcribe oleh AI</p>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => onUpload(e.target.files)}
                  />
                </label>
                {files.length > 0 && (
                  <div className="space-y-1.5">
                    {files.map((f, i) => {
                      const isMedia = /^(audio|video)\//.test(f.mime);
                      return (
                        <div key={i} className="bg-muted/50 rounded-md px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {isMedia && <Mic className="size-3.5 shrink-0 text-primary" />}
                              <span className="truncate">{f.name}</span>
                              {f.transcribing && (
                                <Badge variant="secondary" className="text-[10px] gap-1"><Loader2 className="size-2.5 animate-spin" />Transcribing</Badge>
                              )}
                              {f.transcript && !f.transcribing && (
                                <Badge variant="secondary" className="text-[10px] gap-1"><CheckCircle2 className="size-2.5 text-primary" />Transkrip siap</Badge>
                              )}
                            </div>
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                          {f.transcript && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Lihat transkrip ({f.transcript.length} chars)</summary>
                              <p className="text-xs mt-1.5 whitespace-pre-wrap text-muted-foreground max-h-40 overflow-y-auto">{f.transcript}</p>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                <Textarea
                  placeholder="Paste caption, transkrip, atau catatan tambahan di sini..."
                  rows={6}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </TabsContent>
            </Tabs>

            <Button className="w-full mt-5" size="lg" onClick={onAnalyze} disabled={analyzing || uploading}>
              {analyzing ? <><Loader2 className="size-4 mr-2 animate-spin" />Menganalisis...</> : <><Sparkles className="size-4 mr-2" />Analyze dengan AI</>}
            </Button>
          </Card>

          {result && <ResultsPanel result={result} trends={trendData} loadingTrends={loadingTrends} />}
        </div>

        {/* Right: Knowledge Base */}
        <KnowledgeBasePanel
          items={kb}
          onSave={async (payload) => {
            await saveKbFn({ data: payload });
            router.invalidate();
          }}
          onDelete={async (id) => {
            await deleteKbFn({ data: { id } });
            router.invalidate();
          }}
        />
      </main>
    </div>
  );
}

function ResultsPanel({ result, trends, loadingTrends }: { result: AnalysisResult; trends: TrendRow[] | null; loadingTrends: boolean }) {
  const trendFor = (kw: string) => trends?.find((t) => t.keyword === kw);
  return (
    <Card className="p-6 shadow-[var(--shadow-elevated)] space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Tag className="size-4 text-primary" />
            <h2 className="font-semibold">Rekomendasi AI</h2>
          </div>
          <p className="text-sm text-muted-foreground">{result.summary}</p>
        </div>
        <Badge style={{ background: "var(--gradient-brand)", color: "white" }}>{result.category}</Badge>
      </div>

      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="size-4" />Main Keywords</h3>
        <div className="space-y-2">
          {result.main_keywords.map((k, i) => {
            const t = trendFor(k.keyword);
            return (
              <div key={i} className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{k.keyword}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{k.rationale}</div>
                  </div>
                  <Badge variant="outline" className="text-xs">{k.intent}</Badge>
                </div>
                <div className="flex gap-3 mt-2.5 text-xs">
                  <TrendStat label="Global" value={loadingTrends ? null : t?.global ?? null} />
                  <TrendStat label="Indonesia" value={loadingTrends ? null : t?.indonesia ?? null} />
                  {loadingTrends && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Hash className="size-4" />Secondary Keywords</h3>
        <div className="flex flex-wrap gap-1.5">
          {result.secondary_keywords.map((k, i) => (
            <Badge key={i} variant="secondary" className="font-normal">{k}</Badge>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><FileText className="size-4" />Judul Artikel</h3>
        <ul className="space-y-1.5">
          {result.article_titles.map((t, i) => (
            <li key={i} className="text-sm flex gap-2.5 items-start">
              <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      {(result.extracted.hashtags.length > 0 || result.extracted.key_topics.length > 0) && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Konten yang diekstrak</summary>
          <div className="mt-3 space-y-2 text-xs text-muted-foreground">
            {result.extracted.hashtags.length > 0 && <div><b>Hashtags:</b> {result.extracted.hashtags.join(" ")}</div>}
            {result.extracted.key_topics.length > 0 && <div><b>Topics:</b> {result.extracted.key_topics.join(", ")}</div>}
            {result.extracted.comments_themes.length > 0 && <div><b>Comment themes:</b> {result.extracted.comments_themes.join(", ")}</div>}
          </div>
        </details>
      )}
    </Card>
  );
}

function TrendStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}:</span>
      {value === null ? <span className="text-muted-foreground">—</span> : (
        <span className="font-medium tabular-nums">{value}<span className="text-muted-foreground font-normal">/100</span></span>
      )}
    </div>
  );
}

function KnowledgeBasePanel({ items, onSave, onDelete }: {
  items: { id: string; type: string; title: string; content: string }[];
  onSave: (p: { type: "playbook" | "persona" | "knowledge"; title: string; content: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<"playbook" | "persona" | "knowledge">("playbook");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || !content.trim()) { toast.error("Title & content wajib diisi"); return; }
    setSaving(true);
    try {
      await onSave({ type, title, content });
      toast.success("Tersimpan");
      setTitle(""); setContent(""); setAdding(false);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Card className="p-5 h-fit lg:sticky lg:top-24 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-primary" />
          <h2 className="font-semibold">Knowledge Base</h2>
        </div>
        {!adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-3.5 mr-1" />Add
          </Button>
        )}
      </div>

      {adding && (
        <div className="space-y-2 mb-4 p-3 rounded-lg bg-muted/50">
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="playbook">Playbook</SelectItem>
              <SelectItem value="persona">User Persona</SelectItem>
              <SelectItem value="knowledge">Knowledge</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Content..." rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={saving}>{saving ? "..." : "Save"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {items.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground text-center py-6">
            Belum ada knowledge. Tambah playbook atau user persona agar rekomendasi AI lebih sesuai brand kamu.
          </p>
        )}
        {items.map((it) => (
          <div key={it.id} className="group p-2.5 rounded-md hover:bg-accent/40 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{it.type}</Badge>
                  <span className="text-sm font-medium truncate">{it.title}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{it.content}</p>
              </div>
              <Button variant="ghost" size="icon" className="size-7 opacity-0 group-hover:opacity-100" onClick={() => onDelete(it.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
