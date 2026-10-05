// Botella de malbec inclinada sirviendo (vista cenital con perspectiva): cuello con cápsula bordó y anillo dorado,
// hombro, cuerpo verde botella con etiqueta crema y brillos largos; chorro de vino hasta la copa.
import { TAU } from '../../engine/ease.js';
import { project } from './util.js';

// perfil: [s (px a lo largo del eje desde el pico), radio]
const PROFILE = [[0, 15], [6, 15], [8, 12.5], [78, 13.5], [104, 22], [128, 36], [148, 42], [380, 42], [386, 40]];
const rAt = (s) => {
  for (let i = 1; i < PROFILE.length; i++) {
    if (s <= PROFILE[i][0]) {
      const [s0, r0] = PROFILE[i - 1], [s1, r1] = PROFILE[i];
      const u = (s - s0) / (s1 - s0);
      return r0 + (r1 - r0) * (u * u * (3 - 2 * u));
    }
  }
  return PROFILE[PROFILE.length - 1][1];
};

/**
 * o = { mx, my, mh (pico en el mundo), dir (ángulo del eje en planta, hacia la base), tilt (rad: cuánto sube la base),
 *       alpha }. Devuelve el pico proyectado [x, y] para enganchar el chorro.
 */
export function drawBottle(ctx, C, o) {
  const { mx, my, mh, dir, tilt, alpha = 1 } = o;
  if (alpha <= 0.01) return null;
  const cd = Math.cos(dir), sd = Math.sin(dir), ct = Math.cos(tilt), st = Math.sin(tilt);
  const N = 30;
  const S = [];
  for (let i = 0; i < N; i++) {
    const s = (i / (N - 1)) * 386;
    const [x, y, k] = project(C, mx + cd * ct * s, my + sd * ct * s, mh + st * s);
    S.push([x, y, rAt(s) * k, s]);
  }
  const side = (sign) => S.map(([x, y, r], i) => {
    const [xa, ya] = S[Math.max(0, i - 1)], [xb, yb] = S[Math.min(N - 1, i + 1)];
    const d = Math.hypot(xb - xa, yb - ya) || 1;
    return [x - ((yb - ya) / d) * r * sign, y + ((xb - xa) / d) * r * sign];
  });
  const A = side(1), B = side(-1);
  const outline = new Path2D();
  A.forEach(([x, y], i) => (i ? outline.lineTo(x, y) : outline.moveTo(x, y)));
  const [ex, ey, er] = S[N - 1];
  const ea = Math.atan2(S[N - 1][1] - S[N - 2][1], S[N - 1][0] - S[N - 2][0]);
  outline.arc(ex, ey, er, ea + Math.PI / 2, ea - Math.PI / 2, true);
  for (let i = N - 1; i >= 0; i--) outline.lineTo(B[i][0], B[i][1]);
  const [x0, y0, r0] = S[0];
  const a0 = Math.atan2(S[1][1] - y0, S[1][0] - x0);
  outline.arc(x0, y0, r0, a0 - Math.PI / 2, a0 + Math.PI / 2, true);
  outline.closePath();
  // luz: del lado A o B según hacia dónde queda la vela (arriba a la izquierda de la botella)
  ctx.save();
  ctx.globalAlpha *= alpha;
  const g = ctx.createLinearGradient(A[18][0], A[18][1], B[18][0], B[18][1]);
  g.addColorStop(0, '#3E6B50');
  g.addColorStop(0.3, '#1F4430');
  g.addColorStop(0.8, '#0F2419');
  g.addColorStop(1, '#0A1810');
  ctx.fillStyle = g;
  ctx.fill(outline);
  ctx.clip(outline);
  // etiqueta (banda en el cuerpo)
  const band = (s0, s1, fill) => {
    const i0 = Math.round((s0 / 386) * (N - 1)), i1 = Math.round((s1 / 386) * (N - 1));
    const p = new Path2D();
    for (let i = i0; i <= i1; i++) (i === i0 ? p.moveTo(A[i][0], A[i][1]) : p.lineTo(A[i][0], A[i][1]));
    for (let i = i1; i >= i0; i--) p.lineTo(B[i][0], B[i][1]);
    p.closePath();
    ctx.fillStyle = fill;
    ctx.fill(p);
    return [i0, i1];
  };
  const [l0, l1] = band(190, 320, '#F1E4C8');
  band(196, 200, '#C9973C');
  band(310, 314, '#C9973C');
  // escudo y renglones de la etiqueta
  const mid = Math.round((l0 + l1) / 2);
  const [cx, cy, cr] = S[mid];
  ctx.fillStyle = '#7A1A2C';
  ctx.beginPath(); ctx.arc(cx, cy, cr * 0.32, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#C9973C';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, cr * 0.4, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(90,60,40,0.45)';
  ctx.lineWidth = 1.4;
  for (const f of [-0.62, 0.62]) {
    const i = Math.round(mid + f * (l1 - l0) * 0.4);
    ctx.beginPath(); ctx.moveTo(S[i][0] + (A[i][0] - S[i][0]) * 0.5, S[i][1] + (A[i][1] - S[i][1]) * 0.5);
    ctx.lineTo(S[i][0] + (B[i][0] - S[i][0]) * 0.5, S[i][1] + (B[i][1] - S[i][1]) * 0.5); ctx.stroke();
  }
  // cápsula bordó con anillo dorado
  band(0, 92, '#6E1426');
  band(6, 14, '#D7A646');
  band(86, 92, '#D7A646');
  // sombreado cilíndrico y brillos largos
  const sh = ctx.createLinearGradient(A[18][0], A[18][1], B[18][0], B[18][1]);
  sh.addColorStop(0, 'rgba(255,255,255,0.10)');
  sh.addColorStop(0.45, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = sh;
  ctx.fill(outline);
  ctx.lineCap = 'round';
  const stripe = (f, w, a, i0 = 2, i1 = N - 2) => {
    ctx.strokeStyle = `rgba(255,250,235,${a})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const px = S[i][0] + (A[i][0] - S[i][0]) * f, py = S[i][1] + (A[i][1] - S[i][1]) * f;
      if (i === i0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  };
  stripe(0.55, 5, 0.55, 9, N - 2);
  stripe(0.55, 2, 0.6, 1, 7);
  stripe(0.78, 1.6, 0.35, 10, N - 3);
  stripe(-0.7, 2, 0.12, 10, N - 3);
  ctx.restore();
  // pico
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = '#2A0A12';
  ctx.beginPath(); ctx.arc(x0, y0, r0 * 0.62, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#E0B256';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x0, y0, r0 * 0.9, 0, TAU); ctx.stroke();
  ctx.restore();
  return [x0, y0, r0];
}

/** Chorro de vino de (x0,y0) a (x1,y1). w = grosor; flow 0..1 (se corta en gotas al final). */
export function drawStream(ctx, x0, y0, x1, y1, w, flow, t) {
  if (flow <= 0.01) return;
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d, ny = dx / d;
  const wob = Math.sin(t * 40) * 1.2;
  ctx.save();
  ctx.fillStyle = '#6A0C22';
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w * 0.5 * flow, y0 + ny * w * 0.5 * flow);
  ctx.quadraticCurveTo((x0 + x1) / 2 + nx * (w * 0.35 + wob), (y0 + y1) / 2 + ny * (w * 0.35 + wob), x1 + nx * w * 0.3 * flow, y1 + ny * w * 0.3 * flow);
  ctx.lineTo(x1 - nx * w * 0.3 * flow, y1 - ny * w * 0.3 * flow);
  ctx.quadraticCurveTo((x0 + x1) / 2 - nx * (w * 0.35 - wob), (y0 + y1) / 2 - ny * (w * 0.35 - wob), x0 - nx * w * 0.5 * flow, y0 - ny * w * 0.5 * flow);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,170,180,0.7)';
  ctx.lineWidth = 1.6 * flow;
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w * 0.2, y0 + ny * w * 0.2);
  ctx.quadraticCurveTo((x0 + x1) / 2 + nx * w * 0.15, (y0 + y1) / 2 + ny * w * 0.15, x1, y1);
  ctx.stroke();
  ctx.restore();
}
