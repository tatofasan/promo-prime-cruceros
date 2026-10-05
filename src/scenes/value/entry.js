// Entrada de VALOR (20,5 → val.in): una BANDA CIAN que sube desde abajo con borde líquido (lenguas que se
// adelantan, ondulación) y smear vertical, continuando el látigo hacia arriba de MAPA. La máscara la usa el
// compositor (maskFrom/maskUntil); el labio de espuma y las gotas van encima (over).
import { W, H } from '../../engine/time.js';
import { PAL, rgba } from '../../engine/color.js';
import { E, clamp, prog, lerp, TAU } from '../../engine/ease.js';
import { rng } from '../../engine/noise.js';
import { T } from './timeline.js';

let FINGERS = null, DROPS = null, STREAKS = null;
function init() {
  if (FINGERS) return;
  const r = rng(2063);
  FINGERS = [];
  for (let i = 0; i < 7; i++) {
    FINGERS.push({ x: (i + 0.15 + 0.7 * r()) * (W / 7), w: 70 + 110 * r(), h: 110 + 190 * r(), ph: r() * TAU });
  }
  DROPS = [];
  for (let i = 0; i < 34; i++) DROPS.push({ x: r() * W, up: 60 + 260 * r(), rad: 4 + 7 * r(), vy: 0.6 + 0.8 * r(), col: r() < 0.3 ? PAL.aqua100 : '#FFFFFF' });
  STREAKS = [];
  for (let i = 0; i < 22; i++) STREAKS.push({ x: r() * W, len: 160 + 380 * r(), w: 3 + 9 * r(), a: 0.25 + 0.45 * r() });
}

/** Progreso del barrido (0..1) entre T.win y val.in. */
const bandP = (t) => prog(t, T.win, T.in);
/** Altura del frente de la banda: arranca abajo de cuadro y sale por arriba un poco antes del cue. */
function bandY(p) {
  const e = 0.5 * p + 0.5 * E.outQuad(p);
  return lerp(H + 150, -300, e);
}

/** y del borde en x (lenguas que se adelantan mientras la banda va rápido). */
function edgeY(x, t, Y, sp) {
  let y = Y + 26 * Math.sin(x * 0.0047 + 1.7 + t * 7) + 14 * Math.sin(x * 0.0123 - t * 11);
  for (const f of FINGERS) {
    const d = (x - f.x) / f.w;
    y -= f.h * sp * Math.exp(-d * d) * (0.8 + 0.2 * Math.sin(t * 20 + f.ph));
  }
  return y;
}

function edgePath(c, t, Y, sp, dy = 0) {
  c.beginPath();
  c.moveTo(-20, H + 20);
  for (let x = -20; x <= W + 20; x += 24) c.lineTo(x, edgeY(x, t, Y, sp) + dy);
  c.lineTo(W + 20, H + 20);
  c.closePath();
}

/** Máscara: la región ya cubierta por la banda (con borde suavizado por el smear vertical). */
export function drawEntryMask(c, t) {
  init();
  const p = bandP(t);
  if (p >= 1) { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); return; }
  const Y = bandY(p), sp = 1 - 0.65 * p;
  c.fillStyle = '#fff';
  edgePath(c, t, Y, sp);
  c.fill();
  // smear: copias corridas hacia arriba cada vez más transparentes (el borde «arrastra» la imagen)
  for (const [dy, a] of [[-26, 0.4], [-56, 0.2], [-96, 0.09]]) {
    c.globalAlpha = a;
    edgePath(c, t, Y, sp, dy);
    c.fill();
  }
  // estrías verticales sobre las lenguas
  for (const s of STREAKS) {
    const y0 = edgeY(s.x, t, Y, sp);
    const g = c.createLinearGradient(0, y0 - s.len, 0, y0 + 10);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, `rgba(255,255,255,${s.a})`);
    c.globalAlpha = 1;
    c.fillStyle = g;
    c.fillRect(s.x - s.w / 2, y0 - s.len, s.w, s.len + 10);
  }
  c.globalAlpha = 1;
}

/** Encima: labio de espuma en el borde, brillo y gotas que salen despedidas hacia arriba. */
export function drawEntryEdge(c, t) {
  init();
  if (t < T.win || t > T.in + 0.02) return;
  const p = bandP(t);
  const Y = bandY(p), sp = 1 - 0.65 * p;
  const fade = 1 - E.inCubic(clamp((p - 0.7) / 0.32));
  if (fade <= 0.01) return;
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const line = (dy) => {
    c.beginPath();
    for (let x = -20; x <= W + 20; x += 24) {
      const y = edgeY(x, t, Y, sp) + dy;
      if (x === -20) c.moveTo(x, y); else c.lineTo(x, y);
    }
  };
  // halo aqua + labio blanco + sombra navy justo debajo (da volumen al borde del líquido)
  c.strokeStyle = rgba(PAL.navy700, 0.35 * fade);
  c.lineWidth = 16;
  line(14); c.stroke();
  c.strokeStyle = rgba(PAL.aqua200, 0.45 * fade);
  c.lineWidth = 30;
  line(0); c.stroke();
  c.strokeStyle = rgba('#FFFFFF', 0.92 * fade);
  c.lineWidth = 9;
  line(0); c.stroke();
  c.strokeStyle = rgba(PAL.aqua100, 0.8 * fade);
  c.lineWidth = 3;
  line(12); c.stroke();
  // gotas despedidas (estiradas en la dirección del movimiento)
  const age = t - T.win;
  for (const d of DROPS) {
    const ye = edgeY(d.x, t, Y, sp);
    const y = ye - d.up * (0.4 + d.vy * age * 6);
    if (y < -60 || y > H + 60) continue;
    c.fillStyle = rgba(d.col, 0.9 * fade);
    c.beginPath(); c.ellipse(d.x, y, d.rad, d.rad * (2.2 + 2 * sp), 0, 0, TAU); c.fill();
  }
  c.restore();
}
