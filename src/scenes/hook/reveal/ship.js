// El crucero del drop: navega en el horizonte hacia la derecha (con estela, ola de proa y humo), crece con el
// push-in y en el disparo la cámara viaja hasta UN ojo de buey del casco (shipZoom del kit: el vidrio llega
// exacto a (960, 540) r 300 en 5,625).
import { shipZoom, seaDepth, SHIP } from '../../../art/index.js';
import { W, H } from '../../../engine/time.js';
import { toScreen } from '../../../engine/camera.js';
import { E, prog } from '../../../engine/ease.js';
import { HZ, SHIP0, PRESET, R, EYE } from './time.js';
import { pushK, pushIn, antic } from './cam.js';

export const SHIP_DEPTH = seaDepth(SHIP0.y, HZ);

/** Pose del barco en pantalla con la cámara del mar (sin el disparo). */
export function shipPose(t, cam) {
  // navega a la derecha (con la cámara que lo acompaña se corre ≥ 120 px en pantalla durante el push-in)
  const x = SHIP0.x + SHIP0.v * (t - R.drop);
  const [sx, sy] = toScreen(cam, SHIP_DEPTH, x, SHIP0.y);
  // además del parallax, el barco «se acerca» (la cámara viaja hacia él): crece ≥ 40 % y su flotación baja
  const pi = pushIn(t);
  // (la anticipación del disparo también lo aleja un 3 %: dolly-out)
  const near = (1 + 0.42 * pi) * (1 - 0.03 * antic(t));
  const scale = SHIP0.scale * Math.pow(cam.z, SHIP_DEPTH) * near;
  return { x: sx, y: sy + SHIP0.drop * pi, scale, dir: 1, preset: PRESET, smoke: 0.35, wake: 1, bowWave: 1.3, wind: 2.6, speed: 170, wakeLen: 760 };
}

/** Pose final con el disparo al ojo de buey aplicado. */
export function shipPoseAt(t, cam) {
  const o0 = shipPose(t, cam);
  const k = pushK(t);
  if (k <= 0) return o0;
  // después de 5,625 sigue un push lento (debajo del iris de pool)
  const slow = 1 + 0.08 * E.outCubic(prog(t, R.land, R.end));
  const o = shipZoom(o0, k, { i: SHIP.hero, cx: EYE.x, cy: EYE.y, r: EYE.r * slow });
  // de cerca, el reflejo y la estela no se ven (y cuestan): se apagan
  o.reflect = Math.max(0, 1 - k * 2.5);
  o.wake = Math.max(0, 1 - k * 2.5);
  return o;
}

/** ¿El casco ya tapa todo el cuadro? (entonces no hace falta pintar cielo ni mar debajo) */
export function shipCovers(o) {
  const s = o.scale;
  return s > 12 && o.y > H + 12 && o.y - 62 * s < -12 && o.x - 480 * s < -12 && o.x + 430 * s > W + 12;
}
