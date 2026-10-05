// Nubes estilizadas en capas: lóbulos redondos con base plana, sombreado en 3 tonos (filo de luz del lado
// del sol, cuerpo y sombra plana abajo/del lado opuesto) más una franja profunda en la panza y grano sutil.
// Cada silueta se pinta UNA vez en un sprite (makeCanvas) por preset y se reutiliza: dibujar cuesta un drawImage.
import { W } from '../engine/time.js';
import { makeCanvas } from '../engine/env.js';
import { rng, hash } from '../engine/noise.js';
import { texture } from '../engine/draw.js';
import { resolve, PRESET_NAMES } from './presets.js';
import { camPt, camZ, unit } from './util.js';

const RS = 1.6; // resolución de los sprites (para aguantar push-ins sin pixelar)
const VARIANTS = 6;
const shapes = new Map(); // seed → [formas]
const sprites = new Map(); // `${preset}|${seed}|${i}` → canvas

function shapesFor(seed) {
  let S = shapes.get(seed);
  if (S) return S;
  const r = rng(seed * 101 + 7);
  S = [];
  for (let v = 0; v < VARIANTS; v++) {
    const w = 300 + r() * 280;
    const n = 5 + Math.floor(r() * 4);
    const lobes = [];
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const bell = Math.sin(Math.PI * (0.12 + 0.76 * u));
      const rr = w * (0.09 + 0.12 * bell * (0.65 + 0.35 * r()));
      const x = -w / 2 + w * (0.1 + 0.8 * u) + (r() - 0.5) * w * 0.05;
      lobes.push([x, -rr * (0.38 + 0.5 * r()), rr]);
    }
    // segunda fila de lóbulos arriba (más volumen)
    const m = 1 + Math.floor(r() * 3);
    for (let j = 0; j < m; j++) {
      const x = (r() - 0.5) * w * 0.45;
      const rr = w * (0.11 + 0.08 * r());
      lobes.push([x, -rr * 1.25 - w * 0.05, rr]);
    }
    const top = Math.min(...lobes.map(([, y, rr]) => y - rr));
    // base irregular: algunas variantes bajan lóbulos por debajo de la línea de base (panza despareja)
    S.push({ w, lobes, h: -top + w * 0.03, base: w * 0.1, wav: 0.4 + 0.6 * r(), ph: r() * 6 });
  }
  shapes.set(seed, S);
  return S;
}

function cloudPath(sh, dx = 0, dy = 0) {
  const p = new Path2D();
  for (const [x, y, rr] of sh.lobes) { p.moveTo(x + dx + rr, y + dy); p.arc(x + dx, y + dy, rr, 0, Math.PI * 2); }
  // base plana redondeada
  const bw = sh.w * 0.86, bh = sh.w * 0.075;
  p.moveTo(-bw / 2 + bh + dx, -bh + dy);
  p.arcTo(bw / 2 + dx, -bh + dy, bw / 2 + dx, dy, bh);
  p.lineTo(bw / 2 + dx, dy);
  p.lineTo(-bw / 2 + dx, dy);
  p.arcTo(-bw / 2 + dx, -bh + dy, -bw / 2 + bh + dx, -bh + dy, bh);
  p.closePath();
  return p;
}

