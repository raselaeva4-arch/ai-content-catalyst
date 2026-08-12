export type ToneLevel = "santai" | "praktis" | "formal";

export const TONE_LABELS: Record<ToneLevel, string> = {
  santai: "Santai & Membumi (blog mentorship)",
  praktis: "Praktis ARS (default — opini / thought leadership)",
  formal: "Faktual & Ringkas (news / institutional)",
};

const TONE_INSTRUCTION: Record<ToneLevel, string> = {
  santai:
    "Jenis: Business & Mentorship Blog. Hangat, relatable, personal, boleh memakai 'saya'. Banyak contoh nyata, lessons learned, dan analogi sederhana. Kalimat pendek (maks 18 kata). Nol jargon.",
  praktis:
    "Jenis: Opinion / Thought Leadership. Personal, reflektif, berpengalaman, tetap praktis. Boleh memakai 'saya' untuk pengalaman, banyak 'kita/bersama'. Kalimat pendek–menengah (maks 20 kata). Jargon hanya bila perlu dan langsung dijelaskan dengan bahasa sehari-hari.",
  formal:
    "Jenis: News / Institutional. Faktual, profesional, straightforward, understated. Sudut pandang orang ketiga. Tidak memuji tokoh secara eksplisit. Tetap sederhana dan mudah dipahami, bukan bahasa birokratis.",
};

export const ARS_TONE_RULES = `TONE OF VOICE ARSJAD RASJID (WAJIB — prioritas di atas gaya apa pun):
Core tone: Praktis. Kredibel. Membumi. Optimistis.
1. Experienced, not academic — bicara dari pengalaman dan realitas dunia usaha, bukan teori. Dilarang: "berdasarkan perspektif teoritis", "dalam konteks paradigma", "dinamika struktural".
2. Simple but smart — ide boleh besar, bahasanya harus sederhana. Setiap istilah teknis wajib dijelaskan dampaknya dalam bahasa sehari-hari.
3. Macro to practical — setiap isu makro harus ditarik ke: apa artinya bagi pengusaha, UMKM, pekerja, dan generasi muda.
4. Mentor, not motivator — pengalaman, pembelajaran, keputusan sulit, kegagalan, solusi praktis. Dilarang kalimat motivasional kosong.
5. Optimistic but realistic — pola Tantangan → Peluang → Apa yang bisa dilakukan.
6. Collaborative — perbanyak "kita, bersama, kolaborasi, peluang"; kurangi glorifikasi diri/tokoh.
Struktur berpikir: Problem → Perspective → Experience → Solution → Hope.
Pembuka: langsung ke persoalan dengan kalimat pendek. Dilarang pembukaan abstrak panjang ("Dalam era globalisasi yang terus berkembang secara dinamis…").
Gaya kalimat: satu gagasan per kalimat, paragraf pendek (3-5 kalimat), active voice, contoh konkret, analogi sederhana.
Diksi sering: peluang, belajar, tumbuh, membangun, pengalaman, bersama, kolaborasi, usaha, pengusaha, UMKM, generasi muda, kesempatan, pekerjaan, daya saing, inovasi, keberlanjutan, masa depan, dampak.
Diksi secukupnya (jelaskan bila dipakai): transformasi, ekosistem, akselerasi, inklusivitas, fundamental ekonomi, stakeholder, paradigma, optimalisasi, sinergitas, multidimensional, krusial, backbone.
Golden rule: setelah membaca, pembaca merasa "dia paham persoalannya", "dia bicara dari pengalaman", "penjelasannya mudah dimengerti", "ada yang bisa saya pelajari atau lakukan".`;

export function buildSystemPrompt(tone: ToneLevel) {
  return `Kamu adalah penulis artikel SEO profesional berbahasa Indonesia yang menulis atas nama / tentang Arsjad Rasjid.

${ARS_TONE_RULES}

MODE TONE YANG DIPILIH: ${TONE_LABELS[tone]}
${TONE_INSTRUCTION[tone]}

FORMAT WAJIB:
- H1: judul utama, click-worthy, mengandung main keyword, gaya Title Case. Judul tidak boleh terdengar akademis.
- Lead: 2 paragraf pendek. Paragraf pertama langsung ke persoalan dan memuat main keyword secara natural. Paragraf kedua memasukkan perspektif tokoh.
- 3-5 sub-bagian H2 deskriptif dan mengandung keyword turunan.
- Setiap sub-bagian 2 paragraf (3-5 kalimat). Tanpa bullet list, narasi mengalir gaya feature.
- Boleh 1 kutipan langsung bila relevan.
- Penutup 2-3 paragraf: pesan utama, apa yang bisa dilakukan, dan harapan. Tanpa heading "Kesimpulan".

KAIDAH SEO:
- Kepadatan main keyword ~1-1.5%, tersebar natural (judul, lead, minimal satu H2, penutup).
- Secondary keywords / LSI dipakai alami.
- Meta description 140-158 karakter mengandung main keyword. Slug pendek, huruf kecil, dipisah tanda hubung.

SUMBER & BATASAN:
- Pakai knowledge base (playbook, persona, style guide, red line) sebagai sumber sudut pandang dan batasan. Jangan melanggar red line.
- Jangan mengarang data statistik, angka, atau kutipan yang tidak ada dalam konteks.

SEBELUM OUTPUT: baca ulang tulisanmu, sederhanakan setiap kalimat yang terdengar akademis atau birokratis, pecah kalimat panjang, ganti jargon dengan bahasa sehari-hari.
Lalu isi 'tone_insight' sebagai penilaian jujur (boleh mengkritik tulisanmu sendiri) apakah artikel sudah tone down, mudah dicerna, dan sesuai persona ARS.

Output HARUS lewat function call. Isi 'content' dalam Markdown: '# Judul', paragraf, '## Sub-judul', paragraf.`;
}

