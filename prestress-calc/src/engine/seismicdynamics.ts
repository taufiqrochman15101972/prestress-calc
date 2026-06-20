/**
 * seismicdynamics.ts — Dynamic analysis & seismic DESIGN of the substructure
 * (bangunan bawah). Procedure/flow after AASHTO Guide Specifications for LRFD
 * Seismic Bridge Design, Caltrans SDC, Priestley/Calvi/Kowalsky "Displacement-
 * Based Seismic Design of Structures", SNI 2833:2016, and Seed–Idriss/Youd
 * (liquefaction). PDF numbers are NEVER code references — only the procedure.
 *
 * DISTINCT from:
 *   • seismic.ts          — PCI single-mode uniform-load force method
 *   • sni2833seismic.ts   — SNI 2833 design RESPONSE SPECTRUM coefficients
 *   • foundationdynamics.ts — machine-foundation half-space + SSI period
 * This module adds: SDOF dynamic response, 2-DOF modal (SRSS) analysis,
 * capacity-design plastic-hinge / displacement-ductility / P-Δ of the pier,
 * and simplified liquefaction triggering.
 *
 * Units (SI): force kN · length m · stress MPa · accel g · period s.
 * Pure functions → Object.freeze().
 */

const G = 9.81;

// ─── SDOF dynamic response (single pier as SDOF oscillator) ──────────────

export interface SDOFInputs {
  /** tributary seismic weight, kN */
  W: number;
  /** lateral stiffness, kN/m */
  K: number;
  /** damping ratio ζ (0.05 typical RC) */
  zeta: number;
  /** spectral acceleration at the period (g) — from design spectrum (🌎 tab) */
  Sa: number;
}

export interface SDOFResult {
  readonly mass: number;     // ton (kN·s²/m)
  readonly omega: number;    // rad/s
  readonly T: number;        // s
  readonly Sa: number;       // g
  readonly Sd: number;       // spectral displacement, m
  readonly Vbase: number;    // base shear, kN
  readonly damping: number;  // damping-adjustment factor B
}

export function computeSDOF(i: SDOFInputs): SDOFResult {
  const mass = i.W / G;                     // kN·s²/m (=ton)
  const omega = Math.sqrt(i.K / mass);      // rad/s
  const T = (2 * Math.PI) / omega;
  // Damping adjustment B (ATC/Eurocode): η = √(0.10/(0.05+ζ)).
  const B = Math.sqrt(0.10 / (0.05 + i.zeta));
  const SaAdj = i.Sa * B;
  const Vbase = SaAdj * i.W;                 // base shear
  const Sd = (SaAdj * G) / (omega * omega);  // Sd = Sa·g/ω²
  return Object.freeze({ mass, omega, T, Sa: SaAdj, Sd, Vbase, damping: B });
}

// ─── 2-DOF modal analysis (deck + pier-cap masses) — SRSS ────────────────

export interface Modal2Inputs {
  m1: number; m2: number;     // lumped masses, ton (kN·s²/m)
  k1: number; k2: number;     // storey stiffnesses, kN/m (k1 lower, k2 upper)
  /** spectral acceleration function Sa(T) sampled — pass design Sa for each mode */
  Sa1: number; Sa2: number;   // g, evaluated at T1, T2 (from 🌎 spectrum)
}

export interface Modal2Result {
  readonly T1: number; readonly T2: number;     // s
  readonly phi1: readonly [number, number];
  readonly phi2: readonly [number, number];
  readonly Gamma1: number; readonly Gamma2: number;   // participation
  readonly Vbase: number;     // SRSS base shear, kN
  readonly Mratio1: number;   // modal mass ratio mode 1
}

