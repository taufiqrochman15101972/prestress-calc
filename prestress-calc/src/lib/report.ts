/**
 * Generates a printable HTML engineering report and opens it in a new window.
 */
import type { ProjectInputs, DesignResults } from "@/types";

function n(v: number, d = 2) { return v.toFixed(d); }
function kN(v: number) { return n(v, 2) + " kN"; }
function kNm(v: number) { return n(v, 2) + " kN·m"; }
function MPa(v: number) { return n(v, 2) + " MPa"; }
function mm(v: number) { return n(v, 2) + " mm"; }
function mm2(v: number) { return n(v, 1) + " mm²"; }
function sci(v: number, e: number) { return (v / Math.pow(10, e)).toFixed(4) + "×10" + sup(e); }
function sup(n: number) { const s = String(n); return s.split("").map(c => "⁰¹²³⁴⁵⁶⁷⁸⁹"[parseInt(c)] ?? c).join(""); }
function pct(v: number, total: number) { return (v / total * 100).toFixed(2) + "%"; }
function verdict(ok: boolean) {
  return ok
    ? `<span style="color:#16a34a;font-weight:700">✓ AMAN</span>`
    : `<span style="color:#dc2626;font-weight:700">✗ OVERSTRESS</span>`;
}
function check(ok: boolean) {
  return ok
    ? `<span style="color:#16a34a;font-weight:700">✓ OK</span>`
    : `<span style="color:#dc2626;font-weight:700">✗ NG</span>`;
}

function row(label: string, value: string, unit = "") {
  return `<tr><td class="lbl">${label}</td><td class="val">${value}</td><td class="unit">${unit}</td></tr>`;
}

function section(title: string, content: string) {
  return `
    <div class="section">
      <div class="section-title">${title}</div>
      ${content}
    </div>`;
}

function table(rows: string) {
  return `<table class="data-table"><tbody>${rows}</tbody></table>`;
}

function twoCol(left: string, right: string) {
  return `<div class="two-col"><div>${left}</div><div>${right}</div></div>`;
}

