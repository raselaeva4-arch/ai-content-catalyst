import { useEffect, useRef } from "react";
import {
  Bold,
  Check,
  Code,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  Undo2,
  Underline,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdownToHtml(value: string) {
  let text = escapeHtml(value);
  const codeTokens: string[] = [];

  text = text.replace(/\`([^\`]+)\`/g, (_, code) => {
    const token = `%%INLINE_CODE_${codeTokens.length}%%`;
    codeTokens.push(`<code>${code}</code>`);
    return token;
  });

  text = text.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" />');
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  text = text.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  text = text.replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, "<u>$1</u>");
  text = text.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  text = text.replace(/_([^_\n]+)_/g, "<em>$1</em>");

  codeTokens.forEach((token, index) => {
    text = text.replace(`%%INLINE_CODE_${index}%%`, token);
  });
  return text;
}

export function sanitizeRichHtml(html: string) {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const forbidden = doc.querySelectorAll("script, iframe, object, embed, style, link, meta, base, form");
  forbidden.forEach((node) => node.remove());

  const allowed = new Set([
    "P", "DIV", "BR", "H1", "H2", "H3", "H4", "H5", "H6",
    "STRONG", "B", "EM", "I", "U", "S", "DEL", "BLOCKQUOTE",
    "UL", "OL", "LI", "A", "CODE", "PRE", "HR",
  ]);

  doc.body.querySelectorAll("*").forEach((element) => {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;
      if (name.startsWith("on") || name === "style" || name === "class" || name === "id") {
        element.removeAttribute(attribute.name);
      }
      if (element.tagName === "A" && name === "href") {
        try {
          const url = new URL(value, window.location.origin);
          if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
            element.removeAttribute("href");
          } else {
            element.setAttribute("href", url.href);
            element.setAttribute("target", "_blank");
            element.setAttribute("rel", "noopener noreferrer");
          }
        } catch {
          element.removeAttribute("href");
        }
      } else if (element.tagName !== "A" && name !== "href") {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return doc.body.innerHTML;
}

export function markdownToRichHtml(markdown: string) {
  const source = String(markdown ?? "").replace(/\r\n?/g, "\n").trim();
  if (!source) return "<p><br></p>";

  const lines = source.split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let inCode = false;
  let codeLines: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (text) html.push(`<p>${inlineMarkdownToHtml(text)}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith("\`\`\`")) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        flushParagraph();
        closeList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(6, heading[1].length);
      html.push(`<h${level}>${inlineMarkdownToHtml(heading[2])}</h${level}>`);
      continue;
    }

    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${inlineMarkdownToHtml(quote[1])}</blockquote>`);
      continue;
    }

    const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${inlineMarkdownToHtml(unordered[1])}</li>`);
      continue;
    }

    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${inlineMarkdownToHtml(ordered[1])}</li>`);
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      closeList();
      html.push("<hr>");
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  if (inCode) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }
  flushParagraph();
  closeList();

  return sanitizeRichHtml(html.join(""));
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  const children = Array.from(element.childNodes).map(nodeToMarkdown).join("");

  switch (tag) {
    case "br": return "\n";
    case "strong":
    case "b": return `**${children.trim()}**`;
    case "em":
    case "i": return `*${children.trim()}*`;
    case "u": return `<u>${children.trim()}</u>`;
    case "s":
    case "del": return `~~${children.trim()}~~`;
    case "code":
      return element.parentElement?.tagName.toLowerCase() === "pre" ? children : `\`${children}\``;
    case "pre": return `\`\`\`\n${element.textContent ?? ""}\n\`\`\``;
    case "a": {
      const href = element.getAttribute("href");
      return href ? `[${children.trim()}](${href})` : children;
    }
    case "h1": return `# ${children.trim()}\n\n`;
    case "h2": return `## ${children.trim()}\n\n`;
    case "h3": return `### ${children.trim()}\n\n`;
    case "h4": return `#### ${children.trim()}\n\n`;
    case "h5": return `##### ${children.trim()}\n\n`;
    case "h6": return `###### ${children.trim()}\n\n`;
    case "blockquote":
      return children.split("\n").filter(Boolean).map((line) => `> ${line}`).join("\n") + "\n\n";
    case "li": return children.trim();
    case "ul":
      return Array.from(element.children).map((child) => `- ${nodeToMarkdown(child)}`).join("\n") + "\n\n";
    case "ol":
      return Array.from(element.children).map((child, index) => `${index + 1}. ${nodeToMarkdown(child)}`).join("\n") + "\n\n";
    case "hr": return "---\n\n";
    case "div":
    case "p":
      return children.trim() ? `${children.trim()}\n\n` : "";
    default:
      return children;
  }
}

