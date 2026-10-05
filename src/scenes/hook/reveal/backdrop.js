// Fondo del mar abierto con el kit de ART: cielo dorado de día, tres capas de nubes, sol con flare y el mar
// con su camino de destellos. Las nubes grandes viven a los costados: el centro de arriba es del texto (TYPE).
import { drawSky, skyPoint, drawSun, drawClouds, drawOcean } from '../../../art/index.js';
import { beatPulse } from '../../../engine/time.js';
import { camZ } from '../../../art/util.js';
import { HZ, SUN, PRESET, R } from './time.js';

/** Intensidad del flare del sol: base + golpe en el drop + barrido del bocinazo. */
export function sunFlare(t) {
  const hit = (t0, d) => (t >= t0 ? Math.exp(-(t - t0) / d) : 0);
  return 0.62 + 0.5 * hit(R.drop, 0.35) + 0.35 * hit(R.q5, 0.25) + 0.8 * hit(R.horn, 0.12) * Math.min(1, (t - R.horn + 0.02) / 0.03);
}

/** Pulso de bombo (negras fuertes y corcheas suaves desde el drop) para lo que está vivo: sol y destellos. */
export const kick = (t) => Math.max(beatPulse(t, { from: R.drop, every: 1, decay: 0.12 }), 0.45 * beatPulse(t, { from: R.drop, every: 0.5, decay: 0.08 }));

/** Sol en pantalla (para el flare que barre y los fantasmas). */
export function sunScreen(cam) {
  const [x, y] = skyPoint(cam, SUN.x, SUN.y);
  return { x, y, r: SUN.r * camZ(cam, 0.08) };
}

export function drawBackdrop(ctx, t, cam) {
  const P = PRESET;
  const k = kick(t);
  drawSky(ctx, t, { preset: P, horizonY: HZ, sunX: SUN.x, sunY: SUN.y, cam, rays: 1.1 });
  // nubes lejanas, en la bruma del horizonte
  drawClouds(ctx, t, { preset: P, cam, depth: 0.1, seed: 3, y: HZ - 40, scale: 0.34, alpha: 0.6, density: 0.8, spread: 30, speed: 6, x0: -380, x1: 700 });
  drawClouds(ctx, t, { preset: P, cam, depth: 0.1, seed: 2, y: HZ - 36, scale: 0.3, alpha: 0.55, density: 0.6, spread: 24, speed: 5, x0: 1420, x1: 2300 });
  const s = sunScreen(cam);
  drawSun(ctx, t, s.x, s.y, s.r, { preset: P, flare: sunFlare(t), pulse: k * 1.5 });
  // capa media: a los costados del barco
  drawClouds(ctx, t, { preset: P, cam, depth: 0.16, seed: 2, y: HZ - 175, scale: 0.6, alpha: 0.9, density: 0.5, spread: 60, speed: 9, x0: -300, x1: 760 });
  drawClouds(ctx, t, { preset: P, cam, depth: 0.17, seed: 3, y: HZ - 150, scale: 0.55, alpha: 0.88, density: 0.4, spread: 50, speed: 8, x0: 1380, x1: 2300 });
  // capa cercana: grandes y en los bordes de arriba (el centro queda libre para «CRUCERO?»)
  drawClouds(ctx, t, { preset: P, cam, depth: 0.24, seed: 1, y: 210, scale: 1.05, density: 0.5, spread: 120, speed: 12, x0: -420, x1: 640 });
  drawClouds(ctx, t, { preset: P, cam, depth: 0.26, seed: 5, y: 120, scale: 0.9, density: 0.35, spread: 60, speed: 10, x0: 1680, x1: 2500 });
  // en «CRUCERO?» el mar entero destella (golpe de luz sobre el agua)
  const q5 = t >= R.q5 ? Math.exp(-(t - R.q5) / 0.2) : 0;
  // y en el bocinazo el camino del sol se enciende con el flare
  const hn = t >= R.horn ? Math.exp(-(t - R.horn) / 0.16) : 0;
  drawOcean(ctx, t, { preset: P, horizonY: HZ, cam, sunX: SUN.x, sunY: SUN.y, glitter: 1 + 2 * k + 2.4 * q5 + 1.8 * hn, swell: 1.3, speed: 2 });
  return s;
}
