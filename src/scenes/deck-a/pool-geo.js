// Geometría de la cubierta de la pileta (coordenadas de mundo, piso de teca en h = 0, 1 px ≈ 1 cm·1,05).
// La cámara cenital (util.js) mira desde A = F de altura: lo alto crece y se abre desde el centro.
import { TAU } from '../../engine/ease.js';

export const F = 3000;
/** Pileta: rectángulo redondeado (borde interno del solado). */
export const POOL = { x0: 330, y0: 268, x1: 1440, y1: 834, r: 146 };
export const FLOOR_H = -118;   // fondo (aparente, con la refracción)
export const WATER_H = -7;     // superficie del agua
export const TILE_H = -30;     // fin de la guarda de venecitas de la pared
export const COPING = 30;      // borde de piedra
export const MOSAIC = 30;      // guarda de venecitas en el piso
export const MARGIN = 24;      // tabla de borde que sigue la pileta
export const EDGE_X = 1762;    // borde de la cubierta (baranda); más allá, el mar
export const SEA_H = -3300;
export const RAIL_H = 104;
/** Tobogán en espiral: horario de arriba hacia abajo, sale por el sur hacia el oeste. */
/** Tobogán en espiral cónica: arriba cerrada (R0) y abajo abierta (R1), así desde arriba se lee la espiral. */
export const SLIDE = { cx: 1622, cy: 700, R0: 52, R1: 158, hTop: 420, hBot: 62, turns: 1.75, w: 48 };
export const DECK = { x0: -340, y0: -770, x1: EDGE_X + 6, y1: 1850 };

// sol arriba a la derecha (igual que el preset 'golden' del ojo de buey): sombras largas abajo a la izquierda
export const SUN = [0.62, -0.785];
export const SUN_K = 0.66;
/** Corrimiento de la sombra de algo a altura h sobre un plano a altura h0. */
export const shadowOff = (h, h0 = 0) => [-SUN[0] * SUN_K * (h - h0), -SUN[1] * SUN_K * (h - h0)];

/** Rectángulo redondeado de la pileta agrandado `d` px (negativo = hacia adentro). */
export function poolPath(d = 0, into = null) {
  const p = into || new Path2D();
  const x0 = POOL.x0 - d, y0 = POOL.y0 - d, x1 = POOL.x1 + d, y1 = POOL.y1 + d;
  const r = Math.max(1, POOL.r + d);
  p.moveTo(x0 + r, y0);
  p.lineTo(x1 - r, y0);
  p.arc(x1 - r, y0 + r, r, -Math.PI / 2, 0);
  p.lineTo(x1, y1 - r);
  p.arc(x1 - r, y1 - r, r, 0, Math.PI / 2);
  p.lineTo(x0 + r, y1);
  p.arc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI);
  p.lineTo(x0, y0 + r);
  p.arc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5);
  p.closePath();
  return p;
}

/** Punto del contorno de la pileta (agrandada d) en la fracción u ∈ [0,1) del perímetro, con su normal hacia afuera. */
export function poolOutline(d = 0) {
  const x0 = POOL.x0 - d, y0 = POOL.y0 - d, x1 = POOL.x1 + d, y1 = POOL.y1 + d;
  const r = Math.max(1, POOL.r + d);
  const segs = [];
  const line = (ax, ay, bx, by, nx, ny) => segs.push({ len: Math.hypot(bx - ax, by - ay), at: (u) => [ax + (bx - ax) * u, ay + (by - ay) * u, nx, ny] });
  const arc = (cx, cy, a0) => segs.push({ len: (r * Math.PI) / 2, at: (u) => { const a = a0 + (u * Math.PI) / 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a), Math.sin(a)]; } });
  line(x0 + r, y0, x1 - r, y0, 0, -1); arc(x1 - r, y0 + r, -Math.PI / 2);
  line(x1, y0 + r, x1, y1 - r, 1, 0); arc(x1 - r, y1 - r, 0);
  line(x1 - r, y1, x0 + r, y1, 0, 1); arc(x0 + r, y1 - r, Math.PI / 2);
  line(x0, y1 - r, x0, y0 + r, -1, 0); arc(x0 + r, y0 + r, Math.PI);
  const total = segs.reduce((s, q) => s + q.len, 0);
  return {
    total,
    at(u) {
      let d2 = (((u % 1) + 1) % 1) * total;
      for (const s of segs) { if (d2 <= s.len) return s.at(d2 / s.len); d2 -= s.len; }
      return segs[0].at(0);
    },
  };
}

/** ¿(x, y) cae dentro de la pileta? */
export function inPool(x, y, d = 0) {
  const x0 = POOL.x0 - d, y0 = POOL.y0 - d, x1 = POOL.x1 + d, y1 = POOL.y1 + d, r = POOL.r + d;
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

export const ang = (a) => ((a % TAU) + TAU) % TAU;
