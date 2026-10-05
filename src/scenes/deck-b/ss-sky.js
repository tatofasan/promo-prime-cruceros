// Fondo del atardecer con el kit de ART: cielo (dusk → coral → dorado), nubes en tres capas, el sol que baja,
// el mar con su camino de destellos, una isla lejana en contraluz y gaviotas. Todo en pantalla con la cámara.
// Además: los rayos del reflector del show que siguen en el sol (entrada) y el flare del brindis (exp.cheers).
import { plane } from '../../engine/camera.js';
import { W, beatPulse } from '../../engine/time.js';
import { E, TAU, clamp } from '../../engine/ease.js';
import { PAL, rgba, mixHex } from '../../engine/color.js';
import { rad } from '../../engine/draw.js';
import { drawSky, skyPoint, horizonScreen, drawSun, drawFlare, drawClouds, drawOcean, drawGulls, drawPalm, gull } from '../../art/index.js';
import { HZ, T0, T_B2, T_CHEERS, T_OUT, sunRWorld, sunFlat } from './ss-time.js';

export const PRESET = 'sunset';

/** Centro del sol en pantalla (coherente con el resplandor del cielo y el camino del mar). */
export const sunScreen = (cam) => skyPoint(cam, cam.cx, cam.cy);

/** Golpe del brindis: sube en la anticipación, PICO sostenido 3 cuadros desde el choque y cae. */
export function cheersK(t) {
  const d = t - T_CHEERS;
  if (d < -0.06 || d > 0.9) return 0;
  if (d < 0) return 0.35 * E.inQuad((d + 0.06) / 0.06);
  if (d < 3 / 60) return 1;
  return Math.exp(-(d - 3 / 60) / 0.2);
}

/** Intensidad del flare: base, latido en cada negra y golpe en el brindis. */
function flareK(t) {
  // exp.out: el sol «inhala» con un destello antes de encogerse
  const out = t >= T_OUT ? Math.exp(-(t - T_OUT) / 0.09) : 0;
  return 0.55 + 1.05 * cheersK(t) + 0.9 * out + 0.22 * beatPulse(t, { from: T0, every: 1, decay: 0.14 });
}

/** Cielo, nubes lejanas y sol (lo que va detrás del mar). */
export function drawSkyBack(ctx, t, cam) {
  const sy = cam.cy;
  const flat = sunFlat(t);
  drawSky(ctx, t, { preset: PRESET, horizonY: HZ, sunX: cam.cx, sunY: sy, cam, glow: 1.15 * (1 - flat * 0.35), rays: 1.2 });
  // nubes: bajas y finas junto al horizonte, medias a los costados del sol, altas arriba a la derecha
  drawClouds(ctx, t, { preset: PRESET, cam, depth: 0.1, seed: 3, y: 586, scale: 0.34, alpha: 0.62, density: 1.4, spread: 26, speed: 10 });
  drawClouds(ctx, t, { preset: PRESET, cam, depth: 0.2, seed: 2, y: 392, scale: 0.62, alpha: 0.95, density: 0.5, spread: 70, speed: 9, x0: 1180, x1: 2350 });
  drawClouds(ctx, t, { preset: PRESET, cam, depth: 0.34, seed: 1, y: 182, scale: 1.05, alpha: 0.96, density: 0.5, spread: 70, speed: 6, x0: 1000, x1: 2500 });
}

/**
 * Rayos del reflector que siguen en el sol: el mismo abanico de 12 cuñas del fondo del escenario (misma fase de
 * giro, t·0,18 rad) sale ahora del sol y se recoge hasta quedar como los rayos suaves del cielo.
 */
export function drawEntryRays(ctx, t, x, y, r) {
  const k = 1 - E.outCubic(clamp((t - T0) / 0.62));
  if (k <= 0.01) return;
  const n = 24, R = 1700;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.18);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rad(ctx, 0, 0, r * 0.9, 0, 0, R, [[0, rgba(PAL.goldPale, 0.42 * k)], [0.3, rgba(PAL.gold, 0.2 * k)], [0.7, rgba(PAL.coral, 0.06 * k)], [1, rgba(PAL.coral, 0)]]);
  ctx.beginPath();
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, a0, a1);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

