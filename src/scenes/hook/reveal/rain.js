// Resaca de la ola: el agua que la ola tiró para arriba vuelve a caer delante de la cámara (3,72–4,3).
// Gotas estiradas por la velocidad (tres tonos: cuerpo, filo de luz y brillo) y algunas muy cerca, fuera de
// foco (discos blandos). Nacen detrás del frente de la ola: arriba a la izquierda, por donde se fue.
import { PAL, rgba } from '../../../engine/color.js';
import { clamp, TAU } from '../../../engine/ease.js';
import { hash } from '../../../engine/noise.js';
import { waveFrontX } from '../../../art/index.js';
import { HOOK_WAVE } from '../../waves.js';
import { R } from './time.js';

const N = 46;
const G = 2600; // gravedad (px/s²)

export function drawFallout(ctx, t) {
  const t0 = R.drop - 0.06;
  if (t < t0 || t > R.drop + 0.5) return;
  ctx.save();
  for (let i = 0; i < N; i++) {
    // cada gota se suelta cuando el frente de la ola pasa por su x
    const x0 = 30 + Math.pow(hash(i, 1), 1.4) * 1100;
    const tb = Math.max(t0, tFront(x0)) + hash(i, 2) * 0.12;
    const u = t - tb;
    if (u <= 0) continue;
    const near = hash(i, 3) < 0.16; // fuera de foco, pegadas a la cámara
    const vy0 = -650 + hash(i, 4) * 600, vx = -260 - hash(i, 5) * 420;
    const x = x0 + vx * u, y = (near ? 200 : -60) + hash(i, 6) * 420 + vy0 * u + 0.5 * G * u * u;
    if (y > 1180) continue;
    const vy = vy0 + G * u;
    const r = near ? 18 + hash(i, 7) * 26 : 2.5 + Math.pow(hash(i, 8), 2) * 9;
    const sp = Math.hypot(vx, vy);
    const st = 1 + sp * (near ? 0.0003 : 0.0007);
    const al = clamp((0.42 - u) / 0.15) * (near ? 0.32 : 0.95);
    const ang = Math.atan2(vy, vx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    if (near) {
      // gota desenfocada: disco blando con el brillo corrido hacia la luz
      const g = ctx.createRadialGradient(r * 0.3, -r * 0.3, 0, 0, 0, r * st);
      g.addColorStop(0, rgba(PAL.white, al * 0.9));
      g.addColorStop(0.35, rgba(PAL.aqua100, al * 0.55));
      g.addColorStop(0.8, rgba(PAL.aqua200, al * 0.3));
      g.addColorStop(1, rgba(PAL.aqua200, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, r * st, r / Math.sqrt(st), 0, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = rgba(PAL.aqua300, al);
      ctx.beginPath(); ctx.ellipse(0, 0, r * st, r / Math.sqrt(st), 0, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(PAL.aqua100, al);
      ctx.beginPath(); ctx.ellipse(r * 0.2 * st, -r * 0.25, r * st * 0.7, r * 0.45 / Math.sqrt(st), 0, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(PAL.white, al);
      ctx.beginPath(); ctx.arc(r * 0.45 * st, -r * 0.3, r * 0.28, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

/** t en que el frente de la ola pasa por la x de pantalla (búsqueda sobre p, monótona). */
function tFront(x) {
  let a = HOOK_WAVE.t0, b = HOOK_WAVE.t1;
  for (let k = 0; k < 18; k++) {
    const m = (a + b) / 2;
    if (waveFrontX(HOOK_WAVE.p(m), HOOK_WAVE.dir) > x) a = m; else b = m;
  }
  return b;
}
