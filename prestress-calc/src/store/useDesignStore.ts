"use client";

import { create } from "zustand";
import { calculateGrossProperties, calculateCompositeProperties, widthAt } from "@/engine/section";
import { tendonProfile, computePrestressForces } from "@/engine/tendon";
import { computeTimeDependentLosses, computeLumpSumLosses } from "@/engine/losses";
import { computeSLSChecks } from "@/engine/sls";
import {
  computeFlexuralStrength,
  computeDeflection,
  computeShearStrength,
  computeInterfaceShear,
  computeLoadBalance,
  checkDuctility,
} from "@/engine/uls";
import { computeTransferLength } from "@/engine/development";
import { computeAnchorageZone } from "@/engine/anchorage";
import { computeCrackWidth, crackedSectionSteel } from "@/engine/crackwidth";
import { computeDualMethod } from "@/engine/dualmethod";
import { computeTorsion, estimateAcpPcp, estimateAohPh } from "@/engine/torsion";
import { computeContinuousBeam, computeMomentRedistribution } from "@/engine/continuous";
import { computeFlexuralStages } from "@/engine/flexuralstages";
import { computeMCFT } from "@/engine/mcft";
import { computeBSFlexure, computeBSShear, bsClassLimits } from "@/engine/bs8110";
import { computeThermalGradient } from "@/engine/thermal";
import { computeElongation } from "@/engine/elongation";
import { computePreliminary, computePressureLine } from "@/engine/preliminary";
import {
  ec2Material, ec2StressLimits, ec2TimeDependentLoss, ec2Flexure, ec2Shear,
} from "@/engine/ec2";
import { concreteModulus } from "@/lib/utils";
import type {
  ProjectInputs,
  DesignResults,
  IGirderGeometry,
  DeckGeometry,
  MaterialProps,
  TendonConfig,
  TendonRow,
  LoadConfig,
  ImmediateLossParams,
  ProjectInfo,
  PartialPrestressConfig,
  AppSettings,
  UnitSystem,
  FormulaVariant,
  PrestressSystem,
} from "@/types";

const LS_KEY = "prestress-calc-v3";

// ─── Defaults ────────────────────────────────────────────────

const defaultProjectInfo: ProjectInfo = {
  namaProyek: "Jembatan Prategang",
  noPekerjaan: "",
  perencana: "",
  lokasi: "",
};

// Realistic popular I-girder with trapezoidal (filleted) top & bottom flanges
// — a plain rectangular-flange I is rare in practice (Nilson §4.4 standard shapes).
// Top/bottom transition fillets (h5/h4) give the tension & compression flanges
// their characteristic trapezium shape. H = 180+150+950+200+200 = 1680 mm.
const defaultGirder: IGirderGeometry = {
  b1: 600, h1: 180, h5: 150,
  b2: 200, h2: 950, h4: 200,
  b3: 700, h3: 200,
};

const defaultDeck: DeckGeometry = {
  thicknessTd: 200,
  widthBeff: 2100,
  fcDeck: 30,
  fcGirder: 50,
};

const defaultMaterial: MaterialProps = {
  fci: 40, fc: 50, fcDeck: 30,
  fpu: 1860, fpy: 1580, Eps: 197_000,
  Ec: concreteModulus(50),
  fy: 420, fys: 240,
  As: 0,
};

const defaultTendon: TendonConfig = {
  profileType: "PARABOLIC",
  rows: [
    { id: 1, strandCount: 12, yFromBottom: 85  },
    { id: 2, strandCount: 12, yFromBottom: 120 },
    { id: 3, strandCount: 12, yFromBottom: 155 },
  ],
  singleStrandArea: 98.7,
  jackingRatio: 0.75,
  fpu: 1860, fpy: 1580, Eps: 197_000,
  eccentricitySupport: 0,
  holdDownRatio: 0,
  strandDiameter: 12.7,
};

