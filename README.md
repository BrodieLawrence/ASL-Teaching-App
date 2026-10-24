# ASL Masters (Wacode 2026 team project)

- **Team name:** [TEAM NAME]
- **Team members:** [NAMES]
- **Live demo:** https://aslmasters.com (served by GitHub Pages from the public
  repository [BrodieLawrence/ASL-Teaching-App](https://github.com/BrodieLawrence/ASL-Teaching-App),
  an identical copy of this code, because this repository is private)

## Disclosures

- **AI-generated work:** most of the code, tools and documentation were written with
  Claude Code (Anthropic's AI coding assistant), directed and tested by the team. The
  full commit history shows how the project was built.
- **Outside code:** MediaPipe Tasks Vision 0.10.14 and its hand/pose models (Google,
  Apache 2.0), hosted in `vendor/mediapipe`; Phosphor Icons (MIT, `assets/icons.svg`);
  Fredoka and Nunito fonts (SIL Open Font License, `assets/fonts`).
- **Outside data:** example sign recordings (hand and body tracking points, not video)
  come from the Kaggle competition "Google - Isolated Sign Language Recognition"
  (https://www.kaggle.com/competitions/asl-signs).
- **Music:** [SOURCE AND LICENCE OF assets/music.mp3]
- **Simulated or placeholder parts:** demonstration videos for "sleep" (and the unused
  "no" / "thank you") are placeholder recordings by a team member; the other words show
  a stick-figure animation drawn from the dataset until real videos are recorded.
  Accuracy figures below come from dataset recordings of people the app has not seen,
  not from live webcam use.

## Security and data

No secrets, keys or personal data are stored in this repository. The app has no
server or accounts; camera video and tracking data never leave the user's browser
(details under "Privacy and security" below).

---

A web app for ASL students to practice vocabulary alongside their classes. It
shows a word and a video of the sign, you sign it to your webcam, and it tells
you whether you got it right, or which sign it looked like instead.

Live at https://aslmasters.com.

Everything runs in the browser. The video never leaves your computer.

## Running it

The page loads several files, so it needs to be served rather than opened by
double-clicking:

```
python3 -m http.server 8000
```

Then open http://localhost:8000 in Chrome and allow camera access.
(It is also set up to work as-is on GitHub Pages.)

## How it works

1. **Tracking.** [MediaPipe](https://ai.google.dev/edge/mediapipe) finds 21
   points on each hand, plus the nose and shoulders, in every webcam frame.
2. **Body coordinates.** Positions are measured from the middle of the shoulders
   and scaled by body size, so it doesn't matter where you stand or how close
   you are to the camera.
3. **Main hand.** The app follows your main signing hand, mirrors left-handed
   signing to match right-handed examples, and fills in frames where the
   tracker briefly lost the hand.
4. **Comparison.** Your attempt is compared with about 35 example recordings of
   every word using dynamic time warping, which lines up two movements even if
   one is done faster. Both hand position and handshape count.
5. **Grading.** You pass if the target word is among your closest matches **and**
   your attempt is close enough to its examples. The difficulty setting
   (Easy / Normal / Hard) sets how forgiving both rules are ("leniency", see
   `js/settings.js`).

## Showing the sign

If `videos/<word>.mp4` exists, the page plays it on a loop. Add one with
`tools/add_video.sh my-video.mov sleep` (converts any phone video; needs ffmpeg).

Words without a video show a looping stick-figure animation of their most
typical example recording (the one closest on average to all the others),
drawn facing the learner, showing only the main signing hand.

## Accuracy

The 20 words were chosen with `tools/choose_words.js`: from a shortlist of 53 beginner
words, it kept the 20 the grader tells apart best (keeping hello, please, mom and
sleep). Testing each recording only against other people's examples, the closest
word was correct 72% of the time and in the closest 3 86% of the time.

Grading test (`node tools/evaluate.js`): recordings from 3 signers whose recordings
are not used as examples. So far these test recordings cover 4 of the 20 words
(80 recordings; the rest are still being downloaded), with 19 examples per word:

| Difficulty (leniency) | Correct sign passes | A different sign passes |
|---|---|---|
| Hard (0.7) | 50% | 5% |
| **Normal (1.25, default)** | **75%** | **15%** |
| Easy (2.0) | 84% | 20% |

This is a small test, so treat the numbers as rough (±10%), and they come from
dataset recordings rather than live webcam use.

The default favours the learner: it is better to occasionally accept a sloppy
sign than to frustrate someone who signed correctly.

## Changing the look

- **Colours:** the six colours at the top of `style.css` (`--page`, `--surface`,
  `--primary`, `--secondary`, `--accent`, `--highlight`). Text colours are
  worked out from them automatically.
- **Fonts:** `--font-display` (headings, buttons) and `--font-body` in
  `style.css`; the font files are in `assets/fonts` (SIL Open Font License).
- **Icons:** [Phosphor](https://phosphoricons.com) duotone icons in
  `assets/icons.svg` (MIT licence, `assets/LICENSE-phosphor.txt`).

## Project layout

```
index.html, style.css   the page (welcome screen and practice screen)
assets/                 icons, favicon
js/
  settings.js           all adjustable settings (difficulty levels, practice words, timings)
  tracking.js           webcam + MediaPipe tracking
  recorder.js           recording, conversion to body coordinates
  grader.js             compares an attempt with the examples
  signs.js              loads the example files
  demo.js               demonstration video or stick-figure animation for each sign
  progress.js           streak and words learned, saved in the browser
  app.js                connects the page together
videos/
  <word>.mp4            demonstration video for one word (optional)
signs/
  words.json            list of words and the grading distance limit
  <word>.json           example recordings for one word
tools/
  word_list.txt         which words to build
  add_video.sh          converts a video into videos/<word>.mp4
  download_dataset.py   downloads example recordings from Kaggle
  build_signs.js        turns them into signs/*.json
  evaluate.js           accuracy test (table above)
  evaluate_attempts.js  re-grades attempts saved from the page (see Testing with real attempts)
  pipeline.js           shared helpers; uses the same code as the page
```

## Adding words

1. Add the word to `tools/word_list.txt` (it must be one of the dataset's 250 words).
2. `python3 tools/download_dataset.py` (needs `pip install pyarrow` and Kaggle access, see the script)
3. `node tools/build_signs.js`
4. `node tools/evaluate.js` to check accuracy

## Testing with real attempts

Open the page with `?debug` at the end of the address (e.g.
`http://localhost:8000/?debug`). The debug bar also has a leniency box that overrides the difficulty buttons.
After each attempt, tick **I signed it wrong on
purpose** if that's the case, then click **Save last attempt**. This downloads
the tracked points of the attempt (numbers only, no video). Re-grade a folder
of saved attempts with:

```
node tools/evaluate_attempts.js path/to/attempts
```

## Privacy and security

- **No server, no accounts.** The site is static files on GitHub Pages; everything runs
  in the browser.
- **Nothing leaves the device.** Camera video and the tracked hand points are only used
  in the browser's memory to grade the attempt. The page never uploads anything; the
  only network requests are for its own files.
- **No third-party code or services at run time.** MediaPipe's tracking code and models
  (`vendor/mediapipe`, with checksums in its README) and the fonts (`assets/fonts`) are
  hosted with the site.
- **Content Security Policy** (in `index.html`): the page may only load from and connect
  to its own site.
- **Saved data** (streak, words learned, settings, quiz lists) stays in the browser's
  local storage and is checked when read.

## Data

Example recordings come from the
[Google - Isolated Sign Language Recognition](https://www.kaggle.com/competitions/asl-signs)
dataset on Kaggle: hand and body tracking points (not video) of 21 signers.

## Limitations

- Only the main signing hand is graded; the second hand and facial
  expressions are not checked.
- The examples were recorded on phones; laptop webcams may score slightly differently.
