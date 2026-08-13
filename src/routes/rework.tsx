import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Upload, FileText, CheckCircle, ListChecks, RefreshCw, ArrowLeft, Loader2, Trash2, Save, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster, toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProject } from "@/hooks/use-active-project";
import { extractArticleFile, reviewRevisionNotes, runRework, saveRework } from "@/lib/rework.functions";

export const Route = createFileRoute("/rework")({
  component: ReworkPage,
  head: () => ({
    meta: [
      { title: "AI Article Rework — KeywordForge" },
      { name: "description", content: "Upload dokumen dan lakukan rework artikel dengan AI secara mendalam." },
    ],
  }),
});

type RevisionNote = {
  location?: string;
  note: string;
  type?: string;
};

type ReworkResult = {
  title: string;
  content: string;
  summary: string;
  changes: any[];
  crosscheck: {
    score?: number;
    verdict?: string;
    items?: any[];
  };
};

function ReworkPage() {
  const { projectId } = useActiveProject();

  // Server functions bindings
  const extractFn = useServerFn(extractArticleFile);
  const reviewFn = useServerFn(reviewRevisionNotes);
  const reworkFn = useServerFn(runRework);
  const saveFn = useServerFn(saveRework);

  // Form states
  const [file, setFile] = useState<File | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileMime, setFileMime] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  
  const [articleTitle, setArticleTitle] = useState("");
  const [articleContent, setArticleContent] = useState("");
  const [revisionNotes, setRevisionNotes] = useState<RevisionNote[]>([]);
  const [manualPrompt, setManualPrompt] = useState("");
  const [scope, setScope] = useState<"full" | "partial">("full");

  // Loading flags
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [reviewingNotes, setReviewingNotes] = useState(false);
  const [runningRework, setRunningRework] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Result state
  const [result, setResult] = useState<ReworkResult | null>(null);

  // 1. Handle File Upload & Extraction
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 20 * 1024 * 1024) {
        toast.error("Ukuran file terlalu besar (maksimal 20MB)");
        return;
      }
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setFileMime(selectedFile.type || "application/octet-stream");
      setUploading(true);

      try {
        const path = `rework/${Date.now()}-${Math.random().toString(36).slice(2)}-${selectedFile.name}`;
        const { error } = await supabase.storage.from("uploads").upload(path, selectedFile);
        if (error) throw new Error(error.message);
        setFilePath(path);
        toast.success(`File "${selectedFile.name}" berhasil diupload.`);

        // Auto-extract using backend
        setExtracting(true);
        toast.info("AI sedang mengekstrak artikel & catatan revisi dari file...");
        const extracted = await extractFn({
          data: { path, name: selectedFile.name, mime: selectedFile.type || "application/octet-stream" },
        });

        setArticleTitle(extracted.title);
        setArticleContent(extracted.content);
        setRevisionNotes(extracted.revision_notes as RevisionNote[]);
        toast.success("Ekstraksi dokumen selesai!");
      } catch (err) {
        toast.error("Gagal memproses file: " + (err as Error).message);
      } finally {
        setUploading(false);
        setExtracting(false);
      }
    }
  };

  // 2. AI Review Revision Notes
  const handleAiReviewNotes = async () => {
    if (!articleContent.trim()) {
      toast.error("Konten artikel masih kosong.");
      return;
    }
    setReviewingNotes(true);
    try {
      const res = await reviewFn({
        data: {
          content: articleContent,
          extra_context: manualPrompt,
        },
      });
      setRevisionNotes(res.revision_notes as RevisionNote[]);
      toast.success("Catatan revisi berhasil di-review & diperbarui oleh AI!");
    } catch (err) {
      toast.error("Gagal review catatan revisi: " + (err as Error).message);
    } finally {
      setReviewingNotes(false);
    }
  };

  // 3. Run Rework Process
  const handleRunRework = async () => {
    if (!articleContent.trim()) {
      toast.error("Konten artikel wajib diisi atau diekstrak terlebih dahulu.");
      return;
    }
    setRunningRework(true);
    setResult(null);
    setSavedId(null);

    try {
      const res = await reworkFn({
        data: {
          project_id: projectId,
          content: articleContent,
          title: articleTitle || "Artikel Rework",
          revision_notes: revisionNotes,
          manual_prompt: manualPrompt,
          scope: scope,
        },
      });

      setResult({
        title: res.title,
        content: res.content,
        summary: res.summary,
        changes: res.changes,
        crosscheck: res.crosscheck,
      });
      toast.success("AI berhasil melakukan rework artikel!");
    } catch (err) {
      toast.error("Gagal menjalankan rework: " + (err as Error).message);
    } finally {
      setRunningRework(false);
    }
  };

  // 4. Save to Database
  const handleSaveToDb = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const notesText = revisionNotes.map((n) => `[${n.type || "note"}] ${n.note}`).join("\n");
      const res = await saveFn({
        data: {
          project_id: projectId,
          title: articleTitle || "Artikel Rework",
          source_type: file ? "file" : "paste",
          source_path: filePath,
          source_name: fileName,
          source_mime: fileMime,
          original_content: articleContent,
          revision_notes: revisionNotes,
          revision_notes_text: notesText,
          manual_prompt: manualPrompt,
          reworked_content: result.content,
          reworked_title: result.title,
          changes: result.changes,
          crosscheck: result.crosscheck,
          status: "draft",
        },
      });
      setSavedId(res.item.id);
      toast.success("Berhasil disimpan ke database article_reworks!");
    } catch (err) {
      toast.error("Gagal menyimpan: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowLeft className="size-4" /> Kembali ke Dashboard
              </Button>
            </Link>
          </div>
          <h1 className="text-sm font-semibold">AI Article Rework & Crosscheck Studio</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <RefreshCw className="size-5 text-primary" /> Rework Artikel & Manajemen Revisi
            </h2>
            <p className="text-sm text-muted-foreground">Ekstrak dokumen, audit catatan revisi, dan jalankan rework berstandar ARS Tone & Knowledge Base.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* KOLOM KIRI: INPUT & CONFIG */}
          <div className="space-y-6">
            {/* Upload File / Ekstraksi */}
            <Card className="p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="size-4 text-primary" /> 1. Sumber Konten & Dokumen
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 space-y-4">
                {!file ? (
                  <label className="block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-accent/30 transition-colors">
                    <Upload className="size-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {uploading ? "Mengupload..." : extracting ? "Mengekstrak dengan AI..." : "Klik untuk upload file (PDF, Docx, Image, Text)"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Maksimal 20MB</p>
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={handleFileChange}
                      accept=".pdf,.docx,.txt,.doc,image/*"
                      disabled={uploading || extracting}
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/40 text-sm">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="size-4 text-primary shrink-0" />
                      <span className="truncate font-medium">{file.name}</span>
                      {extracting && <Badge variant="secondary" className="gap-1"><Loader2 className="size-3 animate-spin" /> Ekstraksi...</Badge>}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="size-8 text-destructive"
                      onClick={() => { setFile(null); setFilePath(null); setArticleContent(""); setRevisionNotes([]); }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}

                {/* Judul & Konten Artikel */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium">Judul Artikel</label>
                    <input 
                      type="text"
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                      placeholder="Judul artikel asli..."
                      value={articleTitle}
                      onChange={(e) => setArticleTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Isi Artikel Asli (Markdown / Text)</label>
                    <Textarea 
                      placeholder="Paste isi artikel atau hasil ekstraksi otomatis akan muncul di sini..."
                      rows={6}
                      className="text-xs font-mono"
                      value={articleContent}
                      onChange={(e) => setArticleContent(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Catatan Revisi & Prompt Manual */}
            <Card className="p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ListChecks className="size-4 text-primary" /> 2. Catatan Revisi & Prompt
                  </span>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleAiReviewNotes}
                    disabled={reviewingNotes || !articleContent.trim()}
                  >
                    {reviewingNotes ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Sparkles className="size-3.5 mr-1.5 text-primary" />}
                    AI Review Catatan
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 space-y-4">
                {/* Daftar Catatan Revisi */}
                <div className="space-y-2">
                  <label className="text-xs font-medium">Ditemukan Catatan Revisi ({revisionNotes.length})</label>
                  {revisionNotes.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic border p-3 rounded-md bg-muted/20">
                      Belum ada catatan terdeteksi. Upload file atau klik "AI Review Catatan" untuk mendeteksi instruksi editor/koreksi.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {revisionNotes.map((rn, idx) => (
                        <div key={idx} className="p-2.5 border rounded bg-muted/30 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[10px] uppercase">{rn.type || "note"}</Badge>
                            {rn.location && <span className="text-muted-foreground font-mono">{rn.location}</span>}
                          </div>
                          <p>{rn.note}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Prompt Manual & Scope */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-medium">Perintah / Prompt Tambahan (Prioritas Tertinggi)</label>
                    <Textarea 
                      placeholder="Contoh: Ubah tone jadi lebih santai, pastikan keyword utama masuk di paragraf 1..."
                      rows={3}
                      value={manualPrompt}
                      onChange={(e) => setManualPrompt(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-medium">Cakupan Rework (Scope)</label>
                    <Select value={scope} onValueChange={(v) => setScope(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full Rework (Rombak menyeluruh dengan panduan KB & ARS)</SelectItem>
                        <SelectItem value="partial">Partial Rework (Hanya ubah bagian yang direvisi)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  size="lg" 
                  onClick={handleRunRework}
                  disabled={runningRework || !articleContent.trim()}
                >
                  {runningRework ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" /> Menjalankan AI Rework...
                    </span>
                  ) : (
                    <>
                      <Sparkles className="size-4 mr-2" /> Jalankan AI Rework & Crosscheck
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* KOLOM KANAN: HASIL REWORK & CROSSCHECK */}
          <div>
            <Card className="p-6 h-full flex flex-col">
              <CardHeader className="px-0 pt-0 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Hasil Rework & Crosscheck</CardTitle>
                {result && (
                  <Button size="sm" onClick={handleSaveToDb} disabled={saving || !!savedId} variant={savedId ? "secondary" : "default"}>
                    {saving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : savedId ? <CheckCircle2 className="size-3.5 mr-1.5" /> : <Save className="size-3.5 mr-1.5" />}
                    {savedId ? "Tersimpan" : "Simpan ke DB"}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="px-0 flex-1 flex flex-col">
                {!result ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground text-xs text-center border rounded-lg bg-muted/20">
                    <ListChecks className="size-10 mb-2 opacity-30" />
                    <p>Hasil artikel rework, daftar perubahan, dan laporan crosscheck validasi AI akan muncul di sini.</p>
                  </div>
                ) : (
                  <Tabs defaultValue="article" className="w-full flex-1 flex flex-col">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                      <TabsTrigger value="article">Artikel Baru</TabsTrigger>
                      <TabsTrigger value="changes">Poin Perubahan ({result.changes?.length || 0})</TabsTrigger>
                      <TabsTrigger value="crosscheck">Crosscheck ({result.crosscheck?.score ?? 0}%)</TabsTrigger>
                    </TabsList>
                    
                    {/* Tab 1: Artikel Baru */}
                    <TabsContent value="article" className="p-4 bg-muted/30 rounded-md border text-sm max-h-[500px] overflow-y-auto whitespace-pre-wrap flex-1 font-mono">
                      <div className="mb-3 pb-2 border-b font-sans font-bold text-base text-primary">
                        {result.title}
                      </div>
                      {result.content}
                    </TabsContent>
                    
                    {/* Tab 2: Poin Perubahan */}
                    <TabsContent value="changes" className="p-4 bg-muted/30 rounded-md border text-sm max-h-[500px] overflow-y-auto space-y-2 flex-1">
                      <div className="font-medium text-amber-600 mb-2 flex items-center gap-1.5">
                        <ListChecks className="size-4" /> Daftar Poin Perubahan:
                      </div>
                      {(!result.changes || result.changes.length === 0) ? (
                        <p className="text-xs text-muted-foreground">Tidak ada detail perubahan tercatat.</p>
                      ) : (
                        result.changes.map((ch, idx) => (
                          <div key={idx} className="p-2.5 border rounded bg-card text-xs space-y-1">
                            {typeof ch === "string" ? (
                              <p>• {ch}</p>
                            ) : (
                              <>
                                <div className="font-semibold text-foreground">{ch.section || ch.title || `Perubahan ${idx + 1}`}</div>
                                <p className="text-muted-foreground">{ch.description || ch.note || JSON.stringify(ch)}</p>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </TabsContent>
                    
                    {/* Tab 3: Crosscheck */}
                    <TabsContent value="crosscheck" className="p-4 bg-muted/30 rounded-md border text-sm max-h-[500px] overflow-y-auto space-y-3 flex-1">
                      <div className="flex items-center justify-between pb-2 border-b">
                        <div className="font-medium text-green-600 flex items-center gap-1.5">
                          <CheckCircle className="size-4" /> Verifikasi & Validasi Catatan
                        </div>
                        <Badge variant="default" className="text-xs">Skor: {result.crosscheck?.score ?? 0}%</Badge>
                      </div>
                      {result.crosscheck?.verdict && (
                        <p className="text-xs text-muted-foreground italic bg-card p-2.5 rounded border">
                          "{result.crosscheck.verdict}"
                        </p>
                      )}
                      <div className="space-y-2 mt-2">
                        {result.crosscheck?.items?.map((item: any, idx: number) => (
                          <div key={idx} className="p-2.5 border rounded bg-card text-xs space-y-1">
                            <div className="flex items-center justify-between font-medium">
                              <span>{item.note || item.requirement || `Item ${idx + 1}`}</span>
                              <Badge variant={item.status === "fulfilled" || item.status === "passed" ? "default" : "secondary"} className="text-[10px]">
                                {item.status || "checked"}
                              </Badge>
                            </div>
                            {item.explanation && <p className="text-muted-foreground">{item.explanation}</p>}
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