export function richHtmlToMarkdown(html: string) {
  if (typeof window === "undefined") return html;
  const sanitized = sanitizeRichHtml(html);
  const doc = new DOMParser().parseFromString(sanitized, "text/html");
  return nodeToMarkdown(doc.body)
    .replace(/[ 	]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function copyRichTextFromHtml(html: string) {
  const sanitized = sanitizeRichHtml(html);
  const doc = typeof window !== "undefined" ? new DOMParser().parseFromString(sanitized, "text/html") : null;
  const plainText = doc?.body.innerText ?? doc?.body.textContent ?? "";
  if (typeof navigator !== "undefined" && navigator.clipboard && "write" in navigator.clipboard && typeof ClipboardItem !== "undefined") {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([sanitized], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(plainText);
}

type RichArticleEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  minHeight?: number;
};

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8"
      title={label}
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function RichArticleEditor({ value, onChange, minHeight = 420 }: RichArticleEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastExternalValue = useRef(value);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const currentMarkdown = richHtmlToMarkdown(editor.innerHTML);
    if (value !== lastExternalValue.current || currentMarkdown !== value) {
      editor.innerHTML = markdownToRichHtml(value);
    }
    lastExternalValue.current = value;
  }, [value]);

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const sanitized = sanitizeRichHtml(editor.innerHTML);
    if (sanitized !== editor.innerHTML) editor.innerHTML = sanitized;
    const markdown = richHtmlToMarkdown(sanitized);
    lastExternalValue.current = markdown;
    onChange(markdown);
  };

  const exec = (command: string, argument?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, argument);
    emitChange();
  };

  const createLink = () => {
    const url = window.prompt("Masukkan URL:", "https://");
    if (!url) return;
    exec("createLink", url);
  };

  const setBlock = (tag: string) => exec("formatBlock", tag);

  const copyCurrent = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      await copyRichTextFromHtml(editor.innerHTML);
      const event = new CustomEvent("rich-article-copied");
      window.dispatchEvent(event);
    } catch {
      await navigator.clipboard.writeText(editor.innerText);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
      <div className="sticky top-0 z-[1] flex flex-wrap items-center gap-1 border-b bg-muted/50 p-1">
        <ToolbarButton label="Undo" onClick={() => exec("undo")}><Undo2 className="size-4" /></ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => exec("redo")}><Redo2 className="size-4" /></ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton label="Judul 1" onClick={() => setBlock("H1")}><Heading1 className="size-4" /></ToolbarButton>
        <ToolbarButton label="Judul 2" onClick={() => setBlock("H2")}><Heading2 className="size-4" /></ToolbarButton>
        <ToolbarButton label="Bold" onClick={() => exec("bold")}><Bold className="size-4" /></ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => exec("italic")}><Italic className="size-4" /></ToolbarButton>
        <ToolbarButton label="Underline" onClick={() => exec("underline")}><Underline className="size-4" /></ToolbarButton>
        <ToolbarButton label="Bullet list" onClick={() => exec("insertUnorderedList")}><List className="size-4" /></ToolbarButton>
        <ToolbarButton label="Numbered list" onClick={() => exec("insertOrderedList")}><ListOrdered className="size-4" /></ToolbarButton>
        <ToolbarButton label="Quote" onClick={() => setBlock("BLOCKQUOTE")}><Quote className="size-4" /></ToolbarButton>
        <ToolbarButton label="Code" onClick={() => setBlock("PRE")}><Code className="size-4" /></ToolbarButton>
        <ToolbarButton label="Link" onClick={createLink}><Link2 className="size-4" /></ToolbarButton>
        <ToolbarButton label="Garis horizontal" onClick={() => exec("insertHorizontalRule")}><Minus className="size-4" /></ToolbarButton>
        <ToolbarButton label="Hapus format" onClick={() => exec("removeFormat")}><RemoveFormatting className="size-4" /></ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={copyCurrent}>
          <Check className="size-3.5" />Salin Format
        </Button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        spellCheck
        onInput={emitChange}
        onBlur={emitChange}
        onPaste={(event) => {
          const html = event.clipboardData.getData("text/html");
          if (!html) return;
          event.preventDefault();
          const clean = sanitizeRichHtml(html);
          document.execCommand("insertHTML", false, clean);
          emitChange();
        }}
        className="prose prose-sm max-w-none min-h-[420px] px-6 py-5 outline-none leading-7 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-3 [&_ul]:my-3 [&_ol]:my-3 [&_li]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:italic"
        style={{ minHeight }}
      />
    </div>
  );
}
