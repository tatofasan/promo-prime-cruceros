// Gancho, mundo gris (1,775–3,86): «¿Y SI» · «TUS PRÓXIMAS» · «VACACIONES…» en la mitad izquierda.
// Hielo con extrusión navy; «VACACIONES…» en oro que late. La ola de ART se las lleva:
//  · la cresta (over de reveal-sea) se pinta ENCIMA de los titulares (PLAN §7 v2, OVER_ABOVE): el agua los tapa;
//  · lo que ya quedó detrás del frente se borra con la máscara INVERSA de la ola (waveCut);
//  · antes de que llegue el agua, el bloque recibe un EMPUJE hacia la izquierda (dirección de la ola) con giro
//    antihorario, monótono por letra (cada letra se mueve igual o más que la de su derecha: nunca se pisan) y
//    una estela CONTINUA (smear direccional del motor, largo ∝ velocidad) detrás del bloque nítido.
// Cajas de línea (coordenadas del bloque): «¿Y SI» 263–473 · «TUS PRÓXIMAS» 492–615 · «VACACIONES…» 647–745.
import { txt } from '../../engine/text.js';
import { E, clamp, lerp, smoothstep } from '../../engine/ease.js';
import { beatPulse, BEAT } from '../../engine/time.js';
import { noise1 } from '../../engine/noise.js';
import { sparkle, smear } from '../../engine/draw.js';
import { layer } from '../../engine/layer.js';
import { PAL, rgba } from '../../engine/color.js';
import { drawGlyphs, S0, spaced, warm, glyphList } from './glyphs.js';
import { echoAt, popIn, lineFloat } from './motion.js';
import { C, ICE, GOLD } from './style.js';
import { WAVE, frontMin, waveCut, hollowShade } from './wave-clip.js';
import { drawBurst, drawDust } from './burst.js';

const X0 = 124;
const LIGHT = [-0.42, -0.91]; // tubo fluorescente arriba a la izquierda
const BASE = [416, 604, 734]; // líneas de base definitivas (bloque)
const RISE = 112; // «¿Y SI» golpea un renglón más abajo (sola, centrada en la zona) y sube antes de q2
const BAND = 479; // tope de la franja de la línea 2: la caída de «TUS PRÓXIMAS» va enmascarada debajo
// …salvo una muesca sobre la Ó: el acento asoma desde el primer cuadro de la caída (no se lee «PROXIMAS»)
const NOTCH = { pad: 40, h: 90 };
let ACC = null; // [x0, x1] de la Ó en coordenadas del bloque
// subida de «¿Y SI»: anticipación de 3 cuadros (se hunde) → sube con overshoot → asentada en 2,30
const UP_A = C.q2 - 0.161, UP_B = C.q2 - 0.111, UP_C = C.q2 - 0.044;
// caída corta de «TUS PRÓXIMAS» (0,45 em, golpea en q2 = 2,344)
const FALL = 0.044, FALL_H = 50;
let L1, L2, L3, LINES = null;

export const HOOK_GREY = { from: C.q1 - 0.12, to: WAVE.t1 };
/** Mide y pre-arma (en init: en el navegador las fuentes cargan DESPUÉS de importar las escenas). */
export function initHookGrey() {
  L1 = spaced(txt('¿Y SI', { size: 212, weight: 900, tracking: -0.02 }), 0.16);
  L2 = spaced(txt('TUS PRÓXIMAS', { size: 112, weight: 900, tracking: -0.01 }), 0.12);
  L3 = txt('VACACIONES…', { size: 118, weight: 900, tracking: -0.01 });
  LINES = [L1, L2, L3].map((T, k) => ({ T, x: X0, y: BASE[k] - T.lines[0].base }));
  const o = glyphList(L2).find((it) => it.g.ch === 'Ó');
  ACC = o ? [X0 + o.cx - o.g.w / 2 - NOTCH.pad, X0 + o.cx + o.g.w / 2 + NOTCH.pad] : null;
  // también el juego chico (0,42) precalentado (drawGlyphs lo elige si la escala en pantalla baja de 0,62)
  warm(L1, ICE, LIGHT, true);
  warm(L2, ICE, LIGHT, true);
  warm(L3, GOLD, LIGHT, true);
}

