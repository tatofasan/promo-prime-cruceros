// Pétalos de rosa sobre el mantel: caen revoloteando desde arriba de la cámara (entran de afuera del cuadro, sin
// fundidos) y quedan apoyados. Más pétalos de primer plano, desenfocados y muy cerca de la cámara: parallax fuerte
// con el push-in y la cámara en mano. Respetan las zonas libres de TYPE (arriba y abajo a la izquierda).
import { clamp, E } from '../../engine/ease.js';
import { noise1 } from '../../engine/noise.js';
import { makeCanvas } from '../../engine/env.js';
import { sprite, project, onPlane, put, inkDisc, lightAng, flatten } from './util.js';
import { blob, tone3 } from './shape.js';

const COLS = [['#FF7A57', '#C9452C', '#FFC0A6'], ['#FFB59A', '#DE8466', '#FFE3D6'], ['#FFD27A', '#D29A38', '#FFF0C9']];
// [x, y, rot, color, tIn]
export const PETALS = [
  [1530, 640, 0.6, 0, 7.66], [1690, 520, 2.1, 1, 7.70], [1330, 905, -0.8, 0, 7.73], [760, 870, 1.4, 1, 7.76],
  [330, 520, 2.6, 0, 7.79], [1770, 880, -1.9, 2, 7.71], [480, 760, 0.3, 1, 7.82], [1450, 980, 1.1, 0, 7.75],
];

let SPR = null, FG = null;
// primer plano: [x, y (mundo), h, rot, color, deriva x/s, escala]; h alto = muy cerca de la cámara
const FGP = [
  [1264, 571, 1480, 0.7, 0, -26, 1.0], [1039, 689, 1520, -1.1, 1, 22, 1.1], [922, 387, 1560, 2.2, 2, 24, 0.9], [1223, 424, 1620, -2.4, 0, -18, 0.8],
];
export function buildPetals() {
  // pétalo desenfocado (primer plano): se dibuja grande y se desenfoca una vez
  FG = COLS.map((col) => {
    const c = makeCanvas(150, 140);
    const x = c.getContext('2d');
    x.translate(75, 70);
    x.scale(2.2, 2.2);
    const mk = blob([[-20, 0], [-12, -9], [2, -17], [16, -16], [22, -7], [18, -1], [23, 6], [15, 15], [0, 16], [-12, 9]]);
    tone3(x, mk, { base: col[0], dark: col[1], light: col[2], L: [0.5, -0.8], dd: 4, dl: 2.4 });
    const o = makeCanvas(150, 140);
    const oc = o.getContext('2d');
    oc.filter = 'blur(5px)';
    oc.drawImage(c, 0, 0);
    oc.filter = 'none';
    return { c: flatten(o), w: 150, h: 140, res: 1 };
  });
  SPR = COLS.map((col) => {
    const a = lightAng(960, 540);
    const L = [Math.cos(a), Math.sin(a)];
    return sprite(54, 50, (c) => {
      // pétalo: base angosta, borde ancho con muesca suave, enrollado de un lado
      const mk = blob([[-20, 0], [-12, -9], [2, -17], [16, -16], [22, -7], [18, -1], [23, 6], [15, 15], [0, 16], [-12, 9]]);
      tone3(c, mk, { base: col[0], dark: col[1], light: col[2], L, dd: 4, dl: 2.4 });
      c.save();
      c.clip(mk());
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.beginPath(); c.ellipse(8, -6, 12, 5, -0.3, 0, Math.PI * 2); c.fill();
      c.strokeStyle = col[1];
      c.globalAlpha = 0.5;
      c.lineWidth = 1;
      for (const k of [-6, 0, 6]) { c.beginPath(); c.moveTo(-16, 0); c.quadraticCurveTo(0, k * 0.6, 18, k * 1.6); c.stroke(); }
      c.restore();
    }, 1.5);
  });
}

function state(p, t) {
  const [x, y, rot, , tIn] = p;
  const dur = 0.62;
  const u = clamp((t - tIn) / dur);
  // cae desde arriba de la cámara (h 1700: fuera de cuadro) y frena al posarse
  const h = 1700 * Math.pow(1 - E.outQuad(u), 1.6);
  const sway = (1 - u) * 60;
  return {
    x: x + noise1(t * 3 + x, 7) * sway, y: y + noise1(t * 3 + y, 8) * sway * 0.6, h,
    r: rot + (1 - u) * 5 * (x > 960 ? 1 : -1), flip: u < 1 ? Math.cos((t - tIn) * 14) : 1, a: 1,
  };
}

