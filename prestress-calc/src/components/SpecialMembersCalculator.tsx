"use client";

import React, { useState, useMemo } from "react";
import {
  computePipe, computePole, computeSleeper,
} from "@/engine/specialmembers";
import type {
  PipeInputs, PoleInputs, SleeperInputs,
} from "@/engine/specialmembers";

const PIPE_DEFAULT: PipeInputs = {
  Di: 1000, t: 75, p: 0.8, residualComp: 1.0, fc: 45,
  wireDia: 5, sigmaWire: 1000, eta: 0.8,
};
const POLE_DEFAULT: PoleInputs = {
  H: 9, Do: 350, tWall: 75, Ptip: 2.0, windPressure: 1.0,
  avgWidth: 280, Pe: 350, fc: 50,
};
const SLEEPER_DEFAULT: SleeperInputs = {
  axleLoad: 250, impact: 2.0, L: 2600, gauge: 1500, B: 250,
  Zrs: 5.0e6, Zc: 3.5e6, Pe: 350, A: 48000, fc: 55,
};

function Nf({ label, unit, value, onChange, step = 1 }: {
  label: string; unit?: string; value: number; onChange: (v: number) => void; step?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-gray-500 leading-tight">{label}</span>
      <div className="relative flex items-center">
        <input type="number" value={value} step={step}
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
function Verdict({ ok, okText, ngText }: { ok: boolean; okText: string; ngText: string }) {
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {ok ? `✓ ${okText}` : `✗ ${ngText}`}
    </span>
  );
}

// ─── Pipa prategang melingkar ────────────────────────────────
function PipeView() {
  const [inp, setInp] = useState<PipeInputs>(PIPE_DEFAULT);
  const set = (k: keyof PipeInputs, v: number) => setInp(p => ({ ...p, [k]: v }));
  const r = useMemo(() => computePipe(inp), [inp]);
  const f = (v: number, d = 2) => v.toFixed(d);
  return (
    <div className="flex gap-4">
      <div className="w-56 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Pipa & Tekanan</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="Ø dalam D_i" unit="mm" value={inp.Di} onChange={v => set("Di", v)} step={50} />
          <Nf label="Tebal dinding t" unit="mm" value={inp.t} onChange={v => set("t", v)} step={5} />
          <Nf label="Tekanan kerja p" unit="MPa" value={inp.p} onChange={v => set("p", v)} step={0.05} />
          <Nf label="Sisa tekan residual" unit="MPa" value={inp.residualComp} onChange={v => set("residualComp", v)} step={0.1} />
          <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
          <Nf label="η rasio efektif" value={inp.eta} onChange={v => set("eta", v)} step={0.05} />
          <Nf label="Ø kawat lilit" unit="mm" value={inp.wireDia} onChange={v => set("wireDia", v)} step={0.5} />
          <Nf label="σ kawat lilit" unit="MPa" value={inp.sigmaWire} onChange={v => set("sigmaWire", v)} step={50} />
        </div>
      </div>
      <div className="flex-1 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">Gaya Lingkar (Hoop) & Prategang</p>
        <table className="w-full"><tbody>
          <Row label="N_θ = p·D_i/2 (per mm pipa)" value={f(r.hoopTension, 1)} unit="N/mm" />
          <Row label="σ_hoop layan = N_θ/t" value={f(r.sigmaHoopService)} unit="MPa" />
          <Row label="σ_pre efektif perlu = σ_hoop + residual" value={f(r.sigmaPreReq)} unit="MPa" hi />
          <Row label="σ_pre awal (sebelum loss, /η)" value={f(r.sigmaPreInitial)} unit="MPa" />
          <Row label="Tekan dinding saat lilit" value={f(r.compAtTransfer)} unit="MPa" />
        </tbody></table>
        <Verdict ok={r.transferOk} okText="|σ| ≤ 0.60·f'c (transfer)" ngText="Tekan transfer berlebih" />
        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Lilitan Kawat (Wire Winding)</p>
        <table className="w-full"><tbody>
          <Row label="A_kawat" value={f(r.wireArea, 1)} unit="mm²" />
          <Row label="Pitch s = A_w·σ_w/(σ_pre·t)" value={f(r.pitchMm, 1)} unit="mm" hi />
          <Row label="Jumlah lilitan per meter" value={f(r.nTurnsPerM, 1)} unit="/m" />
          <Row label="Tekanan uji p₀ (residual habis)" value={f(r.testPressure)} unit="MPa" />
        </tbody></table>
        <p className="text-[9px] text-gray-400">
          Silinder dinding tipis: prategang melingkar dari kawat dililit tegangan tinggi
          (Raju Bab 16). Inti harus tetap tertekan pada tekanan kerja.
        </p>
      </div>
    </div>
  );
}

// ─── Tiang listrik / pole ────────────────────────────────────
function PoleView() {
  const [inp, setInp] = useState<PoleInputs>(POLE_DEFAULT);
  const set = (k: keyof PoleInputs, v: number) => setInp(p => ({ ...p, [k]: v }));
  const r = useMemo(() => computePole(inp), [inp]);
  const f = (v: number, d = 2) => v.toFixed(d);
  return (
    <div className="flex gap-4">
      <div className="w-56 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Geometri & Beban</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="Tinggi H" unit="m" value={inp.H} onChange={v => set("H", v)} step={0.5} />
          <Nf label="Ø luar dasar D_o" unit="mm" value={inp.Do} onChange={v => set("Do", v)} step={25} />
          <Nf label="Tebal dinding (0=pejal)" unit="mm" value={inp.tWall} onChange={v => set("tWall", v)} step={5} />
          <Nf label="P ujung (kabel)" unit="kN" value={inp.Ptip} onChange={v => set("Ptip", v)} step={0.5} />
          <Nf label="Tek. angin" unit="kN/m²" value={inp.windPressure} onChange={v => set("windPressure", v)} step={0.1} />
          <Nf label="Lebar proyeksi rata2" unit="mm" value={inp.avgWidth} onChange={v => set("avgWidth", v)} step={10} />
          <Nf label="P_e prategang" unit="kN" value={inp.Pe} onChange={v => set("Pe", v)} step={25} />
          <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
        </div>
      </div>
      <div className="flex-1 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">Penampang Dasar & Momen</p>
        <table className="w-full"><tbody>
          <Row label="A annular" value={f(r.A, 0)} unit="mm²" />
          <Row label="Z modulus" value={(r.Z / 1e6).toFixed(3)} unit="×10⁶mm³" />
          <Row label="M dasar = P·H + w·H²/2" value={f(r.Mbase)} unit="kN·m" hi />
        </tbody></table>
        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Tegangan Serat Dasar (layan)</p>
        <table className="w-full"><tbody>
          <Row label="−P/A aksial" value={f(r.sigmaAxial)} unit="MPa" />
          <Row label="Muka tarik: −P/A + M/Z" value={f(r.sigmaTensFace)} unit="MPa" hi />
          <Row label="Muka tekan: −P/A − M/Z" value={f(r.sigmaCompFace)} unit="MPa" />
          <Row label="Batas tarik 0.50√f'c / tekan 0.45f'c" value={`+${f(r.limTens)} / −${f(r.limComp)}`} unit="MPa" />
        </tbody></table>
        <div className="flex gap-2">
          <Verdict ok={r.tensOk} okText="Tarik OK" ngText="Tarik berlebih" />
          <Verdict ok={r.compOk} okText="Tekan OK" ngText="Tekan berlebih" />
        </div>
        <table className="w-full"><tbody>
          <Row label="M_retak = Z·(f_r + P/A)" value={f(r.Mcrack)} unit="kN·m" />
          <Row label="FK retak = M_retak/M_dasar" value={f(r.safetyCrack)} hi />
        </tbody></table>
        <p className="text-[9px] text-gray-400">
          Kantilever vertikal: momen dasar dari beban ujung konduktor + angin terdistribusi
          (Raju Bab 19.1). Prategang konsentris menahan tarik lentur dua arah angin.
        </p>
      </div>
    </div>
  );
}

// ─── Bantalan rel / sleeper ──────────────────────────────────
function SleeperView() {
  const [inp, setInp] = useState<SleeperInputs>(SLEEPER_DEFAULT);
  const set = (k: keyof SleeperInputs, v: number) => setInp(p => ({ ...p, [k]: v }));
  const r = useMemo(() => computeSleeper(inp), [inp]);
  const f = (v: number, d = 2) => v.toFixed(d);
  return (
    <div className="flex gap-4">
      <div className="w-56 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Beban & Geometri</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="Beban gandar statik" unit="kN" value={inp.axleLoad} onChange={v => set("axleLoad", v)} step={10} />
          <Nf label="Faktor impak i" value={inp.impact} onChange={v => set("impact", v)} step={0.1} />
          <Nf label="Panjang L" unit="mm" value={inp.L} onChange={v => set("L", v)} step={50} />
          <Nf label="Jarak rel (gauge)" unit="mm" value={inp.gauge} onChange={v => set("gauge", v)} step={25} />
          <Nf label="Lebar dasar B" unit="mm" value={inp.B} onChange={v => set("B", v)} step={10} />
          <Nf label="Z di dudukan rel" unit="mm³" value={inp.Zrs} onChange={v => set("Zrs", v)} step={1e5} />
          <Nf label="Z di tengah" unit="mm³" value={inp.Zc} onChange={v => set("Zc", v)} step={1e5} />
          <Nf label="A penampang" unit="mm²" value={inp.A} onChange={v => set("A", v)} step={1000} />
          <Nf label="P_e prategang" unit="kN" value={inp.Pe} onChange={v => set("Pe", v)} step={25} />
          <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
        </div>
      </div>
      <div className="flex-1 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">Reaksi & Momen Desain</p>
        <table className="w-full"><tbody>
          <Row label="R dudukan rel = (gandar/2)·i" value={f(r.R, 1)} unit="kN" hi />
          <Row label="p balas merata = 2R/(B·L)" value={f(r.pBallast, 3)} unit="MPa" />
          <Row label="M+ dudukan rel (overhang)" value={f(r.Mrs)} unit="kN·m" hi />
          <Row label="M− tengah (hogging)" value={f(r.Mc)} unit="kN·m" />
        </tbody></table>
        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Tegangan Serat (layan)</p>
        <table className="w-full"><tbody>
          <Row label="−P/A prategang" value={f(r.sigmaPre)} unit="MPa" />
          <Row label="Serat bawah @ dudukan rel" value={f(r.sigmaRailSeat)} unit="MPa" hi />
          <Row label="Serat atas @ tengah" value={f(r.sigmaCentreTop)} unit="MPa" />
          <Row label="Batas tarik 0.50√f'c" value={`+${f(r.limTens)}`} unit="MPa" />
        </tbody></table>
        <div className="flex gap-2">
          <Verdict ok={r.railSeatOk} okText="Dudukan rel OK" ngText="Dudukan rel overstress" />
          <Verdict ok={r.centreOk} okText="Tengah OK" ngText="Tengah overstress" />
        </div>
        <p className="text-[9px] text-gray-400">
          Model balok di atas reaksi balas merata (Raju Bab 19.3): momen dudukan rel dari
          kantilever overhang, momen tengah hogging dari kopel R vs reaksi balas.
          Pratarik banyak-strand khas pabrikasi long-line.
        </p>
      </div>
    </div>
  );
}

type SubTab = "pipe" | "pole" | "sleeper";

export function SpecialMembersCalculator() {
  const [sub, setSub] = useState<SubTab>("pipe");
  const tabs: [SubTab, string][] = [
    ["pipe", "🚰 Pipa Melingkar"],
    ["pole", "⚡ Tiang / Pole"],
    ["sleeper", "🚆 Bantalan Rel"],
  ];
  return (
    <div className="text-[11px]">
      <div className="flex gap-1 mb-2">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setSub(k)}
            className={`px-2 py-1 rounded text-[10px] font-semibold border
              ${sub === k ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
            {label}
          </button>
        ))}
      </div>
      {sub === "pipe" && <PipeView />}
      {sub === "pole" && <PoleView />}
      {sub === "sleeper" && <SleeperView />}
    </div>
  );
}
