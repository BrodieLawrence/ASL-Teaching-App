// Quiz lists: the built-in ones from settings.js plus the learner's own, saved in this
// browser only (no accounts). Built-in lists can't be changed or deleted, but can be copied.

import { DEFAULT_LISTS } from "./settings.js";

const KEY = "aslmasters-lists";

function loadOwn() {
  try {
    const lists = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(lists) ? lists.filter(l => l && l.id && Array.isArray(l.words)) : [];
  } catch {
    return [];
  }
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
    const clean = { name: name.trim() || "My list", words: [...new Set(words)] };
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
