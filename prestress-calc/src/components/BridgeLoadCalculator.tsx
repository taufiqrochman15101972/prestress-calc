"use client";

import React, { useState, useMemo } from "react";
import { computeBridgeLoad, computeAashtoLiveLoad } from "@/engine/bridgeload";
import type { BridgeLoadInputs, AashtoLiveLoadInputs } from "@/engine/bridgeload";

const DEFAULT: BridgeLoadInputs = {
  L: 25, bTrib: 1.85, btrFactor: 1.0, girderDF: 1.0,
};

function Nf({ label, unit, value, onChange, step = 1, min = 0 }: {
  label: string; unit?: string; value: number;
  onChange: (v: number) => void; step?: number; min?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-gray-500 leading-tight">{label}</span>
      <div className="relative flex items-center">
        <input type="number" value={value} min={min} step={step}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          className={`w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ${unit ? "pr-9" : ""}`} />
        {unit && <span className="absolute right-1.5 text-[9px] text-gray-400 pointer-events-none">{unit}</span>}
      </div>
    </div>
  );
}
function Row({ label, value, unit, hi }: { label: string; value: string; unit?: string; hi?: boolean }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-0.5 pr-3 text-gray-500 text-[10px]">{label}</td>
      <td className={`py-0.5 font-mono text-right text-[10px] font-semibold ${hi ? "text-blue-700" : "text-gray-800"}`}>{value}</td>
      {unit && <td className="py-0.5 pl-1 text-gray-400 text-[9px]">{unit}</td>}
    </tr>
  );
}