export function computeModal2(i: Modal2Inputs): Modal2Result {
  const { m1, m2, k1, k2 } = i;
  // Shear-building 2-DOF: M=diag(m1,m2), K=[[k1+k2,-k2],[-k2,k2]].
  const K11 = k1 + k2, K12 = -k2, K22 = k2;
  // Generalized eigenproblem → solve det(K − ω²M)=0 (quadratic in λ=ω²).
  const a = m1 * m2;
  const b = -(K11 * m2 + K22 * m1);
  const c = K11 * K22 - K12 * K12;
  const disc = Math.sqrt(Math.max(b * b - 4 * a * c, 0));
  const lam1 = (-b - disc) / (2 * a);   // lower → mode 1
  const lam2 = (-b + disc) / (2 * a);
  const w1 = Math.sqrt(lam1), w2 = Math.sqrt(lam2);
  const T1 = (2 * Math.PI) / w1, T2 = (2 * Math.PI) / w2;
  // Mode shapes (set φ_1=1): from row1 (K11−λm1)·1 + K12·φ2 = 0 → φ2=−(K11−λm1)/K12.
  const sh = (lam: number): [number, number] => {
    const r2 = -(K11 - lam * m1) / K12;
    return [1, r2];
  };
  const phi1 = sh(lam1), phi2 = sh(lam2);
  const partic = (phi: [number, number]) => {
    const Lh = m1 * phi[0] + m2 * phi[1];
    const Mg = m1 * phi[0] ** 2 + m2 * phi[1] ** 2;
    return { Gamma: Lh / Mg, Leff: (Lh * Lh) / Mg };
  };
  const p1 = partic(phi1), p2 = partic(phi2);
  const Mtot = m1 + m2;
  // Modal base shears Vk = Sa_k·g·Meff_k ; SRSS combine.
  const V1 = i.Sa1 * G * p1.Leff;
  const V2 = i.Sa2 * G * p2.Leff;
  const Vbase = Math.sqrt(V1 * V1 + V2 * V2);
  return Object.freeze({
    T1, T2, phi1: phi1 as [number, number], phi2: phi2 as [number, number],
    Gamma1: p1.Gamma, Gamma2: p2.Gamma, Vbase, Mratio1: p1.Leff / Mtot,
  });
}

// ─── Capacity design — plastic hinge, ductility, P-Δ (AASHTO/Caltrans) ───

export interface CapacityDesignInputs {
  /** plastic moment capacity M_p of the column (from P-M, 🏛️ tab), kN·m */
  Mp: number;
  /** column clear height H, m */
  H: number;
  /** fixity: "CANTILEVER" (single-curvature) or "FIXED" (double) */
  fixity: "CANTILEVER" | "FIXED";
  /** overstrength factor λ_o (1.2 ASTM A706 / 1.3 A615) */
  lambdaO: number;
  /** column diameter/depth, m */
  D: number;
  /** yield curvature φ_y ≈ 2.25·ε_y/D, 1/m */
  phiY: number;
  /** ultimate curvature φ_u (section analysis), 1/m */
  phiU: number;
  /** longitudinal bar yield strength f_ye, MPa */
  fye: number;
  /** longitudinal bar diameter d_bl, mm */
  dbl: number;
  /** sustained gravity axial load (for P-Δ), kN */
  Pdl: number;
  /** seismic displacement demand Δ_D, m (from SDOF/modal) */
  deltaD: number;
}

export interface CapacityDesignResult {
  readonly Mpo: number;     // overstrength moment, kN·m
  readonly Vpo: number;     // plastic shear demand (capacity-protected), kN
  readonly Lp: number;      // plastic hinge length, m
  readonly deltaY: number;  // yield displacement, m
  readonly thetaP: number;  // plastic rotation, rad
  readonly deltaP: number;  // plastic displacement, m
  readonly deltaC: number;  // displacement capacity, m
  readonly muDelta: number; // displacement ductility capacity
  readonly demandRatio: number;  // Δ_D / Δ_C
  readonly PdeltaRatio: number;  // Pdl·Δ / Mp (≤ 0.25 limit)
  readonly displOk: boolean;
  readonly PdeltaOk: boolean;
}

