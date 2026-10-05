// Tipografía cinética. Dos pasos:
//   1) txt(str, opts)  → texto MEDIDO (cacheado): líneas, glifos con su x (respeta el kerning), ancho, alto.
//   2) drawText(ctx, T, o) → lo dibuja en t con animación de entrada/salida por letra, palabra o línea.
//
// Ejemplo:
//   const T = txt('EXPERIENCIAS ÚNICAS', { size: 150, weight: 900, tracking: -0.02 });
//   drawText(ctx, T, { t, x: 960, y: 300, anchor: [0.5, 0.5], in: cue('exp.pool') - 0.1, anim: 'slam', by: 'word',
//                      stagger: 0.117, fill: '#fff', extrude: { depth: 10, color: '#0A2340' }, out: 7.0, outAnim: 'rise' });
//
// Animaciones de entrada (anim):
//   'rise'    sube desde abajo de una máscara por línea (clásico motion). Llega a ~dur·0.6.
//   'slam'    entra grande (×2,3) y golpea en in+0,10 s con aplastamiento y rebote. USAR in = cue − 0,10.
//   'pop'     escala 0 → overshoot → 1 (pico en in + 0,4·dur).
//   'drop'    cae desde arriba con resorte y aplastamiento al tocar.
//   'stretch' se estira en X con rebote elástico.
//   'type'    aparece de golpe letra por letra (máquina de escribir) con micro-pop.
//   'focus'   de desenfocado y grande a nítido.
//   'fade'    aparece subiendo apenas.  'none' ya está.
// Salidas (outAnim): 'rise' (se va hacia arriba por la máscara) · 'fall' · 'pop' (anticipa y se encoge) ·
//   'fade' · 'wipe' (se borra de izquierda a derecha) · 'none'.
// Escalonado: by 'char' | 'word' | 'line', stagger (s), from 'start' | 'center' | 'end' | 'random'.
import { makeCanvas } from './env.js';
import { E, clamp, spring, pop, TAU } from './ease.js';
import { layer } from './layer.js';
import { hash } from './noise.js';

export const FAMILY = 'Outfit';
export const fontStr = (weight, size, family = FAMILY) => `${weight} ${size}px ${family}`;

let mctx = null;
const meas = () => (mctx ??= makeCanvas(16, 16).getContext('2d'));

const cache = new Map();
/** Texto medido y cacheado. opts: size, weight, family, tracking (em), lineHeight (× size), align, maxWidth, upper. */
export function txt(str, opts = {}) {
  const key = str + '\u0000' + JSON.stringify(opts);
  let T = cache.get(key);
  if (!T) { T = layout(str, opts); cache.set(key, T); }
  return T;
}

export function layout(str, o = {}) {
  const size = o.size ?? 100, weight = o.weight ?? 800, family = o.family ?? FAMILY;
  const tracking = (o.tracking ?? 0) * size;
  // espacio extra entre palabras: con tracking abierto el espacio de Outfit (0,18 em) se pierde
  const wordSp = (o.wordSpacing ?? ((o.tracking ?? 0) > 0.04 ? (o.tracking ?? 0) * 1.5 : 0)) * size;
  const lh = (o.lineHeight ?? 1.05) * size;
  const align = o.align ?? 'left';
  const text = o.upper ? str.toUpperCase() : str;
  const m = meas();
  m.font = fontStr(weight, size, family);
  const spaces = (s) => (s.match(/ /g) || []).length;
  const widthOf = (s) => m.measureText(s).width + tracking * Math.max(0, [...s].length - 1) + wordSp * spaces(s);

  const lines = [];
  for (const raw of text.split('\n')) {
    let cur = '';
    for (const w of raw.split(' ')) {
      const test = cur ? cur + ' ' + w : w;
      if (cur && o.maxWidth && widthOf(test) > o.maxWidth) { lines.push(cur); cur = w; } else cur = test;
    }
    lines.push(cur);
  }
  const capH = m.measureText('H').actualBoundingBoxAscent;
  let word = 0, char = 0;
  const L = lines.map((ln, li) => {
    const chars = [...ln];
    const glyphs = [];
    let acc = '';
    chars.forEach((ch, i) => {
      const x = (acc ? m.measureText(acc).width : 0) + tracking * i + wordSp * spaces(acc);
      if (ch === ' ') word++;
      else glyphs.push({ ch, x, w: m.measureText(ch).width, word, char: char++, line: li });
      acc += ch;
    });
    word++;
    return { text: ln, width: widthOf(ln), glyphs, i: li };
  });
  const width = Math.max(...L.map((l) => l.width));
  for (const l of L) {
    l.x0 = align === 'center' ? (width - l.width) / 2 : align === 'right' ? width - l.width : 0;
    l.base = l.i * lh + lh / 2 + capH / 2;
  }
  return { lines: L, width, height: L.length * lh, size, lh, capH, weight, family, tracking, font: fontStr(weight, size, family), nWords: word, nChars: char, nLines: L.length, align };
}

