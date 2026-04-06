import { supabase } from "@/lib/supabase";
import { formatRestaurantName } from "@/lib/formatRestaurantName";
import type { NotableIncident } from "@/lib/notableIncidentsSort";
import {
  type SignalSeverity,
  getSeverity,
  SEVERITY_ORDER,
} from "@/lib/signalSeverity";
import {
  bodyClassName,
  mutedBodyClassName,
  pageTitleClassName,
  sectionHeadingClassName,
} from "@/lib/typography";
import { LinkedSafetySignalsAndIncidents } from "./LinkedSafetySignalsAndIncidents";

function signalCountsBreakdown(
  incidents: { signal_labels: string[] }[],
): Record<string, number> {
  const signalCounts: Record<string, number> = {};
  for (const inc of incidents) {
    for (const s of inc.signal_labels) {
      signalCounts[s] = (signalCounts[s] ?? 0) + 1;
    }
  }
  return signalCounts;
}

function formatMonthYear(iso: string | null | undefined): string | null {
  if (iso == null || iso === "") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** e.g. 29 of 277 reviews → "~1 in 10" */
function formatApproxIssuesPerReviews(
  issuesCount: number | null | undefined,
  totalReviews: number | null | undefined,
): string | null {
  if (
    issuesCount == null ||
    totalReviews == null ||
    totalReviews <= 0 ||
    issuesCount <= 0
  ) {
    return null;
  }
  const n = Math.round(totalReviews / issuesCount);
  const denom = Math.max(1, n);
  return `~1 in ${denom}`;
}

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: signals, error: signalsError } = await supabase
    .from("signals")
    .select("*")
    .eq("restaurant_slug", slug);

  const { data: metrics } = await supabase
    .from("restaurant_metrics")
    .select("*")
    .eq("restaurant_slug", slug)
    .single();

  // No early limit: a small limit ordered by date can hide older flagged reviews.
  // Empty [] arrays are filtered client-side (PostgREST JSON `eq` for [] is unreliable).
  const { data: flaggedReviews } = await supabase
    .from("reviews")
    .select("review_text, signal_labels, review_date, evidence")
    .eq("restaurant_slug", slug)
    .not("signal_labels", "is", null)
    .order("review_date", { ascending: false });

  const flaggedReviewsWithSignals = flaggedReviews?.filter(
    (r) =>
      Array.isArray(r.signal_labels) && r.signal_labels.length > 0,
  );

  const notableIncidents: NotableIncident[] = (flaggedReviewsWithSignals ?? []).map(
    (r) => ({
      review_text: String(r.review_text ?? ""),
      signal_labels: (r.signal_labels as unknown[]).map(String),
      review_date:
        r.review_date != null ? String(r.review_date) : null,
      evidence: Array.isArray(r.evidence)
        ? (r.evidence as unknown[]).map(String)
        : null,
    }),
  );

  if (process.env.NODE_ENV === "development") {
    console.log(
      "[restaurant]",
      slug,
      "Total incidents:",
      notableIncidents.length,
    );
    console.log(
      "[restaurant] Signals breakdown:",
      signalCountsBreakdown(notableIncidents),
    );
  }

  if (signalsError) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className={bodyClassName}>Error loading data</p>
      </main>
    );
  }

  const safetyIssuesCount = metrics?.reviews_with_signals;
  const totalReviewsAnalyzed = metrics?.total_reviews;
  const lastReportedLabel = formatMonthYear(
    metrics?.last_issue_date != null
      ? String(metrics.last_issue_date)
      : undefined,
  );
  const issuesPerReviewsLabel = formatApproxIssuesPerReviews(
    safetyIssuesCount,
    totalReviewsAnalyzed,
  );

  function rowSeverity(signal: {
    severity?: string | null;
    signal_type: string;
  }): SignalSeverity {
    const s = signal.severity;
    if (s === "high" || s === "medium" || s === "low") return s;
    return getSeverity(signal.signal_type);
  }

  const sortedSignals = [...(signals ?? [])].sort((a, b) => {
    const da = SEVERITY_ORDER[rowSeverity(a)];
    const db = SEVERITY_ORDER[rowSeverity(b)];
    if (da !== db) return da - db;
    return a.signal_type.localeCompare(b.signal_type);
  });

  return (
    <main className="mx-auto max-w-2xl space-y-10 px-4 py-10">
      <header className="space-y-2">
        <h1 className={pageTitleClassName}>{formatRestaurantName(slug)}</h1>
        <p className={mutedBodyClassName}>
          What people wrote in public reviews
        </p>
      </header>

      <div>
        <h2 className={sectionHeadingClassName}>
          Food Quality & Safety Snapshot
        </h2>

        <div className="relative mt-6 overflow-hidden rounded-2xl bg-white shadow-sm shadow-gray-900/5">
          <div
            className="pointer-events-none absolute left-0 right-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-yellow-400/75 via-orange-400/75 to-red-400/75"
            aria-hidden
          />
          <div className="space-y-4 px-5 pb-5 pt-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <span aria-hidden>⚠️</span>
                <span>
                  {safetyIssuesCount ?? "—"} food quality & safety issues
                  identified
                </span>
              </div>

              <div className="text-sm text-gray-500">
                Based on {totalReviewsAnalyzed ?? "—"} public reviews
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span aria-hidden>🕒</span>
              <span>
                Last reported: {lastReportedLabel ?? "—"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span aria-hidden>📊</span>
              <span>
                {issuesPerReviewsLabel != null
                  ? `Issues reported in ${issuesPerReviewsLabel} reviews`
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        <LinkedSafetySignalsAndIncidents
          sortedSignals={sortedSignals.map((s) => ({
            signal_type: s.signal_type,
            count: s.count,
            severity: s.severity ?? null,
          }))}
          incidents={notableIncidents}
        />
      </div>

      <p className={`max-w-prose ${mutedBodyClassName}`}>
        This is our read of what people said in public reviews—not every visit,
        and not a health inspection.
      </p>
    </main>
  );
}
