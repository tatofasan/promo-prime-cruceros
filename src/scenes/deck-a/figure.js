// Persona vista desde arriba, boca arriba (cabeza hacia −y, pelvis en 0,0; ~170 px de alto a escala 1).
// Cada miembro es UNA pieza (muslo + pantorrilla + pie unidos) con 3 tonos: base, medialuna de sombra del lado
// opuesto al sol y filo de luz. Malla, pelo y cara con anteojos de sol. La pose va por ángulos (rad) medidos
// desde "a lo largo del cuerpo" hacia afuera: [hombro/cadera, codo/rodilla].
import { PAL, mixHex } from '../../engine/color.js';
import { TAU } from '../../engine/ease.js';
import { tone3, tone3u, union, blob, ellipse } from './shape.js';
import { SKIN, HAIR } from './pool-pal.js';
import { drawFigure as drawArtFigure } from '../../art/figure.js';

const SH = { L: [-17.5, -50], R: [17.5, -50] };
const HIP = { L: [-8.8, 2], R: [8.8, 2] };
const ARM = [27, 24], LEG = [39, 37];

/** Cápsula (dos círculos y sus tangentes) como forma desplazable: mk(ox, oy, into?) con moveTo propio. */
export const capsule = (x0, y0, r0, x1, y1, r1) => (ox = 0, oy = 0, into = null) => {
  const p = into || new Path2D();
  const ax = x0 + ox, ay = y0 + oy, bx = x1 + ox, by = y1 + oy;
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
  if (d <= Math.abs(r1 - r0) + 0.01) {
    const [cx, cy, r] = r1 > r0 ? [bx, by, r1] : [ax, ay, r0];
    p.moveTo(cx + r, cy);
    p.arc(cx, cy, r, 0, TAU);
    p.closePath();
    return p;
  }
  const a = Math.atan2(dy, dx), b = Math.acos(Math.max(-1, Math.min(1, (r0 - r1) / d)));
  p.moveTo(ax + Math.cos(a + b) * r0, ay + Math.sin(a + b) * r0);
  p.arc(ax, ay, r0, a + b, a - b + TAU, false);
  p.arc(bx, by, r1, a - b, a + b, false);
  p.closePath();
  return p;
};

const TORSO = [[-18.5, -52], [-11, -57.5], [0, -59], [11, -57.5], [18.5, -52], [17.5, -38], [13.2, -24], [13.6, -10], [16, 1], [11.5, 11], [0, 14], [-11.5, 11], [-16, 1], [-13.6, -10], [-13.2, -24], [-17.5, -38]];

function limb(side, a1, a2, len, base) {
  const s = side === 'L' ? -1 : 1;
  const [x0, y0] = base;
  const x1 = x0 + s * Math.sin(a1) * len[0], y1 = y0 + Math.cos(a1) * len[0];
  const b = a1 + a2;
  const d2 = [s * Math.sin(b), Math.cos(b)];
  return { a: [x0, y0], b: [x1, y1], c: [x1 + d2[0] * len[1], y1 + d2[1] * len[1]], d: d2 };
}
const ang = (d) => Math.atan2(d[1], d[0]) - Math.PI / 2;
const hairTone = (hr, L) => ({ base: hr.base, dark: mixHex(hr.base, '#000000', 0.32), light: hr.light, L, dd: 2.6, dl: 1.6 });

/**
 * drawFigure(ctx, o) en coordenadas locales (el que llama pone posición, rotación y escala).
 * o = { L: [lx, ly] hacia la luz (LOCAL), skin, hair, suit, trim, kind: 'one'|'bikini'|'trunks', hairStyle: 'long'|'short'|'bun',
 *       pose: { aL:[a1,a2], aR, lL, lR }, glasses, smile, under (0..1 piernas bajo el agua), hairFloat (fase), hold (mano der. ocupada) }
 * Devuelve { hands: [[x,y],[x,y]] } para colgar objetos (el trago).
 */
