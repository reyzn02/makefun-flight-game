// Kelana Sky Courier — boot and the one loop. The game moves between screens
// (title, hangar, mission map, briefing, play, paused, debrief, logbook,
// how-to); the world advances in fixed 1/60 s steps and the renderer paints
// what is there. ?seed=N fixes the world. ?shot=start|play|cockpit|night|
// missions stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { AIRCRAFT, BEST_KEY, CREDITS_KEY, STEP, TIMES } from './config.js';
import { createRandom } from './random.js';
import { createWeather, skyFor } from './weather.js';
import { createPlane, stepPlane, EVENT_RING, EVENT_LANDED, EVENT_CRASHED, EVENT_TOUCHDOWN, EVENT_TAKEOFF, EVENT_STALL, EVENT_FUEL_EMPTY } from './physics.js';
import { MISSIONS, missionById, medalFor } from './missions.js';
import { createRenderer } from './render.js';
import { createHud, fmtTime } from './hud.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_GEAR, ACTION_FLAPS, ACTION_CAMERA, ACTION_MUTE, ACTION_RESET } from './input.js';
import { createAudio } from './audio.js';
import { stageShot, autopilotControl } from './shots.js';
import { airportById } from './terrain.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
void createRandom(seed);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const renderer = createRenderer(canvas);
const hud = createHud(canvas);
const input = createInput(canvas);
const audio = createAudio();