/** Pétalos de primer plano (desenfocados, muy cerca de la cámara). on 0..1 los saca de cuadro hacia afuera. */
export function drawFgPetals(ctx, C, t, out = 0) {
  for (const [x, y, h, rot, col, vx, sc] of FGP) {
    const wx = x + vx * (t - 7.5) + 8 * noise1(t * 0.7 + x, 11), wy = y + 6 * noise1(t * 0.6 + y, 12);
    const [px, py, k] = project(C, wx, wy, h + 300 * out);
    put(ctx, FG[col], px, py, { r: rot + 0.9 * noise1(t * 0.8 + h, 13) + C.r, s: (k * sc) / 2.2, sy: 0.75 + 0.25 * Math.cos(t * 1.3 + h) });
  }
}

// ráfagas de brisa: pétalos MUY cerca de la cámara (grandes y desenfocados) que cruzan el cuadro en el beat.
// 1ª con la campana (siguen su vuelo hacia arriba a la derecha), 2ª con el vino (vuelve por la izquierda, lejos de
// la acción de las copas). Ninguno pasa por encima del plato.
// [t0, dur, x0, y0, x1, y1 (pantalla, de afuera a afuera), tamaño (px), color, rot0, giro, curva]
const GUST = [
  [7.95, 0.42, 420, 1320, 2250, 560, 330, 0, 0.6, 5, 0.16],
  [7.99, 0.38, 540, 1300, 1000, -300, 190, 1, -1.2, -6, -0.1],
  [8.06, 0.42, -220, 420, 2150, -150, 120, 2, 2.0, 4, 0.2],
  [8.14, 0.4, 900, 1300, 2200, 200, 150, 0, -0.4, 5, -0.18],
  [8.45, 0.42, 1500, -300, -300, 1000, 300, 1, 1.1, -5, 0.16],
  [8.52, 0.4, 820, 1350, 560, -280, 170, 0, -2.2, 6, -0.12],
  [8.57, 0.42, 2150, 980, -240, 1180, 130, 2, 0.4, -4, 0.2],
];
const TRAIL = [1, 0.32, 0.18, 0.1];
const gustP = (u) => { const v = 2 * u - 1; return 0.5 + 0.5 * (0.4 * v * v * v + 0.6 * v); }; // rápido-afloja-rápido
function gustAt(g, t) {
  const [t0, dur, x0, y0, x1, y1, , , rot0, spin, curl] = g;
  const u = (t - t0) / dur;
  const p = gustP(clamp(u));
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  const bend = Math.sin(Math.PI * p) * curl * L * 0.5;
  return [x0 + dx * p - (dy / L) * bend, y0 + dy * p + (dx / L) * bend, rot0 + spin * u];
}
/** Pétalos de las ráfagas (coordenadas de pantalla; con estela corta en la dirección del vuelo). */
export function drawGustPetals(ctx, C, t) {
  for (const g of GUST) {
    const [t0, dur, , , , , size, col] = g;
    if (t <= t0 || t >= t0 + dur) continue;
    const sy = 0.6 + 0.4 * Math.abs(Math.cos((t - t0) * 9 + size));
    const S = FG[col], sc = size / 100;
    // desenfoque de movimiento: el pétalo se estira en la dirección del vuelo (∝ velocidad) + estela corta
    const [ax, ay] = gustAt(g, t - 0.004), [bx, by] = gustAt(g, t);
    const vx = (bx - ax) / 0.004, vy = (by - ay) / 0.004, sp = Math.hypot(vx, vy);
    const va = Math.atan2(vy, vx), st = 1 + Math.min(1.6, sp * 0.00016);
    for (let k = 3; k >= 0; k--) {
      const [x, y, r] = k ? gustAt(g, t - k * 0.0035) : [bx, by, gustAt(g, t)[2]];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(va + C.r);
      ctx.scale(st, 1);
      ctx.rotate(r - va);
      ctx.scale(sc, sc * sy);
      ctx.globalAlpha *= TRAIL[k] * (size > 250 ? 0.85 : 1);
      ctx.drawImage(S.c, -S.w / 2, -S.h / 2, S.w, S.h);
      ctx.restore();
    }
  }
}

/** Sombras de los pétalos (en la mesa). */
export function petalShadows(ctx, C, t) {
  onPlane(ctx, C, 0, (c) => {
    for (const p of PETALS) {
      if (t < p[4]) continue;
      const s = state(p, t);
      const off = 4 + s.h * 0.35;
      put(c, inkDisc(), s.x - off * 0.4, s.y + off, { s: (22 + s.h * 0.05) / 64, alpha: 0.4 * s.a * clamp(1 - s.h / 600) });
    }
  });
}

/** Pétalos (en su altura: los que caen están más cerca de la cámara). */
export function drawPetals(ctx, C, t) {
  for (const p of PETALS) {
    if (t < p[4]) continue;
    const s = state(p, t);
    const [x, y, k] = project(C, s.x, s.y, s.h);
    put(ctx, SPR[p[3]], x, y, { r: s.r + C.r, s: k, sy: Math.abs(s.flip) * 0.8 + 0.2, alpha: s.a });
  }
}
