// Accuracy test: grades recordings from signers the app has never seen,
// using the same code as the web page, at several leniency settings.
//
// Usage: node tools/evaluate.js
import { loadSignsFromDisk, rankHoldout } from "./pipeline.js";
import { judge } from "../js/grader.js";

const { words, distanceLimit, signs } = loadSignsFromDisk();
const results = rankHoldout(signs);
const pct = (a, b) => `${Math.round((100 * a) / b)}%`;

const graded = results.filter(r => r.ranked);
const top1 = graded.filter(r => r.ranked[0].word === r.word).length;
const top3 = graded.filter(r => r.ranked.slice(0, 3).some(x => x.word === r.word)).length;
console.log(`${results.length} test recordings, ${results.length - graded.length} rejected by basic checks`);
console.log(`Closest word is correct: ${pct(top1, graded.length)}; correct word in closest 3: ${pct(top3, graded.length)}\n`);

console.log("Leniency | correct sign passes | a different sign passes");
for (const leniency of [0.5, 0.75, 1, 1.25, 1.5, 2]) {
  let correct = 0, wrong = 0, wrongTotal = 0;
  for (const r of results) {
    for (const word of words) {
      const pass = r.ranked && judge(word, r.ranked, leniency, distanceLimit).pass;
      if (word === r.word) correct += pass ? 1 : 0;
      else { wrongTotal++; wrong += pass ? 1 : 0; }
    }
  }
  console.log(`${String(leniency).padEnd(8)} | ${pct(correct, results.length).padEnd(19)} | ${pct(wrong, wrongTotal)}`);
}
