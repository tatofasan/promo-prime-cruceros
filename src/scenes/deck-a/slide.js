// Tobogán en espiral visto desde arriba con perspectiva real: cada tramo se proyecta a su altura (las vueltas de
// arriba crecen y se abren hacia afuera: resorte telescópico). Canaleta abierta de colores con interior claro,
// agua que corre, labios con filo de luz, bridas entre tramos, columnas que apuntan lejos del centro, torre con
// plataforma y techito a rayas. Quien baja va adentro, con rocío.
import { PAL, mixHex } from '../../engine/color.js';
import { TAU, clamp } from '../../engine/ease.js';
import { hash } from '../../engine/noise.js';
import { sparkle } from '../../engine/draw.js';
import { project, hullPath } from './util.js';
import { SLIDE, SUN, shadowOff } from './pool-geo.js';
import { PATH, S_END, pathAt, riderAt } from './pool-path.js';
import { SKIN, HAIR } from './pool-pal.js';
import { drawFigure } from './figure.js';

const W = SLIDE.w;
const COLS = [PAL.coral, PAL.gold, PAL.brandCyan, PAL.brandOrange, PAL.ocean500, PAL.gold];
const SEG = 64; // largo de cada tramo (px de mundo)
const TOWER_R = 20, PLAT_R = 36;

// tramos precalculados (índices de PATH)
const SEGS = [];
{
  let i0 = 0;
  for (let i = 1; i < PATH.length; i++) {
    if (PATH[i].s - PATH[i0].s >= SEG || i === PATH.length - 1) {
      const mid = (PATH[i0].s + PATH[i].s) / 2;
      SEGS.push({ a: i0, b: i, s0: PATH[i0].s, s1: PATH[i].s, col: COLS[Math.floor(mid / 128) % COLS.length], h: (PATH[i0].h + PATH[i].h) / 2 });
      i0 = i;
    }
  }
}
// columnas: cada ~45° de la hélice y dos bajo la canaleta
const POSTS = [];
for (let s = 140; s < S_END - 40; s += 150) { const q = pathAt(s); if (q.h > 70) POSTS.push(q); }
POSTS.push(pathAt(S_END - 60));

export function initSlide() {}

/** Siluetas de sombra del tobogán sobre un plano a altura h0 (cubierta = 0, fondo = −118): tubo y torre (suave), columnas (nítida). */
export function slideShadow(soft, sharp, h0 = 0) {
  soft.lineWidth = W * 0.92;
  soft.beginPath();
  PATH.forEach((p, i) => {
    const [ox, oy] = shadowOff(p.h, h0);
    if (i) soft.lineTo(p.x + ox, p.y + oy); else soft.moveTo(p.x + ox, p.y + oy);
  });
  soft.stroke();
  const [bx, by] = shadowOff(0, h0);
  const [tx, ty] = shadowOff(SLIDE.hTop, h0);
  soft.lineWidth = TOWER_R * 2;
  soft.beginPath(); soft.moveTo(SLIDE.cx + bx, SLIDE.cy + by); soft.lineTo(SLIDE.cx + tx, SLIDE.cy + ty); soft.stroke();
  soft.beginPath(); soft.arc(SLIDE.cx + tx, SLIDE.cy + ty, PLAT_R, 0, TAU); soft.fill();
  if (!sharp) return;
  sharp.lineWidth = 9;
  for (const q of POSTS) {
    const [ox, oy] = shadowOff(q.h, h0);
    sharp.beginPath(); sharp.moveTo(q.x + bx, q.y + by); sharp.lineTo(q.x + ox, q.y + oy); sharp.stroke();
  }
}

function polyline(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
}

