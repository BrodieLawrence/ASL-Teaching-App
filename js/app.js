// Wires the page together: welcome, quiz lists, list editor, practice and quiz-complete screens.
import * as settings from "./settings.js";
import { loadTrackingModels, startTracking, CameraError } from "./tracking.js";
import { captureFrames, toBodyCoordinates } from "./recorder.js";
import { mainHandSequence, checkAttempt, rankWords, judge } from "./grader.js";
import { loadSigns } from "./signs.js";
import { showSignDemo } from "./demo.js";
import { progress } from "./progress.js";
import { confettiFountain } from "./confetti.js";
import { quizLists } from "./lists.js";
import { Quiz } from "./quiz.js";
import { music } from "./music.js";

const $ = id => document.getElementById(id);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const debugMode = new URLSearchParams(location.search).has("debug");

let data = null;           // example signs (see signs.js)
let models = null;         // tracking models, loaded during the welcome screen
let tracker = null;
let quiz = null;           // the quiz list being played (see quiz.js)
let currentWord = null;
let editing = null;        // list being edited: { id, words: Set } (id null for a new list)
let demo = { stop() {}, replay() {} };
let difficulty = settings.DIFFICULTIES[progress.difficulty] ? progress.difficulty : settings.DEFAULT_DIFFICULTY;
let lastAttempt = null;    // kept so it can be saved for testing (see saveLastAttempt)

// How a word is shown to the learner (the dataset writes some words without spaces).
const label = word => settings.WORD_LABELS[word] ?? word;

// ---------- Welcome and loading ----------

function setLoading(text, percent) {
  $("load-text").textContent = text;
  $("load-percent").textContent = `${percent}%`;
  $("load-bar").style.width = `${percent}%`;
}

function showWelcomeError(message) {
  $("welcome-error").textContent = message;
  $("welcome-error").hidden = false;
}

async function load() {
  setLoading("Loading signs…", 10);
  data = await loadSigns();
  renderProgress();
  setLoading("Loading hand tracking…", 35);
  models = await loadTrackingModels();
  setLoading("Ready!", 100);
  $("begin").disabled = false;
}

async function begin() {
  music.start();  // the click on START PRACTICING lets the browser play sound
  $("begin").disabled = true;
  $("welcome-error").hidden = true;
  setLoading("Starting your camera…", 100);
  try {
    tracker = await startTracking(models, $("video"), $("overlay"));
  } catch (err) {
    console.error(err);
    showWelcomeError(err instanceof CameraError ? err.message : `Couldn't start the camera (${err.message}).`);
    $("begin").disabled = false;
    setLoading("Ready!", 100);
    return;
  }
  watchForHands();
  showLists();
}

// ---------- Screens ----------

const SCREENS = ["welcome", "lists", "editor", "practice", "done"];
function showScreen(name) {
  for (const id of SCREENS) $(id).hidden = id !== name;
  if (name !== "practice") demo.stop();
  if (tracker) tracker.paused = name !== "practice";  // no tracking work while not practising
  window.scrollTo(0, 0);
}

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `assets/icons.svg#${name}`);
  svg.append(use);
  return svg;
}

function button(className, text, iconName, onClick, ariaLabel) {
  const b = document.createElement("button");
  b.className = className;
  if (iconName) b.append(icon(iconName));
  if (text) b.append(text);
  if (ariaLabel) { b.setAttribute("aria-label", ariaLabel); b.title = ariaLabel; }
  b.onclick = onClick;
  return b;
}

// ---------- Quiz lists ----------

