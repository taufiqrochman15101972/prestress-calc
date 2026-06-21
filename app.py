"""
PRESTRESS-CALC — Pre-stressed Concrete I-Girder Design Tool
Single Page Application (Streamlit) — Post-Tension Girder SLS Check
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import streamlit as st

# Ensure project root is on path when running via streamlit
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from engine.loading import compute_moments, moments_to_dict
from engine.prestress import compute_prestress_forces, prestress_to_dict
from engine.section_properties import compute_section_properties, section_properties_to_dict
from engine.stress_check import (
    compute_stress_checks,
    stress_distribution_along_depth,
    stress_summary_table,
)
from engine.validation import GirderInputs, validate_inputs

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="PRESTRESS-CALC",
    page_icon="🏗️",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("PRESTRESS-CALC")
st.caption(
    "Perhitungan Gelagar Beton Prategang Pasca-Tarik (Post-Tension) — "
    "Kontrol Tegangan SLS (ACI 318 / SNI 2847)"
)

# ---------------------------------------------------------------------------
# Sidebar — Input Panel
# ---------------------------------------------------------------------------
with st.sidebar:
    st.header("Input Parameter")

    st.subheader("Geometri I-Girder")
    height_mm = st.number_input("Tinggi Total (H) [mm]", value=1200.0, min_value=1.0)
    top_flange_width_mm = st.number_input("Lebar Sayap Atas [mm]", value=400.0, min_value=1.0)
    top_flange_thickness_mm = st.number_input("Tebal Sayap Atas [mm]", value=150.0, min_value=1.0)
    web_thickness_mm = st.number_input("Tebal Badan / Web [mm]", value=200.0, min_value=1.0)
    bottom_flange_width_mm = st.number_input("Lebar Sayap Bawah [mm]", value=600.0, min_value=1.0)
    bottom_flange_thickness_mm = st.number_input("Tebal Sayap Bawah [mm]", value=200.0, min_value=1.0)
    span_length_mm = st.number_input("Panjang Bentang (L) [mm]", value=20000.0, min_value=1.0)

    st.subheader("Material")
    fc_mpa = st.number_input("f'c — Mutu Beton Servis [MPa]", value=35.0, min_value=1.0)
    fci_mpa = st.number_input("f'ci — Mutu Beton Transfer [MPa]", value=28.0, min_value=1.0)
    fpu_mpa = st.number_input("fpu — Tegangan Ultimit Strand [MPa]", value=1860.0, min_value=1.0)

    st.subheader("Prategang (Post-Tension)")
    num_strands = st.number_input("Jumlah Strand", value=19, min_value=1, step=1)
    aps_mm2 = st.number_input("Luas Total Tendon (Aps) [mm²]", value=1387.0, min_value=1.0)
    jacking_ratio = st.number_input(
        "Rasio Tegangan Jack (ρ)", value=0.75, min_value=0.01, max_value=1.0, step=0.01
    )
    eccentricity_mm = st.number_input(
        "Eksentrisitas Tendon di Midspan (e) [mm]", value=400.0, min_value=0.0
    )

    st.subheader("Beban")
    sdl_kn_m = st.number_input("Beban Mati Tambahan (SIDL) [kN/m]", value=5.0, min_value=0.0)
    live_load_kn_m = st.number_input("Beban Hidup (Live Load) [kN/m]", value=20.0, min_value=0.0)

    gamma_concrete = st.number_input(
        "Berat Jenis Beton (γ) [kN/m³]", value=24.0, min_value=1.0
    )
    service_loss = (
        st.number_input(
            "Kehilangan Prategang Servis [%]",
            value=20.0,
            min_value=0.0,
            max_value=99.0,
            help="Estimasi total loss untuk tahap servis: Pe = Pj × (1 - loss%)",
        )
        / 100.0
    )

    with st.expander("Info Satuan & Asumsi"):
        st.markdown(
            """
            - **Satuan:** mm, MPa, kN, kN/m, kN·m
            - **Balok:** lentur sederhana jepit-jepit, M = wL²/8
            - **Penampang:** I-girder non-komposit
            - **Transfer:** Pi = Pj (tanpa immediate loss)
            - **Servis:** Pe = Pj × (1 − loss%)
            - **Batas tegangan:**
              - Tekan: 0.60 × f'c (f'ci untuk transfer)
              - Tarik: 0.50 × √f'c
            """
        )

# ---------------------------------------------------------------------------
# Build input object & validate
# ---------------------------------------------------------------------------
inputs = GirderInputs(
    height_mm=height_mm,
    top_flange_width_mm=top_flange_width_mm,
    top_flange_thickness_mm=top_flange_thickness_mm,
    web_thickness_mm=web_thickness_mm,
    bottom_flange_width_mm=bottom_flange_width_mm,
    bottom_flange_thickness_mm=bottom_flange_thickness_mm,
    span_length_mm=span_length_mm,
    fc_mpa=fc_mpa,
    fci_mpa=fci_mpa,
    fpu_mpa=fpu_mpa,
    num_strands=int(num_strands),
    aps_mm2=aps_mm2,
    jacking_ratio=jacking_ratio,
    eccentricity_mm=eccentricity_mm,
    sdl_kn_m=sdl_kn_m,
    live_load_kn_m=live_load_kn_m,
    gamma_concrete_kn_m3=gamma_concrete,
    service_loss_fraction=service_loss,
)

is_valid, validation_errors = validate_inputs(inputs)

if not is_valid:
    st.error("Input tidak valid. Perbaiki parameter berikut:")
    for err in validation_errors:
        st.warning(err)
    st.stop()

# ---------------------------------------------------------------------------
# Core engine pipeline
# ---------------------------------------------------------------------------
section = compute_section_properties(inputs)
moments = compute_moments(inputs, section)
prestress = compute_prestress_forces(inputs)
stresses = compute_stress_checks(inputs, section, moments, prestress)

# Guard against degenerate moduli (should not happen after validation)
if section.modulus_top_mm3 <= 0 or section.modulus_bottom_mm3 <= 0:
    st.error("Modulus penampang tidak valid (Z ≤ 0). Periksa geometri penampang.")
    st.stop()

# ---------------------------------------------------------------------------
# Output Panel — Summary tables
# ---------------------------------------------------------------------------
col_left, col_right = st.columns(2)

with col_left:
    st.subheader("Sifat Penampang")
    df_section = pd.DataFrame(
        {"Parameter": list(section_properties_to_dict(section).keys()),
         "Nilai": [f"{v:,.2f}" for v in section_properties_to_dict(section).values()],
         "Satuan": ["mm²", "mm", "mm", "mm⁴", "mm³", "mm³", "mm"]},
    )
    st.dataframe(df_section, use_container_width=True, hide_index=True)

with col_right:
    st.subheader("Momen & Gaya Prategang")
    moment_dict = moments_to_dict(moments)
    prestress_dict = prestress_to_dict(prestress)
    combined = {**moment_dict, **prestress_dict}
    units = ["kN/m"] + ["kN·m"] * 4 + ["MPa", "kN", "kN", "kN", "kN", "-", "-", "mm²"]
    df_loads = pd.DataFrame(
        {"Parameter": list(combined.keys()),
         "Nilai": [f"{v:,.3f}" if isinstance(v, float) else str(v) for v in combined.values()],
         "Satuan": units[: len(combined)]},
    )
    st.dataframe(df_loads, use_container_width=True, hide_index=True)

# ---------------------------------------------------------------------------
# Status Validasi
# ---------------------------------------------------------------------------
st.subheader("Status Validasi Tegangan")

status_cols = st.columns(4)

status_cards = [
    ("Transfer — Serat Atas", stresses.transfer.top_fiber),
    ("Transfer — Serat Bawah", stresses.transfer.bottom_fiber),
    ("Servis — Serat Atas", stresses.service.top_fiber),
    ("Servis — Serat Bawah", stresses.service.bottom_fiber),
]

for col, (label, fiber) in zip(status_cols, status_cards):
    with col:
        if fiber.is_safe:
            st.success(f"**{label}**\n\nAMAN")
        else:
            st.error(f"**{label}**\n\nOVERSTRESS")
        st.caption(
            f"σ = {fiber.stress_mpa:+.2f} MPa | "
            f"Batas tekan = −{fiber.compression_limit_mpa:.2f} MPa | "
            f"Batas tarik = +{fiber.tension_limit_mpa:.2f} MPa"
        )

overall_label = "AMAN" if stresses.is_overall_safe else "OVERSTRESS"
if stresses.is_overall_safe:
    st.success(f"**Keseluruhan: {overall_label}** — Semua serat memenuhi batas tegangan.")
else:
    st.error(f"**Keseluruhan: {overall_label}** — Satu atau lebih serat melampaui batas.")

st.subheader("Ringkasan Tegangan")
df_stress = pd.DataFrame(stress_summary_table(stresses))
st.dataframe(df_stress, use_container_width=True, hide_index=True)

# ---------------------------------------------------------------------------
# Plotly Visualizations
# ---------------------------------------------------------------------------
st.subheader("Diagram Penampang & Distribusi Tegangan")


def _build_i_girder_polygon(params: GirderInputs) -> dict:
    """Return polygon coordinates for I-girder cross-section (mm)."""
    H = params.height_mm
    b_top = params.top_flange_width_mm
    t_top = params.top_flange_thickness_mm
    b_web = params.web_thickness_mm
    b_bot = params.bottom_flange_width_mm
    t_bot = params.bottom_flange_thickness_mm
    h_web = H - t_top - t_bot

    # Centered about x=0
    x_bot_l, x_bot_r = -b_bot / 2, b_bot / 2
    x_web_l, x_web_r = -b_web / 2, b_web / 2
    x_top_l, x_top_r = -b_top / 2, b_top / 2

    y_bot = 0
    y_web_bot = t_bot
    y_web_top = t_bot + h_web
    y_top = H

    x_coords = [
        x_bot_l, x_bot_r, x_bot_r, x_web_r, x_web_r,
        x_top_r, x_top_r, x_top_l, x_top_l, x_web_l,
        x_web_l, x_bot_l, x_bot_l,
    ]
    y_coords = [
        y_bot, y_bot, y_web_bot, y_web_bot, y_web_top,
        y_web_top, y_top, y_top, y_web_top, y_web_top,
        y_web_bot, y_web_bot, y_bot,
    ]
    return {"x": x_coords, "y": y_coords}


def _plot_cross_section_and_stress(
    params: GirderInputs,
    section_props,
    stress_results,
) -> go.Figure:
    """Combined Plotly figure: I-girder section + stress profiles."""
    poly = _build_i_girder_polygon(params)
    H = params.height_mm

    dist_transfer = stress_distribution_along_depth(
        stress_results.transfer.sigma_top_mpa,
        stress_results.transfer.sigma_bottom_mpa,
        H,
    )
    dist_service = stress_distribution_along_depth(
        stress_results.service.sigma_top_mpa,
        stress_results.service.sigma_bottom_mpa,
        H,
    )

    limits_transfer_tens = stress_results.transfer.top_fiber.tension_limit_mpa
    limits_transfer_comp = stress_results.transfer.top_fiber.compression_limit_mpa
    limits_service_tens = stress_results.service.top_fiber.tension_limit_mpa
    limits_service_comp = stress_results.service.top_fiber.compression_limit_mpa

    fig = make_subplots(
        rows=1, cols=2,
        subplot_titles=("Penampang I-Girder", "Distribusi Tegangan (Midspan)"),
        column_widths=[0.45, 0.55],
        horizontal_spacing=0.08,
    )

    # --- Cross-section ---
    fig.add_trace(
        go.Scatter(
            x=poly["x"], y=poly["y"],
            fill="toself",
            fillcolor="rgba(100,149,237,0.25)",
            line=dict(color="steelblue", width=2),
            name="Penampang",
            hoverinfo="skip",
        ),
        row=1, col=1,
    )

    # Neutral axis
    y_na = section_props.centroid_from_bottom_mm
    fig.add_hline(
        y=y_na, line_dash="dash", line_color="gray",
        annotation_text="Garis Netral", row=1, col=1,
    )

    # Tendon position (eccentricity from bottom)
    fig.add_trace(
        go.Scatter(
            x=[0], y=[params.eccentricity_mm],
            mode="markers",
            marker=dict(size=12, color="red", symbol="circle"),
            name="Tendon",
            text=[f"e = {params.eccentricity_mm:.0f} mm"],
            hovertemplate="Tendon<br>y = %{y:.0f} mm<extra></extra>",
        ),
        row=1, col=1,
    )

    fig.update_xaxes(title_text="mm", row=1, col=1)
    fig.update_yaxes(title_text="mm (dari serat bawah)", row=1, col=1)

    # --- Stress distribution ---
    fig.add_trace(
        go.Scatter(
            x=dist_transfer["sigma_mpa"],
            y=dist_transfer["y_mm"],
            mode="lines",
            name="Transfer",
            line=dict(color="orange", width=2),
            hovertemplate="σ = %{x:.2f} MPa<br>y = %{y:.0f} mm<extra>Transfer</extra>",
        ),
        row=1, col=2,
    )
    fig.add_trace(
        go.Scatter(
            x=dist_service["sigma_mpa"],
            y=dist_service["y_mm"],
            mode="lines",
            name="Servis",
            line=dict(color="royalblue", width=2),
            hovertemplate="σ = %{x:.2f} MPa<br>y = %{y:.0f} mm<extra>Servis</extra>",
        ),
        row=1, col=2,
    )

    # Allowable limits (service shown as reference lines)
    for label, x_val, color in [
        ("+f_tens servis", limits_service_tens, "green"),
        ("−f_comp servis", -limits_service_comp, "green"),
        ("+f_tens transfer", limits_transfer_tens, "darkorange"),
        ("−f_comp transfer", -limits_transfer_comp, "darkorange"),
    ]:
        fig.add_vline(
            x=x_val, line_dash="dot", line_color=color, opacity=0.6,
            row=1, col=2,
        )

    fig.update_xaxes(title_text="Tegangan σ (MPa)", row=1, col=2)
    fig.update_yaxes(title_text="Kedalaman y (mm)", row=1, col=2)

    fig.update_layout(
        height=500,
        showlegend=True,
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
        margin=dict(l=40, r=40, t=60, b=40),
    )
    return fig


fig = _plot_cross_section_and_stress(inputs, section, stresses)
st.plotly_chart(fig, use_container_width=True)

# ---------------------------------------------------------------------------
# Detailed stress comparison chart
# ---------------------------------------------------------------------------
with st.expander("Diagram Perbandingan Tegangan (Bar)"):
    labels = ["Atas\nTransfer", "Bawah\nTransfer", "Atas\nServis", "Bawah\nServis"]
    values = [
        stresses.transfer.sigma_top_mpa,
        stresses.transfer.sigma_bottom_mpa,
        stresses.service.sigma_top_mpa,
        stresses.service.sigma_bottom_mpa,
    ]
    colors = [
        "#2ecc71" if stresses.transfer.top_fiber.is_safe else "#e74c3c",
        "#2ecc71" if stresses.transfer.bottom_fiber.is_safe else "#e74c3c",
        "#2ecc71" if stresses.service.top_fiber.is_safe else "#e74c3c",
        "#2ecc71" if stresses.service.bottom_fiber.is_safe else "#e74c3c",
    ]
    fig_bar = go.Figure(
        data=[go.Bar(x=labels, y=values, marker_color=colors, text=[f"{v:+.2f}" for v in values],
                     textposition="outside")],
    )
    tens_limit_servis = stresses.service.top_fiber.tension_limit_mpa
    comp_limit_servis = stresses.service.top_fiber.compression_limit_mpa
    fig_bar.add_hline(
        y=tens_limit_servis,
        line_dash="dash",
        line_color="green",
        annotation_text="Batas tarik servis",
    )
    fig_bar.add_hline(
        y=-comp_limit_servis,
                      line_dash="dash", line_color="green",
                      annotation_text="Batas tekan servis")
    fig_bar.update_layout(
        title="Tegangan Serat — Transfer vs Servis",
        yaxis_title="σ (MPa)",
        height=400,
    )
    st.plotly_chart(fig_bar, use_container_width=True)
