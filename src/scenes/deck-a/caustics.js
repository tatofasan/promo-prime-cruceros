// Cáusticas del fondo de la pileta en vector: celdas de una grilla hexagonal que se mueven con ruido; cada
// vértice es el promedio de 3 centros vecinos (teselado tipo Voronoi) y la celda se encoge y se redondea.
// La luz es lo que queda ENTRE celdas: un solo Path2D (rect + celdas) relleno con 'evenodd'. Nítido a cualquier zoom.
import { hash, noise1 } from '../../engine/noise.js';
import { smoothInto } from './shape.js';

const NB_EVEN = [[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]];
const NB_ODD = [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]];

/** Grilla de celdas que cubre el rectángulo (mundo). */
export function makeCaustics({ x0, y0, x1, y1, step = 62, seed = 1, jitter = 0.35 }) {
  const dy = step * 0.866;
  const cols = Math.ceil((x1 - x0) / step) + 3, rows = Math.ceil((y1 - y0) / dy) + 3;
  const cells = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      cells.push({
        i, j,
        bx: x0 - step + i * step + (j % 2 ? step / 2 : 0) + (hash(i, j, seed) - 0.5) * step * jitter,
        by: y0 - dy + j * dy + (hash(i, j, seed + 1) - 0.5) * dy * jitter,
        ph: hash(i, j, seed + 2) * 97, ph2: hash(i, j, seed + 3) * 97,
      });
    }
  }
  const idx = (i, j) => (i < 0 || j < 0 || i >= cols || j >= rows ? -1 : j * cols + i);
  for (const c of cells) {
    c.n = (c.j % 2 ? NB_ODD : NB_EVEN).map(([a, b]) => idx(c.i + a, c.j + b));
    c.ok = c.n.every((k) => k >= 0);
  }
  return { cells, step, x0, y0, x1, y1, px: new Float32Array(cells.length), py: new Float32Array(cells.length) };
}

/**
 * Path de la red de luz en t (rect + celdas, rellenar con 'evenodd').
 * amp = cuánto se mueven los centros (fracción del paso) · gap = grosor medio de la luz · gapVar = variación.
 */
export function causticPath(K, t, { amp = 0.24, speed = 1, gap = 0.16, gapVar = 0.09, seed = 3, sx = 0, sy = 0 } = {}) {
  const { cells, step, px, py } = K;
  const a = amp * step;
  for (let k = 0; k < cells.length; k++) {
    const c = cells[k];
    px[k] = c.bx + a * noise1(t * speed + c.ph, seed) + sx * (t - 6.5);
    py[k] = c.by + a * noise1(t * speed * 0.9 + c.ph + 31, seed + 1) + sy * (t - 6.5);
  }
  const p = new Path2D();
  p.rect(K.x0 - step * 2, K.y0 - step * 2, K.x1 - K.x0 + step * 4, K.y1 - K.y0 + step * 4);
  const pts = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
  for (let k = 0; k < cells.length; k++) {
    const c = cells[k];
    if (!c.ok) continue;
    const cx = px[k], cy = py[k];
    const s = 1 - gap - gapVar * noise1(t * 0.8 * speed + c.ph2, seed + 2);
    for (let m = 0; m < 6; m++) {
      const q = c.n[m], r = c.n[(m + 1) % 6];
      const vx = (cx + px[q] + px[r]) / 3, vy = (cy + py[q] + py[r]) / 3;
      pts[m][0] = cx + (vx - cx) * s;
      pts[m][1] = cy + (vy - cy) * s;
    }
    smoothInto(p, pts, 0, 0, true, 0.75);
  }
  return p;
}
