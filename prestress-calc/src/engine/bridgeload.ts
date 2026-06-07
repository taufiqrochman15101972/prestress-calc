/**
 * Bridge Live-Load Generator — SNI 1725:2016 / RSNI T-02-2005 "D" Lane Load
 * Ir. Soetoyo, "Konstruksi Beton Pratekan" §9 (Beban BTR + BTG) — the
 * Indonesian bridge live-load model that the project's generic `wLive`
 * input did not previously generate.
 *
 * Lane load "D" (governs girder design):
 *   • BTR — Beban Terbagi Rata (uniformly distributed lane load), kPa:
 *       L ≤ 30 m  → q = 9.0 kPa
 *       L > 30 m  → q = 9.0·(0.5 + 15/L) kPa
 *   • BGT — Beban Garis Terpusat (knife-edge line load):
 *       p = 49.0 kN/m  (× dynamic allowance)
 *   • FBD — Faktor Beban Dinamis (Dynamic Load Allowance), on BGT only:
 *       L ≤ 50 m              → 0.40
 *       50 < L < 90 m         → 0.40 − 0.0025·(L−50)   (linear)
 *       L ≥ 90 m              → 0.30
 *
 * Truck load "T" (Beban Truk = 500 kN) — for short spans / local slab
 * effects — reported for reference.
 *
 * Mid-span simple-span effects per girder (tributary width b_trib):
 *   q_line = q · b_trib              [kN/m]
 *   P_knife = p · b_trib             [kN]   (knife edge across the girder)
 *   M_L = q_line·L²/8 + (1+FBD)·P_knife·L/4
 *   V_L = q_line·L/2  + (1+FBD)·P_knife          (knife edge at support)
 *
 * NOTE: q, p, FBD are CODE values (SNI 1725 / RSNI T-02-2005), not the
 * book's worked-example arithmetic — per the project's standing rule.
 * Internal SI: kN, m, kN·m.
 */

export interface BridgeLoadInputs {
  /** Simple-span length L (m) */
  L: number;
  /** Tributary / load distribution width per girder (m) — e.g. girder spacing */
  bTrib: number;
  /**
   * BTR transverse reduction factor (0–1). SNI: 100% over the first 5.5 m of
   * roadway width, 50% beyond. Use 1.0 for a single loaded lane (default).
   */
  btrFactor: number;
  /** Distribution / load fraction carried by this girder (0–1), e.g. from a
   *  lever-rule / DF analysis. Default 1.0 (tributary already accounts for it). */
  girderDF: number;
}

export interface BridgeLoadResult {
  // ── Code intensities ───────────────────────────────────────
  readonly q_kPa: number;       // BTR intensity (kPa)
  readonly p_kNm: number;       // BGT intensity (kN/m)
  readonly FBD: number;         // dynamic load allowance (fraction)
  readonly truckT_kN: number;   // "T" truck total (kN) — reference

  // ── Per-girder line loads ──────────────────────────────────
  readonly qLine: number;       // BTR per girder (kN/m)
  readonly Pknife: number;      // BGT knife edge per girder (kN)

  // ── Mid-span effects (simple span) ─────────────────────────
  readonly M_BTR: number;       // moment from BTR (kN·m)
  readonly M_BGT: number;       // moment from BGT incl. FBD (kN·m)
  readonly M_live: number;      // total live-load moment (kN·m)
  readonly V_BTR: number;       // shear from BTR (kN)
  readonly V_BGT: number;       // shear from BGT incl. FBD (kN)
  readonly V_live: number;      // total live-load shear (kN)

  /** Equivalent uniform live load that gives the same M_live (kN/m) —
   *  drop-in for the main design `wLive` field: w_eq = 8·M_live/L². */
  readonly wLive_equiv: number;
}

/** SNI 1725 BTR intensity (kPa) as a function of span. */
export function btrIntensity(L: number): number {
  return L <= 30 ? 9.0 : 9.0 * (0.5 + 15 / L);
}

/** SNI 1725 / RSNI T-02-2005 dynamic load allowance (FBD) on the BGT. */
export function dynamicAllowance(L: number): number {
  if (L <= 50) return 0.40;
  if (L >= 90) return 0.30;
  return 0.40 - 0.0025 * (L - 50);
}

export function computeBridgeLoad(inp: BridgeLoadInputs): BridgeLoadResult {
  const { L, bTrib, btrFactor, girderDF } = inp;

  const q_kPa = btrIntensity(L);
  const p_kNm = 49.0;              // BGT intensity (SNI 1725)
  const FBD = dynamicAllowance(L);
  const truckT_kN = 500.0;         // "T" truck (reference)

  // Per-girder line loads
  const qLine = q_kPa * bTrib * btrFactor * girderDF;   // kN/m
  const Pknife = p_kNm * bTrib * girderDF;              // kN

  // Simple-span mid-span moment
  const M_BTR = (qLine * L ** 2) / 8;
  const M_BGT = (1 + FBD) * (Pknife * L) / 4;
  const M_live = M_BTR + M_BGT;

  // Support shear (BGT knife edge placed at the support for V_max)
  const V_BTR = (qLine * L) / 2;
  const V_BGT = (1 + FBD) * Pknife;
  const V_live = V_BTR + V_BGT;

  const wLive_equiv = (8 * M_live) / L ** 2;

  return Object.freeze({
    q_kPa, p_kNm, FBD, truckT_kN,
    qLine, Pknife,
    M_BTR, M_BGT, M_live,
    V_BTR, V_BGT, V_live,
    wLive_equiv,
  });
}
