// Ayudas de dibujo sobre CanvasRenderingContext2D (idénticas en navegador y Node).
// Convenciones: ángulos en RADIANES, coordenadas del cuadro 1920×1080, colores de engine/color.js.
import { layer, layerHalf } from './layer.js';
import { makeCanvas } from './env.js';
import { W, H } from './time.js';
import { rng } from './noise.js';
import { TAU } from './ease.js';

// ------------------------------------------------------------------ paths
const pathCache = new Map();
/** Path2D cacheado a partir de un string SVG 'M… C… Z'. */
export function P(d) {
  let p = pathCache.get(d);
  if (!p) { p = new Path2D(d); pathCache.set(d, p); }
  return p;
}
export function rrectPath(x, y, w, h, r) {
  const p = new Path2D();
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  p.moveTo(x + rr, y);
  p.arcTo(x + w, y, x + w, y + h, rr);
  p.arcTo(x + w, y + h, x, y + h, rr);
  p.arcTo(x, y + h, x, y, rr);
  p.arcTo(x, y, x + w, y, rr);
  p.closePath();
  return p;
}
export function circlePath(x, y, r) {
  const p = new Path2D();
  p.arc(x, y, Math.max(0, r), 0, TAU);
  p.closePath();
  return p;
}
export function ellipsePath(x, y, rx, ry, rot = 0) {
  const p = new Path2D();
  p.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU);
  p.closePath();
  return p;
}
/** Polígono a partir de [[x,y], …]. */
export function polyPath(pts, closed = true) {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  if (closed) p.closePath();
  return p;
}
/**
 * Curva suave (Catmull-Rom → Bézier) por los puntos. tension 0..1 (0,5 = natural).
 * Ideal para olas, gotas, manchas líquidas y siluetas orgánicas.
 */
export function smoothPath(pts, closed = false, tension = 0.5, into = null) {
  const p = into || new Path2D();
  const n = pts.length;
  if (n < 2) return p;
  const get = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  if (!into) p.moveTo(pts[0][0], pts[0][1]);
  else p.lineTo(pts[0][0], pts[0][1]);
  const segs = closed ? n : n - 1;
  const k = tension / 3;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    p.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k,
      p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k,
      p2[0], p2[1],
    );
  }
  if (closed) p.closePath();
  return p;
}
/** Estrella de n puntas (r1 externo, r2 interno). */
export function starPath(x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n, r = i % 2 ? r2 : r1;
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return polyPath(pts);
}

// ------------------------------------------------------------------ transformaciones y grupos
/**
 * Aplica una transformación al contexto: translate(x,y) · rotate(r) · scale(sx,sy) · translate(-ax,-ay).
 * (ax, ay) es el punto de anclaje/pivote en coordenadas locales.
 */
export function tf(ctx, { x = 0, y = 0, r = 0, s = 1, sx = s, sy = s, ax = 0, ay = 0, skx = 0 } = {}) {
  ctx.translate(x, y);
  if (r) ctx.rotate(r);
  if (skx) ctx.transform(1, 0, Math.tan(skx), 1, 0, 0);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  if (ax || ay) ctx.translate(-ax, -ay);
}
/**
 * Grupo: save → transformación → alpha (multiplica) → blend → filtro → clip → fn(ctx) → restore.
 * o = { x, y, r, s, sx, sy, ax, ay, alpha, blend, filter, clip: Path2D|string }
 */
export function group(ctx, o, fn) {
  if (o.alpha !== undefined && o.alpha <= 0.0005) return;
  ctx.save();
  tf(ctx, o);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.blend) ctx.globalCompositeOperation = o.blend;
  if (o.filter) ctx.filter = o.filter;
  if (o.clip) ctx.clip(typeof o.clip === 'string' ? P(o.clip) : o.clip);
  fn(ctx);
  ctx.restore();
}

