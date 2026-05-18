import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TRENDS_BASE = "https://trends.google.com/trends/api";

async function getInterest(keyword: string, geo: string): Promise<number | null> {
  try {
    // Step 1: explore to get token
    const exploreReq = {
      comparisonItem: [{ keyword, geo, time: "today 12-m" }],
      category: 0,
      property: "",
    };
    const exploreUrl = `${TRENDS_BASE}/explore?hl=en-US&tz=-420&req=${encodeURIComponent(JSON.stringify(exploreReq))}`;
    const exploreRes = await fetch(exploreUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!exploreRes.ok) return null;
    const exploreText = await exploreRes.text();
    const exploreJson = JSON.parse(exploreText.replace(/^\)\]\}',?\n?/, ""));
    const widget = exploreJson.widgets?.find((w: any) => w.id === "TIMESERIES");
    if (!widget) return null;

    // Step 2: fetch widget data
    const dataUrl = `${TRENDS_BASE}/widgetdata/multiline?hl=en-US&tz=-420&req=${encodeURIComponent(JSON.stringify(widget.request))}&token=${widget.token}`;
    const dataRes = await fetch(dataUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!dataRes.ok) return null;
    const dataText = await dataRes.text();
    const dataJson = JSON.parse(dataText.replace(/^\)\]\}',?\n?/, ""));
    const points = dataJson.default?.timelineData ?? [];
    if (!points.length) return null;
    // Average interest 0-100
    const avg = points.reduce((s: number, p: any) => s + (p.value?.[0] ?? 0), 0) / points.length;
    return Math.round(avg);
  } catch {
    return null;
  }
}

export const getTrends = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ keywords: z.array(z.string().min(1).max(100)).max(10) }).parse(d))
  .handler(async ({ data }) => {
    const results = await Promise.all(
      data.keywords.map(async (kw) => {
        const [global, id] = await Promise.all([getInterest(kw, ""), getInterest(kw, "ID")]);
        return { keyword: kw, global, indonesia: id };
      }),
    );
    return { trends: results };
  });
