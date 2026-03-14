/**
 * leaves.js
 * Injects an upside-down tree in the top-left corner
 * with continuously falling red leaves.
 */
(function () {

  /* ── styles ─────────────────────────────────────────── */
  const style = document.createElement("style");
  style.textContent = `

    /* ── Upside-down tree ── */
    .st-tree {
      position: fixed;
      top: -12%;
      left: 0;
      width: clamp(200px, 22vw, 340px);
      pointer-events: none;
      /* must sit above the black upside-trees SVG overlay (z-index 150) */
      z-index: 160;
      /*
        scaleY(-1) with DEFAULT transform-origin (center center):
        - The element box stays at top:0 and occupies normal space
        - The image content is flipped in place — trunk now at the top,
          branches hang downward into the screen. Stays fully visible.
        Using transform-origin:top would push it ABOVE the viewport.
      */
      transform: scaleY(-1);
      filter:
        brightness(0.8)
        contrast(1.2)
        sepia(0.3)
        hue-rotate(-8deg)
        drop-shadow(8px 0 30px rgba(180, 0, 10, 0.8))
        drop-shadow(0 12px 45px rgba(120, 0, 5, 0.6));
      opacity: 0.95;
    }

    /* ── Leaf keyframes ── */
    @keyframes leaf-fall {
      0% {
        transform: translate(0px, 0px) rotate(0deg) scale(1);
        opacity: 0;
      }
      6% { opacity: 0.95; }

      /* sway left */
      28% {
        transform:
          translate(var(--wx1), 28vh)
          rotate(var(--r1))
          scale(0.93);
        opacity: 0.9;
      }

      /* sway right */
      58% {
        transform:
          translate(var(--wx2), 60vh)
          rotate(var(--r2))
          scale(0.85);
        opacity: 0.7;
      }

      /* drift further */
      85% {
        transform:
          translate(var(--wx3), 88vh)
          rotate(var(--r3))
          scale(0.78);
        opacity: 0.35;
      }

      100% {
        transform:
          translate(var(--wx3), 108vh)
          rotate(var(--r3))
          scale(0.7);
        opacity: 0;
      }
    }

    /* ── Individual leaf ── */
    .st-leaf {
      position: fixed;
      pointer-events: none;
      z-index: 161;
      opacity: 0;
      /* leaf silhouette */
      border-radius: 50% 4% 50% 4%;
      box-shadow:
        0 0 4px rgba(180, 0, 10, 0.55),
        inset 0 0 3px rgba(255, 0, 20, 0.2);
      animation: leaf-fall var(--ld) var(--del) ease-in forwards;
      will-change: transform, opacity;
    }
  `;
  document.head.appendChild(style);

  /* ── create the tree ─────────────────────────────────── */
  const tree = document.createElement("img");
  tree.className = "st-tree";
  tree.src = "/static/tree.png";
  tree.alt = "";
  document.body.appendChild(tree);

  /* ── leaf colours ────────────────────────────────────── */
  const COLORS = [
    "#7a0008", "#a0000f", "#cc0018",
    "#8b0000", "#5c0005", "#b50015",
    "#900010", "#d4001c",
  ];

  /* ── spawn a single leaf ─────────────────────────────── */
  function spawnLeaf() {
    const el = document.createElement("div");
    el.className = "st-leaf";

    // tree covers roughly this much of the viewport
    const treeW = Math.min(340, window.innerWidth * 0.22);

    // spawn from the branch region — tree is pushed up by ~12% of viewport
    // so visible branches start near y=0 and spread downward ~120px
    const sx = -5 + Math.random() * (treeW + 10);
    const sy = 5 + Math.random() * 120;

    const w  = 8  + Math.random() * 13;           // width  8–21 px
    const h  = w  * (0.55 + Math.random() * 0.3); // height slightly smaller
    const dur  = 4.5 + Math.random() * 6.5;       // fall duration 4.5–11 s
    const del  = Math.random() * 0.6;             // stagger delay

    // three wind-drift waypoints (px) — create organic S-curve path
    const wx1 = (Math.random() - 0.45) * 80;
    const wx2 = wx1 + (Math.random() - 0.4) * 90;
    const wx3 = wx2 + (Math.random() - 0.35) * 70;

    // rotation at each waypoint
    const r1 = 80  + Math.random() * 120;
    const r2 = 200 + Math.random() * 140;
    const r3 = 320 + Math.random() * 120;

    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    el.style.cssText = `
      left: ${sx}px;
      top:  ${sy}px;
      width:  ${w}px;
      height: ${h}px;
      background: ${color};
    `;
    el.style.setProperty("--ld",  `${dur}s`);
    el.style.setProperty("--del", `${del}s`);
    el.style.setProperty("--wx1", `${wx1}px`);
    el.style.setProperty("--wx2", `${wx2}px`);
    el.style.setProperty("--wx3", `${wx3}px`);
    el.style.setProperty("--r1",  `${r1}deg`);
    el.style.setProperty("--r2",  `${r2}deg`);
    el.style.setProperty("--r3",  `${r3}deg`);

    document.body.appendChild(el);

    // clean up after animation finishes
    setTimeout(() => el.remove(), (dur + del + 0.5) * 1000);
  }

  /* ── continuous leaf spawner ─────────────────────────── */
  function nextLeaf() {
    spawnLeaf();
    // new leaf every 180–620 ms — dense but not overwhelming
    setTimeout(nextLeaf, 180 + Math.random() * 440);
  }

  // short warm-up delay so the tree image loads first
  setTimeout(nextLeaf, 600);

})();
