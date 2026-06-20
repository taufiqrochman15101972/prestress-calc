"use client";

import React, { useMemo, useRef, useState } from "react";
import { useDesignStore } from "@/store/useDesignStore";
import {
  computeBeamFields, queryAt, jetColor,
  type BeamFieldInputs, type FieldKind,
} from "@/engine/internalforces";
import { concreteModulus } from "@/lib/utils";

const FIELD_META: { key: FieldKind; label: string; unit: string; color: string }[] = [
  { key: "Mz", label: "Momen Utama M_z (lentur)", unit: "kN·m", color: "#1d4ed8" },
  { key: "Vy", label: "Geser V_y (vertikal)", unit: "kN", color: "#0891b2" },
  { key: "N", label: "Aksial N (tekan −/tarik +)", unit: "kN", color: "#6b7280" },
  { key: "T", label: "Torsi / Puntir T_x", unit: "kN·m", color: "#9333ea" },
  { key: "My", label: "Momen Lateral M_y (transversal)", unit: "kN·m", color: "#c026d3" },
  { key: "Vx", label: "Geser Lateral V_x", unit: "kN", color: "#0d9488" },
  { key: "dz", label: "Lendutan Δz (−turun / +naik)", unit: "mm", color: "#dc2626" },
  { key: "dy", label: "Lendutan Lateral Δy", unit: "mm", color: "#ea580c" },
];
// display scaling: convert N·mm→kN·m (1e-6), N→kN (1e-3), mm→mm (1)
const DISP: Record<FieldKind, number> = { Mz: 1e-6, My: 1e-6, T: 1e-6, Vy: 1e-3, Vx: 1e-3, N: 1e-3, dz: 1, dy: 1 };
const f = (v: number, d = 2) => (isFinite(v) ? v.toFixed(d) : "—");

