"use client";

import React, { useMemo, useState } from "react";
import { solveFrame3D, type Frame3DModel } from "@/engine/fem/frame3d";

// default 1-bay space frame (4 fixed base + 4 top, 4 columns + 4 ring beams)
const SEC = { E: 200000, G: 80000, A: 80000, Iy: 1.067e9, Iz: 1.067e9, J: 1.5e9 };
const DEFAULT: Frame3DModel = {
  nodes: [
    { id: 1, x: 0, y: 0, z: 0 }, { id: 2, x: 6000, y: 0, z: 0 }, { id: 3, x: 6000, y: 6000, z: 0 }, { id: 4, x: 0, y: 6000, z: 0 },
    { id: 5, x: 0, y: 0, z: 4000 }, { id: 6, x: 6000, y: 0, z: 4000 }, { id: 7, x: 6000, y: 6000, z: 4000 }, { id: 8, x: 0, y: 6000, z: 4000 },
  ],
  members: [
    { id: 1, n1: 1, n2: 5, ...SEC }, { id: 2, n1: 2, n2: 6, ...SEC }, { id: 3, n1: 3, n2: 7, ...SEC }, { id: 4, n1: 4, n2: 8, ...SEC },
    { id: 5, n1: 5, n2: 6, ...SEC }, { id: 6, n1: 6, n2: 7, ...SEC }, { id: 7, n1: 7, n2: 8, ...SEC }, { id: 8, n1: 8, n2: 5, ...SEC },
  ],
  supports: [1, 2, 3, 4].map(node => ({ node, dofs: [true, true, true, true, true, true] as [boolean, boolean, boolean, boolean, boolean, boolean] })),
  loads: [{ node: 5, fx: 30000 }, { node: 6, fx: 30000 }, { node: 7, fz: -40000 }, { node: 8, fz: -40000 }],
};
const f = (v: number, d = 2) => (isFinite(v) ? v.toFixed(d) : "—");

