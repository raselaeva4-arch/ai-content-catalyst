import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import {
  ArrowLeft, Sparkles, Mic, Plus, Loader2, Trash2, Pencil, Save, X, Copy, Calendar, FileText, Link2, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  listTranscripts, createTranscript, updateTranscript, deleteTranscript,
} from "@/lib/transcripts.functions";
import { transcribeUrl } from "@/lib/transcribe-url.functions";

type Item = {
  id: string;
  title: string;
  source_type: string;
  source_url: string | null;
  source_path: string | null;
  platform: string | null;
  mime: string | null;
  transcript: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function ErrorComp({ error, reset }: { error: any; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <h1 className="text-xl font-semibold">Terjadi kesalahan</h1>
        <p className="text-sm text-muted-foreground">{error?.message ?? "Gagal memuat transkrip."}</p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => { router.invalidate(); reset(); }}>Coba lagi</Button>
          <Link to="/"><Button variant="outline">Ke Beranda</Button></Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/transcripts")({
  component: TranscriptsPage,
  loader: async () => {
    const res = await listTranscripts();
    return { items: res.items as Item[] };
  },
  errorComponent: ErrorComp,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center">
      <Link to="/"><Button>Ke Beranda</Button></Link>
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Transcripts — KeywordForge" },
      { name: "description", content: "Ekstrak & kelola transkrip dari Reel/TikTok dengan AI." },
    ],
  }),
});

