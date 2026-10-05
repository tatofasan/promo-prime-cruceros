// CTA del cierre: botón 3D «CONSULTANOS POR WHATSAPP →» con el ícono. Nace como círculo (pop con pico en
// close.cta) y se estira con resorte hasta la píldora; la flecha empuja a la derecha en cada beat. En close.final
// el botón SE APRIETA (la cara baja sobre su canto: anticipación), salta con overshoot y late con anillos y
// destellos. Hasta 30,0: el cuerpo pulsa en cada beat (el texto NO: se lee quieto), una luz recorre el borde,
// barridos de brillo y el ícono «suena».
// Color (contrato §3 actualizado): #25D366 en el filo, el brillo de arriba, el ícono y los anillos; el cuerpo
// detrás del texto es verde profundo (#1A9E4E → #128C45) y el texto blanco lleva extrusión dura #0B5E2E
// → ≥ 3,5:1 en todo el alto de las letras (antes 1,6:1).
import { E, clamp, prog, pop, lerp, spring, TAU } from '../../engine/ease.js';
import { PAL, rgba } from '../../engine/color.js';
import { rrectPath, lin, sparkle } from '../../engine/draw.js';
import { drawText, txt } from '../../engine/text.js';
import { beatPulse } from '../../engine/time.js';
import { hash } from '../../engine/noise.js';
import { makeCanvas } from '../../engine/env.js';
import { drawWhatsApp } from '../../brand/whatsapp.js';
import { textSprite, drawTextSprite } from './text-sprite.js';
import { grainIn } from './grain.js';
import { T_CTA, T_FIN, BEAT } from './layout.js';

const LABEL = 'CONSULTANOS POR WHATSAPP';
const SIZE = 44;
const DEEP = '#0B5E2E';                                     // extrusión del texto y la flecha
const LABEL_EXTRUDE = { depth: 4, color: DEEP, dx: 0.75, dy: 1 }; // 3 px a la derecha y 4 hacia abajo
const LABEL_LOOK = { fill: PAL.white, extrude: LABEL_EXTRUDE };
const EDGE = 12;         // alto del canto (botón 3D)
const GLOW_BLUR = 56;
const DROP = { color: 'rgba(4,16,31,0.5)', blur: 44, x: -14, y: 24 }; // el sol está a la derecha: sombra a la izquierda
/** Cara: brillo #25D366 arriba (por encima de las letras) y cuerpo verde profundo detrás del texto. */
const FACE_STOPS = [[0, '#3BE07E'], [0.11, PAL.wa], [0.23, '#1A9E4E'], [0.34, '#159248'], [0.72, '#128C45'], [1, '#0F7E3D']];

/** Medidas de la píldora (centrada en x, y) a partir del texto real. */
export function ctaBox(x, y, h) {
  const T = txt(LABEL, { size: SIZE, weight: 800, tracking: 0.05 });
  const icon = h * 0.62, padL = h * 0.27, gap = h * 0.24, arrow = h * 0.46, padR = h * 0.42;
  const w = padL + icon + gap + T.width + gap * 0.95 + arrow + padR;
  return { x, y, w, h, T, icon, padL, gap, arrow, padR, x0: x - w / 2, y0: y - h / 2 };
}

// ------------------------------------------------------------------ sprites (init)
// halo verde y sombra larga de la píldora ABIERTA, pre-pintados (se usan cuando ya no se estira)
let shadows = null;
function shadowSprites(B) {
  if (shadows) return shadows;
  const m = 120;
  const x = B.x0 - m, y = B.y0 - m, w = Math.ceil(B.w + m * 2), h = Math.ceil(B.h + m * 2 + 40);
  const r = B.h / 2;
  const glow = makeCanvas(w, h), g = glow.getContext('2d');
  g.translate(-x, -y);
  g.shadowColor = 'rgba(37,211,102,1)';
  g.shadowBlur = GLOW_BLUR;
  g.fillStyle = PAL.wa;
  g.fill(rrectPath(B.x0, B.y0, B.w, B.h, r));
  const drop = makeCanvas(w, h), d = drop.getContext('2d');
  d.translate(-x, -y);
  d.shadowColor = DROP.color;
  d.shadowBlur = DROP.blur;
  d.shadowOffsetX = DROP.x;
  d.shadowOffsetY = DROP.y;
  d.fillStyle = PAL.waDark;
  d.fill(rrectPath(B.x0, B.y0 + EDGE, B.w, B.h, r));
  shadows = { glow, drop, x, y };
  return shadows;
}
const labelSprite = (T) => textSprite(T, LABEL_LOOK);
export function initCta(G) { const B = ctaBox(G.cta.x, G.cta.y, G.cta.h); labelSprite(B.T); shadowSprites(B); }

