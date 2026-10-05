// Valor: valija con calcos (c11) → tarjeta de embarque con sello (c12) → especialistas con chat (c13).
// Un color plano por compás (cian → coral → navy) que cambia con barrido circular (iris) desde el objeto.
// ENTRADA (20,5 → 20,625): una banda cian con borde líquido sube desde abajo (máscara) y continúa el látigo de
// MAPA; el contenido llega 500 px abajo con smear vertical y frena en val.in, donde aterriza la valija.
// Sostiene hasta 26,6 debajo de la segunda ola. Equipo VALUE. Contrato: docs/PLAN.md §6.5 y §7.
import { W, H, beatPulse } from '../engine/time.js';
import { E, prog, clamp, TAU } from '../engine/ease.js';
import { rgba, PAL } from '../engine/color.js';
import { plane, handheld, toScreen } from '../engine/camera.js';
import { smear } from '../engine/draw.js';
import { T } from './value/timeline.js';
import { initBg, drawTheme, drawShapes, drawSpeedLines, sweepRadius, drawSweepRing, SWEEP_R } from './value/bg.js';
import { initCase, drawCase, drawCaseHeadline, CASE_C, entryOff } from './value/beat-case.js';
import { drawCaseBackdrop, drawCaseRoute } from './value/backdrop-case.js';
import { initPass, drawPass, drawPassHeadline } from './value/beat-pass.js';
import { initPro, drawPro, drawProHeadline, PRO, surgeAt } from './value/beat-pro.js';
import { drawEntryMask, drawEntryEdge } from './value/entry.js';
import { pushZ, PUSH_AT, drawStampWave } from './value/hype.js';
import { ticketMotion } from './value/beat-pass.js';
import { PRICE } from './value/ticket.js';

function camAt(t) {
  const s = surgeAt(t);
  // golpe de bombo: la cámara empuja un pelito en cada beat (desde el primer calco)
  const bump = 0.014 * beatPulse(t, { from: T.s1, to: T.surge, decay: 0.09 });
  const z = 1 + 0.045 * E.inOutSine(prog(t, T.in, T.surge)) - 0.025 * s.k + bump;
  // compás 12: empuje hacia la ventana del precio durante la cuenta y rebote del sello (pivote fijo en pantalla)
  const dz = pushZ(t);
  let x = 0, y = -entryOff(t);
  if (dz !== 0) {
    const k = z / (z + dz), px = PUSH_AT[0] - W / 2, py = PUSH_AT[1] - H / 2;
    x = px - (px - x) * k;
    y = py - (py - y) * k;
  }
  return handheld({ x, y, z: z + dz, r: 0.006 * s.k }, t, { amp: 6, hz: 0.5, rollAmp: 0.0018, seed: 41 });
}

// barridos circulares (centros en el mundo): la valija (→ coral) y el timón (→ navy)
const SWEEPS = [
  { t0: T.hold, dur: 0.3, k: 1, at: CASE_C, ring: PAL.goldPale },
  // iris navy: radio lineal y un poco antes, para que el salto coral → navy se reparta en ~8 cuadros y a 24,34
  // ya no quede nada del compás 12
  { t0: T.pro - 0.175, dur: 0.26, k: 2, at: [PRO.x, PRO.wheelY], ring: PAL.aqua300, ease: E.linear },
];
const sweepDone = (t, s) => t >= s.t0 + s.dur;

/** Llama fn(k) para cada tema visible, recortando al círculo del barrido cuando corresponde. */
function eachTheme(ctx, t, cam, fn) {
  let base = 0;
  for (const s of SWEEPS) if (sweepDone(t, s)) base = s.k;
  fn(base);
  for (const s of SWEEPS) {
    if (s.k <= base) continue;
    const r = sweepRadius(t, s.t0, s.dur, s.ease);
    if (r <= 0) continue;
    const [cx, cy] = toScreen(cam, 1, s.at[0], s.at[1]);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.clip();
    fn(s.k);
    ctx.restore();
  }
}

/** Velocidad del látigo de entrada → largo del smear vertical (px de pantalla, medio obturador). */
function smearLen(t) {
  if (t >= T.in || t < T.win) return 0;
  return Math.min(170, Math.abs(entryOff(t) - entryOff(t - 1 / 120)));
}

