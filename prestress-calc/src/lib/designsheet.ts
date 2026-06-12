/**
 * Unified Design Output Sheet — one complete structural-engineering
 * drawing combining: composite cross-section, multi-tendon PT profile,
 * moment & deflection curves, transfer/service stress diagrams, key
 * results and verdict stamps in an engineering title block.
 *
 * Pure SVG-string generator (no React) so the SAME figure is embedded
 * in the on-screen results panel AND the printed PDF report — single
 * source, no duplication.
 *
 * Palette (engineering, no garish colors):
 *   concrete   #dbeafe / #bfdbfe (light blue)   outline #1d4ed8 (blue)
 *   steel/duct #475569 (slate)                  grid    #94a3b8
 *   compression #1d4ed8 (blue)   tension #dc2626 (red, sparingly)
 *   safe        #15803d (green)  text    #1f2937
 */

import { tendonProfile } from "@/engine/tendon";
import { suggestTendonLayout } from "@/lib/strands";
import type { ProjectInputs, DesignResults, IGirderGeometry } from "@/types";

// ─── shared geometry helper ──────────────────────────────────

/** Symmetric girder outline (bottom→top), as an SVG points string. */
export function sectionPolygonPoints(
  g: IGirderGeometry, scale: number, cx: number, baseY: number
): string {
  const h4 = g.h4 ?? 0, h5 = g.h5 ?? 0;
  const yPix = (yFromBottom: number) => baseY - yFromBottom * scale;
  const half = (w: number) => (w / 2) * scale;
  let y = 0;
  const L: [number, number][] = [], R: [number, number][] = [];
  L.push([cx - half(g.b3), yPix(y)]); R.push([cx + half(g.b3), yPix(y)]);
  y += g.h3;
  L.push([cx - half(g.b3), yPix(y)]); R.push([cx + half(g.b3), yPix(y)]);
  y += h4;
  L.push([cx - half(g.b2), yPix(y)]); R.push([cx + half(g.b2), yPix(y)]);
  y += g.h2;
  L.push([cx - half(g.b2), yPix(y)]); R.push([cx + half(g.b2), yPix(y)]);
  y += h5;
  L.push([cx - half(g.b1), yPix(y)]); R.push([cx + half(g.b1), yPix(y)]);
  y += g.h1;
  L.push([cx - half(g.b1), yPix(y)]); R.push([cx + half(g.b1), yPix(y)]);
  return [...L, ...R.reverse()].map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
}

// ─── small svg helpers ───────────────────────────────────────

const f = (v: number, d = 2) => v.toFixed(d);

