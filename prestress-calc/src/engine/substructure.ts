/**
 * Bangunan Bawah (Substructure) — Reinforced-Concrete Design Engine
 * ================================================================
 * Wai-Fah Chen & Lian Duan, "Bridge Engineering: Substructure Design"
 * (book 104) + AASHTO LRFD Bridge Design Specifications §3 (loads),
 * §5 (concrete), §10 (foundations) + SUSPA / VSL ground-rock-anchor
 * data sheet (book 122) for tieback anchors.
 *
 * This is the ORDINARY reinforced-concrete (beton bertulang biasa)
 * companion to the prestressed superstructure engines: the loads that
 * the prestressed girders deliver to the bearings flow down through
 *   bent cap  →  pier column  →  footing / pile cap  →  soil / piles
 * and the abutment retains the approach embankment.
 *
 * CONVENTIONS (shared with the rest of the suite)
 *   • Dimensions mm, stresses MPa, forces kN, moments kN·m.
 *   • At section level convert to N, N·mm (×1000, ×1e6) then back.
 *   • Strain control (kontrol regangan): εcu = 0.003 at extreme
 *     compression fibre; εt = net tensile strain in extreme tension
 *     steel = εcu·(d_t − c)/c. Tension-controlled εt ≥ 0.005 → φ = 0.90;
 *     compression-controlled εt ≤ εty → φ = 0.65 (tied) / 0.75 (spiral);
 *     linear transition in between (ACI 318-19 §21.2 / AASHTO §5.5.4.2).
 *
 * Every result object is frozen and carries the intermediate values so
 * the report layer can print the mandatory 3-line format
 *   (1) rumus → (2) angka tersubstitusi → (3) hasil + satuan.
 */

// ════════════════════════════════════════════════════════════════
//  Shared helpers
// ════════════════════════════════════════════════════════════════

const ECU = 0.003;
const ES = 200_000; // mild-steel modulus, MPa

/** Whitney β₁ (ACI 318-19 §22.2.2.4.3 / AASHTO §5.6.2.2). */
export function beta1(fc: number): number {
  return fc <= 28 ? 0.85 : Math.max(0.65, 0.85 - 0.05 * ((fc - 28) / 7));
}

/** Concrete modulus E_c = 4700√f'c (MPa). */
export function Ec(fc: number): number {
  return 4700 * Math.sqrt(fc);
}

/**
 * φ from net tensile strain (strain-control ramp).
 * spiral=true → confined member (φ ranges 0.75→0.90).
 */
export function phiFromStrain(epsT: number, fy: number, spiral = false): {
  phi: number; epsTy: number; classification: "tarik" | "transisi" | "tekan";
} {
  const epsTy = fy / ES;
  const phiC = spiral ? 0.75 : 0.65;
  let phi: number;
  let classification: "tarik" | "transisi" | "tekan";
  if (epsT >= 0.005) { phi = 0.90; classification = "tarik"; }
  else if (epsT <= epsTy) { phi = phiC; classification = "tekan"; }
  else {
    phi = phiC + (0.90 - phiC) * (epsT - epsTy) / (0.005 - epsTy);
    classification = "transisi";
  }
  return { phi, epsTy, classification };
}

// ════════════════════════════════════════════════════════════════
//  1.  LOAD-COMBINATION GENERATOR  (AASHTO LRFD Table 3.4.1-1/2)
// ════════════════════════════════════════════════════════════════
/**
 * Each load source contributes an axial P (kN, +compression), a moment
 * M (kN·m) and a horizontal shear H (kN) at the design section (column
 * base / footing top). The generator factors them into the standard
 * limit-state combinations and returns the governing factored demand.
 */
export interface LoadSource {
  P: number;  // axial (kN)
  M: number;  // moment (kN·m)
  H: number;  // horizontal/shear (kN)
}
export interface LoadComboInputs {
  DC: LoadSource;   // structural dead (girders, cap, self)
  DW: LoadSource;   // wearing surface + utilities
  LL: LoadSource;   // live load incl. dynamic allowance IM + braking BR
  WS: LoadSource;   // wind on structure
  WL: LoadSource;   // wind on live load
  EH: LoadSource;   // horizontal earth pressure
  EV: LoadSource;   // vertical earth pressure
  ES: LoadSource;   // earth surcharge
  EQ: LoadSource;   // earthquake (extreme event)
  /** use minimum permanent-load factors (uplift / stability check) */
  minLoad?: boolean;
}
export interface Combo {
  readonly name: string;
  readonly Pu: number; readonly Mu: number; readonly Hu: number;
  readonly factors: string; // human-readable factor string for the report
}
export interface LoadComboResult {
  readonly combos: readonly Combo[];
  readonly govAxial: Combo;   // max |Pu|
  readonly govMoment: Combo;  // max |Mu|
  readonly govShear: Combo;   // max |Hu|
}

