/**
 * Strand & Multi-Strand PT Tendon Database
 * Seven-wire prestressing strand per ASTM A416/A416M (AASHTO M203):
 * Grade 1725 (250 ksi) and Grade 1860 (270 ksi), low-relaxation.
 *
 *   MBL (minimum breaking load) = f_pu × A_ps
 *   f_py = 0.90·f_pu (low-relaxation)  [0.85·f_pu if stress-relieved]
 *   mass = A_ps × 7.85×10⁻³ kg/m
 *
 * Multi-strand post-tensioning units (the suite's prioritized system):
 * commercial anchorage families come in 4/7/12/19/22/27/31/37-strand
 * units. Duct size follows AASHTO LRFD §5.4.6.2: internal duct area
 * ≥ 2.5 × total strand area (fill ratio ≤ 0.40), rounded up to 5 mm.
 *
 * All values SI: mm, mm², MPa, kN, kg/m.
 */

export interface StrandType {
  id: string;
  /** Display name, e.g. `12.7 mm (0.5") G270` */
  name: string;
  diameterMm: number;
  areaMm2: number;
  /** f_pu (MPa) — 1725 = Grade 250, 1860 = Grade 270 */
  fpu: number;
  /** f_py = 0.90·f_pu, low-relaxation (MPa) */
  fpy: number;
  /** Minimum breaking load = f_pu·A_ps (kN) */
  mblKn: number;
  /** Nominal mass (kg/m) */
  massKgM: number;
}

function strand(id: string, name: string, d: number, A: number, fpu: number): StrandType {
  return Object.freeze({
    id, name, diameterMm: d, areaMm2: A, fpu,
    fpy: Math.round(0.90 * fpu),
    mblKn: Math.round((fpu * A) / 100) / 10,
    massKgM: Math.round(A * 7.85e-3 * 1000) / 1000,
  });
}

/** ASTM A416 low-relaxation seven-wire strand catalog */
export const STRAND_DB: readonly StrandType[] = Object.freeze([
  // Grade 1860 (270 ksi) — the modern default
  strand("9.53-1860",  '9.53 mm (3/8") G270',          9.53, 54.8, 1860),
  strand("11.11-1860", '11.11 mm (7/16") G270',       11.11, 74.2, 1860),
  strand("12.70-1860", '12.7 mm (0.5") G270',         12.70, 98.7, 1860),
  strand("13.20-1860", '13.2 mm (0.5" super) G270',   13.20, 107.0, 1860),
  strand("15.24-1860", '15.24 mm (0.6") G270',        15.24, 140.0, 1860),
  // Grade 1725 (250 ksi) — legacy
  strand("12.70-1725", '12.7 mm (0.5") G250',         12.70, 92.9, 1725),
  strand("15.24-1725", '15.24 mm (0.6") G250',        15.24, 139.4, 1725),
]);

export function findStrand(id: string): StrandType | undefined {
  return STRAND_DB.find((s) => s.id === id);
}

// ─── Multi-strand PT tendon units ───────────────────────────

/** Standard commercial anchorage-unit sizes (strands per tendon) */
export const PT_UNIT_SIZES: readonly number[] = Object.freeze([4, 7, 12, 19, 22, 27, 31, 37]);

export interface PTTendonUnit {
  /** Strands per tendon */
  nStrands: number;
  /** Total A_ps of one tendon (mm²) */
  apsMm2: number;
  /** Tendon MBL = n·f_pu·A_ps (kN) */
  mblKn: number;
  /** Max jacking force 0.80·f_pu·A_ps — temporary, at the ram (kN) */
  pMax080: number;
  /** Typical jacking force 0.75·f_pu·A_ps (kN) */
  pJack075: number;
  /** Duct internal Ø from A_duct ≥ 2.5·ΣA_ps, rounded up to 5 mm (mm) */
  ductIdMm: number;
  /** Tendon mass (kg/m) */
  massKgM: number;
}

/** Properties of an n-strand post-tensioning tendon built from `s` */
export function tendonUnit(nStrands: number, s: StrandType): PTTendonUnit {
  const Aps = nStrands * s.areaMm2;
  const ductArea = 2.5 * Aps;                       // AASHTO LRFD §5.4.6.2
  const ductId = Math.ceil(Math.sqrt((4 * ductArea) / Math.PI) / 5) * 5;
  return Object.freeze({
    nStrands,
    apsMm2: Aps,
    mblKn: Math.round((s.fpu * Aps) / 1000),
    pMax080: Math.round(0.80 * s.fpu * Aps / 1000),
    pJack075: Math.round(0.75 * s.fpu * Aps / 1000),
    ductIdMm: ductId,
    massKgM: Math.round(nStrands * s.massKgM * 100) / 100,
  });
}

/** Full unit table for one strand type (for the database tab) */
export function tendonUnitTable(s: StrandType): PTTendonUnit[] {
  return PT_UNIT_SIZES.map((n) => tendonUnit(n, s));
}

/**
 * Suggest a multi-tendon arrangement for a required strand count:
 * fewest tendons using standard unit sizes (largest units first),
 * preferring equal-size tendons when possible.
 */
export function suggestTendonLayout(totalStrands: number): { nTendons: number; unitSize: number; arrangement: string } {
  if (totalStrands <= 0) return { nTendons: 0, unitSize: 0, arrangement: "—" };
  // try equal units: smallest standard unit that fits in ≤ 6 tendons
  for (let k = 1; k <= 6; k++) {
    const per = Math.ceil(totalStrands / k);
    const unit = PT_UNIT_SIZES.find((u) => u >= per);
    if (unit) {
      return { nTendons: k, unitSize: unit, arrangement: `${k} × tendon-${unit} (${k * unit} strand ≥ ${totalStrands})` };
    }
  }
  const max = PT_UNIT_SIZES[PT_UNIT_SIZES.length - 1];
  const k = Math.ceil(totalStrands / max);
  return { nTendons: k, unitSize: max, arrangement: `${k} × tendon-${max}` };
}
