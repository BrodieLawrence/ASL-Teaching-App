// Wires the page together: pick a word, record an attempt, show the result.
import * as settings from "./settings.js";
import { startTracking } from "./tracking.js";
import { recordAttempt, toBodyCoordinates } from "./recorder.js";
import { mainHandSequence, checkAttempt, rankWords, judge } from "./grader.js";
import { loadSigns } from "./signs.js";
import { playSignDemo } from "./demo.js";

const $ = id => document.getElementById(id);
let data = null;
let tracker = null;
let currentWord = null;
let stopDemo = () => {};

function showStatus(text, kind = "") {
  $("status").textContent = text;
  $("status").className = kind;
}

function nextWord() {
  const pool = settings.PRACTICE_WORDS.length ? settings.PRACTICE_WORDS : data.words;
  const choices = pool.filter(w => w !== currentWord);
  currentWord = choices[Math.floor(Math.random() * choices.length)];
  $("word").textContent = currentWord;
  $("details").textContent = "";
  stopDemo();
  stopDemo = playSignDemo($("demo"), data.signs.find(s => s.word === currentWord).demo);
  showStatus("Press Start when ready.");
}

// Grade raw tracked frames against the current word. Returns {pass, message, details}.
export function gradeAttempt(rawFrames, word, leniency) {
  const frames = toBodyCoordinates(rawFrames);
  if (!frames) return { pass: false, message: "Couldn't see your shoulders and face. Step back so they're in view." };
  const sequence = mainHandSequence(frames);
  const problem = checkAttempt(frames, sequence, settings);
  if (problem) return { pass: false, message: problem };

  const ranked = rankWords(sequence, data.signs);
  const result = judge(word, ranked, leniency, data.distanceLimit);
  return {
    pass: result.pass,
    message: result.pass ? `Correct! You signed "${word}".` : `Not quite. Try "${word}" again.`,
    details:
      `"${word}" ranked #${result.rank} of ${ranked.length} (needs top ${result.maxRank})\n` +
      `distance ${result.distance.toFixed(3)} (limit ${result.limit.toFixed(3)} at leniency ${leniency})\n` +
      `closest words: ${ranked.slice(0, 3).map(r => `${r.word} ${r.distance.toFixed(3)}`).join(", ")}`,
  };
}

async function onStart() {
  $("start").disabled = $("next").disabled = true;
  $("details").textContent = "";
  const rawFrames = await recordAttempt(tracker, {
    countdownSeconds: settings.COUNTDOWN_SECONDS,
    recordSeconds: settings.RECORD_SECONDS,
    onStatus: showStatus,
  });
  const leniency = parseFloat($("leniency").value) || settings.DEFAULT_LENIENCY;
  const result = gradeAttempt(rawFrames, currentWord, leniency);
  showStatus(result.message, result.pass ? "pass" : "fail");
  $("details").textContent = result.details || "";
  $("start").disabled = $("next").disabled = false;
}

async function main() {
  $("leniency").value = settings.DEFAULT_LENIENCY;
  showStatus("Loading signs and hand tracking...");
  data = await loadSigns();
  tracker = await startTracking($("video"), $("overlay"));
  $("next").onclick = nextWord;
  $("start").onclick = onStart;
  $("start").disabled = false;
  nextWord();
  showStatus("Ready. Press Start.");
}

main().catch(err => {
  console.error(err);
  showStatus(`Error: ${err.message}. Allow camera access and use Chrome.`, "fail");
});
