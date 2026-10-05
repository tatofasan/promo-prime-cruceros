// Bailarinas de revista en silueta (contraluz). Esqueleto con poses por ángulos y cambio de pose con resorte
// (overshoot); el CUERPO es una silueta de curvas (cadera, cintura, busto, muslos que se afinan a la rodilla,
// pantorrilla, tobillo fino y zapato con taco aguja; brazos con deltoides, codo y mano alargada), todo en un solo
// Path2D. Vestuario: tocado de plumas en abanico coral y dorado (traslúcidas a contraluz), abanico de espalda en
// la protagonista, cinturón de pedrería con flecos que siguen el movimiento y lentejuelas que destellan. Filo de
// luz dorado (aro) y cian (reflectores) en los bordes. Ángulos medidos desde "hacia abajo", positivos hacia la
// derecha de la pantalla.
import { TAU, clamp, spring } from '../../engine/ease.js';
import { PAL, rgba, mixHex } from '../../engine/color.js';
import { sparkle, lin } from '../../engine/draw.js';
import { hash } from '../../engine/noise.js';
import { addSmooth, addEllipse, addPoly } from './ss-geom.js';

const L = { thigh: 84, shin: 82, torso: 86, neck: 12, head: 15, upper: 54, fore: 50 };

// poses base (lado izquierdo de pantalla = L, derecho = R)
export const POSES = {
  stand: { lean: 0, head: 0, aL1: -0.25, aL2: -0.15, aR1: 0.25, aR2: 0.15, lL1: -0.06, lL2: -0.02, lR1: 0.08, lR2: 0.04, lift: 0 },
  vup: { lean: 0.02, head: -0.08, aL1: -2.45, aL2: -2.7, aR1: 2.45, aR2: 2.7, lL1: -0.1, lL2: -0.04, lR1: 0.26, lR2: -0.15, lift: 0 },
  kick: { lean: -0.12, head: -0.1, aL1: -1.55, aL2: -1.75, aR1: 1.6, aR2: 1.45, lL1: -0.04, lL2: 0.0, lR1: 2.05, lR2: 2.25, lift: 0 },
  hip: { lean: 0.1, head: 0.14, aL1: -0.75, aL2: 0.85, aR1: 2.75, aR2: 3.0, lL1: -0.05, lL2: -0.02, lR1: 0.95, lR2: -0.25, lift: 0 },
  crouch: { lean: 0.05, head: 0.1, aL1: -0.7, aL2: -0.3, aR1: 0.7, aR2: 0.3, lL1: -0.55, lL2: 0.35, lR1: 0.55, lR2: -0.35, lift: 0 },
  star: { lean: 0, head: -0.12, aL1: -2.25, aL2: -2.45, aR1: 2.25, aR2: 2.45, lL1: -0.5, lL2: -0.42, lR1: 0.5, lR2: 0.42, lift: -58 },
  point: { lean: -0.06, head: -0.35, aL1: -0.7, aL2: 0.9, aR1: 2.9, aR2: 3.05, lL1: -0.12, lL2: -0.06, lR1: 0.5, lR2: 0.15, lift: 0 },
  open: { lean: 0.04, head: -0.2, aL1: -2.0, aL2: -2.2, aR1: 2.0, aR2: 2.2, lL1: -0.18, lL2: -0.08, lR1: 0.12, lR2: 0.4, lift: 0 },
  // variantes para el coro (que no sean todas iguales)
  attitude: { lean: -0.08, head: 0.18, aL1: -2.6, aL2: -2.95, aR1: 1.25, aR2: 0.55, lL1: -0.08, lL2: 0.02, lR1: 1.15, lR2: 0.25, lift: 0 },
  lunge: { lean: 0.16, head: 0.1, aL1: -1.2, aL2: -1.05, aR1: 2.35, aR2: 2.85, lL1: -0.62, lL2: -0.1, lR1: 0.32, lR2: 0.38, lift: 0 },
  passe: { lean: -0.04, head: -0.16, aL1: -2.3, aL2: -2.9, aR1: 2.1, aR2: 2.6, lL1: -0.03, lL2: 0.0, lR1: 1.25, lR2: -0.9, lift: 0 },
  wave: { lean: 0.07, head: 0.22, aL1: -0.55, aL2: 0.6, aR1: 2.55, aR2: 2.2, lL1: -0.16, lL2: -0.05, lR1: 0.2, lR2: 0.1, lift: 0 },
  // saltos del confeti con variantes (no todas la misma estrella)
  starA: { lean: 0.05, head: -0.2, aL1: -2.75, aL2: -2.95, aR1: 2.55, aR2: 2.85, lL1: -0.42, lL2: -0.2, lR1: 0.75, lR2: 1.15, lift: -46 },
  starB: { lean: -0.08, head: 0.12, aL1: -1.75, aL2: -2.2, aR1: 2.9, aR2: 3.0, lL1: -0.62, lL2: -0.6, lR1: 0.3, lR2: 0.12, lift: -52 },
};
const KEYS = Object.keys(POSES.stand);

