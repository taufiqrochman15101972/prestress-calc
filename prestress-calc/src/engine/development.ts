/**
 * Transfer Length & Development Length Engine
 * ACI 318-19 §25.8.8.1 / R25.8.8.1
 *
 * Transfer length:    l_t = (f_se / 3) × d_b   [US: psi/in → converted from MPa/mm]
 *   SI equivalent:    l_t = f_se × d_b / 20.7   (1 MPa = 145.04 psi)
 *   Conservative alt: l_t = 50 × d_b            (ACI commentary pre-2019)
 *
 * Development length: l_d = l_t + (f_ps - f_se) × d_b / 3  [US psi/in]
 *   SI equivalent:    l_d = l_t + (f_ps - f_se) × d_b / 20.7
 *
 * Sign convention: all lengths in mm, stresses in MPa.
 */

export interface TransferLengthResult {
  readonly lt_ACI: number;      // ACI exact: fse×db/3 (mm, using converted psi)
  readonly lt_50db: number;     // Conservative: 50×db (mm)
  readonly lt_mm: number;       // Governing (max of ACI and 50db)
  readonly ld_mm: number;       // Development length (mm)
  readonly lt_db: number;       // lt / db (number of diameters)
  readonly ld_db: number;       // ld / db
  readonly fse: number;         // effective prestress after losses (MPa)
  readonly fps: number;         // fps at nominal flexural strength (MPa)
  readonly db: number;          // strand diameter (mm)
}

const PSI_PER_MPa = 145.0377;  // 1 MPa = 145.04 psi
const IN_PER_MM   = 1 / 25.4;  // 1 mm = 0.03937 in

/**
 * Compute transfer length and development length for prestressed strand.
 *
 * @param fse_MPa  Effective prestress after losses (MPa)
 * @param fps_MPa  Tendon stress at nominal flexural strength (MPa)
 * @param db_mm    Nominal strand diameter (mm)
 */
export function computeTransferLength(
  fse_MPa: number,
  fps_MPa: number,
  db_mm: number
): TransferLengthResult {
  // Convert to US psi and inches for ACI formula, then convert result back to mm
  const fse_psi = fse_MPa * PSI_PER_MPa;
  const fps_psi = fps_MPa * PSI_PER_MPa;
  const db_in   = db_mm  * IN_PER_MM;

  // ACI 318-19 §25.8.8.1 (a): l_t = (f_se / 3) × d_b [psi, in]
  const lt_in  = (fse_psi / 3) * db_in;
  const lt_ACI = lt_in / IN_PER_MM;   // → mm

  // Conservative: 50 d_b
  const lt_50db = 50 * db_mm;

  // Governing transfer length
  const lt_mm = Math.max(lt_ACI, lt_50db);

  // ACI 318-19 §25.8.8.1 (b): l_d = l_t + (f_ps - f_se) / 3 × d_b [psi, in]
  const ld_in = lt_in + ((fps_psi - fse_psi) / 3) * db_in;
  const ld_mm = Math.max(ld_in / IN_PER_MM, lt_mm);

  return Object.freeze({
    lt_ACI,
    lt_50db,
    lt_mm,
    ld_mm,
    lt_db: lt_mm / db_mm,
    ld_db: ld_mm / db_mm,
    fse:   fse_MPa,
    fps:   fps_MPa,
    db:    db_mm,
  });
}
