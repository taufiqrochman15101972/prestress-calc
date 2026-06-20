/**
 * foundationdynamics.ts — Shallow-foundation GEOTECHNICAL bearing capacity +
 * DYNAMIC / machine-foundation analysis + soil-structure interaction (SSI).
 *
 * Procedure/flow after Bowles "Foundation Analysis and Design" 5th Ed and
 * French "Design of Shallow Foundations" (general bearing-capacity equation);
 * Das & Ramana "Principles of Soil Dynamics" 2nd Ed + Richart-Hall-Woods
 * (elastic half-space lumped-mass machine foundation); Ali & Mahamid (compressor
 * block SSI), Kaynia & Andersen / Boulkhiout (dynamic impedances & soil springs).
 * PDF numbers are NOT code references — only the procedure/flow.
 *
 * Units (SI): force kN · length m · soil stress kPa · G (shear modulus) MPa
 * (converted to kPa internally) · frequency Hz · amplitude mm.
 * Pure functions → Object.freeze().
 *
 * Complements engine/substructure.ts `computeSpreadFooting` (which does the
 * STRUCTURAL design — bearing pressure q=ΣP/A±M/S, punching, flexure): here the
 * GEOTECHNICAL ultimate bearing capacity q_ult and the DYNAMIC response.
 */

// ─── General bearing capacity (Meyerhof / Vesic) ─────────────────────────

export interface BearingInputs {
  B: number;        // footing width, m
  L: number;        // footing length, m (= B for square)
  Df: number;       // embedment depth, m
  gamma: number;    // soil unit weight, kN/m³
  c: number;        // cohesion, kPa
  phi: number;      // friction angle, deg
  /** applied service load (vertical), kN */
  P: number;
  FS: number;
}

export interface BearingResult {
  readonly Nc: number; readonly Nq: number; readonly Ngamma: number;
  readonly sc: number; readonly sq: number; readonly sgamma: number;
  readonly dc: number; readonly dq: number; readonly dgamma: number;
  readonly qult: number;     // kPa
  readonly qall: number;     // kPa
  readonly qApplied: number; // kPa
  readonly ok: boolean;
}

export function computeBearingCapacity(i: BearingInputs): BearingResult {
  const phiR = (i.phi * Math.PI) / 180;
  // Bearing-capacity factors (Vesic / Reissner-Prandtl).
  const Nq = Math.exp(Math.PI * Math.tan(phiR)) * Math.tan(Math.PI / 4 + phiR / 2) ** 2;
  const Nc = i.phi < 0.01 ? 5.14 : (Nq - 1) / Math.tan(phiR);
  const Ngamma = 2 * (Nq + 1) * Math.tan(phiR);     // Vesic
  // Shape factors (Vesic).
  const BL = i.B / i.L;
  const sc = 1 + (BL) * (Nq / Nc);
  const sq = 1 + BL * Math.tan(phiR);
  const sgamma = Math.max(0.6, 1 - 0.4 * BL);
  // Depth factors (Hansen, Df/B ≤ 1).
  const k = i.Df / i.B <= 1 ? i.Df / i.B : Math.atan(i.Df / i.B);
  const dc = 1 + 0.4 * k;
  const dq = 1 + 2 * Math.tan(phiR) * (1 - Math.sin(phiR)) ** 2 * k;
  const dgamma = 1.0;
  const q = i.gamma * i.Df;     // surcharge, kPa
  const qult = i.c * Nc * sc * dc + q * Nq * sq * dq + 0.5 * i.gamma * i.B * Ngamma * sgamma * dgamma;
  const qall = qult / i.FS;
  const qApplied = i.P / (i.B * i.L);
  return Object.freeze({
    Nc, Nq, Ngamma, sc, sq, sgamma, dc, dq, dgamma,
    qult, qall, qApplied, ok: qApplied <= qall,
  });
}

// ─── Machine / dynamic foundation (elastic half-space lumped mass) ────────

export type VibrationMode = "VERTICAL" | "HORIZONTAL" | "ROCKING" | "TORSION";

export interface MachineFoundationInputs {
  B: number;        // block plan width, m
  L: number;        // block plan length, m
  height: number;   // block height, m
  /** total vibrating weight (block + machine), kN */
  weight: number;
  /** dynamic shear modulus of soil G, MPa */
  G: number;
  /** soil Poisson ratio */
  mu: number;
  /** soil mass density, kg/m³ */
  rhoSoil: number;
  /** operating speed, rpm */
  rpm: number;
  /** rotating unbalance m_e·e, kg·m (vertical exciting force amplitude basis) */
  meE: number;
  /** allowable displacement amplitude, mm (Richart limits) */
  ampAllow: number;
  mode: VibrationMode;
}

export interface MachineFoundationResult {
  readonly r0: number;       // equivalent radius, m
  readonly k: number;        // dynamic stiffness, kN/m
  readonly mass: number;     // kg
  readonly Bmass: number;    // mass (inertia) ratio
  readonly D: number;        // damping ratio
  readonly fn: number;       // natural frequency, Hz
  readonly fop: number;      // operating frequency, Hz
  readonly freqRatio: number;
  readonly amplitude: number; // mm
  readonly resonanceOk: boolean;
  readonly amplitudeOk: boolean;
}

