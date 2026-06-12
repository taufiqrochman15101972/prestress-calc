/**
 * Spliced Post-Tensioned Girder Engine — two-stage PT continuity
 * Ronald, "Design and Construction Considerations for Continuous
 * Post-Tensioned Bulb-Tee Girder Bridges" (PCI Journal 2001) +
 * WSDOT BDM §5.9 (spliced girders) — and the PT-duct shear effect from
 * TxDOT 0-6652-1 "Shear Behavior of Spliced Post-Tensioned Girders"
 * (Moore/Williams/Bayrak/Jirsa), codified as AASHTO LRFD §5.7.2.8.
 *
 * Construction sequence (stress ACCUMULATES on the section as built):
 *
 *  STAGE A — precast yard: pretension P_pre + self weight M_g on the
 *            PRECAST section (limits at f'ci).
 *  STAGE B — girders erected, closure pours cast, STAGE-1 PT P_pt1
 *            stressed on the still NON-COMPOSITE section; deck weight
 *            M_deck rides on the same section.
 *  STAGE C — deck cured → STAGE-2 PT P_pt2 stressed on the COMPOSITE
 *            section; superimposed dead load + live load follow.
 *
 *  CLOSURE JOINT — the splice has NO pretension crossing it; only the
 *  PT (stage 1 + 2) compresses the joint. Epoxy/CIP joints without
 *  bonded reinforcement must stay in compression at service.
 *
 *  DUCT SHEAR — a PT duct in the web weakens the diagonal strut:
 *      λ_duct = 1 − δ·(Ø_duct/b_w)²   (δ = 2.0 grouted, AASHTO 5.7.2.8)
 *  applied to (V_c + V_s); the legacy alternative reduces the web:
 *      b_v,eff = b_w − k·Ø_duct       (k = 0.25 grouted / 0.50 ungrouted)
 *  Both are reported so the user sees the two code generations agree.
 *
 * Units: kN, kN·m, mm, MPa. Sign: + tension, − compression.
 * Procedure from the references; limits per the adopted code path.
 */

export interface SplicedGirderInputs {
  // ── Precast (non-composite) section ──────────────────────────
  A: number;          // mm²
  Ztg: number;        // mm³ top of girder
  Zbg: number;        // mm³ bottom
  // ── Composite section ────────────────────────────────────────
  Ac: number;         // mm²
  Ztgc: number;       // mm³ top of girder (composite)
  Zbc: number;        // mm³ bottom (composite)
  // ── Prestress per stage (e + below the respective NA, mm) ────
  Ppre: number;  ePre: number;   // pretension on precast section (kN, mm)
  Ppt1: number;  ePt1: number;   // stage-1 PT on precast section
  Ppt2: number;  ePt2: number;   // stage-2 PT on composite section
  // ── Moments at the critical section (kN·m) ───────────────────
  Mg: number;        // girder self weight (stage A)
  Mdeck: number;     // deck + diaphragm/closure weight (stage B)
  Msdl: number;      // superimposed DL (stage C)
  Mll: number;       // live load + IM (stage C)
  // ── Strengths ────────────────────────────────────────────────
  fci: number;       // at transfer/stage-1 (MPa)
  fc: number;        // at service (MPa)
  // ── Web shear with duct ──────────────────────────────────────
  bw: number;        // web width (mm)
  ductOD: number;    // duct outer diameter (mm)
  grouted: boolean;
  VcPlusVs: number;  // nominal V_c + V_s without duct effect (kN)
  Vp: number;        // vertical prestress component (kN)
}

export interface StageStress {
  /** Stress increments of THIS stage (MPa) */
  readonly dTop: number;
  readonly dBot: number;
  /** Cumulative after this stage (MPa) */
  readonly top: number;
  readonly bot: number;
  readonly limT: number;   // tension limit (MPa)
  readonly limC: number;   // compression limit (MPa)
  readonly ok: boolean;
}

