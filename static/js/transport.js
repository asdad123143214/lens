// "Why the Wasserstein distance?": the 196 residuals of two consecutive frame pairs as two rows of dots,
// linked either by location (same patch) or by value (k-th smallest to k-th smallest = Wasserstein).

import { ClipPlayer } from "./player.js";
import { inferno, D_CLIP, D_SCALE } from "./colormap.js";
import { clipIndex, reducedMotion } from "./data.js";

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent.append(n);
  return n;
};
const argsort = a => Array.from(a.keys()).sort((i, j) => a[i] - a[j]);

function jitter(i, salt) { // deterministic, in [-1, 1]
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return 2 * (x - Math.floor(x)) - 1;
}

const NOTES = {
  location: "Paired by location: every patch is linked to the same patch one step later. The long, crossing links are paid for motion, not for change.",
  value: "Paired by value: smallest with smallest, largest with largest. No pairing is cheaper, and the length of these links is the Wasserstein distance.",
};

export async function initTransport() {
  const $ = id => document.getElementById(id);
  const svg = $("tp-svg"), note = $("tp-note"), range = $("tp-t");
  const buttons = [...document.querySelectorAll("#transport .seg")];
  const list = await clipIndex();
  const clip = list.find(c => c.pair === "p0" && c.label === "real");
  const opts = { autoplay: false, smooth: false, opacity: 0.85 };
  const pa = new ClipPlayer($("tp-clip-a"), opts), pb = new ClipPlayer($("tp-clip-b"), opts);
  const rec = await pa.load(clip.id);
  await pb.load(clip.id);
  const cls = rec.label === "real" ? "real" : "gen";

  // one value scale for the whole clip; square root because residuals are heavy-tailed
  const all = rec.d.flat().sort((p, q) => p - q);
  const vmax = all[Math.floor(all.length * 0.995)];
  let t = 0, prog = 0, target = 0, anim = 0, geo = null;

  function layout() {
    const W = svg.clientWidth || 700, H = svg.clientHeight || 300;
    const narrow = W < 520; // phones: row labels go above the rows instead of to their left
    const left = narrow ? 6 : 92, right = 16, y0 = narrow ? 58 : 46, y1 = narrow ? H - 80 : H - 62, spread = Math.min(16, (y1 - y0) / 10);
    const X = v => left + Math.sqrt(Math.min(1, Math.max(0, v) / vmax)) * (W - left - right);
    const top = rec.d[t], bot = rec.d[t + 1];
    const oTop = argsort(top), oBot = argsort(bot);
    const rank = new Array(196);
    oTop.forEach((p, k) => (rank[p] = k));
    const pts = (row, y, salt) => row.map((v, i) => [X(v), y + jitter(i, salt) * spread]);
    return { W, H, left, y0, y1, X, top, bot, narrow, pTop: pts(top, y0, t), pBot: pts(bot, y1, t + 1),
      byValue: Array.from({ length: 196 }, (_, i) => oBot[rank[i]]) };
  }

  function draw() {
    geo = layout();
    const { W, H, left, y0, y1, top, bot, pTop, pBot, narrow } = geo;
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const label = (x, y, text, anchor = "start", c = "axis-title") => { el("text", { x, y, class: c, "text-anchor": anchor }, svg).textContent = text; };
    label(0, narrow ? y0 - 24 : y0 + 4, "frame pair t", "start", "row-label");
    label(0, narrow ? y1 + 32 : y1 + 4, "frame pair t + 1", "start", "row-label");
    el("line", { x1: left, x2: W - 16, y1: H - 26, y2: H - 26, class: "axis" }, svg);
    label(left, H - 8, "← smaller residual");
    label(W - 16, H - 8, "larger residual →", "end");
    const links = el("g", { class: `links ${cls}` }, svg);
    geo.lines = pTop.map(([x, y], i) => el("line", { x1: x, y1: y, x2: x, y2: y, "data-i": i }, links));
    const dots = el("g", { class: "dots" }, svg);
    const dot = (p, v, i, row) => {
      const [r, g, b] = inferno(v / D_SCALE / D_CLIP);
      el("circle", { cx: p[0], cy: p[1], r: 3.6, fill: `rgb(${r | 0},${g | 0},${b | 0})`, "data-i": i, "data-row": row }, dots);
    };
    top.forEach((v, i) => dot(pTop[i], v, i, "t"));
    bot.forEach((v, i) => dot(pBot[i], v, i, "b"));
    place();
  }

  function place() {
    const { pTop, pBot, byValue, lines } = geo;
    const e = prog < 0.5 ? 2 * prog * prog : 1 - (-2 * prog + 2) ** 2 / 2; // ease in-out
    for (let i = 0; i < 196; i++) {
      const a = pBot[i], b = pBot[byValue[i]];
      lines[i].setAttribute("x2", a[0] + (b[0] - a[0]) * e);
      lines[i].setAttribute("y2", a[1] + (b[1] - a[1]) * e);
    }
  }

  function animateTo(goal) {
    target = goal;
    cancelAnimationFrame(anim);
    if (reducedMotion()) { prog = goal; place(); return; }
    const start = performance.now(), from = prog, dur = 850;
    const step = now => {
      const k = Math.min(1, (now - start) / dur);
      prog = from + (goal - from) * k;
      place();
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  function setMode(mode) {
    buttons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    svg.classList.toggle("by-value", mode === "value");
    note.textContent = NOTES[mode];
    animateTo(mode === "value" ? 1 : 0);
  }

  function setT(v) {
    t = v;
    pa.seekTransition(t);
    pb.seekTransition(t + 1);
    range.setAttribute("aria-valuetext", `frame pair ${t + 1} of ${rec.d.length - 1}`);
    draw();
  }

  // hover a dot: highlight its link
  svg.addEventListener("pointerover", e => {
    const i = e.target.getAttribute && e.target.getAttribute("data-i");
    if (i === null || !geo) return;
    const idx = e.target.getAttribute("data-row") === "b"
      ? (target ? geo.byValue.indexOf(Number(i)) : Number(i)) : Number(i);
    geo.lines.forEach((l, k) => l.classList.toggle("hot", k === idx));
  });
  svg.addEventListener("pointerleave", () => geo && geo.lines.forEach(l => l.classList.remove("hot")));

  buttons.forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  range.addEventListener("input", () => setT(Number(range.value)));
  new ResizeObserver(() => geo && draw()).observe(svg);
  setT(0);
  setMode("location");
}