export function openPrintReport(inputs: ProjectInputs, results: DesignResults) {
  const { girder, deck, material, tendon, loads, immediateLoss } = inputs;
  const { gross: g, composite: c, moments: m, prestress: p, tdLosses: td, sls, ulsFlexure: uf, ulsShear: us, deflection: d } = results;

  const hTotal = girder.h1 + girder.h2 + girder.h3;
  const hComp  = hTotal + deck.thicknessTd;
  const totalStrands = tendon.rows.reduce((s, r) => s + r.strandCount, 0);
  const Aps = totalStrands * tendon.singleStrandArea;
  const yResultant = tendon.rows.reduce((s, r) => s + r.strandCount * r.yFromBottom, 0) / totalStrands;
  const e_mid = g.yb - yResultant;

  const totalLossMpa = p.deltaFR + p.deltaAS + p.deltaES + td.deltaFpLT;
  const etaLoss = totalLossMpa / p.jackingStressMpa * 100;

  const { projectInfo } = inputs;
  const now = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<title>Laporan Desain Prategang — PRESTRESS-CALC</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #111; background: #fff; padding-bottom: 28mm; }
  @page { size: A4 portrait; margin: 15mm 15mm 18mm 15mm; }
  @media print { body { font-size: 8.5pt; } .no-print { display:none!important; } }

  /* ── Header ── */
  .report-header { border-bottom: 2.5px solid #1d4ed8; padding-bottom: 6px; margin-bottom: 10px; }
  .report-header h1 { font-size: 14pt; font-weight: 800; color: #1d4ed8; letter-spacing: 0.5px; }
  .report-header .sub { font-size: 8pt; color: #6b7280; margin-top: 2px; }
  .report-header .meta { display:flex; justify-content:space-between; margin-top:4px; font-size:7.5pt; color:#6b7280; }
  .proj-info { display:grid; grid-template-columns:1fr 1fr; gap:2px 16px; margin-top:5px; font-size:8pt; }
  .proj-info .pk { color:#6b7280; }
  .proj-info .pv { font-weight:700; color:#111; }

  /* ── Sections ── */
  .section { margin-bottom: 10px; break-inside: avoid; }
  .section-title {
    background: #1d4ed8; color: #fff;
    font-size: 8.5pt; font-weight: 700; padding: 3px 7px;
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-bottom: 5px;
  }
  .sub-title { font-size: 7.5pt; font-weight: 700; text-transform: uppercase;
    color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; margin: 6px 0 3px; }

  /* ── Table ── */
  .data-table { width: 100%; border-collapse: collapse; }
  .data-table td { padding: 1.5px 4px; }
  .data-table tr:nth-child(even) { background: #f9fafb; }
  .data-table tr:hover { background: #eff6ff; }
  td.lbl { color: #374151; width: 52%; }
  td.val { font-family: "Courier New", monospace; text-align: right; font-weight: 600; width: 32%; }
  td.unit { color: #9ca3af; padding-left: 3px; white-space: nowrap; }

  /* ── Two-column layout ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  /* ── Check row ── */
  .check-row { display:flex; justify-content:space-between; align-items:center;
    background:#f0fdf4; border:1px solid #bbf7d0; border-radius:3px;
    padding: 3px 7px; margin: 3px 0; font-size: 8pt; }
  .check-row.fail { background:#fef2f2; border-color:#fecaca; }
  .check-label { color:#374151; }
  .check-value { font-family: "Courier New", monospace; font-size:8pt; }

  /* ── Loss bar ── */
  .loss-row { display:flex; align-items:center; gap:6px; margin:2px 0; }
  .loss-name { width: 150px; font-size: 8pt; color: #374151; flex-shrink:0; }
  .loss-bar-bg { flex:1; background:#f3f4f6; border-radius:2px; height:8px; overflow:hidden; }
  .loss-bar { height:100%; border-radius:2px; }
  .loss-val { font-family:"Courier New",monospace; font-size:8pt; width:75px; text-align:right; flex-shrink:0; }
  .loss-pct { font-size: 7.5pt; color:#9ca3af; width:40px; text-align:right; flex-shrink:0; }

  /* ── Summary box ── */
  .summary-box { background:#f0f9ff; border:1px solid #bae6fd; border-radius:4px; padding:5px 8px; }
  .summary-box .row { display:flex; justify-content:space-between; padding:1.5px 0; border-bottom:1px dotted #e0f2fe; }
  .summary-box .row:last-child { border:none; }
  .summary-box .lkey { color:#0369a1; font-size:8pt; }
  .summary-box .lval { font-family:"Courier New",monospace; font-size:8.5pt; font-weight:700; }

  /* ── Footer ── */
  .footer { position:fixed; bottom:10mm; left:15mm; right:15mm;
    border-top:1px solid #e5e7eb; padding-top:3px;
    display:flex; justify-content:space-between; font-size:7pt; color:#9ca3af; }

  /* ── Print button ── */
  .no-print { position:fixed; top:15px; right:15px; z-index:9999; }
  .btn-print { background:#1d4ed8; color:#fff; border:none; border-radius:6px;
    padding:8px 18px; font-size:11pt; font-weight:700; cursor:pointer; box-shadow:0 2px 8px #0003; }
  .btn-print:hover { background:#1e40af; }

  .all-ok { background:#f0fdf4; border:2px solid #16a34a; border-radius:4px;
    padding:4px 10px; color:#15803d; font-weight:800; font-size:10pt; text-align:center; margin-bottom:8px; }
  .has-fail { background:#fef2f2; border:2px solid #dc2626; border-radius:4px;
    padding:4px 10px; color:#dc2626; font-weight:800; font-size:10pt; text-align:center; margin-bottom:8px; }
</style>
</head>
<body>

<button class="no-print btn-print" onclick="window.print()">🖨 Cetak / Simpan PDF</button>

<div class="report-header">
  <h1>PRESTRESS-CALC — Laporan Desain Prategang</h1>
  <p class="sub">Gelagar I Beton Prategang Pasca-Tarik (Post-tensioned) · ACI 318 / SNI 2847 / AASHTO LRFD Refined Method</p>
  <div class="proj-info">
    <div><span class="pk">Nama Proyek:</span></div>
    <div><span class="pv">${projectInfo.namaProyek || "—"}</span></div>
    <div><span class="pk">No. Pekerjaan:</span></div>
    <div><span class="pv">${projectInfo.noPekerjaan || "—"}</span></div>
    <div><span class="pk">Perencana:</span></div>
    <div><span class="pv">${projectInfo.perencana || "—"}</span></div>
    <div><span class="pk">Lokasi:</span></div>
    <div><span class="pv">${projectInfo.lokasi || "—"}</span></div>
  </div>
  <div class="meta">
    <span>Tanggal cetak: ${now}</span>
    <span>Bentang: ${n(loads.spanLength/1000,2)} m · H_girder: ${hTotal} mm · H_komposit: ${hComp} mm</span>
  </div>
</div>

${(() => {
  const allOk = sls.isOverallSafe && uf.isAdequate && us.isAdequate && d.liveOk && d.totalOk;
  return `<div class="${allOk ? "all-ok" : "has-fail"}">
    ${allOk ? "✓ SEMUA KONTROL AMAN" : "✗ ADA KONTROL YANG TIDAK TERPENUHI"} &nbsp;|&nbsp;
    SLS: ${sls.isOverallSafe ? "✓" : "✗"} &nbsp; Lentur: ${uf.isAdequate ? "✓" : "✗"} &nbsp;
    Geser: ${us.isAdequate ? "✓" : "✗"} &nbsp; Lendutan: ${d.liveOk && d.totalOk ? "✓" : "✗"}
  </div>`;
})()}

${twoCol(
  section("1. Geometri I-Girder", table(
    row("Sayap atas b₁ × h₁", `${girder.b1} × ${girder.h1}`, "mm") +
    row("Web  b₂ × h₂", `${girder.b2} × ${girder.h2}`, "mm") +
    row("Sayap bawah b₃ × h₃", `${girder.b3} × ${girder.h3}`, "mm") +
    row("H_girder total", `${hTotal}`, "mm") +
    row("Panjang bentang L", `${n(loads.spanLength/1000,2)}`, "m")
  )),
  section("2. Material", table(
    row("f'ci transfer", MPa(material.fci)) +
    row("f'c girder servis", MPa(material.fc)) +
    row("f'c pelat lantai", MPa(material.fcDeck)) +
    row("E_c girder", `${n(material.Ec,0)}`, "MPa") +
    row("f_pu strand", MPa(material.fpu)) +
    row("E_ps strand", `${n(material.Eps,0)}`, "MPa") +
    row("f_y baja mild", MPa(material.fy)) +
    row("A_s tulangan tarik", mm2(material.As)) +
    row("f_ys sengkang", MPa(material.fys))
  ))
)}

${twoCol(
  section("3. Penampang Non-Komposit", table(
    row("A_g", `${n(g.areaAg,0)}`, "mm²") +
    row("y_b", mm(g.yb)) +
    row("y_t", mm(g.yt)) +
    row("I_g", sci(g.momentOfInertiaIg, 11), "mm⁴") +
    row("Z_tg", sci(g.Ztg, 6), "mm³") +
    row("Z_bg", sci(g.Zbg, 6), "mm³")
  )),
  section("4. Penampang Komposit", table(
    row("t_d × b_eff", `${deck.thicknessTd} × ${deck.widthBeff}`, "mm") +
    row("n_c = E_deck/E_girder", n(c.modularRatioNc, 4)) +
    row("A_c komposit", `${n(c.compositeAreaAc,0)}`, "mm²") +
    row("y_bc", mm(c.ybc)) +
    row("I_c", sci(c.momentOfInertiaIc, 11), "mm⁴") +
    row("Z_bc", sci(c.Zbc, 6), "mm³") +
    row("Z_tgc", sci(c.Ztgc, 6), "mm³")
  ))
)}

${section("5. Konfigurasi Tendon", twoCol(
  table(
    row("Profil lintasan", tendon.profileType) +
    row("Jumlah strand total", `${totalStrands}`) +
    row("Luas 1 strand", mm2(tendon.singleStrandArea)) +
    row("A_ps total", mm2(Aps)) +
    row("Ø strand nominal", `${tendon.strandDiameter}`, "mm") +
    row("Rasio jacking", n(tendon.jackingRatio, 2)) +
    row("e midspan (terhitung)", mm(e_mid)) +
    row("e tumpuan", mm(tendon.eccentricitySupport))
  ),
  table(
    row("f_jack = ρ × f_pu", MPa(p.jackingStressMpa)) +
    row("P_j gaya dongkrak", kN(p.Pj)) +
    row("μ gesek", n(immediateLoss.mu, 3)) +
    row("K wobble", `${immediateLoss.K.toFixed(7)}`, "/mm") +
    row("Δ_set slip angkur", `${immediateLoss.deltaSet}`, "mm") +
    row("N kelompok jacking", `${immediateLoss.numJackingGroups}`)
  )
))}

${section("6. Kehilangan Prategang (6 Komponen)", `
  <div class="summary-box" style="margin-bottom:6px;">
    <div class="row"><span class="lkey">f_jack</span><span class="lval">${MPa(p.jackingStressMpa)}</span></div>
    <div class="row"><span class="lkey">Total kehilangan</span><span class="lval" style="color:#dc2626">−${n(totalLossMpa,2)} MPa (${n(etaLoss,1)}%)</span></div>
    <div class="row"><span class="lkey">f_pe efektif</span><span class="lval" style="color:#15803d">${MPa(p.jackingStressMpa - totalLossMpa)}</span></div>
    <div class="row"><span class="lkey">P_j → P_i → P_e</span><span class="lval">${kN(p.Pj)} → ${kN(p.Pi)} → ${kN(p.Pe)}</span></div>
  </div>
  <div class="sub-title">Seketika</div>
  ${[
    { label: "FR  Gesek (midspan)", val: p.deltaFR, color: "#EF4444" },
    { label: "AS  Slip Angkur", val: p.deltaAS, color: "#F97316" },
    { label: "ES  Perpendekan Elastis", val: p.deltaES, color: "#F59E0B" },
  ].map(l => `<div class="loss-row">
    <span class="loss-name">${l.label}</span>
    <div class="loss-bar-bg"><div class="loss-bar" style="width:${Math.min(l.val/p.jackingStressMpa*100*5,100)}%;background:${l.color}"></div></div>
    <span class="loss-val">${MPa(l.val)}</span>
    <span class="loss-pct">${pct(l.val, p.jackingStressMpa)}</span>
  </div>`).join("")}
  <div class="sub-title" style="margin-top:6px">Jangka Panjang (AASHTO Refined)</div>
  ${[
    { label: "CR  Rangkak (Creep)", val: td.deltaFpCR, color: "#8B5CF6" },
    { label: "SH  Susut (Shrinkage)", val: td.deltaFpSR, color: "#3B82F6" },
    { label: "RE  Relaksasi", val: td.deltaFpR2, color: "#10B981" },
  ].map(l => `<div class="loss-row">
    <span class="loss-name">${l.label}</span>
    <div class="loss-bar-bg"><div class="loss-bar" style="width:${Math.min(l.val/p.jackingStressMpa*100*5,100)}%;background:${l.color}"></div></div>
    <span class="loss-val">${MPa(l.val)}</span>
    <span class="loss-pct">${pct(l.val, p.jackingStressMpa)}</span>
  </div>`).join("")}
`)}

${section("7. Beban & Momen", twoCol(
  `<div class="sub-title">Momen Rencana</div>` +
  table(
    row("w_self (berat sendiri)", `${n(m.wSelf,3)}`, "kN/m") +
    row("w_SDL", `${loads.wSDL}`, "kN/m") +
    row("w_live", `${loads.wLive}`, "kN/m") +
    row("M_g (berat sendiri)", kNm(m.Mg)) +
    row("M_sdl", kNm(m.Msdl)) +
    row("M_live", kNm(m.Mlive)) +
    row("M_service total", kNm(m.Mservice)) +
    row("M_u = 1.25DL+1.75LL", kNm(m.Mu))
  ),
  `<div class="sub-title">Kelembapan & Lingkungan</div>` +
  table(
    row("Kelembapan relatif (RH)", `${loads.relativeHumidity}`, "%") +
    row("Berat jenis beton γ", `${loads.gammaConc}`, "kN/m³")
  )
))}

${section("8. Kontrol SLS — Tegangan Serat", `
  <div style="${sls.isOverallSafe ? "color:#15803d" : "color:#dc2626"};font-weight:700;margin-bottom:5px;font-size:9pt">
    ${sls.isOverallSafe ? "✓ SEMUA FIBER AMAN" : "✗ ADA FIBER OVERSTRESS"}
  </div>
  <div class="sub-title">Tahap Transfer (P_i + M_g) — batas ±: −0.60f'ci / +0.50√f'ci</div>
  <table class="data-table">
    <thead><tr style="background:#e0f2fe;font-size:7.5pt">
      <td class="lbl">Serat</td><td class="val">σ (MPa)</td>
      <td class="unit">Batas−</td><td class="unit">Batas+</td><td class="unit">Status</td>
    </tr></thead>
    <tbody>
      ${[sls.transfer.topFiber, sls.transfer.botFiber].map(f => `
        <tr style="${f.isSafe ? "" : "background:#fef2f2"}">
          <td class="lbl">${f.fiber}</td>
          <td class="val" style="${f.isSafe ? "" : "color:#dc2626"}">${MPa(f.stressMpa)}</td>
          <td class="unit">−${n(f.limitCompMpa,1)}</td>
          <td class="unit">+${n(f.limitTensMpa,2)}</td>
          <td class="unit">${verdict(f.isSafe)}</td>
        </tr>`).join("")}
    </tbody>
  </table>
  <div class="sub-title" style="margin-top:6px">Tahap Servis (P_e + M_total) — batas ±: −0.45f'c / +0.50√f'c</div>
  <table class="data-table">
    <thead><tr style="background:#e0f2fe;font-size:7.5pt">
      <td class="lbl">Serat</td><td class="val">σ (MPa)</td>
      <td class="unit">Batas−</td><td class="unit">Batas+</td><td class="unit">Status</td>
    </tr></thead>
    <tbody>
      ${[sls.service.topFiber, sls.service.botFiber, sls.service.deckFiber].map(f => `
        <tr style="${f.isSafe ? "" : "background:#fef2f2"}">
          <td class="lbl">${f.fiber}</td>
          <td class="val" style="${f.isSafe ? "" : "color:#dc2626"}">${MPa(f.stressMpa)}</td>
          <td class="unit">−${n(f.limitCompMpa,1)}</td>
          <td class="unit">+${n(f.limitTensMpa,2)}</td>
          <td class="unit">${verdict(f.isSafe)}</td>
        </tr>`).join("")}
    </tbody>
  </table>
`)}

${twoCol(
  section("9. Kontrol ULS Lentur (φ=0.90)", `
    ${table(
      row("d_p (dari top komposit)", mm(hComp - (g.yb - e_mid))) +
      row("f_ps (strand pada ULS)", MPa(uf.fps)) +
      row("a (blok tekan Whitney)", mm(uf.a)) +
      row("c (garis netral)", mm(uf.c)) +
      row("c/d_p", n(uf.c / (hComp - (g.yb - e_mid)), 3)) +
      row("M_n nominal", kNm(uf.Mn)) +
      row("φM_n kapasitas", kNm(uf.phiMn)) +
      row("M_u terfaktor", kNm(uf.Mu))
    )}
    <div class="check-row ${uf.isAdequate ? "" : "fail"}">
      <span class="check-label">φM_n ≥ M_u</span>
      <span class="check-value">${kNm(uf.phiMn)} ≥ ${kNm(uf.Mu)}</span>
      <span>${check(uf.isAdequate)}</span>
    </div>
  `),
  section("10. Kontrol ULS Geser (φ=0.75)", `
    ${table(
      row("V_p (komponen vertikal)", kN(us.Vp)) +
      row("V_ci (geser-lentur)", kN(us.Vci)) +
      row("V_cw (geser-web)", kN(us.Vcw)) +
      row("V_c = min(Vci, Vcw)", kN(us.Vc)) +
      row("A_v/s diperlukan", us.AvPerS > 0 ? n(us.AvPerS,4) + " mm²/mm" : "min") +
      row("V_u terfaktor", kN(us.Vu))
    )}
    <div class="check-row ${us.isAdequate ? "" : "fail"}">
      <span class="check-label">φ(Vc+Vp) ≥ Vu</span>
      <span class="check-value">${kN(0.75*(us.Vc+us.Vp))} ≥ ${kN(us.Vu)}</span>
      <span>${check(us.isAdequate)}</span>
    </div>
  `)
)}

${section("11. Kontrol Lendutan & Camber", `
  ${twoCol(
    table(
      row("δ Camber (prategang)", `+${mm(d.deltaCamber)}`, "↑") +
      row("δ Berat sendiri", `−${mm(d.deltaSW)}`, "↓") +
      row("δ Pelat lantai", `−${mm(d.deltaDeck)}`, "↓") +
      row("δ Live load", `−${mm(d.deltaLive)}`, "↓") +
      row("δ Total (+ = ke atas)", `${d.deltaTotal >= 0 ? "+" : ""}${mm(d.deltaTotal)}`)
    ),
    `<div style="font-size:8pt;color:#374151;margin-bottom:4px">
      Batas: L/360 = ${mm(d.limitLive)} (live) · L/300 = ${mm(d.limitTotal)} (total)<br>
      Multiplier rangkak jangka panjang: 2.0
    </div>
    <div class="check-row ${d.liveOk ? "" : "fail"}">
      <span class="check-label">δ_live ≤ L/360</span>
      <span class="check-value">${mm(d.deltaLive)} ≤ ${mm(d.limitLive)}</span>
      <span>${check(d.liveOk)}</span>
    </div>
    <div class="check-row ${d.totalOk ? "" : "fail"}" style="margin-top:3px">
      <span class="check-label">|δ_total| ≤ L/300</span>
      <span class="check-value">${mm(Math.abs(d.deltaTotal))} ≤ ${mm(d.limitTotal)}</span>
      <span>${check(d.totalOk)}</span>
    </div>`
  )}
`)}

<div class="footer">
  <span>PRESTRESS-CALC — ACI 318 / SNI 2847 / AASHTO LRFD</span>
  <span>${now}</span>
  <span>L = ${n(loads.spanLength/1000,2)} m · A_ps = ${n(Aps,1)} mm² · η_loss = ${n(etaLoss,1)}%</span>
</div>

</body>
</html>`;

  const w = window.open("", "_blank", "width=900,height=750,scrollbars=yes");
  if (!w) { alert("Popup diblokir browser. Izinkan popup untuk mencetak laporan."); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
}
