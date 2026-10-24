// Remembers the learner's progress in this browser: current streak, which words
// they've signed correctly at least once, and their chosen difficulty.
// Nothing leaves the device. If the browser blocks storage, progress just isn't kept.

const KEY = "aslmasters-progress";

// Saved data is checked field by field, so anything unexpected is ignored instead of
// breaking the page.
function load() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || "{}") || {};
  } catch { /* unreadable: start fresh */ }
  const isWord = w => typeof w === "string" && w.length <= 40;
  return {
    streak: Number.isInteger(saved.streak) && saved.streak >= 0 ? saved.streak : 0,
    learned: Array.isArray(saved.learned) ? saved.learned.filter(isWord).slice(0, 500) : [],
    difficulty: typeof saved.difficulty === "string" ? saved.difficulty : null,
  };
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage blocked (e.g. some private windows): keep going without saving.
  }
}

const state = load();

export const progress = {
  get streak() { return state.streak; },
  get difficulty() { return state.difficulty; },
  hasLearned(word) { return state.learned.includes(word); },

  recordResult(word, passed) {
    state.streak = passed ? state.streak + 1 : 0;
    if (passed && !state.learned.includes(word)) state.learned.push(word);
    save(state);
  },

  setDifficulty(level) {
    state.difficulty = level;
    save(state);
  },
};
