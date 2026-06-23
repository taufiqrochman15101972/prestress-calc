/**
 * limitanalysis.ts — LIMIT ANALYSIS & PLASTICITY collapse design.
 *
 * Fills the gap from the ASM applied-solid-mechanics library (Nielsen & Hoang
 * "Limit Analysis and Concrete Plasticity" appears 3×, plus Johansen yield-line,
 * plastic theory of structures, computational plasticity). The project already
 * has a LOWER-bound method (strut-and-tie ▽, a static/safe solution) and elastic
 * plate FEM (▦); it lacks the UPPER-bound (kinematic) limit-analysis side:
 *   • Yield-line theory for RC slabs (Johansen work method)
 *   • Plastic collapse of beams (mechanism loads)
 *   • Concrete-plasticity effectiveness factor ν (Nielsen) + plastic shear
 *
 * Bound theorems (Drucker/Prager): the LOWER-bound (static) theorem → any
 * statically admissible stress field gives a SAFE (≤ true) collapse load
 * (strut-and-tie). The UPPER-bound (kinematic) theorem → any admissible collapse
 * mechanism gives an UNSAFE (≥ true) load; the lowest mechanism governs
 * (yield-line). They coincide at the true plastic limit load.
 *
 * Units: moments m as moment-capacity PER UNIT WIDTH (kN·m/m) for slabs, Mp
 * (kN·m) for beams, spans in m, loads w (kN/m² slabs, kN/m beams), fc in MPa.
 * Sign: collapse loads returned positive.
 */

// ── Yield-line: rectangular slab, UDL, isotropic bottom moment m ────────────
// Uniform top (negative) moment = i·m on every continuous edge (i = 0 → simply
// supported). Johansen formula, exact at all tested limits (SS/fixed strips,
// SS/fixed square):
//   w_u = (24·m/Lx²)·(1+i) / [√(3 + (Lx/Ly)²) − Lx/Ly]²
export type SlabSupport = "SS" | "FIXED" | "CONTINUOUS";
export interface YieldLineRectInputs {
  Lx: number;        // short span (m)
  Ly: number;        // long span (m)
  m: number;         // positive (bottom) yield moment per unit width (kN·m/m)
  i?: number;        // top/bottom moment ratio on continuous edges (default 0 = SS)
}
export interface YieldLineRectResult {
  wu: number;        // collapse UDL (kN/m²)
  ratio: number;     // Lx/Ly
  kappa: number;     // [√(3+r²) − r]²  (aspect coefficient)
  mRequired: (w: number) => number;  // inverse: required m for a given service-factored w
  mode: string;
}
export function yieldLineRect(inp: YieldLineRectInputs): YieldLineRectResult {
  const { Lx, Ly, m } = inp;
  const i = inp.i ?? 0;
  const r = Lx / Ly;                       // ≤ 1 (Lx is short)
  const kappa = Math.pow(Math.sqrt(3 + r * r) - r, 2);
  const wu = (24 * m / (Lx * Lx)) * (1 + i) / kappa;
  const mRequired = (w: number) => (w * Lx * Lx * kappa) / (24 * (1 + i));
  return Object.freeze({
    wu, ratio: r, kappa, mRequired,
    mode: i > 0 ? "mekanisme garis-leleh dengan kontinuitas tepi (i·m)" : "mekanisme garis-leleh tumpuan sederhana",
  });
}