export function Frame3DCalculator() {
  const [model, setModel] = useState<Frame3DModel>(DEFAULT);
  const [showDef, setShowDef] = useState(true);
  const r = useMemo(() => { try { return { r: solveFrame3D(model), e: "" }; } catch (e) { return { r: null, e: e instanceof Error ? e.message : "err" }; } }, [model]);

  const setNode = (id: number, k: "x" | "y" | "z", v: number) => setModel(m => ({ ...m, nodes: m.nodes.map(n => n.id === id ? { ...n, [k]: v } : n) }));
  const setLoad = (node: number, k: "fx" | "fy" | "fz", v: number) => setModel(m => {
    const rest = m.loads.filter(l => l.node !== node);
    const ex = m.loads.find(l => l.node === node) ?? { node };
    return { ...m, loads: [...rest, { ...ex, [k]: v }] };
  });

  // isometric: X→right, Y→front, Z→up
  const ISO = Math.PI / 6, cI = Math.cos(ISO), sI = Math.sin(ISO);
  const iX = (X: number, Y: number) => (X - Y) * cI;
  const iU = (X: number, Y: number, Z: number) => Z - (X + Y) * sI;
  const pj = model.nodes.map(n => ({ ix: iX(n.x, n.y), iy: iU(n.x, n.y, n.z) }));
  const W = 460, H = 340, pad = 38;
  const minIX = Math.min(...pj.map(p => p.ix)), maxIX = Math.max(...pj.map(p => p.ix));
  const minIY = Math.min(...pj.map(p => p.iy)), maxIY = Math.max(...pj.map(p => p.iy));
  const sc = Math.min((W - 2 * pad) / Math.max(maxIX - minIX, 1), (H - 2 * pad) / Math.max(maxIY - minIY, 1));
  const ox = pad - minIX * sc, oy = H - pad + minIY * sc;
  const P = (X: number, Y: number, Z: number) => ({ x: ox + iX(X, Y) * sc, y: oy - iU(X, Y, Z) * sc });
  const nById = new Map(model.nodes.map(n => [n.id, n]));
  const dById = new Map((r.r?.disp ?? []).map(d => [d.node, d]));
  const span = Math.max(...model.nodes.map(n => Math.max(n.x, n.y, n.z))) || 1;
  const defSc = r.r ? (0.12 * span) / Math.max(r.r.maxDisp, 1e-9) : 0;
  const tri = { x0: 42, y0: H - 26, len: 20 };

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-60 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Rangka Ruang 3D (6 DOF/node)</p>
        <details open><summary className="text-[10px] font-bold text-gray-600 cursor-pointer">Node (x,y,z) + tumpuan</summary>
          <table className="w-full mt-1"><thead><tr className="text-[8px] text-gray-400"><th>id</th><th>X</th><th>Y</th><th>Z</th><th>fix</th></tr></thead>
            <tbody>{model.nodes.map(n => {
              const fixed = model.supports.some(s => s.node === n.id);
              return (<tr key={n.id} className="border-b border-gray-100">
                <td className="text-center text-[9px]">{n.id}</td>
                {(["x", "y", "z"] as const).map(k => <td key={k}><input type="number" value={n[k]} onChange={e => setNode(n.id, k, +e.target.value)} className="w-11 text-[9px] font-mono border border-gray-200 rounded px-0.5" /></td>)}
                <td className="text-center"><button onClick={() => setModel(m => ({ ...m, supports: fixed ? m.supports.filter(s => s.node !== n.id) : [...m.supports, { node: n.id, dofs: [true, true, true, true, true, true] }] }))} className={`text-[10px] ${fixed ? "text-blue-700 font-bold" : "text-gray-300"}`}>⊿</button></td>
              </tr>);
            })}</tbody></table>
        </details>
        <details><summary className="text-[10px] font-bold text-gray-600 cursor-pointer">Beban titik (kN→N)</summary>
          <table className="w-full mt-1"><thead><tr className="text-[8px] text-gray-400"><th>node</th><th>Fx</th><th>Fy</th><th>Fz</th></tr></thead>
            <tbody>{model.nodes.map(n => {
              const ld = model.loads.find(l => l.node === n.id);
              return (<tr key={n.id} className="border-b border-gray-100"><td className="text-center text-[9px]">{n.id}</td>
                {(["fx", "fy", "fz"] as const).map(k => <td key={k}><input type="number" value={ld?.[k] ?? 0} onChange={e => setLoad(n.id, k, +e.target.value)} className="w-12 text-[9px] font-mono border border-gray-200 rounded px-0.5" /></td>)}
              </tr>);
            })}</tbody></table>
        </details>
        <label className="flex items-center gap-1 text-[10px]"><input type="checkbox" checked={showDef} onChange={e => setShowDef(e.target.checked)} /> tampilkan lendutan</label>
        <button onClick={() => setModel(DEFAULT)} className="text-[9px] text-gray-500">↺ reset space frame default</button>
        {r.r && <table className="w-full"><tbody>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">DOF</td><td className="font-mono text-right text-[10px]">{r.r.dof}</td></tr>
          <tr><td className="text-[10px] text-gray-500 py-0.5">|u|_max</td><td className="font-mono text-right text-[10px] font-semibold text-red-600">{f(r.r.maxDisp, 2)} mm</td></tr>
        </tbody></table>}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">Isometrik — X→kanan, Y→depan, Z→atas</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-gray-200 rounded bg-slate-50">
          {model.members.map(m => {
            const a = nById.get(m.n1)!, b = nById.get(m.n2)!; const pa = P(a.x, a.y, a.z), pb = P(b.x, b.y, b.z);
            return <line key={m.id} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#334155" strokeWidth="1.5" />;
          })}
          {r.r && showDef && model.members.map(m => {
            const a = nById.get(m.n1)!, b = nById.get(m.n2)!, da = dById.get(m.n1)!, db = dById.get(m.n2)!;
            const pa = P(a.x + da.ux * defSc, a.y + da.uy * defSc, a.z + da.uz * defSc);
            const pb = P(b.x + db.ux * defSc, b.y + db.uy * defSc, b.z + db.uz * defSc);
            return <line key={m.id} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#dc2626" strokeWidth="1.3" />;
          })}
          {model.nodes.map(n => { const q = P(n.x, n.y, n.z); const fx = model.supports.some(s => s.node === n.id);
            return <g key={n.id}><circle cx={q.x} cy={q.y} r="2.5" fill={fx ? "#475569" : "#1e293b"} /><text x={q.x + 3} y={q.y - 3} fontSize="7" fill="#475569">{n.id}</text></g>;
          })}
          <line x1={tri.x0} y1={tri.y0} x2={tri.x0 + cI * tri.len} y2={tri.y0 + sI * tri.len} stroke="#dc2626" strokeWidth="1.3" />
          <line x1={tri.x0} y1={tri.y0} x2={tri.x0 - cI * tri.len} y2={tri.y0 + sI * tri.len} stroke="#16a34a" strokeWidth="1.3" />
          <line x1={tri.x0} y1={tri.y0} x2={tri.x0} y2={tri.y0 - tri.len} stroke="#1d4ed8" strokeWidth="1.3" />
          <text x={tri.x0 + cI * tri.len + 1} y={tri.y0 + sI * tri.len + 6} fontSize="8" fill="#dc2626">X</text>
          <text x={tri.x0 - cI * tri.len - 8} y={tri.y0 + sI * tri.len + 6} fontSize="8" fill="#16a34a">Y</text>
          <text x={tri.x0 - 2} y={tri.y0 - tri.len - 2} fontSize="8" fill="#1d4ed8">Z</text>
        </svg>
        {r.e && <p className="text-[10px] text-red-600 mt-1">⚠ {r.e}</p>}
        {r.r && <div className="mt-1 max-h-28 overflow-auto"><table className="w-full text-[9px]"><thead><tr className="text-gray-400"><th>mbr</th><th>N(kN)</th><th>Vy</th><th>Vz</th><th>T(kN·m)</th><th>My</th><th>Mz</th></tr></thead>
          <tbody className="font-mono">{r.r.members.map(m => <tr key={m.id} className="border-b border-gray-100"><td className="text-center">{m.id}</td><td className="text-right">{f(m.N / 1e3, 0)}</td><td className="text-right">{f(m.Vy / 1e3, 0)}</td><td className="text-right">{f(m.Vz / 1e3, 0)}</td><td className="text-right">{f(m.T / 1e6, 1)}</td><td className="text-right">{f(m.My / 1e6, 1)}</td><td className="text-right">{f(m.Mz / 1e6, 1)}</td></tr>)}</tbody></table></div>}
      </div>
    </div>
  );
}