export function computeMachineFoundation(i: MachineFoundationInputs): MachineFoundationResult {
  const g = 9.81;
  const Gk = i.G * 1000;            // kPa
  const mass = (i.weight / g) * 1000;   // kg  (weight kN → N/g → kg)
  const nu = i.mu;
  const A = i.B * i.L;

  // Equivalent radii per mode.
  const rz = Math.sqrt(A / Math.PI);                 // vertical / horizontal
  const rphi = Math.pow((i.B * i.L ** 3) / (3 * Math.PI), 0.25);  // rocking
  const rt = Math.pow((i.B * i.L * (i.B * i.B + i.L * i.L)) / (6 * Math.PI), 0.25); // torsion

  let r0 = rz, k = 0, Bmass = 0, D = 0;
  const rhoSoilUnit = i.rhoSoil;     // kg/m³
  const Iblock = (mass) * (i.B * i.B + i.height * i.height) / 12
    + mass * (i.height / 2) ** 2;    // mass moment of inertia about base (rocking)

  switch (i.mode) {
    case "VERTICAL": {
      r0 = rz;
      k = (4 * Gk * r0) / (1 - nu);
      Bmass = ((1 - nu) / 4) * (mass / (rhoSoilUnit * r0 ** 3));
      D = 0.425 / Math.sqrt(Bmass);
      break;
    }
    case "HORIZONTAL": {
      r0 = rz;
      k = (32 * (1 - nu) * Gk * r0) / (7 - 8 * nu);
      Bmass = ((7 - 8 * nu) / (32 * (1 - nu))) * (mass / (rhoSoilUnit * r0 ** 3));
      D = 0.288 / Math.sqrt(Bmass);
      break;
    }
    case "ROCKING": {
      r0 = rphi;
      k = (8 * Gk * r0 ** 3) / (3 * (1 - nu));
      Bmass = (3 * (1 - nu) / 8) * (Iblock / (rhoSoilUnit * r0 ** 5));
      D = 0.15 / ((1 + Bmass) * Math.sqrt(Bmass));
      break;
    }
    case "TORSION": {
      r0 = rt;
      k = (16 * Gk * r0 ** 3) / 3;
      const Jt = mass * (i.B * i.B + i.L * i.L) / 12;
      Bmass = Jt / (rhoSoilUnit * r0 ** 5);
      D = 0.5 / (1 + 2 * Bmass);
      break;
    }
  }

  // Natural frequency. Rotating/rocking use generalized mass (mass or inertia).
  const genMass = i.mode === "ROCKING" ? Iblock : (i.mode === "TORSION"
    ? mass * (i.B * i.B + i.L * i.L) / 12 : mass);
  const wn = Math.sqrt(k * 1000 / genMass);   // k kN/m → N/m
  const fn = wn / (2 * Math.PI);
  const fop = i.rpm / 60;
  const wop = 2 * Math.PI * fop;
  const r = wop / wn;

  // Rotating-mass excitation amplitude (frequency-dependent force m_e·e·ω²).
  // A = (m_e·e / m)·[ r² / √((1−r²)² + (2Dr)²) ]   (for translational modes)
  const Mfac = (r * r) / Math.sqrt((1 - r * r) ** 2 + (2 * D * r) ** 2);
  const amplitude = i.mode === "ROCKING" || i.mode === "TORSION"
    ? ((i.meE * (i.height / 2)) / genMass) * Mfac * 1000   // rotational → tip disp
    : ((i.meE) / mass) * Mfac * 1000;                       // m → mm

  return Object.freeze({
    r0, k, mass, Bmass, D, fn, fop, freqRatio: r,
    amplitude,
    resonanceOk: r < 0.8 || r > 1.2,        // avoid ±20% of resonance
    amplitudeOk: amplitude <= i.ampAllow,
  });
}

// ─── Soil-structure interaction — period lengthening (FEMA/Veletsos) ─────

export interface SSIInputs {
  /** fixed-base structure period, s */
  Tfixed: number;
  /** structure effective stiffness k, kN/m */
  kStruct: number;
  /** effective height of structure c.g., m */
  height: number;
  /** foundation half-space: G (MPa), ν, radius r0 (m) */
  G: number;
  mu: number;
  r0: number;
}

export interface SSIResult {
  readonly Kx: number;     // sway stiffness, kN/m
  readonly Kphi: number;   // rocking stiffness, kN·m/rad
  readonly Tssi: number;   // flexible-base period, s
  readonly ratio: number;  // T~/T
}

export function computeSSI(i: SSIInputs): SSIResult {
  const Gk = i.G * 1000;
  const Kx = (8 * Gk * i.r0) / (2 - i.mu);
  const Kphi = (8 * Gk * i.r0 ** 3) / (3 * (1 - i.mu));
  // Veletsos: (T~/T)² = 1 + k/Kx + k·h²/Kφ
  const ratioSq = 1 + i.kStruct / Kx + (i.kStruct * i.height * i.height) / Kphi;
  const ratio = Math.sqrt(ratioSq);
  return Object.freeze({ Kx, Kphi, Tssi: i.Tfixed * ratio, ratio });
}
