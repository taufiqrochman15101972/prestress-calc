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

type ExtraTab = "pile" | "column" | "slab" | "tank" | "tension" | "corbel" | "dapped" | "bearing" | "grade" | "box" | "load" | "ltb" | "seg" | "spliced" | "ext" | "curved" | "handling" | "fire" | "fatigue" | "lldf" | "diffsh" | "aemm" | "special" | "rating" | "opt" | "profiles";

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
          {tab === "profiles" && "Katalog profil girder pracetak/prategang — WIKA WF · AASHTO I–VI · PCI Bulb-Tee/I · NU (Nebraska) · CPCI (Kanada) · Deck Bulb-Tee · Double-Tee · PC-U · Voided Slab · Box · properti penampang terurut dimensi"}
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
