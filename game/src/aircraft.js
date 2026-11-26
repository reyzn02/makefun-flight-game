// The aircraft themselves: how each one looks from behind (chase view) and
// the instrument panel the pilot sees from the cockpit. All drawn, no images.
import { PALETTE, FONT } from './config.js';

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

/**
 * The chase-view aircraft, centred low on the screen, banked with the roll,
 * pitched a touch with the climb, propeller blurred, nav lights blinking.
 */
export function drawChasePlane(ctx, view, plane, elapsed) {
  const ac = plane.aircraft;
  const cx = view.w / 2;
  const cy = view.h * 0.66;
  const s = view.h / 720; // sprite scale with window height
  const w = 250 * s;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((plane.roll * Math.PI) / 180 * 0.55);
  ctx.translate(0, -plane.pitch * s * 1.1);
  // Soft shadow on the world below (a dark ellipse under the plane).
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 96 * s, 120 * s, 14 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tailplane and fin first (behind the fuselage).
  ctx.fillStyle = shade(ac.livery2, 0.75);
  ctx.beginPath(); // horizontal stabiliser
  ctx.moveTo(-14 * s, -52 * s); ctx.lineTo(-78 * s, -66 * s); ctx.lineTo(-74 * s, -48 * s); ctx.lineTo(-12 * s, -38 * s);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14 * s, -52 * s); ctx.lineTo(78 * s, -66 * s); ctx.lineTo(74 * s, -48 * s); ctx.lineTo(12 * s, -38 * s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(ac.livery, 0.9); // vertical fin
  ctx.beginPath();
  ctx.moveTo(-10 * s, -46 * s); ctx.lineTo(0, -96 * s); ctx.lineTo(12 * s, -48 * s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = ac.livery2;
  ctx.fillRect(-3 * s, -92 * s, 6 * s, 10 * s);

  // Main wings, swept slightly back, with livery tips.
  ctx.fillStyle = shade(ac.livery, 0.85);
  ctx.beginPath();
  ctx.moveTo(-16 * s, -18 * s); ctx.lineTo(-w / 2, -34 * s); ctx.lineTo(-w / 2 + 8 * s, -6 * s); ctx.lineTo(-14 * s, 6 * s);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(16 * s, -18 * s); ctx.lineTo(w / 2, -34 * s); ctx.lineTo(w / 2 - 8 * s, -6 * s); ctx.lineTo(14 * s, 6 * s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = ac.livery2;
  ctx.fillRect(-w / 2, -32 * s, 14 * s, 16 * s);
  ctx.fillRect(w / 2 - 14 * s, -32 * s, 14 * s, 16 * s);

  // Fuselage: shaded body with a livery cheatline and windows.
  const body = ctx.createLinearGradient(0, -34 * s, 0, 30 * s);
  body.addColorStop(0, '#f4f6f8');
  body.addColorStop(0.45, '#dfe6ec');
  body.addColorStop(1, '#9fb0bd');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -78 * s);
  ctx.quadraticCurveTo(20 * s, -70 * s, 22 * s, -30 * s);
  ctx.quadraticCurveTo(24 * s, 10 * s, 14 * s, 42 * s);
  ctx.quadraticCurveTo(0, 54 * s, -14 * s, 42 * s);
  ctx.quadraticCurveTo(-24 * s, 10 * s, -22 * s, -30 * s);
  ctx.quadraticCurveTo(-20 * s, -70 * s, 0, -78 * s);
  ctx.fill();
  // Cheatline.
  ctx.fillStyle = ac.livery;
  ctx.beginPath();
  ctx.moveTo(-22 * s, -8 * s); ctx.quadraticCurveTo(0, -2 * s, 22 * s, -8 * s);
  ctx.lineTo(20 * s, 2 * s); ctx.quadraticCurveTo(0, 8 * s, -20 * s, 2 * s);
  ctx.closePath(); ctx.fill();
  // Windows.
  ctx.fillStyle = '#16222e';
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.ellipse(i * 8.5 * s, -42 * s, 3.4 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Registration.
  ctx.fillStyle = '#2b3542';
  ctx.font = `bold ${11 * s}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(ac.reg, 0, 30 * s);
  // Panel lines and rivets for a built look.
  ctx.strokeStyle = 'rgba(60,70,84,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-20 * s, -28 * s); ctx.lineTo(20 * s, -28 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-22 * s, 12 * s); ctx.lineTo(22 * s, 12 * s); ctx.stroke();

  if (ac.id === 'rajawali') {
    // Jet: exhaust glow, no propeller.
    const glow = ctx.createRadialGradient(0, 48 * s, 2, 0, 48 * s, 26 * s);
    glow.addColorStop(0, `rgba(140,200,255,${0.5 + 0.3 * plane.throttle})`);
    glow.addColorStop(1, 'rgba(140,200,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 48 * s, 26 * s, 0, Math.PI * 2); ctx.fill();
  } else {
    // Propeller: blurred disc + two blades, spinning with throttle.
    const spin = elapsed * (6 + plane.throttle * 34);
    ctx.save();
    ctx.translate(0, -72 * s);
    ctx.fillStyle = 'rgba(30,34,40,0.16)';
    ctx.beginPath(); ctx.ellipse(0, 0, 30 * s, 34 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(spin);
    ctx.fillStyle = 'rgba(30,34,40,0.75)';
    ctx.beginPath(); ctx.ellipse(0, -20 * s, 3 * s, 18 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 20 * s, 3 * s, 18 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#2b3542';
    ctx.beginPath(); ctx.arc(0, -72 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
  }

  // Nav lights: red left, green right, white strobe blinking.
  const blink = Math.sin(elapsed * 6) > 0;
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath(); ctx.arc(-w / 2 + 4 * s, -20 * s, 3.4 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#34d17b';
  ctx.beginPath(); ctx.arc(w / 2 - 4 * s, -20 * s, 3.4 * s, 0, Math.PI * 2); ctx.fill();
  if (blink) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, -94 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
  }
  // Damage smoke trails from the engine when hurt.
  if (plane.damage > 35) {
    ctx.fillStyle = `rgba(60,60,60,${Math.min(0.55, plane.damage / 160)})`;
    for (let i = 0; i < 5; i += 1) {
      const t = ((elapsed * 0.8 + i / 5) % 1);
      ctx.beginPath();
      ctx.arc((Math.sin(i * 7 + elapsed) * 8) * s, (-80 - t * 60) * s, (6 + t * 16) * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** One round gauge: face, ticks, needle, label and a lit value. */
function gauge(ctx, x, y, r, label, valueText, frac, color) {
  ctx.save();
  ctx.translate(x, y);
  // Face.
  const face = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  face.addColorStop(0, '#1a2230');
  face.addColorStop(1, '#0a0e14');
  ctx.fillStyle = face;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4a5568';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Ticks.
  ctx.strokeStyle = '#8fa3b8';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 10; i += 1) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
    ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
    ctx.stroke();
  }
  // Needle.
  const na = Math.PI * 0.75 + Math.max(0, Math.min(1, frac)) * Math.PI * 1.5;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(na) * r * 0.78, Math.sin(na) * r * 0.78);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2); ctx.fill();
  // Label + value.
  ctx.fillStyle = '#9fb0c3';
  ctx.font = `bold ${Math.max(8, r * 0.24)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(label, 0, r * 0.55);
  ctx.fillStyle = PALETTE.gaugeLit;
  ctx.font = `bold ${Math.max(9, r * 0.3)}px ${FONT}`;
  ctx.fillText(valueText, 0, -r * 0.42);
  ctx.restore();
}

/** Attitude indicator: a ball that rolls and pitches with the aircraft. */
function attitude(ctx, x, y, r, plane) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
  ctx.rotate((-plane.roll * Math.PI) / 180);
  const dy = plane.pitch * r * 0.06;
  ctx.fillStyle = '#2f6fd0';
  ctx.fillRect(-r, -r + dy, r * 2, r + dy);
  ctx.fillStyle = '#8a6b46';
  ctx.fillRect(-r, dy, r * 2, r - dy + 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-r, dy); ctx.lineTo(r, dy); ctx.stroke();
  for (const off of [-0.5, 0.5]) {
    ctx.beginPath(); ctx.moveTo(-r * 0.4, dy + off * r * 0.5); ctx.lineTo(r * 0.4, dy + off * r * 0.5); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#4a5568';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  // Fixed wings marker.
  ctx.strokeStyle = '#f2c94c';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - r * 0.55, y); ctx.lineTo(x - r * 0.18, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + r * 0.18, y); ctx.lineTo(x + r * 0.55, y); ctx.stroke();
  ctx.fillStyle = '#f2c94c';
  ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9fb0c3';
  ctx.font = `bold ${Math.max(8, r * 0.24)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', x, y + r * 0.72);
}

/**
 * The cockpit: a lit instrument panel across the bottom of the screen —
 * airspeed, attitude, altimeter, heading, vertical speed, fuel — plus the
 * throttle quadrant and gear/flap lights.
 */
export function drawCockpitPanel(ctx, view, plane) {
  const ac = plane.aircraft;
  const ph = view.h * 0.34;
  const py = view.h - ph;
  // Panel body.
  const g = ctx.createLinearGradient(0, py, 0, view.h);
  g.addColorStop(0, '#2a323e');
  g.addColorStop(0.12, '#1c222c');
  g.addColorStop(1, '#12161d');
  ctx.fillStyle = g;
  ctx.fillRect(0, py, view.w, ph);
  ctx.strokeStyle = '#39424f';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(view.w, py); ctx.stroke();
  // Glare shield.
  ctx.fillStyle = '#0c0f14';
  ctx.fillRect(0, py - 10, view.w, 10);

  const r = Math.min(52, ph * 0.32);
  const cy = py + ph * 0.42;
  const cx = view.w / 2;
  const gap = r * 2.35;
  const kt = plane.speed * 1.94384;
  const altFt = plane.y * 3.28084;
  gauge(ctx, cx - gap * 2.4, cy, r, 'AIRSPEED', `${Math.round(kt)}`, kt / (ac.maxSpeed * 1.94384 * 1.15), '#7fe3ff');
  attitude(ctx, cx - gap * 1.2, cy, r, plane);
  gauge(ctx, cx, cy, r, 'ALTITUDE', `${Math.round(altFt)}`, Math.min(1, altFt / 12000), '#7fe3ff');
  gauge(ctx, cx + gap * 1.2, cy, r, 'HEADING', `${String(Math.round(plane.heading)).padStart(3, '0')}°`, plane.heading / 360, '#7fe3ff');
  gauge(ctx, cx + gap * 2.4, cy, r, 'VERT SPEED', `${plane.vspeed >= 0 ? '+' : ''}${Math.round(plane.vspeed * 196.85)}`, (plane.vspeed + 15) / 30, plane.vspeed < -8 ? '#ff5a4e' : '#7fe3ff');
  gauge(ctx, cx - gap * 3.5, cy, r * 0.85, 'FUEL', `${Math.round((plane.fuel / ac.fuelCap) * 100)}%`, plane.fuel / ac.fuelCap, plane.fuel / ac.fuelCap < 0.2 ? '#ff5a4e' : '#ffb347');

  // Throttle quadrant (left) and gear/flap lights (right).
  const qx = cx - gap * 4.6, qy = py + ph * 0.3;
  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(qx - 12, qy - 10, 26, ph * 0.55);
  ctx.fillStyle = '#39424f';
  ctx.fillRect(qx - 2, qy - 8, 4, ph * 0.5);
  const leverY = qy - 8 + (1 - plane.throttle) * ph * 0.5;
  ctx.fillStyle = '#f2c94c';
  ctx.fillRect(qx - 10, leverY - 4, 20, 8);
  ctx.fillStyle = '#9fb0c3';
  ctx.font = `bold 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('THR', qx, qy + ph * 0.62);
  ctx.fillText(`${Math.round(plane.throttle * 100)}%`, qx, qy + ph * 0.76);

  const lx = view.w - 150;
  const lights = [
    { label: 'GEAR', on: plane.gear || ac.gearFixed, color: '#58d68d' },
    { label: 'FLAPS', on: plane.flaps > 0, color: '#7fe3ff' },
    { label: 'STALL', on: plane.stallWarn, color: '#ff5a4e' },
  ];
  lights.forEach((l, i) => {
    const ly = py + 26 + i * 26;
    ctx.fillStyle = l.on ? l.color : '#2a323e';
    ctx.beginPath(); ctx.arc(lx, ly, 7, 0, Math.PI * 2); ctx.fill();
    if (l.on) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(lx, ly, 10, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#9fb0c3';
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(l.label, lx + 14, ly + 4);
  });
  // Damage bar on the panel.
  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(lx - 8, py + ph - 30, 130, 10);
  ctx.fillStyle = plane.damage > 50 ? '#ff5a4e' : plane.damage > 20 ? '#ffb347' : '#58d68d';
  ctx.fillRect(lx - 8, py + ph - 30, 130 * (1 - plane.damage / 100), 10);
  ctx.fillStyle = '#9fb0c3';
  ctx.font = `bold 10px ${FONT}`;
  ctx.fillText('AIRFRAME', lx - 8, py + ph - 36);
}
