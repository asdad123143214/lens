// Small SVG helpers: W_t traces and pairs of sorted-residual curves. No tick values on purpose:
// the page shows shapes, not numbers.

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
};

/** Prepare an svg with a fixed viewBox; returns {g, W, H} with an inner plot group. */
export function frame(svg, { width = 600, height = 160, pad = [10, 10, 22, 14], xTitle = "", yTitle = "" } = {}) {
  svg.replaceChildren();
  // draw in the svg's real pixel size so text and strokes are never stretched
  if (svg.clientWidth > 0) width = svg.clientWidth;
  if (svg.clientHeight > 0) height = svg.clientHeight;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  const [pt, pr, pb, pl] = pad;
  const W = width - pl - pr, H = height - pt - pb;
  const g = el("g", { transform: `translate(${pl},${pt})` }, svg);
  el("line", { x1: 0, x2: W, y1: H, y2: H, class: "axis", "vector-effect": "non-scaling-stroke" }, g);
  if (xTitle) {
    const t = el("text", { x: W, y: H + pb - 6, class: "axis-title", "text-anchor": "end" }, g);
    t.textContent = xTitle;
  }
  if (yTitle) {
    const t = el("text", { x: 0, y: -2, class: "axis-title", "text-anchor": "start" }, g);
    t.textContent = yTitle;
  }
  return { g, W, H };
}

const path = pts => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join("");

/**
 * W_t traces. series: [{values, cls, dashed, upto}] where cls is "real" | "gen" | "neutral".
 * upto: draw only the first `upto` points (progressive drawing); undefined = all.
 */
export function traces(svg, series, { ymax, n = 14, cursor = null, ...frameOpts } = {}) {
  const { g, W, H } = frame(svg, frameOpts);
  const x = i => (n === 1 ? 0 : (i * W) / (n - 1));
  const y = v => H - Math.min(1, v / ymax) * H;
  if (cursor !== null && cursor >= 0) {
    el("line", { x1: x(cursor), x2: x(cursor), y1: 0, y2: H, class: "cursor", "vector-effect": "non-scaling-stroke" }, g);
  }
  for (const s of series) {
    const k = s.upto === undefined ? s.values.length : Math.max(0, Math.min(s.values.length, s.upto));
    if (k < 1) continue;
    const pts = s.values.slice(0, k).map((v, i) => [x(i), y(v)]);
    if (!s.dashed && s.area !== false) {
      el("path", { d: `${path(pts)}L${pts[k - 1][0]},${H}L${pts[0][0]},${H}Z`, class: `area ${s.cls}` }, g);
    }
    el("path", { d: path(pts), class: `line ${s.cls}${s.dashed ? " dashed" : ""}`, "vector-effect": "non-scaling-stroke" }, g);
    if (s.head !== false) {
      const [hx, hy] = pts[k - 1];
      el("circle", { cx: hx, cy: hy, r: 3.2, class: `head ${s.cls}` }, g);
    }
  }
  return { x, y, W, H };
}

/**
 * Sorted residuals of transition t and t+1 (quantile functions) with the area between them shaded:
 * that area is W_t. a, b: sorted arrays of 196 residuals (x1e5); b may be null at the last transition.
 */
export function sortedPair(svg, a, b, { cls = "neutral", ymax, sqrt = true, ...frameOpts } = {}) {
  const { g, W, H } = frame(svg, frameOpts);
  const n = a.length;
  const x = i => ((i + 0.5) * W) / n;
  // residuals are heavy-tailed; a square-root axis keeps the bulk of the curve readable
  const s = v => (sqrt ? Math.sqrt(Math.max(0, v) / ymax) : v / ymax);
  const y = v => H - Math.min(1, s(v)) * H;
  const pa = Array.from(a, (v, i) => [x(i), y(v)]);
  if (b) {
    const pb = Array.from(b, (v, i) => [x(i), y(v)]);
    el("path", { d: `${path(pa)}${path(pb.slice().reverse()).replace("M", "L")}Z`, class: `between ${cls}` }, g);
    el("path", { d: path(pb), class: `line ${cls} next`, "vector-effect": "non-scaling-stroke" }, g);
  }
  el("path", { d: path(pa), class: `line ${cls}`, "vector-effect": "non-scaling-stroke" }, g);
  return { x, y, W, H };
}

/** Robust y-range for a clip's sorted curves (99.5th percentile of all its residuals). */
export function residualMax(rec) {
  const all = rec.sorted.flatMap(r => Array.from(r)).sort((p, q) => p - q);
  return all[Math.floor(all.length * 0.995)] * 1.05;
}
