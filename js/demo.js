// Shows how to do a sign: a demonstration video if the word has one,
// otherwise a looping stick-figure animation of one of the word's example
// recordings (the most typical one, see build_signs.js).
//
// The figure faces you, like a teacher would: their right hand appears on your left.
// Only the main signing hand is recorded in the examples, so only that hand is drawn.

// Which hand points connect to which (MediaPipe's 21-point hand layout).
const HAND_LINES = [
  [0, 1], [1, 2], [2, 3], [3, 4],          // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],          // index finger
  [5, 9], [9, 10], [10, 11], [11, 12],     // middle finger
  [9, 13], [13, 14], [14, 15], [15, 16],   // ring finger
  [13, 17], [17, 18], [18, 19], [19, 20],  // little finger
  [0, 17],                                 // palm
];

// Body coordinates divide x by shoulder width and y by nose-to-shoulder height.
// On a real person that height is roughly half the shoulder width.
const NECK_TO_SHOULDER_RATIO = 0.5;
const FRAME_MS = 70;         // time per recorded frame
const PAUSE_MS = 800;        // pause at the end before repeating

// Starts the animation on the canvas. Returns a function that stops it.
export function playSignDemo(canvas, sequence) {
  const ctx = canvas.getContext("2d");
  const scale = canvas.width * 0.32;              // pixels per shoulder width
  const originX = canvas.width / 2, originY = canvas.height * 0.62;
  const toPixels = (x, y) => [originX + x * scale, originY + y * scale * NECK_TO_SHOULDER_RATIO];

  const style = getComputedStyle(canvas);
  const bodyColor = style.getPropertyValue("--demo-body").trim() || "#999";
  const handColor = style.getPropertyValue("--demo-hand").trim() || "#1a6";

  const playMs = FRAME_MS * (sequence.length - 1);
  const start = performance.now();
  let running = true;

  function drawBody() {
    const [noseX, noseY] = toPixels(0, -1);
    const [leftX, shoulderY] = toPixels(-0.5, 0);
    const [rightX] = toPixels(0.5, 0);
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(noseX, noseY, scale * 0.28, 0, Math.PI * 2);        // head
    ctx.moveTo(leftX, shoulderY); ctx.lineTo(rightX, shoulderY); // shoulders
    ctx.moveTo(leftX, shoulderY); ctx.lineTo(leftX - scale * 0.05, canvas.height);   // torso sides
    ctx.moveTo(rightX, shoulderY); ctx.lineTo(rightX + scale * 0.05, canvas.height);
    ctx.stroke();
  }

  function drawHand(hand) {
    const points = [];
    for (let i = 0; i < 21; i++) points.push(toPixels(hand[2 * i], hand[2 * i + 1]));
    ctx.strokeStyle = handColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const [a, b] of HAND_LINES) { ctx.moveTo(...points[a]); ctx.lineTo(...points[b]); }
    ctx.stroke();
    ctx.fillStyle = handColor;
    for (const [x, y] of points) ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
  }

  function frame(now) {
    if (!running) return;
    const elapsed = Math.max(0, now - start);  // the first frame's timestamp can be slightly before start
    const t = Math.min(elapsed % (playMs + PAUSE_MS), playMs) / FRAME_MS;
    const i = Math.min(Math.floor(t), sequence.length - 2);
    const blend = t - i;  // smooth between recorded frames
    const hand = sequence[i].map((v, k) => v + (sequence[i + 1][k] - v) * blend);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBody();
    drawHand(hand);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return () => { running = false; };
}

// Shows the word's video if it exists, otherwise the stick figure.
// Returns { stop, replay }.
export function showSignDemo({ video, canvas }, videoUrl, sequence) {
  let stopped = false, stopFigure = null;

  function useStickFigure() {
    if (stopped || stopFigure) return;
    video.pause();
    video.hidden = true;
    canvas.hidden = false;
    stopFigure = playSignDemo(canvas, sequence);
  }

  function useVideo() {
    if (stopped) return;
    canvas.hidden = true;
    video.hidden = false;
    video.onerror = useStickFigure;  // e.g. a format this browser can't play
    video.src = videoUrl;
    video.play().catch(() => {});   // muted videos are allowed to autoplay
  }

  // Check whether this word has a video before choosing what to show.
  video.hidden = canvas.hidden = true;
  fetch(videoUrl, { method: "HEAD" })
    .then(response => (response.ok ? useVideo() : useStickFigure()))
    .catch(useStickFigure);

  return {
    stop() {
      stopped = true;
      video.onerror = null;
      video.pause();
      if (stopFigure) stopFigure();
    },
    replay() {
      if (stopped) return;
      if (stopFigure) {
        stopFigure();
        stopFigure = playSignDemo(canvas, sequence);
      } else {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    },
  };
}
