// Cámara de mesa en perspectiva para el casino: proyecta el plano de la mesa a pantalla.
// Mundo: x a la derecha, y hacia el fondo (en vista cenital = arriba de la pantalla), z altura.
// pitch 0 = cenital; al subir, la cámara se inclina hacia el horizonte. Con D = F la escala en el blanco es 1.
import { W, H } from '../../engine/time.js';

export function tableCam({ tx = 0, ty = 0, D = 2400, pitch = 0, yaw = 0, roll = 0, F = 2400, sx = W / 2, sy = H / 2, ox = 0, oy = 0 } = {}) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cy = Math.cos(yaw), sy2 = Math.sin(yaw);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  /** Punto del mundo → { x, y, s } en pantalla (s = escala local en px por unidad). */
  function p(x, y, z = 0) {
    const dx = x - tx, dy = y - ty;
    const rx = dx * cy + dy * sy2, ry = -dx * sy2 + dy * cy;
    const py = ry + D * sp, pz = z - D * cp;
    const zc = Math.max(1, py * sp - pz * cp);
    const yc = py * cp + pz * sp;
    const s = F / zc;
    const X = rx * s, Y = -yc * s;
    return { x: sx + ox + X * cr - Y * sr, y: sy + oy + X * sr + Y * cr, s };
  }
  /** Afín local en (x, y, z): coordenadas de imagen (u = x del mundo, v = −y del mundo) → pantalla. */
  function aff(x, y, z = 0) {
    const o = p(x, y, z), ex = p(x + 1, y, z), ey = p(x, y - 1, z);
    return [ex.x - o.x, ex.y - o.y, ey.x - o.x, ey.y - o.y, o.x, o.y];
  }
  /** Vector de pantalla de una unidad de altura (z) en (x, y, z). */
  function up(x, y, z = 0) {
    const o = p(x, y, z), u = p(x, y, z + 1);
    return [u.x - o.x, u.y - o.y];
  }
  return { p, aff, up, F, D, pitch, yaw };
}

/** Aplica el afín local de la cámara (multiplicándolo a la transformación actual). */
export function onPlane(ctx, cam, x, y, z, fn) {
  const m = cam.aff(x, y, z);
  ctx.save();
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  fn(ctx);
  ctx.restore();
}
