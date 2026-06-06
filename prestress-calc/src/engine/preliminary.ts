/**
 * Preliminary Flexural Design & Pressure Line — Libby "Modern Prestressed
 * Concrete" Ch.4 (Basic Principles) & Ch.9 (Design Expedients).
 *
 *  • Minimum prestressing force (§9-6/§9-7): the smallest P that keeps both
 *    transfer and service fibre stresses inside the allowable envelope, given a
 *    section and the moment range Mmin (transfer) … Mmax (service).
 *  • Minimum section moduli (§9-8): lower-bound Z_t, Z_b for preliminary
 *    member selection from the allowable-stress envelope.
 *  • Pressure line / C-line (§4-3..§4-5): location of the internal compression
 *    resultant, e_C = e − M/P, which migrates through the kern as load is
 *    applied. Staying within the kern ⇒ no tension (full prestress).
 *
 * Sign convention: positive σ = tension. Allowable magnitudes are taken as
 * fractions of f'ci / f'c per ACI 318 (procedure only — not book numbers).
 * SI units: forces kN, moments kN·m, stresses MPa, lengths mm, section in mm³.
 */

export interface PreliminaryInputs {
  A: number;        // gross area (mm²)
  Zt: number;       // top section modulus (mm³)
  Zb: number;       // bottom section modulus (mm³)
  yb: number;       // centroid from bottom (mm)
  fci: number;      // f'ci at transfer (MPa)
  fc: number;       // f'c at service (MPa)
  Mmin: number;     // moment at transfer, e.g. self-weight (kN·m)
  Mmax: number;     // total service moment (kN·m)
  eMax: number;     // maximum practical tendon eccentricity (mm)
  eta: number;      // effectiveness ratio Pe/Pi = 1 − totalLoss (0–1)
  allowTension: boolean; // true = Class U full-prestress tension limit allowed
}

export interface PreliminaryResult {
  // allowable stresses (magnitudes, MPa)
  readonly f_ci_c: number;  // comp at transfer  0.60 f'ci
  readonly f_ti: number;    // tension at transfer 0.50√f'ci (or 0)
  readonly f_cs: number;    // comp at service   0.45 f'c
  readonly f_ts: number;    // tension at service 0.50√f'c (or 0)
  // minimum prestress force
  readonly Pmin_service: number; // governs bottom tension at full load (kN)
  readonly Pmin_transfer: number;// governs top tension at transfer (kN)
  readonly Pmin: number;         // governing min prestress force (kN)
  // minimum section moduli (preliminary sizing)
  readonly Zb_req: number;  // required bottom modulus (mm³)
  readonly Zt_req: number;  // required top modulus (mm³)
}

export function computePreliminary(inp: PreliminaryInputs): PreliminaryResult {
  const { A, Zt, Zb, fci, fc, Mmin, Mmax, eMax, eta, allowTension } = inp;

  const f_ci_c = 0.60 * fci;
  const f_ti   = allowTension ? 0.50 * Math.sqrt(fci) : 0;
  const f_cs   = 0.45 * fc;
  const f_ts   = allowTension ? 0.50 * Math.sqrt(fc) : 0;

  const MmaxN = Mmax * 1e6; // N·mm
  const MminN = Mmin * 1e6;

  // Service, bottom fibre (tension positive must stay ≤ f_ts), tendon at eMax,
  // effective force Pe = η·Pi.  −Pe/A − Pe·e/Zb + Mmax/Zb ≤ f_ts
  //   ⇒ Pe ≥ (Mmax/Zb − f_ts) / (1/A + eMax/Zb)
  const Pe_req = (MmaxN / Zb - f_ts) / (1 / A + eMax / Zb); // N
  const Pmin_service = Math.max(0, (Pe_req / eta) / 1000);  // back to Pi, kN

  // Transfer, top fibre tension: −Pi/A + Pi·e/Zt − Mmin/Zt ≤ f_ti
  //   ⇒ Pi ≥ (Mmin/Zt + f_ti)·... bounded; use governing form for top tension
  //   Pi·(eMax/Zt − 1/A) ≤ f_ti + Mmin/Zt  →  if eMax/Zt>1/A this is an upper
  //   bound; the lower-bound on Pi from service generally governs, so we report
  //   the transfer value as the force at which top tension just reaches f_ti.
  const denomT = eMax / Zt - 1 / A;
  const Pmin_transfer = denomT > 0
    ? Math.max(0, ((f_ti + MminN / Zt) / denomT) / 1000)
    : 0;

  const Pmin = Math.max(Pmin_service, 0);

  // Minimum section moduli (lower-bound, ΔM = Mmax − η·Mmin):
  const dM = MmaxN - eta * MminN;
  const Zb_req = dM / (eta * f_ci_c + f_ts);
  const Zt_req = dM / (f_cs + eta * f_ti);

  return Object.freeze({
    f_ci_c, f_ti, f_cs, f_ts,
    Pmin_service, Pmin_transfer, Pmin,
    Zb_req: Math.max(0, Zb_req),
    Zt_req: Math.max(0, Zt_req),
  });
}

// ─── Pressure line / C-line (Libby §4-3..§4-5) ────────────────

export interface PressureLineInputs {
  Pi: number;     // prestress at transfer (kN)
  Pe: number;     // effective prestress at service (kN)
  e: number;      // tendon eccentricity below centroid (mm, + = below)
  Mg: number;     // transfer moment (kN·m)
  Mservice: number; // total service moment (kN·m)
  kt: number;     // upper kern (mm)
  kb: number;     // lower kern (mm)
}

export interface PressureLineResult {
  /** C-line eccentricity at transfer, e_C = e − Mg/Pi (mm, + below centroid). */
  readonly eC_transfer: number;
  /** C-line eccentricity at service, e_C = e − Mservice/Pe (mm). */
  readonly eC_service: number;
  /** Pressure-line shift caused by service load = Mservice/Pe (mm). */
  readonly shift: number;
  /** C-line stays within kern (−kt … +kb) ⇒ no tension at transfer. */
  readonly withinKernTransfer: boolean;
  /** C-line within kern at service ⇒ section fully in compression. */
  readonly withinKernService: boolean;
}

export function computePressureLine(inp: PressureLineInputs): PressureLineResult {
  const { Pi, Pe, e, Mg, Mservice, kt, kb } = inp;
  const eC_transfer = Pi > 0 ? e - (Mg * 1e3) / Pi : e;        // kN·m→kN·mm /kN
  const eC_service  = Pe > 0 ? e - (Mservice * 1e3) / Pe : e;
  const shift = Pe > 0 ? (Mservice * 1e3) / Pe : 0;
  // Kern band measured from centroid: below +kb, above −kt (tendon-down +).
  const inKern = (ec: number) => ec <= kb && ec >= -kt;
  return Object.freeze({
    eC_transfer,
    eC_service,
    shift,
    withinKernTransfer: inKern(eC_transfer),
    withinKernService: inKern(eC_service),
  });
}
