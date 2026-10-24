// Builds signs/<word>.json and signs/words.json from tools/cache/examples.json.
// Also sets the distance limit used for grading: the distance that 90% of
// correct attempts by unseen signers (tools/cache/holdout.json) stay under.
//
// Usage: node tools/build_signs.js    (after python3 tools/download_dataset.py)
import { writeFileSync } from "node:fs";
import { readJson, toSequence, rankHoldout } from "./pipeline.js";
import { toFeatures, dtwDistance } from "../js/grader.js";

const round = v => Math.round(v * 1000) / 1000;
const examples = readJson("./cache/examples.json");
const words = [...new Set(examples.map(e => e.word))];

const signs = words.map(word => {
  const sequences = examples
    .filter(e => e.word === word)
    .map(e => toSequence(e.frames)?.sequence)
    .filter(Boolean)
    .map(seq => seq.map(hand => hand.map(round)));
  // The demo example is the most typical one: closest on average to all the others.
  const features = sequences.map(toFeatures);
  const totals = features.map(a => features.reduce((sum, b) => sum + dtwDistance(a, b), 0));
  const demoIndex = totals.indexOf(Math.min(...totals));
  // One example per line keeps the file somewhat browsable.
  const body = sequences.map(s => "    " + JSON.stringify(s)).join(",\n");
  writeFileSync(new URL(`../signs/${word}.json`, import.meta.url),
    `{\n  "word": "${word}",\n  "source": "Kaggle asl-signs (Google Isolated Sign Language Recognition)",\n` +
    `  "format": "each example is 16 frames of the main signing hand: 21 points as x,y in body coordinates",\n` +
    `  "demoIndex": ${demoIndex},\n` +
    `  "examples": [\n${body}\n  ]\n}\n`);
  console.log(`${word}: ${sequences.length} examples`);
  return { word, examples: features };
});

const correctDistances = rankHoldout(signs)
  .filter(r => r.ranked)
  .map(r => r.ranked.find(x => x.word === r.word).distance)
  .sort((a, b) => a - b);
const distanceLimit = round(correctDistances[Math.floor(0.9 * (correctDistances.length - 1))]);

writeFileSync(new URL("../signs/words.json", import.meta.url),
  JSON.stringify({ words, distanceLimit }, null, 2) + "\n");
console.log(`distanceLimit = ${distanceLimit}. Run "node tools/evaluate.js" to see accuracy.`);
