// Caché de letras pre-dibujadas (lo caro se hace UNA vez). Por letra, estilo, luz y resolución:
//   back → sombra blanda proyectada + extrusión sombreada (rampa de color por capa)
//   face → filo de luz + cara en degradé con «horizonte» + grano dentro de la letra
//   glow → halo cálido (solo estilos con glow)
// y por LÍNEA quieta, todo junto en un solo sprite (lineSprite): un drawImage por línea cuando nada se mueve
// letra por letra. Cada sprite guarda dónde cae respecto del origen (pluma en x, línea de base en y), en px del
// bloque. En Node (napi) dibujar con escala/rotación remuestrea y cuesta: por eso se apila lo menos posible.
import { makeCanvas } from '../../engine/env.js';
import { speckTile } from './surface.js';

const cache = new Map();
const styleIds = new WeakMap();
let nextId = 1;
const sid = (st) => { let v = styleIds.get(st); if (!v) { v = nextId++; styleIds.set(st, v); } return v; };

let mctx = null;
const meas = () => (mctx ??= makeCanvas(8, 8).getContext('2d'));

function box(T, ch) {
  const m = meas();
  m.font = T.font;
  const mt = m.measureText(ch);
  return { l: -mt.actualBoundingBoxLeft, r: mt.actualBoundingBoxRight, t: -mt.actualBoundingBoxAscent, b: mt.actualBoundingBoxDescent };
}

