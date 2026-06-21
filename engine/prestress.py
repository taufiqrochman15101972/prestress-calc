"""Prestressing force calculations and simplified loss model."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

from engine.validation import GirderInputs


@dataclass(frozen=True)
class PrestressForces:
    """Prestressing forces at different stages (kN)."""

    jacking_stress_mpa: float
    force_jacking_kn: float
    force_transfer_kn: float
    force_effective_kn: float
    loss_fraction: float
    loss_force_kn: float
    num_strands: int
    area_strand_mm2: float


def compute_prestress_forces(params: GirderInputs) -> PrestressForces:
    """
    Compute jacking, transfer, and effective prestress forces.

    Pj = f_jack * Aps / 1000   [kN]  (f in MPa, A in mm²)
    Pi = Pj  (transfer, no immediate loss in MVP)
    Pe = Pj * (1 - loss_fraction)  (service, default 20% loss)
    """
    # Tegangan tarik awal pada tendon saat penarikan dongkrak
    jacking_stress_mpa = params.jacking_ratio * params.fpu_mpa

    # Gaya prategang awal: Pj [kN] = σ [MPa] × A [mm²] / 1000
    force_jacking_kn = jacking_stress_mpa * params.aps_mm2 / 1000.0

    # Tahap transfer: gaya prategang sesaat setelah transfer (MVP = Pj)
    force_transfer_kn = force_jacking_kn

    # Tahap servis: kehilangan gaya prategang konstan (default 20%)
    retention = 1.0 - params.service_loss_fraction
    force_effective_kn = force_jacking_kn * retention
    loss_force_kn = force_jacking_kn - force_effective_kn

    return PrestressForces(
        jacking_stress_mpa=jacking_stress_mpa,
        force_jacking_kn=force_jacking_kn,
        force_transfer_kn=force_transfer_kn,
        force_effective_kn=force_effective_kn,
        loss_fraction=params.service_loss_fraction,
        loss_force_kn=loss_force_kn,
        num_strands=params.num_strands,
        area_strand_mm2=params.aps_mm2,
    )


def prestress_to_dict(prestress: PrestressForces) -> Dict[str, float]:
    """Convert prestress results to a flat dictionary for display."""
    return {
        "Tegangan Jack (f_jack)": prestress.jacking_stress_mpa,
        "Pj (Jacking Force)": prestress.force_jacking_kn,
        "Pi (Transfer)": prestress.force_transfer_kn,
        "Pe (Servis Efektif)": prestress.force_effective_kn,
        "Kehilangan (ΔP)": prestress.loss_force_kn,
        "Fraksi Loss": prestress.loss_fraction,
        "Jumlah Strand": float(prestress.num_strands),
        "Aps": prestress.area_strand_mm2,
    }
