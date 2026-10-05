// Detalles de segunda mirada en la pileta: escalera de acero cromado, una pareja sentada en el borde con los pies
// en el agua (patalean y hacen ondas) y una pelota de playa que flota y se mece cuando le llega la onda del splash.
import { PAL } from '../../engine/color.js';
import { TAU, clamp } from '../../engine/ease.js';
import { sparkle } from '../../engine/draw.js';
import { project, onPlane, wobble } from './util.js';
import { POOL, WATER_H, FLOOR_H, SUN, shadowOff } from './pool-geo.js';
import { SPLASH_PT } from './pool-path.js';
import { T_BALL } from './pool-timeline.js';
import { drawSitter } from './figure.js';
import { SKIN, HAIR } from './pool-pal.js';

const LADDER = { x: POOL.x0, y: 560, gap: 46 };
const SITTERS = [
  { x: 1004, kind: 'one', skin: SKIN[1], hair: HAIR[3], hairStyle: 'long', suit: PAL.coral, ph: 0 },
  { x: 1052, kind: 'trunks', skin: SKIN[0], hair: HAIR[1], hairStyle: 'short', suit: PAL.navy600, ph: 1.7 },
];
// la pelota está a la distancia justa para que la primera onda la alcance en el beat de 7,031
const BALL = { x: 1224, y: 478, r: 22 };
const rotL = (a) => [SUN[0] * Math.cos(-a) - SUN[1] * Math.sin(-a), SUN[0] * Math.sin(-a) + SUN[1] * Math.cos(-a)];

/** Pelota: posición y giro en t (la onda del splash la empuja y la hace saltar un poco). */
function ballAt(t) {
  const d = Math.hypot(BALL.x - SPLASH_PT.x, BALL.y - SPLASH_PT.y);
  const hitT = T_BALL;
  const push = t > hitT ? 1 - Math.exp(-(t - hitT) * 3) : 0;
  const ux = (BALL.x - SPLASH_PT.x) / d, uy = (BALL.y - SPLASH_PT.y) / d;
  return {
    x: BALL.x + ux * 26 * push + Math.sin(t * 0.8) * 4, y: BALL.y + uy * 26 * push + Math.cos(t * 0.7) * 3,
    h: 6 + 46 * Math.max(0, Math.sin(Math.PI * clamp((t - hitT) / 0.32))) + 8 * Math.max(0, wobble(t - hitT - 0.32, { freq: 3, damp: 6 })) * (t > hitT + 0.32 ? 1 : 0),
    rot: t * 0.5 + 0.8 * push,
  };
}

/** Sombras y partes sumergidas (en el plano del fondo / bajo el agua). */
export function detailsUnder(ctx, C, t) {
  const b = ballAt(t);
  onPlane(ctx, C, FLOOR_H, (c) => {
    const [ox, oy] = shadowOff(b.h, FLOOR_H);
    c.fillStyle = 'rgba(16,44,82,0.18)';
    c.beginPath(); c.arc(b.x + ox, b.y + oy, BALL.r * 1.05, 0, TAU); c.fill();
    // patas de la escalera bajo el agua (desplazadas por la refracción)
    c.strokeStyle = 'rgba(200,225,235,0.45)';
    c.lineWidth = 5;
    c.lineCap = 'round';
    for (const s of [-1, 1]) {
      const y = LADDER.y + (s * LADDER.gap) / 2;
      c.beginPath(); c.moveTo(LADDER.x + 22, y); c.lineTo(LADDER.x + 40, y); c.stroke();
    }
  });
}

