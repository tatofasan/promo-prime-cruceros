// Fondo del cierre con el kit de ART: atardecer dorado sobre el mar. Planos (de lejos a cerca): cielo con rayos
// y bruma (0,08) · cirros altos · sol bajo que toca el horizonte · mar en filas con parallax (adelante más rápido,
// olas altas y con su propio tiempo que se acelera con cada bombo) · crucero que avanza con su estela · gaviotas
// (0,3 / 0,45 / bandada 0,5 / par alto 0,7) · gaviotas CERCANAS que bajan en diagonal hacia el sol (0,6) · motas
// de luz en primer plano (1,35). Con cada bombo: destellos en el agua, ola de luz que rueda hacia cámara por el
// camino del sol y bombeo de luz del atardecer (con una leve anticipación: el fondo se apaga antes del golpe).
// Lo lejano casi no se mueve: se pinta a 15–30 cuadros/s en una caché por tiempo cuantizado (qcache.js) y
// encima van, a 60, el latido del sol con el bombo, el flare (pico en close.final), el mar, los destellos que
// titilan con el bombo y el barco. (Las nubes oscuras de las esquinas, cortadas por el cuadro, se sacaron.)
import { W, H, BEAT } from '../../engine/time.js';
import { plane } from '../../engine/camera.js';
import { rad, sparkle } from '../../engine/draw.js';
import { clamp, TAU } from '../../engine/ease.js';
import { hash } from '../../engine/noise.js';
import { PAL, mixHex } from '../../engine/color.js';
import { drawSky, skyPoint, drawSun, drawFlare, drawOcean, seaDepth, drawShip, drawGulls, gull, initArt } from '../../art/index.js';
import { ca } from '../../art/util.js';
import { LOOK, HORIZON, SUN, SHIP_AT } from './look.js';
import { drawMotes } from './motes.js';
import { makeQCache } from './qcache.js';
import { drawWisps } from './wisps.js';

// a 30 cuadros/s mientras la cámara se abre después de la ola, a 15 cuando ya casi no se mueve
const FAR = makeQCache(W, H, (t) => (t < 26.95 ? 30 : 15), 2);

export async function initBackdrop() {
  await initArt({});
  FAR.init();
}

const zf08 = (cam) => Math.pow(cam.z || 1, 0.08);

// cielo + sol (sin flare ni latido) + cirros: todo lo del plano lejano
function drawFar(ctx, t, cam) {
  const P = LOOK;
  drawSky(ctx, t, { preset: P, horizonY: HORIZON, sunX: SUN.x, sunY: SUN.y, cam, rays: 1.1 });
  const [sx, sy] = skyPoint(cam, SUN.x, SUN.y);
  const hy = skyPoint(cam, SUN.x, HORIZON)[1];
  drawSun(ctx, t, sx, sy, SUN.r * zf08(cam), { preset: P, flare: 0, horizon: hy });
  drawWisps(ctx, t, cam);
}

// destellos del agua con el bombo: en cada beat se encienden chispas sobre el camino del sol (cada beat otras)
function kickGlints(ctx, t, cam, kick) {
  if (kick < 0.04) return;
  const k = Math.floor((t - 26.25) / BEAT + 1e-6);
  const [sx] = skyPoint(cam, SUN.x, SUN.y);
  for (let i = 0; i < 60; i++) {
    const f = Math.pow(hash(k, i, 501), 1.6);            // 0 horizonte → 1 abajo
    const y = HORIZON + 12 + f * (H - HORIZON - 30);
    const spread = 120 + 760 * f;
    const x = sx + (hash(k, i, 502) + hash(k, i, 503) - 1) * spread;
    const sz = (7 + 30 * f) * (0.6 + 0.4 * hash(k, i, 504)) * Math.min(1.15, kick);
    sparkle(ctx, x, y, sz, { alpha: Math.min(1, kick * 1.3), color: i % 4 ? PAL.goldPale : '#ffffff', rot: hash(k, i, 505) * TAU, halo: 0.7 });
  }
}

