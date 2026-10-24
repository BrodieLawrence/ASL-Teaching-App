// Compares a recorded sign with the example recordings of each word.
//
// Works on recordings in body coordinates (see recorder.js): a list of frames,
// each {L, R} where L/R is the person's left/right hand as 42 numbers
// (x, y of 21 hand points) or null if that hand wasn't seen.
//
// Method: keep the main signing hand, stretch every sign to the same length,
// then measure how different two signs are with dynamic time warping (DTW),
// which lines up two movements even if one is done faster.
// This file is also used by the tools in tools/, so the accuracy test checks
// exactly the code the web page runs.

export const SEQUENCE_LENGTH = 16; // every sign is resampled to this many frames
const SHAPE_WEIGHT = 2.0;          // how much handshape counts vs hand position
const VERTICAL_WEIGHT = 0.5;       // how much up/down position counts vs left/right
const CLOSEST_EXAMPLES = 3;        // a word's score = average of its 3 closest examples

// Turn a recording into a fixed-length sequence of the main signing hand.
// Left-handed signing is mirrored so it matches right-handed examples.
// Short gaps where the tracker lost the hand are filled in.
// Returns SEQUENCE_LENGTH hands (42 numbers each), or null if too few hand frames.
export function mainHandSequence(frames) {
  let leftCount = 0, rightCount = 0;
  for (const f of frames) { if (f.L) leftCount++; if (f.R) rightCount++; }
  const mirror = hand => hand.map((v, i) => (i % 2 === 0 ? -v : v));
  let hands = frames.map(f => (rightCount >= leftCount ? f.R : f.L && mirror(f.L)) || null);

  const seen = hands.map((h, i) => (h ? i : -1)).filter(i => i >= 0);
  if (seen.length < 3) return null;
  hands = hands.slice(seen[0], seen[seen.length - 1] + 1);

  const filled = hands.map((h, i) => {
    if (h) return h;
    let before = i - 1; while (!hands[before]) before--;
    let after = i + 1; while (!hands[after]) after++;
    const t = (i - before) / (after - before);
    return hands[before].map((v, k) => v + (hands[after][k] - v) * t);
  });

  const out = [];
  for (let i = 0; i < SEQUENCE_LENGTH; i++) {
    out.push(filled[Math.round((i * (filled.length - 1)) / (SEQUENCE_LENGTH - 1))]);
  }
  return out;
}

// Split a hand into position (wrist) and shape (points relative to the wrist, scaled by hand size).
function handFeatures(hand) {
  let size = 0;
  for (let i = 1; i < 21; i++) size += Math.hypot(hand[2 * i] - hand[0], hand[2 * i + 1] - hand[1]);
  size = size / 20 || 1;
  const shape = new Float32Array(42);
  for (let i = 0; i < 21; i++) {
    shape[2 * i] = (hand[2 * i] - hand[0]) / size;
    shape[2 * i + 1] = (hand[2 * i + 1] - hand[1]) / size;
  }
  return { x: hand[0], y: hand[1] * VERTICAL_WEIGHT, shape };
}

export function toFeatures(sequence) {
  return sequence.map(handFeatures);
}

function frameDistance(a, b) {
  let shapeDiff = 0;
  for (let i = 0; i < 21; i++) {
    shapeDiff += Math.hypot(a.shape[2 * i] - b.shape[2 * i], a.shape[2 * i + 1] - b.shape[2 * i + 1]);
  }
  return Math.hypot(a.x - b.x, a.y - b.y) + SHAPE_WEIGHT * (shapeDiff / 21);
}

function dtwDistance(a, b) {
  const n = b.length;
  let prev = new Float64Array(n + 1).fill(Infinity);
  let cur = new Float64Array(n + 1);
  prev[0] = 0;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = Infinity;
    for (let j = 1; j <= n; j++) {
      cur[j] = frameDistance(a[i - 1], b[j - 1]) + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n] / (a.length + n);
}

// Quick checks before grading, so standing still or hiding your hands can't pass.
// Returns null if OK, otherwise a message for the user.
export function checkAttempt(frames, sequence, { minHandVisible, minMovement }) {
  const handFrames = frames.filter(f => f.L || f.R).length;
  if (!sequence || handFrames < minHandVisible * frames.length) {
    return "Not enough hand visible. Try again with your hand in view.";
  }
  const xs = sequence.map(h => h[0]), ys = sequence.map(h => h[1]);
  const moved = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (moved < minMovement) return "Your hand barely moved. Try the sign again.";
  return null;
}

// signs: [{word, examples: [features, ...]}] (examples already passed through toFeatures).
// Returns every word with its distance to the attempt, closest first.
export function rankWords(sequence, signs) {
  const attempt = toFeatures(sequence);
  return signs.map(({ word, examples }) => {
    const dists = examples.map(ex => dtwDistance(ex, attempt)).sort((a, b) => a - b);
    const k = Math.min(CLOSEST_EXAMPLES, dists.length);
    return { word, distance: dists.slice(0, k).reduce((s, d) => s + d, 0) / k };
  }).sort((a, b) => a.distance - b.distance);
}

// Pass if the target word is among the closest few words AND close enough overall.
// distanceLimit comes from signs/words.json: the distance that 90% of correct
// attempts by unseen signers stayed under. Leniency scales both rules.
export function judge(targetWord, ranked, leniency, distanceLimit) {
  const rank = ranked.findIndex(r => r.word === targetWord) + 1;
  const distance = ranked[rank - 1].distance;
  const maxRank = Math.max(1, Math.round(1 + 2 * leniency));
  const limit = distanceLimit * leniency;
  return { pass: rank <= maxRank && distance <= limit, rank, distance, maxRank, limit };
}
