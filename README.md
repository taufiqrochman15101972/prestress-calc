# PRESTRESS-CALC Design Suite

Aplikasi rekayasa **full-stack** untuk desain jembatan beton **prategang** (utamakan **pasca-tarik / post-tensioned multi-tendon**) per **ACI 318 / SNI 2847 / AASHTO LRFD**, dengan jalur paralel **BS 8110** (Kong & Evans) dan **Eurocode 2 / EN 1992-1-1** (M.K. Hurst) untuk perbandingan silang — lengkap dengan **bangunan bawah beton bertulang biasa** (substructure RC).

> Basis pengetahuan disarikan dari **218+ referensi** (buku 1–218 + 170.xls/174.jpg/123.ppm + 54 gambar `*.dwg`): TY Lin, Naaman, Nawy, Libby, Hurst, Menn, Wright, Abeles & Bardhan-Roy, PCI Design Handbook & Bridge Design Manual (incl. Appendix B tabel produk standar AASHTO/PCI + AASHTO-PCI-ASBI Segmental Box & PCI U-Girder), AASHTO LRFD (incl. contoh desain AASHTO Type IV), FHWA/NCHRP (incl. Report 322 made-continuous), ACI 423.5R partial prestress, Krishna Raju, Gilbert, Hewson, PTI, Wai-Fah Chen, Bridge Engineering Handbook, Sengupta–Menon, standar Bina Marga (Gelagar Balok-T 5–25 m), Perhitungan Teknis PCI Girder Standar PT Adhi Persada Beton, brosur WIKA-KOBE / WIKA Beton / Waskita Precast, serta riset rangkak/susut & box-girder (ACI 209R-92, CEB-FIP/fib, GL2000, B3), dll. Angka di PDF tidak dijadikan acuan — hanya bab, sub-bab, urutan, prosedur, rumus, dan kelengkapannya. Gambar output desain mengikuti gaya **DED** (Tampak Samping + Potongan berdimensi-lengkap + blok CATATAN/NOTES) dari gambar rujukan A/B/C, **auto-scaling proporsional** (bentuk & angka berubah otomatis saat input diubah, ukuran gambar tetap pas dalam kotak).

## Toggle global (header)

- **Satuan**: SI (kN, mm, MPa, kN·m) ⇄ US (kip, in, ksi, kip·ft) — dapat dikonversi sewaktu-waktu.
- **Varian rumus tegangan**: Standard `f = −P/A ± Pe/Z ∓ M/Z` ⇄ Kernel/TY Lin `f = −P/A·(1±ey/r²) ∓ M/Z` (keduanya ekuivalen).
- **Sistem prategang**: 🔗 **Post-Tensioned** (diutamakan) ⇄ ⚓ Pretensioned.
- **Metode**: **Prategang Penuh (Full / Class U)** ⇄ **Prategang Sebagian (LRFD Partial / Class C)** — keduanya dihitung paralel.

## Cakupan modul (engine `src/engine/` + tab kalkulator)

**Inti girder (panel utama):** sifat penampang gross & komposit (`section`), profil tendon & gaya (`tendon`), kehilangan prategang AASHTO Refined + EC2 (`losses`), kontrol tegangan SLS transfer/servis (`sls`), kapasitas lentur/geser ULS + MCFT + tie longitudinal (`uls`, `mcft`), metode ganda Full vs Partial (`dualmethod`), lembar desain terpadu (`designsheet`).

**Kalkulator tambahan (🔧, tiap tab = engine murni):** tiang, kolom prategang, pelat PT, tangki, batang tarik, korbel, dapped-end, bearing pad, slab-on-grade, 🌉 box girder, 🚚 beban jembatan (SNI 1725 + HL-93), 🌀 stabilitas lateral (Timoshenko + Mast roll), 🏗 segmental, 🧩 spliced PT, 🪢 tendon eksternal, ➰ tendon melengkung, 🏭 handling & camber, 🔥 ketahanan api, 🔁 fatik, 🛤 faktor distribusi LRFD, 💧 susut diferensial, ⏳ AEMM jangka panjang, 🧪 member khusus (pipa/pole/sleeper), 🏷 load rating LRFR, 💰 optimasi biaya HPC, 🛞 pelat dek, 🔲 transversal box PT, ▽ strut-and-tie, 🌐 gempa mode-tunggal, 🕰 model rangkak & susut (ACI 209R-92 / CEB-FIP-fib / GL2000 / B3), 📚 database 70 profil girder. Tab 🌉 box girder kini juga mencakup distorsi penampang deformable (analogi BEF) + shear-lag & lendutan deformasi geser.

