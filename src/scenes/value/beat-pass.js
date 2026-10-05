// Compás 12: la valija gira y en su lugar aparece la TARJETA DE EMBARQUE (de canto → de frente, viajando
// al centro). «MINICRUCEROS» golpea, los campos se tipean en corcheas, el contador rueda hasta USD 355,
// el SELLO golpea en val.price y el talón se arranca por el troquel en val.tear.
import { PAL, rgba } from '../../engine/color.js';
import { E, clamp, prog, lerp, spring, TAU } from '../../engine/ease.js';
import { sparkle } from '../../engine/draw.js';
import { rng, hash } from '../../engine/noise.js';
import { beatPulse } from '../../engine/time.js';
import { T, E8, E16 } from './timeline.js';
import { initTicket, drawTicket, drawLooseStub, TK, PRICE } from './ticket.js';
import { initStamp, drawStampImprint, INK } from './stamp.js';
import { makeBlock, drawBlock } from './headline.js';
import { CASE_C } from './beat-case.js';
import { glints } from './glints.js';
import { cardHype } from './hype.js';

export const TICKET = { x: 960, y: 652, rot: -0.05 };
const FROM = CASE_C;
let HEAD = null;

export function initPass() {
  initTicket();
  initStamp();
  HEAD = makeBlock([{ text: 'MINICRUCEROS', size: 150 }], { x: 960, y: 290, align: 'center' });
}

const TICKET_T0 = () => T.pass - 0.008;
const kick = (t, t0, amp, f = 20, d = 9) => (t < t0 ? 0 : amp * Math.exp(-(t - t0) * d) * Math.sin((t - t0) * f));

/** Movimiento de la tarjeta (centro en pantalla del mundo, escala, giro, volteo). */
export function ticketMotion(t) {
  const dt = t - T.pass;
  const t0 = TICKET_T0(); // arranca cuando la valija queda de canto
  const flip = t < t0 ? 0 : E.backOut(1.8)(prog(t, t0, t0 + 0.24));
  const travel = t < t0 ? 0 : E.backOut(1.25)(prog(t, t0, t0 + 0.4));
  const grow = 0.42 + 0.58 * (t < t0 ? 0 : E.backOut(1.6)(prog(t, t0, t0 + 0.34)));
  let x = lerp(FROM[0], TICKET.x, travel);
  let y = lerp(FROM[1], TICKET.y, travel) - Math.sin(Math.PI * clamp(dt / 0.35)) * 60;
  let rot = lerp(0.2, TICKET.rot, E.outCubic(clamp(dt / 0.4))) + 0.012 * Math.sin(t * 2.1);
  let s = grow;
  // flotación sutil
  y += Math.sin(t * 2.6) * 5;
  // respiración con los tics del contador, inclinación de tensión y bamboleo del sello
  const hy = cardHype(t);
  y += hy.dy;
  s *= 1 + hy.ds;
  rot += hy.rot;
  // reacción al sello: se hunde y vuelve
  y += kick(t, T.price, 16, 22, 10);
  s *= 1 - 0.02 * (t > T.price ? Math.exp(-(t - T.price) * 10) : 0);
  // reacción al arranque del talón: tirón hacia la izquierda
  x += kick(t, T.tear, -36, 18, 8);
  rot += kick(t, T.tear, -0.035, 18, 8);
  // salida: anticipa subiendo y cae girando; fuera de cuadro ANTES de que el iris navy tape (24,34)
  const o0 = T.pro - 0.26, o1 = T.pro - 0.19, o2 = T.pro - 0.04;
  if (t > o0) {
    y -= 22 * E.outCubic(prog(t, o0, o1));
    const p = prog(t, o1, o2);
    y += 1320 * E.inQuad(p);
    rot += 0.22 * E.inCubic(p);
    s *= 1 - 0.18 * E.inCubic(p);
  }
  return { x, y, rot, s, flip: Math.max(0.02, flip), lift: (1 - Math.min(1, travel)) * 80 };
}

/** Progreso de tipeo de los tres campos (en corcheas después del corte). */
function fieldsAt(t) {
  return [0, 1, 2].map((i) => clamp((t - (T.pass + 0.1 + i * 0.09)) / 0.16));
}

