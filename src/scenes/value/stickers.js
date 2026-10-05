// Calcos de viaje que se PEGAN en la valija: vuelan hacia la superficie, golpean (squash), bambolean y
// les queda una esquinita de papel levantada. Se dibujan en coordenadas LOCALES de la valija.
import { PAL, shade, rgba } from '../../engine/color.js';
import { E, clamp, lerp, TAU } from '../../engine/ease.js';
import { rrectPath } from '../../engine/draw.js';
import { makeCanvas } from '../../engine/env.js';
import { fontStr } from '../../engine/text.js';
import { shade3, gloss } from './shade3.js';
import { tones, sprite, drawSprite, shadowOf, label } from './util.js';
import { iconCouple, iconFamily, iconToast } from './icons.js';
import { T } from './timeline.js';

const FS = 40;
const BORDER = 10;
const IH = 94; // alto interior

/** Escala de los calcos sobre la valija (texto de ≥ 34 px de mayúscula a 1080 en reposo). */
export const K = 1.3;
const FLY = 0.09; // vuelo: termina EN el cue (impacto)

// Todos llegan desde la derecha (fuera de cuadro): ninguna trayectoria cruza el titular.
export const STK = [
  { text: 'EN PAREJA', t: T.s1, fill: PAL.navy700, fg: PAL.white, iconBg: PAL.coral, icon: iconCouple, shape: 'pill',
    x: -18, y: -372, rot: -0.085, from: [760, -560], spin: 0.55 },
  { text: 'EN FAMILIA', t: T.s2, fill: PAL.gold, fg: PAL.navy900, iconBg: PAL.navy700, icon: iconFamily, shape: 'scallop',
    x: 30, y: -228, rot: 0.06, from: [820, -60], spin: 0.7 },
  { text: 'CON AMIGOS', t: T.s3, fill: PAL.ocean500, fg: PAL.white, iconBg: PAL.navy800, icon: iconToast, shape: 'rect',
    x: -8, y: -84, rot: -0.045, from: [700, 430], spin: -0.6 },
];

function outerPath(d) {
  const w = d.w + BORDER * 2, h = IH + BORDER * 2;
  if (d.shape === 'scallop') {
    // borde festoneado tipo estampilla
    const p = new Path2D();
    p.addPath(rrectPath(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 14));
    const r = 9.5, step = 21;
    const per = [];
    for (let x = -w / 2 + 14; x <= w / 2 - 14; x += step) per.push([x, -h / 2 + 6], [x, h / 2 - 6]);
    for (let y = -h / 2 + 22; y <= h / 2 - 22; y += step) per.push([-w / 2 + 6, y], [w / 2 - 6, y]);
    for (const [x, y] of per) { p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); }
    return p;
  }
  return rrectPath(-w / 2, -h / 2, w, h, d.shape === 'pill' ? h / 2 : 22);
}

function innerPath(d) {
  return rrectPath(-d.w / 2, -IH / 2, d.w, IH, d.shape === 'pill' ? IH / 2 : d.shape === 'scallop' ? 10 : 14);
}

function paintSticker(c, d) {
  const outer = outerPath(d);
  // papel blanco del troquel en 3 tonos
  shade3(c, outer, { base: '#FFFFFF', dark: '#D9E4EA', light: '#FFFFFF' }, { sh: 5, rim: 0 });
  const inner = innerPath(d);
  shade3(c, inner, tones(d.fill, -0.16, 0.22), { sh: 7, rim: 2.5, grain: 0.12 });
  // círculo del ícono
  const icx = -d.w / 2 + 14 + 37, r = 37;
  const ic = new Path2D();
  ic.arc(icx, 0, r, 0, TAU);
  shade3(c, ic, tones(d.iconBg, -0.2, 0.25), { sh: 5, rim: 2 });
  c.save();
  c.clip(ic);
  c.translate(icx, 2);
  d.icon(c, 64);
  c.restore();
  // texto con sombra dura corta
  const tx = icx + r + 16;
  const font = fontStr(800, FS);
  label(c, d.text, tx + 2, FS * 0.36 + 3, { font, color: shade(d.fill, -0.32), tracking: FS * 0.03 });
  label(c, d.text, tx, FS * 0.36, { font, color: d.fg, tracking: FS * 0.03 });
  // brillo de vinilo
  gloss(c, inner, -d.w / 2, -IH / 2, d.w / 2, IH / 2, { alpha: 0.18, width: 0.1, at: 0.3 });
}

let ready = false;
export function initStickers() {
  if (ready) return;
  ready = true;
  const m = makeCanvas(8, 8).getContext('2d');
  m.font = fontStr(800, FS);
  for (const d of STK) {
    const chars = [...d.text];
    const tw = m.measureText(d.text).width + FS * 0.03 * (chars.length - 1) + FS * 0.03 * 3.5 * (chars.filter((ch) => ch === ' ').length);
    d.w = 14 + 74 + 16 + tw + 30;
    const w = d.w + BORDER * 2 + 8, h = IH + BORDER * 2 + 8;
    d.spr = sprite(w, h, w / 2, h / 2, 1.6, (c) => paintSticker(c, d));
    d.shadow = shadowOf(d.spr, { blur: 7, color: '#04101F' });
    d.outer = outerPath(d);
  }
}

/** Bamboleo amortiguado (rad) que arranca en t0: ±amp, ~6,5 Hz → 3–4 oscilaciones visibles. */
const wobble = (t, t0, amp) => (t < t0 ? 0 : amp * Math.exp(-(t - t0) * 4.4) * Math.sin((t - t0) * 41));