const defaultLoads: LoadConfig = {
  spanLength: 30_000,
  gammaConc: 24,
  wSDL: 5, wLive: 20,
  relativeHumidity: 70,
  tuTorsion: 0,
  eTorsionArm: 1.5,
  nSpans: 1,
};

const defaultImmediateLoss: ImmediateLossParams = {
  mu: 0.20,
  K: 0.000002,
  deltaSet: 6,
  numJackingGroups: 4,
};

const defaultPartialPrestress: PartialPrestressConfig = {
  enabled: false,
  beamClass: "U",
};

const defaultSettings: AppSettings = {
  unitSystem: "SI",
  formulaVariant: "STANDARD",
  prestressSystem: "POST_TENSIONED", // prioritized default
};

// ─── Tendon resolver ─────────────────────────────────────────

export function resolveTendon(tendon: TendonConfig, yb: number) {
  const totalStrands = tendon.rows.reduce((s, r) => s + r.strandCount, 0);
  const Aps = totalStrands * tendon.singleStrandArea;
  const yResultant = totalStrands > 0
    ? tendon.rows.reduce((s, r) => s + r.strandCount * r.yFromBottom, 0) / totalStrands
    : yb - 100;
  const eccentricityMidspan = yb - yResultant;
  return { totalStrands, Aps, yResultant, eccentricityMidspan };
}

// ─── Store interface ─────────────────────────────────────────

interface DesignStore {
  inputs: ProjectInputs;
  settings: AppSettings;
  results: DesignResults | null;
  errors: string[];

  // Input updaters
  updateProjectInfo: (p: Partial<ProjectInfo>) => void;
  updateGirder: (g: Partial<IGirderGeometry>) => void;
  updateDeck: (d: Partial<DeckGeometry>) => void;
  updateMaterial: (m: Partial<MaterialProps>) => void;
  updateTendon: (t: Partial<TendonConfig>) => void;
  addTendonRow: () => void;
  removeTendonRow: (id: number) => void;
  updateTendonRow: (id: number, patch: Partial<Omit<TendonRow, "id">>) => void;
  updateLoads: (l: Partial<LoadConfig>) => void;
  updateImmediateLoss: (p: Partial<ImmediateLossParams>) => void;
  updatePartialPrestress: (pp: Partial<PartialPrestressConfig>) => void;
  setGirder: (g: IGirderGeometry) => void;

  // Settings
  setUnitSystem: (s: UnitSystem) => void;
  setFormulaVariant: (v: FormulaVariant) => void;
  setPrestressSystem: (s: PrestressSystem) => void;

  // Persistence
  saveToLocal: () => void;
  loadFromLocal: () => boolean;

  // Compute
  compute: () => void;
}

// ─── Computation pipeline ────────────────────────────────────

