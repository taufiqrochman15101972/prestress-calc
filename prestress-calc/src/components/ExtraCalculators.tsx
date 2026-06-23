"use client";

import React, { useState } from "react";
import { PileCalculator } from "@/components/PileCalculator";
import { ColumnCalculator } from "@/components/ColumnCalculator";
import { SlabCalculator } from "@/components/SlabCalculator";
import { TankCalculator } from "@/components/TankCalculator";
import { TensionCalculator } from "@/components/TensionCalculator";
import { CorbelCalculator } from "@/components/CorbelCalculator";
import { DappedEndCalculator } from "@/components/DappedEndCalculator";
import { BearingCalculator } from "@/components/BearingCalculator";
import { SlabOnGradeCalculator } from "@/components/SlabOnGradeCalculator";
import { BoxGirderCalculator } from "@/components/BoxGirderCalculator";
import { BridgeLoadCalculator } from "@/components/BridgeLoadCalculator";
import { LateralStabilityCalculator } from "@/components/LateralStabilityCalculator";
import { SegmentalCalculator } from "@/components/SegmentalCalculator";
import { ExternalTendonCalculator } from "@/components/ExternalTendonCalculator";
import { HandlingCalculator } from "@/components/HandlingCalculator";
import { FireResistanceCalculator } from "@/components/FireResistanceCalculator";
import { DistributionCalculator } from "@/components/DistributionCalculator";
import { DiffShrinkageCalculator } from "@/components/DiffShrinkageCalculator";
import { ProfileDatabaseCalculator } from "@/components/ProfileDatabaseCalculator";
import { AEMMCalculator } from "@/components/AEMMCalculator";
import { SpecialMembersCalculator } from "@/components/SpecialMembersCalculator";
import { CurvedTendonCalculator } from "@/components/CurvedTendonCalculator";
import { RatingCalculator } from "@/components/RatingCalculator";
import { SplicedGirderCalculator } from "@/components/SplicedGirderCalculator";
import { FatigueCalculator } from "@/components/FatigueCalculator";
import { OptimizationCalculator } from "@/components/OptimizationCalculator";
import { TransversePTCalculator } from "@/components/TransversePTCalculator";
import { StrutTieCalculator } from "@/components/StrutTieCalculator";
import { DeckSlabCalculator } from "@/components/DeckSlabCalculator";
import { SeismicCalculator } from "@/components/SeismicCalculator";
import { SubstructureCalculator } from "@/components/SubstructureCalculator";
import { CreepShrinkageCalculator } from "@/components/CreepShrinkageCalculator";
import { MadeContinuousCalculator } from "@/components/MadeContinuousCalculator";
import { RCGirderCalculator } from "@/components/RCGirderCalculator";
import { FoundationCalculator } from "@/components/FoundationCalculator";
import { SeismicSNICalculator } from "@/components/SeismicSNICalculator";
import { CableStayedCalculator } from "@/components/CableStayedCalculator";
import { SteelTrussCalculator } from "@/components/SteelTrussCalculator";
import { SeismicDynamicsCalculator } from "@/components/SeismicDynamicsCalculator";
import { DxfImportCalculator } from "@/components/DxfImportCalculator";
import { ForceDiagramsCalculator } from "@/components/ForceDiagramsCalculator";
import { FemModelerCalculator } from "@/components/FemModelerCalculator";
import { PlateFemCalculator } from "@/components/PlateFemCalculator";
import { Frame3DCalculator } from "@/components/Frame3DCalculator";
import { StrainCompatCalculator } from "@/components/StrainCompatCalculator";
import { InfluenceLineCalculator } from "@/components/InfluenceLineCalculator";
import { TimeHistoryCalculator } from "@/components/TimeHistoryCalculator";
import { PushoverCalculator } from "@/components/PushoverCalculator";
import { BaseIsolationCalculator } from "@/components/BaseIsolationCalculator";
import { FiberMCCalculator } from "@/components/FiberMCCalculator";
import { ShellSolverCalculator } from "@/components/ShellSolverCalculator";
import { SlopeStabilityCalculator } from "@/components/SlopeStabilityCalculator";
import { ShellReinfCalculator } from "@/components/ShellReinfCalculator";
import { UmatCalculator } from "@/components/UmatCalculator";
import { BuildingSeismicCalculator } from "@/components/BuildingSeismicCalculator";
import { HysteresisCalculator } from "@/components/HysteresisCalculator";
import { LimitAnalysisCalculator } from "@/components/LimitAnalysisCalculator";

type ExtraTab = "pile" | "column" | "slab" | "tank" | "tension" | "corbel" | "dapped" | "bearing" | "grade" | "box" | "load" | "ltb" | "seg" | "spliced" | "ext" | "curved" | "handling" | "fire" | "fatigue" | "lldf" | "diffsh" | "aemm" | "special" | "rating" | "opt" | "profiles" | "transpt" | "stm" | "deck" | "seismic" | "substructure" | "creepsh" | "madecont" | "rcgirder" | "foundation" | "snieq" | "cable" | "truss" | "seisdyn" | "dxf" | "forces" | "fem" | "plate" | "fem3d" | "straincompat" | "influence" | "timehistory" | "pushover" | "isolation" | "fibermc" | "shellsolve" | "slope" | "shellreinf" | "umat" | "bldgeq" | "hyst" | "limit";

interface Props {
  open: boolean;
  onClose: () => void;
}

