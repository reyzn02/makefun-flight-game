// The archipelago: island heightfields, flattened runway pads, towns, the
// volcano, lighthouses and the canyon. Everything is a pure function of (x, z),
// so the terrain the screenshots show is the terrain the player flies over.
import { AIRPORTS, ISLANDS, WORLD_SEED } from './config.js';
import { fbm } from './random.js';

const SEA = -24;

function islandBump(x, z) {
  let h = SEA;
  for (const isl of ISLANDS) {
    const dx = x - isl.x, dz = z - isl.z;
    const d = Math.sqrt(dx * dx + dz * dz) / isl.radius;
    if (d >= 1.4) continue;
    let bump;
    if (isl.volcano) {
      // Cone with a crater dip at the top.
      bump = isl.peak * Math.max(0, 1 - d * 0.85);
      const crater = Math.exp(-((d * isl.radius) ** 2) / (2 * 260 * 260));
      bump -= crater * 260;
    } else if (isl.plateau) {
      bump = isl.peak * Math.max(0, 1 - d * d) * 0.8 + isl.peak * 0.25 * Math.max(0, 1 - d * 3);
    } else {
      bump = isl.peak * Math.exp(-d * d * 2.2);
    }
    h += bump;
  }
  return h;
}

/** Runway pad: flatten the ground to the runway elevation near a strip. */
function runwayBlend(x, z) {
  let elev = null;
  let weight = 0;
  for (const ap of AIRPORTS) {
    const hd = (ap.heading * Math.PI) / 180;
    const along = (x - ap.x) * Math.sin(hd) + (z - ap.z) * -Math.cos(hd);
    const across = (x - ap.x) * Math.cos(hd) + (z - ap.z) * Math.sin(hd);
    const halfL = ap.length / 2 + 260, halfW = ap.width / 2 + 220;
    if (Math.abs(along) > halfL || Math.abs(across) > halfW) continue;
    const w = Math.max(0, 1 - Math.abs(along) / halfL) * Math.max(0, 1 - Math.abs(across) / halfW);
    const core = Math.abs(along) < ap.length / 2 + 40 && Math.abs(across) < ap.width / 2 + 40 ? 1 : 0;
    const ww = Math.max(w, core);
    if (ww > weight) { weight = ww; elev = ap.elev; }
  }
  return { elev, weight };
}

export function groundHeight(x, z) {
  let h = islandBump(x, z);
  // Rolling hills on land, gentle swell at sea.
  const land = Math.min(1, Math.max(0, (h - 2) / 60));
  h += fbm(x * 0.0016, z * 0.0016, WORLD_SEED) * 26 * land;
  h += fbm(x * 0.006, z * 0.006, WORLD_SEED + 5) * 6 * land;
  // Carve the Embun canyon: a low winding corridor through the highlands.
  const canyon = canyonFloor(x, z);
  if (canyon) h = h * (1 - canyon.depth * 0.55) + 440 * canyon.depth * 0.55;
  const rb = runwayBlend(x, z);
  if (rb.elev !== null && rb.weight > 0) h = h * (1 - rb.weight) + rb.elev * rb.weight;
  return h;
}

export function airportById(id) { return AIRPORTS.find((a) => a.id === id); }

/** The four corners of a runway strip, in world metres. */
export function runwayCorners(ap) {
  const hd = (ap.heading * Math.PI) / 180;
  const fwd = { x: Math.sin(hd), z: -Math.cos(hd) };
  const right = { x: Math.cos(hd), z: Math.sin(hd) };
  const hl = ap.length / 2, hw = ap.width / 2;
  const y = ap.elev + 1.2;
  return [
    { x: ap.x - fwd.x * hl - right.x * hw, y, z: ap.z - fwd.z * hl - right.z * hw },
    { x: ap.x + fwd.x * hl - right.x * hw, y, z: ap.z + fwd.z * hl - right.z * hw },
    { x: ap.x + fwd.x * hl + right.x * hw, y, z: ap.z + fwd.z * hl + right.z * hw },
    { x: ap.x - fwd.x * hl + right.x * hw, y, z: ap.z - fwd.z * hl + right.z * hw },
  ];
}

/** Small towns: clusters of buildings beside the towered airports. */
export function townBuildings() {
  const out = [];
  const towns = [
    { ap: 'arunika', n: 26, spread: 900, offX: 900, offZ: 700 },
    { ap: 'senja', n: 16, spread: 650, offX: -800, offZ: -600 },
    { ap: 'kelana', n: 10, spread: 420, offX: 500, offZ: 420 },
  ];
  for (const t of towns) {
    const ap = airportById(t.ap);
    for (let i = 0; i < t.n; i += 1) {
      const a = (i * 2.39996) % (Math.PI * 2); // golden-angle scatter, deterministic
      const r = t.spread * (0.35 + 0.65 * ((i * 37) % 10) / 10);
      const x = ap.x + t.offX + Math.cos(a) * r;
      const z = ap.z + t.offZ + Math.sin(a) * r;
      const g = groundHeight(x, z);
      if (g < 4) continue;
      out.push({ x, z, y: g, w: 14 + ((i * 13) % 18), d: 12 + ((i * 7) % 14), h: 10 + ((i * 11) % 26), hue: (i * 47) % 3 });
    }
  }
  return out;
}

/** Lighthouses on the coast of Arunika and Senja, beams at night. */
export const LIGHTHOUSES = [
  { x: 1850, z: 1650, name: 'Arunika Light' },
  { x: -5400, z: 5600, name: 'Senja Light' },
];

/** The Embun canyon: a low corridor the slalom mission threads. */
export function canyonFloor(x, z) {
  // A winding valley running south from Embun: lower ground along a sine path.
  const pathX = 800 + Math.sin((z + 6800) * 0.00045) * 900;
  const d = Math.abs(x - pathX);
  if (z < -7000 || z > -2200) return null;
  const depth = Math.max(0, 1 - d / 700);
  return { pathX, depth };
}
