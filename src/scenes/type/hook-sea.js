// Gancho, mar abierto (3,71–5,5): «…FUERAN EN» golpea en el drop y «CRUCERO?» ENORME en reveal.q5, con
// subrayado dorado y barrido de luz junto al bocinazo. Sale hacia cámara acompañando el empuje al ojo de buey.
// Luz del sol arriba a la derecha → extrusión y sombras hacia abajo a la izquierda.
//  · «…FUERAN EN» no existe hasta que el frente de la ola pasó por su zona: SLAM en 3,75 (escala 1,5 → 0,96 → 1)
//    con un desenfoque que se apaga y una extrusión que crece en 6 cuadros (0 → 12 capas).
//  · «CRUCERO?»: kerning de excepción O–? (+0,05 em) y el «?» en ORO con contorno navy (rima con «VACACIONES…»
//    y no se pierde contra el cielo claro). En el bocinazo: barrido dorado, estrella que corre por el subrayado y
//    estalla en la punta EN 4,6875, y micro-golpe de escala del 3 % en el cue.
import { txt } from '../../engine/text.js';
import { E, clamp } from '../../engine/ease.js';
import { beatPulse, BEAT } from '../../engine/time.js';
import { makeCanvas } from '../../engine/env.js';
import { drawGlyphs, S0, spaced, warm, kernBefore } from './glyphs.js';
import { squash, echoAt, lineFloat } from './motion.js';
import { C, SEA, SEA_GOLD, BAR_GOLD } from './style.js';
import { WAVE, clipBehind } from './wave-clip.js';
import { drawBar } from './bar.js';
import { drawBurst } from './burst.js';
import { PAL } from '../../engine/color.js';
import { sparkle, blurred } from '../../engine/draw.js';

const LIGHT = [0.5, -0.86];
const CX = 960, CY = 300, ROT = -0.045;
let L4 = null, L5 = null;
const B4 = 214, B5 = 426; // líneas de base (coordenadas del bloque, sin rotar)
const UL = { y: B5 + 40, h: 28, pad: -4 };
const END = 5.5;
// slam de «…FUERAN EN»: entra 2 cuadros antes del drop (cuando el frente ya pasó su zona)
const SLAM4 = 0.04;
// «?» en oro con contorno navy (fondo inmediato oscuro: contraste alto contra cualquier cielo)
const Q_GOLD = { ...SEA_GOLD, stroke: { color: PAL.navy800, width: 7 }, rim: PAL.goldPale, rimPx: 2 };
const qStyle = (it) => (it.g.ch === '?' ? Q_GOLD : null);
// la extrusión de «…FUERAN EN» crece de a 2 capas por cuadro: un estilo (y un sprite de línea) por paso
const EXT_STEPS = [0, 2, 4, 6, 8, 10, 12].map((d) => ({ ...SEA, ext: SEA.ext.slice(0, d + 1) }));

export const HOOK_SEA = { from: C.drop - SLAM4, to: END };
/** Mide y pre-arma (en init: en el navegador las fuentes cargan DESPUÉS de importar las escenas). */
export function initHookSea() {
  L4 = spaced(txt('…FUERAN EN', { size: 112, weight: 900, tracking: -0.01 }), 0.12);
  L5 = kernBefore(txt('CRUCERO?', { size: 214, weight: 900, tracking: -0.02 }), '?', 0.05);
  warm(L4, SEA, LIGHT);
  for (const st of EXT_STEPS) warm(L4, st, LIGHT);
  warm(L5, SEA, LIGHT, false, qStyle, '?oro');
}

/** Golpe del bocinazo: pico EXACTO en el cue (sube en 3 cuadros, cae con la cola). */
function hornPunch(t) {
  const q = t - C.horn;
  if (q < -0.05 || q > 0.6) return 0;
  return q < 0 ? E.inQuad((q + 0.05) / 0.05) : Math.exp(-q / 0.09);
}