// bandada en V que cruza el cielo alto de izquierda a derecha durante todo el cierre (plano 0,5)
const FLOCK = Array.from({ length: 7 }, (_, i) => ({ k: i, row: Math.ceil(i / 2), side: i % 2 ? 1 : -1 }));
function flock(ctx, t) {
  const L = LOOK.sky.light;
  const col = { top: mixHex(PAL.navy900, PAL.dusk, 0.3), under: mixHex(PAL.navy800, PAL.dusk, 0.35), tip: PAL.ink, body: mixHex(PAL.navy900, PAL.dusk, 0.25), rim: L.rim, beak: mixHex(PAL.gold, PAL.navy900, 0.5) };
  const d = t - 26.55;
  if (d < 0) return;
  const lead = -200 + 610 * d; // cruza todo el cierre
  for (const g of FLOCK) {
    const x = lead - g.row * 70 + Math.sin(t * 1.3 + g.k) * 6;
    const y = 118 + g.side * g.row * 26 - 0.05 * x + Math.sin(t * 1.7 + g.k * 2) * 5;
    if (x < -120 || x > W + 120) continue;
    const ph = t * TAU * (2.2 + 0.25 * hash(g.k, 701)) + g.k * 1.3;
    gull(ctx, x, y, 42 - g.row * 4, Math.sin(ph), 1, col, true, -0.04);
  }
}

// gaviotas que cruzan (plano 0,7): un par arriba de la placa, de izquierda a derecha, mientras se tipea la URL
const CROSS = [
  { t0: 26.95, y: 96, R: 50, v: 620, seed: 3, dir: 1, dy: -0.01 },
  { t0: 27.12, y: 130, R: 40, v: 560, seed: 4, dir: 1, dy: -0.008 },
];
// gaviotas CERCANAS (plano 0,6: más parallax que el cielo y que el barco, menos que el mar de adelante) que pasan
// rápido en silueta por la franja encendida entre la URL y el horizonte, rumbo al sol como el barco: entran altas
// por la izquierda (por arriba del barco, sin taparlo) y bajan en diagonal hasta pasar por debajo de la URL y
// delante del sol. Siempre hay una o dos cruzando de 26,5 a 30, sin chocarse (mismo sentido, separadas ~1 s). Ni
// la URL (y ≤ 522) ni el CTA (y ≥ 770) quedan tapados: con el vaivén las alas no suben de y ≈ 525.
const NEAR = [
  { t0: 26.42, y: 548, R: 106, v: 1120, seed: 5, dir: 1, dy: 0.064, xMax: 1050 },
  { t0: 27.3, y: 554, R: 86, v: 1040, seed: 6, dir: 1, dy: 0.058, xMax: 1050 },
  { t0: 28.12, y: 550, R: 110, v: 1100, seed: 1, dir: 1, dy: 0.064, xMax: 1050 },
  { t0: 28.98, y: 556, R: 92, v: 1060, seed: 2, dir: 1, dy: 0.058, xMax: 1050 },
  { t0: 29.62, y: 548, R: 100, v: 1120, seed: 7, dir: 1, dy: 0.064, xMax: 1050 },
];
function crossingGulls(ctx, t, list) {
  const L = LOOK.sky.light;
  const col = { top: mixHex(PAL.navy900, PAL.dusk, 0.25), under: mixHex(PAL.navy800, PAL.dusk, 0.3), tip: PAL.ink, body: mixHex(PAL.navy900, PAL.dusk, 0.2), rim: L.rim, beak: mixHex(PAL.gold, PAL.navy900, 0.5) };
  for (const g of list) {
    const d = t - g.t0;
    if (d < 0) continue;
    const x = g.dir < 0 ? W + 1.3 * g.R - g.v * d : -1.3 * g.R + g.v * d;
    if (x < -1.5 * g.R || x > W + 1.5 * g.R) continue;
    const ph = t * TAU * (g.R > 80 ? 2.9 : 2.4) + g.seed * 1.7;
    const glide = clamp(0.5 + 0.5 * Math.sin(t * 1.3 + g.seed)); // aletea y planea
    const f = Math.sin(ph) * (0.35 + 0.65 * glide);
    const y = g.y + g.dy * Math.min(g.dir < 0 ? W - x : x, g.xMax ?? Infinity) + Math.sin(t * 2 + g.seed) * 6 - Math.cos(ph) * 3;
    gull(ctx, x, y, g.R, f, g.dir, col, true, -0.05 + Math.sin(t * 0.9 + g.seed) * 0.05);
  }
}

