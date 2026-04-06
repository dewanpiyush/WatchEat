import {
  type SignalSeverity,
  canonicalSignalType,
  normalizeSignalType,
  reviewRowSeverity,
} from "@/lib/signalSeverity";

export type NotableIncident = {
  review_text: string;
  signal_labels: string[];
  review_date: string | null;
  /** Matched keyword phrases (max 3), from processing pipeline */
  evidence?: string[] | null;
};

/** Sort key: high (3) → medium (2) → low (1) — higher first */
const SEVERITY_RANK: Record<SignalSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Severity for UI/sorting: always derived from current `reviewRowSeverity` rules + text
 * (does not use stored `reviews.severity`).
 */
export function incidentSeverity(inc: NotableIncident): SignalSeverity {
  return reviewRowSeverity(inc.signal_labels, inc.review_text) ?? "low";
}

function reviewDateMs(iso: string | null): number {
  if (iso == null || iso === "") return 0;
  const t = Date.parse(String(iso));
  return Number.isNaN(t) ? 0 : t;
}

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

export function isIncidentInLast12Months(
  incident: NotableIncident,
  nowMs = Date.now(),
): boolean {
  const t = reviewDateMs(incident.review_date);
  if (t <= 0) return false;
  return t >= nowMs - TWELVE_MONTHS_MS;
}

export function splitIncidentsByRecency(
  incidents: NotableIncident[],
  nowMs = Date.now(),
): { recent: NotableIncident[]; older: NotableIncident[] } {
  const recent: NotableIncident[] = [];
  const older: NotableIncident[] = [];
  for (const inc of incidents) {
    if (isIncidentInLast12Months(inc, nowMs)) recent.push(inc);
    else older.push(inc);
  }
  return { recent, older };
}

function sortRecentIncidents(incidents: NotableIncident[]): NotableIncident[] {
  return [...incidents].sort((a, b) => {
    const ra = SEVERITY_RANK[incidentSeverity(a)];
    const rb = SEVERITY_RANK[incidentSeverity(b)];
    if (rb !== ra) return rb - ra;
    return reviewDateMs(b.review_date) - reviewDateMs(a.review_date);
  });
}

function sortOlderIncidents(incidents: NotableIncident[]): NotableIncident[] {
  return [...incidents].sort(
    (a, b) => reviewDateMs(b.review_date) - reviewDateMs(a.review_date),
  );
}

export function sortIncidentsForDisplay(
  incidents: NotableIncident[],
): NotableIncident[] {
  const { recent, older } = splitIncidentsByRecency(incidents);
  return [...sortRecentIncidents(recent), ...sortOlderIncidents(older)];
}

export function sortNotableIncidents(
  incidents: NotableIncident[],
): NotableIncident[] {
  return sortIncidentsForDisplay(incidents);
}

/** DOM id for scroll targets: `incident-${sortedIndex}` */
export function incidentDomId(sortedIndex: number): string {
  return `incident-${sortedIndex}`;
}

/**
 * Maps `signals.signal_type` keys → first incident DOM id for scroll.
 * Registers both canonical and legacy keys (e.g. food_quality ↔ stale) for pill linking.
 */
export function buildFirstIncidentIdBySignal(
  sortedIncidents: NotableIncident[],
): Record<string, string> {
  const map: Record<string, string> = {};
  sortedIncidents.forEach((incident, sortedIndex) => {
    for (const raw of incident.signal_labels) {
      const k = normalizeSignalType(String(raw));
      if (k === "") continue;
      const canon = canonicalSignalType(String(raw));
      for (const key of new Set([k, canon])) {
        if (key !== "" && map[key] === undefined) {
          map[key] = incidentDomId(sortedIndex);
        }
      }
    }
  });
  return map;
}

export function parseIncidentDomIdIndex(domId: string): number | null {
  const m = /^incident-(\d+)$/.exec(domId);
  if (!m) return null;
  return Number(m[1]);
}
