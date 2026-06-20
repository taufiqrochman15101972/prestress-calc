"use client";

import React, { useMemo, useState } from "react";
import { solvePlate, type PlateInputs } from "@/engine/fem/plate";
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

export function PlateFemCalculator() {
  const [p, setP] = useState<PlateInputs>({ a: 4000, b: 4000, nx: 8, ny: 8, t: 200, E: 25000, nu: 0.2, q: 0.01, edge: "SS" });
  const set = (k: keyof PlateInputs, v: number | string) => setP(prev => ({ ...prev, [k]: v }));
  const r = useMemo(() => solvePlate(p), [p]);

  // ── isometric deflected surface: X→right, Y→front, Z(=w)→up ──
  const ISO = Math.PI / 6, cI = Math.cos(ISO), sI = Math.sin(ISO);
  const maxAbsW = Math.max(...r.nodes.map(n => Math.abs(n.w)), 1e-9);
  const wScale = (0.28 * Math.max(p.a, p.b)) / maxAbsW;
  const isoX = (X: number, Y: number) => (X - Y) * cI;
  const isoUp = (X: number, Y: number, Z: number) => Z - (X + Y) * sI;
  const proj = r.nodes.map(n => ({ ix: isoX(n.x, n.y), iy: isoUp(n.x, n.y, n.w * wScale) }));
  const minIX = Math.min(...proj.map(p => p.ix)), maxIX = Math.max(...proj.map(p => p.ix));
  const minIY = Math.min(...proj.map(p => p.iy)), maxIY = Math.max(...proj.map(p => p.iy));
  const W = 460, H = 320, pad = 30;
  const sc = Math.min((W - 2 * pad) / Math.max(maxIX - minIX, 1), (H - 2 * pad) / Math.max(maxIY - minIY, 1));
  const ox = pad - minIX * sc, oy = H - pad + minIY * sc;
  const PR = (X: number, Y: number, Z: number) => ({ x: ox + isoX(X, Y) * sc, y: oy - isoUp(X, Y, Z) * sc });
  const nodeAt = (i: number, j: number) => r.nodes[j * r.nnx + i];

  const tri = { x0: 40, y0: H - 24, len: 20 };

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-56 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Pelat/Shell FEM (Mindlin-SRI, bebas shear-locking)</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="a (Lx)" unit="mm" value={p.a} step={250} onChange={v => set("a", v)} />
          <Nf label="b (Ly)" unit="mm" value={p.b} step={250} onChange={v => set("b", v)} />
          <Nf label="mesh nx" value={p.nx} step={1} onChange={v => set("nx", Math.max(2, Math.round(v)))} />
          <Nf label="mesh ny" value={p.ny} step={1} onChange={v => set("ny", Math.max(2, Math.round(v)))} />
          <Nf label="tebal t" unit="mm" value={p.t} step={10} onChange={v => set("t", v)} />
          <Nf label="E" unit="MPa" value={p.E} step={1000} onChange={v => set("E", v)} />
          <Nf label="ν" value={p.nu} step={0.05} onChange={v => set("nu", v)} />
          <Nf label="q tekanan" unit="N/mm²" value={p.q} step={0.005} onChange={v => set("q", v)} />
          <div className="flex flex-col gap-0.5 col-span-2">
            <span className="text-[9px] font-medium text-gray-500">tepi</span>
            <select value={p.edge} onChange={e => set("edge", e.target.value)} className="rounded border border-gray-300 px-1.5 py-1 text-[10px]">
              <option value="SS">Simply-supported (tumpuan sederhana)</option>
              <option value="CLAMPED">Clamped (jepit)</option>
            </select>
          </div>
        </div>
        <table className="w-full"><tbody>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">DOF</td><td className="font-mono text-right text-[10px]">{r.dof}</td></tr>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">w_tengah (FEM)</td><td className="font-mono text-right text-[10px] font-semibold text-red-600">{f(r.centerW, 3)} mm</td></tr>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">w teori pelat tipis</td><td className="font-mono text-right text-[10px]">{f(r.analytic, 3)} mm</td></tr>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">rasio FEM/teori</td><td className="font-mono text-right text-[10px] font-semibold text-blue-700">{f(r.ratio, 3)}</td></tr>
          <tr><td className="text-[10px] text-gray-500 py-0.5">D = Et³/12(1−ν²)</td><td className="font-mono text-right text-[10px]">{(r.D).toExponential(2)}</td></tr>
        </tbody></table>
        <p className="text-[9px] text-gray-400 leading-snug">Validasi: untuk pelat persegi, rasio FEM/teori → ≈1 saat mesh dirapatkan (SS α=0,00406; jepit α=0,00126). Geser 1-titik (SRI) → tanpa shear-locking pada pelat tipis.</p>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">Permukaan lendutan isometrik — warna = w (biru kecil → merah maks)</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-gray-200 rounded bg-slate-50">
          {/* element quads colored by avg w */}
          {Array.from({ length: p.ny }).flatMap((_, j) => Array.from({ length: p.nx }).map((_, i) => {
            const a = nodeAt(i, j), b = nodeAt(i + 1, j), c = nodeAt(i + 1, j + 1), d = nodeAt(i, j + 1);
            const pa = PR(a.x, a.y, a.w * wScale), pb = PR(b.x, b.y, b.w * wScale), pc = PR(c.x, c.y, c.w * wScale), pd = PR(d.x, d.y, d.w * wScale);
            const wAvg = (a.w + b.w + c.w + d.w) / 4;
            return <polygon key={`${i}-${j}`} points={`${pa.x},${pa.y} ${pb.x},${pb.y} ${pc.x},${pc.y} ${pd.x},${pd.y}`}
              fill={jetColor(-Math.abs(wAvg) / maxAbsW * 2 + 1)} fillOpacity="0.9" stroke="#1e293b" strokeWidth="0.3" />;
          }))}
          {/* axis triad */}
          <line x1={tri.x0} y1={tri.y0} x2={tri.x0 + cI * tri.len} y2={tri.y0 + sI * tri.len} stroke="#dc2626" strokeWidth="1.3" />
          <line x1={tri.x0} y1={tri.y0} x2={tri.x0 - cI * tri.len} y2={tri.y0 + sI * tri.len} stroke="#16a34a" strokeWidth="1.3" />
          <line x1={tri.x0} y1={tri.y0} x2={tri.x0} y2={tri.y0 - tri.len} stroke="#1d4ed8" strokeWidth="1.3" />
          <text x={tri.x0 + cI * tri.len + 1} y={tri.y0 + sI * tri.len + 6} fontSize="8" fill="#dc2626">X</text>
          <text x={tri.x0 - cI * tri.len - 8} y={tri.y0 + sI * tri.len + 6} fontSize="8" fill="#16a34a">Y</text>
          <text x={tri.x0 - 2} y={tri.y0 - tri.len - 2} fontSize="8" fill="#1d4ed8">Z=w</text>
        </svg>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[8px] text-gray-500">0</span>
          <div className="flex-1 h-2 rounded" style={{ background: `linear-gradient(to right, ${jetColor(1)}, ${jetColor(0)}, ${jetColor(-1)})` }} />
          <span className="text-[8px] text-gray-500">|w|_max = {f(Math.abs(r.maxW), 2)} mm</span>
        </div>
      </div>
    </div>
  );
}
