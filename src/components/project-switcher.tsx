import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FolderKanban, Settings, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveProject } from "@/hooks/use-active-project";
import { listProjects, createProject } from "@/lib/projects.functions";
import { supabase } from "@/integrations/supabase/client";

type Project = { id: string; name: string };

export function ProjectSwitcher() {
  const { projectId, setProjectId, mounted } = useActiveProject();
  const listFn = useServerFn(listProjects);
  const createFn = useServerFn(createProject);
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await listFn();
        let list = res.items as Project[];
        if (list.length === 0) {
          const created = await createFn({ data: { name: "My Project", description: null } });
          list = [created.item as Project];
        }
        if (cancelled) return;
        setItems(list);
        if (!list.some((p) => p.id === projectId)) setProjectId(list[0].id);
      } catch (e) {
        console.error(e);
        bootstrapped.current = false;
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [listFn, createFn, projectId, setProjectId]);

  // Real-time sync: projects changes
  useEffect(() => {
    const channel = supabase
      .channel("projects-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, async () => {
        const res = await listFn();
        setItems(res.items as Project[]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [listFn]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (!mounted) return null;

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
      <Button variant="ghost" size="icon" className="size-8" title="Sign out" onClick={signOut}>
        <LogOut className="size-3.5" />
      </Button>
    </div>
  );
}
