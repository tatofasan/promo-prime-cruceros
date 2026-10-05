// Público en primer plano: dos filas de cabezas y hombros en contraluz (filo cálido del escenario arriba),
// fuera de foco (desenfoque horneado en init). En el confeti, algunos levantan los brazos con resorte.
import { makeCanvas } from '../../engine/env.js';
import { W } from '../../engine/time.js';
import { TAU, spring, clamp } from '../../engine/ease.js';
import { PAL, rgba, shade } from '../../engine/color.js';
import { rng } from '../../engine/noise.js';

const CW = W + 700, CH = 330;
let rows = [];
let arms = [];

function person(g, x, y, s, r, body, rim) {
  const headR = 30 * s * (0.9 + r() * 0.2);
  const shW = 78 * s * (0.9 + r() * 0.25);
  const neckY = y - 8 * s;
  const tilt = (r() - 0.5) * 0.25;
  const hair = r();
  const draw = (fill, dx, dy) => {
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(x - shW + dx, CH + 10);
    g.quadraticCurveTo(x - shW + dx, neckY + 14 * s + dy, x - shW * 0.45 + dx, neckY + 4 * s + dy);
    g.lineTo(x + shW * 0.45 + dx, neckY + 4 * s + dy);
    g.quadraticCurveTo(x + shW + dx, neckY + 14 * s + dy, x + shW + dx, CH + 10);
    g.closePath();
    g.fill();
    g.beginPath();
    g.ellipse(x + dx + tilt * 20 * s, neckY - headR * 0.95 + dy, headR * 0.88, headR, tilt, 0, TAU);
    g.fill();
    // rodete o sombrero ocasional
    if (hair < 0.25) { g.beginPath(); g.arc(x + dx + headR * 0.5, neckY - headR * 1.75 + dy, headR * 0.42, 0, TAU); g.fill(); }
    else if (hair < 0.35) { g.beginPath(); g.ellipse(x + dx, neckY - headR * 1.6 + dy, headR * 1.5, headR * 0.28, 0, 0, TAU); g.fill(); }
  };
  // filo de luz del escenario (arriba) y el cuerpo oscuro encima
  draw(rim, 0, -4 * s);
  draw(body, 0, 0);
}

function buildRow(seed, n, y, s, body, rim, blur) {
  const cv = makeCanvas(CW, CH);
  const g = cv.getContext('2d');
  const r = rng(seed);
  const tmp = makeCanvas(CW, CH);
  const t = tmp.getContext('2d');
  for (let i = 0; i < n; i++) {
    const x = (i + 0.3 + r() * 0.4) * (CW / n);
    // cada persona con su propia semilla para que el filo y el cuerpo coincidan
    const pr = rng(seed * 100 + i);
    person(t, x, y + (r() - 0.5) * 24 * s, s * (0.92 + r() * 0.16), pr, body, rim);
  }
  g.filter = `blur(${blur}px)`;
  g.drawImage(tmp, 0, 0);
  g.filter = 'none';
  return cv;
}

export function initCrowd() {
  if (rows.length) return;
  rows = [
    { img: buildRow(31, 11, 175, 1.0, shade(PAL.navy900, -0.1), rgba(PAL.goldLight, 0.85), 2.5), y: 735, depth: 1.35 },
    { img: buildRow(47, 8, 120, 1.45, PAL.ink, rgba(PAL.gold, 0.9), 5), y: 835, depth: 1.6 },
  ];
  const r = rng(77);
  arms = Array.from({ length: 7 }, (_, i) => ({
    x: 200 + i * 270 + (r() - 0.5) * 90,
    row: i % 3 === 0 ? 1 : 0,
    side: r() < 0.5 ? -1 : 1,
    delay: r() * 0.12,
    phone: r() < 0.35,
    len: 120 + r() * 50,
  }));
}

export const CROWD_ROWS = [{ depth: 1.35 }, { depth: 1.6 }];

/** Fila k del público (en su plano). tUp = cuándo levantan los brazos; glow = brillo del filo y las pantallas. */
export function drawCrowdRow(ctx, t, k, { tUp = 99, glow = 1 } = {}) {
  const R = rows[k];
  const x0 = -350, y0 = R.y;
  // brazos levantados detrás de la fila (se ven en contraluz)
  for (const a of arms) {
    if (a.row !== k) continue;
    const u = spring(t, tUp + a.delay, { from: 0, to: 1, freq: 3.2, damp: 6 });
    if (u <= 0.01) continue;
    const bx = x0 + 350 + a.x, by = y0 + 290;
    const sc = k ? 1.3 : 1;
    const ang = -Math.PI / 2 + a.side * (0.22 + 0.1 * Math.sin(t * 6 + a.x));
    const len = a.len * 0.5 * sc * clamp(u, 0, 1.12);
    // brazo con codo (dos tramos), mano y celular ocasional
    const ex = bx + Math.cos(ang - a.side * 0.35) * len, ey = by + Math.sin(ang - a.side * 0.35) * len;
    const hx = ex + Math.cos(ang + a.side * 0.12) * len * 0.95, hy = ey + Math.sin(ang + a.side * 0.12) * len * 0.95;
    const body = k ? PAL.ink : shade(PAL.navy900, -0.1);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [col, w, dy] of [[rgba(PAL.goldLight, 0.75 * glow), 15 * sc, -2.5], [body, 13 * sc, 0]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(bx, by + dy); ctx.lineTo(ex, ey + dy); ctx.lineTo(hx, hy + dy); ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(hx, hy + dy, 9 * sc, 0, TAU); ctx.fill();
    }
    if (a.phone) {
      ctx.translate(hx, hy - 6 * sc);
      ctx.rotate(ang + Math.PI / 2 + a.side * 0.12);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(-11 * sc, -24 * sc, 22 * sc, 36 * sc);
      ctx.fillStyle = rgba(PAL.aqua100, 0.85 * glow);
      ctx.fillRect(-8.5 * sc, -21.5 * sc, 17 * sc, 30 * sc);
    }
    ctx.restore();
  }
  ctx.drawImage(R.img, x0, y0);
}