// ------------------------------------------------------------------ curvas
/** Desplazamiento de la flecha: anticipa hacia atrás antes de cada beat y sale disparada en el beat. */
function arrowDx(t) {
  if (t < T_CTA) return 0;
  const k = Math.floor((t - T_CTA) / BEAT + 1e-9);
  const dt = t - (T_CTA + k * BEAT);
  const toNext = BEAT - dt;
  let dx;
  if (dt < 0.06) dx = lerp(-7, 20, E.outCubic(dt / 0.06));
  else dx = 20 * Math.exp(-(dt - 0.06) * 8) * Math.cos((dt - 0.06) * TAU * 1.5);
  if (toNext < 0.08) dx += -7 * E.inOutSine(1 - toNext / 0.08);
  return dx;
}
/** Golpe del final (rebote amortiguado) y anticipación chiquita antes. */
function hitAt(t) {
  const dF = t - T_FIN;
  if (dF >= 0) return 0.11 * Math.exp(-dF * 6.5) * Math.cos(dF * TAU * 2.2);
  return dF > -0.1 ? -0.03 * E.inQuad(1 + dF / 0.1) : 0;
}
/** Latido del cuerpo en cada beat (el texto no late: se lee quieto). */
const beatAt = (t) => beatPulse(t, { from: T_CTA + BEAT, every: 1, decay: 0.12 });
/** Botón apretado: 1 = la cara tocó el canto. Baja antes del golpe y en el golpe salta (pasa de largo hacia arriba). */
function pressAt(t) {
  if (t < T_FIN - 0.14) return 0;
  if (t < T_FIN) return E.inOutQuad(prog(t, T_FIN - 0.14, T_FIN - 0.035));
  return spring(t, T_FIN, { from: 1, to: 0, freq: 3.4, damp: 7.5 });
}
/** 0 = círculo con el ícono · 1 = píldora abierta (pasa de largo y vuelve). */
const openAt = (t) => spring(t, T_CTA + 0.02, { from: 0, to: 1, freq: 3.2, damp: 10 });
export const ctaOpen = openAt;
// primer instante en que la píldora llega a abrirse del todo (antes del rebote)
const T_OPENED = (() => { let u = T_CTA; while (openAt(u) < 1 && u < T_CTA + 1) u += 0.001; return u; })();

function drawArrow(ctx, x, y, s, color, alpha = 1) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineWidth = 7.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-22, 0); ctx.lineTo(19, 0);
    ctx.moveTo(4, -16); ctx.lineTo(20, 0); ctx.lineTo(4, 16);
  };
  // extrusión dura (como el texto)
  ctx.strokeStyle = DEEP;
  for (let q = 4; q >= 1; q--) { ctx.save(); ctx.translate((0.75 * q) / s, q / s); path(); ctx.stroke(); ctx.restore(); }
  ctx.strokeStyle = color;
  path();
  ctx.stroke();
  ctx.restore();
}

// vibración tipo «teléfono que suena»
function ringing(t, t0) {
  const d = t - t0;
  if (d < 0 || d > 0.45) return 0;
  return 0.12 * Math.sin(d * TAU * 16) * (1 - d / 0.45);
}