/** Sombra de quien baja (por cuadro), sobre la cubierta. */
export function riderShadow(ctx, C, t) {
  const R = riderAt(t);
  if (R.phase === 'gone') return;
  const [ox, oy] = shadowOff(R.h);
  const [x, y, k] = project(C, R.x + ox, R.y + oy, 0);
  ctx.save();
  ctx.fillStyle = 'rgba(16,44,82,0.28)';
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(R.ty, R.tx) + C.r);
  ctx.beginPath(); ctx.ellipse(0, 0, 70 * k, 20 * k, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawRider(ctx, C, t, R, k) {
  const [x, y] = project(C, R.x, R.y, R.h + 14);
  const a = Math.atan2(R.ty, R.tx) - Math.PI / 2;
  const fly = R.phase === 'fly' ? R.fly : 0;
  const wiggle = Math.sin(t * 30) * 0.06 * clamp(R.v / 3000);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a + C.r + wiggle);
  const hop = 1 + 0.28 * Math.sin(Math.PI * fly);
  ctx.rotate(0.5 * fly);
  ctx.scale(0.86 * k * hop, 0.86 * k * hop * (1 - 0.12 * fly));
  const loc = [SUN[0] * Math.cos(-a) - SUN[1] * Math.sin(-a), SUN[0] * Math.sin(-a) + SUN[1] * Math.cos(-a)];
  const yay = R.phase === 'fly' || R.phase === 'chute' ? 1 : 0;
  drawFigure(ctx, {
    L: loc, skin: SKIN[1], hair: HAIR[1], hairStyle: 'short', kind: 'trunks', suit: PAL.coral,
    pose: yay ? { aL: [2.75, 0.25], aR: [2.6, 0.3], lL: [0.12, 0], lR: [0.16, -0.05] } : { aL: [0.35, 0.9], aR: [0.35, 0.9], lL: [0.03, 0], lR: [0.03, 0] },
    glasses: false, smile: 1.8,
  });
  ctx.restore();
}