/** Contador: nace en T.roll YA rodando (desde 100, dígitos borrosos) y se va 2 cuadros antes del sello. */
const ODO_END = () => T.price - 0.033;
function odoAt(t) {
  const t1 = ODO_END();
  if (t < T.roll || t >= t1) return null;
  const p = prog(t, T.roll, t1);
  const v = 100 + 255 * E.outQuad(p);
  const speed = (255 * 2 * (1 - p)) / (t1 - T.roll);
  return { v, blur: clamp(speed / 700), a: 1, k: 1 + 0.12 * Math.exp(-(t - T.roll) * 14) * Math.cos((t - T.roll) * 30) };
}

/** Polvito de tinta que tapa el contador justo antes del sello (coords locales de la tarjeta). */
function drawInkPuff(c, t, x, y) {
  const dt = t - (ODO_END() - 0.03);
  if (dt < 0 || dt > 0.34) return;
  const r = rng(355);
  const grow = E.outCubic(clamp(dt / 0.035));
  const fade = 1 - E.inQuad(clamp((dt - 0.06) / 0.28));
  c.save();
  for (let i = 0; i < 30; i++) {
    // nubecitas sobre la ventana del precio que se abren hacia afuera
    const px0 = x + (r() - 0.5) * 470, py0 = y + (r() - 0.5) * 130;
    const out = 1 + 0.5 * E.outCubic(clamp(dt / 0.3));
    const px = x + (px0 - x) * out, py = y + (py0 - y) * out - 30 * dt;
    const rad = (30 + 34 * r()) * grow * (1 - 0.35 * clamp(dt / 0.34));
    const ink = i % 4 === 0;
    c.fillStyle = rgba(ink ? INK : i % 3 ? PAL.warmWhite : '#F7E3DA', (ink ? 0.55 : 0.97) * fade);
    c.beginPath(); c.arc(px, py, rad, 0, TAU); c.fill();
  }
  c.restore();
}

/** Sello: cae desde la cámara (opaco, 2 cuadros) y golpea en val.price; queda la tinta con salpicaduras.
 *  En val.tear da un segundo golpe (1 → 1,08 → 1) con destello. 12 % más grande que el original. */