export function drawFigure(ctx, o = {}) {
  const L = o.L ?? [0.62, -0.785];
  const sk = o.skin ?? SKIN[0], hr = o.hair ?? HAIR[0];
  const pose = { aL: [0.2, 0.06], aR: [0.2, 0.06], lL: [0.08, -0.04], lR: [0.06, 0.02], ...(o.pose || {}) };
  const st = { base: sk.base, dark: sk.dark, light: sk.light, L, dd: 2.8, dl: 1.7 };
  const under = o.under ?? 0;
  const sk2 = o.shinK ?? 1, fa = o.foreK ?? 1;
  const legs = [limb('L', pose.lL[0], pose.lL[1], [LEG[0], LEG[1] * sk2], HIP.L), limb('R', pose.lR[0], pose.lR[1], [LEG[0], LEG[1] * sk2], HIP.R)];
  const arms = [limb('L', pose.aL[0], pose.aL[1], [ARM[0], ARM[1] * fa], SH.L), limb('R', pose.aR[0], pose.aR[1], [ARM[0], ARM[1] * (o.foreKR ?? fa)], SH.R)];

  if ((o.hairStyle ?? 'long') === 'long') hairFan(ctx, hr, o.hairFloat ?? 0, L);

  // piernas: una pieza cada una (lo sumergido, más azul y transparente)
  const legTone = under > 0
    ? { ...st, base: mixHex(sk.base, PAL.ocean400, 0.4 * under), dark: mixHex(sk.dark, PAL.ocean600, 0.45 * under), light: mixHex(sk.light, PAL.aqua200, 0.4 * under) }
    : st;
  for (const g of legs) {
    ctx.save();
    if (under > 0) ctx.globalAlpha *= 1 - 0.3 * under;
    const foot = ellipse(g.c[0] + g.d[0] * 4.5, g.c[1] + g.d[1] * 4.5, 4.6, 7.6, ang(g.d));
    tone3u(ctx, union(capsule(g.a[0], g.a[1], 9.6, g.b[0], g.b[1], 6.4), capsule(g.b[0], g.b[1], 6.2, g.c[0], g.c[1], 4), foot), legTone);
    // rótula: brillo chico
    ctx.fillStyle = `rgba(255,236,220,${0.35 * (1 - under * 0.6)})`;
    ctx.beginPath(); ctx.ellipse(g.b[0] + L[0] * 1.8, g.b[1] + L[1] * 1.8, 2.6, 2, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // torso + cuello en una pieza
  const torso = blob(TORSO);
  tone3u(ctx, union(torso, capsule(0, -51, 5.8, 0, -63, 5.2)), { ...st, dd: 3.6, dl: 2.1 });
  // ombligo y clavículas (detalle chico)
  ctx.strokeStyle = mixHex(sk.dark, sk.base, 0.4);
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-10, -51); ctx.quadraticCurveTo(-5, -49, -2, -50.5); ctx.moveTo(10, -51); ctx.quadraticCurveTo(5, -49, 2, -50.5); ctx.stroke();
  suit(ctx, torso, o, L);
  if (o.kind === 'trunks') {
    const tr = o.suit ?? PAL.coral;
    const trunk = union(...legs.map((g) => capsule(g.a[0], g.a[1], 10.6, g.a[0] + (g.b[0] - g.a[0]) * 0.45, g.a[1] + (g.b[1] - g.a[1]) * 0.45, 9.4)),
      blob([[-15, -6], [15, -6], [16, 6], [0, 10], [-16, 6]]));
    tone3u(ctx, trunk, { base: tr, dark: mixHex(tr, PAL.navy800, 0.3), light: mixHex(tr, '#ffffff', 0.35), L, dd: 2.8, dl: 1.6 });
    ctx.strokeStyle = mixHex(tr, '#ffffff', 0.6);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-14, -4.5); ctx.lineTo(14, -4.5); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 2.2, -1.5, 1, 0, TAU); ctx.fill(); }
  }
  head(ctx, o, sk, hr, L);
  // brazos encima, una pieza cada uno
  arms.forEach((g, i) => {
    const parts = [capsule(g.a[0], g.a[1], 5.6, g.b[0], g.b[1], 4.5), capsule(g.b[0], g.b[1], 4.4, g.c[0], g.c[1], 3.4)];
    if (!(o.hold && i === 1)) parts.push(ellipse(g.c[0] + g.d[0] * 4.4, g.c[1] + g.d[1] * 4.4, 4.5, 6, ang(g.d)));
    tone3u(ctx, union(...parts), st);
  });
  return { hands: arms.map((g) => [g.c[0] + g.d[0] * 5, g.c[1] + g.d[1] * 5]), arms, legs };
}

