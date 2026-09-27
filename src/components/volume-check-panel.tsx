import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BarChart3, Loader2, History, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { checkVolume, listVolumeChecks, type VolumeRow } from "@/lib/volume.functions";

type Props = { projectId: string; keywords: string[]; onResults?: (rows: VolumeRow[]) => void };

const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString("id-ID"));

export function VolumeCheckPanel({ projectId, keywords, onResults }: Props) {
  const run = useServerFn(checkVolume);
  const list = useServerFn(listVolumeChecks);
  const [kwText, setKwText] = useState(keywords.join("\n"));
  const [mode, setMode] = useState<"metrics" | "ideas">("metrics");
  const [maxIdeas, setMaxIdeas] = useState(100);
  const [geo, setGeo] = useState("id");
  const [language, setLanguage] = useState("id");
  const [network, setNetwork] = useState<"GOOGLE_SEARCH" | "GOOGLE_SEARCH_AND_PARTNERS">("GOOGLE_SEARCH");
  const [aiVolume, setAiVolume] = useState(false);
  const [adult, setAdult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<VolumeRow[] | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => setKwText(keywords.join("\n")), [keywords.join("|")]);

  const loadHistory = async () => {
    try { setHistory((await list({ data: { project_id: projectId } })).items); } catch { /* ignore */ }
  };
  useEffect(() => { loadHistory(); }, [projectId]);

  const onRun = async () => {
    const kws = kwText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!kws.length) return toast.error("Isi minimal 1 keyword");
    setLoading(true);
    try {
      const r = await run({ data: { project_id: projectId, keywords: kws, mode, maxIdeas, geo, language, network, aiVolume, includeAdultKeywords: adult } });
      setRows(r.results);
      onResults?.(r.results);
      toast.success(`${r.results.length} keyword berhasil dicek`);
      loadHistory();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!rows) return;
    const head = "keyword,volume,cpc_low,cpc_high,competition,competition_index,ai_volume";
    const body = rows.map((r) => [`"${r.keyword.replace(/"/g, '""')}"`, r.volume ?? "", r.cpcLow ?? "", r.cpcHigh ?? "", r.competition ?? "", r.competitionIndex ?? "", r.aiVolume ?? ""].join(","));
    const url = URL.createObjectURL(new Blob([[head, ...body].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "keyword-volume.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const sorted = rows ? [...rows].sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1)) : null;

  return (
    <section className="rounded-lg border bg-muted/30 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="size-4" />Check Volume Search</h3>
        <span className="text-xs text-muted-foreground">Google Keyword Planner via Apify</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2 space-y-1">
          <label className="text-xs font-medium">Keywords (satu per baris) — {kwText.split("\n").filter((s) => s.trim()).length} keyword</label>
          <Textarea rows={5} value={kwText} onChange={(e) => setKwText(e.target.value)} className="font-mono text-xs" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Mode</label>
          <Select value={mode} onValueChange={(v) => setMode(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="metrics">Metrics (ukur keyword saya)</SelectItem>
              <SelectItem value="ideas">Ideas (kembangkan + ukur)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Max idea rows {mode !== "ideas" && <span className="text-muted-foreground">(mode ideas saja)</span>}</label>
          <Input type="number" min={1} max={10000} value={maxIdeas} disabled={mode !== "ideas"} onChange={(e) => setMaxIdeas(Math.max(1, Number(e.target.value) || 1))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Lokasi (kosong = worldwide)</label>
          <Input value={geo} onChange={(e) => setGeo(e.target.value)} placeholder="id, us, singapore, 2360…" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Bahasa (kosong = semua)</label>
          <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="id, en…" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Network</label>
          <Select value={network} onValueChange={(v) => setNetwork(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="GOOGLE_SEARCH">Google Search</SelectItem>
              <SelectItem value="GOOGLE_SEARCH_AND_PARTNERS">Google Search + partners</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 text-xs pt-5">
          <label className="flex items-center gap-2"><input type="checkbox" checked={aiVolume} onChange={(e) => setAiVolume(e.target.checked)} />Volume AI-assistant (+$0.012/keyword)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />Sertakan keyword dewasa</label>
        </div>
      </div>

      <Button className="w-full" onClick={onRun} disabled={loading}>
        {loading ? <><Loader2 className="size-4 mr-2 animate-spin" />Mengecek volume… (bisa 1–3 menit)</> : <><BarChart3 className="size-4 mr-2" />Check Volume Search</>}
      </Button>

      {sorted && (
        <div className="space-y-2">
          <div className="flex justify-end"><Button size="sm" variant="outline" onClick={exportCsv}><Download className="size-3.5 mr-1.5" />CSV</Button></div>
          <div className="overflow-x-auto rounded-md border bg-card">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">Keyword</th><th className="p-2 text-right">Volume/bln</th><th className="p-2 text-right">CPC (low–high)</th><th className="p-2">Kompetisi</th><th className="p-2">Tren 12 bln</th>{aiVolume && <th className="p-2 text-right">AI</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 font-medium">{r.keyword}</td>
                    <td className="p-2 text-right tabular-nums font-semibold">{fmt(r.volume)}</td>
                    <td className="p-2 text-right tabular-nums">{r.cpcLow === null && r.cpcHigh === null ? "—" : `${r.cpcLow?.toFixed(2) ?? "?"}–${r.cpcHigh?.toFixed(2) ?? "?"}`}</td>
                    <td className="p-2">{r.competition ? <Badge variant="outline" className="text-[10px]">{r.competition}{r.competitionIndex !== null ? ` · ${r.competitionIndex}` : ""}</Badge> : "—"}</td>
                    <td className="p-2"><Spark values={r.trend} /></td>
                    {aiVolume && <td className="p-2 text-right tabular-nums">{fmt(r.aiVolume)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium flex items-center gap-1.5"><History className="size-3.5" />Riwayat cek volume ({history.length})</summary>
          <ul className="mt-2 space-y-1">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 rounded border bg-card px-2 py-1.5">
                <span className="truncate">{new Date(h.created_at).toLocaleString("id-ID")} · {(h.keywords as string[]).length} kw · {h.settings?.geo || "global"}</span>
                {h.status === "done" ? (
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setRows(h.results); onResults?.(h.results); }}>Lihat</Button>
                ) : <Badge variant="outline" className="text-[10px]">{h.status}</Badge>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Spark({ values }: { values: number[] }) {
  if (!values?.length) return <span className="text-muted-foreground">—</span>;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 60},${18 - (v / max) * 16}`).join(" ");
  return <svg width="60" height="20" className="text-primary"><polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts} /></svg>;
}
