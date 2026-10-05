// Render de titulares letra por letra con oficio: sombra blanda proyectada, extrusión sombreada (rampa de
// color por capa), filo de luz del lado de la luz, cara en degradé con «horizonte», grano, halo y eco de impacto.
// Lo caro (extrusión, sombra, grano) vive en sprites por letra (sprites.js); acá solo se transforman y apilan.
// Se dibuja en PASADAS (sombras → extrusiones → caras) para que la extrusión de una letra nunca tape la cara
// de la vecina. El texto viene medido con txt() del motor (respeta el kerning).
import { clamp } from '../../engine/ease.js';
import { glyphSprites, lineSprite, put } from './sprites.js';

export const S0 = () => ({ dx: 0, dy: 0, sx: 1, sy: 1, r: 0, a: 1, echo: -1, glow: 0 });

/**
 * Copia de T con más aire entre palabras (`em` × tamaño extra por espacio): en Outfit 900 con tracking negativo
 * el espacio queda muy apretado y «¿Y SI» se lee «¿YSI». Recalcula anchos y alineación centrada.
 */
export function spaced(T, em = 0.14) {
  const extra = em * T.size;
  const lines = T.lines.map((ln) => {
    const w0 = ln.glyphs.length ? ln.glyphs[0].word : 0;
    const glyphs = ln.glyphs.map((g) => ({ ...g, x: g.x + (g.word - w0) * extra }));
    const nw = glyphs.length ? glyphs[glyphs.length - 1].word - w0 : 0;
    return { ...ln, glyphs, width: ln.width + nw * extra };
  });
  const width = Math.max(...lines.map((l) => l.width));
  for (const l of lines) l.x0 = T.align === 'center' ? (width - l.width) / 2 : T.align === 'right' ? width - l.width : 0;
  return { ...T, lines, width };
}

/**
 * Copia de T con kerning de excepción: `em` × tamaño de aire extra ANTES de cada aparición de `ch` (p. ej. el
 * par O–? de «CRUCERO?», que con la extrusión se pega). Recalcula anchos.
 */
export function kernBefore(T, ch, em) {
  const extra = em * T.size;
  const lines = T.lines.map((ln) => {
    let acc = 0;
    const glyphs = ln.glyphs.map((g) => { if (g.ch === ch) acc += extra; return { ...g, x: g.x + acc }; });
    return { ...ln, glyphs, width: ln.width + acc };
  });
  const width = Math.max(...lines.map((l) => l.width));
  for (const l of lines) l.x0 = T.align === 'center' ? (width - l.width) / 2 : T.align === 'right' ? width - l.width : 0;
  return { ...T, lines, width };
}

/** Ubicación de cada letra en coordenadas del bloque (antes del ancla): centro x, base y. */
export function glyphList(T) {
  let out = cacheGL.get(T);
  if (out) return out;
  out = [];
  for (const ln of T.lines) {
    for (const g of ln.glyphs) {
      if (g.ch === '…') {
        // la elipsis de Outfit son tres puntos idénticos al «.»: se separa para animar cada punto
        for (let k = 0; k < 3; k++) {
          const d = { ...g, ch: '.', w: g.w / 3, x: g.x + (k * g.w) / 3, dot: k };
          out.push({ g: d, ln, cx: ln.x0 + d.x + d.w / 2, base: ln.base });
        }
      } else out.push({ g, ln, cx: ln.x0 + g.x + g.w / 2, base: ln.base });
    }
  }
  cacheGL.set(T, out);
  return out;
}
const cacheGL = new Map();

/**
 * Dibuja el texto T con letras pre-dibujadas (sprites.js): por cuadro solo hay drawImage con transformaciones.
 * Si ninguna letra se mueve por su cuenta, la línea entera sale de UN sprite (barato en Node).
 * o = { x, y, anchor [ax, ay], scale, sx, sy, rotate, alpha, style, light [lx, ly] (hacia la luz, unitario),
 *       res (resolución de sprites: 1 | 0.42; por defecto según la escala en pantalla), glow 0..1,
 *       state(item, i) → s | null,
 *       styleOf(item) → estilo propio de una letra (o null = o.style) · styleKey (id de esa combinación, p. ej. '?oro'),
 *       sheen { p 0..1, angle, width (fracción del ancho), color 'r,g,b', alpha, blend, blendFor(item) }
 *             (barrido de luz SOLO sobre las caras; blend 'lighter' para caras que no son blancas) }
 * s = { dx, dy, sx, sy, r, a, echo (0..1, <0 apagado), glow 0..1, dark 0..1 } (pivote: base de la letra)
 */
