const GATEWAY = "https://connector-gateway.lovable.dev";

export type DocComment = {
  section: string;
  note: string;
  author: string;
  commented_at: string | null;
  resolved: boolean;
};

function keys() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const driveKey = process.env.GOOGLE_DRIVE_API_KEY;
  const docsKey = process.env.GOOGLE_DOCS_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY belum tersedia.");
  return { lovableKey, driveKey, docsKey };
}

async function gatewayFetch(connectorId: string, connectionKey: string, path: string, query?: Record<string, string>) {
  const { lovableKey } = keys();
  const url = new URL(`${GATEWAY}/${connectorId}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": connectionKey },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google API error [${res.status}]: ${body.slice(0, 300)}`);
  }
  return res;
}

function driveKeyOrThrow() {
  const { driveKey } = keys();
  if (!driveKey) throw new Error("Koneksi Google Drive belum terhubung di connectors.");
  return driveKey;
}

export async function searchDocs(q: string) {
  const key = driveKeyOrThrow();
  const escaped = q.replace(/'/g, "\\'");
  const query = ["mimeType='application/vnd.google-apps.document'", "trashed=false"];
  if (escaped.trim()) query.push(`name contains '${escaped.trim()}'`);
  const res = await gatewayFetch("google_drive", key, "/drive/v3/files", {
    q: query.join(" and "),
    pageSize: "20",
    orderBy: "modifiedTime desc",
    fields: "files(id,name,modifiedTime,webViewLink,owners(displayName))",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const json: any = await res.json();
  return (json.files ?? []).map((f: any) => ({
    id: String(f.id),
    name: String(f.name ?? "Untitled"),
    modifiedTime: f.modifiedTime ?? null,
    webViewLink: f.webViewLink ?? `https://docs.google.com/document/d/${f.id}/edit`,
    owner: f.owners?.[0]?.displayName ?? "",
  }));
}

export async function fetchDocContent(docId: string) {
  const key = driveKeyOrThrow();
  try {
    const res = await gatewayFetch("google_drive", key, `/drive/v3/files/${docId}/export`, {
      mimeType: "text/plain",
    });
    return await res.text();
  } catch {
    const { docsKey } = keys();
    if (!docsKey) throw new Error("Gagal membaca isi Google Doc.");
    const res = await gatewayFetch("google_docs", docsKey, `/v1/documents/${docId}`);
    const json: any = await res.json();
    const parts: string[] = [];
    for (const el of json.body?.content ?? []) {
      const runs = el.paragraph?.elements ?? [];
      const text = runs.map((r: any) => r.textRun?.content ?? "").join("");
      if (text.trim()) parts.push(text.trimEnd());
    }
    return parts.join("\n\n");
  }
}

export async function fetchDocMeta(docId: string) {
  const key = driveKeyOrThrow();
  const res = await gatewayFetch("google_drive", key, `/drive/v3/files/${docId}`, {
    fields: "id,name,webViewLink",
    supportsAllDrives: "true",
  });
  const json: any = await res.json();
  return {
    id: String(json.id ?? docId),
    name: String(json.name ?? "Google Doc"),
    webViewLink: json.webViewLink ?? `https://docs.google.com/document/d/${docId}/edit`,
  };
}

export async function fetchDocComments(docId: string): Promise<DocComment[]> {
  const key = driveKeyOrThrow();
  const res = await gatewayFetch("google_drive", key, `/drive/v3/files/${docId}/comments`, {
    pageSize: "100",
    fields:
      "comments(id,content,resolved,createdTime,author(displayName),quotedFileContent(value),replies(content,createdTime,author(displayName)))",
  });
  const json: any = await res.json();
  return (json.comments ?? []).map((c: any) => {
    const replies = (c.replies ?? [])
      .map((r: any) => (r.content ? `↳ ${r.author?.displayName ?? "?"}: ${r.content}` : ""))
      .filter(Boolean)
      .join("\n");
    return {
      section: String(c.quotedFileContent?.value ?? ""),
      note: [String(c.content ?? ""), replies].filter(Boolean).join("\n"),
      author: String(c.author?.displayName ?? "Unknown"),
      commented_at: c.createdTime ?? null,
      resolved: Boolean(c.resolved),
    };
  });
}