function listCard(list) {
  const card = document.createElement("div");
  card.className = "list-card";

  const head = document.createElement("div");
  head.className = "list-card-head";
  const name = document.createElement("div");
  name.className = "list-name";
  name.textContent = list.name;
  head.append(name);
  if (list.builtIn) {
    const tag = document.createElement("span");
    tag.className = "tag-default";
    tag.append(icon("lock-simple"), "DEFAULT");
    head.append(tag);
  }

  const count = document.createElement("div");
  count.className = "muted strong";
  count.textContent = `${list.words.length} word${list.words.length === 1 ? "" : "s"}`;

  const chips = document.createElement("div");
  chips.className = "chips";
  for (const word of list.words.slice(0, 6)) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = label(word);
    chips.append(chip);
  }
  if (list.words.length > 6) {
    const more = document.createElement("span");
    more.className = "muted strong";
    more.textContent = `+${list.words.length - 6} more`;
    chips.append(more);
  }

  const actions = document.createElement("div");
  actions.className = "list-card-actions";
  const tools = document.createElement("div");
  tools.className = "icon-buttons";
  if (list.builtIn) {
    tools.append(button("btn btn-quiet btn-icon", "", "copy", () => openEditor(list, true), "Copy and edit this list"));
  } else {
    tools.append(
      button("btn btn-quiet btn-icon", "", "pencil-simple", () => openEditor(list, false), "Edit list"),
      button("btn btn-quiet btn-icon", "", "trash", () => deleteList(list), "Delete list"));
  }
  actions.append(button("btn btn-primary", "PLAY", "play", () => startQuiz(list)), tools);

  card.append(head, count, chips, actions);
  return card;
}

function showLists() {
  const lists = quizLists.all(data.words);
  $("word-total").textContent = data.words.length;
  $("default-lists").replaceChildren(...lists.filter(l => l.builtIn).map(listCard));
  const newCard = $("new-list-card");
  $("my-lists").replaceChildren(...lists.filter(l => !l.builtIn).map(listCard), newCard);
  showScreen("lists");
}

function deleteList(list) {
  if (!confirm(`Delete the list "${list.name}"? This can't be undone.`)) return;
  quizLists.remove(list.id);
  showLists();
}

// ---------- List editor ----------

// list: an existing list to edit (or copy, if `copy`), or nothing for a new list.
function openEditor(list = null, copy = false) {
  const isEdit = list && !copy && !list.builtIn;
  editing = { id: isEdit ? list.id : null, words: new Set(list ? list.words : []) };
  $("editor-title").textContent = isEdit ? "Edit quiz list" : "New quiz list";
  $("list-name").value = list ? (copy ? `${list.name} (copy)` : list.name) : "";
  $("list-name").placeholder = "e.g. Week 4 vocab";
  $("delete-list").hidden = !isEdit;
  $("editor-error").hidden = true;
  $("word-toggles").replaceChildren(...data.words.map(word => {
    const b = button("word-toggle", label(word), "check", () => {
      if (editing.words.has(word)) editing.words.delete(word); else editing.words.add(word);
      renderEditor();
    });
    b.dataset.word = word;
    return b;
  }));
  renderEditor();
  showScreen("editor");
  $("list-name").focus();
}

function renderEditor() {
  $("editor-error").hidden = true;
  for (const b of $("word-toggles").children) b.setAttribute("aria-pressed", String(editing.words.has(b.dataset.word)));
  $("editor-count").textContent = `${editing.words.size} of ${data.words.length} selected`;
}

function saveList() {
  const name = $("list-name").value.trim();
  const problem = !name ? "Give the list a name." : !editing.words.size ? "Choose at least one word." : null;
  if (problem) {
    $("editor-error").textContent = problem;
    $("editor-error").hidden = false;
    return;
  }
  // Keep the words in the usual order, not the order they were clicked.
  quizLists.save({ id: editing.id, name, words: data.words.filter(w => editing.words.has(w)) });
  showLists();
}

// ---------- Quiz ----------

function startQuiz(list) {
  quiz = new Quiz(list);
  $("playing-list").textContent = list.name;
  showScreen("practice");
  nextWord();
}

function nextWord() {
  if (quiz.finished) return showDone();
  currentWord = quiz.next();
  $("word").textContent = label(currentWord);
  updateQuizProgress();
  demo.stop();
  demo = showSignDemo(
    { youtube: $("demo-youtube"), video: $("demo-video"), canvas: $("demo") },
    {
      youtubeVideo: settings.YOUTUBE_VIDEOS[currentWord],
      videoUrl: `${settings.VIDEO_FOLDER}${currentWord}.mp4`,
      sequence: data.signs.find(s => s.word === currentWord).demo,
    });
  showIdle();
}

