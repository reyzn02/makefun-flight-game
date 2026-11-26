// Screenshot scenes and the autopilot that flies them: each ?shot= scene is
// the real game, flown forward from a fresh mission by a simple pilot that
// steers for the active objective, so the frame is what real play looks like
// and the same seed always gives the same frame.
import { STEP } from './config.js';
import { stepPlane, EVENT_LANDED, EVENT_TAKEOFF } from './physics.js';
import { airportById } from './terrain.js';
import { missionById } from './missions.js';

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function bearingTo(x1, z1, x2, z2) {
  return (Math.atan2(x2 - x1, -(z2 - z1)) * 180 / Math.PI + 360) % 360;
}

/**
 * Steer the plane toward the active objective. The pilot thinks in angles —
 * a bank angle for the heading error, a pitch angle for the altitude error —
 * and the returned -1..1 commands are rates toward those angles, so the
 * aircraft settles instead of winding up. Also takes off when the mission
 * starts on the ground.
 */
export function autopilotControl(game) {
  const plane = game.plane;
  const obj = game.objectives[game.objectiveIndex];
  let targetX = plane.x, targetZ = plane.z, targetAlt = 500;
  if (obj) {
    if (obj.kind === 'ring') { targetX = obj.x; targetZ = obj.z; targetAlt = obj.y; }
    else if (obj.kind === 'land') {
      const ap = airportById(obj.airport);
      // Aim at a point 300 m past the threshold, on the centreline, low:
      // the aircraft flies down the glide path onto the strip. (Aiming at
      // an approach fix 1,400 m out would turn an aircraft that is already
      // inside the fix back around.)
      const hd = (ap.heading * Math.PI) / 180;
      targetX = ap.x - Math.sin(hd) * (ap.length / 2 - 300);
      targetZ = ap.z + Math.cos(hd) * (ap.length / 2 - 300);
      targetAlt = ap.elev + 60;
    } else if (obj.kind === 'takeoff') {
      targetX = plane.x + Math.sin((plane.heading * Math.PI) / 180) * 2000;
      targetZ = plane.z - Math.cos((plane.heading * Math.PI) / 180) * 2000;
      targetAlt = 500;
    }
  }
  const wantHeading = bearingTo(plane.x, plane.z, targetX, targetZ);
  let err = wantHeading - plane.heading;
  while (err > 180) err -= 360;
  while (err < -180) err += 360;
  const dist = Math.hypot(targetX - plane.x, targetZ - plane.z);
  const onFinal = obj && obj.kind === 'land' && dist < 2200;
  // Proportional navigation: the turn rate follows the line-of-sight rate,
  // three times over, plus a term for the heading error. Pure pursuit (turn
  // rate from the heading error alone) traps the aircraft in a stable orbit
  // around its target — at the orbit radius the turn rate always equals the
  // bearing rate, so the error never shrinks. PN breaks the orbit: turning
  // three times faster than the bearing swings drives the error to zero and
  // the aircraft onto the target.
  let bearingRate = 0;
  const nav = plane._nav ?? (plane._nav = { prevBearing: null, prevElapsed: 0 });
  if (nav.prevBearing !== null) {
    let db = wantHeading - nav.prevBearing;
    while (db > 180) db -= 360;
    while (db < -180) db += 360;
    const dt = Math.max(0.001, plane.elapsed - nav.prevElapsed);
    bearingRate = db / dt;
  }
  nav.prevBearing = wantHeading;
  nav.prevElapsed = plane.elapsed;
  const desiredTurnRate = clamp(3.0 * bearingRate + err * 0.4, -12, 12) * (Math.PI / 180); // rad/s
  const desiredRoll = Math.atan((plane.speed * desiredTurnRate) / 9.81) * (180 / Math.PI);
  const roll = clamp((desiredRoll - plane.roll) * 0.5, -1, 1);
  // Pitch for the altitude error: gentle on final, firmer en route. The gain
  // must keep the climb rate up while the error is large — a pure proportional
  // pitch eases off as the target nears and the aircraft arrives hundreds of
  // metres below its ring, then orbits the ring's ground position forever.
  const altErr = targetAlt - plane.y;
  const desiredPitch = plane.onGround
    ? (plane.speed > plane.aircraft.rotateSpeed ? 10 : 0)
    : onFinal ? clamp(altErr * 0.03, -8, 3) : clamp(altErr * 0.05, -10, 16);
  const pitch = clamp((desiredPitch - plane.pitch) * 0.15, -1, 1);
  // Throttle is a target, not a rate: drive the lever toward the power the
  // moment wants, so the aircraft settles at cruise instead of full throttle.
  // Slow down to thread a ring ONLY once close and nearly level with it:
  // slowing early kills the climb, and the aircraft arrives below its ring
  // and orbits the ring's ground position instead of flying through it.
  // And slow down whenever the nose is far off the target: a fast aircraft
  // cannot turn faster than its target's bearing swings, so it orbits the
  // target forever; a slow one turns inside the bearing and closes in.
  const approachSpeed = Math.max(plane.aircraft.stallSpeed * 1.5, 38);
  const approachThrottle = approachSpeed / plane.aircraft.maxSpeed;
  let targetThrottle;
  if (plane.onGround) targetThrottle = 1;
  else if (onFinal) targetThrottle = plane.speed > 48 ? 0.35 : 0.55;
  else if (obj?.kind === 'ring' && dist < 250 && Math.abs(altErr) < 80) targetThrottle = approachThrottle;
  else if (Math.abs(err) > 45) targetThrottle = approachThrottle;
  else targetThrottle = plane.speed < plane.aircraft.cruiseSpeed ? 0.75 : 0.55;
  const throttle = clamp((targetThrottle - plane.throttle) * 2, -1, 1);
  if (onFinal) { plane.gear = true; plane.flaps = 0.6; }
  return { pitch, roll, throttle };
}

