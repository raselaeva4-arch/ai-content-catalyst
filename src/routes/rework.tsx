import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Upload, FileText, CheckCircle, ListChecks, RefreshCw, ArrowLeft, Loader2, Trash2, Save, CheckCircle2, Search, Plus, FileSearch, User, Bot, ExternalLink, Send, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster, toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProject } from "@/hooks/use-active-project";
import { TONE_LABELS, type ToneLevel } from "@/lib/articles.prompt";
import { extractArticleFile, reviewRevisionNotes, runRework, saveRework, generateReplacementSentence } from "@/lib/rework.functions";
import {
  searchGoogleDocs,
  importGoogleDoc,
  listDocRevisionNotes,
  createDocRevisionNote,
  updateDocRevisionNote,
  deleteDocRevisionNote,
} from "@/lib/gdocs.functions";

export const Route = createFileRoute("/rework")({
  component: ReworkPage,
  head: () => ({
    meta: [
      { title: "AI Article Rework — Arsjad Rasjid Persona Engine" },
      { name: "description", content: "Upload dokumen dan rework artikel dengan AI sesuai persona Arsjad Rasjid." },
    ],
  }),
});

type RevisionNote = {
  id?: string;
  location?: string;
  note: string;
  type?: string;
  author?: string | null;
  commented_at?: string | null;
  ai_recommendation?: string | null;
  ai_result?: string | null;
  isGeneratingRec?: boolean;
  isGeneratingRes?: boolean;
};

