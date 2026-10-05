// Formas para ilustrar con oficio: cintas de ancho variable, curvas suaves con desplazamiento y
// sombreado de 3 tonos (base + medialuna de sombra + filo de luz) orientado a la vela.
import { TAU } from '../../engine/ease.js';

/** Catmull-Rom cerrado que agrega un subpath a `p` (con moveTo propio), desplazado (ox, oy). */
export function smoothInto(p, pts, ox = 0, oy = 0, closed = true, tension = 0.5) {
  const n = pts.length;
  const get = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  p.moveTo(pts[0][0] + ox, pts[0][1] + oy);
  const segs = closed ? n : n - 1;
  const k = tension / 3;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    p.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) * k + ox, p1[1] + (p2[1] - p0[1]) * k + oy,
      p2[0] - (p3[0] - p1[0]) * k + ox, p2[1] - (p3[1] - p1[1]) * k + oy,
      p2[0] + ox, p2[1] + oy,
    );
  }
  if (closed) p.closePath();
  return p;
}

/** Forma = generador de Path2D desplazable: mk(ox, oy, into?) */
export const blob = (pts) => (ox = 0, oy = 0, into = null) => smoothInto(into || new Path2D(), pts, ox, oy);
export const ellipse = (x, y, rx, ry, rot = 0) => (ox = 0, oy = 0, into = null) => {
  const p = into || new Path2D();
  p.moveTo(x + ox + Math.cos(rot) * rx, y + oy + Math.sin(rot) * rx);
  p.ellipse(x + ox, y + oy, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
  p.closePath();
  return p;
};
export const circle = (x, y, r) => ellipse(x, y, r, r);

/** Muestras de una Bézier cúbica. */
export function bez(p0, p1, p2, p3, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), v = 1 - u;
    out.push([
      v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
      v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
    ]);
  }
  return out;
}

/** Contorno de una cinta de ancho variable a lo largo de `center` (wfn(u) = ancho en u∈[0,1]). */
export function ribbonPts(center, wfn) {
  const n = center.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = center[i];
    const [xa, ya] = center[Math.max(0, i - 1)], [xb, yb] = center[Math.min(n - 1, i + 1)];
    let tx = xb - xa, ty = yb - ya;
    const d = Math.hypot(tx, ty) || 1;
    tx /= d; ty /= d;
    const w = Math.max(0.3, wfn(i / (n - 1)) / 2);
    L.push([x - ty * w, y + tx * w]);
    R.push([x + ty * w, y - tx * w]);
  }
  return [...L, ...R.reverse()];
}

/**
 * Sombreado de 3 tonos: base, medialuna de sombra del lado opuesto a la luz y filo de luz del lado de la vela.
 * L = [lx, ly] vector unitario hacia la luz. dd/dl = grosor de la sombra y del filo.
 */
export function tone3(ctx, mk, { base, dark, light, L, dd = 5, dl = 2.5, gloss = null }) {
  const S = mk(0, 0);
  ctx.fillStyle = dark;
  ctx.fill(S);
  ctx.save();
  ctx.clip(S);
  ctx.fillStyle = base;
  ctx.fill(mk(L[0] * dd, L[1] * dd));
  if (light) {
    const p = new Path2D();
    p.rect(-4000, -4000, 8000, 8000);
    mk(-L[0] * dl, -L[1] * dl, p);
    ctx.fillStyle = light;
    ctx.fill(p, 'evenodd');
  }
  if (gloss) gloss(ctx);
  ctx.restore();
  return S;
}

/** Medialuna (forma − forma desplazada) rellena con `color`: para sombras y brillos sueltos. */
export function crescent(ctx, mk, dx, dy, color) {
  ctx.save();
  ctx.clip(mk(0, 0));
  const p = new Path2D();
  p.rect(-4000, -4000, 8000, 8000);
  mk(dx, dy, p);
  ctx.fillStyle = color;
  ctx.fill(p, 'evenodd');
  ctx.restore();
}

/** Rota un vector unitario. */
export const rotV = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/**
 * Sombreado de 3 tonos que admite formas UNIDAS (varios subpaths superpuestos, relleno nonzero): una pierna con
 * muslo + pantorrilla + pie se sombrea como una sola pieza (sin costuras en las articulaciones).
 */
export function tone3u(ctx, mk, { base, dark, light, L, dd = 4, dl = 2 }) {
  const S = mk(0, 0);
  ctx.save();
  ctx.clip(S);
  ctx.fillStyle = light || base;
  ctx.fill(S);
  const away = mk(-L[0] * dl, -L[1] * dl);
  ctx.fillStyle = dark;
  ctx.fill(away);
  ctx.clip(away);
  ctx.fillStyle = base;
  ctx.fill(mk(L[0] * dd, L[1] * dd));
  ctx.restore();
  return S;
}

/** Une varias formas en una sola: mk(ox, oy, into) de cada una al mismo Path2D. */
export const union = (...mks) => (ox = 0, oy = 0, into = null) => {
  const p = into || new Path2D();
  for (const m of mks) m(ox, oy, p);
  return p;
};
