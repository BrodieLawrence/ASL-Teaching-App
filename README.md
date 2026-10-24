# ASL Sign Check

A web app for practicing American Sign Language. It shows a word, you sign it to
your webcam, and it tells you whether you signed it correctly.

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
   your attempt is close enough to its examples. The *leniency* setting
   controls how forgiving both rules are.

## Showing the sign

Each word shows a looping stick-figure animation of its most typical example
recording (the one closest on average to all the others). It is drawn facing
the learner and shows only the main signing hand.

## Accuracy

Tested on recordings from 3 signers whose recordings are not in the examples
(`node tools/evaluate.js`, 60 recordings, 10 words):

| Leniency | Correct sign passes | A different sign passes |
|---|---|---|
| 0.75 | 67% | 14% |
| 1.0 | 77% | 19% |
| **1.25 (default)** | **87%** | **30%** |
| 2.0 | 92% | 42% |

The default favors the learner: it is better to occasionally accept a sloppy
sign than to frustrate someone who signed correctly.

## Project layout

```
index.html, style.css   the page
js/
  settings.js           all adjustable settings (leniency, practice words, timings)
  tracking.js           webcam + MediaPipe tracking
  recorder.js           countdown, recording, conversion to body coordinates
  grader.js             compares an attempt with the examples
  signs.js              loads the example files
  demo.js               stick-figure animation showing how to do each sign
  app.js                connects the page together
signs/
  words.json            list of words and the grading distance limit
  <word>.json           example recordings for one word
tools/
  word_list.txt         which words to build
  download_dataset.py   downloads example recordings from Kaggle
  build_signs.js        turns them into signs/*.json
  evaluate.js           accuracy test (table above)
  pipeline.js           shared helpers; uses the same code as the page
```

## Adding words

1. Add the word to `tools/word_list.txt` (it must be one of the dataset's 250 words).
2. `python3 tools/download_dataset.py` (needs `pip install pyarrow` and Kaggle access, see the script)
3. `node tools/build_signs.js`
4. `node tools/evaluate.js` to check accuracy

## Data

Example recordings come from the
[Google - Isolated Sign Language Recognition](https://www.kaggle.com/competitions/asl-signs)
dataset on Kaggle: hand and body tracking points (not video) of 21 signers.

## Limitations

- Only the main signing hand is graded; the second hand and facial
  expressions are not checked.
- The examples were recorded on phones; laptop webcams may score slightly differently.
