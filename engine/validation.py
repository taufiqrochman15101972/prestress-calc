"""Input validation to prevent division-by-zero and invalid geometry."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple


@dataclass(frozen=True)
class GirderInputs:
    """All user inputs required for the calculation pipeline."""

    # Geometry (mm)
    height_mm: float
    top_flange_width_mm: float
    top_flange_thickness_mm: float
    web_thickness_mm: float
    bottom_flange_width_mm: float
    bottom_flange_thickness_mm: float
    span_length_mm: float

    # Material (MPa)
    fc_mpa: float
    fci_mpa: float
    fpu_mpa: float

    # Prestress
    num_strands: int
    aps_mm2: float
    jacking_ratio: float
    eccentricity_mm: float

    # Loads (kN/m)
    sdl_kn_m: float
    live_load_kn_m: float

    # Optional
    gamma_concrete_kn_m3: float = 24.0
    service_loss_fraction: float = 0.20


def validate_inputs(params: GirderInputs) -> Tuple[bool, List[str]]:
    """
    Validate all inputs before running the engine.

    Returns (is_valid, list_of_error_messages).
    """
    errors: List[str] = []

    positive_fields = [
        ("Tinggi total (H)", params.height_mm),
        ("Lebar sayap atas", params.top_flange_width_mm),
        ("Tebal sayap atas", params.top_flange_thickness_mm),
        ("Tebal badan (web)", params.web_thickness_mm),
        ("Lebar sayap bawah", params.bottom_flange_width_mm),
        ("Tebal sayap bawah", params.bottom_flange_thickness_mm),
        ("Panjang bentang (L)", params.span_length_mm),
        ("f'c", params.fc_mpa),
        ("f'ci", params.fci_mpa),
        ("fpu", params.fpu_mpa),
        ("Luas tendon (Aps)", params.aps_mm2),
    ]

    for label, value in positive_fields:
        if value is None or value <= 0:
            errors.append(f"{label} harus lebih besar dari 0.")

    if params.num_strands < 1:
        errors.append("Jumlah strand minimal 1.")

    if params.jacking_ratio <= 0 or params.jacking_ratio > 1:
        errors.append("Rasio tegangan jack (ρ) harus berada di antara 0 dan 1.")

    if params.eccentricity_mm < 0:
        errors.append("Eksentrisitas (e) tidak boleh negatif.")

    if params.sdl_kn_m < 0 or params.live_load_kn_m < 0:
        errors.append("Beban SIDL dan Live Load tidak boleh negatif.")

    if params.gamma_concrete_kn_m3 <= 0:
        errors.append("Berat jenis beton (γ) harus lebih besar dari 0.")

    if not (0 <= params.service_loss_fraction < 1):
        errors.append("Fraksi kehilangan prategang servis harus antara 0 dan 1.")

    flange_sum = (
        params.top_flange_thickness_mm + params.bottom_flange_thickness_mm
    )
    if params.height_mm > 0 and flange_sum >= params.height_mm:
        errors.append(
            "Tebal sayap atas + bawah tidak boleh lebih besar atau sama dengan tinggi total (H)."
        )

    web_height = params.height_mm - flange_sum
    if params.height_mm > 0 and web_height <= 0:
        errors.append("Tinggi badan (web) hasil sisa geometri harus lebih besar dari 0.")

    return len(errors) == 0, errors
