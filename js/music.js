// Background music: loops assets/music.mp3 without a gap, fades in, pauses while the
// tab is hidden, and remembers whether the learner turned it off.
// Browsers only allow sound after a click, so start() must be called from one.

const URL = "assets/music.mp3";
const VOLUME = 0.35;        // background level, so it doesn't drown things out
const FADE_SECONDS = 1.5;
const KEY = "aslmasters-music";

let context = null, gain = null, source = null, buffer = null, loading = null;

function readPreference() {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}
function writePreference(on) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* not saved */ }
}

let enabled = readPreference();
const listeners = new Set();
const notify = () => listeners.forEach(fn => fn(enabled));

async function play() {
  if (!context) {
    context = new AudioContext();
    gain = context.createGain();
    gain.connect(context.destination);
    document.addEventListener("visibilitychange", () => {
      if (!enabled) return;
      if (document.hidden) context.suspend(); else context.resume();
    });
  }
  if (context.state === "suspended") await context.resume();
  loading ??= fetch(URL).then(r => r.arrayBuffer()).then(data => context.decodeAudioData(data));
  buffer = await loading;
  if (!enabled || source) return;
  source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);
  const now = context.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(VOLUME, now + FADE_SECONDS);
  source.start();
}

function stop() {
  if (!source) return;
  const old = source;
  source = null;
  const now = context.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + 0.4);
  old.stop(now + 0.45);
}

export const music = {
  get enabled() { return enabled; },
  onChange(fn) { listeners.add(fn); fn(enabled); },

  // Call from a click. Plays if the learner hasn't turned music off.
  start() {
    if (enabled) play().catch(err => console.warn("Music couldn't play:", err));
  },

  toggle() {
    enabled = !enabled;
    writePreference(enabled);
    if (enabled) this.start(); else stop();
    notify();
  },
};
