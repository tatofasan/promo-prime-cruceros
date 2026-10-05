// Cámara 2.5D con parallax. Una escena define su cámara como función pura de t (normalmente con kf()):
//   const c = { x, y, z, r }   x/y = paneo en px (en el plano focal) · z = zoom (1 = normal) · r = roll (rad)
// y dibuja cada plano con su profundidad:
//   depth 0   = infinito (cielo): no se mueve ni escala
//   depth 1   = plano focal (lo que la cámara encuadra)
//   depth >1  = primer plano (se mueve y crece más rápido que la cámara: sensación de profundidad)
// El zoom por plano es z^depth (un dolly-in hace crecer más rápido lo cercano).
import { W, H } from './time.js';
import { noise1 } from './noise.js';

export const CAM0 = Object.freeze({ x: 0, y: 0, z: 1, r: 0 });

/** Aplica la cámara al contexto para un plano de profundidad `depth`. Usar dentro de save/restore. */
export function applyCam(ctx, c = CAM0, depth = 1) {
  const cx = c.cx ?? W / 2, cy = c.cy ?? H / 2;
  const z = Math.pow(c.z ?? 1, depth);
  ctx.translate(cx, cy);
  if (c.r) ctx.rotate(c.r);
  ctx.scale(z, z);
  ctx.translate(-cx - (c.x || 0) * depth, -cy - (c.y || 0) * depth);
}

/** Dibuja fn en el plano `depth` con la cámara c. */
export function plane(ctx, c, depth, fn) {
  ctx.save();
  applyCam(ctx, c, depth);
  fn(ctx);
  ctx.restore();
}

/** Convierte un punto del plano `depth` a coordenadas de pantalla (para anclar tipografía o partículas). */
export function toScreen(c, depth, x, y) {
  const cx = c.cx ?? W / 2, cy = c.cy ?? H / 2;
  const z = Math.pow(c.z ?? 1, depth);
  let dx = (x - cx - (c.x || 0) * depth) * z, dy = (y - cy - (c.y || 0) * depth) * z;
  if (c.r) { const s = Math.sin(c.r), k = Math.cos(c.r); [dx, dy] = [dx * k - dy * s, dx * s + dy * k]; }
  return [cx + dx, cy + dy];
}

/** Cámara en mano: suma una deriva orgánica suave a la cámara c (amp en px, rollAmp en rad). */
export function handheld(c, t, { amp = 5, hz = 0.45, rollAmp = 0.002, seed = 3 } = {}) {
  return {
    ...c,
    x: (c.x || 0) + amp * noise1(t * hz, seed),
    y: (c.y || 0) + amp * 0.7 * noise1(t * hz + 31.7, seed + 1),
    r: (c.r || 0) + rollAmp * noise1(t * hz * 0.8 + 77.1, seed + 2),
  };
}
