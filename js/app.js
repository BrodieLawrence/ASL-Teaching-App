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
let practiceWords = [];
let lastAttempt = null;  // kept so it can be saved for testing (see saveLastAttempt)
const debugMode = new URLSearchParams(location.search).has("debug");

function showStatus(text, kind = "") {
  $("status").textContent = text;
  $("status").className = kind;
}

// PRACTICE_WORDS from settings, minus any that have no sign file (e.g. typos).
// Falls back to every word if none are usable.
function choosePracticeWords() {
  const unknown = settings.PRACTICE_WORDS.filter(w => !data.words.includes(w));
  if (unknown.length) console.warn(`PRACTICE_WORDS: no sign file for ${unknown.join(", ")}; skipping.`);
  const usable = settings.PRACTICE_WORDS.filter(w => data.words.includes(w));
  return usable.length ? usable : data.words;
}

function nextWord() {
  // Pick a different word than last time, unless there is only one word.
  const others = practiceWords.filter(w => w !== currentWord);
  const choices = others.length ? others : practiceWords;
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

// Leniency from the input box, kept within a sensible range.
function readLeniency() {
  const value = parseFloat($("leniency").value);
  if (!(value > 0)) return settings.DEFAULT_LENIENCY;
  return Math.min(3, Math.max(0.25, value));
}

async function onStart() {
  $("start").disabled = $("next").disabled = true;
  $("details").textContent = "";
  try {
    const rawFrames = await recordAttempt(tracker, {
      countdownSeconds: settings.COUNTDOWN_SECONDS,
      recordSeconds: settings.RECORD_SECONDS,
      onStatus: showStatus,
    });
    const leniency = readLeniency();
    const result = gradeAttempt(rawFrames, currentWord, leniency);
    lastAttempt = { word: currentWord, leniency, pass: result.pass, message: result.message,
      savedAt: new Date().toISOString(), frames: rawFrames };
    $("save").disabled = false;
    showStatus(result.message, result.pass ? "pass" : "fail");
    $("details").textContent = result.details || "";
  } catch (err) {
    console.error(err);
    showStatus(`Something went wrong: ${err.message}. Please try again.`, "fail");
  } finally {
    // Always give the buttons back, even if something failed.
    $("start").disabled = $("next").disabled = false;
  }
}

// Debug only: download the last attempt's tracked points (numbers only, no video)
// so it can be re-graded with tools/evaluate_attempts.js.
function saveLastAttempt() {
  const wrongOnPurpose = $("wrong-on-purpose").checked;
  const attempt = { ...lastAttempt, wrongOnPurpose };
  const blob = new Blob([JSON.stringify(attempt)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  const label = wrongOnPurpose ? "wrong" : "correct";
  link.download = `attempt-${attempt.word}-${label}-${attempt.savedAt.replace(/[:.]/g, "-")}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  $("save").disabled = true;  // one save per attempt
  showStatus(`Saved (${label}).`);
}

async function main() {
  $("leniency").value = settings.DEFAULT_LENIENCY;
  showStatus("Loading signs and hand tracking...");
  data = await loadSigns();
  practiceWords = choosePracticeWords();
  tracker = await startTracking($("video"), $("overlay"));
  $("next").onclick = nextWord;
  $("start").onclick = onStart;
  $("save").onclick = saveLastAttempt;
  $("debug-tools").hidden = !debugMode;
  $("start").disabled = false;
  nextWord();
  showStatus("Ready. Press Start.");
}

main().catch(err => {
  console.error(err);
  // Camera problems (permission denied, no camera) get a hint; other errors are shown as-is.
  const cameraProblem = ["NotAllowedError", "NotFoundError", "NotReadableError"].includes(err.name);
  showStatus(`Error: ${err.message}${cameraProblem ? ". Allow camera access and use Chrome." : ""}`, "fail");
});
