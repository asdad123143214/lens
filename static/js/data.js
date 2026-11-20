// Clip metadata and per-clip LENS fields (exported by tools/server_export_clips.py).

const BASE = "static";
let indexPromise = null;
const cache = new Map();
const revs = new Map(); // clip id -> content hash, so a replaced clip never comes from a stale cache

// the two index files are small: always revalidate them (a 304 when unchanged)
const fresh = url => fetch(url, { cache: "no-cache" }).then(r => r.json());
const withRev = (url, id) => (revs.has(id) ? `${url}?v=${revs.get(id)}` : url);

export function clipIndex() {
  if (!indexPromise) indexPromise = fresh(`${BASE}/data/clips.json`).then(list => {
    for (const c of list) if (c.rev) revs.set(c.id, c.rev);
    return list;
  });
  return indexPromise;
}

/** Full record of one clip: d (15 x 196, x1e5), W (14), U (14), plus derived sorted residuals. */
export function loadClip(id) {
  if (!cache.has(id)) {
    cache.set(id, fetch(withRev(`${BASE}/data/${id}.json`, id)).then(r => r.json()).then(rec => {
      rec.sorted = rec.d.map(row => Float64Array.from(row).sort());
      return rec;
    }));
  }
  return cache.get(id);
}

export const mediaUrl = (id, ext) => withRev(`${BASE}/media/${id}.${ext}`, id);

/** W_t / U_t of every clip plus shared axis maxima ({wmax, umax, clips: {id: {W, U}}}). */
let tracesPromise = null;
export function allTraces() {
  if (!tracesPromise) tracesPromise = fresh(`${BASE}/data/traces.json`);
  return tracesPromise;
}

export const label = c => (c.label === "real" ? "Real" : "Generated");
export const sourceText = c => (c.label === "real"
  ? `Real · ${c.benchmark === "EvalCrafter" ? "MSR-VTT" : c.benchmark}`
  : `${c.generator} · ${c.benchmark}`);

/** Transition index (0..14) shown at playback time t (s): frames are sampled every 1/8 s. */
export const transitionAt = (t, n = 15) => Math.min(n - 1, Math.max(0, Math.floor(t * 8 + 1e-6)));

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