const TABS: { key: ExtraTab; emoji: string; title: string; subtitle: string }[] = [
  {
    key: "pile",
    emoji: "🪝",
    title: "Tiang Pancang Prategang",
    subtitle: "Pretensioned pile — P+M+V capacity, pengangkatan, pemancangan",
  },
  {
    key: "column",
    emoji: "🏛",
    title: "Kolom Prategang — P-M Interaction",
    subtitle: "Diagram interaksi aksial-lentur untuk kolom prategang persegi",
  },
  {
    key: "slab",
    emoji: "🏗",
    title: "Pelat Post-Tension 2-Arah",
    subtitle: "Load balancing TY Lin — geser pons, tegangan serat, lendutan",
  },
  {
    key: "tank",
    emoji: "🛢",
    title: "Tangki/Pipa Prategang Sirkuler",
    subtitle: "Prategang melingkar — tegangan hoop, tekanan cairan, ACI 350",
  },
  {
    key: "tension",
    emoji: "🔗",
    title: "Batang Tarik Prategang",
    subtitle: "Tension tie — N_dec, N_cr, kekakuan retak, kapasitas (Nilson §11.7)",
  },
  {
    key: "corbel",
    emoji: "📐",
    title: "Konsol Pendek / Korbel",
    subtitle: "Bracket & corbel — geser-friksi, Asc, Ah (Nilson §12.5, ACI §16.5)",
  },
  {
    key: "dapped",
    emoji: "🪚",
    title: "Ujung Takik (Dapped-End)",
    subtitle: "5 mode runtuh PCI — As, Avf, Ash, Av/Ah (Libby §12-6)",
  },
  {
    key: "bearing",
    emoji: "🧱",
    title: "Bantalan Elastomer",
    subtitle: "Pad elastomer berlapis — S, σ, geser, stabilitas (Libby §12-9, AASHTO §14.7.6)",
  },
  {
    key: "grade",
    emoji: "🛣",
    title: "Pelat di Atas Tanah (PT)",
    subtitle: "Slab-on-grade — Westergaard, ℓ, friksi tanah, bebas retak (Khan §11)",
  },
  {
    key: "box",
    emoji: "🌉",
    title: "Box Girder Jembatan",
    subtitle: "Torsi sel tertutup (Bredt), distribusi beban eksentris ke web, desain komponen (Menn Ch.5)",
  },
  {
    key: "load",
    emoji: "🚚",
    title: "Beban Jembatan SNI 1725",
    subtitle: "Beban 'D' lajur — BTR + BTG, FBD, M_live/V_live per gelagar (Soetoyo §9 / RSNI T-02)",
  },
  {
    key: "ltb",
    emoji: "🌀",
    title: "Stabilitas Lateral / Tekuk Torsi",
    subtitle: "Lateral-torsional buckling balok langsing — W_cr Timoshenko, I_y/J, FS≥3 (Abeles §13.3)",
  },
  {
    key: "seg",
    emoji: "🏗",
    title: "Konstruksi Bertahap / Segmental",
    subtitle: "Kantilever seimbang + peluncuran bertahap, redistribusi rangkak + estimasi awal layout PT (Hewson §13/§15, PTI §2.7, ASPIRE)",
  },
  {
    key: "spliced",
    emoji: "🧩",
    title: "Gelagar Spliced — PT 2 Tahap",
    subtitle: "Akumulasi tegangan pracetak→komposit, joint closure, reduksi geser duct λ_duct (Ronald PCI J. 2001, TxDOT 0-6652, WSDOT §5.9)",
  },
  {
    key: "ext",
    emoji: "🪢",
    title: "Prategang Eksternal",
    subtitle: "Tendon poligonal, gaya deviator, efek orde-2, ULS unbonded f_ps (Hewson §6–7, PTI §3.2.3)",
  },
  {
    key: "curved",
    emoji: "➰",
    title: "Tendon Melengkung — Gaya Radial",
    subtitle: "F = P_u/R sebidang + multistrand flattening, geser cover, tieback (Stone–Breen CTR 208-3F, AASHTO §5.9.5.4.3)",
  },
  {
    key: "handling",
    emoji: "🏭",
    title: "Handling & Ereksi + Camber",
    subtitle: "Stripping/transport/ereksi, titik angkat, multiplier camber jangka panjang (PCI Ch.8)",
  },
  {
    key: "fire",
    emoji: "🔥",
    title: "Ketahanan Api",
    subtitle: "Tebal & cover min per rating, k_θ retensi strand, M_n,θ ≥ M_fire (PCI Ch.10 / Abeles §16 / ACI 216)",
  },
  {
    key: "fatigue",
    emoji: "🔁",
    title: "Fatik Strand & Tulangan",
    subtitle: "Fatigue I — saringan tak-retak 0.25√f'c, Δf_p vs ΔF_TH per radius, tulangan 166−0.33f_min (AASHTO §5.5.3, FHWA NHI step 5.6.6)",
  },
  {
    key: "lldf",
    emoji: "🛤",
    title: "Faktor Distribusi LRFD",
    subtitle: "Live-load distribution factor AASHTO LRFD §4.6.2.2 — K_g, interior/eksterior, momen/geser (Bridge Superstructure Ch.3)",
  },
  {
    key: "diffsh",
    emoji: "💧",
    title: "Susut Diferensial Komposit",
    subtitle: "Deck cor-setempat vs gelagar pracetak — F_sh, M_cs, tegangan soffit (Abeles §11.5/§11.7.4, Evans–Parker)",
  },
  {
    key: "aemm",
    emoji: "⏳",
    title: "Jangka Panjang AEMM",
    subtitle: "Age-adjusted effective modulus (Trost–Bažant) — Ē=E/(1+χφ), Δε/Δκ, lendutan & loss jangka panjang + pergerakan expansion joint (Gilbert §5.7/§5.11)",
  },
  {
    key: "special",
    emoji: "🧪",
    title: "Pipa · Tiang · Bantalan Rel",
    subtitle: "Elemen prategang khusus — pipa melingkar (hoop), pole kantilever angin, sleeper rel (Krishna Raju Bab 16 & 19)",
  },
  {
    key: "rating",
    emoji: "🏷",
    title: "Load Rating Jembatan (LRFR)",
    subtitle: "RF inventory/operating — lentur, geser, Service III; beban aman & posting (AASHTO MBE §6A / CDOT 9B)",
  },
  {
    key: "opt",
    emoji: "💰",
    title: "Optimasi Biaya HPC",
    subtitle: "Biaya per m² dek — CMCR = 0.936+(f'c/100)³, jumlah vs jarak gelagar, angkut+ereksi (Hassanain–Loov PCI J. 1999)",
  },
  {
    key: "deck",
    emoji: "🛞",
    title: "Desain Pelat Dek Jembatan",
    subtitle: "Metode strip AASHTO Standard vs LRFD — lebar ekuivalen, momen ±, overhang, impak (PCI BDM §8.8)",
  },
  {
    key: "transpt",
    emoji: "🔲",
    title: "Desain Transversal Box Adjacent",
    subtitle: "PT diafragma transversal + tie-rod Oregon untuk balok box berdampingan — gaya PT vs lebar/tinggi (PCI BDM §8.9, El-Remaily)",
  },
  {
    key: "stm",
    emoji: "▽",
    title: "Strut-and-Tie (D-Region)",
    subtitle: "Model strut-tie zona-D & kepala-pilar — f_cu softening, faktor node CCC/CCT/CTT, φ strut/tie (PCI BDM §8.12, AASHTO §5.6.3)",
  },
  {
    key: "seismic",
    emoji: "🌐",
    title: "Beban Gempa (Mode Tunggal)",
    subtitle: "Metode beban seragam single-mode — T, C_s, V desain, lebar dudukan min N (PCI BDM Ch.15, STD I-A / LRFD §4.7.4)",
  },
  {
    key: "creepsh",
    emoji: "🕰",
    title: "Model Rangkak & Susut",
    subtitle: "Empat model time-dependent paralel (ACI 209R-92, CEB-FIP MC90/fib MC2010, GL2000, B3) — φ(t,t₀), ε_sh(t), modulus efektif/age-adjusted χ; basis lendutan jangka panjang & kehilangan prategang (buku 123–135)",
  },
  {
    key: "substructure",
    emoji: "🏛️",
    title: "Bangunan Bawah (RC)",
    subtitle: "Beton bertulang biasa — kombinasi beban AASHTO LRFD, kolom pier P-M, bent cap, telapak spread, pile cap/grup, abutmen (Rankine + stem), angkur tanah/batuan (Chen Substructure + SUSPA/VSL)",
  },
  {
    key: "rcgirder",
    emoji: "🧱",
    title: "Gelagar Balok-T (RC)",
    subtitle: "Bangunan atas beton bertulang biasa — standar Bina Marga Balok-T 5–25 m: lebar sayap efektif, beban 'D' SNI 1725, lentur penampang-T (kontrol regangan φ), geser sengkang (book 152)",
  },
  {
    key: "madecont",
    emoji: "⛓️",
    title: "Gelagar Dibuat Menerus",
    subtitle: "Pracetak prategang dibuat menerus (NCHRP 322 / PCA) — momen restraint rangkak (1−e^−φ) prategang+sendiri & susut diferensial, sambungan momen-positif diafragma (book 147/148)",
  },
  {
    key: "foundation",
    emoji: "🪨",
    title: "Pondasi (Statik & Dinamik)",
    subtitle: "Deep & shallow foundation — kapasitas aksial tiang/bore pile/shaft (α/β/Meyerhof), grup (Converse-Labarre + blok), penurunan Vesic, lateral Broms, pemancangan dinamik (ENR/Hiley/Janbu), daya dukung dangkal (Vesic), fondasi mesin half-space + SSI (Bowles/Budhu/Das, books 194–205)",
  },
  {
    key: "seisdyn",
    emoji: "🌋",
    title: "Dinamik & Gempa Bangunan Bawah",
    subtitle: "Analisis dinamik & desain gempa substruktur — respons SDOF, modal 2-DOF (SRSS), desain kapasitas pilar (sendi plastis L_p, daktilitas μ_Δ, geser overstrength V_po, P-Δ), likuifaksi Seed–Idriss (AASHTO Guide Spec / Caltrans SDC / Priestley DBD / SNI 2833, books 219–229)",
  },
  {
    key: "bldgeq",
    emoji: "🏙️",
    title: "Gempa Bangunan Gedung (ASCE 7 / EC8)",
    subtitle: "Bangunan gedung bertingkat — prosedur Gaya Lateral Ekuivalen ASCE 7-16/NEHRP (FEMA P-750): spektrum desain S_DS/S_D1, C_s, V=C_s·W, distribusi F_x, drift Δ & stabilitas P-Δ θ; jalur paralel Eurocode 8 (S_d(T1), F_b). Beda dari gempa jembatan (books GM 1, 118–256)",
  },
  {
    key: "hyst",
    emoji: "🔄",
    title: "Histeresis & Respons Siklik Nonlinier",
    subtitle: "Model histeresis rate-independent (bilinear kinematik / Bouc-Wen mulus / Takeda RC dengan degradasi kekakuan & pinching) → kurva F–u, energi disipasi E_D & redaman ekuivalen ξ_eq per siklus; riwayat-waktu NONLINIER Newmark-β + Newton-Raphson (duktilitas μ, energi histeretik, u residu); asesmen energi Park-Ang (DI); strat ekuivalen infill bata (Mainstone/FEMA 356). Melengkapi time-history linier 🌊 (books GM 257–272)",
  },
  {
    key: "limit",
    emoji: "⚖️",
    title: "Analisis Batas & Garis Leleh",
    subtitle: "Teori plastisitas / analisis batas: garis-leleh Johansen (batas-ATAS/kinematik) untuk pelat beton 2-arah (w_u=(24m/L_x²)(1+i)/[√(3+r²)−r]²) + runtuh plastis balok (mekanisme sendi: SS 8/jepit 16/prop 11,66 ·M_p/L²) + faktor efektivitas beton ν=0,7−f'c/200 & geser plastis (web-crushing) Nielsen. Melengkapi strut-and-tie ▽ (batas-BAWAH/statis). Pustaka ASM Nielsen & Hoang 'Limit Analysis and Concrete Plasticity' (ASM 1–92)",
  },
  {
    key: "snieq",
    emoji: "🌎",
    title: "Beban & Gempa SNI",
    subtitle: "SNI 2833:2016 spektrum respons gempa jembatan (As, S_DS, S_D1, C_sm, zona, R) + SNI 1725:2016 beban sekunder (angin EWs/EWl, rem TB, suhu EUn) — masuk kombinasi beban bangunan bawah (books 207/211)",
  },
  {
    key: "cable",
    emoji: "🪢",
    title: "Jembatan Kabel",
    subtitle: "Cable-stayed (Gimsing & Georgakis) — layout fan/harp/semi-fan, gaya stay = V_trib/sinθ, luas perlu, modulus efektif Ernst (sag), aksial pilon & tekan dek (book 209)",
  },
  {
    key: "truss",
    emoji: "🔺",
    title: "Jembatan Rangka Baja",
    subtitle: "Steel truss Pratt/Warren/Howe (Rochman & Suhariyanto) — beban titik buhul, gaya chord M/h & diagonal V/sinθ, kapasitas tarik (leleh) & tekan (tekuk lentur AASHTO/SNI 1729) (book 210)",
  },
  {
    key: "fem",
    emoji: "🧮",
    title: "FEM Modeler (STAAD-style)",
    subtitle: "Ekosistem FEM/FEA — Pre-processor (node/member/mesh + 3 cara copy: linear/mirror/rotate), Solver Core (elemen balok-kolom 2D aksial+geser+lentur, solver Float64Array zero-copy), Post-processor (lendutan, diagram N/V/M). Elemen flat-shell Mindlin-SRI bebas shear-locking di pustaka elemen. Target Phase-2: Python(GUI)+Julia(solver)+Zig(memori) native",
  },
  {
    key: "fem3d",
    emoji: "🧊",
    title: "Rangka Ruang 3D (FEM)",
    subtitle: "Elemen balok-kolom 3D 6-DOF/node (aksial + torsi GJ + lentur EIy & EIz), transformasi 3 sumbu, solve & lendutan + gaya batang N/Vy/Vz/T/My/Mz. Tampilan isometrik X→kanan/Y→depan/Z→atas. Divalidasi vs rumus tertutup",
  },
  {
    key: "slope",
    emoji: "⛰",
    title: "Stabilitas Lereng",
    subtitle: "Faktor keamanan lereng (MIDAS GTS, MD482) — lereng tak-hingga (translasi, ±seepage) & busur lingkaran metode irisan Bishop simplified + Fellenius; sketsa lereng + bidang gelincir, FS≥1,5",
  },
  {
    key: "shellreinf",
    emoji: "◫",
    title: "Tulangan Shell (Sandwich)",
    subtitle: "Desain tulangan beton shell dari 8 resultan tegangan (n_x/n_y/n_xy + m_x/m_y/m_xy) — metode sandwich IASS (Medwadowski-Samartin) + Baumann/CEB, As tiap muka & arah; mengambil hasil solver shell ▣ (file 253)",
  },
  {
    key: "umat",
    emoji: "⚗",
    title: "UMAT Material (USSR)",
    subtitle: "Antarmuka user-material 1D (MIDAS GTS USSR / ABAQUS UMAT, file 255) — σ(ε)+tangen E_t: linear, beton Hognestad nonlinear-elastik, baja elasto-plastis + hardening; uji kurva σ–ε & colok ke serat M–φ / truss-fiber",
  },
  {
    key: "fibermc",
    emoji: "🧵",
    title: "Fiber Moment-Curvature (UMAT)",
    subtitle: "Momen-kurvatur nonlinier metode serat dengan hukum material pengguna (Hognestad beton + crushing, baja elastik-plastis) — Newton-Raphson kesetimbangan aksial tiap kurvatur → kurva M–φ (retak→leleh→ultimit), daktilitas. Basis pushover fiber & nonlinier material (MD120)",
  },
  {
    key: "shellsolve",
    emoji: "▣",
    title: "Shell 3D Penuh (FEM)",
    subtitle: "Rakit & solve shell datar 6-DOF/node (membran bilinear + pelat Mindlin-SRI bebas shear-locking + drilling) — tekanan→lentur w & tarik tepi→membran u, permukaan lendutan isometrik. Divalidasi vs teori pelat & membran",
  },
  {
    key: "pushover",
    emoji: "📈",
    title: "Pushover (Sendi Plastis)",
    subtitle: "Analisis pushover nonlinier-statik (event-to-event sendi plastis, kondensasi statik) — portal didorong lateral, sendi M_p terbentuk berurutan → kurva kapasitas base shear vs perpindahan kontrol sampai mekanisme. Gaya MIDAS pushover (MD55)",
  },
  {
    key: "isolation",
    emoji: "🛡",
    title: "Isolasi Dasar & Damper",
    subtitle: "Desain isolasi seismik (AASHTO Guide Spec Isolation / SNI) — K_iso & ζ_iso memperpanjang perioda → reduksi geser dasar + perpindahan isolator; faktor redaman B, perbandingan fixed-base vs terisolasi (MD60 isolator/damper)",
  },
  {
    key: "timehistory",
    emoji: "🌊",
    title: "Time-History Dinamik",
    subtitle: "Analisis riwayat waktu Newmark-β (γ=½, β=¼, stabil tanpa syarat) — osilator SDOF (pier) di bawah gempa sinus / gaya harmonik / pulsa → riwayat perpindahan u(t), puncak & DAF, resonansi ω≈ωn. Gaya MIDAS/Robot time-history (nonlinier #2)",
  },
  {
    key: "influence",
    emoji: "📉",
    title: "Garis Pengaruh & Beban Bergerak",
    subtitle: "Analisis garis pengaruh & moving-load gaya MIDAS/Civil (MD-1) — beban satuan ditelusuri (solver FEM kita) → garis pengaruh R₀/M_mid/V_mid, kendaraan gandar digeser → amplop maks/min + posisi kritis. Bentang sederhana/menerus",
  },
  {
    key: "straincompat",
    emoji: "🎚",
    title: "Kompatibilitas Regangan ULS",
    subtitle: "Analisis lentur ultimit dgn kompatibilitas regangan berlapis (Naaman) — cari garis netral c dari regangan riil, f_ps dari kurva tegangan-regangan tendon, berlaku prategang PENUH & SEBAGIAN, kontrol regangan εt→φ. Melengkapi/validasi tab ULS aproksimasi",
  },
  {
    key: "plate",
    emoji: "▦",
    title: "Pelat/Shell FEM",
    subtitle: "Meshing & solve pelat/shell — elemen Q4 Mindlin Selective-Reduced-Integration (bebas shear-locking), tepi simply-supported/clamped, tekanan merata → medan lendutan w(x,y), permukaan isometrik berwarna, validasi vs teori pelat tipis",
  },
  {
    key: "forces",
    emoji: "📊",
    title: "Diagram Gaya Dalam & Tegangan",
    subtitle: "Visual real-time gaya M_z/M_y, geser V_x/V_y, aksial N (tarik/tekan), torsi T_x, & lendutan ±Z/±Y — kurva gradien warna (gaya OriginPro/IDEA StatiCa). Klik bentang → gaya dalam; klik tinggi penampang → tegangan σ (Navier & kernel) + lendutan. Mekanika bahan lanjut, siap dikembangkan ke FEM/FEA",
  },
  {
    key: "dxf",
    emoji: "📐",
    title: "Impor Gambar DXF",
    subtitle: "Baca geometri dari gambar CAD (ekspor DWG→DXF): extents panjang/lebar jembatan, profil & tinggi girder, spasi girder/diafragma, dimensi & teks, kotak abutment/pier/pilecap/pierhead → terapkan ke desain (bentang, lebar dek, tinggi girder)",
  },
  {
    key: "profiles",
    emoji: "📚",
    title: "Database Profil Girder",
    subtitle: "Katalog semua penampang (WIKA/AASHTO/PCI/NU/CPCI/Deck-BT/Double-T/PC-U/voided/box) terurut dimensi + properti A, I, Z, ρ + strand & tendon PT",
  },
];

