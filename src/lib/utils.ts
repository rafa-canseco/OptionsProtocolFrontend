import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtUsd(n: number): string {
  if (n < 100) return n.toFixed(2);
  return Math.round(n).toLocaleString();
}

export function fmtAsset(n: number): string {
  if (n === 0) return "0";
  if (n >= 0.01) return n.toFixed(2);
  const magnitude = Math.floor(Math.log10(n));
  return n.toFixed(Math.abs(magnitude) + 1);
}

export function floorTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.floor(value * factor) / factor;
}
