// A short confetti fountain: pieces shoot up from the bottom middle of an element,
// spread out over the whole screen, tumble and fall. Used when the learner signs a word correctly.
// Colours come from the palette in style.css. Skipped for people who prefer less motion.

const DURATION_MS = 2400;   // whole effect
const EMIT_MS = 700;        // how long new pieces keep shooting out
const PIECES = 140;
const GRAVITY = 1400;       // pixels per second per second

export function confettiFountain(source) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // The canvas covers the whole window; the fountain starts at the bottom middle of `source`.
  const canvas = document.createElement("canvas");
  canvas.className = "confetti";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const width = window.innerWidth, height = window.innerHeight;
  const box = source.getBoundingClientRect();
  const originX = box.left + box.width / 2, originY = box.bottom;
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  const style = getComputedStyle(document.documentElement);
  const colors = ["--accent", "--highlight", "--primary", "--secondary"]
    .map(name => style.getPropertyValue(name).trim()).filter(Boolean);

  // Each piece gets a launch time, so they stream out like a fountain rather than all at once.
  const pieces = Array.from({ length: PIECES }, (_, i) => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;   // upwards, spreading up to ±40°
    const speed = box.height * (1.8 + Math.random() * 1.0);
    return {
      launch: (i / PIECES) * EMIT_MS,
      x: originX + (Math.random() - 0.5) * 30,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: (Math.random() - 0.5) * 14,
      size: 6 + Math.random() * 6,
      color: colors[i % colors.length],
    };
  });

  // Positions are worked out from the time since launch, so the effect looks the same
  // whatever the frame rate (a slow computer just shows fewer frames).
  const start = performance.now();
  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, width, height);
    // Fade everything out over the last half second.
    ctx.globalAlpha = Math.max(0, Math.min(1, (DURATION_MS - elapsed) / 500));
    for (const p of pieces) {
      if (elapsed < p.launch) continue;
      const t = (elapsed - p.launch) / 1000;
      const x = p.x + p.vx * t;
      const y = p.y + p.vy * t + 0.5 * GRAVITY * t * t;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.spin * t);
      ctx.scale(1, Math.cos(p.spin * t * 0.7));   // flips over as it tumbles
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (elapsed < DURATION_MS) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
