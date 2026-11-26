// Weather and light: wind that pushes the aircraft, gusts, cloud fields and
// the sky's colour at any hour, from noon blue to night black.
import { PALETTE, WEATHER } from './config.js';
import { createRandom } from './random.js';

export function createWeather(presetName, hour) {
  const preset = WEATHER[presetName] ?? WEATHER.clear;
  const windFrom = (preset.windFrom * Math.PI) / 180;
  // Wind blows FROM windFrom, so the vector points the other way.
  const wind = { x: -Math.sin(windFrom) * preset.windSpeed, z: Math.cos(windFrom) * preset.windSpeed };
  const clouds = [];
  const rand = createRandom(777);
  for (let i = 0; i < 46; i += 1) {
    clouds.push({
      x: (rand() - 0.5) * 24000,
      y: 900 + rand() * 700,
      z: (rand() - 0.5) * 24000,
      r: 260 + rand() * 420,
      shade: 0.75 + rand() * 0.25,
    });
  }
  const state = { preset, hour, wind, gust: 0, gustPhase: rand() * 10, clouds, time: 0 };

  function step(dt) {
    state.time += dt;
    // Gusts breathe on a slow sine plus a faster wobble.
    const g = Math.sin(state.time * 0.35 + state.gustPhase) * 0.6 + Math.sin(state.time * 1.1) * 0.4;
    state.gust = g * preset.gust;
    for (const c of state.clouds) {
      c.x += wind.x * dt * 0.9;
      c.z += wind.z * dt * 0.9;
      if (c.x > 13000) c.x -= 26000;
      if (c.x < -13000) c.x += 26000;
      if (c.z > 13000) c.z -= 26000;
      if (c.z < -13000) c.z += 26000;
    }
  }

  /** Wind vector at the aircraft right now, gusts included. */
  function windAt() {
    const s = 1 + state.gust / Math.max(1, preset.windSpeed);
    return { x: wind.x * s, z: wind.z * s };
  }

  return { state, step, windAt };
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Sky colours for an hour: returns top/mid/low gradient stops + sun position. */
export function skyFor(hour) {
  // Keyframes through the day; blend between neighbours.
  const keys = [
    { h: 0, top: PALETTE.skyNightTop, mid: PALETTE.skyNightMid, low: PALETTE.skyNightLow, sun: -1, day: 0 },
    { h: 5, top: PALETTE.skyNightTop, mid: PALETTE.skyNightMid, low: PALETTE.skyNightLow, sun: -1, day: 0 },
    { h: 6.5, top: PALETTE.skyDawnTop, mid: PALETTE.skyDawnMid, low: PALETTE.skyDawnLow, sun: 0.12, day: 0.4 },
    { h: 8.5, top: PALETTE.skyDayTop, mid: PALETTE.skyDayMid, low: PALETTE.skyDayLow, sun: 0.55, day: 1 },
    { h: 12.5, top: PALETTE.skyDayTop, mid: PALETTE.skyDayMid, low: PALETTE.skyDayLow, sun: 1, day: 1 },
    { h: 17.4, top: PALETTE.skyDuskTop, mid: PALETTE.skyDuskMid, low: PALETTE.skyDuskLow, sun: 0.35, day: 0.85 },
    { h: 18.7, top: PALETTE.skyDuskTop, mid: PALETTE.skyDuskMid, low: PALETTE.skyDuskLow, sun: 0.05, day: 0.45 },
    { h: 19.6, top: PALETTE.skyNightTop, mid: PALETTE.skyNightMid, low: PALETTE.skyNightLow, sun: -1, day: 0.12 },
    { h: 24, top: PALETTE.skyNightTop, mid: PALETTE.skyNightMid, low: PALETTE.skyNightLow, sun: -1, day: 0 },
  ];
  let i = 0;
  while (i < keys.length - 2 && hour > keys[i + 1].h) i += 1;
  const a = keys[i], b = keys[i + 1];
  const t = Math.min(1, Math.max(0, (hour - a.h) / (b.h - a.h)));
  return {
    top: mix(a.top, b.top, t),
    mid: mix(a.mid, b.mid, t),
    low: mix(a.low, b.low, t),
    sunElev: a.sun + (b.sun - a.sun) * t,
    daylight: a.day + (b.day - a.day) * t,
    night: 1 - (a.day + (b.day - a.day) * t),
  };
}
