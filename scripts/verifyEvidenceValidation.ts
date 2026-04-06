/**
 * Spot-checks pattern-based canonical evidence (tsx scripts/verifyEvidenceValidation.ts)
 */
import {
  collectCanonicalEvidenceItems,
  detectSignalsWithEvidence,
  evidenceChipAddsValue,
  isSnippetWorthy,
  isValidEvidenceChip,
  normalize,
} from "../lib/reviewSignals.ts";

function assertEq(name: string, got: unknown, exp: unknown) {
  if (got !== exp) {
    console.error(`FAIL ${name}: expected`, exp, "got", got);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${name}`);
  }
}

function assertWorthy(name: string, snippet: string, expected: boolean) {
  const got = isSnippetWorthy(snippet);
  if (got !== expected) {
    console.error(`FAIL ${name}:`, snippet, "expected", expected, "got", got);
    process.exitCode = 1;
  } else {
    console.log(`ok worthy: ${name}`);
  }
}

assertWorthy("very bad taste", "very bad taste", true);
assertWorthy("very bad (2w)", "very bad", false);
assertWorthy("worst pizza ever", "worst pizza ever", false);
assertWorthy("pizza single", "pizza", false);
assertWorthy("plain hard bread", "plain hard bread", true);
assertWorthy("so bad", "so bad", false);

function evidenceSnippets(text: string): string[] {
  return collectCanonicalEvidenceItems(normalize(text)).map((i) => i.snippet);
}

assertEq(
  "rats were there → canonical",
  evidenceSnippets("rats were there in the kitchen").includes("rats present"),
  true,
);
assertEq(
  "fell into food → canonical",
  evidenceSnippets("something fell into food").includes("rat fell into food"),
  true,
);
assertEq(
  "not cooked well → canonical",
  evidenceSnippets("was not cooked well").includes("not cooked properly"),
  true,
);
assertEq(
  "felt stale → canonical",
  evidenceSnippets("felt stale as u can see").includes("food felt stale"),
  true,
);

if (!isValidEvidenceChip("rats present")) {
  console.error("rats present should be valid chip");
  process.exitCode = 1;
}
if (isValidEvidenceChip("rats and mice")) {
  console.error("should reject and in chip");
  process.exitCode = 1;
}

assertEq("no echo: bad food quality", evidenceChipAddsValue("bad food quality"), false);
assertEq("no echo: poor food quality", evidenceChipAddsValue("poor food quality"), false);
assertEq("keep: not cooked properly", evidenceChipAddsValue("not cooked properly"), true);
assertEq("keep: cheese was bad", evidenceChipAddsValue("cheese was bad"), true);

const r1 = detectSignalsWithEvidence(
  "The pasta was stale and had very bad taste overall.",
);
console.log("detect (stale + taste) → evidence:", r1.evidence);

const r2 = detectSignalsWithEvidence("Worst pizza ever will not return.");
console.log("detect (worst pizza ever) → evidence:", r2.evidence);

if (process.exitCode === 1) console.error("\nSome checks failed.");
else console.log("\nEvidence validation checks passed.");