// el agua titila: destellos cortos repartidos por todo el mar (más densos y largos cerca del camino del sol),
// cada uno nace, brilla y se apaga en 0,3–0,6 s y vuelve a nacer en otro lugar; corren con el oleaje y el bombo
// los aviva
const SHIM = 70;
function shimmer(ctx, t, cam, kick) {
  const [sx] = skyPoint(cam, SUN.x, SUN.y);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < SHIM; i++) {
    const rate = 1.6 + 1.6 * hash(i, 601);
    const ph = t * rate + hash(i, 602);
    const cyc = Math.floor(ph), u = ph - cyc;
    const life = Math.pow(Math.sin(Math.PI * u), 2);
    if (life < 0.04) continue;
    const f = Math.pow(hash(i, cyc, 603), 1.35);                       // 0 horizonte → 1 abajo
    const y = HORIZON + 10 + f * (H - HORIZON - 10) + cam.y * 0.4 * f;
    const nearSun = hash(i, cyc, 604) < 0.55;
    const spread = nearSun ? 60 + 560 * f : 1100;
    const x0 = nearSun ? sx + (hash(i, cyc, 605) + hash(i, cyc, 606) - 1) * spread : -100 + hash(i, cyc, 605) * (W + 200);
    const x = x0 + (t - cyc / rate) * (20 + 140 * f) - cam.x * f;
    const len = (6 + 70 * f) * (0.5 + hash(i, cyc, 607)) * (nearSun ? 1 : 0.6);
    const a = Math.min(1, life * (nearSun ? 0.85 : 0.5) * (1 + 0.8 * kick));
    ctx.strokeStyle = ca(i % 3 ? PAL.goldPale : '#ffffff', a);
    ctx.lineWidth = 1.2 + 3.2 * f;
    ctx.beginPath();
    ctx.moveTo(x - len / 2, y);
    ctx.lineTo(x + len / 2, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ola de LUZ con cada bombo: el sol «cae» al agua y el brillo rueda por el camino de luz hacia la cámara (se abre
// con la perspectiva y se apaga en 0,45 s), con destellos montados en el frente que viajan con ella
const RIPPLE_FROM = 26.71875, RIPPLE_DUR = 0.45;
function lightRipples(ctx, t, cam, gain) {
  if (t < RIPPLE_FROM) return;
  const [sx] = skyPoint(cam, SUN.x, SUN.y);
  const hy = skyPoint(cam, SUN.x, HORIZON)[1];
  const k0 = Math.floor((t - RIPPLE_FROM) / BEAT + 1e-6);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let k = k0 - 1; k <= k0; k++) {
    const dt = t - (RIPPLE_FROM + k * BEAT);
    if (k < 0 || dt < 0 || dt > RIPPLE_DUR) continue;
    const p = dt / RIPPLE_DUR;
    const y = hy + 8 + (H + 90 - hy) * Math.pow(p, 1.55);
    const hh = 8 + 95 * p;                       // medio alto de la banda
    const hw = 160 + 980 * Math.pow(p, 0.9);     // medio ancho (el camino del sol se abre hacia abajo)
    const a = gain * 0.42 * Math.pow(1 - p, 0.8) * Math.min(1, p * 8);
    if (a < 0.01) continue;
    ctx.save();
    ctx.translate(sx - 40 * p, y);
    ctx.scale(hw / hh, 1);
    ctx.fillStyle = rad(ctx, 0, 0, hh, [[0, ca(PAL.goldLight, a)], [0.45, ca(PAL.gold, a * 0.55)], [1, ca(PAL.coral, 0)]]);
    ctx.fillRect(-hh, -hh, hh * 2, hh * 2);
    ctx.restore();
    // destellos sobre el frente de la banda
    for (let i = 0; i < 16; i++) {
      const u = hash(k, i, 801) * 2 - 1;
      const x = sx - 40 * p + u * hw * 0.8;
      const yy = y + (hash(k, i, 802) - 0.5) * hh * 0.9;
      const life = (1 - p) * (1 - Math.abs(u) * 0.6);
      const sz = (6 + 26 * p) * (0.6 + 0.6 * hash(k, i, 803));
      sparkle(ctx, x, yy, sz, { alpha: Math.min(1, life * 1.3 * gain), color: i % 3 ? PAL.goldPale : '#ffffff', rot: hash(k, i, 804) * TAU, halo: 0.6 });
    }
  }
  ctx.restore();
}

/**
 * camAt(t) → cámara del fondo · o = { flare 0..1.5, sunPulse 0..1, horn (t del bocinazo), glint 0..1, kick 0..1 }
 */
export function drawBackdrop(ctx, t, camAt, o = {}) {
  const P = LOOK;
  const cam = camAt(t);
  const kick = o.kick ?? 0;
  ctx.drawImage(FAR.get(t, (c, tq) => drawFar(c, tq, camAt(tq))), 0, 0);

  // latido del sol con el bombo y flare, en vivo
  const [sx, sy] = skyPoint(cam, SUN.x, SUN.y);
  const r = SUN.r * zf08(cam);
  const pulse = o.sunPulse ?? 0;
  if (pulse > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const R = r * 8;
    ctx.fillStyle = rad(ctx, sx, sy, R, [[0, ca(P.sky.sun.core, 0.6 * pulse)], [0.18, ca(P.sky.sun.glow, 0.42 * pulse)], [0.55, ca(P.sky.sun.glow, 0.12 * pulse)], [1, ca(P.sky.sun.glow, 0)]]);
    ctx.fillRect(sx - R, sy - R, R * 2, R * 2);
    ctx.restore();
  }
  const flare = (o.flare ?? 0.6) + 0.35 * kick; // el flare también late con el bombo
  if (flare > 0.01) drawFlare(ctx, t, sx, sy, r * (1 + pulse * 0.06), flare, P.sky.sun, true);

  // mar más vivo: adelante corre más que el horizonte (la velocidad crece con la cercanía de cada fila)
  // (el mar corre en su propio tiempo: se acelera después de cada bombo; olas de adelante más altas)
  drawOcean(ctx, o.seaT ?? t, { preset: P, horizonY: HORIZON, cam, sunX: SUN.x, sunY: SUN.y, glitter: 1.15 + 0.4 * (o.glint ?? 0) + 0.5 * kick, swell: 2.2, speed: 5.2 });
  shimmer(ctx, t, cam, kick);
  kickGlints(ctx, t, cam, kick);
  lightRipples(ctx, t, cam, o.groove ?? 1);
  // el crucero navega hacia el sol con su estela (avanza ~40 px en el cierre); en close.final toca bocina
  const sy0 = SHIP_AT.y;
  plane(ctx, cam, seaDepth(sy0, HORIZON), (c) => {
    drawShip(c, t, { x: SHIP_AT.x + SHIP_AT.vx * (t - 26), y: sy0, scale: SHIP_AT.scale, preset: P, dir: 1, smoke: 0.18, horn: o.horn, wakeLen: 700 });
  });
  plane(ctx, cam, 0.3, (c) => {
    drawGulls(c, t, { preset: P, count: 2, area: { x: -100, y: 70, w: 2100, h: 90 }, scale: 0.62, seed: 11, dir: 1, speed: 0.8 });
    drawGulls(c, t, { preset: P, count: 2, area: { x: 980, y: 560, w: 520, h: 50 }, scale: 0.32, seed: 4, dir: -1, speed: 0.6 });
  });
  // una gaviota más cerca (plano 0,45) cruza a la izquierda por arriba de la placa: acción secundaria y profundidad
  plane(ctx, cam, 0.45, (c) => drawGulls(c, t, { preset: P, count: 1, area: { x: -100, y: 120, w: 2100, h: 30 }, scale: 1.3, seed: 34, dir: -1, speed: 1 }));
  plane(ctx, cam, 0.5, (c) => flock(c, t));
  plane(ctx, cam, 0.7, (c) => crossingGulls(c, t, CROSS));
  plane(ctx, cam, 0.6, (c) => crossingGulls(c, t, NEAR));
  plane(ctx, cam, 1.35, (c) => drawMotes(c, t, kick));
  // bombeo de luz con el bombo: el atardecer «respira» (más fuerte cerca del sol; la marca y el CTA van encima)
  const lk = o.light ?? kick;
  if (lk > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const R = 1900;
    ctx.fillStyle = rad(ctx, sx, sy, R, [[0, ca('#FFD9A0', 0.4 * lk)], [0.35, ca('#FFA070', 0.24 * lk)], [0.7, ca('#FF6F8E', 0.15 * lk)], [1, ca('#C860C8', 0.1 * lk)]]);
    ctx.fillRect(0, 0, W, H);
    // y el reflejo del sol en el agua se enciende (elipse dorada sobre el camino de luz)
    const hy = skyPoint(cam, SUN.x, HORIZON)[1];
    ctx.translate(sx, hy + 170);
    ctx.scale(1, 0.42);
    ctx.fillStyle = rad(ctx, 0, 0, 760, [[0, ca(PAL.goldLight, 0.36 * lk)], [0.45, ca(PAL.gold, 0.17 * lk)], [1, ca(PAL.coral, 0)]]);
    ctx.fillRect(-760, -760, 1520, 1520);
    ctx.restore();
  } else if (lk < -0.01) {
    // anticipación del bombo: el fondo se apaga apenas (toma aire) justo antes del golpe de luz
    ctx.save();
    ctx.fillStyle = rad(ctx, sx, sy, 1700, [[0, ca('#1A0F3A', 0.3 * -lk)], [1, ca('#1A0F3A', 0.5 * -lk)]]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