/** Escala/posición del bloque: micro-golpe en el bocinazo, anticipación en el push y vuelo hacia cámara. */
function blockMove(t) {
  // empuje lento con la cámara (cámara viva) + micro-golpe del 3 % en el bocinazo
  let s = (1 + 0.035 * E.inOutSine(clamp((t - C.drop) / (C.push - C.drop)))) * (1 + 0.03 * hornPunch(t));
  let blur = 0, a = 1, lift = 0;
  const q = t - C.push;
  if (q > 0) {
    // anticipación (se encoge 3 cuadros) y vuela hacia cámara acompañando el empuje al ojo de buey
    const anti = E.outCubic(clamp(q / 0.05));
    const fly = E.inQuad(clamp((q - 0.035) / (END - 0.05 - C.push - 0.035)));
    s *= 1 - 0.05 * anti + 2.4 * fly;
    blur = 18 * fly;
    a = 1 - E.inOutSine(clamp((q - 0.1) / (END - 0.06 - C.push - 0.1)));
    lift = 180 * fly;
  }
  return { s, blur, a, lift };
}

function slamScale(q, from = 2.3, lead = 0.1) {
  if (q >= 0) return 1;
  return from - (from - 1) * E.inQuad(clamp((q + lead) / lead));
}

/** Slam de «…FUERAN EN»: 1,5 → 0,96 (en el cue) → 1 con un rebote corto. */
function slam4(q) {
  if (q < 0) return 1.5 - 0.54 * E.inQuad(clamp((q + SLAM4) / SLAM4));
  return 1 - 0.04 * Math.exp(-q * 22) * Math.cos(q * 26);
}

/** Los puntos de «…» rebotan de a uno en semicorcheas (acción secundaria), cuando la extrusión ya creció. */
function stateL4(t) {
  const q = t - C.drop;
  return (it) => {
    const s = S0();
    if (it.g.dot !== undefined && q > 0.12) {
      const d = q - 0.12 - it.g.dot * (BEAT / 4);
      if (d > 0 && d < 0.7) s.dy -= 22 * Math.exp(-d * 7) * Math.max(0, Math.sin(d * 18));
      if (Math.abs(s.dy) < 0.05) s.dy = 0;
    }
    return s;
  };
}

function stateL5(t) {
  const q = t - C.q5;
  const n = 8;
  return (it, i) => {
    const s = S0();
    const ord = Math.abs(i - (n - 1) / 2);
    squash(s, q - ord * 0.02, 1.3);
    s.echo = echoAt(q - ord * 0.01, 0.4);
    if (it.g.ch === '?' && q > 0 && q < 1.1) s.r += 0.22 * Math.exp(-q * 4.5) * Math.sin(q * 15); // el signo se balancea
    return s;
  };
}

/** Barrido DORADO del bocinazo sobre las caras: en el blanco tiñe (source-over); en el «?» de oro suma luz. */
const hornSheen = (t, lag) => ({
  p: (t - (C.horn - 0.13 + lag)) / 0.24, color: '255,210,122', alpha: 0.62, width: 0.24,
  blendFor: (it) => (it.g.ch === '?' ? 'lighter' : null),
});