function runPipeline(
  inputs: ProjectInputs,
  prestressSystem: PrestressSystem = "POST_TENSIONED"
): { results: DesignResults | null; errors: string[] } {
  const errors: string[] = [];
  const { girder, deck, material, tendon, loads, partialPrestress } = inputs;

  // Construction-method differentiation (pretensioned vs post-tensioned):
  //  - Pretensioned strands run straight in the bed with no duct ⇒ no curvature
  //    or wobble friction, and all strands are released together (single ES group).
  //  - Post-tensioned tendons sit in ducts ⇒ friction + anchorage draw-in, and
  //    are stressed sequentially (ΔES factor (N−1)/2N).
  const isPretensioned = prestressSystem === "PRETENSIONED";
  const immediateLoss: ImmediateLossParams = isPretensioned
    ? { ...inputs.immediateLoss, mu: 0, K: 0, numJackingGroups: 1 }
    : inputs.immediateLoss;

  const hGirder = (girder.h1) + (girder.h5 ?? 0) + (girder.h2) + (girder.h4 ?? 0) + (girder.h3);
  if (hGirder <= 0) errors.push("Tinggi girder tidak valid.");
  if (loads.spanLength <= 0) errors.push("Panjang bentang harus > 0.");
  if (tendon.rows.length === 0) errors.push("Minimal satu baris tendon diperlukan.");
  if (errors.length > 0) return { results: null, errors };

  const Eci = concreteModulus(material.fci);
  const Ec  = concreteModulus(material.fc);
  const L   = loads.spanLength;
  const LM  = L / 1000;

  // Layer 1
  const gross     = calculateGrossProperties(girder);
  const composite = calculateCompositeProperties(girder, deck);

  // Resolve tendon
  const { totalStrands, Aps, eccentricityMidspan } = resolveTendon(tendon, gross.yb);
  const engineTendon = { ...tendon, totalStrands, eccentricityMidspan };

  // Moments
  const wSelf    = loads.gammaConc * gross.areaAg * 1e-6;
  const Mg       = wSelf * LM ** 2 / 8;
  const Msdl     = loads.wSDL  * LM ** 2 / 8;
  const Mlive    = loads.wLive * LM ** 2 / 8;
  const Mservice = Mg + Msdl + Mlive;
  const Mu       = 1.25 * (Mg + Msdl) + 1.75 * Mlive;
  const moments  = Object.freeze({ wSelf, Mg, Msdl, Mlive, Mservice, Mu });

  // Layer 3 (first pass with Pj)
  const Pj0       = (tendon.jackingRatio * tendon.fpu * Aps) / 1000;
  const tdLosses  = computeTimeDependentLosses(
    engineTendon, gross, material.fci, material.fc,
    material.Eps, Ec, Pj0, Mg, loads.relativeHumidity, L
  );

  // Layer 2
  const prestress = computePrestressForces(
    engineTendon, gross, Mg, L, immediateLoss, Eci, tdLosses.deltaFpLT
  );

  // fse (effective steel stress after losses)
  const fse = Aps > 0 ? (prestress.Pe * 1000) / Aps : 0;

  // Augment prestress with fse
  const prestressFull = Object.freeze({ ...prestress, fse });

  // Layer 4
  const beamClass = partialPrestress.enabled ? partialPrestress.beamClass : "U";
  const sls = computeSLSChecks(
    { Pi: prestress.Pi, Pe: prestress.Pe, e: eccentricityMidspan,
      Mg, Msdl, Mlive, fci: material.fci, fc: material.fc, beamClass },
    gross, composite
  );

  // Cracking moment at midspan (for 1.2Mcr and Vci)
  const fpe_fiber = (prestress.Pe * 1000) / gross.areaAg
    + (prestress.Pe * 1000 * eccentricityMidspan) / gross.momentOfInertiaIg * gross.yb;
  const fd_bot = (Mg * 1e6 * gross.yb) / gross.momentOfInertiaIg;
  const fr     = 0.62 * Math.sqrt(material.fc); // modulus of rupture (MPa)
  const Mcr    = (gross.Zbg / 1e6) * (fr + Math.max(0, fpe_fiber - fd_bot));

  // Layer 5a: ULS flexure
  const ulsFlexure = computeFlexuralStrength({
    tendon: engineTendon, girder, deck,
    comp: composite, gross,
    As: material.As, fy: material.fy, Mu, Mcr,
  });

  // Layer 5b: Deflection
  const wDeck = loads.gammaConc * deck.thicknessTd * deck.widthBeff * 1e-6;
  const deflection = computeDeflection({
    Pe: prestress.Pe, Pi: prestress.Pi,
    e_midspan: eccentricityMidspan, spanMm: L,
    EcGirder: Ec, gross, comp: composite,
    wSelf, wDeck, wLive: loads.wLive,
  });

  // Layer 5c: Shear
  const profile0      = tendonProfile(engineTendon, L);
  const thetaSupport  = Math.abs(profile0[0].thetaRad);
  const Vg     = wSelf  * LM / 2;
  const Vsdl   = loads.wSDL  * LM / 2;
  const Vd     = Vg + Vsdl;
  const VuShear = 1.25 * Vd + 1.75 * (loads.wLive * LM / 2);

  const hComp  = gross.hTotal + deck.thicknessTd;
  const dv     = Math.max(
    0.9 * (gross.yb + Math.max(0, eccentricityMidspan)),
    0.72 * hComp
  );
  const bw     = girder.b2;
  const fpc    = (prestress.Pe * 1000) / gross.areaAg;

  const ulsShear = computeShearStrength({
    Vu: VuShear, Pe: prestress.Pe, thetaSupport,
    gross, fc: material.fc, fpc,
    fpe: prestress.jackingStressMpa * 0.8,
    fd: fd_bot, Vd, Vi: loads.wLive * LM / 2,
    Mmax: Mlive, Mcr, bw, dv, fys: material.fys,
  });

  // Layer 5d: Interface shear
  const interfaceShear = computeInterfaceShear({
    Vu: VuShear, comp: composite, gross,
    hGirder: gross.hTotal, tDeck: deck.thicknessTd,
    bvi: girder.b1, fy_avf: material.fy, roughened: true,
  });

  // Load balance
  const loadBalance = computeLoadBalance(
    prestress.Pe, eccentricityMidspan, tendon.eccentricitySupport, L, Mservice
  );

  // Transfer + development length
  const transferLength = computeTransferLength(
    fse, ulsFlexure.fps, tendon.strandDiameter
  );

  // Anchorage zone (end zone, post-tensioned) — NCHRP 356 / AASHTO §5.8.4.
  // Inclination of the tendon at the support governs the bursting term; for a
  // post-tensioned multi-tendon system the force is shared between devices.
  const anchorPlate = Math.min(gross.hTotal * 0.25, 300);
  const nTendons = Math.max(1, Math.round(totalStrands / 19)); // ~19-strand units
  const anchorageZone = computeAnchorageZone({
    Pi: prestress.Pi,
    hTotal: gross.hTotal,
    eEnd: tendon.eccentricitySupport,
    anchorPlateHeight: anchorPlate,
    anchorPlateWidth: anchorPlate,
    sectionWidth: Math.max(girder.b2, girder.b3 * 0.5),
    fci: material.fci,
    tendonInclination: (thetaSupport * 180) / Math.PI,
    nAnchors: prestressSystem === "POST_TENSIONED" ? nTendons : 1,
    fy: material.fy,
  });

  // Crack width (only for Class T or C)
  let crackWidth;
  if (partialPrestress.enabled && partialPrestress.beamClass !== "U" && material.As > 0) {
    const fs_s = crackedSectionSteel(Mservice, Mcr, material.As, gross.yb * 0.9);
    crackWidth = computeCrackWidth({
      fs: fs_s,
      dc: 40,
      bw: girder.b2,
      nBars: Math.max(1, Math.round(material.As / 200)),
      exposure: "exterior",
    });
  }

  // Torsion (only when Tu > 0)
  let torsion;
  if (loads.tuTorsion > 0) {
    const bTotal = Math.max(girder.b1, girder.b3);
    const { Acp, pcp } = estimateAcpPcp(bTotal, gross.hTotal);
    const { Aoh, ph }  = estimateAohPh(girder.b2, gross.hTotal);
    const fpc = (prestress.Pe * 1000) / gross.areaAg;
    torsion = computeTorsion({
      Tu: loads.tuTorsion,
      Vu: VuShear,
      bw: girder.b2,
      dv,
      Acp, pcp, Aoh, ph,
      fc: material.fc,
      fpc,
      fyt: material.fys,
      fyl: material.fy,
      isPrestressed: true,
      Vc: ulsShear.Vc,
    });
  }

  // Continuous beam secondary moments
  let continuousBeam;
  const nSpans = loads.nSpans ?? 1;
  if (nSpans > 1) {
    continuousBeam = computeContinuousBeam({
      nSpans: nSpans as 1 | 2 | 3,
      L,
      Pe: prestress.Pe,
      eMidspan: eccentricityMidspan,
      eSupport: tendon.eccentricitySupport,
      eEnd: tendon.eccentricitySupport,
    });
  }

  // Flexural load stages & changes in prestress force (Nilson §1.7/§3.6)
  const n_modular = material.Eps / Ec;
  const flexuralStages = computeFlexuralStages({
    Pe: prestress.Pe, fse, e: eccentricityMidspan, Aps,
    A: gross.areaAg, I: gross.momentOfInertiaIg, Zb: gross.Zbg,
    kt: gross.kt, Mdead: Mg, fr, n: n_modular, fps: ulsFlexure.fps,
  });

  // Compression Field Theory shear (Nilson §5.11 / AASHTO general method)
  const mcftShear = computeMCFT({
    Vu: VuShear, Mu, Nu: 0, Vp: ulsShear.Vp,
    fc: material.fc, bv: bw, dv,
    Aps, As: material.As, fpu: tendon.fpu, Ep: material.Eps,
    fyt: material.fys, AvPerS: ulsShear.AvPerS,
  });

  // Moment redistribution for continuous members (Nilson §8.10)
  let momentRedistribution;
  if (continuousBeam && continuousBeam.nSpans > 1) {
    const hCompMr = gross.hTotal + deck.thicknessTd;
    const dpMr = hCompMr - (gross.yb - eccentricityMidspan);
    const ductMr = checkDuctility(ulsFlexure.c, dpMr);
    momentRedistribution = computeMomentRedistribution({
      M_support_elastic: Math.abs(continuousBeam.M_total_support) || Mu,
      M_midspan_elastic: ulsFlexure.Mu,
      epsilon_t: ductMr.epsilon_t,
    });
  }

  // Lump-sum loss estimate (Nilson §6.2) — cross-check of refined method
  const fpi_lump = prestress.jackingStressMpa - prestress.deltaFR - prestress.deltaAS - prestress.deltaES;
  const lumpSumLosses = computeLumpSumLosses(
    fpi_lump, Aps, gross.areaAg, material.fci, loads.relativeHumidity
  );

  // ── BS 8110 alternative (Kong & Evans Ch.9) ─────────────────
  const hCompBS = gross.hTotal + deck.thicknessTd;
  const dpBS    = hCompBS - (gross.yb - eccentricityMidspan);
  const fcuApprox = material.fc / 0.8; // f'c (cylinder) ≈ 0.8·fcu (cube)
  const bonded  = prestressSystem === "PRETENSIONED" || immediateLoss.mu > 0;
  const bsFlexure = computeBSFlexure({
    Aps, d: dpBS, b: deck.widthBeff, fcu: fcuApprox,
    fpu: tendon.fpu, fpe: fse, bonded, L,
    Mu_demand: Mu,
  });
  const fcp = (prestress.Pe * 1000) / gross.areaAg; // prestress at centroid (MPa)
  const fpt = fcp + (prestress.Pe * 1000 * eccentricityMidspan * gross.yb) / gross.momentOfInertiaIg;
  const bsShear = computeBSShear({
    bv: girder.b2, h: gross.hTotal, d: dpBS, fcu: fcuApprox,
    fcp, fpt, I: gross.momentOfInertiaIg, y: gross.yb,
    fpe_fpu: fse / tendon.fpu, vc: 0.7, // vc default Table 6.4-1 (MPa)
    V: VuShear, M: Mu,
  });
  const bsClass = bsClassLimits(
    partialPrestress.enabled ? "3" : "1", fcuApprox, prestressSystem === "PRETENSIONED"
  );

  // ── Eurocode 2 (EN 1992-1-1) — M.K. Hurst "Prestressed Concrete Design" ──
  // Fourth code path, parallel to ACI/AASHTO and BS 8110. fck = cylinder
  // strength = material.fc (the suite already stores cylinder values).
  const ec2Mat = ec2Material(material.fc, tendon.fpu);
  const ec2Limits = ec2StressLimits(material.fc, material.fci);

  // §5.10.6 combined time-dependent loss — couple the three effects.
  // εcs recovered from the shrinkage stress loss already computed; relaxation
  // from ΔfpR2; creep coefficient φ from a typical RH-based default.
  const eps_cs = material.Eps > 0 ? tdLosses.deltaFpSR / material.Eps : 0;
  const phiCreep = 2.4 * (1 - loads.relativeHumidity / 100) + 1.0; // ≈1.7–2.4
  // Concrete stress at tendon level under quasi-permanent loads (+ = comp):
  const Mqp_Nmm = (Mg + Msdl + 0.3 * Mlive) * 1e6;
  const Ig = gross.momentOfInertiaIg;
  const sigma_c_qp = (prestress.Pe * 1000) / gross.areaAg
    + (prestress.Pe * 1000 * eccentricityMidspan * eccentricityMidspan) / Ig
    - (Mqp_Nmm * eccentricityMidspan) / Ig;
  const ec2Loss = ec2TimeDependentLoss({
    eps_cs, Ep: material.Eps, Ecm: ec2Mat.Ecm,
    delta_pr: tdLosses.deltaFpR2, phi: phiCreep,
    sigma_c_qp: Math.max(sigma_c_qp, 0),
    Ap: Aps, Ac: gross.areaAg, Ic: Ig, zcp: eccentricityMidspan,
  });

  // §6.1 ULS flexure (rectangular block).
  const ec2Flex = ec2Flexure({
    Ap: Aps, d: dpBS, b: deck.widthBeff,
    fck: material.fc, fpk: tendon.fpu, Mu_demand: Mu,
  });

  // §6.2 shear — first moment of area Q above the centroid via strip integration.
  let Q_centroid = 0;
  const nStrip = 40, dyStrip = gross.yt / nStrip;
  for (let i = 0; i < nStrip; i++) {
    const y = gross.yb + (i + 0.5) * dyStrip; // above centroid
    Q_centroid += widthAt(girder, y) * (y - gross.yb) * dyStrip;
  }
  const rho_l = (material.As + Aps) / (girder.b2 * dpBS);
  const ec2Shr = ec2Shear({
    bw: girder.b2, d: dpBS, h: gross.hTotal,
    fck: material.fc, fpk: tendon.fpu,
    I: Ig, S: Q_centroid, sigma_cp: fcp,
    rho_l, V: VuShear, M: Mu, Mcr,
  });

  const ec2 = {
    material: ec2Mat,
    stressLimits: ec2Limits,
    loss: ec2Loss,
    flexure: ec2Flex,
    shear: ec2Shr,
  };

  // ── Libby "Modern Prestressed Concrete" additions ───────────
  // §11-5 Thermal gradient self-equilibrating stresses (AASHTO §3.12.3).
  const thermal = computeThermalGradient({
    girder, gross, Ec,
    alpha: 1.08e-5,           // normal-weight concrete (1/°C)
    T1: 23, T2: 6, T3: 3,     // AASHTO Zone 3 positive gradient (user-editable defaults)
  });

  // §16-7 PT tendon elongation & gage force (post-tensioned field control).
  const elongation = prestressSystem === "POST_TENSIONED"
    ? computeElongation({
        frictionProfile: prestress.frictionProfile,
        Pj: prestress.Pj, spanMm: L, Aps,
        Eps: material.Eps, deltaSet: immediateLoss.deltaSet,
      })
    : undefined;

  // §9-6..§9-8 Preliminary design — min prestress force & section moduli.
  const etaEff = prestress.Pi > 0 ? prestress.Pe / prestress.Pi : 0.82;
  const preliminary = computePreliminary({
    A: gross.areaAg, Zt: gross.Ztg, Zb: gross.Zbg, yb: gross.yb,
    fci: material.fci, fc: material.fc,
    Mmin: Mg, Mmax: Mservice,
    eMax: Math.max(eccentricityMidspan, gross.yb - 100),
    eta: etaEff,
    // ACI Class U/T/C all permit some service tension; the allowable magnitude
    // itself differentiates full vs partial in the SLS check.
    allowTension: true,
  });

  // §4-3..§4-5 Pressure line / C-line migration through the kern.
  const pressureLine = computePressureLine({
    Pi: prestress.Pi, Pe: prestress.Pe, e: eccentricityMidspan,
    Mg, Mservice, kt: gross.kt, kb: gross.kb,
  });

  // Partial Prestress Ratio (PPR)
  const PPR_val = ulsFlexure.fps > 0
    ? (Aps * ulsFlexure.fps) / (Aps * ulsFlexure.fps + Math.max(material.As, 0) * material.fy)
    : 1.0;

  // ── Dual design method — Full vs LRFD-Partial prestressing (side-by-side) ──
  // The service fibre stresses are identical; only the allowable tension
  // (0.5√f'c vs 1.0√f'c), the verdict and the cracked-section crack control
  // differ. Always computed so the two philosophies sit beside each other.
  const dualMethod = computeDualMethod({
    sigmaTopService: sls.service.sigmaTop,
    sigmaBotService: sls.service.sigmaBot,
    fc: material.fc,
    Mservice, Mcr,
    Aps, fps: ulsFlexure.fps,
    As: material.As, fy: material.fy,
    jd: 0.9 * gross.yb,
    bw: girder.b2,
  });

  return {
    results: Object.freeze({
      gross,
      composite,
      moments,
      prestress: prestressFull,
      tdLosses,
      sls,
      ulsFlexure,
      ulsShear,
      interfaceShear,
      deflection,
      loadBalance,
      transferLength,
      anchorageZone,
      crackWidth,
      torsion,
      continuousBeam,
      flexuralStages,
      mcftShear,
      momentRedistribution,
      lumpSumLosses,
      bsFlexure,
      bsShear,
      bsClass,
      thermal,
      elongation,
      preliminary,
      pressureLine,
      ec2,
      PPR: PPR_val,
      dualMethod,
    }),
    errors: [],
  };
}