const STAMP_K = 1.12;
function stampFn(t) {
  const dt = t - T.price;
  if (dt < -0.06) return null;
  return (c, x, y) => {
    drawInkPuff(c, t, x, y);
    c.save();
    c.translate(x, y);
    c.rotate(-0.09);
    c.scale(STAMP_K, STAMP_K);
    if (dt < 0) {
      const p = (dt + 0.034) / 0.034;
      if (p <= 0) { c.restore(); return; }
      const k = lerp(1.9, 1, E.inQuad(p));
      // sombra del sello que se acerca
      c.save();
      c.globalAlpha *= 0.16 * p;
      c.translate(30 * (k - 1), 40 * (k - 1));
      c.scale(k * 1.02, k * 1.02);
      c.fillStyle = PAL.ink;
      c.beginPath(); c.rect(-280, -125, 560, 250); c.fill();
      c.restore();
      drawStampImprint(c, { k, a: 1 });
    } else {
      const g2 = Math.exp(-Math.pow((t - T.tear) / 0.045, 2));
      const k = (1 - 0.06 * Math.exp(-dt * 14) * Math.cos(dt * 40)) * (1 + 0.08 * g2);
      // salpicaduras de tinta
      const r = rng(23);
      c.fillStyle = INK;
      for (let i = 0; i < 16; i++) {
        const a = r() * TAU, d = 250 + r() * 90;
        const sx = Math.cos(a) * d * 1.15, sy = Math.sin(a) * d * 0.55;
        const rad = (2 + r() * 7) * clamp(dt / 0.05);
        c.globalAlpha = 0.75;
        c.beginPath(); c.arc(sx, sy, rad, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
      drawStampImprint(c, { k, bleed: Math.exp(-dt / 0.08) + 0.8 * g2 });
      if (g2 > 0.05) {
        // destello del segundo golpe
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha *= 0.5 * g2;
        drawStampImprint(c, { k: k * 1.01 });
        c.restore();
        sparkle(c, 250, -110, 70 * g2, { alpha: 1, color: '#FFFFFF' });
        sparkle(c, -262, 104, 44 * g2, { alpha: 0.9, color: PAL.goldPale });
      }
    }
    c.restore();
  };
}

/** Papelitos del troquel al arrancar el talón (coords locales de la tarjeta). */
function drawTearBits(c, t) {
  const dt = t - T.tear;
  if (dt < 0 || dt > 0.7) return;
  const r = rng(91);
  for (let i = 0; i < 18; i++) {
    const y0 = -TK.h / 2 + r() * TK.h;
    const vx = 200 + r() * 700, vy = -300 - r() * 600;
    const x = TK.perf + vx * dt, y = y0 + vy * dt + 1600 * dt * dt;
    const a = 1 - dt / 0.7;
    c.save();
    c.translate(x, y);
    c.rotate(r() * TAU + dt * (8 + r() * 10));
    c.scale(1, Math.cos(dt * (14 + r() * 10)));
    c.fillStyle = i % 4 ? rgba(PAL.warmWhite, a) : rgba(PAL.navy700, a);
    c.fillRect(-5, -3, 10 + r() * 8, 6);
    c.restore();
  }
}

/** Dibuja el compás 12 (dentro del plano de la cámara). */
export function drawPass(ctx, t) {
  // la tarjeta nace de canto cuando la valija termina de girar (antes sería una rayita sobre los calcos)
  if (t < TICKET_T0() || t > T.pro + 0.1) return;
  const m = ticketMotion(t);
  const f = fieldsAt(t);
  const odo = odoAt(t);
  const dtT = t - T.tear;
  const tear = dtT < 0 ? { a: 0.075 * E.inQuad(prog(t, T.tear - 0.11, T.tear)) } : { gone: true };
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(m.rot);
  ctx.scale(m.s * m.flip, m.s);
  // al voltearse, la tarjeta pasa por una cara más oscura (de canto)
  drawTicket(ctx, {
    fields: f, odo: odo ? odo.v : null, odoBlur: odo?.blur ?? 0, odoA: odo?.a ?? 0, odoK: odo?.k ?? 1,
    tear, stamp: stampFn(t), lift: m.lift,
    sweep: prog(t, T.tear + 0.16, T.tear + 0.62),
  });
  // destellos: sello holográfico y brillo del papel
  glints(ctx, t, [[T.roll - 0.05, 238, -86, 34], [T.price + 0.3, 238, -86, 28], [T.tear + 0.3, -560, -200, 30]]);
  if (m.flip < 0.98) {
    ctx.fillStyle = rgba(PAL.ink, 0.45 * (1 - m.flip));
    ctx.fillRect(-TK.w / 2, -TK.h / 2, TK.w, TK.h);
  }
  // talón suelto
  if (dtT >= 0) {
    const vx = 1900, vy = -1150, g = 2600;
    drawLooseStub(ctx, {
      x: vx * dtT, y: vy * dtT + 0.5 * g * dtT * dtT, r: 0.075 + 5.5 * dtT, s: 1 + 0.35 * dtT,
      smear: Math.max(0, 60 - dtT * 140),
    });
  }
  drawTearBits(ctx, t);
  ctx.restore();
}

/** Titular del compás 12 (encima de la tarjeta). */
export function drawPassHeadline(ctx, t) {
  if (t < T.pass || t > T.pro + 0.2) return;
  const pulse = beatPulse(t, { from: T.pass + 0.5, decay: 0.1 });
  ctx.save();
  ctx.translate(960, 240);
  ctx.scale(1 + 0.012 * pulse, 1 + 0.012 * pulse);
  ctx.translate(-960, -240);
  drawBlock(ctx, HEAD, {
    t, in: T.pass + 0.02, enter: 'slam', stagger: 0,
    out: T.pro - 0.3, leave: 'fly',
    extrude: { depth: 12, color: PAL.navy900, dx: 0.62, dy: 1 },
    sweep: { t0: T.roll + 0.05, dur: 0.55, alpha: 0.8 },
  });
  ctx.restore();
}

export { hash, E8 };
