// All the settings you might want to change, in one place.

// Difficulty levels and how forgiving grading is at each ("leniency": 1 = normal,
// higher = easier). Pass rates for correct signs on unseen signers are in the README.
export const DIFFICULTIES = {
  easy: { label: "Easy", leniency: 2.0 },
  normal: { label: "Normal", leniency: 1.25 },
  hard: { label: "Hard", leniency: 0.7 },
};
export const DEFAULT_DIFFICULTY = "normal";

// Built-in quiz lists (learners can also make their own, see lists.js).
// Words not in signs/words.json are skipped. Grading always compares against every word.
export const DEFAULT_LISTS = [
  { id: "basics", name: "Everyday basics", words: ["hello", "please", "yes", "water", "hungry", "sleep"] },
  { id: "family", name: "Family & feelings", words: ["mom", "dad", "girl", "happy", "hungry"] },
  { id: "animals", name: "Animals", words: ["cow", "horse", "bird"] },
  { id: "outdoors", name: "Out and about", words: ["tree", "moon", "car", "airplane", "hat", "hot"] },
  { id: "home", name: "At home", words: ["bath", "sleep", "water", "hot", "hat"] },
  { id: "all", name: "All 20 words", words: ["hello", "please", "mom", "dad", "yes", "sleep", "water", "hungry", "hot", "happy",
    "cow", "bird", "horse", "tree", "airplane", "car", "girl", "hat", "moon", "bath"] },
];

// How words are shown to learners. The dataset writes some words without spaces.
export const WORD_LABELS = {
  thankyou: "thank you", callonphone: "call on phone", frenchfries: "french fries",
  glasswindow: "glass window", haveto: "have to", hesheit: "he / she / it", icecream: "ice cream",
  minemy: "mine / my", weus: "we / us", owie: "owie", shhh: "shhh",
};

// Demonstration videos from YouTube, shown first when a word has one: word -> video id
// (the part after "v=" in the link), or { id, start, end } in seconds to play only part.
// Current videos are from ASL University's "Signs" channel (youtube.com/@aslu).
export const YOUTUBE_VIDEOS = {
  sleep: "dXEqaWSEztY",
};

// Demonstration videos: videos/<word>.mp4. Words without a video show a stick figure.
export const VIDEO_FOLDER = "videos/";

export const COUNTDOWN_SECONDS = 3;
export const RECORD_SECONDS = 3;

// An attempt is rejected before grading if hands were visible in fewer than this
// fraction of frames, or the hand moved less than this many shoulder-widths.
export const MIN_HAND_VISIBLE = 0.25;
export const MIN_MOVEMENT = 0.05;
