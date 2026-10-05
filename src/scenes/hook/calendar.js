// Almanaque de arrancar hojas, GRANDE, colgado de un clavo (la apertura es un primer plano de él y del reloj).
// En cada hook.calN la esquina de la hoja se LEVANTA 4–7 cuadros antes (anticipación), en el cue la hoja se
// despega por el troquel con un tirón y vuela HACIA CÁMARA: crece, da vueltas como papel, se barre (smear) y sale
// por abajo. El almanaque se hamaca en el clavo (acción secundaria) y el día nuevo hace un micro-pop.
// En el estallido el viento arranca varias hojas en blanco de golpe.
import { PAL, mixHex, rgba } from '../../engine/color.js';
import { lin, fill, rrectPath, circlePath, polyPath, texture, smear } from '../../engine/draw.js';
import { toScreen } from '../../engine/camera.js';
import { E, clamp, prog } from '../../engine/ease.js';
import { hash } from '../../engine/noise.js';
import { txt } from '../../engine/text.js';
import { bake, put, blurSprite, wobble, hit } from './util.js';
import { CAL, T, D } from './layout.js';

export const DAYS = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES'];
const PAPER = mixHex(PAL.grey200, '#F4F2EC', 0.45);
const PAPER_BACK = mixHex(PAL.grey300, PAL.grey400, 0.35);
const INK = mixHex(PAL.grey900, PAL.ink, 0.2);
// hoja (coordenadas del plano pared, con el almanaque quieto)
const SH = { x: CAL.x + 14, y: CAL.y + 80, w: CAL.w - 28, h: CAL.h - 102 };
const DAY = { size: 106, top: 24, pad: 13 };
const LIFT = 0.12;   // s: la esquina empieza a levantarse 7 cuadros antes del cue
const LIFT_UP = 0.08; // s: en 5 cuadros ya está arriba (≥ 3 cuadros antes del cue)
let BOARD = null, SHADOW = null;

export function initCalendar() {
  const { x, y, w, h } = CAL;
  BOARD = bake(x - 10, y - 10, w + 20, h + 30, 1.4, (g) => {
    // cartón de base en tres tonos
    fill(g, rrectPath(x, y, w, h, 9), lin(g, x, y, x + w, y + h, [mixHex(PAL.grey400, PAL.grey300, 0.3), PAL.grey500]));
    fill(g, rrectPath(x, y, w, 4, 2), rgba(PAL.white, 0.35));
    fill(g, rrectPath(x + w - 8, y + 4, 8, h - 8, 4), rgba(PAL.ink, 0.22));
    texture(g, rrectPath(x, y, w, h, 9), { alpha: 0.14, scale: 0.8 });
    // cabezal oscuro con ilustración impresa (sierras grises con sol pálido) y ojalillos
    const HH = 64;
    fill(g, rrectPath(x + 10, y + 10, w - 20, HH, 6), mixHex(PAL.grey700, PAL.navy700, 0.15));
    g.save();
    g.clip(rrectPath(x + 10, y + 10, w - 20, HH, 6));
    const X = (f) => x + 10 + f * (w - 20);
    fill(g, polyPath([[X(0), y + 74], [X(0.22), y + 36], [X(0.4), y + 58], [X(0.62), y + 26], [X(1), y + 74]]), mixHex(PAL.grey600, PAL.grey500, 0.4));
    fill(g, polyPath([[X(0), y + 74], [X(0.16), y + 54], [X(0.4), y + 68], [X(0.72), y + 48], [X(1), y + 74]]), PAL.grey600);
    fill(g, circlePath(X(0.84), y + 32, 11), rgba(PAL.grey300, 0.45));
    g.restore();
    for (const ox of [w * 0.3, w * 0.7]) {
      fill(g, circlePath(x + ox, y + 80, 8), PAL.grey300);
      fill(g, circlePath(x + ox, y + 80, 4), rgba(PAL.ink, 0.7));
    }
    // canto del taco (hojas apiladas)
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? mixHex(PAL.grey300, PAL.grey400, 0.5) : PAL.grey200;
      g.fillRect(SH.x + 1, SH.y + SH.h + i * 2, SH.w - 2, 2);
    }
  });
  const sh = bake(x - 70, y - 70, w + 140, h + 160, 0.5, (g) => {
    fill(g, rrectPath(x, y, w, h + 10, 10), rgba(PAL.ink, 0.5));
  });
  SHADOW = blurSprite(sh, 16);
  for (const d of [...DAYS, null]) for (const torn of [false, true]) sheetFace(null, d, { torn });
  sheetBack(null);
}

