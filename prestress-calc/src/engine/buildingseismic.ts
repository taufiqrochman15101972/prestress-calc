/**
 * buildingseismic.ts — BUILDING seismic design, Equivalent Lateral Force (ELF)
 * procedure per ASCE 7-16 / NEHRP (FEMA P-750, FEMA 451) §11.4 + §12.8, with a
 * parallel EUROCODE 8 (EN 1998-1) lateral-force path for cross-comparison.
 *
 * Sources behind the GM (1)…GM (256) earthquake-engineering library:
 *   - FEMA 451 / FEMA P-750 NEHRP Recommended Provisions + Design Examples
 *   - ASCE/SEI 7-10 & 7-16 Minimum Design Loads (§11–12)
 *   - IBC 2012/2015 §1613 (adopts ASCE 7)
 *   - EN 1998-1:2004 Eurocode 8 §3.2 (design spectrum) + §4.3.3.2 (lateral force)
 *   - SNI 1726 (Indonesian; mirrors ASCE 7 ELF) — same equations, SI site factors
 *
 * DISTINCT from the bridge seismic modules:
 *   - seismic.ts          : PCI BDM single-mode uniform-load (bridge superstructure)
 *   - sni2833seismic.ts   : SNI 2833 bridge response spectrum
 *   - seismicdynamics.ts  : SDOF/2-DOF modal, pier capacity design, liquefaction
 *   - baseisolation.ts    : isolator displacement & shear reduction
 * Here the subject is a multi-storey BUILDING: design spectrum → base shear V =
 * Cs·W → vertical force distribution Fx → storey drift & P-Δ stability θ.
 *
 * Per project rule: textbook/design-example PDF NUMBERS are not code references —
 * only the chapter order & procedure. The closed-form CODE EQUATIONS below are the
 * verification target (see tests/buildingseismic.test.ts).
 *
 * Units (SI): force kN · length m · period s · spectral acceleration g · mass via W/g.
 * Pure functions → Object.freeze().
 */

export type SiteClassASCE = "A" | "B" | "C" | "D" | "E";

/** Lateral-force-resisting system → approximate-period coefficients (ASCE 7-16
 * Table 12.8-2, SI form: Ta = Ct·hn^x with hn in metres). */
export type StructuralSystem =
  | "steel_mrf"      // steel moment-resisting frame   Ct=0.0724 x=0.8
  | "concrete_mrf"   // concrete moment-resisting frame Ct=0.0466 x=0.9
  | "steel_ebf"      // eccentrically braced frame      Ct=0.0731 x=0.75
  | "other";         // all other structural systems    Ct=0.0488 x=0.75

const SYS_CT: Record<StructuralSystem, { Ct: number; x: number }> = {
  steel_mrf:    { Ct: 0.0724, x: 0.8 },
  concrete_mrf: { Ct: 0.0466, x: 0.9 },
  steel_ebf:    { Ct: 0.0731, x: 0.75 },
  other:        { Ct: 0.0488, x: 0.75 },
};

/** Site coefficient Fa vs Ss (ASCE 7-16 Table 11.4-1) — interpolated bands. */
function siteFa(site: SiteClassASCE, Ss: number): number {
  const t: Record<SiteClassASCE, [number, number][]> = {
    A: [[0.25, 0.8], [1.5, 0.8]],
    B: [[0.25, 0.9], [1.5, 0.9]],
    C: [[0.25, 1.3], [0.5, 1.3], [0.75, 1.2], [1.0, 1.2], [1.25, 1.2], [1.5, 1.2]],
    D: [[0.25, 1.6], [0.5, 1.4], [0.75, 1.2], [1.0, 1.1], [1.25, 1.0], [1.5, 1.0]],
    E: [[0.25, 2.4], [0.5, 1.7], [0.75, 1.3], [1.0, 1.1], [1.25, 0.9], [1.5, 0.8]],
  };
  return interp(t[site], Ss);
}