function updateQuizProgress() {
  $("word-position").textContent = `${quiz.correct.size} of ${quiz.words.length} done`;
}

function showDone() {
  showScreen("done");
  const totalTries = Object.values(quiz.tries).reduce((a, b) => a + b, 0);
  $("done-list").textContent = quiz.list.name;
  $("done-summary").textContent =
    `All ${quiz.words.length} word${quiz.words.length === 1 ? "" : "s"} signed correctly in ${totalTries} tr${totalTries === 1 ? "y" : "ies"}`;
  $("done-words").replaceChildren(...quiz.words.map(word => {
    const chip = document.createElement("span");
    chip.className = "done-word";
    const tries = document.createElement("span");
    tries.className = "tries";
    tries.textContent = `${quiz.tries[word]} ${quiz.tries[word] === 1 ? "try" : "tries"}`;
    chip.append(icon("check"), label(word), tries);
    return chip;
  }));
  confettiFountain($("done").querySelector(".done-card"));
}

// ---------- Top bar ----------

function renderProgress() {
  $("streak").textContent = progress.streak;
  const squares = $("learned-squares");
  squares.replaceChildren(...data.words.map(word => {
    const square = document.createElement("span");
    if (progress.hasLearned(word)) square.className = "on";
    return square;
  }));
  const learned = data.words.filter(w => progress.hasLearned(w)).length;
  $("learned-count").textContent = `${learned} / ${data.words.length}`;
}

// ---------- Difficulty ----------

function setDifficulty(level) {
  difficulty = level;
  progress.setDifficulty(level);
  for (const button of document.querySelectorAll(".pill[data-level]")) {
    button.setAttribute("aria-pressed", String(button.dataset.level === level));
  }
  $("leniency").value = settings.DIFFICULTIES[level].leniency;
}

// In debug mode the leniency box overrides the difficulty buttons.
function currentLeniency() {
  if (debugMode) {
    const value = parseFloat($("leniency").value);
    if (value > 0) return Math.min(3, Math.max(0.25, value));
  }
  return settings.DIFFICULTIES[difficulty].leniency;
}

// ---------- "Hand detected" badge ----------

function watchForHands() {
  const recent = [];
  tracker.onFrame(frame => {
    recent.push(Boolean(frame.L || frame.R));
    if (recent.length > 10) recent.shift();
    const on = recent.some(Boolean);
    const chip = $("hand-chip");
    if (chip.dataset.on !== String(on)) {
      chip.dataset.on = String(on);
      $("hand-chip-text").textContent = on ? "Hand detected" : "Show your hand";
    }
  });
}

// ---------- Practice flow ----------

function setBusy(busy) {
  for (const id of ["start", "next", "back-to-lists", "result-primary", "result-secondary"]) $(id).disabled = busy;
}

function showIdle() {
  $("countdown").hidden = true;
  $("phase-bar").hidden = true;
  $("result").hidden = true;
  $("result-actions").hidden = true;
  $("turn-actions").hidden = false;
  $("camera-box").classList.remove("recording");
  setBusy(false);
}

// Animates the attempt over time: the progress bar fills to halfway ("SIGN") during the
// countdown and to the end while signing. The camera dims quickly when the countdown
// starts, then brightens steadily until it is back to normal at "SIGN NOW!".
// Only the picture on screen changes; the hand tracking always sees the full image.
// Returns { startSigning(), stop() }: call startSigning at "SIGN NOW!" so the bar's second
// half starts then (even on a slow computer where the countdown runs late).
const DIM_SECONDS = 0.3;   // how quickly the camera dims after pressing Start
const DIMMEST = 0.25;      // brightness at its darkest
function animateAttempt() {
  const fill = $("phase-fill"), video = $("video");
  const countdown = settings.COUNTDOWN_SECONDS, record = settings.RECORD_SECONDS;
  const start = performance.now();
  let signStart = null, frame = null;
  function step(now) {
    let bar, brightness;
    if (signStart === null) {
      const t = Math.min((now - start) / 1000, countdown);
      bar = 50 * (t / countdown);
      brightness = t < DIM_SECONDS
        ? 1 - (1 - DIMMEST) * (t / DIM_SECONDS)
        : DIMMEST + (1 - DIMMEST) * ((t - DIM_SECONDS) / (countdown - DIM_SECONDS));
    } else {
      bar = 50 + 50 * Math.min(1, (now - signStart) / 1000 / record);
      brightness = 1;
    }
    fill.style.width = `${bar}%`;
    video.style.filter = brightness < 0.999 ? `brightness(${brightness.toFixed(3)})` : "";
    frame = requestAnimationFrame(step);
  }
  fill.style.width = "0%";
  frame = requestAnimationFrame(step);
  return {
    startSigning() { signStart = performance.now(); },
    stop() {
      cancelAnimationFrame(frame);
      video.style.filter = "";
      fill.style.width = "0%";
    },
  };
}