/** Estrella que corre por el subrayado y estalla en la punta EXACTO en el bocinazo. */
function underlineStar(c, t, ux, uw) {
  const t0 = C.horn - 0.13, q = t - t0, run = C.horn - t0;
  const tipX = ux + uw - 10, y = UL.y - 2;
  if (q > 0 && q < run) {
    const k = E.inCubic(q / run);
    const x = ux + 20 + (tipX - ux - 20) * k;
    // estela de luz sobre la barra
    const g = c.createLinearGradient(x - 260 * k - 40, 0, x, 0);
    g.addColorStop(0, 'rgba(255,246,222,0)');
    g.addColorStop(1, 'rgba(255,246,222,0.85)');
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = g;
    c.fillRect(x - 260 * k - 40, y - 5, 260 * k + 40, 10);
    c.restore();
    sparkle(c, x, y, 34 + 26 * k, { alpha: 1, color: '#FFF6DE', rot: q * 6 });
  }
  const qb = t - C.horn;
  if (qb >= 0 && qb < 0.45) {
    const a = Math.exp(-qb / 0.12);
    // estallido en oro (sobre el cielo claro el blanco no se lee): anillo, estrella grande y núcleo blanco
    c.save();
    c.strokeStyle = `rgba(255,185,56,${(0.9 * a).toFixed(3)})`;
    c.lineWidth = 7 * a + 1.5;
    c.beginPath();
    c.arc(tipX, y, 24 + 190 * E.outCubic(clamp(qb / 0.4)), 0, Math.PI * 2);
    c.stroke();
    c.restore();
    const big = 118 * (0.45 + 0.55 * a) * Math.min(1, 0.65 + qb * 14);
    // estrella de 4 puntas en oro PINTADA (no suma luz: se lee sobre el cielo claro) + núcleo blanco que suma
    c.save();
    c.globalAlpha *= Math.min(1, a * 1.3);
    c.translate(tipX, y);
    c.rotate(qb * 1.2);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, big);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.18, PAL.goldPale); g.addColorStop(0.5, PAL.gold); g.addColorStop(1, PAL.coral);
    c.fillStyle = g;
    const k = big * 0.12;
    c.beginPath();
    c.moveTo(0, -big); c.quadraticCurveTo(k, -k, big, 0); c.quadraticCurveTo(k, k, 0, big);
    c.quadraticCurveTo(-k, k, -big, 0); c.quadraticCurveTo(-k, -k, 0, -big);
    c.fill();
    c.restore();
    sparkle(c, tipX, y, big * 0.5, { alpha: a, color: '#FFFFFF', rot: qb * 1.2 + 0.785, halo: 0.5 });
  }
  drawBurst(c, t, C.horn + 0.017, tipX, y, 40, 40, { n: 16, seed: 17, reach: 170, dur: 0.45, size: 1.25, kinds: ['spark', 'dot', 'dot'], colors: [PAL.gold, PAL.coral, PAL.goldLight] });
}

