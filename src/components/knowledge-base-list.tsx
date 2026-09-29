import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bold, Check, Download, Heading2, Italic, List, ListOrdered, Loader2, Pencil, Quote, Underline, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getKbDownloadUrl, updateKb } from "@/lib/kb.functions";

export type KnowledgeBaseItem = {
  id: string;
  type: "playbook" | "persona" | "knowledge" | string;
  title: string;
  content: string;
  source_name?: string | null;
  source_path?: string | null;
  source_mime?: string | null;
};

function sanitizeRichHtml(input: string) {
  const doc = new DOMParser().parseFromString(input, "text/html");
  doc.querySelectorAll("script,iframe,object,embed,style,link").forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith("on") || attr.name.toLowerCase() === "srcdoc") {
        el.removeAttribute(attr.name);
      }
    });
  });
  return doc.body.innerHTML;
}

function toEditorHtml(value: string) {
  const clean = value.trim();
  if (!clean) return "<p></p>";
  if (/<[a-z][\\s\\S]*>/i.test(clean)) return sanitizeRichHtml(clean);
  return clean
    .split(/\\n{2,}/)
    .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\\n/g, "<br>")}</p>`)
    .join("");
}

function RichKnowledgeEditor({
  initialContent,
  onSave,
  saving,
}: {
  initialContent: string;
  onSave: (html: string) => Promise<void>;
  saving: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(() => toEditorHtml(initialContent));

  useEffect(() => {
    setHtml(toEditorHtml(initialContent));
  }, [initialContent]);

  const command = (name: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(name, false, value);
    if (ref.current) setHtml(sanitizeRichHtml(ref.current.innerHTML));
  };

  const finish = async () => {
    await onSave(sanitizeRichHtml(ref.current?.innerHTML || html));
  };

  return (
    <div className="rounded-lg border overflow-hidden bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 p-2">
        <Button type="button" variant="ghost" size="icon" className="size-8" title="Bold" onClick={() => command("bold")}><Bold className="size-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" title="Italic" onClick={() => command("italic")}><Italic className="size-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" title="Underline" onClick={() => command("underline")}><Underline className="size-4" /></Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="icon" className="size-8" title="Heading" onClick={() => command("formatBlock", "h2")}><Heading2 className="size-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" title="Bullet list" onClick={() => command("insertUnorderedList")}><List className="size-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" title="Numbered list" onClick={() => command("insertOrderedList")}><ListOrdered className="size-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" title="Quote" onClick={() => command("formatBlock", "blockquote")}><Quote className="size-4" /></Button>
        <div className="ml-auto">
          <Button type="button" size="sm" onClick={finish} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Check className="size-3.5 mr-1.5" />}
            Selesai & Simpan
          </Button>
        </div>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => setHtml(sanitizeRichHtml(e.currentTarget.innerHTML))}
        dangerouslySetInnerHTML={{ __html: html }}
        className="min-h-[360px] max-h-[60vh] overflow-y-auto p-5 text-sm leading-7 outline-none prose prose-sm max-w-none dark:prose-invert"
      />
    </div>
  );
}

export function KnowledgeBaseList({
  projectId,
  items,
  selectedIds,
  onSelectionChange,
  onUpdated,
  onDelete,
  emptyText = "Belum ada Knowledge Base.",
}: {
  projectId: string;
  items: KnowledgeBaseItem[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onUpdated: (item: KnowledgeBaseItem) => void;
  onDelete?: (id: string) => Promise<void>;
  emptyText?: string;
}) {
  const updateFn = useServerFn(updateKb);
  const downloadFn = useServerFn(getKbDownloadUrl);
  const [editing, setEditing] = useState<KnowledgeBaseItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const toggle = (id: string) => {
    onSelectionChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const saveEdit = async (html: string) => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await updateFn({
        data: {
          id: editing.id,
          project_id: projectId,
          type: (editing.type === "persona" || editing.type === "playbook" || editing.type === "knowledge" ? editing.type : "knowledge"),
          title: editing.title.trim(),
          content: sanitizeRichHtml(html),
        },
      });
      onUpdated(res.item as KnowledgeBaseItem);
      setEditing(null);
      toast.success("Knowledge Base disimpan. Perubahan langsung dipakai AI.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const download = async (item: KnowledgeBaseItem) => {
    setDownloadingId(item.id);
    try {
      const res = await downloadFn({ data: { id: item.id, project_id: projectId } });
      const a = document.createElement("a");
      a.href = res.url;
      a.download = res.filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Download dimulai.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-6">{emptyText}</p>;
  }

  return (
    <>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {items.map((item) => {
          const checked = selectedIds.includes(item.id);
          return (
            <div key={item.id} className="group rounded-md border bg-background p-2.5 transition-colors hover:bg-accent/20">
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  aria-label={checked ? `Jangan pilih ${item.title} untuk AI` : `Pilih ${item.title} untuk AI`}
                  onClick={() => toggle(item.id)}
                  className={`mt-0.5 size-5 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
                >
                  {checked && <Check className="size-3.5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{item.type}</Badge>
                    <span className="text-sm font-medium truncate">{item.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.content}</p>
                  {item.source_name && <p className="text-[10px] text-muted-foreground mt-1 truncate">{item.source_name}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button type="button" variant="outline" size="sm" className="h-8 px-2" title="Edit Knowledge" onClick={() => setEditing(item)}>
                    <Pencil className="size-3.5 mr-1" /><span>Edit</span>
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-8 px-2" title="Download File" onClick={() => download(item)} disabled={downloadingId === item.id}>
                    {downloadingId === item.id ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />}
                    <span>Download</span>
                  </Button>
                  {onDelete && (
                    <Button type="button" variant="ghost" size="icon" className="size-8" title="Hapus Knowledge" onClick={() => void onDelete(item.id)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground mt-2">
        Centang <strong>Pilih</strong> untuk menjadikan file ini konteks AI. <strong>Edit</strong> membuka Rich Text Editor dan <strong>Download</strong> mengambil file asli/versi HTML.
      </p>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open && !saving) setEditing(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Knowledge Base</DialogTitle>
            <DialogDescription>
              Edit isi file/knowledge langsung. Setelah disimpan, versi terbaru menjadi konteks AI project ini.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Judul" />
                <Select value={editing.type === "persona" || editing.type === "playbook" || editing.type === "knowledge" ? editing.type : "knowledge"} onValueChange={(v) => setEditing({ ...editing, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="playbook">Playbook</SelectItem>
                    <SelectItem value="persona">Persona</SelectItem>
                    <SelectItem value="knowledge">Knowledge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <RichKnowledgeEditor key={editing.id} initialContent={editing.content} saving={saving} onSave={saveEdit} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