function renderSprite(sh, C, light) {
  const pad = 12;
  const cw = Math.ceil((sh.w * 1.15 + pad * 2) * RS), ch = Math.ceil((sh.h + sh.base + pad * 2) * RS);
  const ox = sh.w * 0.575 + pad, oy = sh.h + pad;
  const [lx, ly] = light;
  const full = cloudPath(sh);
  const mk = () => {
    const cv = makeCanvas(cw, ch);
    const c = cv.getContext('2d');
    c.scale(RS, RS);
    c.translate(ox, oy);
    // base: casi plana pero despareja (ondula y deja asomar lóbulos), no una regla
    c.beginPath();
    c.moveTo(-sh.w, -sh.h * 2);
    c.lineTo(sh.w, -sh.h * 2);
    for (let k = 0; k <= 24; k++) {
      const x = sh.w - (2 * sh.w * k) / 24;
      const wv = Math.max(0, Math.sin((x / sh.w) * 5.5 + sh.ph)) * sh.w * 0.05 * sh.wav + Math.max(0, Math.sin((x / sh.w) * 11 + sh.ph * 2)) * sh.w * 0.015;
      c.lineTo(x, wv);
    }
    c.closePath();
    c.clip();
    return [cv, c];
  };
  // diferencia de formas: forma − forma corrida (dx, dy) → la parte de la forma que «no tapa» la copia
  const diff = (color, dx, dy, keepUp = 0) => {
    const [cv, c] = mk();
    c.fillStyle = color;
    c.fill(full);
    c.globalCompositeOperation = 'destination-out';
    c.fill(cloudPath(sh, dx, dy));
    if (keepUp) { c.globalCompositeOperation = 'destination-in'; c.fill(cloudPath(sh, 0, -keepUp)); }
    return cv;
  };
  const [cv, c] = mk();
  // cuerpo
  c.fillStyle = C.base;
  c.fill(full);
  const h = sh.h;
  // sombra plana de la panza (borde festoneado que sigue los lóbulos) y del lado opuesto a la luz
  const sh1 = diff(C.shadow, lx * sh.w * 0.03, -h * 0.26);
  // franja profunda abajo de todo
  const sh2 = diff(C.deep, lx * sh.w * 0.01, -h * 0.09);
  // filo de luz del lado del sol (solo en la mitad de arriba)
  const rim = diff(C.rim, -lx * sh.w * 0.022, -ly * sh.w * 0.022, h * 0.18);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(sh1, 0, 0);
  c.globalAlpha = 0.7;
  c.drawImage(sh2, 0, 0);
  c.globalAlpha = 1;
  c.drawImage(rim, 0, 0);
  c.restore();
  texture(c, full, { alpha: 0.06, scale: 0.7 });
  return { cv, cw: cw / RS, ch: ch / RS, ox, oy };
}

function spriteFor(presetName, seed, i, P) {
  const key = `${presetName}|${seed}|${i}`;
  let s = sprites.get(key);
  if (!s) {
    const L = P.sky.light;
    const [lx, ly] = unit([L.dir[0] * 0.7, Math.min(-0.5, L.dir[1])]);
    s = renderSprite(shapesFor(seed)[i], P.sky.cloud, [lx, ly]);
    sprites.set(key, s);
  }
  return s;
}

/** Precalcula los sprites (opcional: si no, se arman la primera vez que se usan). */
export function initClouds(seeds = [1, 2, 3], presets = PRESET_NAMES) {
  for (const p of presets) for (const sd of seeds) for (let i = 0; i < VARIANTS; i++) spriteFor(p, sd, i, resolve(p));
}

/**
 * drawClouds(ctx, t, { preset, cam, depth, seed, y, density, scale, speed, spread, alpha, x0, x1, bands, cirrus, cluster })
 *  Una CAPA de nubes que deriva y da la vuelta. Para profundidad, llamala 2–3 veces (lejos: depth chico,
 *  scale chico, alpha menor; cerca: depth mayor). En PANTALLA con `cam` (como drawSky).
 *  - y: altura de la base de las nubes (mundo) · spread: variación vertical (px) · density: ~4 nubes por 1
 *  - scale: escala MEDIA; cada nube varía de 0,5 a 1,6 × scale · speed: px/s de deriva
 *  - cluster 1: las nubes se AGRUPAN (una grande adelante y 1–2 chicas detrás, solapadas y más lavadas por la
 *    distancia); 0 = sueltas · bands [w0, w1, …]: densidad por banda horizontal (p. ej. [0.2, 1, 0.4])
 *  - cirrus 0..1: estelas finas tipo cirros en la capa (detrás de las nubes)
 *  - x0/x1: franja horizontal donde viven (def. todo el ancho)
 *  - preset: nombre o mixPreset(a, b, p) (en mezcla se funden los sprites de los dos presets)
 */