function loadLogbook() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* private window: fresh logbook */ }
  return { flown: 0, completed: 0, gold: 0, silver: 0, bronze: 0, creditsEarned: 0, bestScore: 0, missions: {} };
}
function loadCredits() {
  try { return Number.parseInt(window.localStorage.getItem(CREDITS_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveAll(game) {
  try {
    window.localStorage.setItem(BEST_KEY, JSON.stringify(game.logbook));
    window.localStorage.setItem(CREDITS_KEY, String(game.credits));
  } catch { /* storage off: the logbook lasts this visit only */ }
}

function announce(msg) { statusEl.textContent = msg; }

/** A demo plane that circles Arunika behind the menus, so the title never sits on a still image. */
function createDemoPlane() {
  const plane = createPlane(AIRCRAFT[0], 'arunika', 1);
  plane.x = -2200; plane.z = -800; plane.y = 560;
  plane.heading = 90; plane.speed = 52; plane.throttle = 0.6;
  plane.onGround = false; plane.airborne = true;
  return plane;
}

const game = {
  screen: 'title',
  menuIndex: 0,
  aircraftIndex: 0,
  aircraftId: 'pipit',
  missionIndex: 0,
  mission: MISSIONS[0],
  plane: createDemoPlane(),
  weather: createWeather('clear', TIMES.golden),
  hour: TIMES.golden,
  objectives: [],
  objectiveIndex: 0,
  score: 0,
  credits: loadCredits(),
  missionElapsed: 0,
  elapsed: 0,
  message: '',
  messageUntil: 0,
  cameraMode: 'chase',
  logbook: loadLogbook(),
  debrief: null,
  demoAngle: 0,
  stallBeepAt: 0,
};

game.sky = skyFor(game.hour);

function ringsForObjectives(objectives) {
  return objectives.filter((o) => o.kind === 'ring');
}

game.startMission = function startMission(mission, aircraftId) {
  const ac = AIRCRAFT.find((a) => a.id === aircraftId) ?? AIRCRAFT[0];
  game.mission = mission;
  game.aircraftId = ac.id;
  game.aircraftIndex = AIRCRAFT.indexOf(ac);
  game.plane = createPlane(ac, mission.start, mission.fuelStart);
  game.weather = createWeather(mission.weather, mission.time);
  game.hour = mission.time;
  game.sky = skyFor(mission.time);
  game.objectives = mission.objectives.map((o) => ({ ...o }));
  game.objectiveIndex = 0;
  game.score = 0;
  game.missionElapsed = 0;
  game.message = `${mission.name} — ${mission.objectives[0]?.label ?? ''}`;
  game.messageUntil = 8;
  game._fuelWarned = false;
  game.cameraMode = 'chase';
  game.screen = 'play';
  game.debrief = null;
  announce(`${mission.name}. ${mission.objectives[0]?.label ?? ''}`);
};

function currentObjective() { return game.objectives[game.objectiveIndex] ?? null; }

function finishMission(outcome) {
  const m = game.mission;
  const seconds = game.missionElapsed;
  const rings = game.objectives.filter((o) => o.kind === 'ring').length;
  const ringsDone = game.objectives.slice(0, game.objectiveIndex).filter((o) => o.kind === 'ring').length;
  let credits = 0, medal = 'bronze';
  if (outcome === 'success') {
    const timeBonus = Math.max(0, Math.round((m.timeLimit - seconds) * 2));
    game.score += timeBonus;
    medal = medalFor(m, seconds, game.plane.damage);
    credits = m.reward;
    game.credits += credits;
    game.logbook.completed += 1;
    game.logbook[medal] += 1;
    game.logbook.creditsEarned += credits;
    const prev = game.logbook.missions[m.id];
    if (!prev || seconds < prev.seconds) game.logbook.missions[m.id] = { medal, seconds: Math.round(seconds), score: game.score };
    if (game.score > game.logbook.bestScore) game.logbook.bestScore = game.score;
    audio.fanfare();
  } else if (outcome === 'crash') {
    audio.crash();
  }
  game.logbook.flown += 1;
  saveAll(game);
  game.debrief = {
    outcome, medal, credits, seconds: Math.round(seconds),
    score: game.score, damage: game.plane.damage,
    fuel: game.plane.fuel, rings: ringsDone, ringsTotal: rings,
  };
  game.screen = 'debrief';
  announce(outcome === 'success' ? `Mission complete. ${medal} medal, ${credits} credits.` : outcome === 'crash' ? 'Crashed.' : 'Mission failed.');
}

function stepPlay(dt) {
  const plane = game.plane;
  const steer = input.steering();
  const ctl = { pitch: steer.pitch, roll: steer.roll, throttle: steer.throttle };
  game.weather.step(dt);
  const events = stepPlane(plane, ctl, game.weather.windAt(), game.mission.cargo ?? 1, dt);
  game.missionElapsed += dt;
  game.elapsed += dt;

  if (events & EVENT_TAKEOFF) {
    const obj = currentObjective();
    if (obj?.kind === 'takeoff') {
      game.objectiveIndex += 1;
      game.score += 50;
      game.message = 'Airborne — ' + (currentObjective()?.label ?? 'fly on');
      game.messageUntil = game.elapsed + 4;
    }
  }
  if (events & EVENT_TOUCHDOWN) audio.touchdown();
  if (events & EVENT_STALL && game.elapsed > game.stallBeepAt) {
    audio.stall();
    game.stallBeepAt = game.elapsed + 0.5;
  }
  if (events & EVENT_FUEL_EMPTY && !game._fuelWarned) {
    game._fuelWarned = true;
    game.message = 'FUEL EMPTY — find a runway, now';
    game.messageUntil = game.elapsed + 5;
  }
  // Ring pass: inside the ring's radius.
  const obj = currentObjective();
  if (obj?.kind === 'ring') {
    const d = Math.hypot(obj.x - plane.x, obj.y - plane.y, obj.z - plane.z);
    if (d < obj.r) {
      game.objectiveIndex += 1;
      game.score += 100;
      audio.ring();
      game.message = `Ring cleared! ${game.score} pts — ${currentObjective()?.label ?? 'mission complete'}`;
      game.messageUntil = game.elapsed + 3.5;
    } else if (d < obj.r + 14) {
      plane.damage += 4; // clipped the rim
      game.message = 'Clipped the ring — check the airframe';
      game.messageUntil = game.elapsed + 2.5;
    }
  }
  if (events & EVENT_LANDED) {
    const landed = currentObjective();
    if (landed?.kind === 'land' && plane.landedAt === landed.airport) {
      game.objectiveIndex += 1;
      game.score += 200;
      game.message = `Down at ${airportById(landed.airport).name} — ${currentObjective()?.label ?? 'mission complete'}`;
      game.messageUntil = game.elapsed + 4;
    } else {
      const ap = airportById(plane.landedAt);
      game.message = ap ? `Landed at ${ap.name} — not the mission strip. Take off and try again.` : 'Landed off-strip.';
      game.messageUntil = game.elapsed + 4;
    }
  }
  if (events & EVENT_CRASHED) { finishMission('crash'); return; }
  if (game.objectiveIndex >= game.objectives.length) { finishMission('success'); return; }
  if (game.missionElapsed > game.mission.timeLimit) { finishMission('failed'); return; }
  // Out of fuel and stopped on the ground away from the goal: failed.
  if (plane.fuel <= 0 && plane.onGround && plane.speed < 1 && currentObjective()?.kind !== 'land') {
    finishMission('failed');
  }
}

function stepDemo(dt) {
  // Circle Arunika at 550 m, so menus sit over a living sky.
  game.demoAngle += dt * 0.02;
  const tx = Math.cos(game.demoAngle) * 2200;
  const tz = Math.sin(game.demoAngle) * 2200 - 400;
  const fake = { plane: game.plane, objectives: [{ kind: 'ring', x: tx, y: 560, z: tz, r: 300 }], objectiveIndex: 0 };
  const ctl = autopilotControl(fake);
  game.weather.step(dt);
  stepPlane(game.plane, ctl, game.weather.windAt(), 1, dt);
  game.elapsed += dt;
}

function handleActions() {
  const actions = input.takeActions();
  if (!actions) return;
  if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
  if (game.screen === 'play') {
    if (actions & ACTION_PAUSE) { game.screen = 'paused'; announce('Paused.'); }
    else if (actions & ACTION_CAMERA) { game.cameraMode = game.cameraMode === 'chase' ? 'cockpit' : 'chase'; }
    else if (actions & ACTION_GEAR) {
      if (!game.plane.aircraft.gearFixed) { game.plane.gear = !game.plane.gear; audio.gear(); }
    } else if (actions & ACTION_FLAPS) {
      game.plane.flaps = game.plane.flaps === 0 ? 0.5 : game.plane.flaps === 0.5 ? 1 : 0;
      audio.click();
    } else if (actions & ACTION_RESET) {
      game.startMission(game.mission, game.aircraftId);
    }
  } else if (game.screen === 'paused') {
    if (actions & ACTION_PAUSE) { game.screen = 'play'; announce('Playing.'); }
  } else if (actions & ACTION_CONFIRM) {
    doMenuConfirm();
  }
}

function doMenuConfirm() {
  audio.unlock();
  audio.click();
  switch (game.screen) {
    case 'title': {
      const go = ['map', 'hangar', 'logbook', 'howto'][game.menuIndex];
      game.screen = go;
      break;
    }
    case 'hangar': game.screen = 'map'; break;
    case 'map': game.screen = 'briefing'; break;
    case 'briefing': game.startMission(MISSIONS[game.missionIndex], game.aircraftId); break;
    case 'debrief': game.screen = 'map'; break;
    case 'logbook': case 'howto': game.screen = 'title'; break;
    case 'paused': game.screen = 'play'; break;
    default: break;
  }
}

function doMenuBack() {
  switch (game.screen) {
    case 'hangar': case 'map': case 'logbook': case 'howto': game.screen = 'title'; break;
    case 'briefing': game.screen = 'map'; break;
    case 'debrief': game.screen = 'map'; break;
    case 'paused': game.screen = 'play'; break;
    default: break;
  }
}

/** Menu keys: arrows move, Enter confirms, Esc goes back. */
window.addEventListener('keydown', (event) => {
  if (game.screen === 'play') return;
  if (event.code === 'Enter' || event.code === 'Space') { doMenuConfirm(); event.preventDefault(); }
  else if (event.code === 'Escape') { doMenuBack(); }
  else if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
    const dir = event.code === 'ArrowDown' ? 1 : -1;
    if (game.screen === 'title') game.menuIndex = (game.menuIndex + dir + 4) % 4;
    else if (game.screen === 'map') game.missionIndex = (game.missionIndex + dir + MISSIONS.length) % MISSIONS.length;
    else if (game.screen === 'hangar') {
      game.aircraftIndex = (game.aircraftIndex + dir + AIRCRAFT.length) % AIRCRAFT.length;
      game.aircraftId = AIRCRAFT[game.aircraftIndex].id;
    }
    event.preventDefault();
  } else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    if (game.screen === 'hangar') {
      const dir = event.code === 'ArrowRight' ? 1 : -1;
      game.aircraftIndex = (game.aircraftIndex + dir + AIRCRAFT.length) % AIRCRAFT.length;
      game.aircraftId = AIRCRAFT[game.aircraftIndex].id;
      event.preventDefault();
    }
  }
});

/** Clicks on menu zones, and the first gesture unlocks audio. */
let lastZones = [];
canvas.addEventListener('pointerdown', (event) => {
  audio.unlock();
  if (game.screen === 'play') return;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  void ratio;
  const s = Math.min(rect.width / 1280, rect.height / 720);
  const ox = (rect.width - 1280 * s) / 2;
  const oy = (rect.height - 720 * s) / 2;
  const lx = (event.clientX - rect.left - ox) / s;
  const ly = (event.clientY - rect.top - oy) / s;
  for (const z of lastZones) {
    if (lx >= z.x && lx <= z.x + z.w && ly >= z.y && ly <= z.y + z.h) {
      handleZoneAction(z.action);
      return;
    }
  }
});

function handleZoneAction(action) {
  audio.click();
  if (action === 'back') { doMenuBack(); return; }
  if (action === 'fly') { game.screen = 'map'; return; }
  if (action === 'hangar') { game.screen = 'hangar'; return; }
  if (action === 'logbook') { game.screen = 'logbook'; return; }
  if (action === 'howto') { game.screen = 'howto'; return; }
  if (action === 'title') { game.screen = 'title'; return; }
  if (action === 'briefing') { game.screen = 'briefing'; return; }
  if (action === 'start') {
    if (game.screen === 'briefing') game.startMission(MISSIONS[game.missionIndex], game.aircraftId);
    else if (game.screen === 'debrief') game.startMission(game.mission, game.aircraftId);
    return;
  }
  if (action === 'resume') { game.screen = 'play'; return; }
  if (action === 'quit') { game.screen = 'map'; return; }
  if (action.startsWith('aircraft:')) {
    game.aircraftIndex = Number(action.split(':')[1]);
    game.aircraftId = AIRCRAFT[game.aircraftIndex].id;
    return;
  }
  if (action.startsWith('mission:')) {
    game.missionIndex = Number(action.split(':')[1]);
    return;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.screen === 'play') { game.screen = 'paused'; announce('Paused.'); }
});

function renderFrame() {
  const ratio = window.devicePixelRatio || 1;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const world = {
    plane: game.plane,
    weather: game.weather,
    sky: game.sky,
    hour: game.hour,
    rings: ringsForObjectives(game.objectives),
    activeRing: game.objectiveIndex,
    cameraMode: game.cameraMode,
    // Menus fly over a living sky — but the chase plane itself stays out of
    // the menu backgrounds, or it looms over the mission list.
    showAircraft: game.screen === 'play' || game.screen === 'paused',
  };
  renderer.drawWorld(world);
  // HUD in a 1280x720 logical space, letterboxed.
  const w = window.innerWidth, h = window.innerHeight;
  const s = Math.min(w / 1280, h / 720);
  const ox = (w - 1280 * s) / 2;
  const oy = (h - 720 * s) / 2;
  ctx.setTransform(ratio * s, 0, 0, ratio * s, ratio * ox, ratio * oy);
  const view = {
    ...game,
    objectives: game.objectives,
    objectiveIndex: game.objectiveIndex,
    missionElapsed: game.missionElapsed,
    elapsed: game.elapsed,
    message: game.message,
    messageUntil: game.messageUntil,
  };
  switch (game.screen) {
    case 'play': lastZones = hud.drawPlay(view); break;
    case 'paused': lastZones = hud.drawPaused(view); break;
    case 'title': lastZones = hud.drawTitle(view); break;
    case 'hangar': lastZones = hud.drawHangar(view); break;
    case 'map': lastZones = hud.drawMap(view); break;
    case 'briefing': lastZones = hud.drawBriefing(view); break;
    case 'debrief': lastZones = hud.drawDebrief(view); break;
    case 'logbook': lastZones = hud.drawLogbook(view); break;
    case 'howto': lastZones = hud.drawHowTo(view); break;
    default: lastZones = hud.drawTitle(view);
  }
  audio.update(game.plane);
}

function runShot(name) {
  stageShot(name, game);
  let painted = 0;
  function paint() {
    renderFrame();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  announce('Kelana Sky Courier. Press Enter to fly.');
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    while (accumulator >= STEP) {
      if (game.screen === 'play') stepPlay(STEP);
      else if (game.screen !== 'paused' && game.screen !== 'debrief') stepDemo(STEP);
      accumulator -= STEP;
    }
    renderFrame();
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