// ------------------------------------------------------------------ animaciones por unidad
function inState(anim, dt, d, T, u) {
  const s = { dx: 0, dy: 0, sx: 1, sy: 1, r: 0, a: 1, clip: false, blur: 0 };
  if (anim === 'none') return s;
  if (dt < 0) { s.a = 0; return s; }
  const p = clamp(dt / d);
  switch (anim) {
    case 'fade': { const e = E.outCubic(p); s.a = e; s.dy = (1 - e) * T.size * 0.18; break; }
    case 'rise': { const e = E.outExpo(clamp(dt / (d * 0.85))); s.dy = (1 - e) * T.lh * 1.08; s.clip = true; break; }
    case 'pop': {
      const k = pop(dt, 0, { dur: d, over: 1.24 });
      s.sx = s.sy = Math.max(0, k); s.dy = (1 - Math.min(1, k)) * T.size * 0.22; s.a = clamp(k * 4); break;
    }
    case 'slam': {
      const hit = 0.1;
      if (dt < hit) {
        const e = E.inQuad(dt / hit);
        s.sx = s.sy = 2.3 - 1.3 * e; s.a = clamp(dt / 0.05);
      } else {
        const q = dt - hit;
        const k = Math.exp(-q * 9) * Math.cos(q * 34);
        s.sy = 1 - 0.13 * k; s.sx = 1 + 0.09 * k; s.dy = T.capH * 0.06 * k;
      }
      break;
    }
    case 'drop': {
      s.dy = spring(dt, 0, { from: -T.size * 1.7, to: 0, freq: 2.4, damp: 8.5 });
      const land = Math.exp(-Math.max(0, dt - 0.16) * 12) * (dt > 0.12 ? 1 : 0);
      s.sy = 1 - 0.16 * land; s.sx = 1 + 0.1 * land; s.a = clamp(dt / 0.06); break;
    }
    case 'stretch': { const e = E.elasticOut(1, 0.42)(p); s.sx = Math.max(0, e); s.sy = 1 + (1 - Math.min(1, e)) * 0.25; s.a = clamp(p * 6); break; }
    case 'type': { s.sx = s.sy = 1 + 0.28 * Math.exp(-dt / 0.045); break; }
    case 'focus': { const e = E.outCubic(p); s.a = e; s.sx = s.sy = 1.35 - 0.35 * e; s.blur = (1 - e) * T.size * 0.12; break; }
    case 'spin': { const e = E.backOut(1.6)(p); s.r = (1 - e) * -0.9; s.sx = s.sy = Math.max(0, e); s.a = clamp(p * 4); break; }
    default: break;
  }
  return s;
}
function outState(anim, dt, d, T, s) {
  if (dt < 0 || anim === 'none') return s;
  const p = clamp(dt / d);
  switch (anim) {
    case 'fade': s.a *= 1 - E.inOutCubic(p); s.dy -= E.inCubic(p) * T.size * 0.12; break;
    case 'rise': s.dy -= E.inExpo(p) * T.lh * 1.1; s.clip = true; break;
    case 'fall': s.dy += E.inBack(p) * T.lh * 1.1; s.clip = true; break;
    case 'pop': { const e = E.backIn(2.2)(p); const k = Math.max(0, 1 - e); s.sx *= k; s.sy *= k; s.a *= clamp(k * 3); break; }
    case 'wipe': s.a *= p < 1 ? 1 : 0; s.wipe = p; break;
    default: s.a *= 1 - p;
  }
  return s;
}
function unitIndex(g, by) { return by === 'word' ? g.word : by === 'line' ? g.line : g.char; }
function unitCount(T, by) { return by === 'word' ? T.nWords : by === 'line' ? T.nLines : T.nChars; }
function orderOf(u, n, from) {
  if (from === 'center') return Math.abs(u - (n - 1) / 2);
  if (from === 'end') return n - 1 - u;
  if (from === 'random') return Math.floor(hash(u, 913) * n);
  return u;
}

