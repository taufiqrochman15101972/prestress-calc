"use client";

import React, { useState } from "react";
import { analyseDxf, type DxfParseResult } from "@/engine/dxfimport";
import { useDesignStore } from "@/store/useDesignStore";

function Row({ label, value, unit, hi }: { label: string; value: string; unit?: string; hi?: boolean }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-0.5 pr-3 text-gray-500 text-[10px]">{label}</td>
      <td className={`py-0.5 font-mono text-right text-[10px] font-semibold ${hi ? "text-blue-700" : "text-gray-800"}`}>{value}</td>
      {unit && <td className="py-0.5 pl-1 text-gray-400 text-[9px]">{unit}</td>}
    </tr>
  );
}
const f = (v: number, d = 0) => (isFinite(v) ? v.toFixed(d) : "—");

export function DxfImportCalculator() {
  const [res, setRes] = useState<DxfParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [scale, setScale] = useState(1);   // ×1 (mm) or ×1000 (m→mm)
  const [msg, setMsg] = useState("");
  const { updateGirder, updateLoads, updateDeck, inputs } = useDesignStore();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const txt = String(rd.result ?? "");
        if (!/\bENTITIES\b|\bLWPOLYLINE\b|\bLINE\b|^\s*0\s*$/m.test(txt)) {
          setMsg("File tidak tampak seperti DXF ASCII. Ekspor dari CAD: SAVE AS → DXF (atau DXFOUT).");
          setRes(null); return;
        }
        setRes(analyseDxf(txt));
        setMsg("");
      } catch { setMsg("Gagal mem-parse DXF."); setRes(null); }
    };
    rd.readAsText(file);
  };

  const mm = (v: number) => v * scale;

  const applySpan = () => {
    if (!res) return;
    updateLoads({ spanLength: Math.round(mm(res.extents.w)) });
    setMsg(`Bentang diterapkan: ${f(mm(res.extents.w))} mm.`);
  };
  const applyDeck = () => {
    if (!res?.memberSpacing) return;
    updateDeck({ widthBeff: Math.round(mm(res.memberSpacing)) });
    setMsg(`Lebar efektif dek = spasi girder: ${f(mm(res.memberSpacing))} mm.`);
  };
  const applyGirderHeight = () => {
    if (!res?.girderProfile) return;
    const Htarget = mm(res.girderProfile.h);
    const g = inputs.girder;
    const Hcur = g.h1 + (g.h5 ?? 0) + g.h2 + (g.h4 ?? 0) + g.h3;
    const k = Htarget / Hcur;
    updateGirder({
      h1: Math.round(g.h1 * k), h2: Math.round(g.h2 * k), h3: Math.round(g.h3 * k),
      h4: Math.round((g.h4 ?? 0) * k), h5: Math.round((g.h5 ?? 0) * k),
    });
    setMsg(`Tinggi girder diskalakan ke ${f(Htarget)} mm (rasio flens dipertahankan).`);
  };

  return (
    <div className="text-[11px] space-y-3">
      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800">
        <b>DWG (biner) tidak dapat dibaca langsung</b> tanpa konverter (ODA/AutoCAD) — tidak tersedia di lingkungan ini.
        Ekspor gambar Anda ke <b>DXF (ASCII)</b> di CAD: <span className="font-mono">SAVE AS → AutoCAD DXF</span> atau perintah <span className="font-mono">DXFOUT</span>, lalu unggah di sini.
        Parser mengekstrak <b>extents (panjang/lebar jembatan), profil girder, spasi girder/diafragma, dimensi & teks</b>, serta kotak substruktur (abutment/pier/pilecap/pierhead).
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="px-3 py-1.5 rounded bg-blue-600 text-white text-[11px] font-semibold cursor-pointer hover:bg-blue-700">
          📐 Pilih file .dxf
          <input type="file" accept=".dxf,text/plain" className="hidden" onChange={onFile} />
        </label>
        {fileName && <span className="text-[10px] text-gray-500 font-mono">{fileName}</span>}
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-gray-500">Satuan gambar:</span>
          <select value={scale} onChange={e => setScale(parseFloat(e.target.value))}
            className="rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px]">
            <option value={1}>milimeter (×1)</option>
            <option value={1000}>meter (×1000 → mm)</option>
            <option value={10}>centimeter (×10)</option>
          </select>
        </div>
      </div>
      {msg && <p className="text-[10px] text-blue-700">{msg}</p>}

      {res && (
        <div className="flex gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-[9px] font-bold uppercase text-gray-400">Ringkasan geometri DXF</p>
            <p className="text-[10px] text-gray-600">{res.note}</p>
            <table className="w-full max-w-md"><tbody>
              <Row label="Jumlah entitas" value={`${res.entityCount}`} />
              <Row label="Layer" value={res.layers.slice(0, 6).join(", ") + (res.layers.length > 6 ? " …" : "")} />
              <Row label="Extents lebar (X)" value={f(mm(res.extents.w))} unit="mm" hi />
              <Row label="Extents tinggi (Y)" value={f(mm(res.extents.h))} unit="mm" hi />
              {res.girderProfile && <Row label="Profil girder b×H" value={`${f(mm(res.girderProfile.w))}×${f(mm(res.girderProfile.h))}`} unit="mm" hi />}
              {res.memberSpacing && <Row label="Spasi girder/anggota (median)" value={f(mm(res.memberSpacing))} unit="mm" hi />}
              <Row label="Jumlah dimensi (kode 42)" value={`${res.dimensions.length}`} />
            </tbody></table>

            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={applySpan} className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] hover:bg-emerald-700">→ Terapkan bentang</button>
              <button onClick={applyDeck} disabled={!res.memberSpacing} className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] hover:bg-emerald-700 disabled:opacity-40">→ Terapkan lebar dek (spasi)</button>
              <button onClick={applyGirderHeight} disabled={!res.girderProfile} className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] hover:bg-emerald-700 disabled:opacity-40">→ Terapkan tinggi girder</button>
            </div>

            {res.rectangles.length > 0 && (<>
              <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Kotak terdeteksi (abutment / pier / pilecap / pierhead — urut luas)</p>
              <table className="w-full max-w-md text-[10px]"><tbody>
                {res.rectangles.slice(0, 6).map((r, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-0.5 text-gray-500">#{i + 1}</td>
                    <td className="py-0.5 font-mono text-right">{f(mm(r.w))} × {f(mm(r.h))}</td>
                    <td className="py-0.5 pl-1 text-gray-400">mm (b×h)</td>
                  </tr>
                ))}
              </tbody></table>
            </>)}
          </div>

          <div className="w-64 flex-none space-y-2">
            <p className="text-[9px] font-bold uppercase text-gray-400">Teks & dimensi pada gambar</p>
            <div className="max-h-72 overflow-auto rounded border border-gray-200 p-2 space-y-0.5">
              {res.dimensions.length > 0 && (
                <p className="text-[9px] text-gray-600"><b>Dimensi:</b> {res.dimensions.slice(0, 20).map(d => f(mm(d))).join(", ")} mm</p>
              )}
              {res.texts.map((t, i) => (
                <p key={i} className="text-[9px] text-gray-600 font-mono truncate">• {t.text}</p>
              ))}
              {res.texts.length === 0 && res.dimensions.length === 0 && <p className="text-[9px] text-gray-400">Tidak ada teks/dimensi terbaca.</p>}
            </div>
            <p className="text-[9px] text-gray-400 leading-snug">Nilai tinggi abutment, lebar/tinggi pier, frontwall, wingwall, pilecap, pierhead, & diameter pile dapat dibaca dari daftar teks/dimensi di atas lalu dimasukkan ke tab 🏛️ Bangunan Bawah / 🪨 Pondasi.</p>
          </div>
        </div>
      )}
    </div>
  );
}