function txt(x: number, y: number, s: string, opt: {
  size?: number; fill?: string; w?: number | string; anchor?: string; mono?: boolean;
} = {}): string {
  const { size = 9, fill = "#1f2937", w = 400, anchor = "start", mono = false } = opt;
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${w}"
    text-anchor="${anchor}"${mono ? ' font-family="Consolas,monospace"' : ' font-family="Arial,sans-serif"'}>${s}</text>`;
}

/** Stress diagram: vertical axis with linear σ(y); blue = compression, red = tension. */
function stressDiagram(
  x0: number, yTop: number, yBot: number,
  sTop: number, sBot: number, pxPerMPa: number, label: string
): string {
  const xT = x0 + sTop * pxPerMPa;
  const xB = x0 + sBot * pxPerMPa;
  let body = "";
  if (sTop * sBot >= 0) {
    const col = (sTop + sBot) >= 0 ? "#fecaca" : "#bfdbfe";
    const line = (sTop + sBot) >= 0 ? "#dc2626" : "#1d4ed8";
    body = `<polygon points="${x0},${yTop} ${xT},${yTop} ${xB},${yBot} ${x0},${yBot}"
      fill="${col}" fill-opacity="0.75" stroke="${line}" stroke-width="1"/>`;
  } else {
    // zero crossing
    const t = Math.abs(sTop) / (Math.abs(sTop) + Math.abs(sBot));
    const yC = yTop + (yBot - yTop) * t;
    const colT = sTop >= 0 ? "#fecaca" : "#bfdbfe";
    const colB = sBot >= 0 ? "#fecaca" : "#bfdbfe";
    const lnT = sTop >= 0 ? "#dc2626" : "#1d4ed8";
    const lnB = sBot >= 0 ? "#dc2626" : "#1d4ed8";
    body =
      `<polygon points="${x0},${yTop} ${xT},${yTop} ${x0},${yC}" fill="${colT}" fill-opacity="0.75" stroke="${lnT}" stroke-width="1"/>` +
      `<polygon points="${x0},${yC} ${xB},${yBot} ${x0},${yBot}" fill="${colB}" fill-opacity="0.75" stroke="${lnB}" stroke-width="1"/>`;
  }
  return `
    ${body}
    <line x1="${x0}" y1="${yTop - 4}" x2="${x0}" y2="${yBot + 4}" stroke="#475569" stroke-width="1"/>
    ${txt(xT + (sTop >= 0 ? 3 : -3), yTop + 3, f(sTop), { size: 8, mono: true, fill: sTop >= 0 ? "#dc2626" : "#1d4ed8", anchor: sTop >= 0 ? "start" : "end" })}
    ${txt(xB + (sBot >= 0 ? 3 : -3), yBot + 3, f(sBot), { size: 8, mono: true, fill: sBot >= 0 ? "#dc2626" : "#1d4ed8", anchor: sBot >= 0 ? "start" : "end" })}
    ${txt(x0, yBot + 16, label, { size: 8.5, w: 700, anchor: "middle", fill: "#334155" })}
  `;
}

function stamp(x: number, y: number, ok: boolean, label: string): string {
  const col = ok ? "#15803d" : "#dc2626";
  return `
    <rect x="${x}" y="${y}" width="118" height="20" rx="3" fill="none" stroke="${col}" stroke-width="1.4"/>
    ${txt(x + 59, y + 14, `${ok ? "✓" : "✗"} ${label}`, { size: 9, fill: col, w: 700, anchor: "middle" })}
  `;
}

// ─── main generator ──────────────────────────────────────────

export function designSheetSVG(inputs: ProjectInputs, r: DesignResults): string {
  const { girder, deck, tendon, loads, projectInfo, material } = inputs;
  const g = r.gross, sls = r.sls, p = r.prestress, m = r.moments;
  const defl = r.deflection, uf = r.ulsFlexure, dm = r.dualMethod;

  const W = 1150, H = 815;
  const hG = g.hTotal, hC = hG + deck.thicknessTd;
  const totalStrands = tendon.rows.reduce((s, row) => s + row.strandCount, 0);
  const Aps = totalStrands * tendon.singleStrandArea;
  const eMid = g.yb - (totalStrands > 0
    ? tendon.rows.reduce((s, row) => s + row.strandCount * row.yFromBottom, 0) / totalStrands
    : g.yb - 100);
  const layout = suggestTendonLayout(totalStrands);

  // ════ Zone A — composite cross-section ════
  const secScale = 300 / hC;
  const secCx = 142, secBase = 396;
  const deckW = Math.min(deck.widthBeff * secScale, 250);
  const deckH = deck.thicknessTd * secScale;
  const yDeckTop = secBase - hC * secScale;
  const naY = secBase - r.composite.ybc * secScale;
  const naGirderY = secBase - g.yb * secScale;

  let strandCircles = "";
  for (const row of tendon.rows) {
    const ry = secBase - row.yFromBottom * secScale;
    const nDots = Math.min(row.strandCount, 12);
    const spread = Math.min(girder.b3 * 0.55 * secScale, 90);
    for (let i = 0; i < nDots; i++) {
      const rx = secCx - spread / 2 + (nDots > 1 ? (spread * i) / (nDots - 1) : 0);
      strandCircles += `<circle cx="${rx}" cy="${ry}" r="2.1" fill="#475569" stroke="#1f2937" stroke-width="0.4"/>`;
    }
  }

  const zoneA = `
    ${txt(20, 64, "A — PENAMPANG KOMPOSIT", { size: 9.5, w: 700, fill: "#1d4ed8" })}
    <rect x="${secCx - deckW / 2}" y="${yDeckTop}" width="${deckW}" height="${deckH}"
      fill="#e2e8f0" stroke="#64748b" stroke-width="1"/>
    <polygon points="${sectionPolygonPoints(girder, secScale, secCx, secBase)}"
      fill="#dbeafe" stroke="#1d4ed8" stroke-width="1.4"/>
    ${strandCircles}
    <line x1="${secCx - 124}" y1="${naY}" x2="${secCx + 124}" y2="${naY}" stroke="#dc2626" stroke-width="0.9" stroke-dasharray="5 3"/>
    ${txt(secCx + 126, naY + 3, `NA komposit y_bc=${f(r.composite.ybc, 0)}`, { size: 7.5, fill: "#dc2626" })}
    <line x1="${secCx - 124}" y1="${naGirderY}" x2="${secCx + 124}" y2="${naGirderY}" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="3 3"/>
    ${txt(secCx + 126, naGirderY + 3, `NA girder y_b=${f(g.yb, 0)}`, { size: 7.5, fill: "#64748b" })}
    <line x1="24" y1="${secBase}" x2="24" y2="${yDeckTop}" stroke="#475569" stroke-width="0.9" marker-start="url(#dim)" marker-end="url(#dim)"/>
    ${txt(20, (secBase + yDeckTop) / 2, `H = ${f(hC, 0)} mm`, { size: 8, anchor: "middle", fill: "#475569" })?.replace("<text ", `<text transform="rotate(-90 20 ${(secBase + yDeckTop) / 2})" `)}
    ${txt(secCx, secBase + 14, `${totalStrands} strand Ø${tendon.strandDiameter} · A_ps=${f(Aps, 0)} mm² · e=${f(eMid, 0)} mm`, { size: 8, anchor: "middle", fill: "#334155", mono: true })}
  `;

  // ════ Zone B — multi-tendon PT profile (elevation) ════
  const bx = 292, bw2 = 552, by = 58, bh = 150;
  const exScale = bw2 / loads.spanLength;
  const eyScale = (bh - 36) / hG;
  const girTopY = by + 14, girBotY = girTopY + hG * eyScale;
  const cgY = girBotY - g.yb * eyScale;
  const pts = tendonProfile({ ...tendon, eccentricityMidspan: eMid }, loads.spanLength, 40);
  const nTendonDraw = Math.min(layout.nTendons || 1, 4);
  let tendonPaths = "";
  for (let k = 0; k < nTendonDraw; k++) {
    const off = (k - (nTendonDraw - 1) / 2) * 3.2;
    const d = pts.map((pt, i) =>
      `${i === 0 ? "M" : "L"}${(bx + pt.xMm * exScale).toFixed(1)},${(cgY + pt.eMm * eyScale + off).toFixed(1)}`
    ).join(" ");
    tendonPaths += `<path d="${d}" fill="none" stroke="#475569" stroke-width="1.5"/>`;
  }
  const zoneB = `
    ${txt(bx, 50, `B — PROFIL TENDON PASCA-TARIK (${layout.nTendons} × tendon-${layout.unitSize}, ${tendon.profileType})`, { size: 9.5, w: 700, fill: "#1d4ed8" })}
    <rect x="${bx}" y="${girTopY}" width="${bw2}" height="${hG * eyScale}" fill="#eff6ff" stroke="#1d4ed8" stroke-width="1.1"/>
    <line x1="${bx}" y1="${cgY}" x2="${bx + bw2}" y2="${cgY}" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="4 3"/>
    ${txt(bx + bw2 + 4, cgY + 3, "cgc", { size: 7.5, fill: "#64748b" })}
    ${tendonPaths}
    <rect x="${bx - 7}" y="${cgY - 9}" width="7" height="18" fill="#cbd5e1" stroke="#475569" stroke-width="0.8"/>
    <rect x="${bx + bw2}" y="${cgY - 9}" width="7" height="18" fill="#cbd5e1" stroke="#475569" stroke-width="0.8"/>
    ${txt(bx - 9, cgY - 13, "angkur", { size: 7, fill: "#475569" })}
    <line x1="${bx + bw2 / 2}" y1="${cgY}" x2="${bx + bw2 / 2}" y2="${cgY + eMid * eyScale}" stroke="#dc2626" stroke-width="0.8" stroke-dasharray="2 2"/>
    ${txt(bx + bw2 / 2 + 4, cgY + eMid * eyScale - 4, `e=${f(eMid, 0)} mm`, { size: 7.5, fill: "#dc2626", mono: true })}
    ${txt(bx + bw2 / 2, girBotY + 14, `L = ${f(loads.spanLength / 1000, 1)} m · P_jack=${f(p.Pj, 0)} kN → P_e=${f(p.Pe, 0)} kN (loss ${f((1 - p.Pe / p.Pj) * 100, 1)}%)`, { size: 8, anchor: "middle", fill: "#334155", mono: true })}
  `;

  // ════ Zone C — moment & deflection ════
  const cx0 = 292, cw0 = 552, cy0 = 252, ch0 = 130;
  const axisY = cy0 + 58;
  const mScale = 44 / Math.max(m.Mu, 1);
  const dScale = 30 / Math.max(Math.abs(defl.deltaTotal), Math.abs(defl.deltaLive), 1);
  let momPath = "", deflPath = "";
  for (let i = 0; i <= 40; i++) {
    const xi = i / 40;
    const px = cx0 + xi * cw0;
    const shape = 4 * xi * (1 - xi);          // parabola 0..1
    const myv = axisY + m.Mu * shape * mScale; // moment drawn downward (sagging)
    const dyv = axisY - defl.deltaTotal * shape * dScale; // camber up = up
    momPath  += `${i === 0 ? "M" : "L"}${px.toFixed(1)},${myv.toFixed(1)} `;
    deflPath += `${i === 0 ? "M" : "L"}${px.toFixed(1)},${dyv.toFixed(1)} `;
  }
  const zoneC = `
    ${txt(cx0, cy0 - 6, "C — MOMEN ULTIMIT & LENDUTAN NETO", { size: 9.5, w: 700, fill: "#1d4ed8" })}
    <line x1="${cx0}" y1="${axisY}" x2="${cx0 + cw0}" y2="${axisY}" stroke="#475569" stroke-width="1"/>
    <path d="${momPath}" fill="none" stroke="#94a3b8" stroke-width="1.4"/>
    <path d="${deflPath}" fill="none" stroke="#1d4ed8" stroke-width="1.6"/>
    ${txt(cx0 + cw0 / 2, axisY + m.Mu * mScale + 14, `M_u = ${f(m.Mu, 0)} kN·m ≤ φM_n = ${f(uf.phiMn, 0)} kN·m`, { size: 8, anchor: "middle", fill: "#64748b", mono: true })}
    ${txt(cx0 + cw0 / 2, axisY - defl.deltaTotal * dScale - 6, `δ_net = ${f(defl.deltaTotal, 1)} mm ${defl.deltaTotal >= 0 ? "(camber ↑)" : "(lendut ↓)"}`, { size: 8, anchor: "middle", fill: "#1d4ed8", mono: true })}
    ${txt(cx0 + 4, cy0 + ch0 - 2, `δ_live = ${f(defl.deltaLive, 1)} mm ≤ L/800 = ${f(defl.limitLive, 1)} mm ${defl.liveOk ? "✓" : "✗"}`, { size: 8, fill: defl.liveOk ? "#15803d" : "#dc2626", mono: true })}
  `;

  // ════ Zone D — stress diagrams (transfer | service | dual limits) ════
  const dy0 = 432, dTop = dy0 + 26, dBot = dy0 + 158;
  const pxMPa = 4.2;
  const zoneD = `
    ${txt(20, dy0 + 6, "D — DIAGRAM TEGANGAN SERAT (MPa · biru = tekan, merah = tarik)", { size: 9.5, w: 700, fill: "#1d4ed8" })}
    ${stressDiagram(110, dTop, dBot, sls.transfer.sigmaTop, sls.transfer.sigmaBot, pxMPa, "TRANSFER (P_i + M_g)")}
    ${stressDiagram(320, dTop, dBot, sls.service.sigmaTop, sls.service.sigmaBot, pxMPa, "LAYAN (P_e + M_total)")}
    ${stressDiagram(530, dTop, dBot, sls.service.sigmaDeck, 0, pxMPa, "DECK (M_live)")}
    ${txt(640, dTop + 12, "Batas izin:", { size: 8.5, w: 700, fill: "#334155" })}
    ${txt(640, dTop + 26, `transfer: −0.60f'ci = −${f(0.6 * material.fci, 1)} · +0.50√f'ci = +${f(0.5 * Math.sqrt(material.fci), 2)}`, { size: 8, fill: "#475569", mono: true })}
    ${txt(640, dTop + 40, `layan: −0.45f'c = −${f(0.45 * material.fc, 1)} · Penuh +0.50√f'c = +${f(0.5 * Math.sqrt(material.fc), 2)}`, { size: 8, fill: "#475569", mono: true })}
    ${txt(640, dTop + 54, `Parsial (LRFD) +1.00√f'c = +${f(Math.sqrt(material.fc), 2)} · f_r = ${f(0.62 * Math.sqrt(material.fc), 2)}`, { size: 8, fill: "#475569", mono: true })}
    ${dm ? txt(640, dTop + 76, `PENUH: ${dm.full.safe ? "✓ memenuhi" : "✗ overstress"} · PARSIAL: ${dm.partial.safe ? "✓ memenuhi" : "✗ overstress"}${dm.partial.cracked ? ` (retak, w=${f(dm.partial.crackWidthMm, 2)}mm)` : ""}`, { size: 8.5, w: 700, fill: dm.full.safe || dm.partial.safe ? "#15803d" : "#dc2626" }) : ""}
    ${dm ? txt(640, dTop + 92, dm.governs, { size: 7.5, fill: "#64748b" }) : ""}
  `;

  // ════ Zone F — key results column ════
  const fx = 866, fy = 58;
  const keyRows: [string, string][] = [
    ["A_g / A_c", `${f(g.areaAg / 1e3, 0)}e3 / ${f(r.composite.compositeAreaAc / 1e3, 0)}e3 mm²`],
    ["I_g / I_c", `${(g.momentOfInertiaIg / 1e11).toFixed(3)} / ${(r.composite.momentOfInertiaIc / 1e11).toFixed(3)} e11 mm⁴`],
    ["y_b / y_bc", `${f(g.yb, 1)} / ${f(r.composite.ybc, 1)} mm`],
    ["Z_tg / Z_bg", `${(g.Ztg / 1e6).toFixed(1)} / ${(g.Zbg / 1e6).toFixed(1)} e6 mm³`],
    ["kern k_t/k_b", `${f(g.kt, 0)} / ${f(g.kb, 0)} mm`],
    ["w_self / M_g", `${f(m.wSelf, 2)} kN/m / ${f(m.Mg, 0)} kN·m`],
    ["M_service / M_u", `${f(m.Mservice, 0)} / ${f(m.Mu, 0)} kN·m`],
    ["P_j → P_i → P_e", `${f(p.Pj, 0)} → ${f(p.Pi, 0)} → ${f(p.Pe, 0)} kN`],
    ["f_se / f_ps", `${f(p.fse, 0)} / ${f(uf.fps, 0)} MPa`],
    ["a / c Whitney", `${f(uf.a, 1)} / ${f(uf.c, 1)} mm`],
    ["φM_n", `${f(uf.phiMn, 0)} kN·m`],
    ["PPR", r.PPR !== undefined ? `${f(r.PPR * 100, 1)} %` : "—"],
    ["δ camber/total", `${f(defl.deltaCamber, 1)} / ${f(defl.deltaTotal, 1)} mm`],
  ];
  const zoneF = `
    ${txt(fx, 64, "E — HASIL KUNCI (SI)", { size: 9.5, w: 700, fill: "#1d4ed8" })}
    ${keyRows.map((row, i) =>
      txt(fx, fy + 24 + i * 17, row[0], { size: 8, fill: "#64748b" }) +
      txt(fx + 272, fy + 24 + i * 17, row[1], { size: 8, anchor: "end", mono: true, fill: "#1f2937" })
    ).join("")}
    ${stamp(fx, fy + 254, sls.isOverallSafe, "SLS TEGANGAN")}
    ${stamp(fx + 132, fy + 254, uf.isAdequate, "ULS LENTUR")}
    ${stamp(fx, fy + 280, defl.liveOk && defl.totalOk, "LENDUTAN")}
    ${stamp(fx + 132, fy + 280, r.ulsShear.isAdequate, "GESER")}
    ${dm ? stamp(fx, fy + 306, dm.full.safe, "PENUH (U)") : ""}
    ${dm ? stamp(fx + 132, fy + 306, dm.partial.safe, "PARSIAL LRFD") : ""}
  `;

  // ════ Title block ════
  const tbY = 662;
  const sysLabel = "PASCA-TARIK MULTI-TENDON (POST-TENSIONED)";
  const titleBlock = `
    <rect x="8" y="${tbY}" width="${W - 16}" height="${H - tbY - 8}" fill="none" stroke="#1f2937" stroke-width="1.6"/>
    <line x1="8" y1="${tbY + 26}" x2="${W - 8}" y2="${tbY + 26}" stroke="#1f2937" stroke-width="1"/>
    <line x1="300" y1="${tbY}" x2="300" y2="${H - 8}" stroke="#1f2937" stroke-width="0.8"/>
    <line x1="640" y1="${tbY}" x2="640" y2="${H - 8}" stroke="#1f2937" stroke-width="0.8"/>
    <line x1="930" y1="${tbY}" x2="930" y2="${H - 8}" stroke="#1f2937" stroke-width="0.8"/>
    ${txt(16, tbY + 18, "PRESTRESS-CALC DESIGN SUITE", { size: 11, w: 800, fill: "#1d4ed8" })}
    ${txt(308, tbY + 18, sysLabel, { size: 9.5, w: 700, fill: "#334155" })}
    ${txt(648, tbY + 18, "ACI 318-19 / SNI 2847:2019 · AASHTO LRFD · BS 8110 · EC2", { size: 8.5, fill: "#475569" })}
    ${txt(938, tbY + 18, new Date().toLocaleDateString("id-ID"), { size: 9, fill: "#475569" })}
    ${txt(16, tbY + 44, `Proyek : ${projectInfo.namaProyek || "—"}`, { size: 9, fill: "#1f2937" })}
    ${txt(16, tbY + 60, `Lokasi : ${projectInfo.lokasi || "—"}`, { size: 9, fill: "#1f2937" })}
    ${txt(16, tbY + 76, `Perencana : ${projectInfo.perencana || "—"}`, { size: 9, fill: "#1f2937" })}
    ${txt(16, tbY + 92, `No. Pekerjaan : ${projectInfo.noPekerjaan || "—"}`, { size: 9, fill: "#1f2937" })}
    ${txt(308, tbY + 44, `L = ${f(loads.spanLength / 1000, 1)} m · girder H = ${f(hG, 0)} mm + deck ${f(deck.thicknessTd, 0)} mm`, { size: 8.5, mono: true })}
    ${txt(308, tbY + 60, `f'ci/f'c = ${material.fci}/${material.fc} MPa · deck ${material.fcDeck} MPa`, { size: 8.5, mono: true })}
    ${txt(308, tbY + 76, `f_pu = ${tendon.fpu} MPa · ${totalStrands} strand = ${layout.nTendons}×tendon-${layout.unitSize}`, { size: 8.5, mono: true })}
    ${txt(308, tbY + 92, `Beban: w_sdl=${loads.wSDL} · w_live=${loads.wLive} kN/m · RH=${loads.relativeHumidity}%`, { size: 8.5, mono: true })}
    ${txt(648, tbY + 44, `P_e = ${f(p.Pe, 0)} kN · f_se = ${f(p.fse, 0)} MPa`, { size: 8.5, mono: true })}
    ${txt(648, tbY + 60, `σ layan atas/bawah = ${f(sls.service.sigmaTop)} / ${f(sls.service.sigmaBot)} MPa`, { size: 8.5, mono: true })}
    ${txt(648, tbY + 76, `φM_n/M_u = ${f(uf.phiMn / Math.max(m.Mu, 1e-6), 2)} · δ_net = ${f(defl.deltaTotal, 1)} mm`, { size: 8.5, mono: true })}
    ${txt(648, tbY + 92, `Satuan SI: mm · mm² · MPa · kN · kN·m`, { size: 8.5, fill: "#64748b" })}
    ${stamp(938, tbY + 36, sls.isOverallSafe && uf.isAdequate && defl.liveOk, "DESAIN AMAN")}
    ${txt(938, tbY + 76, "LEMBAR DESAIN TERPADU", { size: 8.5, w: 700, fill: "#334155" })}
    ${txt(938, tbY + 92, "No. Lembar: DS-01", { size: 8.5, fill: "#64748b" })}
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="background:#ffffff">
    <defs>
      <marker id="dim" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
        <path d="M1,5 L5,1" stroke="#475569" stroke-width="0.9"/>
      </marker>
    </defs>
    <rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="none" stroke="#1f2937" stroke-width="2"/>
    <rect x="8" y="8" width="${W - 16}" height="${H - 16}" fill="none" stroke="#94a3b8" stroke-width="0.7"/>
    ${txt(W / 2, 30, "LEMBAR DESAIN TERPADU — GELAGAR BETON PRATEGANG PASCA-TARIK KOMPOSIT", { size: 13, w: 800, anchor: "middle", fill: "#1f2937" })}
    <line x1="280" y1="40" x2="280" y2="652" stroke="#e2e8f0" stroke-width="1"/>
    <line x1="858" y1="40" x2="858" y2="652" stroke="#e2e8f0" stroke-width="1"/>
    <line x1="8" y1="424" x2="858" y2="424" stroke="#e2e8f0" stroke-width="1"/>
    <line x1="8" y1="40" x2="${W - 8}" y2="40" stroke="#94a3b8" stroke-width="0.7"/>
    ${zoneA}
    ${zoneB}
    ${zoneC}
    ${zoneD}
    ${zoneF}
    ${titleBlock}
  </svg>`;
}