export function drawClouds(ctx, t, o = {}) {
  const P = resolve(o.preset ?? 'day');
  const seed = o.seed ?? 1;
  const depth = o.depth ?? 0.15;
  const n = Math.max(1, Math.round(4 * (o.density ?? 1)));
  const scale = o.scale ?? 1;
  const speed = o.speed ?? 8;
  const spread = o.spread ?? 120;
  const y0 = o.y ?? 300;
  const x0 = o.x0 ?? -350, x1 = o.x1 ?? W + 350;
  const span = x1 - x0;
  const zf = camZ(o.cam, depth);
  const names = P.from ? [[P.from, 1 - P.q], [P.to, P.q]] : [[P.name, 1]];
  const clus = o.cluster ?? 1;
  // densidad por banda: u uniforme → u con la distribución de las bandas (inversa de la acumulada)
  const bands = o.bands;
  let cum = null;
  if (bands && bands.length) {
    const tot = bands.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    cum = [0];
    for (const b of bands) cum.push(cum[cum.length - 1] + Math.max(0, b) / tot);
  }
  const warp = (u) => {
    if (!cum) return u;
    for (let k = 1; k < cum.length; k++) if (u <= cum[k]) return (k - 1 + (u - cum[k - 1]) / (cum[k] - cum[k - 1] || 1)) / (cum.length - 1);
    return u;
  };
  ctx.save();
  // cirros: estelas finas detrás
  const ci = o.cirrus ?? 0;
  if (ci > 0.01) {
    const col = P.sky.cloud.rim;
    for (let k = 0; k < Math.round(2 + 4 * ci); k++) {
      const len = (280 + 420 * hash(k, seed, 21)) * scale * zf;
      let wx = x0 + hash(k, seed, 22) * span + t * speed * 1.4;
      wx = x0 + (((wx - x0) % span) + span) % span;
      const wy = y0 - spread * (0.6 + 0.8 * hash(k, seed, 23));
      const [sx, sy] = camPt(o.cam, depth, wx, wy);
      const th = (3 + 6 * hash(k, seed, 24)) * scale * zf;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-0.04 - 0.06 * hash(k, seed, 25));
      const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.35, col);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.globalAlpha = (o.alpha ?? 1) * 0.35 * ci;
      ctx.beginPath(); ctx.ellipse(0, 0, len / 2, th, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha *= 0.6;
      ctx.beginPath(); ctx.ellipse(len * 0.12, th * 2.2, len * 0.3, th * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  // nubes: grupos (una líder y acompañantes detrás) en posiciones despares
  const nc = clus > 0 ? Math.max(1, Math.round(n / (1 + 1.3 * clus))) : n;
  const items = [];
  for (let i = 0; i < n; i++) {
    const c = i % nc, m = Math.floor(i / nc); // grupo y miembro (0 = líder)
    const v = Math.floor(hash(i, seed, 1) * VARIANTS);
    const lead = m === 0;
    const sz = scale * (lead ? 0.85 + 0.75 * Math.pow(hash(i, seed, 2), 0.8) : 0.5 + 0.4 * hash(i, seed, 2));
    const u = warp((c + 0.1 + 0.85 * hash(c, seed, 3)) / nc);
    const side = hash(i, seed, 12) < 0.5 ? -1 : 1;
    const dx = lead ? 0 : side * (0.22 + 0.25 * hash(i, seed, 13)) * 520 * scale;
    let wx = x0 + u * span + dx + t * speed * (0.75 + 0.5 * hash(c, seed, 4));
    wx = x0 + (((wx - x0) % span) + span) % span;
    const wy = y0 + (hash(c, seed, 5) - 0.5) * spread - (lead ? 0 : (12 + 22 * hash(i, seed, 14)) * scale);
    items.push({ v, sz, wx, wy, lead, a: lead ? 1 : 0.72 + 0.12 * hash(i, seed, 15) });
  }
  // atrás primero (acompañantes, más lavados: perspectiva atmosférica), adelante las líderes
  items.sort((p, q) => (p.lead === q.lead ? p.sz - q.sz : p.lead ? 1 : -1));
  for (const it of items) {
    const [sx, sy] = camPt(o.cam, depth, it.wx, it.wy);
    const k = it.sz * zf;
    for (const [name, wgt] of names) {
      if (wgt <= 0.01) continue;
      const s = spriteFor(name, seed, it.v, resolve(name));
      ctx.globalAlpha = (o.alpha ?? 1) * wgt * it.a;
      ctx.drawImage(s.cv, sx - s.ox * k, sy - s.oy * k, s.cw * k, s.ch * k);
    }
  }
  ctx.restore();
}
