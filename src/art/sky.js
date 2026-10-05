// Cielo: degradé del preset, resplandor alrededor del sol, rayos suaves, bruma y nubecitas finas del
// horizonte, y estrellas de noche. Se dibuja en PANTALLA (transformación identidad) y la cámara llega por
// `cam`: el cielo vive en un plano lejano (depth ≈ 0.08), así un push-in casi no lo mueve.
import { W, H } from '../engine/time.js';
import { lin, rad } from '../engine/draw.js';
import { rng } from '../engine/noise.js';
import { TAU } from '../engine/ease.js';
import { skyOf } from './presets.js';
import { ca, camPt, camZ, lowCanvas } from './util.js';

export const SKY_DEPTH = 0.08;

/** Posición en pantalla de un punto del plano del cielo (para ubicar el sol coherente con drawSky). */
export function skyPoint(cam, x, y, depth = SKY_DEPTH) {
  return camPt(cam, depth, x, y);
}
/** Y del horizonte en pantalla para `horizonY` (mundo) y la cámara. */
export function horizonScreen(cam, horizonY, depth = SKY_DEPTH) {
  return camPt(cam, depth, W / 2, horizonY)[1];
}

let STARS = null, STREAKS = null;
function initSky() {
  if (STARS) return;
  const r = rng(7311);
  STARS = [];
  for (let i = 0; i < 260; i++) {
    const big = r() < 0.07;
    STARS.push({ x: r() * W * 1.2 - W * 0.1, y: Math.pow(r(), 1.35), s: big ? 1.6 + r() * 1.6 : 0.5 + r() * 1.1, ph: r() * TAU, hz: 0.6 + r() * 2.2, big });
  }
  const q = rng(9127);
  STREAKS = [];
  for (let i = 0; i < 9; i++) {
    STREAKS.push({ x: q() * 2600 - 340, h: 18 + q() * 30, w: 220 + q() * 520, lift: 0.1 + Math.pow(q(), 1.3) * 0.85, sp: 4 + q() * 9, a: 0.3 + q() * 0.35 });
  }
}
export const initSkyArt = initSky;

/**
 * drawSky(ctx, t, { preset, horizonY, sunX, sunY, cam, stars, rays, haze, streaks, glow, depth })
 *  - horizonY: y del horizonte en el mundo (con cam neutra = pantalla). Def. 620.
 *  - sunX/sunY: posición del sol en el plano del cielo (para el resplandor y los rayos). null = sin sol.
 *  - stars: 0..1 (def. la del preset) · rays 0..1.5 · haze 0..1.5 · streaks 0..1 · glow 0..1.5
 */
