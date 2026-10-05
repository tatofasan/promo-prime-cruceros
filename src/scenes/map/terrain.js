// Océano y continentes del mapa: fondo navy con charco de luz, retícula, halo de aguas bajas y curvas de
// profundidad (precalculadas en un bitmap), y continentes como placas 2.5D en 3 tonos (canto, cara, sombra
// interna, filo de luz arriba a la izquierda) con una textura propia pegada al mapa (manchas + grano).
// La luz viene de arriba a la izquierda.
import { W, H } from '../../engine/time.js';
import { PAL, mixHex, rgba } from '../../engine/color.js';
import { makeCanvas } from '../../engine/env.js';
import { grainCanvasFor } from '../../engine/draw.js';
import { clamp } from '../../engine/ease.js';
import { fbm2 } from '../../engine/noise.js';
import { geo, CITIES, SHALLOW } from './world.js';
import { applyCam, toScr } from './mapcam.js';
import { PAD, fullRect } from './soft.js';

export const LAND = {
  base: mixHex(PAL.ocean600, PAL.ocean500, 0.25),
  baseHi: mixHex(PAL.ocean500, PAL.aqua300, 0.32),
  baseLo: mixHex(PAL.ocean700, PAL.ocean600, 0.4),
  shadow: mixHex(PAL.ocean700, PAL.navy600, 0.45),
  rim: PAL.aqua200,
  side: PAL.navy900,
};

// bitmaps en coordenadas de mapa (escala R): fondo marino y textura de la tierra
const BOX = { x0: -1750, y0: -980, x1: 1560, y1: 1140, R: 0.8 };
let BG = null, TEX = null;
// filo de luz: caminos «rectángulo + costa corrida» precalculados por escalón de zoom (el corrimiento es
// en px de pantalla). Armarlos en cada cuadro copiaba la costa entera; trazar la costa costaba ~40 ms.
const RIM = 1.6, Z0 = 0.5, ZK = 1.2, NZ = 22;
let RIMS = null;
const zBucket = (z) => Math.max(0, Math.min(NZ - 1, Math.round(Math.log(z / Z0) / Math.log(ZK))));
function buildRims() {
  const { land, landLo } = geo();
  RIMS = { hi: [], lo: [] };
  for (let k = 0; k < NZ; k++) {
    const zb = Z0 * Math.pow(ZK, k);
    for (const [key, path] of [['hi', land], ['lo', landLo]]) {
      const rp = new Path2D();
      rp.rect(-6000, -4000, 12000, 8000);
      rp.addPath(path, new DOMMatrix([1, 0, 0, 1, (RIM * 0.7) / zb, RIM / zb]));
      RIMS[key].push(rp);
    }
  }
}

function canvasFor() {
  const w = Math.ceil((BOX.x1 - BOX.x0) * BOX.R), h = Math.ceil((BOX.y1 - BOX.y0) * BOX.R);
  const c = makeCanvas(w, h);
  return [c, c.getContext('2d'), w, h];
}
const toMap = (cx) => cx.setTransform(BOX.R, 0, 0, BOX.R, -BOX.x0 * BOX.R, -BOX.y0 * BOX.R);

