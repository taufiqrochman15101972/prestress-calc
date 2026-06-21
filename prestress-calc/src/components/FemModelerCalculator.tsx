"use client";

import React, { useMemo, useState } from "react";
import { solveFrame, type FrameModel, type FemNode, type FemMember } from "@/engine/fem/frame";
import { linearRepeat, mirror, rotateCopy, deflectedShape } from "@/engine/fem/model";
import { checkSteelMember } from "@/engine/fem/designcheck";
import { solveFramePDelta } from "@/engine/fem/pdelta";
import { useDesignStore } from "@/store/useDesignStore";

// ── default portal frame (STAAD-like: page opens pre-filled, not blank) ──
const DEFAULT: FrameModel = {
  nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: 3000 }, { id: 3, x: 6000, y: 3000 }, { id: 4, x: 6000, y: 0 }],
  members: [
    { id: 1, n1: 1, n2: 2, E: 200000, A: 80000, I: 1.067e9 },
    { id: 2, n1: 2, n2: 3, E: 200000, A: 80000, I: 1.067e9 },
    { id: 3, n1: 4, n2: 3, E: 200000, A: 80000, I: 1.067e9 },
  ],
  supports: [{ node: 1, ux: true, uy: true, rz: true }, { node: 4, ux: true, uy: true, rz: true }],
  nodalLoads: [{ node: 2, fx: 20000 }],
  memberLoads: [{ member: 2, w: -30 }],
};

const f = (v: number, d = 2) => (isFinite(v) ? v.toFixed(d) : "—");
type ViewMode = "model" | "deflect" | "N" | "V" | "M";