export function drawSky(ctx, t, o = {}) {
  initSky();
  const S = skyOf(o.preset ?? 'day');
  const cam = o.cam;
  const depth = o.depth ?? SKY_DEPTH;
  const horizonY = o.horizonY ?? 620;
  const zf = camZ(cam, depth);
  const hy = camPt(cam, depth, W / 2, horizonY)[1];
  const span = (horizonY + 60) * zf;
  const top = hy - span;

  // degradé base (se estira con el zoom del plano)
  ctx.fillStyle = lin(ctx, 0, top, 0, hy, S.stops);
  ctx.fillRect(0, 0, W, H);

  // resplandor del cielo alrededor del sol
  const hasSun = o.sunX !== undefined && o.sunX !== null;
  let sx = 0, sy = 0;
  if (hasSun) {
    [sx, sy] = camPt(cam, depth, o.sunX, o.sunY ?? 260);
    const g = (o.glow ?? 1) * S.glowA;
    if (g > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const R = 1100 * zf;
      ctx.fillStyle = rad(ctx, sx, sy, R, [[0, ca(S.glow, g)], [0.25, ca(S.glow, g * 0.55)], [0.6, ca(S.glow, g * 0.16)], [1, ca(S.glow, 0)]]);
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  // estrellas (titilan)
  const stars = o.stars ?? S.stars;
  if (stars > 0.01) drawStars(ctx, t, stars, hy, top, cam);

  // rayos suaves que giran muy lento (a baja resolución y desenfocados: bordes blandos)
  const rays = (o.rays ?? 1) * S.raysA;
  if (hasSun && rays > 0.003) {
    const k = 0.25, lw = W * k, lh = H * k;
    const A = lowCanvas('sky-rays-a', lw, lh);
    const a = A.getContext('2d');
    a.scale(k, k);
    const R = 1800 * zf;
    const n = 15;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU + t * 0.035 + Math.sin(i * 7.3) * 0.16;
      const wdt = 0.035 + 0.05 * (0.5 + 0.5 * Math.sin(i * 3.1));
      const al = rays * (0.5 + 0.5 * Math.sin(t * 0.6 + i * 1.7));
      a.fillStyle = rad(a, sx, sy, R, [[0, ca(S.rays, al)], [0.45, ca(S.rays, al * 0.45)], [1, ca(S.rays, 0)]]);
      a.beginPath();
      a.moveTo(sx, sy);
      a.arc(sx, sy, R, a0 - wdt, a0 + wdt);
      a.closePath();
      a.fill();
    }
    const B = lowCanvas('sky-rays-b', lw, lh);
    const b = B.getContext('2d');
    b.filter = 'blur(3px)';
    b.drawImage(A, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.beginPath();
    ctx.rect(0, 0, W, hy + 2);
    ctx.clip();
    ctx.drawImage(B, 0, 0, W, H);
    ctx.restore();
  }

  // nubecitas finas del horizonte: lentes afinadas en las puntas, cuerpo + filo de luz + panza en sombra
  const streaks = o.streaks ?? 1;
  if (streaks > 0.01) {
    ctx.save();
    for (const s of STREAKS) {
      const lift = s.lift * 230;
      const [x0, y0] = camPt(cam, depth * 1.6, s.x + t * s.sp, horizonY - lift);
      const span2 = 2600;
      const x = ((x0 % span2) + span2) % span2 - 340;
      const w = s.w * zf, h = s.h * zf * 0.42;
      const a = s.a * streaks * (0.4 + 0.6 * (1 - s.lift));
      lens(ctx, x, y0, w, h, ca(S.streak, a));
      lens(ctx, x + w * 0.12, y0 - h * 0.28, w * 0.6, h * 0.42, ca('#ffffff', a * 0.55));
      lens(ctx, x + w * 0.3, y0 + h * 0.22, w * 0.62, h * 0.22, ca(S.haze2 ?? S.haze, a * 0.35));
    }
    ctx.restore();
  }

  // bruma del horizonte
  const haze = (o.haze ?? 1) * S.hazeA;
  if (haze > 0.01) {
    const hh = 230 * zf;
    ctx.fillStyle = lin(ctx, 0, hy - hh, 0, hy, [[0, ca(S.haze, 0)], [0.7, ca(S.haze2 ?? S.haze, haze * 0.45)], [1, ca(S.haze, haze)]]);
    ctx.fillRect(0, hy - hh, W, hh + 1);
    ctx.fillStyle = lin(ctx, 0, hy - 26 * zf, 0, hy, [[0, ca('#ffffff', 0)], [1, ca('#ffffff', haze * 0.35)]]);
    ctx.fillRect(0, hy - 26 * zf, W, 26 * zf + 1);
  }
  return { hy, top, sun: hasSun ? [sx, sy] : null, zf };
}

/** Lente de nube fina: puntas afinadas, lomo arriba más alto que la panza. */
function lens(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + w * 0.18, y - h * 1.1, x + w * 0.62, y - h * 1.25, x + w, y);
  ctx.bezierCurveTo(x + w * 0.7, y + h * 0.55, x + w * 0.25, y + h * 0.5, x, y);
  ctx.fill();
}

function drawStars(ctx, t, amt, hy, top, cam) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const ox = -((cam && cam.x) || 0) * 0.04;
  for (const s of STARS) {
    const y = top + s.y * (hy - top) * 0.92;
    const fade = Math.min(1, (hy - y) / 160);
    if (fade <= 0) continue;
    const tw = 0.55 + 0.45 * Math.sin(t * s.hz * TAU * 0.5 + s.ph);
    const a = amt * fade * tw * (s.big ? 1 : 0.75);
    if (a < 0.02) continue;
    const x = s.x + ox;
    ctx.fillStyle = `rgba(235,248,255,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, s.s, 0, TAU);
    ctx.fill();
    if (s.big) {
      const L = s.s * 4.5 * (0.7 + 0.3 * tw);
      ctx.fillStyle = `rgba(235,248,255,${(a * 0.5).toFixed(3)})`;
      ctx.fillRect(x - L, y - 0.5, L * 2, 1);
      ctx.fillRect(x - 0.5, y - L, 1, L * 2);
    }
  }
  ctx.restore();
}
