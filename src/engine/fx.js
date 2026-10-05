// Golpes globales de pantalla como FUNCIÓN PURA de t, leídos de cues[].fx:
//   flash (0..1) + flashColor · shake (0..1) · punch (0..0.06 zoom de golpe) · rgb (0..1 separación cromática)
// Las escenas pueden sumar los suyos con addFx(t => ({ punch: 0.01 })) (por ejemplo, un latido en el bombo).
import { CUES } from './time.js';
import { noise1 } from './noise.js';

const extras = [];
export function addFx(fn) { extras.push(fn); }

const env = (dt, decay) => (dt < 0 ? 0 : Math.exp(-dt / decay));

export function fxAt(t) {
  let flash = 0, flashColor = '#ffffff', shake = 0, punch = 0, rgb = 0;
  for (const c of CUES) {
    const f = c.fx;
    if (!f) continue;
    const dt = t - c.t;
    if (dt < 0 || dt > 1.5) continue;
    if (f.flash) {
      const v = f.flash * env(dt, 0.075);
      if (v > flash) { flash = v; flashColor = f.flashColor ?? '#ffffff'; }
    }
    if (f.shake) shake += f.shake * env(dt, 0.14);
    if (f.punch) punch += f.punch * env(dt, 0.22) * Math.min(1, dt / 0.016 + 0.35);
    if (f.rgb) rgb = Math.max(rgb, f.rgb * env(dt, 0.09));
  }
  for (const fn of extras) {
    const e = fn(t) || {};
    if ((e.flash || 0) > flash) { flash = e.flash; flashColor = e.flashColor ?? flashColor; }
    shake += e.shake || 0;
    punch += e.punch || 0;
    rgb = Math.max(rgb, e.rgb || 0);
  }
  // sacudón con ruido suave (se siente de cámara, no temblequeo aleatorio)
  const sx = shake * 18 * noise1(t * 31, 11);
  const sy = shake * 13 * noise1(t * 35, 23);
  const sr = shake * 0.006 * noise1(t * 27, 37);
  return { flash: Math.min(1, flash), flashColor, shake, punch, rgb: Math.min(1, rgb), sx, sy, sr };
}
