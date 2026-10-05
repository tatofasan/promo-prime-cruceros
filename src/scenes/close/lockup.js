// Lockup de marca del cierre (variante 'plate', decisión de post): logo a color (prime #FF3D00, cruceros #00A7CE,
// fiel a docs/ref/logo-principal.png) sobre una placa blanca COMPACTA con filo de vía aérea coral/cian.
//  - La placa NACE DEL PIN: aparece detrás de él cuando aterriza y se estira en horizontal anclada a la «o».
//  - Las letras hacen pop en cascada desde el pin hacia afuera («s» a la derecha; «r e c u r c e m i r p» a la
//    izquierda), cada una ya en su lugar final: pop de escala UNIFORME 0 → 1,07 → 1 con opacidad plena y pivote
//    en el medio del alto de x (sin estirar en Y: nunca cambia de lectura). La última asienta en 26,69: el
//    barrido de close.word cae sobre el logo completo.
//  - Barridos de luz (close.word y 29,06) que avivan los colores (overlay) sin lavarlos, destellos y la URL
//    tipeada AFUERA, debajo de la placa, en blanco con sombra navy suave.
import { E, clamp, prog, lerp } from '../../engine/ease.js';
import { PAL, rgba } from '../../engine/color.js';
import { rrectPath, texture, lin, rad, sparkle, bake } from '../../engine/draw.js';
import { makeCanvas } from '../../engine/env.js';
import { drawText, txt } from '../../engine/text.js';
import { hash } from '../../engine/noise.js';
import { drawLogo, logoGlyphs, logoLettersPath, LOGO, PIN_INDEX } from '../../brand/logo.js';
import { T_LAND, T_PLATE, T_WORD, T_URL, T_CTA, T_FIN, T_SWEEP2, BEAT } from './layout.js';
import { textSprite, drawTextSprite } from './text-sprite.js';

const URL_TXT = 'primecruceros.com.ar';
const URL_LOOK = { fill: PAL.white, shadow: { color: 'rgba(6,14,40,0.8)', blur: 12, y: 3 } };

// ------------------------------------------------------------------ cascada de letras
const STEP = 0.026;  // 1,56 cuadros entre letras vecinas
const DUR = 0.125;   // pop de cada letra (7,5 cuadros)
const T0 = T_PLATE + 0.005;
/** Escalón de la cascada: 0 para las vecinas del pin («r» y «s»), 10 para la «p». */
const rankOf = (i) => Math.abs(i - PIN_INDEX) - 1;
export const letterStart = (i) => T0 + rankOf(i) * STEP;
export const LOGO_DONE = T0 + 10 * STEP + DUR; // 26,69

// Pop de cada letra: escala UNIFORME con opacidad plena (nada de fundido: el color de marca es pleno desde el
// primer cuadro), 0 → 1,07 → 0,985 → 1, con pivote en el medio del alto de x. El pico está acotado (≤ 1,12) y no
// hay estiramiento solo en Y: una «c» que pasa de 1,1× el alto de x se lee «C» (QA ronda 2: «eCruceros»).
const POP_PEAK = 1.07;
const X_MID = (LOGO.xTop + LOGO.baseline) / 2; // medio del alto de x (px del PNG)
export const letterScale = (u) => (u < 0.45 ? POP_PEAK * E.outCubic(u / 0.45)
  : u < 0.75 ? lerp(POP_PEAK, 0.985, E.inOutSine((u - 0.45) / 0.3))
    : lerp(0.985, 1, E.inOutSine((u - 0.75) / 0.25)));

/** Transformación de la letra i: pop de escala uniforme, pivote en (centro de la letra, medio del alto de x). */
export function letterAnim(t) {
  return (i, g) => {
    if (g.pin) return null;
    const u = (t - letterStart(i)) / DUR;
    if (u <= 0) return { alpha: 0 };
    if (u >= 1) return null;
    const s = letterScale(u);
    // applyGlyph escala con pivote en el pie (g.py): dy lo corre al medio del alto de x
    return { sx: s, sy: s, dy: (X_MID - g.py) * (1 - s) };
  };
}

// ------------------------------------------------------------------ placa
const SHADOW = { color: 'rgba(22,12,52,0.46)', blur: 44, x: -16, y: 26 };
const CONTACT = { color: 'rgba(22,12,52,0.28)', blur: 10, x: -3, y: 7 };
const LIP = 7; // canto de la tarjeta

