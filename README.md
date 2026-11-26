# Kelana Sky Courier — 3 aircraft, 6 island airports, 12 missions, fuel, damage, wind, weather & day–dusk–night flying, ring gates and runway landings

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/reyzn02/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/reyzn02/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A complete, original flight game for the make.fun best-flight-game bounty. Fly a bush-plane courier across a volcanic archipelago: thread ring gates, deliver the mail, rescue a stranded hiker, survey a smoking volcano, and land by runway lights at night — with fuel to watch, an airframe to look after, and wind that will shove you sideways if you let it.

## The game

- **3 flyable aircraft** — Pipit K-1 light STOL prop, Elang K-2 twin turboprop, Rajawali K-3 light jet. Each has its own speed, climb, stall, fuel burn and handling; the jet is fast and thirsty, the Pipit lands on a sand strip.
- **6 island airports** — Arunika Intl, Kelana Field, Merapi Strip (by the volcano), Karang Cove (700 m of sand), Senja Bay (night-lit), Embun Highlands (428 m up). Every strip has a real runway with threshold numbers, centreline, edge lines and lights.
- **12 missions** — training, mail runs, ring rallies, volcano survey, rescue, night ferry, storm crossing, canyon slalom, heavy cargo, a three-landing island hopper, a low-fuel medical dash, and a 12-ring golden-hour grand tour. Gold, silver and bronze medals for fast, clean flying; a logbook keeps every sortie.
- **Real systems** — fuel burn by throttle, airframe damage from hard landings, clipped rings, overspeed and over-G, stalls that drop the nose, wind and gusts, flaps and retractable gear, ground effect on the flare.
- **Two cameras** — chase view with a built-looking aircraft, or the cockpit with a lit six-pack (airspeed, attitude, altimeter, heading, vertical speed, fuel), throttle quadrant and gear/flap/stall lights.
- **Weather and light** — clear, sea breeze, crosswind, storm front, golden dusk and night, with drifting clouds, volcano smoke, lighthouses that sweep at night, and an AI courier on a circuit around Arunika.
- **Synthesised sound** — engine drone that follows the throttle, wind noise that follows the speed, ring chimes, stall warning and a landing fanfare. No audio files; all WebAudio.

## How to play

Serve `game/` with any static server and open `index.html` (or run `node serve.ts` and open http://localhost:8080). No network requests, no build step.

| Key | Does |
| --- | --- |
| ← → or A / D | Bank — the bank turns the nose |
| ↑ ↓ or W / S | Pitch down / up |
| Shift / Ctrl | Throttle up / down |
| F | Flaps (0 → 50% → 100%) |
| G | Landing gear |
| C | Chase / cockpit camera |
| M | Sound on/off |
| P / Esc | Pause |
| R | Restart the mission |
| Mouse | Hold and steer with the pointer |

Landings count when you touch down on a runway, slow and level, gear down. Rings pay 100 points, landings 200, and finishing under the time limit pays a time bonus.

## Structure

`game/` is plain static files; every module has one job:

| File | Job |
| --- | --- |
| `index.html` | Page shell, canvas, status line |
| `src/main.js` | Boot, fixed-step loop, screens, mission flow |
| `src/config.js` | Tuning, palette, aircraft, airports, islands, weather |
| `src/missions.js` | The 12 missions, objectives, medals |
| `src/terrain.js` | Island heightfields, runway pads, towns, lighthouses |
| `src/weather.js` | Wind, gusts, clouds, sky colour by hour |
| `src/physics.js` | Flight model, stalls, fuel, damage, landings, crashes |
| `src/render.js` | Pseudo-3D projection: sky, sea, terrain mesh, runways, rings |
| `src/aircraft.js` | Chase-view plane art and the cockpit instrument panel |
| `src/hud.js` | HUD, compass tape, minimap, menus, briefing, debrief |
| `src/audio.js` | Synthesised engine, wind and cues (WebAudio) |
| `src/input.js` | Keyboard and mouse |
| `src/shots.js` | Screenshot scenes and the autopilot that flies them |
| `src/random.js` | Seeded RNG and value noise |

`main.ts` (repo root) hands the game in: it copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with `buildDossier` from `vendor/makefun-game.ts` (the kit's copy, unchanged).

## Screenshots

1. `1-cover.jpg` — First Flight, ring 1 of 3 dead ahead over Arunika bay
2. `2-cockpit.jpg` — Mail Run on final to Kelana Field, lit panel
3. `3-night.jpg` — Night Ferry on final to Senja Bay by the lights
4. `4-missions.jpg` — the mission map: 12 sorties across the archipelago

All four are real renders of the game's own code, taken in headless Chromium with `?shot=` staging (see `src/shots.js`).

---

<sub>Entered on [make.fun](https://make.fun/?ref=jqzhkth7&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