/** Site coefficient Fv vs S1 (ASCE 7-16 Table 11.4-2) — interpolated bands. */
function siteFv(site: SiteClassASCE, S1: number): number {
  const t: Record<SiteClassASCE, [number, number][]> = {
    A: [[0.1, 0.8], [0.6, 0.8]],
    B: [[0.1, 0.8], [0.6, 0.8]],
    C: [[0.1, 1.5], [0.2, 1.5], [0.3, 1.5], [0.4, 1.5], [0.5, 1.5], [0.6, 1.4]],
    D: [[0.1, 2.4], [0.2, 2.2], [0.3, 2.0], [0.4, 1.9], [0.5, 1.8], [0.6, 1.7]],
    E: [[0.1, 4.2], [0.2, 3.3], [0.3, 2.8], [0.4, 2.4], [0.5, 2.2], [0.6, 2.0]],
  };
  return interp(t[site], S1);
}

/** Piecewise-linear interpolation on a sorted [x,y] table, clamped at the ends. */
function interp(tbl: [number, number][], v: number): number {
  if (v <= tbl[0][0]) return tbl[0][1];
  const last = tbl[tbl.length - 1];
  if (v >= last[0]) return last[1];
  for (let k = 1; k < tbl.length; k++) {
    if (v <= tbl[k][0]) {
      const [x0, y0] = tbl[k - 1], [x1, y1] = tbl[k];
      return y0 + (y1 - y0) * (v - x0) / (x1 - x0);
    }
  }
  return last[1];
}

/** One storey of the building (numbered from base up). */
export interface Storey {
  /** seismic weight at level x, kN */
  w: number;
  /** height of level x above the base, m */
  h: number;
  /** elastic storey drift δ_xe at level x from the analysis (m); optional */
  deltaXe?: number;
}

export interface BuildingSeismicInputs {
  /** mapped MCE_R short-period spectral accel S_s (g) */
  Ss: number;
  /** mapped MCE_R 1-second spectral accel S_1 (g) */
  S1: number;
  site: SiteClassASCE;
  /** long-period transition period T_L (s), ASCE 7-16 Fig 22-14..17 */
  TL: number;
  /** response-modification coefficient R (Table 12.2-1) */
  R: number;
  /** deflection-amplification factor C_d (Table 12.2-1) */
  Cd: number;
  /** overstrength factor Ω_0 (Table 12.2-1) */
  Omega0: number;
  /** importance factor I_e (Table 1.5-2: 1.0/1.25/1.5) */
  Ie: number;
  /** lateral system → approximate period coefficients */
  system: StructuralSystem;
  /** period upper-limit coefficient C_u (Table 12.8-1, by SD1; default 1.4) */
  Cu?: number;
  /** allowable drift ratio Δa/hsx (Table 12.12-1; default 0.020) */
  driftLimit?: number;
  /** redundancy factor ρ (1.0 or 1.3) */
  rho?: number;
  /** storeys, base→top */
  storeys: Storey[];
}

export interface BuildingSeismicResult {
  readonly Fa: number; readonly Fv: number;
  readonly SMS: number; readonly SM1: number;
  readonly SDS: number; readonly SD1: number;
  readonly T0: number; readonly TS: number;
  /** seismic design category A–F (governing of SDS- and SD1-based) */
  readonly SDC: string;
  /** approximate fundamental period T_a (s) */
  readonly Ta: number;
  /** code period used T = min(T_computed, Cu·Ta) — here T_a governs (no model) */
  readonly T: number;
  /** spectral acceleration S_a(T) on the design spectrum (g) */
  readonly SaT: number;
  /** seismic response coefficient C_s (governing) */
  readonly Cs: number;
  readonly CsMax: number; readonly CsMin: number;
  /** total seismic weight W, kN */
  readonly W: number;
  /** seismic base shear V = Cs·W, kN */
  readonly V: number;
  /** vertical-distribution exponent k */
  readonly k: number;
  /** per-storey lateral force F_x, storey shear V_x, drift & P-Δ */
  readonly storeys: ReadonlyArray<{
    readonly h: number; readonly w: number;
    readonly Cvx: number; readonly Fx: number; readonly Vx: number;
    readonly delta: number;        // amplified deflection δx = Cd·δxe/Ie, m
    readonly drift: number;        // storey drift Δ, m
    readonly driftRatio: number;   // Δ / hsx
    readonly driftOK: boolean;
    readonly theta: number;        // P-Δ stability coefficient
    readonly thetaMax: number;
    readonly thetaOK: boolean;
  }>;
  /** design design-spectrum samples for plotting */
  readonly spectrum: ReadonlyArray<{ T: number; Sa: number }>;
}