export function ForceDiagramsCalculator() {
  const { results, inputs } = useDesignStore();
  const [on, setOn] = useState<Record<FieldKind, boolean>>({
    Mz: true, Vy: true, N: false, T: false, My: false, Vx: false, dz: true, dy: false,
  });
  const [wLatLocal, setWLatLocal] = useState(0);     // kN/m lateral (wind) for demo
  const [clickX, setClickX] = useState<number | null>(null);
  const [clickY, setClickY] = useState<number | null>(null);   // mm from NA
  const elevRef = useRef<SVGSVGElement>(null);
  const secRef = useRef<SVGSVGElement>(null);

  const fin: BeamFieldInputs | null = useMemo(() => {
    if (!results) return null;
    const g = results.gross;
    const L = inputs.loads.spanLength;
    const Ec = concreteModulus(inputs.material.fc);
    const Ig = g.momentOfInertiaIg;
    const EI = Ec * Ig;
    const hG = inputs.girder.h1 + (inputs.girder.h5 ?? 0) + inputs.girder.h2 + (inputs.girder.h4 ?? 0) + inputs.girder.h3;
    const yb = g.yb, yt = hG - yb;
    // lateral inertia (about vertical axis) ≈ Σ b_i³·h_i /12
    const gg = inputs.girder;
    const Iy = (gg.h1 * gg.b1 ** 3 + gg.h2 * gg.b2 ** 3 + gg.h3 * gg.b3 ** 3) / 12;
    const EIlat = Ec * Iy;
    const totalStrands = inputs.tendon.rows.reduce((s, r) => s + r.strandCount, 0);
    const Aps = totalStrands * inputs.tendon.singleStrandArea;
    const yRes = totalStrands > 0
      ? inputs.tendon.rows.reduce((s, r) => s + r.strandCount * r.yFromBottom, 0) / totalStrands
      : yb - 100;
    const e = yb - yRes;                       // mm (tendon below NA +)
    const Pe = results.prestress.Pe * 1000;    // kN → N
    const wUDL = (results.moments.wSelf + inputs.loads.wSDL + inputs.loads.wLive); // kN/m = N/mm
    const wBal = (8 * Pe * e) / (L * L);       // N/mm upward
    return {
      L, EI, EIlat, wUDL, Pmid: 0, wBal, Plong: Pe, e, A: g.areaAg, Ig, yb, yt,
      Tu: inputs.loads.tuTorsion * 1e6, wLat: wLatLocal, Naxial: 0, samples: 81,
    };
  }, [results, inputs, wLatLocal]);

  const res = useMemo(() => (fin ? computeBeamFields(fin) : null), [fin]);

  if (!results || !fin || !res) {
    return <p className="text-[11px] text-gray-500">Jalankan desain utama dulu (panel input) agar diagram gaya dalam &amp; tegangan dapat ditampilkan.</p>;
  }

  // ── elevation geometry ──
  const W = 560, H = 230, padL = 44, padR = 14, padT = 16, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const x2px = (x: number) => padL + (x / fin.L) * plotW;
  const baseY = padT + plotH / 2;

  const activeFields = FIELD_META.filter(m => on[m.key]);
  // per-field max abs for scaling to half-plot
  const scaleOf = (k: FieldKind) => {
    const mx = Math.max(Math.abs(res.max[k]), Math.abs(res.min[k]), 1e-9);
    return (plotH / 2 - 4) / mx;
  };

  const onElevClick = (e: React.MouseEvent) => {
    const r = elevRef.current?.getBoundingClientRect(); if (!r) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    const x = ((px - padL) / plotW) * fin.L;
    setClickX(Math.min(Math.max(x, 0), fin.L));
  };

  const qX = clickX ?? fin.L / 2;
  const q = queryAt(fin, res, qX, clickY ?? 0);

  // ── section geometry ──
  const SW = 230, SH = 250, sPadT = 14, sPadB = 22, sCx = SW / 2;
  const secH = fin.yt + fin.yb;
  const sScale = (SH - sPadT - sPadB) / secH;
  const yNApx = sPadT + fin.yt * sScale;          // pixel of NA (y=0)
  const y2px = (y: number) => yNApx - y * sScale;  // y up
  // stress range over the section at qX for colormap
  const sigTop = queryAt(fin, res, qX, fin.yt).sigma.navier;
  const sigBot = queryAt(fin, res, qX, -fin.yb).sigma.navier;
  const sigAbs = Math.max(Math.abs(sigTop), Math.abs(sigBot), 1e-6);
  const bands = 40;

  const onSecClick = (e: React.MouseEvent) => {
    const r = secRef.current?.getBoundingClientRect(); if (!r) return;
    const py = ((e.clientY - r.top) / r.height) * SH;
    const y = (yNApx - py) / sScale;     // mm from NA
    setClickY(Math.min(Math.max(y, -fin.yb), fin.yt));
  };

  return (
    <div className="text-[11px]">
      <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">
        Diagram Gaya Dalam, Tegangan &amp; Lendutan — real-time (mekanika bahan lanjut; siap dikembangkan ke FEM/FEA)
      </p>

      {/* checkboxes */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
        {FIELD_META.map(m => (
          <label key={m.key} className="flex items-center gap-1 text-[10px] cursor-pointer">
            <input type="checkbox" checked={on[m.key]} onChange={e => setOn(p => ({ ...p, [m.key]: e.target.checked }))} />
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: m.color }} />
            {m.label}
          </label>
        ))}
        <label className="flex items-center gap-1 text-[10px]">
          <span className="text-gray-500">beban lateral w_lat:</span>
          <input type="number" value={wLatLocal} step={1} onChange={e => setWLatLocal(parseFloat(e.target.value) || 0)}
            className="w-16 rounded border border-gray-300 px-1 py-0.5 font-mono text-[10px]" /> kN/m
        </label>
      </div>

      <div className="flex gap-4 flex-wrap">
        {/* ELEVATION */}
        <div className="flex-1 min-w-[480px]">
          <svg ref={elevRef} viewBox={`0 0 ${W} ${H}`} className="w-full border border-gray-200 rounded bg-slate-50 cursor-crosshair" onClick={onElevClick}>
            <defs>
              {activeFields.map(m => (
                <linearGradient key={m.key} id={`g-${m.key}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={jetColor(-1)} /><stop offset="25%" stopColor={jetColor(-0.5)} />
                  <stop offset="50%" stopColor={jetColor(0)} /><stop offset="75%" stopColor={jetColor(0.5)} />
                  <stop offset="100%" stopColor={jetColor(1)} />
                </linearGradient>
              ))}
            </defs>
            {/* beam axis + supports */}
            <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="#94a3b8" strokeWidth="1.5" />
            <polygon points={`${padL - 5},${baseY + 9} ${padL + 5},${baseY + 9} ${padL},${baseY}`} fill="#475569" />
            <polygon points={`${W - padR - 5},${baseY + 9} ${W - padR + 5},${baseY + 9} ${W - padR},${baseY}`} fill="#475569" />
            <text x={padL} y={H - 6} fontSize="8" fill="#64748b">0</text>
            <text x={W - padR - 18} y={H - 6} fontSize="8" fill="#64748b">L={f(fin.L / 1000, 1)}m</text>

            {/* filled colored field curves */}
            {activeFields.map(m => {
              const s = scaleOf(m.key);
              const path = res.pts.map((p, idx) => {
                const px = x2px(p.x); const py = baseY - p[m.key] * s;
                return `${idx === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`;
              }).join(" ");
              const fillPath = `${path} L${x2px(fin.L).toFixed(1)},${baseY} L${padL},${baseY} Z`;
              return (
                <g key={m.key}>
                  <path d={fillPath} fill={`url(#g-${m.key})`} fillOpacity="0.22" />
                  <path d={path} fill="none" stroke={m.color} strokeWidth="1.6" />
                </g>
              );
            })}

            {/* click marker */}
            {clickX !== null && (
              <>
                <line x1={x2px(qX)} y1={padT} x2={x2px(qX)} y2={H - padB} stroke="#dc2626" strokeWidth="0.8" strokeDasharray="3 2" />
                <circle cx={x2px(qX)} cy={baseY} r="2.5" fill="#dc2626" />
                <text x={Math.min(x2px(qX) + 3, W - 70)} y={padT + 8} fontSize="8" fill="#dc2626">x={f(qX / 1000, 2)}m</text>
              </>
            )}
          </svg>
          <p className="text-[9px] text-gray-400 mt-0.5">Klik di sepanjang bentang (0–L) → gaya dalam pada titik itu. Kurva terisi gradien warna jet (OriginPro-style), skala per-komponen.</p>

          {/* query results at x */}
          <div className="mt-2 grid grid-cols-4 gap-2">
            {FIELD_META.map(m => {
              const t = m.key;
              const val = t === "dz" ? q.dz : t === "Mz" ? q.Mz : t === "Vy" ? q.Vy : t === "N" ? q.N : t === "T" ? q.T
                : res.pts[Math.round((qX / fin.L) * (res.pts.length - 1))][t];
              return (
                <div key={t} className="rounded border border-gray-200 px-1.5 py-1">
                  <div className="text-[8px] text-gray-500 truncate">{t}</div>
                  <div className="font-mono text-[10px] font-semibold" style={{ color: m.color }}>{f(val * DISP[t], 2)} <span className="text-gray-400">{m.unit}</span></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION + STRESS */}
        <div className="w-60 flex-none">
          <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">Penampang @ x={f(qX / 1000, 2)}m — tegangan σ(z)</p>
          <svg ref={secRef} viewBox={`0 0 ${SW} ${SH}`} className="w-full border border-gray-200 rounded bg-white cursor-crosshair" onClick={onSecClick}>
            {/* stress colormap bands across height */}
            {Array.from({ length: bands }).map((_, b) => {
              const yTop = fin.yt - (b / bands) * secH;
              const yBot = fin.yt - ((b + 1) / bands) * secH;
              const ymid = (yTop + yBot) / 2;
              const sig = queryAt(fin, res, qX, ymid).sigma.navier;
              return <rect key={b} x={sCx - 40} y={y2px(yTop)} width="80" height={Math.abs(y2px(yBot) - y2px(yTop)) + 0.6}
                fill={jetColor(sig / sigAbs)} />;
            })}
            {/* outline + NA */}
            <rect x={sCx - 40} y={sPadT} width="80" height={secH * sScale} fill="none" stroke="#334155" strokeWidth="1" />
            <line x1={sCx - 48} y1={yNApx} x2={sCx + 48} y2={yNApx} stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3 2" />
            <text x={sCx + 50} y={yNApx + 3} fontSize="7" fill="#1e293b">NA</text>
            <text x={sCx - 40} y={sPadT - 3} fontSize="7" fill="#64748b">+yt={f(fin.yt, 0)}</text>
            <text x={sCx - 40} y={SH - 8} fontSize="7" fill="#64748b">−yb={f(fin.yb, 0)}</text>
            {/* clicked height marker */}
            {clickY !== null && (
              <>
                <line x1={sCx - 44} y1={y2px(clickY)} x2={sCx + 44} y2={y2px(clickY)} stroke="#000" strokeWidth="0.8" />
                <circle cx={sCx} cy={y2px(clickY)} r="2.5" fill="#000" />
              </>
            )}
          </svg>
          {/* colorbar */}
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[8px] text-gray-500">−{f(sigAbs, 1)}</span>
            <div className="flex-1 h-2 rounded" style={{ background: `linear-gradient(to right, ${jetColor(-1)}, ${jetColor(-0.5)}, ${jetColor(0)}, ${jetColor(0.5)}, ${jetColor(1)})` }} />
            <span className="text-[8px] text-gray-500">+{f(sigAbs, 1)} MPa</span>
          </div>
          <p className="text-[9px] text-gray-400 mt-0.5">Biru = tekan, merah = tarik. Klik ketinggian (−yb…+yt) → tegangan &amp; lendutan.</p>

          {/* stress at clicked height — two formula variants */}
          <div className="mt-2 rounded border border-gray-200 p-2 space-y-1">
            <p className="text-[9px] text-gray-500">Pada z = {f(clickY ?? 0, 0)} mm dari NA:</p>
            <table className="w-full"><tbody>
              <tr className="border-b border-gray-100"><td className="text-[9px] text-gray-500 py-0.5">σ Navier (N/A − M·y/I)</td><td className="font-mono text-right text-[10px] font-semibold text-blue-700">{f(q.sigma.navier, 3)}</td><td className="text-[8px] text-gray-400 pl-1">MPa</td></tr>
              <tr className="border-b border-gray-100"><td className="text-[9px] text-gray-500 py-0.5">σ Kernel (P/A(1∓ey/r²)∓My/I)</td><td className="font-mono text-right text-[10px] font-semibold text-indigo-700">{f(q.sigma.kernel, 3)}</td><td className="text-[8px] text-gray-400 pl-1">MPa</td></tr>
              <tr className="border-b border-gray-100"><td className="text-[9px] text-gray-500 py-0.5">Δz lendutan</td><td className="font-mono text-right text-[10px] font-semibold text-red-600">{f(q.dz, 2)}</td><td className="text-[8px] text-gray-400 pl-1">mm</td></tr>
              <tr><td className="text-[9px] text-gray-500 py-0.5">r² = I/A</td><td className="font-mono text-right text-[10px]">{f(q.r2, 0)}</td><td className="text-[8px] text-gray-400 pl-1">mm²</td></tr>
            </tbody></table>
            <p className="text-[8px] text-gray-400">Kedua rumus tegangan memberi nilai sama (ekuivalen).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
