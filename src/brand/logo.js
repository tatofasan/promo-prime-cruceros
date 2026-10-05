// Logo de Prime Cruceros vectorizado del PNG original (docs/ref/logo-principal.png, 2651×334): cada letra de
// «prime» y «cruceros» es un grupo animable; la «o» de cruceros es el PIN de marca (drawPin de pin.js, calzado
// con el círculo ajustado al original). Los glifos los genera src/scenes/close/_build_logo.py (no a mano).
//
//   drawLogo(ctx, 960, 480, 1300, { variant: 'color', glyph: (i, g) => ({ dy, sx, sy, r, alpha }) })
//   pinPlacement(960, 480, 1300) → { x, y, size } para drawPin (la punta), por si el pin se anima aparte.
import { drawPin, PIN } from './pin.js';
import { PAL } from '../engine/color.js';

/** Medidas del original en px del PNG. baseline = pie de las astas; xTop = alto de x. */
export const LOGO = { w: 2651, h: 334, baseline: 259, xTop: 36 };
/** Colores medidos en el PNG (el cielo del pin es apenas más verde que el del favicon). */
export const LOGO_COLORS = { prime: '#FF3C00', cruceros: '#00A7CE', sky: '#6BC7D6', sea: '#00A7CE' };

let glyphs = null;
/** Glifos con Path2D y pivote (pie, centro) en coordenadas del PNG. word 0 = «prime», 1 = «cruceros». */
export function logoGlyphs() {
  if (glyphs) return glyphs;
  glyphs = GLYPHS.map((g, i) => {
    const [x0, y0, x1, y1] = g.box;
    return {
      ...g, i,
      path: g.d ? new Path2D(g.d) : null,
      px: (x0 + x1) / 2, py: Math.min(y1, LOGO.baseline),
      cx: (x0 + x1) / 2, cy: (y0 + y1) / 2,
    };
  });
  return glyphs;
}
export const PIN_INDEX = 11;

/** Cabeza del pin en px del PNG y escala de drawPin que la calza (k = px del PNG por unidad del PIN). */
export function pinFit() {
  const k = PIN_FIT.r / PIN.headR;
  return { cx: PIN_FIT.cx, cy: PIN_FIT.cy, r: PIN_FIT.r, k, tipX: PIN_FIT.cx, tipY: PIN_FIT.cy + (PIN.tipY - PIN.headCy) * k, size: PIN.h * k };
}

/** Transformación logo → pantalla: el logo de ancho `width` con su caja anclada en (x, y). */
export function logoFrame(x, y, width, anchor = [0.5, 0.5]) {
  const s = width / LOGO.w;
  return { s, ox: x - anchor[0] * LOGO.w * s, oy: y - anchor[1] * LOGO.h * s };
}
/** Punto del PNG → pantalla. */
export const logoPt = (F, px, py) => [F.ox + px * F.s, F.oy + py * F.s];

/** Dónde dibujar el pin (punta y alto para drawPin) para que sea exactamente la «o» del logo. */
export function pinPlacement(x, y, width, anchor) {
  const F = logoFrame(x, y, width, anchor);
  const P = pinFit();
  const [tx, ty] = logoPt(F, P.tipX, P.tipY);
  const [hx, hy] = logoPt(F, P.cx, P.cy);
  return { x: tx, y: ty, size: P.size * F.s, headX: hx, headY: hy, headR: P.r * F.s };
}

/**
 * Dibuja el logo. o = {
 *   anchor [ax, ay] (fracción de la caja 2651×334; def. centro) · alpha
 *   variant 'color' | 'white' · prime, cruceros (colores que pisan los de la variante)
 *   glyph (i, g) => { dx, dy, sx, sy, r, alpha } transformación por letra (pivote en el pie de la letra, px del PNG)
 *   pin false | objeto de opciones extra para drawPin (squash, gloss, sweep, shipDx…) · pinWhite (pin macizo blanco)
 *   paint (ctx, g) => estilo  (relleno propio por letra, p. ej. degradé)
 * }
 */
