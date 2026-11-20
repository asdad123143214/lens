// Entry point: start each section's module when it comes near the viewport.

import { initHero } from "./hero.js";

const sections = {
  how: () => import("./scrolly.js").then(m => m.initScrolly()),
  explore: () => import("./explorer.js").then(m => m.initExplorer()),
  gallery: () => import("./wall.js").then(m => m.initWall()),
};

function lazySections() {
  const started = new Set();
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      const id = e.target.id;
      if (!e.isIntersecting || started.has(id)) continue;
      started.add(id);
      io.unobserve(e.target);
      sections[id]().catch(err => console.error(`section ${id} failed`, err));
    }
  }, { rootMargin: "600px 0px" });
  for (const id of Object.keys(sections)) {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  }
}

initHero().catch(err => console.error("hero failed", err));
lazySections();
