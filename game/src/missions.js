// The 12 missions: what the pilot must do, where, in what weather and light.
// Rings are placed by helpers from the airports, so every course is a real
// route across the archipelago, not numbers typed in a vacuum.
import { AIRPORTS, TIMES } from './config.js';

const byId = {};
for (const a of AIRPORTS) byId[a.id] = a;

function deg2rad(d) { return (d * Math.PI) / 180; }
/** Point `dist` metres from an airport along its runway heading (or a bearing). */
function fromAirport(id, bearingDeg, dist, alt) {
  const a = byId[id];
  const b = deg2rad(bearingDeg);
  return { x: a.x + Math.sin(b) * dist, z: a.z - Math.cos(b) * dist, y: a.elev + alt };
}
/** Rings spaced along the straight course between two points. `startNum` and
 * `total` keep the numbering true across a multi-leg course (8 rings in two
 * legs of 4 still read "Ring 5 of 8"). */
function ringLine(x1, z1, y1, x2, z2, y2, count, r, startNum = 1, total = count) {
  const rings = [];
  for (let i = 0; i < count; i += 1) {
    const t = (i + 1) / (count + 1);
    rings.push({
      kind: 'ring',
      x: x1 + (x2 - x1) * t,
      y: y1 + (y2 - y1) * t,
      z: z1 + (z2 - z1) * t,
      r,
      label: `Ring ${startNum + i} of ${total}`,
    });
  }
  return rings;
}
function land(id, label) { return { kind: 'land', airport: id, label: label ?? `Land at ${byId[id].name}` }; }
function takeoff(label) { return { kind: 'takeoff', label: label ?? 'Take off' }; }

const A = byId.arunika, K = byId.kelana, M = byId.merapi, C = byId.karang, S = byId.senja, E = byId.embun;

