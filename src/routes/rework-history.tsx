import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { ArrowLeft, Pencil, Trash2, Save, X, Sparkles, FileText, Calendar, Eye, Loader2, RefreshCw, CheckCircle2, FileEdit, Link2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listReworks, updateRework, deleteRework } from "@/lib/rework.functions";
import { useActiveProject } from "@/hooks/use-active-project";
import { ProjectSwitcher } from "@/components/project-switcher";

function ReworkHistoryErrorComponent({ error, reset }: { error: any; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-xl font-semibold">Terjadi kesalahan</h1>
        <p className="text-sm text-muted-foreground">{error?.message ?? "Gagal memuat rework."}</p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => reset()}>Coba lagi</Button>
          <Link to="/rework"><Button variant="outline">Ke Rework</Button></Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/rework-history")({
  component: ReworkHistoryPage,
  errorComponent: ReworkHistoryErrorComponent,
  head: () => ({
    meta: [
      { title: "Riwayat Rework Artikel — Arsjad Rasjid Persona Engine" },
      { name: "description", content: "Daftar artikel rework yang telah disimpan ke database." },
    ],
  }),
});

type ReworkItem = {
  id: string;
  project_id: string;
  title: string;
  source_type: string;
  source_path: string | null;
  source_name: string | null;
  source_mime: string | null;
  original_content: string;
  revision_notes: any[];
  revision_notes_text: string;
  manual_prompt: string;
  reworked_content: string;
  reworked_title: string | null;
  changes: any[];
  crosscheck: any;
  status: string;
  created_at: string;
  updated_at: string;
};

function ReworkHistoryPage() {
  const { projectId } = useActiveProject();
  const listFn = useServerFn(listReworks);
  const updateFn = useServerFn(updateRework);
  const deleteFn = useServerFn(deleteRework);
  const [items, setItems] = useState<ReworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = async () => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await listFn({ data: { project_id: projectId } });
      setItems(res.items as ReworkItem[]);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [projectId]);

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/rework">
              <Button variant="ghost" size="icon"><ArrowLeft className="size-4" /></Button>
            </Link>
            <div className="size-9 rounded-lg flex items-center justify-center text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
              <FileEdit className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Riwayat Rework Artikel</h1>
              <p className="text-xs text-muted-foreground">{items.length} rework tersimpan di project ini</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ProjectSwitcher />
            <Button variant="ghost" size="icon" onClick={refresh} title="Muat ulang"><RefreshCw className="size-4" /></Button>
            <Link to="/rework"><Button variant="outline" size="sm">+ Rework Baru</Button></Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-4">
        {loading ? (
          <Card className="p-12 text-center"><Loader2 className="size-6 mx-auto animate-spin text-muted-foreground" /></Card>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="size-10 mx-auto mb-3 text-muted-foreground" />
            <h2 className="font-semibold mb-1">Belum ada rework tersimpan</h2>
            <p className="text-sm text-muted-foreground mb-4">Rework artikel lalu simpan dari halaman Rework.</p>
            <Link to="/rework"><Button>Buat Rework</Button></Link>
          </Card>
        ) : (
          items.map((item) => (
            <ReworkCard
              key={item.id}
              item={item}
              editing={editingId === item.id}
              expanded={expandedId === item.id}
              onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onEdit={() => setEditingId(item.id)}
              onCancel={() => setEditingId(null)}
              onSave={async (patch) => {
                try {
                  await updateFn({ data: { id: item.id, ...patch } });
                  toast.success("Perubahan disimpan");
                  setEditingId(null);
                  await refresh();
                } catch (e) { toast.error((e as Error).message); }
              }}
              onDelete={async () => {
                if (!confirm(`Hapus "${item.title}"?`)) return;
                try {
                  await deleteFn({ data: { id: item.id } });
                  toast.success("Dihapus");
                  await refresh();
                } catch (e) { toast.error((e as Error).message); }
              }}
            />
          ))
        )}
      </main>
    </div>
  );
}

function SourceBadge({ item }: { item: ReworkItem }) {
  if (item.source_type === "gdoc" || (item.source_path ?? "").includes("docs.google")) {
    return <Badge variant="secondary" className="text-[10px] gap-1"><Link2 className="size-3" />Google Doc</Badge>;
  }
  if (item.source_type === "upload" || item.source_path) {
    return <Badge variant="secondary" className="text-[10px] gap-1"><Upload className="size-3" />{item.source_name || "File"}</Badge>;
  }
  return <Badge variant="outline" className="text-[10px]">Paste</Badge>;
}

