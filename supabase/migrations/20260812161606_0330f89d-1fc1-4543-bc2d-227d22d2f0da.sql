ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS tone_level text NOT NULL DEFAULT 'praktis',
  ADD COLUMN IF NOT EXISTS tone_insight jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO public.knowledge_base (project_id, type, title, content)
SELECT p.id, 'playbook', 'Tone of Voice Arsjad Rasjid — Guidelines Artikel, Opini & Blog',
$tov$TONE OF VOICE ARSJAD RASJID (ARS) — panduan wajib untuk artikel, opini, blog.

INSIGHT RISET: credibility/experience dan positive personality adalah key driver. Gaya komunikasi inspiratif dan mudah dipahami adalah faktor penting. Peluang kuat pada tema entrepreneurship/leadership dan audiens muda. Positioning Arsjad lebih luas dari identitas KADIN: kewirausahaan, inklusivitas, generasi muda.

CORE TONE: Praktis. Kredibel. Membumi. Optimistis.

KARAKTER SUARA:
1. Experienced, not academic — bicara dari pengalaman ("Dari pengalaman saya membangun bisnis…", "Saya belajar bahwa…"), hindari "Berdasarkan perspektif teoritis…", "Dalam konteks paradigma…".
2. Simple but smart — ide besar, bahasa sederhana. Jelaskan istilah teknis dengan dampak sehari-hari.
3. Macro to practical — selalu tarik ke: apa artinya bagi pengusaha, UMKM, pekerja, generasi muda.
4. Mentor, not motivator — fokus pengalaman, pembelajaran, keputusan sulit, kegagalan, prinsip kepemimpinan, solusi praktis. Hindari motivasi kosong.
5. Optimistic but realistic — pola Tantangan → Peluang → Apa yang bisa dilakukan.
6. Collaborative, not self-centered — perbanyak "kita, bersama, kolaborasi, peluang"; kurangi glorifikasi diri.

POSITIONING: Business Leader, Business Mentor, Bridge Builder (industri besar–UMKM–startup–wirausaha muda), Forward-Looking Leader. KADIN bagian rekam jejak, bukan satu-satunya identitas.

STRUKTUR BERPIKIR: Problem → Perspective → Experience → Solution → Hope.

PEMBUKA: langsung ke persoalan, kalimat pendek. Hindari pembukaan abstrak panjang ("Dalam era globalisasi yang terus berkembang secara dinamis…").

GAYA KALIMAT: kalimat pendek–menengah (maks ~20 kata), satu gagasan per kalimat, paragraf pendek, contoh konkret, analogi sederhana, active voice. Hindari anak kalimat bertumpuk, jargon, bahasa birokratis, kalimat abstrak tanpa contoh.

DIKSI SERING: peluang, belajar, tumbuh, membangun, pengalaman, bersama, kolaborasi, usaha, pengusaha, UMKM, generasi muda, kesempatan, pekerjaan, daya saing, inovasi, keberlanjutan, masa depan, dampak.
DIKSI SECUKUPNYA (jelaskan bila dipakai): transformasi, ekosistem, akselerasi, inklusivitas, fundamental ekonomi, stakeholder, paradigma, optimalisasi.

TONE PER JENIS ARTIKEL:
A. News/Institutional — faktual, profesional, straightforward, understated. Jangan memuji Arsjad secara eksplisit.
B. Opinion/Thought Leadership — personal, reflektif, boleh "saya", tetap praktis, harus memberi perspektif bukan rangkuman isu.
C. Business & Mentorship Blog — hangat, relatable, praktis, insightful; lessons learned, leadership, karier, entrepreneurship, kegagalan, keputusan, membangun tim.

TEMA UTAMA: Entrepreneurship; Leadership & Mentorship; UMKM & pengusaha muda; Ekonomi Indonesia; Business lessons; Innovation & technology; Investment & competitiveness; Sustainability; Collaboration; Future of Indonesia.

DO: beri perspektif; pakai pengalaman; jelaskan dampak; akui tantangan; beri arah konkret.
DON'T: akademis, birokratis, menggurui, glorifikatif, motivasional kosong.

BEFORE vs AFTER:
- Before: "Penguatan fundamental ekonomi nasional membutuhkan kolaborasi multipihak dalam rangka mendorong pertumbuhan inklusif dan berkelanjutan." After: "Ekonomi yang kuat tidak bisa dibangun pemerintah atau dunia usaha sendirian. Kita perlu bekerja bersama agar pertumbuhan benar-benar membuka lebih banyak pekerjaan dan peluang usaha."
- Before: "UMKM memiliki posisi strategis sebagai backbone perekonomian nasional." After: "UMKM bukan sekadar usaha kecil. Di banyak daerah, merekalah yang membuka pekerjaan dan menggerakkan ekonomi sehari-hari."
- Before: "Kepemimpinan adaptif menjadi faktor krusial dalam menghadapi era disrupsi." After: "Saat perubahan datang cepat, pemimpin tidak harus punya semua jawaban. Tetapi ia harus cepat belajar, berani memutuskan, dan mau mendengar timnya."
- Before: "Digitalisasi merupakan instrumen penting dalam meningkatkan efisiensi dan produktivitas pelaku usaha." After: "Teknologi seharusnya membuat bisnis bekerja lebih mudah, lebih cepat, dan lebih produktif. Kalau tidak, berarti kita belum menggunakannya dengan tepat."

CHECKLIST SEBELUM PUBLIKASI: sekali baca langsung paham; jargon disederhanakan; ada perspektif Arsjad; ada pengalaman/contoh konkret; dampak jelas bagi pembaca; optimistis tapi realistis; terdengar pengusaha berpengalaman bukan akademisi; pembaca dapat sesuatu yang berguna.

GOLDEN RULE: pembaca merasa "Dia paham persoalannya", "Dia bicara dari pengalaman", "Penjelasannya mudah dimengerti", "Ada yang bisa saya pelajari atau lakukan."$tov$
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.knowledge_base k
  WHERE k.project_id = p.id AND k.title LIKE 'Tone of Voice Arsjad Rasjid%'
);