function TranscriptsPage() {
  const router = useRouter();
  const { items } = Route.useLoaderData() as { items: Item[] };
  const transcribeUrlFn = useServerFn(transcribeUrl);
  const createFn = useServerFn(createTranscript);
  const updateFn = useServerFn(updateTranscript);
  const deleteFn = useServerFn(deleteTranscript);

  const [url, setUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const [preview, setPreview] = useState<{
    name: string;
    sourceUrl: string;
    platform: string;
    transcript: string;
  } | null>(null);

  const onExtract = async () => {
    const u = url.trim();
    if (!u) return toast.error("Paste link TikTok atau Instagram Reels dulu.");
    setExtracting(true);
    try {
      const res = await transcribeUrlFn({ data: { url: u } });
      setPreview({
        name: res.name,
        sourceUrl: res.sourceUrl,
        platform: res.platform,
        transcript: res.transcript,
      });
      setUrl("");
      toast.success(`Transkrip dari ${res.platform} selesai — silakan edit sebelum simpan.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />

      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="size-4" /></Button></Link>
            <div className="size-9 rounded-lg flex items-center justify-center text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
              <Mic className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Transcripts</h1>
              <p className="text-xs text-muted-foreground">{items.length} transkrip tersimpan</p>
            </div>
          </div>
          <Link to="/history"><Button variant="outline" size="sm">History Generate</Button></Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Extract panel */}
        <Card className="p-6 shadow-[var(--shadow-card)] space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="font-semibold">Extract Transkrip Baru</h2>
          </div>
          <div className="rounded-lg border bg-accent/20 p-3 text-xs text-muted-foreground">
            Paste link <strong>TikTok</strong> atau <strong>Instagram Reels</strong> publik. AI akan download videonya & transcribe otomatis, lalu simpan ke database.
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="https://www.tiktok.com/@user/video/... atau https://www.instagram.com/reel/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={extracting}
              onKeyDown={(e) => { if (e.key === "Enter") onExtract(); }}
            />
            <Button onClick={onExtract} disabled={extracting || !url.trim()}>
              {extracting ? <><Loader2 className="size-4 mr-1.5 animate-spin" />Extracting...</> : <><Mic className="size-4 mr-1.5" />Extract & Simpan</>}
            </Button>
          </div>
          <div>
            <Button variant="ghost" size="sm" onClick={() => setShowManual((v) => !v)}>
              <Plus className="size-3.5 mr-1.5" />Tambah manual
            </Button>
          </div>
          {showManual && (
            <ManualForm
              onCancel={() => setShowManual(false)}
              onSave={async (payload) => {
                try {
                  await createFn({ data: { ...payload, source_type: "manual" } });
                  toast.success("Transkrip ditambahkan.");
                  setShowManual(false);
                  router.invalidate();
                } catch (e) { toast.error((e as Error).message); }
              }}
            />
          )}
        </Card>

        {/* List */}
        {items.length === 0 ? (
          <Card className="p-12 text-center">
            <Mic className="size-10 mx-auto mb-3 text-muted-foreground" />
            <h2 className="font-semibold mb-1">Belum ada transkrip</h2>
            <p className="text-sm text-muted-foreground">Ekstrak link Reel/TikTok di atas untuk memulai.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <TranscriptCard
                key={it.id}
                item={it}
                editing={editingId === it.id}
                onEdit={() => setEditingId(it.id)}
                onCancel={() => setEditingId(null)}
                onSave={async (patch) => {
                  try {
                    await updateFn({ data: { id: it.id, ...patch } });
                    toast.success("Perubahan disimpan.");
                    setEditingId(null);
                    router.invalidate();
                  } catch (e) { toast.error((e as Error).message); }
                }}
                onDelete={async () => {
                  if (!confirm(`Hapus "${it.title}"?`)) return;
                  try {
                    await deleteFn({ data: { id: it.id } });
                    toast.success("Dihapus.");
                    router.invalidate();
                  } catch (e) { toast.error((e as Error).message); }
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ManualForm({ onCancel, onSave }: {
  onCancel: () => void;
  onSave: (p: { title: string; transcript: string; source_url?: string | null; notes?: string | null }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <div className="space-y-3 border-t pt-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Judul</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul transkrip" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Source URL (opsional)</label>
          <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Transkrip</label>
        <Textarea rows={6} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Paste transkrip di sini..." />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Catatan</label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel}><X className="size-4 mr-1.5" />Batal</Button>
        <Button
          disabled={!title.trim() || !transcript.trim()}
          onClick={() => onSave({
            title: title.trim(),
            transcript: transcript.trim(),
            source_url: sourceUrl.trim() || null,
            notes: notes.trim() || null,
          })}
        >
          <Save className="size-4 mr-1.5" />Simpan
        </Button>
      </div>
    </div>
  );
}

function TranscriptCard({ item, editing, onEdit, onCancel, onSave, onDelete }: {
  item: Item;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: Partial<Item>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [title, setTitle] = useState(item.title);
  const [transcript, setTranscript] = useState(item.transcript);
  const [notes, setNotes] = useState(item.notes ?? "");

  if (editing) {
    return (
      <Card className="p-6 shadow-[var(--shadow-elevated)] space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Judul</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Transkrip</label>
          <Textarea rows={10} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Catatan</label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel}><X className="size-4 mr-1.5" />Batal</Button>
          <Button onClick={() => onSave({ title: title.trim(), transcript, notes: notes || null })}>
            <Save className="size-4 mr-1.5" />Simpan
          </Button>
        </div>
      </Card>
    );
  }

  const PlatformIcon = item.platform === "tiktok" || item.platform === "instagram" ? Video : item.source_type === "url" ? Link2 : FileText;

  return (
    <Card className="p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <PlatformIcon className="size-4 text-primary shrink-0" />
            <h3 className="font-semibold leading-tight truncate">{item.title}</h3>
            {item.platform && <Badge variant="outline" className="text-[10px] capitalize">{item.platform}</Badge>}
            <Badge variant="secondary" className="text-[10px]">{item.transcript.length} chars</Badge>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3" />
            <span>{new Date(item.created_at).toLocaleString("id-ID")}</span>
            {item.source_url && (
              <a href={item.source_url} target="_blank" rel="noreferrer" className="hover:underline truncate max-w-[300px]">
                {item.source_url}
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" title="Salin transkrip" onClick={() => {
            navigator.clipboard.writeText(item.transcript);
            toast.success("Transkrip disalin");
          }}><Copy className="size-4" /></Button>
          <Button variant="ghost" size="icon" onClick={onEdit}><Pencil className="size-4" /></Button>
          <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="size-4 text-destructive" /></Button>
        </div>
      </div>

      <details>
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Lihat transkrip lengkap</summary>
        <p className="text-sm mt-2 whitespace-pre-wrap text-foreground/90 max-h-96 overflow-y-auto bg-muted/40 rounded-md p-3">{item.transcript || "(kosong)"}</p>
      </details>

      {item.notes && (
        <div className="mt-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Catatan:</strong> {item.notes}
        </div>
      )}
    </Card>
  );
}