export function computeLoadCombos(i: LoadComboInputs): LoadComboResult {
  const dcP = i.minLoad ? 0.90 : 1.25;
  const dwP = i.minLoad ? 0.65 : 1.50;
  const ehP = i.minLoad ? 0.90 : 1.50; // active EH
  const evP = i.minLoad ? 1.00 : 1.35;
  const esP = i.minLoad ? 0.75 : 1.50;

  const lc = (
    name: string, factors: string,
    fDC: number, fDW: number, fLL: number, fWS: number, fWL: number,
    fEH: number, fEV: number, fES: number, fEQ: number,
  ): Combo => {
    const acc = (k: keyof LoadSource) =>
      fDC * i.DC[k] + fDW * i.DW[k] + fLL * i.LL[k] + fWS * i.WS[k] +
      fWL * i.WL[k] + fEH * i.EH[k] + fEV * i.EV[k] + fES * i.ES[k] +
      fEQ * i.EQ[k];
    return Object.freeze({ name, factors, Pu: acc("P"), Mu: acc("M"), Hu: acc("H") });
  };

  const combos: Combo[] = [
    lc("Strength I", `${dcP}DC+${dwP}DW+1.75(LL+IM+BR)+${ehP}EH+${evP}EV+${esP}ES`,
       dcP, dwP, 1.75, 0, 0, ehP, evP, esP, 0),
    lc("Strength III (angin)", `${dcP}DC+${dwP}DW+1.40WS+${ehP}EH+${evP}EV`,
       dcP, dwP, 0, 1.40, 0, ehP, evP, esP, 0),
    lc("Strength V (LL+angin)", `${dcP}DC+${dwP}DW+1.35LL+0.40WS+1.0WL`,
       dcP, dwP, 1.35, 0.40, 1.0, ehP, evP, esP, 0),
    lc("Service I", `1.0(DC+DW+LL)+0.3WS+1.0WL+1.0EH+1.0EV+1.0ES`,
       1.0, 1.0, 1.0, 0.30, 1.0, 1.0, 1.0, 1.0, 0),
    lc("Extreme I (gempa)", `${dcP}DC+${dwP}DW+0.5LL+1.0EQ`,
       dcP, dwP, 0.5, 0, 0, ehP, evP, esP, 1.0),
  ];

  const pick = (k: "Pu" | "Mu" | "Hu") =>
    combos.reduce((a, b) => (Math.abs(b[k]) > Math.abs(a[k]) ? b : a));

  return Object.freeze({
    combos,
    govAxial: pick("Pu"),
    govMoment: pick("Mu"),
    govShear: pick("Hu"),
  });
}

// ════════════════════════════════════════════════════════════════
//  2.  RC PIER COLUMN — P-M Interaction + slenderness magnification
// ════════════════════════════════════════════════════════════════
/**
 * Rectangular tied (or spiral) RC pier column. Symmetric reinforcement
 * is described by per-layer bars; the engine sweeps the neutral axis to
 * build the nominal P-M curve, applies the strain-control φ ramp and
 * checks the magnified factored demand (δ·M2). This is the "beton
 * bertulang biasa" counterpart of the prestressed column.ts engine.
 */
export interface RebarLayer {
  d: number;   // distance from extreme compression fibre (mm)
  As: number;  // total steel area in the layer (mm²)
}
export interface PierColumnInputs {
  b: number;   // width ⊥ bending (mm)
  h: number;   // depth ∥ bending (mm)
  fc: number;  // f'c (MPa)
  fy: number;  // f_y (MPa)
  layers: RebarLayer[];
  spiral: boolean;
  Pu: number;  // factored axial (kN, +compression)
  Mu: number;  // factored moment (kN·m) — already magnified, or raw
  // slenderness (optional)
  k?: number; Lu?: number; betaDns?: number; M1?: number; M2?: number; sway?: boolean;
}
export interface PMPt { readonly Pn: number; readonly Mn: number; readonly phi: number;
  readonly phiPn: number; readonly phiMn: number; readonly epsT: number; readonly label?: string; }
