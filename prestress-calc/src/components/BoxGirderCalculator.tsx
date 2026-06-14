"use client";

import React, { useState, useMemo } from "react";
import { computeBoxGirder, computeBoxDistortion, computeBoxShearLag } from "@/engine/boxgirder";
import type { BoxGirderInputs } from "@/engine/boxgirder";

const DEFAULT: BoxGirderInputs = {
  bt: 7000, tt: 250, bb: 3500, tb: 200, tw: 350, H: 1800,
  swTop: 4000, swBot: 4000, overhang: 1500,
  fc: 40, Ec: 0, fy: 420,
  Vu: 2500, Tu: 1800, Mu: 9000,
  Pecc: 300, eEcc: 2500, Pwheel: 100, wheelWidth: 600, wDeckDL: 3,
  theta: 30,
};

function Nf({ label, unit, value, onChange, step = 1, min = 0 }: {
  label: string; unit?: string; value: number;
  onChange: (v: number) => void; step?: number; min?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-gray-500 leading-tight">{label}</span>
      <div className="relative flex items-center">
        <input type="number" value={value} min={min} step={step}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          className={`w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ${unit ? "pr-9" : ""}`} />
        {unit && <span className="absolute right-1.5 text-[9px] text-gray-400 pointer-events-none">{unit}</span>}
      </div>
    </div>
  );
}
function Row({ label, value, unit, hi }: { label: string; value: string; unit?: string; hi?: boolean }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-0.5 pr-3 text-gray-500 text-[10px]">{label}</td>
      <td className={`py-0.5 font-mono text-right text-[10px] font-semibold ${hi ? "text-blue-700" : "text-gray-800"}`}>{value}</td>
      {unit && <td className="py-0.5 pl-1 text-gray-400 text-[9px]">{unit}</td>}
    </tr>
  );
}
function Chk({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`flex justify-between items-center px-2 py-1 rounded text-[10px] my-0.5 border ${ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
      <span>{label}</span>
      <span className="font-mono font-bold">{value}</span>
      <span className="font-bold">{ok ? "✓ OK" : "✗ NG"}</span>
    </div>
  );
}

const DEFAULT_EXTRA = { L: 40000, w: 120, diaSpacing: 0 };

export function BoxGirderCalculator() {
  const [inp, setInp] = useState<BoxGirderInputs>(DEFAULT);
  const [ex, setEx] = useState(DEFAULT_EXTRA);
  const set = (k: keyof BoxGirderInputs, v: number) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const setX = (k: keyof typeof DEFAULT_EXTRA, v: number) =>
    setEx(prev => ({ ...prev, [k]: v }));
  const res = useMemo(() => computeBoxGirder(inp), [inp]);
  const dist = useMemo(() => computeBoxDistortion({
    bt: inp.bt, tt: inp.tt, bb: inp.bb, tb: inp.tb, tw: inp.tw, H: inp.H,
    swTop: inp.swTop, swBot: inp.swBot, fc: inp.fc, Ec: inp.Ec,
    Pecc: inp.Pecc, eEcc: inp.eEcc, L: ex.L, diaSpacing: ex.diaSpacing, Mu: inp.Mu,
  }), [inp, ex.L, ex.diaSpacing]);
  const slag = useMemo(() => computeBoxShearLag({
    bt: inp.bt, tt: inp.tt, bb: inp.bb, tb: inp.tb, tw: inp.tw, H: inp.H,
    fc: inp.fc, Ec: inp.Ec, L: ex.L, w: ex.w, Ig: res.Ig,
  }), [inp, ex.L, ex.w, res.Ig]);
  const f = (v: number, d = 1) => v.toFixed(d);
  const e = (v: number, d = 3) => v.toExponential(d);

  // ── SVG box cross-section (scaled) ──────────────────────────
  const sc = 130 / inp.bt;                    // px per mm (fit width)
  const Wp = inp.bt * sc, Hp = inp.H * sc;
  const ox = 18, oy = 14;
  const cx = ox + Wp / 2;
  const ttp = inp.tt * sc, tbp = inp.tb * sc, twp = inp.tw * sc;
  const swTopP = inp.swTop * sc, swBotP = inp.swBot * sc;
  // outer top edge spans full width; bottom slab is narrower (centered)
  const botX0 = cx - (inp.bb * sc) / 2, botX1 = cx + (inp.bb * sc) / 2;
  // web inner/outer faces (centreline ± tw/2)
  const wLtopC = cx - swTopP / 2, wRtopC = cx + swTopP / 2;
  const wLbotC = cx - swBotP / 2, wRbotC = cx + swBotP / 2;

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-56 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Geometri Box (Sel Tunggal)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="b_top deck" unit="mm" value={inp.bt} onChange={v => set("bt", v)} step={100} />
            <Nf label="t_top" unit="mm" value={inp.tt} onChange={v => set("tt", v)} step={10} />
            <Nf label="b_bot slab" unit="mm" value={inp.bb} onChange={v => set("bb", v)} step={100} />
            <Nf label="t_bot" unit="mm" value={inp.tb} onChange={v => set("tb", v)} step={10} />
            <Nf label="t_web" unit="mm" value={inp.tw} onChange={v => set("tw", v)} step={10} />
            <Nf label="H tinggi" unit="mm" value={inp.H} onChange={v => set("H", v)} step={50} />
            <Nf label="s_web atas" unit="mm" value={inp.swTop} onChange={v => set("swTop", v)} step={100} />
            <Nf label="s_web bawah" unit="mm" value={inp.swBot} onChange={v => set("swBot", v)} step={100} />
            <Nf label="kantilever" unit="mm" value={inp.overhang} onChange={v => set("overhang", v)} step={100} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Aksi (Sectional Forces)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="Vu geser" unit="kN" value={inp.Vu} onChange={v => set("Vu", v)} step={100} />
            <Nf label="Tu torsi" unit="kN·m" value={inp.Tu} onChange={v => set("Tu", v)} step={100} />
            <Nf label="Mu lentur" unit="kN·m" value={inp.Mu} onChange={v => set("Mu", v)} step={100} />
            <Nf label="P eksentris" unit="kN" value={inp.Pecc} onChange={v => set("Pecc", v)} step={25} />
            <Nf label="e melintang" unit="mm" value={inp.eEcc} onChange={v => set("eEcc", v)} step={100} />
            <Nf label="θ strut" unit="°" value={inp.theta} onChange={v => set("theta", v)} step={1} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Pelat Deck & Material</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="P roda" unit="kN" value={inp.Pwheel} onChange={v => set("Pwheel", v)} step={10} />
            <Nf label="lebar sebar" unit="mm" value={inp.wheelWidth} onChange={v => set("wheelWidth", v)} step={50} />
            <Nf label="w DL deck" unit="kN/m²" value={inp.wDeckDL} onChange={v => set("wDeckDL", v)} step={0.5} />
            <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
            <Nf label="fy" unit="MPa" value={inp.fy} onChange={v => set("fy", v)} step={20} />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">Menn Ch.5 (Box Girder):</p>
          <p className="text-blue-600 mt-0.5">Torsi St. Venant tertutup: v = T/(2·A_k); J = 4·A_k²/∮(ds/t). Beban eksentris → simetris (lentur) + antisimetris (torsi) ke 2 web.</p>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 space-y-2 min-w-0">
        {/* Cross-section sketch */}
        <div className="flex gap-3">
          <svg width="166" height={Hp + 28} viewBox={`0 0 166 ${Hp + 28}`}
            className="flex-none border border-gray-200 rounded bg-gray-50">
            {/* top slab (deck) full width */}
            <rect x={ox} y={oy} width={Wp} height={ttp} fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="1" />
            {/* bottom slab */}
            <rect x={botX0} y={oy + Hp - tbp} width={botX1 - botX0} height={tbp} fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="1" />
            {/* left web (trapezoid for inclined) */}
            <polygon points={`${wLtopC - twp/2},${oy + ttp} ${wLtopC + twp/2},${oy + ttp} ${wLbotC + twp/2},${oy + Hp - tbp} ${wLbotC - twp/2},${oy + Hp - tbp}`}
              fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1" />
            {/* right web */}
            <polygon points={`${wRtopC - twp/2},${oy + ttp} ${wRtopC + twp/2},${oy + ttp} ${wRbotC + twp/2},${oy + Hp - tbp} ${wRbotC - twp/2},${oy + Hp - tbp}`}
              fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1" />
            {/* shear-flow loop (A_k mid-lines) */}
            <polygon points={`${wLtopC},${oy + ttp/2} ${wRtopC},${oy + ttp/2} ${wRbotC},${oy + Hp - tbp/2} ${wLbotC},${oy + Hp - tbp/2}`}
              fill="none" stroke="#dc2626" strokeWidth="1" strokeDasharray="3 2" />
            <text x={cx - 8} y={oy + Hp/2} fontSize="7" fill="#dc2626" fontWeight="bold">A_k</text>
            {/* torsion arrow (shear flow direction) */}
            <text x={ox} y={oy + Hp + 22} fontSize="7" fill="#1d4ed8">v = Tu/(2A_k)</text>
            {/* eccentric load arrow */}
            <line x1={cx + Math.min(inp.eEcc*sc, Wp/2 - 4)} y1={oy - 8} x2={cx + Math.min(inp.eEcc*sc, Wp/2 - 4)} y2={oy} stroke="#7c3aed" strokeWidth="1.5" markerEnd="url(#bg_ar)" />
            <text x={cx + 6} y={oy - 3} fontSize="6" fill="#7c3aed">P·e</text>
            <defs>
              <marker id="bg_ar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#7c3aed" />
              </marker>
            </defs>
          </svg>
          <table className="flex-1"><tbody>
            <Row label="A penampang" value={e(res.A, 3)} unit="mm²" />
            <Row label="y_b dari serat bawah" value={f(res.yb, 1)} unit="mm" />
            <Row label="I_g" value={e(res.Ig, 3)} unit="mm⁴" />
            <Row label="A_k (luas tertutup)" value={e(res.Ak, 3)} unit="mm²" hi />
            <Row label="J_box / J_open" value={`${f(res.torsionStiffRatio, 0)}×`} unit="kali kaku" hi />
          </tbody></table>
        </div>

        {/* §5.1.2 Torsion */}
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">§5.1.2 Torsi St. Venant (Bredt)</p>
          <table className="w-full"><tbody>
            <Row label="v aliran geser = Tu/(2A_k)" value={f(res.shearFlow, 1)} unit="N/mm" hi />
            <Row label="τ slab atas (v/t_top)" value={f(res.tauTop, 2)} unit="MPa" />
            <Row label="τ slab bawah (v/t_bot)" value={f(res.tauBot, 2)} unit="MPa" />
            <Row label="τ web (v/t_web)" value={f(res.tauWeb, 2)} unit="MPa" />
            <Row label="J_box = 4A_k²/∮(ds/t)" value={e(res.Jbox, 3)} unit="mm⁴" />
            <Row label="θ' = Tu/(G·J) laju puntir" value={e(res.twistRate, 3)} unit="rad/mm" />
          </tbody></table>
        </div>

        {/* §5.1.1 Eccentric load distribution */}
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">§5.1.1 Distribusi Beban Eksentris ke 2 Web</p>
          <table className="w-full"><tbody>
            <Row label="T_ecc = P·e" value={f(res.Tecc, 1)} unit="kN·m" />
            <Row label="V simetris / web (P/2)" value={f(res.Vsym_web, 1)} unit="kN" />
            <Row label="V torsi / web (antisimetris)" value={`±${f(res.Vtor_web, 1)}`} unit="kN" />
            <Row label="Web terbebani: V_max" value={f(res.Vweb_max, 1)} unit="kN" hi />
            <Row label="Web ringan: V_min" value={f(res.Vweb_min, 1)} unit="kN" />
          </tbody></table>
        </div>

        {/* §5.3 Component design */}
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">§5.3 Desain Komponen Penampang</p>
          <table className="w-full"><tbody>
            <Row label="Web: V desain (V/2 + torsi)" value={f(res.Vweb_design, 1)} unit="kN" hi />
            <Row label="Web: Av/s perlu" value={f(res.Av_s, 3)} unit="mm²/mm" />
            <Row label="Deck: M kantilever" value={f(res.Mcant, 2)} unit="kN·m/m" />
            <Row label="Deck: M lap. dalam" value={f(res.Minterior, 2)} unit="kN·m/m" />
            <Row label="Deck: As melintang" value={f(res.As_deck, 0)} unit="mm²/m" hi />
          </tbody></table>
        </div>

        <div className="space-y-0.5">
          <Chk label="Web: tekan diagonal σ_strut ≤ ν·f'c"
            value={`${f(res.sigma_strut, 1)} ${res.webCrushOk ? "≤" : ">"} ${f(res.sigma_strut_lim, 1)} MPa`} ok={res.webCrushOk} />
          <Chk label="Slab bawah: σ_long ≥ −0.6f'c (tumpuan menerus)"
            value={`${f(res.sigma_bot_long, 1)} ${res.bottomSlabOk ? "≥" : "<"} ${f(res.sigma_bot_lim, 1)} MPa`} ok={res.bottomSlabOk} />
        </div>

        {/* Span-level inputs for distortion + shear-lag */}
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Parameter Bentang (distorsi & lendutan)</p>
          <div className="grid grid-cols-3 gap-1.5">
            <Nf label="L bentang" unit="mm" value={ex.L} onChange={v => setX("L", v)} step={1000} />
            <Nf label="w layan" unit="kN/m" value={ex.w} onChange={v => setX("w", v)} step={5} />
            <Nf label="spasi diafragma" unit="mm" value={ex.diaSpacing} onChange={v => setX("diaSpacing", v)} step={1000} />
          </div>
        </div>

        {/* Distortion — deformable cross section (Wright) */}
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Distorsi Penampang (Wright — analogi BEF)</p>
          <table className="w-full"><tbody>
            <Row label="T distorsi = P·e" value={f(dist.Tdist, 1)} unit="kN·m" />
            <Row label="V distorsi (kopel)" value={f(dist.Vdist, 1)} unit="kN" />
            <Row label="λ karakteristik BEF" value={e(dist.lambda, 2)} unit="1/mm" />
            <Row label="β·L = λ·L" value={f(dist.betaL, 2)} hi />
            <Row label="M sudut rangka melintang" value={f(dist.Mcorner, 2)} unit="kN·m/m" />
            <Row label="σ lentur melintang dinding" value={f(dist.sigmaTransverse, 2)} unit="MPa" />
            <Row label="σ warping distorsi / σ lentur" value={`${f(dist.warpRatio * 100, 1)}%`} unit="≤10%" hi />
            <Row label="Spasi diafragma maks disarankan" value={f(dist.diaSpacingMax, 0)} unit="mm" />
          </tbody></table>
          <Chk label="Distorsi terkendali (σ_warp ≤ 10% σ_lentur)"
            value={`${f(dist.warpRatio * 100, 1)}%`} ok={dist.distortionOk} />
          {dist.needsDiaphragm && (
            <p className="text-[9px] text-red-600 mt-0.5">⚠ β·L &gt; 4 tanpa diafragma → pasang diafragma interior (≤ {f(dist.diaSpacingMax, 0)} mm).</p>
          )}
        </div>

        {/* Shear lag + shear-deformation deflection (book 135) */}
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Shear Lag &amp; Lendutan Deformasi Geser</p>
          <table className="w-full"><tbody>
            <Row label="ψ shear-lag flens atas" value={f(slag.psiTop, 3)} />
            <Row label="b_eff flens atas" value={f(slag.beTop, 0)} unit="mm" hi />
            <Row label="b_eff flens bawah" value={f(slag.beBot, 0)} unit="mm" />
            <Row label="δ lentur 5wL⁴/384EI" value={f(slag.deltaBend, 2)} unit="mm" />
            <Row label="δ geser wL²/8GA_v" value={f(slag.deltaShear, 2)} unit="mm" hi />
            <Row label="δ total" value={f(slag.deltaTotal, 2)} unit="mm" hi />
            <Row label="δ_geser / δ_lentur" value={`${f(slag.shearRatio * 100, 1)}%`} />
            <Row label="Batas L/800" value={f(slag.deflLimit, 2)} unit="mm" />
          </tbody></table>
          <Chk label="Lendutan total ≤ L/800"
            value={`${f(slag.deltaTotal, 2)} ${slag.ok ? "≤" : ">"} ${f(slag.deflLimit, 2)} mm`} ok={slag.ok} />
        </div>
      </div>
    </div>
  );
}
