// Guirnalda de lamparitas colgada sobre la cubierta (arriba a la derecha, deja libre el lockup de arriba a la
// izquierda): cable con filo de luz, portalámparas, globitos que se mecen. Se prenden en cascada en el beat 2 con
// pop y estallido de halo, y laten con el bombo. Una segunda tira, más cerca de cámara, va desenfocada (bokeh).
import { PAL, rgba, mixHex } from '../../engine/color.js';
import { pop, TAU } from '../../engine/ease.js';
import { rad } from '../../engine/draw.js';
import { beatPulse } from '../../engine/time.js';
import { T0, T_B2 } from './ss-time.js';

const STRANDS = [
  { A: [2140, 70], B: [1010, -64], sag: 196, n: 12, r: 8.5, ph: 0 },
  { A: [1010, -64], B: [540, -150], sag: 150, n: 4, r: 8.5, ph: 1.7 },
];
const NEAR = { A: [2260, 330], B: [1560, -90], sag: 150, n: 6, r: 22, ph: 0.6 };

const pt = (S, u, t) => {
  const sway = 7 * Math.sin(t * 1.6 + S.ph) * Math.sin(Math.PI * u);
  return [S.A[0] + (S.B[0] - S.A[0]) * u + sway * 0.4, S.A[1] + (S.B[1] - S.A[1]) * u + 4 * S.sag * u * (1 - u) + sway];
};

/** Brillo de una lamparita: 0 apagada → pop con sobrepico → 1, y latido con el bombo. */
function bulbOn(t, i) {
  const ton = T_B2 + i * 0.021;
  const dur = 0.26;
  const p = pop(t, ton - 0.4 * dur, { dur, over: 1.55 });
  return p * (1 + 0.32 * beatPulse(t, { from: T0, every: 1, decay: 0.12 }) + 0.3 * beatPulse(t, { from: T_B2, every: 0.5, decay: 0.1 }));
}

function wire(ctx, S, t, width, color, rim) {
  ctx.beginPath();
  for (let k = 0; k <= 24; k++) { const [x, y] = pt(S, k / 24, t); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
  if (rim) {
    ctx.save();
    ctx.translate(0, -width * 0.35);
    ctx.strokeStyle = rim;
    ctx.lineWidth = width * 0.35;
    ctx.stroke();
    ctx.restore();
  }
}

/** Tiras principales (plano de las luces). */
export function drawLights(ctx, t) {
  // se prenden desde el centro (junto al sol) hacia afuera: la tira 1 de derecha a izquierda va al revés
  STRANDS.forEach((S, k) => {
    wire(ctx, S, t, 2.6, mixHex(PAL.ink, PAL.dusk, 0.25), rgba(PAL.goldLight, 0.55));
    for (let i = 0; i < S.n; i++) {
      const u = (i + 0.5) / S.n;
      const [x, y] = pt(S, u, t);
      const sw = 0.12 * Math.sin(t * 2.4 + i * 0.8 + S.ph);
      bulb(ctx, x, y, S.r, sw, bulbOn(t, k === 0 ? S.n - 1 - i : i));
    }
  });
}

function bulb(ctx, x, y, r, sw, on) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sw);
  // portalámparas
  ctx.fillStyle = mixHex(PAL.ink, PAL.dusk, 0.2);
  ctx.fillRect(-r * 0.42, 0, r * 0.84, r * 1.15);
  ctx.fillStyle = rgba(PAL.goldLight, 0.5);
  ctx.fillRect(r * 0.2, 0, r * 0.2, r * 1.1);
  const cy = r * 1.15 + r * 0.92;
  const k = Math.max(0, on);
  // globo de vidrio: apagado se ve oscuro con su canto; prendido, núcleo blanco cálido
  ctx.fillStyle = mixHex(mixHex(PAL.navy800, PAL.dusk, 0.4), PAL.goldPale, Math.min(1, k));
  ctx.beginPath(); ctx.arc(0, cy, r, 0, TAU); ctx.fill();
  if (k > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rad(ctx, 0, cy, r * 0.75, [[0, rgba(PAL.white, Math.min(1, k))], [1, rgba(PAL.gold, 0)]]);
    ctx.beginPath(); ctx.arc(0, cy, r, 0, TAU); ctx.fill();
    const hr = r * (4 + 2.5 * Math.max(0, k - 1) * 3);
    ctx.fillStyle = rad(ctx, 0, cy, hr, [[0, rgba(PAL.goldLight, 0.55 * Math.min(1.3, k))], [0.35, rgba(PAL.gold, 0.18 * Math.min(1.3, k))], [1, rgba(PAL.gold, 0)]]);
    ctx.fillRect(-hr, cy - hr, hr * 2, hr * 2);
  } else {
    ctx.strokeStyle = rgba(PAL.goldLight, 0.5);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, cy, r - 0.6, -2.4, -0.9); ctx.stroke();
  }
  ctx.restore();
}

/**
 * Tira cercana desenfocada (bokeh): discos ADITIVOS y translúcidos (se ve el cielo a través), dorado cálido,
 * con el borde más brillante que el centro (como un bokeh de lente real) y un halo coral muy suave.
 */
export function drawNearLights(ctx, t) {
  const S = NEAR;
  ctx.save();
  ctx.globalAlpha *= 0.35;
  wire(ctx, S, t, 6, rgba(PAL.ink, 0.5), null);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < S.n; i++) {
    const u = (i + 0.5) / S.n;
    const [x, y0] = pt(S, u, t);
    const y = y0 + S.r * 1.8;
    const k = Math.min(1.3, bulbOn(t, 3 + i));
    if (k <= 0.01) continue;
    const R = S.r * 1.75;
    ctx.fillStyle = rad(ctx, x, y, R, [[0, rgba(PAL.gold, 0.1 * k)], [0.72, rgba(PAL.gold, 0.13 * k)], [0.9, rgba(PAL.goldLight, 0.24 * k)], [0.97, rgba(PAL.goldPale, 0.2 * k)], [1, rgba(PAL.gold, 0)]]);
    ctx.fillRect(x - R, y - R, R * 2, R * 2);
    ctx.fillStyle = rad(ctx, x, y, R * 2, [[0, rgba(PAL.coral, 0.07 * k)], [1, rgba(PAL.coral, 0)]]);
    ctx.fillRect(x - R * 2, y - R * 2, R * 4, R * 4);
  }
  ctx.restore();
}