export interface PierColumnResult {
  readonly curve: readonly PMPt[];
  readonly Pn0: number;        // pure compression nominal
  readonly phiPnMax: number;   // capped axial 0.80·φ·Pn0 (tied) / 0.85 (spiral)
  readonly balanced: PMPt;
  readonly pureFlex: PMPt;
  readonly Ag: number; readonly Ast: number; readonly rho: number;
  readonly Pu: number; readonly Mu: number;
  readonly demandRatio: number; readonly isAdequate: boolean;
  readonly rhoOk: boolean;     // 0.01 ≤ ρ ≤ 0.08
  // slenderness
  readonly slender?: { ratio: number; required: boolean; Cm: number; Pc: number; delta: number; Mc: number };
}

function colPointAtC(c: number, b: number, h: number, fc: number, fy: number, layers: RebarLayer[]) {
  const b1 = beta1(fc);
  const a = Math.min(b1 * c, h);
  const ref = h / 2;
  let F = 0.85 * fc * b * a;          // N
  let M = F * (ref - a / 2);          // N·mm about centroid
  const dt = Math.max(...layers.map(l => l.d));
  for (const l of layers) {
    const eps = (c - l.d) / c * ECU;  // + = compression
    let fs = Math.max(-fy, Math.min(fy, eps * ES));
    // subtract displaced concrete where steel is in the compression block
    const inBlock = l.d <= a;
    const fnet = inBlock ? fs - 0.85 * fc : fs;
    const Fs = l.As * fnet;
    F += Fs; M += Fs * (ref - l.d);
  }
  const epsT = (dt - c) / c * ECU;    // + = tension in extreme steel
  return { Pn: F / 1000, Mn: Math.abs(M) / 1e6, epsT };
}

export function computePierColumn(inp: PierColumnInputs): PierColumnResult {
  const { b, h, fc, fy, layers, spiral, Pu, Mu } = inp;
  const Ag = b * h;
  const Ast = layers.reduce((s, l) => s + l.As, 0);
  const rho = Ast / Ag;
  const dt = Math.max(...layers.map(l => l.d));

  // Pure compression: Pn0 = 0.85f'c(Ag−Ast) + fy·Ast
  const Pn0 = (0.85 * fc * (Ag - Ast) + fy * Ast) / 1000;
  const phiAx = spiral ? 0.75 : 0.65;
  const capFactor = spiral ? 0.85 : 0.80;
  const phiPnMax = capFactor * phiAx * Pn0;

  // Sweep c → build curve
  const cBal = dt * ECU / (ECU + fy / ES);
  const cs = [h * 5, h * 2, h * 1.4, h, h * 0.85, cBal * 1.6, cBal * 1.25,
    cBal, cBal * 0.8, cBal * 0.6, cBal * 0.45, cBal * 0.3, cBal * 0.18];
  const mk = (c: number, label?: string): PMPt => {
    const p = colPointAtC(c, b, h, fc, fy, layers);
    const { phi } = phiFromStrain(p.epsT, fy, spiral);
    const phiPnRaw = phi * p.Pn;
    return Object.freeze({
      Pn: p.Pn, Mn: p.Mn, phi, epsT: p.epsT,
      phiPn: Math.min(phiPnRaw, phiPnMax), phiMn: phi * p.Mn, label,
    });
  };
  const curve: PMPt[] = [
    Object.freeze({ Pn: Pn0, Mn: 0, phi: phiAx, epsT: -fy / ES, phiPn: phiPnMax, phiMn: 0, label: "P₀ (tekan murni)" }),
    ...cs.map(c => mk(c)),
  ];
  const balanced = mk(cBal, "Titik imbang");

  // pure flexure: bisection for Pn ≈ 0
  let lo = 0.1, hi = cBal;
  for (let n = 0; n < 40; n++) {
    const cm = (lo + hi) / 2;
    if (colPointAtC(cm, b, h, fc, fy, layers).Pn > 0) hi = cm; else lo = cm;
  }
  const pureFlex = mk((lo + hi) / 2, "Lentur murni");
  curve.push(balanced, pureFlex);
  curve.sort((a, c) => c.Pn - a.Pn);

  // demand ratio along radial direction in (φPn, φMn)
  const dr = radialDemandRatio(Pu, Mu, curve.map(p => ({ x: p.phiPn, y: p.phiMn })));

  // slenderness magnification (optional)
  let slender: PierColumnResult["slender"];
  if (inp.k && inp.Lu) {
    const Ig = b * h ** 3 / 12;
    const r = h / Math.sqrt(12);
    const EI = 0.4 * Ec(fc) * Ig / (1 + (inp.betaDns ?? 0.6));
    const Pc = Math.PI ** 2 * EI / (inp.k * inp.Lu) ** 2 / 1000;
    const ratio = inp.k * inp.Lu / r;
    const M1 = inp.M1 ?? 0, M2 = inp.M2 ?? Mu;
    const Cm = inp.sway ? 1.0 : Math.max(0.4, 0.6 + 0.4 * (M1 / (M2 || 1)));
    const delta = Math.max(1.0, Cm / (1 - Pu / (0.75 * Pc)));
    slender = { ratio, required: ratio > 22, Cm, Pc, delta, Mc: delta * Math.abs(M2) };
  }

  return Object.freeze({
    curve, Pn0, phiPnMax, balanced, pureFlex,
    Ag, Ast, rho, Pu, Mu,
    demandRatio: dr, isAdequate: dr <= 1.0 && Pu <= phiPnMax,
    rhoOk: rho >= 0.01 && rho <= 0.08,
    slender,
  });
}

