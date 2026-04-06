/**
 * Keyword + heuristic detection for review signal labels.
 * Phrases match on {@link normalize}d text using word-boundary regex (`\\bphrase\\b`).
 * Evidence chips are **only** predefined canonical phrases from {@link CANONICAL_EVIDENCE_RULES}
 * — never raw substrings or clause-extracted text.
 */

import {
  getSeverity,
  SEVERITY_ORDER,
  sortSignalsBySeverity,
} from "./signalSeverity";

export const signalsMap = {
  hygiene: [
    "dirty",
    "unhygienic",
    "filthy",
    "unclean",
    "not clean",
    "poor hygiene",
    "bad hygiene",
    "messy",
    "sticky table",
    "smelly place",
    "place was stinking",
    "place smelled",
    "place smells",
    "the place smelled",
    "place smelt",
    "bad odor",
    "foul smell",
    "restaurant smelled",
  ],
  food_quality: [
    "stale",
    "rotten",
    "spoiled",
    "not fresh",
    "old food",
    "food was old",
    "food smell",
    "smell of food",
    "food smelled",
    "weird smell",
    "tasted bad",
    "tasted off",
    "strange taste",
    "sour taste",
    "food was sour",
    "expired",
    "went bad",
    "bad food",
    "very bad",
    "worst food",
    "tasteless",
    "no taste",
    "taste was flat",
    "bland",
    "undercooked",
    "not cooked",
    "not cooked properly",
    "overcooked",
    "burnt",
    "rubbery",
    "cold food",
    "cheese was bad",
    "poor quality",
    "bad quality",
    "quality of food",
  ],
  insect: [
    "fly",
    "flies",
    "cockroach",
    "roach",
    "bug",
    "insect",
    "worm",
    "rat",
    "rats",
    "mouse",
    "rodent",
    "hair in food",
    "found hair",
    "something in food",
    "contaminated",
    "dirty plate",
    "unclean utensils",
    "unclean utensil",
    "dirty utensils",
    "dirty plates",
    "dirty cutlery",
  ],
  food_poisoning: [
    "food poisoning",
    "got sick",
    "fell sick",
    "vomit",
    "vomiting",
    "nausea",
    "diarrhea",
    "loose motions",
    "stomach pain",
    "after eating here",
    "next day sick",
  ],
} as const;