function suit(ctx, torso, o, L) {
  const kind = o.kind ?? 'one';
  if (kind === 'trunks') return;
  const c = o.suit ?? PAL.navy700, tr = o.trim ?? PAL.gold;
  const dark = mixHex(c, '#000000', 0.28), light = mixHex(c, '#ffffff', 0.24);
  ctx.save();
  ctx.clip(torso(0, 0));
  if (kind === 'one') {
    const p = blob([[-15, -45], [-6, -38.5], [0, -41], [6, -38.5], [15, -45], [16, -31], [12.6, -21], [13.6, -7], [16.5, 2], [10, 14], [0, 16], [-10, 14], [-16.5, 2], [-13.6, -7], [-12.6, -21], [-16, -31]]);
    tone3(ctx, p, { base: c, dark, light, L, dd: 3.2, dl: 1.7 });
    // franja diagonal y ribete dorado
    ctx.fillStyle = tr;
    ctx.beginPath(); ctx.moveTo(-17, -10); ctx.lineTo(17, -24); ctx.lineTo(17, -20.5); ctx.lineTo(-17, -6.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = tr;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-15, -45); ctx.quadraticCurveTo(-6, -37, 0, -40.5); ctx.quadraticCurveTo(6, -37, 15, -45); ctx.stroke();
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = c;
    ctx.beginPath(); ctx.moveTo(-14, -44); ctx.lineTo(-14.6, -56); ctx.moveTo(14, -44); ctx.lineTo(14.6, -56); ctx.stroke();
  } else {
    for (const s of [-1, 1]) tone3(ctx, blob([[s * 2, -45], [s * 14.5, -46], [s * 13, -34], [s * 4, -33]]), { base: c, dark, light, L, dd: 2, dl: 1.2 });
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-17, -36); ctx.lineTo(17, -36); ctx.moveTo(-12, -46); ctx.lineTo(-14, -56); ctx.moveTo(12, -46); ctx.lineTo(14, -56); ctx.stroke();
    tone3(ctx, blob([[-15.5, -2], [0, 1], [15.5, -2], [12, 9], [0, 16], [-12, 9]]), { base: c, dark, light, L, dd: 2.2, dl: 1.2 });
    ctx.fillStyle = tr;
    ctx.beginPath(); ctx.arc(0, -39.5, 1.7, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// pelo largo: mechones ondulados que se abren detrás de la cabeza (en el agua flotan)
function hairFan(ctx, hr, ph, L) {
  const tone = hairTone(hr, L);
  const locks = [[-0.95, 25], [-0.5, 31], [-0.1, 33], [0.32, 30], [0.75, 27], [1.1, 20]];
  ctx.save();
  locks.forEach(([a, len], i) => {
    const pts = [];
    const n = 7;
    const base = [Math.sin(a) * 9, -76 - Math.cos(a) * 8];
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const w = 7.5 * (1 - u * 0.78);
      const aa = a + 0.35 * Math.sin(ph + i * 1.3 + u * 2.6) * u;
      const cx = base[0] + Math.sin(aa) * len * u, cy = base[1] - Math.cos(aa) * len * u;
      pts.push([cx + Math.cos(aa) * w, cy + Math.sin(aa) * w, cx - Math.cos(aa) * w, cy - Math.sin(aa) * w]);
    }
    const shape = [...pts.map((q) => [q[0], q[1]]), ...pts.reverse().map((q) => [q[2], q[3]])];
    tone3(ctx, blob(shape), { ...tone, dd: 2, dl: 1.3 });
  });
  ctx.restore();
}

function head(ctx, o, sk, hr, L) {
  const style = o.hairStyle ?? 'long';
  if (style === 'bun') tone3(ctx, ellipse(0, -89, 8.2, 7.2), hairTone(hr, L));
  // cara
  tone3(ctx, ellipse(0, -71.5, 10.6, 12.6), { base: sk.base, dark: sk.dark, light: sk.light, L, dd: 2.6, dl: 1.6 });
  // orejas
  ctx.fillStyle = sk.dark;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 10.6, -71.5, 2, 3.2, 0, 0, TAU); ctx.fill(); }
  // pelo: casquete con raya al costado y flequillo
  const cap = style === 'short'
    ? blob([[-11.2, -72], [-11, -81], [-5, -86.5], [2, -87], [8, -84.5], [11.4, -78], [11, -72], [8, -78.5], [1, -80.5], [-6, -79]])
    : blob([[-11.5, -68], [-12, -80], [-6, -86.5], [1, -87.5], [7, -85.5], [11.8, -79], [11.4, -68], [8.5, -76], [4, -80], [-2, -79.5], [-8, -75]]);
  tone3(ctx, cap, hairTone(hr, L));
  ctx.strokeStyle = hr.light;
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-3, -86); ctx.quadraticCurveTo(2, -84, 6, -80); ctx.stroke();
  // nariz, boca, cachetes
  ctx.fillStyle = mixHex(sk.dark, sk.base, 0.35);
  ctx.beginPath(); ctx.ellipse(0.5, -67.3, 2.1, 2.8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = sk.light;
  ctx.beginPath(); ctx.arc(1.1, -68.2, 0.9, 0, TAU); ctx.fill();
  const sm = o.smile ?? 1;
  ctx.fillStyle = sk.lip;
  ctx.beginPath();
  ctx.moveTo(-3.4, -63.2); ctx.quadraticCurveTo(0, -61.4 + 2.4 * sm, 3.4, -63.2); ctx.quadraticCurveTo(0, -62.6, -3.4, -63.2);
  ctx.fill();
  ctx.fillStyle = 'rgba(232,110,90,0.3)';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 6.6, -66, 2.4, 1.6, 0, 0, TAU); ctx.fill(); }
  if (o.glasses !== false) {
    const gc = o.glassCol ?? PAL.navy900;
    for (const s of [-1, 1]) {
      ctx.fillStyle = gc;
      ctx.beginPath(); ctx.ellipse(s * 4.9, -73, 4.2, 3.3, s * 0.08, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.ellipse(s * 4.9 + 1.5, -74.2, 1.3, 0.7, -0.4, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = o.frame ?? PAL.gold;
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-1.2, -73.6); ctx.lineTo(1.2, -73.6); ctx.stroke();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 4.9, -73, 4.2, 3.3, s * 0.08, 0, TAU); ctx.stroke(); }
  } else {
    ctx.strokeStyle = mixHex(sk.dark, '#000000', 0.35);
    ctx.lineWidth = 1.1;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 4.4, -73.6, 2.2, 0.25, Math.PI - 0.25); ctx.stroke(); }
  }
}

