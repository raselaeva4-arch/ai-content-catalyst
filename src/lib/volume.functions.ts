import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { publicAccess } from "@/lib/public-access";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/apify";
const ACTOR_ID = "aitorsm~keyword-volume";

const InputSchema = z.object({
  project_id: z.string().uuid(),
  keywords: z.array(z.string().trim().min(1).max(200)).min(1).max(200),
  mode: z.enum(["metrics", "ideas"]).default("metrics"),
  maxIdeas: z.number().int().min(1).max(10000).default(100),
  geo: z.string().trim().max(60).default(""),
  language: z.string().trim().max(60).default(""),
  network: z.enum(["GOOGLE_SEARCH", "GOOGLE_SEARCH_AND_PARTNERS"]).default("GOOGLE_SEARCH"),
  aiVolume: z.boolean().default(false),
  includeAdultKeywords: z.boolean().default(false),
});

export type VolumeRow = {
  keyword: string;
  volume: number | null;
  cpcLow: number | null;
  cpcHigh: number | null;
  competition: string | null;
  competitionIndex: number | null;
  aiVolume: number | null;
  trend: number[];
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function pick(o: Record<string, any>, keys: string[]) {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
}

function normalize(item: Record<string, any>): VolumeRow {
  const monthly = pick(item, ["monthlySearchVolumes", "monthlySearches", "trend", "monthly"]) ?? [];
  const trend = Array.isArray(monthly)
    ? monthly.map((m: any) => num(typeof m === "object" ? pick(m, ["volume", "searches", "monthlySearches", "value"]) : m) ?? 0)
    : [];
  const ai = pick(item, ["aiVolume", "aiSearchVolume", "ai_volume"]);
  return {
    keyword: String(pick(item, ["keyword", "text", "term"]) ?? ""),
    volume: num(pick(item, ["searchVolume", "avgMonthlySearches", "volume", "search_volume"])),
    cpcLow: num(pick(item, ["lowTopOfPageBid", "cpcLow", "lowBid", "low_top_of_page_bid"])),
    cpcHigh: num(pick(item, ["highTopOfPageBid", "cpcHigh", "highBid", "cpc", "high_top_of_page_bid"])),
    competition: (pick(item, ["competition", "competitionLevel"]) as string) ?? null,
    competitionIndex: num(pick(item, ["competitionIndex", "competition_index"])),
    aiVolume: num(typeof ai === "object" && ai ? pick(ai, ["volume", "current", "value"]) : ai),
    trend,
  };
}

export const checkVolume = createServerFn({ method: "POST" })
  .middleware([publicAccess])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const apifyKey = process.env.APIFY_API_KEY;
    if (!apifyKey) throw new Error("Koneksi Apify belum tersambung");

    const keywords = Array.from(new Set(data.keywords.map((k) => k.toLowerCase())));
    const input: Record<string, string | number | boolean | string[]> = {
      keywords,
      mode: data.mode,
      network: data.network,
      aiVolume: data.aiVolume,
      includeAdultKeywords: data.includeAdultKeywords,
    };
    if (data.mode === "ideas") input.maxIdeas = data.maxIdeas;
    if (data.geo) input.geo = data.geo;
    if (data.language) input.language = data.language;

    const settings: Record<string, string | number | boolean> = { ...(input as any) };
    delete (settings as any).keywords;

    const { data: row } = await context.supabase
      .from("keyword_volume_checks")
      .insert({ project_id: data.project_id, keywords, settings, status: "running" })
      .select("id")
      .single();

    const res = await fetch(`${GATEWAY_URL}/acts/${ACTOR_ID}/run-sync-get-dataset-items?timeout=280`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apifyKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Apify request failed [${res.status}]: ${body}`);
      const msg = `Apify error ${res.status}: ${body.slice(0, 300)}`;
      if (row?.id) await context.supabase.from("keyword_volume_checks").update({ status: "error", error: msg }).eq("id", row.id);
      throw new Error(msg);
    }

    const items = (await res.json()) as Record<string, any>[];
    const results = (Array.isArray(items) ? items : []).map(normalize).filter((r) => r.keyword);

    if (row?.id) {
      await context.supabase
        .from("keyword_volume_checks")
        .update({ status: "done", results: results as any })
        .eq("id", row.id);
    }
    return { id: row?.id ?? null, results, settings, status: "done" as const };
  });

export const listVolumeChecks = createServerFn({ method: "POST" })
  .middleware([publicAccess])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("keyword_volume_checks")
      .select("id,keywords,settings,results,status,error,created_at")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: false })
      .limit(20);
    return { items: (rows ?? []) as any[] };
  });
