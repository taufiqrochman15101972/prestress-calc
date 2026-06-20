/**
 * internalforces.ts — Internal-force, stress & deflection FIELDS along the beam
 * (strength-of-materials equilibrium, pre-FEM). Drives the OriginPro / IDEA-
 * StatiCa-style real-time diagrams: major moment M_z, lateral moment M_y, shear
 * V_y & V_x, axial N (tension/compression), torsion T_x, and deflection in ±Z
 * (down/up) and ±Y (lateral). Designed so a future FEM/FEA layer can replace the
 * closed-form fields without changing the UI.
 *
 * Sign convention (project): tension +, compression −. y measured UP from the
 * neutral axis. Sagging M_z > 0 → top compression, bottom tension.
 *
 * Units in → SI consistent: L mm, EI N·mm², w N/mm, P N, e mm, A mm², I mm⁴.
 * Stresses MPa, deflection mm. Pure functions → Object.freeze().
 */

export interface BeamFieldInputs {
  L: number;            // span, mm
  EI: number;           // flexural rigidity E·I, N·mm² (major axis)
  EIlat: number;        // lateral E·I_y, N·mm²
  wUDL: number;         // total downward UDL (self+SDL+live), N/mm
  Pmid: number;         // mid-span point load (BGT knife), N
  wBal: number;         // prestress balancing (upward) UDL, N/mm
  Plong: number;        // longitudinal prestress force, N (compression magnitude)
  e: number;            // tendon eccentricity at mid (below NA +), mm
  A: number;            // gross area, mm²
  Ig: number;           // major inertia, mm⁴
  yb: number;           // NA to bottom, mm
  yt: number;           // NA to top, mm
  Tu: number;           // applied torsion, N·mm (0 if none)
  wLat: number;         // lateral UDL (wind), N/mm (0 if none)
  Naxial: number;       // external axial (tension +), N (usually 0)
  samples?: number;     // sample count (default 81)
}

export type FieldKind = "Mz" | "My" | "Vy" | "Vx" | "N" | "T" | "dz" | "dy";

export interface BeamFieldPoint {
  x: number;     // mm
  Mz: number; My: number; Vy: number; Vx: number;
  N: number; T: number;
  dz: number;    // vertical deflection (down −, up +), mm
  dy: number;    // lateral deflection, mm
}

export interface BeamFieldResult {
  readonly L: number;
  readonly pts: ReadonlyArray<BeamFieldPoint>;
  readonly max: Readonly<Record<FieldKind, number>>;
  readonly min: Readonly<Record<FieldKind, number>>;
  readonly h: number;     // section height (yt+yb), mm
  readonly yb: number; readonly yt: number;
}

/** simply-supported UDL deflection shape δ(x)=w·x(L³−2Lx²+x³)/(24EI) (down +). */
function udlDefl(w: number, x: number, L: number, EI: number): number {
  return (w * x * (L ** 3 - 2 * L * x * x + x ** 3)) / (24 * EI);
}
/** simply-supported central point-load deflection (down +). */
function pointDefl(P: number, x: number, L: number, EI: number): number {
  const a = L / 2;
  if (x <= a) return (P * x * (3 * L * L - 4 * x * x)) / (48 * EI);
  const xr = L - x;
  return (P * xr * (3 * L * L - 4 * xr * xr)) / (48 * EI);
}

