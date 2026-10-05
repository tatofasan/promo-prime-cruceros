// Fondo cercano del compás 11: disco de luz detrás de la valija (escenario del producto), estallido de
// impacto en el corte y una ruta punteada con un barquito que cruza el cielo vacío de arriba.
import { PAL, rgba, shade } from '../../engine/color.js';
import { E, clamp, prog, pop, TAU } from '../../engine/ease.js';
import { beatPulse } from '../../engine/time.js';
import { T } from './timeline.js';
import { CASE, CASE_C } from './beat-case.js';

const DISC = { x: CASE_C[0], y: CASE.y - 236, r: 400 };

// ruta: dos cúbicas muestreadas una vez (largo acumulado para dibujarla de a poco)
let ROUTE = null;
function cubic(p0, p1, p2, p3, n, out) {
  for (let i = out.length ? 1 : 0; i <= n; i++) {
    const u = i / n, v = 1 - u;
    out.push([
      v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
      v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
    ]);
  }
}
function buildRoute() {
  const pts = [];
  cubic([-80, 318], [180, 120], [430, 300], [700, 196], 60, pts);
  cubic([700, 196], [930, 108], [1080, 150], [1236, 262], 60, pts);
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  ROUTE = { pts, len, total: len[len.length - 1] };
}

function shipIcon(c, s) {
  c.save();
  c.scale(s, s);
  c.fillStyle = rgba(PAL.navy900, 0.25);
  c.save(); c.translate(3, 4);
  hull(c); c.restore();
  c.fillStyle = '#FFFFFF';
  hull(c);
  c.fillStyle = PAL.brandOrange;
  c.fillRect(-2, -30, 10, 10);
  c.fillStyle = PAL.brandCyan;
  c.fillRect(-28, -8, 46, 3);
  c.restore();
}
function hull(c) {
  c.beginPath();
  c.moveTo(-40, 0); c.lineTo(38, 0); c.lineTo(26, 15); c.lineTo(-40, 15); c.closePath(); c.fill();
  c.beginPath();
  c.moveTo(-36, 0); c.lineTo(-36, -14); c.lineTo(-6, -14); c.lineTo(-6, -22); c.lineTo(10, -22); c.lineTo(10, -14);
  c.lineTo(16, -14); c.lineTo(26, 0); c.closePath(); c.fill();
}

/** Disco de luz + estallido del impacto (en el plano de la valija; antes de dibujarla). */
export function drawCaseBackdrop(c, t) {
  if (t > T.pass + 0.05) return;
  const k = pop(t, T.in - 0.12, { dur: 0.5, over: 1.12 });
  const out = 1 - E.inBack(prog(t, T.hold, T.pass));
  const pulse = beatPulse(t, { from: T.in, decay: 0.12 });
  const r = DISC.r * k * Math.max(0, out) * (1 + 0.05 * pulse);
  if (r > 1) {
    c.save();
    c.fillStyle = rgba('#FFFFFF', 0.13);
    c.beginPath(); c.arc(DISC.x, DISC.y, r, 0, TAU); c.fill();
    c.fillStyle = rgba('#FFFFFF', 0.08);
    c.beginPath(); c.arc(DISC.x - r * 0.06, DISC.y - r * 0.06, r * 0.82, 0, TAU); c.fill();
    c.strokeStyle = rgba('#FFFFFF', 0.35 + 0.25 * pulse);
    c.lineWidth = 5;
    c.setLineDash([2, 16]);
    c.lineCap = 'round';
    c.beginPath(); c.arc(DISC.x, DISC.y, r + 26, -t * 0.4, -t * 0.4 + TAU); c.stroke();
    c.setLineDash([]);
    c.restore();
  }
  // en cada beat (y en la corchea del tercer calco) sale un aro punteado desde la valija
  for (const tb of [T.s1, T.s1 + 0.234, T.s2, T.s3, T.s2 + 0.469, T.wob]) {
    const q = (t - tb) / 0.42;
    if (q <= 0 || q >= 1 || tb > T.hold) continue;
    c.save();
    c.strokeStyle = rgba('#FFFFFF', 0.55 * (1 - q));
    c.lineWidth = 12 * (1 - q) + 2;
    c.setLineDash([2, 22]);
    c.lineCap = 'round';
    c.beginPath(); c.arc(DISC.x, DISC.y, DISC.r * (0.95 + 0.75 * E.outCubic(q)), q, q + TAU); c.stroke();
    c.restore();
  }
  // estallido de impacto (estrella que crece y se apaga)
  const dt = t - T.in;
  if (dt >= 0 && dt < 0.32) {
    const p = dt / 0.32;
    const s = 0.55 + 0.75 * E.outCubic(p);
    c.save();
    c.translate(DISC.x, CASE.y - 210);
    c.rotate(0.15 * p);
    c.scale(s * 1.25, s * 1.25);
    c.fillStyle = rgba('#FFFFFF', 0.42 * (1 - p));
    c.beginPath();
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU, rr = i % 2 ? 300 : 520;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.72);
    }
    c.closePath();
    c.fill();
    c.restore();
    // aro de choque
    c.strokeStyle = rgba('#FFFFFF', 0.7 * (1 - p));
    c.lineWidth = 18 * (1 - p) + 2;
    c.beginPath(); c.arc(DISC.x, CASE.y - 210, 200 + 520 * E.outCubic(p), 0, TAU); c.stroke();
  }
}

/** Ruta punteada que se dibuja durante el compás con un barquito en la punta. */
export function drawCaseRoute(c, t) {
  if (!ROUTE) buildRoute();
  const p = E.inOutCubic(prog(t, T.in + 0.12, T.s3 + 0.2));
  const fade = 1 - prog(t, T.hold, T.hold + 0.035);
  if (p <= 0 || fade <= 0) return;
  const L = ROUTE.total * p;
  const { pts, len } = ROUTE;
  let i = 1;
  c.save();
  c.globalAlpha *= fade;
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (; i < pts.length && len[i] <= L; i++) c.lineTo(pts[i][0], pts[i][1]);
  let hx = pts[i - 1][0], hy = pts[i - 1][1], ang = 0;
  if (i < pts.length) {
    const f = (L - len[i - 1]) / (len[i] - len[i - 1]);
    hx = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f;
    hy = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f;
    c.lineTo(hx, hy);
    ang = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
  } else {
    const n = pts.length - 1;
    ang = Math.atan2(pts[n][1] - pts[n - 1][1], pts[n][0] - pts[n - 1][0]);
  }
  c.lineCap = 'round';
  c.setLineDash([1, 20]);
  c.strokeStyle = rgba(shade(PAL.brandCyan, -0.35), 0.5);
  c.lineWidth = 9;
  c.save(); c.translate(3, 4); c.stroke(); c.restore();
  c.strokeStyle = rgba('#FFFFFF', 0.85);
  c.stroke();
  c.setLineDash([]);
  // barquito con estela corta
  c.translate(hx, hy);
  c.rotate(ang * 0.6);
  c.translate(0, -6 + Math.sin(t * 9) * 2);
  const k = clamp(p * 8);
  shipIcon(c, 0.95 * k);
  c.restore();
}
