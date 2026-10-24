// Picks the set of words the grader tells apart best.
//
// Uses a small sample of each candidate word (tools/candidate_words.txt), downloaded with:
//   python3 tools/download_dataset.py --words tools/candidate_words.txt --examples 12 --holdout 8 --out screen
// Each recording is tested against every candidate word, the same way the page grades,
// using only other people's recordings as the examples ("leave one person out"), so no
// separate test recordings are needed.
// Then, one at a time, the word that causes the most confusion is dropped: either it is
// often not recognised, or other words are often mistaken for it. This repeats until
// TARGET words remain.
//
// Usage: node tools/choose_words.js [--size 20] [--keep sleep,hello]
import { readJson, toSequence } from "./pipeline.js";
import { checkAttempt, toFeatures, dtwDistance } from "../js/grader.js";
import * as settings from "../js/settings.js";

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const TARGET = parseInt(opt("--size", "20"), 10);
const KEEP = new Set(opt("--keep", "sleep").split(",").filter(Boolean));

// Every usable recording of every candidate word.
const recordings = readJson("./cache/screen-examples.json").flatMap(({ word, signer, frames }) => {
  const c = toSequence(frames);
  if (!c?.sequence || checkAttempt(c.frames, c.sequence, settings)) return [];
  return [{ word, signer, features: toFeatures(c.sequence) }];
});
const counts = {};
for (const r of recordings) counts[r.word] = (counts[r.word] || 0) + 1;
const words = Object.keys(counts).filter(w => counts[w] >= 5);

// Distance from each recording to each word: the average of its 3 closest examples of
// that word, ignoring recordings by the same person.
const tests = recordings.filter(r => words.includes(r.word)).map(t => {
  const dist = {};
  for (const word of words) {
    const d = recordings.filter(r => r.word === word && r.signer !== t.signer && r !== t)
      .map(r => dtwDistance(r.features, t.features)).sort((a, b) => a - b);
    const k = Math.min(3, d.length);
    dist[word] = d.slice(0, k).reduce((a, b) => a + b, 0) / k;
  }
  return { word: t.word, dist };
});
console.log(`${words.length} candidate words, ${tests.length} test recordings (each tested against other people's)\n`);
const signs = words.map(word => ({ word }));

// How well a set of words works: for each word, how often its recordings are recognised
// (closest within the set), and how often other words' recordings are mistaken for it.
function evaluate(set) {
  const stats = Object.fromEntries([...set].map(w => [w, { tests: 0, right: 0, top3: 0, stolen: 0 }]));
  for (const t of tests) {
    if (!set.has(t.word)) continue;
    const ranked = [...set].sort((a, b) => t.dist[a] - t.dist[b]);
    const s = stats[t.word];
    s.tests++;
    if (ranked[0] === t.word) s.right++;
    else stats[ranked[0]].stolen++;
    if (ranked.slice(0, 3).includes(t.word)) s.top3++;
  }
  return stats;
}
const confusion = s => (s.tests - s.right + s.stolen) / Math.max(1, s.tests);

const set = new Set(signs.map(s => s.word));
while (set.size > TARGET) {
  const stats = evaluate(set);
  const worst = [...set].filter(w => !KEEP.has(w))
    .sort((a, b) => confusion(stats[b]) - confusion(stats[a]))[0];
  set.delete(worst);
}

const stats = evaluate(set);
const total = Object.values(stats).reduce((a, s) => ({ tests: a.tests + s.tests, right: a.right + s.right, top3: a.top3 + s.top3 }), { tests: 0, right: 0, top3: 0 });
console.log(`Chosen ${set.size} words (closest word correct ${Math.round(100 * total.right / total.tests)}%, in closest 3: ${Math.round(100 * total.top3 / total.tests)}%):\n`);
for (const w of [...set].sort((a, b) => confusion(stats[a]) - confusion(stats[b]))) {
  const s = stats[w];
  console.log(`  ${w.padEnd(10)} recognised ${s.right}/${s.tests}, top 3 ${s.top3}/${s.tests}, mistaken for it ${s.stolen}x`);
}
console.log(`\nDropped: ${signs.map(s => s.word).filter(w => !set.has(w)).join(", ")}`);
