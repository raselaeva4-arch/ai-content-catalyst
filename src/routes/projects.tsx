import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { ArrowLeft, FolderKanban, Plus, Trash2, Loader2, Check, Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listProjects, createProject, updateProject, deleteProject, DEFAULT_PROJECT_ID } from "@/lib/projects.functions";
import { useActiveProject } from "@/hooks/use-active-project";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
  head: () => ({
    meta: [
      { title: "Projects — KeywordForge" },
      { name: "description", content: "Kelola project: tiap project punya knowledge base & transkrip sendiri." },
    ],
  }),
});

type Project = { id: string; name: string; description: string | null; created_at: string };

function ProjectsPage() {
  const router = useRouter();
  const { projectId, setProjectId } = useActiveProject();
  const listFn = useServerFn(listProjects);
  const createFn = useServerFn(createProject);
  const updateFn = useServerFn(updateProject);
  const deleteFn = useServerFn(deleteProject);

  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await listFn();
      setItems(res.items as Project[]);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, []);

  const onCreate = async () => {
    if (!newName.trim()) return toast.error("Nama project wajib diisi");
    setCreating(true);
    try {
      const res = await createFn({ data: { name: newName.trim(), description: newDesc.trim() || null } });
      toast.success(`Project "${res.item.name}" dibuat`);
      setProjectId(res.item.id);
      setNewName(""); setNewDesc("");
      await refresh();
    } catch (e) { toast.error((e as Error).message); }
    finally { setCreating(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="size-4" /></Button></Link>
            <div className="size-9 rounded-lg flex items-center justify-center text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
              <FolderKanban className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Projects</h1>
              <p className="text-xs text-muted-foreground">Tiap project punya knowledge base, transkrip, & history sendiri</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <Card className="p-6 shadow-[var(--shadow-card)] space-y-3">
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-primary" />
            <h2 className="font-semibold">Buat Project Baru</h2>
          </div>
          <div className="grid sm:grid-cols-[1fr_2fr] gap-3">
            <Input placeholder="Nama project (mis: Brand X)" value={newName} onChange={(e) => setNewName(e.target.value)} disabled={creating} />
            <Input placeholder="Deskripsi singkat (opsional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} disabled={creating} />
          </div>
          <div className="flex justify-end">
            <Button onClick={onCreate} disabled={creating || !newName.trim()}>
              {creating ? <><Loader2 className="size-4 mr-1.5 animate-spin" />Membuat...</> : <><Plus className="size-4 mr-1.5" />Buat Project</>}
            </Button>
          </div>
        </Card>

        {loading ? (
          <Card className="p-12 text-center"><Loader2 className="size-6 mx-auto animate-spin text-muted-foreground" /></Card>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">Belum ada project.</Card>
        ) : (
          <div className="space-y-3">
            {items.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                active={p.id === projectId}
                editing={editingId === p.id}
                onActivate={() => { setProjectId(p.id); toast.success(`Project aktif: ${p.name}`); }}
                onEdit={() => setEditingId(p.id)}
                onCancel={() => setEditingId(null)}
                onSave={async (patch) => {
                  try {
                    await updateFn({ data: { id: p.id, ...patch } });
                    toast.success("Tersimpan");
                    setEditingId(null);
                    await refresh();
                  } catch (e) { toast.error((e as Error).message); }
                }}
                onDelete={async () => {
                  if (!confirm(`Hapus "${p.name}"? Semua KB, transkrip, & history project ini akan ikut terhapus.`)) return;
                  try {
                    await deleteFn({ data: { id: p.id } });
                    if (projectId === p.id) setProjectId(DEFAULT_PROJECT_ID);
                    toast.success("Project dihapus");
                    await refresh();
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

function ProjectCard({ project, active, editing, onActivate, onEdit, onCancel, onSave, onDelete }: {
  project: Project;
  active: boolean;
  editing: boolean;
  onActivate: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (p: { name: string; description: string | null }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description ?? "");
  const isDefault = project.id === DEFAULT_PROJECT_ID;

  if (editing) {
    return (
      <Card className="p-5 shadow-[var(--shadow-elevated)] space-y-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Deskripsi" />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel}><X className="size-4 mr-1.5" />Batal</Button>
          <Button onClick={() => onSave({ name: name.trim(), description: desc.trim() || null })}>
            <Save className="size-4 mr-1.5" />Simpan
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-5 shadow-[var(--shadow-card)] ${active ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <FolderKanban className="size-4 text-primary shrink-0" />
            <h3 className="font-semibold truncate">{project.name}</h3>
            {active && <Badge className="text-[10px]">Aktif</Badge>}
            {isDefault && <Badge variant="outline" className="text-[10px]">Default</Badge>}
          </div>
          {project.description && <p className="text-sm text-muted-foreground mt-1.5">{project.description}</p>}
          <p className="text-xs text-muted-foreground mt-1">Dibuat {new Date(project.created_at).toLocaleDateString("id-ID")}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          {!active && (
            <Button variant="outline" size="sm" onClick={onActivate}>
              <Check className="size-3.5 mr-1" />Aktifkan
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onEdit}><Pencil className="size-4" /></Button>
          {!isDefault && (
            <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="size-4 text-destructive" /></Button>
          )}
        </div>
      </div>
    </Card>
  );
}
