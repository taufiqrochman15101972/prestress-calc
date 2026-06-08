/**
 * Fire-Resistance Design Engine
 * PCI Design Handbook 7th Ed. — Ch.10 (Design for Fire Resistance) +
 * Abeles & Bardhan-Roy §16, after ACI 216.1 / IBC.
 *
 * Two complementary checks for a target fire-endurance rating:
 *  (1) PRESCRIPTIVE — minimum equivalent slab thickness (heat-transmission /
 *      insulation criterion) and minimum cover to the prestressing strand
 *      (so the strand stays cool enough), read from the code tables by
 *      aggregate type and rating.
 *  (2) STRENGTH (analytical) — prestressing steel loses strength with
 *      temperature; the strand temperature θ_s follows from the cover and the
 *      fire duration, giving a retained strength f_pu,θ = k_θ·f_pu and a
 *      reduced flexural capacity M_n,θ that must still carry the fire load
 *      combination (≈ 1.0·D + 1.0·L_arc, load factor 1.0 at the fire limit).
 *
 * Restrained members (continuity / axial restraint) develop thrust that boosts
 * the fire endurance; unrestrained simply-supported members rely on the strand
 * retained strength alone → governed by cover.
 *
 * Internal SI: N, mm, MPa, °C.
 * NOTE: table values (thickness, cover) and the k_θ retention curve are the
 * ACI 216 / PCI procedure; the member's own f'c, A_ps follow the project data.
 */

export type Aggregate = "SILICEOUS" | "CARBONATE" | "LIGHTWEIGHT";

export interface FireInputs {
  /** Target fire-endurance rating (hours): 1, 1.5, 2, 3, 4 */
  rating: number;
  /** Concrete aggregate type */
  aggregate: Aggregate;
  /** Member: slab governs by thickness; beam governs by cover */
  isSlab: boolean;
  /** Provided overall thickness / depth (mm) */
  thickness: number;
  /** Provided clear cover to the centroid of the prestressing strand (mm) */
  cover: number;
  /** Restrained (continuity/axial) — boosts endurance */
  restrained: boolean;

  // ── Strength check at the fire limit state ──────────────────
  /** Prestressing steel area A_ps (mm²) */
  Aps: number;
  /** Strand ultimate f_pu (MPa) */
  fpu: number;
  /** Effective depth to strand d_p (mm) */
  dp: number;
  /** Compression-face width b (mm) */
  b: number;
  /** Concrete f'c (MPa) */
  fc: number;
  /** Applied moment at the fire limit state (kN·m, ≈1.0D + 1.0L_arc) */
  Mfire: number;
  /** Estimated strand temperature θ_s (°C) at the rating — from ACI 216 charts
   *  (helper estimate provided if left at 0) */
  strandTemp: number;
}

export interface FireResult {
  readonly reqThickness: number;   // min equivalent thickness for rating (mm)
  readonly reqCover: number;       // min cover to strand for rating (mm)
  readonly thicknessOk: boolean;
  readonly coverOk: boolean;
  readonly strandTempUsed: number; // °C
  readonly kTheta: number;         // retained-strength factor f_pu,θ/f_pu
  readonly fpuTheta: number;       // retained strand strength (MPa)
  readonly aTheta: number;         // Whitney block at fire (mm)
  readonly MnFire: number;         // reduced flexural capacity (kN·m)
  readonly demandCapacityRatio: number; // Mfire / MnFire
  readonly strengthOk: boolean;
  readonly isAdequate: boolean;
  readonly note: string;
}

/** Min equivalent thickness (mm) for fire rating — ACI 216 (siliceous base). */
function minThickness(rating: number, agg: Aggregate): number {
  // siliceous baseline (in→mm): 1h 3.5", 1.5h 4.3", 2h 5.0", 3h 6.2", 4h 7.0"
  const base: Record<string, number> = { "1": 89, "1.5": 109, "2": 127, "3": 157, "4": 178 };
  const key = String(rating);
  let t = base[key] ?? 89 + (rating - 1) * 30;
  if (agg === "CARBONATE") t *= 0.97;       // carbonate slightly better
  if (agg === "LIGHTWEIGHT") t *= 0.83;     // lightweight much better insulator
  return Math.round(t);
}

/** Min cover to strand (mm) for fire rating — ACI 216 (restrained vs not). */
function minCover(rating: number, restrained: boolean, isSlab: boolean): number {
  // unrestrained beams need the most cover; restrained least.
  const beamUnres: Record<string, number> = { "1": 38, "1.5": 45, "2": 64, "3": 70, "4": 76 };
  const beamRes: Record<string, number> = { "1": 25, "1.5": 25, "2": 25, "3": 32, "4": 38 };
  const slabUnres: Record<string, number> = { "1": 25, "1.5": 25, "2": 32, "3": 38, "4": 50 };
  const slabRes: Record<string, number> = { "1": 19, "1.5": 19, "2": 19, "3": 25, "4": 25 };
  const key = String(rating);
  const tbl = isSlab ? (restrained ? slabRes : slabUnres) : (restrained ? beamRes : beamUnres);
  return tbl[key] ?? 38;
}

/** Retained-strength factor of cold-drawn prestressing steel vs temperature. */
function retentionFactor(theta: number): number {
  if (theta <= 150) return 1.0;
  if (theta >= 700) return 0.0;
  // ~1.0 at 150°C, ~0.5 at ~425°C, ~0 at 700°C (ACI/PCI strand curve)
  return Math.max(0, 1 - (theta - 150) / (700 - 150));
}

/** Estimate strand temperature from cover & rating (monotonic helper). */
function estimateStrandTemp(rating: number, cover: number): number {
  // hotter with longer fire, cooler with more cover
  const base = 250 + 110 * rating;       // °C at ~25 mm cover
  return Math.max(20, base - 6 * Math.max(cover - 25, 0));
}

export function computeFireResistance(inp: FireInputs): FireResult {
  const {
    rating, aggregate, isSlab, thickness, cover, restrained,
    Aps, fpu, dp, b, fc, Mfire,
  } = inp;

  const reqThickness = minThickness(rating, aggregate);
  const reqCover = minCover(rating, restrained, isSlab);
  const thicknessOk = thickness >= reqThickness;
  const coverOk = cover >= reqCover;

  const strandTempUsed = inp.strandTemp > 0 ? inp.strandTemp : estimateStrandTemp(rating, cover);
  const kTheta = retentionFactor(strandTempUsed);
  const fpuTheta = kTheta * fpu;

  // Reduced flexural capacity at the fire limit state (no φ; material at temp)
  const T = Aps * fpuTheta;
  const aTheta = T / (0.85 * fc * b);
  const MnFire = (T * (dp - aTheta / 2)) / 1e6;     // kN·m
  const demandCapacityRatio = MnFire > 0 ? Mfire / MnFire : Infinity;
  const strengthOk = demandCapacityRatio <= 1.0;

  const isAdequate = thicknessOk && coverOk && strengthOk;
  const note = restrained
    ? "Restrained: thrust kontinuitas menambah ketahanan; cover lebih kecil diizinkan."
    : "Unrestrained: hanya andalkan kekuatan sisa strand → cover menentukan.";

  return Object.freeze({
    reqThickness, reqCover, thicknessOk, coverOk,
    strandTempUsed, kTheta, fpuTheta, aTheta, MnFire,
    demandCapacityRatio, strengthOk, isAdequate, note,
  });
}
