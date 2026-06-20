// ============================================================
// PRESTRESS-CALC — Shared TypeScript Types
// All dimensions in mm, forces in kN, moments in kN·m, stresses in MPa
// ============================================================

// ─── Global Settings Types ───────────────────────────────────
export type UnitSystem     = "SI" | "US";
export type FormulaVariant = "STANDARD" | "KERNEL";
export type PrestressType  = "FULL" | "PARTIAL";
export type ACIBeamClass   = "U" | "T" | "C";
/** Construction method — POST_TENSIONED is the prioritized default. */
export type PrestressSystem = "PRETENSIONED" | "POST_TENSIONED";
/** BS 8110 member class (Kong & Evans Ch.9) — parallel to ACIBeamClass. */
export type BSMemberClass  = "1" | "2" | "3";

// ─── Input Interfaces ────────────────────────────────────────

/**
 * I-girder cross-section geometry.
 * Supports rectangular flanges (h4=h5=0) or trapezoidal fillets.
 *
 *  ┌──────── b1 ────────┐  ← top flange
 *  │         h1         │
 *  └──┐  h5  ┌──────────┘  ← top fillet (trapezoid: b1→b2)
 *     │      │
 *     │ b2,h2│            ← web (rectangle)
 *     │      │
 *  ┌──┘  h4  └──────────┐  ← bottom fillet (trapezoid: b2→b3)
 *  │         h3         │
 *  └──────── b3 ────────┘  ← bottom flange
 */
export interface IGirderGeometry {
  b1: number; // top flange width (mm)
  h1: number; // top flange thickness (mm)
  h5?: number; // top fillet height (mm) — 0 = rectangular (no fillet)
  b2: number; // web width (mm)
  h2: number; // web height (mm) — net between fillets
  h4?: number; // bottom fillet height (mm) — 0 = rectangular (no fillet)
  b3: number; // bottom flange width (mm)
  h3: number; // bottom flange thickness (mm)
  /** Total girder height = h1 + (h5??0) + h2 + (h4??0) + h3 */
  readonly hTotal?: number;
}

/** Deck slab (composite topping) */
export interface DeckGeometry {
  thicknessTd: number; // deck slab thickness (mm)
  widthBeff: number;   // effective deck width (mm)
  fcDeck: number;      // f'c deck (MPa)
  fcGirder: number;    // f'c girder at service (MPa)
}

export type TendonProfileType = "STRAIGHT" | "HARPED" | "PARABOLIC";

/** One horizontal row of strands inside the girder section */
export interface TendonRow {
  id: number;
  strandCount: number;   // number of strands in this row
  yFromBottom: number;   // height from bottom fiber to row centroid (mm)
}

export interface TendonConfig {
  profileType: TendonProfileType;
  rows: TendonRow[];
  singleStrandArea: number;   // area of ONE strand (mm²)
  jackingRatio: number;       // fraction of fpu at jacking (0–1)
  fpu: number;                // ultimate strand stress (MPa)
  fpy: number;                // yield strand stress (MPa)
  Eps: number;                // modulus of strand (MPa)
  eccentricitySupport: number;// e at support (mm)
  holdDownRatio: number;      // x_g/L for harped (0 = not applicable)
  strandDiameter: number;     // nominal diameter (mm) for diagrams
  /** Computed by store pipeline — do not set manually */
  totalStrands?: number;
  eccentricityMidspan?: number;
}

export interface TendonResultant {
  totalStrands: number;
  Aps: number;
  yResultant: number;
  eccentricityMidspan: number;
}

export interface MaterialProps {
  fci: number;      // f'ci at transfer (MPa)
  fc: number;       // f'c girder at service (MPa)
  fcDeck: number;   // f'c deck (MPa)
  fpu: number;      // strand ultimate (MPa)
  fpy: number;      // strand yield (MPa)
  Eps: number;      // strand modulus (MPa)
  Ec: number;       // girder concrete modulus (MPa) — computed 4700√f'c
  fy: number;       // mild longitudinal steel yield (MPa)
  fys: number;      // stirrup yield (MPa)
  As: number;       // mild longitudinal steel area in tension zone (mm²), 0 = none
}

export interface LoadConfig {
  spanLength: number;       // L (mm)
  gammaConc: number;        // concrete unit weight (kN/m³)
  wSDL: number;             // superimposed dead load (kN/m)
  wLive: number;            // live load (kN/m)
  relativeHumidity: number; // RH (%) for long-term losses
  /** Factored torque at critical section (kN·m); 0 = no torsion check */
  tuTorsion: number;
  /** Torsion lever arm (m) — eccentricity of live load from shear centre */
  eTorsionArm?: number;
  /** Number of spans (1 = simply supported, 2 or 3 = continuous) */
  nSpans?: 1 | 2 | 3;
}

