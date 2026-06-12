# PRESTRESS-CALC Design Suite

Aplikasi desain **gelagar jembatan beton prategang pasca-tarik (post-tensioned)** — Next.js + TypeScript, engine kalkulasi murni (pure functions), satuan SI (mm, MPa, kN, kN·m) dengan tampilan ganda SI/US.

## Kode desain (dihitung paralel, berdampingan)

- **ACI 318-19 / SNI 2847:2019** — jalur utama (SLS, ULS Whitney, losses)
- **AASHTO LRFD** — refined losses, anchorage zone, MCFT, LLDF, fatik, load rating
- **BS 8110** (Kong & Evans) — Class 1/2/3, Vco/Vcr
- **Eurocode 2 / EN 1992-1-1** (Hurst) — fcd/fctm, eq. 5.46, VRd,c/VRd,max
- **SNI 1725:2016** — beban "D" lajur jembatan

## Arsitektur engine 5-lapis (satu arah, tanpa dependensi melingkar)

```
section → tendon → losses → SLS → ULS
```

Setiap modul `src/engine/*.ts` adalah fungsi murni: objek input → objek hasil beku (`Object.freeze`). Orkestrasi di `src/store/useDesignStore.ts` (`runPipeline`).

## Cakupan

Panel utama: penampang trapesium ber-fillet (komposit dek), profil tendon multi-strand PT, kehilangan prategang (refined + lump-sum + aproksimasi PT Caltrans), SLS transfer/layan **Full vs LRFD-Partial berdampingan**, ULS lentur/geser (Vci/Vcw + MCFT + tie longitudinal), lendutan/camber, Magnel, cable zone, laporan PDF format 3-baris (rumus → substitusi → hasil) + lembar desain terpadu (SVG).

Tab tambahan (26): 🪝 pile · 🏛 kolom P-M · 🏗 pelat PT 2-arah · 🛢 tangki/pipa · 🔗 batang tarik · 📐 korbel · 🪚 dapped-end · 🧱 bearing pad · 🛣 slab-on-grade · 🌉 box girder (Bredt/Menn) · 🚚 beban SNI 1725 · 🌀 stabilitas lateral · 🏗 segmental (kantilever seimbang + launching + prelim PT) · 🧩 gelagar spliced PT 2-tahap · 🪢 prategang eksternal · ➰ tendon melengkung (gaya radial) · 🏭 handling + camber + debonding · 🔥 ketahanan api · 🔁 fatik · 🛤 LLDF AASHTO · 💧 susut diferensial · ⏳ AEMM jangka panjang + joint movement + loss aproksimasi PT · 🧪 pipa/pole/sleeper · 🏷 load rating LRFR · 💰 optimasi biaya HPC · 📚 database 44 profil (WIKA/AASHTO/PCI/NU/CPCI/…) + strand & tendon PT.

Basis referensi: **59 buku/laporan** (TY Lin, Naaman, Nilson, Libby, Abeles, Menn, Hewson, PTI, PCI, CPCI, Gilbert, Raju, FHWA, AASHTO, Caltrans, WSDOT, TxDOT, NU/CPCI PCI Journal, dll.) — semua telah ditinjau, lihat `PRD Prategang.md` (v3.2).

## Perintah

```bash
npm install        # dependensi
npm run dev        # server pengembangan
npm test           # vitest (29 asersi benchmark, toleransi ±0.5%)
npx tsc --noEmit   # type check
npm run build      # build produksi
```

## Benchmark terverifikasi (PRD §10)

Girder H=1650 (600/200 + 200/1200 + 700/250), dek 200×2100, L=30 m:
A_g=535.000 mm², y_b=769,86 mm, I_g=1,7746×10¹¹ mm⁴, y_bc=1.140,5 mm, I_c=3,7290×10¹¹ mm⁴, f_ps=1.822,2 MPa, φM_n=9.730 kN·m.

## Penyimpanan

- **localStorage** — input + setelan otomatis tersimpan
- **Supabase** — `supabase/migrations/001_design_projects.sql`; input+hasil disimpan sebagai JSONB sehingga field hasil baru tidak butuh migrasi. Isi kredensial di `.env.local`.