export const MISSIONS = [
  {
    id: 'm01', name: 'First Flight', type: 'Training', aircraft: 'pipit', start: 'arunika',
    weather: 'clear', time: TIMES.morning, timeLimit: 300, reward: 100, fuelStart: 1,
    brief: 'Three gentle rings over Arunika bay, then home. Learn the throttle, the bank and the flare before the mail starts flying.',
    objectives: [
      ...ringLine(A.x - 600, A.z - 1200, 320, A.x + 1400, A.z - 2400, 380, 3, 55),
      land('arunika', 'Land on Runway 09 at Arunika'),
    ],
    gold: 180, silver: 240,
  },
  {
    id: 'm02', name: 'Mail Run', type: 'Delivery', aircraft: 'pipit', start: 'arunika',
    weather: 'breeze', time: TIMES.noon, timeLimit: 420, reward: 150, fuelStart: 1,
    brief: 'The morning post for Kelana Field. Two guide rings over the strait, then put her down on the grass at Kelana.',
    objectives: [
      takeoff('Take off from Arunika'),
      ...ringLine(A.x + 900, A.z - 900, 420, K.x - 800, K.z + 800, 380, 2, 55),
      land('kelana'),
    ],
    gold: 240, silver: 330,
  },
  {
    id: 'm03', name: 'Ring Rally', type: 'Race', aircraft: 'elang', start: 'arunika',
    weather: 'clear', time: TIMES.golden, timeLimit: 240, reward: 250, fuelStart: 1,
    brief: 'Eight rings, one clock. Thread them clean — a missed ring costs the rally, a clipped ring costs the airframe.',
    objectives: [
      ...ringLine(A.x - 1500, A.z - 1500, 500, A.x + 2600, A.z - 3500, 700, 4, 48, 1, 8),
      ...ringLine(A.x + 2600, A.z - 3500, 700, A.x + 800, A.z - 5200, 560, 4, 48, 5, 8),
      land('arunika', 'Land at Arunika to stop the clock'),
    ],
    gold: 150, silver: 200,
  },
  {
    id: 'm04', name: 'Volcano Survey', type: 'Survey', aircraft: 'elang', start: 'merapi',
    weather: 'breeze', time: TIMES.morning, timeLimit: 480, reward: 300, fuelStart: 1,
    brief: 'Merapi is grumbling. Circle the crater through five survey rings and bring the readings home. Mind the updrafts — and the ash.',
    objectives: [
      takeoff('Take off from Merapi Strip'),
      ...(() => {
        const rings = [];
        for (let i = 0; i < 5; i += 1) {
          const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
          rings.push({ kind: 'ring', x: M.x + Math.cos(ang) * 1400, y: M.elev + 1050, z: M.z + Math.sin(ang) * 1400, r: 60, label: `Survey ring ${i + 1} of 5` });
        }
        return rings;
      })(),
      land('merapi', 'Land back at Merapi Strip'),
    ],
    gold: 260, silver: 360,
  },
  {
    id: 'm05', name: 'Rescue at Karang', type: 'Rescue', aircraft: 'pipit', start: 'arunika',
    weather: 'crosswind', time: TIMES.noon, timeLimit: 600, reward: 400, fuelStart: 1,
    brief: 'A hiker is stranded on Karang Cove with a broken ankle. Land on the 700 m sand strip, pick them up, and fly them home to Arunika.',
    objectives: [
      takeoff('Take off from Arunika'),
      ...ringLine(A.x + 1800, A.z + 1200, 380, C.x - 900, C.z - 600, 300, 2, 55),
      land('karang', 'Land at Karang Cove — pick up the hiker'),
      takeoff('Take off with the patient aboard'),
      land('arunika', 'Land at Arunika — rescue complete'),
    ],
    gold: 360, silver: 480,
  },
  {
    id: 'm06', name: 'Night Ferry', type: 'Delivery', aircraft: 'elang', start: 'arunika',
    weather: 'night', time: TIMES.night, timeLimit: 540, reward: 350, fuelStart: 1,
    brief: 'The last ferry of the day, flown after dark. Follow the lit rings to Senja Bay and land by runway lights. Trust the instruments.',
    objectives: [
      takeoff('Take off into the night'),
      ...ringLine(A.x - 1200, A.z + 1000, 520, S.x + 900, S.z - 900, 460, 3, 60),
      land('senja', 'Land at Senja Bay by the lights'),
    ],
    gold: 300, silver: 420,
  },
  {
    id: 'm07', name: 'Storm Crossing', type: 'Challenge', aircraft: 'elang', start: 'arunika',
    weather: 'storm', time: TIMES.dusk, timeLimit: 600, reward: 450, fuelStart: 1,
    brief: 'A storm front sits between you and Embun Highlands. Four rings mark the gap in the weather. Fly it steady — gusts will shove you sideways.',
    objectives: [
      takeoff('Take off into the storm front'),
      ...ringLine(A.x + 400, A.z - 2000, 700, E.x - 400, E.z + 900, 900, 4, 62),
      land('embun', 'Land at Embun Highlands'),
    ],
    gold: 360, silver: 480,
  },
  {
    id: 'm08', name: 'Canyon Slalom', type: 'Race', aircraft: 'pipit', start: 'embun',
    weather: 'clear', time: TIMES.golden, timeLimit: 300, reward: 350, fuelStart: 1,
    brief: 'Six rings down the Embun canyon, low and fast. Stay under 900 m and keep the wings level — the canyon walls do not forgive.',
    objectives: [
      takeoff('Take off from Embun Highlands'),
      ...ringLine(E.x - 500, E.z + 800, 620, E.x + 300, E.z + 4200, 520, 6, 46),
      land('embun', 'Climb out and land at Embun'),
    ],
    gold: 170, silver: 240,
  },
  {
    id: 'm09', name: 'Cargo Heavy', type: 'Delivery', aircraft: 'elang', start: 'arunika',
    weather: 'crosswind', time: TIMES.morning, timeLimit: 540, reward: 500, fuelStart: 1, cargo: 1.35,
    brief: 'A full load of survey gear for the Merapi station. Heavy means a long roll, a slow climb and thirsty engines — plan the fuel.',
    objectives: [
      takeoff('Heavy take-off from Arunika'),
      ...ringLine(A.x - 1500, A.z - 1800, 800, M.x + 1000, M.z + 1200, 950, 3, 58),
      land('merapi', 'Land heavy at Merapi Strip'),
    ],
    gold: 320, silver: 440,
  },
  {
    id: 'm10', name: 'Island Hopper', type: 'Tour', aircraft: 'elang', start: 'arunika',
    weather: 'breeze', time: TIMES.noon, timeLimit: 900, reward: 600, fuelStart: 1,
    brief: 'Three landings, one sortie: Kelana, Karang, then Senja. Watch the fuel gauge — there is no tanker waiting at the grass strips.',
    objectives: [
      takeoff('Take off from Arunika'),
      land('kelana', 'Land 1 of 3: Kelana Field'),
      takeoff('Depart Kelana'),
      land('karang', 'Land 2 of 3: Karang Cove'),
      takeoff('Depart Karang'),
      land('senja', 'Land 3 of 3: Senja Bay'),
    ],
    gold: 560, silver: 720,
  },
  {
    id: 'm11', name: 'Medical Dash', type: 'Rescue', aircraft: 'rajawali', start: 'arunika',
    weather: 'dusk', time: TIMES.dusk, timeLimit: 360, reward: 550, fuelStart: 0.55,
    brief: 'A patient at Senja needs the jet. You start with just over half a tank — fly fast, fly clean, and do not go around twice.',
    objectives: [
      takeoff('Scramble from Arunika'),
      ...ringLine(A.x - 1000, A.z + 1400, 900, S.x + 800, S.z - 800, 700, 2, 65),
      land('senja', 'Land the jet at Senja Bay'),
    ],
    gold: 210, silver: 300,
  },
  {
    id: 'm12', name: 'Golden Hour Grand Tour', type: 'Grand Tour', aircraft: 'rajawali', start: 'arunika',
    weather: 'dusk', time: TIMES.golden, timeLimit: 900, reward: 1000, fuelStart: 1,
    brief: 'The whole archipelago in one golden-hour flight: twelve rings past every island, then home to Arunika as the sun goes down.',
    objectives: [
      takeoff('Take off into the golden hour'),
      ...ringLine(A.x - 1200, A.z - 1200, 700, K.x - 600, K.z + 500, 650, 3, 60, 1, 12),
      ...ringLine(K.x + 500, K.z - 500, 650, E.x - 500, E.z + 800, 900, 3, 60, 4, 12),
      ...ringLine(E.x + 400, E.z - 600, 900, M.x + 1200, M.z + 1000, 1050, 3, 60, 7, 12),
      ...ringLine(M.x - 1000, M.z - 1000, 1050, S.x + 900, S.z - 900, 600, 3, 60, 10, 12),
      land('arunika', 'Final landing at Arunika'),
    ],
    gold: 600, silver: 780,
  },
];

export function missionById(id) { return MISSIONS.find((m) => m.id === id) ?? MISSIONS[0]; }

/** Medal for a finished mission: gold / silver / bronze by time, none when slow. */
export function medalFor(mission, seconds, damageTaken) {
  if (damageTaken > 40) return 'bronze';
  if (seconds <= mission.gold) return 'gold';
  if (seconds <= mission.silver) return 'silver';
  return 'bronze';
}