export function drawHookSea(ctx, t) {
  if (t < HOOK_SEA.from || t >= HOOK_SEA.to) return;
  if (!L4) initHookSea();
  const mv = blockMove(t);
  if (mv.a <= 0.003) return;
  const p = WAVE.p(t);
  // capa solo cuando hace falta: desenfoque del vuelo a cámara (salida, a media resolución)
  const half = mv.blur > 0.3;
  const L = half ? halfBuf() : null;
  const lc = L ? L.getContext('2d') : ctx;
  if (half) { lc.setTransform(1, 0, 0, 1, 0, 0); lc.clearRect(0, 0, L.width, L.height); lc.setTransform(0.5, 0, 0, 0.5, 0, 0); }
  lc.save();
  if (!L) lc.globalAlpha *= mv.a;
  // mientras la ola pasa, solo se ve del lado del mar nuevo (la cresta, encima de todo, lo tapa al pasar)
  if (p < 1) clipBehind(lc, p);
  // vuelo hacia cámara: escala alrededor del ojo de buey (960, 540)
  lc.translate(960, 540 - mv.lift);
  lc.scale(mv.s, mv.s);
  lc.translate(-960, -540);
  lc.translate(CX, CY);
  lc.rotate(ROT);
  lc.translate(-CX, -CY);

  // subrayado dorado (debajo de las letras: la extrusión de las letras lo pisa)
  const q5 = t - C.q5;
  const ux = CX - L5.width / 2 - UL.pad, uw = L5.width + UL.pad * 2;
  if (q5 > 0.04) {
    const k = E.outExpo(clamp((q5 - 0.04) / 0.34));
    const pulse = Math.max(beatPulse(t, { from: C.q5, every: 0.5, decay: 0.12 }), hornPunch(t));
    drawBar(lc, ux, UL.y, uw, UL.h, k, BAR_GOLD, { light: LIGHT, depth: 9, glint: 0.35 * pulse });
  }
  // «…FUERAN EN»: slam (línea entera) con desenfoque que se apaga y extrusión que crece
  const q4 = t - C.drop;
  if (q4 >= -SLAM4) {
    const sc = slam4(q4);
    // desenfoque de «viene desde la cámara» que se apaga justo en el golpe (el cuadro de impacto queda nítido)
    const blurPx = q4 < 0 ? 12 * (1 - E.outQuad(clamp((q4 + SLAM4) / SLAM4))) : 0;
    const step = q4 < 0 ? 0 : Math.min(EXT_STEPS.length - 1, 1 + Math.floor(q4 * 60 + 1e-6));
    const draw4 = (c) => {
      c.save();
      c.translate(CX, B4 - L4.capH / 2); c.scale(sc, sc); c.translate(-CX, -(B4 - L4.capH / 2));
      drawGlyphs(c, L4, { res: 1, sheen: hornSheen(t, 0), x: CX - L4.width / 2, y: B4 - L4.lines[0].base + lineFloat(t, 0, C.drop + 0.5), style: EXT_STEPS[step], light: LIGHT,
        alpha: clamp((q4 + SLAM4) / 0.012), state: stateL4(t) });
      c.restore();
    };
    if (blurPx > 0.35 && !half) blurred(lc, blurPx, draw4);
    else draw4(lc);
  }
  // «CRUCERO?»
  if (q5 > -0.1) {
    const sc = slamScale(q5, 2.1);
    lc.save();
    lc.translate(CX, B5 - L5.capH / 2); lc.scale(sc, sc); lc.translate(-CX, -(B5 - L5.capH / 2));
    drawGlyphs(lc, L5, { res: 1, x: CX - L5.width / 2, y: B5 - L5.lines[0].base + lineFloat(t, 1, C.q5 + 0.6), style: SEA, styleOf: qStyle, styleKey: '?oro', light: LIGHT,
      alpha: clamp((q5 + 0.1) / 0.035), state: stateL5(t), sheen: hornSheen(t, 0.06) });
    lc.restore();
  }
  // acción secundaria: espuma/destellos en el drop, chispas doradas en «CRUCERO?», estrella del bocinazo
  drawBurst(lc, t, C.drop, CX, B4 - L4.capH / 2, L4.width * 0.52, L4.capH * 0.8, { n: 18, seed: 5, reach: 170, gravity: 1.2, kinds: ['dot', 'dot', 'ring', 'spark'], colors: ['#FFFFFF', PAL.aqua100, PAL.aqua200] });
  drawBurst(lc, t, C.q5, CX, B5 - L5.capH / 2, L5.width * 0.52, L5.capH * 0.7, { n: 22, seed: 9, reach: 210, size: 1.25, kinds: ['spark', 'streak', 'dot', 'spark', 'ring'], colors: [PAL.goldPale, PAL.gold, '#FFFFFF', PAL.coralLight] });
  underlineStar(lc, t, ux, uw);
  lc.restore();
  if (!half) return;
  // desenfoque a media resolución (4 veces más barato) y después se escala al cuadro
  const B2 = halfBuf(1);
  const b2 = B2.getContext('2d');
  b2.setTransform(1, 0, 0, 1, 0, 0);
  b2.clearRect(0, 0, B2.width, B2.height);
  b2.filter = `blur(${(mv.blur * 0.5).toFixed(1)}px)`;
  b2.drawImage(L, 0, 0);
  b2.filter = 'none';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= mv.a;
  ctx.drawImage(B2, 0, 0, B2.width, B2.height, 0, 0, 1920, 1080);
  ctx.restore();
}

const hb = [null, null];
/** Lienzos a media resolución para el vuelo desenfocado (se limpian en cada uso). */
const halfBuf = (i = 0) => (hb[i] ??= makeCanvas(960, 540));