/** ¿El texto está en pantalla en t? (para saltear trabajo). */
export function textVisible(T, o) {
  const n = unitCount(T, o.by ?? 'char');
  const st = o.stagger ?? 0.025;
  if (o.t < (o.in ?? 0) - 1e-6) return false;
  if (o.out !== undefined && o.t > o.out + (o.outStagger ?? st * 0.5) * n + (o.outDur ?? 0.3)) return false;
  return true;
}

/**
 * Dibuja el texto T en t. Opciones (todas opcionales salvo t):
 *  x, y, anchor [ax, ay] (fracción de la caja; [0.5,0.5] = centro) · scale, rotate (bloque entero)
 *  in, anim, by, stagger, dur, from · out, outAnim, outDur, outStagger
 *  fill (color | (ctx, T) => estilo, en coords de la caja) · colors { índiceDePalabra: color }
 *  stroke { color, width } · shadow { color, blur, x, y } · extrude { depth, color, dx, dy } (letra 3D)
 *  sweep { t0, dur, color, alpha, width } (barrido de luz sobre las letras)
 *  underline { words: [i…] | 'all', t0, dur, color, height, offset } (subrayado que crece)
 *  live { amp, hz } (flotación continua por letra después de entrar) · alpha
 */
export function drawText(ctx, T, o) {
  if (!textVisible(T, o)) return;
  const t = o.t;
  const by = o.by ?? 'char';
  const st = o.stagger ?? 0.025;
  const n = unitCount(T, by);
  const t0 = o.in ?? 0;
  const anim = o.anim ?? 'rise';
  const d = o.dur ?? (anim === 'pop' ? 0.42 : anim === 'drop' ? 0.5 : 0.55);
  const outT = o.out ?? Infinity;
  const outAnim = o.outAnim ?? 'fade';
  const outDur = o.outDur ?? 0.3;
  const outSt = o.outStagger ?? st * 0.5;
  const from = o.from ?? 'start';
  const [ax, ay] = o.anchor ?? [0, 0];

  const paint = (c) => {
    c.save();
    c.translate(o.x ?? 0, o.y ?? 0);
    if (o.rotate) c.rotate(o.rotate);
    if (o.scale && o.scale !== 1) c.scale(o.scale, o.scale);
    c.translate(-ax * T.width, -ay * T.height);
    if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
    c.font = T.font;
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    const fillStyle = typeof o.fill === 'function' ? o.fill(c, T) : (o.fill ?? '#ffffff');

    if (o.underline) drawUnderline(c, T, o.underline, t);

    // dos pasadas: primero TODAS las extrusiones, después las caras (si no, la extrusión de una letra pisa
    // la cara de la anterior en pares apretados como LA, AV, O?)
    const items = [];
    for (const ln of T.lines) {
      for (const g of ln.glyphs) {
        const u = unitIndex(g, by);
        const ord = orderOf(u, n, from);
        let s = inState(anim, t - (t0 + ord * st), d, T, u);
        s = outState(outAnim, t - (outT + ord * outSt), outDur, T, s);
        if (s.a <= 0.002 || s.sx <= 0.001 || s.sy <= 0.001) continue;
        if (o.live && t > t0 + ord * st + d) {
          const k = clamp((t - (t0 + ord * st + d)) / 0.4);
          s.dy += Math.sin(TAU * (o.live.hz ?? 0.6) * t + g.char * 0.55) * (o.live.amp ?? 4) * k;
        }
        items.push({ ln, g, s });
      }
    }
    const passes = o.extrude ? ['extrude', 'face'] : ['face'];
    for (const pass of passes) {
      for (const { ln, g, s } of items) {
        const gx = ln.x0 + g.x, by0 = ln.base;
        const px = gx + g.w / 2, py = by0 - T.capH / 2;
        c.save();
        if (s.clip) {
          c.beginPath();
          c.rect(ln.x0 - T.size, ln.base - T.size * 1.08, ln.width + T.size * 2, T.size * 1.42);
          c.clip();
        }
        if (s.wipe !== undefined) {
          c.beginPath();
          c.rect(ln.x0 + ln.width * s.wipe, ln.base - T.size * 1.2, ln.width * 2, T.size * 2);
          c.clip();
        }
        c.globalAlpha *= s.a;
        if (s.blur > 0.3) c.filter = `blur(${s.blur.toFixed(1)}px)`;
        c.translate(px + s.dx, py + s.dy);
        if (s.r) c.rotate(s.r);
        c.scale(s.sx, s.sy);
        c.translate(-px, -py);
        if (pass === 'extrude') drawExtrude(c, g.ch, gx, by0, o.extrude);
        else drawGlyph(c, g.ch, gx, by0, o, o.colors?.[g.word] ?? fillStyle);
        c.restore();
      }
    }
    c.restore();
  };

  if (o.sweep && t > o.sweep.t0 && t < o.sweep.t0 + (o.sweep.dur ?? 0.6)) {
    const L = layer();
    const lc = L.getContext('2d');
    lc.setTransform(ctx.getTransform());
    lc.globalAlpha = ctx.globalAlpha;
    paint(lc);
    // banda de luz pegada a las letras (source-atop)
    const p = (t - o.sweep.t0) / (o.sweep.dur ?? 0.6);
    lc.save();
    lc.globalCompositeOperation = 'source-atop';
    lc.translate(o.x ?? 0, o.y ?? 0);
    if (o.scale && o.scale !== 1) lc.scale(o.scale, o.scale);
    lc.translate(-ax * T.width, -ay * T.height);
    const bw = T.width * (o.sweep.width ?? 0.25);
    const cx = -bw + (T.width + 2 * bw) * E.inOutSine(p);
    lc.translate(cx, T.height / 2);
    lc.rotate(-0.4);
    const g = lc.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    const col = o.sweep.color ?? '#ffffff';
    g.addColorStop(0, hexA(col, 0)); g.addColorStop(0.5, hexA(col, o.sweep.alpha ?? 0.85)); g.addColorStop(1, hexA(col, 0));
    lc.fillStyle = g;
    lc.fillRect(-bw / 2, -T.height * 3, bw, T.height * 6);
    lc.restore();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(L, 0, 0);
    ctx.restore();
  } else {
    paint(ctx);
  }
}

