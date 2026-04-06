"use client";

import { useMemo, useState } from "react";
import {
  type SignalSeverity,
  severityDotClassName,
  severityLabel,
} from "@/lib/signalSeverity";
import { formatSignalLabels } from "@/lib/signalLabels";
import { incidentCardClassName } from "@/lib/cardStyles";
import {
  mutedBodyClassName,
  storyLabelClassName,
} from "@/lib/typography";
import {
  detectSignalsWithEvidence,
  filterCanonicalEvidence,
  filterValuableEvidenceChips,
} from "@/lib/reviewSignals";
import {
  type NotableIncident,
  incidentDomId,
  incidentSeverity,
  sortIncidentsForDisplay,
  splitIncidentsByRecency,
} from "@/lib/notableIncidentsSort";

export type { NotableIncident };

const SNIPPET_LEN = 120;
const INITIAL_VISIBLE = 3;

/** Editorial incident body — comfortable measure and line height */
const incidentReviewTextClassName =
  "text-[15px] leading-relaxed text-gray-800 max-w-prose";

function snippet(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen).trimEnd();
  return `${cut}…`;
}

function formatIncidentReviewDate(iso: string | null): string | null {
  if (iso == null || iso === "") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const yy = String(d.getFullYear()).slice(-2);
  return `${month} ’${yy}`;
}

/** Left accent: tier from severity-first ranking */
function getSeverityBorder(sev: SignalSeverity): string {
  switch (sev) {
    case "high":
      return "border-l-[3px] border-l-red-500";
    case "medium":
      return "border-l-[3px] border-l-orange-500";
    case "low":
    default:
      return "border-l-[3px] border-l-yellow-500";
  }
}

type NotableIncidentsProps = {
  incidents: NotableIncident[];
  /** Controlled "show all" (e.g. when jumping to a later incident). */
  showAll?: boolean;
  onShowAllChange?: (show: boolean) => void;
};

