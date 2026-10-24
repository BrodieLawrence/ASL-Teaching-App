// All the settings you might want to change, in one place.

// Difficulty levels and how forgiving grading is at each ("leniency": 1 = normal,
// higher = easier). Pass rates for correct signs on unseen signers are in the README.
export const DIFFICULTIES = {
  easy: { label: "Easy", leniency: 2.0 },
  normal: { label: "Normal", leniency: 1.25 },
  hard: { label: "Hard", leniency: 0.7 },
};
export const DEFAULT_DIFFICULTY = "normal";

// Words that "Next word" can pick. Use [] to allow every word in signs/words.json.
// Grading always compares against every word, so this only changes what is asked.
export const PRACTICE_WORDS = ["thankyou", "sleep", "no"];

// How words are shown to learners. The dataset writes some words without spaces.
export const WORD_LABELS = {
  thankyou: "thank you", callonphone: "call on phone", frenchfries: "french fries",
  glasswindow: "glass window", haveto: "have to", hesheit: "he / she / it", icecream: "ice cream",
  minemy: "mine / my", weus: "we / us", owie: "owie", shhh: "shhh",
};

// Demonstration videos: videos/<word>.mp4. Words without a video show a stick figure.
export const VIDEO_FOLDER = "videos/";

export const COUNTDOWN_SECONDS = 3;
export const RECORD_SECONDS = 3;

// An attempt is rejected before grading if hands were visible in fewer than this
// fraction of frames, or the hand moved less than this many shoulder-widths.
export const MIN_HAND_VISIBLE = 0.25;
export const MIN_MOVEMENT = 0.05;
