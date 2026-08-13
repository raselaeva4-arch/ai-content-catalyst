import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Upload, FileText, CheckCircle, ListChecks, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster, toast } from "sonner";

export const Route = createFileRoute("/rework")({
  component: ReworkPage,
  head: () => ({
    meta: [
      { title: "AI Article Rework — KeywordForge" },
      { name: "description", content: "Upload dokumen dan lakukan rework artikel dengan AI." },
    ],
  }),
});

function ReworkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    article?: string;
    changes?: string;
    crosscheck?: string;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!file && !prompt.trim()) {
      toast.error("Upload file atau masukkan prompt revisi terlebih dahulu.");
      return;
    }
    setLoading(true);
    try {
      // TODO: Sambungkan dengan backend rework.functions.ts milikmu di sini
      setTimeout(() => {
        setResult({
          article: "Ini adalah hasil artikel yang sudah di-rework menggunakan knowledge base dan tone ARS...",
          changes: "- Menyesuaikan struktur penulisan\n- Memperbarui poin data crosscheck\n- Mengoptimalkan tone ARS",
          crosscheck: "Validasi sukses: Konten sudah sesuai dengan panduan knowledge base."
        });
        setLoading(false);
        toast.success("Rework artikel berhasil!");
      }, 2000);
    } catch (error) {
      toast.error("Gagal memproses rework: " + (error as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowLeft className="size-4" /> Kembali ke Dashboard
              </Button>
            </Link>
          </div>
          <h1 className="text-sm font-semibold">AI Article Rework Studio</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <RefreshCw className="size-5 text-primary" /> Rework Artikel & Konten
          </h2>
          <p className="text-sm text-muted-foreground">Upload file artikel/catatan revisi dan jalankan AI Rework otomatis.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Kolom Kiri: Input */}
          <Card className="p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-4 text-primary" /> Sumber File & Catatan Revisi
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 space-y-4">
              <label className="block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-accent/30 transition-colors">
                <Upload className="size-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">{file ? file.name : "Klik untuk upload file (PDF, Docx, Image, Text)"}</p>
                <p className="text-xs text-muted-foreground mt-1">Maksimal 10MB</p>
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.txt,image/*"
                />
              </label>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Instruksi / Catatan Revisi Manual</label>
                <Textarea 
                  placeholder="Masukkan catatan revisi atau prompt tambahan di sini..."
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>

              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? <span className="animate-pulse">Memproses AI Rework...</span> : <><Sparkles className="size-4 mr-2" /> AI Review & Rework</>}
              </Button>
            </CardContent>
          </Card>

          {/* Kolom Kanan: Hasil */}
          <Card className="p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-base">Hasil Rework</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {!result ? (
                <div className="flex flex-col items-center justify-center h-[320px] text-muted-foreground text-xs text-center border rounded-lg bg-muted/20">
                  <ListChecks className="size-10 mb-2 opacity-30" />
                  <p>Hasil artikel baru, poin perubahan, dan crosscheck akan muncul di sini setelah diproses.</p>
                </div>
              ) : (
                <Tabs defaultValue="article" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="article">Artikel Baru</TabsTrigger>
                    <TabsTrigger value="changes">Poin Perubahan</TabsTrigger>
                    <TabsTrigger value="crosscheck">Crosscheck</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="article" className="p-4 bg-muted/30 rounded-md border text-sm min-h-[260px] whitespace-pre-wrap">
                    {result.article}
                  </TabsContent>
                  
                  <TabsContent value="changes" className="p-4 bg-muted/30 rounded-md border text-sm min-h-[260px] whitespace-pre-wrap">
                    <div className="font-medium text-amber-600 mb-2 flex items-center gap-1.5"><ListChecks className="size-4" /> Daftar Revisi:</div>
                    {result.changes}
                  </TabsContent>
                  
                  <TabsContent value="crosscheck" className="p-4 bg-muted/30 rounded-md border text-sm min-h-[260px] whitespace-pre-wrap">
                    <div className="font-medium text-green-600 mb-2 flex items-center gap-1.5"><CheckCircle className="size-4" /> Hasil Validasi:</div>
                    {result.crosscheck}
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
