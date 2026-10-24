// All the settings you might want to change, in one place.

// How much grading favors the user. 1 = normal, higher = easier, lower = stricter.
// On signers the app has never seen, 1.25 passed 93% of correct signs (see README).
export const DEFAULT_LENIENCY = 1.25;

// Words that "Next word" can pick. Use [] to allow every word in signs/words.json.
// Grading always compares against every word, so this only changes what is asked.
export const PRACTICE_WORDS = ["thankyou", "sleep", "no"];

// Demonstration videos: videos/<word>.mp4. Words without a video show a stick figure.
export const VIDEO_FOLDER = "videos/";

export const COUNTDOWN_SECONDS = 3;
export const RECORD_SECONDS = 3;

// An attempt is rejected before grading if hands were visible in fewer than this
// fraction of frames, or the hand moved less than this many shoulder-widths.
export const MIN_HAND_VISIBLE = 0.25;
export const MIN_MOVEMENT = 0.05;
