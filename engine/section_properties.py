"""Section properties calculator for I-girder (PRD §3.1)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

import numpy as np

from engine.validation import GirderInputs


@dataclass(frozen=True)
class RectangleComponent:
    """Single rectangular part of the discretized I-section."""

    name: str
    area_mm2: float
    centroid_from_bottom_mm: float
    local_inertia_mm4: float


@dataclass(frozen=True)
class SectionProperties:
    """Aggregated section properties."""

    area_mm2: float
    centroid_from_bottom_mm: float
    centroid_from_top_mm: float
    inertia_mm4: float
    modulus_top_mm3: float
    modulus_bottom_mm3: float
    web_height_mm: float
    components: List[RectangleComponent]


def _rectangle_props(
    name: str,
    width_mm: float,
    height_mm: float,
    bottom_edge_mm: float,
) -> RectangleComponent:
    """
    Compute area, centroid, and local moment of inertia for one rectangle.

    bottom_edge_mm: distance from bottom fiber to the bottom of this rectangle.
    """
    area_mm2 = width_mm * height_mm
    centroid_from_bottom_mm = bottom_edge_mm + height_mm / 2.0
    local_inertia_mm4 = width_mm * height_mm**3 / 12.0
    return RectangleComponent(
        name=name,
        area_mm2=area_mm2,
        centroid_from_bottom_mm=centroid_from_bottom_mm,
        local_inertia_mm4=local_inertia_mm4,
    )


def _build_i_girder_components(params: GirderInputs) -> List[RectangleComponent]:
    """Discretize I-girder into bottom flange, web, and top flange rectangles."""
    h_total = params.height_mm
    t_bot = params.bottom_flange_thickness_mm
    t_top = params.top_flange_thickness_mm
    h_web = h_total - t_bot - t_top

    components = [
        _rectangle_props(
            "Sayap Bawah",
            params.bottom_flange_width_mm,
            t_bot,
            bottom_edge_mm=0.0,
        ),
        _rectangle_props(
            "Badan (Web)",
            params.web_thickness_mm,
            h_web,
            bottom_edge_mm=t_bot,
        ),
        _rectangle_props(
            "Sayap Atas",
            params.top_flange_width_mm,
            t_top,
            bottom_edge_mm=t_bot + h_web,
        ),
    ]
    return components


def compute_section_properties(params: GirderInputs) -> SectionProperties:
    """
    Calculate A, y_b, y_t, Ix, Z_t, Z_b using composite rectangle method (PRD §3.1).

    Reference axis: bottom fiber y = 0.
    """
    components = _build_i_girder_components(params)

    areas = np.array([c.area_mm2 for c in components], dtype=float)
    centroids = np.array([c.centroid_from_bottom_mm for c in components], dtype=float)
    local_inertias = np.array([c.local_inertia_mm4 for c in components], dtype=float)

    # Luas penampang total: A = Σ A_i
    area_total_mm2 = float(np.sum(areas))

    # Titik berat terhadap serat bawah: y_b = Σ(A_i * y_i) / A
    centroid_bottom_mm = float(np.sum(areas * centroids) / area_total_mm2)

    # Titik berat terhadap serat atas: y_t = H - y_b
    centroid_top_mm = params.height_mm - centroid_bottom_mm

    # Momen inersia terhadap sumbu netral: Ix = Σ(I_g,i + A_i*(y_i - y_b)^2)
    parallel_axis_terms = areas * (centroids - centroid_bottom_mm) ** 2
    inertia_mm4 = float(np.sum(local_inertias + parallel_axis_terms))

    # Modulus penampang: Z = I / y
    modulus_top_mm3 = inertia_mm4 / centroid_top_mm
    modulus_bottom_mm3 = inertia_mm4 / centroid_bottom_mm

    web_height_mm = params.height_mm - (
        params.top_flange_thickness_mm + params.bottom_flange_thickness_mm
    )

    return SectionProperties(
        area_mm2=area_total_mm2,
        centroid_from_bottom_mm=centroid_bottom_mm,
        centroid_from_top_mm=centroid_top_mm,
        inertia_mm4=inertia_mm4,
        modulus_top_mm3=modulus_top_mm3,
        modulus_bottom_mm3=modulus_bottom_mm3,
        web_height_mm=web_height_mm,
        components=components,
    )


def section_properties_to_dict(section: SectionProperties) -> Dict[str, float]:
    """Convert section properties to a flat dictionary for display."""
    return {
        "Luas (A)": section.area_mm2,
        "y_b (dari serat bawah)": section.centroid_from_bottom_mm,
        "y_t (dari serat atas)": section.centroid_from_top_mm,
        "Momen Inersia (Ix)": section.inertia_mm4,
        "Modulus Atas (Z_t)": section.modulus_top_mm3,
        "Modulus Bawah (Z_b)": section.modulus_bottom_mm3,
        "Tinggi Web": section.web_height_mm,
    }
