/**
 * Kolom Prategang — P-M Interaction Engine
 * TY Lin & Burns, Ch. 11 — Compression Members
 * Reference: ACI 318-19 §22.4, SNI 2847:2019
 *
 * Generates P-M interaction curve for a rectangular prestressed column
 * using strain compatibility + Whitney stress block.
 *
 * Strain diagram: εcu = 0.003 at extreme compression fiber
 * Steel strains: εs = εcu × (c − ds) / c  (compression side)
 *               εs = εcu × (ds − c) / c   (tension side)
 *
 * Prestressed steel (strands): initial strain εpe = fse/Eps
 *   Total strain = εpe + εs (tension side) or εpe − εs (if comp. side)
 *   fps = min(fpu, Eps × (εpe + εs))  — tension
 *   fps = fse − Eps × εs  — if strand is in compression zone
 */

export interface ColumnSection {
  b: number;   // width (mm)
  h: number;   // depth (mm)
  fc: number;  // f'c (MPa)
}

export interface ColumnStrandLayer {
  /** Distance from extreme compression fiber (mm) */
  d: number;
  /** Total strand area in this layer (mm²) */
  Aps: number;
  /** Effective prestress fse (MPa) */
  fse: number;
  /** Strand modulus (MPa) */
  Eps: number;
  /** Strand ultimate fpu (MPa) */
  fpu: number;
}

export interface ColumnMildLayer {
  d: number;   // mm from extreme compression fiber
  As: number;  // mm²
  fy: number;  // MPa
}

export interface ColumnInputs {
  section: ColumnSection;
  strandLayers: ColumnStrandLayer[];
  mildLayers: ColumnMildLayer[];
  /** Applied loads for demand point */
  Pu: number;  // kN (positive = compression)
  Mu: number;  // kN·m
}

export interface PMPoint {
  readonly Pn: number;   // kN
  readonly Mn: number;   // kN·m
  readonly label?: string;
}

export interface ColumnResult {
  /** P-M interaction curve (Pn, Mn) — ordered from pure compression to pure tension */
  readonly curve: readonly PMPoint[];
  /** Pure compression Pn0 (kN) */
  readonly Pn0: number;
  /** Pure bending Mn0 (kN·m) at Pn=0 */
  readonly Mn0: number;
  /** Balanced point */
  readonly Pn_bal: number;
  readonly Mn_bal: number;
  /** Demand point */
  readonly Pu: number;
  readonly Mu: number;
  /** Is demand inside P-M envelope? */
  readonly isAdequate: boolean;
  /** Demand ratio (distance from origin / distance to envelope at same angle) */
  readonly demandRatio: number;
}

const ECU = 0.003;
const PHI_COMP = 0.65; // tied column (for prestressed, transition to 0.90 at pure flex)

function beta1(fc: number): number {
  return fc <= 28 ? 0.85 : Math.max(0.65, 0.85 - 0.05 * ((fc - 28) / 7));
}

/**
 * Compute Pn and Mn for a given neutral axis depth c (mm from compression face).
 * Returns {Pn_kN, Mn_kNm} — Pn positive = compression.
 */
function pointAtC(
  c: number,
  sec: ColumnSection,
  strands: ColumnStrandLayer[],
  mild: ColumnMildLayer[]
): { Pn: number; Mn: number } {
  const b1 = beta1(sec.fc);
  const a  = Math.min(b1 * c, sec.h);
  const ref = sec.h / 2; // centroidal axis

  // Concrete compression block
  let C_conc = 0.85 * sec.fc * sec.b * a;
  let M_conc = C_conc * (sec.h / 2 - a / 2); // about centroid

  let sum_F = C_conc;   // N
  let sum_M = M_conc;   // N·mm

  // Strand layers
  for (const s of strands) {
    const eps_s = (c - s.d) / c * ECU; // positive = compression strain
    const eps_total = eps_s + s.fse / s.Eps; // total strain
    let fps: number;
    if (eps_total <= 0) {
      // Strand in tension
      fps = Math.min(s.fpu, -eps_total * s.Eps);
      fps = Math.max(0, fps);
    } else {
      // Strand in compression
      fps = Math.min(s.fse, eps_total * s.Eps);
    }
    const F_s = s.Aps * (fps - 0.85 * sec.fc); // subtract displaced concrete
    const moment_arm = ref - s.d;
    sum_F += F_s;
    sum_M += F_s * moment_arm;
  }

  // Mild steel layers
  for (const m of mild) {
    const eps_s = (c - m.d) / c * ECU;
    const fs = Math.max(-m.fy, Math.min(m.fy, eps_s * 200_000));
    const F_m = m.As * (fs - 0.85 * sec.fc);
    sum_F += F_m;
    sum_M += F_m * (ref - m.d);
  }

  return { Pn: sum_F / 1000, Mn: Math.abs(sum_M) / 1e6 };
}

