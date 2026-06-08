/**
 * AASHTO LRFD Live-Load Distribution Factors (LLDF)
 * "Bridge Superstructure Design" Ch.3 — AASHTO LRFD §4.6.2.2 (Type (k):
 * precast I / bulb-tee / spread-box girders with a cast-in-place deck).
 *
 * Converts the total lane live load into the share carried by ONE girder — the
 * `girderDF` that the SNI 1725 lane-load generator (bridgeload.ts) previously
 * required as a manual input.  Computed for the four cases (interior/exterior ×
 * moment/shear) and one vs two-or-more loaded lanes; the governing (largest)
 * value controls.
 *
 * Longitudinal stiffness parameter:
 *   K_g = n·(I + A·e_g²),  n = E_girder/E_deck,  e_g = girder–deck centroid dist.
 *
 * Interior, moment (mm units):
 *   1 lane : 0.06 + (S/4300)^0.4·(S/L)^0.3·(K_g/(L·t_s³))^0.1
 *   2+lane : 0.075 + (S/2900)^0.6·(S/L)^0.2·(K_g/(L·t_s³))^0.1
 * Interior, shear:
 *   1 lane : 0.36 + S/7600        2+lane : 0.2 + S/3600 − (S/10700)²
 * Exterior: lever rule (1 lane) and e·g_interior (2+lane),
 *   e_moment = 0.77 + d_e/2800,   e_shear = 0.6 + d_e/3000.
 * Multiple-presence m (lever rule): 1.20 / 1.00 / 0.85 for 1 / 2 / 3 lanes.
 *
 * NOTE: these are AASHTO LRFD code equations (not a book's worked numbers).
 * Internal units: mm. Distribution factors are dimensionless (lanes/girder).
 */

export interface DistributionInputs {
  /** Girder spacing S (mm) */
  S: number;
  /** Span length L (mm) */
  L: number;
  /** Deck slab thickness t_s (mm) */
  ts: number;
  /** Number of girders N_b */
  Nb: number;
  /** Overhang: distance from exterior web to interior edge of barrier d_e (mm, + outboard) */
  de: number;
  /** Roadway clear width for the lever rule (mm) — wheel-line geometry */
  wheelGauge: number;

  /** Modular ratio n = E_girder/E_deck */
  n: number;
  /** Girder non-composite moment of inertia I (mm⁴) */
  I: number;
  /** Girder area A (mm²) */
  A: number;
  /** Distance between girder and deck centroids e_g (mm) */
  eg: number;
}

export interface DistributionResult {
  readonly Kg: number;            // longitudinal stiffness parameter (mm⁴)
  // Interior girder
  readonly gM_int_1: number;      // moment, 1 lane
  readonly gM_int_2: number;      // moment, 2+ lanes
  readonly gV_int_1: number;      // shear, 1 lane
  readonly gV_int_2: number;      // shear, 2+ lanes
  // Exterior girder
  readonly e_moment: number;      // exterior moment correction factor
  readonly e_shear: number;       // exterior shear correction factor
  readonly gM_ext_lever: number;  // moment, lever rule (1 lane, with m=1.2)
  readonly gM_ext_2: number;      // moment, 2+ lanes (e·g_int)
  readonly gV_ext_2: number;      // shear, 2+ lanes (e·g_int)
  // Governing
  readonly gMoment: number;       // governing moment DF
  readonly gShear: number;        // governing shear DF
}

export function computeDistribution(inp: DistributionInputs): DistributionResult {
  const { S, L, ts, de, wheelGauge, n, I, A, eg } = inp;

  const Kg = n * (I + A * eg ** 2);
  const stiff = Math.pow(Kg / (L * ts ** 3), 0.1);

  // ── Interior, moment ────────────────────────────────────────
  const gM_int_1 = 0.06 + Math.pow(S / 4300, 0.4) * Math.pow(S / L, 0.3) * stiff;
  const gM_int_2 = 0.075 + Math.pow(S / 2900, 0.6) * Math.pow(S / L, 0.2) * stiff;

  // ── Interior, shear ─────────────────────────────────────────
  const gV_int_1 = 0.36 + S / 7600;
  const gV_int_2 = 0.2 + S / 3600 - (S / 10700) ** 2;

  // ── Exterior, moment ────────────────────────────────────────
  // Lever rule for one lane: reaction of the wheel lines about the first
  // interior girder, with multiple-presence m = 1.20.
  // A wheel line sits (de + overhang−offset); simplified static reaction:
  const leverReaction = wheelGauge > 0 ? (S + de - 600) / S : 1.0; // 600 mm wheel offset
  const gM_ext_lever = 1.20 * Math.max(leverReaction, 0) / 2;
  const e_moment = 0.77 + de / 2800;
  const gM_ext_2 = e_moment * gM_int_2;

  // ── Exterior, shear ─────────────────────────────────────────
  const e_shear = 0.6 + de / 3000;
  const gV_ext_2 = e_shear * gV_int_2;

  // ── Governing ───────────────────────────────────────────────
  const gMoment = Math.max(gM_int_1, gM_int_2, gM_ext_lever, gM_ext_2);
  const gShear = Math.max(gV_int_1, gV_int_2, e_shear * gV_int_1, gV_ext_2);

  return Object.freeze({
    Kg,
    gM_int_1, gM_int_2, gV_int_1, gV_int_2,
    e_moment, e_shear, gM_ext_lever, gM_ext_2, gV_ext_2,
    gMoment, gShear,
  });
}