/** Cámara del bloque: empuje lento con deriva; en el surge retrocede, se apoya contra la ola y tiembla (TODO el bloque). */
function blockCam(t) {
  const push = 1 + 0.03 * E.inOutSine(clamp((t - C.q1) / (C.surge - C.q1)));
  const back = -0.022 * E.outCubic(clamp((t - C.surge) / 0.12)) * (1 - 0.4 * E.inOutSine(clamp((t - C.surge - 0.12) / 0.3)));
  const shake = 5 * smoothstep(C.surge - 0.02, C.surge + 0.06, t);
  // anticipación al surge: el bloque se encoge apenas y se inclina contra la ola (que viene de la derecha)
  const brace = smoothstep(C.surge - 0.04, C.surge + 0.2, t);
  return {
    s: push + back,
    dx: 3 * noise1(t * 0.5, 7) + noise1(t * 28, 11) * shake - brace * 6,
    dy: 2.4 * noise1(t * 0.45 + 9, 8) + noise1(t * 31, 23) * shake * 0.8,
    r: -0.012 * brace + noise1(t * 24, 37) * shake * 0.0012,
  };
}

/** Desplazamiento vertical de «¿Y SI» respecto de su renglón definitivo, y su escala (pivote: base). */
function riseL1(t) {
  let dy = RISE, sx = 1, sy = 1;
  if (t >= UP_A && t < UP_B) {
    const k = E.outCubic((t - UP_A) / (UP_B - UP_A));
    dy = RISE + 14 * k; sy = 1 - 0.07 * k; sx = 1 + 0.035 * k;
  } else if (t >= UP_B && t < UP_C) {
    const x = (t - UP_B) / (UP_C - UP_B);
    dy = lerp(RISE + 14, 0, E.backOut(1.6)(x));
    const st = Math.sin(Math.PI * clamp(x * 1.25));
    sy = 1 + 0.1 * st; sx = 1 - 0.04 * st;
  } else if (t >= UP_C) {
    dy = 0;
    // reacción al golpe de «TUS PRÓXIMAS»: saltito hacia ARRIBA (lejos de la línea 2) y asienta
    const q = t - C.q2;
    if (q > 0 && q < 0.16) dy = -12 * Math.sin(Math.PI * q / 0.16) * (1 - q / 0.32);
  }
  // golpe de entrada en q1: aplastamiento uniforme de toda la palabra (≤ 8 %)
  const q1 = t - C.q1;
  if (q1 > 0 && q1 < 0.5) { const k = Math.exp(-q1 * 9) * Math.cos(q1 * 34); sy *= 1 - 0.08 * k; sx *= 1 + 0.05 * k; }
  return { dy, sx, sy };
}

/** Caída corta de «TUS PRÓXIMAS» (línea entera): dy y escala con pivote en la base. */
function dropL2(t) {
  const q = t - C.q2;
  if (q < -FALL) return null;
  if (q < 0) {
    const p = 1 + q / FALL;
    return { dy: -FALL_H * (1 - p * p), sx: 1 - 0.06 * p, sy: 1 + 0.14 * p, a: clamp(p * 3) };
  }
  if (q > 0.6) return { dy: 0, sx: 1, sy: 1, a: 1 };
  const env = Math.exp(-q * 13);
  return { dy: -8 * Math.exp(-q * 6) * Math.max(0, Math.sin(q * 16)), sx: 1 + 0.08 * env, sy: 1 - 0.14 * env, a: 1 };
}

