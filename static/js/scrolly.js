// "How it works": a sticky frame that changes as the four steps scroll past.

import { ClipPlayer } from "./player.js";
import { drawGrid, drawField, inferno } from "./colormap.js";
import { sortedPair, traces, residualMax } from "./curves.js";
import { allTraces, clipIndex, loadClip } from "./data.js";

const T0 = 5; // the frame pair used for the walkthrough

export async function initScrolly() {
  const host = document.getElementById("scrolly-clip");
  const annot = document.getElementById("scrolly-annot");
  const chip = document.getElementById("scrolly-chip");
  const glyphBox = document.getElementById("glyph-box");
  const glyph = document.getElementById("glyph");
  const chart = document.getElementById("scrolly-chart");
  const chart2 = document.getElementById("scrolly-chart2");
  const list = await clipIndex();
  const realClip = list.find(c => c.pair === "p0" && c.label === "real");
  const genClip = list.find(c => c.pair === "p0" && c.label !== "real");
  const player = new ClipPlayer(host, { overlay: false, autoplay: false, smooth: false, opacity: 0.85 });
  const [rec, tr] = await Promise.all([player.load(realClip.id), allTraces()]);
  await loadClip(genClip.id);

  // patch to follow: interior, moved between t0 and t0+1 (best match not at the centre), large residual
  let p = 0, best = -1;
  for (let i = 0; i < 196; i++) {
    const r = Math.floor(i / 14), c = i % 14;
    if (r < 4 || r > 9 || c < 4 || c > 9) continue;
    const moved = rec.match ? rec.match[T0][i] !== 12 : true;
    const v = rec.d[T0][i] * (moved ? 1 : 0.4);
    if (v > best) { best = v; p = i; }
  }
  const pr = Math.floor(p / 14), pc = p % 14;
  const mk = rec.match ? rec.match[T0][p] : 12;
  const mr = pr + Math.floor(mk / 5) - 2, mc = pc + (mk % 5) - 2;
  const ctx = annot.getContext("2d");
  const ymaxSorted = residualMax(rec);

  function sizeAnnot() {
    const r = annot.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    annot.width = Math.round(r.width * dpr); annot.height = Math.round(r.height * dpr);
  }
  const cell = () => [annot.width / 14, annot.height / 14];
  const box = (r, c, n, style, dash = []) => {
    const [cw, ch] = cell();
    ctx.save(); ctx.strokeStyle = style; ctx.lineWidth = Math.max(2, annot.width / 320); ctx.setLineDash(dash.map(d => d * annot.width / 700));
    ctx.strokeRect((c - (n - 1) / 2) * cw, (r - (n - 1) / 2) * ch, n * cw, n * ch); ctx.restore();
  };

  function drawGlyph(t, idx) {
    const g = glyph.getContext("2d"), s = glyph.width / 3;
    g.clearRect(0, 0, glyph.width, glyph.height);
    const probs = rec.desc ? rec.desc[t][idx] : new Array(9).fill(1 / 8);
    const maxp = Math.max(...probs);
    for (let k = 0; k < 9; k++) {
      const x = (k % 3) * s, y = Math.floor(k / 3) * s;
      if (k === 4) { g.fillStyle = "rgba(128,128,128,0.25)"; g.fillRect(x + 3, y + 3, s - 6, s - 6); continue; }
      const [r, gg, b] = inferno(0.15 + 0.85 * probs[k] / maxp);
      g.fillStyle = `rgb(${r},${gg},${b})`;
      g.fillRect(x + 3, y + 3, s - 6, s - 6);
    }
  }

  let step = 0, timer = null;
  function show(n) {
    if (n === step) return;
    step = n;
    clearTimeout(timer);
    sizeAnnot();
    ctx.clearRect(0, 0, annot.width, annot.height);
    // panels below the frame take space only in the steps that use them
    glyphBox.parentElement.hidden = n === 1;
    chart2.toggleAttribute("hidden", n !== 4); // an <svg> has no .hidden property
    glyphBox.style.opacity = n === 2 || n === 3 ? 1 : 0;
    chart.style.opacity = n === 4 ? 1 : 0;
    chart2.style.opacity = n === 4 ? 1 : 0;
    if (n <= 2) {
      player.setOverlay(false);
      player.seekTransition(T0);
      chip.textContent = "frame t";
      drawGrid(ctx, n === 1 ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.18)");
      if (n === 2) {
        box(pr, pc, 3, "#fcffa4");
        box(pr, pc, 1, "#ffffff");
        drawGlyph(T0, p);
      }
    } else if (n === 3) {
      player.setOverlay(false);
      player.seekTransition(T0 + 1);
      chip.textContent = "frame t + 1";
      drawGrid(ctx, "rgba(255,255,255,0.14)");
      box(pr, pc, 5, "rgba(255,255,255,0.9)", [6, 5]);
      box(mr, mc, 1, "#fcffa4");
      const [cw, ch] = cell();
      ctx.save(); ctx.strokeStyle = "#fcffa4"; ctx.fillStyle = "#fcffa4"; ctx.lineWidth = Math.max(2, annot.width / 300);
      const x0 = (pc + 0.5) * cw, y0 = (pr + 0.5) * ch, x1 = (mc + 0.5) * cw, y1 = (mr + 0.5) * ch;
      ctx.beginPath(); ctx.arc(x0, y0, cw * 0.12, 0, 7); ctx.fill();
      if (mk !== 12) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
      ctx.restore();
      drawGlyph(T0, p);
      timer = setTimeout(() => { player.opts.smooth = false; player.setOverlay(true); chip.textContent = "residual"; }, 1400);
    } else if (n === 4) {
      player.setOverlay(true);
      player.seekTransition(T0);
      chip.textContent = "residual";
      sortedPair(chart, rec.sorted[T0], rec.sorted[T0 + 1], { cls: "real", ymax: ymaxSorted, height: 150,
        pad: [16, 6, 20, 2], xTitle: "patches, sorted →", yTitle: "Sorted residuals" });
      const gW = tr.clips[genClip.id].W, rW = tr.clips[realClip.id].W;
      const ymax = Math.max(...gW, ...rW) * 1.1;
      traces(chart2, [{ values: rW, cls: "real" }, { values: gW, cls: "gen" }], { ymax, height: 120,
        pad: [16, 70, 20, 2], xTitle: "time →", yTitle: "Wasserstein distance over time" });
      labelEnds(chart2, rW, gW, ymax);
    }
  }

  function labelEnds(svg, rW, gW, ymax) {
    const g = svg.querySelector("g");
    const vb = svg.viewBox.baseVal, H = vb.height - 36, Wd = vb.width - 72;
    for (const [vals, cls, text] of [[rW, "real", "real"], [gW, "gen", "generated"]]) {
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", Wd + 8); t.setAttribute("y", H - Math.min(1, vals[vals.length - 1] / ymax) * H + 4);
      t.setAttribute("class", `series-label ${cls}`); t.textContent = text; g.append(t);
    }
  }

  // click-to-switch steps (accordion): the active step is expanded and drives the frame on the left
  const steps = [...document.querySelectorAll(".scrolly-steps .step")];
  function activate(n) {
    for (const s of steps) {
      const on = Number(s.dataset.step) === n;
      s.classList.toggle("active", on);
      s.querySelector(".step-btn").setAttribute("aria-expanded", String(on));
    }
    show(n);
  }
  for (const s of steps) {
    s.querySelector(".step-btn").addEventListener("click", () => activate(Number(s.dataset.step)));
  }
  window.addEventListener("resize", () => { const s = step; step = 0; show(s || 1); });
  activate(1);
}