/** ratio |demand|/|capacity| along the ray from the origin through (x0,y0). */
function radialDemandRatio(x0: number, y0: number, poly: { x: number; y: number }[]): number {
  if (poly.length < 2) return 1.5;
  const ang = Math.atan2(y0, x0);
  const rdem = Math.hypot(x0, y0);
  let best = Infinity;
  for (let i = 0; i < poly.length - 1; i++) {
    const A = poly[i], B = poly[i + 1];
    const dx = B.x - A.x, dy = B.y - A.y;
    const denom = Math.cos(ang) * dy - Math.sin(ang) * dx;
    if (Math.abs(denom) < 1e-9) continue;
    const t = (Math.cos(ang) * A.y - Math.sin(ang) * A.x) / denom;
    if (t < -1e-6 || t > 1 + 1e-6) continue;
    const xc = A.x + t * dx, yc = A.y + t * dy;
    const rcap = Math.hypot(xc, yc);
    if (rcap > 1e-6) best = Math.min(best, rdem / rcap);
  }
  return isFinite(best) ? best : 1.5;
}

// ════════════════════════════════════════════════════════════════
//  3.  RC BENT / PIER CAP — flexure + one-way shear
// ════════════════════════════════════════════════════════════════
export interface BentCapInputs {
  b: number; h: number; d: number;   // section + effective depth (mm)
  fc: number; fy: number;
  Mu: number;   // factored design moment (kN·m)
  Vu: number;   // factored design shear (kN)
  Av: number;   // stirrup area per set (mm²)
  s: number;    // stirrup spacing (mm)
}
export interface BentCapResult {
  readonly AsReq: number; readonly AsMin: number; readonly a: number; readonly c: number;
  readonly epsT: number; readonly phiF: number; readonly phiMn: number; readonly flexOk: boolean;
  readonly Vc: number; readonly Vs: number; readonly phiVn: number; readonly phiV: number;
  readonly shearOk: boolean; readonly sMax: number; readonly needsStirrups: boolean;
}
export function computeBentCap(i: BentCapInputs): BentCapResult {
  const { b, h, d, fc, fy, Mu, Vu, Av, s } = i;
  const Mn_req = Mu * 1e6 / 0.90; // start with φ=0.9 estimate
  // As from quadratic: Mn = As·fy·(d − a/2), a = As·fy/(0.85f'c·b)
  const Rn = Mn_req / (b * d * d);
  const m = fy / (0.85 * fc);
  const rho = (1 / m) * (1 - Math.sqrt(Math.max(0, 1 - 2 * m * Rn / fy)));
  let AsReq = rho * b * d;
  const AsMin = Math.max(0.25 * Math.sqrt(fc) / fy * b * d, 1.4 / fy * b * d);
  AsReq = Math.max(AsReq, AsMin);
  const a = AsReq * fy / (0.85 * fc * b);
  const c = a / beta1(fc);
  const epsT = (d - c) / c * ECU;
  const { phi: phiF } = phiFromStrain(epsT, fy);
  const phiMn = phiF * AsReq * fy * (d - a / 2) / 1e6;

  // one-way shear (AASHTO simplified β=2 → Vc = 0.166√f'c·b·d N)
  const Vc = 0.166 * Math.sqrt(fc) * b * d / 1000; // kN
  const Vs = Av > 0 && s > 0 ? Av * fy * d / s / 1000 : 0;
  const phiV = 0.90;
  const phiVn = phiV * (Vc + Vs);
  const VsMax = 0.66 * Math.sqrt(fc) * b * d / 1000;
  const sMax = Vs <= 0.33 * Math.sqrt(fc) * b * d / 1000 ? Math.min(0.5 * d, 600) : Math.min(0.25 * d, 300);

  return Object.freeze({
    AsReq, AsMin, a, c, epsT, phiF, phiMn, flexOk: phiMn >= Mu,
    Vc, Vs: Math.min(Vs, VsMax), phiVn, phiV,
    shearOk: phiVn >= Vu, sMax, needsStirrups: Vu > 0.5 * phiV * Vc,
  });
}

