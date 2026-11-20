// Hero: a motion-matched real / generated pair, looping in sync, with live W_t traces.

import { ClipPlayer, autoPause } from "./player.js";
import { traces } from "./curves.js";
import { allTraces, clipIndex, reducedMotion } from "./data.js";
import { infernoGradient } from "./colormap.js";

export async function initHero() {
  const stage = document.getElementById("hero-stage");
  stage.querySelector(".ramp").style.background = infernoGradient();
  const [list, tr] = await Promise.all([clipIndex(), allTraces()]);
  const pair = list.filter(c => c.pair === "p0");
  const clips = { real: pair.find(c => c.label === "real"), gen: pair.find(c => c.label !== "real") };
  const ymax = Math.max(...tr.clips[clips.real.id].W, ...tr.clips[clips.gen.id].W) * 1.12;
  const still = reducedMotion();

  const players = {};
  for (const slot of ["real", "gen"]) {
    const host = stage.querySelector(`.clip-host[data-slot="${slot}"]`);
    const svg = stage.querySelector(`svg.trace[data-slot="${slot}"]`);
    const W = tr.clips[clips[slot].id].W;
    const draw = t => traces(svg, [{ values: W, cls: slot, upto: still ? W.length : t }],
      { ymax, height: 76, pad: [6, 8, 16, 2], xTitle: slot === "real" ? "time →" : "" });
    const p = new ClipPlayer(host, { overlay: still, opacity: 0.8, autoplay: !still, onTransition: draw });
    p.video.setAttribute("aria-label", slot === "real" ? "Real video" : "Generated video");
    players[slot] = p;
    draw(still ? W.length : 0);
  }
  if (clips.gen.generator) stage.querySelector(".chip.gen").textContent = `Generated · ${clips.gen.generator}`;
  await Promise.all([players.real.load(clips.real.id), players.gen.load(clips.gen.id)]);
  autoPause(players.real);
  autoPause(players.gen);

  // keep the two loops aligned
  setInterval(() => {
    const a = players.real.video, b = players.gen.video;
    if (!a.paused && !b.paused && Math.abs(a.currentTime - b.currentTime) > 0.06) b.currentTime = a.currentTime;
  }, 400);

  // reveal the heatmap after the first loop has been seen clean
  if (!still) {
    players.real.setOverlay(false);
    players.gen.setOverlay(false);
    setTimeout(() => setOverlay(true), 2300);
  }

  const btn = act => stage.querySelector(`[data-act="${act}"]`);
  function setOverlay(on) {
    players.real.setOverlay(on); players.gen.setOverlay(on);
    btn("overlay").setAttribute("aria-pressed", String(on));
  }
  btn("overlay").addEventListener("click", e => setOverlay(e.currentTarget.getAttribute("aria-pressed") !== "true"));
  btn("slow").addEventListener("click", e => {
    const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
    e.currentTarget.setAttribute("aria-pressed", String(on));
    players.real.setRate(on ? 0.5 : 1); players.gen.setRate(on ? 0.5 : 1);
  });
  const playBtn = btn("play");
  const syncPlay = () => {
    const playing = players.real.playing;
    playBtn.textContent = playing ? "Pause" : "Play";
    playBtn.setAttribute("aria-pressed", String(playing));
  };
  playBtn.addEventListener("click", () => {
    if (players.real.playing) { players.real.pause(); players.gen.pause(); players.real.wantPlay = players.gen.wantPlay = false; }
    else { players.gen.video.currentTime = players.real.video.currentTime; players.real.play(); players.gen.play(); players.real.wantPlay = players.gen.wantPlay = true; }
  });
  players.real.video.addEventListener("play", syncPlay);
  players.real.video.addEventListener("pause", syncPlay);
  syncPlay();
}
