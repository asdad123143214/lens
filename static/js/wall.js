// Gallery: every clip in a grid; hover or tap to reveal the residual heatmap.

import { ClipPlayer, autoPause } from "./player.js";
import { traces } from "./curves.js";
import { allTraces, clipIndex, mediaUrl, sourceText } from "./data.js";

export async function initWall() {
  const wall = document.getElementById("wall");
  const filters = document.getElementById("wall-filters");
  const [list, tr] = await Promise.all([clipIndex(), allTraces()]);

  // interleave real and generated so the grid reads as a comparison
  const real = list.filter(c => c.label === "real"), gen = list.filter(c => c.label !== "real");
  const order = [];
  const step = Math.max(1, Math.round(gen.length / Math.max(1, real.length)));
  let ri = 0;
  gen.forEach((c, i) => { if (i % step === 0 && real[ri]) order.push(real[ri++]); order.push(c); });
  while (ri < real.length) order.push(real[ri++]);

  const cards = [];
  const lazy = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      lazy.unobserve(e.target);
      const card = e.target._card;
      card.player.load(card.clip.id).then(() => autoPause(card.player));
    }
  }, { rootMargin: "300px 0px" });

  for (const c of order) {
    const cls = c.label === "real" ? "real" : "gen";
    const fig = document.createElement("figure");
    fig.className = "card";
    fig.innerHTML = `<div class="clip-frame" tabindex="0" aria-label="${sourceText(c)}. Press Enter to toggle the heatmap.">
        <div class="clip-host"></div><span class="chip ${cls}">${sourceText(c)}</span></div>
      <svg class="trace" role="img" aria-label="Wasserstein distance over time"></svg>`;
    const host = fig.querySelector(".clip-host");
    host.style.aspectRatio = `${c.w} / ${c.h}`;
    const player = new ClipPlayer(host, { overlay: false, opacity: 0.85, preload: "none" });
    player.video.poster = mediaUrl(c.id, "webp");
    player.setOverlay(false);
    traces(fig.querySelector("svg"), [{ values: tr.clips[c.id].W, cls, head: false }],
      { ymax: tr.wmax, height: 34, pad: [2, 2, 2, 2] });
    const frameEl = fig.querySelector(".clip-frame");
    let pinned = false;
    frameEl.addEventListener("mouseenter", () => player.setOverlay(true));
    frameEl.addEventListener("mouseleave", () => { if (!pinned) player.setOverlay(false); });
    const toggle = () => { pinned = !pinned; player.setOverlay(pinned); };
    frameEl.addEventListener("click", toggle);
    frameEl.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    const card = { el: fig, clip: c, player };
    fig._card = card;
    cards.push(card);
    wall.append(fig);
    lazy.observe(fig);
  }

  // filter: all / real / generated
  const g = document.createElement("div");
  g.className = "filter-group";
  g.setAttribute("role", "group");
  for (const [val, text] of [["all", "All"], ["real", "Real"], ["generated", "Generated"]]) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "pill"; b.textContent = text;
    b.setAttribute("aria-pressed", String(val === "all"));
    b.addEventListener("click", () => {
      g.querySelectorAll(".pill").forEach(p => p.setAttribute("aria-pressed", String(p === b)));
      for (const card of cards) card.el.hidden = !(val === "all" || card.clip.label === val);
    });
    g.append(b);
  }
  filters.append(g);
}