/**
 * Persona SENTADA en el borde de la pileta vista desde arriba (cabeza hacia −y, el borde del solado en y = 0 y el
 * agua hacia +y): coronilla, hombros, brazos apoyados, muslos hacia adelante y pantorrillas dentro del agua
 * (azuladas). kick = fase del pataleo.
 */
export function drawSitter(ctx, o = {}) {
  const L = o.L ?? [0.62, -0.785];
  const sk = o.skin ?? SKIN[0], hr = o.hair ?? HAIR[0];
  const st = { base: sk.base, dark: sk.dark, light: sk.light, L, dd: 2.6, dl: 1.5 };
  const kick = o.kick ?? 0;
  // pantorrillas en el agua (más chicas por el escorzo y azuladas)
  const wet = { ...st, base: mixHex(sk.base, PAL.ocean400, 0.45), dark: mixHex(sk.dark, PAL.ocean600, 0.5), light: mixHex(sk.light, PAL.aqua200, 0.45) };
  for (const s of [-1, 1]) {
    const kx = s * 9, ky = 30;
    const fy = ky + 20 + 5 * Math.sin(kick + (s > 0 ? Math.PI : 0));
    ctx.save();
    ctx.globalAlpha *= 0.8;
    tone3u(ctx, union(capsule(kx, ky, 5.6, kx + s * 2, fy, 4), ellipse(kx + s * 2, fy + 4, 4.2, 5.5, 0)), wet);
    ctx.restore();
  }
  // muslos sobre el borde y hacia el agua
  for (const s of [-1, 1]) tone3u(ctx, capsule(s * 9, 2, 8.6, s * 9, 30, 6.6), st);
  if (o.kind === 'trunks') {
    const tr = o.suit ?? PAL.coral;
    tone3u(ctx, union(capsule(-9, 2, 9.6, -9, 14, 8.8), capsule(9, 2, 9.6, 9, 14, 8.8)), { base: tr, dark: mixHex(tr, PAL.navy800, 0.3), light: mixHex(tr, '#ffffff', 0.35), L, dd: 2.4, dl: 1.4 });
  } else {
    const c = o.suit ?? PAL.navy700;
    tone3u(ctx, union(capsule(-9, 2, 9.4, -9, 9, 8.6), capsule(9, 2, 9.4, 9, 9, 8.6)), { base: c, dark: mixHex(c, '#000000', 0.28), light: mixHex(c, '#ffffff', 0.24), L, dd: 2.4, dl: 1.4 });
  }
  // brazos apoyados atrás y hombros
  for (const s of [-1, 1]) tone3u(ctx, union(capsule(s * 17, -14, 5, s * 24, 4, 4), ellipse(s * 25, 7, 4.2, 5, 0)), st);
  tone3u(ctx, ellipse(0, -12, 19, 11), { ...st, dd: 3, dl: 1.8 });
  if (o.kind !== 'trunks') {
    ctx.fillStyle = o.suit ?? PAL.navy700;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 9, -14, 2.2, 6, s * 0.3, 0, TAU); ctx.fill(); }
  }
  // coronilla (pelo) con raya y brillo
  tone3(ctx, ellipse(0, -17, 10.5, 10), hairTone(hr, L));
  if ((o.hairStyle ?? 'short') === 'long') tone3(ctx, ellipse(0, -27, 8, 6.5), hairTone(hr, L));
  ctx.strokeStyle = hr.light;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-1, -26); ctx.quadraticCurveTo(1, -18, 0, -9); ctx.stroke();
}

