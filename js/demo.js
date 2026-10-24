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

// Shows how to sign a word: its YouTube video if it has one, otherwise its own video file
// if it exists, otherwise the stick figure. Returns { stop, replay }.
export function showSignDemo({ youtube, video, canvas }, { youtubeVideo, videoUrl, sequence }) {
  let stopped = false, stopFigure = null, player = null;
  youtube.hidden = video.hidden = canvas.hidden = true;

  function useStickFigure() {
    if (stopped || stopFigure) return;
    video.pause();
    video.hidden = true;
    canvas.hidden = false;
    stopFigure = playSignDemo(canvas, sequence);
  }

  function useVideo() {
    if (stopped) return;
    video.hidden = false;
    video.onerror = useStickFigure;  // e.g. a format this browser can't play
    video.src = videoUrl;
    video.play().catch(() => {});   // muted videos are allowed to autoplay
  }

  if (youtubeVideo) {
    player = playYouTube(youtube, youtubeVideo);
  } else {
    // Check whether this word has a video file before choosing what to show.
    fetch(videoUrl, { method: "HEAD" })
      .then(response => (response.ok ? useVideo() : useStickFigure()))
      .catch(useStickFigure);
  }

  return {
    stop() {
      stopped = true;
      video.onerror = null;
      video.pause();
      if (stopFigure) stopFigure();
      if (player) player.stop();
    },
    replay() {
      if (stopped) return;
      if (player) {
        player.restart();
      } else if (stopFigure) {
        stopFigure();
        stopFigure = playSignDemo(canvas, sequence);
      } else {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    },
  };
}

// ---------- YouTube ----------
//
// Browsers sometimes skip a YouTube video's autoplay (for example while the page is busy
// starting the hand tracking), leaving it stuck on its thumbnail. So instead of just hoping
// it starts, the page talks to the player with postMessage (YouTube's embed API, no extra
// scripts needed): it asks the player to report its state, tells it to play until it says
// it is playing, and reloads it as a last resort.

const YOUTUBE_ORIGIN = "https://www.youtube-nocookie.com";
const PLAYING = 1, BUFFERING = 3;
const CHECK_EVERY_MS = 700;
const RELOAD_AFTER_CHECKS = 6;   // about 4 seconds without playing
const MAX_RELOADS = 2;

// Starts a YouTube video in the given iframe and keeps nudging it until it plays.
// Returns { stop, restart }.
function playYouTube(placeholder, entry) {
  const { start = 0 } = typeof entry === "string" ? {} : entry;
  let frame = placeholder, state = -1, ready = false, checks = 0, reloads = 0, timer = null;

  // A fresh iframe for each word, so switching words doesn't add entries to the browser's
  // back-button history (changing an iframe's address does).
  function load() {
    const fresh = frame.cloneNode(false);
    fresh.src = youtubeUrl(entry);
    fresh.hidden = false;
    fresh.addEventListener("load", () => { listen(); nudge(); });
    frame.replaceWith(fresh);
    frame = fresh;
    state = -1; ready = false; checks = 0;
  }

  function send(message) {
    frame.contentWindow?.postMessage(JSON.stringify({ ...message, id: 1, channel: "widget" }), YOUTUBE_ORIGIN);
  }
  const listen = () => send({ event: "listening" });
  const command = (func, args = []) => send({ event: "command", func, args });
  function nudge() {
    command("mute");
    command("playVideo");
  }

  function onMessage(event) {
    if (event.origin !== YOUTUBE_ORIGIN || event.source !== frame.contentWindow) return;
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (!data || typeof data !== "object") return;
    ready = true;  // the player is answering, so it can take commands
    if (data.event === "onReady") nudge();
    const reported = data.event === "onStateChange" ? data.info : data.info?.playerState;
    if (typeof reported === "number") state = reported;
  }

  function check() {
    if (state === PLAYING || state === BUFFERING) { checks = 0; return; }
    checks++;
    if (checks >= RELOAD_AFTER_CHECKS && reloads < MAX_RELOADS) {
      reloads++;
      load();
      return;
    }
    listen();
    nudge();
  }

  window.addEventListener("message", onMessage);
  load();
  timer = setInterval(check, CHECK_EVERY_MS);

  return {
    stop() {
      clearInterval(timer);
      window.removeEventListener("message", onMessage);
      frame.removeAttribute("src");  // stops the YouTube player
      frame.hidden = true;
    },
    restart() {
      reloads = 0;
      if (ready) {
        command("seekTo", [start, true]);
        nudge();
        checks = 0;
      } else {
        load();
      }
    },
  };
}

// YouTube's privacy-enhanced player: autoplays muted, loops, no controls or suggestions.
// enablejsapi lets the page tell it to play (see playYouTube).
function youtubeUrl(entry) {
  const { id, start, end } = typeof entry === "string" ? { id: entry } : entry;
  const params = new URLSearchParams({
    autoplay: "1", mute: "1", loop: "1", playlist: id, controls: "0", rel: "0",
    playsinline: "1", modestbranding: "1", iv_load_policy: "3", disablekb: "1",
    enablejsapi: "1",
  });
  if (location.origin.startsWith("http")) params.set("origin", location.origin);
  if (start) params.set("start", String(start));
  if (end) params.set("end", String(end));
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params}`;
}