**🏛️ Bangunan Bawah (RC, beton bertulang biasa)** — 7 sub-tab: ① kombinasi beban AASHTO LRFD, ② kolom pier P-M (kontrol regangan εt + δ pembesaran momen), ③ bent/pier cap, ④ telapak spread (daya dukung, pons, geser, lentur), ⑤ pile cap/grup, ⑥ abutmen (Rankine + stem RC), ⑦ angkur tanah/batuan (SUSPA/VSL).

**🧱 Gelagar Balok-T (RC, bangunan atas)** — gelagar beton bertulang biasa standar Bina Marga 5–25 m: lebar sayap efektif, beban "D" SNI 1725, lentur penampang-T (kontrol regangan φ), geser sengkang + sketsa penampang-T. **⛓️ Gelagar Dibuat Menerus** — pracetak prategang dibuat menerus (NCHRP 322 / PCA): momen restraint rangkak & susut diferensial, sambungan momen-positif diafragma.

**🪨 Pondasi (Statik & Dinamik)** — fondasi dalam & dangkal (Bowles/Budhu/Das/TM 5-818-1, books 194–205): kapasitas aksial tiang/bore-pile/shaft (α/β/Meyerhof, Q_s+Q_p), grup (Converse-Labarre + blok), penurunan Vesic, lateral Broms, pemancangan dinamik (ENR/Hiley/Janbu), daya dukung dangkal Vesic, fondasi mesin half-space (Richart) + SSI (Veletsos). **Centang opt-in** `🪨 Sertakan analisis & desain pondasi` di panel input → §30 Pondasi ikut dihitung & muncul di laporan PDF (3-baris); jika tidak dicentang, tidak ikut. **🌎 Beban & Gempa SNI** — SNI 2833:2016 spektrum respons gempa jembatan (As/S_DS/S_D1/C_sm/zona/R) + SNI 1725:2016 beban sekunder (angin EWs/EWl, rem TB, suhu EUn) (books 207/211). **🪢 Jembatan Kabel** — cable-stayed Gimsing (fan/harp, gaya stay V/sinθ, Ernst E_eff, aksial pilon) (book 209). **🔺 Jembatan Rangka Baja** — rangka Pratt/Warren/Howe (chord M/h, diagonal V/sinθ, tarik leleh + tekan tekuk F_cr; Rochman & Suhariyanto + SNI 1729) (book 210).

## Laporan PDF

Tiap perhitungan tampil 3-baris: (1) rumus → (2) rumus tersubstitusi angka → (3) hasil + satuan. Gambar input/proses/output (penampang, tendon, diagram tegangan biru/merah, detailing) menyatu dalam satu lembar desain teknik.

## Tech stack

Next.js (App Router) · TypeScript · Tailwind · Zustand · Recharts · Supabase (simpan/muat proyek) · Vitest (toleransi ±0.5%). Engine = fungsi murni yang mengembalikan objek beku (frozen), aliran data satu-arah 5 layer.

## Menjalankan

```bash
cd prestress-calc
npm install
npm run dev        # http://localhost:3000
npm test           # vitest (90 assertion)
npx tsc --noEmit   # type check
npm run build      # build produksi (deploy Vercel)
```

> **Catatan lingkungan (mesin ini):** Node ada di `C:\Program Files\nodejs` (belum di PATH shell tool). Di PowerShell jalankan dulu `$env:Path = "C:\Program Files\nodejs;$env:APPDATA\npm;$env:Path"`.

### MVP Python lama (arsip)

`app.py` + `engine/*.py` (Streamlit) — kontrol tegangan SLS non-komposit saja. `pip install -r requirements.txt && streamlit run app.py`.

## Konvensi

Satuan internal N, mm, MPa (konversi ×1000 / ×1e6 di level penampang). Tegangan: **positif = tarik**, negatif = tekan. Sumbu `y=0` di serat bawah girder, jarak ke atas. Modular ratio komposit `n_c = E_deck/E_girder` dihitung dinamis.
