// Kelana Sky Courier — every tuning number, colour and data table in one place.
// The world is metres: x east, z south, y up. Heading 0 = north (-z), clockwise.
// Times are hours of day; speeds are m/s in the sim, shown as knots on the HUD.
export const STEP = 1 / 60;
export const KT = 1.94384; // m/s -> knots
export const FT = 3.28084; // m -> feet
export const WORLD_SEED = 20261126;

export const PALETTE = {
  skyDayTop: '#2f6fd0', skyDayMid: '#7fb2e8', skyDayLow: '#cfe6f7',
  skyDawnTop: '#3b3f7d', skyDawnMid: '#e07a5f', skyDawnLow: '#f7c873',
  skyDuskTop: '#232a55', skyDuskMid: '#c65f6e', skyDuskLow: '#f2a35e',
  skyNightTop: '#060a1c', skyNightMid: '#0d1a38', skyNightLow: '#1c2f55',
  sun: '#fff3c4', sunCore: '#fffbe8', moon: '#e8ecf5',
  seaDeep: '#0e4d7a', seaShallow: '#2e8fb8', seaGlint: '#bfe6f5',
  sand: '#e6d29a', grass: '#5d9b4a', grassDry: '#8aa84f', forest: '#2f6b34',
  rock: '#7a7268', rockDark: '#5b534a', snow: '#f2f5f7', lava: '#e05a2a',
  runway: '#33373d', runwayLine: '#f5f5e8', runwayNum: '#ffffff',
  panel: '#1c222c', panelEdge: '#39424f', gaugeFace: '#10151d',
  gaugeLit: '#7fe3ff', gaugeAmber: '#ffb347', gaugeRed: '#ff5a4e',
  text: '#eef3f8', muted: '#9fb0c3', gold: '#f2c94c', good: '#58d68d', warn: '#ff9f43',
};

/** The three flyable aircraft. maxSpeed/thrust in m/s, stall in m/s, fuel in kg. */
export const AIRCRAFT = [
  {
    id: 'pipit', name: 'Pipit K-1', maker: 'Kelana Aero Works', kind: 'Light STOL prop',
    desc: 'Forgiving bush plane. Short strips, slow and steady, sips fuel.',
    maxSpeed: 62, cruiseSpeed: 48, stallSpeed: 22, climbRate: 5.5,
    rollRate: 1.9, pitchRate: 1.1, fuelCap: 90, burnRate: 0.16, gearFixed: true,
    rotateSpeed: 26, vne: 78, livery: '#e8542f', livery2: '#f7c873', reg: 'PK-KLN',
  },
  {
    id: 'elang', name: 'Elang K-2', maker: 'Kelana Aero Works', kind: 'Twin turboprop',
    desc: 'The workhorse. Two engines, room for mail and medics, lands anywhere.',
    maxSpeed: 95, cruiseSpeed: 78, stallSpeed: 30, climbRate: 8,
    rollRate: 1.6, pitchRate: 0.95, fuelCap: 220, burnRate: 0.34, gearFixed: false,
    rotateSpeed: 36, vne: 118, livery: '#2f6fd0', livery2: '#bfe6f5', reg: 'PK-ELG',
  },
  {
    id: 'rajawali', name: 'Rajawali K-3', maker: 'Kelana Aero Works', kind: 'Light jet',
    desc: 'Fast and thirsty. Needs a long strip and a firm hand on the throttle.',
    maxSpeed: 148, cruiseSpeed: 128, stallSpeed: 42, climbRate: 14,
    rollRate: 2.4, pitchRate: 1.3, fuelCap: 420, burnRate: 0.85, gearFixed: false,
    rotateSpeed: 52, vne: 172, livery: '#3a3f4a', livery2: '#f2c94c', reg: 'PK-RJW',
  },
];

/** Six island airports. heading is the runway direction in degrees. */
export const AIRPORTS = [
  { id: 'arunika', name: 'Arunika Intl', code: 'ARK', x: 0, z: 0, heading: 90, length: 1600, width: 46, elev: 14, surface: 'Asphalt', lights: true, tower: true },
  { id: 'kelana', name: 'Kelana Field', code: 'KLN', x: 4200, z: -2600, heading: 140, length: 1100, width: 36, elev: 22, surface: 'Grass', lights: true, tower: false },
  { id: 'merapi', name: 'Merapi Strip', code: 'MRP', x: -3800, z: -4200, heading: 20, length: 950, width: 32, elev: 186, surface: 'Gravel', lights: false, tower: false },
  { id: 'karang', name: 'Karang Cove', code: 'KRG', x: 5200, z: 3400, heading: 300, length: 700, width: 28, elev: 8, surface: 'Sand', lights: false, tower: false },
  { id: 'senja', name: 'Senja Bay', code: 'SNJ', x: -4200, z: 4200, heading: 80, length: 1200, width: 38, elev: 18, surface: 'Asphalt', lights: true, tower: true },
  { id: 'embun', name: 'Embun Highlands', code: 'EMB', x: 800, z: -6800, heading: 170, length: 1000, width: 32, elev: 428, surface: 'Grass', lights: false, tower: false },
];

/** Islands that shape the terrain: gaussians + a volcano cone + highland plateau. */
export const ISLANDS = [
  { x: 0, z: 0, radius: 2600, peak: 260, name: 'Arunika' },
  { x: 4200, z: -2600, radius: 1900, peak: 190, name: 'Kelana' },
  { x: -3800, z: -4200, radius: 2400, peak: 920, volcano: true, name: 'Merapi' },
  { x: 5200, z: 3400, radius: 1500, peak: 130, name: 'Karang' },
  { x: -4200, z: 4200, radius: 2100, peak: 210, name: 'Senja' },
  { x: 800, z: -6800, radius: 2200, peak: 640, plateau: true, name: 'Embun' },
  { x: -6500, z: -800, radius: 1200, peak: 150, name: 'Pulau Kecil' },
  { x: 1500, z: 6200, radius: 1100, peak: 110, name: 'Pulau Ombak' },
];

/** Weather presets: wind (m/s from direction deg), gust, cloud cover, rain, visibility. */
export const WEATHER = {
  clear: { label: 'Clear skies', windSpeed: 3, windFrom: 240, gust: 1, clouds: 0.18, rain: 0, vis: 1 },
  breeze: { label: 'Sea breeze', windSpeed: 7, windFrom: 200, gust: 2, clouds: 0.3, rain: 0, vis: 0.95 },
  crosswind: { label: 'Crosswind', windSpeed: 12, windFrom: 10, gust: 4, clouds: 0.4, rain: 0, vis: 0.9 },
  storm: { label: 'Storm front', windSpeed: 19, windFrom: 310, gust: 9, clouds: 0.85, rain: 1, vis: 0.55 },
  dusk: { label: 'Golden dusk', windSpeed: 5, windFrom: 270, gust: 1.5, clouds: 0.25, rain: 0, vis: 0.9 },
  night: { label: 'Night', windSpeed: 4, windFrom: 180, gust: 1, clouds: 0.12, rain: 0, vis: 0.7 },
};

/** Times of day used by missions (hours). */
export const TIMES = { morning: 8.5, noon: 12.5, golden: 17.4, dusk: 18.7, night: 21.4 };

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'kelana-sky-courier.logbook.v1';
export const CREDITS_KEY = 'kelana-sky-courier.credits.v1';
