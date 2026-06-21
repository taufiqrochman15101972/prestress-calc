"""Moment calculations for simply supported girder (PRD §5.1 loading stage)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

from engine.section_properties import SectionProperties
from engine.validation import GirderInputs


@dataclass(frozen=True)
class MomentResults:
    """Flexural moments at midspan (kN·m)."""

    self_weight_kn_m: float
    moment_self_weight_knm: float
    moment_sdl_knm: float
    moment_live_knm: float
    moment_service_total_knm: float


def compute_moments(
    params: GirderInputs,
    section: SectionProperties,
) -> MomentResults:
    """
    Compute midspan moments for a simply supported beam under uniform loads.

    M = w * L^2 / 8   (L in m, w in kN/m → M in kN·m)
    """
    span_m = params.span_length_mm / 1000.0

    # Berat sendiri: w = γ * A  (γ in kN/m³, A in m²)
    area_m2 = section.area_mm2 * 1e-6
    self_weight_kn_m = params.gamma_concrete_kn_m3 * area_m2

    # Momen lentur akibat beban merata di tengah bentang
    moment_self_weight_knm = self_weight_kn_m * span_m**2 / 8.0
    moment_sdl_knm = params.sdl_kn_m * span_m**2 / 8.0
    moment_live_knm = params.live_load_kn_m * span_m**2 / 8.0
    moment_service_total_knm = (
        moment_self_weight_knm + moment_sdl_knm + moment_live_knm
    )

    return MomentResults(
        self_weight_kn_m=self_weight_kn_m,
        moment_self_weight_knm=moment_self_weight_knm,
        moment_sdl_knm=moment_sdl_knm,
        moment_live_knm=moment_live_knm,
        moment_service_total_knm=moment_service_total_knm,
    )


def moments_to_dict(moments: MomentResults) -> Dict[str, float]:
    """Convert moment results to a flat dictionary for display."""
    return {
        "Berat Sendiri (w_self)": moments.self_weight_kn_m,
        "M_bs (Berat Sendiri)": moments.moment_self_weight_knm,
        "M_sdl (SIDL)": moments.moment_sdl_knm,
        "M_ll (Live Load)": moments.moment_live_knm,
        "M_total Servis": moments.moment_service_total_knm,
    }
