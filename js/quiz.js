// One round of a quiz list: keeps cycling through the words the learner hasn't signed
// correctly yet, and is finished once every word has been signed correctly once.

function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Quiz {
  constructor(list) {
    this.list = list;
    this.words = [...list.words];
    this.correct = new Set();
    this.tries = Object.fromEntries(this.words.map(w => [w, 0]));
    this.queue = [];
    this.current = null;
  }

  get remaining() { return this.words.filter(w => !this.correct.has(w)); }
  get finished() { return this.correct.size === this.words.length; }

  // The next word to practise. Goes through the remaining words in a shuffled order,
  // then reshuffles, without repeating the word just shown (unless it's the only one left).
  next() {
    this.queue = this.queue.filter(w => !this.correct.has(w));
    if (!this.queue.length) {
      this.queue = shuffle(this.remaining);
      if (this.queue.length > 1 && this.queue[0] === this.current) this.queue.push(this.queue.shift());
    }
    this.current = this.queue.shift() ?? null;
    return this.current;
  }

  record(word, passed) {
    this.tries[word] = (this.tries[word] || 0) + 1;
    if (passed) this.correct.add(word);
  }
}
