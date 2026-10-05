// Salvavidas naranja colgado en la baranda, a contraluz: aro con 4 bandas blancas, sombra dura del lado opuesto
// al sol, filo de luz del lado del sol (afuera arriba y adentro abajo), cabo con senos que se mecen y gancho.
import { PAL, rgba, mixHex } from '../../engine/color.js';
import { TAU } from '../../engine/ease.js';
import { sparkle } from '../../engine/draw.js';
import { grain } from './grain.js';

const C = {
  orange: mixHex(PAL.brandOrange, PAL.dusk, 0.28),
  orangeShade: mixHex(mixHex(PAL.brandOrange, PAL.dusk, 0.28), PAL.ink, 0.42),
  band: mixHex(PAL.warmWhite, PAL.dusk, 0.38),
  bandShade: mixHex(PAL.warmWhite, PAL.navy800, 0.62),
  rim: PAL.goldLight,
  rope: mixHex(PAL.navy900, '#5A3A2A', 0.35),
  steel: mixHex(PAL.navy900, PAL.dusk, 0.3),
};

function ringPath(x, y, R, r) {
  const p = new Path2D();
  p.arc(x, y, R, 0, TAU);
  p.closePath();
  p.moveTo(x + r, y);
  p.arc(x, y, r, 0, TAU, true);
  p.closePath();
  return p;
}

/**
 * (hx, hy) = gancho en el pasamanos · R/r = radio exterior / interior · light = vector unitario hacia el sol.
 * swing = ángulo de vaivén (rad) alrededor del gancho.
 */
export function drawLifeRing(ctx, t, hx, hy, R, r, light, swing = 0) {
  const [lx, ly] = light;
  const cy = hy + 14 + R;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(swing);
  ctx.translate(-hx, -hy);
  const x = hx;
  const tube = R - r;
  const ring = ringPath(x, cy, R, r);

  // cabo: senos entre las bandas (por afuera), cuelgan y se mecen apenas
  ctx.strokeStyle = C.rope;
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  const angs = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.25, Math.PI * 0.75];
  for (let i = 0; i < 4; i++) {
    const a0 = angs[i], a1 = angs[(i + 1) % 4] + (i === 3 ? TAU : 0);
    const am = (a0 + a1) / 2;
    const sag = 14 + 6 * Math.sin(t * 2.1 + i * 1.7);
    const p0 = [x + Math.cos(a0) * (R + 2), cy + Math.sin(a0) * (R + 2)];
    const p1 = [x + Math.cos(a1) * (R + 2), cy + Math.sin(a1) * (R + 2)];
    const m = [x + Math.cos(am) * (R + 2 + sag * 0.7), cy + Math.sin(am) * (R + 2 + sag * 0.7) + sag * 0.6];
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.quadraticCurveTo(2 * m[0] - (p0[0] + p1[0]) / 2, 2 * m[1] - (p0[1] + p1[1]) / 2, p1[0], p1[1]);
    ctx.stroke();
  }

  // sombra (tono 2) en todo el aro; encima el cuerpo corrido hacia el sol (tono 1) → medialunas de sombra
  ctx.fillStyle = C.orangeShade;
  ctx.fill(ring, 'evenodd');
  ctx.save();
  ctx.clip(ring, 'evenodd');
  ctx.fillStyle = C.orange;
  ctx.fill(ringPath(x + lx * tube * 0.28, cy + ly * tube * 0.28, R, r), 'evenodd');
  // bandas blancas (cuñas) con su propia sombra
  for (const a of angs) {
    const w = 0.2;
    ctx.fillStyle = C.bandShade;
    wedge(ctx, x, cy, R + 2, r - 2, a - w, a + w);
    ctx.save();
    ctx.clip(ringPath(x + lx * tube * 0.28, cy + ly * tube * 0.28, R, r), 'evenodd');
    ctx.fillStyle = C.band;
    wedge(ctx, x, cy, R + 2, r - 2, a - w, a + w);
    ctx.restore();
  }
  grain(ctx, null, { alpha: 0.1, blend: 'overlay' });
  // filo de luz (tono 3): aro menos su copia corrida en contra del sol
  ctx.save();
  ctx.fillStyle = rgba(C.rim, 0.95);
  ctx.beginPath();
  ctx.rect(x - R - 20, cy - R - 20, 2 * R + 40, 2 * R + 40);
  const d = 3.2;
  ctx.arc(x - lx * d, cy - ly * d, R, 0, TAU, true);
  ctx.moveTo(x - lx * d + r, cy - ly * d);
  ctx.arc(x - lx * d, cy - ly * d, r, 0, TAU);
  ctx.fill('evenodd');
  ctx.restore();
  // brillo especular suave sobre el lomo del lado del sol
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(PAL.peach, 0.22);
  ctx.lineWidth = tube * 0.22;
  ctx.beginPath();
  const am = Math.atan2(ly, lx);
  ctx.arc(x, cy, (R + r) / 2 + tube * 0.12, am - 0.9, am + 0.9);
  ctx.stroke();
  ctx.restore();

  // gancho: correa al pasamanos
  ctx.fillStyle = C.steel;
  ctx.fillRect(x - 5, hy - 2, 10, 18 + (R - r) * 0.2);
  ctx.fillStyle = rgba(C.rim, 0.8);
  ctx.fillRect(x - 5, hy - 2, 2, 16);
  ctx.restore();
  // destello en el canto encendido
  sparkle(ctx, x + lx * R * 0.92, cy + ly * R * 0.92, 14 + 4 * Math.sin(t * 3.3), { color: PAL.goldPale, alpha: 0.85, halo: 0.6 });
}

function wedge(ctx, x, y, R, r, a0, a1) {
  ctx.beginPath();
  ctx.arc(x, y, R, a0, a1);
  ctx.arc(x, y, r, a1, a0, true);
  ctx.closePath();
  ctx.fill();
}