export interface SplicedGirderResult {
  readonly stageA: StageStress;
  readonly stageB: StageStress;
  readonly stageC: StageStress;
  // closure joint (no pretension crossing)
  readonly jointTop: number;
  readonly jointBot: number;
  readonly jointOk: boolean;   // must remain ≤ 0 (no tension)
  // duct shear knock-down
  readonly lambdaDuct: number;
  readonly VnDuct: number;     // λ·(Vc+Vs) + Vp (kN)
  readonly bvEff: number;      // legacy effective web (mm)
  readonly VnBvEff: number;    // (Vc+Vs)·bvEff/bw + Vp (kN)
  readonly reductionPct: number;
}

function stage(
  dTop: number, dBot: number, prevTop: number, prevBot: number,
  fcStage: number, isTransfer: boolean,
): StageStress {
  const top = prevTop + dTop;
  const bot = prevBot + dBot;
  const limT = 0.5 * Math.sqrt(fcStage);
  const limC = -(isTransfer ? 0.6 : 0.45) * fcStage;
  const ok = top <= limT && top >= limC && bot <= limT && bot >= limC;
  return { dTop, dBot, top, bot, limT, limC, ok };
}

export function computeSplicedGirder(inp: SplicedGirderInputs): SplicedGirderResult {
  const {
    A, Ztg, Zbg, Ac, Ztgc, Zbc,
    Ppre, ePre, Ppt1, ePt1, Ppt2, ePt2,
    Mg, Mdeck, Msdl, Mll, fci, fc,
    bw, ductOD, grouted, VcPlusVs, Vp,
  } = inp;

  // P/A ± P·e/Z ∓ M/Z on the section active at each stage (+ tension)
  const pm = (P: number, e: number, M: number, Asec: number, Zt: number, Zb: number) => {
    const PN = P * 1000, MN = M * 1e6;
    return {
      top: -PN / Asec + (PN * e) / Zt - MN / Zt,
      bot: -PN / Asec - (PN * e) / Zb + MN / Zb,
    };
  };

  // ── Stage A: pretension + M_g on precast section ─────────────
  const a = pm(Ppre, ePre, Mg, A, Ztg, Zbg);
  const stageA = stage(a.top, a.bot, 0, 0, fci, true);

  // ── Stage B: stage-1 PT + deck weight on precast section ─────
  const b = pm(Ppt1, ePt1, Mdeck, A, Ztg, Zbg);
  const stageB = stage(b.top, b.bot, stageA.top, stageA.bot, fci, true);

  // ── Stage C: stage-2 PT + SDL + LL on composite section ──────
  const c = pm(Ppt2, ePt2, Msdl + Mll, Ac, Ztgc, Zbc);
  const stageC = stage(c.top, c.bot, stageB.top, stageB.bot, fc, false);

  // ── Closure joint: only PT crosses the splice ────────────────
  const jointTop = b.top + c.top;
  const jointBot = b.bot + c.bot;
  const jointOk = jointTop <= 0 && jointBot <= 0; // no tension at the joint

  // ── Duct effect on web shear ─────────────────────────────────
  const delta = grouted ? 2.0 : 2.0; // δ per AASHTO 5.7.2.8 (research basis TxDOT 0-6652)
  const lambdaDuct = Math.max(0, 1 - delta * (ductOD / bw) ** 2);
  const VnDuct = lambdaDuct * VcPlusVs + Vp;
  const k = grouted ? 0.25 : 0.5;
  const bvEff = Math.max(0, bw - k * ductOD);
  const VnBvEff = (VcPlusVs * bvEff) / bw + Vp;
  const reductionPct = VcPlusVs > 0 ? (1 - lambdaDuct) * 100 : 0;

  return Object.freeze({
    stageA, stageB, stageC,
    jointTop, jointBot, jointOk,
    lambdaDuct, VnDuct, bvEff, VnBvEff, reductionPct,
  });
}
