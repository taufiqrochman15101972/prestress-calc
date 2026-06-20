"use client";

import React, { useMemo, useState } from "react";
import { computeInfluenceLine } from "@/engine/fem/influence";

function Nf({ label, unit, value, onChange, step = 1 }: { label: string; unit?: string; value: number; onChange: (v: number) => void; step?: number; }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-gray-500 leading-tight">{label}</span>
      <div className="relative flex items-center">
        <input type="number" value={value} step={step} onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          className={`w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ${unit ? "pr-9" : ""}`} />
        {unit && <span className="absolute right-1.5 text-[9px] text-gray-400 pointer-events-none">{unit}</span>}
      </div>
    </div>
  );
}
const f = (v: number, d = 1) => (isFinite(v) ? v.toFixed(d) : "—");

const DIAGS = [
  { key: "R0" as const, label: "Reaksi tumpuan kiri R₀", color: "#0891b2", unit: "(/satuan beban)" },
  { key: "Mmid" as const, label: "Momen tengah bentang M_mid", color: "#1d4ed8", unit: "mm·(/beban)" },
  { key: "Vmid" as const, label: "Geser tengah bentang V_mid", color: "#9333ea", unit: "(/satuan beban)" },
];

export function InfluenceLineCalculator() {
  const [s, setS] = useState({ spans: 1 as 1 | 2, L: 30000, E: 200000, A: 535000, I: 1.77e11, P1: 145000, P2: 145000, dx: 4300 });
  const set = (k: keyof typeof s, v: number) => setS(p => ({ ...p, [k]: v }));
  const r = useMemo(() => computeInfluenceLine({
    spans: s.spans, L: s.L, E: s.E, A: s.A, I: s.I, perSpan: 12,
    axles: [{ P: s.P1, dx: 0 }, { P: s.P2, dx: s.dx }],
  }), [s]);

  const W = 540, H = 86, padL = 8, padR = 8;
  const plotW = W - padL - padR;
  const x2 = (x: number) => padL + (x / r.Ltot) * plotW;

  const diagram = (key: "R0" | "Mmid" | "Vmid", color: string, label: string) => {
    const vals = r.line.map(p => p[key]);
    const vmax = Math.max(...vals.map(Math.abs), 1e-9);
    const mid = H / 2;
    const y2 = (v: number) => mid - (v / vmax) * (H / 2 - 8);
    const path = r.line.map((p, i) => `${i === 0 ? "M" : "L"}${x2(p.x).toFixed(1)},${y2(vals[i]).toFixed(1)}`).join(" ");
    const fill = `${path} L${x2(r.Ltot)},${mid} L${padL},${mid} Z`;
    return (
      <div key={key} className="mb-1">
        <p className="text-[9px] font-semibold" style={{ color }}>{label} · maks ordinat = {f(vmax, key === "Mmid" ? 0 : 3)}</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-gray-200 rounded bg-slate-50">
          <line x1={padL} y1={H / 2} x2={W - padR} y2={H / 2} stroke="#94a3b8" strokeWidth="0.7" />
          <path d={fill} fill={color} fillOpacity="0.18" />
          <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
          {/* supports */}
          {Array.from({ length: s.spans + 1 }).map((_, k) => <polygon key={k} points={`${x2(k * s.L) - 4},${H / 2 + 7} ${x2(k * s.L) + 4},${H / 2 + 7} ${x2(k * s.L)},${H / 2}`} fill="#475569" />)}
        </svg>
      </div>
    );
  };

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-56 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Garis Pengaruh & Beban Bergerak (MIDAS-style)</p>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex flex-col gap-0.5"><span className="text-[9px] text-gray-500">bentang</span>
            <select value={s.spans} onChange={e => set("spans", +e.target.value)} className="rounded border border-gray-300 px-1.5 py-1 text-[10px]"><option value={1}>1 (sederhana)</option><option value={2}>2 (menerus)</option></select></div>
          <Nf label="L /bentang" unit="mm" value={s.L} step={1000} onChange={v => set("L", v)} />
          <Nf label="E" unit="MPa" value={s.E} step={1000} onChange={v => set("E", v)} />
          <Nf label="I" unit="mm⁴" value={s.I} step={1e10} onChange={v => set("I", v)} />
        </div>
        <p className="text-[9px] font-bold text-gray-500 uppercase">Kendaraan (gandar)</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="P₁ depan" unit="N" value={s.P1} step={5000} onChange={v => set("P1", v)} />
          <Nf label="P₂ belakang" unit="N" value={s.P2} step={5000} onChange={v => set("P2", v)} />
          <Nf label="jarak gandar" unit="mm" value={s.dx} step={100} onChange={v => set("dx", v)} />
        </div>
        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Amplop beban bergerak</p>
        <table className="w-full"><tbody>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">M_mid maks</td><td className="font-mono text-right text-[10px] font-semibold text-blue-700">{f(r.env.MmidMax / 1e6, 1)} kN·m</td></tr>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">M_mid min</td><td className="font-mono text-right text-[10px]">{f(r.env.MmidMin / 1e6, 1)} kN·m</td></tr>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">posisi M maks</td><td className="font-mono text-right text-[10px]">{f(r.env.MmidAtMm / 1000, 2)} m</td></tr>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">R₀ maks</td><td className="font-mono text-right text-[10px] font-semibold text-cyan-700">{f(r.env.R0Max / 1e3, 1)} kN</td></tr>
          <tr><td className="text-[10px] text-gray-500 py-0.5">V_mid maks/min</td><td className="font-mono text-right text-[10px]">{f(r.env.VmidMax / 1e3, 1)} / {f(r.env.VmidMin / 1e3, 1)} kN</td></tr>
        </tbody></table>
        <p className="text-[9px] text-gray-400 leading-snug">Beban satuan ditelusuri sepanjang gelagar (FEM solver kita) → garis pengaruh; kendaraan digeser → amplop maks/min. Setara fitur moving-load MIDAS/Civil.</p>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">Garis pengaruh (ordinat per satuan beban ke bawah)</p>
        {DIAGS.map(d => diagram(d.key, d.color, d.label))}
      </div>
    </div>
  );
}