export function ExtraCalculators({ open, onClose }: Props) {
  const [tab, setTab] = useState<ExtraTab>("pile");
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl z-10 border border-gray-200
        w-[92vw] max-w-5xl flex flex-col" style={{ maxHeight: "85vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-t-xl">
          <div>
            <h2 className="font-bold text-sm tracking-tight">
              Kalkulator Tambahan — PRESTRESS-CALC
            </h2>
            <p className="text-[10px] text-blue-200">
              TY Lin Ch. 9–11 · Nilson §11 (Batang Tarik) · §12.5 (Korbel)
            </p>
          </div>
          <button onClick={onClose}
            className="text-white/70 hover:text-white text-xl leading-none font-bold">✕</button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {TABS.map(t => (
            <button key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 px-3 text-left transition-colors border-b-2 ${
                tab === t.key
                  ? "border-blue-600 bg-white"
                  : "border-transparent hover:bg-gray-100"
              }`}>
              <p className="text-[11px] font-bold text-gray-800">
                {t.emoji} {t.title}
              </p>
              <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">{t.subtitle}</p>
            </button>
          ))}
        </div>

        {/* TY Lin reference banner */}
        <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-100 text-[10px] text-blue-700">
          <span className="font-semibold">Referensi: </span>
          {tab === "pile" && "TY Lin & Burns, Ch. 10 — Tension & Compression Members · ACI 318-19 §10 · SNI 7833:2012 Tiang Pancang Beton Prategang"}
          {tab === "column" && "TY Lin & Burns, Ch. 11 — Compression Members · ACI 318-19 §22.4 — P-M Interaction Diagram · SNI 2847:2019"}
          {tab === "slab" && "TY Lin & Burns, Ch. 9 — Two-Way Slabs · ACI 318-19 §8.10 — Equivalent Frame · PTI DC20.9 Post-Tensioned Slab Design"}
          {tab === "tank" && "TY Lin & Burns, Ch. 10 — Circular Prestressing · ACI 350-20 Liquid-Retaining Structures · AWWA D110"}
          {tab === "tension" && "Nilson, Design of Prestressed Concrete 2nd Ed. §11.7–11.10 — Tension Members · ACI 318-19 §20.3"}
          {tab === "corbel" && "Nilson §12.4–12.5 — Brackets & Corbels · ACI 318-19 §16.5 — Shear-Friction Method"}
          {tab === "dapped" && "Libby, Modern Prestressed Concrete §12-6 — Dapped-End Connections · PCI Design Handbook (5 mode runtuh)"}
          {tab === "bearing" && "Libby, Modern Prestressed Concrete §12-9 — Elastomeric Bearing Pads · AASHTO LRFD §14.7.6 Metode A"}
          {tab === "grade" && "Khan & Williams, Post-tensioned Concrete Floors §11 — Slabs on Grade · Westergaard plat di atas fondasi elastis"}
          {tab === "box" && "Christian Menn, Prestressed Concrete Bridges (Birkhäuser 1990) Ch.5 — Analysis & Design of Bridge Superstructures · Torsi sel-tunggal (St. Venant/Bredt), distribusi beban, komponen penampang"}
          {tab === "load" && "Ir. Soetoyo, Konstruksi Beton Pratekan §9 — Beban 'D' Lajur · SNI 1725:2016 / RSNI T-02-2005 · BTR (q kPa) + BTG (p=49 kN/m) + FBD"}
          {tab === "ltb" && "P.W. Abeles & B.K. Bardhan-Roy, Prestressed Concrete Designer's Handbook 3rd Ed. §13.3 — Stability problems · Timoshenko 'Theory of Elastic Stability' · W_cr=(K/L²)√(B₁C), FS≥3"}
          {tab === "seg" && "Nigel R. Hewson, Prestressed Concrete Bridges §13/§15 + PTI Post-Tensioning Manual §2.7 — Balanced cantilever, incremental launching, creep redistribution on system change"}
          {tab === "ext" && "Nigel R. Hewson, Prestressed Concrete Bridges §6–7 + PTI Post-Tensioning Manual §3.2.3 — External post-tensioning · polygonal tendon, deviator forces, 2nd-order eccentricity, ACI unbonded f_ps"}
          {tab === "spliced" && "Hugh D. Ronald, 'Design and Construction Considerations for Continuous Post-Tensioned Bulb-Tee Girder Bridges' (PCI Journal 2001) + TxDOT 0-6652-1 (Bayrak/Jirsa, geser duct) + WSDOT BDM §5.9 — PT 2 tahap: tahap-1 non-komposit, tahap-2 komposit, joint closure tanpa pretension, λ_duct = 1−2(Ø/b_w)²"}
          {tab === "fatigue" && "FHWA NHI-04-043/044 'Comprehensive Design Example' step 5.6.6 / AASHTO LRFD §5.5.3 — Fatigue I: saringan tak-retak 0.25√f'c, rentang tegangan strand vs ΔF_TH per radius kelengkungan, tulangan ΔF_TH = 166 − 0.33·f_min"}
          {tab === "curved" && "Stone & Breen, CTR 208-3F 'Design of Post-Tensioned Girder Anchorage Zones' + Powell/Breen/Kreger CTR 365-1 (deviator & radius duct) — gaya radial tendon melengkung F=P_u/R, multistrand side-face, geser cover d_eff, tieback (AASHTO LRFD §5.9.5.4.3)"}
          {tab === "rating" && "AASHTO Manual for Bridge Evaluation §6A (LRFR) + CDOT Bridge Rating Manual §9B — RF = (φc·φs·φ·Rn − γ·D)/(γLL·LL+IM), inventory 1.75 / operating 1.35 / Service III 0.80, beban aman & posting"}
          {tab === "handling" && "PCI Design Handbook 7th Ed. Ch.8 — Component Handling & Erection Bracing · stripping/transport/erection impact, two-point pickup, long-term camber multipliers"}
          {tab === "fire" && "PCI Design Handbook 7th Ed. Ch.10 + Abeles & Bardhan-Roy §16 + ACI 216.1 — Fire resistance · min thickness/cover by rating, strand strength retention k_θ, M_n,θ"}
          {tab === "lldf" && "Bridge Superstructure Design Ch.3 — AASHTO LRFD §4.6.2.2 Live-Load Distribution Factors · K_g longitudinal stiffness, interior/exterior, moment/shear, lever rule"}
          {tab === "diffsh" && "P.W. Abeles & B.K. Bardhan-Roy §11.5 / §11.7.4 (Evans & Parker) — Differential shrinkage in composite members · F_sh, M_cs, creep reduction (1−e^−φ)/φ, soffit tension"}
          {tab === "aemm" && "Gilbert, Mickleborough & Ranzi 'Design of Prestressed Concrete to Eurocode 2' §5.7 / §5.11.4 — Age-Adjusted Effective Modulus Method (Trost–Bažant), restraint creep+susut+relaksasi, penampang transformasi age-adjusted"}
          {tab === "special" && "N. Krishna Raju 'Prestressed Concrete' Bab 16 & 19 — pipa prategang melingkar (wire winding), tiang/pole prategang, bantalan rel (rail-seat & centre moment)"}
          {tab === "opt" && "Hassanain & Loov, 'Design of Prestressed Girder Bridges Using HPC — An Optimization Approach' (PCI Journal 1999) — C = [n_g·C_g + C_c·V_c + C_s·m_s]/(W·L), CMCR mix-cost ratio, jarak gelagar 3–6 m, n_g ≥ 2"}
          {tab === "deck" && "PCI Bridge Design Manual §8.8 — Bridge Deck Design · Metode strip AASHTO Standard (S+2)/32 vs LRFD lebar ekuivalen (660+0.55S), momen positif/negatif/overhang, impak 30%/IM 1.33"}
          {tab === "transpt" && "PCI Bridge Design Manual §8.9 (El-Remaily, Tadros) — Transverse Design of Adjacent Box Beams · PT diafragma transversal (grout no-tension + 1.72 MPa) atau tie-rod empiris Oregon Ø22 A449"}
          {tab === "stm" && "PCI Bridge Design Manual §8.12 + AASHTO LRFD §5.6.3 — Strut-and-Tie Model · f_cu = f'c/(0.8+170ε₁) ≤ 0.85f'c, faktor node CCC 0.85 / CCT 0.75 / CTT 0.65, φ_strut 0.70 / φ_tie 0.90, rangka kepala-pilar"}
          {tab === "seismic" && "PCI Bridge Design Manual Ch.15 — Seismic Design · Metode beban seragam mode-tunggal (STD Div. I-A / LRFD §4.7.4): T=2π√(W/gK), C_s=1.2AS/T^⅔≤2.5A, V/R, lebar dudukan min N anti loss-of-span"}
          {tab === "foundation" && "Bowles 'Foundation Analysis and Design' 5th + Budhu 'Soil Mechanics and Foundations' + US Army TM 5-818-1 + Vulcanhammer (wave equation) + Das 'Principles of Soil Dynamics' + Richart/Ali (machine foundation) — kapasitas tiang statik (α/β/Meyerhof, Q_s+Q_p), grup, penurunan Vesic, lateral Broms, pemancangan dinamik, daya dukung dangkal Vesic, fondasi mesin half-space + SSI (books 194–205)"}
          {tab === "seisdyn" && "AASHTO Guide Specifications for LRFD Seismic Bridge Design + Caltrans SDC + Priestley/Calvi/Kowalsky 'Displacement-Based Seismic Design' + SNI 2833:2016 + Seed–Idriss/Youd (likuifaksi) — analisis dinamik substruktur: respons SDOF (T, Sd, V_base), modal 2-DOF SRSS, desain kapasitas pilar (M_po overstrength, L_p sendi plastis, μ_Δ daktilitas, P-Δ), pemicuan likuifaksi CSR/CRR/MSF (books 219–229; angka PDF bukan acuan — hanya prosedur)"}
          {tab === "bldgeq" && "ASCE/SEI 7-16 §11.4 + §12.8 (Equivalent Lateral Force) / NEHRP FEMA P-750 & FEMA 451 + IBC 2012 §1613 + SNI 1726 — gempa BANGUNAN GEDUNG bertingkat: spektrum desain S_a(T) (S_DS=⅔F_a·S_s, S_D1=⅔F_v·S_1, T0/Ts), kategori SDC, periode pendekatan T_a=C_t·h_n^x, koefisien C_s & geser dasar V=C_s·W, distribusi vertikal F_x=C_vx·V (k=1..2), drift δ_x=C_d·δ_xe/I_e ≤ Δ_a, stabilitas P-Δ θ=P_x·Δ·I_e/(V_x·h·C_d); jalur PARALEL Eurocode 8 EN 1998-1 §3.2.2.5 spektrum desain S_d(T) + §4.3.3.2 gaya dasar F_b=S_d(T1)·m·λ. BEDA dari gempa jembatan (seismic.ts/snieq/seisdyn). Angka contoh-desain FEMA/EC8 bukan acuan — hanya prosedur (books GM 1, 118–256)"}
          {tab === "hyst" && "Pustaka GM 257–272 (model matematis histeresis Bouc-Wen/Takeda/T(x), dinamika nonlinier dengan degradasi kekuatan & kekakuan + pinching gaya ENGLTHA, asesmen energi seismik kolom RC/Park-Ang, kinerja siklik sambungan pracetak EC8, RC berisi dinding bata PEER/FEMA 356) — histeresis NONLINIER rate-independent: (1) konstitutif bilinear kinematik (return-mapping), Bouc-Wen mulus (ż=A·u̇−β|u̇||z|ⁿ⁻¹z−γu̇|z|ⁿ, F=αk₀u+(1−α)F_y·z), Takeda RC (k_unl=k₀(u_y/u_max)^β_s + pinching); (2) kurva F–u protokol amplitudo bertingkat → E_D & ξ_eq=E_D/(4πE_so) (elasto-plastis ξ=(2/π)(1−1/μ)); (3) riwayat-waktu NONLINIER Newmark-β γ=½ β=¼ + iterasi Newton-Raphson pada gaya pemulih → μ demand, energi histeretik, u residu; (4) indeks kerusakan Park-Ang DI=μ/μ_cap+β·E_H/(F_y·u_u); (5) strat diagonal ekuivalen infill bata Mainstone/FEMA 356 (λ₁, a=0,175(λ₁h)⁻⁰·⁴·r). Melengkapi time-history LINIER 🌊. Angka contoh PDF bukan acuan — hanya prosedur/model"}
          {tab === "limit" && "Pustaka ASM 1–92 (mekanika padat terapan/variasional/FEM/plastisitas): Nielsen & Hoang 'Limit Analysis and Concrete Plasticity' (3×), Johansen yield-line, teori plastik struktur, de Souza Neto computational plasticity, Megson/Washizu/Zienkiewicz. TEORI PLASTISITAS / ANALISIS BATAS (sisi batas-ATAS/kinematik, melengkapi strut-and-tie ▽ yang batas-BAWAH/statis): (1) GARIS-LELEH Johansen pelat persegi UDL — w_u=(24·m/L_x²)(1+i)/[√(3+(L_x/L_y)²)−L_x/L_y]² (eksak: persegi SS=24m/L², jepit i=1→48m/L², strip 1-arah SS=8/jepit=16·m/L_x²); m perlu = inversi untuk desain; (2) RUNTUH PLASTIS BALOK — beban mekanisme sendi: UDL SS=8M_p/L², jepit-jepit=16M_p/L², kantilever-prop=11,657M_p/L²; titik tengah SS=4M_p/L, jepit=8M_p/L, prop=6M_p/L; (3) FAKTOR EFEKTIVITAS BETON Nielsen ν=0,7−f'c/200 (dibatasi 0,4–1), f'c efektif & geser plastis web-crushing τ=ν·f'c·sinθcosθ, V=τ·b_w·z; (4) teorema batas-bawah (statis, AMAN) vs batas-atas (kinematik, TAK-AMAN). Angka contoh PDF bukan acuan — hanya rumus/prosedur"}
          {tab === "snieq" && "SNI 2833:2016 'Perencanaan jembatan terhadap beban gempa' — spektrum respons As/S_DS/S_D1/T0/Ts/C_sm, zona (SDC), faktor R · SNI 1725:2016 'Pembebanan untuk jembatan' — angin (EWs/EWl), gaya rem TB, beban suhu EUn (books 207/211)"}
          {tab === "cable" && "Niels J. Gimsing & Christos T. Georgakis, 'Cable Supported Bridges — Concept and Design' 3rd Ed — cable-stayed: layout fan/harp/semi-fan, gaya stay = beban tributari/sinθ, luas perlu, modulus efektif Ernst (sag), aksial pilon & tekan dek (book 209)"}
          {tab === "truss" && "Prof. Taufiq Rochman & Suhariyanto, 'Desain Jembatan Rangka Baja' (2024) + AASHTO LRFD / SNI 1729 — rangka Pratt/Warren/Howe: beban titik buhul, gaya chord M/h & diagonal V/sinθ, kapasitas tarik (leleh) & tekan (tekuk lentur F_cr) (book 210)"}
          {tab === "umat" && "Antarmuka USER-MATERIAL (UMAT) 1D — MIDAS GTS User-Supplied-Subroutine (file 255) / ABAQUS UMAT: rutin konstitutif yang dari regangan mengembalikan tegangan σ DAN modulus tangen E_t. Pustaka: linear elastik, beton Hognestad (nonlinear-elastik, parabola→softening→crushing), baja elasto-plastis bilinear (+isotropic hardening E_h). Uji kurva σ–ε (peak, ε@peak) lalu dicolok ke serat penampang (M–φ 🧵) & elemen truss/fiber-frame — memperkaya nonlinier material."}
          {tab === "slope" && "Stabilitas lereng (geoteknik, MIDAS GTS — MD482): (1) lereng tak-hingga translasi FS=[c+γz cos²β tanφ]/[γz sinβ cosβ] (kasus kering & seepage sejajar lereng); (2) busur lingkaran metode irisan — Fellenius (ordinary) & Bishop's Simplified (iteratif) untuk lereng seragam + lingkaran coba lewat toe, irisan otomatis, pore-pressure ru. Geser pusat/jari-jari cari lingkaran kritis (FS min). Verifikasi FS=tanφ/tanβ (kohesi nol)."}
          {tab === "shellreinf" && "Desain tulangan beton shell (file 253 IASS, Medwadowski & Samartin 'Design of Reinforcement in Concrete Shells: A Unified Approach') dari 8 resultan tegangan (membran n_x,n_y,n_xy + lentur m_x,m_y,m_xy): metode SANDWICH — shell diganti 2 lapis baja di lengan z=t−2·cover, tiap muka diberi triad membran n±m/z, tulangan via aturan Baumann/CEB As·fy=n+|n_xy| (tekan dipangkas). Hasil As_x/As_y tiap muka (mm²/m). Mengambil resultan dari solver shell ▣."}
          {tab === "fibermc" && "Momen-kurvatur nonlinier metode SERAT dgn hukum material pengguna (UMAT-style, MD120): penampang dipotong jadi serat beton (Hognestad f=f'c[2ε/ε0−(ε/ε0)²] + softening + crushing εcu) & lapis baja (elastik-plastis ±fy); tiap kurvatur φ, regangan atas dicari Newton-Raphson agar ΣF=N → kurva M–φ (retak→leleh→ultimit), daktilitas μ_φ=φu/φy. Basis fiber-pushover & nonlinier material. Divalidasi M_u≈As·fy·(d−a/2)."}
          {tab === "shellsolve" && "Shell 3D PENUH (#2) — rakit & solve elemen flat-shell Q4 6-DOF/node (u,v,w,θx,θy,θz) = membran bilinear (2×2 Gauss) + pelat Mindlin Selective-Reduced-Integration (bebas shear-locking) + drilling, 24×24/elemen. Tekanan keluar-bidang → lendutan w; tarik tepi → regangan membran u. Permukaan lendutan isometrik berwarna. Divalidasi vs teori pelat (w≈α·q·a⁴/D) & membran (u≈N·a/EA)."}
          {tab === "pushover" && "Pushover nonlinier-statik (gaya MIDAS, MD55) — pola beban lateral diperbesar; metode event-to-event: tiap langkah satu ujung batang mencapai momen plastis M_p → sendi plastis (rilis momen via kondensasi statik) → struktur melunak → ulang sampai mekanisme runtuh (kekakuan singular). Output: kurva kapasitas base shear vs perpindahan kontrol + urutan pembentukan sendi. Sendi elastik-plastis sempurna."}
          {tab === "isolation" && "Isolasi dasar & damper seismik (AASHTO Guide Spec for Seismic Isolation / SNI, MD60) — lapisan isolasi K_iso + redaman ζ_iso memperpanjang perioda (T_iso=2π√(W/gK_iso)) menjauh dari resonansi → spektrum Sa(T_iso)/B → gaya geser dasar turun; perpindahan isolator d_iso=Sa·g·(T/2π)². Faktor reduksi redaman B=(ζ/0,05)^0,3. Bandingkan fixed-base vs terisolasi → reduksi %."}
          {tab === "timehistory" && "Time-history dinamik linear (integrasi langsung Newmark-β rata-rata percepatan, γ=½ β=¼ stabil tanpa syarat) — osilator SDOF m/k/ζ (mis. pier) di bawah eksitasi gempa-sinus a_g, gaya harmonik, atau pulsa → riwayat u(t), kecepatan, percepatan, puncak & faktor amplifikasi dinamik (resonansi ω≈ωn → DAF≈1/2ζ). Setara fitur time-history MIDAS/Robot; MDOF di atas solver FEM = peningkatan berikutnya."}
          {tab === "influence" && "Garis pengaruh & beban bergerak (MIDAS/Civil-style, MD-1) — beban satuan ditelusuri di sepanjang gelagar memakai solver FEM kita; tiap posisi disolve → ordinat garis pengaruh untuk reaksi R₀, momen tengah M_mid, geser V_mid. Kendaraan multi-gandar lalu digeser → amplop respons maks/min + posisi kritis (Müller-Breslau numerik). Bentang sederhana atau menerus 2-bentang."}
          {tab === "fem3d" && "Rangka ruang 3D (#3) — elemen balok-kolom 3D 2-node 6 DOF/node (u,v,w,θx,θy,θz): aksial EA/L + torsi GJ/L + lentur dua sumbu EIy & EIz, matriks lokal 12×12, transformasi 3 sumbu (direction cosine + up-vector otomatis). Solve via seam backend (Float64Array zero-copy). Tampilan ISOMETRIK X→kanan/Y→depan/Z→atas + triad + lendutan. Divalidasi vs rumus tertutup (kantilever PL³/3EIz & PL³/3EIy, torsi TL/GJ, aksial PL/EA, kolom vertikal)."}
          {tab === "straincompat" && "Analisis lentur ultimit dgn KOMPATIBILITAS REGANGAN berlapis (Naaman, PCI J. — buku 249) + ACI/AASHTO. Garis netral c dicari dari regangan riil tiap lapis (εcu=0,003), tegangan tendon f_ps dari kurva σ–ε aktual (bukan rumus aproksimasi), regangan tendon = prategang efektif f_se/E_ps + tambahan kompatibilitas. Berlaku sama untuk prategang PENUH (hanya A_ps) & SEBAGIAN (A_ps + A_s), kontrol regangan εt→φ. Melengkapi & memvalidasi tab ULS utama."}
          {tab === "plate" && "Pelat/Shell FEM — meshing rektangular nx×ny dgn elemen Q4 Mindlin-Reissner Selective Reduced Integration (lentur 2×2 Gauss, geser 1-titik tereduksi → BEBAS SHEAR LOCKING). Tepi simply-supported (w=0) atau clamped (w=θ=0), tekanan merata q → solve medan lendutan w(x,y), permukaan lendutan isometrik berwarna (X→kanan, Y→depan, Z=w→atas). Divalidasi vs teori pelat tipis (SS α=0,00406, jepit α=0,00126; rasio→1 saat mesh rapat)."}
          {tab === "fem" && "Ekosistem FEM/FEA (TypeScript, zero-copy Float64Array — pondasi yang siap ditingkatkan ke Python+Julia+Zig native). Pre-processor: tabel node/member gaya STAAD.Pro + 3 cara copy/paste (1 linear repeat/translasi, 2 mirror/cermin, 3 rotate/circular). Solver Core: elemen balok-kolom 2D 2-node 3-DOF (aksial EA/L + lentur + geser Timoshenko bebas shear-locking), perakitan global, BC penalti, solve LU. Post-processor: bentuk lendutan (Hermite), diagram N/V/M, reaksi. Pustaka elemen juga memuat flat-shell Q4 (membran + pelat Mindlin Selective-Reduced-Integration → bebas shear locking, terbukti energi geser nol pada lentur murni). Divalidasi vs rumus tertutup (kantilever P·L³/3EI, SS PL³/48EI & 5wL⁴/384EI, aksial PL/EA)."}
          {tab === "forces" && "Diagram Gaya Dalam, Tegangan & Lendutan (gaya OriginPro / IDEA StatiCa / Robot / MIDAS) — momen utama M_z, momen lateral M_y, geser V_x/V_y, aksial N (tarik +/tekan −), torsi T_x, lendutan ±Z & ±Y. Kurva terisi gradien warna jet real-time saat dicentang; klik di bentang (0–L) → gaya dalam, klik tinggi penampang (−yb…+yt) → tegangan σ (Navier = N/A−M·y/I & kernel = P/A(1∓ey/r²)∓My/I, ekuivalen) + lendutan. Berbasis kesetimbangan mekanika bahan lanjut (pre-FEM), disiapkan untuk peningkatan bertahap ke FEM/FEA."}
          {tab === "dxf" && "Impor DXF (ASCII) — DWG biner tidak dapat dibaca tanpa konverter, ekspor SAVE AS → DXF / DXFOUT. Parser mengekstrak extents (panjang/lebar jembatan), bounding-box profil girder, spasi girder/diafragma (median garis vertikal), nilai DIMENSION (kode 42), teks, & kotak substruktur — lalu terapkan ke bentang/lebar dek/tinggi girder. Geometri dari gambar Anda, bukan tebakan."}
          {tab === "profiles" && "Katalog profil girder pracetak/prategang — WIKA WF · AASHTO I–VI · PCI Bulb-Tee/I · NU (Nebraska) · CPCI (Kanada) · Deck Bulb-Tee · Double-Tee · PC-U · Voided Slab · Box · AASHTO Box BI–BIV · Segmental Box · AASHTO Slab · properti penampang terurut dimensi"}
          {tab === "rcgirder" && "Standar Jembatan Gelagar Beton Bertulang Balok-T, Bentang 5–25 m (Direktorat Jenderal Bina Marga) + AASHTO LRFD §4.6.2.6 / §5 + SNI 2847:2019 + SNI 1725:2016 — beton bertulang biasa, lentur penampang-T & geser, kontrol regangan"}
          {tab === "madecont" && "NCHRP Report 322 'Design of Precast Prestressed Bridge Girders Made Continuous' + Freyermuth/PCA + PCI BDM §11.1 — momen restraint M_r=(M_p+M_g)(1−e^−φ)+M_sh(1−e^−φ)/φ, metode rotasi 3-momen, sambungan momen-positif §5.12.3.3"}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "pile"    && <PileCalculator />}
          {tab === "column"  && <ColumnCalculator />}
          {tab === "slab"    && <SlabCalculator />}
          {tab === "tank"    && <TankCalculator />}
          {tab === "tension" && <TensionCalculator />}
          {tab === "corbel"  && <CorbelCalculator />}
          {tab === "dapped"  && <DappedEndCalculator />}
          {tab === "bearing" && <BearingCalculator />}
          {tab === "grade"   && <SlabOnGradeCalculator />}
          {tab === "box"     && <BoxGirderCalculator />}
          {tab === "load"    && <BridgeLoadCalculator />}
          {tab === "ltb"     && <LateralStabilityCalculator />}
          {tab === "seg"     && <SegmentalCalculator />}
          {tab === "spliced" && <SplicedGirderCalculator />}
          {tab === "ext"     && <ExternalTendonCalculator />}
          {tab === "curved"  && <CurvedTendonCalculator />}
          {tab === "fatigue" && <FatigueCalculator />}
          {tab === "rating"  && <RatingCalculator />}
          {tab === "handling" && <HandlingCalculator />}
          {tab === "fire"    && <FireResistanceCalculator />}
          {tab === "lldf"    && <DistributionCalculator />}
          {tab === "diffsh"  && <DiffShrinkageCalculator />}
          {tab === "aemm"    && <AEMMCalculator />}
          {tab === "special" && <SpecialMembersCalculator />}
          {tab === "opt"     && <OptimizationCalculator />}
          {tab === "deck"    && <DeckSlabCalculator />}
          {tab === "transpt" && <TransversePTCalculator />}
          {tab === "stm"     && <StrutTieCalculator />}
          {tab === "seismic" && <SeismicCalculator />}
          {tab === "substructure" && <SubstructureCalculator />}
          {tab === "creepsh" && <CreepShrinkageCalculator />}
          {tab === "rcgirder" && <RCGirderCalculator />}
          {tab === "madecont" && <MadeContinuousCalculator />}
          {tab === "foundation" && <FoundationCalculator />}
          {tab === "seisdyn" && <SeismicDynamicsCalculator />}
          {tab === "dxf" && <DxfImportCalculator />}
          {tab === "forces" && <ForceDiagramsCalculator />}
          {tab === "fem" && <FemModelerCalculator />}
          {tab === "plate" && <PlateFemCalculator />}
          {tab === "fem3d" && <Frame3DCalculator />}
          {tab === "straincompat" && <StrainCompatCalculator />}
          {tab === "influence" && <InfluenceLineCalculator />}
          {tab === "timehistory" && <TimeHistoryCalculator />}
          {tab === "umat" && <UmatCalculator />}
          {tab === "slope" && <SlopeStabilityCalculator />}
          {tab === "shellreinf" && <ShellReinfCalculator />}
          {tab === "fibermc" && <FiberMCCalculator />}
          {tab === "shellsolve" && <ShellSolverCalculator />}
          {tab === "pushover" && <PushoverCalculator />}
          {tab === "isolation" && <BaseIsolationCalculator />}
          {tab === "snieq" && <SeismicSNICalculator />}
          {tab === "bldgeq" && <BuildingSeismicCalculator />}
          {tab === "hyst" && <HysteresisCalculator />}
          {tab === "limit" && <LimitAnalysisCalculator />}
          {tab === "cable" && <CableStayedCalculator />}
          {tab === "truss" && <SteelTrussCalculator />}
          {tab === "profiles" && <ProfileDatabaseCalculator />}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 rounded-b-xl flex items-center justify-between">
          <p className="text-[9px] text-gray-400">
            Semua satuan dalam N dan mm secara internal · Hasil dalam kN, MPa, kN·m
          </p>
          <button onClick={onClose}
            className="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 text-xs font-semibold text-gray-700 transition-colors">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
