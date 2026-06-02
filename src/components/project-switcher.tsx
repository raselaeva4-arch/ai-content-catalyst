import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FolderKanban, Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveProject } from "@/hooks/use-active-project";
import { listProjects, DEFAULT_PROJECT_ID } from "@/lib/projects.functions";

type Project = { id: string; name: string };

export function ProjectSwitcher() {
  const { projectId, setProjectId, mounted } = useActiveProject();
  const listFn = useServerFn(listProjects);
  const [items, setItems] = useState<Project[]>([{ id: DEFAULT_PROJECT_ID, name: "Default Project" }]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listFn()
      .then((res) => { if (!cancelled) setItems(res.items as Project[]); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [listFn]);

  // If active project no longer exists, fall back to default
  useEffect(() => {
    if (!loading && mounted && !items.some((p) => p.id === projectId)) {
      setProjectId(DEFAULT_PROJECT_ID);
    }
  }, [items, loading, mounted, projectId, setProjectId]);

  return (
    <div className="flex items-center gap-2">
      <FolderKanban className="size-3.5 text-muted-foreground" />
      <Select value={projectId} onValueChange={setProjectId}>
        <SelectTrigger className="h-8 w-[180px] text-xs">
          {loading ? <Loader2 className="size-3 animate-spin" /> : <SelectValue />}
        </SelectTrigger>
        <SelectContent>
          {items.map((p) => (
            <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Link to="/projects">
        <Button variant="ghost" size="icon" className="size-8" title="Kelola Projects">
          <Settings className="size-3.5" />
        </Button>
      </Link>
    </div>
  );
}