// ------------------------------------------------------------------ pintura
/** Degradé lineal. stops: ['#a', '#b'] repartidos o [[0,'#a'], [0.4,'#b'], …]. */
export function lin(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  addStops(g, stops);
  return g;
}
/** Degradé radial centrado (x, y, radio r) o completo (x0,y0,r0,x1,y1,r1) si se pasan 6 números. */
export function rad(ctx, ...a) {
  const stops = a.pop();
  const g = a.length === 3 ? ctx.createRadialGradient(a[0], a[1], 0, a[0], a[1], Math.max(0.001, a[2]))
    : ctx.createRadialGradient(a[0], a[1], Math.max(0, a[2]), a[3], a[4], Math.max(0.001, a[5]));
  addStops(g, stops);
  return g;
}
function addStops(g, stops) {
  const n = stops.length;
  stops.forEach((s, i) => (Array.isArray(s) ? g.addColorStop(s[0], s[1]) : g.addColorStop(n === 1 ? 0 : i / (n - 1), s)));
}
export function fill(ctx, path, style) {
  ctx.fillStyle = style;
  ctx.fill(typeof path === 'string' ? P(path) : path);
}
export function stroke(ctx, path, style, width = 2, { cap = 'round', join = 'round', dash = null, offset = 0 } = {}) {
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.lineCap = cap;
  ctx.lineJoin = join;
  if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = offset; }
  ctx.stroke(typeof path === 'string' ? P(path) : path);
  if (dash) ctx.setLineDash([]);
}

// ------------------------------------------------------------------ efectos por capa
/** Dibuja fn en una capa con la MISMA transformación que ctx y te devuelve la capa (coordenadas de pantalla). */
export function toLayer(ctx, fn) {
  const L = layer();
  const lc = L.getContext('2d');
  lc.setTransform(ctx.getTransform());
  fn(lc);
  return L;
}
/** Pega una capa en pantalla completa respetando alpha/blend actuales de ctx. */
export function blit(ctx, L, { blend = null, filter = null, alpha = 1, dx = 0, dy = 0 } = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (blend) ctx.globalCompositeOperation = blend;
  if (filter) ctx.filter = filter;
  ctx.globalAlpha *= alpha;
  ctx.drawImage(L, dx, dy);
  ctx.restore();
}
/** Dibuja fn a MEDIA resolución (misma transformación que ctx) y devuelve la capa chica. */
function toHalf(ctx, fn) {
  const L = layerHalf();
  const lc = L.getContext('2d');
  const m = ctx.getTransform();
  lc.setTransform(m.a * 0.5, m.b * 0.5, m.c * 0.5, m.d * 0.5, m.e * 0.5, m.f * 0.5);
  fn(lc);
  return L;
}
/** Pega una capa de media resolución estirada a pantalla completa. */
function blitHalf(ctx, L, { blend = null, filter = null, alpha = 1 } = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (blend) ctx.globalCompositeOperation = blend;
  if (filter) ctx.filter = filter;
  ctx.globalAlpha *= alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(L, 0, 0, W, H);
  ctx.restore();
}
/**
 * Resplandor: dibuja fn nítido y además una copia desenfocada sumada (bloom local).
 * El halo se calcula a media resolución (4× más barato). o = { blur, strength 0..2, blend, crisp }
 */
export function glow(ctx, fn, { blur = 24, strength = 1, blend = 'lighter', crisp = true } = {}) {
  const S = toHalf(ctx, fn);
  const B = layerHalf();
  const bc = B.getContext('2d');
  bc.filter = `blur(${Math.max(1, blur / 2).toFixed(2)}px)`;
  bc.drawImage(S, 0, 0);
  bc.filter = 'none';
  let s = strength;
  while (s > 0.001) { blitHalf(ctx, B, { blend, alpha: Math.min(1, s) }); s -= 1; }
  if (crisp) fn(ctx);
}
/**
 * Dibuja fn desenfocado (profundidad de campo, planos lejanos durante movimientos de cámara).
 * Desde 2 px el desenfoque se hace a media resolución (los blur chicos en Skia son caros y los grandes también).
 */
