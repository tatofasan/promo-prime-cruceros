// Compás 11: la VALIJA entra con el látigo desde abajo (estirada), aterriza en val.in con squash y polvito,
// pulsa en cada beat y se le pegan los tres calcos (cada uno EN su cue). Titular «HAY UN CRUCERO / PARA CADA /
// FORMA DE VIAJAR» que entra por palabras con la misma curva. El cuadro completo se sostiene hasta T.hold y la
// salida (titular de costado, valija que gira de canto) es rápida, hasta val.pass.
import { PAL, rgba } from '../../engine/color.js';
import { E, clamp, prog, lerp, TAU } from '../../engine/ease.js';
import { rng } from '../../engine/noise.js';
import { beatPulse } from '../../engine/time.js';
import { T } from './timeline.js';
import { drawSuitcase, initSuitcase, SC, CORNERS } from './suitcase.js';
import { initStickers, drawSticker, drawSlapLines, STK } from './stickers.js';
import { makeBlock, drawBlock } from './headline.js';
import { glints } from './glints.js';

export const CASE = { x: 1488, y: 912, s: 0.98 };
/** Centro aproximado de la valija en el mundo (origen de los barridos y de la tarjeta). */
export const CASE_C = [CASE.x + 14, CASE.y - CASE.s * 250];
let HEAD = null;

export function initCase() {
  initSuitcase();
  initStickers();
  HEAD = makeBlock([
    { text: 'HAY UN CRUCERO', size: 100, wordSpace: 0.32 },
    { text: 'PARA CADA', size: 100 },
    { text: 'FORMA DE VIAJAR', size: 100, gold: true },
  ], { x: 112, y: 452, align: 'left', gap: 16 });
}

/** Látigo de entrada del MUNDO: llega 500 px abajo y frena (E.outExpo) justo en val.in. px, + = abajo. */
export function entryOff(t) {
  if (t < T.in) return 500 * (1 - E.outExpo(prog(t, T.win, T.in)));
  const dt = t - T.in;
  return 7 * Math.exp(-dt * 12) * Math.sin(dt * 30); // la cámara acusa el aterrizaje
}

/** Recorrido TOTAL de la valija en pantalla durante la entrada (px, + = abajo): sube estirada, pasa de largo y cae. */
function caseRide(t) {
  const p = prog(t, T.win, T.in);
  if (p < 0.55) {
    const u = p / 0.55;
    return { y: lerp(660, -112, E.outCubic(u)), st: 0.15 * (1 - u * u) };
  }
  const u = (p - 0.55) / 0.45;
  return { y: -112 * (1 - u * u), st: 0.08 * u * u };
}

// impacto amortiguado (squash) que arranca en t0
const hit = (t, t0, amp, f = 26, d = 13) => (t < t0 ? 0 : amp * Math.exp(-(t - t0) * d) * Math.cos((t - t0) * f));

/** Movimiento de la valija en t. */
export function caseMotion(t) {
  let lift = 0, sq = 0, stretch = 0, rot = 0, dx = 0, spin = 0, dy = 0;
  if (t < T.in) {
    // entrada: viaja estirada en Y (1,15) con el látigo y cae sobre el piso en el cue
    const r = caseRide(t);
    dy = r.y - entryOff(t);
    stretch = r.st;
  }
  // aterrizaje en val.in: squash 0,9 / 1,1 que se asienta con resorte
  sq += hit(t, T.in, 0.1, 27, 8.5);
  // reacción a cada calco: golpecito y empujón hacia la izquierda (llegan desde la derecha)
  for (const s of STK) {
    sq += hit(t, s.t, 0.045, 30, 11);
    dx += -16 * (t > s.t ? Math.exp(-(t - s.t) * 8) * Math.sin((t - s.t) * 24) : 0);
    // saltito de la valija después del golpe (aterriza en la corchea)
    const u = (t - s.t - 0.03) / 0.2;
    if (u > 0 && u < 1) lift += 4 * 16 * u * (1 - u);
  }
  // pulso en cada beat (0,96 / 1,04) y en el segundo bamboleo de los calcos
  sq += 0.04 * beatPulse(t, { from: T.s1, to: T.hold, decay: 0.085 });
  sq += 0.025 * beatPulse(t, { from: T.s1 + 0.234375, to: T.hold, decay: 0.07 });
  sq += hit(t, T.wob, 0.03, 30, 12);
  rot += 0.012 * (t > T.wob ? Math.exp(-(t - T.wob) * 6) * Math.sin((t - T.wob) * 30) : 0);
  // salida rápida (T.hold → val.pass): se agacha, salta y gira hasta quedar de canto
  const a0 = T.hold, a1 = T.hold + 0.022, a2 = T.pass - 0.008;
  if (t > a0) {
    sq += 0.12 * E.outCubic(prog(t, a0, a1)) * (1 - E.inQuad(prog(t, a1, a1 + 0.02)));
    if (t > a1) {
      const u = prog(t, a1, a2);
      lift += 60 * E.outQuad(u);
      stretch += 0.12 * u;
      spin = (Math.PI / 2) * E.inCubic(u);
    }
  }
  // etiqueta: golpes de péndulo
  let tag = 0.05 * Math.sin(t * 2.3);
  const kick = (t0, a) => (t < t0 ? 0 : a * Math.exp(-(t - t0) * 2.8) * Math.sin((t - t0) * 9.5));
  tag += kick(T.in, 0.55) + kick(T.wob, 0.18);
  for (const s of STK) tag += kick(s.t, 0.28);
  return { lift, sx: (1 + sq) * (1 - stretch * 0.55), sy: (1 - sq) * (1 + stretch), rot, dx, dy, spin, tag };
}