// ════════════════════════════════════════════════════════════════
//  4.  SPREAD FOOTING (telapak) — bearing, punching, one-way, flexure
// ════════════════════════════════════════════════════════════════
export interface SpreadFootingInputs {
  B: number; L: number; t: number;   // plan B×L, thickness t (mm)
  d: number;                          // effective depth (mm)
  cx: number; cy: number;            // column footprint (mm)
  fc: number; fy: number;
  P: number;   // service axial at footing top (kN)
  M: number;   // service moment about L-axis (kN·m)
  Pu: number;  // factored axial (kN)
  Mu: number;  // factored moment (kN·m)
  qAllow: number; // allowable soil bearing (kPa)
  gammaC?: number; // concrete unit weight (kN/m³)
}
export interface SpreadFootingResult {
  readonly e: number; readonly ekern: number; readonly bearingMode: "full" | "partial";
  readonly qMax: number; readonly qMin: number; readonly bearingOk: boolean;
  readonly quNet: number;
  // two-way (punching)
  readonly b0: number; readonly vu2: number; readonly phiVc2: number; readonly punchOk: boolean;
  // one-way (beam) shear
  readonly vu1: number; readonly phiVc1: number; readonly onewayOk: boolean;
  // flexure at column face
  readonly Mu_face: number; readonly AsReq: number; readonly AsMin: number; readonly flexOk: boolean;
  readonly epsT: number; readonly phiMn: number;
}
export function computeSpreadFooting(i: SpreadFootingInputs): SpreadFootingResult {
  const { B, L, t, d, cx, cy, fc, fy, P, M, Pu, Mu, qAllow } = i;
  const gC = i.gammaC ?? 24;
  const A = (B / 1000) * (L / 1000);       // m²
  const Sx = (B / 1000) * (L / 1000) ** 2 / 6; // m³ (moment about axis ∥ B, ecc along L)
  const Wftg = A * (t / 1000) * gC;        // kN self-weight
  const Ptot = P + Wftg;
  const e = M / Ptot * 1000;               // mm
  const ekern = L / 6;
  const partial = Math.abs(e) > ekern;
  let qMax: number, qMin: number;
  if (!partial) {
    qMax = Ptot / A + M / Sx;
    qMin = Ptot / A - M / Sx;
  } else {
    // resultant outside kern → triangular bearing, length 3·(L/2−e)
    const aLen = 3 * (L / 2 - Math.abs(e) / 1) / 1000; // m (e already mm→ /1000)
    const aLenM = 3 * (L / 2000 - Math.abs(e) / 1000);
    qMax = 2 * Ptot / ((B / 1000) * Math.max(aLenM, 1e-6));
    qMin = 0;
    void aLen;
  }
  const bearingOk = qMax <= qAllow;

  // factored net upward pressure for structural design (uniform approx on factored P)
  const quNet = Pu / A; // kPa (neglect self-wt for upward design pressure)

  // two-way punching at d/2 around column
  const b0 = 2 * (cx + d) + 2 * (cy + d); // mm
  const dEff = d;
  const critArea = (cx + d) * (cy + d) / 1e6; // m²
  const Vu2 = Pu - quNet * critArea;       // kN
  const betaC = Math.max(cx, cy) / Math.min(cx, cy);
  const vc2 = Math.min(
    0.33 * Math.sqrt(fc),
    0.17 * (1 + 2 / betaC) * Math.sqrt(fc),
    0.083 * (2 + 40 * dEff / b0) * Math.sqrt(fc),
  ); // MPa
  const phiVc2 = 0.75 * vc2 * b0 * dEff / 1000; // kN
  const vu2 = Vu2;
  const punchOk = phiVc2 >= Vu2;

  // one-way shear at distance d from column face (along L)
  const xCrit = (L - cy) / 2 - d; // mm from edge of footing to crit section... distance of cantilever beyond crit
  const cantBeyond = Math.max(0, (L - cy) / 2 - d) / 1000; // m
  const Vu1 = quNet * (B / 1000) * cantBeyond; // kN
  const phiVc1 = 0.75 * 0.166 * Math.sqrt(fc) * B * d / 1000;
  const onewayOk = phiVc1 >= Vu1;
  void xCrit;

  // flexure at column face (cantilever)
  const cant = (L - cy) / 2000; // m
  const Mu_face = quNet * (B / 1000) * cant * cant / 2; // kN·m
  const Rn = Mu_face * 1e6 / 0.90 / (B * d * d);
  const m2 = fy / (0.85 * fc);
  const rho = (1 / m2) * (1 - Math.sqrt(Math.max(0, 1 - 2 * m2 * Rn / fy)));
  let AsReq = rho * B * d;
  const AsMin = 0.0018 * B * t; // shrinkage/temperature minimum for footings
  AsReq = Math.max(AsReq, AsMin);
  const a = AsReq * fy / (0.85 * fc * B);
  const c = a / beta1(fc);
  const epsT = (d - c) / c * ECU;
  const { phi } = phiFromStrain(epsT, fy);
  const phiMn = phi * AsReq * fy * (d - a / 2) / 1e6;

  return Object.freeze({
    e, ekern, bearingMode: partial ? "partial" : "full",
    qMax, qMin, bearingOk, quNet,
    b0, vu2, phiVc2, punchOk,
    vu1: Vu1, phiVc1, onewayOk,
    Mu_face, AsReq, AsMin, flexOk: phiMn >= Mu_face, epsT, phiMn,
  });
}

