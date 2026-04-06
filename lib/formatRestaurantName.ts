function wordTitle(w: string): string {
  if (!w) return w;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** Title-case a slug segment; hyphens become word boundaries */
function segmentTitle(seg: string): string {
  return seg.split("-").map(wordTitle).join(" ");
}

/**
 * Human-readable name from URL slug.
 * - Underscores separate major parts (e.g. brand_rest_place_city).
 * - Hyphens inside a part become spaces (e.g. lotus-leaf → Lotus Leaf).
 * - Two-part brands like pizza_hut are grouped when the second token is "hut".
 */
export function formatRestaurantName(slug: string): string {
  const parts = slug.split("_").filter(Boolean);
  if (parts.length === 0) return slug;

  if (parts.length === 1) {
    return segmentTitle(parts[0]);
  }

  let brandEnd = 1;
  if (parts.length >= 2 && parts[1].toLowerCase() === "hut") {
    brandEnd = 2;
  }

  const brand = parts
    .slice(0, brandEnd)
    .map(segmentTitle)
    .join(" ");

  const locSegments = parts.slice(brandEnd);
  if (locSegments.length === 0) return brand;

  if (locSegments.length >= 2) {
    const area = locSegments
      .slice(0, -1)
      .map(segmentTitle)
      .join(" ");
    const city = segmentTitle(locSegments[locSegments.length - 1]);
    return `${brand} – ${area}, ${city}`;
  }

  return `${brand} – ${segmentTitle(locSegments[0])}`;
}
