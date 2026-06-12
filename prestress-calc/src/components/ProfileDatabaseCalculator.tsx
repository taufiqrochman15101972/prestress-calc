"use client";

import React, { useState, useMemo } from "react";
import { GIRDER_PRESETS, CATEGORY_LABEL } from "@/lib/presets";
import type { PresetCategory } from "@/lib/presets";
import { STRAND_DB, tendonUnitTable } from "@/lib/strands";
import { calculateGrossProperties, girderHeight } from "@/engine/section";
import type { IGirderGeometry } from "@/types";

type SortKey = "H" | "A" | "Ig" | "eff" | "name";
type DbView = "profiles" | "strands";

/** Symmetric section polygon (bottom→top) for a mini sketch. */
function sectionPoints(g: IGirderGeometry, scale: number, cx: number, oy: number): string {
  const h4 = g.h4 ?? 0, h5 = g.h5 ?? 0;
  const H = g.h3 + h4 + g.h2 + h5 + g.h1;
  const yTop = oy; // top y in svg (we draw with y increasing downward → invert)
  // level y from bottom (0) → svg y = oy + (H - yFromBottom)*scale
  const sy = (yFromBottom: number) => yTop + (H - yFromBottom) * scale;
  const half = (w: number) => (w / 2) * scale;
  let y = 0;
  const L: [number, number][] = [], R: [number, number][] = [];
  // bottom flange
  L.push([cx - half(g.b3), sy(y)]); R.push([cx + half(g.b3), sy(y)]);
  y += g.h3;
  L.push([cx - half(g.b3), sy(y)]); R.push([cx + half(g.b3), sy(y)]);
  if (h4 > 0) { y += h4; L.push([cx - half(g.b2), sy(y)]); R.push([cx + half(g.b2), sy(y)]); }
  else { L.push([cx - half(g.b2), sy(y)]); R.push([cx + half(g.b2), sy(y)]); }
  y += g.h2;
  L.push([cx - half(g.b2), sy(y)]); R.push([cx + half(g.b2), sy(y)]);
  if (h5 > 0) { y += h5; L.push([cx - half(g.b1), sy(y)]); R.push([cx + half(g.b1), sy(y)]); }
  else { L.push([cx - half(g.b1), sy(y)]); R.push([cx + half(g.b1), sy(y)]); }
  y += g.h1;
  L.push([cx - half(g.b1), sy(y)]); R.push([cx + half(g.b1), sy(y)]);
  const pts = [...L, ...R.reverse()];
  return pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
}

