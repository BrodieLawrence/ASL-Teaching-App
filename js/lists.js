// Quiz lists: the built-in ones from settings.js plus the learner's own, saved in this
// browser only (no accounts). Built-in lists can't be changed or deleted, but can be copied.

import { DEFAULT_LISTS } from "./settings.js";

const KEY = "aslmasters-lists";

// Saved lists are checked field by field; anything unexpected is dropped.
const MAX_LISTS = 100, MAX_NAME = 40;
function loadOwn() {
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch { /* unreadable: start fresh */ }
  if (!Array.isArray(saved)) return [];
  return saved.filter(l => l && typeof l.id === "string" && typeof l.name === "string" && Array.isArray(l.words))
    .slice(0, MAX_LISTS)
    .map(l => ({
      id: l.id.slice(0, 40),
      name: l.name.slice(0, MAX_NAME),
      words: l.words.filter(w => typeof w === "string").slice(0, 100),
    }));
}

function saveOwn(lists) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lists));
  } catch {
    // Storage blocked (e.g. some private windows): lists last until the page is closed.
  }
}

let own = loadOwn();

export const quizLists = {
  // Built-in lists first, then the learner's. Words not in `available` are left out.
  all(available) {
    const keep = list => ({ ...list, words: list.words.filter(w => available.includes(w)) });
    return [
      ...DEFAULT_LISTS.map(l => ({ ...keep(l), builtIn: true })),
      ...own.map(l => ({ ...keep(l), builtIn: false })),
    ].filter(l => l.words.length > 0);
  },

  get(id, available) {
    return this.all(available).find(l => l.id === id) || null;
  },

  // Creates a new list (no id) or updates one of the learner's lists. Returns its id.
  save({ id, name, words }) {
    const clean = { name: name.trim().slice(0, MAX_NAME) || "My list", words: [...new Set(words)] };
    const existing = id && own.find(l => l.id === id);
    if (existing) {
      Object.assign(existing, clean);
    } else {
      id = `list-${Date.now().toString(36)}`;
      own.push({ id, ...clean });
    }
    saveOwn(own);
    return id;
  },

  remove(id) {
    own = own.filter(l => l.id !== id);
    saveOwn(own);
  },
};