/** Ordered most-specific first; first match per canonical phrase wins (deduped). */
export const CANONICAL_EVIDENCE_RULES: readonly {
  re: RegExp;
  evidence: string;
  signal: keyof typeof signalsMap;
}[] = [
  {
    re: /\b(?:dropped|fell)\s+into\s+food\b/i,
    evidence: "rat fell into food",
    signal: "insect",
  },
  { re: /\brats?\s+were\s+there\b/i, evidence: "rats present", signal: "insect" },
  {
    re: /\bhair\s+in\s+food\b|\bfound\s+hair\b/i,
    evidence: "hair in food",
    signal: "insect",
  },
  {
    re: /\bsomething\s+in\s+food\b/i,
    evidence: "foreign object in food",
    signal: "insect",
  },
  { re: /\bcontaminated\b/i, evidence: "food contaminated", signal: "insect" },
  {
    re: /\bdirty\s+(?:plate|plates|utensils|cutlery)\b|\bunclean\s+utensils?\b/i,
    evidence: "dirty utensils or plates",
    signal: "insect",
  },
  {
    re: /\bcockroaches?\b|\broaches?\b/i,
    evidence: "cockroaches present",
    signal: "insect",
  },
  { re: /\bflies\b|\bfly\b/i, evidence: "flies present", signal: "insect" },
  { re: /\bbugs?\b|\binsects?\b|\bworms?\b/i, evidence: "insects present", signal: "insect" },
  {
    re: /\b(?:rats?|mice|mouse|rodents?)\b/i,
    evidence: "rats present",
    signal: "insect",
  },

  { re: /\bsticky\s+table\b/i, evidence: "sticky table", signal: "hygiene" },
  {
    re: /\b(?:dirty|filthy|unclean|unhygienic|messy)\b|\bnot\s+clean\b/i,
    evidence: "dirty or unclean premises",
    signal: "hygiene",
  },
  {
    re: /\bplace\s+was\s+stinking\b|\bplace\s+(?:smelled|smells|smelt)\b|\bthe\s+place\s+smelled\b|\brestaurant\s+smelled\b|\bsmelly\s+place\b|\bfoul\s+smell\b|\bbad\s+odor\b|\bstinking\b/i,
    evidence: "place was stinking",
    signal: "hygiene",
  },

  {
    re: /\bnot\s+cooked\s+(?:well|properly)\b|\bundercooked\b/i,
    evidence: "not cooked properly",
    signal: "food_quality",
  },
  {
    re: /\bnot\s+cooked\b(?!\s+(?:well|properly))/i,
    evidence: "not cooked properly",
    signal: "food_quality",
  },
  {
    re: /\b(?:felt\s+)?stale\b|\bstaleness\b/i,
    evidence: "food felt stale",
    signal: "food_quality",
  },
  {
    re: /\b(?:rotten|spoiled|expired)\b|\bwent\s+bad\b/i,
    evidence: "food seemed spoiled",
    signal: "food_quality",
  },
  {
    re: /\bnot\s+fresh\b|\bold\s+food\b|\bfood\s+was\s+old\b/i,
    evidence: "food not fresh",
    signal: "food_quality",
  },
  {
    re: /\bfood\s+(?:smell|smelled|smells)\b|\bsmell\s+of\s+food\b|\bweird\s+smell\b|\bstrange\s+taste\b|\bsour\s+taste\b|\btasted\s+(?:bad|off)\b|\bfood\s+was\s+sour\b/i,
    evidence: "off taste or smell",
    signal: "food_quality",
  },
  {
    re: /\btasteless\b|\bno\s+taste\b|\btaste\s+was\s+flat\b|\bbland\b/i,
    evidence: "bland or tasteless food",
    signal: "food_quality",
  },
  {
    re: /\bovercooked\b|\bburnt\b|\brubbery\b/i,
    evidence: "overcooked or burnt food",
    signal: "food_quality",
  },
  { re: /\bcold\s+food\b/i, evidence: "cold food served", signal: "food_quality" },
  {
    re: /\bcheese\s+was\s+(?:very\s+)?bad\b/i,
    evidence: "cheese was bad",
    signal: "food_quality",
  },

  {
    re: /\bfood\s+poisoning\b/i,
    evidence: "food poisoning mentioned",
    signal: "food_poisoning",
  },
  {
    re: /\b(?:got|fell)\s+sick\b|\bvomit(?:ing)?\b|\bnausea\b|\bdiarrhea\b|\bloose\s+motions\b|\bstomach\s+pain\b|\bafter\s+eating\s+here\b|\bnext\s+day\s+sick\b/i,
    evidence: "illness after eating",
    signal: "food_poisoning",
  },
];

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordsLongestFirst(keywords: readonly string[]): string[] {
  return [...keywords].sort((a, b) => b.length - a.length);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const phraseBoundaryReCache = new Map<string, RegExp>();

/** Whole phrase at word boundaries (normalized lowercase text). */
function wordBoundaryMatch(normalizedText: string, phrase: string): boolean {
  if (!phrase || !normalizedText) return false;
  let re = phraseBoundaryReCache.get(phrase);
  if (!re) {
    re = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i");
    phraseBoundaryReCache.set(phrase, re);
  }
  return re.test(normalizedText);
}

export function phraseMatches(signal: string, normalized: string, phrase: string): boolean {
  if (signal === "food_quality" && phrase === "cheese was bad") {
    return /\bcheese was (\w+ )?bad\b/i.test(normalized);
  }
  return wordBoundaryMatch(normalized, phrase);
}

/** Intensifier + "bad" with no subject (e.g. not "very bad taste"). */
const INTENSIFIERS_BEFORE_BAD = new Set(["very", "so", "really", "too"]);

const PURE_NEGATIVE_ADJ = new Set([
  "bad",
  "worst",
  "poor",
  "terrible",
  "awful",
]);

/** Standalone food nouns — not enough as a complaint object with "worst" alone. */
const COMMON_FOOD_NOUNS = new Set([
  "pizza",
  "bread",
  "burger",
  "fries",
  "cheese",
  "pasta",
  "rice",
  "soup",
]);

/**
 * Legacy helper for tests: whether a free-form snippet would be worth showing.
 * Canonical evidence bypasses this via {@link isValidEvidenceChip}.
 */
export function isSnippetWorthy(snippet: string): boolean {
  const words = snippet.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 6) return false;

  if (
    words.length === 2 &&
    INTENSIFIERS_BEFORE_BAD.has(words[0]) &&
    words[1] === "bad"
  ) {
    return false;
  }

  if (words[0] === "worst" && words[words.length - 1] === "ever") {
    return false;
  }

  if (
    words.length === 2 &&
    words[0] === "worst" &&
    COMMON_FOOD_NOUNS.has(words[1])
  ) {
    return false;
  }

  if (
    words.length === 2 &&
    PURE_NEGATIVE_ADJ.has(words[0]) &&
    PURE_NEGATIVE_ADJ.has(words[1])
  ) {
    return false;
  }

  if (words.length === 2 && words[0] === "poor") {
    const okAfterPoor = new Set([
      "quality",
      "hygiene",
      "service",
      "food",
      "experience",
      "taste",
      "smell",
      "odor",
      "odour",
      "cooking",
    ]);
    if (!okAfterPoor.has(words[1])) return false;
  }

  return true;
}

