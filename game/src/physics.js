// The flight model: throttle and lift, stalls, coordinated turns, fuel burn,
// damage, wind drift, and landings that read as landings — or crashes.
// Pure numbers in, events out; no drawing, no browser.
import { AIRPORTS, STEP } from './config.js';
import { groundHeight, airportById } from './terrain.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_LANDED = 2;
export const EVENT_CRASHED = 4;
export const EVENT_TOUCHDOWN = 8;
export const EVENT_STALL = 16;
export const EVENT_FUEL_EMPTY = 32;
export const EVENT_TAKEOFF = 64;

const G = 9.81;

export function createPlane(aircraft, startAirport, fuelStart) {
  const ap = airportById(startAirport);
  const hd = (ap.heading * Math.PI) / 180;
  const plane = {
    aircraft,
    x: ap.x - Math.sin(hd) * (ap.length / 2 - 120),
    y: ap.elev + 2.2,
    z: ap.z + Math.cos(hd) * (ap.length / 2 - 120),
    heading: ap.heading,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: aircraft.fuelCap * fuelStart,
    damage: 0,
    gear: true,
    flaps: 0,
    onGround: true,
    airborne: false,
    vspeed: 0,
    gLoad: 1,
    engineTemp: 20,
    windX: 0,
    windZ: 0,
    crashed: false,
    landedAt: null,
    stallWarn: false,
    overSpeed: false,
    elapsed: 0,
  };
  return plane;
}

/**
 * One fixed step. `ctl` is {pitch: -1..1 (up positive), roll: -1..1 (right
 * positive), throttle: -1/0/1, flaps: 0/1 toggle handled by caller, gear}.
 * `wind` is the wind vector. `cargo` multiplies weight (1 = empty).
 * Returns event flags.
 */
