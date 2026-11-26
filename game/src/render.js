// Drawing only: a pseudo-3D chase/cockpit view over the archipelago. The camera
// sits behind the aircraft; the world is projected point by point and painted
// far-to-near: sky, sea, terrain mesh, runways, towns, rings, clouds, traffic.
import { AIRPORTS, PALETTE, FONT } from './config.js';
import { groundHeight, runwayCorners, townBuildings, LIGHTHOUSES } from './terrain.js';
import { skyFor } from './weather.js';
import { drawChasePlane, drawCockpitPanel } from './aircraft.js';
import { createRandom, fbm as fbmNoise } from './random.js';

const FOV = (70 * Math.PI) / 180;
const ROWS = [60, 100, 150, 220, 320, 450, 650, 950, 1400, 2000, 3000, 4500];
const COLS = 33;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function mixc(c1, c2, t) {
  return [0, 1, 2].map((i) => Math.round(c1[i] + (c2[i] - c1[i]) * t));
}
function rgb(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }
function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Accept '#rrggbb' or 'rgb(r,g,b)' — weather.js returns rgb() strings. */
function parseColor(c) {
  if (c[0] === '#') return hexRgb(c);
  const m = c.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : [128, 128, 128];
}

const C = {
  sand: hexRgb(PALETTE.sand), grass: hexRgb(PALETTE.grass), grassDry: hexRgb(PALETTE.grassDry),
  forest: hexRgb(PALETTE.forest), rock: hexRgb(PALETTE.rock), rockDark: hexRgb(PALETTE.rockDark),
  snow: hexRgb(PALETTE.snow), seaDeep: hexRgb(PALETTE.seaDeep), seaShallow: hexRgb(PALETTE.seaShallow),
  seaGlint: hexRgb(PALETTE.seaGlint), lava: hexRgb(PALETTE.lava),
};