// ════════════════════════════════════════════════════════════════
//  5.  PILE CAP / PILE GROUP — rigid-cap reaction distribution
// ════════════════════════════════════════════════════════════════
export interface PileGroupInputs {
  /** pile coordinates from cap centroid (mm): x along bending axis */
  piles: { x: number; y: number }[];
  P: number;   // service axial (kN)
  Mx: number;  // service moment about y-axis → distributes on x (kN·m)
  Pu: number;  // factored axial (kN)
  Mux: number; // factored moment (kN·m)
  pileCap: number; // single-pile allowable capacity (kN)
  // group efficiency (Converse-Labarre)
  rows?: number; cols?: number; spacing?: number; diameter?: number;
}
export interface PileGroupResult {
  readonly n: number; readonly Sxx: number;
  readonly reactions: readonly { x: number; y: number; R: number; Ru: number }[];
  readonly Rmax: number; readonly Rmin: number; readonly tension: boolean;
  readonly capacityOk: boolean;
  readonly efficiency?: number; readonly groupCapacity?: number;
}
export function computePileGroup(i: PileGroupInputs): PileGroupResult {
  const n = i.piles.length;
  const Sxx = i.piles.reduce((s, p) => s + p.x * p.x, 0); // mm²·count
  const react = (P: number, M: number) => i.piles.map(p => ({
    x: p.x, y: p.y,
    R: P / n + (Sxx > 0 ? (M * 1e6) * p.x / Sxx / 1000 : 0), // kN
  }));
  const serv = react(i.P, i.Mx);
  const fact = react(i.Pu, i.Mux);
  const reactions = serv.map((s, k) => ({ x: s.x, y: s.y, R: s.R, Ru: fact[k].R }));
  const Rmax = Math.max(...serv.map(r => r.R));
  const Rmin = Math.min(...serv.map(r => r.R));

  let efficiency: number | undefined, groupCapacity: number | undefined;
  if (i.rows && i.cols && i.spacing && i.diameter) {
    const theta = Math.atan(i.diameter / i.spacing) * 180 / Math.PI;
    const m = i.rows, nn = i.cols;
    efficiency = 1 - theta / 90 * ((nn - 1) * m + (m - 1) * nn) / (m * nn);
    groupCapacity = efficiency * n * i.pileCap;
  }

  return Object.freeze({
    n, Sxx, reactions, Rmax, Rmin, tension: Rmin < 0,
    capacityOk: Rmax <= i.pileCap && Rmin >= -0.0,
    efficiency, groupCapacity,
  });
}

