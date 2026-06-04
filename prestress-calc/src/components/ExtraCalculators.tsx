"use client";

import React, { useState } from "react";
import { PileCalculator } from "@/components/PileCalculator";
import { ColumnCalculator } from "@/components/ColumnCalculator";
import { SlabCalculator } from "@/components/SlabCalculator";

type ExtraTab = "pile" | "column" | "slab";

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
              TY Lin Ch. 9 (Pelat) · Ch. 10 (Tiang) · Ch. 11 (Kolom)
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "pile"   && <PileCalculator />}
          {tab === "column" && <ColumnCalculator />}
          {tab === "slab"   && <SlabCalculator />}
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
