import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findStep } from "../scripts/structure";
import type { Rule } from "../scripts/verify";
import { asList, block, isFilled, readDesign, wordCount } from "./lib/design";

// One answer on the checklist. A learner may leave any field out.
type Answer = { item?: unknown; answer?: unknown; quote?: unknown };
type Review = { case?: unknown; items?: unknown; question?: unknown };

// The reviewer checklist. Every item gets pass, fail or not-stated.
export const CHECKLIST = [
  "outcome",
  "metric-base",
  "shape",
  "human-gate",
  "failure-path",
  "cost-per-outcome",
  "system-of-record",
];
export const ANSWERS = ["pass", "fail", "not-stated"];
const SHORTEST_QUOTE = 5;

// A question about a denominator asks "of how many?" or "compared with what?".
const BASE_WORDS = [
  "denominator",
  "out of",
  "of how many",
  "how many of",
  "of the \\d",
  "compared (with|to)",
  "baseline",
  "share of",
  "what base",
];
const ASKS_FOR_A_BASE = new RegExp(BASE_WORDS.join("|"), "i");
// A question about a gate asks who signs off, approves or checks before an action.
const ASKS_ABOUT_A_GATE = /\bgate|sign(s|ed)? off|approv|who checks|a person|a human|human review/i;

const casesFolder = () => join(String(findStep("review-a-real-system")?.dir), "cases");

// Saved copies of the public pages, such as cases/freedom-forever.txt.
export const knownCases = () =>
  readdirSync(casesFolder())
    .filter((file) => file.endsWith(".txt"))
    .map((file) => file.replace(/\.txt$/, ""));

// Dashes, curly quotes and spacing differ between a web page and a typed quote,
// so both sides are made plain before they are compared.
export function plainText(text: string): string {
  const straightQuotes = text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  const plainDashes = straightQuotes.replace(/[‐-―]/g, "-");
  return plainDashes.replace(/\s+/g, " ").trim().toLowerCase();
}

// Every review file in the folder, such as review-aes.md.
function reviewFiles(folder: string): string[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder).filter((file) => /^review-[a-z0-9-]+\.md$/.test(file));
}

function readReview(folder: string, file: string): Review {
  const result = block(readDesign(folder, file), "Review");
  return result.ok ? (result.data as Review) : {};
}

// True when the folder has a review file and every review passes the test.
function everyReview(folder: string, passes: (review: Review) => boolean): boolean {
  const files = reviewFiles(folder);
  return files.length > 0 && files.every((file) => passes(readReview(folder, file)));
}

const answersOf = (review: Review) => asList<Answer>(review.items);

function answersEveryItem(review: Review): boolean {
  const answers = answersOf(review);
  return CHECKLIST.every((item) => {
    const matching = answers.filter((answer) => answer.item === item);
    return matching.length === 1 && ANSWERS.includes(String(matching[0].answer));
  });
}

function passesAreQuoted(review: Review): boolean {
  const sourcePath = join(casesFolder(), `${String(review.case)}.txt`);
  if (!existsSync(sourcePath)) return false;
  const source = plainText(readFileSync(sourcePath, "utf8"));
  const passes = answersOf(review).filter((answer) => answer.answer === "pass");
  return passes.every((answer) => {
    const quote = plainText(String(answer.quote ?? ""));
    return wordCount(quote) >= SHORTEST_QUOTE && source.includes(quote);
  });
}

function asksGoodQuestion(review: Review): boolean {
  const question = String(review.question ?? "").trim();
  const asksSomething = isFilled(question) && question.endsWith("?") && wordCount(question) >= 8;
  return asksSomething && (ASKS_FOR_A_BASE.test(question) || ASKS_ABOUT_A_GATE.test(question));
}

export default [
  {
    says: "a review-<case>.md file has a Review block for a case in cases/",
    test: (folder) => everyReview(folder, (review) => knownCases().includes(String(review.case))),
    tryNext:
      "fill the yaml design block under ## Review and set case: to the name of a file " +
      "in cases/, such as freedom-forever or aes",
  },
  {
    says: "every checklist item is answered once with pass, fail or not-stated",
    test: (folder) => everyReview(folder, answersEveryItem),
    tryNext: `answer each item once: ${CHECKLIST.join(", ")}`,
  },
  {
    says: "every pass quotes at least 5 words found in the saved source",
    test: (folder) => everyReview(folder, passesAreQuoted),
    tryNext:
      "copy the words for each pass from the case file in cases/; " +
      "if the page never says it, the answer is not-stated",
  },
  {
    says: "at least one item is not stated",
    test: (folder) =>
      everyReview(folder, (review) =>
        answersOf(review).some((answer) => answer.answer === "not-stated"),
      ),
    tryNext:
      "a customer story leaves things out; find an item the page never answers " +
      "and mark it not-stated",
  },
  {
    says: "the question for the team asks for a denominator or about a gate",
    test: (folder) => everyReview(folder, asksGoodQuestion),
    tryNext:
      "ask one question of at least 8 words ending in ?, such as of how many emails, " +
      "or who signs off before the agent acts",
  },
] satisfies Rule[];
