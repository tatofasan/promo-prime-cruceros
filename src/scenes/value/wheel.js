// TIMÓN que gira detrás del especialista: aro y rayos en navy con filo de luz (la luz NO gira con él:
// el sombreado se calcula en coordenadas del mundo), manijas torneadas y maza de bronce.
import { PAL, shade, rgba } from '../../engine/color.js';
import { TAU } from '../../engine/ease.js';
import { shade3, LIGHT } from './shade3.js';
import { tones } from './util.js';

const WOOD = tones(PAL.navy500, -0.36, 0.34);
const BRASS = tones(PAL.gold, -0.28, 0.5);
const N = 8;

function spokePath(R) {
  // rayo afinado + manija torneada (bulbo, cuello, bulbo) hacia afuera del aro
  const p = new Path2D();
  const w0 = 17, w1 = 11;
  p.moveTo(40, -w0); p.lineTo(R - 10, -w1); p.lineTo(R + 22, -w1);
  p.quadraticCurveTo(R + 40, -w1 - 12, R + 58, -12);
  p.quadraticCurveTo(R + 66, -8, R + 72, -14);
  p.quadraticCurveTo(R + 104, -22, R + 108, 0);
  p.quadraticCurveTo(R + 104, 22, R + 72, 14);
  p.quadraticCurveTo(R + 66, 8, R + 58, 12);
  p.quadraticCurveTo(R + 40, w1 + 12, R + 22, w1);
  p.lineTo(R - 10, w1); p.lineTo(40, w0);
  p.closePath();
  return p;
}

/** Dibuja el timón centrado en (0,0) con radio de aro R, girado `ang` rad. alpha opcional. */
export function drawWheel(c, R, ang, { glow = 0 } = {}) {
  const sp = spokePath(R);
  // sombra proyectada de todo el timón (abajo a la derecha)
  c.save();
  c.translate(16, 22);
  c.fillStyle = rgba(PAL.ink, 0.35);
  c.save();
  c.rotate(ang);
  for (let i = 0; i < N; i++) { c.save(); c.rotate((i / N) * TAU); c.fill(sp); c.restore(); }
  c.restore();
  c.lineWidth = 44;
  c.strokeStyle = rgba(PAL.ink, 0.35);
  c.beginPath(); c.arc(0, 0, R - 4, 0, TAU); c.stroke();
  c.restore();
  // rayos (sombreado con la luz del mundo)
  for (let i = 0; i < N; i++) {
    const a = ang + (i / N) * TAU;
    c.save();
    c.rotate(a);
    const ca = Math.cos(-a), sa = Math.sin(-a);
    const lx = LIGHT[0] * ca - LIGHT[1] * sa, ly = LIGHT[0] * sa + LIGHT[1] * ca;
    shade3(c, sp, WOOD, { sh: 8, rim: 3, lx, ly });
    // anillo de bronce en el cuello de la manija
    c.fillStyle = BRASS.base;
    c.fillRect(R + 50, -15, 8, 30);
    c.fillStyle = BRASS.light;
    c.fillRect(R + 50, -15, 3, 30);
    c.restore();
  }
  // aro: anillo grueso con sombra abajo-derecha y filo arriba-izquierda (invariante al giro)
  const ring = new Path2D();
  ring.arc(0, 0, R + 18, 0, TAU);
  ring.arc(0, 0, R - 26, 0, TAU, true);
  shade3(c, ring, WOOD, { sh: 9, rim: 3.5 });
  // ranura interior del aro
  c.strokeStyle = rgba(PAL.ink, 0.3);
  c.lineWidth = 3;
  c.beginPath(); c.arc(0, 0, R - 4, 0, TAU); c.stroke();
  c.strokeStyle = rgba(PAL.aqua200, 0.16);
  c.beginPath(); c.arc(-1.5, -1.5, R - 7, 0, TAU); c.stroke();
  // remaches de bronce sobre el aro, en cada rayo
  for (let i = 0; i < N; i++) {
    const a = ang + (i / N) * TAU + TAU / (N * 2);
    const x = Math.cos(a) * (R - 4), y = Math.sin(a) * (R - 4);
    c.fillStyle = BRASS.dark;
    c.beginPath(); c.arc(x + 1.5, y + 2, 7.5, 0, TAU); c.fill();
    c.fillStyle = BRASS.base;
    c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fill();
    c.fillStyle = BRASS.light;
    c.beginPath(); c.arc(x - 2.2, y - 2.2, 2.8, 0, TAU); c.fill();
  }
  // maza central
  const hub = new Path2D();
  hub.arc(0, 0, 70, 0, TAU);
  shade3(c, hub, WOOD, { sh: 10, rim: 3 });
  const cap = new Path2D();
  cap.arc(0, 0, 42, 0, TAU);
  shade3(c, cap, BRASS, { sh: 7, rim: 3 });
  c.fillStyle = shade(PAL.gold, -0.45);
  c.beginPath(); c.arc(0, 0, 10, 0, TAU); c.fill();
  if (glow > 0.01) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = rgba(PAL.aqua300, 0.35 * glow);
    c.lineWidth = 14;
    c.beginPath(); c.arc(0, 0, R + 30, 0, TAU); c.stroke();
    c.restore();
  }
}
