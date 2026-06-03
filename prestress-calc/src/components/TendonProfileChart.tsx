"use client";

import React from "react";
import {
  ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { tendonProfile } from "@/engine/tendon";
import type { TendonConfig, GrossSectionProps, CompositeSectionProps } from "@/types";

interface Props {
  tendon: TendonConfig;
  gross: GrossSectionProps;
  composite: CompositeSectionProps;
  spanLength: number; // mm
  eccentricityMidspan: number; // resolved from rows
  yResultant: number;          // tendon centroid from bottom at midspan
}

const N = 61;

export function TendonProfileChart({
  tendon, gross, composite, spanLength, eccentricityMidspan, yResultant,
}: Props) {
  const L = spanLength;
  const LM = L / 1000;

  // Build engine-compatible config with resolved eccentricity
  const engineTendon = { ...tendon, eccentricityMidspan };

  // Sample tendon profile
  const profile = tendonProfile(engineTendon, L, N);

  const data = profile.map((pt) => ({
    x: parseFloat((pt.xMm / 1000).toFixed(2)),
    // height of tendon centroid from bottom fiber
    yTendon: parseFloat((gross.yb - pt.eMm).toFixed(1)),
    theta: parseFloat((pt.thetaRad * 180 / Math.PI).toFixed(2)),
  }));

  const yMin = Math.min(...data.map((d) => d.yTendon)) * 0.85;
  const yMax = composite.ybc * 1.05;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 px-1">
        Profil Lintasan Tendon Sepanjang Bentang
      </p>

      {/* Info strip */}
      <div className="flex gap-3 px-1 flex-wrap text-[9px]">
        <span className="text-red-600">e_midspan = {eccentricityMidspan.toFixed(0)} mm</span>
        <span className="text-gray-500">e_support = {tendon.eccentricitySupport} mm</span>
        <span className="text-gray-500">Profil: {tendon.profileType}</span>
        <span className="text-gray-500">y_NA = {gross.yb.toFixed(0)} mm</span>
      </div>

      <ResponsiveContainer width="100%" height={210}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 22, left: 54 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="x" tick={{ fontSize: 8 }} tickCount={7}
            label={{ value: "Posisi x (m)", position: "insideBottom", offset: -12, style: { fontSize: 9, fill: "#9ca3af" } }} />
          <YAxis
            domain={[Math.max(0, Math.floor(yMin / 50) * 50), Math.ceil(yMax / 50) * 50]}
            tick={{ fontSize: 8 }} width={52}
            label={{ value: "y dari serat bawah (mm)", angle: -90, position: "insideLeft",
              offset: -4, style: { fontSize: 8, fill: "#6b7280" } }}
          />
          <Tooltip
            formatter={(val: unknown, name: unknown) => {
              const n = Number(val);
              return [String(name) === "theta" ? `${n.toFixed(2)}°` : `${n.toFixed(0)} mm`, String(name)];
            }}
            labelFormatter={(l) => `x = ${l} m`}
            contentStyle={{ fontSize: 9 }}
          />
          <Legend wrapperStyle={{ fontSize: 8 }} iconSize={8} />

          {/* Gross neutral axis */}
          <ReferenceLine y={gross.yb} stroke="#374151" strokeDasharray="6 3" strokeWidth={1}
            label={{ value: `NA (${gross.yb.toFixed(0)})`, position: "right", fontSize: 7, fill: "#374151" }} />

          {/* Composite neutral axis */}
          <ReferenceLine y={composite.ybc} stroke="#d97706" strokeDasharray="5 3" strokeWidth={1}
            label={{ value: `NAc (${composite.ybc.toFixed(0)})`, position: "right", fontSize: 7, fill: "#d97706" }} />

          {/* Bottom of girder reference */}
          <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={0.8} />

          {/* Tendon profile */}
          <Line
            type="monotone"
            dataKey="yTendon"
            name="Lintasan Tendon"
            stroke="#dc2626"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
