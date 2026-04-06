/**
 * WatchEat semantic palette (light mode).
 * Background: #F8FAFC · Card: white · Text: gray-900 / gray-500
 * Risk: red-500 / orange-500 / yellow-500 · Safe: green-600
 */
export const palette = {
  background: "#F8FAFC",
  card: "#ffffff",
} as const;

/** Muted list / meta row — not severity-coded */
export const metaDotClassName = "h-2 w-2 shrink-0 rounded-full bg-gray-400";

export const safeDotClassName = "h-2 w-2 shrink-0 rounded-full bg-green-600";

export const highRiskDotClassName = "h-2 w-2 shrink-0 rounded-full bg-red-500";

export const mediumRiskDotClassName =
  "h-2 w-2 shrink-0 rounded-full bg-orange-500";

export const lowRiskDotClassName =
  "h-2 w-2 shrink-0 rounded-full bg-yellow-500";
