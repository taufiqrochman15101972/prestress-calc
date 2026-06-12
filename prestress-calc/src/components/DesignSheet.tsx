"use client";

import React, { useMemo } from "react";
import { designSheetSVG } from "@/lib/designsheet";
import type { ProjectInputs, DesignResults } from "@/types";

/** Unified design output sheet — thin wrapper around the shared SVG
 *  generator (the same markup is embedded in the printed PDF report). */
export function DesignSheet({ inputs, results }: {
  inputs: ProjectInputs; results: DesignResults;
}) {
  const svg = useMemo(() => designSheetSVG(inputs, results), [inputs, results]);
  return (
    <div
      className="w-full overflow-auto rounded border border-gray-200 bg-white"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