/** Canonical chips: 2–6 words, no "and" (avoids joining two issues). */
export function isValidEvidenceChip(s: string): boolean {
  const t = s.trim().toLowerCase();
  if (!t || /\band\b/.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 6) return false;
  return true;
}

/** Legacy / redundant phrases that may still appear in stored evidence. */
const LABEL_ECHO_PHRASES_EXACT = new Set([
  "bad food quality",
  "poor food quality",
  "poor hygiene",
  "bad hygiene",
  "cheese quality issue",
  "food quality issue",
]);

const GENERIC_QUALITY_WORD = /\b(bad|poor|quality|issue)\b/;

function isSpecificWasBadChip(t: string): boolean {
  return /^\w+\s+was\s+(bad|off)$/.test(t);
}

/**
 * No-echo rule: drop chips that restate the signal label or add little beyond it.
 * Also rejects short generic judgments (≤3 words with bad/poor/quality/issue), except
 * subject-specific lines like "cheese was bad".
 */
export function evidenceChipAddsValue(chip: string): boolean {
  const t = chip.trim().toLowerCase();
  if (!t) return false;
  if (LABEL_ECHO_PHRASES_EXACT.has(t)) return false;
  if (isSpecificWasBadChip(t)) return true;

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 3 && GENERIC_QUALITY_WORD.test(t)) return false;
  return true;
}

/** Dedupe, {@link isValidEvidenceChip}, {@link evidenceChipAddsValue}, cap at `max`. */
export function filterValuableEvidenceChips(
  phrases: readonly string[],
  max = 3,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of phrases) {
    const k = p.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    if (!isValidEvidenceChip(k) || !evidenceChipAddsValue(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= max) break;
  }
  return out;
}

function signalsMatchingFullText(normalized: string): string[] {
  const found = new Set<string>();
  for (const signal of Object.keys(signalsMap) as (keyof typeof signalsMap)[]) {
    for (const phrase of keywordsLongestFirst(signalsMap[signal])) {
      if (phraseMatches(signal, normalized, phrase)) {
        found.add(signal);
        break;
      }
    }
  }
  return [...found];
}

/**
 * Pattern-driven canonical evidence only — no raw review fragments.
 */
export function collectCanonicalEvidenceItems(normalized: string): EvidenceItem[] {
  const seen = new Set<string>();
  const items: EvidenceItem[] = [];
  for (const rule of CANONICAL_EVIDENCE_RULES) {
    if (!rule.re.test(normalized)) continue;
    const key = rule.evidence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ signal: rule.signal, snippet: rule.evidence });
  }
  return items;
}

/** Allowed chip strings — use to drop legacy raw snippets from stored evidence. */
export const CANONICAL_EVIDENCE_PHRASES = new Set(
  CANONICAL_EVIDENCE_RULES.map((r) => r.evidence.toLowerCase()),
);

export type EvidenceTheme =
  | "contamination_risks"
  | "cleanliness_concerns"
  | "food_quality_issues"
  | "illness_reported";

export const EVIDENCE_THEME_LABELS: Record<EvidenceTheme, string> = {
  contamination_risks: "Contamination risks",
  cleanliness_concerns: "Cleanliness concerns",
  food_quality_issues: "Food quality issues",
  illness_reported: "Illness reported",
};

function signalToTheme(signal: string): EvidenceTheme | null {
  if (signal === "insect") return "contamination_risks";
  if (signal === "hygiene") return "cleanliness_concerns";
  if (signal === "food_quality") return "food_quality_issues";
  if (signal === "food_poisoning") return "illness_reported";
  return null;
}