/** Rectángulo de la placa en t (nace del pin y se estira anclada a la «o»). null = todavía no existe. */
export function plateRect(t, G) {
  const P = G.plate, px = G.pin.headX, py = G.pin.headY;
  if (t < T_LAND - 0.002) return null;
  // semilla: disco blanco concéntrico con la cabeza del pin que se infla con el impacto…
  const seed = E.backOut(2.2)(prog(t, T_LAND - 0.002, T_LAND + 0.045));
  const d0 = G.pin.headR * 2.5 * seed;
  // …y se estira: primero en alto (hasta 250) y en horizontal hacia los dos lados, anclado a la «o»
  const eh = E.backOut(1.5)(prog(t, T_PLATE - 0.005, T_PLATE + 0.1));
  const ew = E.backOut(1.3)(prog(t, T_PLATE, T_PLATE + 0.15));
  const L = P.x - P.w / 2, R = P.x + P.w / 2;
  const x0 = px - d0 / 2 - (px - d0 / 2 - L) * ew;
  const x1 = px + d0 / 2 + (R - px - d0 / 2) * ew;
  const h = Math.max(1, lerp(d0, P.h, eh));
  const cy = lerp(py, P.y, clamp(eh));
  return { x: x0, y: cy - h / 2, w: Math.max(1, x1 - x0), h, r: Math.min(lerp(h / 2, P.r, clamp(ew)), h / 2) };
}
const PLATE_STILL = T_PLATE + 0.15; // desde acá la placa está quieta: se dibuja la caché

let plateCache = null;
function plateSprites(G) {
  if (plateCache) return plateCache;
  const P = G.plate;
  const pad = 110;
  const R = { x: P.x - P.w / 2, y: P.y - P.h / 2, w: P.w, h: P.h, r: P.r };
  const w = Math.ceil(P.w + pad * 2), h = Math.ceil(P.h + pad * 2);
  const ox = R.x - pad, oy = R.y - pad;
  const base = makeCanvas(w, h), b = base.getContext('2d');
  b.translate(-ox, -oy);
  paintPlate(b, R, 1);
  const border = makeCanvas(w, h), d = border.getContext('2d');
  d.translate(-ox, -oy);
  paintAirmail(d, R);
  plateCache = { base: bake(base), border: bake(border), ox, oy, R };
  return plateCache;
}

/** Placa completa: sombra larga y de contacto, canto, cara blanca con rebote cálido y grano. */
function paintPlate(c, R, k = 1) {
  const face = rrectPath(R.x, R.y, R.w, R.h, R.r);
  const lip = rrectPath(R.x, R.y + LIP, R.w, R.h, R.r);
  for (const S of [SHADOW, CONTACT]) {
    c.save();
    c.shadowColor = S.color;
    c.shadowBlur = S.blur * k;
    c.shadowOffsetX = S.x * k;
    c.shadowOffsetY = S.y * k;
    c.fillStyle = '#C3D2E0';
    c.fill(lip);
    c.restore();
  }
  c.fillStyle = lin(c, 0, R.y, 0, R.y + R.h + LIP, [[0, '#D8E3EE'], [1, '#B4C5D6']]);
  c.fill(lip);
  c.fillStyle = lin(c, 0, R.y, 0, R.y + R.h, [[0, '#FFFFFF'], [0.62, '#FDFEFF'], [1, '#EEF3F8']]);
  c.fill(face);
  // rebote cálido del sol (a la derecha) y filo de luz arriba a la derecha
  c.save();
  c.clip(face);
  c.fillStyle = rad(c, R.x + R.w, R.y + R.h * 0.7, R.w * 0.45, [[0, 'rgba(255,214,160,0.16)'], [1, 'rgba(255,214,160,0)']]);
  c.fillRect(R.x, R.y, R.w, R.h);
  c.restore();
  if (k === 1) texture(c, face, { alpha: 0.05, blend: 'multiply' });
  c.save();
  c.strokeStyle = lin(c, R.x, 0, R.x + R.w, 0, [[0, 'rgba(255,233,184,0)'], [0.55, 'rgba(255,233,184,0)'], [1, 'rgba(255,210,122,0.9)']]);
  c.lineWidth = 2.5;
  c.stroke(rrectPath(R.x + 1.25, R.y + 1.25, R.w - 2.5, R.h - 2.5, R.r - 1));
  c.restore();
}

/** Filo de vía aérea: banda fina de rayas diagonales coral / blanco / cian / blanco, adentro del borde. */
function paintAirmail(c, R) {
  const inset = 12, bw = 8;
  const outer = rrectPath(R.x + inset, R.y + inset, R.w - inset * 2, R.h - inset * 2, R.r - inset * 0.55);
  const inner = rrectPath(R.x + inset + bw, R.y + inset + bw, R.w - (inset + bw) * 2, R.h - (inset + bw) * 2, R.r - (inset + bw) * 0.55);
  // (sin Path2D.addPath, que en @napi-rs une los subcaminos): rayas recortadas al borde de afuera y el de
  // adentro borrado con destination-out (lienzo propio de init)
  c.save();
  c.clip(outer);
  const per = 52, sk = R.h + 40;
  const cols = [[PAL.coral, 0, 15], [PAL.brandCyan, 26, 15]];
  for (let x = R.x - sk - per; x < R.x + R.w + per; x += per) {
    for (const [col, off, wd] of cols) {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(x + off, R.y + R.h + 20);
      c.lineTo(x + off + sk, R.y - 20);
      c.lineTo(x + off + sk + wd, R.y - 20);
      c.lineTo(x + off + wd, R.y + R.h + 20);
      c.closePath();
      c.fill();
    }
  }
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = '#000';
  c.fill(inner);
  c.restore();
}