// ── Yield-line: one-way strip / plastic beam collapse (UDL or central point) ─
export type BeamRestraint = "SS" | "PROPPED" | "FIXED";
export type BeamLoad = "UDL" | "POINT_MID";
export interface BeamCollapseInputs {
  Mp: number;        // plastic moment capacity (kN·m); for strips use moment/width
  L: number;         // span (m)
  restraint: BeamRestraint;
  load: BeamLoad;
  MpSupport?: number;   // support plastic moment if ≠ Mp (default = Mp for FIXED/PROPPED)
}
export interface BeamCollapseResult {
  Pc: number;        // collapse load: w (kN/m) for UDL, P (kN) for POINT_MID
  coefficient: number;  // dimensionless mechanism coefficient
  hinges: number;
  mode: string;
}
export function beamCollapse(inp: BeamCollapseInputs): BeamCollapseResult {
  const { Mp, L, restraint, load } = inp;
  const Mps = inp.MpSupport ?? Mp;
  if (load === "UDL") {
    // Plastic mechanism work equation, midspan + support hinges.
    switch (restraint) {
      case "SS":      // w·L²/8 = Mp
        return Object.freeze({ Pc: 8 * Mp / (L * L), coefficient: 8, hinges: 1, mode: "sendi tengah bentang" });
      case "FIXED":   // w·L²/16 = ... → w = 8(Mp+Mps)/L²  (=16Mp/L² if Mps=Mp)
        return Object.freeze({ Pc: 8 * (Mp + Mps) / (L * L), coefficient: 8 * (Mp + Mps) / Mp, hinges: 3, mode: "sendi 2 tumpuan + tengah" });
      case "PROPPED": { // fixed end (Mps) + sagging span hinge (Mp): solve
        // (wL/2 − Mps/L)² = 2·w·Mp  →  w = 2[(Mps+2Mp)+√((Mps+2Mp)²−Mps²)]/L²
        // (Mps=Mp ⇒ 11.657·Mp/L²; the classic exact coefficient)
        const s = Mps + 2 * Mp;
        const wc = 2 * (s + Math.sqrt(s * s - Mps * Mps)) / (L * L);
        return Object.freeze({ Pc: wc, coefficient: wc * L * L / Mp, hinges: 2, mode: "sendi tumpuan jepit + dalam bentang" });
      }
    }
  } else { // POINT_MID
    switch (restraint) {
      case "SS":      // P·L/4 = Mp
        return Object.freeze({ Pc: 4 * Mp / L, coefficient: 4, hinges: 1, mode: "sendi di bawah beban" });
      case "FIXED":   // P·L/8 with 3 hinges → P = 4(Mp+Mps)/L (=8Mp/L if equal)
        return Object.freeze({ Pc: 4 * (Mp + Mps) / L, coefficient: 4 * (Mp + Mps) / Mp, hinges: 3, mode: "sendi 2 tumpuan + beban" });
      case "PROPPED": { // P = 2(2Mp+Mps)/L  (hinge at load + fixed end)
        const pc = 2 * (2 * Mp + Mps) / L;
        return Object.freeze({ Pc: pc, coefficient: pc * L / Mp, hinges: 2, mode: "sendi jepit + beban" });
      }
    }
  }
  // unreachable
  return Object.freeze({ Pc: 0, coefficient: 0, hinges: 0, mode: "—" });
}

// ── Concrete plasticity: effectiveness factor ν + plastic shear (Nielsen) ───
export interface EffFactorInputs {
  fc: number;        // cylinder strength (MPa)
  bw?: number;       // web width (mm) — for plastic shear capacity
  z?: number;        // internal lever arm (mm)
  theta?: number;    // compression-strut angle (deg), default 45
}
export interface EffFactorResult {
  nu: number;        // effectiveness factor (compression), Nielsen
  fcEff: number;     // ν·fc (MPa)
  tauPlastic: number;// max plastic shear stress ½·ν·fc at θ=45° (MPa)
  Vplastic: number;  // plastic (web-crushing) shear capacity (kN), if bw,z given
}
export function effectivenessFactor(inp: EffFactorInputs): EffFactorResult {
  const { fc } = inp;
  // Nielsen: ν = 0.7 − fc/200 (fc in MPa), for shear/web compression; bounded.
  const nu = Math.max(0.4, Math.min(1, 0.7 - fc / 200));
  const fcEff = nu * fc;
  const th = ((inp.theta ?? 45) * Math.PI) / 180;
  // plastic shear stress (diagonal compression) τ = ν·fc·sinθ·cosθ; max ½νfc @45°
  const tau = fcEff * Math.sin(th) * Math.cos(th);
  const tauPlastic = 0.5 * fcEff;
  const Vplastic = inp.bw && inp.z ? (tau * inp.bw * inp.z) / 1000 : 0;
  return Object.freeze({ nu, fcEff, tauPlastic, Vplastic });
}

// ── Bound-theorem classifier (for the report / teaching) ───────────────────
export type LimitMethod = "STATIC_LOWER" | "KINEMATIC_UPPER";
export function boundCharacter(method: LimitMethod): { safe: boolean; note: string } {
  return method === "STATIC_LOWER"
    ? { safe: true, note: "Teorema batas-bawah (statis): medan tegangan admisibel → beban runtuh AMAN (≤ sejati). Contoh: strut-and-tie." }
    : { safe: false, note: "Teorema batas-atas (kinematik): mekanisme runtuh admisibel → beban runtuh TAK-AMAN (≥ sejati); mekanisme terendah menentukan. Contoh: garis-leleh." };
}
