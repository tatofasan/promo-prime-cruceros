// Destellos puntuales sobre metal y vidrio (bronce de la valija, sello holográfico, maza del timón):
// estrellitas de 4 puntas que nacen, giran un poco y se apagan. Puras de t.
import { sparkle } from '../../engine/draw.js';
import { clamp } from '../../engine/ease.js';

/** Dibuja los destellos de la lista [[t0, x, y, size], ...] activos en t (dur ≈ 0,32 s). */
export function glints(c, t, list, { dur = 0.32, color = '#FFFFFF' } = {}) {
  for (const [t0, x, y, s] of list) {
    const p = (t - t0) / dur;
    if (p <= 0 || p >= 1) continue;
    const k = Math.sin(Math.PI * clamp(p));
    sparkle(c, x, y, s * k, { alpha: 0.95, color, rot: p * 0.6, halo: 0.8 });
  }
}
