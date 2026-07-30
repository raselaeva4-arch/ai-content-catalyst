import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Code2, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildFullHtmlDocument,
  markdownToGutenberg,
  markdownToHtml,
} from "@/lib/markdown-to-html";

export type HtmlExportArticle = {
  title: string;
  slug?: string | null;
  meta_description?: string | null;
  main_keyword?: string | null;
  secondary_keywords?: string[] | null;
  content: string;
};

export function HtmlExportDialog({
  article,
  trigger,
}: {
  article: HtmlExportArticle;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const normalized = useMemo(
    () => ({
      title: article.title,
      slug: article.slug ?? undefined,
      meta_description: article.meta_description ?? undefined,
      main_keyword: article.main_keyword ?? undefined,
      secondary_keywords: article.secondary_keywords ?? [],
      content: article.content ?? "",
    }),
    [article],
  );

  const outputs = useMemo(
    () => ({
      gutenberg: markdownToGutenberg(normalized.content),
      classic: markdownToHtml(normalized.content),
      full: buildFullHtmlDocument(normalized),
    }),
    [normalized],
  );

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("HTML disalin. Tempel di editor WordPress.");
    } catch {
      toast.error("Gagal menyalin. Salin manual dari kotak teks.");
    }
  }

  function download(text: string) {
    const blob = new Blob([text], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${normalized.slug || "artikel"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const panels: { key: keyof typeof outputs; label: string; hint: string }[] = [
    {
      key: "gutenberg",
      label: "WordPress (Blok)",
      hint: "Tempel di editor blok WordPress (Gutenberg) — blok otomatis terbentuk.",
    },
    {
      key: "classic",
      label: "HTML Biasa",
      hint: "Untuk Classic Editor / tab Text, Elementor HTML widget, atau CMS lain.",
    },
    {
      key: "full",
      label: "Dokumen Lengkap",
      hint: "Dokumen HTML penuh dengan title & meta description — cocok untuk diunduh.",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Code2 className="mr-1.5 size-3.5" />
            HTML
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Export HTML — WordPress</DialogTitle>
          <DialogDescription className="line-clamp-1">{normalized.title}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="gutenberg">
          <TabsList className="grid w-full grid-cols-3">
            {panels.map((p) => (
              <TabsTrigger key={p.key} value={p.key}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {panels.map((p) => (
            <TabsContent key={p.key} value={p.key} className="space-y-3">
              <p className="text-xs text-muted-foreground">{p.hint}</p>
              <Textarea
                readOnly
                rows={16}
                value={outputs[p.key]}
                className="font-mono text-[11px] leading-5"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => download(outputs[p.key])}>
                  <Download className="mr-1.5 size-3.5" />
                  Unduh .html
                </Button>
                <Button size="sm" onClick={() => copy(outputs[p.key])}>
                  <Copy className="mr-1.5 size-3.5" />
                  Salin HTML
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