// ════════════════════════════════════════════════════════════════
//  6.  ABUTMENT STABILITY (kepala jembatan) — Rankine + RC stem
// ════════════════════════════════════════════════════════════════
export interface AbutmentInputs {
  H: number;       // total retained height (mm)
  stemT: number;   // stem thickness at base (mm)
  baseB: number;   // footing width (toe→heel) (mm)
  toe: number;     // toe length (mm)
  heel: number;    // heel length (mm)
  baseT: number;   // footing thickness (mm)
  gammaSoil: number; // backfill unit weight (kN/m³)
  phiSoil: number;   // friction angle (deg)
  gammaC: number;    // concrete unit weight (kN/m³)
  surcharge: number; // uniform surcharge (kPa)
  Vbearing: number;  // superstructure vertical reaction on abutment (kN/m)
  muBase: number;    // base friction coefficient
  qAllow: number;    // allowable bearing (kPa)
  fc: number; fy: number; dStem: number; // for stem RC design
}
export interface AbutmentResult {
  readonly Ka: number; readonly Pa: number; readonly Psur: number; readonly Htot: number;
  readonly W: number;          // total resisting vertical (kN/m)
  readonly Mr: number; readonly Mo: number; readonly FSot: number; readonly otOk: boolean;
  readonly FSsl: number; readonly slOk: boolean;
  readonly eBase: number; readonly qMax: number; readonly qMin: number; readonly bearingOk: boolean;
  // stem RC at base
  readonly MuStem: number; readonly AsStem: number; readonly epsT: number; readonly phiMn: number; readonly stemOk: boolean;
}
export function computeAbutment(i: AbutmentInputs): AbutmentResult {
  const H = i.H / 1000;            // m
  const Ka = Math.tan((45 - i.phiSoil / 2) * Math.PI / 180) ** 2;
  const Pa = 0.5 * Ka * i.gammaSoil * H * H;        // kN/m (acts H/3)
  const Psur = Ka * i.surcharge * H;                // kN/m (acts H/2)
  const Htot = Pa + Psur;

  // resisting weights (per metre run) about toe
  const toe = i.toe / 1000, heel = i.heel / 1000, baseB = i.baseB / 1000;
  const stemT = i.stemT / 1000, baseT = i.baseT / 1000, stemH = H - baseT;
  const Wstem = stemT * stemH * i.gammaC;
  const Wbase = baseB * baseT * i.gammaC;
  const Wsoil = heel * stemH * i.gammaSoil;         // soil over heel
  const Wsur = heel * i.surcharge;                  // surcharge over heel
  const Wsup = i.Vbearing;                          // superstructure reaction (at stem centre)
  const W = Wstem + Wbase + Wsoil + Wsur + Wsup;

  // moment arms about toe
  const xStem = toe + stemT / 2;
  const xBase = baseB / 2;
  const xSoil = toe + stemT + heel / 2;
  const Mr = Wstem * xStem + Wbase * xBase + (Wsoil + Wsur) * xSoil + Wsup * xStem;
  const Mo = Pa * (H / 3) + Psur * (H / 2);
  const FSot = Mr / Mo;
  const FSsl = i.muBase * W / Htot;

  // bearing pressure under base
  const xR = (Mr - Mo) / W;       // location of resultant from toe (m)
  const eBase = baseB / 2 - xR;   // eccentricity from base centre (m)
  const q0 = W / baseB;
  const within = Math.abs(eBase) <= baseB / 6;
  const qMax = within ? q0 * (1 + 6 * eBase / baseB) : 2 * W / (3 * (baseB / 2 - Math.abs(eBase)));
  const qMin = within ? q0 * (1 - 6 * eBase / baseB) : 0;

  // stem RC at base (cantilever): Mu from factored lateral pressure (1.5 EH + 1.5 ES)
  const PaStem = 0.5 * Ka * i.gammaSoil * stemH * stemH;
  const PsurStem = Ka * i.surcharge * stemH;
  const MuStem = (1.5 * PaStem * (stemH / 3) + 1.5 * PsurStem * (stemH / 2)); // kN·m/m
  const bw = 1000; // per metre
  const Rn = MuStem * 1e6 / 0.90 / (bw * i.dStem * i.dStem);
  const m = i.fy / (0.85 * i.fc);
  const rho = (1 / m) * (1 - Math.sqrt(Math.max(0, 1 - 2 * m * Rn / i.fy)));
  let AsStem = rho * bw * i.dStem;
  const AsMin = Math.max(0.25 * Math.sqrt(i.fc) / i.fy * bw * i.dStem, 0.0018 * bw * i.stemT);
  AsStem = Math.max(AsStem, AsMin);
  const a = AsStem * i.fy / (0.85 * i.fc * bw);
  const c = a / beta1(i.fc);
  const epsT = (i.dStem - c) / c * ECU;
  const { phi } = phiFromStrain(epsT, i.fy);
  const phiMn = phi * AsStem * i.fy * (i.dStem - a / 2) / 1e6;

  return Object.freeze({
    Ka, Pa, Psur, Htot, W, Mr, Mo,
    FSot, otOk: FSot >= 2.0, FSsl, slOk: FSsl >= 1.5,
    eBase: eBase * 1000, qMax, qMin, bearingOk: qMax <= i.qAllow,
    MuStem, AsStem, epsT, phiMn, stemOk: phiMn >= MuStem,
  });
}

