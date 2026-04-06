"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signalLabelsMap } from "@/lib/signalLabels";
import {
  detectSignalsWithEvidence,
  EVIDENCE_THEME_LABELS,
  evidenceThemeForChip,
  filterCanonicalEvidence,
  filterValuableEvidenceChips,
  type EvidenceTheme,
} from "@/lib/reviewSignals";
import {
  type SignalSeverity,
  canonicalSignalType,
  getSeverity,
  severityDotClassName,
  severityLabel,
} from "@/lib/signalSeverity";
import { cardClassName } from "@/lib/cardStyles";
import { sectionHeadingClassName } from "@/lib/typography";
import {
  type NotableIncident,
  buildFirstIncidentIdBySignal,
  parseIncidentDomIdIndex,
  sortIncidentsForDisplay,
} from "@/lib/notableIncidentsSort";
import { NotableIncidents } from "./NotableIncidents";

const INITIAL_VISIBLE = 3;
const TOP_ISSUES_PER_GROUP = 3;
const MIN_GROUP_FREQUENCY = 2;

export type SignalRow = {
  signal_type: string;
  count: number;
  severity?: string | null;
};

function rowSeverity(signal: SignalRow): SignalSeverity {
  const s = signal.severity;
  if (s === "high" || s === "medium" || s === "low") return s;
  return getSeverity(signal.signal_type);
}

function getSignalDotClass(signal: SignalRow): string {
  return severityDotClassName(rowSeverity(signal));
}

function getSignalStyles(
  signalType: string,
  severity: SignalSeverity,
): string {
  const t = signalType.toLowerCase();
  const base =
    "rounded-full px-3 py-1 text-[15px] font-medium text-gray-900 ring-1 ring-inset ring-black/[0.06] transition-colors";

  if (t === "hygiene") {
    return `${base} bg-orange-50 hover:bg-orange-100/90`;
  }
  if (t === "food_quality" || t === "stale") {
    return `${base} bg-yellow-50 hover:bg-yellow-100/90`;
  }
  if (t === "insect" || t === "contamination" || t === "food_poisoning") {
    return `${base} bg-red-50 hover:bg-red-100/90`;
  }

  if (severity === "high") {
    return `${base} bg-red-50 hover:bg-red-100/90`;
  }
  if (severity === "medium") {
    return `${base} bg-orange-50 hover:bg-orange-100/90`;
  }
  return `${base} bg-yellow-50 hover:bg-yellow-100/90`;
}

