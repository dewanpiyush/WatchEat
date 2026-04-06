export const signalLabelsMap: Record<string, string> = {
  food_quality: "Food quality",
  stale: "Food quality",
  hygiene: "Hygiene concerns",
  insect: "Contamination detected",
  food_poisoning: "Food safety incident",
};

export function formatSignalLabels(labels: unknown): string {
  if (!Array.isArray(labels)) return String(labels ?? "");
  return labels
    .map((s) => signalLabelsMap[String(s)] ?? String(s))
    .join(", ");
}
