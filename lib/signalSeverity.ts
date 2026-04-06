export type SignalSeverity = "high" | "medium" | "low";

const HIGH_SIGNAL_TYPES = new Set([
  "insect",
  "contamination",
  "rat",
  "hair",
  "foreign_object",
  "food_poisoning",
]);

/** Default bucket for aggregate `signals` rows — hygiene / food-quality are lower than medical/pest */
const LOW_SIGNAL_TYPES = new Set(["food_quality", "hygiene"]);

const LEGACY_SIGNAL_ALIASES: Record<string, string> = {
  stale: "food_quality",
};

/** Normalize slug-style or spaced signal keys */
export function normalizeSignalType(signalType: string): string {
  return signalType.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Map historical DB/API keys to the current canonical signal type */
export function canonicalSignalType(signalType: string): string {
  const k = normalizeSignalType(signalType);
  return LEGACY_SIGNAL_ALIASES[k] ?? k;
}

export function getSeverity(signalType: string): SignalSeverity {
  const key = canonicalSignalType(signalType);
  if (HIGH_SIGNAL_TYPES.has(key)) return "high";
  if (LOW_SIGNAL_TYPES.has(key)) return "low";
  return "medium";
}

export const SEVERITY_ORDER: Record<SignalSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Order signal keys for display / storage: most severe categories first. */
export function sortSignalsBySeverity(signals: string[]): string[] {
  const unique = [
    ...new Set(signals.map((s) => canonicalSignalType(s))),
  ];
  return unique.sort(
    (a, b) =>
      SEVERITY_ORDER[getSeverity(a)] - SEVERITY_ORDER[getSeverity(b)],
  );
}

/** Bump when `reviewRowSeverity` rules change (optional future: sync with `reviews.severity_version`). */
export const REVIEW_SEVERITY_LOGIC_VERSION = 3;

function canonicalLabelSet(labels: string[]): Set<string> {
  return new Set(labels.map((l) => canonicalSignalType(l)));
}

/**
 * Per-review severity from signal labels + review text (deterministic).
 */
export function reviewRowSeverity(
  labels: string[],
  text: string,
): SignalSeverity | null {
  if (labels.length === 0) return null;
  const t = text.toLowerCase();
  const canon = canonicalLabelSet(labels);

  if (
    canon.has("insect") ||
    canon.has("food_poisoning") ||
    t.includes("rat") ||
    t.includes("rats") ||
    t.includes("hair in food") ||
    t.includes("worm")
  ) {
    return "high";
  }

  if (
    canon.has("hygiene") &&
    (t.includes("dirty utensils") ||
      t.includes("unclean utensils") ||
      t.includes("filthy") ||
      t.includes("cockroach") ||
      t.includes("insects"))
  ) {
    return "high";
  }

  if (
    canon.has("food_quality") &&
    (t.includes("not cooked") ||
      t.includes("undercooked") ||
      t.includes("smelled bad") ||
      t.includes("sour") ||
      t.includes("tasted off") ||
      t.includes("spoiled") ||
      t.includes("stale"))
  ) {
    return "medium";
  }

  return "low";
}

/** @deprecated Prefer reviewRowSeverity(labels, text) for per-review rows */
export function maxSeverityForSignals(signals: string[]): SignalSeverity | null {
  if (signals.length === 0) return null;
  let best: SignalSeverity = "low";
  let order = SEVERITY_ORDER[best];
  for (const s of signals) {
    const sev = getSeverity(s);
    if (SEVERITY_ORDER[sev] < order) {
      order = SEVERITY_ORDER[sev];
      best = sev;
    }
  }
  return best;
}

export function severityEmoji(severity: SignalSeverity): string {
  switch (severity) {
    case "high":
      return "🔴";
    case "medium":
      return "🟠";
    case "low":
      return "🟡";
  }
}

export function severityDotClassName(severity: SignalSeverity): string {
  switch (severity) {
    case "high":
      return "h-2 w-2 shrink-0 rounded-full bg-red-500";
    case "medium":
      return "h-2 w-2 shrink-0 rounded-full bg-orange-500";
    case "low":
      return "h-2 w-2 shrink-0 rounded-full bg-yellow-500";
  }
}

export function severityLabel(severity: SignalSeverity): string {
  switch (severity) {
    case "high":
      return "High risk";
    case "medium":
      return "Medium risk";
    case "low":
      return "Lower risk";
  }
}

export function severityTextClass(severity: SignalSeverity): string {
  switch (severity) {
    case "high":
      return "text-red-500";
    case "medium":
      return "text-orange-500";
    case "low":
      return "text-yellow-500";
  }
}
