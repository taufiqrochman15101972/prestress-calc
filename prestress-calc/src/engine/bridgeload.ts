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

// ════════════════════════════════════════════════════════════════
// AASHTO vehicular live load — PCI Bridge Design Manual §8.11 + Ch.7
// (HS20 design truck, HL-93 = truck/tandem + 0.64 kip/ft lane,
//  LRFD fatigue truck with 30-ft constant axle spacing)
//
// Closed-form per-lane maxima at any section x of a SIMPLE span
// (PCI BDM Tables 8.11.1-1/2, 8.11.3-1 — formulas in ft·kip / kip,
// converted to SI on output):
//   HS20 truck  M(x): x/L ≤ ⅓ : 72x[(L−x)−9.33]/L          (L ≥ 28 ft)
//               x/L > ⅓ : 72x[(L−x)−4.67]/L − 112          (x ≥ 14 ft)
//   HS20 truck  V(x) = max{ 72[(L−x)−9.33]/L ,  72[(L−x)−4.67]/L − 8 }
//   Tandem (2×25 kip @ 4 ft):  M = 50x(L−x−2)/L ;  V = 50(L−x−2)/L
//   Lane 0.64 k/ft:  M = 0.64x(L−x)/2 ;  V = 0.64(L−x)²/(2L)
//   Fatigue truck M(x): x/L ≤ 0.241 : 72x[(L−x)−18.22]/L   (L ≥ 44 ft)
//               x/L > 0.241 : 72x[(L−x)−11.78]/L − 112
//   HL-93: M = max(truck, tandem)·(1+IM) + lane, IM = 0.33 (fatigue 0.15)
//
// Output feeds the per-girder design via the LRFD distribution factor
// g (see engine/distribution.ts) — drop-in alternative to the SNI "D"
// load above. Internal: US formulas, SI in/out (m, kN, kN·m).
// ════════════════════════════════════════════════════════════════

const FT = 0.3048;            // m per ft
const FTKIP = 1.355818;       // kN·m per ft·kip
const KIP = 4.448222;         // kN per kip

export interface AashtoLiveLoadInputs {
  /** Simple-span length L (m) */
  L: number;
  /** Section position ratio x/L for moment (0.5 = midspan governs) */
  xRatio: number;
  /** Moment distribution factor g_M (lanes/girder), from distribution.ts */
  gM: number;
  /** Shear distribution factor g_V (lanes/girder) */
  gV: number;
  /** Dynamic load allowance on truck/tandem (LRFD 0.33) */
  IM: number;
}

export interface AashtoLiveLoadResult {
  // per-lane, NO impact (kN·m / kN)
  readonly M_truck: number;
  readonly M_tandem: number;
  readonly M_lane: number;
  readonly V_truck: number;
  readonly V_tandem: number;
  readonly V_lane: number;
  readonly M_fatigue: number;     // fatigue truck, per lane, no impact
  // HL-93 combination per lane (incl. IM on vehicle)
  readonly governsVehicle: "TRUCK" | "TANDEM";
  readonly M_HL93_lane: number;
  readonly V_HL93_lane: number;
  // per girder (× g)
  readonly M_HL93_girder: number;
  readonly V_HL93_girder: number;
  readonly M_fatigue_girder: number; // incl. 15% IM, × g_M
  /** Equivalent uniform load giving the same girder moment (kN/m) */
  readonly wLive_equiv: number;
}

/** HS20 truck per-lane maximum moment at x (ft) on span L (ft), ft·kip. */
export function hs20TruckMoment(L: number, x: number): number {
  const xr = Math.min(x, L - x) / L;             // symmetric
  const xs = Math.min(x, L - x);
  if (L < 28) {
    // span shorter than the 14+14 ft axle train — single 32-kip axle governs
    return (32 * xs * (L - xs)) / L;
  }
  void xr;
  const m1 = (72 * xs * ((L - xs) - 9.33)) / L;            // all 3 axles on span
  const m2 = (72 * xs * ((L - xs) - 4.67)) / L - 112;      // rear axle pair
  return Math.max(m1, m2, 0);                               // envelope of the two
}

/** HS20 truck per-lane maximum shear at x (ft) on span L (ft), kip. */
export function hs20TruckShear(L: number, x: number): number {
  if (L < 28) return (32 * (L - x)) / L;
  const v1 = (72 * ((L - x) - 9.33)) / L;        // full train on span
  const v2 = (72 * ((L - x) - 4.67)) / L - 8;    // rear axles only
  return Math.max(v1, v2, 0);
}

/** LRFD design tandem (2 × 25 kip @ 4 ft) maximum moment, ft·kip. */
export function tandemMoment(L: number, x: number): number {
  const xs = Math.min(x, L - x);
  if (L <= 4) return (50 * xs * (L - xs)) / L / 2;
  return (50 * xs * (L - xs - 2)) / L;
}

/** LRFD design tandem maximum shear at x, kip. */
export function tandemShear(L: number, x: number): number {
  if (L <= 4) return 25;
  return Math.max((50 * (L - x - 2)) / L, 0);
}

/** LRFD fatigue truck (32-kip axles @ 30 ft) maximum moment, ft·kip. */
export function fatigueTruckMoment(L: number, x: number): number {
  const xs = Math.min(x, L - x);
  const xr = xs / L;
  if (L < 44) {
    // rear+front cannot both be on a short span at full effect — use the
    // two-axle expression when valid, else single axle
    if (L >= 28 && xs >= 14) return (72 * xs * ((L - xs) - 11.78)) / L - 112;
    return (32 * xs * (L - xs)) / L;
  }
  if (xr <= 0.241) return (72 * xs * ((L - xs) - 18.22)) / L;
  return (72 * xs * ((L - xs) - 11.78)) / L - 112;
}

export function computeAashtoLiveLoad(inp: AashtoLiveLoadInputs): AashtoLiveLoadResult {
  const Lft = inp.L / FT;
  const xM = inp.xRatio * Lft;          // moment section (ft)
  const xV = 0;                         // shear at the support face → x = 0

  const M_truck = hs20TruckMoment(Lft, xM) * FTKIP;
  const M_tandem = tandemMoment(Lft, xM) * FTKIP;
  const M_lane = ((0.64 * xM * (Lft - xM)) / 2) * FTKIP;
  const V_truck = hs20TruckShear(Lft, xV) * KIP;
  const V_tandem = tandemShear(Lft, xV) * KIP;
  const V_lane = ((0.64 * (Lft - xV) ** 2) / (2 * Lft)) * KIP;
  const M_fatigue = fatigueTruckMoment(Lft, xM) * FTKIP;

  const governsVehicle: "TRUCK" | "TANDEM" = M_tandem > M_truck ? "TANDEM" : "TRUCK";
  const M_veh = Math.max(M_truck, M_tandem);
  const V_veh = Math.max(V_truck, V_tandem);
  const M_HL93_lane = M_veh * (1 + inp.IM) + M_lane;
  const V_HL93_lane = V_veh * (1 + inp.IM) + V_lane;

  const M_HL93_girder = M_HL93_lane * inp.gM;
  const V_HL93_girder = V_HL93_lane * inp.gV;
  const M_fatigue_girder = M_fatigue * 1.15 * inp.gM;   // fatigue IM = 15%

  const wLive_equiv = (8 * M_HL93_girder) / inp.L ** 2;

  return Object.freeze({
    M_truck, M_tandem, M_lane, V_truck, V_tandem, V_lane, M_fatigue,
    governsVehicle, M_HL93_lane, V_HL93_lane,
    M_HL93_girder, V_HL93_girder, M_fatigue_girder,
    wLive_equiv,
  });
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