export function drawLogo(ctx, x, y, width, o = {}) {
  const G = logoGlyphs();
  const F = logoFrame(x, y, width, o.anchor);
  const white = o.variant === 'white';
  const cPrime = o.prime ?? (white ? PAL.white : LOGO_COLORS.prime);
  const cCru = o.cruceros ?? (white ? PAL.white : LOGO_COLORS.cruceros);
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.translate(F.ox, F.oy);
  ctx.scale(F.s, F.s);
  for (const g of G) {
    const m = o.glyph ? o.glyph(g.i, g) : null;
    if (m && m.alpha !== undefined && m.alpha <= 0.002) continue;
    if (g.pin) {
      if (o.pin === false) continue;
      const P = pinFit();
      ctx.save();
      applyGlyph(ctx, g, m);
      const pinWhite = o.pinWhite ?? false;
      drawPin(ctx, P.tipX, P.tipY, P.size, {
        sky: pinWhite ? PAL.white : LOGO_COLORS.sky,
        sea: pinWhite ? PAL.white : LOGO_COLORS.sea,
        ring: pinWhite ? PAL.white : (o.prime ?? LOGO_COLORS.prime),
        ship: PAL.white,
        ...(o.pin || {}),
      });
      ctx.restore();
      continue;
    }
    ctx.save();
    applyGlyph(ctx, g, m);
    ctx.fillStyle = o.paint ? o.paint(ctx, g) : (g.word === 0 ? cPrime : cCru);
    ctx.fill(g.path, 'evenodd');
    ctx.restore();
  }
  ctx.restore();
}

function applyGlyph(ctx, g, m) {
  if (!m) return;
  if (m.alpha !== undefined) ctx.globalAlpha *= m.alpha;
  ctx.translate(g.px + (m.dx ?? 0), g.py + (m.dy ?? 0));
  if (m.r) ctx.rotate(m.r);
  const sx = m.sx ?? m.s ?? 1, sy = m.sy ?? m.s ?? 1;
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  ctx.translate(-g.px, -g.py);
}

/** Silueta de las letras (sin el pin) en coords del PNG: para máscaras, barridos de luz o sombras. */
let lettersPath = null;
export function logoLettersPath() {
  // un solo camino SVG con todos los subcaminos (en @napi-rs/canvas, Path2D.addPath une el último punto con el
  // camino agregado y aparecen hilos entre letras al recortar con evenodd)
  lettersPath ??= new Path2D(logoGlyphs().filter((g) => g.d).map((g) => g.d).join(' '));
  return lettersPath;
}

