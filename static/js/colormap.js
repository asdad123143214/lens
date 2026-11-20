// Inferno colormap (matplotlib, 33 stops) and residual-field drawing.

const STOPS = ["000004","040312","0b0724","150b37","210c4a","2f0a5b","3d0965","4a0c6b","57106e","64156e","71196e",
  "7d1e6d","8a226a","972766","a32c61","b0315b","bc3754","c73e4c","d24644","db503b","e45a31","eb6628","f1731d","f68013",
  "f98e09","fb9d07","fcac11","fbbc21","f9cb35","f5db4c","f2ea69","f3f68a","fcffa4"].map(h => [
  parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);

/** Colour for v in [0, 1] (clamped). */
export function inferno(v) {
  const x = Math.min(1, Math.max(0, v)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const a = STOPS[i], b = STOPS[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** CSS gradient of the colormap, for legends. */
export function infernoGradient(direction = "to right") {
  const parts = STOPS.filter((_, i) => i % 4 === 0 || i === STOPS.length - 1)
    .map((c, i, arr) => `rgb(${c.join(",")}) ${(100 * i / (arr.length - 1)).toFixed(1)}%`);
  return `linear-gradient(${direction}, ${parts.join(", ")})`;
}

// Residuals are stored x1e5; the paper's Fig. 2 clips the colour scale at d = 0.10.
export const D_SCALE = 1e5;
export const D_CLIP = 0.10;

const cellCanvas = document.createElement("canvas");
cellCanvas.width = 14; cellCanvas.height = 14;
const cellCtx = cellCanvas.getContext("2d");
const cellImg = cellCtx.createImageData(14, 14);

/**
 * Draw one 14x14 residual field over the whole canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[]} field 196 residual values (x1e5)
 * @param {{opacity?:number, smooth?:boolean, grid?:boolean, clip?:number, solid?:boolean}} opts
 */
export function drawField(ctx, field, opts = {}) {
  const { opacity = 0.85, smooth = true, grid = false, clip = D_CLIP, solid = false } = opts;
  const floor = opts.floor ?? (smooth ? 0.28 : 0.14);
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!field) return;
  for (let i = 0; i < 196; i++) {
    const v = field[i] / D_SCALE / clip;
    const [r, g, b] = inferno(v);
    const k = i * 4;
    cellImg.data[k] = r; cellImg.data[k + 1] = g; cellImg.data[k + 2] = b;
    // brighter residual -> more opaque, so the video stays readable under quiet patches
    cellImg.data[k + 3] = 255 * (solid ? 1 : Math.min(1, floor + 0.9 * Math.sqrt(Math.min(1, v))));
  }
  cellCtx.putImageData(cellImg, 0, 0);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.imageSmoothingEnabled = smooth;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cellCanvas, 0, 0, W, H);
  ctx.restore();
  if (grid) drawGrid(ctx, "rgba(255,255,255,0.22)");
}

export function drawGrid(ctx, color = "rgba(255,255,255,0.35)", n = 14) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, W / 700);
  ctx.beginPath();
  for (let i = 1; i < n; i++) {
    const x = Math.round((i * W) / n) + 0.5, y = Math.round((i * H) / n) + 0.5;
    ctx.moveTo(x, 0); ctx.lineTo(x, H);
    ctx.moveTo(0, y); ctx.lineTo(W, y);
  }
  ctx.stroke();
  ctx.restore();
}
