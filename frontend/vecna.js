/**
 * vecna.js — Vecna ghost appearances
 * No background overlay. Image floats in from screen edges/corners at random angles.
 * pointer-events: none — never blocks the UI.
 */
(function () {
  const css = `
    .vecna-ghost {
      position: fixed;
      z-index: 9999;
      pointer-events: none;
      opacity: 0;
      width: var(--vw, 280px);
      transition: opacity 0.25s ease;
      will-change: opacity;
    }

    .vecna-ghost.show { opacity: 1; }

    .vecna-ghost img {
      width: 100%;
      height: auto;
      display: block;
      filter:
        drop-shadow(0 0 18px rgba(200, 0, 20, 0.75))
        drop-shadow(0 0 55px rgba(130, 0, 10, 0.45))
        contrast(1.08) brightness(0.82);
    }

    @keyframes vecna-breathe {
      0%, 100% { filter:
        drop-shadow(0 0 18px rgba(200,0,20,0.75))
        drop-shadow(0 0 55px rgba(130,0,10,0.45))
        contrast(1.08) brightness(0.82); }
      50%       { filter:
        drop-shadow(0 0 30px rgba(220,0,25,0.95))
        drop-shadow(0 0 80px rgba(160,0,15,0.6))
        contrast(1.12) brightness(0.9); }
    }

    .vecna-ghost.show img {
      animation: vecna-breathe 1.8s ease-in-out infinite;
    }

    @keyframes vecna-screen-flash {
      0%,100% { background: transparent; }
      30%      { background: rgba(80,0,5,0.18); }
    }
    body.vecna-flash::after {
      content: "";
      position: fixed;
      inset: 0;
      z-index: 9998;
      pointer-events: none;
      animation: vecna-screen-flash 0.5s ease forwards;
    }
  `;
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /**
   * Each spawn defines:
   *  pos   — CSS position props applied to the wrapper div
   *  rot   — CSS transform on the <img> (rotate + optional flip)
   *  size  — width of the wrapper (vw units to be responsive)
   */
  const spawns = [
    // ── corners ──────────────────────────────────────────
    // bottom-left, leaning inward
    { pos: { bottom: "-3%", left: "-4%" },       rot: "rotate(10deg)",              size: "clamp(160px,22vw,300px)" },
    // bottom-right, leaning inward
    { pos: { bottom: "-3%", right: "-4%" },       rot: "rotate(-10deg)",             size: "clamp(160px,22vw,300px)" },
    // top-left, upside-down
    { pos: { top: "-3%",  left: "-4%" },          rot: "rotate(-8deg) scaleY(-1)",   size: "clamp(140px,20vw,280px)" },
    // top-right, upside-down
    { pos: { top: "-3%",  right: "-4%" },         rot: "rotate(8deg)  scaleY(-1)",   size: "clamp(140px,20vw,280px)" },

    // ── edges ─────────────────────────────────────────────
    // left side, mid-height
    { pos: { top: "28%", left: "-12%" },          rot: "rotate(-6deg)",              size: "clamp(150px,20vw,270px)" },
    // right side, mid-height
    { pos: { top: "28%", right: "-12%" },         rot: "rotate(6deg)",               size: "clamp(150px,20vw,270px)" },
    // bottom centre-left
    { pos: { bottom: "-4%", left: "8%" },         rot: "rotate(-14deg)",             size: "clamp(130px,18vw,250px)" },
    // bottom centre-right
    { pos: { bottom: "-4%", right: "8%" },        rot: "rotate(14deg)",              size: "clamp(130px,18vw,250px)" },
    // left side, lower
    { pos: { top: "55%", left: "-15%" },          rot: "rotate(-3deg)",              size: "clamp(140px,19vw,260px)" },
    // right side, lower
    { pos: { top: "55%", right: "-15%" },         rot: "rotate(3deg)",               size: "clamp(140px,19vw,260px)" },
    // bottom-left, steep angle
    { pos: { bottom: "-2%", left: "-2%" },        rot: "rotate(22deg)",              size: "clamp(120px,16vw,220px)" },
    // bottom-right, steep angle
    { pos: { bottom: "-2%", right: "-2%" },       rot: "rotate(-22deg)",             size: "clamp(120px,16vw,220px)" },
  ];

  let current = null;
  let autoHide;

  function show() {
    if (current) { current.remove(); current = null; }

    const spawn = spawns[Math.floor(Math.random() * spawns.length)];

    // brief red flash on the screen
    document.body.classList.add("vecna-flash");
    setTimeout(() => document.body.classList.remove("vecna-flash"), 600);

    const el = document.createElement("div");
    el.className = "vecna-ghost";
    el.style.setProperty("--vw", spawn.size);

    // apply position
    Object.entries(spawn.pos).forEach(([k, v]) => (el.style[k] = v));

    el.innerHTML = `<img src="/static/vecna.png" alt=""
      style="transform:${spawn.rot};transform-origin:center bottom;" />`;

    document.body.appendChild(el);
    // force reflow
    el.getBoundingClientRect();
    el.classList.add("show");

    current = el;
    clearTimeout(autoHide);
    autoHide = setTimeout(hide, 2600 + Math.random() * 1200);
  }

  function hide() {
    if (!current) return;
    current.classList.remove("show");
    const old = current;
    current = null;
    setTimeout(() => old.remove(), 350);
    scheduleNext();
  }

  function scheduleNext() {
    // reappear after 25–65 seconds
    setTimeout(show, 25000 + Math.random() * 40000);
  }

  // first appearance: 7–14 s after load
  setTimeout(show, 7000 + Math.random() * 7000);
})();