export function drawGlyphs(c, T, o) {
  const st = o.style;
  const [ax, ay] = o.anchor ?? [0, 0];
  const light = o.light ?? [-0.5, -0.86];
  const items = glyphList(T);
  const S = items.map((it, i) => (o.state ? o.state(it, i) : S0()));
  c.save();
  c.translate(o.x ?? 0, o.y ?? 0);
  if (o.rotate) c.rotate(o.rotate);
  const sx = (o.sx ?? 1) * (o.scale ?? 1), sy = (o.sy ?? 1) * (o.scale ?? 1);
  if (sx !== 1 || sy !== 1) c.scale(sx, sy);
  c.translate(-ax * T.width, -ay * T.height);
  if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
  const baseA = c.globalAlpha;
  const M = c.getTransform();
  const scr = Math.hypot(M.a, M.b);
  // resolución del sprite según el tamaño en pantalla (el lockup chico usa su propio juego, nítido)
  const res = o.res ?? (scr < 0.62 ? 0.42 : 1);
  const gl0 = o.glow ?? 0;

  // barrido de luz (solo caras): degradé en coordenadas del bloque
  const sh = o.sheen;
  let sheenG = null, bandX = 0, bandW = 0;
  if (sh && sh.p > 0 && sh.p < 1) {
    const sw = T.width * (sh.width ?? 0.22);
    const cx = -sw + (T.width + 2 * sw) * sh.p, cy = T.height / 2;
    const a = sh.angle ?? 0.38;
    const ddx = (Math.cos(a) * sw) / 2, ddy = (Math.sin(a) * sw) / 2;
    sheenG = c.createLinearGradient(cx - ddx, cy - ddy, cx + ddx, cy + ddy);
    const col = sh.color ?? '255,255,255', al = sh.alpha ?? 0.85;
    sheenG.addColorStop(0, `rgba(${col},0)`);
    sheenG.addColorStop(0.4, `rgba(${col},${al * 0.5})`);
    sheenG.addColorStop(0.5, `rgba(${col},${al})`);
    sheenG.addColorStop(0.6, `rgba(${col},${al * 0.5})`);
    sheenG.addColorStop(1, `rgba(${col},0)`);
    bandX = cx; bandW = sw + T.height * Math.abs(Math.tan(a)) * 0.6 + T.size;
  }
  c.font = T.font;
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  const sheenOn = (it, gx) => {
    if (!sheenG || Math.abs(it.cx - bandX) >= bandW) return;
    const bl = sh.blendFor?.(it) ?? sh.blend;
    if (bl) { c.save(); c.globalCompositeOperation = bl; }
    c.fillStyle = sheenG;
    c.fillText(it.g.ch, gx, it.base);
    if (bl) c.restore();
  };
  const stOf = o.styleOf ? (it) => o.styleOf(it) ?? st : null;

  const still = S.every((s) => s && s.a >= 1 && !s.dx && !s.dy && s.sx === 1 && s.sy === 1 && !s.r && !(s.echo >= 0 && s.echo < 1) && !s.glow && !s.dark);
  if (still) {
    const LS = lineSprite(T, items, st, light, res, stOf, o.styleKey ?? '');
    if (gl0 > 0.01 && LS.glow) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha *= clamp(gl0);
      put(c, LS.glow, 0, 0);
      c.restore();
    }
    put(c, LS.all, 0, 0);
    if (sheenG) items.forEach((it) => sheenOn(it, it.ln.x0 + it.g.x));
    c.restore();
    return S;
  }

  const spr = items.map((it) => glyphSprites(T, it.g.ch, stOf ? stOf(it) : st, light, res));
  const each = (fn) => {
    for (let i = 0; i < items.length; i++) {
      const s = S[i];
      if (!s || s.a <= 0.003 || s.sx <= 0.001 || s.sy <= 0.001) continue;
      const it = items[i];
      c.save();
      c.globalAlpha = baseA * Math.min(1, s.a);
      c.translate(it.cx + s.dx, it.base + s.dy);
      if (s.r) c.rotate(s.r);
      if (s.sx !== 1 || s.sy !== 1) c.scale(s.sx, s.sy);
      c.translate(-it.cx, -it.base);
      fn(it, s, it.ln.x0 + it.g.x, spr[i]);
      c.restore();
    }
  };
  // halo · sombra+extrusión · eco · caras (+barrido): en pasadas, nada tapa la cara de la vecina
  each((it, s, gx, R) => {
    const gl = gl0 + (s.glow ?? 0);
    if (gl <= 0.01 || !R.glow) return;
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha *= clamp(gl);
    put(c, R.glow, gx, it.base);
  });
  each((it, s, gx, R) => put(c, R.back, gx, it.base));
  each((it, s, gx, R) => {
    if (!(s.echo >= 0 && s.echo < 1)) return;
    const e = s.echo, k = 1 + e * 0.45, py = it.base - T.capH / 2;
    c.translate(it.cx, py); c.scale(k, k); c.translate(-it.cx, -py);
    c.globalAlpha *= (1 - e) * (1 - e) * (1 - e) * 0.6;
    put(c, R.face, gx, it.base);
  });
  each((it, s, gx, R) => {
    put(c, R.face, gx, it.base);
    sheenOn(it, gx);
    // sombra que le cae encima (la ola que se acerca)
    if (s.dark > 0.003) { c.fillStyle = `rgba(4,16,31,${s.dark.toFixed(3)})`; c.fillText(it.g.ch, gx, it.base); }
  });
  c.restore();
  return S;
}

/** Pre-arma los sprites de T (grande y, si hace falta, chico) para no pagarlos en el primer cuadro. */
export function warm(T, st, light, both = false, styleOf = null, styleKey = '') {
  const stOf = styleOf ? (it) => styleOf(it) ?? st : null;
  for (const res of both ? [1, 0.42] : [1]) {
    const items = glyphList(T);
    for (const it of items) glyphSprites(T, it.g.ch, stOf ? stOf(it) : st, light, res);
    lineSprite(T, items, st, light, res, stOf, styleKey);
  }
}
