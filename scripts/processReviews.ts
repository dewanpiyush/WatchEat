import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  getSeverity,
  reviewRowSeverity,
} from "../lib/signalSeverity.ts";
import {
  detectSignalsWithEvidence,
  evidenceForFallbackFoodQuality,
  lowRatingFallbackSignals,
  normalize,
} from "../lib/reviewSignals.ts";
import {
  SCRIPTS_DATA_DIR,
  fileKey,
  loadProcessed,
  saveProcessed,
} from "./processedFiles.ts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const baseDir = SCRIPTS_DATA_DIR;

/** Parse DB / JSON review_date for comparisons; invalid values → null */
function parseReviewDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(String(value).trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

async function fetchReviews(restaurantSlug: string) {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, review_id, review_text, review_date, rating")
    .eq("restaurant_slug", restaurantSlug);

  if (error) {
    console.error("Error fetching reviews:", error);
    return [];
  }

  return data ?? [];
}

async function processRestaurant(restaurantSlug: string): Promise<boolean> {
  await supabase.from("signals").delete().eq("restaurant_slug", restaurantSlug);

  const reviews = await fetchReviews(restaurantSlug);

  console.log(`Processing ${reviews.length} reviews`);

  const aggregated: Record<
    string,
    {
      count: number;
      lastDetected: string | null;
      severity: ReturnType<typeof getSeverity>;
    }
  > = {};

  let totalReviews = 0;
  let reviewsWithSignals = 0;
  let lastIssueDate: Date | null = null;

  for (const r of reviews) {
    const text = r.review_text?.trim() ? String(r.review_text) : "";
    const normalized = text ? normalize(text) : "";
    let { signals, evidence } = text
      ? detectSignalsWithEvidence(text)
      : { signals: [] as string[], evidence: [] as string[] };
    if (signals.length === 0 && normalized) {
      const fallback = lowRatingFallbackSignals(normalized, r.rating);
      if (fallback.length > 0) {
        signals = fallback;
        evidence = evidenceForFallbackFoodQuality(normalized);
      }
    }
    const severity = reviewRowSeverity(signals, text);
    const processedAt = new Date().toISOString();
    const reviewDate = parseReviewDate(r.review_date);

    if (text) {
      totalReviews++;
    }

    if (signals.length > 0) {
      reviewsWithSignals++;
      if (
        reviewDate &&
        (!lastIssueDate || reviewDate.getTime() > lastIssueDate.getTime())
      ) {
        lastIssueDate = reviewDate;
      }
    }

    const hasReviewId =
      r.review_id != null && String(r.review_id).trim() !== "";
    const updateQuery = supabase
      .from("reviews")
      .update({
        signal_labels: signals,
        severity,
        evidence,
        processed_at: processedAt,
      })
      .eq(hasReviewId ? "review_id" : "id", hasReviewId ? r.review_id! : r.id);

    const { error: updateError } = await updateQuery;

    if (updateError) {
      console.error("Update error:", updateError);
    }

    if (signals.length > 0) {
      console.log("MATCHED REVIEW:");
      console.log(r.review_text);
      console.log("Signals:", signals, "Evidence:", evidence);
      console.log("------");
    }

    for (const signal of signals) {
      if (!aggregated[signal]) {
        aggregated[signal] = {
          count: 0,
          lastDetected: null,
          severity: getSeverity(signal),
        };
      }

      aggregated[signal].count++;

      if (reviewDate) {
        const prev = aggregated[signal].lastDetected
          ? parseReviewDate(aggregated[signal].lastDetected)
          : null;
        if (!prev || reviewDate.getTime() > prev.getTime()) {
          aggregated[signal].lastDetected = reviewDate.toISOString();
        }
      }
    }
  }

  console.log("Signal Summary:", restaurantSlug);
  console.log(aggregated);

  for (const [signal, data] of Object.entries(aggregated)) {
    const sev = getSeverity(signal);
    const { error } = await supabase.from("signals").upsert(
      {
        restaurant_slug: restaurantSlug,
        signal_type: signal,
        count: data.count,
        last_detected: data.lastDetected,
        severity: sev,
      },
      { onConflict: "restaurant_slug,signal_type" },
    );
    if (error) {
      console.error("signals upsert:", error);
      return false;
    }
  }

  const cleanPercentage =
    totalReviews > 0
      ? ((totalReviews - reviewsWithSignals) / totalReviews) * 100
      : 100;

  const { error: metricsError } = await supabase
    .from("restaurant_metrics")
    .upsert(
      {
        restaurant_slug: restaurantSlug,
        total_reviews: totalReviews,
        reviews_with_signals: reviewsWithSignals,
        clean_percentage: cleanPercentage,
        last_issue_date: lastIssueDate
          ? lastIssueDate.toISOString()
          : null,
      },
      { onConflict: "restaurant_slug" },
    );

  if (metricsError) {
    console.error("restaurant_metrics upsert:", metricsError);
    return false;
  }

  console.log(`${restaurantSlug} clean %:`, cleanPercentage.toFixed(1));
  return true;
}

function restaurantNeedsSignalPass(
  restaurantSlug: string,
  jsonFiles: string[],
  processed: ReturnType<typeof loadProcessed>,
): boolean {
  return jsonFiles.some((file) => {
    const k = fileKey(restaurantSlug, file);
    return (
      processed.ingested.includes(k) && !processed.signalsProcessed.includes(k)
    );
  });
}

async function main() {
  const isBackfill = process.argv.includes("--backfill");
  console.log("Process mode:", isBackfill ? "BACKFILL" : "INCREMENTAL");

  const processed = loadProcessed();

  const restaurants = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        !d.name.startsWith(".") &&
        d.name !== "node_modules",
    )
    .map((d) => d.name)
    .sort();

  console.log("Processing signals from DB for restaurants under:", baseDir);

  let skippedRestaurants = 0;
  let processedRestaurants = 0;

  for (const restaurant of restaurants) {
    const restaurantPath = path.join(baseDir, restaurant);
    const jsonFiles = fs
      .readdirSync(restaurantPath)
      .filter((f) => f.endsWith(".json"))
      .sort();

    if (
      !isBackfill &&
      !restaurantNeedsSignalPass(restaurant, jsonFiles, processed)
    ) {
      console.log(
        `Skip (no new ingested files pending signals): ${restaurant}`,
      );
      skippedRestaurants++;
      continue;
    }

    console.log(`Running signal pass for: ${restaurant}`);
    const ok = await processRestaurant(restaurant);
    if (!ok) {
      console.error(
        `Not marking files signalsProcessed for ${restaurant} (errors above).`,
      );
      continue;
    }

    const done = new Set(processed.signalsProcessed);
    for (const file of jsonFiles) {
      const k = fileKey(restaurant, file);
      if (processed.ingested.includes(k)) done.add(k);
    }
    processed.signalsProcessed = [...done];
    saveProcessed(processed);
    processedRestaurants++;
    console.log(`Marked signalsProcessed for ingested JSON under ${restaurant}`);
  }

  console.log("Restaurants processed:", processedRestaurants);
  console.log("Restaurants skipped:", skippedRestaurants);
  console.log("Done processReviews");
}

main();