export function FemModelerCalculator() {
  const [model, setModel] = useState<FrameModel>(DEFAULT);
  const [view, setView] = useState<ViewMode>("deflect");
  const [sec, setSec] = useState({ E: 200000, A: 80000, I: 1.067e9 });
  // copy controls
  const [cp, setCp] = useState({ method: "linear" as "linear" | "mirror" | "rotate", dx: 6000, dy: 0, copies: 1, axis: "V" as "V" | "H", at: 6000, cx: 0, cy: 0, dth: 90 });

  const [dc, setDc] = useState({ on: false, Fy: 250, d: 400 });   // design check (steel)
  const [pdOn, setPdOn] = useState(false);                        // P-Δ second-order
  const updateLoads = useDesignStore(s => s.updateLoads);
  const [sentMsg, setSentMsg] = useState("");

  const result = useMemo(() => {
    try { return { r: solveFrame(model), err: "" }; }
    catch (e) { return { r: null, err: e instanceof Error ? e.message : "error" }; }
  }, [model]);
  const pd = useMemo(() => {
    if (!pdOn) return null;
    try { return solveFramePDelta(model); } catch { return null; }
  }, [model, pdOn]);

  const upd = (m: FrameModel) => setModel(m);
  const setNode = (id: number, k: "x" | "y", v: number) =>
    upd({ ...model, nodes: model.nodes.map(n => n.id === id ? { ...n, [k]: v } : n) });
  const addNode = () => {
    const id = model.nodes.reduce((m, n) => Math.max(m, n.id), 0) + 1;
    upd({ ...model, nodes: [...model.nodes, { id, x: 0, y: 0 }] });
  };
  const setMember = (id: number, k: "n1" | "n2", v: number) =>
    upd({ ...model, members: model.members.map(m => m.id === id ? { ...m, [k]: v } : m) });
  const addMember = () => {
    const id = model.members.reduce((m, e) => Math.max(m, e.id), 0) + 1;
    upd({ ...model, members: [...model.members, { id, n1: 1, n2: 2, ...sec }] });
  };
  const applySection = () => upd({ ...model, members: model.members.map(m => ({ ...m, ...sec })) });
  const toggleSup = (node: number, k: "ux" | "uy" | "rz") => {
    const ex = model.supports.find(s => s.node === node);
    if (ex) upd({ ...model, supports: model.supports.map(s => s.node === node ? { ...s, [k]: !s[k] } : s) });
    else upd({ ...model, supports: [...model.supports, { node, ux: false, uy: false, rz: false, [k]: true }] });
  };
  const doCopy = () => {
    const ids = model.members.map(m => m.id);   // copy all (simple selection)
    if (cp.method === "linear") upd(linearRepeat(model, ids, cp.dx, cp.dy, cp.copies));
    else if (cp.method === "mirror") upd(mirror(model, ids, cp.axis, cp.at));
    else upd(rotateCopy(model, ids, cp.cx, cp.cy, cp.dth, cp.copies));
  };

  // ── isometric view: global X→right, Y→front (depth), Z→up ──
  // 2D frame lives in the X–Z plane (node.x = X, node.y = Z up); depth Y=0 now,
  // ready for 3D. True-scale isometric (no perspective shrink), just "cornered".
  const ISO = Math.PI / 6, cI = Math.cos(ISO), sI = Math.sin(ISO);
  const isoX = (X: number, Y: number) => (X - Y) * cI;
  const isoUp = (X: number, Y: number, Z: number) => Z - (X + Y) * sI;
  const W = 540, H = 330, pad = 42;
  const pj = model.nodes.map(n => ({ ix: isoX(n.x, 0), iy: isoUp(n.x, 0, n.y) }));
  const minIX = Math.min(...pj.map(p => p.ix), 0), maxIX = Math.max(...pj.map(p => p.ix), 1);
  const minIY = Math.min(...pj.map(p => p.iy), 0), maxIY = Math.max(...pj.map(p => p.iy), 1);
  const sc = Math.min((W - 2 * pad) / Math.max(maxIX - minIX, 1), (H - 2 * pad) / Math.max(maxIY - minIY, 1));
  const ox = pad - minIX * sc, oy = H - pad + minIY * sc;
  const P = (X: number, Z: number, Y = 0) => ({ x: ox + isoX(X, Y) * sc, y: oy - isoUp(X, Y, Z) * sc });
  const Xs = model.nodes.map(n => n.x), Zs = model.nodes.map(n => n.y);
  const spanModel = Math.max(Math.max(...Xs) - Math.min(...Xs), Math.max(...Zs) - Math.min(...Zs), 1);
  const r = result.r;
  const defScale = r ? (0.12 * spanModel) / Math.max(r.maxDisp, 1e-9) : 0;

  const nodeById = new Map(model.nodes.map(n => [n.id, n]));
  const dispById = new Map((r?.disp ?? []).map(d => [d.node, d]));
  // axis triad (corner), unit screen directions
  const tri = { x0: 50, y0: H - 30, len: 22 };
  const triX = { x: tri.x0 + cI * tri.len, y: tri.y0 + sI * tri.len };
  const triY = { x: tri.x0 - cI * tri.len, y: tri.y0 + sI * tri.len };
  const triZ = { x: tri.x0, y: tri.y0 - tri.len };

  return (
    <div className="text-[11px]">
      <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">
        FEM Modeler (gaya STAAD.Pro) — elemen balok-kolom 2D (aksial+geser+lentur), solver Float64Array zero-copy
      </p>
      <div className="flex gap-4 flex-wrap">
        {/* ── tables / controls ── */}
        <div className="w-64 flex-none space-y-2">
          <details open>
            <summary className="text-[10px] font-bold text-gray-600 cursor-pointer">Node (titik)</summary>
            <table className="w-full mt-1"><thead><tr className="text-[8px] text-gray-400"><th>id</th><th>X (mm)</th><th>Y (mm)</th><th>Sup</th></tr></thead>
              <tbody>{model.nodes.map(n => {
                const s = model.supports.find(su => su.node === n.id);
                return (<tr key={n.id} className="border-b border-gray-100">
                  <td className="text-center text-[9px]">{n.id}</td>
                  <td><input type="number" value={n.x} onChange={e => setNode(n.id, "x", +e.target.value)} className="w-14 text-[9px] font-mono border border-gray-200 rounded px-0.5" /></td>
                  <td><input type="number" value={n.y} onChange={e => setNode(n.id, "y", +e.target.value)} className="w-14 text-[9px] font-mono border border-gray-200 rounded px-0.5" /></td>
                  <td className="text-center text-[8px]">
                    {(["ux", "uy", "rz"] as const).map(k => (
                      <button key={k} onClick={() => toggleSup(n.id, k)} title={k}
                        className={`px-0.5 ${s?.[k] ? "text-blue-700 font-bold" : "text-gray-300"}`}>{k[0]}</button>
                    ))}
                  </td>
                </tr>);
              })}</tbody></table>
            <button onClick={addNode} className="text-[9px] text-blue-600 mt-0.5">+ node</button>
          </details>

          <details open>
            <summary className="text-[10px] font-bold text-gray-600 cursor-pointer">Member (elemen)</summary>
            <table className="w-full mt-1"><thead><tr className="text-[8px] text-gray-400"><th>id</th><th>n1</th><th>n2</th><th>UDL w</th></tr></thead>
              <tbody>{model.members.map(m => {
                const ml = model.memberLoads.find(l => l.member === m.id);
                return (<tr key={m.id} className="border-b border-gray-100">
                  <td className="text-center text-[9px]">{m.id}</td>
                  <td><input type="number" value={m.n1} onChange={e => setMember(m.id, "n1", +e.target.value)} className="w-9 text-[9px] font-mono border border-gray-200 rounded px-0.5" /></td>
                  <td><input type="number" value={m.n2} onChange={e => setMember(m.id, "n2", +e.target.value)} className="w-9 text-[9px] font-mono border border-gray-200 rounded px-0.5" /></td>
                  <td><input type="number" value={ml?.w ?? 0} onChange={e => {
                    const w = +e.target.value; const rest = model.memberLoads.filter(l => l.member !== m.id);
                    upd({ ...model, memberLoads: w ? [...rest, { member: m.id, w }] : rest });
                  }} className="w-12 text-[9px] font-mono border border-gray-200 rounded px-0.5" /></td>
                </tr>);
              })}</tbody></table>
            <button onClick={addMember} className="text-[9px] text-blue-600 mt-0.5">+ member</button>
          </details>

          <details>
            <summary className="text-[10px] font-bold text-gray-600 cursor-pointer">Penampang (E, A, I)</summary>
            <div className="grid grid-cols-3 gap-1 mt-1">
              <input type="number" value={sec.E} onChange={e => setSec({ ...sec, E: +e.target.value })} className="text-[9px] font-mono border rounded px-0.5" title="E MPa" />
              <input type="number" value={sec.A} onChange={e => setSec({ ...sec, A: +e.target.value })} className="text-[9px] font-mono border rounded px-0.5" title="A mm²" />
              <input type="number" value={sec.I} onChange={e => setSec({ ...sec, I: +e.target.value })} className="text-[9px] font-mono border rounded px-0.5" title="I mm⁴" />
            </div>
            <button onClick={applySection} className="text-[9px] text-blue-600 mt-0.5">terapkan ke semua member</button>
          </details>

          <details>
            <summary className="text-[10px] font-bold text-gray-600 cursor-pointer">Copy/Paste (3 cara)</summary>
            <select value={cp.method} onChange={e => setCp({ ...cp, method: e.target.value as typeof cp.method })} className="w-full text-[9px] border rounded px-0.5 mt-1">
              <option value="linear">1. Linear repeat (translasi)</option>
              <option value="mirror">2. Mirror (cermin)</option>
              <option value="rotate">3. Rotate/circular</option>
            </select>
            {cp.method === "linear" && <div className="grid grid-cols-3 gap-1 mt-1">
              <input type="number" value={cp.dx} onChange={e => setCp({ ...cp, dx: +e.target.value })} className="text-[9px] border rounded px-0.5" title="Δx" />
              <input type="number" value={cp.dy} onChange={e => setCp({ ...cp, dy: +e.target.value })} className="text-[9px] border rounded px-0.5" title="Δy" />
              <input type="number" value={cp.copies} onChange={e => setCp({ ...cp, copies: +e.target.value })} className="text-[9px] border rounded px-0.5" title="n" />
            </div>}
            {cp.method === "mirror" && <div className="grid grid-cols-2 gap-1 mt-1">
              <select value={cp.axis} onChange={e => setCp({ ...cp, axis: e.target.value as "V" | "H" })} className="text-[9px] border rounded px-0.5"><option value="V">vertikal</option><option value="H">horizontal</option></select>
              <input type="number" value={cp.at} onChange={e => setCp({ ...cp, at: +e.target.value })} className="text-[9px] border rounded px-0.5" title="axis at" />
            </div>}
            {cp.method === "rotate" && <div className="grid grid-cols-4 gap-1 mt-1">
              <input type="number" value={cp.cx} onChange={e => setCp({ ...cp, cx: +e.target.value })} className="text-[9px] border rounded px-0.5" title="cx" />
              <input type="number" value={cp.cy} onChange={e => setCp({ ...cp, cy: +e.target.value })} className="text-[9px] border rounded px-0.5" title="cy" />
              <input type="number" value={cp.dth} onChange={e => setCp({ ...cp, dth: +e.target.value })} className="text-[9px] border rounded px-0.5" title="Δθ°" />
              <input type="number" value={cp.copies} onChange={e => setCp({ ...cp, copies: +e.target.value })} className="text-[9px] border rounded px-0.5" title="n" />
            </div>}
            <button onClick={doCopy} className="text-[9px] bg-blue-600 text-white rounded px-2 py-0.5 mt-1">Copy semua member</button>
          </details>
          <button onClick={() => setModel(DEFAULT)} className="text-[9px] text-gray-500">↺ reset portal default</button>
        </div>

        {/* ── viewport ── */}
        <div className="flex-1 min-w-[420px]">
          <div className="flex gap-1 mb-1">
            {(["model", "deflect", "N", "V", "M"] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-2 py-0.5 rounded text-[10px] border ${view === v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300"}`}>
                {v === "model" ? "Model" : v === "deflect" ? "Lendutan" : v === "N" ? "Aksial N" : v === "V" ? "Geser V" : "Momen M"}
              </button>
            ))}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-gray-200 rounded bg-slate-50">
            {/* members */}
            {model.members.map(m => {
              const a = nodeById.get(m.n1), b = nodeById.get(m.n2); if (!a || !b) return null;
              const pa = P(a.x, a.y), pb = P(b.x, b.y);
              return <line key={m.id} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#334155" strokeWidth="1.6" />;
            })}
            {/* deflected overlay */}
            {r && view === "deflect" && model.members.map(m => {
              const a = nodeById.get(m.n1)!, b = nodeById.get(m.n2)!;
              const d1 = dispById.get(m.n1)!, d2 = dispById.get(m.n2)!;
              const pts = deflectedShape(a.x, a.y, b.x, b.y, d1, d2, defScale).map(p => { const q = P(p.x, p.y); return `${q.x},${q.y}`; }).join(" ");
              return <polyline key={m.id} points={pts} fill="none" stroke="#dc2626" strokeWidth="1.4" />;
            })}
            {/* N/V/M diagram (offset ⟂ member in the X–Z plane) */}
            {r && (view === "N" || view === "V" || view === "M") && model.members.map(m => {
              const mf = r.members.find(x => x.id === m.id); const a = nodeById.get(m.n1)!, b = nodeById.get(m.n2)!;
              if (!mf) return null;
              const c = (b.x - a.x) / mf.L, s = (b.y - a.y) / mf.L, nx = -s, ny = c;  // perp in X–Z
              const vals = mf.samples.map(sp => view === "N" ? sp.N : view === "V" ? sp.V : sp.M);
              const vmax = Math.max(...vals.map(Math.abs), 1e-9);
              const amp = 0.10 * spanModel / vmax;
              const pa = P(a.x, a.y), pb = P(b.x, b.y);
              const pts = mf.samples.map((sp, i) => {
                const xx = a.x + c * sp.x + nx * vals[i] * amp, yy = a.y + s * sp.x + ny * vals[i] * amp;
                const q = P(xx, yy); return `${q.x},${q.y}`;
              });
              const base = `${pa.x},${pa.y} ${pts.join(" ")} ${pb.x},${pb.y}`;
              const col = view === "N" ? "#6b7280" : view === "V" ? "#0891b2" : "#1d4ed8";
              return <polygon key={m.id} points={base} fill={col} fillOpacity="0.18" stroke={col} strokeWidth="1" />;
            })}
            {/* nodes + supports */}
            {model.nodes.map(n => {
              const s = model.supports.find(su => su.node === n.id);
              const q = P(n.x, n.y);
              return (<g key={n.id}>
                <circle cx={q.x} cy={q.y} r="2.5" fill="#1e293b" />
                <text x={q.x + 4} y={q.y - 4} fontSize="8" fill="#475569">{n.id}</text>
                {s && (s.ux || s.uy) && <polygon points={`${q.x - 5},${q.y + 9} ${q.x + 5},${q.y + 9} ${q.x},${q.y}`} fill={s.rz ? "#475569" : "none"} stroke="#475569" strokeWidth="1" />}
              </g>);
            })}
            {/* axis triad: X→right, Y→front, Z→up (isometric) */}
            <g>
              <line x1={tri.x0} y1={tri.y0} x2={triX.x} y2={triX.y} stroke="#dc2626" strokeWidth="1.4" />
              <line x1={tri.x0} y1={tri.y0} x2={triY.x} y2={triY.y} stroke="#16a34a" strokeWidth="1.4" />
              <line x1={tri.x0} y1={tri.y0} x2={triZ.x} y2={triZ.y} stroke="#1d4ed8" strokeWidth="1.4" />
              <text x={triX.x + 1} y={triX.y + 6} fontSize="8" fill="#dc2626">X</text>
              <text x={triY.x - 8} y={triY.y + 6} fontSize="8" fill="#16a34a">Y</text>
              <text x={triZ.x - 2} y={triZ.y - 2} fontSize="8" fill="#1d4ed8">Z</text>
            </g>
          </svg>

          {result.err
            ? <p className="text-[10px] text-red-600 mt-1">⚠ {result.err}</p>
            : r && <div className="mt-1 grid grid-cols-3 gap-2">
              <div className="rounded border border-gray-200 px-2 py-1"><div className="text-[8px] text-gray-500">DOF</div><div className="font-mono text-[11px] font-semibold">{r.dofCount}</div></div>
              <div className="rounded border border-gray-200 px-2 py-1"><div className="text-[8px] text-gray-500">|u|_max</div><div className="font-mono text-[11px] font-semibold text-red-600">{f(r.maxDisp, 2)} mm</div></div>
              <div className="rounded border border-gray-200 px-2 py-1"><div className="text-[8px] text-gray-500">M_max</div><div className="font-mono text-[11px] font-semibold text-blue-700">{f(Math.max(...r.members.flatMap(m => m.samples.map(s => Math.abs(s.M)))) / 1e6, 1)} kN·m</div></div>
            </div>}
          {r && <div className="mt-1 max-h-28 overflow-auto">
            <table className="w-full text-[9px]"><thead><tr className="text-gray-400"><th className="text-left">mbr</th><th>N₁(kN)</th><th>V₁(kN)</th><th>M₁(kN·m)</th><th>M₂(kN·m)</th>{dc.on && <th>rasio</th>}</tr></thead>
              <tbody className="font-mono">{r.members.map(m => {
                let ratio = 0, ok = true;
                if (dc.on) {
                  const sec = model.members.find(mm => mm.id === m.id)!;
                  const Mmax = Math.max(...m.samples.map(sp => Math.abs(sp.M)));
                  const Vmax = Math.max(Math.abs(m.V1), Math.abs(m.V2));
                  const cr = checkSteelMember({ N: m.N1, M: Mmax, V: Vmax, L: m.L, A: sec.A, I: sec.I, d: dc.d, Fy: dc.Fy, E: sec.E, Kfac: 1 });
                  ratio = cr.ratio; ok = cr.ok;
                }
                return (<tr key={m.id} className="border-b border-gray-100"><td>{m.id}</td><td className="text-right">{f(m.N1 / 1e3, 1)}</td><td className="text-right">{f(m.V1 / 1e3, 1)}</td><td className="text-right">{f(m.M1 / 1e6, 1)}</td><td className="text-right">{f(m.M2 / 1e6, 1)}</td>{dc.on && <td className="text-right font-bold" style={{ color: ratio > 1 ? "#dc2626" : ratio > 0.9 ? "#d97706" : "#16a34a" }}>{f(ratio, 2)}</td>}</tr>);
              })}</tbody></table>
          </div>}

          {/* ── Cek Desain (MIDAS/Robot) + P-Δ nonlinier ── */}
          <div className="mt-2 border-t border-gray-200 pt-2 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <label className="flex items-center gap-1"><input type="checkbox" checked={dc.on} onChange={e => setDc({ ...dc, on: e.target.checked })} /> Cek desain baja (AISC/SNI 1729)</label>
              {dc.on && <>
                <span className="text-gray-500">F_y</span><input type="number" value={dc.Fy} onChange={e => setDc({ ...dc, Fy: +e.target.value })} className="w-14 border rounded px-1 font-mono text-[9px]" />
                <span className="text-gray-500">d</span><input type="number" value={dc.d} onChange={e => setDc({ ...dc, d: +e.target.value })} className="w-14 border rounded px-1 font-mono text-[9px]" />
                {r && <span className="font-semibold" style={{ color: Math.max(...r.members.map(m => { const sec = model.members.find(mm => mm.id === m.id)!; const Mmax = Math.max(...m.samples.map(sp => Math.abs(sp.M))); return checkSteelMember({ N: m.N1, M: Mmax, V: Math.max(Math.abs(m.V1), Math.abs(m.V2)), L: m.L, A: sec.A, I: sec.I, d: dc.d, Fy: dc.Fy, E: sec.E, Kfac: 1 }).ratio; })) > 1 ? "#dc2626" : "#16a34a" }}>rasio maks = {f(Math.max(...r.members.map(m => { const sec = model.members.find(mm => mm.id === m.id)!; const Mmax = Math.max(...m.samples.map(sp => Math.abs(sp.M))); return checkSteelMember({ N: m.N1, M: Mmax, V: Math.max(Math.abs(m.V1), Math.abs(m.V2)), L: m.L, A: sec.A, I: sec.I, d: dc.d, Fy: dc.Fy, E: sec.E, Kfac: 1 }).ratio; })), 2)}</span>}
              </>}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <label className="flex items-center gap-1"><input type="checkbox" checked={pdOn} onChange={e => setPdOn(e.target.checked)} /> Analisis P-Δ (orde-2 / nonlinier geometrik)</label>
              {pd && <span className="font-mono text-gray-700">δ₁={f(pd.firstOrderMax, 2)} → δ₂={f(pd.secondOrderMax, 2)} mm · <b style={{ color: pd.diverged ? "#dc2626" : "#1d4ed8" }}>amplifikasi {pd.diverged ? "∞ (tekuk!)" : "×" + f(pd.amplification, 3)}</b> ({pd.iterations} iter)</span>}
            </div>
            <p className="text-[9px] text-gray-400">Cek desain & P-Δ memakai gaya batang dari solver FEM (gaya MIDAS/Robot). Rasio &gt;1 = tidak memenuhi (merah).</p>
            {r && <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => {
                const maxM = Math.max(...r.members.flatMap(m => m.samples.map(s => Math.abs(s.M)))) / 1e6;
                updateLoads({ directMoments: { enabled: true, Mg: 0, Msdl: 0, Mlive: +maxM.toFixed(1) } });
                setSentMsg(`M maks ${maxM.toFixed(1)} kN·m → desain girder (sbg M_live, input langsung aktif).`);
              }} className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] hover:bg-emerald-700">→ kirim gaya ke desain girder</button>
              {sentMsg && <span className="text-[9px] text-emerald-700">{sentMsg}</span>}
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}