/** El tobogán completo con quien baja. Se dibuja de abajo hacia arriba (lo alto tapa lo bajo). */
export function drawSlide(ctx, C, t) {
  const L = [SUN[0] * Math.cos(C.r) - SUN[1] * Math.sin(C.r), SUN[0] * Math.sin(C.r) + SUN[1] * Math.cos(C.r)];
  const R = riderAt(t);
  // columnas
  ctx.lineCap = 'round';
  for (const q of POSTS) {
    const a = project(C, q.x, q.y, 0), b = project(C, q.x, q.y, q.h - 14);
    ctx.strokeStyle = '#9AAAB8';
    ctx.lineWidth = 11 * b[2];
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.strokeStyle = '#F2F6F8';
    ctx.lineWidth = 3.5 * b[2];
    ctx.beginPath(); ctx.moveTo(a[0] + L[0] * 3, a[1] + L[1] * 3); ctx.lineTo(b[0] + L[0] * 3, b[1] + L[1] * 3); ctx.stroke();
  }
  // torre central: columna vista en perspectiva (base chica y oscura, tope grande y claro)
  {
    const a = project(C, SLIDE.cx, SLIDE.cy, 0), b = project(C, SLIDE.cx, SLIDE.cy, SLIDE.hTop);
    const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    g.addColorStop(0, '#7F91A2'); g.addColorStop(1, '#E3EAF0');
    ctx.fillStyle = g;
    ctx.fill(hullPath(a[0], a[1], TOWER_R * a[2], b[0], b[1], TOWER_R * b[2]));
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3.5 * b[2];
    ctx.beginPath(); ctx.moveTo(a[0] + L[0] * TOWER_R * 0.55 * a[2], a[1] + L[1] * TOWER_R * 0.55 * a[2]); ctx.lineTo(b[0] + L[0] * TOWER_R * 0.55 * b[2], b[1] + L[1] * TOWER_R * 0.55 * b[2]); ctx.stroke();
  }
  // tramos de abajo hacia arriba
  const rIdx = R.phase === 'slide' || R.phase === 'chute' || R.phase === 'wait' ? SEGS.findIndex((g) => R.s >= g.s0 - 1e-6 && R.s <= g.s1 + 1e-6) : -1;
  const flow = (t * 760) % 60;
  for (let i = SEGS.length - 1; i >= 0; i--) {
    const g = SEGS[i];
    const pts = [];
    for (let j = g.a; j <= g.b; j++) { const p = PATH[j]; pts.push(project(C, p.x, p.y, p.h)); }
    if (i < SEGS.length - 1) { const p = PATH[Math.max(0, g.b + 1)]; if (p) pts.push(project(C, p.x, p.y, p.h)); }
    const k = pts[0][2];
    const off = (d, w, col, cap = 'butt') => {
      ctx.lineCap = cap;
      ctx.strokeStyle = col;
      ctx.lineWidth = w * k;
      ctx.beginPath();
      pts.forEach(([x, y], n) => (n ? ctx.lineTo(x + L[0] * d * k, y + L[1] * d * k) : ctx.moveTo(x + L[0] * d * k, y + L[1] * d * k)));
      ctx.stroke();
    };
    // lo bajo queda en la sombra de las vueltas de arriba (oclusión): más oscuro y frío
    const ao = 0.34 * (1 - (g.h - SLIDE.hBot) / (SLIDE.hTop - SLIDE.hBot));
    const col = mixHex(g.col, PAL.navy700, ao);
    // sombra que este tramo tira sobre la vuelta de abajo
    off(-14, W + 4, 'rgba(10,30,60,0.16)', 'round');
    off(-4, W + 6, `rgba(10,30,60,${0.3 + ao * 0.4})`);
    off(0, W, mixHex(col, PAL.navy800, 0.18));
    off(W * 0.06, W * 0.84, col);
    off(-W * 0.16, W * 0.36, mixHex(col, PAL.navy800, 0.3));
    off(W * 0.08, W * 0.36, mixHex(col, '#ffffff', 0.32));
    off(W * 0.04, W * 0.18, mixHex('#BDEFF8', PAL.navy700, ao * 0.6));
    // agua que corre (rayitas)
    ctx.setLineDash([10 * k, 22 * k]);
    ctx.lineDashOffset = -flow * k - i * 13;
    off(W * 0.04, 2.4, 'rgba(255,255,255,0.85)');
    ctx.setLineDash([]);
    off(W * 0.44, 2.6, 'rgba(255,255,255,0.75)');
    off(-W * 0.46, 1.8, 'rgba(10,30,60,0.35)');
    // brida al final del tramo
    const [bx, by] = pts[pts.length - 1 - (i < SEGS.length - 1 ? 1 : 0)];
    const p0 = pts[Math.max(0, pts.length - 3)];
    const ang = Math.atan2(by - p0[1], bx - p0[0]) + Math.PI / 2;
    ctx.strokeStyle = mixHex(g.col, PAL.navy800, 0.35);
    ctx.lineWidth = 3 * k;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx + Math.cos(ang) * W * 0.5 * k, by + Math.sin(ang) * W * 0.5 * k); ctx.lineTo(bx - Math.cos(ang) * W * 0.5 * k, by - Math.sin(ang) * W * 0.5 * k); ctx.stroke();
    if (i === rIdx) riderInFlume(ctx, C, t, R);
  }
  // plataforma arriba de la torre, con baranda y quien espera su turno
  {
    const [px, py, pk] = project(C, SLIDE.cx, SLIDE.cy, SLIDE.hTop + 4);
    ctx.fillStyle = 'rgba(10,30,60,0.3)';
    ctx.beginPath(); ctx.arc(px - L[0] * 6 * pk, py - L[1] * 6 * pk, PLAT_R * pk, 0, TAU); ctx.fill();
    ctx.fillStyle = '#C9D4DC';
    ctx.beginPath(); ctx.arc(px, py, PLAT_R * pk, 0, TAU); ctx.fill();
    ctx.fillStyle = '#EEF3F6';
    ctx.beginPath(); ctx.arc(px + L[0] * 3 * pk, py + L[1] * 3 * pk, PLAT_R * pk * 0.88, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(150,165,180,0.35)';
    for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; ctx.beginPath(); ctx.arc(px + Math.cos(a) * PLAT_R * 0.55 * pk, py + Math.sin(a) * PLAT_R * 0.55 * pk, 2 * pk, 0, TAU); ctx.fill(); }
    const [rx, ry, rk] = project(C, SLIDE.cx, SLIDE.cy, SLIDE.hTop + 44);
    ctx.strokeStyle = 'rgba(10,30,60,0.25)';
    ctx.lineWidth = 4 * rk;
    ctx.beginPath(); ctx.arc(rx - L[0] * 3, ry - L[1] * 3, PLAT_R * rk, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3 * rk;
    ctx.beginPath(); ctx.arc(rx, ry, PLAT_R * rk, 0.8, TAU - 0.3); ctx.stroke();
    // techito a rayas (cúpula chica): el remate de la torre
    const [cx, cy, ck] = project(C, SLIDE.cx, SLIDE.cy, SLIDE.hTop + 92);
    const RR = 40 * ck, la = Math.atan2(L[1], L[0]);
    ctx.fillStyle = 'rgba(10,30,60,0.28)';
    ctx.beginPath(); ctx.arc(cx - L[0] * 9 * ck, cy - L[1] * 9 * ck, RR, 0, TAU); ctx.fill();
    for (let k = 0; k < 10; k++) {
      const a0 = (k / 10) * TAU + C.r, a1 = ((k + 1) / 10) * TAU + C.r;
      const lit = Math.cos((a0 + a1) / 2 - la);
      const base = k % 2 ? '#FFF8EE' : PAL.coral;
      ctx.fillStyle = lit > 0 ? mixHex(base, '#ffffff', 0.22 * lit) : mixHex(base, PAL.navy800, -0.22 * lit);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, RR, a0, a1); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = PAL.gold;
    ctx.beginPath(); ctx.arc(cx, cy, 6 * ck, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(cx + L[0] * 2 * ck, cy + L[1] * 2 * ck, 2.5 * ck, 0, TAU); ctx.fill();
  }
  if (R.phase === 'fly') drawRider(ctx, C, t, R, project(C, R.x, R.y, R.h)[2]);
}

function riderInFlume(ctx, C, t, R) {
  const k = project(C, R.x, R.y, R.h)[2];
  // rocío detrás
  const sp = clamp(R.v / 2500);
  for (let n = 0; n < 9; n++) {
    const q = pathAt(R.s - 14 - n * 9 - hash(n, 3) * 10);
    const side = (hash(n, 4) - 0.5) * W * 0.9;
    const [x, y, kk] = project(C, q.x - q.ty * side, q.y + q.tx * side, q.h + 10 + hash(n, 5) * 20);
    ctx.fillStyle = `rgba(255,255,255,${0.8 * sp * (1 - n / 9)})`;
    ctx.beginPath(); ctx.arc(x, y, (2 + 2.5 * hash(n, 6)) * kk, 0, TAU); ctx.fill();
  }
  drawRider(ctx, C, t, R, k);
  if (sp > 0.6) {
    const q = pathAt(R.s + 40);
    const [x, y, kk] = project(C, q.x, q.y, q.h + 20);
    sparkle(ctx, x, y, 12 * kk * sp, { alpha: 0.7 * sp });
  }
}

/** Agua que cae de la canaleta a la pileta: espuma que respira, burbujas y ondas (va en la superficie). */
export function chuteSpill(ctx, C, t) {
  const end = PATH[PATH.length - 1];
  const fx = end.x - 22, fy = end.y + 2;
  const [x, y, k] = project(C, fx, fy, -7);
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const q = (t * 1.3 + i / 3) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - q)})`;
    ctx.lineWidth = 2 * k;
    ctx.beginPath(); ctx.ellipse(x, y, (16 + q * 46) * k, (12 + q * 36) * k, 0, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(250,254,255,0.85)';
  for (let i = 0; i < 9; i++) {
    const a = hash(i, 61) * TAU + t * (1 + hash(i, 62)), r = (6 + 14 * hash(i, 63)) * k;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, (3 + 4 * hash(i, 64) * (0.7 + 0.3 * Math.sin(t * 9 + i))) * k, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/** Abanico de agua cuando quien baja entra a la canaleta (corchea antes del splash). */
export function chuteSpray(ctx, C, t, T) {
  const d = t - T;
  if (d < 0 || d > 0.32) return;
  const q = pathAt(S_END - 70);
  const a0 = Math.atan2(q.y - SLIDE.cy, q.x - SLIDE.cx);
  for (let i = 0; i < 22; i++) {
    const a = a0 + (hash(i, 71) - 0.5) * 1.3;
    const v = 260 + 380 * hash(i, 72), vz = 200 + 380 * hash(i, 73);
    const r = v * d, h = q.h + vz * d - 1200 * d * d;
    if (h < 0) continue;
    const [x, y, k] = project(C, q.x + Math.cos(a) * r, q.y + Math.sin(a) * r, h);
    const s = (2.5 + 4 * hash(i, 74)) * k * (1 + h / 500);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.ellipse(x, y, s * 1.6, s, a + C.r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(140,215,238,0.9)';
    ctx.beginPath(); ctx.arc(x - SUN[0] * s * 0.3, y - SUN[1] * s * 0.3, s * 0.6, 0, TAU); ctx.fill();
  }
  if (d < 0.12) {
    const [x, y, k] = project(C, q.x, q.y, q.h + 30);
    sparkle(ctx, x, y, 30 * k * (1 - d / 0.12), { alpha: 1 - d / 0.12 });
  }
}
