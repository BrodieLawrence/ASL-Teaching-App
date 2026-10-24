// Webcam + MediaPipe hand and body tracking.
// Produces one raw frame per video frame (see recorder.js for the format)
// and draws the tracked points over the video.

import { FilesetResolver, HandLandmarker, PoseLandmarker }
  from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const POSE_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// MediaPipe pose point numbers
const NOSE = 0, LEFT_SHOULDER = 11, RIGHT_SHOULDER = 12, LEFT_WRIST = 15, RIGHT_WRIST = 16;

export async function startTracking(video, canvas) {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const hands = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: HAND_MODEL, delegate: "GPU" }, runningMode: "VIDEO", numHands: 2,
  });
  const pose = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" }, runningMode: "VIDEO", numPoses: 1,
  });

  video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
  await new Promise(resolve => (video.onloadeddata = resolve));
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const listeners = new Set();
  const tracker = {
    recording: false,  // only changes the dot colour
    onFrame(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };

  let lastPose = null, lastTime = -1;
  function loop() {
    const now = performance.now();
    if (video.readyState >= 2 && now > lastTime) {
      lastTime = now;
      const handResult = hands.detectForVideo(video, now);
      const poseResult = pose.detectForVideo(video, now);
      if (poseResult.landmarks?.[0]) lastPose = poseResult.landmarks[0];
      draw(canvas, handResult.landmarks, lastPose, tracker.recording);
      const frame = makeFrame(handResult.landmarks, lastPose);
      listeners.forEach(fn => fn(frame));
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  return tracker;
}

// Decide which detected hand is the person's left and which is their right,
// by which pose wrist each hand is closest to.
function makeFrame(handList, posePoints) {
  const frame = {
    L: null, R: null,
    pose: posePoints && [NOSE, LEFT_SHOULDER, RIGHT_SHOULDER].map(i => [posePoints[i].x, posePoints[i].y]),
  };
  if (!handList?.length) return frame;
  const flat = hand => hand.flatMap(p => [p.x, p.y]);
  if (!posePoints) { frame.R = flat(handList[0]); return frame; }

  const dist = (hand, wrist) => Math.hypot(hand[0].x - posePoints[wrist].x, hand[0].y - posePoints[wrist].y);
  if (handList.length === 1) {
    const hand = handList[0];
    if (dist(hand, LEFT_WRIST) < dist(hand, RIGHT_WRIST)) frame.L = flat(hand); else frame.R = flat(hand);
  } else {
    const [a, b] = handList;
    const aIsLeft = dist(a, LEFT_WRIST) + dist(b, RIGHT_WRIST) <= dist(a, RIGHT_WRIST) + dist(b, LEFT_WRIST);
    frame.L = flat(aIsLeft ? a : b);
    frame.R = flat(aIsLeft ? b : a);
  }
  return frame;
}

function draw(canvas, handList, posePoints, recording) {
  const ctx = canvas.getContext("2d");
  const dot = (p, size) => ctx.fillRect(p.x * canvas.width - size / 2, p.y * canvas.height - size / 2, size, size);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = recording ? "red" : "lime";
  for (const hand of handList || []) hand.forEach(p => dot(p, 5));
  if (posePoints) {
    ctx.fillStyle = "cyan";
    [NOSE, LEFT_SHOULDER, RIGHT_SHOULDER].forEach(i => dot(posePoints[i], 9));
  }
}