function body(ctx, t, cam) {
  const M0 = ctx.getTransform();
  const v = (entryOff(t) - entryOff(t - 0.008)) / 0.008; // px/s (negativo = subiendo)
  const streak = Math.max(0, -v) * 0.03;
  eachTheme(ctx, t, cam, (k) => drawTheme(ctx, t, k, cam, { streak: k === 0 ? streak : 0 }));
  for (const s of SWEEPS) {
    const [cx, cy] = toScreen(cam, 1, s.at[0], s.at[1]);
    drawSweepRing(ctx, t, s.t0, s.dur, cx, cy, s.ring, s.ease);
  }
  if (t > T.price && t < T.price + 0.6) {
    // onda expansiva del sello (debajo de la tarjeta): centro = ventana del precio en pantalla
    const m = ticketMotion(t);
    const lx = PRICE[0] * m.s, ly = PRICE[1] * m.s;
    const wx = m.x + lx * Math.cos(m.rot) - ly * Math.sin(m.rot), wy = m.y + lx * Math.sin(m.rot) + ly * Math.cos(m.rot);
    const [sx, sy] = toScreen(cam, 1, wx, wy);
    drawStampWave(ctx, t, sx, sy);
  }
  if (t < T.pass + 0.02) plane(ctx, cam, 0.8, (c) => drawCaseRoute(c, t));
  // iris del compás 13: lo que queda del 12 (tarjeta, talón, titular) va DEBAJO, recortado afuera del círculo
  const iris = SWEEPS[1];
  const ir = sweepRadius(t, iris.t0, iris.dur, iris.ease);
  const [icx, icy] = toScreen(cam, 1, iris.at[0], iris.at[1]);
  plane(ctx, cam, 1, (c) => {
    if (t < T.pass + 0.02) {
      drawCaseBackdrop(c, t);
      drawCaseHeadline(c, t);
      drawCase(c, t);
    }
    drawPro(c, t);
    drawProHeadline(c, t);
    if (t > T.pass - 0.05 && t < iris.t0 + iris.dur) {
      c.save();
      if (ir > 0) {
        if (ir >= SWEEP_R - 1) { c.restore(); return; }
        const m = c.getTransform();
        c.setTransform(M0);
        c.beginPath();
        c.rect(-50, -50, W + 100, H + 100);
        c.arc(icx, icy, ir, 0, TAU, true);
        c.clip('evenodd');
        c.setTransform(m);
      }
      drawPass(c, t);
      drawPassHeadline(c, t);
      c.restore();
    }
  });
  eachTheme(ctx, t, cam, (k) => drawShapes(ctx, t, k, cam, { near: true, streak: k === 0 ? streak : 0 }));
  drawSpeedLines(ctx, t);
  // la ola que viene de la izquierda: sombra que avanza y oscurece el borde
  const sk = surgeAt(t).k;
  if (sk > 0.01) {
    const g = ctx.createLinearGradient(0, 0, W * 0.6, 0);
    g.addColorStop(0, rgba(PAL.ink, 0.38 * sk));
    g.addColorStop(1, rgba(PAL.ink, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

const scene = {
  id: 'value',
  team: 'VALUE',
  from: T.win,
  to: 26.6,
  z: 80,
  maskFrom: T.win,
  maskUntil: T.in,
  async init() {
    initBg();
    initCase();
    initPass();
    initPro();
  },
  draw(ctx, t) {
    const cam = camAt(t);
    const sm = smearLen(t);
    if (sm > 3) smear(ctx, 0, sm, (c) => body(c, t, cam), 4);
    else body(ctx, t, cam);
  },
  /** Banda cian que sube (región ya cubierta) — solo entre maskFrom y maskUntil. */
  mask(ctx, t) {
    drawEntryMask(ctx, t);
  },
  /** Labio de espuma y gotas del borde de la banda (encima de todo, solo durante la entrada). */
  over(ctx, t) {
    drawEntryEdge(ctx, t);
  },
};
export default scene;
export { clamp };