export function initTerrain() {
  if (BG) return;
  buildRims();
  const { land, landLo } = geo();
  const [c, x, w, h] = canvasFor();
  const [tmp, tx] = canvasFor();
  // curvas de profundidad: anillos a distancia d de la costa (sobre la costa suavizada de 110m)
  const rings = [[5, 0.2, 1.4], [11, 0.14, 1.3], [19, 0.1, 1.2], [30, 0.065, 1.1]];
  for (const [d, a, lw] of rings) {
    tx.setTransform(1, 0, 0, 1, 0, 0);
    tx.clearRect(0, 0, w, h);
    toMap(tx);
    tx.lineJoin = 'round';
    tx.strokeStyle = '#fff';
    tx.lineWidth = 2 * d + lw;
    tx.stroke(landLo);
    tx.globalCompositeOperation = 'destination-out';
    tx.lineWidth = 2 * d - lw;
    tx.stroke(landLo);
    tx.globalCompositeOperation = 'source-in';
    tx.setTransform(1, 0, 0, 1, 0, 0);
    tx.fillStyle = rgba(PAL.aqua300, a);
    tx.fillRect(0, 0, w, h);
    tx.globalCompositeOperation = 'source-over';
    x.drawImage(tmp, 0, 0);
  }
  // halo de aguas bajas (turquesa suave pegado a la costa)
  x.save();
  toMap(x);
  x.filter = `blur(${(10 * BOX.R).toFixed(1)}px)`;
  x.strokeStyle = rgba(PAL.ocean500, 0.34);
  x.lineWidth = 22;
  x.lineJoin = 'round';
  x.stroke(landLo);
  x.filter = `blur(${(3 * BOX.R).toFixed(1)}px)`;
  x.strokeStyle = rgba(PAL.ocean400, 0.3);
  x.lineWidth = 7;
  x.stroke(land);
  // sombra suave de las placas
  x.filter = `blur(${(5 * BOX.R).toFixed(1)}px)`;
  x.translate(4, 7);
  x.fillStyle = rgba(PAL.ink, 0.62);
  x.fill(land);
  x.translate(-4, -7);
  // aguas bajas (Río de la Plata): turquesa medio con borde muy blando hacia el mar abierto; la tierra tapa el
  // resto. Va ENCIMA de la sombra de las placas: en un estuario angosto la sombra lo volvía una cuña negra.
  x.filter = `blur(${(4.5 * BOX.R).toFixed(1)}px)`;
  for (const poly of Object.values(SHALLOW)) {
    const sp = new Path2D();
    poly.forEach(([px, py], i) => (i ? sp.lineTo(px, py) : sp.moveTo(px, py)));
    sp.closePath();
    x.fillStyle = rgba(PAL.ocean700, 0.9);
    x.fill(sp);
  }
  x.restore();
  BG = c;

  // textura de la tierra: interior apenas más oscuro, franja costera más clara (llanuras), manchas muy
  // suaves de relieve y grano fino. Todo pegado al mapa y recortado a la tierra.
  const [t, tc] = canvasFor();
  toMap(tc);
  tc.fillStyle = rgba(PAL.navy900, 0.22);
  tc.fill(land);
  tc.globalCompositeOperation = 'destination-out';
  tc.filter = `blur(${(9 * BOX.R).toFixed(1)}px)`;
  tc.strokeStyle = '#000';
  tc.lineWidth = 34;
  tc.lineJoin = 'round';
  tc.stroke(landLo);
  tc.globalCompositeOperation = 'source-over';
  tc.filter = `blur(${(2.2 * BOX.R).toFixed(1)}px)`;
  tc.strokeStyle = rgba(PAL.aqua200, 0.2);
  tc.lineWidth = 7;
  tc.stroke(land);
  tc.filter = 'none';
  tc.setTransform(1, 0, 0, 1, 0, 0);
  const lw = Math.ceil(w / 6), lh = Math.ceil(h / 6);
  const small = makeCanvas(lw, lh);
  const sc = small.getContext('2d');
  const img = sc.createImageData(lw, lh);
  for (let j = 0; j < lh; j++) {
    for (let i = 0; i < lw; i++) {
      const n = fbm2(i * 0.13, j * 0.13, 77, 4);
      const k = (j * lw + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = n > 0 ? 255 : 0;
      img.data[k + 3] = Math.min(255, Math.abs(n) * 38);
    }
  }
  sc.putImageData(img, 0, 0);
  tc.imageSmoothingQuality = 'high';
  tc.drawImage(small, 0, 0, w, h);
  tc.globalAlpha = 0.06;
  tc.fillStyle = tc.createPattern(grainCanvasFor(), 'repeat');
  tc.fillRect(0, 0, w, h);
  tc.globalAlpha = 1;
  tc.globalCompositeOperation = 'destination-in';
  toMap(tc);
  tc.fillStyle = '#fff';
  tc.fill(land);
  // fronteras finitas y tenues (van en el bitmap: dibujarlas vectoriales costaba ~12 ms por cuadro)
  tc.globalCompositeOperation = 'source-over';
  tc.lineWidth = 1.1;
  tc.lineJoin = 'round';
  tc.strokeStyle = rgba(PAL.aqua100, 0.22);
  tc.stroke(geo().borders);
  TEX = t;
}

// Pega solo la parte visible del bitmap (con margen por el roll): drawImage del bitmap entero con zoom
// grande es carísimo en Skia.
function blitMap(ctx, cam, img, alpha = 1) {
  const m = (80 + PAD) / cam.z;
  const hw = W / 2 / cam.z + m, hh = H / 2 / cam.z + m;
  const x0 = Math.max(BOX.x0, cam.cx - hw), y0 = Math.max(BOX.y0, cam.cy - hh);
  const x1 = Math.min(BOX.x1, cam.cx + hw), y1 = Math.min(BOX.y1, cam.cy + hh);
  if (x1 <= x0 || y1 <= y0) return;
  const R = BOX.R;
  const sx = Math.floor((x0 - BOX.x0) * R), sy = Math.floor((y0 - BOX.y0) * R);
  const sw = Math.min(img.width - sx, Math.ceil((x1 - x0) * R) + 2), sh = Math.min(img.height - sy, Math.ceil((y1 - y0) * R) + 2);
  ctx.save();
  applyCam(ctx, cam);
  ctx.globalAlpha *= alpha;
  ctx.drawImage(img, sx, sy, sw, sh, BOX.x0 + sx / R, BOX.y0 + sy / R, sw / R, sh / R);
  ctx.restore();
}

/** Fondo: degradé navy con charco de luz arriba a la izquierda, retícula y el bitmap de halos y sombras. */
export function drawOcean(ctx, cam) {
  const g = ctx.createRadialGradient(W * 0.36, H * 0.3, 40, W * 0.5, H * 0.55, W * 0.82);
  g.addColorStop(0, PAL.navy700);
  g.addColorStop(0.4, PAL.navy800);
  g.addColorStop(1, PAL.navy900);
  ctx.fillStyle = g;
  ctx.fillRect(...fullRect());
  ctx.save();
  applyCam(ctx, cam);
  ctx.lineWidth = 1.1 / cam.z;
  ctx.strokeStyle = rgba(PAL.aqua300, 0.085);
  ctx.stroke(geo().grat);
  ctx.restore();
  blitMap(ctx, cam, BG);
}

/**
 * Continentes como placas: canto oscuro (espesor hacia abajo a la derecha), cara con degradé de luz,
 * banda de sombra interna abajo/derecha, textura pegada al mapa y filo de luz arriba/izquierda.
 * glow 0..1 los ilumina (map.all).
 */
export function drawLand(ctx, cam, t, { glow = 0 } = {}) {
  // en tomas abiertas alcanza la costa de 110m (mismo aspecto, la mitad de costo)
  const land = cam.z < 0.9 ? geo().landLo : geo().land;
  const z = cam.z;
  const thick = clamp(2.2 + z * 0.9, 2.6, 6.5);
  const base = ctx.getTransform();
  // canto
  ctx.save();
  ctx.translate(thick * 0.55, thick);
  applyCam(ctx, cam);
  ctx.fillStyle = LAND.side;
  ctx.fill(land);
  ctx.restore();

  ctx.save();
  applyCam(ctx, cam);
  ctx.clip(land);
  ctx.setTransform(base);
  // banda de sombra interna: queda donde la tierra corrida hacia arriba-izquierda no tapa
  ctx.fillStyle = LAND.shadow;
  ctx.fillRect(...fullRect());
  const sh = 4.5;
  ctx.save();
  ctx.translate(-sh * 0.7, -sh);
  applyCam(ctx, cam);
  const face = ctx.createLinearGradient(cam.cx - 900 / z, cam.cy - 560 / z, cam.cx + 900 / z, cam.cy + 560 / z);
  face.addColorStop(0, mixHex(LAND.baseHi, PAL.aqua300, glow * 0.3));
  face.addColorStop(0.5, mixHex(LAND.base, PAL.ocean500, glow * 0.35));
  face.addColorStop(1, mixHex(LAND.baseLo, PAL.ocean600, glow * 0.3));
  ctx.fillStyle = face;
  ctx.fill(land);
  ctx.restore();
  // filo de luz arriba-izquierda: lo que la tierra corrida hacia abajo-derecha deja ver (par/impar)
  ctx.setTransform(base);
  applyCam(ctx, cam);
  ctx.fillStyle = rgba(LAND.rim, 0.72 + glow * 0.28);
  ctx.fill(RIMS[cam.z < 0.9 ? 'lo' : 'hi'][zBucket(z)], 'evenodd');
  ctx.restore();
  // textura (ya recortada a la tierra en el bitmap)
  blitMap(ctx, cam, TEX, 0.9);
}

/** Luces de ciudades: puntitos dorados con halo que titilan (detalle para la segunda mirada). */
export function drawCities(ctx, cam, t, { boost = 0 } = {}) {
  const z = cam.z;
  const hw = (W / 2 + PAD) / z + 20, hh = (H / 2 + PAD) / z + 20;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < CITIES.length; i++) {
    const [x, y, w] = CITIES[i];
    if (Math.abs(x - cam.cx) > hw || Math.abs(y - cam.cy) > hh) continue;
    const [sx, sy] = toScr(cam, x, y);
    const tw = 0.7 + 0.3 * Math.sin(t * (2 + (i % 5) * 0.7) + i * 1.9);
    const r = (1.2 + 1.6 * w) * Math.min(1.6, 0.75 + z * 0.22) * (1 + boost * 0.4);
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 4.5);
    g.addColorStop(0, rgba(PAL.goldPale, 0.9 * tw));
    g.addColorStop(0.25, rgba(PAL.gold, 0.45 * tw));
    g.addColorStop(1, rgba(PAL.gold, 0));
    ctx.fillStyle = g;
    ctx.fillRect(sx - r * 4.5, sy - r * 4.5, r * 9, r * 9);
  }
  ctx.restore();
}