/** Lo que está sobre el agua y la cubierta (después del horneado de la cubierta). */
export function detailsOver(ctx, C, t) {
  // escalera: dos pasamanos curvos de acero cromado (suben a h 80 y entran al agua)
  const L = [SUN[0] * Math.cos(C.r) - SUN[1] * Math.sin(C.r), SUN[0] * Math.sin(C.r) + SUN[1] * Math.cos(C.r)];
  for (const s of [-1, 1]) {
    const y = LADDER.y + (s * LADDER.gap) / 2;
    const pts = [[-46, 0], [-36, 52], [-14, 80], [8, 66], [20, 18], [24, -6]].map(([dx, h]) => project(C, LADDER.x + dx, y, h));
    const line = (col, w, ox = 0, oy = 0) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = w * pts[2][2];
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach(([x, yy], i) => (i ? ctx.lineTo(x + ox, yy + oy) : ctx.moveTo(x + ox, yy + oy)));
      ctx.stroke();
    };
    line('rgba(16,44,82,0.25)', 9, -L[0] * 6, -L[1] * 6);
    line('#7E91A2', 7.5);
    line('#D9E3EA', 4.6, L[0] * 1, L[1] * 1);
    line('#FFFFFF', 1.8, L[0] * 2, L[1] * 2);
    const tw = Math.pow(Math.max(0, Math.sin(t * 2.3 + s)), 8);
    if (tw > 0.05) sparkle(ctx, pts[2][0] + L[0] * 2, pts[2][1] + L[1] * 2, 14 * pts[2][2] * tw, { alpha: tw });
  }
  // la pareja sentada en el borde de abajo, mirando al agua (rotada 180°)
  for (const p of SITTERS) {
    const [x, y, k] = project(C, p.x, POOL.y1 + 14, 6);
    onPlane(ctx, C, WATER_H, (c) => {
      for (let i = 0; i < 2; i++) {
        const q = ((t * 1.1 + i * 0.5 + p.ph * 0.1) % 1);
        c.strokeStyle = `rgba(255,255,255,${0.55 * (1 - q)})`;
        c.lineWidth = 1.8;
        c.beginPath(); c.ellipse(p.x, POOL.y1 - 40, 22 + q * 40, 12 + q * 22, 0, 0, TAU); c.stroke();
      }
    });
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI + C.r);
    ctx.scale(k, k);
    drawSitter(ctx, { ...p, L: rotL(Math.PI), kick: t * 6 + p.ph });
    ctx.restore();
  }
  // pelota de playa: 6 gajos, sombra propia, brillo
  const b = ballAt(t);
  const [bx, by, bk] = project(C, b.x, b.y, b.h);
  const dh = t - T_BALL;
  onPlane(ctx, C, WATER_H, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.6)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(b.x, b.y, BALL.r + 5 + 2 * Math.sin(t * 4), 0, TAU); c.stroke();
    if (dh > 0 && dh < 0.6) {
      for (let i = 0; i < 2; i++) {
        const q = clamp((dh - i * 0.1) / 0.5);
        c.strokeStyle = `rgba(255,255,255,${0.8 * (1 - q)})`;
        c.lineWidth = 3 * (1 - q) + 0.5;
        c.beginPath(); c.arc(BALL.x, BALL.y, BALL.r + 6 + q * 60, 0, TAU); c.stroke();
      }
      c.fillStyle = `rgba(255,255,255,${0.9 * clamp(1 - dh / 0.3)})`;
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * TAU + 0.3, rr = BALL.r + 8 + dh * 120;
        c.beginPath(); c.arc(BALL.x + Math.cos(an) * rr, BALL.y + Math.sin(an) * rr, 3.2, 0, TAU); c.fill();
      }
    }
  });
  const sq = dh > 0 && dh < 0.08 ? 1 - 0.18 * Math.sin(Math.PI * dh / 0.08) : 1;
  const R = BALL.r * bk * (1 + b.h / 500) * sq;
  const cols = [PAL.coral, '#FFFFFF', PAL.gold, '#FFFFFF', PAL.brandCyan, '#FFFFFF'];
  for (let i = 0; i < 6; i++) {
    const a0 = b.rot + (i / 6) * TAU + C.r, a1 = b.rot + ((i + 1) / 6) * TAU + C.r;
    ctx.fillStyle = cols[i];
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.arc(bx, by, R, a0, a1); ctx.closePath(); ctx.fill();
  }
  // sombreado esférico: medialuna oscura del lado contrario al sol + brillo
  const g = ctx.createRadialGradient(bx + L[0] * R * 0.35, by + L[1] * R * 0.35, R * 0.1, bx, by, R);
  g.addColorStop(0, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.55, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(40,20,60,0.32)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(bx, by, R, 0, TAU); ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(bx, by, R * 0.18, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.ellipse(bx + L[0] * R * 0.5, by + L[1] * R * 0.5, R * 0.2, R * 0.1, Math.atan2(L[1], L[0]) + Math.PI / 2, 0, TAU); ctx.fill();
  if (dh > -0.02 && dh < 0.3) {
    const a = dh < 0 ? 1 + dh / 0.02 : Math.exp(-dh / 0.09);
    sparkle(ctx, bx + L[0] * R * 0.6, by + L[1] * R * 0.6, 30 * bk * a, { alpha: a, rot: 0.3 });
  }
}
