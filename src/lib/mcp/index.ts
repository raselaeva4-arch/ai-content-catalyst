import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjects from "./tools/list-projects";
import listKnowledgeBase from "./tools/list-knowledge-base";
import listTranscripts from "./tools/list-transcripts";
import listSavedGenerations from "./tools/list-saved-generations";
import getSavedGeneration from "./tools/get-saved-generation";
import createKnowledgeBaseEntry from "./tools/create-knowledge-base-entry";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "keyword-explorer-mcp",
  title: "Ebran Keyword Explorer MCP",
  version: "0.1.0",
  instructions:
    "Tools for the signed-in user's Keyword Explorer workspace: list projects, browse knowledge base entries, read transcripts, and review saved keyword/title generations. Use `list_projects` first to get a project_id, then pass it to list_knowledge_base, list_transcripts, or list_saved_generations.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listProjects,
    listKnowledgeBase,
    listTranscripts,
    listSavedGenerations,
    getSavedGeneration,
    createKnowledgeBaseEntry,
  ],
});
