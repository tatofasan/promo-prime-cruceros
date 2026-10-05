// Utilidades de DECK-A: cámara cenital con perspectiva real, sprites cacheados, sombras suaves,
// resortes con velocidad inicial y la luz de la vela. Todo puro: nada guarda estado entre cuadros.
import { makeCanvas } from '../../engine/env.js';
import { TAU, clamp } from '../../engine/ease.js';
import { noise1 } from '../../engine/noise.js';

export const CX = 960, CY = 540;

// ------------------------------------------------------------------ resortes
/** Resorte amortiguado con posición y velocidad iniciales (x0, v0/s) que converge a `to`. */
export function springV(dt, x0, v0, to, { freq = 2, damp = 6 } = {}) {
  if (dt <= 0) return x0 + v0 * dt;
  const w = TAU * freq;
  const A = x0 - to;
  const B = (v0 + damp * A) / w;
  return to + Math.exp(-damp * dt) * (A * Math.cos(w * dt) + B * Math.sin(w * dt));
}

/** Rebote amortiguado que arranca en 0 (golpe de aterrizaje): 1 → oscila → 0. */
export const wobble = (dt, { freq = 5, damp = 9 } = {}) => (dt <= 0 ? 0 : Math.exp(-damp * dt) * Math.cos(TAU * freq * dt));

// ------------------------------------------------------------------ cámara cenital con perspectiva
// La cámara mira derecho hacia abajo desde CAM_D px de altura. Un punto a altura h se ve con escala
// z·D/(D−h): lo alto (copas, vela, campana) crece y se abre desde el centro → parallax de verdad.
export const CAM_D = 2200;

// Opcional (pileta): F = focal y A = altura de la cámara. Con A < F la cámara baja (dolly): lo alto se agranda
// más rápido que el piso. Sin A/F se comporta como antes (la cena).
export function cam(x = CX, y = CY, z = 1, r = 0, A = undefined, F = undefined) {
  return { x, y, z, r, c: Math.cos(r), s: Math.sin(r), A, F };
}
export const scaleAt = (C, h = 0) => (C.z * (C.F ?? CAM_D)) / Math.max(60, (C.A ?? CAM_D) - h);

/** Mundo (x, y, h) → pantalla [x, y, escala]. */
export function project(C, wx, wy, h = 0) {
  const k = scaleAt(C, h);
  const dx = (wx - C.x) * k, dy = (wy - C.y) * k;
  return [CX + dx * C.c - dy * C.s, CY + dx * C.s + dy * C.c, k];
}

/** Rectángulo de mundo (plano a altura h) que cubre la pantalla: [x0, y0, x1, y1] (con margen m en px de pantalla). */
export function visibleWorld(C, h = 0, m = 0) {
  const k = scaleAt(C, h);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [sx, sy] of [[-m, -m], [1920 + m, -m], [-m, 1080 + m], [1920 + m, 1080 + m]]) {
    const dx = (sx - CX) / k, dy = (sy - CY) / k;
    const wx = C.x + dx * C.c + dy * C.s, wy = C.y - dx * C.s + dy * C.c;
    x0 = Math.min(x0, wx); y0 = Math.min(y0, wy); x1 = Math.max(x1, wx); y1 = Math.max(y1, wy);
  }
  return [x0, y0, x1, y1];
}

/** Deja ctx listo para dibujar en coordenadas de mundo del plano a altura h. */
export function atH(ctx, C, h = 0) {
  const k = scaleAt(C, h);
  ctx.translate(CX, CY);
  if (C.r) ctx.rotate(C.r);
  ctx.scale(k, k);
  ctx.translate(-C.x, -C.y);
}
export function onPlane(ctx, C, h, fn) {
  ctx.save();
  atH(ctx, C, h);
  fn(ctx);
  ctx.restore();
}

/**
 * Columna en perspectiva vista desde arriba: envolvente de dos círculos (base y tope) ya proyectados.
 * Sirve para el tallo de la copa, la vela, el candelabro, la botella y los brazos.
 */
export function hullPath(x0, y0, r0, x1, y1, r1) {
  const p = new Path2D();
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
  if (d <= Math.abs(r1 - r0) + 0.01) {
    const big = r1 > r0 ? [x1, y1, r1] : [x0, y0, r0];
    p.arc(big[0], big[1], big[2], 0, TAU);
    p.closePath();
    return p;
  }
  const a = Math.atan2(dy, dx);
  const b = Math.acos(clamp((r0 - r1) / d, -1, 1));
  p.arc(x0, y0, r0, a + b, a - b + TAU, false);
  p.arc(x1, y1, r1, a - b, a + b, false);
  p.closePath();
  return p;
}