export function BridgeLoadCalculator() {
  const [inp, setInp] = useState<BridgeLoadInputs>(DEFAULT);
  const set = (k: keyof BridgeLoadInputs, v: number) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const res = useMemo(() => computeBridgeLoad(inp), [inp]);
  const f = (v: number, d = 1) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-52 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Bentang & Distribusi</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="L bentang" unit="m" value={inp.L} onChange={v => set("L", v)} step={1} />
            <Nf label="b tributari" unit="m" value={inp.bTrib} onChange={v => set("bTrib", v)} step={0.05} />
            <Nf label="faktor BTR" value={inp.btrFactor} onChange={v => set("btrFactor", v)} step={0.05} />
            <Nf label="DF girder" value={inp.girderDF} onChange={v => set("girderDF", v)} step={0.05} />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">Beban &quot;D&quot; (Lajur) SNI 1725:</p>
          <p className="text-blue-600 mt-0.5">
            BTR q: L≤30m → 9 kPa; L&gt;30m → 9(0,5+15/L). BGT p = 49 kN/m × (1+FBD).
            M<sub>L</sub> = qL²/8 + (1+FBD)·P·L/4.
          </p>
          <p className="text-blue-600 mt-1">
            b tributari = jarak antar gelagar; faktor BTR = 1,0 (≤5,5 m) atau 0,5 (sisanya).
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[10px]">
          <p className="text-amber-700">
            w<sub>L,ekiv</sub> bisa langsung dipakai sebagai <span className="font-mono">wLive</span> di
            panel desain utama (memberi M<sub>live</sub> yang sama).
          </p>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 space-y-2 min-w-0">
        {/* Loading diagram */}
        <div className="flex gap-3">
          <svg width="180" height="96" viewBox="0 0 180 96" className="flex-none border border-gray-200 rounded bg-gray-50">
            {/* span line */}
            <line x1="15" y1="70" x2="165" y2="70" stroke="#374151" strokeWidth="2" />
            {/* supports */}
            <polygon points="15,70 9,80 21,80" fill="#374151" />
            <polygon points="165,70 159,80 171,80" fill="#374151" />
            {/* BTR udl arrows */}
            {[20, 40, 60, 80, 100, 120, 140, 160].map((x, i) => (
              <line key={i} x1={x} y1="34" x2={x} y2="48" stroke="#2563eb" strokeWidth="1.2" markerEnd="url(#bl_ar)" />
            ))}
            <line x1="18" y1="32" x2="162" y2="32" stroke="#2563eb" strokeWidth="1.5" />
            <text x="60" y="26" fontSize="7" fill="#2563eb" fontWeight="bold">BTR q (kPa)</text>
            {/* BGT knife edge at midspan */}
            <line x1="90" y1="14" x2="90" y2="48" stroke="#dc2626" strokeWidth="2.5" markerEnd="url(#bl_arr)" />
            <text x="93" y="18" fontSize="7" fill="#dc2626" fontWeight="bold">BGT p</text>
            <text x="70" y="92" fontSize="7" fill="#374151">L = {f(inp.L, 0)} m</text>
            <defs>
              <marker id="bl_ar" markerWidth="6" markerHeight="6" refX="3" refY="5" orient="auto">
                <path d="M0,0 L6,0 L3,6 Z" fill="#2563eb" />
              </marker>
              <marker id="bl_arr" markerWidth="6" markerHeight="6" refX="3" refY="5" orient="auto">
                <path d="M0,0 L6,0 L3,6 Z" fill="#dc2626" />
              </marker>
            </defs>
          </svg>
          <table className="flex-1"><tbody>
            <Row label="q BTR (intensitas)" value={f(res.q_kPa, 2)} unit="kPa" hi />
            <Row label="p BGT (intensitas)" value={f(res.p_kNm, 1)} unit="kN/m" />
            <Row label="FBD (faktor dinamis)" value={`${f(res.FBD * 100, 0)}%`} unit="" hi />
            <Row label="Beban Truk 'T' (ref.)" value={f(res.truckT_kN, 0)} unit="kN" />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Beban Line per Gelagar</p>
          <table className="w-full"><tbody>
            <Row label="q_line = q·b_trib" value={f(res.qLine, 2)} unit="kN/m" />
            <Row label="P_knife = p·b_trib" value={f(res.Pknife, 1)} unit="kN" />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Momen Tengah Bentang (Simple Span)</p>
          <table className="w-full"><tbody>
            <Row label="M_BTR = q·L²/8" value={f(res.M_BTR, 1)} unit="kN·m" />
            <Row label="M_BGT = (1+FBD)·P·L/4" value={f(res.M_BGT, 1)} unit="kN·m" />
            <Row label="M_live total" value={f(res.M_live, 1)} unit="kN·m" hi />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Geser di Tumpuan</p>
          <table className="w-full"><tbody>
            <Row label="V_BTR = q·L/2" value={f(res.V_BTR, 1)} unit="kN" />
            <Row label="V_BGT = (1+FBD)·P" value={f(res.V_BGT, 1)} unit="kN" />
            <Row label="V_live total" value={f(res.V_live, 1)} unit="kN" hi />
          </tbody></table>
        </div>

        <div className="bg-green-50 border border-green-200 rounded px-2 py-1.5 text-[10px] flex justify-between items-center">
          <span className="text-green-800">w<sub>Live</sub> ekivalen (= 8·M_live/L²) untuk panel utama:</span>
          <span className="font-mono font-bold text-green-700">{f(res.wLive_equiv, 2)} kN/m</span>
        </div>

        <Hl93Block L={inp.L} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// AASHTO HL-93 / HS20 per-lane formulas — PCI BDM §8.11 + Ch.7
// ════════════════════════════════════════════════════════════════
function Hl93Block({ L }: { L: number }) {
  const [inp, setInp] = useState<Omit<AashtoLiveLoadInputs, "L">>({
    xRatio: 0.5, gM: 0.6, gV: 0.7, IM: 0.33,
  });
  const set = (k: keyof Omit<AashtoLiveLoadInputs, "L">, v: number) =>
    setInp(p => ({ ...p, [k]: v }));
  const r = useMemo(() => computeAashtoLiveLoad({ L, ...inp }), [L, inp]);
  const f = (v: number, d = 1) => v.toFixed(d);

  return (
    <div className="border-t border-gray-200 pt-2 space-y-1.5">
      <p className="text-[9px] font-bold uppercase text-gray-400">
        Pembanding — AASHTO HL-93 per Lajur (PCI BDM §8.11, rumus tertutup simple span)
      </p>
      <div className="grid grid-cols-4 gap-1.5 max-w-md">
        <Nf label="x/L posisi momen" value={inp.xRatio} onChange={v => set("xRatio", v)} step={0.05} />
        <Nf label="g_M faktor distribusi" value={inp.gM} onChange={v => set("gM", v)} step={0.05} />
        <Nf label="g_V faktor distribusi" value={inp.gV} onChange={v => set("gV", v)} step={0.05} />
        <Nf label="IM truk/tandem" value={inp.IM} onChange={v => set("IM", v)} step={0.03} />
      </div>
      <div className="flex gap-4">
        <table className="flex-1"><tbody>
          <Row label="M truk HS20 (3 gandar 35+145+145 kN)" value={f(r.M_truck, 0)} unit="kN·m/lajur" />
          <Row label="M tandem (2×110 kN @1,2 m)" value={f(r.M_tandem, 0)} unit="kN·m/lajur" />
          <Row label="M lajur 9,3 kN/m" value={f(r.M_lane, 0)} unit="kN·m/lajur" />
          <Row label={`M HL-93 = ${r.governsVehicle === "TANDEM" ? "tandem" : "truk"}·(1+IM) + lajur`} value={f(r.M_HL93_lane, 0)} unit="kN·m/lajur" hi />
          <Row label="M fatik (gandar 145 @9,1 m, IM 15%)" value={f(r.M_fatigue, 0)} unit="kN·m/lajur" />
        </tbody></table>
        <table className="flex-1"><tbody>
          <Row label="V truk di tumpuan" value={f(r.V_truck, 0)} unit="kN/lajur" />
          <Row label="V tandem" value={f(r.V_tandem, 0)} unit="kN/lajur" />
          <Row label="V lajur" value={f(r.V_lane, 0)} unit="kN/lajur" />
          <Row label="V HL-93 per lajur" value={f(r.V_HL93_lane, 0)} unit="kN" hi />
          <Row label="M per gelagar (× g_M)" value={f(r.M_HL93_girder, 0)} unit="kN·m" hi />
          <Row label="V per gelagar (× g_V)" value={f(r.V_HL93_girder, 0)} unit="kN" hi />
        </tbody></table>
      </div>
      <div className="bg-green-50 border border-green-200 rounded px-2 py-1.5 text-[10px] flex justify-between items-center">
        <span className="text-green-800">w<sub>Live</sub> ekivalen HL-93 per gelagar (ambil g dari tab 🛤 LLDF):</span>
        <span className="font-mono font-bold text-green-700">{f(r.wLive_equiv, 2)} kN/m</span>
      </div>
    </div>
  );
}
