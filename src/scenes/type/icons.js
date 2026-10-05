// Pictogramas de los chips de escena (navy sobre el disco dorado). Centrados en (0, 0), caja de lado s.
// Trazos redondeados de grosor variado y un acento claro: que se lean a 36 px y tengan oficio de cerca.
import { PAL } from '../../engine/color.js';
import { starPath } from '../../engine/draw.js';

const INK = PAL.navy800;
const LIT = '#FFF4D6';

function line(c, w, pts) {
  c.lineWidth = w;
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
}

/** Escalera de pileta + agua. */
function pool(c, s) {
  const u = s / 40;
  c.strokeStyle = INK;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const dx of [-7, 7]) {
    c.lineWidth = 3.4 * u;
    c.beginPath();
    c.moveTo((dx - 7) * u, -6 * u);
    c.arc(dx * u, -6 * u, 7 * u, Math.PI, Math.PI * 1.75);
    c.stroke();
    line(c, 3.4 * u, [[(dx - 7) * u, -6 * u], [(dx - 7) * u, 6 * u]]);
  }
  line(c, 2.6 * u, [[-14 * u, -1 * u], [0, -1 * u]]);
  line(c, 2.6 * u, [[-14 * u, 5 * u], [0, 5 * u]]);
  // olas
  for (const [y, w] of [[11, 3], [17, 2.4]]) {
    c.lineWidth = w * u;
    c.beginPath();
    for (let i = 0; i <= 24; i++) {
      const x = -17 + (34 * i) / 24;
      const yy = y + Math.sin((x / 34) * Math.PI * 4) * 2;
      i ? c.lineTo(x * u, yy * u) : c.moveTo(x * u, yy * u);
    }
    c.stroke();
  }
}

/** Campana de cena con perilla, plato y vapor. */
function cloche(c, s) {
  const u = s / 40;
  c.fillStyle = INK;
  c.beginPath();
  c.moveTo(-15 * u, 7 * u);
  c.arc(0, 7 * u, 15 * u, Math.PI, 0);
  c.closePath();
  c.fill();
  // brillo del domo
  c.strokeStyle = LIT;
  c.lineCap = 'round';
  c.lineWidth = 2.2 * u;
  c.beginPath();
  c.arc(0, 7 * u, 10.5 * u, Math.PI * 1.15, Math.PI * 1.42);
  c.stroke();
  c.fillStyle = INK;
  c.beginPath(); c.arc(0, -10.5 * u, 3 * u, 0, Math.PI * 2); c.fill();
  c.strokeStyle = INK;
  line(c, 3.6 * u, [[-18 * u, 10.5 * u], [18 * u, 10.5 * u]]);
  line(c, 2 * u, [[-9 * u, 15 * u], [9 * u, 15 * u]]);
}

/** Estrella de show con destellos. */
function star(c, s) {
  const u = s / 40;
  c.fillStyle = INK;
  c.fill(starPath(-1 * u, 2 * u, 15 * u, 6.6 * u, 5));
  c.fillStyle = LIT;
  c.fill(starPath(-3.5 * u, -1.5 * u, 4.2 * u, 1.8 * u, 5));
  c.fillStyle = INK;
  for (const [x, y, r] of [[14, -12, 3.6], [16, 8, 2.4]]) {
    c.beginPath();
    c.moveTo(x * u, (y - r) * u);
    c.quadraticCurveTo((x + 0.4) * u, (y - 0.4) * u, (x + r) * u, y * u);
    c.quadraticCurveTo((x + 0.4) * u, (y + 0.4) * u, x * u, (y + r) * u);
    c.quadraticCurveTo((x - 0.4) * u, (y + 0.4) * u, (x - r) * u, y * u);
    c.quadraticCurveTo((x - 0.4) * u, (y - 0.4) * u, x * u, (y - r) * u);
    c.fill();
  }
}

/** Sol que se hunde en el horizonte, con rayos. */
function sunset(c, s, t = 0) {
  const u = s / 40;
  c.fillStyle = INK;
  c.beginPath();
  c.moveTo(-10 * u, 4 * u);
  c.arc(0, 4 * u, 10 * u, Math.PI, 0);
  c.closePath();
  c.fill();
  c.strokeStyle = INK;
  c.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    const a = Math.PI + (k + 0.5) * (Math.PI / 5) + Math.sin(t * 2) * 0.05;
    line(c, 2.8 * u, [[Math.cos(a) * 14 * u, 4 * u + Math.sin(a) * 14 * u], [Math.cos(a) * 19 * u, 4 * u + Math.sin(a) * 19 * u]]);
  }
  line(c, 3.4 * u, [[-18 * u, 8.5 * u], [18 * u, 8.5 * u]]);
  line(c, 2.4 * u, [[-11 * u, 13.5 * u], [11 * u, 13.5 * u]]);
  line(c, 1.8 * u, [[-5 * u, 17.5 * u], [5 * u, 17.5 * u]]);
}

export const ICONS = { pool, cloche, star, sunset };
