// Loads the example recordings for each word from the signs/ folder.
import { toFeatures } from "./grader.js";

// Returns { words, distanceLimit, signs: [{word, examples}] }.
export async function loadSigns(baseUrl = "signs/") {
  const index = await (await fetch(baseUrl + "words.json")).json();
  const signs = await Promise.all(index.words.map(async word => {
    const data = await (await fetch(`${baseUrl}${word}.json`)).json();
    return { word, examples: data.examples.map(toFeatures) };
  }));
  return { words: index.words, distanceLimit: index.distanceLimit, signs };
}
