// Barquito visto desde arriba (cenital) que navega en la punta de la ruta: casco blanco en 3 tonos,
// cubiertas, pileta turquesa, chimenea naranja de marca, botes salvavidas y estela en V con espuma.
// Proa hacia +x. len = largo en px de pantalla.
import { PAL, rgba, shade } from '../../engine/color.js';
import { TAU } from '../../engine/ease.js';

let P = null;
function build() {
  const hull = new Path2D();
  hull.moveTo(-50, -11);
  hull.lineTo(22, -11);
  hull.bezierCurveTo(38, -11, 48, -5, 54, 0);
  hull.bezierCurveTo(48, 5, 38, 11, 22, 11);
  hull.lineTo(-50, 11);
  hull.quadraticCurveTo(-56, 11, -56, 5);
  hull.lineTo(-56, -5);
  hull.quadraticCurveTo(-56, -11, -50, -11);
  hull.closePath();
  const half = new Path2D();
  half.rect(-60, 0, 120, 14);
  const deck = new Path2D();
  deck.moveTo(-46, -7.5);
  deck.lineTo(20, -7.5);
  deck.bezierCurveTo(32, -7.5, 40, -4, 44, 0);
  deck.bezierCurveTo(40, 4, 32, 7.5, 20, 7.5);
  deck.lineTo(-46, 7.5);
  deck.closePath();
  const top = new Path2D();
  top.moveTo(-38, -5);
  top.lineTo(12, -5);
  top.quadraticCurveTo(22, -5, 26, 0);
  top.quadraticCurveTo(22, 5, 12, 5);
  top.lineTo(-38, 5);
  top.closePath();
  P = { hull, half, deck, top };
}

/** Dibuja el barco en (x, y) con rumbo `ang` (rad). o = { alpha, t, wake (0..1), glow (0..1) } */
export function drawShipTop(ctx, x, y, ang, len, o = {}) {
  if (!P) build();
  const k = len / 110;
  const t = o.t ?? 0;
  const a = o.alpha ?? 1;
  if (a <= 0.01 || k <= 0.001) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(k, k);
  ctx.globalAlpha *= a;
  // estela en V con espuma que late
  const wk = o.wake ?? 1;
  if (wk > 0.01) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const g = ctx.createLinearGradient(-52, 0, -150, 0);
      g.addColorStop(0, rgba(PAL.foam, 0.85 * wk));
      g.addColorStop(1, rgba(PAL.foam, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(-48, s * 9);
      ctx.quadraticCurveTo(-95, s * (16 + 2 * Math.sin(t * 9)), -150, s * 34);
      ctx.stroke();
    }
    const fg = ctx.createLinearGradient(-50, 0, -130, 0);
    fg.addColorStop(0, rgba(PAL.aqua100, 0.55 * wk));
    fg.addColorStop(1, rgba(PAL.aqua100, 0));
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-50, -9);
    ctx.quadraticCurveTo(-95, -14, -130, 0);
    ctx.quadraticCurveTo(-95, 14, -50, 9);
    ctx.fill();
    // ola de proa
    ctx.strokeStyle = rgba(PAL.foam, 0.7 * wk);
    ctx.lineWidth = 2.5;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(52, s * 1);
      ctx.quadraticCurveTo(40, s * 14, 22, s * 16);
      ctx.stroke();
    }
    ctx.restore();
  }
  // sombra proyectada (luz arriba-izquierda → abajo-derecha en pantalla)
  ctx.save();
  ctx.rotate(-ang);
  ctx.translate(5 / k, 7 / k);
  ctx.rotate(ang);
  ctx.fillStyle = rgba(PAL.ink, 0.42);
  ctx.fill(P.hull);
  ctx.restore();
  // casco: base blanca, mitad en sombra (lado opuesto a la luz) y filo
  ctx.fillStyle = PAL.white;
  ctx.fill(P.hull);
  ctx.save();
  ctx.clip(P.hull);
  // la mitad en sombra depende del rumbo: la luz viene de arriba-izquierda de la PANTALLA
  const lightSide = Math.sin(ang + Math.PI * 0.25) > 0 ? -1 : 1;
  ctx.fillStyle = rgba(shade(PAL.aqua100, -0.12), 0.95);
  ctx.save();
  ctx.scale(1, lightSide);
  ctx.fill(P.half);
  ctx.restore();
  ctx.restore();
  // cubierta (teca clara) y superestructura
  ctx.fillStyle = PAL.goldPale;
  ctx.fill(P.deck);
  ctx.fillStyle = PAL.white;
  ctx.fill(P.top);
  ctx.fillStyle = rgba(PAL.navy600, 0.18);
  ctx.fillRect(-38, lightSide > 0 ? 1.5 : -5, 50, 3.5);
  // pileta turquesa con brillo
  ctx.fillStyle = PAL.ocean400;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-30, -3.2, 16, 6.4, 2.5) : ctx.rect(-30, -3.2, 16, 6.4);
  ctx.fill();
  ctx.fillStyle = rgba(PAL.aqua100, 0.9);
  ctx.fillRect(-28, -2.4, 6, 1.4);
  // botes salvavidas naranjas a los costados
  ctx.fillStyle = PAL.brandOrange;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(-36 + i * 13, -9.2, 3.6, 1.6, 0, 0, TAU);
    ctx.ellipse(-36 + i * 13, 9.2, 3.6, 1.6, 0, 0, TAU);
    ctx.fill();
  }
  // chimenea de marca
  ctx.fillStyle = shade(PAL.brandOrange, -0.25);
  ctx.beginPath();
  ctx.ellipse(-4, 0.8, 6.2, 4.8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = PAL.brandOrange;
  ctx.beginPath();
  ctx.ellipse(-4.6, 0, 5.6, 4.4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = PAL.brandCyan;
  ctx.fillRect(-6.5, -4.4, 2.2, 8.8);
  ctx.fillStyle = PAL.ink;
  ctx.beginPath();
  ctx.ellipse(-3.6, 0, 2.4, 2, 0, 0, TAU);
  ctx.fill();
  // puente de mando (vidrios)
  ctx.fillStyle = PAL.navy600;
  ctx.fillRect(16, -4, 3, 8);
  // filo de luz del casco
  ctx.strokeStyle = rgba(PAL.white, 0.9);
  ctx.lineWidth = 1.4;
  ctx.stroke(P.top);
  ctx.restore();
}