export function blurred(ctx, px, fn) {
  if (px < 0.35) { fn(ctx); return; }
  if (px < 2) {
    const L = toLayer(ctx, fn);
    blit(ctx, L, { filter: `blur(${px.toFixed(2)}px)` });
    return;
  }
  const S = toHalf(ctx, fn);
  const B = layerHalf();
  const bc = B.getContext('2d');
  bc.filter = `blur(${(px / 2).toFixed(2)}px)`;
  bc.drawImage(S, 0, 0);
  bc.filter = 'none';
  blitHalf(ctx, B);
}
/** Sombra proyectada de TODO el grupo (una sola sombra, no una por trazo). */
export function dropShadow(ctx, { color = 'rgba(4,16,31,0.35)', blur = 30, x = 0, y = 14 } = {}, fn) {
  const L = toLayer(ctx, fn);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.shadowOffsetX = x; ctx.shadowOffsetY = y;
  ctx.drawImage(L, 0, 0);
  ctx.restore();
}
/** Máscara: dibuja content y lo recorta con el alfa de mask (ambos con la transformación de ctx). */
export function masked(ctx, content, mask, { invert = false } = {}) {
  const L = toLayer(ctx, content);
  const M = toLayer(ctx, mask);
  const lc = L.getContext('2d');
  lc.save();
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.globalCompositeOperation = invert ? 'destination-out' : 'destination-in';
  lc.drawImage(M, 0, 0);
  lc.restore();
  blit(ctx, L);
}
// Buffers del barrido: media resolución + MARGEN (25 % por lado) para que las copias corridas no muestren
// el borde del cuadro. Se reusan en cada llamada (smear no se anida).
const SM_PAD_X = Math.round(W / 8), SM_PAD_Y = Math.round(H / 8);
let smBufs = null;
function smBuf(i) {
  smBufs ??= [0, 1, 2].map(() => makeCanvas(W / 2 + 2 * SM_PAD_X, H / 2 + 2 * SM_PAD_Y));
  const c = smBufs[i];
  const x = c.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-over';
  x.filter = 'none';
  x.clearRect(0, 0, c.width, c.height);
  return c;
}
/**
 * Barrido de desenfoque direccional (látigos, objetos muy rápidos) de largo total (dx, dy) en px de pantalla.
 * Se hace a media resolución promediando DE A PARES en pasadas sucesivas (ping-pong): cada pasada suma dos
 * copias corridas ±s al 50 % y s se divide por 2 → filtro de caja de 2^passes muestras, sin el posterizado
 * de sumar n copias con alfa 1/n en 8 bits. passes 4–6.
 * Bordes: fn se dibuja en un lienzo con 25 % de margen por lado (si tu escena dibuja más allá del cuadro, ese
 * contenido entra al barrido). edge: 'clamp' (def.) estira los bordes del cuadro hacia el margen para que el
 * barrido nunca muestre una banda vacía; 'none' deja el margen como lo dibujó fn (transparente si no hay nada).
 */
export function smear(ctx, dx, dy, fn, passes = 5, { edge = 'clamp' } = {}) {
  if (Math.hypot(dx, dy) < 2) { fn(ctx); return; }
  const PX = SM_PAD_X, PY = SM_PAD_Y, w2 = W / 2, h2 = H / 2;
  let src = smBuf(0);
  const sc = src.getContext('2d');
  const m = ctx.getTransform();
  sc.setTransform(m.a * 0.5, m.b * 0.5, m.c * 0.5, m.d * 0.5, m.e * 0.5 + PX, m.f * 0.5 + PY);
  fn(sc);
  if (edge === 'clamp') {
    // estira las tiras de 2 px del borde del cuadro hacia el margen (sobre lo que haya, debajo)
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.globalCompositeOperation = 'destination-over';
    sc.drawImage(src, PX, PY, 2, h2, 0, PY, PX, h2);
    sc.drawImage(src, PX + w2 - 2, PY, 2, h2, PX + w2, PY, PX, h2);
    sc.drawImage(src, 0, PY, src.width, 2, 0, 0, src.width, PY);
    sc.drawImage(src, 0, PY + h2 - 2, src.width, 2, 0, PY + h2, src.width, PY);
    sc.globalCompositeOperation = 'source-over';
  }
  let sx = dx / 8, sy = dy / 8; // en media resolución: ±dx/4 en la primera pasada → largo total ≈ dx
  let flip = 1;
  for (let k = 0; k < passes; k++) {
    const D = smBuf(flip);
    const d = D.getContext('2d');
    d.globalCompositeOperation = 'lighter';
    d.globalAlpha = 0.5;
    d.drawImage(src, -sx, -sy);
    d.drawImage(src, sx, sy);
    src = D;
    flip = flip === 1 ? 2 : 1;
    sx /= 2; sy /= 2;
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, PX, PY, w2, h2, 0, 0, W, H);
  ctx.restore();
}
/**
 * Rasteriza un lienzo armado con muchas operaciones. En Node (@napi-rs/canvas) un lienzo se guarda como lista
 * de comandos y se vuelve a rasterizar CADA VEZ que se usa como fuente de drawImage: horneá tus cachés
 * de init() con bake() y quedan como píxeles (pegarlos cuesta ~1 ms en vez de decenas).
 */
