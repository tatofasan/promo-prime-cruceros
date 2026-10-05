// Geometría para siluetas: todas las piezas se agregan con el MISMO sentido de giro, así un solo Path2D es la
// unión de la figura (regla nonzero) y se puede pintar con filo de luz y sombra sin capas.
import { smoothPath } from '../../engine/draw.js';

const area = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    s += x0 * y1 - x1 * y0;
  }
  return s;
};
/** Devuelve los puntos en sentido horario (en pantalla, y hacia abajo). */
export const cw = (pts) => (area(pts) < 0 ? pts.slice().reverse() : pts);

/** Polígono cerrado agregado a p. */
export function addPoly(p, pts) {
  const q = cw(pts);
  p.moveTo(q[0][0], q[0][1]);
  for (let i = 1; i < q.length; i++) p.lineTo(q[i][0], q[i][1]);
  p.closePath();
}
/** Curva suave cerrada (Catmull-Rom) agregada a p. */
export function addSmooth(p, pts, tension = 0.5) {
  const q = cw(pts);
  p.moveTo(q[0][0], q[0][1]);
  smoothPath(q, true, tension, p);
}
/** Círculo y elipse agregados (horario). */
export function addCircle(p, x, y, r) { p.moveTo(x + r, y); p.arc(x, y, r, 0, Math.PI * 2); p.closePath(); }
export function addEllipse(p, x, y, rx, ry, rot = 0) {
  p.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx);
  p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  p.closePath();
}

/** Puntos de una cápsula afinada de (ax, ay) radio ra a (bx, by) radio rb. */
export function capsulePts(ax, ay, ra, bx, by, rb, n = 6) {
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l;
  const a0 = Math.atan2(uy, ux);
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 - Math.PI / 2 + (i / n) * Math.PI; pts.push([bx + Math.cos(a) * rb, by + Math.sin(a) * rb]); }
  for (let i = 0; i <= n; i++) { const a = a0 + Math.PI / 2 + (i / n) * Math.PI; pts.push([ax + Math.cos(a) * ra, ay + Math.sin(a) * ra]); }
  return pts;
}
export function addCapsule(p, ax, ay, ra, bx, by, rb, n = 6) { addPoly(p, capsulePts(ax, ay, ra, bx, by, rb, n)); }

/**
 * Codo de un brazo de dos huesos (hombro s → mano h, largos L1 y L2). bend = ±1 elige de qué lado dobla.
 * Si la mano queda lejos, estira el brazo hacia ella.
 */
export function ik2(sx, sy, hx, hy, L1, L2, bend = 1) {
  const dx = hx - sx, dy = hy - sy;
  const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 0.01);
  const a = Math.atan2(dy, dx);
  const c = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const b = Math.acos(Math.max(-1, Math.min(1, c)));
  return [sx + Math.cos(a + bend * b) * L1, sy + Math.sin(a + bend * b) * L1];
}

/** Transforma puntos locales (cara a la derecha) a la pose: escala k, espejo dir, rotación rot, origen (x, y). */
export function place(pts, x, y, k = 1, dir = 1, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return pts.map(([px, py]) => {
    const lx = px * k * dir, ly = py * k;
    return [x + lx * c - ly * s, y + lx * s + ly * c];
  });
}

/**
 * Pinta una silueta en 3 tonos: filo de luz del lado de la luz (rim px), cuerpo y sombra dura del otro lado
 * (shadow px). light = vector unitario hacia la luz. Sin capas: clip + copias corridas del mismo Path2D.
 */
export function silhouette(ctx, path, light, { base, shade, rim, rimW = 3, shadeW = 6, glow = null }) {
  const [lx, ly] = light;
  ctx.fillStyle = rim;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  ctx.translate(-lx * rimW, -ly * rimW);
  ctx.fillStyle = shade;
  ctx.fill(path);
  ctx.clip(path);
  ctx.translate(lx * (rimW + shadeW), ly * (rimW + shadeW));
  ctx.fillStyle = base;
  ctx.fill(path);
  // volumen: luz cálida que «traspasa» los bordes del lado de la luz (degradé a lo largo de la luz)
  if (glow) {
    const [gx, gy, len, color, a] = glow;
    const g = ctx.createLinearGradient(gx + lx * len, gy + ly * len, gx - lx * len * 0.2, gy - ly * len * 0.2);
    g.addColorStop(0, color.replace('A)', `${a})`));
    g.addColorStop(1, color.replace('A)', '0)'));
    ctx.fillStyle = g;
    ctx.fillRect(gx - 600, gy - 600, 1200, 1200);
  }
  ctx.restore();
}