export interface ImmediateLossParams {
  mu: number;              // curvature friction coefficient
  K: number;               // wobble coefficient (/mm)
  deltaSet: number;        // anchorage slip (mm)
  numJackingGroups: number;// N groups jacked sequentially
}

export interface PartialPrestressConfig {
  enabled: boolean;
  beamClass: ACIBeamClass;     // U = uncracked, T = transition, C = cracked
  PPR?: number;                // Partial Prestress Ratio = Aps·fps/(Aps·fps + As·fy)
}

export interface ProjectInfo {
  namaProyek: string;
  noPekerjaan: string;
  perencana: string;
  lokasi: string;
}

/**
 * Optional foundation analysis & design module — included in the full design
 * pipeline & PDF report ONLY when `enabled` is checked (opt-in). Drives the
 * pile/shaft + group + settlement + shallow-bearing engines (books 194–205).
 */
export interface FoundationConfig {
  enabled: boolean;
  install: "DRIVEN" | "BORED";
  shape: "CIRCULAR" | "SQUARE";
  size: number;          // pile diameter/side, m
  length: number;        // embedded length, m
  soil: "CLAY" | "SAND";
  gamma: number;         // kN/m³
  waterDepth: number;    // m
  cu: number;            // kPa
  phi: number;           // deg
  FS: number;
  rows: number; cols: number; spacing: number;
  Pdemand: number;       // factored load on the group, kN
  Bf: number; Lf: number; Df: number;   // shallow footing for bearing check, m
}

export interface ProjectInputs {
  projectInfo: ProjectInfo;
  girder: IGirderGeometry;
  deck: DeckGeometry;
  material: MaterialProps;
  tendon: TendonConfig;
  loads: LoadConfig;
  immediateLoss: ImmediateLossParams;
  partialPrestress: PartialPrestressConfig;
  foundation: FoundationConfig;
}

// ─── Settings (persisted alongside inputs) ───────────────────
export interface AppSettings {
  unitSystem: UnitSystem;
  formulaVariant: FormulaVariant;
  /** Construction method — defaults to POST_TENSIONED (prioritized). */
  prestressSystem: PrestressSystem;
}

// ─── Engine Result Interfaces ────────────────────────────────

export interface GrossSectionProps {
  readonly areaAg: number;
  readonly yb: number;
  readonly yt: number;
  readonly momentOfInertiaIg: number;
  readonly Ztg: number;
  readonly Zbg: number;
  readonly hTotal: number;
  /** Radius of gyration squared: r² = Ig/Ag (mm²) */
  readonly r2: number;
  /** Upper kern distance kt = r²/yb (mm) — Nilson §4.3 */
  readonly kt: number;
  /** Lower kern distance kb = r²/yt (mm) — Nilson §4.3 */
  readonly kb: number;
  /** Flexural efficiency factor ρ = r²/(yt·yb) — Nilson §4.3 (0–1, higher = better) */
  readonly efficiency: number;
}

export interface CompositeSectionProps {
  readonly modularRatioNc: number;
  readonly deckTransformedArea: number;
  readonly compositeAreaAc: number;
  readonly ybc: number;
  readonly ytgc: number;
  readonly yttc: number;
  readonly momentOfInertiaIc: number;
  readonly Zbc: number;
  readonly Ztgc: number;
  readonly Zttc: number;
}

export interface TendonProfilePoint {
  readonly xMm: number;
  readonly eMm: number;
  readonly thetaRad: number;
}

export interface PrestressForces {
  readonly jackingStressMpa: number;
  readonly Pj: number;
  readonly Pi: number;
  readonly frictionProfile: readonly number[];
  readonly afterSlipProfile: readonly number[];
  readonly deltaFR: number;
  readonly deltaAS: number;
  readonly deltaES: number;
  readonly Pe: number;
  /** Effective steel stress after all losses: Pe·1000/Aps (MPa) */
  readonly fse: number;
}

export interface TimeDependentLosses {
  readonly deltaFpSR: number;
  readonly deltaFpCR: number;
  readonly deltaFpR2: number;
  readonly deltaFpLT: number;
  readonly effectivePe: number;
}

export interface MomentResults {
  readonly wSelf: number;
  readonly Mg: number;
  readonly Msdl: number;
  readonly Mlive: number;
  readonly Mservice: number;
  readonly Mu: number;
}

