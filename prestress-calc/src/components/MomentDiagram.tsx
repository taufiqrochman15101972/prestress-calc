"use client";

import React from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { MomentResults } from "@/types";

interface Props {
  moments: MomentResults;
  spanLength: number; // mm
}

const N = 41; // number of points along span

export function MomentDiagram({ moments, spanLength }: Props) {
  const L = spanLength / 1000; // m
  const { Mg, Msdl, Mlive, Mu } = moments;

  // Parabolic moment distribution: M(ξ) = M_max × 4ξ(1−ξ), ξ = x/L
  const data = Array.from({ length: N }, (_, i) => {
    const xi = i / (N - 1);
    const p  = 4 * xi * (1 - xi); // parabolic factor [0..1], peak at midspan
    return {
      x:       parseFloat((xi * L).toFixed(2)),
      Mg:      parseFloat((Mg   * p).toFixed(1)),
      MgSdl:   parseFloat(((Mg + Msdl) * p).toFixed(1)),
      Mservice:parseFloat(((Mg + Msdl + Mlive) * p).toFixed(1)),
      Mu:      parseFloat((Mu   * p).toFixed(1)),
    };
  });

  const fmt = (v: number) => `${v.toFixed(0)} kN·m`;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 px-1">
        Diagram Momen Lentur Sepanjang Bentang
      </p>

      {/* Peak values summary */}
      <div className="flex gap-3 px-1 flex-wrap text-[9px]">
        <span className="text-blue-600">M_g={fmt(Mg)}</span>
        <span className="text-green-600">M_sdl={fmt(Msdl)}</span>
        <span className="text-orange-500">M_live={fmt(Mlive)}</span>
        <span className="text-red-600 font-bold">M_u={fmt(Mu)}</span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 20, left: 54 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="x" tick={{ fontSize: 8 }} tickCount={7}>
            <text x={0} y={0} dy={16} dx={200} fontSize={9} fill="#9ca3af" textAnchor="middle">
              Posisi x (m)
            </text>
          </XAxis>
          <YAxis tick={{ fontSize: 8 }} width={50}
            label={{ value: "M (kN·m)", angle: -90, position: "insideLeft", offset: -4, style: { fontSize: 9, fill: "#6b7280" } }} />
          <Tooltip
            formatter={(val: unknown, name: unknown) => [`${Number(val).toFixed(0)} kN·m`, String(name)]}
            labelFormatter={(l) => `x = ${l} m`}
            contentStyle={{ fontSize: 9 }}
          />
          <Legend wrapperStyle={{ fontSize: 8 }} iconSize={8} />

          {/* Filled areas from bottom up (stacked appearance) */}
          <Area type="monotone" dataKey="Mg" name="M_g (SW)"
            fill="#bfdbfe" stroke="#3b82f6" strokeWidth={1} fillOpacity={0.8} />
          <Area type="monotone" dataKey="MgSdl" name="M_g+SDL"
            fill="#bbf7d0" stroke="#22c55e" strokeWidth={1} fillOpacity={0.6} />
          <Area type="monotone" dataKey="Mservice" name="M_service"
            fill="#fed7aa" stroke="#f97316" strokeWidth={1.5} fillOpacity={0.5} />

          {/* M_u as dashed line */}
          <Line type="monotone" dataKey="Mu" name="M_u (1.25DL+1.75LL)"
            stroke="#dc2626" strokeWidth={2} strokeDasharray="6 3" dot={false} />

          {/* Peak value annotation */}
          <ReferenceLine
            x={parseFloat((L / 2).toFixed(2))}
            stroke="#9ca3af" strokeDasharray="4 2" strokeWidth={0.8}
            label={{ value: `L/2=${(L/2).toFixed(1)}m`, position: "insideTopRight", fontSize: 7, fill: "#9ca3af" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
