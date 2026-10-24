// Re-grades attempts saved from the page (open it with ?debug, then "Save last attempt").
// Use it to check grading changes on real webcam attempts.
//
// Usage: node tools/evaluate_attempts.js <folder or .json files...> [--leniency 1.25]
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { loadSignsFromDisk, toSequence } from "./pipeline.js";
import { checkAttempt, rankWords, judge } from "../js/grader.js";
import * as settings from "../js/settings.js";

const args = process.argv.slice(2);
const flag = args.indexOf("--leniency");
const leniency = flag >= 0 ? parseFloat(args.splice(flag, 2)[1]) : settings.DEFAULT_LENIENCY;
const files = args.flatMap(p => statSync(p).isDirectory()
  ? readdirSync(p).filter(f => f.endsWith(".json")).map(f => join(p, f)) : [p]);
if (!files.length) {
  console.log("Usage: node tools/evaluate_attempts.js <folder or .json files...> [--leniency 1.25]");
  process.exit(1);
}

const { distanceLimit, signs } = loadSignsFromDisk();
const totals = { correct: [0, 0], wrong: [0, 0] };  // [passed, total]
for (const file of files.sort()) {
  const attempt = JSON.parse(readFileSync(file, "utf8"));
  const kind = attempt.wrongOnPurpose ? "wrong" : "correct";
  const converted = toSequence(attempt.frames);
  const problem = !converted ? "body not visible" : checkAttempt(converted.frames, converted.sequence, settings);
  let pass = false, line;
  if (problem) {
    line = `REJECTED  ${problem}`;
  } else {
    const ranked = rankWords(converted.sequence, signs);
    const r = judge(attempt.word, ranked, leniency, distanceLimit);
    pass = r.pass;
    line = `${r.pass ? "PASS" : "FAIL"}  rank #${r.rank}, distance ${r.distance.toFixed(3)} (limit ${r.limit.toFixed(3)}); ` +
      `closest: ${ranked.slice(0, 3).map(x => x.word).join(", ")}`;
  }
  totals[kind][0] += pass ? 1 : 0;
  totals[kind][1]++;
  console.log(`${basename(file).slice(0, 44).padEnd(45)} ${attempt.word.padEnd(9)} ${kind.padEnd(8)} ${line}`);
}
console.log(`\nAt leniency ${leniency}:`);
console.log(`  correct attempts passed: ${totals.correct[0]}/${totals.correct[1]}  (higher is better)`);
console.log(`  wrong-on-purpose attempts passed: ${totals.wrong[0]}/${totals.wrong[1]}  (lower is better)`);
