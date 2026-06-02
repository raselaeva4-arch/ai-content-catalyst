import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PROJECT_ID } from "@/lib/projects.functions";

const STORAGE_KEY = "activeProjectId";
const EVENT = "active-project-changed";

function readStored(): string {
  if (typeof window === "undefined") return DEFAULT_PROJECT_ID;
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_PROJECT_ID;
  } catch {
    return DEFAULT_PROJECT_ID;
  }
}

export function useActiveProject() {
  const [projectId, setProjectIdState] = useState<string>(DEFAULT_PROJECT_ID);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setProjectIdState(readStored());
    setMounted(true);
    const handler = () => setProjectIdState(readStored());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setProjectId = useCallback((id: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    setProjectIdState(id);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { projectId, setProjectId, mounted };
}
