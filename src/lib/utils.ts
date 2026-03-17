import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtUsd(n: number): string {
  if (n < 100) return n.toFixed(2);
  return Math.round(n).toLocaleString();
}
