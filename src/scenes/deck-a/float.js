// Flotador redondo a rayas coral/blancas con una chica que flota (boca arriba, brazos sobre el aro, trago en la
// mano). Vista cenital: toroide con sombreado de 3 tonos (medialunas según el sol), brillos especulares, costuras,
// válvula y gotitas. Es el círculo del match cut con el plato: R = 62 → 210 px en el corte.
import { PAL, mixHex } from '../../engine/color.js';
import { TAU, clamp, E } from '../../engine/ease.js';
import { sparkle } from '../../engine/draw.js';
import { crescent } from './shape.js';
import { drawFigureArt } from './figure.js';
import { SKIN, HAIR } from './pool-pal.js';
import { RING } from './pool-timeline.js';
import { SUN } from './pool-geo.js';

const { R, r } = RING;
const RM = (R + r) / 2;
const N = 8;
const CORAL = PAL.coral, WHITE = '#FFF9F2';

const ring = (ox = 0, oy = 0, into = null) => {
  const p = into || new Path2D();
  p.moveTo(ox + R, oy);
  p.arc(ox, oy, R, 0, TAU, false);
  p.closePath();
  p.moveTo(ox + r, oy);
  p.arc(ox, oy, r, TAU, 0, true);
  p.closePath();
  return p;
};
const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/** El aro solo (coordenadas locales: centro 0,0; a = rotación del aro; la luz no rota). */
export function drawRing(ctx, a, t, { wet = 1 } = {}) {
  const L = SUN;
  // gajos de colores
  for (let k = 0; k < N; k++) {
    const a0 = a + (k / N) * TAU, a1 = a + ((k + 1) / N) * TAU;
    ctx.fillStyle = k % 2 ? WHITE : CORAL;
    ctx.beginPath();
    ctx.arc(0, 0, R, a0, a1, false);
    ctx.arc(0, 0, r, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }
  // sombra propia (medialunas del lado contrario al sol) y filo de luz
  crescent(ctx, ring, L[0] * 9, L[1] * 9, 'rgba(120,30,40,0.30)');
  crescent(ctx, ring, L[0] * 4, L[1] * 4, 'rgba(90,20,40,0.22)');
  crescent(ctx, ring, -L[0] * 4.5, -L[1] * 4.5, 'rgba(255,250,240,0.55)');
  // costuras entre gajos y la del ecuador
  ctx.lineCap = 'round';
  for (let k = 0; k < N; k++) {
    const aa = a + (k / N) * TAU;
    ctx.strokeStyle = 'rgba(120,40,40,0.25)';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(Math.cos(aa) * (r + 1), Math.sin(aa) * (r + 1)); ctx.lineTo(Math.cos(aa) * (R - 1), Math.sin(aa) * (R - 1)); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(0, 0, R - 3.2, 0, TAU); ctx.stroke();
  // brillos especulares: arriba-derecha afuera, abajo-izquierda adentro (vinilo brilloso)
  const la = Math.atan2(L[1], L[0]);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 4.2;
  ctx.beginPath(); ctx.arc(0, 0, RM + 6.5, la - 0.62, la + 0.5); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath(); ctx.arc(0, 0, RM - 6, la + Math.PI - 0.45, la + Math.PI + 0.35); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  const [sx, sy] = [Math.cos(la - 0.1) * (RM + 6.5), Math.sin(la - 0.1) * (RM + 6.5)];
  ctx.beginPath(); ctx.ellipse(sx, sy, 3.6, 1.9, la + Math.PI / 2, 0, TAU); ctx.fill();
  // válvula
  const va = a + 3.6;
  const [vx, vy] = [Math.cos(va) * (RM + 2), Math.sin(va) * (RM + 2)];
  ctx.fillStyle = 'rgba(100,30,30,0.35)';
  ctx.beginPath(); ctx.arc(vx - L[0] * 1.6, vy - L[1] * 1.6, 4.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(vx, vy, 3.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#E9EEF2';
  ctx.beginPath(); ctx.arc(vx - L[0] * 0.8, vy - L[1] * 0.8, 2.2, 0, TAU); ctx.fill();
  // gotitas que brillan
  if (wet) {
    for (let k = 0; k < 9; k++) {
      const ga = a + k * 0.81 + 0.3, gr = r + 6 + ((k * 7) % 27);
      const [gx, gy] = [Math.cos(ga) * gr, Math.sin(ga) * gr];
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(gx, gy, 0.9 + (k % 3) * 0.4, 0, TAU); ctx.fill();
    }
    const tw = Math.pow(Math.max(0, Math.sin(t * 3.1 + 1)), 6);
    if (tw > 0.05) sparkle(ctx, sx, sy, 9 * tw, { alpha: tw, rot: 0.3 });
  }
}

/** Trago tropical visto de arriba (vaso, líquido atardecer, rodaja de naranja, sombrillita, sorbete). */
export function drawDrink(ctx, s = 1, t = 0) {
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(0, 0, 8.2, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 7.4);
  g.addColorStop(0, PAL.goldLight); g.addColorStop(0.6, PAL.gold); g.addColorStop(1, PAL.coral);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, 7.2, 0, TAU); ctx.fill();
  // hielo
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(-4, -1, 3.2, 3.2); ctx.fillRect(0.5, 1.5, 2.8, 2.8);
  // rodaja de naranja en el borde
  ctx.fillStyle = PAL.goldLight;
  ctx.beginPath(); ctx.arc(5.5, -5.2, 4.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#FF9F2E';
  ctx.beginPath(); ctx.arc(5.5, -5.2, 3.7, 0, TAU); ctx.fill();
  ctx.strokeStyle = PAL.goldPale;
  ctx.lineWidth = 0.5;
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; ctx.beginPath(); ctx.moveTo(5.5, -5.2); ctx.lineTo(5.5 + Math.cos(a) * 3.6, -5.2 + Math.sin(a) * 3.6); ctx.stroke(); }
  // sorbete
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-1, 1); ctx.lineTo(-7.5, 7.5); ctx.stroke();
  ctx.strokeStyle = PAL.coral;
  ctx.setLineDash([1.2, 1.4]);
  ctx.beginPath(); ctx.moveTo(-1, 1); ctx.lineTo(-7.5, 7.5); ctx.stroke();
  ctx.setLineDash([]);
  // sombrillita de cóctel
  ctx.save();
  ctx.translate(-3.5, -4.5);
  ctx.rotate(t * 0.6);
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = k % 2 ? '#FFFFFF' : PAL.brandCyan;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 5.4, (k / 6) * TAU, ((k + 1) / 6) * TAU); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath(); ctx.arc(1.2, -1.2, 2.4, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
}

/**
 * Flotador + chica en coordenadas de mundo (el ctx ya está en el plano del agua).
 * st = floatAt(t). raise 0..1 = brazo con el trago hacia la cámara.
 */
export function drawFloat(ctx, t, st, { raise = 0, rider = true, warm = 0, warmAng = -1.1 } = {}) {
  ctx.save();
  ctx.translate(st.x, st.y);
  ctx.scale(st.bob, st.bob);
  // anillos en el agua alrededor (meniscos)
  for (let k = 0; k < 2; k++) {
    const q = ((t * 0.55 + k * 0.5) % 1);
    ctx.strokeStyle = `rgba(240,253,255,${0.45 * (1 - q)})`;
    ctx.lineWidth = 2.2 * (1 - q) + 0.6;
    ctx.beginPath(); ctx.arc(0, 0, R + 4 + q * 34, 0, TAU); ctx.stroke();
  }
  // sombra de contacto sobre el agua
  ctx.fillStyle = 'rgba(8,60,100,0.18)';
  ctx.beginPath(); ctx.arc(-SUN[0] * 6, -SUN[1] * 6, R + 3, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(0, 0, R + 1.5, 0, TAU); ctx.stroke();
  drawRing(ctx, st.rot, t);
  // filo cálido (anticipa la vela de la cena) en los últimos cuadros antes del corte
  if (warm > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,190,90,${0.35 * warm})`;
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.arc(0, 0, R - 2, warmAng - 1.25, warmAng + 1.25); ctx.stroke();
    ctx.strokeStyle = `rgba(255,232,170,${0.9 * warm})`;
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.arc(0, 0, R - 1, warmAng - 0.95, warmAng + 0.95); ctx.stroke();
    ctx.strokeStyle = `rgba(255,214,140,${0.5 * warm})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r + 1.5, warmAng + Math.PI - 0.8, warmAng + Math.PI + 0.8); ctx.stroke();
    ctx.restore();
  }
  if (!rider) { ctx.restore(); return null; }
  // la chica (rota con el aro; la luz va en su sistema local). Más chica que el aro para que se lea el círculo.
  ctx.rotate(st.rot);
  const Lloc = rot(SUN, -st.rot);
  const up = E.outBack(clamp(raise));
  const pose = { aL: [0.98, -0.6], aR: [0.98 - 0.3 * up, -0.6 + 0.2 * up], lL: [0.16, 0.12], lR: [0.02, 0.32] };
  // sombra del cuerpo sobre el aro y el agua (hacia abajo a la izquierda)
  const [sx, sy] = rot([-SUN[0] * 7, -SUN[1] * 7], -st.rot);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(0.86, 0.86);
  ctx.fillStyle = 'rgba(70,20,40,0.22)';
  ctx.beginPath(); ctx.ellipse(0, -22, 17, 40, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -72, 12, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(0, 8);
  ctx.scale(0.86, 0.86);
  const res = drawFigureArt(ctx, t, {
    L: Lloc, skin: SKIN[0], hair: HAIR[0], hairStyle: 'long', suit: PAL.navy700, trim: PAL.gold, pose,
  });
  // el trago en la mano derecha (crece al levantarlo: escorzo hacia la cámara)
  const [hx, hy] = res.hands[1];
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-st.rot * 0.3);
  if (up > 0.02) {
    ctx.fillStyle = `rgba(60,20,30,${0.22 * up})`;
    ctx.beginPath(); ctx.arc(-Lloc[0] * 9 * up, -Lloc[1] * 9 * up, 9 * (1 + 0.7 * up), 0, TAU); ctx.fill();
  }
  drawDrink(ctx, 1.05 + 1.25 * up, t);
  ctx.restore();
  res.drink = [hx * 0.86, hy * 0.86 + 8];
  ctx.fillStyle = SKIN[0].base;
  ctx.beginPath(); ctx.ellipse(hx - 5.5, hy + 4, 3, 4.2, 0.6, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
  return res;
}

/**
 * La chica se larga del aro de cabeza (vista cenital: el cuerpo se acorta al ponerse vertical) y entra al agua.
 * p 0..1 = progreso del salto · from = [x, y] centro del aro al largarse · dir = ángulo (mundo) hacia la cabeza.
 */
export function drawDiver(ctx, t, p, { from, dir, rot0, out }) {
  if (p <= 0 || p >= 1) return;
  const ux = Math.cos(dir), uy = Math.sin(dir);
  const go = E.inOutSine(p);
  const px = from[0] - ux * 8 + ux * (out + 8) * go, py = from[1] - uy * 8 + uy * (out + 8) * go;
  const lift = Math.sin(Math.PI * Math.min(1, p * 1.15));
  const s = 0.86 * (1 + 0.22 * lift);
  const fore = 1 - 0.62 * E.inCubic(p);
  const a = rot0 + 0.35 * go;
  ctx.save();
  // sombra sobre el agua (más lejos cuanto más alto)
  ctx.fillStyle = `rgba(16,60,100,${0.22 * (1 - p * 0.5)})`;
  ctx.beginPath(); ctx.ellipse(px - SUN[0] * 14 * lift - ux * 30 * fore, py - SUN[1] * 14 * lift - uy * 30 * fore, 22 * s, 58 * s * fore, a, 0, TAU); ctx.fill();
  ctx.translate(px, py);
  ctx.rotate(a);
  ctx.scale(s, s * fore);
  const Lloc = rot(SUN, -a);
  drawFigureArt(ctx, t, {
    L: Lloc, skin: SKIN[0], hair: HAIR[0], hairStyle: 'long', suit: PAL.navy700, trim: PAL.gold,
    pose: { aL: [2.85 - 0.3 * (1 - go), 0.12], aR: [2.75 - 0.3 * (1 - go), 0.15], lL: [0.06, 0.05], lR: [0.04, 0.12] },
  });

  ctx.restore();
}

/** Silueta del aro solo (sombra cuando la chica ya se tiró). */
export function ringSilhouette(c) {
  c.beginPath(); c.arc(0, 0, R, 0, TAU); c.arc(0, 0, r, TAU, 0, true); c.fill();
}

/** Silueta para la sombra en el fondo (aro + cuerpo aproximado). */
export function floatSilhouette(c) {
  c.beginPath(); c.arc(0, 0, R, 0, TAU); c.arc(0, 0, r, TAU, 0, true); c.fill();
  c.beginPath(); c.ellipse(0, -10, 18, 55, 0, 0, TAU); c.fill();
  c.beginPath(); c.arc(0, -72, 12, 0, TAU); c.fill();
}

export { WHITE as RING_WHITE, CORAL as RING_CORAL, mixHex };
