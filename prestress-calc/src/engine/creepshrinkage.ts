/**
 * Creep & Shrinkage Prediction Models — time-dependent material engine
 * ===================================================================
 * The recurring theme of books 123–135 (Sousa SHM, the record-span box-girder
 * over-deflection ACI CI 2010, non-uniform box shrinkage BJRBE 2018, Reybrouck
 * & Savino PhD theses, the multi-decade balanced-cantilever deflection study)
 * is that long-term deflection and prestress loss are GOVERNED BY THE CHOICE OF
 * creep & shrinkage model. This module collects the four families used in
 * practice and lets the user compute and COMPARE them side-by-side:
 *
 *   • ACI 209R-92            — hyperbolic-power, US practice
 *   • CEB-FIP MC90 / fib MC2010 — European, splits drying + autogenous shrink
 *   • GL2000 (Gardner–Lockman)  — refined hyperbolic
 *   • B3 (Bažant–Baweja)        — simplified compliance form
 *
 * Output: creep coefficient φ(t,t₀), shrinkage strain ε_sh(t), a time-series for
 * charting, and the AEMM aging coefficient χ — feeding directly into the ⏳ AEMM
 * tab, long-term deflection (PCI camber multipliers) and the prestress-loss
 * engines (this is the "creep & shrinkage" backbone of the whole long-term path).
 *
 * Units: stresses MPa, dimensions mm, time in DAYS. ε_sh returned as a strain
 * (×10⁻⁶ where shown). Procedure/sequence per the cited codes — numeric factors
 * follow the codes themselves, never any single PDF's worked-example figures.
 */

export type CSModel = "ACI209" | "CEB_FIP" | "GL2000" | "B3";

export interface CreepShrinkageInputs {
  fc: number;        // 28-day cylinder f'c (MPa)
  t0: number;        // age at loading / start of drying (days)
  t: number;         // age at which φ, ε_sh are evaluated (days)
  RH: number;        // relative humidity (%)
  h0: number;        // notional size = 2·A_c/u (mm); A_c area, u perimeter exposed
  cementType?: "R" | "N" | "S"; // rapid / normal / slow (fib β_sc 8/5/4 ; α)
  /** slump-/aggregate-type ACI correction factors (default 1.0 = standard) */
  aciCorr?: number;
}

export interface CSPoint { readonly t: number; readonly phi: number; readonly eps_sh: number; }
export interface CreepShrinkageResult {
  readonly model: CSModel;
  readonly phi: number;        // creep coefficient φ(t,t₀)
  readonly eps_sh: number;     // shrinkage strain (negative = shortening)
  readonly Ec28: number;       // 28-day modulus (MPa)
  readonly Ect0: number;       // modulus at loading age t₀ (MPa)
  readonly Eeff: number;       // effective modulus E_c/(1+φ) (MPa)
  readonly chi: number;        // AEMM aging coefficient (Trost–Bažant, ≈0.65–0.85)
  readonly Eadj: number;       // age-adjusted effective modulus E_c/(1+χφ) (MPa)
  readonly series: readonly CSPoint[]; // φ & ε_sh vs time for charting
}

const TIMES = [3, 7, 14, 28, 60, 90, 180, 365, 730, 1825, 3650, 7300, 18250];

/** 28-day modulus E_c = 4700√f'c (MPa). */
function Ec28of(fc: number): number { return 4700 * Math.sqrt(fc); }

// ── ACI 209R-92 ────────────────────────────────────────────────
function aci209(i: CreepShrinkageInputs, t: number) {
  const tau = t - i.t0;                       // duration under load (days)
  const td = t;                               // drying time (moist-cured ~7d ⇒ use t)
  // creep: φ = (τ^0.6 / (10 + τ^0.6))·φ_u ; φ_u = 2.35·γ_c
  const gRH = 1.27 - 0.0067 * i.RH;           // humidity (RH>40)
  const gLA = 1.25 * Math.pow(i.t0, -0.118);  // loading-age factor (moist cure)
  const gVS = (2 / 3) * (1 + 1.13 * Math.exp(-0.0213 * i.h0)); // volume/surface (h0=V/S·2 approx)
  const phi_u = 2.35 * gRH * gLA * gVS * (i.aciCorr ?? 1);
  const phi = tau <= 0 ? 0 : (Math.pow(tau, 0.6) / (10 + Math.pow(tau, 0.6))) * phi_u;
  // shrinkage: ε_sh = (t/(35+t))·ε_shu ; ε_shu = 780×10⁻⁶·γ_sh
  const sRH = i.RH <= 80 ? 1.40 - 0.0102 * i.RH : 3.00 - 0.030 * i.RH;
  const sVS = 1.2 * Math.exp(-0.00472 * i.h0);
  const eps_shu = 780e-6 * sRH * sVS * (i.aciCorr ?? 1);
  const eps_sh = -(td / (35 + td)) * eps_shu; // negative = shortening
  return { phi, eps_sh };
}