export function computeColumnPM(inp: ColumnInputs): ColumnResult {
  const { section: sec, strandLayers, mildLayers, Pu, Mu } = inp;

  // Build P-M curve by sweeping c from ≈ infinity (pure compression) to ≈ 0 (pure tension)
  const points: PMPoint[] = [];

  // Pure compression (a = h)
  const pt0 = pointAtC(1e6, sec, strandLayers, mildLayers);
  points.push({ ...pt0, Mn: 0, label: "P₀ (pure compression)" });
  const Pn0 = pt0.Pn;

  // Sweep c: from h×3 down to 0.01
  const cValues = [
    sec.h * 4, sec.h * 2, sec.h * 1.5, sec.h * 1.2, sec.h,
    sec.h * 0.85, sec.h * 0.7, sec.h * 0.6, sec.h * 0.5,
    // Balanced point: steel at max tension reaches εy when εcu at compression
    0, // will compute balance
  ];

  // Balance: deepest tension strand reaches fy at same time εcu is reached
  // For the outermost tension strand at d = max:
  const d_max = Math.max(...strandLayers.map(s => s.d), ...mildLayers.map(m => m.d));
  const c_bal = d_max * ECU / (ECU + 0.002); // strain compatibility for fy strand

  // Add balanced point
  const ptBal = pointAtC(c_bal, sec, strandLayers, mildLayers);

  // Sweep actual c values
  const sweepC = [sec.h * 4, sec.h * 2, sec.h * 1.2, sec.h, sec.h * 0.8,
                  c_bal * 1.5, c_bal, c_bal * 0.7, c_bal * 0.5,
                  c_bal * 0.3, c_bal * 0.15, 5];

  const seen = new Set<number>();
  for (const c of sweepC) {
    if (c <= 0 || seen.has(Math.round(c))) continue;
    seen.add(Math.round(c));
    const pt = pointAtC(c, sec, strandLayers, mildLayers);
    if (c === c_bal) {
      points.push({ ...pt, label: "Titik imbang (balanced)" });
    } else if (pt.Pn > -100) { // skip extreme tension
      points.push(pt);
    }
  }

  // Pure bending: binary search for Pn ≈ 0
  let lo = 0.1, hi = c_bal;
  for (let i = 0; i < 30; i++) {
    const cm = (lo + hi) / 2;
    const ptm = pointAtC(cm, sec, strandLayers, mildLayers);
    if (ptm.Pn > 0) hi = cm; else lo = cm;
  }
  const ptPureFlex = pointAtC((lo + hi) / 2, sec, strandLayers, mildLayers);

  // Sort by Pn descending
  points.sort((a, b) => b.Pn - a.Pn);

  const Pn_bal = ptBal.Pn;
  const Mn_bal = ptBal.Mn;
  const Mn0    = ptPureFlex.Mn;

  // Apply φ factors to curve
  const phiCurve: PMPoint[] = points.map(pt => {
    const phi = pt.Pn >= Pn_bal
      ? PHI_COMP  // compression controlled
      : 0.65 + (0.90 - 0.65) * (1 - pt.Pn / Pn_bal); // transition
    return { Pn: phi * pt.Pn, Mn: (phi < 0.9 ? phi : 0.9) * pt.Mn, label: pt.label };
  });

  // Check demand (Pu, Mu) against envelope
  // Simple check: is (Pu, Mu) inside the polygon defined by phiCurve?
  // Use closest-point approach:
  const demandRatio = computeDemandRatio(Pu, Mu, phiCurve);

  return Object.freeze({
    curve: phiCurve,
    Pn0,
    Mn0,
    Pn_bal,
    Mn_bal,
    Pu, Mu,
    isAdequate: demandRatio <= 1.0,
    demandRatio,
  });
}

/** Compute the ratio |demand|/|capacity| along the same direction from origin */
function computeDemandRatio(Pu: number, Mu: number, curve: readonly PMPoint[]): number {
  if (curve.length < 2) return 1.5;

  // Find the two envelope points that bracket the demand direction
  const angle = Math.atan2(Mu, Pu);
  let bestRatio = Infinity;

  for (let i = 0; i < curve.length - 1; i++) {
    const A = curve[i], B = curve[i + 1];
    const aA = Math.atan2(A.Mn, A.Pn);
    const aB = Math.atan2(B.Mn, B.Pn);
    if (!isAngleBetween(angle, aA, aB)) continue;
    // Parametric: P = A.Pn + t*(B.Pn-A.Pn), M = A.Mn + t*(B.Mn-A.Mn)
    // Find intersection with ray from origin at angle `angle`
    const dx = B.Pn - A.Pn, dy = B.Mn - A.Mn;
    const denom = Math.cos(angle) * dy - Math.sin(angle) * dx;
    if (Math.abs(denom) < 1e-9) continue;
    const t = (Math.cos(angle) * A.Mn - Math.sin(angle) * A.Pn) / denom;
    if (t < 0 || t > 1) continue;
    const Pcap = A.Pn + t * dx;
    const Mcap = A.Mn + t * dy;
    const rcap = Math.sqrt(Pcap ** 2 + Mcap ** 2);
    const rdem = Math.sqrt(Pu ** 2 + Mu ** 2);
    if (rcap > 0) bestRatio = Math.min(bestRatio, rdem / rcap);
  }

  return isFinite(bestRatio) ? bestRatio : (Pu > 0 ? Pu / (curve[0]?.Pn || 1) : 1.5);
}