/** El sol (disco, corona, rayos y flare) recortado al horizonte mientras es sol «de verdad». */
export function drawTheSun(ctx, t, cam) {
  const [sx, sy] = sunScreen(cam);
  const flat = sunFlat(t);
  const r = sunRWorld(t);
  const hy = horizonScreen(cam, HZ);
  // el sol late con el bombo (negras fuertes, corcheas suaves) desde que aterriza la cámara
  const pulse = 0.6 * beatPulse(t, { from: T0, every: 1, decay: 0.12 }) + 0.9 * beatPulse(t, { from: T_B2, to: T_OUT, every: 1, decay: 0.16 }) + 0.45 * beatPulse(t, { from: T_B2, to: T_OUT, every: 1, offset: 0.5, decay: 0.12 });
  // a medida que se satura: el disco pasa de blanco-dorado a coral y a naranja de marca
  const flatColor = mixHex(PAL.coral, PAL.brandOrange, E.inQuad(flat));
  drawSun(ctx, t, sx, sy, r, {
    preset: PRESET,
    flare: flareK(t) * (1 - flat),
    glow: 1.1 + 0.2 * cheersK(t),
    rays: 1.1,
    pulse: pulse * (1 - flat),
    flat,
    flatColor,
    horizon: t < T_OUT ? hy : undefined,
  });
}

/**
 * Flare del brindis: crece desde la anticipación, PICO de 3 cuadros en el choque y cae. El halo (+30 %) va
 * DETRÁS de la pareja (front = false, en el cielo: las siluetas no se lavan); la estría anamórfica larga y los
 * fantasmas son de la lente y van encima de todo (front = true).
 */
export function drawCheersFlare(ctx, t, x, y, r, front) {
  const k = cheersK(t);
  if (k <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (!front) {
    const R = r * (3.2 + 1.3 * k);
    ctx.fillStyle = rad(ctx, x, y, R, [[0, rgba(PAL.goldPale, 0.3 * k)], [0.2, rgba(PAL.gold, 0.2 * k)], [0.5, rgba(PAL.coral, 0.08 * k)], [1, rgba(PAL.coral, 0)]]);
    ctx.fillRect(x - R, y - R, R * 2, R * 2);
    ctx.restore();
    return;
  }
  // estría anamórfica larga (pasa de borde a borde) y una segunda más fina azulada
  for (const [len, th, col, a] of [[W * (0.7 + 0.6 * k), 3 + 5 * k, PAL.goldLight, 0.8], [W * 1.15, 2, '#8FD8FF', 0.45]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, th / len);
    ctx.fillStyle = rad(ctx, 0, 0, len, [[0, rgba(PAL.white, a * k)], [0.1, rgba(col, a * 0.75 * k)], [0.45, rgba(col, a * 0.2 * k)], [1, rgba(col, 0)]]);
    ctx.fillRect(-len, -len, len * 2, len * 2);
    ctx.restore();
  }
  ctx.restore();
  // fantasmas de lente a lo largo de la línea sol → centro
  drawFlare(ctx, t, x, y, r * (1 + 0.3 * k), 0.4 * k, PRESET, true);
}

/** Mar con el camino de destellos y la isla lejana. */
export function drawSea(ctx, t, cam, clipY = 1080) {
  const sy = cam.cy;
  // lo que queda debajo del zócalo de la baranda no se ve: se recorta (Skia no rasteriza las filas tapadas)
  ctx.save();
  if (clipY < 1080) { ctx.beginPath(); ctx.rect(0, 0, 1920, clipY); ctx.clip(); }
  drawOcean(ctx, t, { preset: PRESET, horizonY: HZ, cam, sunX: cam.cx, sunY: sy, glitter: 1.7, swell: 1.05, speed: 1.8, rows: 20 });
  // isla lejana en contraluz (velada por la bruma: perspectiva atmosférica)
  plane(ctx, cam, 0.1, (c) => drawFarIsland(c, t));
  ctx.restore();
}

function drawFarIsland(ctx, t) {
  const x = 330, y = HZ + 3;
  const col = mixHex(mixHex(PAL.navy900, PAL.dusk, 0.45), PAL.coral, 0.22);
  ctx.save();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x - 190, y);
  ctx.bezierCurveTo(x - 150, y - 16, x - 90, y - 30, x - 40, y - 30);
  ctx.bezierCurveTo(x + 10, y - 52, x + 70, y - 40, x + 100, y - 20);
  ctx.bezierCurveTo(x + 130, y - 10, x + 160, y - 4, x + 200, y);
  ctx.closePath();
  ctx.fill();
  // filo de luz del lado del sol
  ctx.fillStyle = 'rgba(255,210,122,0.55)';
  ctx.beginPath();
  ctx.moveTo(x + 10, y - 50);
  ctx.bezierCurveTo(x + 60, y - 42, x + 90, y - 26, x + 104, y - 19);
  ctx.bezierCurveTo(x + 86, y - 24, x + 56, y - 38, x + 10, y - 47);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha *= 0.9;
  drawPalm(ctx, t, x - 60, y - 24, 82, { lean: -0.35, seed: 4, silhouette: true, preset: PRESET, fronds: 8, sway: 1.4 });
  drawPalm(ctx, t, x + 4, y - 34, 104, { lean: 0.25, seed: 7, silhouette: true, preset: PRESET, fronds: 9, sway: 1.4 });
  drawPalm(ctx, t, x + 60, y - 28, 70, { lean: 0.55, seed: 9, silhouette: true, preset: PRESET, fronds: 7, sway: 1.4 });
  ctx.restore();
}

