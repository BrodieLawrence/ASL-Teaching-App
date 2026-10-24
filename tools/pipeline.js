// Shared by the tools: runs dataset recordings through the same code the web page uses.
import { readFileSync } from "node:fs";
import { toBodyCoordinates } from "../js/recorder.js";
import { mainHandSequence, checkAttempt, rankWords, toFeatures } from "../js/grader.js";
import * as settings from "../js/settings.js";

export const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));

// Raw recording -> 16-frame main-hand sequence (or null), exactly as the page does it.
export function toSequence(rawFrames) {
  const frames = toBodyCoordinates(rawFrames);
  return frames ? { frames, sequence: mainHandSequence(frames) } : null;
}

// Load signs/ from disk in the same shape js/signs.js gives the page.
export function loadSignsFromDisk() {
  const index = readJson("../signs/words.json");
  const signs = index.words.map(word => ({
    word, examples: readJson(`../signs/${word}.json`).examples.map(toFeatures),
  }));
  return { ...index, signs };
}

// Grade every holdout recording against every word. Returns [{word, ranked}] where
// ranked is null if the attempt was rejected by the basic checks.
export function rankHoldout(signs) {
  return readJson("./cache/holdout.json").map(({ word, frames: raw }) => {
    const converted = toSequence(raw);
    const rejected = !converted || checkAttempt(converted.frames, converted.sequence, settings);
    return { word, ranked: rejected ? null : rankWords(converted.sequence, signs) };
  });
}
