/**
 * bats.js — bat swarm that trails the mouse pointer
 * Bats follow with a staggered delay, sine-wave flight wobble,
 * and flip direction when the mouse reverses.
 */
(function () {
  /* ── styles ── */
  const style = document.createElement("style");
  style.textContent = `
    /* hide the default cursor site-wide */
    * { cursor: none !important; }

    /* custom crosshair cursor dot */
    #bat-cursor-dot {
      position: fixed;
      top: 0; left: 0;
      width: 6px; height: 6px;
      background: rgba(200, 10, 30, 0.9);
      border-radius: 50%;
      pointer-events: none;
      z-index: 99999;
      box-shadow: 0 0 6px rgba(200,10,30,0.7);
      transform: translate(-50%, -50%);
      will-change: transform;
    }

    .bat-trail {
      position: fixed;
      top: 0; left: 0;
      pointer-events: none;
      z-index: 99997;
      will-change: transform;
      transform: translate(-9999px, -9999px);
    }

    .bat-trail svg {
      display: block;
      /* wing flap: scaleY oscillates to simulate flapping */
      transform-origin: center 60%;
      animation: bat-flap var(--flap-dur, 0.22s) var(--flap-off, 0s) ease-in-out infinite;
    }

    @keyframes bat-flap {
      0%, 100% { transform: scaleY(1)   scaleX(var(--dir,1)); }
      45%       { transform: scaleY(0.3) scaleX(var(--dir,1)); }
    }
  `;
  document.head.appendChild(style);

  /* ── cursor dot ── */
  const dot = document.createElement("div");
  dot.id = "bat-cursor-dot";
  document.body.appendChild(dot);

  /* ── bat SVG factory ── */
  function makeBatSVG(size) {
    // viewBox 100×48 — wings + body + ears
    return `<svg xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 48" width="${size}" height="${Math.round(size * 0.48)}">
      <path fill="#cc0018" d="
        M50,18
        C46,13 37,10 27,12 C17,14 5,19 0,24
        C9,21 20,20 27,22 C34,24 40,27 44,28
        L44,28 C44,33 46,40 50,42
        C54,40 56,33 56,28
        C60,27 66,24 73,22 C80,20 91,21 100,24
        C95,19 83,14 73,12 C63,10 54,13 50,18 Z
        M42,17 L38,7  L46,16 Z
        M58,17 L62,7  L54,16 Z
      "/>
    </svg>`;
  }

  /* ── bat configuration ── */
  const COUNT  = 7;   // number of bats in the trail
  const LAG    = 9;   // history frames between each bat
  const MAX_H  = COUNT * LAG + 10;

  const history = [];  // { x, y } ring-buffer of mouse positions
  let mx = -999, my = -999;

  document.addEventListener("mousemove", (e) => {
    mx = e.clientX;
    my = e.clientY;
  });

  /* ── create bats ── */
  const bats = Array.from({ length: COUNT }, (_, i) => {
    const el = document.createElement("div");
    el.className = "bat-trail";
    // bats get slightly smaller towards the tail
    const size = Math.round(34 - i * 3);
    el.innerHTML = makeBatSVG(Math.max(size, 16));
    el.style.setProperty("--flap-dur", `${0.18 + i * 0.025}s`);
    el.style.setProperty("--flap-off", `${i * 0.04}s`);
    el.style.setProperty("--dir", "1");
    document.body.appendChild(el);

    return {
      el,
      svg: el.querySelector("svg"),
      wobble: Math.random() * Math.PI * 2,       // phase offset
      wSpeed: 0.10 + Math.random() * 0.06,        // wobble speed
      wAmpY:  4   + Math.random() * 4,            // vertical wobble amplitude
      wAmpX:  2   + Math.random() * 2,            // horizontal wobble amplitude
    };
  });

  /* ── animation loop ── */
  let lastDir = 1;

  function tick() {
    // push current mouse into history
    history.push({ x: mx, y: my });
    if (history.length > MAX_H) history.shift();

    // update cursor dot
    dot.style.transform = `translate(${mx - 3}px, ${my - 3}px)`;

    bats.forEach((bat, i) => {
      const hi = Math.max(0, history.length - 1 - i * LAG);
      const pos = history[hi] || { x: -999, y: -999 };

      bat.wobble += bat.wSpeed;
      const wy = Math.sin(bat.wobble) * bat.wAmpY;
      const wx = Math.cos(bat.wobble * 0.6) * bat.wAmpX;

      const halfW = 17 - i * 1.5;   // half of bat width for centering
      const halfH = 8  - i * 0.7;

      const x = pos.x + wx - halfW;
      const y = pos.y + wy - halfH;
      bat.el.style.transform = `translate(${x}px, ${y}px)`;

      // flip SVG based on horizontal movement direction
      if (history.length > 2) {
        const prev = history[Math.max(0, hi - 3)];
        const dx = pos.x - prev.x;
        if (dx < -0.5)       bat.el.style.setProperty("--dir", "-1");
        else if (dx > 0.5)   bat.el.style.setProperty("--dir", "1");
      }
    });

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();
