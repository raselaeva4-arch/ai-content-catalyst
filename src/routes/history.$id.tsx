import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast, Toaster } from "sonner";
import { ArrowLeft, Calendar, Clock, FileText, Hash, Link2, Lightbulb, Sparkles, Trash2, Pencil, Eye, Upload, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getHistoryById, deleteHistory } from "@/lib/history.functions";

function ErrorComponent({ error, reset }: { error: any; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-xl font-semibold">Terjadi kesalahan</h1>
        <p className="text-sm text-muted-foreground">{error?.message ?? "Gagal memuat detail."}</p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => { router.invalidate(); reset(); }}>Coba lagi</Button>
          <Link to="/history"><Button variant="outline">Kembali ke History</Button></Link>
        </div>
      </div>
    </div>
  );
}

function NotFoundComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-xl font-semibold">Data tidak ditemukan</h1>
        <p className="text-sm text-muted-foreground">Riwayat yang Anda cari tidak ada atau sudah dihapus.</p>
        <Link to="/history"><Button>Kembali ke History</Button></Link>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/history/$id")({
  component: DetailPage,
  loader: async ({ params }) => {
    const res = await getHistoryById({ data: { id: params.id } });
    return { item: res.item };
  },
  errorComponent: ErrorComponent,
  notFoundComponent: NotFoundComponent,
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.item?.title ?? "Detail"} — History` },
      { name: "description", content: "Detail hasil generate keyword & judul artikel." },
    ],
  }),
});

type Item = {
  id: string;
  title: string;
  category: string | null;
  summary: string | null;
  main_keywords: any[];
  secondary_keywords: any[];
  article_titles: any[];
  extracted: Record<string, any>;
  notes: string | null;
  source_inputs: Record<string, any>;
  created_at: string;
  updated_at: string;
};

function DetailPage() {
  const router = useRouter();
  const { item } = Route.useLoaderData() as { item: Item };
  const deleteFn = useServerFn(deleteHistory);

  const onDelete = async () => {
    if (!confirm(`Hapus "${item.title}"?`)) return;
    try {
      await deleteFn({ data: { id: item.id } });
      toast.success("Dihapus");
      router.navigate({ to: "/history" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const mainKws = item.main_keywords ?? [];
  const secKws = item.secondary_keywords ?? [];
  const titles = item.article_titles ?? [];
  const extracted = item.extracted ?? {};
  const sources = item.source_inputs ?? {};

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />

      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-1 flex-1">
            <Link to="/history">
              <Button variant="ghost" size="icon"><ArrowLeft className="size-4" /></Button>
            </Link>
            <div className="size-9 rounded-lg flex items-center justify-center text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
              <Eye className="size-5" />
            </div>
            <div className="min-w-1">
              <h1 className="text-lg font-semibold tracking-tight truncate">{item.title}</h1>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <Calendar className="size-3" />
                <span>{new Date(item.created_at).toLocaleString("id-ID")}</span>
                {item.category && <Badge variant="outline" className="text-[10px]">{item.category}</Badge>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/history">
              <Button variant="outline" size="sm"><ArrowLeft className="size-3.5 mr-1.5" />Kembali</Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="size-4 text-destructive" /></Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Ringkasan */}
        <Card className="p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="size-4 text-primary" />
            <h2 className="font-semibold">Ringkasan</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {item.summary ?? "Tidak ada ringkasan."}
          </p>
        </Card>

        {/* Main Keywords */}
        <Card className="p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="size-4 text-primary" />
            <h2 className="font-semibold">Main Keywords</h2>
          </div>
          <div className="space-y-3">
            {mainKws.length === 0 && (
              <p className="text-sm text-muted-foreground">Tidak ada main keywords.</p>
            )}
            {mainKws.map((k: any, i: number) => (
              <div key={i} className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-1 flex-1">
                    <div className="font-medium">{typeof k === "string" ? k : k.keyword}</div>
                    {typeof k !== "string" && k.rationale && (
                      <div className="text-xs text-muted-foreground mt-0.5">{k.rationale}</div>
                    )}
                  </div>
                  {typeof k !== "string" && k.intent && (
                    <Badge variant="outline" className="text-xs">{k.intent}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Secondary Keywords */}
        <Card className="p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 mb-3">
            <Hash className="size-4 text-primary" />
            <h2 className="font-semibold">Secondary Keywords</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {secKws.length === 0 ? (
              <span className="text-sm text-muted-foreground">Tidak ada secondary keywords.</span>
            ) : (
              secKws.map((k: any, i: number) => (
                <Badge key={i} variant="secondary" className="font-normal">{String(k)}</Badge>
              ))
            )}
          </div>
        </Card>

        {/* Judul Artikel */}
        <Card className="p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="size-4 text-primary" />
            <h2 className="font-semibold">Judul Artikel</h2>
          </div>
          {titles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada judul artikel.</p>
          ) : (
            <ol className="space-y-2 list-decimal list-inside">
              {titles.map((t: any, i: number) => (
                <li key={i} className="text-sm pl-1">{String(t)}</li>
              ))}
            </ol>
          )}
        </Card>

        {/* Extracted Data */}
        {extracted && Object.keys(extracted).length > 0 && (
          <Card className="p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="size-4 text-primary" />
              <h2 className="font-semibold">Hasil Ekstraksi Konten</h2>
            </div>
            <div className="space-y-4">
              {Array.isArray(extracted.captions) && extracted.captions.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Captions / Transkrip</h3>
                  <ul className="space-y-1">
                    {extracted.captions.map((c: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground">{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(extracted.hashtags) && extracted.hashtags.length > 1 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Hashtags</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {extracted.hashtags.map((h: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs font-normal">{h}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(extracted.comments_themes) && extracted.comments_themes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Tema Komentar</h3>
                  <ul className="space-y-1">
                    {extracted.comments_themes.map((c: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground">{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(extracted.key_topics) && extracted.key_topics.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Topik Kunci</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {extracted.key_topics.map((t: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs font-normal">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {/* Fallback for unknown keys */}
              {Object.entries(extracted)
                .filter(([key]) => !["captions", "hashtags", "comments_themes", "key_topics"].includes(key))
                .map(([key, value]) => (
                  <div key={key}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{key}</h3>
                    <pre className="text-xs bg-muted/50 rounded-md p-2 overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>
                  </div>
                ))}
            </div>
          </Card>
        )}

        {/* Sumber Input */}
        <Card className="p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="size-4 text-primary" />
            <h2 className="font-semibold">Sumber Input</h2>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            {Array.isArray(sources.urls) && sources.urls.length > 0 && (
              <div>
                <span className="font-medium text-foreground">URLs:</span>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {sources.urls.map((u: string, i: number) => (
                    <li key={i} className="break-all">{u}</li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(sources.files) && sources.files.length > 0 && (
              <div>
                <span className="font-medium text-foreground">Files:</span>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {sources.files.map((f: string, i: number) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {!(Array.isArray(sources.urls) && sources.urls.length > 0) && !(Array.isArray(sources.files) && sources.files.length > 0) && (
              <span>Tidak ada sumber input tercatat.</span>
            )}
          </div>
        </Card>

        {/* Notes */}
        {item.notes && (
          <Card className="p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="size-4 text-primary" />
              <h2 className="font-semibold">Catatan</h2>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
          </Card>
        )}
      </main>
    </div>
  );
}