/** Ángulo del almanaque en el clavo: se hamaca con cada arrancada y con el viento del estallido. */
function swing(t) {
  let a = 0;
  for (const c of T.cal) {
    a += 0.016 * E.inQuad(prog(t, c - LIFT, c)) * (t < c ? 1 : 0);
    a += -0.055 * wobble(t, c, { freq: 1.7, decay: 3.4 });
  }
  for (const q of T.q) a += 0.01 * wobble(t, q, { freq: 2.6, decay: 6 });
  if (t > T.surge) {
    const u = t - T.surge;
    a += -0.14 * E.outCubic(clamp(u / 0.2)) - 0.035 * Math.sin(u * 23) * clamp(u / 0.1);
  }
  return a;
}

/** Hoja de arriba según t (índice en DAYS). */
function topIndex(t) {
  let k = 0;
  for (const c of T.cal) if (t >= c) k++;
  return k;
}

function fitDay(day) {
  const T0 = txt(day, { size: DAY.size, weight: 800, tracking: 0.01 });
  return { T: T0, k: Math.min(1, (SH.w - 2 * DAY.pad) / T0.width) };
}

/** Cara de la hoja: sprite horneado salvo durante el micro-pop del texto (ahí va en vivo). */
const FACES = new Map();
function sheetFace(ctx, day, { textPop = 1, torn = false } = {}) {
  if (Math.abs(textPop - 1) > 0.004) { paintFace(ctx, day, { textPop, torn, grain: false }); return; }
  const key = `${day}|${torn}`;
  let S = FACES.get(key);
  if (!S) { S = bake(-4, -4, SH.w + 8, SH.h + 8, 1.8, (g) => paintFace(g, day, { torn })); FACES.set(key, S); }
  if (ctx) put(ctx, S);
}
let BACK = null;
function sheetBack(ctx) {
  if (!BACK) {
    BACK = bake(-4, -4, SH.w + 8, SH.h + 8, 1.8, (g) => {
      const body = tornPath(SH.w, SH.h);
      fill(g, body, lin(g, 0, 0, SH.w, SH.h, [mixHex(PAPER_BACK, PAL.white, 0.2), PAPER_BACK]));
      // el día de adelante se transparenta al revés (papel fino)
      g.save();
      g.globalAlpha = 0.07;
      g.translate(SH.w, 0);
      g.scale(-1, 1);
      g.fillStyle = INK;
      g.fillRect(DAY.pad + 10, DAY.top + 10, SH.w - 2 * DAY.pad - 20, 56);
      g.restore();
      texture(g, body, { alpha: 0.1, scale: 0.6 });
    });
  }
  if (ctx) put(ctx, BACK);
}

/** Cara de la hoja con el día (coordenadas locales: 0,0 arriba a la izquierda). */
function paintFace(ctx, day, { textPop = 1, torn = false, grain = true } = {}) {
  const { w, h } = SH;
  const body = torn ? tornPath(w, h) : rrectPath(0, 0, w, h, 2);
  fill(ctx, body, lin(ctx, 0, 0, w, h, [mixHex(PAPER, PAL.white, 0.25), PAPER, mixHex(PAPER, PAL.grey300, 0.5)]));
  if (!torn) {
    // troquel arriba
    ctx.fillStyle = rgba(PAL.grey500, 0.55);
    for (let x = 6; x < w - 6; x += 8) ctx.fillRect(x, 8, 4, 1.8);
  }
  // día (mayúsculas grandes: se lee en la apertura)
  if (day) {
    const { T: Tx, k } = fitDay(day);
    ctx.save();
    ctx.translate(w / 2, DAY.top + (Tx.capH * k) / 2);
    ctx.scale(k * textPop, k * textPop);
    ctx.font = Tx.font;
    ctx.fillStyle = INK;
    ctx.textBaseline = 'alphabetic';
    const x0 = -Tx.width / 2, y0 = Tx.capH / 2;
    for (const gph of Tx.lines[0].glyphs) ctx.fillText(gph.ch, x0 + gph.x, y0);
    ctx.restore();
  }
  // renglones de agenda
  const y1 = DAY.top + 104;
  ctx.fillStyle = rgba(PAL.grey600, 0.4);
  ctx.fillRect(16, y1, w - 32, 3);
  for (let i = 0; i < 6; i++) {
    const y = y1 + 30 + i * 28;
    if (y > h - 14) break;
    ctx.fillStyle = rgba(PAL.grey400, 0.55);
    ctx.fillRect(48, y, w - 64, 1.6);
    ctx.fillStyle = rgba(PAL.grey500, 0.6);
    ctx.fillRect(16, y - 1, 20, 3.4);
  }
  // grano solo al hornear (crear patrones en cada cuadro degrada el render en Node)
  if (grain) texture(ctx, body, { alpha: 0.1, scale: 0.6 });
}

function tornPath(w, h) {
  const pts = [];
  for (let i = 0; i <= 18; i++) pts.push([(i / 18) * w, 4 + hash(i, 77) * 8]);
  pts.push([w, h], [0, h]);
  return polyPath(pts);
}