async function startAttempt() {
  setBusy(true);
  $("result").hidden = true;
  $("result-actions").hidden = true;
  $("turn-actions").hidden = false;
  $("countdown").hidden = false;
  $("countdown").classList.remove("signing");
  $("phase-bar").hidden = false;
  const animation = animateAttempt();
  try {
    // Get ready: 3, 2, 1
    $("count-label").textContent = "Get ready…";
    for (let i = settings.COUNTDOWN_SECONDS; i > 0; i--) {
      $("count-number").textContent = i;
      await wait(1000);
    }
    // Sign
    $("countdown").classList.add("signing");
    $("count-label").textContent = "SIGN NOW!";
    $("camera-box").classList.add("recording");
    animation.startSigning();
    const rawFrames = await captureFrames(tracker, settings.RECORD_SECONDS);
    animation.stop();
    $("camera-box").classList.remove("recording");
    $("countdown").hidden = true;
    $("phase-bar").hidden = true;

    const leniency = currentLeniency();
    const result = gradeAttempt(rawFrames, currentWord, leniency);
    if (result.kind !== "rejected") {
      progress.recordResult(currentWord, result.kind === "pass");
      quiz.record(currentWord, result.kind === "pass");
    }
    renderProgress();
    updateQuizProgress();
    showResult(result);
    lastAttempt = { word: currentWord, leniency, pass: result.kind === "pass", message: result.title,
      savedAt: new Date().toISOString(), frames: rawFrames };
    $("save").disabled = false;
  } catch (err) {
    console.error(err);
    animation.stop();
    $("camera-box").classList.remove("recording");
    $("countdown").hidden = true;
    $("phase-bar").hidden = true;
    showResult({ kind: "rejected", problem: `Something went wrong (${err.message}). Please try again.` });
  } finally {
    setBusy(false);
  }
}

// Grade raw tracked frames against a word.
// Returns { kind: "pass" | "fail" | "rejected", problem?, ranked?, judged? }.
export function gradeAttempt(rawFrames, word, leniency) {
  const frames = toBodyCoordinates(rawFrames);
  if (!frames) return { kind: "rejected", problem: "We couldn't see your shoulders and face. Sit back so they're inside the outline." };
  const sequence = mainHandSequence(frames);
  const problem = checkAttempt(frames, sequence, settings);
  if (problem) return { kind: "rejected", problem };
  const ranked = rankWords(sequence, data.signs);
  const judged = judge(word, ranked, leniency, data.distanceLimit);
  return { kind: judged.pass ? "pass" : "fail", ranked, judged, leniency };
}

