"""Serviceability stress checks — transfer and service (PRD §5.1, ACI 318 / SNI 2847)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

from engine.loading import MomentResults
from engine.prestress import PrestressForces
from engine.section_properties import SectionProperties
from engine.validation import GirderInputs


@dataclass(frozen=True)
class StressLimits:
    """Allowable stress limits (MPa)."""

    compression_limit_mpa: float
    tension_limit_mpa: float
    fc_used_mpa: float


@dataclass(frozen=True)
class FiberStressResult:
    """Stress check result for one fiber at one stage."""

    stage: str
    fiber: str
    stress_mpa: float
    compression_limit_mpa: float
    tension_limit_mpa: float
    compression_ratio: float
    tension_ratio: float
    is_safe: bool


@dataclass(frozen=True)
class StageStressResult:
    """Top and bottom fiber stresses for one loading stage."""

    stage: str
    sigma_top_mpa: float
    sigma_bottom_mpa: float
    top_fiber: FiberStressResult
    bottom_fiber: FiberStressResult
    is_safe: bool


@dataclass(frozen=True)
class StressCheckResults:
    """Complete stress analysis output."""

    transfer: StageStressResult
    service: StageStressResult
    is_overall_safe: bool


def _allowable_limits(fc_mpa: float) -> StressLimits:
    """
    Allowable stresses per ACI 318 / SNI 2847 (simplified).

    Compression: 0.60 × f'c
    Tension:     0.50 × √(f'c)
    """
    return StressLimits(
        compression_limit_mpa=0.60 * fc_mpa,
        tension_limit_mpa=0.50 * (fc_mpa**0.5),
        fc_used_mpa=fc_mpa,
    )


def _fiber_stress_transfer(
    prestress_force_kn: float,
    eccentricity_mm: float,
    moment_knm: float,
    section: SectionProperties,
    at_top: bool,
) -> float:
    """
    Transfer stage fiber stress (MPa).

    Top:    σ_t = -P/A + P·e/Z_t - M/Z_t
    Bottom: σ_b = -P/A - P·e/Z_b + M/Z_b

    Sign convention: positive = tension, negative = compression.
    """
    area_mm2 = section.area_mm2
    p_n = prestress_force_kn * 1000.0  # kN → N
    m_nmm = moment_knm * 1e6  # kN·m → N·mm

    if at_top:
        z_mm3 = section.modulus_top_mm3
        # Prestress compression at top reduced by eccentricity; dead load adds tension at top
        return (
            -p_n / area_mm2
            + (p_n * eccentricity_mm) / z_mm3
            - m_nmm / z_mm3
        )
    z_mm3 = section.modulus_bottom_mm3
    return (
        -p_n / area_mm2
        - (p_n * eccentricity_mm) / z_mm3
        + m_nmm / z_mm3
    )


def _fiber_stress_service(
    effective_force_kn: float,
    eccentricity_mm: float,
    total_moment_knm: float,
    section: SectionProperties,
    at_top: bool,
) -> float:
    """
    Service stage fiber stress with total load (Mg + Msdl + Mll).

    Top:    σ_t = -Pe/A + Pe·e/Z_t - M_total/Z_t
    Bottom: σ_b = -Pe/A - Pe·e/Z_b + M_total/Z_b
    """
    return _fiber_stress_transfer(
        effective_force_kn, eccentricity_mm, total_moment_knm, section, at_top
    )


def _evaluate_fiber(
    stage: str,
    fiber: str,
    stress_mpa: float,
    limits: StressLimits,
) -> FiberStressResult:
    """
    Check one fiber against allowable tension and compression.

    Safe when: -f_comp ≤ σ ≤ +f_tens
    """
    comp_limit = limits.compression_limit_mpa
    tens_limit = limits.tension_limit_mpa

    # Utilization ratios (0 = no demand)
    if stress_mpa > 0:
        tension_ratio = stress_mpa / tens_limit if tens_limit > 0 else float("inf")
        compression_ratio = 0.0
    elif stress_mpa < 0:
        compression_ratio = abs(stress_mpa) / comp_limit if comp_limit > 0 else float("inf")
        tension_ratio = 0.0
    else:
        tension_ratio = 0.0
        compression_ratio = 0.0

    is_safe = (-comp_limit <= stress_mpa <= tens_limit)

    return FiberStressResult(
        stage=stage,
        fiber=fiber,
        stress_mpa=stress_mpa,
        compression_limit_mpa=comp_limit,
        tension_limit_mpa=tens_limit,
        compression_ratio=compression_ratio,
        tension_ratio=tension_ratio,
        is_safe=is_safe,
    )


def _build_stage(
    stage_name: str,
    sigma_top: float,
    sigma_bottom: float,
    limits: StressLimits,
) -> StageStressResult:
    top = _evaluate_fiber(stage_name, "Serat Atas", sigma_top, limits)
    bottom = _evaluate_fiber(stage_name, "Serat Bawah", sigma_bottom, limits)
    return StageStressResult(
        stage=stage_name,
        sigma_top_mpa=sigma_top,
        sigma_bottom_mpa=sigma_bottom,
        top_fiber=top,
        bottom_fiber=bottom,
        is_safe=top.is_safe and bottom.is_safe,
    )


def compute_stress_checks(
    params: GirderInputs,
    section: SectionProperties,
    moments: MomentResults,
    prestress: PrestressForces,
) -> StressCheckResults:
    """Run transfer and service stress checks."""
    limits_transfer = _allowable_limits(params.fci_mpa)
    limits_service = _allowable_limits(params.fc_mpa)

    sigma_top_transfer = _fiber_stress_transfer(
        prestress.force_transfer_kn,
        params.eccentricity_mm,
        moments.moment_self_weight_knm,
        section,
        at_top=True,
    )
    sigma_bot_transfer = _fiber_stress_transfer(
        prestress.force_transfer_kn,
        params.eccentricity_mm,
        moments.moment_self_weight_knm,
        section,
        at_top=False,
    )

    sigma_top_service = _fiber_stress_service(
        prestress.force_effective_kn,
        params.eccentricity_mm,
        moments.moment_service_total_knm,
        section,
        at_top=True,
    )
    sigma_bot_service = _fiber_stress_service(
        prestress.force_effective_kn,
        params.eccentricity_mm,
        moments.moment_service_total_knm,
        section,
        at_top=False,
    )

    transfer = _build_stage(
        "Transfer",
        sigma_top_transfer,
        sigma_bot_transfer,
        limits_transfer,
    )
    service = _build_stage(
        "Servis",
        sigma_top_service,
        sigma_bot_service,
        limits_service,
    )

    return StressCheckResults(
        transfer=transfer,
        service=service,
        is_overall_safe=transfer.is_safe and service.is_safe,
    )


def stress_distribution_along_depth(
    sigma_top_mpa: float,
    sigma_bottom_mpa: float,
    height_mm: float,
    num_points: int = 50,
) -> Dict[str, List[float]]:
    """
    Linear stress profile between top and bottom fiber for Plotly visualization.

    y = 0 at bottom fiber, y = H at top fiber.
    """
    y_vals = [height_mm * i / (num_points - 1) for i in range(num_points)]
    sigma_vals = [
        sigma_bottom_mpa
        + (sigma_top_mpa - sigma_bottom_mpa) * (y / height_mm)
        for y in y_vals
    ]
    return {"y_mm": y_vals, "sigma_mpa": sigma_vals}


def stress_summary_table(stresses: StressCheckResults) -> List[Dict[str, object]]:
    """Build a summary table for display."""
    rows = []
    for stage in (stresses.transfer, stresses.service):
        for fiber in (stage.top_fiber, stage.bottom_fiber):
            rows.append(
                {
                    "Tahap": stage.stage,
                    "Serat": fiber.fiber,
                    "σ (MPa)": round(fiber.stress_mpa, 3),
                    "Batas Tekan (MPa)": round(fiber.compression_limit_mpa, 3),
                    "Batas Tarik (MPa)": round(fiber.tension_limit_mpa, 3),
                    "Rasio Tekan": round(fiber.compression_ratio, 3),
                    "Rasio Tarik": round(fiber.tension_ratio, 3),
                    "Status": "AMAN" if fiber.is_safe else "OVERSTRESS",
                }
            )
    return rows