/** Cuánto está levantada la esquina en t (0..~1,15): sube rápido con overshoot y flamea hasta el tirón. */
function liftAt(t, c) {
  if (t < c - LIFT || t >= c) return 0;
  const up = E.backOut(1.6)(prog(t, c - LIFT, c - LIFT + LIFT_UP));
  return up + 0.12 * Math.sin((t - c) * 70) * clamp((t - (c - LIFT + LIFT_UP)) / 0.02);
}

/** Almanaque completo en el plano pared (tablero, taco y hoja de arriba con la esquina que se levanta). */
export function drawCalendar(ctx, t) {
  const a = swing(t);
  const k = topIndex(t);
  ctx.save();
  ctx.translate(CAL.nx, CAL.ny);
  ctx.rotate(a);
  ctx.translate(-CAL.nx, -CAL.ny);
  // sombra corrida (la luz viene de arriba a la izquierda)
  ctx.save();
  ctx.globalAlpha = 0.8;
  put(ctx, SHADOW, 14, 18);
  ctx.restore();
  // cordón al clavo
  ctx.strokeStyle = PAL.grey900;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(CAL.x + CAL.w * 0.3, CAL.y + 7); ctx.lineTo(CAL.nx, CAL.ny); ctx.lineTo(CAL.x + CAL.w * 0.7, CAL.y + 7);
  ctx.stroke();
  put(ctx, BOARD);
  // hoja de abajo (la que va a quedar)
  const next = Math.min(DAYS.length - 1, k + 1);
  ctx.save();
  ctx.translate(SH.x, SH.y);
  const c = T.cal[k];
  const f = k < T.cal.length ? liftAt(t, c) : 0;
  if (f > 0) sheetFace(ctx, DAYS[next]);
  // hoja de arriba (con micro-pop del texto recién descubierto)
  const prevC = k > 0 ? T.cal[k - 1] : -9;
  const pop = 1 + 0.1 * wobble(t, prevC, { freq: 3.2, decay: 7 }) + 0.06 * hit(t, prevC, 0.05);
  if (f > 0) curlSheet(ctx, DAYS[k], f);
  else if (t > T.surge) {
    // viento del estallido: debajo asoma una hoja en blanco y la esquina flamea
    const u = t - T.surge;
    sheetFace(ctx, null);
    curlSheet(ctx, DAYS[k], clamp(0.3 + 0.4 * Math.sin(u * 40)) * clamp(u / 0.05));
  } else sheetFace(ctx, DAYS[k], { textPop: pop });
  ctx.restore();
  ctx.restore();
}

/** Hoja con la esquina inferior derecha doblada hacia arriba (f 0..~1,15). */
function curlSheet(ctx, day, f) {
  const { w, h } = SH;
  const s = 30 + 150 * f;
  const A = [w - s, h], B = [w, h - s * 1.1], P = [w, h];
  // reflejo de la esquina sobre la línea AB
  const dx = B[0] - A[0], dy = B[1] - A[1];
  const L2 = dx * dx + dy * dy;
  const tt = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / L2;
  const fx = A[0] + dx * tt, fy = A[1] + dy * tt;
  const R = [2 * fx - P[0], 2 * fy - P[1]];
  ctx.save();
  ctx.clip(polyPath([[0, 0], [w, 0], B, A, [0, h]]));
  sheetFace(ctx, day);
  // sombra que la solapa proyecta sobre la hoja
  fill(ctx, polyPath([A, B, [R[0] - 14, R[1] + 6]]), rgba(PAL.ink, 0.18 + 0.1 * f));
  ctx.restore();
  // solapa (dorso del papel) con filo de luz en el doblez
  fill(ctx, polyPath([A, B, R]), lin(ctx, A[0], A[1], R[0], R[1], [PAPER_BACK, mixHex(PAPER_BACK, PAL.white, 0.45)]));
  ctx.strokeStyle = rgba(PAL.white, 0.75);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
}

/** Hojas en blanco que arranca el viento del estallido (plano pared, pasan por delante del monitor). */
export function drawCalendarFly(ctx, t) {
  for (let i = 0; i < 5; i++) {
    const u = t - (T.surge + 0.03 + i * 0.045);
    if (u < 0 || u > 1.2) continue;
    windSheet(ctx, u, 10 + i);
  }
}