export function computeCapacityDesign(i: CapacityDesignInputs): CapacityDesignResult {
  const Mpo = i.lambdaO * i.Mp;
  // Plastic shear: cantilever Vp = Mpo/H ; fixed-fixed Vp = 2·Mpo/H.
  const Vpo = i.fixity === "FIXED" ? (2 * Mpo) / i.H : Mpo / i.H;
  // Plastic hinge length (Priestley): Lp = 0.08·L + 0.022·f_ye·d_bl  (m, MPa, mm).
  const L = i.H;
  const Lp = Math.max(0.08 * L + 0.022 * i.fye * (i.dbl / 1000), 0.044 * i.fye * (i.dbl / 1000));
  // Yield displacement (cantilever): Δy = φ_y·L²/3.
  const deltaY = (i.phiY * L * L) / 3;
  // Plastic rotation θp = (φ_u − φ_y)·Lp ; plastic disp Δp = θp·(L − Lp/2).
  const thetaP = Math.max(i.phiU - i.phiY, 0) * Lp;
  const deltaP = thetaP * (L - Lp / 2);
  const deltaC = deltaY + deltaP;
  const muDelta = deltaC / deltaY;
  const demandRatio = i.deltaD / deltaC;
  // P-Δ: Pdl·Δ_D ≤ 0.25·Mp (Caltrans).
  const PdeltaRatio = (i.Pdl * i.deltaD) / i.Mp;
  return Object.freeze({
    Mpo, Vpo, Lp, deltaY, thetaP, deltaP, deltaC, muDelta,
    demandRatio, PdeltaRatio,
    displOk: demandRatio <= 1.0,
    PdeltaOk: PdeltaRatio <= 0.25,
  });
}

// ─── Liquefaction triggering (simplified Seed–Idriss / Youd et al.) ──────

export interface LiquefactionInputs {
  /** depth of layer, m */
  z: number;
  /** total unit weight, kN/m³ */
  gamma: number;
  /** water-table depth, m */
  waterDepth: number;
  /** peak ground acceleration a_max (g) */
  amax: number;
  /** SPT blow count corrected (N1)60, blows/300mm */
  N160: number;
  /** fines content FC, % */
  fines: number;
  /** earthquake moment magnitude Mw */
  Mw: number;
}

export interface LiquefactionResult {
  readonly sigmaV: number;    // total vertical stress, kPa
  readonly sigmaVeff: number; // effective vertical stress, kPa
  readonly rd: number;        // stress-reduction coefficient
  readonly CSR: number;       // cyclic stress ratio
  readonly N160cs: number;    // clean-sand-equivalent
  readonly CRR75: number;     // cyclic resistance ratio @ M7.5
  readonly MSF: number;       // magnitude scaling factor
  readonly FS: number;        // factor of safety against liquefaction
  readonly liquefies: boolean;
}

export function computeLiquefaction(i: LiquefactionInputs): LiquefactionResult {
  const gammaW = 9.81;
  const sigmaV = i.gamma * i.z;
  const u = Math.max(i.z - i.waterDepth, 0) * gammaW;
  const sigmaVeff = sigmaV - u;
  // Stress-reduction coefficient (Liao & Whitman linear approx).
  const rd = i.z <= 9.15 ? 1 - 0.00765 * i.z : 1.174 - 0.0267 * i.z;
  // Cyclic stress ratio.
  const CSR = 0.65 * i.amax * (sigmaV / sigmaVeff) * Math.max(rd, 0.5);
  // Fines correction → clean-sand equivalent (Youd et al. 2001).
  const FC = i.fines;
  const alpha = FC <= 5 ? 0 : FC >= 35 ? 5.0 : Math.exp(1.76 - 190 / (FC * FC));
  const beta = FC <= 5 ? 1.0 : FC >= 35 ? 1.2 : 0.99 + (FC ** 1.5) / 1000;
  const N160cs = alpha + beta * i.N160;
  // CRR7.5 (Youd et al. clean-sand curve), capped.
  const N = Math.min(N160cs, 30);
  const CRR75 = N >= 30 ? 0.5
    : 1 / (34 - N) + N / 135 + 50 / (10 * N + 45) ** 2 - 1 / 200;
  // Magnitude scaling factor (Idriss).
  const MSF = Math.min(1.8, 6.9 * Math.exp(-i.Mw / 4) - 0.058);
  const FS = (CRR75 * MSF) / CSR;
  return Object.freeze({
    sigmaV, sigmaVeff, rd, CSR, N160cs, CRR75, MSF, FS,
    liquefies: FS < 1.0,
  });
}