function isAngleBetween(a: number, a1: number, a2: number): boolean {
  const norm = (x: number) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const na = norm(a), n1 = norm(a1), n2 = norm(a2);
  const lo = Math.min(n1, n2), hi = Math.max(n1, n2);
  return (na >= lo && na <= hi) || (hi - lo > Math.PI && (na <= lo || na >= hi));
}

// ─── Column Slenderness — Moment Magnification ───────────────

export interface SlendernessInputs {
  /** Effective length factor k (1.0 = pinned-pinned, 0.5 = fixed-fixed) */
  k: number;
  /** Unsupported length (mm) */
  Lu: number;
  /** Moment of inertia of gross section (mm⁴) */
  Ig: number;
  /** Concrete modulus (MPa) */
  Ec: number;
  /** Ratio of factored sustained load to total factored axial load (0–1) */
  beta_dns: number;
  /** Factored axial load (kN) */
  Pu: number;
  /** Smaller factored end moment (kN·m) — use negative if double curvature */
  M1: number;
  /** Larger factored end moment (kN·m) — always positive */
  M2: number;
  /** Sway frame? false = non-sway (braced) */
  isSway: boolean;
}

export interface SlendernessResult {
  /** kLu/r — slenderness ratio */
  readonly slenderness_ratio: number;
  /** Is second-order analysis required? (kLu/r > 22 for braced frames) */
  readonly secondOrderRequired: boolean;
  /** Equivalent moment factor Cm */
  readonly Cm: number;
  /** Euler buckling load Pc (kN) */
  readonly Pc: number;
  /** Magnification factor δ_ns */
  readonly delta_ns: number;
  /** Magnified design moment Mc = δ_ns × M2 (kN·m) */
  readonly Mc: number;
}

/**
 * ACI 318-19 §6.2-6.3: Non-sway (braced) frame moment magnification.
 * Slenderness limit: kLu/r > 22 → second-order effects required.
 * Mc = δ_ns × M2, δ_ns = Cm / (1 − Pu/(0.75·Pc)) ≥ 1.0
 */
export function computeSlenderness(inp: SlendernessInputs): SlendernessResult {
  const { k, Lu, Ig, Ec, beta_dns, Pu, M1, M2, isSway } = inp;

  // Radius of gyration: r = 0.3h for rectangular (ACI §6.2.5)
  // Using r = sqrt(Ig / Ag) with approx Ag = Ig/r² → r ≈ sqrt(Ig/Ag)
  // For simplicity: r = 0.3 × dimension → use Lu/r formula directly
  // EI (ACI §6.6.4.4.4): EI = 0.4·Ec·Ig / (1 + beta_dns)
  const EI = (0.4 * Ec * Ig) / (1 + beta_dns);

  // Euler buckling load
  const kLu = k * Lu; // mm
  const Pc = (Math.PI ** 2 * EI) / (kLu ** 2) / 1000; // kN

  // r ≈ 0.3 × h for rectangular → estimate from EI and Pc
  // Use a default radius of gyration based on √(Ig/Ag) approximation:
  // For rectangular b×h: Ig = bh³/12, Ag = bh → r = h/√12 ≈ 0.289h
  // Without knowing h explicitly, compute from Ig using cube root:
  const r_est = 0.289 * Math.cbrt(Ig * 12); // very rough — use for display only
  const slenderness_ratio = kLu / r_est;

  const limit_braced = isSway ? 22 : 22;
  const secondOrderRequired = slenderness_ratio > limit_braced;

  // Cm (ACI §6.6.4.5.3): for braced frames with no transverse loads
  const Cm = Math.max(0.4, isSway ? 1.0 : 0.6 + 0.4 * (M1 / M2));

  // Magnification factor
  const delta_ns = Math.max(1.0, Cm / (1 - Pu / (0.75 * Pc)));

  const Mc = delta_ns * Math.max(Math.abs(M1), Math.abs(M2)); // kN·m

  return Object.freeze({
    slenderness_ratio,
    secondOrderRequired,
    Cm,
    Pc,
    delta_ns,
    Mc,
  });
}