export function LinkedSafetySignalsAndIncidents({
  sortedSignals,
  incidents,
}: {
  sortedSignals: SignalRow[];
  incidents: NotableIncident[];
}) {
  const [showAllIncidents, setShowAllIncidents] = useState(false);

  const sortedIncidents = useMemo(
    () => sortIncidentsForDisplay(incidents),
    [incidents],
  );

  const firstIncidentIdBySignal = useMemo(
    () => buildFirstIncidentIdBySignal(sortedIncidents),
    [sortedIncidents],
  );

  const mostReportedIssues = useMemo(() => {
    const countsByTheme: Record<EvidenceTheme, Record<string, number>> = {
      contamination_risks: {},
      cleanliness_concerns: {},
      food_quality_issues: {},
      illness_reported: {},
    };

    for (const inc of sortedIncidents) {
      const fromDb = filterCanonicalEvidence(
        (inc.evidence ?? []).filter(Boolean).map(String),
      );
      const evidence = filterValuableEvidenceChips(
        fromDb.length > 0
          ? fromDb
          : detectSignalsWithEvidence(inc.review_text).evidence,
      );
      for (const chip of new Set(evidence)) {
        const theme = evidenceThemeForChip(chip);
        if (!theme) continue;
        countsByTheme[theme][chip] = (countsByTheme[theme][chip] ?? 0) + 1;
      }
    }

    return (Object.keys(EVIDENCE_THEME_LABELS) as EvidenceTheme[])
      .map((theme) => {
        const topIssues = Object.entries(countsByTheme[theme])
          .filter(([, n]) => n >= MIN_GROUP_FREQUENCY)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, TOP_ISSUES_PER_GROUP)
          .map(([chip]) => chip);
        return {
          theme,
          title: EVIDENCE_THEME_LABELS[theme],
          topIssues,
        };
      })
      .filter((g) => g.topIssues.length > 0);
  }, [sortedIncidents]);

  /** Incidents mentioning each signal (canonical key) — matches scroll targets & list */
  const incidentCountBySignal = useMemo(() => {
    const c: Record<string, number> = {};
    for (const inc of sortedIncidents) {
      const seen = new Set<string>();
      for (const raw of inc.signal_labels) {
        const canon = canonicalSignalType(String(raw));
        if (seen.has(canon)) continue;
        seen.add(canon);
        c[canon] = (c[canon] ?? 0) + 1;
      }
    }
    return c;
  }, [sortedIncidents]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const signalCounts: Record<string, number> = {};
    for (const inc of incidents) {
      for (const s of inc.signal_labels) {
        signalCounts[s] = (signalCounts[s] ?? 0) + 1;
      }
    }
    console.log("[LinkedSafety] Total incidents:", incidents.length);
    console.log("[LinkedSafety] Signals breakdown:", signalCounts);
  }, [incidents]);

  const scrollToDomId = useCallback((domId: string) => {
    const el = document.getElementById(domId);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const onSignalClick = useCallback(
    (signalType: string) => {
      const domId = firstIncidentIdBySignal[signalType];
      if (!domId) return;

      const idx = parseIncidentDomIdIndex(domId);
      if (idx != null && idx >= INITIAL_VISIBLE && !showAllIncidents) {
        setShowAllIncidents(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => scrollToDomId(domId));
        });
        return;
      }
      scrollToDomId(domId);
    },
    [firstIncidentIdBySignal, showAllIncidents, scrollToDomId],
  );

  return (
    <div className="mt-6 border-t border-gray-100 pt-6">
      <h2 className={sectionHeadingClassName}>What customers reported</h2>

      <div className={`${cardClassName} mt-5 space-y-10`}>
        <section>
          <div className="flex flex-wrap gap-2">
            {sortedSignals
              .filter((s) => {
                const key = canonicalSignalType(s.signal_type);
                const isClickable = firstIncidentIdBySignal[s.signal_type] != null;
                const n =
                  incidentCountBySignal[key] ?? incidentCountBySignal[s.signal_type] ?? 0;
                return isClickable && n > 0;
              })
              .map((s) => {
                const sev = rowSeverity(s);
                const label = signalLabelsMap[s.signal_type] ?? s.signal_type;
                const key = canonicalSignalType(s.signal_type);
                const displayCount =
                  incidentCountBySignal[key] ??
                  incidentCountBySignal[s.signal_type] ??
                  s.count;
                return (
                  <button
                    key={s.signal_type}
                    type="button"
                    onClick={() => onSignalClick(s.signal_type)}
                    className={`inline-flex cursor-pointer items-center gap-2 ${getSignalStyles(s.signal_type, sev)}`}
                    aria-label={`Jump to the first note about ${label}`}
                  >
                    <span
                      className={getSignalDotClass(s)}
                      aria-hidden
                      title={severityLabel(rowSeverity(s))}
                    />
                    <span className="tabular-nums">
                      {label} ({displayCount})
                    </span>
                  </button>
                );
              })}
          </div>
        </section>

        {mostReportedIssues.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-[16px] font-semibold text-gray-900">
              Most reported issues
            </h3>
            <div className="space-y-4">
              {mostReportedIssues.map((group) => (
                <div key={group.theme} className="space-y-2">
                  <p className="text-[14px] font-semibold text-gray-900">
                    {group.title}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.topIssues.map((issue) => (
                      <span
                        key={`${group.theme}-${issue}`}
                        className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[13px] font-medium text-gray-800 ring-1 ring-inset ring-gray-200/90"
                      >
                        {issue}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <NotableIncidents
            incidents={incidents}
            showAll={showAllIncidents}
            onShowAllChange={setShowAllIncidents}
          />
        </section>
      </div>
    </div>
  );
}
