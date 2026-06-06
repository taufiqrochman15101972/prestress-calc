/**
 * Generates a printable HTML engineering report and opens it in a new window.
 * Sections:
 *  1  Geometri I-Girder (incl. h4/h5 fillets)
 *  2  Material
 *  3  Penampang Non-Komposit
 *  4  Penampang Komposit
 *  5  Konfigurasi Tendon
 *  6  Kehilangan Prategang (6 komponen)
 *  7  Beban & Momen
 *  8  Kontrol SLS (formula Standard + Kernel breakdown)
 *  9  Kontrol ULS Lentur  + 1.2Mcr
 *  10 Kontrol ULS Geser   (Vci / Vcw)
 *  11 Geser Horizontal Antarmuka (ACI §17.5)
 *  12 Lendutan & Camber
 *  13 Keseimbangan Beban (Load Balancing – TY Lin)
 *  14 Panjang Transfer & Pengembangan (ACI §25.8.8)
 *  15 Zona Angkur – Bursting & Spalling (AASHTO §5.10.9.3)
 *  16 PPR (Partial Prestress Ratio)
 *  17 Torsi (kondisional)
 *  18 Balok Menerus (kondisional)
 *  19 Daktilitas — εt ACI §21.2
 *  20 Kelelahan (Fatigue) — Δfps ACI §26.12
 *  21 Tahapan Lentur & Perubahan Gaya Prategang (Nilson §1.7/§3.6)
 *  22 Geser Metode Umum / Compression Field Theory (Nilson §5.11)
 *  23 Redistribusi Momen (Nilson §8.10) — kondisional menerus
 *  24 Estimasi Kehilangan Lump-Sum (Nilson §6.2) — pembanding
 *  25 Metode BS 8110 (Kong & Evans Ch.9) — flexure fpb·Aps(d−0.45x), shear Vco/Vcr
 *     Lebar Retak (ACI 224R) — hanya jika partial prestress
 *
 * Calculation rows use calc3(): formula → numbers substituted → result+units.
 * Header tags the construction method (PRA-TARIK / PASCA-TARIK).
 */
import type { ProjectInputs, DesignResults, AppSettings } from "@/types";
import { girderHeight } from "@/engine/section";
import { checkDuctility, checkMinSteel, checkFatigue } from "@/engine/uls";

// ─── Formatting helpers ───────────────────────────────────────
function n(v: number, d = 2)  { return v.toFixed(d); }
function kN(v: number)        { return n(v, 2) + " kN"; }
function kNm(v: number)       { return n(v, 2) + " kN·m"; }
function MPa(v: number)       { return n(v, 2) + " MPa"; }
function mm(v: number)        { return n(v, 2) + " mm"; }
function mm2(v: number)       { return n(v, 1) + " mm²"; }
function pct(v: number, t: number) { return (v / t * 100).toFixed(2) + "%"; }
function sci(v: number, e: number) {
  return (v / Math.pow(10, e)).toFixed(4) + "×10" + String(e).split("").map(c => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+c] ?? c).join("");
}
function verdict(ok: boolean) {
  return ok ? `<span style="color:#16a34a;font-weight:700">✓ AMAN</span>`
            : `<span style="color:#dc2626;font-weight:700">✗ OVERSTRESS</span>`;
}
function check(ok: boolean) {
  return ok ? `<span style="color:#16a34a;font-weight:700">✓ OK</span>`
            : `<span style="color:#dc2626;font-weight:700">✗ NG</span>`;
}
function row(label: string, value: string, unit = "") {
  return `<tr><td class="lbl">${label}</td><td class="val">${value}</td><td class="unit">${unit}</td></tr>`;
}
function section(title: string, content: string) {
  return `<div class="section"><div class="section-title">${title}</div>${content}</div>`;
}
function table(rows: string) {
  return `<table class="data-table"><tbody>${rows}</tbody></table>`;
}
function twoCol(left: string, right: string) {
  return `<div class="two-col"><div>${left}</div><div>${right}</div></div>`;
}
function checkRow(label: string, value: string, limit: string, ok: boolean) {
  return `<div class="check-row ${ok ? "" : "fail"}">
    <span class="check-label">${label}</span>
    <span class="check-value">${value} ≤ ${limit}</span>
    <span>${check(ok)}</span>
  </div>`;
}

/**
 * Three-line calculation block (per project requirement):
 *   line 1 — symbolic formula
 *   line 2 — formula with numbers substituted
 *   line 3 — final result with units
 * Short calcs may pass "" for `subst` to collapse to two lines.
 */
function calc3(label: string, formula: string, subst: string, result: string) {
  const mid = subst ? `<div class="calc-ln">= ${subst}</div>` : "";
  return `<div class="calc">
    <div class="calc-lbl">${label} =</div>
    <div class="calc-ln">${formula}</div>
    ${mid}
    <div class="calc-ln calc-res">= ${result}</div>
  </div>`;
}