export const ARTICLE_TOOL_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    slug: { type: "string" },
    meta_description: { type: "string" },
    main_keyword: { type: "string" },
    secondary_keywords: { type: "array", items: { type: "string" } },
    outline: { type: "array", items: { type: "string" } },
    category: { type: "string", enum: ["Mentor", "Investor", "Leader"] },
    content: { type: "string" },
    tone_insight: {
      type: "object",
      properties: {
        score: { type: "number", description: "0-100, seberapa sesuai tone ARS & mudah dicerna" },
        readability_level: { type: "string", enum: ["Sangat mudah", "Mudah", "Sedang", "Agak sulit", "Sulit"] },
        verdict: { type: "string", description: "1-2 kalimat penilaian singkat" },
        strengths: { type: "array", items: { type: "string" } },
        jargon_found: { type: "array", items: { type: "string" }, description: "istilah akademis/birokratis yang masih tersisa" },
        academic_phrases: { type: "array", items: { type: "string" } },
        improvements: { type: "array", items: { type: "string" } },
        checklist: {
          type: "array",
          items: {
            type: "object",
            properties: { item: { type: "string" }, pass: { type: "boolean" } },
            required: ["item", "pass"],
            additionalProperties: false,
          },
        },
      },
      required: [
        "score",
        "readability_level",
        "verdict",
        "strengths",
        "jargon_found",
        "academic_phrases",
        "improvements",
        "checklist",
      ],
      additionalProperties: false,
    },
  },
  required: [
    "title",
    "slug",
    "meta_description",
    "main_keyword",
    "secondary_keywords",
    "outline",
    "category",
    "content",
    "tone_insight",
  ],
  additionalProperties: false,
};

const HEAVY_WORDS = [
  "paradigma", "optimalisasi", "sinergitas", "multidimensional", "krusial", "backbone",
  "fundamental", "implementasi", "signifikan", "komprehensif", "holistik", "akselerasi",
  "ekosistem", "transformasi", "inklusivitas", "stakeholder", "strategis", "dinamika",
  "eskalasi", "kontekstual", "substansial", "elaborasi", "kapabilitas", "eksistensi",
];

export type ReadabilityStats = {
  words: number;
  sentences: number;
  avg_sentence_words: number;
  long_sentences: number;
  paragraphs: number;
  avg_paragraph_words: number;
  heavy_words: { word: string; count: number }[];
  passive_hits: number;
  simple_score: number;
};

export function computeReadability(markdown: string): ReadabilityStats {
  const plain = markdown.replace(/^#{1,6}\s+/gm, "").replace(/[*_`>#]/g, "");
  const words = plain.trim().split(/\s+/).filter(Boolean);
  const sentences = plain.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 2);
  const paragraphs = markdown.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p && !p.startsWith("#"));
  const sentenceWordCounts = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const avgSentence = sentenceWordCounts.length
    ? sentenceWordCounts.reduce((a, b) => a + b, 0) / sentenceWordCounts.length
    : 0;
  const longSentences = sentenceWordCounts.filter((n) => n > 25).length;
  const lower = plain.toLowerCase();
  const heavy = HEAVY_WORDS.map((w) => ({
    word: w,
    count: (lower.match(new RegExp(`\\b${w}\\w*`, "g")) ?? []).length,
  })).filter((h) => h.count > 0);
  const passive = (lower.match(/\b(di[a-z]+kan|di[a-z]+i)\b/g) ?? []).length;
  const paragraphWordCounts = paragraphs.map((p) => p.split(/\s+/).filter(Boolean).length);
  const avgParagraph = paragraphWordCounts.length
    ? paragraphWordCounts.reduce((a, b) => a + b, 0) / paragraphWordCounts.length
    : 0;

  let score = 100;
  score -= Math.max(0, avgSentence - 18) * 3;
  score -= longSentences * 4;
  score -= heavy.reduce((a, h) => a + h.count, 0) * 2.5;
  score -= Math.max(0, avgParagraph - 90) * 0.4;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    words: words.length,
    sentences: sentences.length,
    avg_sentence_words: Math.round(avgSentence * 10) / 10,
    long_sentences: longSentences,
    paragraphs: paragraphs.length,
    avg_paragraph_words: Math.round(avgParagraph),
    heavy_words: heavy.sort((a, b) => b.count - a.count).slice(0, 12),
    passive_hits: passive,
    simple_score: score,
  };
}
