import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "create_knowledge_base_entry",
  title: "Create knowledge base entry",
  description: "Add a new knowledge base entry (title + content) to a project for the signed-in user.",
  inputSchema: {
    project_id: z.string().uuid().describe("Project UUID to add the entry to."),
    title: z.string().min(1).describe("Short title for the KB entry."),
    content: z.string().min(1).describe("Full text content of the KB entry."),
    category: z.string().optional().describe("Optional category label."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ project_id, title, content, category }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("knowledge_base")
      .insert({ project_id, title, content, category: category ?? null, user_id: ctx.getUserId() })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created KB entry ${data.id}` }],
      structuredContent: { entry: data },
    };
  },
});