export function showResult(result) {
  const icon = { pass: "star", fail: "smiley-sad", rejected: "info" }[result.kind];
  $("result-icon").querySelector("use").setAttribute("href", `assets/icons.svg#${icon}`);
  $("result").dataset.kind = result.kind;

  const message = $("result-message");
  message.replaceChildren();
  let title, tip = "";
  if (result.kind === "pass") {
    title = "Nice signing!";
    message.append(`"${label(currentWord)}" looked right. Streak: ${progress.streak}`);
  } else if (result.kind === "fail") {
    title = "Not quite!";
    const closest = result.ranked[0].word;
    if (closest !== currentWord) {
      const em = document.createElement("em");
      em.textContent = `"${label(closest)}"`;
      message.append("That looked more like ", em, ".");
    } else {
      message.append(`Close, but not quite close enough to "${label(currentWord)}".`);
    }
    tip = "Watch the video again and copy where the hand starts, how it moves, and where it ends.";
  } else {
    title = "Let's try that again";
    message.append(result.problem);
  }
  result.title = title;
  $("result-title").textContent = title;
  $("result-tip").textContent = tip;

  const details = $("result-details");
  details.hidden = !result.judged;
  details.open = false;
  if (result.judged) {
    const j = result.judged;
    $("details").textContent =
      `Closest matches: ${result.ranked.slice(0, 3).map(r => label(r.word)).join(", ")}\n` +
      `"${label(currentWord)}" ranked #${j.rank} of ${result.ranked.length} (needs top ${j.maxRank})\n` +
      `Score ${j.distance.toFixed(2)}, pass limit ${j.limit.toFixed(2)} (leniency ${result.leniency})`;
  }

  const passed = result.kind === "pass";
  $("result-primary").textContent = passed ? (quiz?.finished ? "FINISH QUIZ" : "NEXT WORD") : "TRY AGAIN";
  $("result-secondary").textContent = passed ? "Try again" : "Next word";
  $("result-primary").onclick = passed ? nextWord : startAttempt;
  $("result-secondary").onclick = passed ? startAttempt : nextWord;

  $("result").hidden = false;
  $("turn-actions").hidden = true;
  $("result-actions").hidden = false;
  if (passed) confettiFountain($("camera-box"));
}

// Debug only: download the last attempt's tracked points (numbers only, no video)
// so it can be re-graded with tools/evaluate_attempts.js.
function saveLastAttempt() {
  const wrongOnPurpose = $("wrong-on-purpose").checked;
  const attempt = { ...lastAttempt, wrongOnPurpose };
  const blob = new Blob([JSON.stringify(attempt)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  const kind = wrongOnPurpose ? "wrong" : "correct";
  link.download = `attempt-${attempt.word}-${kind}-${attempt.savedAt.replace(/[:.]/g, "-")}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  $("save").disabled = true;  // one save per attempt
  $("save").textContent = `Saved (${kind})`;
  setTimeout(() => ($("save").textContent = "Save last attempt"), 2000);
}

// ---------- Start up ----------

$("begin").onclick = begin;
$("music-toggle").onclick = () => music.toggle();
music.onChange(on => {
  $("music-toggle").setAttribute("aria-pressed", String(on));
  $("music-label").textContent = on ? "Music on" : "Music off";
  $("music-icon").setAttribute("href", `assets/icons.svg#${on ? "music-notes" : "speaker-simple-slash"}`);
});
$("new-list").onclick = () => openEditor();
$("new-list-card").onclick = () => openEditor();
$("editor-back").onclick = showLists;
$("cancel-edit").onclick = showLists;
$("save-list").onclick = saveList;
$("list-name").oninput = () => ($("editor-error").hidden = true);
$("delete-list").onclick = () => editing.id && deleteList(quizLists.get(editing.id, data.words));
$("select-all").onclick = () => { editing.words = new Set(data.words); renderEditor(); };
$("clear-words").onclick = () => { editing.words.clear(); renderEditor(); };
$("back-to-lists").onclick = showLists;
$("done-back").onclick = showLists;
$("play-again").onclick = () => startQuiz(quiz.list);
$("start").onclick = startAttempt;
$("next").onclick = nextWord;
$("replay").onclick = () => demo.replay();
$("save").onclick = saveLastAttempt;
$("debug-tools").hidden = !debugMode;
for (const button of document.querySelectorAll(".pill[data-level]")) {
  button.onclick = () => setDifficulty(button.dataset.level);
}
setDifficulty(difficulty);
// With ?debug, tests can drive the quiz from the browser console.
if (debugMode) window.aslDebug = { get quiz() { return quiz; }, get word() { return currentWord; }, gradeAttempt, showResult, nextWord };

load().catch(err => {
  console.error(err);
  setLoading("Couldn't load", 0);
  showWelcomeError(`Something didn't load (${err.message}). Check your internet connection and reload the page.`);
});
