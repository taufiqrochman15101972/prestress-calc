"use client";

import React, { useMemo, useState } from "react";
import { solveShell, type ShellInputs } from "@/engine/fem/shellsolver";
import { jetColor } from "@/engine/internalforces";

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
const f = (v: number, d = 3) => (isFinite(v) ? v.toFixed(d) : "—");

export function ShellSolverCalculator() {
  const [p, setP] = useState<ShellInputs>({ a: 4000, b: 4000, nx: 8, ny: 8, t: 200, E: 25000, nu: 0.2, qz: 0.01, edgeN: 0, edge: "SS" });
  const set = (k: keyof ShellInputs, v: number | string) => setP(prev => ({ ...prev, [k]: v }));
  const r = useMemo(() => solveShell(p), [p]);

  const ISO = Math.PI / 6, cI = Math.cos(ISO), sI = Math.sin(ISO);
  const maxAbsW = Math.max(...r.nodes.map(n => Math.abs(n.w)), 1e-9);
  const wScale = (0.26 * Math.max(p.a, p.b)) / maxAbsW;
  const isoX = (X: number, Y: number) => (X - Y) * cI, isoUp = (X: number, Y: number, Z: number) => Z - (X + Y) * sI;
  const pj = r.nodes.map(n => ({ ix: isoX(n.x, n.y), iy: isoUp(n.x, n.y, n.w * wScale) }));
  const W = 440, H = 300, pad = 28;
  const minIX = Math.min(...pj.map(q => q.ix)), maxIX = Math.max(...pj.map(q => q.ix)), minIY = Math.min(...pj.map(q => q.iy)), maxIY = Math.max(...pj.map(q => q.iy));
  const sc = Math.min((W - 2 * pad) / Math.max(maxIX - minIX, 1), (H - 2 * pad) / Math.max(maxIY - minIY, 1));
  const ox = pad - minIX * sc, oy = H - pad + minIY * sc;
  const PR = (X: number, Y: number, Z: number) => ({ x: ox + isoX(X, Y) * sc, y: oy - isoUp(X, Y, Z) * sc });
  const at = (i: number, j: number) => r.nodes[j * r.nnx + i];

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-52 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Shell 3D penuh (membran+lentur+drilling)</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="a" unit="mm" value={p.a} step={250} onChange={v => set("a", v)} />
          <Nf label="b" unit="mm" value={p.b} step={250} onChange={v => set("b", v)} />
          <Nf label="nx" value={p.nx} step={1} onChange={v => set("nx", Math.max(2, Math.round(v)))} />
          <Nf label="ny" value={p.ny} step={1} onChange={v => set("ny", Math.max(2, Math.round(v)))} />
          <Nf label="t" unit="mm" value={p.t} step={10} onChange={v => set("t", v)} />
          <Nf label="E" unit="MPa" value={p.E} step={1000} onChange={v => set("E", v)} />
          <Nf label="ν" value={p.nu} step={0.05} onChange={v => set("nu", v)} />
          <Nf label="q tekanan" unit="N/mm²" value={p.qz} step={0.005} onChange={v => set("qz", v)} />
          <Nf label="N tarik x=a" unit="N" value={p.edgeN} step={100000} onChange={v => set("edgeN", v)} />
          <div className="flex flex-col gap-0.5"><span className="text-[9px] text-gray-500">tepi</span>
            <select value={p.edge} onChange={e => set("edge", e.target.value)} className="rounded border border-gray-300 px-1 py-1 text-[10px]"><option value="SS">Simply-supported</option><option value="CLAMPED">Clamped</option></select></div>
        </div>
        <table className="w-full"><tbody>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">DOF (6/node)</td><td className="font-mono text-right text-[10px]">{r.dof}</td></tr>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">w tengah (lentur)</td><td className="font-mono text-right text-[10px] font-semibold text-red-600">{f(r.centerW, 3)} mm</td></tr>
          <tr><td className="text-[10px] text-gray-500 py-0.5">u tepi x=a (membran)</td><td className="font-mono text-right text-[10px] font-semibold text-blue-700">{f(r.uEnd, 4)} mm</td></tr>
        </tbody></table>
        <p className="text-[9px] text-gray-400 leading-snug">Elemen flat-shell Q4 6-DOF/node (membran bilinear + pelat Mindlin-SRI bebas shear-locking + drilling) dirakit penuh. Tekanan → lentur w; tarik tepi → regangan membran u.</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">Permukaan lendutan isometrik (warna = |w|)</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-gray-200 rounded bg-slate-50">
          {Array.from({ length: p.ny }).flatMap((_, j) => Array.from({ length: p.nx }).map((_, i) => {
            const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
            const pa = PR(a.x, a.y, a.w * wScale), pb = PR(b.x, b.y, b.w * wScale), pc = PR(c.x, c.y, c.w * wScale), pd = PR(d.x, d.y, d.w * wScale);
            const wAvg = (a.w + b.w + c.w + d.w) / 4;
            return <polygon key={`${i}-${j}`} points={`${pa.x},${pa.y} ${pb.x},${pb.y} ${pc.x},${pc.y} ${pd.x},${pd.y}`} fill={jetColor(-Math.abs(wAvg) / maxAbsW * 2 + 1)} fillOpacity="0.9" stroke="#1e293b" strokeWidth="0.3" />;
          }))}
        </svg>
      </div>
    </div>
  );
}
