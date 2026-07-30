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
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    let cancelled = false;
    (async () => {
      try {
        setFailed(false);
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
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

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

  if (failed) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-2 text-xs"
        onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }}
      >
        <FolderKanban className="size-3.5" /> Muat ulang project
      </Button>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Select value={items.length ? projectId : undefined} onValueChange={setProjectId} disabled={loading}>
        <SelectTrigger className="h-8 w-[150px] min-w-0 text-xs sm:w-[190px]">
          {loading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Memuat…
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-2">
              <FolderKanban className="size-3.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Pilih project" />
            </span>
          )}
        </SelectTrigger>
        <SelectContent>
          {items.map((p) => (
            <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Link to="/projects">
        <Button variant="ghost" size="icon" className="size-8 shrink-0" title="Kelola Projects">
          <Settings className="size-3.5" />
        </Button>
      </Link>
      <Button variant="ghost" size="icon" className="size-8 shrink-0" title="Sign out" onClick={signOut}>
        <LogOut className="size-3.5" />
      </Button>
    </div>
  );
}
