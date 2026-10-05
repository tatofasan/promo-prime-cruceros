// Gotas grandes que pegan EN LA LENTE en el drop (la ola acaba de pasar por encima de la cámara) y resbalan.
// Cada gota: golpe con aplastamiento y gotitas satélite, después baja despacio dejando un hilo. Ilustradas en
// tres tonos de lente: filo oscuro abajo a la derecha, cuerpo claro que «aumenta» la luz del mar, filo de luz
// arriba a la izquierda y punto especular. Se dibujan en pantalla (no tienen parallax: están en el vidrio).
import { PAL, rgba } from '../../../engine/color.js';
import { rad, lin } from '../../../engine/draw.js';
import { E, clamp, TAU } from '../../../engine/ease.js';
import { hash, noise1 } from '../../../engine/noise.js';
import { R } from './time.js';

// [t de impacto (relativo al drop), x, y, radio] — lejos del bloque del titular (arriba al centro)
const DROPS = [
  [0.0, 300, 600, 44],
  [0.05, 1610, 760, 54],
  [0.11, 840, 880, 34],
];

/** Gota sobre el vidrio: lágrima con la cabeza abajo (resbala), imagen invertida adentro (oscura arriba y
 *  clara abajo), borde blando (fuera de foco) y especular. */
function lensDrop(ctx, x, y, r, sx, sy, a) {
  if (r < 0.5 || a <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.globalAlpha = a;
  const P = new Path2D();
  // cabeza redonda abajo y una cola corta y roma arriba (la gota se aplasta contra el vidrio, no es un ícono)
  P.moveTo(0, -r * 1.3);
  P.bezierCurveTo(r * 0.55, -r * 1.25, r, -r * 0.6, r, 0);
  P.arc(0, 0, r, 0, Math.PI);
  P.bezierCurveTo(-r, -r * 0.6, -r * 0.55, -r * 1.25, 0, -r * 1.3);
  P.closePath();
  ctx.fillStyle = lin(ctx, 0, -r * 1.3, 0, r, [[0, rgba(PAL.navy700, 0.1)], [0.45, rgba(PAL.navy600, 0.3)], [0.7, rgba(PAL.aqua200, 0.25)], [0.93, rgba(PAL.white, 0.6)], [1, rgba(PAL.white, 0.25)]]);
  ctx.fill(P);
  ctx.strokeStyle = rgba(PAL.navy700, 0.22);
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  ctx.stroke(P);
  // especular y contraluz
  ctx.fillStyle = rgba(PAL.white, 0.9);
  ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.3, r * 0.14, r * 0.24, 0.3, 0, TAU); ctx.fill();
  ctx.fillStyle = rgba(PAL.goldPale, 0.55);
  ctx.beginPath(); ctx.ellipse(r * 0.25, r * 0.62, r * 0.4, r * 0.13, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawLensDrops(ctx, t) {
  const u0 = t - R.drop;
  if (u0 < 0 || u0 > 0.62) return;
  ctx.save();
  for (let i = 0; i < DROPS.length; i++) {
    const [d, x0, y0, r] = DROPS[i];
    const u = u0 - d;
    if (u < 0) continue;
    // impacto: se aplasta y rebota (squash & stretch), después resbala acelerando con un leve zigzag
    const imp = E.backOut(2.4)(clamp(u / 0.07));
    const sq = Math.exp(-u * 14) * Math.cos(u * 40);
    const slide = Math.max(0, u - 0.18);
    const y = y0 + 70 * slide + 260 * slide * slide;
    const x = x0 + 10 * noise1(slide * 2 + i * 3, 7) * clamp(slide * 4);
    // un acento del golpe: se van antes de «CRUCERO?» (4,22) y no compiten con el barco
    const a = clamp((0.5 - u) / 0.18);
    // hilo que deja al resbalar
    if (y - y0 > 4) {
      ctx.fillStyle = lin(ctx, 0, y0, 0, y, [rgba(PAL.aqua100, 0), rgba(PAL.aqua100, 0.22 * a)]);
      ctx.beginPath();
      ctx.moveTo(x0 - r * 0.18, y0); ctx.lineTo(x - r * 0.42, y); ctx.lineTo(x + r * 0.42, y); ctx.lineTo(x0 + r * 0.18, y0);
      ctx.fill();
    }
    lensDrop(ctx, x, y, r * imp, 1 + 0.25 * sq, 1 - 0.2 * sq + 0.1 * clamp(slide * 3), a);
    // gotitas satélite del golpe
    if (u < 0.5) {
      for (let k = 0; k < 6; k++) {
        const ang = hash(i, k, 1) * TAU, dd = r * (1.2 + 0.9 * hash(i, k, 2)) * E.outCubic(clamp(u / 0.08));
        lensDrop(ctx, x0 + Math.cos(ang) * dd, y0 + Math.sin(ang) * dd, r * (0.08 + 0.1 * hash(i, k, 3)), 1, 1, a * clamp((0.5 - u) / 0.2));
      }
    }
  }
  ctx.restore();
}