export function stepPlane(plane, ctl, wind, cargo, dt = STEP) {
  if (plane.crashed) return EVENT_NONE;
  const ac = plane.aircraft;
  const weight = cargo ?? 1;
  let events = EVENT_NONE;
  plane.elapsed += dt;

  // Throttle: W/S nudge it; the engine spools, it does not teleport.
  plane.throttle = Math.min(1, Math.max(0, plane.throttle + ctl.throttle * dt * 0.45));

  const stallSpeed = ac.stallSpeed * Math.sqrt(weight) * (1 - plane.flaps * 0.28);
  const maxSpeed = ac.maxSpeed * (1 - plane.flaps * 0.25);
  const drag = 0.00042 * weight;

  // Speed: thrust pushes toward the throttle's speed, drag and climb eat it.
  const targetSpeed = plane.throttle * maxSpeed;
  const climbFactor = Math.sin((plane.pitch * Math.PI) / 180) * 9;
  plane.speed += ((targetSpeed - plane.speed) * 0.24 - drag * plane.speed * plane.speed * 0.12 - climbFactor) * dt * 2.2;
  if (plane.onGround) plane.speed = Math.max(0, plane.speed);
  else plane.speed = Math.max(0, plane.speed);

  // Pitch and roll answer the stick, softer near the stall — but a rolling
  // aircraft still answers, so the authority floor uses rotate speed.
  const authority = Math.min(1, plane.speed / Math.max(12, stallSpeed * 0.7));
  const pitchRate = ctl.pitch * ac.pitchRate * authority;
  const rollRate = ctl.roll * ac.rollRate * authority;
  plane.pitch += pitchRate * dt * 28;
  plane.roll += rollRate * dt * 28;
  // The aircraft wants to return to level: stability, stronger on the ground.
  plane.roll *= Math.pow(0.35, dt);
  plane.pitch = Math.max(-28, Math.min(32, plane.pitch));
  plane.roll = Math.max(-68, Math.min(68, plane.roll));

  // Coordinated turn: bank turns the nose.
  const turnRate = (G * Math.tan((plane.roll * Math.PI) / 180)) / Math.max(18, plane.speed);
  plane.heading = (plane.heading + ((turnRate * 180) / Math.PI) * dt + 360) % 360;
  plane.gLoad = 1 / Math.max(0.5, Math.cos((plane.roll * Math.PI) / 180));
  if (plane.gLoad > 3.4) plane.damage += (plane.gLoad - 3.4) * dt * 6;

  // Stall: below flying speed the nose drops and the wings stop answering.
  plane.stallWarn = !plane.onGround && plane.speed < stallSpeed * 1.08;
  if (!plane.onGround && plane.speed < stallSpeed) {
    plane.pitch -= 14 * dt;
    plane.vspeed = Math.min(plane.vspeed, -6);
    events |= EVENT_STALL;
  }
  plane.overSpeed = plane.speed > ac.vne;
  if (plane.overSpeed) plane.damage += dt * 1.5;

  // Vertical speed from pitch and speed, plus ground effect near the ground.
  const ground = groundHeight(plane.x, plane.z);
  const agl = plane.y - ground;
  let vs = plane.speed * Math.sin((plane.pitch * Math.PI) / 180);
  if (plane.onGround) vs = 0;
  else if (agl < 12 && vs < 0) vs *= 0.55; // ground effect softens the sink
  plane.vspeed = vs;

  // Move: forward along heading/pitch, plus wind drift.
  const hd = (plane.heading * Math.PI) / 180;
  const pc = Math.cos((plane.pitch * Math.PI) / 180);
  const vx = Math.sin(hd) * pc * plane.speed + wind.x;
  const vz = -Math.cos(hd) * pc * plane.speed + wind.z;
  plane.x += vx * dt;
  plane.z += vz * dt;
  plane.y += vs * dt;
  plane.windX = wind.x;
  plane.windZ = wind.z;

  // Fuel: throttle-squared burn; empty tanks mean a dead stick.
  const burn = ac.burnRate * (0.25 + plane.throttle * plane.throttle * 1.6) * weight;
  plane.fuel = Math.max(0, plane.fuel - burn * dt);
  if (plane.fuel <= 0 && plane.throttle > 0) {
    plane.throttle = Math.max(0, plane.throttle - dt * 0.5);
    events |= EVENT_FUEL_EMPTY;
  }
  plane.engineTemp += ((20 + plane.throttle * 68 + (plane.overSpeed ? 12 : 0)) - plane.engineTemp) * dt * 0.08;

  // Take-off: rotate speed and a pulled nose. The aircraft leaves the ground
  // a few metres up, so the touchdown check below cannot catch it again in
  // the same step and pin it to the runway forever.
  if (plane.onGround && plane.speed > ac.rotateSpeed && plane.pitch > 4) {
    plane.onGround = false;
    plane.airborne = true;
    plane.y = ground + 5;
    events |= EVENT_TAKEOFF;
  }

  // Ground contact: landing, belly landing, or crash. Only while descending.
  if (!plane.onGround && plane.y <= ground + 2.2 && plane.vspeed <= 0.5) {
    const sink = -plane.vspeed;
    const nearRunway = nearestRunway(plane);
    const onStrip = nearRunway && nearRunway.onStrip;
    const inWater = ground < 1;
    if (inWater || sink > 7.5 || (!onStrip && sink > 6)) {
      plane.crashed = true;
      plane.damage = 100;
      plane.y = ground + 1;
      return events | EVENT_CRASHED;
    }
    // Touchdown.
    plane.y = ground + 2.2;
    plane.onGround = true;
    plane.pitch = 0;
    plane.roll *= 0.4;
    events |= EVENT_TOUCHDOWN;
    if (!plane.gear && !ac.gearFixed) {
      plane.damage += 18; // belly landing
    } else if (sink > 4) {
      plane.damage += (sink - 4) * 5; // firm arrival
    }
    if (onStrip) {
      plane.landedAt = nearRunway.id;
      events |= EVENT_LANDED;
    }
    // Rolling: brakes and drag slow the aircraft.
    plane.speed = Math.max(0, plane.speed - plane.speed * 0.35 * dt - 6 * dt);
  }
  if (plane.onGround) {
    plane.y = groundHeight(plane.x, plane.z) + 2.2;
    plane.speed = Math.max(0, plane.speed - plane.speed * 0.25 * dt - 4 * dt);
    plane.vspeed = 0;
  }
  if (plane.damage >= 100 && !plane.crashed) {
    plane.crashed = true;
    events |= EVENT_CRASHED;
  }
  return events;
}

/** Nearest runway to the aircraft, with across-track distance to its centreline. */
export function nearestRunway(plane) {
  let best = null;
  for (const ap of AIRPORTS) {
    const hd = (ap.heading * Math.PI) / 180;
    const along = (plane.x - ap.x) * Math.sin(hd) + (plane.z - ap.z) * -Math.cos(hd);
    const across = (plane.x - ap.x) * Math.cos(hd) + (plane.z - ap.z) * Math.sin(hd);
    const d = Math.hypot(along, across);
    if (!best || d < best.dist) {
      best = { id: ap.id, name: ap.name, dist: Math.abs(across), along, across, onStrip: Math.abs(along) <= ap.length / 2 + 20 && Math.abs(across) <= ap.width / 2 + 6 };
    }
  }
  return best;
}
