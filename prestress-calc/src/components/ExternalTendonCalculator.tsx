"use client";

import React, { useState, useMemo } from "react";
import { computeExternalTendon } from "@/engine/external";
import type { ExternalTendonInputs } from "@/engine/external";

const DEFAULT: ExternalTendonInputs = {
  L: 40, nDeviators: 2, Pe: 12000, eAnchor: 100, eDeviator: 850,
  dp: 1700, Aps: 7400, fpe: 1100, fpy: 1670, fc: 45, b: 2100, spanDepthRatio: 22,
  mu: 0.05, beamDeflection: 40,
};

function Nf({ label, unit, value, onChange, step = 1 }: {
  label: string; unit?: string; value: number; onChange: (v: number) => void; step?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-gray-500 leading-tight">{label}</span>
      <div className="relative flex items-center">
        <input type="number" value={value} step={step}
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

export function ExternalTendonCalculator() {
  const [inp, setInp] = useState<ExternalTendonInputs>(DEFAULT);
  const set = (k: keyof ExternalTendonInputs, v: number) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const res = useMemo(() => computeExternalTendon(inp), [inp]);
  const f = (v: number, d = 1) => v.toFixed(d);

  // SVG polygonal-tendon profile (elevation)
  const W = 210, H = 70, ox = 12, oy = 10;
  const nDev = Math.max(1, Math.round(inp.nDeviators));
  const span = W - 2 * ox;
  // tendon points: anchor (ends) deep-ish, deviators at max drape
  const yScale = 44 / Math.max(inp.eDeviator, 1);
  const yAnch = oy + inp.eAnchor * yScale * 0.3 + 4;
  const yDev = oy + inp.eDeviator * yScale * 0.6 + 4;
  const pts: [number, number][] = [[ox, yAnch]];
  for (let i = 1; i <= nDev; i++) pts.push([ox + (span * i) / (nDev + 1), yDev]);
  pts.push([ox + span, yAnch]);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-56 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Geometri Tendon Eksternal</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="L bentang" unit="m" value={inp.L} onChange={v => set("L", v)} step={1} />
            <Nf label="jml deviator" value={inp.nDeviators} onChange={v => set("nDeviators", v)} step={1} />
            <Nf label="e angkur" unit="mm" value={inp.eAnchor} onChange={v => set("eAnchor", v)} step={25} />
            <Nf label="e deviator" unit="mm" value={inp.eDeviator} onChange={v => set("eDeviator", v)} step={25} />
            <Nf label="μ deviator" value={inp.mu} onChange={v => set("mu", v)} step={0.01} />
            <Nf label="δ balok" unit="mm" value={inp.beamDeflection} onChange={v => set("beamDeflection", v)} step={5} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Gaya & Material (ULS)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="P_e per tendon" unit="kN" value={inp.Pe} onChange={v => set("Pe", v)} step={500} />
            <Nf label="A_ps" unit="mm²" value={inp.Aps} onChange={v => set("Aps", v)} step={100} />
            <Nf label="f_pe" unit="MPa" value={inp.fpe} onChange={v => set("fpe", v)} step={20} />
            <Nf label="f_py" unit="MPa" value={inp.fpy} onChange={v => set("fpy", v)} step={20} />
            <Nf label="d_p" unit="mm" value={inp.dp} onChange={v => set("dp", v)} step={25} />
            <Nf label="b tekan" unit="mm" value={inp.b} onChange={v => set("b", v)} step={50} />
            <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
            <Nf label="L/h ratio" value={inp.spanDepthRatio} onChange={v => set("spanDepthRatio", v)} step={1} />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">Hewson §6–7 / PTI §3.2.3:</p>
          <p className="text-blue-600 mt-0.5">Tendon poligonal, gaya deviator F = 2P·sin(Δθ/2). ULS unbonded: f_ps = f_pe + 70 + f'c/(100ρp) (ACI §20.3.2.4.1). Efek orde-2: lengan berkurang sebesar δ balok.</p>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex gap-3">
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-none border border-gray-200 rounded bg-gray-50">
            {/* beam outline */}
            <rect x={ox} y={oy} width={span} height="46" fill="none" stroke="#cbd5e1" strokeWidth="1" />
            {/* polygonal tendon */}
            <polyline points={pts.map(p => p.join(",")).join(" ")} fill="none" stroke="#dc2626" strokeWidth="2" />
            {/* deviators */}
            {pts.slice(1, -1).map((p, i) => (
              <g key={i}>
                <circle cx={p[0]} cy={p[1]} r="2.6" fill="#1d4ed8" />
                <line x1={p[0]} y1={p[1]} x2={p[0]} y2={p[1] + 12} stroke="#16a34a" strokeWidth="1.4" markerEnd="url(#ex_ar)" />
              </g>
            ))}
            <text x={ox + 4} y={oy + 58} fontSize="7" fill="#dc2626">tendon eksternal poligonal</text>
            <text x={pts[1][0] - 6} y={pts[1][1] + 22} fontSize="6" fill="#16a34a">F_dev</text>
            <defs>
              <marker id="ex_ar" markerWidth="6" markerHeight="6" refX="3" refY="5" orient="auto"><path d="M0,0 L6,0 L3,6 Z" fill="#16a34a" /></marker>
            </defs>
          </svg>
          <table className="flex-1"><tbody>
            <Row label="Δθ di deviator" value={f(res.thetaSeg * 2 * 1000, 1)} unit="mrad" />
            <Row label="F deviator = 2P·sin(Δθ/2)" value={f(res.Fdeviator, 1)} unit="kN" hi />
            <Row label="friksi per deviator" value={`${f(res.frictionLoss * 100, 2)}%`} />
            <Row label="uplift ekivalen" value={f(res.wEquiv, 2)} unit="kN/m" />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Efek Orde-Kedua (lengan berkurang)</p>
          <table className="w-full"><tbody>
            <Row label="e efektif mid-span" value={f(res.eEffective, 0)} unit="mm" />
            <Row label="d_p efektif" value={f(res.dpEffective, 0)} unit="mm" hi />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">ULS Tendon Unbonded/Eksternal (ACI §20.3.2.4.1)</p>
          <table className="w-full"><tbody>
            <Row label="ρ_p" value={res.rhoP.toExponential(2)} />
            <Row label="f_ps (cap = f_py / f_pe+Δ)" value={f(res.fps, 0)} unit="MPa" hi />
            <Row label="a blok Whitney" value={f(res.a, 1)} unit="mm" />
            <Row label="M_n" value={f(res.Mn, 0)} unit="kN·m" />
            <Row label="φM_n (φ=0.9)" value={f(res.phiMn, 0)} unit="kN·m" hi />
          </tbody></table>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1.5 text-[10px] text-amber-700">
          Tendon eksternal: Δf_ps jauh lebih kecil dari tendon lekat (member-dependent), dan
          lengan momen berkurang akibat lendutan → kapasitas lentur lebih rendah; selalu cek deviator & friksi.
        </div>
      </div>
    </div>
  );
}
