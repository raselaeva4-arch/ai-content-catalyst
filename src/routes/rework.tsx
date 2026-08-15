import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Upload, FileText, CheckCircle, ListChecks, RefreshCw, ArrowLeft, Loader2, Trash2, Save, CheckCircle2, Search, Plus, FileSearch, User, Bot } from "lucide-react";
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
      { title: "AI Article Rework — KeywordForge" },
      { name: "description", content: "Upload dokumen dan lakukan rework artikel dengan AI secara mendalam." },
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

  // Google Docs states
  const searchDocsFn = useServerFn(searchGoogleDocs);
  const importDocFn = useServerFn(importGoogleDoc);
  const listNotesFn = useServerFn(listDocRevisionNotes);
  const createNoteFn = useServerFn(createDocRevisionNote);
  const updateNoteFn = useServerFn(updateDocRevisionNote);
  const deleteNoteFn = useServerFn(deleteDocRevisionNote);

  const [docQuery, setDocQuery] = useState("");
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
    } catch {
      /* diamkan: catatan tersimpan opsional */
    }
  }, [projectId, listNotesFn]);

  useEffect(() => {
    void loadSavedNotes();
  }, [loadSavedNotes]);

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
      const notesArray = res.notes || res.revision_notes || [];
      setRevisionNotes(notesArray.map(toNote));
      setDocResults([]);
      toast.success(`Doc "${res.doc.name}" dibaca. ${notesArray.length} komentar tersimpan sebagai catatan revisi.`);
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
          // jika backend mendukung kolom ai_recommendation & ai_result, sertakan di sini
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

  // AI Action: Regenerate Rekomendasi / Action Plan per catatan
  const handleGenerateRecommendation = async (idx: number) => {
    const note = revisionNotes[idx];
    if (!note.note.trim()) {
      toast.error("Instruksi/Catatan revisi masih kosong.");
      return;
    }

    setRevisionNotes((prev) => prev.map((n, i) => (i === idx ? { ...n, isGeneratingRec: true } : n)));
    try {
      // Memanggil AI Review / helper untuk menghasilkan Action Plan
      const res = await reviewFn({
        data: {
          content: `Kutipan: "${note.location || ''}"\nInstruksi Editor: "${note.note}"\nBerikan Action Plan / Rekomendasi langkah konkret singkat untuk menjawab instruksi ini.`,
          extra_context: "Fokus buat action plan yang tajam dan taktis.",
        },
      });
      
      const generatedText = res.revision_notes?.[0]?.note || "Analisis instruksi dan sesuaikan bagian terkait sesuai konteks artikel.";
      setRevisionNotes((prev) => prev.map((n, i) => (i === idx ? { ...n, ai_recommendation: generatedText, isGeneratingRec: false } : n)));
      toast.success("Rekomendasi AI / Action Plan berhasil dibuat!");
    } catch (err) {
      toast.error("Gagal membuat rekomendasi AI: " + (err as Error).message);
      setRevisionNotes((prev) => prev.map((n, i) => (i === idx ? { ...n, isGeneratingRec: false } : n)));
    }
  };

  // AI Action: Regenerate Hasil Proses AI (Kalimat Pengganti & Kontekstual + Browsing info jika perlu)
  const handleGenerateAiResult = async (idx: number) => {
    const note = revisionNotes[idx];
    if (!note.note.trim()) {
      toast.error("Instruksi revisi masih kosong.");
      return;
    }

    setRevisionNotes((prev) => prev.map((n, i) => (i === idx ? { ...n, isGeneratingRes: true } : n)));
    try {
      // Menjalankan rework parsial untuk item ini dengan kapabilitas riset/browsing konteks
      const res = await reworkFn({
        data: {
          project_id: projectId,
          content: articleContent,
          title: articleTitle || "Artikel Rework",
          revision_notes: [note],
          manual_prompt: "Lakukan riset web jika diperlukan untuk data/fakta, lalu susun kalimat/paragraf pengganti yang runtut, nyambung, dan easy to digest dengan seluruh artikel.",
          scope: "partial",
        },
      });

      const generatedResult = res.content || "Gagal menyusun hasil proses AI.";
      setRevisionNotes((prev) => prev.map((n, i) => (i === idx ? { ...n, ai_result: generatedResult, isGeneratingRes: false } : n)));
      toast.success("Hasil proses AI & kalimat pengganti berhasil disusun!");
    } catch (err) {
      toast.error("Gagal memproses hasil AI: " + (err as Error).message);
      setRevisionNotes((prev) => prev.map((n, i) => (i === idx ? { ...n, isGeneratingRes: false } : n)));
    }
  };

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
            {/* 1. Sumber Konten & Dokumen */}
            <Card className="p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="size-4 text-primary" /> 1. Sumber Konten & Dokumen
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 space-y-4">
                {/* Google Docs Search & Import */}
                <div className="space-y-3 pb-4 border-b">
                  <label className="text-xs font-medium flex items-center gap-1.5">
                    <FileSearch className="size-3.5 text-primary" /> Import dari Google Docs
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Cari nama Google Doc..."
                      value={docQuery}
                      onChange={(e) => setDocQuery(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSearchDocs();
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleSearchDocs}
                      disabled={docSearching}
                    >
                      {docSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                      Cari
                    </Button>
                  </div>

                  {docResults.length > 0 && (
                    <div className="border rounded-md divide-y max-h-40 overflow-y-auto bg-muted/20">
                      {docResults.map((doc) => (
                        <div key={doc.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-muted/40">
                          <div className="truncate pr-2">
                            <a href={doc.webViewLink} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline block truncate">
                              {doc.name}
                            </a>
                            <span className="text-[10px] text-muted-foreground">Pemilik: {doc.owner || "Tidak diketahui"}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleImportDoc(doc)}
                            disabled={docImporting === doc.id}
                          >
                            {docImporting === doc.id ? <Loader2 className="size-3 animate-spin mr-1" /> : <Upload className="size-3 mr-1" />}
                            Import
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeDoc && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 bg-muted/30 p-2 rounded">
                      <CheckCircle2 className="size-3.5 text-green-600 shrink-0" />
                      <span className="truncate">Dokumen aktif: <strong className="text-foreground">{activeDoc.name}</strong></span>
                    </div>
                  )}
                </div>

                {/* Upload File Lokal */}
                <div className="space-y-2">
                  <label className="text-xs font-medium">Atau Upload File Lokal (PDF, Text, Gambar)</label>
                  {!file ? (
                    <label className="block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-accent/30 transition-colors">
                      <Upload className="size-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        {uploading ? "Mengupload..." : extracting ? "Mengekstrak dengan AI..." : "Klik untuk upload file"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Maksimal 20MB</p>
                      <input 
                        type="file" 
                        className="hidden" 
                        onChange={handleFileChange}
                        accept=".pdf,.txt,image/*" 
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
                </div>

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

            {/* 2. Catatan Revisi & Prompt */}
            <Card className="p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ListChecks className="size-4 text-primary" /> 2. Catatan Revisi & Instruksi AI
                  </span>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleAddNote}
                      className="gap-1 text-xs"
                    >
                      <Plus className="size-3.5" /> Tambah Catatan
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleAiReviewNotes}
                      disabled={reviewingNotes || !articleContent.trim()}
                      className="text-xs"
                    >
                      {reviewingNotes ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Sparkles className="size-3.5 mr-1.5 text-primary" />}
                      AI Review
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 space-y-4">
                {/* Tabel Catatan Revisi Komprehensif (Multi-Kolom) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium">Daftar Catatan Revisi & Analisis AI ({revisionNotes.length})</label>
                  </div>

                  {revisionNotes.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic border p-4 rounded-md bg-muted/20 text-center">
                      Belum ada catatan revisi. Import dari Google Doc, tambah manual, atau klik "AI Review".
                    </p>
                  ) : (
                    <div className="border rounded-md overflow-x-auto max-h-[520px] overflow-y-auto">
                      <table className="w-full text-left border-collapse min-w-[1100px]">
                        <thead className="bg-muted/50 text-muted-foreground text-[11px] sticky top-0 z-10">
                          <tr>
                            <th className="p-2.5 border-b font-medium w-[22%]">Bagian Yang Direvisi (Teks Asli)</th>
                            <th className="p-2.5 border-b font-medium w-[22%]">Apa yang Harus Direvisi (Instruksi)</th>
                            <th className="p-2.5 border-b font-medium w-[23%]">Rekomendasi AI / Action Plan</th>
                            <th className="p-2.5 border-b font-medium w-[23%]">Hasil Proses AI (Kalimat Pengganti)</th>
                            <th className="p-2.5 border-b font-medium w-[10%]">Penulis & Waktu</th>
                            <th className="p-2.5 border-b font-medium w-[5%] text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border text-xs">
                          {revisionNotes.map((rn, idx) => (
                            <tr key={rn.id || idx} className="bg-background hover:bg-muted/10">
                              {/* Kolom 1: Teks Asli / Lokasi */}
                              <td className="p-2 align-top">
                                <Textarea
                                  value={rn.location || ""}
                                  onChange={(e) => handleNoteChange(idx, "location", e.target.value)}
                                  onBlur={() => handleNoteBlur(idx)}
                                  placeholder="Kutipan bagian..."
                                  rows={4}
                                  className="text-xs resize-y font-mono"
                                />
                              </td>

                              {/* Kolom 2: Instruksi / Komentar */}
                              <td className="p-2 align-top">
                                <Textarea
                                  value={rn.note || ""}
                                  onChange={(e) => handleNoteChange(idx, "note", e.target.value)}
                                  onBlur={() => handleNoteBlur(idx)}
                                  placeholder="Instruksi revisi..."
                                  rows={4}
                                  className="text-xs resize-y"
                                />
                              </td>

                              {/* Kolom 3: Rekomendasi AI / Action Plan */}
                              <td className="p-2 align-top space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                    <Bot className="size-3 text-primary" /> Action Plan
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-[10px] gap-1 text-primary hover:bg-primary/10"
                                    onClick={() => handleGenerateRecommendation(idx)}
                                    disabled={rn.isGeneratingRec}
                                  >
                                    {rn.isGeneratingRec ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                                    Regenerate
                                  </Button>
                                </div>
                                <Textarea
                                  value={rn.ai_recommendation || ""}
                                  onChange={(e) => handleNoteChange(idx, "ai_recommendation", e.target.value)}
                                  onBlur={() => handleNoteBlur(idx)}
                                  placeholder="Klik Regenerate untuk mendapatkan action plan AI..."
                                  rows={3}
                                  className="text-xs resize-y bg-primary/5 border-primary/20"
                                />
                              </td>

                              {/* Kolom 4: Hasil Proses AI (Kalimat Pengganti Kontekstual + Browsing) */}
                              <td className="p-2 align-top space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                    <Sparkles className="size-3 text-amber-500" /> Hasil AI & Kontekstual
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-[10px] gap-1 text-amber-600 hover:bg-amber-500/10"
                                    onClick={() => handleGenerateAiResult(idx)}
                                    disabled={rn.isGeneratingRes}
                                  >
                                    {rn.isGeneratingRes ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                                    Regenerate
                                  </Button>
                                </div>
                                <Textarea
                                  value={rn.ai_result || ""}
                                  onChange={(e) => handleNoteChange(idx, "ai_result", e.target.value)}
                                  onBlur={() => handleNoteBlur(idx)}
                                  placeholder="Klik Regenerate untuk menyusun kalimat pengganti & hasil riset web..."
                                  rows={3}
                                  className="text-xs resize-y bg-amber-500/5 border-amber-500/20 font-mono"
                                />
                              </td>

                              {/* Kolom 5: Penulis & Waktu */}
                              <td className="p-2 align-top space-y-1">
                                <div className="flex items-center gap-1 font-medium text-foreground truncate">
                                  <User className="size-3 text-muted-foreground shrink-0" />
                                  <input
                                    type="text"
                                    value={rn.author || ""}
                                    onChange={(e) => handleNoteChange(idx, "author", e.target.value)}
                                    onBlur={() => handleNoteBlur(idx)}
                                    placeholder="Author"
                                    className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary text-xs px-1 py-0.5"
                                  />
                                </div>
                                <div className="text-[10px] text-muted-foreground pl-4">
                                  {rn.commented_at ? new Date(rn.commented_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "Manual"}
                                </div>
                              </td>

                              {/* Kolom 6: Aksi (Delete) */}
                              <td className="p-2 align-top text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteNote(idx)}
                                  title="Hapus Catatan"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Prompt Manual & Scope */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
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