// ─── CSS ────────────────────────────────────────────────────
const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #111; background: #fff; padding-bottom: 28mm; }
  @page { size: A4 portrait; margin: 14mm 14mm 18mm 14mm; }
  @media print { body { font-size: 8.5pt; } .no-print { display:none!important; } }

  .report-header { border-bottom: 2.5px solid #1d4ed8; padding-bottom: 6px; margin-bottom: 8px; }
  .report-header h1 { font-size: 13pt; font-weight: 800; color: #1d4ed8; letter-spacing: 0.4px; }
  .report-header .sub { font-size: 7.5pt; color: #6b7280; margin-top: 2px; }
  .proj-info { display:grid; grid-template-columns:1fr 1fr; gap:2px 16px; margin-top:4px; font-size:8pt; }
  .proj-info .pk { color:#6b7280; }
  .proj-info .pv { font-weight:700; color:#111; }
  .meta { display:flex; justify-content:space-between; margin-top:3px; font-size:7pt; color:#6b7280; }

  .section { margin-bottom: 8px; break-inside: avoid; }
  .section-title { background:#1d4ed8; color:#fff; font-size:8pt; font-weight:700;
    padding:3px 7px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
  .sub-title { font-size:7.5pt; font-weight:700; text-transform:uppercase; color:#374151;
    border-bottom:1px solid #e5e7eb; padding-bottom:2px; margin:5px 0 3px; }

  .data-table { width:100%; border-collapse:collapse; }
  .data-table td { padding:1.5px 4px; }
  .data-table tr:nth-child(even) { background:#f9fafb; }
  td.lbl { color:#374151; width:52%; }
  td.val { font-family:"Courier New",monospace; text-align:right; font-weight:600; width:32%; }
  td.unit { color:#9ca3af; padding-left:3px; white-space:nowrap; }
  td.formula { font-family:"Courier New",monospace; font-size:7.5pt; color:#4f46e5;
    padding:1px 4px; background:#f5f3ff; }

  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .three-col { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }

  /* 3-line calculation block: formula → substitution → result */
  .calc { margin:3px 0 5px; padding:3px 7px; background:#f8fafc; border-left:2.5px solid #6366f1;
    border-radius:0 3px 3px 0; break-inside:avoid; }
  .calc-lbl { font-size:8pt; font-weight:700; color:#374151; }
  .calc-ln { font-family:"Courier New",monospace; font-size:8pt; color:#1f2937;
    padding-left:10px; line-height:1.45; }
  .calc-res { color:#4338ca; font-weight:700; }

  .check-row { display:flex; justify-content:space-between; align-items:center;
    background:#f0fdf4; border:1px solid #bbf7d0; border-radius:3px;
    padding:2.5px 7px; margin:2px 0; font-size:8pt; }
  .check-row.fail { background:#fef2f2; border-color:#fecaca; }
  .check-label { color:#374151; }
  .check-value { font-family:"Courier New",monospace; font-size:8pt; }

  .loss-row { display:flex; align-items:center; gap:5px; margin:2px 0; }
  .loss-name { width:155px; font-size:8pt; color:#374151; flex-shrink:0; }
  .loss-bar-bg { flex:1; background:#f3f4f6; border-radius:2px; height:7px; overflow:hidden; }
  .loss-bar { height:100%; border-radius:2px; }
  .loss-val { font-family:"Courier New",monospace; font-size:8pt; width:70px; text-align:right; flex-shrink:0; }
  .loss-pct { font-size:7.5pt; color:#9ca3af; width:38px; text-align:right; flex-shrink:0; }

  .summary-box { background:#f0f9ff; border:1px solid #bae6fd; border-radius:4px; padding:4px 8px; }
  .summary-box .srow { display:flex; justify-content:space-between; padding:1.5px 0;
    border-bottom:1px dotted #e0f2fe; }
  .summary-box .srow:last-child { border:none; }
  .summary-box .lkey { color:#0369a1; font-size:8pt; }
  .summary-box .lval { font-family:"Courier New",monospace; font-size:8.5pt; font-weight:700; }

  .note-box { background:#fefce8; border:1px solid #fde68a; border-radius:3px;
    padding:3px 7px; font-size:7.5pt; color:#92400e; margin-top:3px; }
  .info-box  { background:#f0f9ff; border:1px solid #bae6fd; border-radius:3px;
    padding:3px 7px; font-size:7.5pt; color:#0369a1; margin-top:3px; }

  .all-ok  { background:#f0fdf4; border:2px solid #16a34a; border-radius:4px;
    padding:4px 10px; color:#15803d; font-weight:800; font-size:9.5pt;
    text-align:center; margin-bottom:6px; }
  .has-fail{ background:#fef2f2; border:2px solid #dc2626; border-radius:4px;
    padding:4px 10px; color:#dc2626; font-weight:800; font-size:9.5pt;
    text-align:center; margin-bottom:6px; }

  .footer { position:fixed; bottom:8mm; left:14mm; right:14mm;
    border-top:1px solid #e5e7eb; padding-top:2px;
    display:flex; justify-content:space-between; font-size:7pt; color:#9ca3af; }
  .no-print { position:fixed; top:12px; right:12px; z-index:9999; }
  .btn-print { background:#1d4ed8; color:#fff; border:none; border-radius:6px;
    padding:8px 18px; font-size:11pt; font-weight:700; cursor:pointer; }
  .btn-print:hover { background:#1e40af; }
`;

// ─── Main export ─────────────────────────────────────────────

export function openPrintReport(
  inputs: ProjectInputs,
  results: DesignResults,
  settings?: AppSettings
) {
  const { girder, deck, material, tendon, loads, immediateLoss, partialPrestress } = inputs;
  const {
    gross: g, composite: c, moments: m, prestress: p, tdLosses: td,
    sls, ulsFlexure: uf, ulsShear: us, deflection: defl,
    interfaceShear: ish, loadBalance: lb, transferLength: tl,
    anchorageZone: az, crackWidth: cw, torsion: tor,
    continuousBeam: cb, PPR,
    flexuralStages: fst, mcftShear: mcft,
    momentRedistribution: mrd, lumpSumLosses: lsl,
    thermal: thg, elongation: elo, preliminary: prl, pressureLine: pl,
    ec2,
  } = results;

  const h4 = girder.h4 ?? 0;
  const h5 = girder.h5 ?? 0;
  const hGirder  = girderHeight(girder);
  const hComp    = hGirder + deck.thicknessTd;
  const totalStrands = tendon.rows.reduce((s, r) => s + r.strandCount, 0);
  const Aps      = totalStrands * tendon.singleStrandArea;
  const yResultant = totalStrands > 0
    ? tendon.rows.reduce((s, r) => s + r.strandCount * r.yFromBottom, 0) / totalStrands
    : g.yb - 100;
  const e_mid    = g.yb - yResultant;

  const totalLossMpa = p.deltaFR + p.deltaAS + p.deltaES + td.deltaFpLT;
  const etaLoss      = (totalLossMpa / p.jackingStressMpa) * 100;
  const showKernel   = settings?.formulaVariant === "KERNEL";
  const beamClassLabels: Record<string, string> = {
    U: "Class U — Prategang Penuh (0.50√f'c)",
    T: "Class T — Prategang Sebagian Transisi (1.00√f'c)",
    C: "Class C — Penampang Retak (1.00√f'c)",
  };
  const beamClassLabel = beamClassLabels[sls.beamClass] ?? "";
  const systemLabel = settings?.prestressSystem === "PRETENSIONED"
    ? "PRA-TARIK (Pretensioned)"
    : "PASCA-TARIK (Post-tensioned)";

  const { projectInfo } = inputs;
  const now = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
  const allOk = sls.isOverallSafe && uf.isAdequate && us.isAdequate
    && defl.liveOk && defl.totalOk && ish.isAdequate;

  // ─── SLS fiber rows with optional kernel breakdown ──────────
  function fiberRow(f: import("@/types").FiberStressResult, showFormula: boolean) {
    const main = `<tr style="${f.isSafe ? "" : "background:#fef2f2"}">
      <td class="lbl">${f.fiber}</td>
      <td class="val" style="${f.isSafe ? "" : "color:#dc2626"}">${MPa(f.stressMpa)}</td>
      <td class="unit">−${n(f.limitCompMpa,1)}</td>
      <td class="unit">+${n(f.limitTensMpa,2)}</td>
      <td class="unit">${verdict(f.isSafe)}</td>
    </tr>`;
    if (!showFormula) return main;
    const { axial, eccentricity, moment } = f.terms;
    const kernelForm = `f = −P/A·(1±ey/r²) ∓ M/Z = ${n(axial,2)} + ${n(eccentricity,2)} + ${n(moment,2)} = ${MPa(f.stressMpa)}`;
    const detail = `<tr><td colspan="5" class="formula">${kernelForm}</td></tr>`;
    return main + detail;
  }

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<title>Laporan Desain Prategang — PRESTRESS-CALC</title>
<style>${CSS}</style>
</head>
<body>
<button class="no-print btn-print" onclick="window.print()">🖨 Cetak / Simpan PDF</button>

<div class="report-header">
  <h1>PRESTRESS-CALC — Laporan Desain Prategang Pasca-Tarik</h1>
  <p class="sub">Gelagar I Beton Prategang Pasca-Tarik (Post-tensioned) · ACI 318-19 / SNI 2847:2019 / AASHTO LRFD</p>
  <div class="proj-info">
    <div><span class="pk">Nama Proyek:</span></div><div><span class="pv">${projectInfo.namaProyek || "—"}</span></div>
    <div><span class="pk">No. Pekerjaan:</span></div><div><span class="pv">${projectInfo.noPekerjaan || "—"}</span></div>
    <div><span class="pk">Perencana:</span></div><div><span class="pv">${projectInfo.perencana || "—"}</span></div>
    <div><span class="pk">Lokasi:</span></div><div><span class="pv">${projectInfo.lokasi || "—"}</span></div>
  </div>
  <div class="meta">
    <span>Cetak: ${now}</span>
    <span>L = ${n(loads.spanLength/1000,2)} m · H = ${hGirder} mm · Komposit = ${hComp} mm · ${beamClassLabel} · ${systemLabel}</span>
  </div>
</div>

<div class="${allOk ? "all-ok" : "has-fail"}">
  ${allOk ? "✓ SEMUA KONTROL AMAN" : "✗ ADA KONTROL YANG TIDAK TERPENUHI"} &nbsp;|&nbsp;
  SLS: ${sls.isOverallSafe ? "✓" : "✗"} &nbsp;
  Lentur φMn=${n(uf.phiMn,0)} kN·m: ${uf.isAdequate ? "✓" : "✗"} &nbsp;
  Geser: ${us.isAdequate ? "✓" : "✗"} &nbsp;
  Antarmuka: ${ish.isAdequate ? "✓" : "✗"} &nbsp;
  Lendutan: ${defl.liveOk && defl.totalOk ? "✓" : "✗"}
</div>

${twoCol(
  section("1. Geometri I-Girder", table(
    row("Sayap atas b₁ × h₁", `${girder.b1} × ${girder.h1}`, "mm") +
    (h5 > 0 ? row("Chamfer atas h₅ (b₁→b₂)", `${h5}`, "mm") : "") +
    row("Web b₂ × h₂", `${girder.b2} × ${girder.h2}`, "mm") +
    (h4 > 0 ? row("Chamfer bawah h₄ (b₂→b₃)", `${h4}`, "mm") : "") +
    row("Sayap bawah b₃ × h₃", `${girder.b3} × ${girder.h3}`, "mm") +
    row("H_girder total", `${hGirder}`, "mm") +
    row("Pelat t_d × b_eff", `${deck.thicknessTd} × ${deck.widthBeff}`, "mm") +
    row("Panjang bentang L", `${n(loads.spanLength/1000,2)}`, "m")
  )),
  section("2. Material Beton & Baja", table(
    row("f'ci transfer", MPa(material.fci)) +
    row("f'c girder servis", MPa(material.fc)) +
    row("f'c pelat lantai", MPa(material.fcDeck)) +
    row("E_c girder", `${n(material.Ec,0)}`, "MPa") +
    row("f_pu strand", MPa(material.fpu)) +
    row("f_py strand", MPa(material.fpy)) +
    row("E_ps strand", `${n(material.Eps,0)}`, "MPa") +
    row("f_y baja mild", MPa(material.fy)) +
    row("A_s tulangan tarik", mm2(material.As)) +
    row("f_ys sengkang", MPa(material.fys))
  ))
)}

${twoCol(
  section("3. Penampang Non-Komposit", table(
    row("A_g", `${n(g.areaAg,0)}`, "mm²") +
    row("y_b (dari bawah)", mm(g.yb)) +
    row("y_t (dari atas girder)", mm(g.yt)) +
    row("I_g", sci(g.momentOfInertiaIg, 11), "mm⁴") +
    row("Z_tg = I_g/y_t", sci(g.Ztg, 6), "mm³") +
    row("Z_bg = I_g/y_b", sci(g.Zbg, 6), "mm³") +
    row("r² = I_g/A_g", `${n(g.r2,1)}`, "mm²") +
    row("k_t (kern atas = r²/y_b)", mm(g.kt)) +
    row("k_b (kern bawah = r²/y_t)", mm(g.kb)) +
    row("ρ efisiensi = r²/(y_t·y_b)", n(g.efficiency, 3))
  ) +
    calc3("y_b", "Σ(Aᵢ·ȳᵢ) / A_g",
      `${sci(g.yb * g.areaAg, 9)} / ${n(g.areaAg,0)}`, `${mm(g.yb)}`) +
    calc3("Z_bg", "I_g / y_b",
      `${sci(g.momentOfInertiaIg,11)} / ${n(g.yb,1)}`, `${sci(g.Zbg,6)} mm³`) +
    calc3("ρ", "r² / (y_t · y_b)",
      `${n(g.r2,0)} / (${n(g.yt,1)} · ${n(g.yb,1)})`, `${n(g.efficiency,3)}`)
  ),
  section("4. Penampang Komposit (Transformasi)", table(
    row("n_c = E_deck/E_girder", n(c.modularRatioNc, 4)) +
    row("A_deck,tr = n_c·b_eff·t_d", `${n(c.deckTransformedArea,0)}`, "mm²") +
    row("A_c komposit total", `${n(c.compositeAreaAc,0)}`, "mm²") +
    row("y_bc (dari bawah)", mm(c.ybc)) +
    row("y_tgc (dari top girder)", mm(c.ytgc)) +
    row("I_c", sci(c.momentOfInertiaIc, 11), "mm⁴") +
    row("Z_bc = I_c/y_bc", sci(c.Zbc, 6), "mm³") +
    row("Z_tgc = I_c/y_tgc", sci(c.Ztgc, 6), "mm³") +
    row("Z_ttc = I_c/(n_c·y_ttc)", sci(c.Zttc, 6), "mm³")
  ))
)}

${section("5. Konfigurasi & Gaya Prategang", twoCol(
  table(
    row("Profil lintasan", tendon.profileType) +
    row("Jumlah strand total", `${totalStrands}`) +
    row("Luas 1 strand (A₁)", mm2(tendon.singleStrandArea)) +
    row("A_ps = n × A₁", mm2(Aps)) +
    row("Ø strand nominal", `${tendon.strandDiameter}`, "mm") +
    row("Rasio jacking ρ = f_jack/f_pu", n(tendon.jackingRatio, 3)) +
    row("e_midspan (terhitung)", mm(e_mid)) +
    row("e_tumpuan", mm(tendon.eccentricitySupport)) +
    row("μ gesek curvature", n(immediateLoss.mu, 3)) +
    row("K wobble", `${immediateLoss.K.toFixed(7)}`, "/mm") +
    row("Δset slip angkur", `${immediateLoss.deltaSet}`, "mm") +
    row("N kelompok jacking", `${immediateLoss.numJackingGroups}`)
  ),
  table(
    row("f_jack = ρ·f_pu", MPa(p.jackingStressMpa)) +
    row("P_j gaya dongkrak", kN(p.Pj)) +
    row("ΔfFR gesek midspan", MPa(p.deltaFR)) +
    row("ΔfAS slip angkur", MPa(p.deltaAS)) +
    row("ΔfES perpendekan elastis", MPa(p.deltaES)) +
    row("P_i = P_j − ES−FR−AS", kN(p.Pi)) +
    row("ΔfCR rangkak (AASHTO)", MPa(td.deltaFpCR)) +
    row("ΔfSR susut (AASHTO)", MPa(td.deltaFpSR)) +
    row("ΔfR2 relaksasi (low-relax)", MPa(td.deltaFpR2)) +
    row("Δf_LT total jangka panjang", MPa(td.deltaFpLT)) +
    row("P_e efektif akhir", kN(p.Pe)) +
    row("f_se = P_e/A_ps", MPa(p.fse))
  )
))}

${section("6. Kehilangan Prategang — 6 Komponen", `
  <div class="summary-box" style="margin-bottom:5px;">
    <div class="srow"><span class="lkey">f_jack (awal)</span><span class="lval">${MPa(p.jackingStressMpa)}</span></div>
    <div class="srow"><span class="lkey">Total kehilangan Σ</span><span class="lval" style="color:#dc2626">−${n(totalLossMpa,2)} MPa &nbsp;(η = ${n(etaLoss,1)}%)</span></div>
    <div class="srow"><span class="lkey">f_pe efektif</span><span class="lval" style="color:#15803d">${MPa(p.jackingStressMpa - totalLossMpa)}</span></div>
    <div class="srow"><span class="lkey">P_j → P_i → P_e</span><span class="lval">${kN(p.Pj)} → ${kN(p.Pi)} → ${kN(p.Pe)}</span></div>
  </div>
  <div class="sub-title">Kehilangan Seketika</div>
  ${[
    { label: "FR  Gesek curvature (midspan)",   val: p.deltaFR,    color: "#EF4444" },
    { label: "AS  Slip angkur (anchorage set)",  val: p.deltaAS,    color: "#F97316" },
    { label: "ES  Perpendekan elastis",          val: p.deltaES,    color: "#F59E0B" },
  ].map(l => `<div class="loss-row">
    <span class="loss-name">${l.label}</span>
    <div class="loss-bar-bg"><div class="loss-bar" style="width:${Math.min(l.val/p.jackingStressMpa*100*5,100)}%;background:${l.color}"></div></div>
    <span class="loss-val">${MPa(l.val)}</span>
    <span class="loss-pct">${pct(l.val, p.jackingStressMpa)}</span>
  </div>`).join("")}
  <div class="sub-title" style="margin-top:5px">Kehilangan Jangka Panjang (AASHTO LRFD Refined)</div>
  ${[
    { label: "CR  Rangkak (Creep)",     val: td.deltaFpCR, color: "#8B5CF6" },
    { label: "SH  Susut (Shrinkage)",   val: td.deltaFpSR, color: "#3B82F6" },
    { label: "RE  Relaksasi baja",      val: td.deltaFpR2, color: "#10B981" },
  ].map(l => `<div class="loss-row">
    <span class="loss-name">${l.label}</span>
    <div class="loss-bar-bg"><div class="loss-bar" style="width:${Math.min(l.val/p.jackingStressMpa*100*5,100)}%;background:${l.color}"></div></div>
    <span class="loss-val">${MPa(l.val)}</span>
    <span class="loss-pct">${pct(l.val, p.jackingStressMpa)}</span>
  </div>`).join("")}
`)}

${section("7. Beban & Momen Rencana", twoCol(
  table(
    row("w_self (berat sendiri gelagar)", `${n(m.wSelf,3)}`, "kN/m") +
    row("w_SDL (beban mati tambahan)", `${loads.wSDL}`, "kN/m") +
    row("w_live (beban hidup)", `${loads.wLive}`, "kN/m") +
    row("M_g = w·L²/8", kNm(m.Mg)) +
    row("M_sdl", kNm(m.Msdl)) +
    row("M_live", kNm(m.Mlive)) +
    row("M_service = M_g+M_sdl+M_live", kNm(m.Mservice)) +
    row("M_u = 1.25·(M_g+M_sdl) + 1.75·M_live", kNm(m.Mu))
  ),
  table(
    row("Kelembapan relatif RH", `${loads.relativeHumidity}`, "%") +
    row("Berat jenis beton γ", `${loads.gammaConc}`, "kN/m³") +
    row("Beban imbang w_bal", `${n(lb.w_bal,2)}`, "kN/m") +
    row("M_bal = P_e·e", kNm(lb.M_bal)) +
    row("% keseimbangan beban", `${n(lb.percentBalance,1)}`, "%")
  )
))}

${section("8. Kontrol SLS — Tegangan Serat", `
  <div style="color:${sls.isOverallSafe ? "#15803d" : "#dc2626"};font-weight:700;margin-bottom:4px;font-size:9pt">
    ${sls.isOverallSafe ? "✓ SEMUA SERAT AMAN" : "✗ ADA SERAT OVERSTRESS"} — ${beamClassLabel}
  </div>
  ${showKernel ? `<div class="info-box">Rumus ditampilkan dalam bentuk Kernel (TY Lin): f = −P/A·(1 ± e·y/r²) ∓ M/Z &nbsp; [r² = I_g/A_g = ${n(g.r2,0)} mm²]</div>` : `<div class="info-box">Rumus Standard: f_top = −P/A + Pe/Z_tg − M/Z_tg &nbsp;&nbsp; f_bot = −P/A − Pe/Z_bg + M/Z_bg</div>`}
  <div class="sub-title">Tahap Transfer (P_i + M_g) — Batas: −${n(0.60*material.fci,1)} MPa / +${n(0.50*Math.sqrt(material.fci),2)} MPa</div>
  <table class="data-table">
    <thead><tr style="background:#e0f2fe;font-size:7.5pt">
      <td class="lbl">Serat</td><td class="val">σ (MPa)</td>
      <td class="unit">Batas−</td><td class="unit">Batas+</td><td class="unit">Status</td>
    </tr></thead>
    <tbody>
      ${[sls.transfer.topFiber, sls.transfer.botFiber].map(f => fiberRow(f, showKernel)).join("")}
    </tbody>
  </table>
  ${calc3("σ_bot (transfer)", "−P_i/A_g − P_i·e/Z_bg + M_g/Z_bg",
    `${n(sls.transfer.botFiber.terms.axial,2)} ${sls.transfer.botFiber.terms.eccentricity>=0?"+":"−"} ${n(Math.abs(sls.transfer.botFiber.terms.eccentricity),2)} ${sls.transfer.botFiber.terms.moment>=0?"+":"−"} ${n(Math.abs(sls.transfer.botFiber.terms.moment),2)}`,
    `${MPa(sls.transfer.sigmaBot)}`)}
  <div class="calc" style="border-left-color:#10b981">
    <div class="calc-lbl">σ_bot bentuk Kernel (ekuivalen) =</div>
    <div class="calc-ln">−P_i/A_g·(1 + e·y_b/r²) + M_g/Z_bg</div>
    <div class="calc-ln calc-res">= ${MPa(sls.transfer.sigmaBot)} &nbsp;(identik — dua rumus = hasil sama)</div>
  </div>
  <div class="sub-title" style="margin-top:5px">Tahap Servis (P_e + M_total, komposit) — Batas: −${n(0.45*material.fc,1)} MPa / +${n(0.50*Math.sqrt(material.fc),2)} MPa</div>
  <table class="data-table">
    <thead><tr style="background:#e0f2fe;font-size:7.5pt">
      <td class="lbl">Serat</td><td class="val">σ (MPa)</td>
      <td class="unit">Batas−</td><td class="unit">Batas+</td><td class="unit">Status</td>
    </tr></thead>
    <tbody>
      ${[sls.service.topFiber, sls.service.botFiber, sls.service.deckFiber].map(f => fiberRow(f, showKernel)).join("")}
    </tbody>
  </table>
`)}

${twoCol(
  section("9. Kontrol ULS Lentur (φ = 0.90)", `
    <div class="sub-title">Kapasitas Lentur — ACI §20.3.2.4</div>
    ${table(
      row("d_p (dari top komposit)", mm(hComp - (g.yb - e_mid))) +
      row("f_ps = f_pu[1−(γ_p/β₁)(ρ_p·f_pu/f'c+…)]", MPa(uf.fps)) +
      row("a (blok tekan Whitney)", mm(uf.a)) +
      row("c = a/β₁", mm(uf.c)) +
      row("β₁ (f'c deck)", n(uf.a > 0 ? uf.a/uf.c : 0.85, 3)) +
      row("c/d_p", n(uf.c / Math.max(hComp - (g.yb - e_mid), 1), 3)) +
      row("M_n nominal", kNm(uf.Mn)) +
      row("φM_n = 0.90·M_n", kNm(uf.phiMn)) +
      row("M_u = 1.25DL + 1.75LL", kNm(uf.Mu))
    )}
    ${calc3("M_n", "A_ps·f_ps·(d_p − a/2)",
      `${n(Aps,1)} · ${n(uf.fps,1)} · (${n(hComp-(g.yb-e_mid),1)} − ${n(uf.a/2,1)})`,
      `${kNm(uf.Mn)}`)}
    ${calc3("φM_n", "0.90 · M_n",
      `0.90 · ${n(uf.Mn,1)}`, `${kNm(uf.phiMn)}`)}
    <div class="check-row ${uf.isAdequate ? "" : "fail"}">
      <span class="check-label">φM_n ≥ M_u</span>
      <span class="check-value">${kNm(uf.phiMn)} ≥ ${kNm(uf.Mu)}</span>
      <span>${check(uf.isAdequate)}</span>
    </div>
    <div class="sub-title" style="margin-top:4px">Kontrol 1.2M_cr (ACI 318-19 §9.6.2.1)</div>
    ${table(
      row("M_cr (momen retak)", kNm(uf.Mcr_12 / 1.2)) +
      row("1.2·M_cr (minimum φM_n)", kNm(uf.Mcr_12))
    )}
    <div class="check-row ${uf.is12McrOk ? "" : "fail"}">
      <span class="check-label">φM_n ≥ 1.2·M_cr</span>
      <span class="check-value">${kNm(uf.phiMn)} ≥ ${kNm(uf.Mcr_12)}</span>
      <span>${check(uf.is12McrOk)}</span>
    </div>
  `),
  section("10. Kontrol ULS Geser (φ = 0.75)", `
    <div class="sub-title">Geser Beton — ACI §22.5.8</div>
    ${table(
      row("d_v = max(0.9dp, 0.72h)", mm(us.dv)) +
      row("b_w (web)", mm(us.bw)) +
      row("V_p (komponen vertikal)", kN(us.Vp)) +
      row("M_cr (untuk V_ci)", kNm(us.Mcr)) +
      row("V_ci (geser-lentur)", kN(us.Vci)) +
      row("V_cw (geser-web)", kN(us.Vcw)) +
      row("V_c = min(V_ci, V_cw)", kN(us.Vc)) +
      row("A_v/s diperlukan", us.AvPerS > 0 ? n(us.AvPerS,4) + " mm²/mm" : "— (minimum)")  +
      row("V_u terfaktor", kN(us.Vu))
    )}
    <div class="check-row ${us.isAdequate ? "" : "fail"}">
      <span class="check-label">φ(V_c+V_p) ≥ V_u</span>
      <span class="check-value">${kN(0.75*(us.Vc+us.Vp))} ≥ ${kN(us.Vu)}</span>
      <span>${check(us.isAdequate)}</span>
    </div>
  `)
)}

${section("11. Geser Horizontal Antarmuka — ACI 318-19 §17.5 (Shear Friction)", twoCol(
  `<div class="sub-title">Parameter & Permintaan</div>` +
  table(
    row("Permukaan", ish.cFactor > 0.3 ? "Dikasarkan ≥ 6mm" : "Halus") +
    row("c (kohesi)", MPa(ish.cFactor)) +
    row("μ (gesek)", n(ish.muFactor, 1)) +
    row("b_vi (lebar kontak)", mm(ish.bvi)) +
    row("Q_deck / I_c (aliran)", "→ V_hu") +
    row("V_hu = V_u·Q/I_c", `${n(ish.Vhu,3)}`, "N/mm") +
    row("φ·c·b_vi (beton saja)", `${n(ish.phiVni_conc,3)}`, "N/mm") +
    row("A_vf/s diperlukan", ish.AvfPerS_req > 0 ? `${n(ish.AvfPerS_req,4)} mm²/mm` : "— (beton cukup)") +
    row("s_max pengikatan", mm(ish.sMax))
  ),
  `<div class="check-row ${ish.isAdequate ? "" : "fail"}">
    <span class="check-label">φV_ni ≥ V_hu</span>
    <span class="check-value">${n(ish.phiVni_conc + 0.75*ish.muFactor*ish.AvfPerS_req*material.fy,3)} ≥ ${n(ish.Vhu,3)} N/mm</span>
    <span>${check(ish.isAdequate)}</span>
  </div>
  ${ish.AvfPerS_req <= 0 ? `<div class="note-box" style="margin-top:4px">✓ Kapasitas beton saja (φ·c·b_vi) sudah mencukupi aliran geser — tulangan pengikatan tidak diperlukan secara kalkulasi, namun tetap dipasang minimum (ACI 26.5.6.4).</div>` : ""}`
))}

${section("12. Lendutan & Camber (Elastis + Efek Jangka Panjang)", twoCol(
  table(
    row("δ Camber prategang P_e", `+${mm(defl.deltaCamber)}`, "↑ (ke atas)") +
    row("δ Berat sendiri gelagar", `−${mm(defl.deltaSW)}`, "↓") +
    row("δ Pelat lantai (beban mati tambahan)", `−${mm(defl.deltaDeck)}`, "↓") +
    row("δ Beban hidup (live load)", `−${mm(defl.deltaLive)}`, "↓") +
    row("δ Total (+ = ke atas)", `${defl.deltaTotal >= 0 ? "+" : ""}${mm(defl.deltaTotal)}`)
  ),
  `<div style="font-size:8pt;color:#374151;margin-bottom:4px">
    Batas lendutan per ACI 318-19 §24.2:<br>
    · Live: L/360 = ${mm(defl.limitLive)}<br>
    · Total: L/300 = ${mm(defl.limitTotal)}<br>
    Multiplier rangkak jangka panjang: 2.0
  </div>
  ${checkRow("δ_live ≤ L/360", mm(defl.deltaLive), mm(defl.limitLive), defl.liveOk)}
  ${checkRow("|δ_total| ≤ L/300", mm(Math.abs(defl.deltaTotal)), mm(defl.limitTotal), defl.totalOk)}`
))}

${section("13. Keseimbangan Beban — Load Balancing (Konsep TY Lin)", `
  <div class="info-box">
    Konsep TY Lin: prategang digantikan oleh beban imbang w_bal = 8·P_e·Δe/L² (parabola) sehingga balok bertindak seolah tidak ada beban. Sisa tegangan dihitung pada beban yang tidak seimbang.
  </div>
  <br/>
  ${twoCol(
    table(
      row("P_e efektif", kN(p.Pe)) +
      row("Δe = e_midspan − e_tumpuan", `${n(e_mid - tendon.eccentricitySupport, 1)}`, "mm") +
      row("w_bal = 8·P_e·Δe/L²", `${n(lb.w_bal,3)}`, "kN/m") +
      row("M_bal = P_e·e_midspan", kNm(lb.M_bal)) +
      row("M_service total", kNm(m.Mservice)) +
      row("% beban terkompensasi", `${n(lb.percentBalance,1)}`, "%")
    ),
    `<div class="note-box">
      <strong>Interpretasi:</strong><br>
      w_bal = ${n(lb.w_bal,2)} kN/m mengimbangi ${n(lb.percentBalance,1)}% dari beban servis total (${n(m.wSelf + loads.wSDL + loads.wLive,2)} kN/m).<br><br>
      Sisa beban tidak seimbang = ${n((m.wSelf + loads.wSDL + loads.wLive) - lb.w_bal, 2)} kN/m.
    </div>`
  )}
`)}

${section("14. Panjang Transfer & Pengembangan — ACI 318-19 §25.8.8", twoCol(
  `<div class="sub-title">Input & Hasil</div>` +
  table(
    row("f_se efektif (P_e/A_ps)", MPa(tl.fse)) +
    row("f_ps pada ULS", MPa(tl.fps)) +
    row("d_b strand (diameter)", mm(tl.db)) +
    row("l_t (ACI) = f_se·d_b/3 [psi/in]", `${n(tl.lt_ACI,0)}`, "mm") +
    row("l_t (konservatif) = 50·d_b", `${n(tl.lt_50db,0)}`, "mm") +
    row("l_t GOVERNING", `${n(tl.lt_mm,0)}`, "mm") +
    row("l_t / d_b", n(tl.lt_db, 1)) +
    row("l_d = l_t + (f_ps−f_se)·d_b/3", `${n(tl.ld_mm,0)}`, "mm") +
    row("l_d / d_b", n(tl.ld_db, 1))
  ),
  `<div class="note-box">
    <strong>Referensi ACI 318-19 §25.8.8.1:</strong><br>
    Transfer length l_t: panjang yang dibutuhkan untuk mentransfer prategang dari strand ke beton secara penuh (setelah pelepasan — untuk pretensioned).<br><br>
    Development length l_d: panjang tambahan yang diperlukan agar strand mencapai tegangan f_ps pada kapasitas lentur nominal.<br><br>
    Untuk post-tensioned: zona transfer ditentukan oleh panjang angkur dan distribusi tekanan pelat angkur.
  </div>`
))}

${section("15. Zona Angkur Pasca-Tarik — Local & General Zone (NCHRP 356 / AASHTO §5.8.4)", `
  <div class="info-box" style="margin-bottom:5px">
    Metode strut-and-tie NCHRP 356 (Breen dkk.). <strong>Local zone</strong> = beton di sekitar
    angkur (tumpu + kekangan); <strong>General zone</strong> = penyebaran gaya tendon (tie bursting).
    Metode pendekatan ${az.approxMethodApplicable ? "BERLAKU" : "TIDAK berlaku — perlu STM/FEM eksplisit"} (a/h≤0.5, |e|≤h/2).
  </div>
  ${twoCol(
    `<div class="sub-title">General Zone — Tie Bursting & Spalling</div>` +
    calc3("T_burst", "0.25·ΣP·(1 − a/h) + 0.5·|ΣP·sinα|",
      `0.25·${n(p.Pi,0)}·(1 − ${n(Math.min(hGirder*0.25,300),0)}/${n(hGirder,0)}) + 0.5·|${n(p.Pi,0)}·sin${n(az.alphaDeg,1)}°|`,
      kN(az.T_burst)) +
    calc3("d_burst", "0.5·(h − 2|e|) + 5·e·sinα", "", mm(az.d_burst)) +
    table(
      row("A_st burst = T_burst/(φ·f_y)", mm2(az.Ast_burst)) +
      row("T_spall = 0.02·ΣP", kN(az.T_spall)) +
      row("A_st spalling", mm2(az.Ast_spall)) +
      (az.T_edge > 0 ? row("T_edge longitudinal = P·e/(2h)", kN(az.T_edge)) + row("A_st edge", mm2(az.Ast_edge)) : "")
    ) +
    `<div class="note-box">Pasang ≈${Math.ceil(az.Ast_burst / (2 * Math.PI * 100 / 4) * 10) / 10} Ø10 (2 kaki) tertutup dalam d_burst = ${n(az.d_burst,0)} mm dari muka angkur.</div>`,

    `<div class="sub-title">Local Zone — Tumpu & Kekangan</div>` +
    calc3("f_b (tegangan tumpu)", "P_dev / A_plate", "", MPa(az.bearingStress)) +
    calc3("f_b,izin", "0.7·f'ci·√(A/A_g) ≤ 2.25·f'ci",
      `0.7·${n(material.fci,0)}·${n(az.confinementRatio,2)}`, MPa(az.bearingAllow)) +
    calc3("P_r = φ·f_b,izin·A_plate", "φ=0.65", "", kN(az.bearingResistance)) +
    `<div class="check-row ${az.bearingOk ? "" : "fail"}">
      <span class="check-label">Tumpu local zone: P_dev ≤ P_r</span>
      <span class="check-value">${kN(az.Pdev)} ≤ ${kN(az.bearingResistance)}</span>
      <span>${check(az.bearingOk)}</span>
    </div>` +
    `<div class="sub-title" style="margin-top:6px">Tegangan Tekan di Depan Angkur</div>` +
    calc3("σ_c", "ΣP/(b·h)", "", MPa(az.compStressAhead)) +
    `<div class="check-row ${az.compOk ? "" : "fail"}">
      <span class="check-label">σ_c ≤ 0.6·f'ci</span>
      <span class="check-value">${MPa(az.compStressAhead)} ≤ ${MPa(az.compLimit)}</span>
      <span>${check(az.compOk)}</span>
    </div>`
  )}
`)}

${PPR !== undefined ? section("16. Partial Prestress Ratio (PPR)", `
  ${twoCol(
    table(
      row("PPR = A_ps·f_ps / (A_ps·f_ps + A_s·f_y)", `${n(PPR * 100, 1)}`, "%") +
      row("A_ps", mm2(tendon.rows.reduce((s,r)=>s+r.strandCount,0)*tendon.singleStrandArea)) +
      row("f_ps (ULS)", MPa(uf.fps)) +
      row("A_s tulangan mild", mm2(material.As)) +
      row("f_y tulangan mild", MPa(material.fy))
    ),
    `<div class="info-box">
      <strong>Interpretasi PPR:</strong><br>
      PPR = 1.0 → prategang penuh (pure prestressed)<br>
      PPR = 0.0 → beton bertulang biasa (no prestress)<br>
      0 &lt; PPR &lt; 1 → prategang sebagian (partially prestressed)<br><br>
      <strong>Nilai PPR = ${n(PPR*100,1)}%</strong><br>
      ${PPR >= 0.99 ? "Prategang penuh — semua tarik ditumpu oleh strand." : `Prategang sebagian — ${n((1-PPR)*100,1)}% kapasitas lentur dari tulangan mild A_s.`}
    </div>`
  )}
`) : ""}

${tor ? section("17. Kontrol Torsi (ACI 318-19 §22.7)", `
  <div style="color:${tor.isAdequate||tor.isNegligible?"#15803d":"#dc2626"};font-weight:700;margin-bottom:4px">
    ${tor.isNegligible ? "✓ TORSI DIABAIKAN (T_u < φ·T_th)" : tor.isAdequate ? "✓ PENAMPANG AMAN TERHADAP TORSI+GESER" : "✗ PENAMPANG TIDAK CUKUP"}
  </div>
  ${twoCol(
    table(
      row("T_u terfaktor", kNm(loads.tuTorsion)) +
      row("T_th (ambang = φ·T_th)", kNm(tor.T_th)) +
      row("T_cr (momen retak)", kNm(tor.T_cr)) +
      row("θ strut angle", `${n(tor.theta_deg,1)}`, "°") +
      row("Ao ≈ 0.85·Aoh", `${n(tor.Ao,0)}`, "mm²")
    ),
    table(
      row("At/s (transversal per kaki)", tor.isNegligible ? "—" : `${n(tor.At_per_s,4)}`, "mm²/mm") +
      row("Al (longitudinal torsion)", tor.isNegligible ? "—" : mm2(tor.Al_req)) +
      row("Rasio V+T gabungan", n(tor.combinedRatio, 3))
    )
  )}
  ${!tor.isNegligible ? `<div class="check-row ${tor.isAdequate?"":"fail"}">
    <span class="check-label">Rasio gabungan (V+T)² ≤ (Vc/bw·dv + 0.66√f'c)²</span>
    <span class="check-value">${n(tor.combinedRatio,3)} ≤ 1.000</span>
    <span>${check(tor.isAdequate)}</span>
  </div>` : `<div class="note-box">T_u = ${kNm(loads.tuTorsion)} &lt; φ·T_th = ${kNm(0.75*tor.T_th)} — torsi diabaikan per ACI §22.7.4.1.</div>`}
`) : ""}

${cb && cb.nSpans > 1 ? section(`18. Balok Menerus ${cb.nSpans} Bentang — Momen Sekunder (TY Lin Ch. 8)`, `
  <div class="info-box" style="margin-bottom:5px">
    Metode beban setara (equivalent load method): tendon menimbulkan reaksi di tumpuan interior.
    Reaksi redundan ini menghasilkan momen sekunder M₂ yang harus dijumlahkan dengan momen primer M₁ = Pe·e.
  </div>
  ${twoCol(
    table(
      row("Jumlah bentang", `${cb.nSpans}`) +
      row("M₁ primer midspan = Pe·e", kNm(cb.M1_midspan)) +
      row("M₂ sekunder tumpuan interior", kNm(cb.M2_support)) +
      row("M_total = M₁ + M₂ (tumpuan)", kNm(cb.M_total_support)) +
      row("e_concordant di tumpuan", mm(cb.e_concordant)) +
      row("C-line shift = M₂/Pe", mm(cb.cLineShift))
    ),
    `<div class="note-box">
      <strong>Tendon Konkordant</strong> (tidak ada momen sekunder):<br>
      e di tumpuan interior = M_total/Pe = <strong>${n(cb.e_concordant,1)} mm</strong><br><br>
      <strong>C-line (Pressure Line)</strong>:<br>
      Bergeser ${n(Math.abs(cb.cLineShift),1)} mm ke ${cb.cLineShift>=0?"bawah":"atas"} dari c.g. tendon di tumpuan.<br><br>
      Untuk desain ULS: gunakan M_total pada kombinasi momen = M₁ + M₂.
    </div>`
  )}
`) : ""}

${(() => {
  // §19 Daktilitas & §20 Fatigue — computed inline
  const dp = hComp - (g.yb - e_mid);
  const duct = checkDuctility(uf.c, dp);
  const minSt = checkMinSteel(
    (c.Zbc * (0.62 * Math.sqrt(material.fc) + (p.Pe * 1000) / g.areaAg + (p.Pe * 1000 * e_mid) / g.Zbg - ((m.Mg + m.Msdl) * 1e6) / g.Zbg)) / 1e6,
    uf.Mu, uf.phiMn
  );
  const fat = checkFatigue(m.Mlive, Aps, dp);
  return section("19. Daktilitas Penampang — εt ACI §21.2 / TY Lin Ch.13", `
  <div class="info-box" style="margin-bottom:5px">
    Klasifikasi penampang berdasarkan regangan tarik bersih εt di serat tarik terluar saat Mn tercapai.
    ACI §21.2: εt ≥ 0.004 → tension-controlled (daktail).
  </div>
  ${twoCol(
    table(
      row("c (garis netral)", mm(uf.c)) +
      row("d_p (jarak tendon dari atas komposit)", mm(dp)) +
      row("c/d_p", n(uf.c / dp, 4)) +
      row("εt = (0.003/c)·(dp−c)", n(duct.epsilon_t, 5)) +
      row("Klasifikasi", duct.strainClass) +
      row("φ faktor kapasitas", n(duct.phi, 2))
    ),
    table(
      row("φMn kapasitas", kNm(uf.phiMn)) +
      row("1.2·Mcr (min)", kNm(minSt.Mn_12Mcr_req)) +
      row("1.33·Mu (min)", kNm(minSt.Mn_133Mu_req))
    ) +
    `<div class="check-row ${duct.isDuctile ? "" : "fail"}">
      <span class="check-label">εt ≥ 0.004 (daktail)</span>
      <span class="check-value">εt = ${n(duct.epsilon_t,5)}</span>
      <span>${check(duct.isDuctile)}</span>
    </div>
    <div class="check-row ${minSt.is_12Mcr_Ok ? "" : "fail"}">
      <span class="check-label">φMn ≥ 1.2Mcr (ACI §9.6.2a)</span>
      <span class="check-value">${kNm(uf.phiMn)} ≥ ${kNm(minSt.Mn_12Mcr_req)}</span>
      <span>${check(minSt.is_12Mcr_Ok)}</span>
    </div>
    <div class="check-row ${minSt.is_133Mu_Ok ? "" : "fail"}">
      <span class="check-label">φMn ≥ 1.33Mu (ACI §9.6.2b)</span>
      <span class="check-value">${kNm(uf.phiMn)} ≥ ${kNm(minSt.Mn_133Mu_req)}</span>
      <span>${check(minSt.is_133Mu_Ok)}</span>
    </div>`
  )}
`) + section("20. Kelelahan Strand — Fatigue (ACI §26.12, TY Lin Ch.13)", `
  <div class="info-box" style="margin-bottom:5px">
    Kontrol kelelahan low-relaxation strand: rentang tegangan akibat beban hidup Δfps ≤ 125 MPa (ACI §26.12.5.2).
    Menggunakan metode transformasi penampang retak (cracked section) jd = 0.9·dp.
  </div>
  ${twoCol(
    table(
      row("M_live (momen hidup)", kNm(m.Mlive)) +
      row("A_ps strand aktif", mm2(Aps)) +
      row("d_p efektif", mm(dp)) +
      row("j·d ≈ 0.9·dp", mm(0.9 * dp)) +
      row("Δfps = M_live / (Aps·jd)", MPa(fat.delta_fps))
    ),
    table(
      row("Batas kelelahan low-relax", `${fat.limit} MPa`)
    ) +
    `<div class="check-row ${fat.isOk ? "" : "fail"}">
      <span class="check-label">Δfps ≤ ${fat.limit} MPa (ACI §26.12)</span>
      <span class="check-value">Δfps = ${MPa(fat.delta_fps)}</span>
      <span>${check(fat.isOk)}</span>
    </div>`
  )}
`);
})()}

${fst ? section("21. Tahapan Lentur & Perubahan Gaya Prategang (Nilson §1.7 / §3.6)", `
  <div class="info-box" style="margin-bottom:5px">
    Seiring momen luar bertambah, balok melewati tahap: dekompresi (serat bawah → 0),
    retak (serat bawah → +f_r), lalu ultimit. Tegangan strand naik perlahan hingga retak
    kemudian cepat — kenaikan total Δf_p yang kecil menandakan penampang efisien.
  </div>
  ${twoCol(
    table(
      row("M_dekompresi (tambahan di atas beban mati)", kNm(fst.M_dec)) +
      row("M_dekompresi total (dari nol)", kNm(fst.M_dec_total)) +
      row("M_cr retak", kNm(fst.M_cr)) +
      row("σ beton di level strand (f_ce)", MPa(fst.f_ce))
    ),
    table(
      row("f_se efektif", MPa(fst.fse)) +
      row("f_p saat dekompresi beton", MPa(fst.fp_dec)) +
      row("f_ps ultimit", MPa(fst.fps)) +
      row("Δf_p total = f_ps − f_se", MPa(fst.delta_fp_total)) +
      row("Rasio kenaikan Δf_p/f_ps", `${n(fst.stress_rise_ratio*100,1)}`, "%")
    )
  )}
`) : ""}

${mcft ? section("22. Geser — Metode Umum / Compression Field Theory (Nilson §5.11, AASHTO §5.7.3)", `
  <div class="info-box" style="margin-bottom:5px">
    Alternatif sectional dari Vci/Vcw: web retak diperlakukan sebagai truss sudut-variabel.
    β dan θ diturunkan dari regangan longitudinal ε_x di tengah tinggi (f_po = 0.70·f_pu).
  </div>
  ${twoCol(
    table(
      row("ε_x regangan longitudinal", `${n(mcft.epsilon_x*1000,3)}`, "×10⁻³") +
      row("β faktor tarik beton", n(mcft.beta,2)) +
      row("θ sudut retak diagonal", `${n(mcft.theta_deg,1)}`, "°") +
      row("f_po = 0.70·f_pu", MPa(mcft.fpo))
    ),
    table(
      row("V_c = 0.083·β·√f'c·bv·dv", kN(mcft.Vc)) +
      row("V_s (cot θ)", kN(mcft.Vs)) +
      row("V_n = Vc+Vs+Vp", kN(mcft.Vn)) +
      row("A_v/s diperlukan (MCFT)", `${n(mcft.AvPerS_req,4)}`, "mm²/mm")
    )
  )}
  <div class="check-row ${mcft.isAdequate?"":"fail"}">
    <span class="check-label">φV_n ≥ V_u (φ=0.75)</span>
    <span class="check-value">${kN(mcft.phiVn)} ≥ ${kN(us.Vu)}</span>
    <span>${check(mcft.isAdequate)}</span>
  </div>
  <div class="check-row ${mcft.Vn <= mcft.Vn_max?"":"fail"}">
    <span class="check-label">V_n ≤ V_n,max = 0.25f'c·bv·dv + Vp</span>
    <span class="check-value">${kN(mcft.Vn)} ≤ ${kN(mcft.Vn_max)}</span>
    <span>${check(mcft.Vn <= mcft.Vn_max)}</span>
  </div>
`) : ""}

${mrd ? section("23. Redistribusi Momen — Analisis Batas (Nilson §8.10, ACI §6.6.5)", `
  <div class="info-box" style="margin-bottom:5px">
    Momen tumpuan (negatif) elastis boleh diredistribusi sebesar 1000·ε_t (maks 20%),
    hanya jika ε_t ≥ 0.0075. Momen bentang bertambah untuk menjaga keseimbangan statika.
  </div>
  ${twoCol(
    table(
      row("Redistribusi diizinkan (ε_t ≥ 0.0075)", mrd.isPermitted ? "Ya" : "Tidak") +
      row("Persentase redistribusi", `${n(mrd.redistribPct,1)}`, "%") +
      row("ΔM yang digeser", kNm(mrd.deltaM))
    ),
    table(
      row("M tumpuan elastis → terdistribusi", kNm(mrd.M_support_adj)) +
      row("M bentang elastis → terdistribusi", kNm(mrd.M_midspan_adj))
    )
  )}
`) : ""}

${lsl ? section("24. Estimasi Kehilangan Lump-Sum (Nilson §6.2, AASHTO §5.9.3.3) — Pembanding", `
  <div class="info-box" style="margin-bottom:5px">
    Metode pendekatan cepat sebagai pembanding terhadap metode refined (Bagian 6).
    Δf_pLT = 10·(f_pi·A_ps/A_g)·γ_h·γ_st + 12·γ_h·γ_st + Δf_pR.
  </div>
  ${twoCol(
    table(
      row("γ_h = 1.7 − 0.01·H", n(lsl.gamma_h,3)) +
      row("γ_st = 35/(7+f'ci)", n(lsl.gamma_st,3))
    ),
    table(
      row("Δf_p creep+shrink", MPa(lsl.deltaFp_creepShrink)) +
      row("Δf_pR relaksasi", MPa(lsl.deltaFp_relax)) +
      row("Δf_pLT lump-sum total", MPa(lsl.deltaFpLT)) +
      row("Δf_pLT refined (Bagian 6)", MPa(td.deltaFpLT))
    )
  )}
  <div class="note-box" style="margin-top:4px">
    Selisih lump-sum vs refined: ${n(Math.abs(lsl.deltaFpLT - td.deltaFpLT),1)} MPa
    (${n(Math.abs(lsl.deltaFpLT - td.deltaFpLT)/Math.max(td.deltaFpLT,1)*100,1)}%).
    Refined dianjurkan untuk desain akhir.
  </div>
`) : ""}

${results.bsFlexure && results.bsShear && results.bsClass ? section("25. Metode BS 8110 — Kong & Evans Ch.9 (Pembanding Inggris)", `
  <div class="info-box" style="margin-bottom:5px">
    Pendekatan British Standard sebagai pembanding ACI. Klasifikasi anggota Class 1/2/3,
    blok tegangan persegi BS 8110, dan geser dua kasus Vco/Vcr. fcu (kubus) ≈ f'c/0.8.
  </div>
  ${twoCol(
    `<div class="sub-title">§9.5 ULS Lentur</div>` +
    table(
      row("Kelas anggota BS", results.bsClass.description) +
      row("σ tarik izin (layan)", MPa(results.bsClass.permTension)) +
      row("fpuAps/(fcu·b·d)", n(results.bsFlexure.ratio,3)) +
      row("fpe/fpu", n(results.bsFlexure.fpeRatio,3)) +
      row("f_pb (tegangan tendon runtuh)", MPa(results.bsFlexure.fpb)) +
      row("x (garis netral)", mm(results.bsFlexure.x)) +
      row("Tendon", results.bsFlexure.bonded ? "bonded (Tabel 9.5-1)" : "unbonded (rumus)")
    ) +
    calc3("M_u (BS 8110)", "f_pb·A_ps·(d − 0.45x)",
      `${n(results.bsFlexure.fpb,1)} · ${n(Aps,1)} · (${n(hComp-(g.yb-e_mid),1)} − 0.45·${n(results.bsFlexure.x,1)})`,
      `${kNm(results.bsFlexure.Mu)}`),
    `<div class="sub-title">§9.6 ULS Geser</div>` +
    table(
      row("f_t = 0.24√fcu", MPa(results.bsShear.ft)) +
      row("M_0 = 0.8·f_pt·I/y", kNm(results.bsShear.M0)) +
      row("Penampang", results.bsShear.isUncracked ? "TAK-RETAK (M<M₀)" : "RETAK (M≥M₀)")
    ) +
    calc3("V_co (tak-retak)", "0.67·b_v·h·√(f_t² + 0.8·f_cp·f_t)",
      "", `${kN(results.bsShear.Vco)}`) +
    calc3("V_cr (retak)", "(1−0.55·f_pe/f_pu)·v_c·b_v·d + M_0·V/M",
      "", `${kN(results.bsShear.Vcr)}`) +
    `<div class="check-row"><span class="check-label">V_c governing = ${results.bsShear.isUncracked ? "V_co" : "min(Vco,Vcr)"}</span><span class="check-value">${kN(results.bsShear.Vc)}</span><span>✓</span></div>`
  )}
`) : ""}

${prl ? section("26. Desain Pendahuluan — Gaya Prategang Minimum & Modulus Penampang (Libby Ch.9)", `
  <div class="info-box" style="margin-bottom:5px">
    Pemilihan awal penampang & gaya prategang dari amplop tegangan izin (Libby §9-6..§9-8).
    Membandingkan modulus penampang aktual terhadap modulus minimum yang disyaratkan.
  </div>
  ${twoCol(
    `<div class="sub-title">Tegangan Izin</div>` +
    table(
      row("f_ci,c = 0.60 f'ci (tekan transfer)", MPa(prl.f_ci_c)) +
      row("f_ti = 0.50√f'ci (tarik transfer)", MPa(prl.f_ti)) +
      row("f_cs = 0.45 f'c (tekan layan)", MPa(prl.f_cs)) +
      row("f_ts = 0.50√f'c (tarik layan)", MPa(prl.f_ts)) +
      row("η = Pe/Pi (efektivitas)", n(p.Pe / Math.max(p.Pi, 1e-6), 3))
    ),
    `<div class="sub-title">Gaya Prategang Minimum</div>` +
    calc3("P_min (layan, serat bawah)",
      "(M_max/Z_b − f_ts) / (1/A + e_max/Z_b) ÷ η",
      "", kN(prl.Pmin_service)) +
    table(
      row("P_min transfer (serat atas)", kN(prl.Pmin_transfer)) +
      row("P_i aktual terpasang", kN(p.Pi)) +
      row("Z_b minimum disyaratkan", `${sci(prl.Zb_req, 6)}`, "mm³") +
      row("Z_b aktual", `${sci(g.Zbg, 6)}`, "mm³") +
      row("Z_t minimum disyaratkan", `${sci(prl.Zt_req, 6)}`, "mm³") +
      row("Z_t aktual", `${sci(g.Ztg, 6)}`, "mm³")
    ) +
    `<div class="check-row ${p.Pi >= prl.Pmin_service && g.Zbg >= prl.Zb_req ? "" : "fail"}">
      <span class="check-label">P_i ≥ P_min  &  Z_b ≥ Z_b,req</span>
      <span class="check-value">${kN(p.Pi)} / ${sci(g.Zbg,6)}</span>
      <span>${check(p.Pi >= prl.Pmin_service && g.Zbg >= prl.Zb_req)}</span>
    </div>`
  )}
`) : ""}

${pl ? section("27. Garis Tekan (Pressure Line / C-line) — Libby §4-3..§4-5", `
  <div class="info-box" style="margin-bottom:5px">
    Resultan tekan internal C = P berpindah dari cgs sebesar M/P saat beban bekerja.
    Selama garis-C berada di dalam kern (−k_t … +k_b), penampang penuh tertekan (tanpa tarik).
  </div>
  ${twoCol(
    `<div class="sub-title">Lokasi Garis-C</div>` +
    calc3("e_C (transfer)", "e − M_g/P_i",
      `${n(e_mid,1)} − ${n(m.Mg,1)}·10³/${n(p.Pi,1)}`, mm(pl.eC_transfer)) +
    calc3("e_C (layan)", "e − M_layan/P_e",
      `${n(e_mid,1)} − ${n(m.Mservice,1)}·10³/${n(p.Pe,1)}`, mm(pl.eC_service)) +
    calc3("Pergeseran garis tekan", "M_layan/P_e", "", mm(pl.shift)),
    `<div class="sub-title">Batas Kern</div>` +
    table(
      row("Kern atas −k_t", mm(-g.kt)) +
      row("Kern bawah +k_b", mm(g.kb)) +
      row("e_C transfer dalam kern?", pl.withinKernTransfer ? "YA — tanpa tarik" : "TIDAK") +
      row("e_C layan dalam kern?", pl.withinKernService ? "YA — penuh tekan" : "TIDAK (ada tarik serat)")
    ) +
    `<div class="check-row ${pl.withinKernTransfer ? "" : "fail"}">
      <span class="check-label">Garis-C transfer ∈ kern</span>
      <span class="check-value">${mm(pl.eC_transfer)} ∈ [${n(-g.kt,0)}, ${n(g.kb,0)}]</span>
      <span>${check(pl.withinKernTransfer)}</span>
    </div>`
  )}
`) : ""}

${thg ? section("28. Tegangan Gradien Suhu — Self-Equilibrating (Libby §11-5 / AASHTO §3.12.3)", `
  <div class="info-box" style="margin-bottom:5px">
    Gradien suhu non-linier menimbulkan tegangan swa-imbang (eigenstress) meski pada balok
    sederhana, karena penampang harus tetap rata. T1=23 / T2=6 / T3=3 °C (Zona AASHTO, dapat diedit).
  </div>
  ${twoCol(
    `<div class="sub-title">Parameter Gradien</div>` +
    table(
      row("T_avg (rata berbobot luas)", `${n(thg.Tavg,2)}`, "°C") +
      row("ψ (kelengkungan termal)", `${n(thg.psi*1000,4)}`, "°C/m") +
      row("N restraint (ujung terjepit)", kN(thg.N_restrained)) +
      row("M restraint (ujung terjepit)", kNm(thg.M_restrained))
    ),
    `<div class="sub-title">Tegangan Serat Swa-imbang</div>` +
    calc3("σ(y)", "E·α·[ T_avg + ψ(y−y_b) − T(y) ]", "", "") +
    table(
      row("σ serat atas", MPa(thg.sigmaTop)) +
      row("σ centroid", MPa(thg.sigmaMid)) +
      row("σ serat bawah", MPa(thg.sigmaBot))
    ) +
    `<div class="note-box">Tegangan ini DITAMBAHKAN pada tegangan SLS (§8). Positif = tarik.</div>`
  )}
`) : ""}

${elo ? section("29. Elongasi Tendon & Gaya Dongkrak — Kendali Lapangan Pasca-Tarik (Libby §16-7)", `
  <div class="info-box" style="margin-bottom:5px">
    Elongasi terukur adalah kontrol lapangan atas gaya prategang: Δ = ∫P(x)/(A_ps·E_ps)dx.
    Hanya untuk metode PASCA-TARIK (post-tensioned).
  </div>
  ${twoCol(
    `<div class="sub-title">Perhitungan Elongasi</div>` +
    calc3("Δ_teoritis (tanpa friksi)", "P_j·L/(A_ps·E_ps)",
      `${n(p.Pj,1)}·10³·${n(loads.spanLength,0)}/(${n(Aps,1)}·${n(tendon.Eps,0)})`,
      mm(elo.deltaTheoretical)) +
    calc3("Δ_friksi (integral profil)", "∫P(x)dx/(A_ps·E_ps)", "", mm(elo.deltaFriction)) +
    calc3("Δ_neto (− set angkur)", "Δ_friksi − δ_set",
      `${n(elo.deltaFriction,1)} − ${n(immediateLoss.deltaSet,1)}`, mm(elo.deltaNet)),
    `<div class="sub-title">Gaya & Friksi</div>` +
    table(
      row("P_j (gaya dongkrak)", kN(p.Pj)) +
      row("P_ujung-mati (setelah friksi)", kN(elo.Pend)) +
      row("Kehilangan friksi", `${n(elo.frictionLossPct,2)}`, "%") +
      (elo.gagePressureMPa > 0 ? row("Tekanan gage", MPa(elo.gagePressureMPa)) : "")
    ) +
    `<div class="note-box">Inspektor membaca Δ_neto pada ram. Toleransi lapangan umumnya ±7%.</div>`
  )}
`) : ""}

${ec2 ? section("30. Metode Eurocode 2 (EN 1992-1-1) — M.K. Hurst (Pembanding Eropa)", `
  <div class="info-box" style="margin-bottom:5px">
    Jalur kode keempat (paralel dengan ACI/AASHTO &amp; BS 8110). Nilai desain bahan EC2,
    batas tegangan per kombinasi beban, kehilangan jangka-panjang gabungan satu-persamaan
    (§5.10.6), lentur blok persegi (λx, η·f_cd), dan geser dua-wilayah + rangka sudut-variabel.
    f_ck = kekuatan silinder = f'c.
  </div>
  ${twoCol(
    `<div class="sub-title">Nilai Desain Bahan (Tabel 3.1)</div>` +
    calc3("f_cd = α_cc·f_ck/γ_c", "0.85·f_ck/1.5",
      `0.85·${n(material.fc,0)}/1.5`, MPa(ec2.material.fcd)) +
    calc3("f_ctm", material.fc <= 50 ? "0.30·f_ck^(2/3)" : "2.12·ln(1+f_cm/10)",
      "", MPa(ec2.material.fctm)) +
    calc3("E_cm", "22·(f_cm/10)^0.3 [GPa]",
      `22·(${n(ec2.material.fcm,0)}/10)^0.3`, `${n(ec2.material.Ecm,0)} MPa`) +
    calc3("f_pd = 0.9·f_pk/γ_s", "0.9·f_pk/1.15",
      `0.9·${n(tendon.fpu,0)}/1.15`, MPa(ec2.material.fpd)) +
    table(
      row("η (faktor kekuatan efektif)", n(ec2.material.eta,3)) +
      row("λ (faktor tinggi blok)", n(ec2.material.lambda,3)) +
      row("ν₁ (reduksi geser retak)", n(ec2.material.nu1,3))
    ) +
    `<div class="sub-title" style="margin-top:6px">Batas Tegangan (§7.2)</div>` +
    table(
      row("σ_c transfer ≤ 0.6·f_ck(t)", MPa(ec2.stressLimits.compTransfer)) +
      row("σ_c layan ≤ 0.6·f_ck (rare)", MPa(ec2.stressLimits.compCharacteristic)) +
      row("σ_c ≤ 0.45·f_ck (quasi-permanen)", MPa(ec2.stressLimits.compQuasiPermanent)) +
      row("σ_t layan ≤ f_ctm", MPa(ec2.stressLimits.tensService))
    ),
    `<div class="sub-title">§5.10.6 Kehilangan Jangka-Panjang Gabungan</div>` +
    calc3("Δσ_p,c+s+r",
      "[ε_cs·E_p + 0.8·Δσ_pr + (E_p/E_cm)·φ·σ_c,QP] / [1 + (E_p/E_cm)(A_p/A_c)(1+A_c·z²/I_c)(1+0.8φ)]",
      "", MPa(ec2.loss.deltaSigma_csr)) +
    table(
      row("Suku susut ε_cs·E_p", MPa(ec2.loss.shrinkageTerm)) +
      row("Suku relaksasi 0.8·Δσ_pr", MPa(ec2.loss.relaxationTerm)) +
      row("Suku rangkak (E_p/E_cm)·φ·σ_c,QP", MPa(ec2.loss.creepTerm)) +
      row("Penyebut (ageing/restraint)", n(ec2.loss.denominator,4))
    ) +
    `<div class="sub-title" style="margin-top:6px">§6.1 ULS Lentur</div>` +
    calc3("x = A_p·f_pd/(η·f_cd·λ·b)", "",
      `${n(Aps,0)}·${n(ec2.flexure.fpd,0)}/(${n(ec2.flexure.eta,2)}·${n(ec2.flexure.fcd,1)}·${n(ec2.flexure.lambda,2)}·${n(deck.widthBeff,0)})`,
      mm(ec2.flexure.x)) +
    calc3("M_Rd = A_p·f_pd·(d − λx/2)", "",
      `${n(Aps,0)}·${n(ec2.flexure.fpd,0)}·(${n(hComp-(g.yb-e_mid),0)} − ${n(ec2.flexure.a/2,0)})`,
      kNm(ec2.flexure.MRd)) +
    `<div class="check-row ${ec2.flexure.isAdequate ? "" : "fail"}">
      <span class="check-label">M_Rd ≥ M_Ed &amp; x/d ≤ 0.45 (daktail)</span>
      <span class="check-value">${kNm(ec2.flexure.MRd)} · x/d=${n(ec2.flexure.x_d,3)}</span>
      <span>${check(ec2.flexure.isAdequate && ec2.flexure.ductile)}</span>
    </div>` +
    `<div class="sub-title" style="margin-top:6px">§6.2 Geser</div>` +
    table(
      row("Wilayah", ec2.shear.region === "uncracked" ? "TAK-RETAK lentur (eq 6.4)" : "RETAK lentur (eq 6.2a)") +
      row("V_Rd,c (tak-retak)", kN(ec2.shear.VRd_c_uncracked)) +
      row("V_Rd,c (retak)", kN(ec2.shear.VRd_c_cracked)) +
      row("V_Rd,c governing", kN(ec2.shear.VRd_c)) +
      row("V_Rd,max (rangka, θ=21.8°)", kN(ec2.shear.VRd_max)) +
      row("α_cw (peningkatan prategang)", n(ec2.shear.alpha_cw,3))
    ) +
    `<div class="check-row ${ec2.shear.isAdequate ? "" : "fail"}">
      <span class="check-label">${ec2.shear.needsLinks ? "Perlu sengkang (V_Ed > V_Rd,c)" : "Tanpa sengkang (V_Ed ≤ V_Rd,c)"} · badan tak hancur</span>
      <span class="check-value">V_Rd,max = ${kN(ec2.shear.VRd_max)}</span>
      <span>${check(ec2.shear.isAdequate)}</span>
    </div>`
  )}
`) : ""}

${cw ? section("Lebar Retak — Prategang Sebagian (ACI 224R-01 Gergely-Lutz)", twoCol(
  `<div class="sub-title">Hasil Perhitungan Lebar Retak</div>` +
  table(
    row("Kelas balok ACI", sls.beamClass === "T" ? "Class T (Transisi)" : "Class C (Retak)") +
    row("w_cr (lebar retak hitung)", `${n(cw.w_cr, 4)}`, "mm") +
    row("w_limit (batas eksposur)", `${n(cw.w_limit, 4)}`, "mm") +
    row("Eksposur", cw.exposure) +
    row("s_max spasi tulangan (ACI 318-19 §24.3)", `${n(cw.sMax_ACI318, 0)}`, "mm")
  ),
  `<div class="check-row ${cw.isOk ? "" : "fail"}">
    <span class="check-label">w_cr ≤ w_limit</span>
    <span class="check-value">${n(cw.w_cr,4)} mm ≤ ${n(cw.w_limit,4)} mm</span>
    <span>${check(cw.isOk)}</span>
  </div>
  <div class="note-box" style="margin-top:4px">
    PPR = A_ps·f_ps / (A_ps·f_ps + A_s·f_y)<br>
    Prategang sebagian memerlukan kontrol lebar retak (ACI 224R) dan kontrol spasi tulangan (ACI 318-19 §24.3.2).
  </div>`
)) : ""}

<div class="footer">
  <span>PRESTRESS-CALC — ACI 318-19 / SNI 2847:2019 / AASHTO LRFD Refined Method</span>
  <span>${now}</span>
  <span>L=${n(loads.spanLength/1000,2)}m · A_ps=${n(Aps,1)}mm² · e=${n(e_mid,0)}mm · η=${n(etaLoss,1)}%loss</span>
</div>

</body>
</html>`;

  const w = window.open("", "_blank", "width=920,height=780,scrollbars=yes");
  if (!w) { alert("Popup diblokir browser. Izinkan popup untuk mencetak laporan."); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
}