/** Pose espejada. */
export function mirror(p) {
  return {
    lean: -p.lean, head: -p.head,
    aL1: -p.aR1, aL2: -p.aR2, aR1: -p.aL1, aR2: -p.aL2,
    lL1: -p.lR1, lL2: -p.lR2, lR1: -p.lL1, lR2: -p.lL2, lift: p.lift,
  };
}

/**
 * Pose en t según una lista [[t, pose], …]: cada cambio entra con resorte (overshoot) desde la pose anterior.
 * Devuelve también `since` (cuánto hace que cambió) y `dir` para la acción secundaria.
 */
export function poseAt(t, seq, { freq = 4.2, damp = 10 } = {}) {
  let i = 0;
  while (i + 1 < seq.length && seq[i + 1][0] <= t) i++;
  if (t < seq[0][0] || i === 0) {
    const p0 = seq[0][1];
    return { ...p0, since: Math.max(0, t - seq[0][0]), dir: 0 };
  }
  const prev = poseAt(seq[i][0] - 1e-4, seq.slice(0, i), { freq, damp });
  const next = seq[i][1];
  const k = spring(t, seq[i][0], { from: 0, to: 1, freq, damp });
  const o = {};
  for (const key of KEYS) o[key] = prev[key] + (next[key] - prev[key]) * k;
  o.since = t - seq[i][0];
  o.dir = Math.sign((next.lean ?? 0) - (prev.lean ?? 0)) || 1;
  return o;
}

const dirv = (a) => [Math.sin(a), Math.cos(a)];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const lerp2 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];

/**
 * Contorno de una cadena de puntos con medio ancho variable a cada lado (wl del lado de la normal izquierda,
 * wr del otro). Devuelve los puntos [ida por la izquierda, punta, vuelta por la derecha] para una curva suave.
 */