export function bake(canvas) {
  const w = canvas.width, h = canvas.height;
  const out = makeCanvas(w, h);
  const img = canvas.getContext('2d').getImageData(0, 0, w, h);
  out.getContext('2d').putImageData(img, 0, 0);
  return out;
}

// ------------------------------------------------------------------ texturas
let grainCanvas = null;
const GS = 1024;
/** Azulejo de grano de 1024² ya rasterizado (putImageData), gris medio ± ruido. */
function grainTile() {
  if (grainCanvas) return grainCanvas;
  grainCanvas = makeCanvas(GS, GS);
  const c = grainCanvas.getContext('2d');
  const img = c.createImageData(GS, GS);
  const r = rng(4242);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (r() + r() + r() - 1.5) * 110;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  return grainCanvas;
}
/**
 * Textura de grano DENTRO de una forma (rompe la esterilidad del vector plano). El grano se mueve con la
 * forma (vive en las coordenadas locales). Solo cubre lo visible: se pegan azulejos de 1024² con drawImage
 * sobre la región de pantalla (o sobre `bounds` {x,y,w,h} en coordenadas locales si la pasás: más barato).
 * alpha 0.05–0.15 · blend 'overlay' | 'soft-light' | 'multiply'.
 */
export function texture(ctx, path, { alpha = 0.08, blend = 'overlay', scale = 1, ox = 0, oy = 0, bounds = null } = {}) {
  const tile = grainTile();
  ctx.save();
  ctx.clip(typeof path === 'string' ? P(path) : path);
  ctx.globalCompositeOperation = blend;
  ctx.globalAlpha *= alpha;
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  let x0, y0, x1, y1;
  if (bounds) {
    x0 = (bounds.x - ox) / scale; y0 = (bounds.y - oy) / scale;
    x1 = x0 + bounds.w / scale; y1 = y0 + bounds.h / scale;
  } else {
    // región de pantalla llevada a coordenadas locales (inversa de la transformación actual)
    const m = ctx.getTransform();
    const det = m.a * m.d - m.b * m.c || 1e-9;
    const inv = (X, Y) => [(m.d * (X - m.e) - m.c * (Y - m.f)) / det, (-m.b * (X - m.e) + m.a * (Y - m.f)) / det];
    const cw = ctx.canvas?.width ?? W, ch = ctx.canvas?.height ?? H;
    const P4 = [inv(0, 0), inv(cw, 0), inv(0, ch), inv(cw, ch)];
    x0 = Math.min(...P4.map((q) => q[0])); x1 = Math.max(...P4.map((q) => q[0]));
    y0 = Math.min(...P4.map((q) => q[1])); y1 = Math.max(...P4.map((q) => q[1]));
  }
  const tx0 = Math.floor(x0 / GS) * GS, ty0 = Math.floor(y0 / GS) * GS;
  let n = 0;
  for (let ty = ty0; ty < y1 && n < 64; ty += GS) {
    for (let tx = tx0; tx < x1 && n < 64; tx += GS, n++) ctx.drawImage(tile, tx, ty);
  }
  ctx.restore();
}
export const grainCanvasFor = grainTile;