/** ASCE 7-16 design response spectrum S_a(T) in g (§11.4.5). */
export function designSpectrumASCE(
  SDS: number, SD1: number, T0: number, TS: number, TL: number, T: number,
): number {
  if (T < T0) return SDS * (0.4 + 0.6 * T / T0);
  if (T <= TS) return SDS;
  if (T <= TL) return SD1 / T;
  return SD1 * TL / (T * T);
}

/** Seismic Design Category from SDS or SD1 (ASCE 7-16 Tables 11.6-1/2, Risk Cat II). */
function sdcFromValue(v: number, isShort: boolean): string {
  if (isShort) {
    if (v < 0.167) return "A";
    if (v < 0.33) return "B";
    if (v < 0.50) return "C";
    return "D";
  }
  if (v < 0.067) return "A";
  if (v < 0.133) return "B";
  if (v < 0.20) return "C";
  return "D";
}

export function computeBuildingSeismic(i: BuildingSeismicInputs): BuildingSeismicResult {
  const g = 9.81;
  const Cu = i.Cu ?? 1.4;
  const driftLimit = i.driftLimit ?? 0.020;
  const rho = i.rho ?? 1.0;

  // §11.4.3–11.4.4 — site-modified MCE_R and design spectral accelerations.
  const Fa = siteFa(i.site, i.Ss);
  const Fv = siteFv(i.site, i.S1);
  const SMS = Fa * i.Ss;
  const SM1 = Fv * i.S1;
  const SDS = (2 / 3) * SMS;
  const SD1 = (2 / 3) * SM1;
  const T0 = 0.2 * SD1 / SDS;
  const TS = SD1 / SDS;

  // §11.6 — Seismic Design Category (more severe of the two).
  const sdcS = sdcFromValue(SDS, true);
  const sdcL = sdcFromValue(SD1, false);
  const SDC = sdcS > sdcL ? sdcS : sdcL;

  // §12.8.2.1 — approximate fundamental period; with no computed model, T = Ta.
  const hn = i.storeys.reduce((m, s) => Math.max(m, s.h), 0);
  const { Ct, x } = SYS_CT[i.system];
  const Ta = Ct * Math.pow(hn, x);
  const T = Math.min(Ta * Cu, Ta) === Ta ? Ta : Ta; // T_used = Ta (model period unknown)

  // §12.8 — seismic response coefficient C_s.
  const RIe = i.R / i.Ie;
  const SaT = designSpectrumASCE(SDS, SD1, T0, TS, i.TL, T);
  const CsBase = SDS / RIe;
  const CsMax = T <= i.TL ? SD1 / (T * RIe) : SD1 * i.TL / (T * T * RIe);
  let CsMin = Math.max(0.044 * SDS * i.Ie, 0.01);
  if (i.S1 >= 0.6) CsMin = Math.max(CsMin, 0.5 * i.S1 / RIe);
  const Cs = Math.max(Math.min(CsBase, CsMax), CsMin);

  const W = i.storeys.reduce((s, st) => s + st.w, 0);
  const V = Cs * W;

  // §12.8.3 — vertical distribution exponent k.
  const k = T <= 0.5 ? 1 : T >= 2.5 ? 2 : 1 + (T - 0.5) / 2.0;

  const whk = i.storeys.map(s => s.w * Math.pow(s.h, k));
  const sumWhk = whk.reduce((a, b) => a + b, 0);

  // Storey forces (Fx), shears (Vx = Σ of forces at-or-above), drift & P-Δ.
  const n = i.storeys.length;
  const Fx = i.storeys.map((_, idx) => (whk[idx] / sumWhk) * V);
  const storeys = i.storeys.map((s, idx) => {
    const Cvx = whk[idx] / sumWhk;
    const force = Fx[idx];
    // storey shear above level x = sum of all forces at level idx..top
    let Vx = 0;
    for (let j = idx; j < n; j++) Vx += Fx[j];
    // §12.8.6 amplified deflection δx = Cd·δxe/Ie.
    const delta = s.deltaXe != null ? i.Cd * s.deltaXe / i.Ie : 0;
    const deltaBelow = idx > 0 && i.storeys[idx - 1].deltaXe != null
      ? i.Cd * (i.storeys[idx - 1].deltaXe as number) / i.Ie : 0;
    const drift = delta - deltaBelow;
    const hsx = idx > 0 ? s.h - i.storeys[idx - 1].h : s.h;
    const driftRatio = hsx > 0 ? drift / hsx : 0;
    const driftOK = driftRatio <= driftLimit;
    // §12.8.7 P-Δ stability coefficient θ = Px·Δ·Ie/(Vx·hsx·Cd).
    let Px = 0; for (let j = idx; j < n; j++) Px += i.storeys[j].w;
    const theta = Vx > 0 && hsx > 0 ? (Px * drift * i.Ie) / (Vx * hsx * i.Cd) : 0;
    const thetaMax = Math.min(0.5 / (1.0 * i.Cd), 0.25);
    return Object.freeze({
      h: s.h, w: s.w, Cvx, Fx: force, Vx,
      delta, drift, driftRatio, driftOK,
      theta, thetaMax, thetaOK: theta <= thetaMax,
    });
  });

  const spectrum: { T: number; Sa: number }[] = [];
  for (let t = 0; t <= 4.001; t += 0.1) {
    spectrum.push({
      T: +t.toFixed(2),
      Sa: +designSpectrumASCE(SDS, SD1, T0, TS, i.TL, Math.max(t, 1e-6)).toFixed(4),
    });
  }

  void rho; // ρ enters load combinations (E = ρ·QE ± 0.2·SDS·D); exposed via Omega0/rho elsewhere
  return Object.freeze({
    Fa, Fv, SMS, SM1, SDS, SD1, T0, TS, SDC, Ta, T, SaT,
    Cs, CsMax, CsMin, W, V, k,
    storeys: Object.freeze(storeys),
    spectrum: Object.freeze(spectrum),
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * EUROCODE 8 (EN 1998-1) — parallel lateral-force path for cross-comparison.
 * ────────────────────────────────────────────────────────────────────────── */

export interface EC8Inputs {
  /** design ground acceleration on type-A ground a_g = γ_I·a_gR (g) */
  ag: number;
  /** soil factor S (Table 3.2/3.3) */
  S: number;
  /** spectrum corner periods (s) */
  TB: number; TC: number; TD: number;
  /** behaviour factor q */
  q: number;
  /** lower-bound factor β (recommended 0.2) */
  beta?: number;
  /** total building height H, m */
  H: number;
  /** Ct for T1 = Ct·H^0.75 (0.085 steel MRF, 0.075 concrete MRF/EBF, 0.05 other) */
  Ct: number;
  /** total mass-equivalent weight W, kN */
  W: number;
  /** correction factor λ (0.85 if T1≤2·TC and >2 storeys, else 1.0) */
  lambda?: number;
}

export interface EC8Result {
  readonly T1: number;
  readonly Sd: number;        // design spectral acceleration Sd(T1)/g
  readonly Fb: number;        // seismic base shear, kN
  readonly spectrum: ReadonlyArray<{ T: number; Sd: number }>;
}

/** EN 1998-1 §3.2.2.5 design spectrum Sd(T) for elastic analysis (in g). */
export function designSpectrumEC8(
  ag: number, S: number, TB: number, TC: number, TD: number, q: number,
  beta: number, T: number,
): number {
  if (T <= TB) return ag * S * (2 / 3 + (T / TB) * (2.5 / q - 2 / 3));
  if (T <= TC) return ag * S * 2.5 / q;
  if (T <= TD) return Math.max(ag * S * (2.5 / q) * (TC / T), beta * ag);
  return Math.max(ag * S * (2.5 / q) * (TC * TD / (T * T)), beta * ag);
}

export function computeEC8(i: EC8Inputs): EC8Result {
  const beta = i.beta ?? 0.2;
  const T1 = i.Ct * Math.pow(i.H, 0.75);
  const lambda = i.lambda ?? (T1 <= 2 * i.TC ? 0.85 : 1.0);
  const Sd = designSpectrumEC8(i.ag, i.S, i.TB, i.TC, i.TD, i.q, beta, T1);
  const Fb = Sd * i.W * lambda; // Sd already in g → Sd·W is a force in kN (W is weight)
  const spectrum: { T: number; Sd: number }[] = [];
  for (let t = 0; t <= 4.001; t += 0.1) {
    spectrum.push({
      T: +t.toFixed(2),
      Sd: +designSpectrumEC8(i.ag, i.S, i.TB, i.TC, i.TD, i.q, beta, t).toFixed(4),
    });
  }
  return Object.freeze({ T1, Sd, Fb, spectrum: Object.freeze(spectrum) });
}