function drawExtrude(c, ch, x, y, ex) {
  const { depth = 8, color = '#0A2340', dx = 0.7, dy = 1 } = ex;
  c.fillStyle = color;
  for (let k = depth; k >= 1; k--) c.fillText(ch, x + dx * k, y + dy * k);
}

function drawGlyph(c, ch, x, y, o, fillStyle) {
  if (o.stroke) {
    c.strokeStyle = o.stroke.color;
    c.lineWidth = o.stroke.width ?? 4;
    c.lineJoin = 'round';
    c.strokeText(ch, x, y);
  }
  if (o.shadow) {
    c.shadowColor = o.shadow.color ?? 'rgba(4,16,31,0.45)';
    c.shadowBlur = o.shadow.blur ?? 24;
    c.shadowOffsetX = o.shadow.x ?? 0;
    c.shadowOffsetY = o.shadow.y ?? 8;
  }
  c.fillStyle = fillStyle;
  c.fillText(ch, x, y);
  if (o.shadow) { c.shadowColor = 'rgba(0,0,0,0)'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; }
}

function drawUnderline(c, T, u, t) {
  const p = E.outExpo(clamp((t - (u.t0 ?? 0)) / (u.dur ?? 0.4)));
  if (p <= 0) return;
  const h = u.height ?? T.size * 0.14;
  const off = u.offset ?? T.size * 0.16;
  for (const ln of T.lines) {
    const gs = ln.glyphs.filter((g) => u.words === 'all' || u.words.includes(g.word));
    if (!gs.length) continue;
    const x0 = ln.x0 + gs[0].x - T.size * 0.04;
    const x1 = ln.x0 + gs[gs.length - 1].x + gs[gs.length - 1].w + T.size * 0.04;
    const w = (x1 - x0) * p;
    c.save();
    c.fillStyle = u.color ?? '#FFB938';
    c.globalAlpha *= u.alpha ?? 1;
    const y = ln.base + off - h / 2;
    const r = h / 2;
    c.beginPath();
    c.moveTo(x0 + r, y); c.lineTo(x0 + w - r, y); c.arc(x0 + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    c.lineTo(x0 + r, y + h); c.arc(x0 + r, y + r, r, Math.PI / 2, -Math.PI / 2);
    c.fill();
    c.restore();
  }
}

function hexA(c, a) {
  if (!c.startsWith('#')) return c;
  let h = c.slice(1);
  if (h.length === 3) h = h.split('').map((q) => q + q).join('');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

/**
 * Chip/píldora con texto (navieras, etiquetas de escena, rótulos de pines).
 * o = { t, in, out, x, y, anchor, size, weight, bg, fg, border {color,width}, padX, padY (em), radius ('pill' | px),
 *       anim 'pop'|'stretch'|'rise', icon (c, h) => {} dibuja a la izquierda en un cuadrado de alto h, shadow, upper, tracking }
 */
export function drawChip(ctx, text, o) {
  const size = o.size ?? 40;
  const T = txt(text, { size, weight: o.weight ?? 700, tracking: o.tracking ?? 0.02, upper: o.upper ?? false });
  const padX = (o.padX ?? 0.8) * size, padY = (o.padY ?? 0.45) * size;
  const iconW = o.icon ? T.capH * 1.9 + size * 0.35 : 0;
  const w = T.width + padX * 2 + iconW, h = T.capH + padY * 2;
  const [ax, ay] = o.anchor ?? [0.5, 0.5];
  const t = o.t, t0 = o.in ?? 0;
  if (t < t0) return null;
  let k = 1, sx = 1, alpha = 1, dy = 0;
  const anim = o.anim ?? 'pop';
  if (anim === 'pop') k = pop(t, t0, { dur: o.dur ?? 0.4, over: 1.18 });
  else if (anim === 'stretch') { sx = Math.max(0, E.elasticOut(1, 0.45)(clamp((t - t0) / (o.dur ?? 0.6)))); }
  else if (anim === 'rise') { const e = E.outExpo(clamp((t - t0) / (o.dur ?? 0.5))); dy = (1 - e) * h * 1.2; alpha = e; }
  if (o.out !== undefined && t > o.out) {
    const p = clamp((t - o.out) / (o.outDur ?? 0.25));
    k *= Math.max(0, 1 - E.backIn(2)(p));
    alpha *= 1 - p * 0.3;
  }
  if (k <= 0.001 || sx <= 0.001) return null;
  ctx.save();
  ctx.translate(o.x, o.y + dy);
  if (o.rotate) ctx.rotate(o.rotate);
  ctx.scale(k * sx, k);
  ctx.translate(-ax * w, -ay * h);
  ctx.globalAlpha *= alpha;
  const r = o.radius === undefined || o.radius === 'pill' ? h / 2 : o.radius;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.arcTo(w, 0, w, h, r); ctx.arcTo(w, h, 0, h, r); ctx.arcTo(0, h, 0, 0, r); ctx.arcTo(0, 0, w, 0, r); ctx.closePath();
  if (o.shadow !== false) {
    ctx.shadowColor = o.shadow?.color ?? 'rgba(4,16,31,0.35)';
    ctx.shadowBlur = o.shadow?.blur ?? 18;
    ctx.shadowOffsetY = o.shadow?.y ?? 6;
  }
  ctx.fillStyle = typeof o.bg === 'function' ? o.bg(ctx, w, h) : (o.bg ?? '#ffffff');
  ctx.fill();
  ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  if (o.border) { ctx.strokeStyle = o.border.color; ctx.lineWidth = o.border.width ?? 3; ctx.stroke(); }
  if (o.icon) { ctx.save(); ctx.translate(padX * 0.8, h / 2); o.icon(ctx, T.capH * 1.9); ctx.restore(); }
  ctx.font = T.font;
  ctx.fillStyle = o.fg ?? '#0A2340';
  ctx.textBaseline = 'alphabetic';
  const bx = padX + iconW, by = padY + T.capH;
  for (const g of T.lines[0].glyphs) ctx.fillText(g.ch, bx + g.x, by);
  ctx.restore();
  return { w: w * k, h: h * k };
}

/** Número con separador de miles rioplatense: 2341 → '2.341'. */
export const fmtInt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