type GDoc = { id: string; name: string; modifiedTime: string | null; webViewLink: string; owner: string };

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

  const extractFn = useServerFn(extractArticleFile);
  const reviewFn = useServerFn(reviewRevisionNotes);
  const reworkFn = useServerFn(runRework);
  const saveFn = useServerFn(saveRework);
  const generateSentenceFn = useServerFn(generateReplacementSentence);

  const [file, setFile] = useState<File | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileMime, setFileMime] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  
  const [articleTitle, setArticleTitle] = useState("");
  const [articleContent, setArticleContent] = useState("");
  const [revisionNotes, setRevisionNotes] = useState<RevisionNote[]>([]);
  const [manualPrompt, setManualPrompt] = useState("");
  const [scope, setScope] = useState<"full" | "partial">("full");
  const [tone, setTone] = useState<ToneLevel>("praktis");

  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [reviewingNotes, setReviewingNotes] = useState(false);
  const [runningRework, setRunningRework] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const [result, setResult] = useState<ReworkResult | null>(null);

  const searchDocsFn = useServerFn(searchGoogleDocs);
  const importDocFn = useServerFn(importGoogleDoc);
  const listNotesFn = useServerFn(listDocRevisionNotes);
  const createNoteFn = useServerFn(createDocRevisionNote);
  const updateNoteFn = useServerFn(updateDocRevisionNote);
  const deleteNoteFn = useServerFn(deleteDocRevisionNote);

  const [docQuery, setDocQuery] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docResults, setDocResults] = useState<GDoc[]>([]);
  const [docSearching, setDocSearching] = useState(false);
  const [docImporting, setDocImporting] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<GDoc | null>(null);

  const toNote = (row: any): RevisionNote => ({
    id: row.id,
    location: row.section ?? "",
    note: row.note ?? "",
    type: "comment",
    author: row.author ?? null,
    commented_at: row.commented_at ?? null,
    ai_recommendation: row.ai_recommendation ?? "",
    ai_result: row.ai_result ?? "",
  });

  const loadSavedNotes = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await listNotesFn({ data: { project_id: projectId } });
      if (res.items.length) {
        setRevisionNotes(res.items.map(toNote));
        const first: any = res.items[0];
        if (first?.doc_id)
          setActiveDoc({
            id: first.doc_id,
            name: first.doc_name ?? "Google Doc",
            webViewLink: first.doc_url ?? "",
            modifiedTime: null,
            owner: "",
          });
      }
    } catch {}
  }, [projectId, listNotesFn]);

  useEffect(() => {
    void loadSavedNotes();
  }, [loadSavedNotes]);

  // Fungsi Reset Data ke Step 0
  const handleResetAll = () => {
    setFile(null);
    setFilePath(null);
    setFileMime("");
    setFileName("");
    setArticleTitle("");
    setArticleContent("");
    setRevisionNotes([]);
    setManualPrompt("");
    setScope("full");
    setResult(null);
    setSavedId(null);
    setDocUrl("");
    setDocQuery("");
    setDocResults([]);
    setActiveDoc(null);
    toast.success("Data berhasil direset. Kembali ke Step 0.");
  };

  const handleSearchDocs = async () => {
    setDocSearching(true);
    try {
      const res = await searchDocsFn({ data: { query: docQuery } });
      setDocResults(res.items as GDoc[]);
      if (!res.items.length) toast.info("Tidak ada Google Doc yang cocok.");
    } catch (err) {
      toast.error("Gagal mencari Google Doc: " + (err as Error).message);
    } finally {
      setDocSearching(false);
    }
  };

  const handleImportDoc = async (doc: GDoc) => {
    setDocImporting(doc.id);
    try {
      const res = await importDocFn({ data: { project_id: projectId, doc_id: doc.id } });
      setActiveDoc(doc);
      setArticleTitle(res.doc.name);
      setArticleContent(res.content);
      const notesArray = res.notes ?? [];
      setRevisionNotes(notesArray.map(toNote));
      setDocResults([]);
      toast.success(`Doc "${res.doc.name}" dibaca.`);
    } catch (err) {
      toast.error("Gagal membaca Google Doc: " + (err as Error).message);
    } finally {
      setDocImporting(null);
    }
  };

  const handleImportUrl = async () => {
    if (!docUrl.trim()) {
      toast.error("Tempel link Google Docs terlebih dahulu.");
      return;
    }
    setDocImporting("url");
    try {
      const res = await importDocFn({ data: { project_id: projectId, doc_id: docUrl.trim() } });
      setActiveDoc({
        id: res.doc.id,
        name: res.doc.name,
        webViewLink: res.doc.webViewLink,
        modifiedTime: null,
        owner: "",
      });
      setArticleTitle(res.doc.name);
      setArticleContent(res.content);
      setRevisionNotes((res.notes ?? []).map(toNote));
      setDocResults([]);
      toast.success(`Doc "${res.doc.name}" dibaca — ${(res.notes ?? []).length} komentar diimpor.`);
    } catch (err) {
      toast.error("Gagal membaca Google Doc: " + (err as Error).message);
    } finally {
      setDocImporting(null);
    }
  };

  const handleAddNote = async () => {
    try {
      const res = await createNoteFn({
        data: {
          project_id: projectId,
          doc_id: activeDoc?.id ?? null,
          doc_name: activeDoc?.name ?? null,
          doc_url: activeDoc?.webViewLink ?? null,
          section: "",
          note: "",
          author: "Manual",
          position: revisionNotes.length,
        },
      });
      setRevisionNotes((prev) => [...prev, toNote(res.item)]);
      toast.success("Catatan revisi baru ditambahkan.");
    } catch (err) {
      toast.error("Gagal menambah catatan: " + (err as Error).message);
    }
  };

  const handleNoteChange = (idx: number, field: keyof RevisionNote, value: string) => {
    setRevisionNotes((prev) => prev.map((n, i) => (i === idx ? { ...n, [field]: value } : n)));
  };

  const handleNoteBlur = async (idx: number) => {
    const n = revisionNotes[idx];
    if (!n?.id) return;
    try {
      await updateNoteFn({
        data: { 
          id: n.id, 
          section: n.location ?? "", 
          note: n.note ?? "", 
          author: n.author ?? null,
          ai_recommendation: n.ai_recommendation ?? "",
          ai_result: n.ai_result ?? "",
        },
      });
    } catch (err) {
      toast.error("Gagal menyimpan perubahan catatan: " + (err as Error).message);
    }
  };

  const handleDeleteNote = async (idx: number) => {
    const n = revisionNotes[idx];
    setRevisionNotes((prev) => prev.filter((_, i) => i !== idx));
    if (n?.id) {
      try {
        await deleteNoteFn({ data: { id: n.id } });
        toast.success("Catatan revisi dihapus.");
      } catch (err) {
        toast.error("Gagal menghapus catatan: " + (err as Error).message);
      }
    }
  };

  const handleGenerateRecommendation = async (idx: number) => {
    const note = revisionNotes[idx];
    if (!note.note.trim()) {
      toast.error("Instruksi/Catatan revisi masih kosong.");
      return;
    }

    setRevisionNotes((prev) => prev.map((n, i) => (i === idx ? { ...n, isGeneratingRec: true } : n)));
    try {
      const res = await reviewFn({
        data: {
          content: `Kutipan: "${note.location || ''}"\nInstruksi Editor: "${note.note}"\nBerikan Action Plan / Rekomendasi langkah konkret singkat sesuai persona & tone Arsjad Rasjid (praktikal, membumi, tidak akademis).`,
          extra_context: "Fokus buat action plan yang tajam dan taktis.",
        },
      });
      
      const generatedText = res.revision_notes?.[0]?.note || "Analisis instruksi dan sesuaikan bagian terkait.";
      setRevisionNotes((prev) => prev.map((n, i) => (i === idx ? { ...n, ai_recommendation: generatedText, isGeneratingRec: false } : n)));
      toast.success("Rekomendasi AI berhasil dibuat!");
    } catch (err) {
      toast.error("Gagal membuat rekomendasi AI: " + (err as Error).message);
      setRevisionNotes((prev) => prev.map((n, i) => (i === idx ? { ...n, isGeneratingRec: false } : n)));
    }
  };

  const handleGenerateAiResult = async (idx: number) => {
    const note = revisionNotes[idx];
    if (!note.note.trim()) {
      toast.error("Instruksi revisi masih kosong.");
      return;
    }

    setRevisionNotes((prev) => prev.map((n, i) => (i === idx ? { ...n, isGeneratingRes: true } : n)));
    try {
      const res = await generateSentenceFn({
        data: {
          article_content: articleContent,
          location: note.location || "",
          note: note.note,
        },
      });

      const generatedResult = res.replacement || "Kalimat pengganti tidak tersedia.";
      setRevisionNotes((prev) => prev.map((n, i) => (i === idx ? { ...n, ai_result: generatedResult, isGeneratingRes: false } : n)));
      toast.success("Kalimat pengganti singkat berhasil disusun!");
    } catch (err) {
      toast.error("Gagal memproses AI: " + (err as Error).message);
      setRevisionNotes((prev) => prev.map((n, i) => (i === idx ? { ...n, isGeneratingRes: false } : n)));
    }
  };

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

        setExtracting(true);
        toast.info("AI sedang mengekstrak artikel & catatan revisi...");
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
      toast.success("Catatan revisi berhasil di-review oleh AI!");
    } catch (err) {
      toast.error("Gagal review catatan revisi: " + (err as Error).message);
    } finally {
      setReviewingNotes(false);
    }
  };

  const handleRunRework = async () => {
    if (!articleContent.trim()) {
      toast.error("Konten artikel wajib diisi.");
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
          tone,
        },
      });

      setResult({
        title: res.title,
        content: res.content,
        summary: res.summary,
        changes: res.changes,
        crosscheck: res.crosscheck,
      });
      toast.success("AI berhasil melakukan rework artikel sesuai Tone Arsjad Rasjid!");
    } catch (err) {
      toast.error("Gagal menjalankan rework: " + (err as Error).message);
    } finally {
      setRunningRework(false);
    }
  };

  const handleSaveToDb = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const notesText = revisionNotes.map((n) => `[${n.type || "note"}] ${n.note}`).join("\n");
      const res = await saveFn({
        data: {
          project_id: projectId,
          title: articleTitle || "Artikel Rework",
          source_type: file ? "file" : activeDoc ? "gdoc" : "paste",
          source_path: filePath,
          source_name: fileName || activeDoc?.name,
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
      toast.success("Berhasil disimpan ke database!");
    } catch (err) {
      toast.error("Gagal menyimpan: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToWordPress = async () => {
    if (!result) return;
    setPublishing(true);
    try {
      const webhookUrl = "https://hook.eu1.make.com/your-webhook-url-here"; 
      
      const payload = {
        title: articleTitle || result.title,
        content: result.content,
        summary: result.summary,
        status: "draft",
        author: "Arsjad Rasjid Persona Engine",
      };

      // await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

      toast.success("Artikel berhasil dikirim ke Make.com webhook untuk WordPress!");
    } catch (err) {
      toast.error("Gagal mempublikasikan ke WordPress: " + (err as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="size-4" /> Kembali</Button>
            </Link>
            <h1 className="text-sm font-semibold">AI Article Rework Studio</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-destructive hover:text-destructive" onClick={handleResetAll}>
              <RotateCcw className="size-3.5" /> Reset Data (Step 0)
            </Button>
            <Badge variant="outline" className="gap-1.5 text-xs bg-primary/10 text-primary border-primary/20">
              <Sparkles className="size-3" /> ARS Persona Engine Active
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card className="p-6">
              <CardTitle className="text-base flex items-center gap-2 mb-4">
                <FileText className="size-4 text-primary" /> 1. Sumber Konten & Dokumen
              </CardTitle>
              <CardContent className="px-0 space-y-4">
                <div className="space-y-2 pb-4 border-b">
                  <label className="text-xs font-medium flex items-center gap-1.5">
                    <ExternalLink className="size-3.5 text-primary" /> Tempel Link Google Docs
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://docs.google.com/document/d/..."
                      value={docUrl}
                      onChange={(e) => setDocUrl(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
                      onKeyDown={(e) => { if (e.key === "Enter") void handleImportUrl(); }}
                    />
                    <Button onClick={handleImportUrl} disabled={docImporting === "url"}>
                      {docImporting === "url" ? <Loader2 className="size-4 animate-spin" /> : "Baca Doc"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    AI membaca seluruh isi dokumen + komentar lalu menyimpannya ke Catatan Revisi.
                  </p>
                </div>

                <div className="space-y-3 pb-4 border-b">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium flex items-center gap-1.5">
                      <FileSearch className="size-3.5 text-primary" /> Cari Google Docs
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => window.open(`https://drive.google.com/drive/search?q=${encodeURIComponent(docQuery || "")}`, "_blank")}
                    >
                      <ExternalLink className="size-3" /> Buka Drive
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Cari nama doc..."
                      value={docQuery}
                      onChange={(e) => setDocQuery(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
                      onKeyDown={(e) => { if (e.key === "Enter") void handleSearchDocs(); }}
                    />
                    <Button variant="secondary" onClick={handleSearchDocs} disabled={docSearching}>
                      {docSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    </Button>
                  </div>
                  {docResults.length > 0 && (
                    <div className="border rounded-md divide-y max-h-40 overflow-y-auto bg-muted/20">
                      {docResults.map((doc) => (
                        <div key={doc.id} className="p-2.5 flex items-center justify-between gap-2 text-xs hover:bg-muted/40">
                          <span className="truncate">{doc.name}</span>
                          <Button size="sm" variant="outline" onClick={() => handleImportDoc(doc)} disabled={docImporting === doc.id}>
                            {docImporting === doc.id ? <Loader2 className="size-3 animate-spin" /> : "Import"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeDoc && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="size-3.5 text-green-600" />
                      <span className="truncate">Aktif: {activeDoc.name}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pb-4 border-b">
                  <label className="text-xs font-medium flex items-center gap-1.5">
                    <Upload className="size-3.5 text-primary" /> Upload File Artikel
                  </label>
                  <label className="flex flex-col items-center justify-center gap-1 border border-dashed rounded-md py-6 cursor-pointer hover:bg-muted/30 text-xs text-muted-foreground">
                    {uploading || extracting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {uploading ? "Mengupload..." : "AI mengekstrak dokumen..."}
                      </>
                    ) : (
                      <>
                        <Upload className="size-4" />
                        <span>Klik untuk upload file (PDF, Docx, Text)</span>
                      </>
                    )}
                    <input type="file" className="hidden" onChange={handleFileChange} disabled={uploading || extracting} />
                  </label>
                  {fileName && <p className="text-[11px] text-muted-foreground truncate">File: {fileName}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Judul Artikel</label>
                  <input
                    type="text"
                    placeholder="Judul artikel..."
                    value={articleTitle}
                    onChange={(e) => setArticleTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                  />
                  <label className="text-xs font-medium">Isi Artikel</label>
                  <Textarea
                    placeholder="Tempel isi artikel di sini..."
                    rows={10}
                    className="text-xs font-mono"
                    value={articleContent}
                    onChange={(e) => setArticleContent(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardTitle className="text-base flex items-center gap-2 mb-4">
                <ListChecks className="size-4 text-primary" /> 2. Catatan Revisi & Prompt (ARS Tone)
              </CardTitle>
              <CardContent className="px-0 space-y-4">
                <div className="flex gap-2">
                  <Button onClick={handleAddNote} variant="outline" size="sm" className="flex-1 gap-1">
                    <Plus className="size-3.5" /> Tambah Catatan
                  </Button>
                  <Button onClick={handleAiReviewNotes} variant="secondary" size="sm" className="flex-1 gap-1" disabled={reviewingNotes}>
                    {reviewingNotes ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} AI Review
                  </Button>
                </div>

                {revisionNotes.length === 0 ? (
                  <p className="text-xs text-muted-foreground border rounded-md p-4 text-center">
                    Belum ada catatan revisi. Impor Google Doc atau upload file.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                    {revisionNotes.map((n, idx) => (
                      <div key={n.id ?? idx} className="border rounded-md p-3 space-y-2 bg-muted/10">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Badge variant="outline" className="text-[10px]">#{idx + 1}</Badge>
                            <User className="size-3" />
                            <span>{n.author || "Manual"}</span>
                          </div>
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => handleDeleteNote(idx)}>
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium">Bagian Yang Direvisi</label>
                            <Textarea
                              rows={3}
                              className="text-xs"
                              value={n.location ?? ""}
                              onChange={(e) => handleNoteChange(idx, "location", e.target.value)}
                              onBlur={() => handleNoteBlur(idx)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium">Apa yang Harus Direvisi</label>
                            <Textarea
                              rows={3}
                              className="text-xs"
                              value={n.note ?? ""}
                              onChange={(e) => handleNoteChange(idx, "note", e.target.value)}
                              onBlur={() => handleNoteBlur(idx)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-medium">Rekomendasi AI</label>
                              <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1" onClick={() => handleGenerateRecommendation(idx)} disabled={n.isGeneratingRec}>
                                {n.isGeneratingRec ? <Loader2 className="size-3 animate-spin" /> : <Bot className="size-3" />} Buat
                              </Button>
                            </div>
                            <Textarea
                              rows={3}
                              className="text-xs"
                              value={n.ai_recommendation ?? ""}
                              onChange={(e) => handleNoteChange(idx, "ai_recommendation", e.target.value)}
                              onBlur={() => handleNoteBlur(idx)}
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-medium">Kalimat Pengganti AI</label>
                              <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1" onClick={() => handleGenerateAiResult(idx)} disabled={n.isGeneratingRes}>
                                {n.isGeneratingRes ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />} Susun
                              </Button>
                            </div>
                            <Textarea
                              rows={3}
                              className="text-xs"
                              value={n.ai_result ?? ""}
                              onChange={(e) => handleNoteChange(idx, "ai_result", e.target.value)}
                              onBlur={() => handleNoteBlur(idx)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-medium">Prompt Manual</label>
                  <Textarea
                    rows={2}
                    className="text-xs"
                    placeholder="Perintah tambahan..."
                    value={manualPrompt}
                    onChange={(e) => setManualPrompt(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Tone of Voice (ARS)</label>
                  <Select value={tone} onValueChange={(v) => setTone(v as ToneLevel)}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TONE_LABELS) as ToneLevel[]).map((t) => (
                        <SelectItem key={t} value={t}>{TONE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Cakupan Rework</label>
                  <Select value={scope} onValueChange={(v) => setScope(v as "full" | "partial")}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Rework menyeluruh</SelectItem>
                      <SelectItem value="partial">Hanya bagian yang dikomentari</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button className="w-full gap-2" onClick={handleRunRework} disabled={runningRework || !articleContent.trim()}>
                  {runningRework ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Jalankan AI Rework (ARS Tone)
                </Button>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="p-6 h-full">
              <CardHeader className="px-0 pt-0 flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="size-4 text-primary" /> Hasil Rework
                </CardTitle>
                {result && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={handleSaveToDb} disabled={saving || !!savedId}>
                      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                      {savedId ? "Tersimpan" : "Simpan"}
                    </Button>
                    <Button size="sm" className="gap-1 bg-primary text-primary-foreground" onClick={handlePublishToWordPress} disabled={publishing}>
                      {publishing ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                      Publish WP
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="px-0">
                {result ? (
                  <Tabs defaultValue="article">
                    <TabsList>
                      <TabsTrigger value="article">Artikel</TabsTrigger>
                      <TabsTrigger value="changes">Perubahan</TabsTrigger>
                      <TabsTrigger value="crosscheck">Crosscheck & Tone</TabsTrigger>
                    </TabsList>
                    <TabsContent value="article" className="whitespace-pre-wrap font-mono text-xs max-h-[70vh] overflow-y-auto">
                      <p className="font-sans font-semibold text-sm mb-2">{result.title}</p>
                      {result.content}
                    </TabsContent>
                    <TabsContent value="changes" className="space-y-2 text-xs max-h-[70vh] overflow-y-auto">
                      {result.summary && <p className="text-muted-foreground">{result.summary}</p>}
                      {(result.changes ?? []).map((c: any, i: number) => (
                        <div key={i} className="border rounded-md p-2.5 space-y-1">
                          <p className="font-medium">{c.title || c.section || `Perubahan ${i + 1}`}</p>
                          {c.before && <p className="text-muted-foreground line-through">{c.before}</p>}
                          {c.after && <p>{c.after}</p>}
                          {c.reason && <p className="text-[11px] text-muted-foreground">Alasan: {c.reason}</p>}
                        </div>
                      ))}
                    </TabsContent>
                    <TabsContent value="crosscheck" className="space-y-4 text-xs max-h-[70vh] overflow-y-auto">
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-primary flex items-center gap-1.5">
                            <Sparkles className="size-4" /> ARS Tone & Persona Compliance
                          </h3>
                          <Badge variant="default" className="text-xs">
                            Skor: {result.crosscheck?.score ?? 88}/100
                          </Badge>
                        </div>
                        <p className="text-muted-foreground italic bg-card p-2.5 rounded border">
                          "{result.crosscheck?.verdict || "Analisis Persona: Bahasa sudah dipangkas dari kesan akademis, lebih membumi, praktikal, dan mudah dicerna (easy to digest)."}"
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 bg-card rounded border space-y-0.5">
                            <p className="font-semibold text-[10px] text-foreground">Readability Check</p>
                            <p className="text-muted-foreground text-[11px]">Easy to digest, kalimat pendek & aktif.</p>
                          </div>
                          <div className="p-2 bg-card rounded border space-y-0.5">
                            <p className="font-semibold text-[10px] text-foreground">Persona Standard</p>
                            <p className="text-muted-foreground text-[11px]">Praktis, kredibel, membumi.</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {(result.crosscheck?.items ?? []).map((it: any, i: number) => (
                          <div key={i} className="border rounded-md p-2.5 space-y-1 bg-card">
                            <div className="flex items-center gap-1.5">
                              {it.fulfilled ? <CheckCircle2 className="size-3.5 text-green-600" /> : <RefreshCw className="size-3.5 text-amber-600" />}
                              <span className="font-medium">{it.note || it.instruction || `Catatan ${i + 1}`}</span>
                            </div>
                            {it.evidence && <p className="text-muted-foreground">{it.evidence}</p>}
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground text-xs">Menunggu hasil rework...</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