// ════════════════════════════════════════════════════════════════
//  7.  GROUND / ROCK ANCHOR (tieback) — SUSPA/VSL (book 122)
// ════════════════════════════════════════════════════════════════
/**
 * Permanent ground / rock anchor: a multi-strand tendon grouted into a
 * borehole. Three capacities must each exceed the design load:
 *   (a) tendon (steel) :  T_steel = 0.6·f_pu·A_ps  (service lock-off cap)
 *   (b) grout–ground bond over the bond length L_b:
 *         T_bond = π·d_hole·L_b·τ_ult / FS
 *   (c) grout–tendon bond (rarely governs for strands).
 * Free (unbonded) length keeps the anchor elastic for re-stressing.
 */
export interface GroundAnchorInputs {
  Tdesign: number;  // design anchor force (kN)
  nStrand: number;  // strands per anchor
  Aps: number;      // area per strand (mm²)
  fpu: number;      // strand UTS (MPa)
  dHole: number;    // drilled-hole / bond diameter (mm)
  Lbond: number;    // bond length (mm)
  tauUlt: number;   // ultimate grout-ground bond stress (kPa)
  Lfree: number;    // free length (mm)
  inclination: number; // anchor inclination from horizontal (deg)
  FSbond?: number;  // bond factor of safety (≥ 2.0 permanent)
}
export interface GroundAnchorResult {
  readonly Tsteel: number; readonly steelOk: boolean;
  readonly Tbond: number; readonly bondOk: boolean; readonly FSbond: number;
  readonly LbondReq: number;
  readonly Tlockoff: number; readonly Telong: number; // elastic elongation at free length
  readonly Hcomp: number; readonly Vcomp: number;     // horizontal/vertical components
  readonly verdict: boolean;
}
export function computeGroundAnchor(i: GroundAnchorInputs): GroundAnchorResult {
  const Aps = i.nStrand * i.Aps;
  const Tsteel = 0.6 * i.fpu * Aps / 1000;               // kN (lock-off ≤ 0.6 f_pu)
  const FS = i.FSbond ?? 2.0;
  const Tbond = Math.PI * (i.dHole / 1000) * (i.Lbond / 1000) * i.tauUlt / FS; // kN
  const LbondReq = i.Tdesign * FS / (Math.PI * (i.dHole / 1000) * i.tauUlt) * 1000; // mm
  const Tlockoff = 0.7 * i.Tdesign;                      // typical 70% lock-off
  const Es = 195_000;
  const Telong = i.Tdesign * 1000 * i.Lfree / (Aps * Es); // mm elastic stretch
  const rad = i.inclination * Math.PI / 180;
  return Object.freeze({
    Tsteel, steelOk: Tsteel >= i.Tdesign,
    Tbond, bondOk: Tbond >= i.Tdesign, FSbond: FS, LbondReq,
    Tlockoff, Telong,
    Hcomp: i.Tdesign * Math.cos(rad), Vcomp: i.Tdesign * Math.sin(rad),
    verdict: Tsteel >= i.Tdesign && Tbond >= i.Tdesign,
  });
}