function drawPlate(ctx, t, G) {
  const R = plateRect(t, G);
  if (!R) return;
  const S = plateSprites(G);
  if (t >= PLATE_STILL) {
    ctx.drawImage(S.base, S.ox, S.oy);
  } else {
    // en vivo mientras se estira (sombra más corta: la tarjeta todavía «sube»)
    paintPlate(ctx, R, 0.4 + 0.6 * prog(t, T_PLATE, PLATE_STILL));
  }
  // el filo de vía aérea se dibuja de izquierda a derecha... desde el pin hacia afuera, al terminar de estirarse
  const ba = E.outCubic(prog(t, T_PLATE + 0.1, T_PLATE + 0.3));
  if (ba > 0.001) {
    ctx.save();
    if (ba < 1) {
      const px = G.pin.headX, span = Math.max(px - S.R.x, S.R.x + S.R.w - px) + 40;
      const r = span * ba;
      ctx.beginPath();
      ctx.rect(px - r, S.oy, r * 2, 1e4);
      ctx.clip();
    }
    ctx.drawImage(S.border, S.ox, S.oy);
    ctx.restore();
  }
}

// ------------------------------------------------------------------ barridos y destellos
/** Barrido de luz sobre placa + logo: aviva los colores de las letras (overlay) y deja dos brillos en los cantos. */
function sweep(ctx, t, G, t0, amt = 1) {
  const p = prog(t, t0, t0 + 0.5);
  if (p <= 0 || p >= 1) return;
  const P = G.plate;
  const L = P.x - P.w / 2 - 260, R = P.x + P.w / 2 + 260;
  const bx = lerp(L, R, E.inOutSine(p));
  const ang = 0.36, bw = 150;
  const env = Math.sin(Math.PI * clamp(p * 1.15)) * amt;
  // 1) letras: overlay blanco (naranja → naranja vivo, cian → cian claro; no se lavan)
  ctx.save();
  ctx.translate(G.F.ox, G.F.oy);
  ctx.scale(G.F.s, G.F.s);
  ctx.clip(logoLettersPath(), 'evenodd');
  ctx.scale(1 / G.F.s, 1 / G.F.s); // de vuelta a pantalla (el recorte queda)
  ctx.translate(-G.F.ox, -G.F.oy);
  ctx.translate(bx, P.y);
  ctx.rotate(ang);
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = lin(ctx, -bw, 0, bw, 0, [[0, 'rgba(255,255,255,0)'], [0.5, rgba('#ffffff', 0.95 * env)], [1, 'rgba(255,255,255,0)']]);
  ctx.fillRect(-bw, -400, bw * 2, 800);
  ctx.restore();
  // 2) cara de la placa: reflejo frío muy suave con núcleo blanco (se lee como brillo de tarjeta satinada)
  ctx.save();
  ctx.clip(rrectPath(P.x - P.w / 2, P.y - P.h / 2, P.w, P.h, P.r));
  ctx.translate(bx, P.y);
  ctx.rotate(ang);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = lin(ctx, -bw * 1.4, 0, bw * 1.4, 0, [[0, 'rgba(214,230,244,0)'], [0.3, rgba('#D6E6F4', 0.55 * env)], [0.5, 'rgba(255,255,255,0)'], [0.7, rgba('#D6E6F4', 0.55 * env)], [1, 'rgba(214,230,244,0)']]);
  ctx.fillRect(-bw * 1.4, -400, bw * 2.8, 800);
  ctx.restore();
  // 3) brillos donde la banda corta los cantos de arriba y de abajo
  const tanA = Math.tan(ang);
  for (const [y, k] of [[P.y - P.h / 2 + 2, 1], [P.y + P.h / 2 - 2, 0.75]]) {
    const x = bx - (y - P.y) * tanA;
    if (x < P.x - P.w / 2 + P.r || x > P.x + P.w / 2 - P.r) continue;
    sparkle(ctx, x, y, 34 * env * k, { alpha: env, color: PAL.goldPale, rot: p * 2, halo: 0.9 });
  }
}