export function computeBeamFields(i: BeamFieldInputs): BeamFieldResult {
  const n = i.samples ?? 81;
  const L = i.L;
  const pts: BeamFieldPoint[] = [];
  const R_udl = (i.wUDL * L) / 2;          // support reaction (UDL)
  const R_lat = (i.wLat * L) / 2;

  for (let k = 0; k < n; k++) {
    const x = (L * k) / (n - 1);
    // Major-axis moment from applied gravity load (sagging +).
    const Mudl = (i.wUDL * x * (L - x)) / 2;
    const Mpt = x <= L / 2 ? (i.Pmid / 2) * x : (i.Pmid / 2) * (L - x);
    const Mz = Mudl + Mpt;                  // N·mm
    // Shear V_y (gravity).
    const Vy = R_udl - i.wUDL * x + (x < L / 2 ? i.Pmid / 2 : x > L / 2 ? -i.Pmid / 2 : 0);
    // Lateral moment / shear (wind).
    const My = (i.wLat * x * (L - x)) / 2;
    const Vx = R_lat - i.wLat * x;
    // Axial: prestress compression (−) + external.
    const N = -i.Plong + i.Naxial;
    // Torsion: constant applied torque (uniform-end model).
    const T = i.Tu;
    // Deflection Z: load-down − prestress-camber-up (balancing UDL).
    const dDown = udlDefl(i.wUDL, x, L, i.EI) + pointDefl(i.Pmid, x, L, i.EI);
    const dCamber = udlDefl(i.wBal, x, L, i.EI);
    const dz = -(dDown) + dCamber;          // down negative, up positive
    const dy = i.EIlat > 0 ? udlDefl(i.wLat, x, L, i.EIlat) : 0;
    pts.push({ x, Mz, My, Vy, Vx, N, T, dz, dy });
  }

  const kinds: FieldKind[] = ["Mz", "My", "Vy", "Vx", "N", "T", "dz", "dy"];
  const max = {} as Record<FieldKind, number>;
  const min = {} as Record<FieldKind, number>;
  for (const kd of kinds) {
    const vals = pts.map(p => p[kd]);
    max[kd] = Math.max(...vals); min[kd] = Math.min(...vals);
  }
  return Object.freeze({
    L, pts: Object.freeze(pts), max: Object.freeze(max), min: Object.freeze(min),
    h: i.yt + i.yb, yb: i.yb, yt: i.yt,
  });
}

// ─── point query at (x, y) — internal forces + fibre stress + deflection ──

export interface StressVariants {
  /** σ = N/A − M·y/I  (engineering / Navier) */
  navier: number;
  /** σ = (P/A)(1 ∓ e·y/r²) ∓ M·y/I  (kernel / TY-Lin form) — identical value */
  kernel: number;
}

export function queryAt(i: BeamFieldInputs, res: BeamFieldResult, x: number, yFromNA: number): {
  Mz: number; Vy: number; N: number; T: number; dz: number;
  sigma: StressVariants; r2: number;
} {
  // interpolate fields at x
  const L = i.L; const t = Math.min(Math.max(x, 0), L) / L * (res.pts.length - 1);
  const i0 = Math.floor(t), i1 = Math.min(i0 + 1, res.pts.length - 1), f = t - i0;
  const lerp = (a: number, b: number) => a + (b - a) * f;
  const p0 = res.pts[i0], p1 = res.pts[i1];
  const Mz = lerp(p0.Mz, p1.Mz), Vy = lerp(p0.Vy, p1.Vy);
  const N = lerp(p0.N, p1.N), T = lerp(p0.T, p1.T), dz = lerp(p0.dz, p1.dz);
  const y = yFromNA;
  const r2 = i.Ig / i.A;
  // Navier (explicit terms): σ = N/A + P·e·y/I − M_z·y/I
  //  (N = −P+N_ext ; P·e·y/I = prestress primary hogging ; M_z = applied moment)
  const navier = N / i.A + (i.Plong * i.e * y) / i.Ig - (Mz * y) / i.Ig;
  // Kernel / TY-Lin: σ = (−P/A)(1 − e·y/r²) + N_ext/A − M_z·y/I — algebraically
  // identical to Navier because (P/A)(e·y/r²) = P·e·y/I (since r² = I/A).
  const kernel = (-i.Plong / i.A) * (1 - (i.e * y) / r2) + (i.Naxial / i.A) - (Mz * y) / i.Ig;
  return { Mz, Vy, N, T, dz, sigma: { navier, kernel }, r2 };
}

/** Jet-like colormap (value normalised −1..+1) → CSS rgb, OriginPro-style. */
export function jetColor(norm: number): string {
  const v = Math.max(-1, Math.min(1, norm));
  // map −1(blue) … 0(green) … +1(red)
  const t = (v + 1) / 2; // 0..1
  let r: number, g: number, b: number;
  if (t < 0.25) { r = 0; g = Math.round(255 * (t / 0.25)); b = 255; }
  else if (t < 0.5) { r = 0; g = 255; b = Math.round(255 * (1 - (t - 0.25) / 0.25)); }
  else if (t < 0.75) { r = Math.round(255 * ((t - 0.5) / 0.25)); g = 255; b = 0; }
  else { r = 255; g = Math.round(255 * (1 - (t - 0.75) / 0.25)); b = 0; }
  return `rgb(${r},${g},${b})`;
}
