// Sound, all synthesised in code — no audio files. A low engine drone that
// follows the throttle, wind noise that follows the speed, and short cues:
// ring chime, stall warning, gear clunk, touchdown thud, success fanfare.
export function createAudio() {
  let ctx = null;
  let engineOsc = null, engineOsc2 = null, engineGain = null, engineFilter = null;
  let windSrc = null, windGain = null, windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      // Engine: two detuned saws through a low-pass, pitch follows RPM.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();
      // Wind: looped noise through a band-pass.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      windSrc = ctx.createBufferSource();
      windSrc.buffer = buf;
      windSrc.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      windSrc.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  return {
    /** Call from a user gesture; browsers need one before audio runs. */
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setMuted(m) { muted = m; if (engineGain) engineGain.gain.value = m ? 0 : engineGain.gain.value; },
    isMuted() { return muted; },
    /** Continuous engine + wind, called every frame with the plane's state. */
    update(plane) {
      if (!ctx || muted) return;
      const rpm = 0.25 + plane.throttle * 0.75;
      const base = 52 + rpm * 66 + plane.speed * 0.12;
      engineOsc.frequency.value = base;
      engineOsc2.frequency.value = base * 1.5 + 3;
      engineFilter.frequency.value = 300 + rpm * 900;
      engineGain.gain.value = plane.onGround && plane.throttle < 0.05 ? 0.012 : 0.03 + rpm * 0.05;
      windFilter.frequency.value = 500 + plane.speed * 6;
      windGain.gain.value = Math.min(0.09, plane.speed * 0.0009);
    },
    ring() { tone(880, 0.16, 'sine', 0.22); tone(1318, 0.3, 'sine', 0.2, 0.09); },
    stall() { tone(420, 0.12, 'square', 0.1); },
    gear() { tone(180, 0.1, 'triangle', 0.2); tone(120, 0.14, 'triangle', 0.18, 0.08); },
    touchdown() { tone(90, 0.18, 'sine', 0.35); },
    crash() { tone(70, 0.6, 'sawtooth', 0.3); tone(45, 0.9, 'sine', 0.3, 0.05); },
    fanfare() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.2, i * 0.12));
    },
    click() { tone(660, 0.05, 'square', 0.08); },
  };
}