function windSheet(ctx, u, seed) {
  const { x, y, w, h } = SH;
  const cx0 = x + w / 2, cy0 = y + h / 2;
  const yank = E.outCubic(clamp(u / 0.13));
  const px = cx0 + (520 + 380 * hash(seed, 1)) * u + 70 * yank + 26 * Math.sin(u * 9 + seed);
  const py = cy0 - (260 + 200 * hash(seed, 2)) * yank + 700 * u * u;
  const rot = 0.32 * E.backOut(2)(clamp(u / 0.22)) + 0.9 * u + 0.22 * Math.sin(u * 7.3 + seed);
  const flip = Math.cos(u * 11 + seed * 0.7);
  const sc = 0.7 * (1 + 0.75 * u);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(rot);
  ctx.transform(1, 0.12 * Math.sin(u * 13 + seed), 0, 1, 0, 0);
  ctx.scale(sc * (Math.abs(flip) < 0.06 ? 0.06 * Math.sign(flip || 1) : flip), sc);
  ctx.translate(-w / 2, -h / 2);
  fill(ctx, rrectPath(10, 14, w, h, 3), rgba(PAL.ink, 0.16));
  if (flip >= 0) sheetFace(ctx, null, { torn: true });
  else sheetBack(ctx);
  ctx.restore();
}

// ------------------------------------------------------------------ hojas que vuelan hacia cámara
const FLY = 0.45; // s de vuelo (sale de cuadro por abajo antes del cue siguiente)
// variación por hoja: [deriva lateral, sentido de giro, ritmo del volteo]
const VAR = [[-1, 1, 0.3], [0.8, -1, 1.9], [-0.6, 1, 3.2]];

/**
 * Pose en pantalla de la hoja k a u s del tirón (con la cámara cam). Vuelo en perspectiva: la hoja se acerca a
 * la lente (distancia d → 0,23) mientras cae, así crece y acelera hacia abajo como algo que pasa rozando la cámara.
 */
function flyPose(t, u, k, cam) {
  const [dx, dr, ph] = VAR[k];
  const a = swing(t);
  // centro de la hoja en el plano pared (con el hamaque del almanaque) → pantalla
  const lx = SH.x + SH.w / 2 - CAL.nx, ly = SH.y + SH.h / 2 - CAL.ny;
  const wx = CAL.nx + lx * Math.cos(a) - ly * Math.sin(a), wy = CAL.ny + lx * Math.sin(a) + ly * Math.cos(a);
  const [x0, y0] = toScreen(cam, D.wall, wx, wy);
  const zw = Math.pow(cam.z, D.wall);
  // tirón: en el cuadro del cue ya se despegó (salta hacia abajo); después vuela hacia cámara
  const yank = E.outCubic(clamp((u + 0.035) / 0.12));
  const d = Math.max(0.23, 1 - 1.75 * u);
  const X = x0 - 960 + dx * 420 * u, Y = y0 - 540 + 30 * yank + 60 * u + 2600 * u * u;
  const x = 960 + X / d, y = 540 + Y / d;
  const sc = zw / d;
  const rot = a + (cam.r || 0) + dr * (0.14 * yank + 0.8 * u + 3 * u * u);
  const flip = 0.58 + 0.42 * Math.cos(u * (8 + 2 * ph));
  return { x, y, sc, rot, flip };
}

function paintFly(ctx, P, day) {
  const { w, h } = SH;
  ctx.save();
  ctx.translate(P.x, P.y);
  ctx.rotate(P.rot);
  ctx.transform(1, 0.1 * (1 - Math.abs(P.flip)), 0, 1, 0, 0);
  const fx = Math.abs(P.flip) < 0.05 ? 0.05 : Math.abs(P.flip);
  ctx.scale(P.sc * fx, P.sc);
  ctx.translate(-w / 2, -h / 2);
  // sombra suave proyectada (la hoja está cerca de cámara: sombra amplia)
  fill(ctx, rrectPath(16, 22, w, h, 3), rgba(PAL.ink, 0.18));
  if (P.flip >= 0) sheetFace(ctx, day, { torn: true });
  else sheetBack(ctx);
  ctx.restore();
}

/**
 * Hojas arrancadas volando hacia cámara, en coordenadas de PANTALLA (se dibujan al final, por delante de todo).
 * El barrido (smear) sigue la velocidad de la hoja.
 */
export function drawSheetsToCamera(ctx, t, cam) {
  for (let k = 0; k < T.cal.length; k++) {
    const u = t - T.cal[k];
    if (u < 0 || u > FLY) continue;
    const P = flyPose(t, u, k, cam);
    const d = 1 / 60;
    const P1 = flyPose(t, Math.max(0, u - d), k, cam);
    const vx = (P.x - P1.x) / d, vy = (P.y - P1.y) / d;
    const grow = (P.sc - P1.sc) / d;
    // largo del barrido: velocidad del centro + lo que crece (los bordes se abren)
    const sx = vx * 0.03, sy = (vy + grow * 120) * 0.03;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (Math.hypot(sx, sy) > 6) smear(ctx, sx, sy, (c) => paintFly(c, P, DAYS[k]), 4, { edge: 'none' });
    else paintFly(ctx, P, DAYS[k]);
    ctx.restore();
  }
}
