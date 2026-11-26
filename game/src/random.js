// Seeded randomness: mulberry32 plus smooth value noise, so the archipelago,
// the clouds and every screenshot scene are the same on every run.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296);
}

function smooth(t) { return t * t * (3 - 2 * t); }

/** Value noise in [-1, 1], deterministic for (x, z). */
export function valueNoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const ux = smooth(fx), uz = smooth(fz);
  return ((a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1);
}

/** Two-octave fbm for rolling hills. */
export function fbm(x, z, seed) {
  return valueNoise(x, z, seed) * 0.65 + valueNoise(x * 2.13 + 7.7, z * 2.13 + 3.1, seed) * 0.35;
}