export function NotableIncidents({
  incidents,
  showAll: showAllControlled,
  onShowAllChange,
}: NotableIncidentsProps) {
  const [showAllInternal, setShowAllInternal] = useState(false);
  const showAll =
    showAllControlled !== undefined ? showAllControlled : showAllInternal;
  const setShowAll = onShowAllChange ?? setShowAllInternal;

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const sorted = useMemo(() => sortIncidentsForDisplay(incidents), [incidents]);
  const { recent, older } = useMemo(
    () => splitIncidentsByRecency(sorted),
    [sorted],
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibleRecent = recent;
  const olderCount = older.length;

  if (sorted.length === 0) {
    return (
      <div>
        <h3 className={storyLabelClassName}>Flagged Customer Feedback</h3>
        <p className={`mt-1 text-[13px] text-gray-500`}>
          Based on public customer reviews
        </p>
        <p className={`mt-5 ${mutedBodyClassName}`}>
          Nothing stood out in the reviews we looked at.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className={storyLabelClassName}>Flagged Customer Feedback</h3>
      <p className={`mt-1 text-[13px] text-gray-500`}>
        Based on public customer reviews
      </p>

      <div className="mt-5 space-y-8">
        <section className="space-y-4">
          <h4 className={`${storyLabelClassName} text-[15px] font-semibold text-gray-900`}>
            Last 12 months
          </h4>
          {visibleRecent.length === 0 ? (
            <p className={mutedBodyClassName}>
              No major food safety or quality issues reported in the last 12 months
            </p>
          ) : (
            visibleRecent.map((item) => {
              const sortedIndex = sorted.indexOf(item);
              if (sortedIndex < 0) return null;

              const anchorId = incidentDomId(sortedIndex);
              const sev = incidentSeverity(item);
              const text = item.review_text ?? "";
              const isTruncated = text.trim().length > SNIPPET_LEN;
              const isOpen = expanded.has(anchorId);
              const reviewDateLabel = formatIncidentReviewDate(item.review_date);
              const fromDb = filterCanonicalEvidence(
                (item.evidence ?? []).filter(Boolean).map(String),
              );
              const evidence = filterValuableEvidenceChips(
                fromDb.length > 0
                  ? fromDb
                  : detectSignalsWithEvidence(item.review_text).evidence,
              );

              return (
                <div
                  key={anchorId}
                  id={anchorId}
                  className={`scroll-mt-28 ${incidentCardClassName} ${getSeverityBorder(sev)}`}
                >
                <div className="flex items-start gap-4">
                <div
                  className="flex shrink-0 items-start pt-1"
                  role="img"
                  aria-label={severityLabel(sev)}
                >
                  <span className={severityDotClassName(sev)} aria-hidden />
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[15px] font-semibold text-gray-900">
                        {formatSignalLabels(item.signal_labels)}
                      </p>
                      {reviewDateLabel != null && (
                        <p className="shrink-0 text-right text-[12px] text-gray-500">
                          {reviewDateLabel}
                        </p>
                      )}
                    </div>
                    {evidence.length > 0 && (
                      <div
                        className="mt-2 flex flex-wrap gap-2"
                        aria-label="Why this was flagged"
                      >
                        {evidence.map((e) => (
                          <span
                            key={e}
                            className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[13px] font-medium text-gray-800 ring-1 ring-inset ring-gray-200/90"
                          >
                            {e.trim().toLowerCase()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {!isOpen ? (
                    <>
                      <p className={incidentReviewTextClassName}>
                        {snippet(text, SNIPPET_LEN)}
                      </p>
                      {isTruncated && (
                        <button
                          type="button"
                          onClick={() => toggle(anchorId)}
                          aria-expanded={false}
                          className="text-[15px] font-medium text-blue-600 hover:underline"
                        >
                          → View full review
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <p
                        className={`${incidentReviewTextClassName} whitespace-pre-wrap`}
                      >
                        {text}
                      </p>
                      <button
                        type="button"
                        onClick={() => toggle(anchorId)}
                        aria-expanded={true}
                        className="text-[15px] font-medium text-gray-600 hover:text-gray-900 hover:underline"
                      >
                        Show less
                      </button>
                    </>
                  )}
                </div>
                </div>
              </div>
              );
            })
          )}
        </section>

        {olderCount > 0 && (
          <section className="space-y-4">
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              aria-expanded={showAll}
              aria-label={
                showAll
                  ? "Hide earlier feedback"
                  : `Show earlier feedback, ${olderCount} items`
              }
              className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-transparent px-1 py-2 text-left transition-colors hover:border-gray-200/80 hover:bg-gray-50/90"
            >
              <span
                className={`${storyLabelClassName} text-[15px] font-semibold text-gray-900`}
              >
                Earlier feedback ({olderCount})
              </span>
              <span
                className="shrink-0 text-[15px] font-medium leading-none text-gray-400 transition-colors group-hover:text-gray-600"
                aria-hidden
              >
                {showAll ? "⌄" : ">"}
              </span>
            </button>
            {showAll &&
              older.map((item) => {
              const sortedIndex = sorted.indexOf(item);
              if (sortedIndex < 0) return null;
              const anchorId = incidentDomId(sortedIndex);
              const text = item.review_text ?? "";
              const isTruncated = text.trim().length > SNIPPET_LEN;
              const isOpen = expanded.has(anchorId);
              const reviewDateLabel = formatIncidentReviewDate(item.review_date);
              const fromDb = filterCanonicalEvidence(
                (item.evidence ?? []).filter(Boolean).map(String),
              );
              const evidence = filterValuableEvidenceChips(
                fromDb.length > 0
                  ? fromDb
                  : detectSignalsWithEvidence(item.review_text).evidence,
              );
              return (
                <div
                  key={anchorId}
                  id={anchorId}
                  className={`scroll-mt-28 ${incidentCardClassName} border-l-[3px] border-l-gray-300`}
                >
                  <div className="flex items-start gap-4">
                  <div className="flex shrink-0 items-start pt-1" role="img" aria-hidden>
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[15px] font-semibold text-gray-900">
                          {formatSignalLabels(item.signal_labels)}
                        </p>
                        {reviewDateLabel != null && (
                          <p className="shrink-0 text-right text-[12px] text-gray-500">
                            {reviewDateLabel}
                          </p>
                        )}
                      </div>
                      {evidence.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2" aria-label="Why this was flagged">
                          {evidence.map((e) => (
                            <span
                              key={e}
                              className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[13px] font-medium text-gray-800 ring-1 ring-inset ring-gray-200/90"
                            >
                              {e.trim().toLowerCase()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {!isOpen ? (
                      <>
                        <p className={incidentReviewTextClassName}>
                          {snippet(text, SNIPPET_LEN)}
                        </p>
                        {isTruncated && (
                          <button
                            type="button"
                            onClick={() => toggle(anchorId)}
                            aria-expanded={false}
                            className="text-[15px] font-medium text-blue-600 hover:underline"
                          >
                            → View full review
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <p
                          className={`${incidentReviewTextClassName} whitespace-pre-wrap`}
                        >
                          {text}
                        </p>
                        <button
                          type="button"
                          onClick={() => toggle(anchorId)}
                          aria-expanded={true}
                          className="text-[15px] font-medium text-gray-600 hover:text-gray-900 hover:underline"
                        >
                          Show less
                        </button>
                      </>
                    )}
                  </div>
                  </div>
                </div>
              );
              })}
          </section>
        )}
      </div>
    </div>
  );
}