function ReworkCard({ item, editing, expanded, onToggleExpand, onEdit, onCancel, onSave, onDelete }: {
  item: ReworkItem;
  editing: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: Partial<ReworkItem>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [title, setTitle] = useState(item.title);
  const [status, setStatus] = useState(item.status);
  const [manualPrompt, setManualPrompt] = useState(item.manual_prompt);
  const [reworkedContent, setReworkedContent] = useState(item.reworked_content);

  const changesCount = Array.isArray(item.changes) ? item.changes.length : 0;
  const notesCount = Array.isArray(item.revision_notes) ? item.revision_notes.length : 0;
  const crosscheckScore = item.crosscheck?.score ?? null;
  const wordCount = item.reworked_content.trim() ? item.reworked_content.trim().split(/\s+/).length : 0;

  if (editing) {
    return (
      <Card className="p-6 shadow-[var(--shadow-elevated)] space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Judul</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="final">Final</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Prompt Manual</label>
          <Textarea rows={3} value={manualPrompt} onChange={(e) => setManualPrompt(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Artikel Hasil Rework</label>
          <Textarea rows={10} value={reworkedContent} onChange={(e) => setReworkedContent(e.target.value)} className="font-mono text-xs" />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel}><X className="size-4 mr-1.5" />Batal</Button>
          <Button onClick={() => onSave({
            title: title.trim(),
            status: status as "draft" | "final",
            manual_prompt: manualPrompt,
            reworked_content: reworkedContent,
          })}><Save className="size-4 mr-1.5" />Simpan</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-lg leading-tight">{item.reworked_title || item.title}</h3>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">
            <Calendar className="size-3" />
            <span>{new Date(item.created_at).toLocaleString("id-ID")}</span>
            <Badge variant={item.status === "final" ? "default" : "outline"} className="text-[10px]">
              {item.status === "final" ? (<><CheckCircle2 className="size-3 mr-1" />Final</>) : "Draft"}
            </Badge>
            <SourceBadge item={item} />
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onToggleExpand} title={expanded ? "Tutup" : "Lihat detail"}>
            <Eye className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit}><Pencil className="size-4" /></Button>
          <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="size-4 text-destructive" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-center">
        <div className="rounded-lg bg-muted/40 p-2">
          <div className="text-lg font-semibold">{wordCount}</div>
          <div className="text-[10px] text-muted-foreground">Kata</div>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <div className="text-lg font-semibold">{notesCount}</div>
          <div className="text-[10px] text-muted-foreground">Catatan Revisi</div>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <div className="text-lg font-semibold">{changesCount}</div>
          <div className="text-[10px] text-muted-foreground">Perubahan</div>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <div className="text-lg font-semibold">{crosscheckScore ?? "—"}</div>
          <div className="text-[10px] text-muted-foreground">Skor Crosscheck</div>
        </div>
      </div>

      {item.crosscheck?.verdict && (
        <p className="text-sm text-muted-foreground italic mb-2">"{item.crosscheck.verdict}"</p>
      )}

      {expanded && (
        <div className="mt-4 pt-4 border-t space-y-4">
          {item.manual_prompt && (
            <section>
              <div className="text-xs font-semibold mb-1.5">Prompt Manual</div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md bg-muted/40 p-3">{item.manual_prompt}</p>
            </section>
          )}
          {notesCount > 0 && (
            <section>
              <div className="text-xs font-semibold mb-1.5">Catatan Revisi ({notesCount})</div>
              <ul className="space-y-1.5">
                {(item.revision_notes ?? []).map((n: any, i: number) => (
                  <li key={i} className="text-sm rounded-md bg-muted/30 p-2">
                    {n.location && <div className="text-xs text-muted-foreground mb-0.5">Bagian: "{String(n.location).slice(0, 120)}{String(n.location).length > 120 ? "…" : ""}"</div>}
                    <div>{String(n.note)}</div>
                    {n.author && <div className="text-[10px] text-muted-foreground mt-0.5">— {n.author}{n.commented_at ? ` · ${new Date(n.commented_at).toLocaleString("id-ID")}` : ""}</div>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {changesCount > 0 && (
            <section>
              <div className="text-xs font-semibold mb-1.5">Poin Perubahan ({changesCount})</div>
              <div className="space-y-2">
                {(item.changes ?? []).map((c: any, i: number) => (
                  <div key={i} className="rounded-md border border-border/60 overflow-hidden">
                    <div className="grid grid-cols-2 divide-x divide-border/60">
                      <div className="p-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-1">Before</div>
                        <div className="text-sm whitespace-pre-wrap break-words text-red-700 dark:text-red-300 line-through decoration-red-500/60">
                          {c.before ? String(c.before) : <span className="text-muted-foreground italic">— kosong —</span>}
                        </div>
                      </div>
                      <div className="p-2 bg-sky-50 dark:bg-sky-950/30">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300 mb-1">After</div>
                        <div className="text-sm whitespace-pre-wrap break-words text-sky-800 dark:text-sky-200">
                          {c.after ? String(c.after) : <span className="text-muted-foreground italic">— kosong —</span>}
                        </div>
                      </div>
                    </div>
                    {(c.section || c.reason || c.kind) && (
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 border-t border-border/60 text-[11px] text-muted-foreground">
                        {c.kind && <Badge variant="outline" className="text-[10px] capitalize">{String(c.kind)}</Badge>}
                        {c.section && <span className="truncate">§ {String(c.section)}</span>}
                        {c.reason && <span className="italic truncate">— {String(c.reason).slice(0, 120)}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          <section>
            <div className="text-xs font-semibold mb-1.5">Artikel Hasil Rework</div>
            <pre className="text-xs whitespace-pre-wrap rounded-md bg-muted/40 p-3 max-h-80 overflow-auto font-sans">{item.reworked_content}</pre>
          </section>
        </div>
      )}
    </Card>
  );
}