// ─── Zustand store ───────────────────────────────────────────

const defaultInputs: ProjectInputs = {
  projectInfo:     defaultProjectInfo,
  girder:          defaultGirder,
  deck:            defaultDeck,
  material:        defaultMaterial,
  tendon:          defaultTendon,
  loads:           defaultLoads,
  immediateLoss:   defaultImmediateLoss,
  partialPrestress: defaultPartialPrestress,
};

export const useDesignStore = create<DesignStore>((set, get) => ({
  inputs:   defaultInputs,
  settings: defaultSettings,
  results:  null,
  errors:   [],

  updateProjectInfo: (p) => {
    set((s) => ({ inputs: { ...s.inputs, projectInfo: { ...s.inputs.projectInfo, ...p } } }));
  },
  updateGirder: (g) => {
    set((s) => ({ inputs: { ...s.inputs, girder: { ...s.inputs.girder, ...g } } }));
    get().compute();
  },
  setGirder: (g) => {
    set((s) => ({ inputs: { ...s.inputs, girder: g } }));
    get().compute();
  },
  updateDeck: (d) => {
    set((s) => ({ inputs: { ...s.inputs, deck: { ...s.inputs.deck, ...d } } }));
    get().compute();
  },
  updateMaterial: (m) => {
    const newMat = { ...get().inputs.material, ...m };
    newMat.Ec = concreteModulus(newMat.fc);
    set((s) => ({ inputs: { ...s.inputs, material: newMat } }));
    get().compute();
  },
  updateTendon: (t) => {
    set((s) => ({ inputs: { ...s.inputs, tendon: { ...s.inputs.tendon, ...t } } }));
    get().compute();
  },
  addTendonRow: () => {
    const rows = get().inputs.tendon.rows;
    const newId = rows.length > 0 ? Math.max(...rows.map((r) => r.id)) + 1 : 1;
    const lastY = rows.length > 0 ? rows[rows.length - 1].yFromBottom : 85;
    const newRow: TendonRow = { id: newId, strandCount: 4, yFromBottom: lastY + 35 };
    set((s) => ({
      inputs: { ...s.inputs, tendon: { ...s.inputs.tendon, rows: [...rows, newRow] } },
    }));
    get().compute();
  },
  removeTendonRow: (id) => {
    const rows = get().inputs.tendon.rows.filter((r) => r.id !== id);
    set((s) => ({ inputs: { ...s.inputs, tendon: { ...s.inputs.tendon, rows } } }));
    get().compute();
  },
  updateTendonRow: (id, patch) => {
    const rows = get().inputs.tendon.rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    set((s) => ({ inputs: { ...s.inputs, tendon: { ...s.inputs.tendon, rows } } }));
    get().compute();
  },
  updateLoads: (l) => {
    set((s) => ({ inputs: { ...s.inputs, loads: { ...s.inputs.loads, ...l } } }));
    get().compute();
  },
  updateImmediateLoss: (p) => {
    set((s) => ({ inputs: { ...s.inputs, immediateLoss: { ...s.inputs.immediateLoss, ...p } } }));
    get().compute();
  },
  updatePartialPrestress: (pp) => {
    set((s) => ({
      inputs: { ...s.inputs, partialPrestress: { ...s.inputs.partialPrestress, ...pp } },
    }));
    get().compute();
  },
  setUnitSystem: (s) => {
    set((st) => ({ settings: { ...st.settings, unitSystem: s } }));
  },
  setFormulaVariant: (v) => {
    set((st) => ({ settings: { ...st.settings, formulaVariant: v } }));
  },
  setPrestressSystem: (s) => {
    set((st) => ({ settings: { ...st.settings, prestressSystem: s } }));
    get().compute();
  },
  saveToLocal: () => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        inputs:   get().inputs,
        settings: get().settings,
      }));
    } catch { /* quota or SSR */ }
  },
  loadFromLocal: () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { inputs?: Partial<ProjectInputs>; settings?: Partial<AppSettings> };
      const pi = parsed.inputs ?? {};
      const merged: ProjectInputs = {
        projectInfo:     { ...defaultInputs.projectInfo,     ...pi.projectInfo },
        girder:          { ...defaultInputs.girder,          ...pi.girder },
        deck:            { ...defaultInputs.deck,            ...pi.deck },
        material:        { ...defaultInputs.material,        ...pi.material },
        tendon:          { ...defaultInputs.tendon,          ...pi.tendon },
        loads:           { ...defaultInputs.loads,           ...pi.loads },
        immediateLoss:   { ...defaultInputs.immediateLoss,   ...pi.immediateLoss },
        partialPrestress:{ ...defaultInputs.partialPrestress,...pi.partialPrestress },
      };
      const ps = parsed.settings ?? {};
      const mergedSettings: AppSettings = {
        unitSystem:      ps.unitSystem      ?? defaultSettings.unitSystem,
        formulaVariant:  ps.formulaVariant  ?? defaultSettings.formulaVariant,
        prestressSystem: ps.prestressSystem ?? defaultSettings.prestressSystem,
      };
      set({ inputs: merged, settings: mergedSettings });
      get().compute();
      return true;
    } catch { return false; }
  },
  compute: () => {
    const { results, errors } = runPipeline(get().inputs, get().settings.prestressSystem);
    set({ results, errors });
  },
}));
