// Compás 13: «ASESORAMIENTO DE / ESPECIALISTAS EN CRUCEROS». La especialista aparece desde abajo delante
// del timón que entra girando; globos de chat en val.b1 y val.b2 (con tilde); en val.surge todo se
// inclina y aplasta hacia la izquierda, de donde viene la segunda ola.
import { PAL, rgba } from '../../engine/color.js';
import { E, clamp, prog, spring, TAU } from '../../engine/ease.js';
import { beatPulse } from '../../engine/time.js';
import { T } from './timeline.js';
import { drawWheel } from './wheel.js';
import { initSpecialist, drawSpecialist } from './specialist.js';
import { drawBubble } from './bubbles.js';
import { makeBlock, drawBlock } from './headline.js';
import { glints } from './glints.js';

export const PRO = { x: 960, y: 664, wheelY: 690, R: 286 };
let KICK = null, HEAD = null;

export function initPro() {
  initSpecialist();
  KICK = makeBlock([{ text: 'ASESORAMIENTO DE', size: 64, weight: 800, tracking: 0.06, wordSpace: 0.4, color: PAL.aqua200 }], { x: 960, y: 118, align: 'center' });
  HEAD = makeBlock([{ text: 'ESPECIALISTAS EN CRUCEROS', size: 106 }], { x: 960, y: 238, align: 'center' });
  HEAD.words[1].gold = true;
  HEAD.words[2].gold = true;
}

/** Inclinación de anticipación a la ola (pivote abajo al centro). */
export function surgeAt(t) {
  const p = E.inOutCubic(prog(t, T.surge - 0.04, T.surge + 0.2));
  const q = spring(t, T.surge + 0.2, { from: 0, to: 1, freq: 2, damp: 6 });
  const k = p * (t < T.surge + 0.2 ? 1 : 1 + 0.15 * (1 - q));
  return { k, rot: -0.05 * k, sx: 1 + 0.04 * k, sy: 1 - 0.07 * k, dx: -40 * k };
}

/** Paso con resorte (0 → 1 con overshoot) desde t0. */
const kickStep = (t, t0, freq = 3.2, damp = 9) => spring(t, t0, { from: 0, to: 1, freq, damp });

/** Timón: entra girando, gira parejo y en CADA beat acelera un octavo de vuelta y medio con overshoot. */
function wheelAngle(t) {
  const dt = Math.max(0, t - (T.pro - 0.08));
  const sp = Math.max(0, t - T.surge);
  let a = 2.6 * (1 - Math.exp(-dt * 3.4)) + 1.3 * dt + 3.2 * sp * sp;
  for (const tb of [T.b1, T.b1 + 0.234, T.b2, T.b2 + 0.234]) a += (TAU / 8) * (tb === T.b1 || tb === T.b2 ? 2 : 1.2) * kickStep(t, tb - 0.02);
  return a;
}