// ------------------------------------------------------------------ luz
/** Destello de 4 puntas con halo (agua, vidrio, metal, joyas). size = radio de las puntas. */
export function sparkle(ctx, x, y, size, { alpha = 1, color = '#ffffff', rot = 0, halo = 0.6 } = {}) {
  if (alpha <= 0.002 || size <= 0.2) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.globalCompositeOperation = 'lighter';
  if (halo > 0) {
    ctx.fillStyle = rad(ctx, x, y, size * 0.9, [[0, colorA(color, 0.55 * halo)], [1, colorA(color, 0)]]);
    ctx.fillRect(x - size, y - size, size * 2, size * 2);
  }
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  const t = size * 0.11;
  ctx.beginPath();
  ctx.moveTo(0, -size); ctx.quadraticCurveTo(t, -t, size, 0); ctx.quadraticCurveTo(t, t, 0, size);
  ctx.quadraticCurveTo(-t, t, -size, 0); ctx.quadraticCurveTo(-t, -t, 0, -size);
  ctx.fill();
  ctx.restore();
}
function colorA(c, a) {
  if (c.startsWith('#')) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split('').map((q) => q + q).join('');
    return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
  }
  return c;
}
/**
 * Barrido de luz: una banda brillante inclinada que cruza `rect` {x,y,w,h} recortada a `clip` (Path2D).
 * p 0→1 la lleva de izquierda a derecha. width = ancho de la banda (fracción de rect.w).
 */
export function lightSweep(ctx, clip, rect, p, { angle = -0.35, width = 0.22, color = '#ffffff', alpha = 0.55, blend = 'screen' } = {}) {
  if (p <= 0 || p >= 1 || alpha <= 0) return;
  const { x, y, w, h } = rect;
  const bw = w * width;
  const cx = x - bw + (w + bw * 2) * p;
  ctx.save();
  if (clip) ctx.clip(typeof clip === 'string' ? P(clip) : clip);
  ctx.globalCompositeOperation = blend;
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, y + h / 2);
  ctx.rotate(angle);
  ctx.fillStyle = lin(ctx, -bw / 2, 0, bw / 2, 0, [[0, colorA(color, 0)], [0.5, colorA(color, 1)], [1, colorA(color, 0)]]);
  ctx.fillRect(-bw / 2, -h * 2, bw, h * 4);
  ctx.restore();
}
/**
 * Flare de lente: núcleo, estría anamórfica horizontal y "fantasmas" sobre la línea luz → centro del cuadro.
 * intensity 0..1.5 · tint color cálido · streak = largo de la estría (px).
 */
export function lensFlare(ctx, x, y, { intensity = 1, tint = '#FFD27A', streak = 900, ghosts = true, core = 120 } = {}) {
  if (intensity <= 0.002) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= Math.min(1, intensity);
  ctx.fillStyle = rad(ctx, x, y, core * 2.2, [[0, colorA('#ffffff', 0.9)], [0.12, colorA(tint, 0.55)], [0.45, colorA(tint, 0.12)], [1, colorA(tint, 0)]]);
  ctx.fillRect(x - core * 2.2, y - core * 2.2, core * 4.4, core * 4.4);
  // estría anamórfica
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.018);
  ctx.fillStyle = rad(ctx, 0, 0, streak, [[0, colorA('#ffffff', 0.85)], [0.25, colorA(tint, 0.35)], [1, colorA(tint, 0)]]);
  ctx.fillRect(-streak, -streak, streak * 2, streak * 2);
  ctx.restore();
  if (ghosts) {
    const cx = W / 2, cy = H / 2;
    const G = [[0.45, 26, 0.10, '#9FE7FF'], [0.75, 60, 0.07, tint], [1.25, 18, 0.14, '#ffffff'], [1.55, 90, 0.05, '#7FD3FF'], [1.85, 38, 0.08, tint]];
    for (const [f, r, a, c] of G) {
      const gx = x + (cx - x) * f, gy = y + (cy - y) * f;
      ctx.fillStyle = rad(ctx, gx, gy, r, [[0, colorA(c, a * intensity)], [0.7, colorA(c, a * 0.6 * intensity)], [1, colorA(c, 0)]]);
      ctx.beginPath(); ctx.arc(gx, gy, r, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}