// ─── Strand & multi-strand PT tendon database view ──────────
function StrandDatabase() {
  const [strandId, setStrandId] = useState<string>("12.70-1860");
  const s = STRAND_DB.find(x => x.id === strandId) ?? STRAND_DB[2];
  const units = tendonUnitTable(s);
  return (
    <div className="space-y-3 text-[11px]">
      <div>
        <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">
          Strand 7-Kawat Low-Relaxation — ASTM A416/A416M (AASHTO M203)
        </p>
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr className="text-[9px] text-gray-600">
              <th className="text-left py-1 px-1">Strand</th>
              <th className="text-right px-1">Ø (mm)</th>
              <th className="text-right px-1">A_ps (mm²)</th>
              <th className="text-right px-1">f_pu (MPa)</th>
              <th className="text-right px-1">f_py (MPa)</th>
              <th className="text-right px-1">MBL (kN)</th>
              <th className="text-right px-1">massa (kg/m)</th>
            </tr>
          </thead>
          <tbody>
            {STRAND_DB.map(x => (
              <tr key={x.id} onClick={() => setStrandId(x.id)}
                className={`cursor-pointer border-b border-gray-100 ${strandId === x.id ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                <td className="py-0.5 px-1 text-[10px] font-semibold text-gray-800">{x.name}</td>
                <td className="text-right px-1 font-mono text-[10px]">{x.diameterMm.toFixed(2)}</td>
                <td className="text-right px-1 font-mono text-[10px]">{x.areaMm2.toFixed(1)}</td>
                <td className="text-right px-1 font-mono text-[10px]">{x.fpu}</td>
                <td className="text-right px-1 font-mono text-[10px]">{x.fpy}</td>
                <td className="text-right px-1 font-mono text-[10px] text-blue-700 font-semibold">{x.mblKn.toFixed(1)}</td>
                <td className="text-right px-1 font-mono text-[10px]">{x.massKgM.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[9px] text-gray-400 mt-0.5">
          MBL = f_pu·A_ps (gaya putus minimum) · f_py = 0.90·f_pu (low-relaxation) · E_ps ≈ 196 500 MPa.
          Klik baris untuk membangun tabel unit tendon.
        </p>
      </div>
      <div>
        <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">
          Unit Tendon Multi-Strand Pasca-Tarik — basis {s.name}
        </p>
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr className="text-[9px] text-gray-600">
              <th className="text-left py-1 px-1">Unit</th>
              <th className="text-right px-1">n strand</th>
              <th className="text-right px-1">ΣA_ps (mm²)</th>
              <th className="text-right px-1">MBL (kN)</th>
              <th className="text-right px-1">P_jack 0.75f_pu (kN)</th>
              <th className="text-right px-1">P_maks 0.80f_pu (kN)</th>
              <th className="text-right px-1">Duct Ø_dlm (mm)</th>
              <th className="text-right px-1">massa (kg/m)</th>
            </tr>
          </thead>
          <tbody>
            {units.map(u => (
              <tr key={u.nStrands} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-0.5 px-1 text-[10px] font-semibold text-gray-800">Tendon-{u.nStrands}</td>
                <td className="text-right px-1 font-mono text-[10px]">{u.nStrands}</td>
                <td className="text-right px-1 font-mono text-[10px]">{u.apsMm2.toFixed(0)}</td>
                <td className="text-right px-1 font-mono text-[10px] text-blue-700 font-semibold">{u.mblKn}</td>
                <td className="text-right px-1 font-mono text-[10px]">{u.pJack075}</td>
                <td className="text-right px-1 font-mono text-[10px]">{u.pMax080}</td>
                <td className="text-right px-1 font-mono text-[10px]">{u.ductIdMm}</td>
                <td className="text-right px-1 font-mono text-[10px]">{u.massKgM.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[9px] text-gray-400 mt-0.5">
          Ukuran unit komersial standar (4–37 strand). Duct dari A_duct ≥ 2.5·ΣA_ps
          (AASHTO LRFD §5.4.6.2, rasio isi ≤ 0.40), dibulatkan ke 5 mm.
          Batas jacking: 0.80·f_pu sesaat di ram, 0.75·f_pu umum (ACI 318 §20.3.2.5).
        </p>
      </div>
    </div>
  );
}

export function ProfileDatabaseCalculator() {
  const [view, setView] = useState<DbView>("profiles");
  const [sortKey, setSortKey] = useState<SortKey>("H");
  const [cat, setCat] = useState<PresetCategory | "ALL">("ALL");
  const [selId, setSelId] = useState<string>("wika_wf40");

  const rows = useMemo(() => {
    return GIRDER_PRESETS
      .filter(p => p.id !== "custom")
      .map(p => {
        const gp = calculateGrossProperties(p.girder);
        return { ...p, H: girderHeight(p.girder), props: gp };
      })
      .filter(r => cat === "ALL" || r.category === cat)
      .sort((a, b) => {
        switch (sortKey) {
          case "H": return a.H - b.H;
          case "A": return a.props.areaAg - b.props.areaAg;
          case "Ig": return a.props.momentOfInertiaIg - b.props.momentOfInertiaIg;
          case "eff": return b.props.efficiency - a.props.efficiency;
          case "name": return a.name.localeCompare(b.name);
        }
      });
  }, [sortKey, cat]);

  const sel = rows.find(r => r.id === selId) ?? rows[0];
  const f = (v: number, d = 1) => v.toFixed(d);
  const e = (v: number, d = 3) => v.toExponential(d);

  const viewToggle = (
    <div className="flex gap-1 mb-2">
      {([["profiles", "📐 Profil Girder"], ["strands", "🔗 Strand & Tendon PT"]] as [DbView, string][]).map(([k, label]) => (
        <button key={k} onClick={() => setView(k)}
          className={`px-2 py-1 rounded text-[10px] font-semibold border
            ${view === k ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
          {label}
        </button>
      ))}
    </div>
  );

  if (view === "strands") {
    return (
      <div>
        {viewToggle}
        <StrandDatabase />
      </div>
    );
  }

  return (
    <div>
    {viewToggle}
    <div className="flex gap-4 text-[11px]">
      {/* ── Selected profile preview ─────────────────────── */}
      <div className="w-56 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Tampilan & Urutan</p>
          <div className="grid grid-cols-1 gap-1.5">
            <select value={cat} onChange={e => setCat(e.target.value as PresetCategory | "ALL")}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="ALL">Semua kategori</option>
              {(Object.keys(CATEGORY_LABEL) as PresetCategory[]).filter(c => c !== "CUSTOM").map(c => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
            <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="H">Urut: tinggi H ↑</option>
              <option value="A">Urut: luas A ↑</option>
              <option value="Ig">Urut: inersia I_g ↑</option>
              <option value="eff">Urut: efisiensi ρ ↓</option>
              <option value="name">Urut: nama A–Z</option>
            </select>
          </div>
        </div>
        {sel && (
          <div className="border border-gray-200 rounded p-2 bg-gray-50">
            <p className="text-[10px] font-bold text-blue-700">{sel.name}</p>
            <p className="text-[9px] text-gray-500">{CATEGORY_LABEL[sel.category]} · {sel.spanRange}</p>
            <svg width="200" height="150" viewBox="0 0 200 150" className="mt-1 bg-white rounded border border-gray-100">
              <polygon points={sectionPoints(sel.girder, 130 / sel.H, 100, 8)}
                fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="1.2" />
              {/* centroid line */}
              {(() => { const sc = 130 / sel.H; const yc = 8 + (sel.H - sel.props.yb) * sc;
                return <><line x1="20" y1={yc} x2="180" y2={yc} stroke="#dc2626" strokeWidth="0.8" strokeDasharray="3 2" />
                  <text x="182" y={yc + 3} fontSize="7" fill="#dc2626">y_b</text></>; })()}
              <text x="6" y="146" fontSize="7" fill="#475569">H = {f(sel.H, 0)} mm</text>
            </svg>
            <table className="w-full mt-1"><tbody>
              <tr><td className="text-gray-500 text-[9px] pr-2">A</td><td className="font-mono text-right text-[9px]">{e(sel.props.areaAg)}</td><td className="text-gray-400 text-[8px] pl-1">mm²</td></tr>
              <tr><td className="text-gray-500 text-[9px] pr-2">y_b / y_t</td><td className="font-mono text-right text-[9px]">{f(sel.props.yb)} / {f(sel.props.yt)}</td><td className="text-gray-400 text-[8px] pl-1">mm</td></tr>
              <tr><td className="text-gray-500 text-[9px] pr-2">I_g</td><td className="font-mono text-right text-[9px]">{e(sel.props.momentOfInertiaIg)}</td><td className="text-gray-400 text-[8px] pl-1">mm⁴</td></tr>
              <tr><td className="text-gray-500 text-[9px] pr-2">Z_t / Z_b</td><td className="font-mono text-right text-[9px]">{e(sel.props.Ztg, 2)}/{e(sel.props.Zbg, 2)}</td><td className="text-gray-400 text-[8px] pl-1">mm³</td></tr>
              <tr><td className="text-gray-500 text-[9px] pr-2">ρ efisiensi</td><td className="font-mono text-right text-[9px] text-blue-700 font-bold">{f(sel.props.efficiency, 3)}</td><td className="text-gray-400 text-[8px] pl-1"></td></tr>
              <tr><td className="text-gray-500 text-[9px] pr-2">k_t / k_b kern</td><td className="font-mono text-right text-[9px]">{f(sel.props.kt)}/{f(sel.props.kb)}</td><td className="text-gray-400 text-[8px] pl-1">mm</td></tr>
            </tbody></table>
          </div>
        )}
      </div>

      {/* ── Database table ───────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Database Profil ({rows.length} penampang · diurutkan)</p>
        <div className="overflow-y-auto" style={{ maxHeight: "62vh" }}>
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-100">
              <tr className="text-[9px] text-gray-600">
                <th className="text-left py-1 px-1">Profil</th>
                <th className="text-right px-1">H</th>
                <th className="text-right px-1">A</th>
                <th className="text-right px-1">y_b</th>
                <th className="text-right px-1">I_g</th>
                <th className="text-right px-1">Z_b</th>
                <th className="text-right px-1">ρ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} onClick={() => setSelId(r.id)}
                  className={`cursor-pointer border-b border-gray-100 ${selId === r.id ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                  <td className="py-0.5 px-1 text-[10px]">
                    <span className="font-semibold text-gray-800">{r.name}</span>
                    <span className="text-gray-400 text-[8px] ml-1">{CATEGORY_LABEL[r.category].split(" ")[0]}</span>
                  </td>
                  <td className="text-right px-1 font-mono text-[10px]">{f(r.H, 0)}</td>
                  <td className="text-right px-1 font-mono text-[10px]">{e(r.props.areaAg, 2)}</td>
                  <td className="text-right px-1 font-mono text-[10px]">{f(r.props.yb, 0)}</td>
                  <td className="text-right px-1 font-mono text-[10px]">{e(r.props.momentOfInertiaIg, 2)}</td>
                  <td className="text-right px-1 font-mono text-[10px]">{e(r.props.Zbg, 2)}</td>
                  <td className="text-right px-1 font-mono text-[10px] text-blue-700 font-semibold">{f(r.props.efficiency, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] text-gray-400 mt-1">Klik baris untuk pratinjau penampang. ρ = r²/(y_t·y_b) — makin tinggi makin efisien (Nilson §4.3). Satuan SI: mm, mm², mm³, mm⁴.</p>
      </div>
    </div>
    </div>
  );
}