// ---------------------------------------------------------------- empuje de la ola
const PUSH = 270; // px que viaja la letra de referencia
const pushK = (t) => {
  const p = WAVE.p(t);
  const k = smoothstep(0.2, 0.8, p);
  return k * k;
};
/** Factor por x del bloque: las letras de la izquierda (más lejos del agua) se mueven MÁS → nunca se pisan. */
const pushF = (x) => 1 + 0.55 * clamp((1100 - x) / 1000);

/** Estado de cada letra: entrada propia de la línea + empuje de la ola. */
function lineState(k, t) {
  const L = LINES[k];
  const kp = pushK(t);
  return (it, i) => {
    const s = S0();
    if (k === 0) {
      s.echo = echoAt(t - C.q1 - i * 0.014, 0.36);
    } else if (k === 2) {
      const q = t - C.q3;
      if (it.g.dot !== undefined) {
        // los tres puntos, uno por cuadro: completos en 2,95
        popIn(s, q - 0.1 - it.g.dot / 60, { dur: 0.12, over: 1.4, lift: 0.8 });
      } else {
        popIn(s, q - Math.abs(i - 4.5) * 0.014, { dur: 0.42, over: 1.3 });
        if (q < 0.9) { const g = 0.9 * Math.exp(-Math.max(0, q) / 0.25); if (g > 0.01) s.glow = g; }
      }
      if (s.a <= 0) return null;
    }
    if (kp > 0) {
      const f = pushF(L.x + it.cx);
      s.dx -= PUSH * kp * f;
      s.dy -= 70 * kp * f;
      s.r -= 0.11 * kp * f;
    }
    return s;
  };
}

/** Velo oscuro detrás del bloque (para leer sobre la ventana y el escritorio). */
function veil(c, t) {
  const a = 0.42 * E.outCubic(clamp((t - (C.q1 - 0.1)) / 0.35));
  if (a <= 0.01) return;
  c.save();
  c.translate(560, 540);
  c.scale(1, 0.62);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 760);
  g.addColorStop(0, rgba(PAL.ink, a));
  g.addColorStop(0.55, rgba(PAL.ink, a * 0.62));
  g.addColorStop(1, rgba(PAL.ink, 0));
  c.fillStyle = g;
  c.fillRect(-760, -760, 1520, 1520);
  c.restore();
}

