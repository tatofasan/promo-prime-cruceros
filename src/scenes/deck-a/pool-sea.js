// Más allá de la baranda: el mar MUY abajo (h = −3300, se mueve a la mitad que la cubierta: parallax), con
// crestas, espuma que corre hacia atrás (el barco avanza) y un velerito. La baranda de vidrio con pasamanos
// de teca se dibuja en perspectiva (los parantes apuntan lejos del centro).
import { makeCanvas } from '../../engine/env.js';
import { PAL, mixHex } from '../../engine/color.js';
import { rng, hash } from '../../engine/noise.js';
import { TAU } from '../../engine/ease.js';
import { flatten, project, atH, scaleAt } from './util.js';
import { EDGE_X, SEA_H, RAIL_H, DECK } from './pool-geo.js';
import { TEAK } from './pool-pal.js';

const TS = 512;
let tile = null;

function bakeTile() {
  const c = makeCanvas(TS, TS);
  const x = c.getContext('2d');
  x.fillStyle = PAL.ocean700;
  x.fillRect(0, 0, TS, TS);
  const R = rng(5150);
  // manchas de profundidad
  for (let i = 0; i < 18; i++) {
    const px = R() * TS, py = R() * TS, r = 60 + R() * 120;
    for (const [dx, dy] of [[0, 0], [TS, 0], [-TS, 0], [0, TS], [0, -TS]]) {
      const g = x.createRadialGradient(px + dx, py + dy, 0, px + dx, py + dy, r);
      g.addColorStop(0, R() < 0.5 ? 'rgba(10,35,64,0.35)' : 'rgba(30,140,190,0.25)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(px + dx - r, py + dy - r, r * 2, r * 2);
    }
  }
  // crestas: medialunas claras con sombra debajo
  for (let i = 0; i < 150; i++) {
    const px = R() * TS, py = R() * TS, w = 14 + R() * 34, a = 0.25 + R() * 0.45;
    for (const [dx, dy] of [[0, 0], [TS, 0], [-TS, 0], [0, TS], [0, -TS]]) {
      const X = px + dx, Y = py + dy;
      if (X < -60 || X > TS + 60 || Y < -20 || Y > TS + 20) continue;
      x.strokeStyle = `rgba(6,30,58,${a * 0.6})`;
      x.lineWidth = 3;
      x.beginPath(); x.moveTo(X - w / 2, Y + 3); x.quadraticCurveTo(X, Y - 3, X + w / 2, Y + 3); x.stroke();
      x.strokeStyle = `rgba(200,240,250,${a})`;
      x.lineWidth = 1.8;
      x.beginPath(); x.moveTo(X - w / 2, Y); x.quadraticCurveTo(X, Y - 6, X + w / 2, Y); x.stroke();
    }
  }
  tile = flatten(c);
}

/** Mar de fondo en todo el cuadro (lo tapa la cubierta salvo más allá de la baranda). */
export function drawSea(ctx, C, t) {
  if (!tile) bakeTile();
  ctx.save();
  atH(ctx, C, SEA_H);
  // corre hacia atrás (abajo): el barco va hacia arriba
  const vy = (t * 260) % TS;
  const ks = scaleAt(C, SEA_H), kd = scaleAt(C, 0);
  const xEdge = C.x + (EDGE_X - C.x) * (kd / ks) - 400; // lo que queda a la izquierda lo tapa la cubierta
  const R = 1250 / ks;
  const cx = C.x, cy = C.y;
  const ix = Math.floor(Math.max(xEdge, cx - R) / TS), ix1 = Math.ceil((cx + R) / TS);
  const jy = Math.floor((cy - R - vy) / TS), jy1 = Math.ceil((cy + R - vy) / TS);
  for (let i = ix; i < ix1; i++) {
    for (let j = jy; j < jy1; j++) ctx.drawImage(tile, i * TS, j * TS + vy, TS + 0.5, TS + 0.5);
  }
  // espuma de la estela que corre, cerca del casco (a la izquierda de la franja visible)
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 26; i++) {
    const y = ((hash(i, 3) * 4200 + t * 260 * 1.15) % 4200) - 2100 + cy;
    const x = EDGE_X + 260 + hash(i, 4) * 520;
    ctx.fillStyle = 'rgba(235,250,255,0.5)';
    ctx.beginPath(); ctx.ellipse(x, y, 30 + hash(i, 5) * 60, 4 + hash(i, 6) * 5, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // velerito que pasa
  const by = 900 - ((t - 5.6) * 120);
  const bx = EDGE_X + 1180;
  ctx.fillStyle = 'rgba(4,16,31,0.35)';
  ctx.beginPath(); ctx.ellipse(bx + 30, by + 30, 22, 54, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#F4F7F9';
  ctx.beginPath(); ctx.moveTo(bx, by - 60); ctx.quadraticCurveTo(bx + 24, by - 10, bx + 14, by + 50); ctx.lineTo(bx - 14, by + 50); ctx.quadraticCurveTo(bx - 24, by - 10, bx, by - 60); ctx.fill();
  ctx.fillStyle = PAL.coral;
  ctx.beginPath(); ctx.moveTo(bx, by - 52); ctx.lineTo(bx + 46, by + 22); ctx.lineTo(bx, by + 20); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(235,250,255,0.6)';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(bx - 10, by + 60); ctx.quadraticCurveTo(bx - 30, by + 190, bx - 70, by + 330); ctx.moveTo(bx + 10, by + 60); ctx.quadraticCurveTo(bx + 30, by + 190, bx + 70, by + 330); ctx.stroke();
  ctx.restore();
  // brillo atmosférico: el mar lejano se aclara y se enfría
  // (solo la franja que se ve más allá del borde)
  const xs = Math.min(project(C, EDGE_X, C.y - 800, 0)[0], project(C, EDGE_X, C.y + 800, 0)[0]) - 30;
  if (xs < 1920) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(120,200,230,0.16)';
    ctx.fillRect(Math.max(0, xs), 0, 1920 - Math.max(0, xs), 1080);
    ctx.restore();
  }
}

/** Baranda de vidrio con pasamanos (perspectiva por punto). Rango y del mundo visible. */
export function drawRail(ctx, C, t, y0 = DECK.y0, y1 = DECK.y1) {
  const X = EDGE_X - 5;
  // solo el tramo visible
  const vis = 620 / scaleAt(C, 0) + 60;
  if (project(C, X, C.y, RAIL_H)[0] > 2000 && project(C, X, C.y - vis, 0)[0] > 2000) return;
  y0 = Math.max(y0, C.y - vis * 1.2); y1 = Math.min(y1, C.y + vis * 1.2);
  const step = 118;
  // vidrios
  for (let y = Math.floor(y0 / step) * step; y < y1; y += step) {
    const a = project(C, X, y + 6, 6), b = project(C, X, y + step - 6, 6);
    const c = project(C, X, y + step - 6, RAIL_H - 10), d = project(C, X, y + 6, RAIL_H - 10);
    ctx.fillStyle = 'rgba(150,225,240,0.26)';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
    // reflejo diagonal en el vidrio
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    const m = (p, q, u) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
    const e = m(a, b, 0.3), f = m(d, c, 0.55);
    ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(f[0], f[1]); ctx.stroke();
  }
  // parantes
  for (let y = Math.floor(y0 / step) * step; y < y1; y += step) {
    const a = project(C, X, y, 0), b = project(C, X, y, RAIL_H);
    ctx.strokeStyle = '#8FA3B4';
    ctx.lineWidth = 7 * b[2];
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.strokeStyle = '#F4F8FA';
    ctx.lineWidth = 2.4 * b[2];
    ctx.beginPath(); ctx.moveTo(a[0] + 1.5, a[1] - 1); ctx.lineTo(b[0] + 1.5, b[1] - 1); ctx.stroke();
  }
  // pasamanos de teca: sombra, cuerpo y filo de luz
  const pts = [];
  for (let y = y0; y <= y1; y += 40) pts.push(project(C, X, y, RAIL_H));
  const line = (dx, dy, col, w) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)));
    ctx.stroke();
  };
  const k = pts[Math.floor(pts.length / 2)][2];
  line(-3 * k, 2 * k, 'rgba(40,24,14,0.35)', 15 * k);
  line(0, 0, TEAK.mid, 13 * k);
  line(2.5 * k, -1 * k, mixHex(TEAK.light, '#ffffff', 0.25), 4 * k);
}