/** Estado del calco i en t (null si todavía no entró). Coordenadas locales de la valija. */
export function stickerState(t, i) {
  const d = STK[i];
  const dt = t - d.t;
  if (dt < -FLY) return null;
  if (dt < 0) {
    // vuela desde fuera de cuadro (más cerca de la cámara) y pega justo en el cue
    const p = (dt + FLY) / FLY;
    const e = E.inQuad(p);
    const s = lerp(1.55, 1, e);
    return {
      x: d.x + d.from[0] * (1 - E.outQuad(p)), y: d.y + d.from[1] * (1 - E.outQuad(p)),
      r: d.rot + d.spin * (1 - e), s, sx: 1, sy: 1, h: s - 1, curl: 30, flash: 0, hit: -1,
    };
  }
  const sq = Math.exp(-dt * 10) * Math.cos(dt * 34);
  return {
    x: d.x, y: d.y,
    r: d.rot + wobble(t, d.t, 0.07) + wobble(t, T.wob + i * 0.017, 0.06),
    s: 1, sx: 1 + 0.08 * sq, sy: 1 - 0.12 * sq, h: 0,
    curl: Math.max(7, 15 + 34 * Math.exp(-dt * 7) * Math.cos(dt * 17)) + 8 * Math.max(0, wobble(t, T.wob + i * 0.017, 1)),
    flash: Math.exp(-dt / 0.035), hit: dt,
  };
}

/** Dibuja el calco i en t (llamar en coords locales de la valija). */
export function drawSticker(c, t, i) {
  const d = STK[i];
  const st = stickerState(t, i);
  if (!st) return;
  const w = d.w + BORDER * 2, h = IH + BORDER * 2;
  // sombra: lejos y difusa en el aire, pegada al apoyar
  c.save();
  c.translate(st.x + 4 + 90 * st.h, st.y + 6 + 110 * st.h);
  c.rotate(st.r);
  c.scale(K * st.s * (1 + 0.1 * st.h), K * st.s * (1 + 0.1 * st.h));
  c.globalAlpha *= 0.42 / (1 + 2.2 * st.h);
  drawSprite(c, d.shadow);
  c.restore();
  c.save();
  c.translate(st.x, st.y);
  c.rotate(st.r);
  c.scale(K * st.s * st.sx, K * st.s * st.sy);
  // esquina inferior derecha levantada: recorte por la línea de doblez x + y = k
  const cu = st.curl;
  const k = w / 2 + h / 2 - cu * 1.35;
  c.save();
  c.beginPath();
  c.moveTo(-4000, -4000); c.lineTo(k + 4000, -4000); c.lineTo(-4000, k + 4000); c.closePath();
  c.clip();
  drawSprite(c, d.spr);
  if (st.flash > 0.01) {
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha *= st.flash * 0.45;
    c.fillStyle = '#ffffff';
    c.fill(d.outer);
  }
  c.restore();
  // la solapa (dorso del papel) reflejada sobre la línea de doblez x + y = k
  const beyond = new Path2D();
  beyond.moveTo(k + 4000, -4000); beyond.lineTo(k + 4000, k + 4000); beyond.lineTo(-4000, k + 4000); beyond.closePath();
  const keep = new Path2D();
  keep.moveTo(-4000, -4000); keep.lineTo(k + 4000, -4000); keep.lineTo(-4000, k + 4000); keep.closePath();
  // sombrita que la solapa proyecta sobre el calco
  c.save();
  c.clip(d.outer);
  c.clip(keep);
  c.transform(0, -1, -1, 0, k, k);
  c.translate(-5, -8);
  c.clip(beyond);
  c.fillStyle = 'rgba(4,16,31,0.24)';
  c.fill(d.outer);
  c.restore();
  c.save();
  c.transform(0, -1, -1, 0, k, k);
  c.clip(beyond);
  const g = c.createLinearGradient(k / 2, k / 2, w / 2, h / 2);
  g.addColorStop(0, '#F4F8FA');
  g.addColorStop(1, '#BFCDD6');
  c.fillStyle = g;
  c.fill(d.outer);
  c.restore();
  c.restore();
}

/** Líneas de impacto alrededor del calco recién pegado. */
export function drawSlapLines(c, t, i) {
  const d = STK[i];
  const st = stickerState(t, i);
  if (!st || st.hit < 0 || st.hit > 0.2) return;
  const p = st.hit / 0.2;
  const w = d.w + BORDER * 2, h = IH + BORDER * 2;
  c.save();
  c.translate(d.x, d.y);
  c.rotate(d.rot);
  c.scale(K, K);
  c.strokeStyle = rgba('#FFFFFF', 0.9 * (1 - p));
  c.lineCap = 'round';
  c.lineWidth = 6 * (1 - p * 0.6);
  const rays = [[-1, -1, -2.4], [0, -1, -1.57], [1, -1, -0.75], [1, 1, 0.75], [-1, 1, 2.35], [-1, 0, 3.14], [1, 0, 0]];
  for (const [sx, sy, a] of rays) {
    const bx = sx * (w / 2 + 8), by = sy * (h / 2 + 8);
    const r0 = 6 + 40 * E.outCubic(p), r1 = r0 + 26 * (1 - p);
    c.beginPath();
    c.moveTo(bx + Math.cos(a) * r0, by + Math.sin(a) * r0);
    c.lineTo(bx + Math.cos(a) * r1, by + Math.sin(a) * r1);
    c.stroke();
  }
  c.restore();
}