// ------------------------------------------------------------------ hoja de figura de ART (bañistas de malla entera)
/**
 * Misma convención que drawFigure (pelvis en 0,0, cabeza hacia −y, ~170 px a escala 1) pero con la hoja de figura
 * de ART: muslo más ancho que la pantorrilla, codos y rodillas, piel en 3 tonos, mano con pulgar, mechones.
 * Vista cenital de alguien boca arriba = vista de frente. Solo para malla entera (kind 'one').
 */
export function drawFigureArt(ctx, t, o = {}) {
  const sk = o.skin ?? SKIN[0], hr = o.hair ?? HAIR[0];
  const pose = { aL: [0.2, 0.06], aR: [0.2, 0.06], lL: [0.08, -0.04], lR: [0.06, 0.02], ...(o.pose || {}) };
  const res = drawArtFigure(ctx, t, {
    x: 0, y: 88, h: 176, skin: sk.base, shoes: sk.base, swim: true, top: o.suit ?? PAL.navy700,
    hair: { base: hr.base, dark: mixHex(hr.base, '#000000', 0.35), light: hr.light }, hairStyle: o.hairStyle ?? 'long',
    pose: { armL: pose.aL, armR: pose.aR, legL: pose.lL, legR: pose.lR }, L: o.L, glasses: o.glasses !== false, sway: 0,
  });
  // ribete dorado de la malla (la marca de la pieza) sobre el escote
  if (o.trim) {
    ctx.strokeStyle = o.trim;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-16, -15); ctx.lineTo(16, -27); ctx.stroke();
  }
  return res;
}