// ------------------------------------------------------------------ sprites
/**
 * Aplana un lienzo: en Skia un lienzo dibujado con muchas operaciones puede re-rasterizarse cada vez que se usa
 * como fuente (30 ms el mantel). Copiarlo a un lienzo nuevo lo deja como píxeles fijos (7 ms).
 */
export function flatten(cv) {
  const out = makeCanvas(cv.width, cv.height);
  out.getContext('2d').drawImage(cv, 0, 0);
  return out;
}

/**
 * Rasterizado garantizado: copia por píxeles (getImageData → putImageData). Más lento al armar, pero un lienzo
 * horneado con filtros (blur de sombras) a veces sigue "grabado" después de flatten() y se re-dibuja en cada uso.
 */
export function rasterize(cv) {
  const out = makeCanvas(cv.width, cv.height);
  out.getContext('2d').putImageData(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height), 0, 0);
  return out;
}

/**
 * Desenfoque SIN ctx.filter (en Skia, muchos rellenos con filter sobre un lienzo grande dejan lento todo el proceso:
 * medido 7 → 27 ms por drawImage después de hornear). Achica a la mitad n veces y vuelve a agrandar: ≈ 2^n px.
 */
export function softBlur(src, n = 3) {
  let cur = src;
  for (let i = 0; i < n; i++) {
    const nx = makeCanvas(Math.max(1, Math.ceil(cur.width / 2)), Math.max(1, Math.ceil(cur.height / 2)));
    nx.getContext('2d').drawImage(cur, 0, 0, nx.width, nx.height);
    cur = nx;
  }
  const out = makeCanvas(src.width, src.height);
  const o = out.getContext('2d');
  o.imageSmoothingQuality = 'high';
  o.drawImage(cur, 0, 0, src.width, src.height);
  return out;
}

/**
 * Sombras horneadas en dos capas (suave = cosas altas, nítida = cosas bajas) sobre un lienzo de w×h cuyo origen de
 * mundo es (x0, y0). fn(soft, sharp) dibuja siluetas OPACAS en el color de la sombra; devuelve las dos capas ya
 * desenfocadas para pegar con alpha.
 */
export function shadowLayers(w, h, x0, y0, fn, color = '#102C52') {
  const mk = () => {
    const c = makeCanvas(w, h);
    const x = c.getContext('2d');
    x.translate(-x0, -y0);
    x.fillStyle = color; x.strokeStyle = color; x.lineCap = 'round'; x.lineJoin = 'round';
    return [c, x];
  };
  const [sc, s] = mk(), [hc, hx] = mk();
  fn(s, hx);
  return { soft: softBlur(sc, 3), sharp: softBlur(hc, 2) };
}

/** Dibujo cacheado de w×h (origen en el centro) a `res` px por unidad. fn(ctx) dibuja centrado en 0,0. */
export function sprite(w, h, fn, res = 1.5) {
  const c = makeCanvas(Math.ceil(w * res), Math.ceil(h * res));
  const x = c.getContext('2d');
  x.scale(res, res);
  x.translate(w / 2, h / 2);
  fn(x);
  return { c: flatten(c), w, h, res };
}

/** Sombra suave cacheada: fn rellena la silueta (en 0,0) y se desenfoca `blur` px. */
export function shadowSprite(w, h, blur, fn, color = '#030B16', res = 1) {
  const m = blur * 2.2;
  const W2 = w + m * 2, H2 = h + m * 2;
  const a = makeCanvas(Math.ceil(W2 * res), Math.ceil(H2 * res));
  const ac = a.getContext('2d');
  ac.scale(res, res);
  ac.translate(W2 / 2, H2 / 2);
  ac.fillStyle = color;
  ac.strokeStyle = color;
  fn(ac);
  const c = makeCanvas(a.width, a.height);
  const cc = c.getContext('2d');
  cc.filter = `blur(${(blur * res).toFixed(1)}px)`;
  cc.drawImage(a, 0, 0);
  cc.filter = 'none';
  return { c: flatten(c), w: W2, h: H2, res };
}

/** Pega un sprite centrado en (x, y) del sistema actual. */
export function put(ctx, S, x, y, { r = 0, s = 1, sx = 1, sy = 1, alpha = 1, blend = null } = {}) {
  if (alpha <= 0.002 || s <= 0.0001) return;
  ctx.save();
  ctx.translate(x, y);
  if (r) ctx.rotate(r);
  if (s !== 1 || sx !== 1 || sy !== 1) ctx.scale(s * sx, s * sy);
  if (alpha < 1) ctx.globalAlpha *= alpha;
  if (blend) ctx.globalCompositeOperation = blend;
  ctx.drawImage(S.c, -S.w / 2, -S.h / 2, S.w, S.h);
  ctx.restore();
}