function terrainColor(h, slope, dist, sky) {
  let base;
  if (h < 1.5) base = h < -6 ? C.seaDeep : C.seaShallow;
  else if (h < 6) base = C.sand;
  else if (h < 120) base = mixc(C.grass, C.grassDry, clamp((h - 6) / 114, 0, 1) * 0.5);
  else if (h < 320) base = C.forest;
  else if (h < 650) base = mixc(C.rock, C.rockDark, clamp((h - 320) / 330, 0, 1));
  else base = C.snow;
  // Steep faces read darker, like shaded slopes.
  const shaded = mixc(base, [20, 22, 26], clamp(slope / 90, 0, 0.45));
  // Distance haze toward the horizon colour.
  const fog = clamp(dist / 5200, 0, 0.75);
  return rgb(mixc(shaded, sky.fog, fog));
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { w: 1280, h: 720, scale: 1, focal: 500 };
  const buildings = townBuildings();
  const stars = [];
  {
    const r = createRandom(42);
    for (let i = 0; i < 160; i += 1) stars.push({ x: r(), y: r() * 0.55, s: 0.4 + r() * 1.4, tw: r() * 6 });
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.w = window.innerWidth; view.h = window.innerHeight;
    canvas.width = Math.round(view.w * ratio);
    canvas.height = Math.round(view.h * ratio);
    canvas.style.width = `${view.w}px`;
    canvas.style.height = `${view.h}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    view.focal = (view.h / 2) / Math.tan(FOV / 2);
  }
  resize();
  window.addEventListener('resize', resize);

  // Camera basis from the aircraft, smoothed so the view never snaps.
  const cam = { heading: 0, pitch: 0, roll: 0, init: false };
  function updateCamera(plane, dt) {
    if (!cam.init) { cam.heading = plane.heading; cam.pitch = plane.pitch; cam.roll = plane.roll; cam.init = true; }
    const k = 1 - Math.pow(0.001, dt); // smooth approach
    let dh = plane.heading - cam.heading;
    while (dh > 180) dh -= 360;
    while (dh < -180) dh += 360;
    cam.heading += dh * k;
    cam.pitch += (plane.pitch - cam.pitch) * k;
    cam.roll += (plane.roll * 0.82 - cam.roll) * k; // camera banks a little less than the wing
  }

  function basis() {
    const hd = (cam.heading * Math.PI) / 180;
    const p = (cam.pitch * Math.PI) / 180;
    const r = (cam.roll * Math.PI) / 180;
    const f = { x: Math.sin(hd) * Math.cos(p), y: Math.sin(p), z: -Math.cos(hd) * Math.cos(p) };
    let rr = { x: Math.cos(hd), y: 0, z: Math.sin(hd) };
    let u = { x: -Math.sin(hd) * Math.sin(p), y: Math.cos(p), z: Math.cos(hd) * Math.sin(p) };
    // Roll around the forward axis.
    const cr = Math.cos(r), sr = Math.sin(r);
    const r2 = { x: rr.x * cr + u.x * sr, y: rr.y * cr + u.y * sr, z: rr.z * cr + u.z * sr };
    const u2 = { x: u.x * cr - rr.x * sr, y: u.y * cr - rr.y * sr, z: u.z * cr - rr.z * sr };
    rr = r2; u = u2;
    return { f, r: rr, u };
  }

  function makeProject(camPos, b) {
    return function project(p) {
      const dx = p.x - camPos.x, dy = p.y - camPos.y, dz = p.z - camPos.z;
      const cz = dx * b.f.x + dy * b.f.y + dz * b.f.z;
      if (cz < 8) return null;
      const cx = dx * b.r.x + dy * b.r.y + dz * b.r.z;
      const cy = dx * b.u.x + dy * b.u.y + dz * b.u.z;
      return { x: view.w / 2 + (cx / cz) * view.focal, y: view.h / 2 - (cy / cz) * view.focal, d: cz };
    };
  }

  function drawSky(plane, sky, hour) {
    const g = ctx.createLinearGradient(0, 0, 0, view.h);
    g.addColorStop(0, sky.top);
    g.addColorStop(0.55, sky.mid);
    g.addColorStop(0.78, sky.low);
    g.addColorStop(1, sky.low);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h);
    // Stars at night.
    if (sky.night > 0.4) {
      ctx.save();
      ctx.globalAlpha = (sky.night - 0.4) * 1.4;
      for (const s of stars) {
        const tw = 0.6 + 0.4 * Math.sin(plane.elapsed * 1.5 + s.tw);
        ctx.globalAlpha = (sky.night - 0.4) * 1.4 * tw;
        ctx.fillStyle = '#fff';
        ctx.fillRect(s.x * view.w, s.y * view.h, s.s, s.s);
      }
      ctx.restore();
    }
    // Sun or moon: low in the west at golden hour, high at noon.
    const sunAz = (262 * Math.PI) / 180; // west
    const sunEl = Math.max(0.04, sky.sunElev) * 1.1;
    const sunDir = { x: Math.sin(sunAz) * Math.cos(sunEl), y: Math.sin(sunEl), z: -Math.cos(sunAz) * Math.cos(sunEl) };
    const b = basis();
    const camPos = { x: plane.x, y: plane.y, z: plane.z };
    const sp = makeProject(camPos, b)({ x: camPos.x + sunDir.x * 9000, y: camPos.y + sunDir.y * 9000, z: camPos.z + sunDir.z * 9000 });
    if (sp && sky.sunElev > 0) {
      const glow = ctx.createRadialGradient(sp.x, sp.y, 4, sp.x, sp.y, 150);
      glow.addColorStop(0, 'rgba(255,250,220,0.95)');
      glow.addColorStop(0.25, 'rgba(255,220,140,0.55)');
      glow.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 150, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.sunCore;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 26, 0, Math.PI * 2); ctx.fill();
    } else if (sp) {
      ctx.fillStyle = PALETTE.moon;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(200,210,230,0.5)';
      ctx.beginPath(); ctx.arc(sp.x - 6, sp.y - 4, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sp.x + 7, sp.y + 6, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawSeaAndTerrain(plane, sky, project, camPos) {
    // Sea: everything below the horizon line, drawn before the terrain mesh.
    const b = basis();
    const horizonP = project({ x: camPos.x + b.f.x * 9000, y: camPos.y, z: camPos.z + b.f.z * 9000 });
    const hy = horizonP ? horizonP.y : view.h * 0.55;
    ctx.save();
    ctx.translate(view.w / 2, hy);
    ctx.rotate((cam.roll * Math.PI) / 180);
    const sea = ctx.createLinearGradient(0, 0, 0, view.h);
    sea.addColorStop(0, sky.low);
    sea.addColorStop(0.12, rgb(mixc(C.seaShallow, parseColor(sky.low), 0.4)));
    sea.addColorStop(1, rgb(C.seaDeep));
    ctx.fillStyle = sea;
    ctx.fillRect(-view.w, 0, view.w * 2, view.h * 2);
    // Sun glitter on the water.
    if (sky.sunElev > 0.05) {
      ctx.fillStyle = 'rgba(255,240,200,0.20)';
      for (let i = 0; i < 26; i += 1) {
        const gx = ((i * 173) % 900) - 450 + Math.sin(plane.elapsed * 0.7 + i) * 30;
        const gy = 18 + ((i * 61) % 220);
        ctx.fillRect(gx - 26, gy, 52 + ((i * 29) % 60), 2.5);
      }
    }
    ctx.restore();

    // Terrain fan ahead of the aircraft.
    const hd = (plane.heading * Math.PI) / 180;
    const fwd = { x: Math.sin(hd), z: -Math.cos(hd) };
    const right = { x: Math.cos(hd), z: Math.sin(hd) };
    const fogRgb = parseColor(sky.low);
    const skyInfo = { fog: fogRgb };
    const grid = [];
    for (let ri = 0; ri < ROWS.length; ri += 1) {
      const dist = ROWS[ri];
      const half = dist * 0.9;
      const row = [];
      for (let ci = 0; ci < COLS; ci += 1) {
        const lat = -half + (2 * half * ci) / (COLS - 1);
        const wx = plane.x + fwd.x * dist + right.x * lat;
        const wz = plane.z + fwd.z * dist + right.z * lat;
        const h = groundHeight(wx, wz);
        // Per-vertex texture jitter so hills read as ground, not flat paint.
        const jitter = (fbmNoise(wx * 0.011, wz * 0.011) - 0.5) * 36;
        row.push({ p: project({ x: wx, y: h, z: wz }), h, dist, jitter });
      }
      grid.push(row);
    }
    for (let ri = ROWS.length - 2; ri >= 0; ri -= 1) {
      for (let ci = 0; ci < COLS - 1; ci += 1) {
        const a = grid[ri][ci], bq = grid[ri][ci + 1], c = grid[ri + 1][ci + 1], d = grid[ri + 1][ci];
        if (!a.p || !bq.p || !c.p || !d.p) continue;
        const slope = Math.abs(c.h - a.h) / Math.max(40, c.dist - a.dist) * 60;
        const hAvg = (a.h + bq.h + c.h + d.h) / 4 + (a.jitter + bq.jitter + c.jitter + d.jitter) / 4;
        const dAvg = (a.dist + c.dist) / 2;
        ctx.fillStyle = terrainColor(hAvg, slope, dAvg, skyInfo);
        ctx.beginPath();
        ctx.moveTo(a.p.x, a.p.y); ctx.lineTo(bq.p.x, bq.p.y);
        ctx.lineTo(c.p.x, c.p.y); ctx.lineTo(d.p.x, d.p.y);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  function drawRunways(plane, project) {
    for (const ap of AIRPORTS) {
      const dx = ap.x - plane.x, dz = ap.z - plane.z;
      if (dx * dx + dz * dz > 6500 * 6500) continue;
      const corners = runwayCorners(ap).map((c) => project(c));
      if (corners.some((c) => !c)) continue;
      ctx.fillStyle = '#2e3238';
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 4; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
      ctx.closePath(); ctx.fill();
      // Centreline dashes + threshold bars.
      const hd = (ap.heading * Math.PI) / 180;
      const fwd = { x: Math.sin(hd), z: -Math.cos(hd) };
      ctx.fillStyle = PALETTE.runwayLine;
      for (let s = -ap.length / 2 + 90; s < ap.length / 2 - 60; s += 90) {
        const p1 = project({ x: ap.x + fwd.x * s, y: ap.elev + 1.6, z: ap.z + fwd.z * s });
        const p2 = project({ x: ap.x + fwd.x * (s + 42), y: ap.elev + 1.6, z: ap.z + fwd.z * (s + 42) });
        if (!p1 || !p2) continue;
        ctx.beginPath();
        ctx.moveTo(p1.x - 1.5, p1.y); ctx.lineTo(p2.x - 1.5, p2.y);
        ctx.lineTo(p2.x + 1.5, p2.y); ctx.lineTo(p1.x + 1.5, p1.y);
        ctx.closePath(); ctx.fill();
      }
      // Runway number at the near threshold (only when close enough to read).
      const numP = project({ x: ap.x - fwd.x * (ap.length / 2 - 70), y: ap.elev + 2, z: ap.z - fwd.z * (ap.length / 2 - 70) });
      if (numP && numP.d < 3500) {
        const num = String(Math.round(ap.heading / 10) % 36).padStart(2, '0');
        ctx.fillStyle = PALETTE.runwayNum;
        ctx.font = `bold ${Math.max(10, Math.min(30, 3000 / Math.max(200, numP.d) * 8))}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(num, numP.x, numP.y);
      }
      // Edge lines so the strip reads at dusk and night, not just by day.
      ctx.strokeStyle = 'rgba(245,245,232,0.75)';
      ctx.lineWidth = 1.5;
      for (const side of [-1, 1]) {
        const right = { x: Math.cos(hd), z: Math.sin(hd) };
        const e1 = project({ x: ap.x - fwd.x * ap.length / 2 + right.x * side * (ap.width / 2 - 1), y: ap.elev + 1.7, z: ap.z - fwd.z * ap.length / 2 + right.z * side * (ap.width / 2 - 1) });
        const e2 = project({ x: ap.x + fwd.x * ap.length / 2 + right.x * side * (ap.width / 2 - 1), y: ap.elev + 1.7, z: ap.z + fwd.z * ap.length / 2 + right.z * side * (ap.width / 2 - 1) });
        if (!e1 || !e2) continue;
        ctx.beginPath(); ctx.moveTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y); ctx.stroke();
      }
      // Runway edge lights at night / dusk.
      if (ap.lights) {
        ctx.fillStyle = '#9fe8ff';
        for (let s = -ap.length / 2; s <= ap.length / 2; s += 160) {
          for (const side of [-1, 1]) {
            const right = { x: Math.cos(hd), z: Math.sin(hd) };
            const p = project({ x: ap.x + fwd.x * s + right.x * side * (ap.width / 2 + 2), y: ap.elev + 2.5, z: ap.z + fwd.z * s + right.z * side * (ap.width / 2 + 2) });
            if (!p) continue;
            ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, 2600 / p.d), 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }
  }

  function drawBuildings(plane, project, sky) {
    for (const bld of buildings) {
      const dx = bld.x - plane.x, dz = bld.z - plane.z;
      if (dx * dx + dz * dz > 3200 * 3200) continue;
      const base = project({ x: bld.x, y: bld.y, z: bld.z });
      const top = project({ x: bld.x, y: bld.y + bld.h, z: bld.z });
      if (!base || !top) continue;
      const wpx = Math.max(2, Math.abs(top.y - base.y) * (bld.w / Math.max(6, bld.h)));
      const shade = 0.75 + 0.25 * sky.daylight;
      const cols = [['#d8c9a8', '#b8a888'], ['#c9d6de', '#a9b6be'], ['#e0b48f', '#c09468']];
      const col = cols[bld.hue];
      ctx.fillStyle = col[1];
      ctx.fillRect(base.x - wpx / 2, top.y, wpx, base.y - top.y);
      ctx.fillStyle = col[0];
      ctx.beginPath();
      ctx.moveTo(base.x - wpx / 2, top.y); ctx.lineTo(base.x, top.y - 6);
      ctx.lineTo(base.x + wpx / 2, top.y); ctx.lineTo(base.x + wpx / 2, top.y + 4);
      ctx.lineTo(base.x - wpx / 2, top.y + 4); ctx.closePath(); ctx.fill();
      if (sky.night > 0.5) {
        ctx.fillStyle = 'rgba(255,210,110,0.9)';
        ctx.fillRect(base.x - wpx / 4, top.y + 6, 3, 4);
      }
    }
    // Lighthouses with a sweeping beam at night.
    for (const lh of LIGHTHOUSES) {
      const gy = groundHeight(lh.x, lh.z);
      const base = project({ x: lh.x, y: gy, z: lh.z });
      const top = project({ x: lh.x, y: gy + 42, z: lh.z });
      if (!base || !top) continue;
      const w = Math.max(3, Math.abs(top.y - base.y) * 0.22);
      ctx.fillStyle = '#e8e4da';
      ctx.fillRect(base.x - w / 2, top.y, w, base.y - top.y);
      ctx.fillStyle = '#c23b2e';
      ctx.fillRect(base.x - w / 2, top.y + (base.y - top.y) * 0.4, w, 5);
      if (sky.night > 0.35) {
        const ang = plane.elapsed * 0.9;
        const beamLen = 420;
        const tip = project({ x: lh.x + Math.cos(ang) * beamLen, y: gy + 40, z: lh.z + Math.sin(ang) * beamLen });
        if (tip) {
          ctx.fillStyle = `rgba(255,240,180,${0.22 * sky.night})`;
          ctx.beginPath();
          ctx.moveTo(top.x, top.y); ctx.lineTo(tip.x, tip.y - 8); ctx.lineTo(tip.x, tip.y + 8);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = '#fff6c8';
        ctx.beginPath(); ctx.arc(top.x, top.y, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawRings(rings, activeIdx, project, plane) {
    for (let i = 0; i < rings.length; i += 1) {
      const ring = rings[i];
      if (i < activeIdx) continue; // passed rings are gone
      const dx = ring.x - plane.x, dy = ring.y - plane.y, dz = ring.z - plane.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > 9000) continue;
      const centre = project(ring);
      if (!centre) continue;
      // Ring plane faces the aircraft.
      const toRing = { x: dx / dist, y: dy / dist, z: dz / dist };
      const side = { x: -toRing.z, y: 0, z: toRing.x };
      const sl = Math.hypot(side.x, side.z) || 1;
      side.x /= sl; side.z /= sl;
      const up = { x: -toRing.y * side.z, y: side.x * toRing.z - side.z * toRing.x, z: toRing.y * side.x };
      const ul = Math.hypot(up.x, up.y, up.z) || 1;
      up.x /= ul; up.y /= ul; up.z /= ul;
      const pts = [];
      for (let k = 0; k <= 20; k += 1) {
        const a = (k / 20) * Math.PI * 2;
        const p = project({
          x: ring.x + side.x * Math.cos(a) * ring.r + up.x * Math.sin(a) * ring.r,
          y: ring.y + up.y * Math.sin(a) * ring.r,
          z: ring.z + side.z * Math.cos(a) * ring.r + up.z * Math.sin(a) * ring.r,
        });
        pts.push(p);
      }
      const isActive = i === activeIdx;
      const pulse = isActive ? 0.75 + 0.25 * Math.sin(plane.elapsed * 5) : 0.5;
      ctx.save();
      ctx.globalAlpha = isActive ? 0.95 : 0.55;
      ctx.strokeStyle = isActive ? `rgba(255,214,64,${pulse})` : 'rgba(160,200,235,0.8)';
      ctx.lineWidth = isActive ? Math.max(2.5, 900 / dist * 2.2) : 2;
      ctx.shadowColor = isActive ? '#ffb347' : 'transparent';
      ctx.shadowBlur = isActive ? 14 : 0;
      ctx.beginPath();
      for (let k = 0; k < pts.length; k += 1) {
        if (!pts[k]) continue;
        if (k === 0) ctx.moveTo(pts[k].x, pts[k].y); else ctx.lineTo(pts[k].x, pts[k].y);
      }
      ctx.closePath(); ctx.stroke();
      ctx.restore();
      if (isActive && dist < 4000) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(12, Math.min(26, 6000 / dist * 5))}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(`${ring.label} — ${Math.round(dist)} m`, centre.x, centre.y - ring.r * 0.35 - 14);
      }
    }
  }

  function drawClouds(weather, project, sky) {
    for (const c of weather.state.clouds) {
      const p = project({ x: c.x, y: c.y, z: c.z });
      if (!p || p.d > 14000) continue;
      const scale = (view.focal * c.r) / p.d;
      if (scale < 8) continue;
      const alpha = (0.16 + 0.5 * c.shade) * (0.35 + 0.65 * sky.daylight) * weather.state.preset.clouds * 2.2;
      const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, scale);
      const tint = sky.night > 0.5 ? '40,50,80' : '255,255,255';
      g.addColorStop(0, `rgba(${tint},${Math.min(0.85, alpha)})`);
      g.addColorStop(0.7, `rgba(${tint},${alpha * 0.5})`);
      g.addColorStop(1, `rgba(${tint},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, scale, scale * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTraffic(plane, project, elapsed) {
    // One AI courier on a circuit around Arunika, for life in the sky.
    const a = elapsed * 0.045;
    const tx = Math.cos(a) * 2600, tz = Math.sin(a) * 2600 - 400;
    const ty = 620 + Math.sin(a * 2.3) * 60;
    const p = project({ x: tx, y: ty, z: tz });
    if (!p || p.d > 6000) return;
    const s = Math.max(2, 2600 / p.d * 3.2);
    ctx.fillStyle = 'rgba(40,44,52,0.9)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s * 2.4, s * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(p.x - s * 0.4, p.y - s * 2.6, s * 0.8, s * 5.2);
    ctx.fillRect(p.x - s * 3.4, p.y - s * 0.3, s * 6.8, s * 0.5);
  }

  function drawVolcanoSmoke(project, plane) {
    const mx = -3800, mz = -4200;
    const dx = mx - plane.x, dz = mz - plane.z;
    if (dx * dx + dz * dz > 9000 * 9000) return;
    for (let i = 0; i < 9; i += 1) {
      const t = ((plane.elapsed * 0.12 + i / 9) % 1);
      const px = mx + Math.sin(i * 2.1) * 60 + t * 320;
      const py = 920 + t * 420;
      const pz = mz + Math.cos(i * 1.7) * 60 + t * 120;
      const p = project({ x: px, y: py, z: pz });
      if (!p) continue;
      const r = 26 + t * 90;
      const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r);
      g.addColorStop(0, `rgba(120,116,112,${0.4 * (1 - t)})`);
      g.addColorStop(1, 'rgba(120,116,112,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawRain(weather) {
    if (weather.state.preset.rain <= 0) return;
    ctx.strokeStyle = 'rgba(200,220,240,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 70; i += 1) {
      const x = ((i * 197.3 + planeRef.x * 0.05) % view.w + view.w) % view.w;
      const y = ((i * 89.7 + planeRef.elapsed * 900) % (view.h + 40)) - 20;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y + 16);
    }
    ctx.stroke();
  }

  let planeRef = null;

  /**
   * Paint one frame of the world. `world` carries the plane, weather, sky,
   * mission rings, camera mode and particles. HUD and menus are drawn by hud.js.
   */
  function drawWorld(world) {
    const { plane, weather, sky, rings, activeRing, cameraMode } = world;
    planeRef = plane;
    updateCamera(plane, 1 / 60);
    const b = basis();
    const hd = (cam.heading * Math.PI) / 180;
    const pc = Math.cos((cam.pitch * Math.PI) / 180);
    const f = { x: Math.sin(hd) * pc, y: Math.sin((cam.pitch * Math.PI) / 180), z: -Math.cos(hd) * pc };
    const camPos = cameraMode === 'cockpit'
      ? { x: plane.x + f.x * 2.2, y: plane.y + 1.4, z: plane.z + f.z * 2.2 }
      : { x: plane.x - f.x * 13.5, y: plane.y - Math.sin((cam.pitch * Math.PI) / 180) * 13.5 + 4.4, z: plane.z - f.z * 13.5 };
    const project = makeProject(camPos, b);
    drawSky(plane, sky, world.hour);
    drawSeaAndTerrain(plane, sky, project, camPos);
    drawRunways(plane, project);
    drawBuildings(plane, project, sky);
    drawVolcanoSmoke(project, plane);
    drawRings(rings, activeRing, project, plane);
    drawClouds(weather, project, sky);
    drawTraffic(plane, project, plane.elapsed);
    if (cameraMode === 'chase' && world.showAircraft !== false) drawChasePlane(ctx, view, plane, plane.elapsed);
    else if (cameraMode === 'cockpit') drawCockpitPanel(ctx, view, plane);
    drawRain(weather);
  }

  return { drawWorld, resize, view };
}
