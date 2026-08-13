Agar tombol navigasi ke halaman `/rework` muncul di dashboard utama kamu, perbarui isi file `src/routes/index.tsx` dengan menambahkan import ikon `RefreshCw` dan tombol tautan menu Rework pada bagian header.

Berikut adalah kode lengkap `src/routes/index.tsx` yang sudah disesuaikan:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useRef, useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast, Toaster } from "sonner";
import { Sparkles, Link2, Upload, BookOpen, Trash2, Plus, Loader2, TrendingUp, Hash, FileText, Lightbulb, Tag, Mic, CheckCircle2, Save, History, Video, Square, RefreshCw } from "lucide-react";
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
import { listKb, saveKb, deleteKb, saveKbFile } from "@/lib/kb.functions";
import { transcribeMedia } from "@/lib/transcribe.functions";
import { transcribeUrl } from "@/lib/transcribe-url.functions";
import { saveHistory } from "@/lib/history.functions";
import { createTranscript } from "@/lib/transcripts.functions";
import { useActiveProject } from "@/hooks/use-active-project";
import { ProjectSwitcher } from "@/components/project-switcher";

export const Route = createFileRoute("/")({
  component: Dashboard,
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
  const { projectId } = useActiveProject();
  const [kb, setKb] = useState<{ id: string; type: string; title: string; content: string }[]>([]);
  const analyze = useServerFn(analyzeContent);
  const trends = useServerFn(getTrends);
  const listKbFn = useServerFn(listKb);
  const saveKbFn = useServerFn(saveKb);
  const deleteKbFn = useServerFn(deleteKb);
  const transcribeFn = useServerFn(transcribeMedia);
  const transcribeUrlFn = useServerFn(transcribeUrl);
  const saveFn = useServerFn(saveHistory);
  const createTranscriptFn = useServerFn(createTranscript);

  useEffect(() => {
    let cancelled = false;
    listKbFn({ data: { project_id: projectId } })
      .then((r) => { if (!cancelled) setKb(r.items as any); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectId, listKbFn]);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [reelUrl, setReelUrl] = useState("");
  const [reelLoading, setReelLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const [recProcessing, setRecProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const [urls, setUrls] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<{ path: string; name: string; mime: string; transcript?: string; editedTranscript?: string; transcribing?: boolean; transcriptId?: string; saving?: boolean }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [trendData, setTrendData] = useState<TrendRow[] | null>(null);
  const [loadingTrends, setLoadingTrends] = useState(false);

  const saveFileTranscript = useCallback(async (path: string) => {
    const target = files.find((f) => f.path === path) ?? null;
    setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, saving: true } : f)));
    try {
      const f = target ?? (await new Promise<typeof files[number] | undefined>((r) => setFiles((p) => { r(p.find((x) => x.path === path)); return p; })));
      if (!f || !f.transcript) throw new Error("Belum ada transkrip");
      const transcriptToSave = f.editedTranscript !== undefined ? f.editedTranscript : f.transcript;
      const res = await createTranscriptFn({
        data: {
          project_id: projectId,
          title: f.name,
          source_type: "file",
          source_path: f.path,
          platform: f.mime.split("/")[0],
          mime: f.mime,
          transcript: transcriptToSave,
        },
      });
      setFiles((prev) => prev.map((x) => (x.path === path ? { ...x, transcriptId: res.item.id, saving: false } : x)));
      toast.success(`"${f.name}" tersimpan ke Transcripts`);
    } catch (e) {
      setFiles((prev) => prev.map((x) => (x.path === path ? { ...x, saving: false } : x)));
      toast.error("Gagal simpan transkrip: " + (e as Error).message);
    }
  }, [files, createTranscriptFn, projectId]);

  const runTranscribe = useCallback(async (path: string, name: string, mime: string) => {
    setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, transcribing: true } : f)));
    try {
      const res = await transcribeFn({ data: { path, name, mime } });
      setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, transcript: res.transcript, editedTranscript: res.transcript, transcribing: false } : f)));
      toast.success(`Transkrip ${name} selesai — silakan edit sebelum simpan.`);
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
      for (const u of uploaded) {
        if (/^(audio|video)\//.test(u.mime)) {
          void runTranscribe(u.path, u.name, u.mime);
        }
      }
    } finally { setUploading(false); }
  }, [runTranscribe]);

  const onReelTranscribe = useCallback(async () => {
    const u = reelUrl.trim();
    if (!u) { toast.error("Paste link TikTok atau Instagram Reels dulu."); return; }
    setReelLoading(true);
    try {
      const res = await transcribeUrlFn({ data: { url: u } });
      setFiles((prev) => [
        ...prev,
        {
          path: `url:${res.sourceUrl}`,
          name: res.name,
          mime: `video/${res.platform}`,
          transcript: res.transcript,
          editedTranscript: res.transcript,
        },
      ]);
      setReelUrl("");
      toast.success(`Transkrip dari ${res.platform} berhasil — silakan edit sebelum simpan.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setReelLoading(false); }
  }, [reelUrl, transcribeUrlFn]);

  const startRecording = useCallback(async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
      const mime = mimeCandidates.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blobMime = mr.mimeType || "audio/webm";
        const blob = new Blob(recChunksRef.current, { type: blobMime });
        recChunksRef.current = [];
        if (blob.size === 0) { toast.error("Rekaman kosong."); return; }
        if (blob.size > 20 * 1024 * 1024) { toast.error("Rekaman terlalu besar (max 20MB)."); return; }
        setRecProcessing(true);
        try {
          const ext = blobMime.includes("mp4") ? "m4a" : blobMime.includes("ogg") ? "ogg" : "webm";
          const name = `recording-${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`;
          const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${name}`;
          const { error } = await supabase.storage.from("uploads").upload(path, blob, { contentType: blobMime });
          if (error) throw new Error(error.message);
          setFiles((prev) => [...prev, { path, name, mime: blobMime, transcribing: true }]);
          toast.success("Rekaman terupload — AI sedang transcribing...");
          const tr = await transcribeFn({ data: { path, name, mime: blobMime } });
          setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, transcript: tr.transcript, editedTranscript: tr.transcript, transcribing: false } : f)));
          try {
            const saved = await createTranscriptFn({
              data: {
                project_id: projectId,
                title: name,
                source_type: "file",
                source_path: path,
                platform: "audio",
                mime: blobMime,
                transcript: tr.transcript,
              },
            });
            setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, transcriptId: saved.item.id } : f)));
            toast.success("Transkrip rekaman tersimpan ke database.");
          } catch (e) {
            toast.warning("Transkrip selesai tapi gagal auto-save: " + (e as Error).message);
          }
        } catch (e) {
          setFiles((prev) => prev.map((f) => (f.path.endsWith(blob.size.toString()) ? { ...f, transcribing: false } : f)));
          toast.error("Gagal: " + (e as Error).message);
        } finally {
          setRecProcessing(false);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecElapsed(0);
      recTimerRef.current = setInterval(() => setRecElapsed((s) => s + 1), 1000);
    } catch (e) {
      toast.error("Tidak bisa akses mikrofon: " + (e as Error).message);
    }
  }, [recording, transcribeFn, createTranscriptFn, projectId]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === "inactive") return;
    mr.stop();
    mediaRecorderRef.current = null;
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    setRecording(false);
  }, []);

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
      const transcriptBlock = files
        .filter((f) => f.transcript)
        .map((f) => `=== TRANSKRIP ${f.name} ===\n${f.editedTranscript ?? f.transcript}`)
        .join("\n\n");
      const mergedNotes = [notes.trim(), transcriptBlock].filter(Boolean).join("\n\n");
      const payloadFiles = files.filter((f) => !f.path.startsWith("url:")).map(({ path, name, mime }) => ({ path, name, mime }));
      const res = await analyze({ data: { project_id: projectId, urls: cleanUrls, files: payloadFiles, notes: mergedNotes } });
      setResult(res.result);
      toast.success("Analisis selesai!");
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
  }, [urls, files, notes, analyze, trends, projectId]);

  const onSave = useCallback(async () => {
    if (!result) return;
    setSaving(true);
    try {
      const cleanUrls = urls.map((u) => u.trim()).filter(Boolean);
      const res = await saveFn({ data: {
        project_id: projectId,
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
  }, [result, urls, files, notes, saveFn, projectId]);

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
            <ProjectSwitcher />
            <Link to="/articles">
              <Button variant="outline" size="sm"><FileText className="size-3.5 mr-1.5" />Artikel SEO</Button>
            </Link>
            <Link to="/transcripts">
              <Button variant="outline" size="sm"><Mic className="size-3.5 mr-1.5" />Transcripts</Button>
            </Link>
            <Link to="/rework">
              <Button variant="outline" size="sm"><RefreshCw className="size-3.5 mr-1.5" />Rework</Button>
            </Link>
            <Link to="/history">
              <Button variant="outline" size="sm"><History className="size-3.5 mr-1.5" />History</Button>
            </Link>
          </div>
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
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="urls"><Link2 className="size-3.5 mr-1.5" />Links</TabsTrigger>
                <TabsTrigger value="reel"><Video className="size-3.5 mr-1.5" />Reel/TikTok</TabsTrigger>
                <TabsTrigger value="record"><Mic className="size-3.5 mr-1.5" />Record</TabsTrigger>
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

              <TabsContent value="reel" className="mt-4 space-y-3">
                <div className="rounded-lg border bg-accent/20 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Video className="size-4 text-primary" />
                    <p className="text-sm font-medium">Extract Transcript dari Video</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Paste link <strong>TikTok</strong> atau <strong>Instagram Reels</strong> publik. AI akan otomatis download videonya & transcribe speech-nya ke teks.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://www.tiktok.com/@user/video/... atau https://www.instagram.com/reel/..."
                    value={reelUrl}
                    onChange={(e) => setReelUrl(e.target.value)}
                    disabled={reelLoading}
                  />
                  <Button onClick={onReelTranscribe} disabled={reelLoading || !reelUrl.trim()}>
                    {reelLoading ? <><Loader2 className="size-4 mr-1.5 animate-spin" />Extracting...</> : <><Mic className="size-4 mr-1.5" />Extract</>}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Hasil transkrip akan masuk ke daftar Files dan otomatis ikut dianalisis. Reel private/login-only tidak didukung.
                </p>
              </TabsContent>

              <TabsContent value="record" className="mt-4 space-y-3">
                <div className="rounded-lg border bg-accent/20 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Mic className="size-4 text-primary" />
                    <p className="text-sm font-medium">Rekam Audio Langsung</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Klik tombol rekam, bicara di mikrofon, lalu stop. Audio akan otomatis di-transcribe oleh AI dan muncul di daftar Files.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-4 rounded-lg border p-6 bg-card">
                  {!recording ? (
                    <Button size="lg" onClick={startRecording} disabled={recProcessing}>
                      {recProcessing ? <><Loader2 className="size-4 mr-2 animate-spin" />Memproses...</> : <><Mic className="size-4 mr-2" />Mulai Rekam</>}
                    </Button>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="relative flex size-3">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                          <span className="relative inline-flex size-3 rounded-full bg-destructive" />
                        </span>
                        <span className="font-mono text-sm tabular-nums">
                          {String(Math.floor(recElapsed / 60)).padStart(2, "0")}:{String(recElapsed % 60).padStart(2, "0")}
                        </span>
                      </div>
                      <Button size="lg" variant="destructive" onClick={stopRecording}>
                        <Square className="size-4 mr-2" />Stop & Transcribe
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Max 20MB (~kira 20 menit). Pastikan browser punya izin mikrofon. Rekaman bisa diedit transkripnya di tab Files sebelum disimpan.
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
                              {f.transcript && !f.transcribing && !f.transcriptId && (
                                <Badge variant="secondary" className="text-[10px] gap-1"><CheckCircle2 className="size-2.5 text-primary" />Transkrip siap</Badge>
                              )}
                              {f.transcriptId && (
                                <Badge variant="default" className="text-[10px] gap-1"><Save className="size-2.5" />Tersimpan</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {f.transcript && !f.transcriptId && (
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={f.saving} onClick={() => saveFileTranscript(f.path)}>
                                  {f.saving ? <Loader2 className="size-3 animate-spin" /> : <><Save className="size-3 mr-1" />Simpan</>}
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="size-7" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                          {f.transcript && (
                            <div className="mt-2 space-y-1">
                              <label className="text-xs text-muted-foreground">Edit transkrip sebelum simpan:</label>
                              <Textarea
                                rows={4}
                                className="text-xs max-h-40"
                                value={f.editedTranscript ?? f.transcript}
                                onChange={(e) => setFiles((prev) => prev.map((x) => (x.path === f.path ? { ...x, editedTranscript: e.target.value } : x)))}
                              />
                            </div>
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

          {result && <ResultsPanel result={result} trends={trendData} loadingTrends={loadingTrends} onSave={onSave} saving={saving} savedId={savedId} />}
        </div>

        {/* Right: Knowledge Base */}
        <KnowledgeBasePanel
          projectId={projectId}
          items={kb}
          onSave={async (payload) => {
            await saveKbFn({ data: { project_id: projectId, ...payload } });
            const r = await listKbFn({ data: { project_id: projectId } });
            setKb(r.items as any);
          }}
          onSaveFile={async (payload) => {
            await saveKbFile({ data: { project_id: projectId, ...payload } });
            const r = await listKbFn({ data: { project_id: projectId } });
            setKb(r.items as any);
          }}
          onDelete={async (id) => {
            await deleteKbFn({ data: { id } });
            const r = await listKbFn({ data: { project_id: projectId } });
            setKb(r.items as any);
          }}
        />
      </main>
    </div>
  );
}

function ResultsPanel({ result, trends, loadingTrends, onSave, saving, savedId }: { result: AnalysisResult; trends: TrendRow[] | null; loadingTrends: boolean; onSave: () => Promise<void>; saving: boolean; savedId: string | null }) {
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
        <div className="flex items-center gap-2 shrink-0">
          <Badge style={{ background: "var(--gradient-brand)", color: "white" }}>{result.category}</Badge>
          <Button size="sm" onClick={onSave} disabled={saving || !!savedId} variant={savedId ? "secondary" : "default"}>
            {saving ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" />Menyimpan...</> : savedId ? <><CheckCircle2 className="size-3.5 mr-1.5" />Tersimpan</> : <><Save className="size-3.5 mr-1.5" />Simpan</>}
          </Button>
        </div>
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

function KnowledgeBasePanel({ projectId, items, onSave, onSaveFile, onDelete }: {
  projectId: string;
  items: { id: string; type: string; title: string; content: string }[];
  onSave: (p: { type: "playbook" | "persona" | "knowledge"; title: string; content: string }) => Promise<void>;
  onSaveFile: (p: { path: string; name: string; mime: string; type: "playbook" | "persona" | "knowledge" }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<"playbook" | "persona" | "knowledge">("playbook");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingKb, setUploadingKb] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const onFilesPicked = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setUploadingKb(true);
    try {
      for (const f of Array.from(fileList)) {
        if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name} > 20MB`); continue; }
        const path = `kb/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name}`;
        const { error } = await supabase.storage.from("uploads").upload(path, f);
        if (error) { toast.error(`Upload ${f.name} gagal: ${error.message}`); continue; }
        toast.info(`Mengekstrak "${f.name}" dengan AI...`);
        try {
          await onSaveFile({ path, name: f.name, mime: f.type || "application/octet-stream", type });
          toast.success(`"${f.name}" masuk Knowledge Base`);
        } catch (e) {
          toast.error(`Ekstraksi ${f.name} gagal: ${(e as Error).message}`);
        }
      }
    } finally {
      setUploadingKb(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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

          <div className="pt-2 border-t mt-2">
            <label className="text-xs text-muted-foreground block mb-1.5">Atau upload file (PDF, DOC, PPT, Image)</label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,image/*"
              className="hidden"
              onChange={(e) => onFilesPicked(e.target.files)}
            />
            <Button size="sm" variant="outline" className="w-full" disabled={uploadingKb} onClick={() => fileInputRef.current?.click()}>
              {uploadingKb ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" />Mengekstrak...</> : <><Upload className="size-3.5 mr-1.5" />Upload & AI Extract</>}
            </Button>
            <p className="text-[10px] text-muted-foreground mt-1">AI akan mengekstrak isi & menyimpan sebagai "{type}".</p>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {items.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground text-center py-6">
            Belum ada knowledge. Tambah playbook, persona, atau upload file (PDF/DOC/PPT/Image) — AI akan mengekstrak isinya otomatis.
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

```