/** Bandada lejana (se mueve con un plano intermedio: parallax contra el cielo). */
export function drawFlock(ctx, t, cam) {
  plane(ctx, cam, 0.45, (c) => drawGulls(c, t, { preset: PRESET, count: 5, area: { x: 620, y: 175, w: 1180, h: 190 }, scale: 0.5, seed: 11, dir: 1, speed: 1.6 }));
}

// gaviotas protagonistas: silueta con filo cálido que cruzan por delante del sol
const GULL_COL = {
  top: mixHex(PAL.navy900, PAL.dusk, 0.25), under: mixHex(PAL.navy800, PAL.dusk, 0.3), tip: PAL.ink,
  body: mixHex(PAL.navy900, PAL.dusk, 0.2), rim: PAL.goldLight, beak: mixHex(PAL.gold, PAL.navy900, 0.5),
};
const HERO = [
  // [t0, t1, x0, x1, y, tamaño, profundidad, sentido]: en el beat 2 una bandada cercana barre el cielo de der. a
  // izq. (pasa por delante del sol) y después del brindis otra cruza de izq. a der.
  [T_B2 - 0.08, T_CHEERS + 0.02, 2150, -300, 250, 62, 0.95, -1],
  [T_B2 - 0.02, T_CHEERS + 0.1, 2300, -250, 360, 46, 0.85, -1],
  [T_B2 + 0.04, T_CHEERS + 0.16, 2250, -200, 180, 38, 0.8, -1],
  [T_CHEERS - 0.02, T_OUT + 0.12, -150, 1900, 320, 54, 0.95, 1],
  [T_CHEERS + 0.05, T_OUT + 0.2, -250, 1850, 210, 40, 0.85, 1],
];
export function drawHeroGull(ctx, t, cam) {
  for (const [t0, t1, x0, x1, y0, R, d, dir] of HERO) {
    if (t < t0 || t > t1) continue;
    const u = (t - t0) / (t1 - t0);
    const x = x0 + (x1 - x0) * u, y = y0 + 70 * Math.sin(u * Math.PI) - 40 * u;
    const flap = Math.sin(t * TAU * 2.8 + d * 5) * (u < 0.5 ? 1 : 0.4);
    plane(ctx, cam, d, (c) => gull(c, x, y + Math.cos(t * TAU * 2.8) * 3, R, flap, dir, GULL_COL, true, -0.06));
  }
}
