// Sombreado en 3 tonos para formas planas (luz de arriba a la izquierda, constante en toda la escena):
// base + medialuna de sombra dura abajo/derecha (sh px) + filo de luz arriba/izquierda (rim px).
import { texture } from '../../engine/draw.js';

export const LIGHT = [-0.72, -0.69]; // dirección HACIA la luz (normalizada aprox.)

/**
 * Rellena `path` (Path2D en coords actuales) con tres tonos { base, dark, light }.
 * o = { sh: grosor de la sombra, rim: grosor del filo, grain: alfa de textura (0 = sin grano), lx, ly }
 */
export function shade3(c, path, tn, { sh = 12, rim = 3, grain = 0, lx = LIGHT[0], ly = LIGHT[1] } = {}) {
  c.save();
  c.clip(path);
  c.fillStyle = tn.dark;
  c.fill(path);
  c.save();
  c.translate(lx * sh, ly * sh);
  c.clip(path);
  c.translate(-lx * sh, -ly * sh);
  if (rim > 0) {
    c.fillStyle = tn.light;
    c.fill(path);
    c.save();
    c.translate(-lx * rim, -ly * rim);
    c.fillStyle = tn.base;
    c.fill(path);
    c.restore();
  } else {
    c.fillStyle = tn.base;
    c.fill(path);
  }
  c.restore();
  c.restore();
  if (grain > 0) texture(c, path, { alpha: grain, blend: 'overlay' });
}

/** Brillo especular en banda diagonal (superficies laqueadas), recortado a path. */
export function gloss(c, path, x0, y0, x1, y1, { alpha = 0.16, width = 0.18, at = 0.32 } = {}) {
  c.save();
  c.clip(path);
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(Math.max(0, at - width), 'rgba(255,255,255,0)');
  g.addColorStop(at, `rgba(255,255,255,${alpha})`);
  g.addColorStop(Math.min(1, at + width * 0.35), `rgba(255,255,255,${alpha * 0.55})`);
  g.addColorStop(Math.min(1, at + width), 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fill(path);
  c.restore();
}

/**
 * Filo de luz rebotada (contraluz frío del fondo) en el lado de sombra: la franja de la forma que queda
 * fuera de su copia corrida (dx, dy). pathAt(ox, oy) devuelve el Path2D corrido.
 */
export function rimLight(c, pathAt, color, { dx = -7, dy = 2, alpha = 0.6 } = {}) {
  const p = pathAt(0, 0);
  const q = new Path2D();
  q.rect(-5000, -5000, 10000, 10000);
  q.addPath(pathAt(dx, dy));
  c.save();
  c.clip(p);
  c.clip(q, 'evenodd');
  c.globalAlpha *= alpha;
  c.fillStyle = color;
  c.fill(p);
  c.restore();
}
