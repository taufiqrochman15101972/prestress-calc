"use client";

import { useEffect, useCallback } from "react";
import { InputPanel } from "@/components/InputPanel";
import { ResultsPanel } from "@/components/ResultsPanel";
import { useDesignStore } from "@/store/useDesignStore";
import { openPrintReport } from "@/lib/report";

export default function Home() {
  const {
    compute, inputs, results, loadFromLocal,
    settings, setUnitSystem, setFormulaVariant,
    updatePartialPrestress,
  } = useDesignStore();

  useEffect(() => {
    const restored = loadFromLocal();
    if (!restored) compute();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrint = useCallback(() => {
    if (results) openPrintReport(inputs, results, settings);
  }, [inputs, results, settings]);

  const { unitSystem, formulaVariant } = settings;
  const isPartial = inputs.partialPrestress.enabled;

  return (
    <div className="flex flex-col h-full">
      <header className="flex-none bg-blue-700 text-white px-4 py-2 flex items-center gap-2 shadow-md flex-wrap">
        {/* Title */}
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-base tracking-tight leading-tight">PRESTRESS-CALC</h1>
          <p className="text-[10px] text-blue-200 leading-tight">
            Desain Gelagar Beton Prategang — ACI 318 / SNI 2847 / AASHTO LRFD
          </p>
        </div>

        {/* Unit system toggle */}
        <div className="flex items-center gap-0.5 bg-white/10 rounded p-0.5">
          <button
            onClick={() => setUnitSystem("SI")}
            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
              unitSystem === "SI"
                ? "bg-white text-blue-700"
                : "text-white/80 hover:text-white hover:bg-white/20"
            }`}
          >
            SI
          </button>
          <button
            onClick={() => setUnitSystem("US")}
            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
              unitSystem === "US"
                ? "bg-white text-blue-700"
                : "text-white/80 hover:text-white hover:bg-white/20"
            }`}
          >
            US
          </button>
        </div>

        {/* Formula variant toggle */}
        <div className="flex items-center gap-0.5 bg-white/10 rounded p-0.5">
          <button
            onClick={() => setFormulaVariant("STANDARD")}
            title="Standard: f = −P/A ± Pe/Z ∓ M/Z"
            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
              formulaVariant === "STANDARD"
                ? "bg-white text-blue-700"
                : "text-white/80 hover:text-white hover:bg-white/20"
            }`}
          >
            Std
          </button>
          <button
            onClick={() => setFormulaVariant("KERNEL")}
            title="Kernel (TY Lin): f = −P/A·(1±ey/r²) ∓ M/Z"
            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
              formulaVariant === "KERNEL"
                ? "bg-white text-blue-700"
                : "text-white/80 hover:text-white hover:bg-white/20"
            }`}
          >
            Kernel
          </button>
        </div>

        {/* Full / Partial prestress toggle */}
        <div className="flex items-center gap-0.5 bg-white/10 rounded p-0.5">
          <button
            onClick={() => updatePartialPrestress({ enabled: false })}
            title="Prategang Penuh (Class U)"
            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
              !isPartial
                ? "bg-white text-blue-700"
                : "text-white/80 hover:text-white hover:bg-white/20"
            }`}
          >
            Full
          </button>
          <button
            onClick={() => updatePartialPrestress({ enabled: true })}
            title="Prategang Sebagian (Class T/C)"
            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
              isPartial
                ? "bg-white text-blue-700"
                : "text-white/80 hover:text-white hover:bg-white/20"
            }`}
          >
            Parsial
          </button>
        </div>

        {/* Print report */}
        <button
          onClick={handlePrint}
          disabled={!results}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/15 hover:bg-white/25
            disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold
            border border-white/30 transition-colors"
        >
          <span>🖨</span>
          <span>Laporan</span>
        </button>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <InputPanel />
        <ResultsPanel />
      </main>
    </div>
  );
}