// ------------------------------------------------------------------ botón
export function drawCta(ctx, t, G) {
  const B = ctaBox(G.cta.x, G.cta.y, G.cta.h);
  const k = pop(t, T_CTA - 0.4 * 0.34, { dur: 0.34, over: 1.28 });
  if (k <= 0.001) return;
  const open = openAt(t);
  const vel = (open - openAt(t - 0.016)) / 0.016;
  const hit = hitAt(t), bp = beatAt(t);
  const w = lerp(B.h, B.w, open);
  const x0 = B.x - w / 2;
  // escala del botón entero (pop y golpe) · el cuerpo además late en cada beat y crece unos px
  const sx = k * (1 + 0.6 * hit) * (1 + 0.012 * Math.max(0, vel)), sy = k * (1 + 0.6 * hit) * (1 - 0.018 * Math.max(0, vel));
  const grow = 1 + 0.4 * hit + 0.028 * bp; // sólo cuerpo, halo y canto
  const rise = (1 - clamp(k)) * 50;
  const press = pressAt(t);
  const dyF = (EDGE - 1.5) * press; // la cara baja sobre el canto
  const r = B.h / 2;
  ctx.save();
  ctx.translate(B.x, B.y + rise);
  ctx.scale(sx, sy);
  ctx.translate(-B.x, -B.y);

  // ---- cuerpo (late)
  {
  // halo verde (la píldora «enciende» el agua) y sombra larga: sprites a 1:1 (el halo late en alfa)
  const gl = 0.4 + 0.35 * bp + (t >= T_FIN ? 0.5 * Math.exp(-(t - T_FIN) * 3) : 0);
  const SH = Math.abs(open - 1) < 0.003 ? shadowSprites(B) : null;
  if (SH) {
    ctx.save();
    ctx.globalAlpha *= Math.min(0.95, gl);
    ctx.drawImage(SH.glow, SH.x, SH.y);
    ctx.restore();
    ctx.drawImage(SH.drop, SH.x, SH.y);
  } else {
    ctx.save();
    ctx.shadowColor = `rgba(37,211,102,${Math.min(0.9, gl).toFixed(3)})`;
    ctx.shadowBlur = GLOW_BLUR;
    ctx.fillStyle = PAL.wa;
    ctx.fill(rrectPath(x0, B.y0, w, B.h, r));
    ctx.restore();
    ctx.save();
    ctx.shadowColor = DROP.color;
    ctx.shadowBlur = DROP.blur;
    ctx.shadowOffsetX = DROP.x;
    ctx.shadowOffsetY = DROP.y;
    ctx.fillStyle = PAL.waDark;
    ctx.fill(rrectPath(x0, B.y0 + EDGE, w, B.h, r));
    ctx.restore();
  }
  ctx.save();
  ctx.translate(B.x, B.y);
  ctx.scale(grow, grow);
  ctx.translate(-B.x, -B.y);
  // canto del botón (queda fijo: la cara baja sobre él al apretar)
  ctx.fillStyle = lin(ctx, x0, 0, x0 + w, 0, [[0, '#08502A'], [0.7, '#0B5E31'], [1, '#0E6E3A']]);
  ctx.fill(rrectPath(x0, B.y0 + EDGE, w, B.h, r));
  // cara: brillo #25D366 arriba, cuerpo profundo detrás del texto
  ctx.save();
  ctx.translate(0, dyF);
  const face = rrectPath(x0, B.y0, w, B.h, r);
  ctx.fillStyle = lin(ctx, 0, B.y0, 0, B.y0 + B.h, FACE_STOPS);
  ctx.fill(face);
  ctx.save();
  ctx.clip(face);
  // brillo superior (lente clara sólo en la franja de arriba, sin tocar las letras)
  ctx.fillStyle = lin(ctx, 0, B.y0, 0, B.y0 + B.h * 0.26, [[0, 'rgba(255,255,255,0.36)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fill(rrectPath(x0 + r * 0.4, B.y0 + 4, Math.max(0, w - r * 0.8), B.h * 0.24, B.h * 0.12));
  // apretado: sombra interna arriba (la cara se hunde)
  if (press > 0.02) {
    ctx.fillStyle = lin(ctx, 0, B.y0, 0, B.y0 + B.h * 0.4, [[0, rgba(DEEP, 0.5 * press)], [1, rgba(DEEP, 0)]]);
    ctx.fillRect(x0, B.y0, w, B.h * 0.4);
  }
  ctx.restore();
  // filo #25D366 (más luz del lado del sol) que late con el beat
  ctx.save();
  ctx.lineWidth = 4 + 2 * bp;
  ctx.strokeStyle = lin(ctx, x0, 0, x0 + w, 0, [[0, rgba(PAL.wa, 0.9)], [0.6, PAL.wa], [1, '#7DF0AC']]);
  ctx.stroke(rrectPath(x0 + 2, B.y0 + 2, w - 4, B.h - 4, r - 2));
  ctx.restore();
  grainIn(ctx, face, { x: x0, y: B.y0, w, h: B.h }, { alpha: 0.045 });
  if (open > 0.98) orbit(ctx, t, x0, B.y0, w, B.h, r);
  ctx.restore(); // cara (dyF)
  ctx.restore(); // cuerpo (late)
  }

  // ---- contenido (no late con el beat: se lee quieto)
  {
  ctx.save();
  ctx.translate(0, dyF);
  const face = rrectPath(x0, B.y0, w, B.h, r);
  ctx.save();
  ctx.clip(face);
  // brillo interior que late con el golpe final
  const glowA = t >= T_FIN ? 0.22 * Math.exp(-(t - T_FIN) * 5) : 0;
  if (glowA > 0.01) {
    ctx.fillStyle = lin(ctx, 0, B.y0, 0, B.y0 + B.h, [[0, rgba('#B8FFD2', glowA)], [1, rgba('#B8FFD2', glowA * 0.25)]]);
    ctx.fillRect(x0, B.y0, w, B.h);
  }
  // barridos de luz: al abrirse, en el golpe final, con el barrido de la placa (29,06) y uno más; el último termina
  // antes de 29,98 (el último cuadro queda nítido)
  for (const t0 of [T_CTA + 0.2, T_FIN + 0.08, T_FIN + BEAT + 0.05, T_FIN + 2 * BEAT + 0.02, T_FIN + 3 * BEAT - 0.02]) {
    const p = prog(t, t0, t0 + 0.42);
    if (p > 0 && p < 1) {
      const bx = lerp(B.x0 - 160, B.x0 + B.w + 160, E.inOutSine(p));
      ctx.save();
      ctx.translate(bx, B.y);
      ctx.rotate(0.4);
      ctx.fillStyle = lin(ctx, -60, 0, 60, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.3)'], [1, 'rgba(255,255,255,0)']]);
      ctx.fillRect(-60, -B.h * 2, 120, B.h * 4);
      ctx.restore();
    }
  }
  // texto (desde el centro) y flecha, recortados por la cara mientras se abre
  const tx = B.x0 + B.padL + B.icon + B.gap;
  if (t < T_CTA + 0.6) {
    drawText(ctx, B.T, {
      t, x: tx, y: B.y + 1, anchor: [0, 0.5], in: T_CTA + 0.04, anim: 'rise', by: 'char', stagger: 0.009, from: 'center', dur: 0.36,
      ...LABEL_LOOK,
    });
  } else {
    drawTextSprite(ctx, labelSprite(B.T), tx, B.y + 1, [0, 0.5]); // ya quieto: pre-pintado
  }
  const ak = E.backOut(2)(clamp(prog(t, T_CTA + 0.2, T_CTA + 0.46)));
  const ax = tx + B.T.width + B.gap * 0.95 + B.arrow / 2 - 30 * (1 - ak) + arrowDx(t);
  const as = B.arrow / 46;
  const v = arrowDx(t) - arrowDx(t - 0.016);
  if (v > 2) {
    drawArrow(ctx, ax - v * 1.2, B.y, as, PAL.white, 0.25 * ak);
    drawArrow(ctx, ax - v * 2.4, B.y, as, PAL.white, 0.12 * ak);
  }
  drawArrow(ctx, ax, B.y, as, PAL.white, clamp(ak * 1.5));
  ctx.restore(); // clip

  // ícono #25D366 (globo verde con el auricular blanco, como el oficial): viaja del centro del círculo a su lugar;
  // pop con giro y «suena» (vibra) en el golpe final
  const ik = pop(t, T_CTA - 0.4 * 0.38, { dur: 0.38, over: 1.35 });
  const ring = ringing(t, T_FIN) + ringing(t, T_FIN + BEAT) * 0.6 + ringing(t, T_FIN + 2 * BEAT) * 0.7;
  const ip = t < T_OPENED ? clamp(open) : 1;
  const ix = lerp(B.x, B.x0 + B.padL + B.icon / 2, ip), iy = B.y;
  if (ik > 0.001) {
    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate((1 - clamp(ik)) * -0.9 + ring);
    ctx.scale(ik, ik);
    ctx.shadowColor = 'rgba(4,50,24,0.55)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    drawWhatsApp(ctx, 0, 0, B.icon, { color: PAL.white, bg: PAL.wa, phone: 1 + 0.9 * Math.abs(ring) });
    ctx.restore();
  }
  ctx.restore(); // contenido (dyF)
  }
  ctx.restore(); // transformación del botón
}

// dos cometas de luz que recorren el borde del botón (desde que termina de abrirse)
function orbit(ctx, t, x0, y0, w, h, r) {
  const on = clamp((t - T_CTA - 0.5) / 0.3);
  if (on <= 0) return;
  const per = 2 * (w - 2 * r) + TAU * r;
  const seg = 150;
  const boost = t >= T_FIN ? 1 + 0.8 * Math.exp(-(t - T_FIN) * 2.5) : 1;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  const path = rrectPath(x0 + 2, y0 + 2, w - 4, h - 4, r - 2);
  const off = -((t - T_CTA) / (4 * BEAT)) * per; // una vuelta por compás
  for (const [width, a] of [[9, 0.18], [3.2, 0.85]]) {
    ctx.strokeStyle = rgba('#E9FFF2', a * on * Math.min(1, boost));
    ctx.lineWidth = width;
    ctx.setLineDash([seg, per / 2 - seg]);
    ctx.lineDashOffset = off;
    ctx.stroke(path);
  }
  ctx.setLineDash([]);
  ctx.restore();
}

/** Anillo expansivo achatado (abre más a los costados que hacia arriba: no toca el barco). */
export function ringRect(B, pad) {
  const py = pad * 0.25;
  return rrectPath(B.x0 - pad, B.y0 - py, B.w + pad * 2, B.h + py * 2, B.h / 2 + py);
}

/** Golpe final: anillos que se expanden desde la píldora y destellos que salen despedidos. */
export function drawCtaBurst(ctx, t, G) {
  const d = t - T_FIN;
  if (d < 0 || d > 1.3) return;
  const B = ctaBox(G.cta.x, G.cta.y, G.cta.h);
  ctx.save();
  for (let k = 0; k < 2; k++) {
    const q = d - k * 0.11;
    if (q <= 0) continue;
    const p = E.outCubic(clamp(q / 0.85));
    const pad = 8 + 130 * p;
    ctx.globalAlpha = (1 - p) * (k ? 0.55 : 0.95);
    ctx.strokeStyle = k ? PAL.white : PAL.wa;
    ctx.lineWidth = 12 * (1 - p) + 1.5;
    ctx.stroke(ringRect(B, pad));
  }
  ctx.restore();
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash(i, 71) * 0.4;
    const ex = Math.cos(a) * (B.w / 2 + 20), ey = Math.sin(a) * (B.h / 2 + 10);
    const sp = 160 + 220 * hash(i, 72);
    const p = E.outCubic(clamp(d / 0.8));
    const life = 1 - clamp((d - 0.2 - hash(i, 73) * 0.3) / 0.5);
    const sz = (12 + 18 * hash(i, 74)) * (0.3 + 0.7 * life);
    sparkle(ctx, B.x + ex + Math.cos(a) * sp * p, B.y + ey + Math.sin(a) * sp * p * (Math.sin(a) < 0 ? 0.25 : 0.6), sz, // hacia arriba poco: no pisa la URL ni el barco
      { alpha: life, color: i % 3 === 0 ? PAL.goldLight : PAL.white, rot: d * 2 + i });
  }
}
