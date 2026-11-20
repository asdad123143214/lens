// A muted looping clip with a residual-heatmap canvas kept in sync with playback.

import { drawField } from "./colormap.js";
import { loadClip, mediaUrl, transitionAt, reducedMotion } from "./data.js";

export class ClipPlayer {
  /**
   * @param {HTMLElement} host   element that receives the <video> and overlay <canvas>
   * @param {{overlay?:boolean, opacity?:number, smooth?:boolean, grid?:boolean, autoplay?:boolean,
   *          onTransition?:(t:number, time:number)=>void, preload?:string}} opts
   */
  constructor(host, opts = {}) {
    this.host = host;
    this.opts = { overlay: true, opacity: 0.8, smooth: true, grid: false, autoplay: true, preload: "metadata", ...opts };
    this.rec = null;
    this.t = -1;
    this.video = document.createElement("video");
    Object.assign(this.video, { muted: true, loop: true, playsInline: true, preload: this.opts.preload });
    this.video.setAttribute("muted", "");
    this.video.setAttribute("playsinline", "");
    this.canvas = document.createElement("canvas");
    this.canvas.className = "overlay";
    this.canvas.setAttribute("aria-hidden", "true");
    host.classList.add("clip");
    host.append(this.video, this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this._loop = this._loop.bind(this);
    this.video.addEventListener("play", () => this._kick());
    this.video.addEventListener("seeked", () => this.render(true));
    this.video.addEventListener("loadedmetadata", () => this._resize());
    new ResizeObserver(() => this._resize()).observe(host);
  }

  async load(id) {
    this.id = id;
    this.t = -1;
    this.video.poster = mediaUrl(id, "webp");
    this.video.src = mediaUrl(id, "mp4");
    this.rec = await loadClip(id);
    if (this.id !== id) return this.rec;
    this.host.style.aspectRatio = `${this.rec.w} / ${this.rec.h}`;
    this._resize();
    this.render(true);
    if (this.opts.autoplay && !reducedMotion()) this.play();
    return this.rec;
  }

  play() { const p = this.video.play(); if (p) p.catch(() => {}); }
  pause() { this.video.pause(); }
  get playing() { return !this.video.paused; }

  setOverlay(on) { this.opts.overlay = on; this.host.classList.toggle("overlay-off", !on); this.render(true); }
  setOpacity(v) { this.opts.opacity = v; this.render(true); }
  setRate(r) { this.video.playbackRate = r; }

  /** Jump to transition t (0..14): show the first source frame of that transition. */
  seekTransition(t) {
    this.pause();
    this.video.currentTime = Math.min(1.99, t / 8 + 0.02);
    this.t = t;
    this.render(true);
  }

  _resize() {
    const r = this.host.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
      this.render(true);
    }
  }

  _kick() {
    if (this._running) return;
    this._running = true;
    if ("requestVideoFrameCallback" in this.video) this.video.requestVideoFrameCallback(this._loop);
    else requestAnimationFrame(this._loop);
  }

  _loop() {
    this.render(false);
    if (this.video.paused) { this._running = false; return; }
    if ("requestVideoFrameCallback" in this.video) this.video.requestVideoFrameCallback(this._loop);
    else requestAnimationFrame(this._loop);
  }

  render(force) {
    if (!this.rec) return;
    const t = transitionAt(this.video.currentTime, this.rec.d.length);
    if (!force && t === this.t) return;
    this.t = t;
    if (this.opts.overlay) {
      drawField(this.ctx, this.rec.d[t], { opacity: this.opts.opacity, smooth: this.opts.smooth, grid: this.opts.grid });
    } else {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (this.opts.onTransition) this.opts.onTransition(t, this.video.currentTime);
  }
}

/** Pause videos that scroll out of view; resume the ones that come back (unless the user paused them). */
const io = new IntersectionObserver(entries => {
  for (const e of entries) {
    const p = e.target._player;
    if (!p) continue;
    if (e.isIntersecting) { if (p.wantPlay && !reducedMotion()) p.play(); }
    else if (p.playing) { p.wantPlay = true; p.pause(); }
  }
}, { threshold: 0.15 });

export function autoPause(player) {
  player.wantPlay = player.opts.autoplay;
  player.host._player = player;
  player.video.addEventListener("pause", () => { if (document.visibilityState === "visible" && player._userPaused) player.wantPlay = false; });
  io.observe(player.host);
}