// destellitos sobre los bordes altos de las letras, uno por corchea (más grande en el beat)
function twinkles(ctx, t, G) {
  if (t < T_WORD + 0.25) return;
  const gl = logoGlyphs().filter((g) => !g.pin && g.ch !== 'i'); // nunca sobre el punto de la «i»
  const step = BEAT / 2;
  const k0 = Math.floor((t - T_WORD) / step);
  for (let k = k0 - 2; k <= k0; k++) {
    const d = t - (T_WORD + k * step);
    if (d < 0 || d > 0.4) continue;
    const g = gl[Math.floor(hash(k, 17) * gl.length)];
    const [x0, y0, x1] = g.box;
    const px = G.F.ox + lerp(x0, x1, 0.2 + 0.6 * hash(k, 18)) * G.F.s, py = G.F.oy + (y0 + 10) * G.F.s;
    const life = Math.sin((d / 0.4) * Math.PI);
    sparkle(ctx, px, py, (k % 2 ? 13 : 19) * life, { alpha: life, color: '#ffffff', rot: d * 2 });
  }
}

// ------------------------------------------------------------------ URL
function urlText(G) { return txt(URL_TXT, { size: G.url.size, weight: 600, tracking: 0.035 }); }

function drawUrl(ctx, t, G) {
  const U = G.url;
  const T = urlText(G);
  const st = 0.0175;
  // velo navy blando detrás de la URL (le da ≥ 4,5:1 sobre el cielo rosado): crece mientras se tipea
  const va = 0.72 * E.outCubic(prog(t, T_URL - 0.08, T_URL + 0.3));
  if (va > 0.005) {
    ctx.save();
    ctx.translate(U.x, U.y + 2);
    ctx.scale(1, 0.13);
    const Rv = T.width * 0.74;
    ctx.fillStyle = rad(ctx, 0, 0, Rv, [[0, rgba(PAL.navy900, va)], [0.6, rgba(PAL.navy900, va * 0.7)], [1, rgba(PAL.navy900, 0)]]);
    ctx.fillRect(-Rv, -Rv, Rv * 2, Rv * 2);
    ctx.restore();
  }
  if (t < T_URL + 0.8) {
    drawText(ctx, T, { t, x: U.x, y: U.y, anchor: [0.5, 0.5], in: T_URL, anim: 'type', by: 'char', stagger: st, ...URL_LOOK });
  } else {
    drawTextSprite(ctx, textSprite(T, URL_LOOK), U.x, U.y, [0.5, 0.5]); // ya tipeada: pre-pintada
  }
  const n = [...URL_TXT].length;
  const done = T_URL + n * st;
  // subrayado cian que crece desde el centro cuando termina de tipear
  const up = E.outExpo(prog(t, done + 0.02, done + 0.4));
  if (up > 0) {
    const w = (T.width + 24) * up;
    ctx.save();
    ctx.fillStyle = lin(ctx, U.x - w / 2, 0, U.x + w / 2, 0, [[0, rgba(PAL.aqua300, 0)], [0.2, PAL.aqua300], [0.8, PAL.aqua300], [1, rgba(PAL.aqua300, 0)]]);
    ctx.fill(rrectPath(U.x - w / 2, U.y + T.capH * 0.82, w, 4, 2));
    ctx.restore();
  }
  // cursor que parpadea mientras se tipea y un rato después
  const typed = clamp(Math.floor((t - T_URL) / st) + 1, 0, n);
  if (t >= T_URL - 0.1 && t < T_CTA + 0.55) {
    const blink = t < done + 0.05 ? 1 : (Math.floor((t - T_URL) / 0.2) % 2 ? 0.15 : 1);
    const gl = T.lines[0].glyphs;
    const last = typed > 0 ? gl[typed - 1] : null;
    const cx = U.x - T.width / 2 + (last ? last.x + last.w + U.size * 0.08 : 0);
    const fade = 1 - clamp((t - T_CTA - 0.3) / 0.25);
    ctx.save();
    ctx.globalAlpha *= blink * fade;
    ctx.fillStyle = PAL.aqua200;
    ctx.fillRect(cx, U.y - T.capH * 0.75, 4, T.capH * 1.5);
    ctx.restore();
  }
}

export function initLockup(G) {
  plateSprites(G);
  textSprite(urlText(G), URL_LOOK);
}

/** Placa + letras + barridos + URL (el pin va aparte, en over(); el anillo de luz, entre la placa y las letras). */
export function drawLockup(ctx, t, G, between) {
  drawPlate(ctx, t, G);
  if (between) between(ctx);
  if (t >= T0) drawLogo(ctx, G.x, G.y, G.w, { variant: 'color', pin: false, glyph: t < LOGO_DONE + 0.01 ? letterAnim(t) : undefined });
  sweep(ctx, t, G, T_WORD - 0.16);
  sweep(ctx, t, G, T_SWEEP2 - 0.16, 0.9);
  twinkles(ctx, t, G);
  drawUrl(ctx, t, G);
}