/** Polvito del aterrizaje: nubecitas desde las esquinas del apoyo + aro en el piso (visible desde el cuadro del cue). */
function drawDust(c, t) {
  const dt = t - T.in;
  if (dt < 0 || dt > 0.55) return;
  const r = rng(51);
  const p = dt / 0.55;
  c.save();
  // aro de impacto en el piso
  const rp = E.outCubic(clamp(dt / 0.35));
  c.strokeStyle = rgba('#FFFFFF', 0.6 * (1 - rp));
  c.lineWidth = 12 * (1 - rp) + 2;
  c.beginPath(); c.ellipse(SC.dx * 0.5, 4, 320 + 280 * rp, 34 + 36 * rp, 0, 0, TAU); c.stroke();
  for (let i = 0; i < 22; i++) {
    const side = i % 2 ? 1 : -1;
    const sp = 0.5 + r();
    const x = side * (SC.w * 0.5 - 30 + 40 * r()) + side * (40 + 260 * sp) * E.outCubic(clamp(dt / 0.5));
    const y = -6 - (30 + 100 * r()) * E.outCubic(clamp(dt / 0.45)) + 40 * E.inQuad(p);
    const rad = (14 + 22 * r()) * (0.75 + 0.7 * E.outCubic(clamp(dt / 0.22)));
    const a = (1 - E.inQuad(p)) * 0.85;
    c.fillStyle = rgba(PAL.aqua100, a * 0.6);
    c.beginPath(); c.arc(x + 4, y + 5, rad, 0, TAU); c.fill();
    c.fillStyle = rgba('#FFFFFF', a * 0.85);
    c.beginPath(); c.arc(x, y, rad * 0.86, 0, TAU); c.fill();
  }
  // chispitas que saltan
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    const vx = side * (220 + 380 * r()), vy = -(380 + 420 * r());
    const x = side * SC.w * 0.45 + vx * dt, y = vy * dt + 1300 * dt * dt;
    if (y > 10) continue;
    c.fillStyle = rgba(i % 3 ? '#FFFFFF' : PAL.goldLight, 1 - p);
    c.beginPath(); c.arc(x, y, 5 + 3 * r(), 0, TAU); c.fill();
  }
  c.restore();
}

const BEATS = (n) => n * 0.46875;
// destellos especulares en los esquineros de metal y el bronce (uno por golpe)
const CG = (k, t0, s) => [t0, CORNERS[k][0], CORNERS[k][1], s];
let GLINTS = null;

/** Dibuja la valija con calcos en el mundo (llamar dentro del plano de la cámara). */
export function drawCase(ctx, t, o = {}) {
  const m = caseMotion(t);
  const sx = m.sx * Math.cos(m.spin);
  if (Math.abs(sx) < 0.004) return m;
  GLINTS ??= [
    CG(1, T.in + 0.06, 34), CG(0, T.in + 0.2, 28), CG(3, T.s1 + 0.04, 30), CG(2, T.s1 + 0.24, 24),
    CG(1, T.s2 + 0.04, 32), CG(3, T.s2 + 0.22, 26), CG(0, T.s3 + 0.04, 30), CG(2, T.s3 + 0.2, 26),
    CG(1, T.s3 + BEATS(1), 34), CG(3, T.wob + 0.02, 30), [T.s2 + 0.3, 62, -SC.h + 24, 22], [T.s3 + 0.36, -62, -SC.h + 24, 22],
  ];
  ctx.save();
  // por debajo del piso viaja con todo; por encima, el piso (sombra y polvito) se queda y la valija «vuela»
  ctx.translate(CASE.x + m.dx + (o.dx ?? 0), CASE.y + Math.max(0, m.dy) + (o.dy ?? 0));
  ctx.scale(CASE.s, CASE.s);
  drawDust(ctx, t);
  ctx.rotate(m.rot);
  drawSuitcase(ctx, {
    lift: m.lift + Math.max(0, -m.dy) / CASE.s, sx, sy: m.sy, tagAng: m.tag, shadow: t < T.in ? clamp(1 - Math.abs(m.dy) / 90) : 1,
    front: (c) => {
      for (let i = 0; i < 3; i++) { drawSticker(c, t, i); drawSlapLines(c, t, i); }
      glints(c, t, GLINTS, { dur: 0.28 });
      // al girar, la cara se oscurece (queda de canto)
      if (m.spin > 0.01) {
        c.fillStyle = rgba(PAL.ink, 0.35 * Math.sin(m.spin));
        c.fillRect(-SC.w / 2, -SC.h - 10, SC.w + SC.dx, SC.h + 10);
      }
    },
  });
  ctx.restore();
  return m;
}

/** Titular del compás 11. */
export function drawCaseHeadline(ctx, t) {
  drawBlock(ctx, HEAD, {
    t, in: T.win, enter: 'whip', stagger: 0.0333, order: (w) => w.line + w.il * 0.5,
    out: T.hold - 0.005, leave: 'slide', outDir: -1, outDur: 0.05, lineStagger: 0.008,
    sweep: { t0: T.s3 + 0.18, dur: 0.42, alpha: 0.75 },
    underline: { line: 2, t0: T.s1 - 0.05, dur: 0.4, color: PAL.coral },
    live: 2.5,
    // en la corchea entre calcos el titular «respira» con una ola de saltitos
    hops: [T.s1 + 0.234], hopAmp: 0.16, hopOrder: (w) => w.line * 1.5 + w.il,
  });
}