function outline(chain, wl, wr, tip = null) {
  const Lp = [], Rp = [];
  for (let i = 0; i < chain.length; i++) {
    const a = chain[Math.max(0, i - 1)], b = chain[Math.min(chain.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const nx = -ty, ny = tx;
    Lp.push([chain[i][0] + nx * wl[i], chain[i][1] + ny * wl[i]]);
    Rp.push([chain[i][0] - nx * wr[i], chain[i][1] - ny * wr[i]]);
  }
  return tip ? [...Lp, tip, ...Rp.reverse()] : [...Lp, ...Rp.reverse()];
}

/** Arma la silueta (un Path2D) y las piezas del vestuario en coordenadas locales con la cadera en (0, 0). */
function build(p, t, o) {
  const body = new Path2D();
  const v = o.variant ?? 0;
  const [tx, ty] = dirv(p.lean + Math.PI); // eje del torso hacia arriba
  const nx = -ty, ny = tx; // normal del torso (hacia la derecha de pantalla)
  const at = (q, w) => [tx * L.torso * q + nx * w, ty * L.torso * q + ny * w];
  // torso con curvas: cadera ancha, cintura, busto y hombros (vista de frente)
  const prof = [[-0.1, 15], [0.02, 22.5], [0.16, 19.5], [0.34, 12.5], [0.44, 11], [0.56, 13.5], [0.68, 15.8], [0.78, 14], [0.88, 13.5], [0.95, 18.5], [1.0, 15]];
  const torsoPts = [...prof.map(([q, w]) => at(q, w)), at(1.04, 6), at(1.04, -6), ...[...prof].reverse().map(([q, w]) => at(q, -w))];
  addSmooth(body, torsoPts, 0.5);
  // cuello afinado y cabeza ovalada con rodete
  const neck0 = at(0.98, 0);
  const [hx, hy] = dirv(p.lean + p.head + Math.PI);
  const hnx = -hy, hny = hx;
  const headC = add(neck0, [hx, hy], L.neck + L.head * 0.9);
  addSmooth(body, [add(neck0, [hnx, hny], 6), add(add(neck0, [hx, hy], L.neck), [hnx, hny], 4.6), add(add(neck0, [hx, hy], L.neck), [hnx, hny], -4.6), add(neck0, [hnx, hny], -6)], 0.3);
  addEllipse(body, headC[0], headC[1], 11.8, 14.5, Math.atan2(hny, hnx));
  const bun = add(headC, [hx, hy], 13);
  addEllipse(body, bun[0], bun[1], 7.5, 6.5, Math.atan2(hny, hnx));

  // brazos: deltoides → codo → antebrazo → muñeca → mano alargada (en punta)
  const shL = at(0.93, 17), shR = at(0.93, -17);
  const [sL, sR] = shL[0] < shR[0] ? [shL, shR] : [shR, shL];
  const arm = (s, a1, a2, side) => {
    const e = add(s, dirv(a1), L.upper), w = add(e, dirv(a2), L.fore);
    const d2 = dirv(a2 + side * 0.12);
    const chain = [s, lerp2(s, e, 0.45), e, lerp2(e, w, 0.4), w];
    const tip = add(w, d2, 17);
    addSmooth(body, outline(chain, [7.2, 5.6, 3.9, 4.4, 2.6], [6.4, 5.0, 3.9, 4.0, 2.6], tip), 0.5);
    return { e, w, tip };
  };
  const aLft = arm(sL, p.aL1, p.aL2, -1), aRgt = arm(sR, p.aR1, p.aR2, 1);

  // piernas: muslo ancho que se afina, rodilla, pantorrilla (más llena del lado de afuera), tobillo fino
  const hpL = at(0.0, 10.5), hpR = at(0.0, -10.5);
  const [hL, hR] = hpL[0] < hpR[0] ? [hpL, hpR] : [hpR, hpL];
  const leg = (h, a1, a2, outer) => {
    const k = add(h, dirv(a1), L.thigh), an = add(k, dirv(a2), L.shin);
    const chain = [h, lerp2(h, k, 0.33), lerp2(h, k, 0.68), k, lerp2(k, an, 0.3), lerp2(k, an, 0.64), an];
    const out = [12.5, 11.2, 8.8, 6.0, 7.9, 5.2, 3.0], inn = [12, 10.4, 8.0, 5.6, 6.4, 4.6, 3.0];
    // la normal izquierda de una pierna que baja apunta a −x: afuera para la pierna izquierda
    addSmooth(body, outline(chain, outer < 0 ? out : inn, outer < 0 ? inn : out), 0.5);
    // zapato de taco aguja: empeine en punta hacia afuera y abajo, y el taco fino
    const fd = dirv(a2 + outer * 0.5);
    const toe = add(an, fd, 21);
    const fn = [-fd[1], fd[0]];
    addSmooth(body, [add(an, fn, 3.6), add(add(an, fd, 11), fn, 3.2), toe, add(add(an, fd, 10), fn, -2.4), add(an, fn, -3.4)], 0.4);
    const heelTop = add(an, fd, -2.5);
    const heelDir = dirv(a2 * 0.3);
    addPoly(body, [[heelTop[0] - 1.8, heelTop[1]], [heelTop[0] + heelDir[0] * 13 - 0.6, heelTop[1] + heelDir[1] * 13], [heelTop[0] + heelDir[0] * 13 + 0.6, heelTop[1] + heelDir[1] * 13], [heelTop[0] + 1.8, heelTop[1]]]);
    return { k, an, toe };
  };
  const lgL = leg(hL, p.lL1, p.lL2, -1), lgR = leg(hR, p.lR1, p.lR2, 1);

  // tocado de plumas en abanico (más grande y más plumas en la protagonista)
  const plumes = [];
  const np = o.lead ? 11 : [7, 9, 8][v % 3];
  const spread = o.lead ? 2.5 : [2.0, 2.35, 1.8][v % 3];
  const baseLen = o.lead ? 158 : [118, 104, 128][v % 3];
  for (let i = 0; i < np; i++) {
    const u = i / (np - 1);
    const sway = Math.sin(t * 4.2 + i * 0.7 + (o.seed || 0)) * 0.05 + Math.exp(-p.since * 5) * Math.sin(p.since * 18) * 0.18 * (p.dir || 1);
    const a = p.lean + p.head + Math.PI + (u - 0.5) * spread + sway;
    const len = baseLen * (1 - Math.pow(Math.abs(u - 0.5) * 2, 1.6) * 0.38);
    plumes.push({ x: bun[0] - hx * 4, y: bun[1] - hy * 4, a, len, w: o.lead ? 10 : 7.5, bend: (u - 0.5) * 0.7, col: (i + v) % 2, ph: i * 1.7 + (o.seed || 0) });
  }
  // abanico de espalda (solo la protagonista): plumas grandes detrás del cuerpo
  const fan = [];
  if (o.lead) {
    const c = at(0.52, 0);
    for (let i = 0; i < 17; i++) {
      const u = i / 16;
      const sway = Math.sin(t * 3.1 + i * 0.5) * 0.03 + Math.exp(-p.since * 4) * Math.sin(p.since * 14) * 0.08;
      fan.push({ x: c[0], y: c[1], a: p.lean + Math.PI + (u - 0.5) * 3.3 + sway, len: 190 * (1 - Math.abs(u - 0.5) * 0.3), w: 13, bend: (u - 0.5) * 0.35, col: i % 3, ph: i * 2.3 });
    }
  }
  // cinturón de pedrería y flecos que siguen el movimiento
  const swing = Math.exp(-p.since * 6) * Math.sin(p.since * 22) * 0.55 * (p.dir || 1) + Math.sin(t * 3.1 + (o.seed || 0)) * 0.08 + p.lean * 0.6;
  const belt = [at(0.1, 23), at(0.16, 20.5), at(0.16, -20.5), at(0.1, -23)];
  const fringe = [];
  const nf = 16, flen = [26, 34, 22][v % 3] + (o.lead ? 6 : 0);
  for (let i = 0; i <= nf; i++) {
    const u = i / nf;
    const b0 = lerp2(at(0.09, 23), at(0.09, -23), u);
    const a = swing + (u - 0.5) * 0.5 + Math.sin(t * 9 + i) * 0.04;
    const len = flen * (0.8 + 0.2 * Math.sin(u * Math.PI));
    fringe.push([b0[0], b0[1], b0[0] + Math.sin(a) * len, b0[1] + Math.cos(a) * len]);
  }
  // lentejuelas: puntos fijos en el corpiño y el cinturón
  const seq = [];
  for (let i = 0; i < 14; i++) {
    const q = 0.12 + 0.6 * hash(i, 7, v), w = (hash(i, 9, v) - 0.5) * 2 * 12 * (1 - Math.abs(q - 0.44) * 0.6);
    seq.push(at(q, w));
  }
  return { body, plumes, fan, belt, fringe, seq, headC, bun, hands: [aLft.tip, aRgt.tip], feet: [lgL.toe, lgR.toe], chest: at(0.66, 0), hip: at(0.12, 0) };
}

function featherPath(path, pl) {
  const [dx, dy] = dirv(pl.a);
  const nx = -dy, ny = dx;
  const b = (pl.bend || 0) * pl.len;
  const P = (s, w) => [pl.x + dx * pl.len * s + nx * (w + b * s * s), pl.y + dy * pl.len * s + ny * (w + b * s * s)];
  const W = pl.w;
  addSmooth(path, [P(0, 1.5), P(0.25, W * 0.55), P(0.55, W), P(0.82, W * 0.8), P(1.0, 0), P(0.82, -W * 0.8), P(0.55, -W), P(0.25, -W * 0.55), P(0, -1.5)], 0.5);
}

/** Altura de la cadera para que el pie más bajo apoye en el piso (y = 0 en el piso). */
function groundOffset(p) {
  const legLow = (a1, a2) => Math.cos(a1) * L.thigh + Math.cos(a2) * L.shin + 13;
  return -Math.max(legLow(p.lL1, p.lL2), legLow(p.lR1, p.lR2)) + p.lift;
}

const PLUME = [
  [mixHex(PAL.coral, PAL.navy900, 0.35), PAL.coral, PAL.coralLight],
  [mixHex(PAL.gold, PAL.navy900, 0.35), PAL.gold, PAL.goldPale],
  [mixHex(PAL.sunsetPink, PAL.navy900, 0.35), PAL.sunsetPink, PAL.peach],
];

/** Plumas traslúcidas a contraluz: base oscura → color → punta encendida, plumón en los bordes y cañón dorado. */
function drawFeathers(ctx, list, alpha, t) {
  if (!list.length) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round';
  for (const pl of list) {
    const path = new Path2D();
    featherPath(path, pl);
    const [dx, dy] = dirv(pl.a);
    const c = PLUME[pl.col % PLUME.length];
    const grad = lin(ctx, pl.x, pl.y, pl.x + dx * pl.len, pl.y + dy * pl.len, [[0, c[0]], [0.45, c[1]], [1, c[2]]]);
    ctx.fillStyle = grad;
    ctx.fill(path);
    // plumón: barbas finas que salen de los bordes hacia afuera y adelante, y tiemblan
    const nx = -dy, ny = dx, b = (pl.bend || 0) * pl.len;
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let k = 0; k < 9; k++) {
      const sx = 0.22 + k * 0.085;
      const wob = 0.25 * Math.sin(t * 7 + k * 1.3 + (pl.ph || 0));
      for (const sd of [-1, 1]) {
        const w = pl.w * (sx < 0.55 ? 0.5 + sx : 1.05 - (sx - 0.55) * 1.2);
        const bx = pl.x + dx * pl.len * sx + nx * (sd * w + b * sx * sx), by = pl.y + dy * pl.len * sx + ny * (sd * w + b * sx * sx);
        const ang = Math.atan2(dy, dx) + sd * (0.75 + wob);
        const ln = pl.w * (0.9 + 0.5 * Math.sin(k * 2.1 + sd));
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(ang) * ln, by + Math.sin(ang) * ln);
      }
    }
    ctx.stroke();
    // cañón
    ctx.strokeStyle = rgba(PAL.goldPale, 0.6);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(pl.x, pl.y);
    ctx.quadraticCurveTo(pl.x + dx * pl.len * 0.5 + nx * b * 0.25, pl.y + dy * pl.len * 0.5 + ny * b * 0.25, pl.x + dx * pl.len * 0.95 + nx * b * 0.9, pl.y + dy * pl.len * 0.95 + ny * b * 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Dibuja una bailarina con los pies en (x, y) (línea de piso) y escala s.
 * o = { rim (dorado), rim2 (cian), body, lead, seed, variant, sparkle (0..1), reflect: alfa del reflejo }
 */
export function drawDancer(ctx, x, y, s, p, t, o = {}) {
  const body = o.body ?? mixHex(PAL.ink, PAL.navy900, 0.4);
  const rim = o.rim ?? PAL.goldLight;
  const rim2 = o.rim2 ?? PAL.aqua300;
  const B = build(p, t, o);
  const gy = groundOffset(p);
  const local = (c, dx = 0, dy = 0) => { c.translate(x + dx, y + dy); c.scale(s, s); c.translate(0, gy); };
  const pass = (c, color, dx, dy, alpha = 1, feathers = true) => {
    c.save();
    local(c, dx, dy);
    c.globalAlpha *= alpha;
    c.fillStyle = color;
    c.fill(B.body);
    if (feathers) {
      const fp = new Path2D();
      for (const pl of [...B.fan, ...B.plumes]) featherPath(fp, pl);
      c.fill(fp);
    }
    c.restore();
  };
  // reflejo en el piso brillante (espejo aplastado de la silueta encendida)
  if (o.reflect) {
    ctx.save();
    ctx.translate(0, y + 4);
    ctx.scale(1, -0.7);
    ctx.translate(0, -y);
    pass(ctx, o.reflectColor ?? rgba(rim, 1), 0, 0, o.reflect);
    ctx.restore();
  }
  // abanico de espalda y plumas del tocado (detrás del cuerpo), con su filo encendido
  ctx.save();
  local(ctx);
  if (B.fan.length) drawFeathers(ctx, B.fan, 0.92, t);
  drawFeathers(ctx, B.plumes, 0.95, t);
  ctx.restore();
  // filo de luz: dorado del aro (arriba a la izquierda) y cian de los reflectores (arriba a la derecha)
  pass(ctx, rim, -2.4 * s, -2.2 * s, 0.95, false);
  pass(ctx, rim2, 2.4 * s, -2.0 * s, 0.85, false);
  pass(ctx, rgba(PAL.coral, 0.75), 0, 2.2 * s, 0.5, false);
  pass(ctx, body, 0, 0, 1, false);

  // vestuario encima del cuerpo: cinturón de pedrería, flecos dorados y lentejuelas
  ctx.save();
  local(ctx);
  ctx.fillStyle = rgba(PAL.gold, 0.95);
  ctx.beginPath();
  B.belt.forEach(([bx, by], i) => (i ? ctx.lineTo(bx, by) : ctx.moveTo(bx, by)));
  ctx.closePath();
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(PAL.goldLight, 0.9);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const [a, b2, c2, d] of B.fringe) { ctx.moveTo(a, b2); ctx.lineTo(c2, d); }
  ctx.stroke();
  ctx.strokeStyle = rgba(PAL.goldPale, 0.6);
  ctx.lineWidth = 0.7;
  ctx.stroke();
  const tw = (i) => 0.5 + 0.5 * Math.sin(t * 17 + i * 2.3 + (o.seed || 0));
  B.seq.forEach(([qx, qy], i) => {
    ctx.fillStyle = rgba(i % 3 ? PAL.goldLight : PAL.aqua100, 0.55 + 0.45 * tw(i));
    ctx.beginPath(); ctx.arc(qx, qy, 1.5, 0, TAU); ctx.fill();
  });
  ctx.restore();
  // lentejuelas que destellan (estrellitas en el pecho, la cadera, el tocado y las manos)
  if (o.sparkle > 0.01) {
    const pts = [B.chest, B.hip, [B.bun[0], B.bun[1] - 6], B.hands[0], B.hands[1], ...B.seq.slice(0, 4)];
    pts.forEach(([px, py], i) => {
      const k = clamp(o.sparkle * (0.5 + 0.5 * Math.sin(t * 19 + i * 2.1 + (o.seed || 0))));
      if (k < 0.05) return;
      sparkle(ctx, x + px * s, y + (py + gy) * s, (i < 5 ? 13 : 8) * s * k, { alpha: k, color: i % 2 ? PAL.goldPale : PAL.white, rot: t * 3 + i });
    });
  }
}