// <glifos> (generado por src/scenes/close/_build_logo.py, no editar a mano)
const GLYPHS = [{"ch":"p","word":0,"d":"M124.5 260.5l-9 0.7l-10 -0l-7 -0.4l-8 -1.1l-8 -1.7l-8 -2.4l-7 -2.8l-8 -4l-11 -6.8l-11 -8.2l-8 -6.9l-8.4 -8.4l-4.8 -6l-6.2 -9l-6.8 -11l-1.3 -3l-0.5 -42l-0.3 -2l-0.2 -41l20.3 -23l7.2 -7.2l6 -5.2l8 -5.9l14 -8.9l12 -6l12 -4.1l14 -3l12 -1l8 -0l11 1l11 2l10 3l10 4.1l9 4.9l12 8.2l7 5.9l6.2 6.2l8.1 10l7 11l4.1 8l4 10l2.8 10l2.1 11l0.7 9l0 13l-0.7 8l-3 15l-2.9 9l-3.4 8l-4.7 9l-8 12l-4.9 6l-9.4 9.4l-6 5l-10 6.9l-11 5.9l-10 4l-11 3.1ZM1.5 96.1l-0.6 -0.6l-0.4 -21l0.7 -5l1.9 -5l4.2 -6l5.2 -4.3l7 -2.9l4 -0.5l2 0.3l0.3 0.4l-0 19l-13.5 13ZM124 234.5l8.5 -1.8l6 -1.9l7 -3l9 -5l8 -5.9l6 -5.2l7.3 -8.2l3 -4l3.9 -6l4.2 -8l2.8 -7l2.1 -7l1 -5l1.2 -10l-0.2 -14l-1.1 -8l-1.9 -8l-2.8 -8l-2.2 -5l-5.2 -9l-5.8 -8l-4.3 -4.8l-7 -6.6l-5 -3.9l-6 -3.9l-6 -3.2l-7 -3l-10 -3l-12 -1.9l-5 -0.2l-9 0.2l-8 1l-9 2l-6 2.1l-5 2l-9 4.9l-6 4.1l-7 5.8l-6.2 6.4l-6.2 8l-6.9 12l-2.9 7l-2.2 7l-1.9 9l-1 13l1 13l2.9 13l3.1 8l4 8l3.8 6l6.1 8l8.4 8.4l6 4.9l6 4l7 3.9l7 3l10 2.9l6 1.2l8 0.7l10 -0ZM4.5 333.7l-3 0.3l-1.3 -0.5l-0 -131l0.3 -1.1l7.7 13.1l5.1 7l5.9 7l6.6 7l0 75l-0.9 5l-1 3l-2.1 4l-4.5 5l-2.8 2.3l-4 2.1Z","box":[0.2,40.2,219.5,334.0]},{"ch":"r","word":0,"d":"M281.5 258.6l-4 0.4l-1.3 -0.5l0 -158l9.1 -11l11.2 -12.4l9 -9l6 -4.9l11 -7l13 -6.9l13 -6.1l4 -1.4l0.3 0.7l0 26l-0.3 1l-14 8.6l-9 7.3l-5.2 5.1l-7.1 9l-3.2 5l-4.7 9l-3 8l-3 13l-1.1 11l-0 88l-0.5 5l-2 6l-4 6l-2.2 2.2l-6 4ZM277.5 89.5l-1 0.8l-0.3 -0.8l0 -19l1 -5l2.1 -5l3.6 -5l3.6 -3.4l3 -1.9l5 -2.1l4 -0.9l3 -0.2l0.7 0.5l-0 15l-13.9 14Z","box":[276.2,41.8,352.8,259.0]},{"ch":"i","word":0,"d":"M404.5 34.6l-6 0.8l-4 -0.5l-3 -1.1l-3 -2l-3.3 -3.3l-1.9 -3l-1.1 -3l-0.4 -7l1.4 -5l1 -2l3.3 -3.8l2 -1.7l4 -1.9l6 -0.9l5 0.9l3 1.4l2.8 2l3.2 3.4l2.3 4.6l0.7 4l0 3l-0.8 4l-0.9 2l-1.9 3l-2.4 2.6l-2 1.7ZM391.5 258.6l-5 0.4l-0.5 -0.5l0.2 -189l1.1 -5l1.8 -4l1.9 -3l3.7 -4l2.8 -2.3l4 -2.1l7 -1.9l3 -0.2l0.5 0.5l-0.2 189l-1.9 7l-2.1 4l-3.2 4l-5.1 4l-5 2.4Z","box":[381.8,0.2,416.5,259.0]},{"ch":"m","word":0,"d":"M821.5 258.5l-5 0.5l-0.7 -0.5l0 -114l-1 -12l-2.9 -14l-2.3 -7l-2.9 -7l-4.9 -9l-4 -6l-4 -5l-7.3 -7.4l-6 -4.7l-7 -4.2l-11 -4.1l-4 -0.9l-6 -0.7l-8 0l-5 0.5l-9 2.3l-5 1.9l-6 3l-10 7.1l-6.2 6.2l-4.1 5l-4.1 6l-3.9 7l-5 12l-3.1 11l-1.9 11l-0.4 6l0 92l-1 7l-1.1 3l-2.8 5l-4.4 4.6l-2 1.6l-4 2.2l-6 1.9l-4 0.2l-0.7 -0.5l0 -111l-1 -14l-1 -6l-3 -12l-2.2 -6l-5.7 -12l-5.1 -8l-6.7 -8l-4.6 -4.4l-5 -3.9l-3 -2l-8 -4.1l-8 -2.8l-10 -1.8l-8 0l-6 0.7l-8 2.1l-9 3.9l-8 5l-7.4 6.3l-6.9 8l-6 9l-3 6l-3 7l-3.1 10l-1.9 9l-1 8l-0.2 97l-0.5 4l-1.6 5l-2.1 4l-5.6 6l-3.7 2.5l-4 1.8l-4 1l-4 0.2l-0.5 -0.5l0 -143l0.1 -1l5.2 -12l8 -15l5.9 -9l9.8 -12l8.9 -9l9.6 -7.3l9 -5.1l9 -3.8l11 -3.1l6 -1l9 -0.7l13 0.8l13 2.9l8 2.9l7 3.4l12 7.7l7 5.9l4.4 4.4l9.8 12l7.8 11.3l13.7 -18.3l4.3 -4.8l9 -8.6l10 -7.1l7 -3.8l7 -3.1l5 -1.8l8 -2.1l6 -1l12 -0.7l9 0.7l7 1.2l10 2.8l7 2.9l8 4.1l5 3.2l10 7.9l6.2 6.2l8 10l6.3 10l5.8 12l4 11l3 12l2 13l0.7 9l0 93l-0.6 4l-1.4 4l-2.7 5l-1.7 2l-3.6 3.4l-3 1.9l-4 1.9ZM494.5 95.6l-0.5 -1.1l0 -24l1.3 -6l1.8 -4l3.4 -4.8l5 -4.5l6 -2.9l5 -1.1l3 -0.2l0.5 0.5l0 14l-0.5 1Z","box":[494.0,36.5,841.5,259.0]},{"ch":"e","word":0,"d":"M1013.5 257.5l-6 0.5l-16 -0.2l-8 -1l-13 -3l-9 -3l-9 -4l-12 -7l-8 -6l-12.2 -11.3l-9.1 -11l-6 -9l-5.1 -10l-4 -10l-2.8 -10l-2.1 -11l-1 -12l-0 -7l1 -11l2 -11l3.9 -13l3.4 -8l4.6 -9l7.1 -11l7.3 -8.6l10 -9.8l6 -4.8l9 -6.2l9 -4.9l12 -5l10 -2.8l12 -2.2l12 -0.7l14 0.7l12 2l14 4.1l9 3.9l11 6l10 7.1l12.3 10.2l-0.1 1l-109.2 149.5l-2 -0.3l-11 -7l-8.2 -7.2l0.3 -1l94.2 -129l0.3 -1l-1.6 -1.4l-5 -2.8l-10 -4l-7 -2.1l-10 -1.9l-11 -0.8l-9 0.5l-8 1.2l-8 1.9l-8 3l-10 5.1l-6 3.9l-8 6.6l-8.5 8.8l-4 5l-4.9 8l-4.8 10l-2.1 6l-2 8l-1 5l-1 10l-0 6l1 10l2.1 10l3 9l3.8 8l4.1 7l7.9 10l9.4 9.2l7 5.3l8 4.8l6 2.9l8 3.1l8 2l7 1l18 0l11 -1.9l8 -2.3l7 -2.8l6 -3l9 -5.9l6.6 -5.4l7.4 -7.4l11 -13.9l1 -0.1l1.6 1.4l3.9 5l1.9 4l0.9 3l0.7 5l-0.5 6l-1.2 4l-2 4l-4.3 5.2l-7 6.2l-9 6.9l-10 6l-6 3l-10 4l-7 2Z","box":[890.2,34.5,1085.5,258.0]},{"ch":"c","word":1,"d":"M1243.5 250.5l-9 0.7l-15 -0.4l-12 -2l-8 -2.1l-11 -3.9l-9 -4.3l-11 -6.7l-8 -6.1l-14.2 -14.2l-6.9 -9l-6.2 -10l-6 -13l-3 -9l-3 -14l-1 -8l-0.2 -15l0.5 -6l1.7 -11l3.1 -12l3.8 -10l5 -10l5 -8l5.2 -7l9 -10l9.2 -8.2l7 -5.2l8 -4.9l10 -5l8 -3.1l10 -2.8l12 -2.1l6 -0.4l19 0.4l12 2l11 3l10 3.9l10 5.1l12 8l10.9 8.3l0.6 1l-9.5 12l-4 2.4l-3 0.6l-3 0l-3 -0.6l-2 -1l-11 -7.7l-8 -4.1l-10 -3.8l-8 -2.1l-6 -1l-6 -0.4l-13 0.2l-8 1.2l-9 2.2l-12 4.8l-5 2.8l-5 3.2l-9 7.1l-7.1 7.2l-7 9l-4.2 7l-5 11l-2 6l-2 9l-1.2 11l0.2 11l1 8l2 9l2 6l5 11l3 5l5 7l5.1 6l10.2 9.4l4 2.9l8 4.7l12 5.2l12 3.1l9 1.2l9 0.2l6 -0.4l7 -1l11 -2.9l8 -3.2l12 -6.9l9 -7.1l4.4 -4.2l14.6 -17.5l10.8 8.5l2.5 3l1 2l1 5l-0.8 4l-1.3 3l-6.8 8l-6.4 6.4l-8 6.8l-12 8.1l-10 5.1l-5 2l-12 3.9Z","box":[1120.0,27.8,1320.8,251.2]},{"ch":"r","word":1,"d":"M1369.5 251.8l-5 0.4l-0.5 -0.7l0 -158l17.5 -20.4l15 -14.7l14 -9.2l15 -7.9l14 -6.4l1 0.6l-0.2 27l-9.8 5.9l-7 4.8l-5 4.1l-6.3 6.2l-5.1 6l-4.8 7l-5.2 10l-2.7 7l-3.1 12l-1.3 11l-0.3 93l-1.8 7l-2.1 4l-2.3 2.8l-3.2 3.2l-2.8 2l-5 2.4ZM1364.5 83.5l-0.5 -1l0.2 -21l1 -4l3 -6l4.6 -5l4.7 -3.3l5 -2.1l5 -0.9l2 0.2l0.3 1.1l0 14l-0.3 0.7l-15.2 15.3Z","box":[1364.0,34.9,1440.5,252.2]},{"ch":"u","word":1,"d":"M1577.5 251.5l-5 0.5l-13 -0.2l-12 -2l-7 -2l-8 -3.1l-11 -5.9l-7 -4.9l-5 -4.2l-8.1 -8.2l-9 -12l-4.2 -7l-3 -6l-4.8 -12l-2.3 -8l-2.9 -15l-1 -9l-0 -111l0.3 -1.1l2 -0.2l5 0.9l5 2.1l4 2.7l5.3 5.6l2.1 4l1.8 6l0.5 90l1 9l2 10l3 9l3 7l5 9l6.1 8l5.2 5.4l6 5l6 3.9l8 3.9l6 2.1l10 2l10 0.2l8 -1.1l10 -3l5 -2.2l5 -2.8l7 -5l7 -6.6l6.3 -7.8l4.9 -8l4.2 -9l3 -9l1.9 -9l1 -8l0.6 -114l2.1 -0.3l5 0.9l5 2.1l3 1.8l4 3.7l2.3 2.8l1.7 3l1.3 3l1.2 6l0 89l-1.3 12l-1.9 10l-1.9 7l-3.1 9l-5.1 11l-6.8 11l-7 9l-10.4 10.2l-10 7.3l-11 5.8l-11 4l-8 1.9Z","box":[1474.2,40.2,1661.0,252.0]},{"ch":"c","word":1,"d":"M1833.5 250.5l-9 0.7l-12 -0.2l-10 -1.2l-9 -2l-13 -4.2l-7 -3.1l-12 -6.7l-7 -5l-6.4 -5.3l-10 -10l-5 -6l-6.9 -10l-5.9 -11l-4.1 -10l-2.9 -10l-2.3 -12l-1 -12l0.2 -11l1 -9l2 -10l2.9 -10l4 -10l4.1 -8l7.1 -11l8.4 -10l10.8 -10.4l9 -6.9l8 -5l10 -5l8 -3l11 -3.1l11 -1.9l6 -0.4l19 0.4l12 2l14 4l10 4.3l12 6.7l15 11l3 2.3l0.5 1l-9.5 12.2l-4 2.2l-3 0.6l-3 0l-3 -0.7l-2 -1l-11 -7.7l-10 -5l-8 -2.8l-8 -2.1l-8 -1.2l-13 -0.2l-6 0.4l-14 2.9l-11 4.2l-7 3.7l-9 6.2l-6 5.1l-5.1 5.2l-7.2 9l-6 10l-3.9 9l-2.2 7l-1.8 8l-1.1 8l-0.2 5l0.2 8l1.1 9l2 9l2 6l5 11l4.9 8l3.9 5l7.4 8.2l7 6.1l11 7.1l11 5l14 3.9l9 1.2l9 0.2l6 -0.4l7 -1l8 -2l6 -2l9 -4.1l8 -4.9l8 -6.1l7.4 -7.2l12.6 -15.5l9.7 7.5l3.7 4l1.8 5l0.1 3l-1 4l-1 2l-4.9 6l-5.8 6l-10.6 9.3l-12 8l-14 6.8l-13 4.2Z","box":[1710.0,27.8,1910.8,251.2]},{"ch":"e","word":1,"d":"M2061.5 250.5l-10 0.7l-14 -0.4l-12 -2l-8 -2l-9 -3l-11 -5.1l-8 -4.7l-10 -7.3l-5.8 -5.2l-10.6 -11l-6.9 -9l-4.9 -8l-6.1 -13l-2.8 -8l-3.2 -13l-1 -7l-0.7 -10l0.7 -16l1 -7l2.9 -12l3.1 -9l5 -11l4 -7l6.1 -9l7.2 -8.4l8 -7.8l9 -7.2l9 -5.9l12 -6.1l8 -3l11 -3l11 -1.9l18 -0.4l7 0.4l12 2l14 4.1l11 4.8l9 5.1l9 6.2l13.4 11.1l0.1 1l-2.2 3l-107.3 146.7l-2 -0.5l-5 -2.9l-7 -5l-6.2 -5.3l-0.8 -1l0.4 -1l89.9 -123l4.7 -7l-7 -4.2l-10 -4l-7 -2.1l-11 -2l-5 -0.4l-15 0.4l-11 2l-7 2.1l-13 5.9l-9 5.9l-8 6.8l-6.4 6.6l-6.1 8l-3.7 6l-5.1 11l-4 14l-1 6l-0.7 9l0.7 13l1 6l1.9 8l2.1 6l4.1 9l2.9 5l4.9 7l5.1 6l5.3 5.4l7 5.8l6 4.1l7 4l7 3.1l8 2.8l12 2.1l17 0.2l13 -2.2l7 -2l8 -3.3l9 -4.9l7 -4.9l10.2 -9.2l6.1 -7l6.7 -8.8l1 -0.7l4.4 4.5l1.9 3l2 5l1 5l0 3l-1 6l-1.1 3l-3 5l-4.2 4.4l-8 6.9l-7 5.2l-6 3.8l-9 4.7l-8 3.4l-6 2l-7 1.8Z","box":[1937.5,27.8,2132.8,251.2]},{"ch":"r","word":1,"d":"M2187.5 251.7l-5 0.5l-0.7 -0.7l0.1 -158l14.2 -17l14.6 -15l3.8 -3.4l7 -4.9l12 -6.9l16 -8l8 -3.5l0.7 0.7l-0.1 27l-15.6 9.7l-8 6.7l-6.4 6.6l-6.9 9l-2.9 5l-4 8l-2.2 6l-2.9 11l-1.4 12l-0.3 9l0 83l-0.6 4l-1.4 4l-2.7 5l-4.3 4.6l-4 2.8ZM2182.5 83.1l-0.6 -0.6l-0 -20l1.4 -6l2 -4l3 -4l5.2 -4.3l4 -2.1l3 -1l5 -0.9l1.7 0.3l0.3 1l0 14l-0.5 1l-13.1 13Z","box":[2181.8,34.8,2258.2,252.2]},{"ch":"o","word":1,"pin":true,"box":[2269,29,2492,293]},{"ch":"s","word":1,"d":"M2589.5 251.5l-6 0.5l-12 -0.2l-13 -2.1l-7 -1.8l-15 -5.2l-13 -5.9l-1.6 -1.3l6.2 -14l3.4 -3.1l2 -1.1l4 -1.1l4 0.3l17 6.4l7 1.9l6 1l5 0.4l10 -0.4l5 -1l6 -2l4 -2l6 -3.9l6 -5.6l3.2 -3.8l3.1 -5l3.1 -7l1.9 -9l-0 -7l-0.9 -5l-2 -6l-2.1 -4l-6.1 -8l-8.2 -6.5l-7 -3.6l-8 -3l-16 -3.6l-6 -2l-8 -3.3l-12 -6.7l-8.8 -7.3l-7.7 -9l-4.9 -9l-3.1 -9l-1 -5l-0.2 -11l1.3 -8l2.3 -7l2.8 -6l6.1 -9l5.2 -5.4l6 -4.8l5 -3.2l6 -3l7 -2.8l8 -2.1l12 -1.4l15 0.4l11 1.9l8 2.1l10 3.1l7 2.8l11 4.8l1 0.6l-0.2 1l-5.4 13l-2.6 3l-1.8 1.4l-2 0.9l-3 0.7l-3 0l-3 -0.6l-6 -2.8l-9 -3l-15 -2.9l-14 -0l-10 2.1l-7 3l-5 3.2l-3.6 3l-2.6 3l-3.1 5l-2 5l-0.4 3l0 6l1.4 6l3.2 6l3.1 3.8l6 5.5l3 2l6 3.2l7 2.9l6 1.8l16 3.5l10 3.9l11 6l9 7.1l4.2 4.3l4 5l2.1 3l3.9 7l2.1 5l2.1 7l1.9 14l-1.1 13l-1.9 8l-2.1 6l-5.7 11l-4.2 6l-3.3 3.8l-9 8.3l-10 6.4l-6 2.9l-5 1.8l-8 2.1Z","box":[2521.9,24.8,2650.8,252.0]}];
const PIN_FIT = {"cx": 2380.57, "cy": 140.78, "r": 110.9, "tipY": 292.12};
// </glifos>