/** Run the mission forward under autopilot for `seconds` of game time. */
export function flyForward(game, seconds, windFn) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const ctl = autopilotControl(game);
    const wind = windFn();
    const events = stepPlane(game.plane, ctl, wind, game.mission.cargo ?? 1);
    if (events & EVENT_TAKEOFF) {
      if (game.objectives[game.objectiveIndex]?.kind === 'takeoff') game.objectiveIndex += 1;
    }
    // Ring passes.
    const obj = game.objectives[game.objectiveIndex];
    if (obj && obj.kind === 'ring') {
      const d = Math.hypot(obj.x - game.plane.x, obj.y - game.plane.y, obj.z - game.plane.z);
      if (d < obj.r) game.objectiveIndex += 1;
    }
    if (events & EVENT_LANDED) {
      if (obj && obj.kind === 'land' && game.plane.landedAt === obj.airport) game.objectiveIndex += 1;
      break;
    }
    if (game.plane.crashed) break;
    game.missionElapsed += STEP;
    if (game.objectiveIndex >= game.objectives.length) break;
  }
}

/**
 * Set `game` to the named scene (start, play, cockpit, night, missions) and
 * return the screen to show. Any other name is the title scene.
 */
export function stageShot(name, game) {
  const g = game;
  if (name === 'missions') {
    g.screen = 'map';
    g.missionIndex = 2;
    return;
  }
  if (name === 'cockpit' || name === 'night') {
    // Final approach: gear down, flaps out, runway lights ahead. Skip the
    // take-off and guide rings — the shot is the landing itself.
    const mission = missionById(name === 'night' ? 'm06' : 'm02');
    g.startMission(mission, name === 'night' ? 'rajawali' : 'elang');
    // Approach the airport the mission actually lands at (Kelana for the
    // Mail Run, Senja for the Night Ferry), not the departure strip.
    const landObj = g.objectives.find((o) => o.kind === 'land');
    const ap = airportById(landObj.airport);
    const hd = (ap.heading * Math.PI) / 180;
    const along = ap.length / 2 + 900; // 900 m from the threshold: the strip fills the windshield
    g.plane.x = ap.x - Math.sin(hd) * along;
    g.plane.z = ap.z + Math.cos(hd) * along;
    g.plane.y = ap.elev + 110;
    g.plane.heading = ap.heading;
    g.plane.pitch = -3;
    g.plane.roll = 0;
    g.plane.speed = 46;
    g.plane.throttle = 0.5;
    g.plane.onGround = false;
    g.plane.airborne = true;
    g.plane.gear = true;
    g.plane.flaps = 0.6;
    g.objectiveIndex = g.objectives.findIndex((o) => o.kind === 'land');
    g.cameraMode = 'cockpit';
    g.screen = 'play';
    flyForward(g, 3, () => g.weather.windAt());
    g.message = `${mission.name} — on final to ${ap.name}`;
    g.messageUntil = 999;
    return;
  }
  if (name === 'play') {
    // First Flight in the Pipit: after 35 s the aircraft is level, climbing
    // gently, and ring 1 sits 335 m dead ahead — the most complete frame.
    const mission = missionById('m01');
    g.startMission(mission, 'pipit');
    g.cameraMode = 'chase';
    g.screen = 'play';
    flyForward(g, 35, () => g.weather.windAt());
    g.message = 'First Flight — ring 1 of 3 dead ahead over Arunika bay';
    g.messageUntil = 999;
    return;
  }
  // start: title screen over a live flyover.
  g.screen = 'title';
  g.menuIndex = 0;
}
