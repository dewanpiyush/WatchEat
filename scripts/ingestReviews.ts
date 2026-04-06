import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  SCRIPTS_DATA_DIR,
  fileKey,
  loadProcessed,
  saveProcessed,
} from "./processedFiles.ts";

dotenv.config({ path: ".env.local" });

console.log("ENV CHECK:", process.env.NEXT_PUBLIC_SUPABASE_URL);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const baseDir = SCRIPTS_DATA_DIR;

function slugToDisplayName(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseZomatoDate(text: string | number | undefined | null): string | null {
  if (text == null) return null;
  if (typeof text === "number" && Number.isFinite(text)) {
    return new Date(text).toISOString();
  }
  if (typeof text !== "string") return null;

  const trimmed = text.trim();
  const now = new Date();

  const match = trimmed.match(/(\d+)\s+days?\s+ago/i);
  if (match) {
    const days = parseInt(match[1], 10);
    const d = new Date();
    d.setDate(now.getDate() - days);
    return d.toISOString();
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();

  return null;
}

function generateReviewId(review: any, restaurantSlug: string, text: string) {
  const base = `${restaurantSlug}|${text}|${
    review.publishedAtDate || review.timestamp || ""
  }`;

  return crypto.createHash("sha256").update(base).digest("hex");
}

async function ingest() {
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

  console.log("Ingesting from:", baseDir);
  console.log("Restaurants:", restaurants.join(", "));

  let skippedReviews = 0;
  let skippedFiles = 0;
  let newlyIngestedFiles = 0;

  for (const restaurant of restaurants) {
    const restaurantPath = path.join(baseDir, restaurant);
    const restaurantSlug = restaurant;
    const displayName = slugToDisplayName(restaurantSlug);

    const files = fs
      .readdirSync(restaurantPath)
      .filter((f) => f.endsWith(".json"))
      .sort();

    for (const file of files) {
      const key = fileKey(restaurantSlug, file);
      if (processed.ingested.includes(key)) {
        console.log(`Skip (already ingested): ${key}`);
        skippedFiles++;
        continue;
      }

      const filePath = path.join(restaurantPath, file);
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as any[];

      console.log(
        `Ingesting ${data.length} reviews from ${key}`,
      );

      let fileHadError = false;

      for (const review of data) {
        const text = review.text || review.reviewText;

        if (!text || text.length < 20) {
          skippedReviews++;
          continue;
        }

        const reviewId =
          review.reviewId || generateReviewId(review, restaurantSlug, text);

        console.log("Processing review:", reviewId);

        const row = {
          restaurant_slug: restaurantSlug,
          restaurant_name: review.title || displayName,
          review_text: text,
          rating: review.stars || review.ratingV2 || null,
          review_date:
            review.publishedAtDate ||
            parseZomatoDate(review.timestamp) ||
            null,
          source: review.reviewOrigin || "zomato",
          review_id: reviewId,
          raw_json: review,
        };

        const { error } = await supabase
          .from("reviews")
          .upsert(row, { onConflict: "review_id" });

        if (error) {
          console.error("Insert error:", error);
          fileHadError = true;
        } else {
          console.log("Inserted:", reviewId);
        }
      }

      if (fileHadError) {
        console.error(
          `Not marking ${key} as ingested (fix errors and re-run).`,
        );
        continue;
      }

      processed.ingested.push(key);
      saveProcessed(processed);
      newlyIngestedFiles++;
      console.log(`Marked ingested: ${key}`);
    }
  }

  console.log("Skipped reviews (short/empty):", skippedReviews);
  console.log("Skipped files (already ingested):", skippedFiles);
  console.log("Newly ingested files:", newlyIngestedFiles);
  console.log("Done ingesting");
}

ingest();