export interface FiberStressResult {
  readonly stage: "Transfer" | "Service";
  readonly fiber: "Top" | "Bottom" | "Deck";
  readonly stressMpa: number;
  /** Standard formula components (for display) */
  readonly terms: {
    axial: number;          // −P/A
    eccentricity: number;   // ±P·e/Z
    moment: number;         // ∓M/Z
  };
  readonly limitCompMpa: number;
  readonly limitTensMpa: number;
  readonly utilizationComp: number;
  readonly utilizationTens: number;
  readonly isSafe: boolean;
  readonly verdict: "AMAN" | "OVERSTRESS";
}

export interface SLSCheckResults {
  readonly transfer: {
    sigmaTop: number;
    sigmaBot: number;
    topFiber: FiberStressResult;
    botFiber: FiberStressResult;
    isStagesSafe: boolean;
  };
  readonly service: {
    sigmaTop: number;
    sigmaBot: number;
    sigmaDeck: number;
    topFiber: FiberStressResult;
    botFiber: FiberStressResult;
    deckFiber: FiberStressResult;
    isStageSafe: boolean;
  };
  readonly isOverallSafe: boolean;
  /** ACI beam class used for service tension limit */
  readonly beamClass: ACIBeamClass;
}

export interface ULSFlexureResult {
  readonly fps: number;
  readonly a: number;
  readonly c: number;
  readonly Mn: number;
  readonly phiMn: number;
  readonly Mu: number;
  readonly isAdequate: boolean;
  /** 1.2Mcr check (ACI 18.8.2) */
  readonly Mcr_12: number;
  readonly govMn: number;   // max(φMn, 1.2Mcr)
  readonly is12McrOk: boolean;
}

export interface ULSShearResult {
  readonly Vp: number;
  readonly Vci: number;
  readonly Vcw: number;
  readonly Vc: number;
  readonly AvPerS: number;
  readonly Vu: number;
  readonly Mcr: number;
  readonly dv: number;
  readonly bw: number;
  readonly isAdequate: boolean;
}

export interface DeflectionResult {
  readonly deltaCamber: number;
  readonly deltaSW: number;
  readonly deltaDeck: number;
  readonly deltaLive: number;
  readonly deltaTotal: number;
  readonly limitLive: number;
  readonly limitTotal: number;
  readonly liveOk: boolean;
  readonly totalOk: boolean;
}

export interface InterfaceShearResult {
  readonly Vhu: number;
  readonly bvi: number;
  readonly cFactor: number;
  readonly muFactor: number;
  readonly phiVni_conc: number;
  readonly AvfPerS_req: number;
  readonly sMax: number;
  readonly isAdequate: boolean;
}

export interface LoadBalanceResult {
  /** Equivalent upward UDL from prestress (kN/m) */
  readonly w_bal: number;
  /** Balanced moment at midspan = Pe·e (kN·m) */
  readonly M_bal: number;
  /** Percentage of total service moment that is balanced (%) */
  readonly percentBalance: number;
}

export interface TransferLengthResult {
  readonly lt_ACI: number;    // ACI fse×db/3 (mm)
  readonly lt_50db: number;   // Conservative 50×db (mm)
  readonly lt_mm: number;     // Governing (mm)
  readonly ld_mm: number;     // Development length (mm)
  readonly lt_db: number;     // lt/db
  readonly ld_db: number;     // ld/db
  readonly fse: number;
  readonly fps: number;
  readonly db: number;
}

export interface TorsionResult {
  readonly phi: number;
  readonly T_th: number;
  readonly T_cr: number;
  readonly isNegligible: boolean;
  readonly theta_deg: number;
  readonly Ao: number;
  readonly At_per_s: number;
  readonly Al_req: number;
  readonly combinedRatio: number;
  readonly isAdequate: boolean;
}

export interface AnchorageZoneResult {
  readonly T_burst: number;
  readonly d_burst: number;
  readonly Ast_burst: number;
  readonly T_spall: number;
  readonly Ast_spall: number;
  readonly T_edge: number;
  readonly Ast_edge: number;
  // NCHRP 356 / AASHTO §5.8.4 — local zone & general-zone extras
  readonly alphaDeg: number;
  readonly Pdev: number;
  readonly bearingStress: number;
  readonly confinementRatio: number;
  readonly bearingAllow: number;
  readonly bearingResistance: number;
  readonly bearingOk: boolean;
  readonly compStressAhead: number;
  readonly compLimit: number;
  readonly compOk: boolean;
  readonly approxMethodApplicable: boolean;
}

