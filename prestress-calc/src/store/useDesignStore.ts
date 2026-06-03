"use client";

import { create } from "zustand";
import { calculateGrossProperties, calculateCompositeProperties } from "@/engine/section";
import { tendonProfile, computePrestressForces } from "@/engine/tendon";
import { computeTimeDependentLosses } from "@/engine/losses";
import { computeSLSChecks } from "@/engine/sls";
import {
  computeFlexuralStrength,
  computeDeflection,
  computeShearStrength,
  computeInterfaceShear,
  computeLoadBalance,
} from "@/engine/uls";
import { computeTransferLength } from "@/engine/development";
import { computeAnchorageZone } from "@/engine/anchorage";
import { computeCrackWidth, crackedSectionSteel } from "@/engine/crackwidth";
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
} from "@/types";

const LS_KEY = "prestress-calc-v3";

// ─── Defaults ────────────────────────────────────────────────

const defaultProjectInfo: ProjectInfo = {
  namaProyek: "Jembatan Prategang",
  noPekerjaan: "",
  perencana: "",
  lokasi: "",
};

const defaultGirder: IGirderGeometry = {
  b1: 600, h1: 200, h5: 0,
  b2: 200, h2: 1200, h4: 0,
  b3: 700, h3: 250,
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

  // Persistence
  saveToLocal: () => void;
  loadFromLocal: () => boolean;

  // Compute
  compute: () => void;
}

// ─── Computation pipeline ────────────────────────────────────

function runPipeline(
  inputs: ProjectInputs
): { results: DesignResults | null; errors: string[] } {
  const errors: string[] = [];
  const { girder, deck, material, tendon, loads, immediateLoss, partialPrestress } = inputs;

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

  // Anchorage zone (end zone, post-tensioned)
  const anchorageZone = computeAnchorageZone({
    Pi: prestress.Pi,
    hTotal: gross.hTotal,
    eEnd: tendon.eccentricitySupport,
    anchorPlateHeight: Math.min(gross.hTotal * 0.25, 300),
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
        unitSystem:     ps.unitSystem     ?? defaultSettings.unitSystem,
        formulaVariant: ps.formulaVariant ?? defaultSettings.formulaVariant,
      };
      set({ inputs: merged, settings: mergedSettings });
      get().compute();
      return true;
    } catch { return false; }
  },
  compute: () => {
    const { results, errors } = runPipeline(get().inputs);
    set({ results, errors });
  },
}));
