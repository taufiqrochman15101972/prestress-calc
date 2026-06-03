import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Concrete modulus Ec = 4700 * sqrt(fc) in MPa */
export function concreteModulus(fcMpa: number): number {
  return 4700 * Math.sqrt(fcMpa);
}

/** Format number with comma separator */
export function fmt(value: number, decimals = 2): string {
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format stress value with sign and unit */
export function fmtStress(mpa: number): string {
  const sign = mpa >= 0 ? "+" : "";
  return `${sign}${mpa.toFixed(2)} MPa`;
}
