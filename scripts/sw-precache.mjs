// v1.0.39: lists every image/icon/font in public/ for the service worker to precache (public/sw-precache.json).
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const out = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== "maplibre") walk(p); continue; }
    if (/\.(png|jpe?g|webp|svg|gif|ico|avif|woff2?|ttf|otf)$/i.test(f)) out.push("/" + p.slice("public/".length).split("\\").join("/"));
  }
};
walk("public");
writeFileSync("public/sw-precache.json", JSON.stringify({ assets: out.sort() }));
console.log(`sw-precache: ${out.length} assets`);
