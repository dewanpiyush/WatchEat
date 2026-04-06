/**
 * Validates food_quality phrase detection (run: npx tsx scripts/verifyFoodQualityLabels.ts)
 */
import { detectSignals } from "../lib/reviewSignals.ts";

function assertContains(
  name: string,
  text: string,
  expected: string,
) {
  const got = detectSignals(text);
  if (!got.includes(expected)) {
    console.error(`FAIL: ${name}\n  text: ${JSON.stringify(text)}\n  got:`, got);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${name}`);
  }
}

const cases: [string, string][] = [
  ["not cooked properly", "The pizza was not cooked properly"],
  ["taste was flat", "Honestly the taste was flat and boring"],
  ["cheese was very bad", "The cheese was very bad on the burger"],
  ["quality of food", "Extremely poor quality of food overall"],
  ["bad food", "This was completely bad food"],
];

for (const [expectPhrase, sentence] of cases) {
  assertContains(expectPhrase, sentence, "food_quality");
}

if (process.exitCode === 1) {
  console.error("\nSome checks failed.");
} else {
  console.log("\nAll food_quality checks passed.");
}
