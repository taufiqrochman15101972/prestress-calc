# Kajian Gambar DWG/DXF — Bahan Acuan Output Desain

Dokumen ini merangkum hasil **pembacaan otomatis 55 file `*.dwg`** (dikonversi ke DXF
oleh konverter dalam-proyek `lib/dwgConvert.ts` / LibreDWG-WASM, lihat `tools/dwgdump.mjs`;
hasil DXF tersimpan di `dxf_export/`). Tujuannya: mengenali seperti apa **gambar output
DED jembatan yang lengkap**, agar output PRESTRESS-CALC **lebih baik & lebih sempurna**
dari contoh-contoh ini. (Angka dipakai untuk validasi realisme, BUKAN acuan kode —
sesuai aturan proyek.)

## Inventaris gambar (2 proyek)

### A. Kendilo Bridge (jembatan gelagar baja komposit) — sheet 01–52, LIST
- **01/01-kaltim** General plan & section, bentang L=8,50 m & 7,00 m, steel pile, wing wall.
- **02** Deck slab: CON'C T=250 mm + concrete paving T=50 mm + tar paper T=15 mm, %%c100 L=2.000.
- **03/04/37/39–43** Reinforcement deck slab (1 & 2), arah transversal/longitudinal, SF/SM.
- **05–10** Detail steel girder 1–6 (plate girder, stiffener, splice, slab anchor D16 L=630), material list.
- **11–20** Wing wall plan & approach slab plan (D=25 L=600, %%c60 L=300, banyak bar-list L=…).
- **21–24** Pier P1/P2 (150T): general plan & section, section & detail, reinforcement (bar A/B/L).
- **25–34** H-Pile H-300×300×10×15 (L=6,5–12,0 m), layout & schedule.
- **35** Sheet pile (T=10,5/14/15/16 mm).
- **45/46/50/51** Layout/lane/jembatan umum. **47** Steel pile detail + **pile head detail / top of footing**.
- **48/49/52** Bearing (shoe) schedule: Grade 100Tf/150Tf, FREE MOVED / FULL FIXED, per Abut1&Pier1 / Abut2&Pier2.
- **DET-POND-kaltim** Detail PONDASI: **Abutment A & B (Type A)**, **Pier 1–12 (Type B/C/D)**,
  TIANG PANCANG Ø40 cm, **POER (pilecap)**, dinding/besi, 160 dimensi.

### B. Suramadu PCI-Girder (sisi Surabaya) — file 154
- **TAMPAK DAN POTONGAN PCI GIRDER** (elevasi + potongan), **BALOK GIRDER**.
- **LAYOUT & PENEMPATAN DIAFRAGMA**: **DIAFRAGMA TEPI** (edge) & **DIAFRAGMA TENGAH** (mid),
  DIAFRAGMA COR SETEMPAT / IN-SITU **K-350**, **STRAND DIAFRAGMA Ø12,7 mm**, LUBANG STRAND.
- 17.072 entitas, 21 layer (DMS, FIN, ukuran, dim, plat bawah, SEC, BESI, POT, HAT, GARIS), **526 dimensi**.

## Dimensi nyata (validasi realisme — 154 PCI girder)
Frekuensi nilai dimensi (mm): **200, 250, 50, 70, 2100, 666, 1832, 800, 80, 2150,
3650, 6750, 7200, 100, 150, 180, 400, 495, 700, 130**.
- Sayap bawah ~**700–800**, badan ~**200**, tebal sayap/transisi **130/180/200/250** →
  cocok dengan preset WIKA PCI H-series & default girder (b3 700, b2 200, flens 130–250). ✓
- **b_eff dek ~2100/2150** → cocok default deck.widthBeff. ✓
- **Spasi diafragma ~3650 / 6750 / 7200** → diafragma tepi + 1–2 diafragma tengah pada bentang ±30–40 m.
- Selimut/spasi strand **50/70/80/100**. ✓

## Checklist "OUTPUT LENGKAP & SEMPURNA" (lebih baik dari contoh)
Gambar output kita (`lib/designsheet.ts`) harus memuat — dan MELAMPAUI — contoh:
1. **Tampak Samping** elevasi + tendon parabola + **blok ujung** + **perletakan** + **garis dimensi bentang**. ✓ (ada)
   - **+ Penempatan DIAFRAGMA tepi & tengah** pada elevasi (fitur menonjol Suramadu). → **DITAMBAHKAN**.
2. **Potongan** berdimensi lengkap (b1,b3,b_eff,H,Htot) + baris strand + 2 sumbu netral, fit-to-box. ✓
3. **Diagram tegangan** transfer/servis/dek (biru tekan/merah tarik) + batas Full vs Parsial. ✓
4. **Blok CATATAN/NOTES** material (f'c/f'ci/dek, BjTS/BjTP + selimut, PC strand Ø/grade/jacking%, sistem PT). ✓
5. **Kolom hasil kunci** + cap verdict (SLS/ULS/lendutan/geser). ✓
6. **Kop gambar** (title block). ✓
7. **Substruktur** (dari Kendilo/DET-POND): abutment, pier (tipe), **poer/pilecap**, **tiang pancang Ø**,
   pile head/top-of-footing, bearing (fixed/free) → tersedia di tab 🏛️/🪨; ringkasan masuk §30/§31 PDF saat dicentang. ✓
8. **Daftar gambar / sheet list** (LIST_Rev) → konsep §0..§31 laporan PDF kita = padanan modern. ✓
9. **Diagram gaya dalam & lendutan** (M/V/N/T, ±Z/±Y) interaktif → tab 📊 (melampaui gambar statis DWG). ✓ (unggul)

## Kesimpulan
Konverter DWG→DXF berfungsi (55/55 terbaca). Geometri & terminologi DED nyata (PCI girder
+ diafragma + substruktur lengkap) telah dikenali dan **memvalidasi** preset/َdefault kita.
Satu fitur DED yang belum ada di gambar output kita — **penempatan diafragma pada elevasi** —
ditambahkan ke `designsheet.ts` agar output kita ≥ contoh. Fitur interaktif (📊 diagram gaya
dalam, 📐 impor DWG/DXF) menjadikan output kita **melampaui** gambar statis contoh.