/** Estado del personaje: respiración, una acción por beat (asiente en b1, pulgar arriba + guiño en b2). */
function charState(t) {
  const t0 = T.pro - 0.14;
  const rise = spring(t, t0, { from: 1, to: 0, freq: 2.5, damp: 8 });
  const land = t > T.pro ? Math.exp(-(t - T.pro) * 10) * Math.cos((t - T.pro) * 28) : 0;
  const pulse = beatPulse(t, { from: T.pro + 0.2, decay: 0.12 });
  // asentir en b1: anticipa levantando la cabeza y cae con rebote
  const nodA = clamp(1 - Math.abs(t - (T.b1 - 0.07)) / 0.06);
  const nod = t < T.b1 - 0.02 ? -0.4 * nodA : Math.max(0, Math.exp(-(t - T.b1 + 0.02) * 9) * Math.cos((t - T.b1 + 0.02) * 17));
  const nod2 = t > T.b1 + 0.23 ? 0.5 * Math.exp(-(t - T.b1 - 0.23) * 10) * Math.sin((t - T.b1 - 0.23) * 17) : 0;
  // b2: estira (anticipación) y aplasta en el cue: pulgar arriba + guiño
  const ant2 = clamp(1 - Math.abs(t - (T.b2 - 0.06)) / 0.05);
  const sq2 = t > T.b2 - 0.01 ? Math.exp(-(t - T.b2 + 0.01) * 9) * Math.cos((t - T.b2 + 0.01) * 24) : 0;
  // parpadeos (idle) y guiño sostenido después del pulgar
  const bl = (tb) => clamp(1 - Math.abs(t - tb) / 0.05);
  const blink = Math.max(bl(T.pro + 0.27), bl(T.b1 + 0.3), bl(T.surge - 0.1));
  const wink = t > T.b2 - 0.01 && t < T.b2 + 0.36 ? 1 : 0;
  const talking = t > T.b2 + 0.02 && t < T.b2 + 0.38;
  const mouth = talking ? 0.5 + 0.5 * Math.sin((t - T.b2) * 34) : 0.15 + 0.25 * pulse + 0.5 * Math.max(0, nod);
  const happy = t > T.b2 + 0.36 && t < T.surge - 0.02 ? 1 : 0;
  // brazo: saluda al entrar (la mano va 2–3 cuadros atrasada), se queda arriba y en b2 hace pulgar arriba
  const lag = 0.042;
  const tl = t - lag;
  const waveAmp = tl < T.b1 ? 0.42 : 0.12 * Math.exp(-(tl - T.b1) * 3);
  const pose = clamp((t - (T.b2 - 0.05)) / 0.05);
  const wave = (1 - pose) * (waveAmp * Math.sin((tl - T.pro) * TAU * 2.6) - 0.1) + pose * (0.12 * Math.exp(-(t - T.b2) * 8) * Math.sin((t - T.b2) * 30));
  const swing = (1 - pose) * 10 * Math.sin((tl - T.pro) * TAU * 2.6 - 0.8) - 14 * Math.max(0, nod);
  // la mano: pop al cambiar a pulgar arriba y un segundo «bombeo» en la corchea
  let hp = t > T.b2 - 0.05 ? 1 + 0.35 * Math.exp(-(t - T.b2 + 0.05) * 11) * Math.cos((t - T.b2 + 0.05) * 22) : 1;
  if (t > T.b2 + 0.214) hp += 0.2 * Math.exp(-(t - T.b2 - 0.214) * 10) * Math.sin((t - T.b2 - 0.214) * 26);
  const breath = Math.sin(TAU * 0.9 * (t - T.pro));
  // en b1 todo el cuerpo acompaña el «sí» con un rebotecito
  const hb = (t - T.b1 + 0.02) / 0.24, hb2 = (t - T.b2 - 0.2) / 0.22;
  const hop = (hb > 0 && hb < 1 ? Math.sin(Math.PI * hb) : 0) + (hb2 > 0 && hb2 < 1 ? 0.8 * Math.sin(Math.PI * hb2) : 0);
  return {
    dy: rise * 640 + 5 * pulse + 6 * Math.max(0, nod) - 22 * hop, sx: 1 + 0.06 * land + 0.06 * sq2 - 0.025 * ant2, sy: 1 - 0.08 * land - 0.08 * sq2 + 0.04 * ant2,
    tilt: 0.035 * Math.sin(t * 2.4) - 0.025 * pulse + 0.05 * nod + (talking ? 0.03 * Math.sin((t - T.b2) * 9) : 0),
    headDy: 16 * nod + 6 * nod2, headSq: Math.max(0, nod), look: 6 * Math.max(0, nod),
    tail: 0.35 * Math.sin(t * 3.2 - 0.6) + 0.25 * pulse + 0.4 * nod,
    blink, wink, mouth, happy, led: pulse, breath,
    arm: { pose, wave, swing, pop: hp },
  };
}

/** Ondas de «asesoramiento» que salen del micrófono en cada corchea (más fuertes en el beat). */
function drawSonar(c, t) {
  for (let i = 0; i < 12; i++) {
    const tb = T.pro + 0.234375 * i;
    const dt = t - tb;
    if (dt < 0 || dt > 0.8) continue;
    const p = dt / 0.8;
    const k = i % 2 ? 0.6 : 1;
    c.strokeStyle = rgba(PAL.aqua300, 0.45 * k * (1 - p));
    c.lineWidth = (10 * (1 - p) + 2) * k;
    c.beginPath(); c.arc(PRO.x, PRO.y + 40, 170 + 560 * E.outCubic(p), -2.7, -0.45); c.stroke();
  }
}