/** Group title for a canonical chip, or null when unknown/non-canonical. */
export function evidenceThemeForChip(chip: string): EvidenceTheme | null {
  const t = chip.trim().toLowerCase();
  if (!t) return null;
  const matched = CANONICAL_EVIDENCE_RULES.find(
    (r) => r.evidence.toLowerCase() === t,
  );
  if (!matched) return null;
  return signalToTheme(matched.signal);
}

/** Keep only predefined canonical phrases, then drop echo/generic chips. */
export function filterCanonicalEvidence(
  phrases: readonly string[],
  max = 3,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of phrases) {
    const k = p.trim().toLowerCase();
    if (!k || !CANONICAL_EVIDENCE_PHRASES.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= max) break;
  }
  return filterValuableEvidenceChips(out, max);
}

export type EvidenceItem = { signal: string; snippet: string };

/** Dedupe, severity-first order, cap at `max` (2–3). */
export function finalizeEvidenceSnippets(
  items: EvidenceItem[],
  max = 3,
): string[] {
  const sorted = [...items].sort(
    (x, y) =>
      SEVERITY_ORDER[getSeverity(x.signal)] -
      SEVERITY_ORDER[getSeverity(y.signal)],
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { snippet } of sorted) {
    const k = snippet.trim().toLowerCase();
    if (
      !k ||
      seen.has(k) ||
      !isValidEvidenceChip(snippet) ||
      !evidenceChipAddsValue(snippet)
    ) {
      continue;
    }
    seen.add(k);
    out.push(snippet.trim().toLowerCase());
    if (out.length >= max) break;
  }
  return out;
}

export type DetectResult = {
  signals: string[];
  evidence: string[];
};

/**
 * Signals from keyword map on full text; evidence only from canonical pattern table.
 */
export function detectSignalsWithEvidence(text: string): DetectResult {
  const normalized = normalize(text);
  if (!normalized) return { signals: [], evidence: [] };

  const signalSet = new Set(signalsMatchingFullText(normalized));
  const evidenceItems = collectCanonicalEvidenceItems(normalized);

  const signals = sortSignalsBySeverity([...signalSet]);
  const evidence = finalizeEvidenceSnippets(evidenceItems, 3);

  return { signals, evidence };
}

export function detectSignals(text: string): string[] {
  const normalized = normalize(text);
  if (!normalized) return [];
  return sortSignalsBySeverity(signalsMatchingFullText(normalized));
}

const LOW_RATING_FALLBACK_WORDS = [
  "bad",
  "worst",
  "disgusting",
  "poor",
  "terrible",
  "waste",
] as const;

/** Must appear (padded word/phrase) for low-rating → food_quality fallback */
const foodAnchors = [
  "order food",
  "food",
  "pizza",
  "burger",
  "taste",
  "cheese",
  "bread",
  "meal",
  "dish",
  "fries",
] as const;

/** Service-only reviews: never use food_quality fallback when no food anchor */
const serviceOnlyKeywords = [
  "customer service",
  "wrong order",
  "not delivered",
  "service",
  "staff",
  "behavior",
  "attitude",
  "delivery",
  "late",
  "delay",
  "rude",
] as const;

/**
 * Food anchors classify fallback-only reviews; they are never shown as evidence chips.
 */
export function evidenceForFallbackFoodQuality(_normalized: string): string[] {
  return [];
}

function boundaryContainsAny(
  normalizedText: string,
  phrases: readonly string[],
): boolean {
  return keywordsLongestFirst(phrases).some((p) =>
    wordBoundaryMatch(normalizedText, p),
  );
}

function parseStarRating(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Low-rating food_quality fallback only when the review clearly touches food,
 * not pure service/delivery complaints.
 * @param normalizedText — output of {@link normalize} (or empty)
 */
export function lowRatingFallbackSignals(
  normalizedText: string,
  rating: unknown,
): string[] {
  const stars = parseStarRating(rating);
  if (stars == null || stars > 2) return [];
  if (!normalizedText) return [];

  const containsNegativeWords = LOW_RATING_FALLBACK_WORDS.some((w) =>
    wordBoundaryMatch(normalizedText, w),
  );
  if (!containsNegativeWords) return [];

  const hasFood = boundaryContainsAny(normalizedText, foodAnchors);
  const hasService = boundaryContainsAny(normalizedText, serviceOnlyKeywords);

  if (hasService && !hasFood) return [];
  if (!hasFood) return [];

  return ["food_quality"];
}