/** El bloque de texto completo (sin velo) con la cámara del bloque aplicada. */
function drawBlock(lc, t, cam) {
  lc.save();
  lc.translate(X0 + cam.dx, 500 + cam.dy);
  if (cam.r) lc.rotate(cam.r);
  lc.scale(cam.s, cam.s);
  lc.translate(-X0, -500);
  // 1) ¿Y SI: golpe desde cámara (×2,3 → 1, acelera y pega en el cue) un renglón más abajo; sube antes de q2
  const q1 = t - C.q1;
  if (q1 > -0.1) {
    const e = E.inQuad(clamp((q1 + 0.1) / 0.1));
    const sc = q1 < 0 ? 2.3 - 1.3 * e : 1;
    const R = riseL1(t);
    const T = L1;
    const cx = X0 + T.width / 2, cy = BASE[0] + R.dy - T.capH / 2, by = BASE[0] + R.dy;
    lc.save();
    lc.translate(cx, cy); lc.scale(sc, sc); lc.translate(-cx, -cy);
    if (R.sx !== 1 || R.sy !== 1) { lc.translate(cx, by); lc.scale(R.sx, R.sy); lc.translate(-cx, -by); }
    drawGlyphs(lc, T, { x: LINES[0].x, y: LINES[0].y + R.dy + lineFloat(t, 0, UP_C + 0.3), style: ICE, light: LIGHT, alpha: clamp((q1 + 0.1) / 0.04),
      state: lineState(0, t) });
    lc.restore();
  }
  // 2) TUS PRÓXIMAS: cae 0,45 em DENTRO de su franja (enmascarada debajo de «¿Y SI») y aplasta en q2
  const D = dropL2(t);
  if (D) {
    const masked = t < C.q2 + 0.2;
    const cx = X0 + L2.width / 2, by = BASE[1] + D.dy;
    lc.save();
    if (masked) {
      lc.beginPath();
      lc.rect(-2000, BAND, 6000, 3000);
      if (ACC) lc.rect(ACC[0], BAND - NOTCH.h, ACC[1] - ACC[0], NOTCH.h + 1); // muesca del acento (misma dirección: unión)
      lc.clip();
    }
    if (D.sx !== 1 || D.sy !== 1) { lc.translate(cx, by); lc.scale(D.sx, D.sy); lc.translate(-cx, -by); }
    drawGlyphs(lc, L2, { x: LINES[1].x, y: LINES[1].y + D.dy + lineFloat(t, 1, C.q2 + 0.5), style: ICE, light: LIGHT, alpha: D.a,
      state: lineState(1, t) });
    lc.restore();
  }
  // 3) VACACIONES…: florece desde el centro en oro y late en cada corchea
  if (t > C.q3 - 0.25) {
    const pulse = beatPulse(t, { from: C.q3, every: 0.5, decay: 0.14 });
    drawGlyphs(lc, L3, { x: LINES[2].x, y: LINES[2].y + lineFloat(t, 2, C.q3 + 0.5), style: GOLD, light: LIGHT, glow: 0.22 + 0.4 * pulse,
      state: lineState(2, t), sheen: { p: (t - C.leak + 0.06) / 0.5, color: '255,250,232', alpha: 0.95, width: 0.16 } });
  }
  // acción secundaria de cada golpe: onda y rayitas (¿Y SI), polvito (TUS PRÓXIMAS), chispas doradas (VACACIONES…)
  const c1 = [X0 + L1.width / 2, BASE[0] + RISE - L1.capH / 2];
  drawBurst(lc, t, C.q1, c1[0], c1[1], L1.width * 0.55, L1.capH * 0.62, { n: 16, seed: 11, reach: 150, kinds: ['streak', 'streak', 'dot'], colors: ['#FFFFFF', PAL.grey200], alpha: 0.85 });
  drawDust(lc, t, C.q2, X0, X0 + L2.width, BASE[1] + 6, { n: 14, seed: 4, color: PAL.grey300, alpha: 0.42, size: 1.1 });
  const c3 = [X0 + L3.width / 2, BASE[2] - L3.capH / 2];
  drawBurst(lc, t, C.q3, c3[0], c3[1], L3.width * 0.52, L3.capH * 0.7, { n: 18, seed: 23, reach: 170, kinds: ['spark', 'dot', 'streak', 'spark'], colors: [PAL.goldPale, PAL.gold, '#FFFFFF'], size: 1.1 });
  lc.restore();
  // destellos en el oro (en las corcheas después del golpe; se apagan cuando empuja la ola)
  if (t > C.q3 + 0.1 && pushK(t) < 0.02) glints(lc, t, cam);
}