/** Dibuja el compás 13 (dentro del plano de la cámara). */
export function drawPro(ctx, t) {
  if (t < T.pro - 0.16) return;
  const s = surgeAt(t);
  ctx.save();
  // anticipación de la ola: todo se inclina y aplasta hacia la izquierda (pivote abajo al centro)
  ctx.translate(960 + s.dx, 1080);
  ctx.rotate(s.rot);
  ctx.scale(s.sx, s.sy);
  ctx.translate(-960, -1080);
  // halo frío detrás de la especialista (separa figura y timón)
  const gp = beatPulse(t, { from: T.pro, decay: 0.12, every: 0.5 });
  const ga = clamp((t - T.pro + 0.1) / 0.25);
  if (ga > 0) {
    const g = ctx.createRadialGradient(PRO.x, PRO.y, 0, PRO.x, PRO.y, 620);
    g.addColorStop(0, rgba(PAL.aqua300, (0.2 + 0.2 * gp) * ga));
    g.addColorStop(1, rgba(PAL.aqua300, 0));
    ctx.fillStyle = g;
    ctx.fillRect(PRO.x - 620, PRO.y - 620, 1240, 1240);
  }
  // timón
  const wp = spring(t, T.pro - 0.1, { from: 0, to: 1, freq: 2.6, damp: 7 });
  if (wp > 0.01) {
    ctx.save();
    ctx.translate(PRO.x, PRO.wheelY);
    ctx.scale(wp, wp);
    drawWheel(ctx, PRO.R, wheelAngle(t), { glow: beatPulse(t, { from: T.pro, decay: 0.12 }) });
    glints(ctx, t, [[T.pro + 0.3, -16, -16, 40], [T.b2 + 0.2, -14, -14, 34]]);
    ctx.restore();
  }
  drawSonar(ctx, t);
  // especialista
  const cs = charState(t);
  ctx.save();
  ctx.translate(PRO.x, PRO.y + cs.dy + 416);
  ctx.scale(cs.sx, cs.sy);
  ctx.translate(0, -416);
  drawSpecialist(ctx, cs);
  ctx.restore();
  // globos
  // globos: en la anticipación de la ola se inclinan la MITAD que el fondo (contra-rotación)
  const lean = -0.5 * s.rot;
  drawBubble(ctx, t, { t0: T.b1, x: 140, y: 392, text: '¿Qué crucero me conviene?', bg: PAL.white, fg: PAL.navy900, tail: 'bl', weight: 600, lean, from: -520 });
  drawBubble(ctx, t, { t0: T.b2, x: 1112, y: 512, text: '¡Te ayudamos a elegir!', bg: PAL.ocean500, fg: PAL.white, tail: 'bl', weight: 700, check: true, lean, from: 900 });
  ctx.restore();
}

/** Titular del compás 13. */
export function drawProHeadline(ctx, t) {
  if (t < T.pro - 0.05) return;
  const s = surgeAt(t);
  ctx.save();
  ctx.translate(960 + s.dx * 1.4, 1080);
  ctx.rotate(s.rot * 1.2);
  ctx.scale(s.sx, s.sy);
  ctx.translate(-960, -1080);
  drawBlock(ctx, KICK, { t, in: T.pro - 0.05, enter: 'whip', stagger: 0.0333, extrude: { depth: 5, color: PAL.ink, dx: 0.6, dy: 1 } });
  drawBlock(ctx, HEAD, {
    t, in: T.pro - 0.01, enter: 'whip', stagger: 0.0333,
    extrude: { depth: 9, color: PAL.ink, dx: 0.62, dy: 1 },
    sweep: { t0: T.b1 + 0.1, dur: 0.6, alpha: 0.7 },
    hops: [T.b1 + 0.02, T.b2 + 0.02], hopAmp: 0.14,
  });
  ctx.restore();
}
