/**
 * sni2833seismic.ts — Bridge seismic design, RESPONSE-SPECTRUM method per
 * SNI 2833:2016 "Perencanaan jembatan terhadap beban gempa" (flow/procedure;
 * cross-references AASHTO LRFD Seismic + SNI 1726). PDF numbers are NOT code
 * references — only the chapter/sub-chapter order & procedure.
 *
 * DISTINCT from engine/seismic.ts (PCI BDM single-mode uniform-load method,
 * C_s = 1.2·A·S/T^⅔): this builds the full SNI/AASHTO design RESPONSE SPECTRUM
 * (As, S_DS, S_D1, T0, Ts, C_sm(T)), classifies the Seismic Design Category
 * (Zona/SDC), and applies the response-modification factor R.
 *
 * Units (SI): force kN · length m · period s · acceleration g.
 * Pure functions → Object.freeze().
 */

export type SiteClass = "SA" | "SB" | "SC" | "SD" | "SE";

export interface SNISeismicInputs {
  /** Peak ground acceleration PGA (g) — peta gempa */
  PGA: number;
  /** Short-period spectral accel Ss (0.2 s), g */
  Ss: number;
  /** 1-second spectral accel S1 (1.0 s), g */
  S1: number;
  site: SiteClass;
  /** structure weight (tributary), kN */
  W: number;
  /** lateral stiffness K, kN/m (pier/bent) */
  K: number;
  /** response-modification factor R (substructure type & importance) */
  R: number;
}

export interface SNISeismicResult {
  readonly Fpga: number; readonly Fa: number; readonly Fv: number;
  readonly As: number;            // = Fpga·PGA
  readonly SDS: number;           // = Fa·Ss
  readonly SD1: number;           // = Fv·S1
  readonly T0: number; readonly Ts: number;
  readonly T: number;             // structure period, s
  readonly Csm: number;           // elastic seismic coefficient at T
  readonly zone: string;          // Seismic Design Category 1–4
  readonly EQelastic: number;     // elastic force = Csm·W, kN
  readonly EQdesign: number;      // = EQelastic / R, kN
  readonly spectrum: ReadonlyArray<{ T: number; Csm: number }>;
}

/** Site coefficients Fpga/Fa (vs Ss) and Fv (vs S1) — interpolated bands. */
function siteFactor(site: SiteClass, val: number, kind: "short" | "long"): number {
  // Representative banded values (SNI 1726/2833 tables); interpolation only.
  const tablesShort: Record<SiteClass, [number, number][]> = {
    SA: [[0.25, 0.8], [1.25, 0.8]],
    SB: [[0.25, 1.0], [1.25, 1.0]],
    SC: [[0.25, 1.2], [0.5, 1.2], [0.75, 1.1], [1.0, 1.0], [1.25, 1.0]],
    SD: [[0.25, 1.6], [0.5, 1.4], [0.75, 1.2], [1.0, 1.1], [1.25, 1.0]],
    SE: [[0.25, 2.5], [0.5, 1.7], [0.75, 1.2], [1.0, 0.9], [1.25, 0.9]],
  };
  const tablesLong: Record<SiteClass, [number, number][]> = {
    SA: [[0.1, 0.8], [0.5, 0.8]],
    SB: [[0.1, 1.0], [0.5, 1.0]],
    SC: [[0.1, 1.7], [0.2, 1.6], [0.3, 1.5], [0.4, 1.4], [0.5, 1.3]],
    SD: [[0.1, 2.4], [0.2, 2.0], [0.3, 1.8], [0.4, 1.6], [0.5, 1.5]],
    SE: [[0.1, 3.5], [0.2, 3.2], [0.3, 2.8], [0.4, 2.4], [0.5, 2.4]],
  };
  const tbl = kind === "short" ? tablesShort[site] : tablesLong[site];
  if (val <= tbl[0][0]) return tbl[0][1];
  if (val >= tbl[tbl.length - 1][0]) return tbl[tbl.length - 1][1];
  for (let k = 1; k < tbl.length; k++) {
    if (val <= tbl[k][0]) {
      const [x0, y0] = tbl[k - 1], [x1, y1] = tbl[k];
      return y0 + (y1 - y0) * (val - x0) / (x1 - x0);
    }
  }
  return tbl[tbl.length - 1][1];
}

export function computeSNISeismic(i: SNISeismicInputs): SNISeismicResult {
  const Fpga = siteFactor(i.site, i.PGA, "short");
  const Fa = siteFactor(i.site, i.Ss, "short");
  const Fv = siteFactor(i.site, i.S1, "long");
  const As = Fpga * i.PGA;
  const SDS = Fa * i.Ss;
  const SD1 = Fv * i.S1;
  const T0 = 0.2 * SD1 / SDS;
  const Ts = SD1 / SDS;

  // Structure period T = 2π√(W/(g·K)).
  const g = 9.81;
  const T = 2 * Math.PI * Math.sqrt((i.W / g) / i.K);

  const csmAt = (t: number): number => {
    if (t < T0) return As + (SDS - As) * (t / T0);
    if (t <= Ts) return SDS;
    return SD1 / t;
  };
  const Csm = csmAt(T);

  // Seismic Design Category (Zona) by S_D1 (SNI 2833 Tabel 10).
  const zone = SD1 < 0.15 ? "1 (rendah)"
    : SD1 < 0.30 ? "2 (sedang)"
    : SD1 < 0.50 ? "3 (tinggi)" : "4 (sangat tinggi)";

  const EQelastic = Csm * i.W;
  const EQdesign = EQelastic / i.R;

  // Design spectrum samples for plotting.
  const spectrum: { T: number; Csm: number }[] = [];
  for (let t = 0; t <= 4.001; t += 0.1) spectrum.push({ T: +t.toFixed(2), Csm: +csmAt(t).toFixed(4) });

  return Object.freeze({
    Fpga, Fa, Fv, As, SDS, SD1, T0, Ts, T, Csm, zone,
    EQelastic, EQdesign, spectrum: Object.freeze(spectrum),
  });
}
