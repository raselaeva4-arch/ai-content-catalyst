/**
 * Convert artikel markdown menjadi HTML siap tempel ke WordPress (Gutenberg/Classic).
 * Output sengaja "bersih": hanya tag semantik standar, tanpa class/style.
 */

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(text: string) {
  let out = escapeHtml(text);
  // link [teks](url)
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  // bold + italic
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  // inline code
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out.trim();
}

export function markdownToHtml(markdown: string, opts?: { includeH1?: boolean }): string {
  const includeH1 = opts?.includeH1 ?? false;
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];

  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      html.push(
        `<${list.type}>\n${list.items.map((i) => `  <li>${inline(i)}</li>`).join("\n")}\n</${list.type}>`,
      );
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      html.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
      quote = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flushAll();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      if (level === 1 && !includeH1) continue;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushAll();
      html.push("<hr />");
      continue;
    }

    if (line.startsWith(">")) {
      flushParagraph();
      flushList();
      quote.push(line.replace(/^>\s?/, ""));
      continue;
    }

    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    const ul = line.match(/^[-*+]\s+(.*)$/);
    if (ol || ul) {
      flushParagraph();
      flushQuote();
      const type = ol ? "ol" : "ul";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((ol ? ol[1] : ul![1]).trim());
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line);
  }

  flushAll();
  return html.join("\n\n");
}

/** Versi blok Gutenberg (punya komentar <!-- wp:... -->) */
export function markdownToGutenberg(markdown: string, opts?: { includeH1?: boolean }): string {
  const html = markdownToHtml(markdown, opts);
  if (!html) return "";
  return html
    .split("\n\n")
    .map((block) => {
      if (block.startsWith("<p>")) return `<!-- wp:paragraph -->\n${block}\n<!-- /wp:paragraph -->`;
      const h = block.match(/^<h([1-6])>/);
      if (h)
        return `<!-- wp:heading {"level":${h[1]}} -->\n${block}\n<!-- /wp:heading -->`;
      if (block.startsWith("<ul>")) return `<!-- wp:list -->\n${block}\n<!-- /wp:list -->`;
      if (block.startsWith("<ol>"))
        return `<!-- wp:list {"ordered":true} -->\n${block}\n<!-- /wp:list -->`;
      if (block.startsWith("<blockquote>"))
        return `<!-- wp:quote -->\n${block}\n<!-- /wp:quote -->`;
      if (block.startsWith("<hr"))
        return `<!-- wp:separator -->\n${block}\n<!-- /wp:separator -->`;
      return block;
    })
    .join("\n\n");
}

/** Dokumen HTML lengkap + SEO meta, untuk diunduh sebagai file .html */
export function buildFullHtmlDocument(a: {
  title: string;
  meta_description?: string;
  slug?: string;
  main_keyword?: string;
  secondary_keywords?: string[];
  content: string;
}) {
  const keywords = [a.main_keyword, ...(a.secondary_keywords ?? [])].filter(Boolean).join(", ");
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(a.title)}</title>
${a.meta_description ? `<meta name="description" content="${escapeHtml(a.meta_description)}" />` : ""}
${keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}" />` : ""}
</head>
<body>
<article>
<h1>${escapeHtml(a.title)}</h1>

${markdownToHtml(a.content)}
</article>
</body>
</html>`;
}