// ── CEB-FIP MC90 / fib MC2010 ──────────────────────────────────
function cebFip(i: CreepShrinkageInputs, t: number) {
  const fcm = i.fc + 8;                        // mean strength
  const tau = t - i.t0;
  if (tau < 0) return { phi: 0, eps_sh: 0 };
  // creep
  const phiRH = 1 + (1 - i.RH / 100) / (0.1 * Math.cbrt(i.h0));
  const bfcm = 16.8 / Math.sqrt(fcm);
  const bt0 = 1 / (0.1 + Math.pow(i.t0, 0.20));
  const phi0 = phiRH * bfcm * bt0;
  const bH = Math.min(1500, 1.5 * (1 + Math.pow(0.012 * i.RH, 18)) * i.h0 + 250);
  const bc = Math.pow(tau / (bH + tau), 0.3);
  const phi = phi0 * bc;
  // drying shrinkage ε_cd + autogenous ε_ca
  const ads1 = i.cementType === "R" ? 6 : i.cementType === "S" ? 3 : 4;
  const ads2 = i.cementType === "R" ? 0.12 : i.cementType === "S" ? 0.13 : 0.11;
  const eps_cd0 = (220 + 110 * ads1) * Math.exp(-ads2 * fcm / 10) * 1e-6;
  const bRH = i.RH < 99 ? -1.55 * (1 - Math.pow(i.RH / 100, 3)) : 0.25;
  const bds = (t - i.t0) / ((t - i.t0) + 0.035 * i.h0 ** 2);
  const eps_cd = bRH * bds * eps_cd0;
  const eps_ca0 = -2.5 * (i.fc - 10) * 1e-6;
  const bas = 1 - Math.exp(-0.2 * Math.sqrt(t));
  const eps_ca = bas * eps_ca0;
  const eps_sh = -Math.abs(eps_cd) + eps_ca; // both shortening (negative)
  return { phi, eps_sh };
}

// ── GL2000 (Gardner & Lockman) ─────────────────────────────────
function gl2000(i: CreepShrinkageInputs, t: number) {
  const fcm = i.fc + 8;
  const tau = t - i.t0;
  if (tau < 0) return { phi: 0, eps_sh: 0 };
  const h = i.RH / 100;
  // creep compliance term Φ(τ)
  const Phi =
    2 * Math.pow(tau, 0.3) / (Math.pow(tau, 0.3) + 14) +
    Math.sqrt(7 / i.t0) * Math.sqrt(tau / (tau + 7)) +
    2.5 * (1 - 1.086 * h * h) * Math.sqrt(tau / (tau + 0.15 * i.h0 ** 2));
  const phi = Phi;
  // shrinkage ε_sh = ε_shu·β(h)·β(t)
  const K = 1; // normal cement
  const eps_shu = 1000 * K * Math.pow(30 / fcm, 0.5) * 1e-6;
  const bh = 1 - 1.18 * Math.pow(h, 4);
  const bt = Math.sqrt((t - i.t0) / ((t - i.t0) + 0.15 * i.h0 ** 2));
  const eps_sh = -eps_shu * bh * bt;
  return { phi, eps_sh };
}

// ── B3 (Bažant–Baweja, simplified) ─────────────────────────────
function b3(i: CreepShrinkageInputs, t: number) {
  const fcm = i.fc + 8;
  const tau = t - i.t0;
  if (tau < 0) return { phi: 0, eps_sh: 0 };
  const Ec = Ec28of(i.fc);
  // shrinkage time constant (B3 form)
  const tau_sh = 0.085 * Math.pow(i.t0, -0.08) * Math.pow(fcm, -0.25) * i.h0 ** 2;
  // condensed compliance → equivalent creep coefficient φ = Ec·(basic + drying)
  // n = 0.1 log-power basic creep + humidity/size-dependent drying creep
  const C0 = Math.log(1 + Math.pow(tau, 0.1));            // basic
  const Cd = (1 - i.RH / 100) * Math.sqrt(tau / (tau + tau_sh)); // drying
  const phi = Ec * (3.8e-5 * C0 + 1.0e-4 * Cd);
  // shrinkage
  const eps_shInf = -720e-6 * (1.10 - 0.011 * i.RH);
  const St = Math.tanh(Math.sqrt(tau / tau_sh));
  const eps_sh = eps_shInf * St;
  return { phi, eps_sh };
}

function evalModel(model: CSModel, i: CreepShrinkageInputs, t: number) {
  switch (model) {
    case "ACI209": return aci209(i, t);
    case "CEB_FIP": return cebFip(i, t);
    case "GL2000": return gl2000(i, t);
    case "B3": return b3(i, t);
  }
}

export function computeCreepShrinkage(model: CSModel, i: CreepShrinkageInputs): CreepShrinkageResult {
  const Ec28 = Ec28of(i.fc);
  // modulus at loading age (ACI/CEB maturity): fcm(t)=fcm·βcc, Ec(t)=Ec·√βcc
  const s = i.cementType === "R" ? 0.20 : i.cementType === "S" ? 0.38 : 0.25;
  const bcc = Math.exp(s * (1 - Math.sqrt(28 / Math.max(i.t0, 1))));
  const Ect0 = Ec28 * Math.sqrt(bcc);

  const at = evalModel(model, i, i.t);
  const phi = Math.max(0, at.phi);
  const eps_sh = at.eps_sh;

  const Eeff = Ec28 / (1 + phi);
  // Trost–Bažant aging coefficient (typical 0.6–0.9; rises with age at loading)
  const chi = Math.min(0.9, Math.max(0.6, 0.78 + 0.04 * Math.log10(Math.max(i.t0, 1))));
  const Eadj = Ec28 / (1 + chi * phi);

  const series = TIMES.filter(tt => tt >= i.t0).map(tt => {
    const r = evalModel(model, i, tt);
    return Object.freeze({ t: tt, phi: Math.max(0, r.phi), eps_sh: r.eps_sh });
  });

  return Object.freeze({ model, phi, eps_sh, Ec28, Ect0, Eeff, chi, Eadj, series });
}

/** Run all four models at once for the comparison table/chart. */
export function compareAllModels(i: CreepShrinkageInputs): Record<CSModel, CreepShrinkageResult> {
  return {
    ACI209: computeCreepShrinkage("ACI209", i),
    CEB_FIP: computeCreepShrinkage("CEB_FIP", i),
    GL2000: computeCreepShrinkage("GL2000", i),
    B3: computeCreepShrinkage("B3", i),
  };
}