/** Lienzo para la caja bx (+pad) a resolución k; el contexto queda en coordenadas del bloque. */
function canvasFor(bx, k, pad) {
  const x0 = Math.floor(bx.l - pad), y0 = Math.floor(bx.t - pad);
  const w = Math.ceil(bx.r + pad) - x0, h = Math.ceil(bx.b + pad) - y0;
  const cv = makeCanvas(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
  const c = cv.getContext('2d');
  c.scale(k, k);
  c.translate(-x0, -y0);
  return { cv, c, x0, y0, w, h, k };
}

const grow = (b, dx, dy, m = 0) => ({ l: Math.min(b.l, b.l + dx) - m, r: Math.max(b.r, b.r + dx) + m, t: Math.min(b.t, b.t + dy) - m, b: Math.max(b.b, b.b + dy) + m });
const key = (T, ch, st, light, res) => `${T.font}|${ch}|${sid(st)}|${light[0]},${light[1]}|${res}`;

// pintores (comparten el orden de pasadas con drawGlyphs)
function paintShadow(c, T, ch, st, light) {
  const [lx, ly] = light;
  const depth = st.ext.length - 1, step = st.step ?? 1.1;
  const sd = st.shadow.dist;
  const ox = -lx * (depth * step + sd), oy = -ly * (depth * step + sd);
  const k = Math.hypot(c.getTransform().a, c.getTransform().b);
  c.save();
  c.filter = `blur(${((st.shadow.blur / 2) * k).toFixed(2)}px)`;
  c.fillStyle = st.shadow.color;
  c.font = T.font;
  c.fillText(ch, ox, oy);
  c.restore();
}
function paintExt(c, T, ch, st, light) {
  const [lx, ly] = light;
  const depth = st.ext.length - 1, step = st.step ?? 1.1;
  c.font = T.font;
  for (let k = depth; k >= 1; k--) {
    c.fillStyle = st.ext[k];
    c.fillText(ch, -lx * k * step, -ly * k * step);
  }
}
function paintFace(c, T, ch, st, light) {
  const [lx, ly] = light;
  const rp = st.rimPx ?? 2;
  c.font = T.font;
  // contorno (keyline) opcional: separa la letra de un fondo de valor parecido (p. ej. oro sobre cielo claro)
  if (st.stroke) {
    c.save();
    c.lineJoin = 'round';
    c.strokeStyle = st.stroke.color;
    c.lineWidth = st.stroke.width;
    c.strokeText(ch, 0, 0);
    c.restore();
  }
  if (st.rim) { c.fillStyle = st.rim; c.fillText(ch, lx * rp, ly * rp); }
  const g = c.createLinearGradient(0, -T.capH * 1.02, 0, T.size * 0.02);
  for (const [p, col] of st.face) g.addColorStop(p, col);
  c.fillStyle = g;
  c.fillText(ch, 0, 0);
}
function grainOn(R, st) {
  const c = R.c;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-atop';
  c.globalAlpha = (st.grain ?? 0.4) * (R.k < 1 ? 0.35 : 1); // chico: grano más suave (si no, ensucia)
  c.fillStyle = c.createPattern(speckTile(), 'repeat');
  c.fillRect(0, 0, R.cv.width, R.cv.height);
  c.restore();
}
function backBox(T, ch, st, light) {
  const [lx, ly] = light;
  const b = box(T, ch);
  const depth = st.ext.length - 1, step = st.step ?? 1.1;
  const ex = -lx * depth * step, ey = -ly * depth * step;
  const sd = st.shadow ? st.shadow.dist : 0, bl = st.shadow ? st.shadow.blur : 0;
  return grow(grow(b, ex - lx * sd, ey - ly * sd), 0, 0, bl * 1.3 + 3);
}

/** Sprites de la letra `ch` del texto T con el estilo st, luz [lx, ly] y resolución res (1 = tamaño del bloque). */
export function glyphSprites(T, ch, st, light, res = 1) {
  const kk = key(T, ch, st, light, res);
  let S = cache.get(kk);
  if (S) return S;
  const [lx, ly] = light;
  const b = box(T, ch);
  S = {};
  {
    const R = canvasFor(backBox(T, ch, st, light), res, 0);
    if (st.shadow) paintShadow(R.c, T, ch, st, light);
    paintExt(R.c, T, ch, st, light);
    S.back = R;
  }
  {
    const rp = st.rimPx ?? 2;
    const R = canvasFor(grow(b, lx * rp, ly * rp, 3 + (st.stroke ? st.stroke.width / 2 : 0)), res, 0);
    paintFace(R.c, T, ch, st, light);
    grainOn(R, st);
    S.face = R;
  }
  if (st.glow) {
    const R = canvasFor(grow(b, 0, 0, 40), res * 0.5, 0);
    R.c.filter = `blur(${(16 * res * 0.5).toFixed(2)}px)`;
    R.c.fillStyle = st.glow;
    R.c.font = T.font;
    R.c.fillText(ch, 0, 0);
    R.c.filter = 'none';
    S.glow = R;
  }
  cache.set(kk, S);
  return S;
}

/** Ítems (letra, x de pluma, base, estilo) de T: la «…» se separa en tres puntos (idénticos al glifo de Outfit). */
function penItems(items, st, stOf) { return items.map((it) => ({ ch: it.g.ch, x: it.ln.x0 + it.g.x, base: it.base, st: stOf ? stOf(it) : st })); }

/**
 * Línea entera quieta en un solo sprite (sombras → extrusiones → caras; mismo orden que drawGlyphs).
 * stOf(item) → estilo propio de una letra (p. ej. el «?» en oro); skey distingue esa combinación en la caché.
 */
export function lineSprite(T, items, st, light, res = 1, stOf = null, skey = '') {
  const kk = key(T, '§line' + skey, st, light, res);
  let S = cache.get(kk);
  if (S) return S;
  const P = penItems(items, st, stOf);
  let bx = null;
  for (const p of P) {
    const g = backBox(T, p.ch, p.st, light);
    const f = grow(box(T, p.ch), 0, 0, 6 + (p.st.stroke ? p.st.stroke.width / 2 : 0));
    const u = { l: Math.min(g.l, f.l) + p.x, r: Math.max(g.r, f.r) + p.x, t: Math.min(g.t, f.t) + p.base, b: Math.max(g.b, f.b) + p.base };
    bx = bx ? { l: Math.min(bx.l, u.l), r: Math.max(bx.r, u.r), t: Math.min(bx.t, u.t), b: Math.max(bx.b, u.b) } : u;
  }
  const R = canvasFor(bx, res, 0);
  const c = R.c;
  for (const p of P) if (p.st.shadow) { c.save(); c.translate(p.x, p.base); paintShadow(c, T, p.ch, p.st, light); c.restore(); }
  for (const p of P) { c.save(); c.translate(p.x, p.base); paintExt(c, T, p.ch, p.st, light); c.restore(); }
  // caras en un lienzo aparte (para el grano solo sobre ellas) y después encima
  const F = canvasFor(bx, res, 0);
  for (const p of P) { F.c.save(); F.c.translate(p.x, p.base); paintFace(F.c, T, p.ch, p.st, light); F.c.restore(); }
  grainOn(F, st);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(F.cv, 0, 0);
  c.restore();
  S = { all: R };
  if (st.glow) {
    const G = canvasFor(grow(bx, 0, 0, 30), res * 0.5, 0);
    G.c.filter = `blur(${(16 * res * 0.5).toFixed(2)}px)`;
    G.c.fillStyle = st.glow;
    G.c.font = T.font;
    for (const p of P) G.c.fillText(p.ch, p.x, p.base);
    G.c.filter = 'none';
    S.glow = G;
  }
  cache.set(kk, S);
  return S;
}

/** Pinta el sprite R con su origen en (x, y) del contexto actual (1:1 cuando la escala es 1 y res 1). */
export function put(c, R, x, y) {
  if (R.k === 1) c.drawImage(R.cv, x + R.x0, y + R.y0);
  else c.drawImage(R.cv, x + R.x0, y + R.y0, R.w, R.h);
}