export function drawHookGrey(ctx, t) {
  if (t < HOOK_GREY.from || t >= HOOK_GREY.to) return;
  if (!LINES) initHookGrey();
  const p = WAVE.p(t);
  if (p >= 1) return;
  const cam = blockCam(t);
  // la ola se lleva todo (velo incluido): cuando el frente ya toca la zona del texto se dibuja en una capa propia
  // y se borra lo que quedó DETRÁS del frente (máscara inversa). La cresta la pinta reveal-sea encima.
  const cut = p > 0 && frontMin(p) - 40 < 1240;
  const lc = cut ? layer().getContext('2d') : ctx;
  veil(lc, t);
  // empuje en movimiento: el bloque se pinta UNA vez en una capa y sale como BARRIDO CONTINUO (smear del motor),
  // nunca como copias discretas (se leían como doble exposición, también entre las submuestras del render final):
  //  1) estela: caja de largo ∝ velocidad en la dirección del viaje, corrida medio largo hacia atrás → arranca en
  //     cada letra y se desvanece en rampa hacia donde venía;
  //  2) núcleo: desenfoque corto en la dirección del viaje (centrado) que se funde con la copia nítida a medida
  //     que la velocidad sube; con las submuestras del render final las posiciones se encadenan sin escalones.
  const v = (pushK(t) - pushK(t - 1 / 60)) * PUSH; // px/cuadro de la letra de referencia
  if (v > 2) {
    const A0 = layer();
    drawBlock(A0.getContext('2d'), t, cam);
    const Z = ZONE;
    // napi graba comandos: cada drawImage de A0 lo volvería a rasterizar. Se rasteriza UNA vez pasándolo a A y
    // los barridos y la copia nítida leen A (una imagen ya hecha).
    const A = layer();
    A.getContext('2d').drawImage(A0, Z.x, Z.y, Z.w, Z.h, Z.x, Z.y, Z.w, Z.h);
    const at = (c, ox, oy) => c.drawImage(A, Z.x, Z.y, Z.w, Z.h, Z.x + ox, Z.y + oy, Z.w, Z.h);
    const [ux, uy] = TRAIL.dir;
    lc.save();
    lc.setTransform(1, 0, 0, 1, 0, 0);
    // 1) estela (largo ≈ 1,1 cuadros de viaje de la letra de referencia, con tope; alfa que entra con la velocidad)
    const len = Math.min(TRAIL.max, v * TRAIL.k);
    lc.globalAlpha = TRAIL.alpha * smoothstep(2, 14, v);
    smear(lc, len * ux, len * uy, (c) => at(c, (len * ux) / 2, (len * uy) / 2), 5, { edge: 'none' });
    // 2) núcleo: nítido → desenfoque corto
    const b = smoothstep(CORE.v0, CORE.v1, v), lk = v * CORE.k;
    if (b < 1) { lc.globalAlpha = 1 - b; at(lc, 0, 0); }
    if (b > 0) { lc.globalAlpha = b; smear(lc, lk * ux, lk * uy, (c) => at(c, 0, 0), 5, { edge: 'none' }); }
    lc.restore();
  } else drawBlock(lc, t, cam);
  if (!cut) return;
  // dentro del barril (escena vieja bajo el labio) las letras se hunden en la penumbra y se apagan hacia la cara
  hollowShade(lc, p, { amt: 1.3, sink: 0.7 });
  waveCut(lc, p);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(lc.canvas, 0, 0);
  ctx.restore();
}

// zona del bloque (con margen para las letras empujadas y las chispas): lo que entra en la estela
const ZONE = { x: 0, y: 140, w: 1160, h: 650 };
// estela: hacia ATRÁS del viaje (el empuje lleva cada letra a (−270, −70)·k → la estela va a la derecha y abajo)
const TRAIL = { dir: [0.968, 0.251], k: 1.1, max: 80, alpha: 0.55 };
// núcleo: un poco más que el paso entre submuestras del render final (½ cuadro / 6 de la letra más rápida ≈ 8 px)
// → las 6 posiciones se encadenan sin escalones; en borradores y cuadros sueltos, un desenfoque corto y legible
const CORE = { k: 0.2, v0: 4, v1: 20 };

function glints(c, t, cam) {
  const pts = [[X0 + 478, BASE[2] - 80, 0], [X0 + 128, BASE[2] - 66, 1], [X0 + 700, BASE[2] - 20, 2]];
  for (const [x, y, k] of pts) {
    const t0 = C.q3 + 0.12 + k * BEAT * 0.5;
    const q = (t - t0) / 0.38;
    if (q <= 0 || q >= 1) continue;
    const a = Math.sin(Math.PI * q);
    sparkle(c, x * cam.s + (1 - cam.s) * X0 + cam.dx, y * cam.s + (1 - cam.s) * 500 + cam.dy, 30 * a, { alpha: a, color: '#FFF6DE', rot: q * 0.6 });
  }
}
