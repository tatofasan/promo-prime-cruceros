// Íconos de los calcos y del chat (formas planas con sombra dura propia). Centrados en (0,0), tamaño s.
import { PAL, shade, rgba } from '../../engine/color.js';

export function heartPath(x, y, s) {
  const p = new Path2D();
  p.moveTo(x, y + s * 0.36);
  p.bezierCurveTo(x - s * 0.62, y - s * 0.04, x - s * 0.36, y - s * 0.62, x, y - s * 0.27);
  p.bezierCurveTo(x + s * 0.36, y - s * 0.62, x + s * 0.62, y - s * 0.04, x, y + s * 0.36);
  p.closePath();
  return p;
}

/** Dos corazones superpuestos (EN PAREJA). */
export function iconCouple(c, s) {
  const back = heartPath(s * 0.13, -s * 0.06, s * 0.62);
  const front = heartPath(-s * 0.1, s * 0.06, s * 0.7);
  c.fillStyle = shade(PAL.gold, -0.25);
  c.save(); c.translate(3, 4); c.fill(back); c.restore();
  c.fillStyle = PAL.goldLight;
  c.fill(back);
  c.fillStyle = shade(PAL.coral, -0.35);
  c.save(); c.translate(3, 4); c.fill(front); c.restore();
  c.fillStyle = PAL.white;
  c.fill(front);
  c.save();
  c.clip(front);
  c.fillStyle = rgba(PAL.coral, 0.22);
  c.translate(5, 5);
  c.fill(front);
  c.restore();
  // brillito
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.beginPath(); c.ellipse(-s * 0.24, -s * 0.06, s * 0.06, s * 0.035, -0.7, 0, Math.PI * 2); c.fill();
}

function person(c, x, y, s, col, shadowCol) {
  const head = new Path2D();
  head.arc(x, y - s * 0.2, s * 0.15, 0, Math.PI * 2);
  const body = new Path2D();
  const bw = s * 0.42, top = y - s * 0.02, bot = y + s * 0.42;
  body.moveTo(x - bw / 2, bot);
  body.lineTo(x - bw / 2, top + bw * 0.42);
  body.arc(x, top + bw * 0.42, bw / 2, Math.PI, 0);
  body.lineTo(x + bw / 2, bot);
  body.closePath();
  c.fillStyle = shadowCol;
  c.save(); c.translate(2.5, 3); c.fill(head); c.fill(body); c.restore();
  c.fillStyle = col;
  c.fill(body);
  c.fill(head);
}

/** Dos adultos y un chico (EN FAMILIA). Se recorta al círculo del ícono. */
export function iconFamily(c, s) {
  const sh = shade(PAL.navy700, -0.4);
  person(c, -s * 0.2, -s * 0.02, s * 0.9, PAL.white, sh);
  person(c, s * 0.22, 0, s * 0.84, PAL.aqua200, sh);
  // el chico adelante, con un anillo del color del fondo que lo separa
  c.save();
  c.strokeStyle = PAL.navy700;
  c.lineWidth = s * 0.06;
  c.beginPath(); c.arc(s * 0.01, s * 0.08, s * 0.11, 0, Math.PI * 2); c.stroke();
  c.restore();
  person(c, s * 0.01, s * 0.22, s * 0.6, PAL.goldLight, sh);
}

function glass(c, x, y, s, ang, drink) {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  const bowl = new Path2D();
  bowl.moveTo(-s * 0.2, -s * 0.3);
  bowl.lineTo(s * 0.2, -s * 0.3);
  bowl.quadraticCurveTo(s * 0.2, s * 0.06, 0, s * 0.08);
  bowl.quadraticCurveTo(-s * 0.2, s * 0.06, -s * 0.2, -s * 0.3);
  bowl.closePath();
  c.fillStyle = shade(PAL.navy700, -0.2);
  c.save(); c.translate(2.5, 3); c.fill(bowl); c.restore();
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.fill(bowl);
  c.save();
  c.clip(bowl);
  c.fillStyle = drink;
  c.fillRect(-s * 0.3, -s * 0.16, s * 0.6, s * 0.4);
  c.fillStyle = shade(drink, -0.18);
  c.fillRect(s * 0.06, -s * 0.16, s * 0.3, s * 0.4);
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.fillRect(-s * 0.15, -s * 0.27, s * 0.05, s * 0.22);
  c.restore();
  // pie
  c.fillStyle = PAL.white;
  c.fillRect(-s * 0.025, s * 0.07, s * 0.05, s * 0.2);
  c.beginPath(); c.ellipse(0, s * 0.28, s * 0.12, s * 0.035, 0, 0, Math.PI * 2); c.fill();
  c.restore();
}

/** Dos copas que brindan con chispa (CON AMIGOS). */
export function iconToast(c, s) {
  glass(c, -s * 0.13, s * 0.04, s, -0.32, PAL.coral);
  glass(c, s * 0.13, s * 0.04, s, 0.32, PAL.gold);
  // chispa del chin-chin
  c.strokeStyle = PAL.white;
  c.lineCap = 'round';
  c.lineWidth = s * 0.05;
  for (const a of [-2.3, -1.57, -0.84]) {
    c.beginPath();
    c.moveTo(Math.cos(a) * s * 0.3, -s * 0.3 + Math.sin(a) * s * 0.12);
    c.lineTo(Math.cos(a) * s * 0.44, -s * 0.3 + Math.sin(a) * s * 0.24);
    c.stroke();
  }
}

/** Tilde que se dibuja (p 0..1) con trazo redondeado. */
export function checkStroke(c, s, p, color = PAL.white, width = 0) {
  if (p <= 0) return;
  const pts = [[-s * 0.26, s * 0.02], [-s * 0.06, s * 0.22], [s * 0.3, -s * 0.2]];
  const l1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
  const l2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
  const L = (l1 + l2) * Math.min(1, p);
  c.strokeStyle = color;
  c.lineWidth = width || s * 0.13;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  if (L <= l1) {
    const f = L / l1;
    c.lineTo(pts[0][0] + (pts[1][0] - pts[0][0]) * f, pts[0][1] + (pts[1][1] - pts[0][1]) * f);
  } else {
    c.lineTo(pts[1][0], pts[1][1]);
    const f = (L - l1) / l2;
    c.lineTo(pts[1][0] + (pts[2][0] - pts[1][0]) * f, pts[1][1] + (pts[2][1] - pts[1][1]) * f);
  }
  c.stroke();
}