export interface CrackWidthResult {
  readonly w_cr: number;
  readonly w_limit: number;
  readonly exposure: string;
  readonly isOk: boolean;
  readonly sMax_ACI318: number;
}

export interface ContinuousBeamResult {
  /** Number of spans */
  readonly nSpans: number;
  /** Primary moment = Pe·e (kN·m) */
  readonly M1_midspan: number;
  /** Secondary moment from redundant reactions at interior support (kN·m) */
  readonly M2_support: number;
  /** Total hyperstatic moment at interior support (kN·m) */
  readonly M_total_support: number;
  /** Concordant tendon e at interior support (mm) — no secondary moments */
  readonly e_concordant: number;
  /** C-line shift at interior support = M2/Pe (mm) */
  readonly cLineShift: number;
}

export interface DesignResults {
  readonly gross: GrossSectionProps;
  readonly composite: CompositeSectionProps;
  readonly moments: MomentResults;
  readonly prestress: PrestressForces;
  readonly tdLosses: TimeDependentLosses;
  readonly sls: SLSCheckResults;
  readonly ulsFlexure: ULSFlexureResult;
  readonly ulsShear: ULSShearResult;
  readonly interfaceShear: InterfaceShearResult;
  readonly deflection: DeflectionResult;
  readonly loadBalance: LoadBalanceResult;
  readonly transferLength: TransferLengthResult;
  readonly anchorageZone: AnchorageZoneResult;
  readonly torsion?: TorsionResult;
  readonly crackWidth?: CrackWidthResult;
  readonly continuousBeam?: ContinuousBeamResult;
  /** Flexural load stages & changes in prestress force (Nilson §1.7/§3.6) */
  readonly flexuralStages?: import("@/engine/flexuralstages").FlexuralStageResult;
  /** Compression Field Theory shear (Nilson §5.11 / AASHTO general) */
  readonly mcftShear?: import("@/engine/mcft").MCFTResult;
  /** Moment redistribution for continuous members (Nilson §8.10) */
  readonly momentRedistribution?: import("@/engine/continuous").MomentRedistributionResult;
  /** Lump-sum loss estimate (Nilson §6.2) — cross-check of refined losses */
  readonly lumpSumLosses?: import("@/engine/losses").LumpSumLossResult;
  /** BS 8110 ULS flexure (Kong & Evans §9.5) — alternative to ACI */
  readonly bsFlexure?: import("@/engine/bs8110").BSFlexureResult;
  /** BS 8110 ULS shear (Kong & Evans §9.6) — Vco/Vcr */
  readonly bsShear?: import("@/engine/bs8110").BSShearResult;
  /** BS 8110 member-class permissible service stresses (§9.1) */
  readonly bsClass?: import("@/engine/bs8110").BSClassLimits;
  /** Partial Prestress Ratio = Aps·fps / (Aps·fps + As·fy) */
  readonly PPR?: number;
  /** Thermal gradient self-equilibrating stresses (Libby §11-5 / AASHTO §3.12.3) */
  readonly thermal?: import("@/engine/thermal").ThermalGradientResult;
  /** PT tendon elongation & gage force for field control (Libby §16-7) */
  readonly elongation?: import("@/engine/elongation").ElongationResult;
  /** Preliminary design — min prestress force & section moduli (Libby §9-6..§9-8) */
  readonly preliminary?: import("@/engine/preliminary").PreliminaryResult;
  /** Pressure line / C-line migration (Libby §4-3..§4-5) */
  readonly pressureLine?: import("@/engine/preliminary").PressureLineResult;
  /** Eurocode 2 (EN 1992-1-1) design code — M.K. Hurst 2nd ed. */
  readonly ec2?: import("@/engine/ec2").EC2Result;
  /** Dual design — Full (Class U) vs LRFD-Partial (Class C) side-by-side */
  readonly dualMethod?: import("@/engine/dualmethod").DualMethodResult;
  /** Foundation analysis & design (opt-in via foundation.enabled) — books 194–205 */
  readonly foundation?: FoundationResults;
}

/** Bundled foundation results — present only when foundation.enabled. */
export interface FoundationResults {
  readonly axial: import("@/engine/pilefoundation").PileAxialResult;
  readonly group: import("@/engine/pilefoundation").PileGroupCapResult;
  readonly settlement: import("@/engine/pilefoundation").PileSettlementResult;
  readonly bearing: import("@/engine/foundationdynamics").BearingResult;
  readonly demandPerPile: number;   // kN
  readonly axialOk: boolean;
}
