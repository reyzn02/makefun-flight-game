// Keyboard and mouse. Held keys steer; one-shot presses (start, pause, gear,
// flaps, camera, mute, reset) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost or counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_GEAR = 4;
export const ACTION_FLAPS = 8;
export const ACTION_CAMERA = 16;
export const ACTION_MUTE = 32;
export const ACTION_RESET = 64;
export const ACTION_UP = 128;
export const ACTION_DOWN = 256;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const PITCH_UP = new Set(['ArrowDown', 'KeyS']); // pull back = nose up
const PITCH_DOWN = new Set(['ArrowUp', 'KeyW']);
const THROTTLE_UP = new Set(['ShiftLeft', 'ShiftRight', 'Equal']);
const THROTTLE_DOWN = new Set(['ControlLeft', 'ControlRight', 'Minus']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  let left = false, right = false;
  let pitchUp = false, pitchDown = false;
  let thrUp = false, thrDown = false;
  let actions = 0;
  let mouseSteer = false;
  let mouseX = 0, mouseY = 0;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (PITCH_UP.has(event.code)) pitchUp = true;
    else if (PITCH_DOWN.has(event.code)) pitchDown = true;
    else if (THROTTLE_UP.has(event.code)) thrUp = true;
    else if (THROTTLE_DOWN.has(event.code)) thrDown = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (event.code === 'KeyG') { if (!event.repeat) actions |= ACTION_GEAR; }
    else if (event.code === 'KeyF') { if (!event.repeat) actions |= ACTION_FLAPS; }
    else if (event.code === 'KeyC') { if (!event.repeat) actions |= ACTION_CAMERA; }
    else if (event.code === 'KeyM') { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (event.code === 'KeyR') { if (!event.repeat) actions |= ACTION_RESET; }
    else if (event.code === 'ArrowUp' && event.shiftKey) { if (!event.repeat) actions |= ACTION_UP; }
    else if (event.code === 'ArrowDown' && event.shiftKey) { if (!event.repeat) actions |= ACTION_DOWN; }
    else return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (PITCH_UP.has(event.code)) pitchUp = false;
    else if (PITCH_DOWN.has(event.code)) pitchDown = false;
    else if (THROTTLE_UP.has(event.code)) thrUp = false;
    else if (THROTTLE_DOWN.has(event.code)) thrDown = false;
  });
  window.addEventListener('blur', () => {
    left = right = pitchUp = pitchDown = thrUp = thrDown = false;
    mouseSteer = false;
  });
  target.addEventListener('pointerdown', (event) => {
    mouseSteer = true;
    mouseX = event.clientX / window.innerWidth;
    mouseY = event.clientY / window.innerHeight;
  });
  window.addEventListener('pointermove', (event) => {
    if (!mouseSteer) return;
    mouseX = event.clientX / window.innerWidth;
    mouseY = event.clientY / window.innerHeight;
  });
  window.addEventListener('pointerup', () => { mouseSteer = false; });

  return {
    /** -1..1 roll input (right positive), -1..1 pitch input (up positive). */
    steering() {
      let roll = (right ? 1 : 0) - (left ? 1 : 0);
      let pitch = (pitchUp ? 1 : 0) - (pitchDown ? 1 : 0);
      if (mouseSteer) {
        roll += (mouseX - 0.5) * 2.4;
        pitch += (0.5 - mouseY) * 2.0;
      }
      return {
        roll: Math.max(-1, Math.min(1, roll)),
        pitch: Math.max(-1, Math.min(1, pitch)),
        throttle: (thrUp ? 1 : 0) - (thrDown ? 1 : 0),
      };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
