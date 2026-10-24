// Loads the example recordings for each word from the signs/ folder.
import { toFeatures } from "./grader.js";

// Returns { words, distanceLimit, signs: [{word, examples, demo}] }.
// demo is one example in body coordinates, for the how-to-sign animation.
export async function loadSigns(baseUrl = "signs/") {
  const index = await fetchJson(baseUrl + "words.json");
  const signs = await Promise.all(index.words.map(async word => {
    const data = await fetchJson(`${baseUrl}${word}.json`);
    return { word, examples: data.examples.map(toFeatures), demo: data.examples[data.demoIndex ?? 0] };
  }));
  return { words: index.words, distanceLimit: index.distanceLimit, signs };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Couldn't load ${url} (${response.status})`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${url} is not valid JSON`);
  }
}
