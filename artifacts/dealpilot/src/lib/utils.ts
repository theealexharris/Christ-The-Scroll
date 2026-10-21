import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatRelative(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} d ago`;
  return d.toLocaleDateString();
}

/** Parses a numeric form field; empty strings become null. */
export function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}
