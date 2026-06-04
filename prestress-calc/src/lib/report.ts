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
 *  16 Lebar Retak (ACI 224R) — hanya jika partial prestress
 */
import type { ProjectInputs, DesignResults, AppSettings } from "@/types";
import { girderHeight } from "@/engine/section";

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
    anchorageZone: az, crackWidth: cw,
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
    <span>L = ${n(loads.spanLength/1000,2)} m · H = ${hGirder} mm · Komposit = ${hComp} mm · ${beamClassLabel}</span>
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
    row("r² = I_g/A_g", `${n(g.r2,1)}`, "mm²")
  )),
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

${section("15. Zona Angkur — Bursting & Spalling (AASHTO LRFD §5.10.9.3)", twoCol(
  `<div class="sub-title">Gaya Bursting & Spalling</div>` +
  table(
    row("P_i (gaya transfer)", kN(p.Pi)) +
    row("H_girder (h)", mm(hGirder)) +
    row("e_end (eksentrisitas angkur)", mm(tendon.eccentricitySupport)) +
    row("a (tinggi pelat angkur ≈ 0.25H)", `${n(Math.min(hGirder*0.25,300),0)}`, "mm") +
    row("T_burst = 0.25·P_i·(1−a/h)", kN(az.T_burst)) +
    row("d_burst = 0.5·(h−2|e|)", mm(az.d_burst)) +
    row("A_st burst = T_burst/(φ·f_y)", mm2(az.Ast_burst)) +
    row("T_spall = 0.02·P_i (AASHTO)", kN(az.T_spall)) +
    row("A_st spalling", mm2(az.Ast_spall)) +
    (az.T_edge > 0 ? row("T_edge (eksentrisitas)", kN(az.T_edge)) + row("A_st edge", mm2(az.Ast_edge)) : "")
  ),
  `<div class="note-box">
    <strong>Zona angkur</strong> (daerah D/B): distribusi tegangan berubah drastis dalam jarak ≈ H dari muka tumpuan. Tulangan sengkang tertutup (closed stirrups/ties) harus dipasang dalam d_burst untuk menahan T_burst.<br><br>
    <strong>Desain:</strong><br>
    Pasang ${Math.ceil(az.Ast_burst / (2 * Math.PI * 100 / 4) * 10) / 10} Ø10 (2 kaki) dalam zona d_burst = ${n(az.d_burst,0)} mm dari muka angkur.
  </div>`
))}

${cw ? section("16. Lebar Retak — Prategang Sebagian (ACI 224R-01 Gergely-Lutz)", twoCol(
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
