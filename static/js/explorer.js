// Visualization (Figure 4): choose a clip, play or scrub its 15 frame pairs, read the sorted curves and the W_t trace.

import { ClipPlayer, autoPause } from "./player.js";
import { sortedPair, traces, residualMax } from "./curves.js";
import { allTraces, clipIndex, mediaUrl, sourceText } from "./data.js";

export async function initExplorer() {
  const $ = id => document.getElementById(id);
  const [list, tr] = await Promise.all([clipIndex(), allTraces()]);
  const player = new ClipPlayer($("ex-clip"), { smooth: false, opacity: 0.8, onTransition: t => update(t) });
  autoPause(player);
  const chip = $("ex-chip"), range = $("ex-t"), playBtn = $("ex-play");
  let rec = null, ysorted = 1;

  // interleave real and generated in the rail
  const real = list.filter(c => c.label === "real"), gen = list.filter(c => c.label !== "real");
  const order = [];
  for (let i = 0; i < Math.max(real.length, gen.length * 0.5); i++) {
    if (gen[2 * i]) order.push(gen[2 * i]);
    if (real[i]) order.push(real[i]);
    if (gen[2 * i + 1]) order.push(gen[2 * i + 1]);
  }
  gen.slice(2 * real.length).forEach(c => order.includes(c) || order.push(c));

  const rail = $("ex-rail");
  for (const c of order) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `thumb ${c.label === "real" ? "real" : "gen"}`;
    b.setAttribute("role", "option");
    b.setAttribute("aria-selected", "false");
    b.setAttribute("aria-label", sourceText(c));
    b.innerHTML = `<img src="${mediaUrl(c.id, "webp")}" alt="" loading="lazy" decoding="async"><span>${sourceText(c)}</span>`;
    b.addEventListener("click", () => select(c, b));
    rail.append(b);
  }

  async function select(c, btn) {
    rail.querySelectorAll(".thumb").forEach(t => t.setAttribute("aria-selected", String(t === btn)));
    chip.className = `chip ${c.label === "real" ? "real" : "gen"}`;
    chip.textContent = sourceText(c);
    rec = await player.load(c.id);
    ysorted = residualMax(rec);
    update(player.t < 0 ? 0 : player.t);
  }

  function update(t) {
    if (!rec) return;
    range.value = String(t);
    range.setAttribute("aria-valuetext", `frame pair ${t + 1} of ${rec.d.length}`);
    const cls = rec.label === "real" ? "real" : "gen";
    sortedPair($("ex-sorted"), rec.sorted[t], rec.sorted[t + 1] || null, { cls, ymax: ysorted, height: 150,
      pad: [16, 4, 20, 2], xTitle: "patches, sorted →", yTitle: "sorted residuals" });
    traces($("ex-trace"), [{ values: tr.clips[rec.id].W, cls }], { ymax: tr.wmax, height: 150, cursor: Math.min(t, 13),
      pad: [16, 6, 20, 2], xTitle: "time →", yTitle: "Wasserstein distance" });
  }

  range.addEventListener("input", () => player.seekTransition(Number(range.value)));
  playBtn.addEventListener("click", () => {
    if (player.playing) { player.pause(); player.wantPlay = false; } else { player.play(); player.wantPlay = true; }
  });
  const syncBtn = () => {
    playBtn.classList.toggle("paused", !player.playing);
    playBtn.setAttribute("aria-label", player.playing ? "Pause" : "Play");
  };
  player.video.addEventListener("play", syncBtn);
  player.video.addEventListener("pause", syncBtn);

  const first = rail.querySelector(".thumb");
  await select(order[0], first);
  syncBtn();
}
