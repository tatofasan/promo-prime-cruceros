// Ayudas internas del kit de ART (no forman parte del contrato, pero se pueden usar).
import { CAM0, toScreen } from '../engine/camera.js';
import { rgb } from '../engine/color.js';
import { makeCanvas } from '../engine/env.js';

/** Color hex con alfa → 'rgba()' (sin redondeos raros y rápido). */
export function ca(hex, a = 1) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a < 0 ? 0 : a > 1 ? 1 : +a.toFixed(4)})`;
}

/** Punto de un plano de profundidad `depth` → pantalla (cam opcional). */
export function camPt(cam, depth, x, y) {
  return toScreen(cam || CAM0, depth, x, y);
}
/** Escala de un plano de profundidad `depth` con la cámara. */
export const camZ = (cam, depth) => Math.pow((cam && cam.z) || 1, depth);

/** Vector unitario hacia la luz. */
export function unit([x, y]) {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

const lows = new Map();
/**
 * Lienzo chico persistente (se limpia en cada uso) para efectos suaves a baja resolución que después se
 * estiran (rayos, brumas). Determinista: se redibuja completo cada vez que se pide.
 */
export function lowCanvas(key, w, h) {
  let c = lows.get(key);
  if (!c) { c = makeCanvas(w, h); lows.set(key, c); }
  const x = c.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-over';
  x.filter = 'none';
  x.clearRect(0, 0, w, h);
  return c;
}

/** Envolvente «sube y baja» suave en [a, b] con rampas de largo r (0..1). */
export function window01(x, a, b, r) {
  if (x <= a || x >= b) return 0;
  const u = Math.min((x - a) / r, (b - x) / r, 1);
  return u * u * (3 - 2 * u);
}
