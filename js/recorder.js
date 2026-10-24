// Records an attempt and converts it to body coordinates.
//
// Raw frames (from tracking.js) are in camera coordinates (0..1 across the image):
//   { L, R: 42 numbers or null, pose: [[noseX, noseY], [leftShoulderX, Y], [rightShoulderX, Y]] or null }
// Body coordinates put the origin between the shoulders, divide x by shoulder
// width and y by the nose-to-shoulder height. This makes signs comparable no
// matter where the person stands, how close they are, or the camera's shape.

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

// Returns frames as {L, R} in body coordinates, or null if the body wasn't visible.
export function toBodyCoordinates(rawFrames) {
  const poses = rawFrames.map(f => f.pose).filter(Boolean);
  if (!poses.length) return null;
  const [NOSE, LEFT_SHOULDER, RIGHT_SHOULDER] = [0, 1, 2];
  const centerX = median(poses.map(p => (p[LEFT_SHOULDER][0] + p[RIGHT_SHOULDER][0]) / 2));
  const centerY = median(poses.map(p => (p[LEFT_SHOULDER][1] + p[RIGHT_SHOULDER][1]) / 2));
  const shoulderWidth = median(poses.map(p => Math.abs(p[LEFT_SHOULDER][0] - p[RIGHT_SHOULDER][0])));
  const neckHeight = median(poses.map(p => (p[LEFT_SHOULDER][1] + p[RIGHT_SHOULDER][1]) / 2 - p[NOSE][1]));
  if (!(shoulderWidth > 0.01 && neckHeight > 0.01)) return null;

  const convert = hand => hand && hand.map((v, i) =>
    i % 2 === 0 ? (v - centerX) / shoulderWidth : (v - centerY) / neckHeight);
  return rawFrames.map(f => ({ L: convert(f.L), R: convert(f.R) }));
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Counts down, then collects raw frames from the tracker for recordSeconds.
export async function recordAttempt(tracker, { countdownSeconds, recordSeconds, onStatus }) {
  for (let i = countdownSeconds; i > 0; i--) {
    onStatus(`Get ready... ${i}`);
    await wait(1000);
  }
  onStatus("SIGN NOW!");
  const frames = [];
  const stop = tracker.onFrame(frame => frames.push(frame));
  tracker.recording = true;
  await wait(recordSeconds * 1000);
  tracker.recording = false;
  stop();
  return frames;
}
