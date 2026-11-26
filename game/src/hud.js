// The HUD and every menu screen, drawn on the same canvas as the world:
// flight instruments, compass tape, fuel and damage, objective tracker,
// minimap, warnings — and the title, hangar, mission map, briefing, debrief
// and logbook. Each draw returns the clickable zones on screen.
import { AIRCRAFT, AIRPORTS, ISLANDS, PALETTE, FONT, WEATHER } from './config.js';
import { groundHeight } from './terrain.js';
import { missionById, MISSIONS } from './missions.js';

const W = 1280, H = 720;

function panel(ctx, x, y, w, h, alpha = 0.72) {
  ctx.fillStyle = `rgba(12,18,28,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,170,200,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}
function text(ctx, s, x, y, size, color, align = 'left', weight = 'bold') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}
function bar(ctx, x, y, w, h, frac, color, bg = 'rgba(255,255,255,0.14)') {
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x, y, w * Math.max(0, Math.min(1, frac)), h, 4); ctx.fill();
}
function clamp(v, a, b) { return Math.max(a, Math.min(1, (v - a) / (b - a))); }

/** Bearing (deg) from the plane to a world point. */
function bearingTo(plane, x, z) {
  return (Math.atan2(x - plane.x, -(z - plane.z)) * 180 / Math.PI + 360) % 360;
}
function distTo(plane, x, z) { return Math.hypot(x - plane.x, z - plane.z); }

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  let zones = [];
  function zone(x, y, w, h, action) { zones.push({ x, y, w, h, action }); return { x, y, w, h }; }
  function resetZones() { zones = []; }

  function drawCompass(plane, objective) {
    const cx = W / 2, y = 26;
    panel(ctx, cx - 230, 8, 460, 44, 0.6);
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - 225, 10, 450, 40); ctx.clip();
    const span = 90; // degrees visible
    for (let d = -span; d <= span; d += 5) {
      const hdg = (Math.round(plane.heading) + d + 360) % 360;
      const x = cx + (d / span) * 225;
      const major = hdg % 30 === 0;
      ctx.strokeStyle = major ? '#eef3f8' : 'rgba(238,243,248,0.4)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, y + (major ? 16 : 10)); ctx.stroke();
      if (major) {
        const label = hdg === 0 ? 'N' : hdg === 90 ? 'E' : hdg === 180 ? 'S' : hdg === 270 ? 'W' : String(hdg).padStart(3, '0');
        text(ctx, label, x, y + 30, 12, '#eef3f8', 'center');
      }
    }
    ctx.restore();
    // Centre marker + current heading.
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.moveTo(cx, y - 2); ctx.lineTo(cx - 6, y - 12); ctx.lineTo(cx + 6, y - 12); ctx.closePath(); ctx.fill();
    text(ctx, String(Math.round(plane.heading)).padStart(3, '0') + '°', cx, 68, 15, PALETTE.gold, 'center');
    // Waypoint marker on the tape.
    if (objective) {
      const b = bearingTo(plane, objective.x, objective.z);
      let rel = b - plane.heading;
      while (rel > 180) rel -= 360;
      while (rel < -180) rel += 360;
      if (Math.abs(rel) < span) {
        const x = cx + (rel / span) * 225;
        ctx.fillStyle = '#58d68d';
        ctx.beginPath(); ctx.moveTo(x, y + 34); ctx.lineTo(x - 6, y + 26); ctx.lineTo(x + 6, y + 26); ctx.closePath(); ctx.fill();
      }
    }
  }

  function drawMinimap(plane, rings, activeRing, x, y, w, h, showRings = true) {
    panel(ctx, x - 6, y - 6, w + 12, h + 12, 0.6);
    // Fit the whole archipelago (about 15.5 km across) inside the box.
    const scale = Math.min(w, h) / 15500;
    const cx = x + w / 2, cy = y + h / 2;
    const px = (wx) => cx + wx * scale;
    const pz = (wz) => cy + (wz + 500) * scale;
    // Sea + islands.
    ctx.fillStyle = 'rgba(20,70,110,0.9)';
    ctx.fillRect(x, y, w, h);
    for (const isl of ISLANDS) {
      ctx.fillStyle = isl.volcano ? '#8a6b52' : '#3f7a44';
      ctx.beginPath(); ctx.arc(px(isl.x), pz(isl.z), Math.max(3, isl.radius * scale), 0, Math.PI * 2); ctx.fill();
    }
    // Airports.
    for (const ap of AIRPORTS) {
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath(); ctx.arc(px(ap.x), pz(ap.z), 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#eef3f8';
      ctx.font = `bold 9px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(ap.code, px(ap.x) + 5, pz(ap.z) + 3);
    }
    // Rings.
    if (showRings) {
      rings.forEach((r, i) => {
        ctx.strokeStyle = i === activeRing ? '#ffd640' : 'rgba(160,200,235,0.7)';
        ctx.lineWidth = i === activeRing ? 2 : 1;
        ctx.beginPath(); ctx.arc(px(r.x), pz(r.z), Math.max(2, r.r * scale), 0, Math.PI * 2); ctx.stroke();
      });
    }
    // Aircraft.
    ctx.save();
    ctx.translate(px(plane.x), pz(plane.z));
    ctx.rotate((plane.heading * Math.PI) / 180);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    text(ctx, 'N', x + w - 8, y + 12, 10, '#9fb0c3', 'right');
  }

  function drawPlay(game) {
    resetZones();
    const { plane, mission, objectiveIndex, objectives, message, messageUntil, elapsed } = game;
    const ac = plane.aircraft;
    const kt = plane.speed * 1.94384;
    const altFt = plane.y * 3.28084;
    const aglFt = (plane.y - groundHeight(plane.x, plane.z)) * 3.28084;
    const obj = objectives[objectiveIndex] ?? null;

    // Left instruments.
    panel(ctx, 12, 12, 250, 108, 0.62);
    text(ctx, 'SPD', 28, 36, 12, '#9fb0c3');
    text(ctx, `${Math.round(kt)}`, 28, 66, 30, '#eef3f8');
    text(ctx, 'KT', 108, 66, 13, '#9fb0c3');
    text(ctx, 'ALT', 28, 94, 12, '#9fb0c3');
    text(ctx, `${Math.round(altFt)}`, 70, 94, 17, '#eef3f8');
    text(ctx, 'FT', 148, 94, 11, '#9fb0c3');
    text(ctx, 'VS', 168, 94, 12, '#9fb0c3');
    text(ctx, `${plane.vspeed >= 0 ? '+' : ''}${Math.round(plane.vspeed * 196.85)}`, 196, 94, 13, plane.vspeed < -8 ? '#ff5a4e' : '#7fe3ff');
    text(ctx, `AGL ${Math.round(aglFt)} FT`, 28, 112, 11, '#9fb0c3');

    drawCompass(plane, obj);

    // Right systems: throttle, fuel and airframe bars, plus the wind the
    // pilot is actually fighting and the engine temperature the throttle earns.
    panel(ctx, W - 262, 12, 250, 136, 0.62);
    const wind = game.weather.state.preset;
    const windKt = Math.round(wind.windSpeed * 1.94384);
    text(ctx, 'THR', W - 246, 36, 12, '#9fb0c3');
    text(ctx, `${Math.round(plane.throttle * 100)}%`, W - 246, 62, 20, '#eef3f8');
    text(ctx, 'FUEL', W - 246, 82, 12, '#9fb0c3');
    bar(ctx, W - 190, 72, 110, 10, plane.fuel / ac.fuelCap, plane.fuel / ac.fuelCap < 0.2 ? '#ff5a4e' : '#ffb347');
    text(ctx, `${Math.round(plane.fuel)} kg`, W - 76, 82, 11, '#eef3f8', 'right');
    text(ctx, 'AIRFRAME', W - 246, 102, 12, '#9fb0c3');
    bar(ctx, W - 190, 92, 110, 10, 1 - plane.damage / 100, plane.damage > 50 ? '#ff5a4e' : plane.damage > 20 ? '#ffb347' : '#58d68d');
    text(ctx, `${Math.round(100 - plane.damage)}%`, W - 76, 102, 11, '#eef3f8', 'right');
    text(ctx, 'WIND', W - 246, 124, 12, '#9fb0c3');
    text(ctx, `${windKt} kt from ${String(wind.windFrom).padStart(3, '0')}°`, W - 190, 124, 12, '#7fe3ff');
    text(ctx, 'ENG', W - 246, 142, 12, '#9fb0c3');
    text(ctx, `${Math.round(plane.engineTemp)}°C`, W - 190, 142, 12, plane.engineTemp > 85 ? '#ff9f43' : '#7fe3ff');

    // Objective tracker. In the cockpit the panel owns the bottom of the
    // screen, so the tracker becomes a compact bar under the compass instead.
    const cockpit = game.cameraMode === 'cockpit';
    if (cockpit) {
      panel(ctx, W / 2 - 330, 128, 660, 44, 0.7);
      if (obj) {
        text(ctx, `${mission.name} — ${obj.label}`, W / 2 - 314, 156, 15, '#eef3f8');
        text(ctx, `SCORE ${game.score} · ${fmtTime(game.missionElapsed)} / ${fmtTime(mission.timeLimit)}`, W / 2 + 314, 156, 13, '#9fb0c3', 'right');
      }
    } else {
    panel(ctx, 12, H - 158, 330, 146, 0.62);
    text(ctx, mission.name.toUpperCase(), 28, H - 130, 13, PALETTE.gold);
    text(ctx, `Objective ${Math.min(objectiveIndex + 1, objectives.length)} / ${objectives.length}`, 28, H - 112, 12, '#9fb0c3');
    if (obj) {
      text(ctx, obj.label, 28, H - 88, 15, '#eef3f8');
      if (obj.kind === 'ring' || obj.kind === 'land') {
        const tx = obj.kind === 'ring' ? obj.x : (AIRPORTS.find((a) => a.id === obj.airport)?.x ?? 0);
        const tz = obj.kind === 'ring' ? obj.z : (AIRPORTS.find((a) => a.id === obj.airport)?.z ?? 0);
        const d = distTo(plane, tx, tz);
        const b = bearingTo(plane, tx, tz);
        let rel = b - plane.heading;
        while (rel > 180) rel -= 360;
        while (rel < -180) rel += 360;
        // Waypoint arrow.
        ctx.save();
        ctx.translate(52, H - 44);
        ctx.rotate((rel * Math.PI) / 180);
        ctx.fillStyle = '#58d68d';
        ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 10); ctx.lineTo(0, 4); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill();
        ctx.restore();
        text(ctx, `${(d / 1000).toFixed(1)} km  ·  ${String(Math.round(b)).padStart(3, '0')}°`, 78, H - 38, 14, '#eef3f8');
        text(ctx, `Time ${fmtTime(game.missionElapsed)} / ${fmtTime(mission.timeLimit)}`, 28, H - 20, 12, game.missionElapsed > mission.timeLimit * 0.8 ? '#ff9f43' : '#9fb0c3');
      }
    }
    } // end chase-view tracker

    // Gear / flaps chips (chase view only — the cockpit panel shows them).
    if (!cockpit) {
      text(ctx, `GEAR ${plane.gear || ac.gearFixed ? 'DOWN' : 'UP'}  ·  FLAPS ${Math.round(plane.flaps * 100)}%  ·  CHASE (C)`, 28, H - 168, 11, '#9fb0c3');
      // Minimap, bottom-right.
      drawMinimap(plane, objectives.filter((o) => o.kind === 'ring'), objectiveIndex, W - 222, H - 168, 200, 140);
    }

    // Warnings, centre.
    const warns = [];
    if (plane.stallWarn) warns.push(['STALL — NOSE DOWN, POWER UP', '#ff5a4e']);
    if (plane.overSpeed) warns.push(['OVERSPEED — THROTTLE BACK', '#ff5a4e']);
    if (!plane.onGround && aglFt < 300 && plane.vspeed < -6) warns.push(['PULL UP', '#ff9f43']);
    if (plane.fuel / ac.fuelCap < 0.15) warns.push(['LOW FUEL', '#ff9f43']);
    if (!plane.onGround && aglFt < 800 && !plane.gear && !ac.gearFixed) warns.push(['GEAR UP — PRESS G', '#ff9f43']);
    if (warns.length && Math.floor(elapsed * 2.4) % 2 === 0) {
      const [msg, color] = warns[0];
      text(ctx, msg, W / 2, H * 0.3, 26, color, 'center');
    }
    // Toast message.
    if (message && elapsed < messageUntil) {
      panel(ctx, W / 2 - 260, 84, 520, 40, 0.72);
      text(ctx, message, W / 2, 110, 16, '#eef3f8', 'center');
    }
    // Score strip (chase view; the cockpit bar already carries the score).
    if (!cockpit) text(ctx, `SCORE ${game.score}  ·  CREDITS ${game.credits} cr`, W / 2, H - 14, 13, '#eef3f8', 'center');
    return zones;
  }

  function menuFrame(title, subtitle) {
    ctx.fillStyle = 'rgba(6,10,18,0.72)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, title, W / 2, 92, 44, '#eef3f8', 'center');
    if (subtitle) text(ctx, subtitle, W / 2, 124, 16, '#9fb0c3', 'center');
  }

  function menuButton(label, x, y, w, selected, action, sub) {
    panel(ctx, x, y, w, 46, selected ? 0.92 : 0.6);
    if (selected) { ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, w, 46, 10); ctx.stroke(); }
    text(ctx, label, x + w / 2, y + 29, 18, selected ? PALETTE.gold : '#eef3f8', 'center');
    if (sub) text(ctx, sub, x + w - 14, y + 29, 12, '#9fb0c3', 'right');
    zone(x, y, w, 46, action);
  }

  function drawTitle(game) {
    resetZones();
    ctx.fillStyle = 'rgba(6,10,18,0.35)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'KELANA SKY COURIER', W / 2, 150, 58, '#eef3f8', 'center');
    text(ctx, 'A bush-pilot courier across a volcanic archipelago', W / 2, 192, 19, '#f7c873', 'center');
    text(ctx, '3 aircraft  ·  6 island airports  ·  12 missions  ·  fuel, damage, wind, weather & night flying', W / 2, 224, 15, '#9fb0c3', 'center');
    const items = [
      ['FLY — choose a mission', 'fly', 'Enter'],
      ['HANGAR — choose your aircraft', 'hangar', ''],
      ['LOGBOOK — your flights so far', 'logbook', ''],
      ['HOW TO FLY', 'howto', ''],
    ];
    items.forEach((it, i) => menuButton(it[0], W / 2 - 260, 300 + i * 58, 520, game.menuIndex === i, it[1], it[2]));
    text(ctx, `Credits: ${game.credits} cr   ·   Missions completed: ${game.logbook.completed} / 12   ·   Best: ${game.logbook.bestScore} pts`, W / 2, 580, 14, '#9fb0c3', 'center');
    text(ctx, 'Arrows / WASD fly · Shift/Ctrl throttle · F flaps · G gear · C camera · M sound · P pause', W / 2, 610, 13, '#9fb0c3', 'center');
    text(ctx, 'An original game by Kelana Aero Works — no real aircraft, places or games copied.', W / 2, 640, 12, '#6b7a8c', 'center');
    return zones;
  }

  function drawHangar(game) {
    resetZones();
    menuFrame('HANGAR', 'Pick your aircraft — each one flies differently');
    AIRCRAFT.forEach((ac, i) => {
      const x = 110 + i * 370, y = 160, w = 340, h = 330;
      panel(ctx, x, y, w, h, game.aircraftIndex === i ? 0.92 : 0.6);
      if (game.aircraftIndex === i) { ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.stroke(); }
      // Livery swatch + mini top-down silhouette.
      ctx.fillStyle = ac.livery;
      ctx.fillRect(x + 24, y + 24, 60, 14);
      ctx.fillStyle = ac.livery2;
      ctx.fillRect(x + 24, y + 42, 60, 6);
      ctx.save();
      ctx.translate(x + w / 2, y + 120);
      ctx.fillStyle = '#dfe6ec';
      ctx.beginPath(); ctx.ellipse(0, 0, 16, 62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ac.livery;
      ctx.fillRect(-92, -8, 184, 16);
      ctx.fillRect(-26, 40, 52, 12);
      ctx.fillStyle = '#16222e';
      ctx.beginPath(); ctx.ellipse(0, -38, 9, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      text(ctx, ac.name, x + 24, y + 210, 22, '#eef3f8');
      text(ctx, `${ac.kind} — ${ac.maker}`, x + 24, y + 234, 13, '#9fb0c3');
      text(ctx, ac.desc, x + 24, y + 258, 12, '#c8d4e0');
      const stats = [
        ['Top speed', ac.maxSpeed / 148],
        ['Climb', ac.climbRate / 14],
        ['Fuel', ac.fuelCap / 420],
        ['Agility', ac.rollRate / 2.4],
      ];
      stats.forEach((s, j) => {
        text(ctx, s[0], x + 24, y + 282 + j * 14, 11, '#9fb0c3');
        bar(ctx, x + 110, y + 272 + j * 14, 170, 8, s[1], '#7fe3ff');
      });
      zone(x, y, w, h, `aircraft:${i}`);
    });
    menuButton('← BACK', 110, 520, 200, false, 'back');
    menuButton('FLY THIS AIRCRAFT →', W - 310, 520, 200, false, 'fly');
    text(ctx, '← → to choose · Enter to fly', W / 2, 590, 13, '#9fb0c3', 'center');
    return zones;
  }

  function drawMap(game) {
    resetZones();
    menuFrame('CHOOSE A MISSION', 'Twelve sorties across the archipelago — gold, silver and bronze medals for fast, clean flying');
    const listX = 90, listY = 150, rowH = 40;
    MISSIONS.forEach((m, i) => {
      const y = listY + i * rowH;
      const done = game.logbook.missions[m.id];
      const sel = game.missionIndex === i;
      panel(ctx, listX, y, 640, 34, sel ? 0.92 : 0.5);
      if (sel) { ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(listX, y, 640, 34, 8); ctx.stroke(); }
      text(ctx, `${String(i + 1).padStart(2, '0')}  ${m.name}`, listX + 12, y + 22, 15, sel ? PALETTE.gold : '#eef3f8');
      text(ctx, m.type, listX + 330, y + 22, 12, '#9fb0c3');
      text(ctx, `${m.reward} cr`, listX + 470, y + 22, 12, PALETTE.gold);
      text(ctx, done ? `★ ${done.medal}` : '—', listX + 560, y + 22, 13, done ? '#f2c94c' : '#6b7a8c');
      zone(listX, y, 640, 34, `mission:${i}`);
    });
    // Right side: selected mission detail + island map.
    const m = MISSIONS[game.missionIndex];
    const dx = 770;
    panel(ctx, dx, listY, 420, 250, 0.6);
    text(ctx, m.name, dx + 18, listY + 30, 20, '#eef3f8');
    text(ctx, `${m.type} · ${WEATHER[m.weather].label} · ${m.time < 12 ? 'morning' : m.time < 17 ? 'day' : m.time < 19 ? 'golden hour' : 'night'}`, dx + 18, listY + 54, 12, '#9fb0c3');
    const words = m.brief.split(' ');
    let line = '', ly = listY + 84;
    for (const w of words) {
      if ((line + ' ' + w).length > 52) { text(ctx, line, dx + 18, ly, 13, '#c8d4e0'); line = w; ly += 18; }
      else line = line ? line + ' ' + w : w;
    }
    text(ctx, line, dx + 18, ly, 13, '#c8d4e0');
    ly += 34;
    text(ctx, `Aircraft: ${AIRCRAFT.find((a) => a.id === m.aircraft).name}`, dx + 18, ly, 13, '#eef3f8'); ly += 20;
    text(ctx, `Time limit: ${fmtTime(m.timeLimit)}  ·  Fuel at start: ${Math.round(m.fuelStart * 100)}%`, dx + 18, ly, 13, '#eef3f8'); ly += 20;
    text(ctx, `Medals: gold ≤ ${fmtTime(m.gold)} · silver ≤ ${fmtTime(m.silver)}`, dx + 18, ly, 13, '#eef3f8'); ly += 20;
    text(ctx, `${m.objectives.length} objectives`, dx + 18, ly, 13, '#eef3f8');
    drawMinimap(game.plane, m.objectives.filter((o) => o.kind === 'ring'), 0, dx, listY + 260, 420, 225, true);
    menuButton('← BACK', 90, 656, 160, false, 'back');
    menuButton('BRIEFING →', 1070, 656, 160, false, 'briefing');
    return zones;
  }

  function drawBriefing(game) {
    resetZones();
    const m = game.mission;
    menuFrame(m.name.toUpperCase(), `${m.type} mission · ${WEATHER[m.weather].label} · reward ${m.reward} credits`);
    panel(ctx, W / 2 - 360, 150, 720, 380, 0.7);
    let y = 190;
    text(ctx, 'BRIEF', W / 2 - 330, y, 13, PALETTE.gold); y += 26;
    const words = m.brief.split(' ');
    let line = '';
    for (const w of words) {
      if ((line + ' ' + w).length > 78) { text(ctx, line, W / 2 - 330, y, 15, '#eef3f8'); line = w; y += 22; }
      else line = line ? line + ' ' + w : w;
    }
    text(ctx, line, W / 2 - 330, y, 15, '#eef3f8'); y += 40;
    text(ctx, 'OBJECTIVES', W / 2 - 330, y, 13, PALETTE.gold); y += 24;
    m.objectives.forEach((o, i) => {
      text(ctx, `${i + 1}. ${o.label}`, W / 2 - 330, y, 14, '#c8d4e0');
      y += 20;
    });
    y += 14;
    const ac = AIRCRAFT.find((a) => a.id === game.aircraftId);
    text(ctx, `Aircraft: ${ac.name} (${ac.kind})`, W / 2 - 330, y, 14, '#eef3f8'); y += 22;
    text(ctx, `From: ${AIRPORTS.find((a) => a.id === m.start).name}  ·  Time limit ${fmtTime(m.timeLimit)}  ·  Fuel ${Math.round(m.fuelStart * 100)}%`, W / 2 - 330, y, 14, '#eef3f8'); y += 22;
    text(ctx, `Gold ≤ ${fmtTime(m.gold)} · Silver ≤ ${fmtTime(m.silver)} · Bronze: finish it`, W / 2 - 330, y, 14, '#9fb0c3');
    menuButton('← MISSIONS', W / 2 - 360, 556, 200, false, 'back');
    menuButton('FLY →', W / 2 + 160, 556, 200, false, 'start');
    text(ctx, 'Enter to fly · Esc to go back', W / 2, 630, 13, '#9fb0c3', 'center');
    return zones;
  }

  function drawDebrief(game) {
    resetZones();
    const d = game.debrief;
    const ok = d.outcome === 'success';
    menuFrame(ok ? 'MISSION COMPLETE' : d.outcome === 'crash' ? 'CRASHED' : 'MISSION FAILED',
      ok ? `${game.mission.name} — well flown, pilot` : d.outcome === 'crash' ? 'The airframe is a write-off. The pilot walked away.' : 'Out of time or out of fuel — the mission is over.');
    panel(ctx, W / 2 - 300, 160, 600, 330, 0.75);
    let y = 210;
    if (ok) {
      text(ctx, d.medal === 'gold' ? '★ GOLD MEDAL' : d.medal === 'silver' ? '★ SILVER MEDAL' : '★ BRONZE MEDAL', W / 2, y, 30, '#f2c94c', 'center');
      y += 46;
    }
    const rows = [
      ['Time', fmtTime(d.seconds)],
      ['Score', `${d.score} pts`],
      ['Credits earned', `+${d.credits} cr`],
      ['Damage taken', `${Math.round(d.damage)}%`],
      ['Fuel left', `${Math.round(d.fuel)} kg`],
      ['Rings flown', `${d.rings} / ${d.ringsTotal}`],
    ];
    rows.forEach(([k, v]) => {
      text(ctx, k, W / 2 - 240, y, 16, '#9fb0c3');
      text(ctx, v, W / 2 + 240, y, 16, '#eef3f8', 'right');
      y += 30;
    });
    menuButton('MISSIONS', W / 2 - 300, 516, 180, false, 'back');
    menuButton('FLY AGAIN', W / 2 - 90, 516, 180, false, 'start');
    menuButton('TITLE', W / 2 + 120, 516, 180, false, 'title');
    return zones;
  }

  function drawLogbook(game) {
    resetZones();
    const lb = game.logbook;
    menuFrame('LOGBOOK', 'Every sortie, medal and credit, kept in this browser');
    panel(ctx, 110, 150, 1060, 120, 0.65);
    const stats = [
      ['Missions flown', lb.flown],
      ['Completed', `${lb.completed} / 12`],
      ['Gold medals', lb.gold],
      ['Silver medals', lb.silver],
      ['Bronze medals', lb.bronze],
      ['Credits earned', `${lb.creditsEarned} cr`],
    ];
    stats.forEach((s, i) => {
      const x = 140 + i * 175;
      text(ctx, s[0], x, 190, 12, '#9fb0c3');
      text(ctx, String(s[1]), x, 226, 26, '#eef3f8');
    });
    MISSIONS.forEach((m, i) => {
      const done = lb.missions[m.id];
      const y = 300 + i * 28;
      text(ctx, `${String(i + 1).padStart(2, '0')}  ${m.name}`, 140, y, 14, '#eef3f8');
      text(ctx, m.type, 480, y, 13, '#9fb0c3');
      text(ctx, done ? `★ ${done.medal}  ·  ${fmtTime(done.seconds)}  ·  ${done.score} pts` : 'not flown yet', 700, y, 13, done ? '#f2c94c' : '#6b7a8c');
    });
    menuButton('← BACK', 110, 646, 160, false, 'back');
    return zones;
  }

  function drawPaused(game) {
    resetZones();
    drawPlay(game);
    ctx.fillStyle = 'rgba(6,10,18,0.6)';
    ctx.fillRect(0, 0, W, H);
    panel(ctx, W / 2 - 260, H / 2 - 110, 520, 220, 0.9);
    text(ctx, 'PAUSED', W / 2, H / 2 - 56, 34, '#eef3f8', 'center');
    text(ctx, `${game.mission.name} — ${fmtTime(game.missionElapsed)} elapsed`, W / 2, H / 2 - 18, 14, '#9fb0c3', 'center');
    menuButton('RESUME', W / 2 - 230, H / 2 + 10, 220, false, 'resume');
    menuButton('QUIT MISSION', W / 2 + 10, H / 2 + 10, 220, false, 'quit');
    text(ctx, 'P / Esc to resume', W / 2, H / 2 + 84, 13, '#9fb0c3', 'center');
    return zones;
  }

  function drawHowTo(game) {
    resetZones();
    menuFrame('HOW TO FLY', 'Six things to know before you leave the ground');
    panel(ctx, W / 2 - 360, 150, 720, 400, 0.7);
    const lines = [
      ['← → or A / D', 'Bank left and right — the bank turns the nose.'],
      ['↑ ↓ or W / S', 'Pitch down and up. Pull gently: a hard pull bleeds speed.'],
      ['Shift / Ctrl', 'Throttle up and down. Full throttle burns fuel fast.'],
      ['F — flaps · G — gear', 'Flaps slow you for landing; gear down before touchdown.'],
      ['C — camera · M — sound', 'Chase view or the lit cockpit panel.'],
      ['Landings', 'Touch down on a runway, slow and level, gear down.'],
      ['Fuel & damage', 'Empty tanks or 100% damage ends the sortie. Rings pay score.'],
      ['Mouse', 'Hold the mouse button and steer with the pointer.'],
    ];
    let y = 196;
    lines.forEach(([k, v]) => {
      text(ctx, k, W / 2 - 330, y, 15, PALETTE.gold);
      text(ctx, v, W / 2 - 90, y, 14, '#eef3f8');
      y += 34;
    });
    text(ctx, 'A stall warning means: nose down, full power, wings level.', W / 2, y + 20, 14, '#ff9f43', 'center');
    menuButton('← BACK', W / 2 - 100, 580, 200, false, 'back');
    return zones;
  }

  return { drawPlay, drawTitle, drawHangar, drawMap, drawBriefing, drawDebrief, drawLogbook, drawPaused, drawHowTo, get zones() { return zones; } };
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
