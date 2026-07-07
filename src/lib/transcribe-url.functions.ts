import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  url: z.string().url().min(1).max(2048),
});

const UA_DEFAULT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
// Instagram serves complete OG tags (including og:video) to social crawlers
const UA_FACEBOOK = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

function detectPlatform(url: string): "tiktok" | "instagram" | "other" {
  if (/tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  return "other";
}

async function fetchHtml(url: string, ua: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": ua,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`Gagal mengambil halaman (${res.status}). Link mungkin private/diblokir.`);
  return await res.text();
}


function unescapeJson(s: string): string {
  return s.replace(/\\u002F/g, "/").replace(/\\\//g, "/").replace(/\\"/g, '"');
}

function extractVideoUrl(html: string, platform: "tiktok" | "instagram" | "other"): string | null {
  // 1) og:video / og:video:secure_url
  const ogMatch =
    html.match(/<meta[^>]+property=["']og:video:secure_url["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video["']/i);
  if (ogMatch) return ogMatch[1].replace(/&amp;/g, "&");

  if (platform === "tiktok") {
    const m =
      html.match(/"playAddr":"([^"]+)"/) ||
      html.match(/"playApi":"([^"]+)"/) ||
      html.match(/"downloadAddr":"([^"]+)"/);
    if (m) return unescapeJson(m[1]);
  }

  if (platform === "instagram") {
    const m =
      html.match(/"video_url":"([^"]+)"/) ||
      html.match(/"video_versions":\[\{[^}]*"url":"([^"]+)"/);
    if (m) return unescapeJson(m[1]);
  }

  return null;
}

async function downloadVideo(videoUrl: string, referer: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const res = await fetch(videoUrl, {
    headers: {
      "User-Agent": UA_DEFAULT,
      Referer: referer,
      Accept: "*/*",
      Range: "bytes=0-",
    },
  });
  if (!res.ok) throw new Error(`Gagal mengunduh video (${res.status}).`);
  const mime = res.headers.get("content-type") || "video/mp4";
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 30 * 1024 * 1024) {
    throw new Error("Video terlalu besar (>30MB) untuk di-transcribe.");
  }
  return { bytes: new Uint8Array(buf), mime: mime.split(";")[0] };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const transcribeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY belum terkonfigurasi.");

    const platform = detectPlatform(data.url);
    if (platform === "other") {
      throw new Error("Saat ini hanya mendukung link TikTok dan Instagram Reels.");
    }

    const html = await fetchHtml(data.url);
    const videoUrl = extractVideoUrl(html, platform);
    if (!videoUrl) {
      throw new Error(
        platform === "instagram"
          ? "Tidak bisa mengekstrak video dari Instagram. Reel mungkin private atau butuh login. Coba upload manual file videonya."
          : "Tidak bisa mengekstrak video dari TikTok. Coba lagi, atau upload manual file videonya."
      );
    }

    const { bytes, mime } = await downloadVideo(videoUrl, data.url);
    const b64 = toBase64(bytes);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Kamu transcriber profesional. Tulis transkrip verbatim dalam bahasa aslinya (Indonesia/Inggris). Jangan tambahkan komentar atau penjelasan. Jika tidak ada speech, balas: [TIDAK ADA SUARA].",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Transkripsikan video ${platform} berikut secara lengkap:` },
              { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("Rate limit AI tercapai. Coba lagi sebentar.");
      if (res.status === 402) throw new Error("Kredit AI habis. Top up di Settings > Workspace > Usage.");
      throw new Error(`Transcribe gagal (${res.status}): ${t.slice(0, 200)}`);
    }

    const json = await res.json();
    const transcript: string = json.choices?.[0]?.message?.content ?? "";
    const name = `${platform}-${new URL(data.url).pathname.split("/").filter(Boolean).pop() ?? "video"}.mp4`;

    return { transcript: transcript.trim(), name, platform, sourceUrl: data.url };
  });