/** Disco suave (blanco) para halos y vapor: se tiñe con globalCompositeOperation o se usa como alfa. */
let softDiscS = null;
export function softDisc() {
  if (softDiscS) return softDiscS;
  softDiscS = sprite(128, 128, (c) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.2)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(-64, -64, 128, 128);
  }, 1);
  return softDiscS;
}
let warmDiscS = null;
/** Disco cálido (oro → coral) para halos de vela; se suma con 'lighter'. */
export function warmDisc() {
  if (warmDiscS) return warmDiscS;
  warmDiscS = sprite(128, 128, (c) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 64);
    g.addColorStop(0, 'rgba(255,214,140,1)');
    g.addColorStop(0.25, 'rgba(255,170,80,0.55)');
    g.addColorStop(0.6, 'rgba(255,120,60,0.16)');
    g.addColorStop(1, 'rgba(255,100,50,0)');
    c.fillStyle = g;
    c.fillRect(-64, -64, 128, 128);
  }, 1);
  return warmDiscS;
}
let inkDiscS = null;
/** Disco de sombra (tinta) con borde suave, radio 64. */
export function inkDisc() {
  if (inkDiscS) return inkDiscS;
  inkDiscS = sprite(128, 128, (c) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 64);
    g.addColorStop(0, 'rgba(3,11,22,1)');
    g.addColorStop(0.55, 'rgba(3,11,22,0.85)');
    g.addColorStop(0.8, 'rgba(3,11,22,0.35)');
    g.addColorStop(1, 'rgba(3,11,22,0)');
    c.fillStyle = g;
    c.fillRect(-64, -64, 128, 128);
  }, 1);
  return inkDiscS;
}
/** Elipse de sombra suave de (x0,y0) a (x1,y1) con ancho w (en el sistema actual). */
export function softCapsule(ctx, x0, y0, x1, y1, w, alpha) {
  const S = inkDisc();
  const d = Math.hypot(x1 - x0, y1 - y0) + w;
  put(ctx, S, (x0 + x1) / 2, (y0 + y1) / 2, { r: Math.atan2(y1 - y0, x1 - x0), sx: d / 100, sy: w / 100, alpha });
}

// ------------------------------------------------------------------ la luz de la vela
/** Llama de la vela en el mundo (la única fuente de luz de la escena). */
export const LIGHT = { x: 1125, y: 205, h: 470 };

/** Punto donde cae, sobre la mesa, la sombra de (x, y, h). */
export function shadowPt(x, y, h) {
  const k = LIGHT.h / Math.max(40, LIGHT.h - h);
  return [LIGHT.x + (x - LIGHT.x) * k, LIGHT.y + (y - LIGHT.y) * k];
}
/** Ángulo (rad) desde (x, y) hacia la vela: para orientar filos de luz y brillos. */
export const lightAng = (x, y) => Math.atan2(LIGHT.y - y, LIGHT.x - x);
/** Titileo de la llama (≈ 0,88–1,12). */
export const flicker = (t) => 1 + 0.075 * noise1(t * 7.3, 5) + 0.045 * noise1(t * 19.7, 6) + 0.02 * noise1(t * 41, 7);

// ------------------------------------------------------------------ desenfoque barato
let half = null, half2 = null;
/**
 * Desenfoque barato: dibuja fn directamente a MEDIA resolución, la desenfoca ahí (blur px/2) y la vuelve a escalar.
 * Para el cambio de foco del final (no para detalle fino). fn no debe usar layer().
 */
export function halfBlur(ctx, px, fn, alpha = 1) {
  half ??= makeCanvas(960, 540);
  half2 ??= makeCanvas(960, 540);
  const hc = half.getContext('2d');
  hc.setTransform(1, 0, 0, 1, 0, 0);
  hc.clearRect(0, 0, 960, 540);
  const m = ctx.getTransform();
  hc.setTransform(m.a * 0.5, m.b * 0.5, m.c * 0.5, m.d * 0.5, m.e * 0.5, m.f * 0.5);
  hc.save();
  fn(hc);
  hc.restore();
  const h2 = half2.getContext('2d');
  h2.setTransform(1, 0, 0, 1, 0, 0);
  h2.clearRect(0, 0, 960, 540);
  // ojo: en Skia los radios chicos (< 2 px) son mucho más caros que los medianos
  h2.filter = `blur(${Math.max(2, px / 2).toFixed(2)}px)`;
  h2.drawImage(half, 0, 0);
  h2.filter = 'none';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= alpha;
  ctx.drawImage(half2, 0, 0, 1920, 1080);
  ctx.restore();
}
