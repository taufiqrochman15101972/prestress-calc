"use client";

import React, { useCallback } from "react";
import { useDesignStore, resolveTendon } from "@/store/useDesignStore";
import { GIRDER_PRESETS } from "@/lib/presets";
import { STRAND_DB, suggestTendonLayout, tendonUnit, findStrand } from "@/lib/strands";
import { girderHeight } from "@/engine/section";
import { CloudModal } from "@/components/CloudModal";
import type { TendonProfileType, ACIBeamClass } from "@/types";

// ─── Primitive helpers ────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
      {children}
    </span>
  );
}

function SectionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 bg-gray-100 border-y border-gray-200 px-3 py-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{children}</p>
    </div>
  );
}

function NumField({
  label, unit, value, onChange, min = 0, step = 1, readOnly = false,
}: {
  label: string; unit?: string; value: number;
  onChange?: (v: number) => void;
  min?: number; step?: number; readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <Label>{label}</Label>
      <div className="relative flex items-center">
        <input
          type="number"
          readOnly={readOnly}
          value={readOnly ? value.toFixed(0) : value}
          min={min} step={step}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && onChange) onChange(v);
          }}
          className={`w-full rounded border px-2 py-1 text-xs font-mono
            focus:outline-none focus:ring-1 focus:ring-blue-400
            ${readOnly
              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              : "bg-white border-gray-300 text-gray-800"}
            ${unit ? "pr-9" : ""}`}
        />
        {unit && (
          <span className="absolute right-2 text-[10px] text-gray-400 pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── InputPanel ───────────────────────────────────────────────

export function InputPanel() {
  const {
    inputs,
    updateProjectInfo,
    updateGirder, setGirder,
    updateDeck, updateMaterial, updateTendon,
    updateLoads, updateImmediateLoss, updatePartialPrestress, updateFoundation,
    addTendonRow, removeTendonRow, updateTendonRow,
    saveToLocal, loadFromLocal,
  } = useDesignStore();

  const { projectInfo, girder, deck, material, tendon, loads, immediateLoss, partialPrestress, foundation } = inputs;
  const [saveMsg, setSaveMsg] = React.useState("");
  const [cloudOpen, setCloudOpen] = React.useState(false);

  const hTotal = girderHeight(girder);
  const h4 = girder.h4 ?? 0;
  const h5 = girder.h5 ?? 0;

  // Derived tendon summary
  const { totalStrands, Aps, eccentricityMidspan } = React.useMemo(() => {
    // Approximate gross yb with trapezoid-aware formula (use gross from engine if available)
    // For display purposes, use simple 3-rect approximation
    const areas = [girder.b3 * girder.h3, girder.b2 * girder.h2, girder.b1 * girder.h1];
    const centroids = [girder.h3 / 2, girder.h3 + girder.h2 / 2, girder.h3 + girder.h2 + girder.h1 / 2];
    const Ag = areas.reduce((s, a) => s + a, 0);
    const yb = areas.reduce((s, a, i) => s + a * centroids[i], 0) / Ag;
    return resolveTendon(tendon, yb);
  }, [tendon, girder]);

  const handleProfileChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      updateTendon({ profileType: e.target.value as TendonProfileType }),
    [updateTendon]
  );

  // Apply girder preset
  const handlePreset = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const preset = GIRDER_PRESETS.find(p => p.id === e.target.value);
      if (preset) setGirder(preset.girder);
    },
    [setGirder]
  );

  return (
    <aside className="w-[272px] flex-none flex flex-col overflow-y-auto border-r border-gray-200 bg-gray-50 text-xs">

      {/* Header */}
      <div className="flex-none px-3 py-2 bg-blue-700 text-white">
        <p className="font-bold text-xs uppercase tracking-wide">Parameter Input</p>
      </div>

      {/* ── Info Proyek ── */}
      <SectionBar>Info Proyek</SectionBar>
      <div className="px-3 py-2 space-y-1.5">
        {(["namaProyek","noPekerjaan","perencana","lokasi"] as const).map((key) => {
          const labels: Record<string, string> = {
            namaProyek: "Nama Proyek", noPekerjaan: "No. Pekerjaan",
            perencana: "Perencana", lokasi: "Lokasi",
          };
          return (
            <div key={key} className="flex flex-col gap-0.5">
              <Label>{labels[key]}</Label>
              <input
                type="text"
                value={projectInfo[key]}
                onChange={(e) => updateProjectInfo({ [key]: e.target.value })}
                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800
                  focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          );
        })}
        <div className="flex gap-1 pt-1">
          <button
            onClick={() => { saveToLocal(); setSaveMsg("Tersimpan!"); setTimeout(() => setSaveMsg(""), 2000); }}
            className="flex-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold py-1 transition-colors">
            💾 Simpan
          </button>
          <button
            onClick={() => { const ok = loadFromLocal(); setSaveMsg(ok ? "Data dimuat!" : "Tidak ada data"); setTimeout(() => setSaveMsg(""), 2000); }}
            className="flex-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 text-[10px] font-bold py-1 transition-colors">
            📂 Muat
          </button>
          <button
            onClick={() => setCloudOpen(true)}
            className="flex-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold py-1 transition-colors"
            title="Simpan/Muat dari Supabase cloud">
            ☁ Cloud
          </button>
        </div>
        {saveMsg && (
          <p className="text-center text-[10px] font-semibold text-green-700">{saveMsg}</p>
        )}
        <CloudModal open={cloudOpen} onClose={() => setCloudOpen(false)} />
      </div>

      {/* ── Profil Girder & Geometri ── */}
      <SectionBar>Geometri I-Girder</SectionBar>
      <div className="px-3 py-2 space-y-2">
        {/* Preset selector */}
        <div className="flex flex-col gap-0.5">
          <Label>Profil Standar (Preset)</Label>
          <select
            defaultValue="custom"
            onChange={handlePreset}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs
              focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {GIRDER_PRESETS.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.spanRange !== "—" ? ` (${p.spanRange})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* H_total badge */}
        <div className="flex items-center gap-2 rounded bg-blue-50 border border-blue-200 px-2 py-1">
          <span className="text-[10px] text-blue-600 font-semibold">
            H = h₁+h₅+h₂+h₄+h₃ =
          </span>
          <span className="font-mono font-bold text-blue-800 text-sm">{hTotal}</span>
          <span className="text-[10px] text-blue-500">mm</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NumField label="b₁ Sayap Atas" unit="mm" value={girder.b1}
            onChange={(v) => updateGirder({ b1: v })} />
          <NumField label="h₁ Tebal Sayap Atas" unit="mm" value={girder.h1}
            onChange={(v) => updateGirder({ h1: v })} />

          {/* Top fillet */}
          <NumField label="h₅ Chamfer Atas" unit="mm" value={h5} min={0}
            onChange={(v) => updateGirder({ h5: v })} />
          <div className="flex flex-col justify-end pb-0.5">
            <span className="text-[9px] text-purple-500 italic">b₁→b₂ (opsional)</span>
          </div>

          <NumField label="b₂ Lebar Web" unit="mm" value={girder.b2}
            onChange={(v) => updateGirder({ b2: v })} />
          <NumField label="h₂ Tinggi Web" unit="mm" value={girder.h2}
            onChange={(v) => updateGirder({ h2: v })} />

          {/* Bottom fillet */}
          <NumField label="h₄ Chamfer Bawah" unit="mm" value={h4} min={0}
            onChange={(v) => updateGirder({ h4: v })} />
          <div className="flex flex-col justify-end pb-0.5">
            <span className="text-[9px] text-purple-500 italic">b₂→b₃ (opsional)</span>
          </div>

          <NumField label="b₃ Sayap Bawah" unit="mm" value={girder.b3}
            onChange={(v) => updateGirder({ b3: v })} />
          <NumField label="h₃ Tebal Sayap Bawah" unit="mm" value={girder.h3}
            onChange={(v) => updateGirder({ h3: v })} />

          <div className="col-span-2">
            <NumField label="Panjang Bentang L" unit="mm" value={loads.spanLength} step={500}
              onChange={(v) => updateLoads({ spanLength: v })} />
          </div>
        </div>
      </div>

      {/* ── Pelat Komposit ── */}
      <SectionBar>Pelat Lantai Komposit</SectionBar>
      <div className="px-3 py-2 grid grid-cols-2 gap-2">
        <NumField label="Tebal tᵈ" unit="mm" value={deck.thicknessTd}
          onChange={(v) => updateDeck({ thicknessTd: v })} />
        <NumField label="Lebar Efektif b_eff" unit="mm" value={deck.widthBeff} step={100}
          onChange={(v) => updateDeck({ widthBeff: v })} />
        <NumField label="f'c Pelat" unit="MPa" value={deck.fcDeck}
          onChange={(v) => updateDeck({ fcDeck: v })} />
        <NumField label="f'c Girder (servis)" unit="MPa" value={deck.fcGirder}
          onChange={(v) => updateDeck({ fcGirder: v })} />
      </div>

      {/* ── Material ── */}
      <SectionBar>Material Beton &amp; Baja</SectionBar>
      <div className="px-3 py-2 grid grid-cols-2 gap-2">
        <NumField label="f'ci Transfer" unit="MPa" value={material.fci}
          onChange={(v) => updateMaterial({ fci: v })} />
        <NumField label="f'c Girder" unit="MPa" value={material.fc}
          onChange={(v) => updateMaterial({ fc: v })} />
        <NumField label="fpu Strand" unit="MPa" value={material.fpu}
          onChange={(v) => updateMaterial({ fpu: v })} />
        <NumField label="Eps Strand" unit="MPa" value={material.Eps} step={1000}
          onChange={(v) => updateMaterial({ Eps: v })} />
        <NumField label="fy Baja Mild" unit="MPa" value={material.fy}
          onChange={(v) => updateMaterial({ fy: v })} />
        <NumField label="fys Sengkang" unit="MPa" value={material.fys}
          onChange={(v) => updateMaterial({ fys: v })} />
        <NumField label="As Tulangan Tarik" unit="mm²" value={material.As} step={100}
          onChange={(v) => updateMaterial({ As: v })} />
        <NumField label="γ Beton" unit="kN/m³" value={loads.gammaConc} step={0.5}
          onChange={(v) => updateLoads({ gammaConc: v })} />
      </div>

      {/* ── Prategang Sebagian ── */}
      <SectionBar>Prategang Penuh / Sebagian</SectionBar>
      <div className="px-3 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="partial-ps"
            checked={partialPrestress.enabled}
            onChange={(e) => updatePartialPrestress({ enabled: e.target.checked })}
            className="rounded border-gray-300"
          />
          <label htmlFor="partial-ps" className="text-xs text-gray-700 font-medium">
            Prategang Sebagian (Partial)
          </label>
        </div>
        {partialPrestress.enabled && (
          <div className="flex flex-col gap-0.5">
            <Label>ACI Beam Class (Tegangan Tarik Servis)</Label>
            <select
              value={partialPrestress.beamClass}
              onChange={(e) => updatePartialPrestress({ beamClass: e.target.value as ACIBeamClass })}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs
                focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="U">Class U — 0.50√f'c (tidak retak)</option>
              <option value="T">Class T — 1.00√f'c (transisi)</option>
              <option value="C">Class C — 1.00√f'c (retak, cek lebar retak)</option>
            </select>
            <p className="text-[9px] text-gray-400 mt-0.5">
              PPR = Aps·fps / (Aps·fps + As·fy)
            </p>
          </div>
        )}
        {!partialPrestress.enabled && (
          <p className="text-[10px] text-gray-400">
            Prategang penuh — Kelas U, batas tarik 0.50√f&apos;c
          </p>
        )}
      </div>

      {/* ── Konfigurasi Tendon ── */}
      <SectionBar>Konfigurasi Tendon</SectionBar>
      <div className="px-3 py-2 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-0.5 col-span-2">
            <Label>Profil Lintasan Tendon</Label>
            <select value={tendon.profileType} onChange={handleProfileChange}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs
                focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="PARABOLIC">Parabolik</option>
              <option value="HARPED">Patah (Harped)</option>
              <option value="STRAIGHT">Lurus</option>
            </select>
          </div>
          <div className="flex flex-col gap-0.5 col-span-2">
            <Label>Strand Standar (ASTM A416 / AASHTO M203)</Label>
            <select
              value={
                STRAND_DB.find(
                  (s) => Math.abs(s.areaMm2 - tendon.singleStrandArea) < 0.05
                    && Math.abs(s.diameterMm - tendon.strandDiameter) < 0.05
                )?.id ?? "custom"
              }
              onChange={(e) => {
                const s = findStrand(e.target.value);
                if (s) {
                  updateTendon({
                    singleStrandArea: s.areaMm2, strandDiameter: s.diameterMm,
                    fpu: s.fpu, fpy: s.fpy,
                  });
                  updateMaterial({ fpu: s.fpu, fpy: s.fpy });
                }
              }}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs
                focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="custom">— Kustom (isi manual) —</option>
              {STRAND_DB.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · A={s.areaMm2} mm² · MBL={s.mblKn} kN
                </option>
              ))}
            </select>
          </div>
          <NumField label="Luas 1 Strand" unit="mm²" value={tendon.singleStrandArea} step={0.1}
            onChange={(v) => updateTendon({ singleStrandArea: v })} />
          <NumField label="Ø Strand" unit="mm" value={tendon.strandDiameter} step={0.5}
            onChange={(v) => updateTendon({ strandDiameter: v })} />
          <NumField label="Rasio Jack ρ" value={tendon.jackingRatio} step={0.01} min={0.01}
            onChange={(v) => updateTendon({ jackingRatio: v })} />
          <NumField label="e Tumpuan" unit="mm" value={tendon.eccentricitySupport} min={-9999}
            onChange={(v) => updateTendon({ eccentricitySupport: v })} />
          {tendon.profileType === "HARPED" && (
            <NumField label="x_g/L (hold-down)" value={tendon.holdDownRatio} step={0.05} min={0.05}
              onChange={(v) => updateTendon({ holdDownRatio: v })} />
          )}
        </div>

        {/* Summary box */}
        <div className="rounded bg-blue-50 border border-blue-200 px-2 py-1.5 text-[10px] space-y-0.5">
          <div className="flex justify-between">
            <span className="text-blue-600">Total strand:</span>
            <span className="font-bold text-blue-800">{totalStrands}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-600">A_ps total:</span>
            <span className="font-bold text-blue-800">{Aps.toFixed(1)} mm²</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-600">e midspan:</span>
            <span className="font-bold text-blue-800">{eccentricityMidspan.toFixed(1)} mm</span>
          </div>
          {totalStrands > 0 && (() => {
            // Multi-tendon PT arrangement (prioritized post-tensioned system)
            const layout = suggestTendonLayout(totalStrands);
            const s = STRAND_DB.find(
              (x) => Math.abs(x.areaMm2 - tendon.singleStrandArea) < 0.05
            ) ?? STRAND_DB[2]; // default 12.7 mm G270
            const u = tendonUnit(layout.unitSize, s);
            return (
              <div className="border-t border-blue-200 pt-1 mt-1 space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-blue-600">Susunan PT multi-tendon:</span>
                  <span className="font-bold text-blue-800">{layout.nTendons} × tendon-{layout.unitSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-600">Duct Ø dalam / MBL unit:</span>
                  <span className="font-bold text-blue-800">{u.ductIdMm} mm · {u.mblKn} kN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-600">P_jack 0.75fpu / maks 0.80fpu:</span>
                  <span className="font-bold text-blue-800">{u.pJack075} / {u.pMax080} kN</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Tendon rows */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-gray-600 uppercase">Baris Tendon / Strand</span>
            <button onClick={addTendonRow}
              className="text-[10px] px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 font-semibold">
              + Baris
            </button>
          </div>
          <table className="w-full border border-gray-200 rounded text-[10px]">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-1 py-1 text-left font-semibold text-gray-600">#</th>
                <th className="px-1 py-1 text-center font-semibold text-gray-600">n</th>
                <th className="px-1 py-1 text-center font-semibold text-gray-600">y (mm)</th>
                <th className="px-1 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {tendon.rows.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-1 py-0.5 text-gray-500 font-mono">{idx + 1}</td>
                  <td className="px-1 py-0.5">
                    <input type="number" min={1} step={1} value={row.strandCount}
                      onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) updateTendonRow(row.id, { strandCount: v }); }}
                      className="w-full text-center rounded border border-gray-200 px-1 py-0.5 font-mono text-[10px]
                        focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </td>
                  <td className="px-1 py-0.5">
                    <input type="number" min={10} step={5} value={row.yFromBottom}
                      onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) updateTendonRow(row.id, { yFromBottom: v }); }}
                      className="w-full text-center rounded border border-gray-200 px-1 py-0.5 font-mono text-[10px]
                        focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </td>
                  <td className="px-1 py-0.5 text-center">
                    {tendon.rows.length > 1 && (
                      <button onClick={() => removeTendonRow(row.id)}
                        className="text-red-400 hover:text-red-600 font-bold leading-none">×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Beban ── */}
      <SectionBar>Beban</SectionBar>
      <div className="px-3 py-2 grid grid-cols-2 gap-2">
        <NumField label="SIDL" unit="kN/m" value={loads.wSDL} step={0.5}
          onChange={(v) => updateLoads({ wSDL: v })} />
        <NumField label="Live Load" unit="kN/m" value={loads.wLive} step={0.5}
          onChange={(v) => updateLoads({ wLive: v })} />
        <NumField label="RH Kelembapan" unit="%" value={loads.relativeHumidity} step={5}
          onChange={(v) => updateLoads({ relativeHumidity: v })} />
        <NumField label="Tu Torsi" unit="kN·m" value={loads.tuTorsion} min={0} step={10}
          onChange={(v) => updateLoads({ tuTorsion: v })} />
      </div>

      {/* ── Konfigurasi Bentang ── */}
      <SectionBar>Konfigurasi Bentang</SectionBar>
      <div className="px-3 py-2 space-y-2">
        <div className="flex flex-col gap-0.5">
          <Label>Jumlah Bentang</Label>
          <select
            value={loads.nSpans ?? 1}
            onChange={(e) => updateLoads({ nSpans: parseInt(e.target.value) as 1|2|3 })}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs
              focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value={1}>1 Bentang (Gerber / Simply Supported)</option>
            <option value={2}>2 Bentang Menerus (Continuous)</option>
            <option value={3}>3 Bentang Menerus</option>
          </select>
        </div>
        {(loads.nSpans ?? 1) > 1 && (
          <div className="rounded bg-indigo-50 border border-indigo-200 p-2 text-[10px] text-indigo-700">
            Momen sekunder akan dihitung otomatis dari eksentrisitas tendon.
            Pastikan e_tumpuan diisi sesuai posisi tendon di tumpuan interior.
          </div>
        )}
      </div>

      {/* ── Kehilangan Seketika ── */}
      <SectionBar>Kehilangan Prategang Seketika</SectionBar>
      <div className="px-3 py-2 grid grid-cols-2 gap-2">
        <NumField label="μ Gesek" value={immediateLoss.mu} step={0.01} min={0.01}
          onChange={(v) => updateImmediateLoss({ mu: v })} />
        <NumField label="K Wobble" unit="/mm" value={immediateLoss.K} step={0.000001}
          onChange={(v) => updateImmediateLoss({ K: v })} />
        <NumField label="Δset Slip" unit="mm" value={immediateLoss.deltaSet} step={1}
          onChange={(v) => updateImmediateLoss({ deltaSet: v })} />
        <NumField label="N Kelompok Jack" value={immediateLoss.numJackingGroups} min={1}
          onChange={(v) => updateImmediateLoss({ numJackingGroups: Math.round(v) })} />
      </div>

      {/* ── Analisis & Desain Pondasi (opt-in → masuk laporan PDF) ── */}
      <SectionBar>Analisis &amp; Desain Pondasi</SectionBar>
      <div className="px-3 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <input id="fdn-enabled" type="checkbox" checked={foundation.enabled}
            onChange={(e) => updateFoundation({ enabled: e.target.checked })}
            className="h-3.5 w-3.5" />
          <label htmlFor="fdn-enabled" className="text-xs text-gray-700 font-medium">
            🪨 Sertakan analisis &amp; desain pondasi di laporan
          </label>
        </div>
        {foundation.enabled ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5">
                <Label>Pemasangan</Label>
                <select value={foundation.install}
                  onChange={(e) => updateFoundation({ install: e.target.value as "DRIVEN" | "BORED" })}
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                  <option value="BORED">Bor (bored/shaft)</option>
                  <option value="DRIVEN">Pancang (driven)</option>
                </select>
              </div>
              <div className="flex flex-col gap-0.5">
                <Label>Jenis Tanah</Label>
                <select value={foundation.soil}
                  onChange={(e) => updateFoundation({ soil: e.target.value as "CLAY" | "SAND" })}
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                  <option value="SAND">Pasir (φ)</option>
                  <option value="CLAY">Lempung (c_u)</option>
                </select>
              </div>
              <NumField label="D tiang" unit="m" value={foundation.size} step={0.1}
                onChange={(v) => updateFoundation({ size: v })} />
              <NumField label="L tiang" unit="m" value={foundation.length} step={1}
                onChange={(v) => updateFoundation({ length: v })} />
              {foundation.soil === "CLAY"
                ? <NumField label="c_u" unit="kPa" value={foundation.cu} step={5}
                    onChange={(v) => updateFoundation({ cu: v })} />
                : <NumField label="φ'" unit="°" value={foundation.phi} step={1}
                    onChange={(v) => updateFoundation({ phi: v })} />}
              <NumField label="γ tanah" unit="kN/m³" value={foundation.gamma} step={0.5}
                onChange={(v) => updateFoundation({ gamma: v })} />
              <NumField label="M.A.T" unit="m" value={foundation.waterDepth} step={0.5}
                onChange={(v) => updateFoundation({ waterDepth: v })} />
              <NumField label="FS" value={foundation.FS} step={0.5}
                onChange={(v) => updateFoundation({ FS: v })} />
              <NumField label="baris m" value={foundation.rows} step={1}
                onChange={(v) => updateFoundation({ rows: Math.round(v) })} />
              <NumField label="kolom n" value={foundation.cols} step={1}
                onChange={(v) => updateFoundation({ cols: Math.round(v) })} />
              <NumField label="spasi s" unit="m" value={foundation.spacing} step={0.1}
                onChange={(v) => updateFoundation({ spacing: v })} />
              <NumField label="P demand grup" unit="kN" value={foundation.Pdemand} step={500}
                onChange={(v) => updateFoundation({ Pdemand: v })} />
            </div>
            <p className="text-[10px] text-gray-400">
              Saat dicentang, §30 Pondasi (kapasitas tiang, grup, penurunan, daya dukung dangkal)
              ikut dihitung &amp; muncul di laporan PDF. Detail lebih lengkap (lateral Broms,
              pemancangan dinamik, fondasi mesin) di tab 🪨 Pondasi.
            </p>
          </>
        ) : (
          <p className="text-[10px] text-gray-400">
            Tidak dicentang → pondasi tidak ikut dihitung &amp; tidak muncul di laporan.
          </p>
        )}
      </div>

    </aside>
  );
}
