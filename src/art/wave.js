// LA OLA de las dos transiciones (gancho → mar, valor → cierre). El CUÁNDO vive en src/scenes/waves.js
// (director: p(t), dir); acá vive la FORMA.
//
// v3 (pulido final): BARRIL QUE ROMPE. El LABIO se lanza hacia adelante con vuelo (lengua con espesor que se
// afina y cuya punta se curva hacia abajo, soltando espuma, hilos y gotas); debajo queda el HUECO del tubo
// abierto (ahí todavía se ve la escena vieja, en la sombra del labio, con bruma de spray); la CARA es CÓNCAVA,
// en degradé teal (aqua arriba → ocean500/600 en la base, sin navy) con una penumbra en la garganta; la ESPALDA
// es una LOMA inclinada que baja desde la cresta hasta el mar de la escena nueva (no un acantilado vertical).
// El CUERPO es OPACO: la espalda se funde a 0 recién a la altura del horizonte, sobre el mar entrante; la escena
// nueva aparece por la máscara, nunca por transparencia. Base de ENCAJE (water.js) con spray direccional.
//
// Contrato:
//   drawWaveMask(ctx, p, o)      región YA cubierta (lo que la ola pasó = escena nueva). o.inverse = al revés.
//   drawWaveCrest(ctx, t, p, o)  el cuerpo de la ola por encima de todo.
//   Con el mismo p y o.dir, el borde de la máscara y el frente del agua son EL MISMO trazo (mismo Path2D).
// Direcciones: 'rtl' (entra por la derecha y barre a la izquierda) · 'ltr' · 'up' (sube desde abajo).
// p = 0: todo fuera de cuadro del lado de entrada · p = 1: salió por el lado opuesto (máscara = cuadro entero).
import { W, H } from '../engine/time.js';
import { lin, rad, smoothPath, sparkle, toLayer, blit } from '../engine/draw.js';
import { clamp, smoothstep, lerp } from '../engine/ease.js';
import { hash, noise1 } from '../engine/noise.js';
import { PAL } from '../engine/color.js';
import { ca } from './util.js';
import { waveColors, drawFoamLace, drawSpray, drawDrop, blobInto } from './water.js';

export { waveColors };

// Recorrido del frente en px (igual que en v1, así los tiempos de HOOK/TYPE/CLOSE no cambian):
// X(0) = Wc + 453,6 px (todo fuera a la derecha) · X(1) = −399,6 px (la espalda ya salió por la izquierda).
// Todo lo visible de la ola vive en u ∈ [−0,46, 0,41] (unidades de Hc) para entrar y salir completa.
const AHEAD_PX = 453.6, BEHIND_PX = 399.6;
const HC_K = 0.9;   // alto transversal de la ola = 0,9 del cuadro
const Y0_K = 0.04;  // la ola arranca 0,04 del cuadro más abajo (la cresta queda adentro)
// la espalda se funde (alfa 1 → 0) sobre el mar, al pie de la loma: banda inclinada s = 0,966·u + 0,258·v entre
// FADE_S0 y FADE_S1 (las isolíneas bajan hacia adelante: la loma queda opaca contra el cielo y abajo el cuerpo se
// funde antes con el mar entrante). Nada visible pasa de u ≈ 0,41 (sale entera en p = 1).
const FADE_D = [0.966, 0.258], FADE_S0 = 0.49, FADE_S1 = 0.575;
// luz de la ola en coordenadas canónicas: viene de ARRIBA y de ATRÁS (labio a contraluz)
const LIGHT = [0.45, -0.89];
let PRESET = 'golden'; // preset de la llamada en curso (lo fija drawWaveCrest; lo leen las piezas)

/** Marco canónico de la dirección: largo de recorrido Wc, alto transversal T, la transformación. */
function frame(dir = 'rtl') {
  if (dir === 'up') return { Wc: H, T: W, apply: (ctx) => { ctx.translate(W, 0); ctx.rotate(Math.PI / 2); } };
  if (dir === 'ltr') return { Wc: W, T: H, apply: (ctx) => { ctx.translate(W, 0); ctx.scale(-1, 1); } };
  return { Wc: W, T: H, apply: () => {} };
}

/** x del frente (canónico) para p. */
export function waveFrontX(p, dir = 'rtl') {
  const { Wc } = frame(dir);
  const k = dir === 'up' ? W / H : 1;
  return lerp(Wc + AHEAD_PX * k, -BEHIND_PX * k, clamp(p));
}

// ------------------------------------------------------------------ perfil (unidades de Hc)
// U adelante negativo (hacia donde avanza la ola), V 0 arriba … 1 abajo. Funciones de p (la máscara no recibe t).
// El frente (de abajo hacia arriba) es UN solo trazo que no se cruza:
//   base:  del fondo (fuera de cuadro) al pie B, con la punta de la espuma batida un poco adelante
//   cara:  de B sube CÓNCAVA (rampa → pared casi vertical → se mete bajo el labio) hasta la garganta
//   panza: de la garganta va hacia adelante por debajo del labio hasta la punta T
//   punta: T → curl → nose (la punta se curva hacia abajo; nose = lo más adelantado)
//   lomo:  de la nariz vuelve por arriba del labio hasta la cresta
// y la espalda baja como LOMA desde la cresta hasta el mar de atrás.
const TU = -0.138; // u de la garganta: el labio se lanza desde acá
// base: del fondo (fuera de cuadro) a la punta de la rampa (el pie B queda adelante, bajo la punta del labio)
const BASE = [[0.05, 1.22], [-0.16, 1.12], [-0.31, 1.045], [-0.435, 0.99]];
const B0 = [-0.42, 0.965];
// cara CÓNCAVA: rampa que sube desde el pie, pared casi vertical y se mete bajo el labio
const FACE = [[-0.36, 0.93], [-0.3, 0.88], [-0.245, 0.815], [-0.2, 0.74], [-0.163, 0.66], [-0.135, 0.58], [-0.118, 0.5], [-0.115, 0.43], [-0.123, 0.365]];
const THROAT = [TU, 0.305];
// panza: techo redondo del tubo, de la garganta a la punta (el labio se afina hacia la punta)
const BELLY = [[-0.16, 0.268], [-0.19, 0.243], [-0.23, 0.228], [-0.275, 0.224], [-0.32, 0.232], [-0.36, 0.25], [-0.395, 0.278], [-0.422, 0.315], [-0.436, 0.36], [-0.434, 0.405]];
// punta: se curva hacia abajo y se ENROSCA hacia adentro (hacia la cara): rulo, no pata de arco
const T0 = [-0.418, 0.448], CURL0 = [-0.475, 0.425], NOSE0 = [-0.496, 0.345];
const LOMO = [[-0.488, 0.27], [-0.462, 0.205], [-0.422, 0.155], [-0.37, 0.118], [-0.31, 0.092], [-0.248, 0.078], [-0.19, 0.072], [-0.14, 0.072]];
const CREST = [-0.1, 0.075];
// espalda: LOMA inclinada (≈50°) con hombro chico; llega al horizonte (v ≈ 0,62) justo antes del fundido
const BACK = [[-0.06, 0.082], [-0.02, 0.1], [0.025, 0.135], [0.07, 0.18], [0.115, 0.232], [0.16, 0.29], [0.205, 0.35], [0.25, 0.41], [0.292, 0.47], [0.33, 0.528], [0.362, 0.578], [0.39, 0.615], [0.425, 0.645], [0.48, 0.665], [0.6, 0.68], [0.8, 0.69]];

function profile(p, seed) {
  // el labio se LANZA: arranca recogido (todavía levantándose) y en p ≈ 0,45 ya voló entero; después sigue un poco
  const thr = 0.72 + 0.28 * smoothstep(0, 0.45, p) + 0.04 * smoothstep(0.45, 1, p);
  const dr = 0.05 * smoothstep(0.12, 1, p);       // la punta cae
  // el labio (adelante de la garganta) se estira con thr; la punta baja con dr (más cuanto más cerca de la punta)
  const L = ([u, v]) => {
    if (u >= TU) return [u, v];
    const f = clamp((TU - u) / 0.34);
    return [TU + (u - TU) * thr, v + dr * f * f];
  };
  // frente (de abajo hacia arriba): base → pie → cara → garganta → panza → punta → curl → nariz → lomo → cresta
  const raw = [...BASE, B0, ...FACE, THROAT, ...BELLY.map(L), L(T0), L(CURL0), L(NOSE0), ...LOMO.map(L), CREST];
  const wob = (P, sd, amp) => P.map(([u, v], i) => (i === 0 || i === P.length - 1 ? [u, v]
    : [u + amp * noise1(p * 7.3 + i * 0.93, sd), v + amp * 0.55 * noise1(p * 6.1 + i * 1.71, sd + 3)]));
  const front = wob(raw, seed, 0.004);
  // las piezas salen del MISMO frente (con su temblor): el brillo del borde cae justo sobre el borde
  const iB = BASE.length, iTh = iB + FACE.length + 1, iT = iTh + BELLY.length + 1;
  const face = front.slice(iB, iTh + 1).reverse();         // garganta → pie (de arriba hacia abajo)
  const belly = front.slice(iTh, iT + 1).reverse();        // punta → garganta
  const lomo = front.slice(iT + 2).reverse();              // cresta → nariz
  const back = wob([CREST, ...BACK], seed + 20, 0.004);
  return { front, back, face, belly, lomo, T: front[iT], curl: front[iT + 1], nose: front[iT + 2], B: front[iB], crest: CREST, thr, dr };
}

const geoCache = new Map();
/**
 * Geometría de la ola en p (coordenadas canónicas: ver frame()). Cacheada.
 * { X, Hc, Y0, Wc, front: [[x,y]…] (base → cara → panza → punta → lomo → cresta), mask, inverse, water: Path2D,
 *   face (garganta → pie) / belly (punta → garganta) / lomo (cresta → nariz) / back (cresta → atrás): [[x,y]…],
 *   nose, curl, T (punta), B (pie), crest, hollow (centro del hueco del tubo): [x,y], toC([u,v]) }
 */
export function waveGeom(p, o = {}) {
  const dir = o.dir ?? 'rtl', seed = o.seed ?? 7;
  const key = `${dir}|${seed}|${p.toFixed(5)}`;
  let G = geoCache.get(key);
  if (G) return G;
  const F = frame(dir);
  const Hc = HC_K * F.T, Y0 = Y0_K * F.T, Wc = F.Wc;
  const X = waveFrontX(p, dir);
  const prof = profile(p, seed);
  const toC = ([u, v]) => [X + u * Hc, Y0 + v * Hc];
  const front = prof.front.map(toC);
  const crest = front[front.length - 1];
  // máscara: frente + todo lo de atrás; arriba de la cresta sube casi vertical (lo tapa el penacho de la cresta)
  const maskInto = (P) => {
    P.moveTo(front[0][0], front[0][1]);
    smoothPath(front, false, 0.5, P);
    P.lineTo(crest[0] + 0.012 * Hc, crest[1] - 0.03 * Hc);
    P.lineTo(crest[0] + 0.03 * Hc, -0.6 * Hc);
    P.lineTo(Wc + 4 * Hc, -0.6 * Hc);
    P.lineTo(Wc + 4 * Hc, Y0 + 1.4 * Hc);
    P.lineTo(front[0][0], Y0 + 1.4 * Hc);
    P.closePath();
    return P;
  };
  const mask = maskInto(new Path2D());
  const inverse = new Path2D();
  inverse.rect(-10 * W, -10 * H, 30 * W, 30 * H);
  maskInto(inverse);
  // agua: el mismo frente + la espalda que baja hacia atrás
  const back = prof.back.map(toC);
  const water = smoothPath(front, false, 0.5);
  smoothPath(back, false, 0.5, water);
  water.lineTo(back[back.length - 1][0], Y0 + 1.4 * Hc);
  water.lineTo(front[0][0], Y0 + 1.4 * Hc);
  water.closePath();
  const m = (P) => P.map(toC);
  const T = toC(prof.T);
  G = {
    X, Hc, Y0, Wc, front, mask, inverse, water, back, toC, prof,
    face: m(prof.face), belly: m(prof.belly), lomo: m(prof.lomo),
    nose: toC(prof.nose), curl: toC(prof.curl), T, B: toC(prof.B), crest,
    hollow: [lerp(T[0], toC([-0.11, 0])[0], 0.5), Y0 + 0.58 * Hc],
  };
  geoCache.set(key, G);
  if (geoCache.size > 48) geoCache.delete(geoCache.keys().next().value);
  return G;
}

/**
 * Pinta la región ya cubierta por la ola (o la inversa con o.inverse). Color sólido (sirve de máscara alfa).
 * o = { dir, seed, inverse, color }
 */
export function drawWaveMask(ctx, p, o = {}) {
  ctx.save();
  ctx.fillStyle = o.color ?? '#ffffff';
  if (p <= 0) {
    if (o.inverse) { ctx.fillRect(-W, -H, W * 3, H * 3); }
    ctx.restore();
    return;
  }
  if (p >= 1) {
    if (!o.inverse) ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.restore();
    return;
  }
  const F = frame(o.dir);
  F.apply(ctx);
  const G = waveGeom(p, o);
  if (o.inverse) ctx.fill(G.inverse, 'evenodd');
  else ctx.fill(G.mask);
  ctx.restore();
}

// ------------------------------------------------------------------ ayudas de polilínea
/** Desplaza una polilínea sobre su normal (dy, −dx) (con la orientación del trazo) una distancia d(s). */
function offsetPts(pts, d) {
  const n = pts.length;
  return pts.map(([x, y], i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const k = typeof d === 'function' ? d(i / (n - 1)) : d;
    return [x + (dy / l) * k, y - (dx / l) * k];
  });
}
/** Banda entre una polilínea y su desplazada (cerrada). */
function bandPath(pts, d) {
  const off = offsetPts(pts, d);
  const P = smoothPath(pts, false, 0.5);
  smoothPath(off.slice().reverse(), false, 0.5, P);
  P.closePath();
  return P;
}
/** Sub-tramo de una polilínea entre las fracciones de índice a..b (interpolado). */
function sub(pts, a, b, n = 8) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = (a + ((b - a) * i) / n) * (pts.length - 1);
    const j = Math.min(pts.length - 2, Math.floor(f)), q = f - j;
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * q, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * q]);
  }
  return out;
}
/** Emisión continua: n ráfagas escalonadas que se renuevan rate veces por segundo. */
function bursts(t, rate, n, fn) {
  for (let k = 0; k < n; k++) {
    const ph = t * rate + k / n;
    const i = Math.floor(ph);
    fn(ph - i, i * 13 + k * 101);
  }
}

// ------------------------------------------------------------------ la ola
/**
 * El cuerpo de la ola. o = { dir, seed, preset (de la escena nueva: tiñe la luz), spray 0..1.5, foam 0..1.5, shadow 0..1 }
 */
export function drawWaveCrest(ctx, t, p, o = {}) {
  if (p <= 0 || p >= 1) return;
  const F = frame(o.dir);
  const G = waveGeom(p, o);
  PRESET = o.preset ?? 'golden';
  const C = waveColors(PRESET);
  const { X, Hc, Y0 } = G;
  const k = Hc / 972; // escala de detalles
  const foamAmt = o.foam ?? 1, sprayAmt = o.spray ?? 1;
  const U = (u) => X + u * Hc, V = (v) => Y0 + v * Hc;
  ctx.save();
  F.apply(ctx);

  // 0) sombra que la ola proyecta adelante (solo sobre la escena vieja): el hueco bajo el labio queda en penumbra
  const sh = o.shadow ?? 1;
  if (sh > 0.01) {
    ctx.save();
    ctx.clip(G.inverse, 'evenodd');
    ctx.fillStyle = lin(ctx, U(-0.6), 0, U(-0.04), 0, [[0, ca(PAL.ink, 0)], [0.55, ca(PAL.ink, 0.14 * sh)], [1, ca(PAL.ink, 0.34 * sh)]]);
    ctx.fillRect(U(-0.6), V(0.05), 0.62 * Hc, 1.3 * Hc);
    // el techo del tubo: el labio tapa la luz que viene de arriba
    const [hx, hy] = G.hollow;
    ctx.fillStyle = rad(ctx, hx + 0.03 * Hc, hy - 0.16 * Hc, 0.3 * Hc, [[0, ca(PAL.ink, 0.3 * sh)], [0.6, ca(PAL.ink, 0.12 * sh)], [1, ca(PAL.ink, 0)]]);
    ctx.fillRect(hx - 0.3 * Hc, hy - 0.46 * Hc, 0.66 * Hc, 0.6 * Hc);
    ctx.restore();
  }

  // 1) CUERPO OPACO en una capa recortada al perfil; al final, la espalda se funde a 0 sobre el mar
  const L = toLayer(ctx, (c) => {
    c.save();
    c.clip(G.water);
    const bx0 = U(-0.6), bw = 1.5 * Hc, by0 = V(-0.2), bh = 1.6 * Hc;
    // cara cóncava en degradé teal (aqua bajo el labio → ocean400 → ocean500/600 en la base), sin navy
    c.fillStyle = lin(c, 0, V(0.2), 0, V(1.06), [
      [0, C.faceHi], [0.22, C.face1], [0.5, C.face2], [1, C.faceLo],
    ]);
    c.fillRect(bx0, by0, bw, bh);
    // concavidad: bandas concéntricas al hueco del tubo (la cara se curva alrededor del barril)
    const [hx, hy] = G.hollow;
    c.fillStyle = rad(c, hx, hy, 0.5 * Hc, [[0, ca(C.faceHi, 0)], [0.36, ca(C.faceHi, 0.55)], [0.5, ca(C.faceHi, 0.12)], [0.62, ca(C.faceLo, 0)], [0.8, ca(C.faceLo, 0.4)], [1, ca(C.faceLo, 0)]]);
    c.fillRect(hx - 0.5 * Hc, hy - 0.5 * Hc, Hc, Hc);
    // espalda (la loma): hacia atrás se va al color del mar del preset entrante (sin cortes duros)
    c.fillStyle = lin(c, U(0.0), 0, U(0.3), 0, [[0, ca(C.back, 0)], [1, ca(C.back, 0.9)]]);
    c.fillRect(bx0, by0, bw, bh);
    c.fillStyle = lin(c, U(0.02), V(0.62), U(0.3), V(1.06), [[0, ca(C.backDeep, 0)], [1, ca(C.backDeep, 0.32)]]);
    c.fillRect(bx0, by0, bw, bh);
    // contraluz: la loma alta, detrás de la raíz del labio, es agua fina iluminada por detrás
    c.save();
    c.globalCompositeOperation = 'screen';
    c.fillStyle = rad(c, U(0.02), V(0.14), 0.3 * Hc, [[0, ca(C.glow, 0.42)], [0.5, ca(C.glow, 0.14)], [1, ca(C.glow, 0)]]);
    c.fillRect(U(-0.3), V(-0.2), 0.7 * Hc, 0.7 * Hc);
    c.restore();
    faceStreaks(c, t, G, C, k);
    backLines(c, t, G, C, k);
    faceLace(c, t, p, G, C, k, foamAmt);
    // penumbra de la garganta: bajo la panza y en lo alto de la cara (el techo del tubo)
    throatShade(c, t, G, C, k);
    // LABIO: lengua con espesor en 3 tonos
    lipBody(c, t, G, C, k);
    // filo de contraluz en la loma
    c.lineCap = 'round';
    c.strokeStyle = lin(c, 0, V(0), 0, V(0.55), [[0, ca(C.rim, 0.85)], [0.6, ca(C.rim, 0.35)], [1, ca(C.rim, 0)]]);
    c.lineWidth = 5 * k;
    c.stroke(smoothPath(G.back.slice(0, 10), false, 0.5));
    c.restore();
    // la espalda se funde con el mar del preset entrante, al pie de la loma
    c.save();
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = lin(c, U(FADE_S0 * FADE_D[0]), V(FADE_S0 * FADE_D[1]), U(FADE_S1 * FADE_D[0]), V(FADE_S1 * FADE_D[1]), [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
    c.fillRect(U(-1), V(-1), 3 * Hc, 3 * Hc);
    c.restore();
  });
  blit(ctx, L);

  // 2) brillo del borde de la cara y espuma de la base (encaje)
  frontFoam(ctx, t, p, G, C, k, foamAmt);
  // 3) labio: filo brillante, espuma que rompe en la punta y se desprende, cortina de spray que cae al hueco
  lipFoam(ctx, t, p, G, C, k, foamAmt);
  // 4) bruma, spray y gotas (punta, cresta, hueco y base)
  mist(ctx, t, p, G, C, k);
  sprays(ctx, t, p, G, C, k, sprayAmt);
  // 5) destellos
  glints(ctx, t, p, G, C, k);
  ctx.restore();
}

// ------------------------------------------------------------------ piezas del cuerpo
/** Vetas que suben por la cara cóncava (siguen su curva). */
function faceStreaks(c, t, G, C, k) {
  const { Hc } = G;
  const fc = G.face; // garganta → pie: la normal (+) apunta hacia adentro del cuerpo
  c.save();
  c.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const inset = (0.03 + i * 0.024 + hash(i, 5) * 0.012) * Hc;
    const line = offsetPts(fc, inset);
    const sp = 0.55 + hash(i, 7) * 0.5;
    const s0 = (t * sp + hash(i, 8)) % 1;       // suben (s va de la garganta al pie)
    const len = 0.16 + hash(i, 6) * 0.22;
    const a0 = Math.max(0.04, 1 - s0 - len), a1 = Math.min(0.97, 1 - s0);
    if (a1 - a0 < 0.03) continue;
    const env = Math.min(1, (a1 - 0.04) / 0.1, (0.97 - a0) / 0.1);
    c.strokeStyle = ca(i % 3 === 0 ? C.drop : C.faceHi, (0.42 - i * 0.03) * env);
    c.lineWidth = (2.5 + 3.5 * hash(i, 9)) * k;
    c.stroke(smoothPath(sub(line, a0, a1, 6), false, 0.5));
  }
  c.restore();
}

/** Líneas de oleaje en la loma (siguen la pendiente y la funden con el mar de atrás). */
function backLines(c, t, G, C, k) {
  const { Hc } = G;
  const bk = G.back.slice(0, 12);
  c.save();
  c.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const inset = -(0.03 + i * 0.032 + hash(i, 51) * 0.012) * Hc;
    const line = offsetPts(bk, inset);
    const ph = (t * (0.25 + 0.1 * hash(i, 52)) + hash(i, 53)) % 1;
    const a0 = 0.08 + 0.55 * ph, a1 = Math.min(0.95, a0 + 0.2 + 0.15 * hash(i, 54));
    const env = Math.sin(Math.PI * ph);
    c.strokeStyle = ca(i % 2 ? C.face1 : C.drop, 0.3 * env);
    c.lineWidth = (2 + 2.5 * hash(i, 55)) * k;
    c.stroke(smoothPath(sub(line, a0, a1, 6), false, 0.5));
  }
  c.restore();
}

// Banda BLANDA sin filtros (el blur de Skia costaba ~13 ms por cuadro): la misma banda apilada varias veces, cada
// vez más ancha y con poco alfa → borde que se desvanece en ~8 px, sin borde duro de ningún lado.
function softBand(c, line, th, steps, alpha, style) {
  c.fillStyle = style;
  for (let i = 0; i < steps; i++) {
    const f = (i + 1) / steps;
    const inner = offsetPts(line, (s) => -th(s) * 0.18 * (1 - f));      // un poco hacia el otro lado
    const outer = offsetPts(line, (s) => th(s) * (0.45 + 0.85 * f));
    const P = smoothPath(inner, false, 0.5);
    smoothPath(outer.slice().reverse(), false, 0.5, P);
    P.closePath();
    c.globalAlpha = alpha;
    c.fill(P);
  }
  c.globalAlpha = 1;
}

/** Penumbra teal de la garganta: sigue la panza (punta → garganta) y baja por lo alto de la cara. */
function throatShade(c, t, G, C, k) {
  const { Hc } = G;
  // panza al revés (garganta → punta) no: la línea va de la punta a la garganta y sigue por la cara
  const line = [...G.belly, ...G.face.slice(1, 6)];
  const nb = G.belly.length - 1, n = line.length - 1;
  // del lado del cuerpo: para la panza (va hacia atrás/arriba) la normal + apunta adentro del labio;
  // en la cara (va hacia abajo) apunta adentro del cuerpo
  const th = (s) => {
    const q = s * n;
    const w = q < nb ? 0.01 + 0.026 * Math.pow(q / nb, 0.9) : 0.036 * (1 - 0.85 * (q - nb) / (n - nb));
    return Hc * w;
  };
  const [gx, gy] = G.face[0];
  c.save();
  softBand(c, line, th, 9, 0.16, rad(c, gx, gy, 0.36 * Hc, [[0, C.throat], [0.35, ca(C.throat, 0.9)], [0.7, ca(C.wall, 0.6)], [1, ca(C.wall, 0)]]));
  c.restore();
}

function faceLace(c, t, p, G, C, k, amt) {
  if (amt <= 0.01) return;
  const { Hc } = G;
  const fc = G.face; // garganta → pie; + = hacia adentro del cuerpo
  for (let i = 0; i < 3; i++) {
    const inset = (0.05 + 0.055 * i + hash(i, 61) * 0.025) * Hc;
    const line = offsetPts(fc, inset);
    const sp = 0.35 + hash(i, 62) * 0.2;
    const ph = (t * sp + hash(i, 63)) % 1;
    const s1 = 0.95 - ph * 0.5, s0 = s1 - 0.2 - hash(i, 64) * 0.1;
    const env = Math.sin(Math.PI * ph);
    if (env < 0.2) continue;
    drawFoamLace(c, t, sub(line, Math.max(0.25, s0), s1, 6), {
      width: (0.03 + 0.01 * hash(i, 65)) * Hc * amt, seed: 40 + i, holes: 0.6, rag: 0.5, alpha: 0.7 * env, grain: 0.6,
      light: LIGHT, preset: PRESET, color: C.foam, shade: C.foamShade, deep: C.face2, density: 1.25, taper: [0.35, 0.35], shadow: 0.6,
    });
  }
}

function lipBody(c, t, G, C, k) {
  const { Hc, toC } = G;
  // región del labio: lomo (cresta → nariz) + punta + panza (punta → garganta); se cierra por adentro del cuerpo
  // y se funde con él hacia la raíz (sin raíz dura)
  const reg = smoothPath([...G.lomo, G.curl, ...G.belly], false, 0.5);
  const lt = (u, v) => { const q = toC([u, v]); reg.lineTo(q[0], q[1]); };
  lt(-0.07, 0.34); lt(0.06, 0.3); lt(0.5, 0.12); lt(0.5, -0.3); lt(-0.06, -0.3);
  reg.closePath();
  c.save();
  c.clip(reg);
  // cara del labio (ocean400), que se funde hacia la raíz
  c.fillStyle = lin(c, toC([-0.3, 0])[0], 0, toC([-0.06, 0])[0], 0, [[0, C.lipFace], [0.55, ca(C.lipFace, 0.7)], [1, ca(C.lipFace, 0)]]);
  c.fillRect(toC([-0.7, 0])[0], G.Y0 - 0.3 * Hc, 1.2 * Hc, 0.9 * Hc);
  // panza oscura: banda sobre la panza (de la punta a la garganta), que se oscurece hacia la garganta
  const bl = G.belly, nb = bl.length - 1;
  softBand(c, bl, (s) => Hc * (0.016 + 0.022 * Math.sin(Math.PI * Math.min(1, 0.15 + s * 1.1))) * (1 - smoothstep(0.72, 1, s)), 4, 0.34,
    lin(c, bl[0][0], bl[0][1], bl[nb][0], bl[nb][1], [[0, C.lipFace], [0.3, C.lipBelly], [1, C.throat]]));
  // lomo a contraluz (aqua200): banda bajo el borde de arriba; se afina en la cresta y hacia la punta
  const lomoTip = [...G.lomo, G.curl];
  c.fillStyle = lin(c, 0, G.Y0, 0, G.Y0 + 0.16 * Hc, [[0, C.drop], [0.3, C.lipBack], [1, C.lipBack]]);
  c.fill(bandPath(lomoTip, (s) => Hc * (0.055 * smoothstep(0, 0.3, s) - 0.035 * smoothstep(0.55, 1, s))));
  // luz que atraviesa el labio (contraluz) en el codo, donde el labio empieza a caer
  c.globalCompositeOperation = 'screen';
  const [ex, ey] = toC([-0.33, 0.16]);
  c.fillStyle = rad(c, ex, ey, 0.16 * Hc, [[0, ca(C.glow, 0.42)], [1, ca(C.glow, 0)]]);
  c.fillRect(ex - 0.16 * Hc, ey - 0.16 * Hc, 0.32 * Hc, 0.32 * Hc);
  c.restore();
}

// ------------------------------------------------------------------ espuma, spray, brillo
function frontFoam(ctx, t, p, G, C, k, amt) {
  const { Hc } = G;
  // brillo del borde de la cara (superficie del agua que mira al hueco): glow ancho + filo fino
  const edge = smoothPath(sub(G.face, 0.06, 0.92, 12), false, 0.5);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = ca(C.glow, 0.22);
  ctx.lineWidth = 14 * k;
  ctx.stroke(edge);
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = ca(C.edge, 0.55);
  ctx.lineWidth = 3 * k;
  ctx.stroke(edge);
  ctx.restore();
  if (amt <= 0.01) return;
  // espuma que trepa por el pie de la cara (encaje angosto sobre el borde)
  drawFoamLace(ctx, t, sub(G.face, 0.62, 1, 8), {
    width: 34 * k * amt, seed: 3, holes: 0.45, rag: 0.8, flow: 70, taper: [0.5, 0.02], grain: 0.8,
    light: LIGHT, color: C.foam, shade: C.foamShade, deep: C.foamDeep, density: 1.15, holeColor: C.face1,
  });
  // espuma batida en la base: encaje fino en dos filas (atrás más ancha); los agujeros muestran agua
  // (la espuma se abre hacia adelante a medida que el labio se lanza: mismo estiramiento que el labio)
  const thr = G.prof.thr;
  const S = ([u, v]) => G.toC([u < TU ? TU + (u - TU) * thr : u, v]);
  const rows = [
    { pts: [[-0.54, 1.02], [-0.47, 0.99], [-0.41, 0.965], [-0.34, 0.95], [-0.25, 0.96], [-0.13, 0.99], [0.0, 1.02], [0.14, 1.04]], w: 0.13, seed: 11, flow: 150, grain: 0.7, col: C.foamShade },
    { pts: [[-0.52, 1.065], [-0.44, 1.02], [-0.36, 0.995], [-0.27, 0.99], [-0.16, 1.01], [-0.03, 1.045]], w: 0.12, seed: 17, flow: 90, grain: 0.62, col: C.foam },
  ];
  for (const r of rows) {
    drawFoamLace(ctx, t, r.pts.map(S), {
      width: r.w * Hc * amt, seed: r.seed, holes: 0.6, rag: 1, flow: r.flow, taper: [0.22, 0.3], grain: r.grain,
      light: LIGHT, color: r.col, shade: C.foamShade, deep: C.face2, density: 1.15, holeColor: C.face1,
    });
  }
}

function lipFoam(ctx, t, p, G, C, k, amt) {
  const { Hc } = G;
  const lomoTip = [...G.lomo, G.curl, G.T];
  // filo brillante del lomo hacia la punta (glow ancho + filo fino)
  const edge = smoothPath(sub(lomoTip, 0.2, 1, 14), false, 0.5);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = ca(C.glow, 0.35);
  ctx.lineWidth = 18 * k;
  ctx.stroke(edge);
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = ca(C.edge, 0.95);
  ctx.lineWidth = 5 * k;
  ctx.stroke(edge);
  ctx.restore();
  // cortina de spray: la punta sigue cayendo en hilos traslúcidos hacia el pie (no cierra el tubo)
  curtainSpray(ctx, t, p, G, C, k);
  if (amt <= 0.01) return;
  // espuma de la punta: encaje sobre la nariz y la punta (rompe)
  drawFoamLace(ctx, t, sub(lomoTip, 0.6, 1, 9), {
    width: 36 * k * amt, seed: 5, holes: 0.4, rag: 1.2, flow: -60, taper: [0.35, 0.08], grain: 0.8,
    light: LIGHT, color: C.foam, shade: C.foamShade, deep: C.foamDeep, density: 1.2, holeColor: C.lipBack,
  });
  // espuma que se DESPRENDE de la punta: manchas que se sueltan, vuelan adelante y caen girando y achicándose
  const body = new Path2D();
  const [tx, ty] = G.T, [nx, ny] = G.nose;
  for (let i = 0; i < 9; i++) {
    const ph = (t * (1.1 + 0.5 * hash(i, 75)) + hash(i, 76)) % 1;
    const ox = lerp(tx, nx, hash(i, 77)), oy = lerp(ty, ny, hash(i, 77));
    const vx = -(0.1 + 0.12 * hash(i, 78)) * Hc, vy = (0.02 + 0.06 * hash(i, 79)) * Hc;
    const x = ox + vx * ph, y = oy + vy * ph + 0.42 * Hc * ph * ph;
    const r = (0.008 + 0.01 * hash(i, 80)) * Hc * amt * (1 - 0.6 * ph);
    if (r < 1) continue;
    blobInto(body, x, y, r, 500 + i, t, 0.3, 1 + 0.6 * ph, 1 - 0.2 * ph);
  }
  // hilos que cuelgan de la punta: manchas en fila que caen, se estiran y se balancean (un solo trazado)
  for (let i = 0; i < 4; i++) {
    const s = i / 3;
    const bx = lerp(tx, G.curl[0], s * 0.8) - i * 0.006 * Hc;
    const by = lerp(ty, G.curl[1], s * 0.8);
    const len = (0.05 + 0.06 * hash(i, 72)) * Hc * (0.7 + 0.5 * p) * (1 + 0.15 * Math.sin(t * 7 + i * 2));
    const sw = Math.sin(t * 5 + i * 1.7) * 0.01 * Hc;
    const r0 = (0.01 + 0.006 * hash(i, 73)) * Hc * amt;
    const nbl = 4;
    for (let j = 0; j < nbl; j++) {
      const f = j / (nbl - 1);
      blobInto(body, bx - (0.012 * Hc - sw) * f, by + len * f, r0 * (1 - 0.55 * f), 300 + i * 7 + j, t);
    }
  }
  ctx.save();
  ctx.translate(-LIGHT[0] * 3 * k, -LIGHT[1] * 3 * k);
  ctx.fillStyle = ca(C.foamDeep, 0.35);
  ctx.fill(body);
  ctx.restore();
  ctx.fillStyle = C.foamShade;
  ctx.fill(body);
  ctx.save();
  ctx.translate(LIGHT[0] * 2.5 * k, LIGHT[1] * 2.5 * k);
  ctx.fillStyle = C.foam;
  ctx.fill(body);
  ctx.restore();
}

/** Hilos traslúcidos que siguen cayendo desde la punta hacia el pie, por delante del hueco (sin cerrarlo). */
function curtainSpray(ctx, t, p, G, C, k) {
  const { Hc, toC } = G;
  const [tx, ty] = G.T;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    // parábola desde la punta: sale hacia adelante y abajo
    const off = (i - 1.5) * 0.018 * Hc;
    const pts = [];
    for (let j = 0; j <= 6; j++) {
      const f = j / 6;
      pts.push([tx + off * 0.5 - (0.03 + 0.012 * i) * Hc * f - 0.01 * Hc * Math.sin(t * 4 + i) * f, ty + 0.012 * Hc + (0.2 + 0.05 * hash(i, 41)) * Hc * f]);
    }
    const g = lin(ctx, tx, ty, tx, ty + 0.25 * Hc, [[0, ca(C.lipBack, 0.55)], [0.5, ca(C.foam, 0.2)], [1, ca(C.foam, 0)]]);
    ctx.strokeStyle = g;
    ctx.lineWidth = (7 - i) * k;
    ctx.stroke(smoothPath(pts, false, 0.5));
    // gotitas que corren por el hilo
    const ph = (t * (2 + 0.6 * i) + hash(i, 42)) % 1;
    const q = sub(pts, ph * 0.9, ph * 0.9 + 0.05, 1)[0];
    ctx.fillStyle = ca(C.foam, 0.7 * (1 - ph));
    ctx.beginPath();
    ctx.arc(q[0], q[1], (3 + 1.5 * hash(i, 43)) * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  void toC; void p;
}

function mist(ctx, t, p, G, C, k) {
  const { Hc } = G;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // bruma de la base (adelante del pie)
  const bx = G.B[0] - 0.08 * Hc, by = G.B[1] + 0.07 * Hc;
  ctx.fillStyle = rad(ctx, bx, by, 0.22 * Hc, [[0, ca('#ffffff', 0.3)], [1, ca('#ffffff', 0)]]);
  ctx.fillRect(bx - 0.22 * Hc, by - 0.22 * Hc, 0.44 * Hc, 0.44 * Hc);
  // bruma de spray dentro del tubo (respira)
  const [hx, hy] = G.hollow;
  const hr = 0.17 * Hc * (1 + 0.06 * Math.sin(t * 6));
  ctx.fillStyle = rad(ctx, hx - 0.02 * Hc, hy + 0.1 * Hc, hr, [[0, ca(C.glow, 0.16)], [1, ca(C.glow, 0)]]);
  ctx.fillRect(hx - 0.02 * Hc - hr, hy + 0.1 * Hc - hr, hr * 2, hr * 2);
  // bruma de la punta
  const tx = G.T[0] - 0.02 * Hc, ty = G.T[1] + 0.02 * Hc;
  ctx.fillStyle = rad(ctx, tx, ty, 0.11 * Hc, [[0, ca('#ffffff', 0.22)], [1, ca('#ffffff', 0)]]);
  ctx.fillRect(tx - 0.11 * Hc, ty - 0.11 * Hc, 0.22 * Hc, 0.22 * Hc);
  ctx.restore();
  // velo de spray sobre la cresta: tapa la costura de la máscara arriba de la cresta; lo arrastra el viento
  const [cx, cy] = G.crest;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 3; i++) {
    const q = ((t * 1.8 + i / 3) % 1);
    const x = cx + (0.012 + 0.07 * q) * Hc, y = cy - (0.012 + 0.04 * q) * Hc;
    const r = (0.022 + 0.04 * q) * Hc;
    const a = 0.5 * Math.sin(Math.PI * Math.min(1, q * 1.2 + 0.12));
    ctx.fillStyle = rad(ctx, x, y, r, [[0, ca('#ffffff', a)], [0.5, ca('#ffffff', a * 0.4)], [1, ca('#ffffff', 0)]]);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
  // penacho: columna de spray que el viento levanta de la cresta hasta el borde del cuadro (cubre la costura)
  ctx.save();
  ctx.translate(cx + 0.022 * Hc, cy * 0.45);
  ctx.scale(1, Math.max(1, cy / (0.05 * Hc)));
  const pr = 0.05 * Hc;
  ctx.fillStyle = rad(ctx, 0, 0, pr, [[0, ca(C.foam, 0.6)], [0.5, ca(C.foam, 0.28)], [1, ca(C.foam, 0)]]);
  ctx.fillRect(-pr, -pr, pr * 2, pr * 2);
  ctx.restore();
  // núcleo del velo justo sobre la costura (espuma clara, no bruma gris)
  ctx.save();
  ctx.fillStyle = rad(ctx, cx + 0.016 * Hc, cy - 0.02 * Hc, 0.034 * Hc, [[0, ca(C.foam, 0.85)], [0.55, ca(C.foam, 0.35)], [1, ca(C.foam, 0)]]);
  ctx.fillRect(cx - 0.03 * Hc, cy - 0.06 * Hc, 0.09 * Hc, 0.09 * Hc);
  ctx.restore();
}

function sprays(ctx, t, p, G, C, k, amt) {
  if (amt <= 0.01) return;
  const { Hc } = G;
  const ramp = smoothstep(0.02, 0.1, p);
  // spray que se desprende de la punta hacia adelante y abajo
  bursts(t, 3.2, 3, (q, sd) => {
    drawSpray(ctx, t, G.nose[0] + 0.005 * Hc, G.nose[1] + 0.01 * Hc, 2.35 + 0.3 * hash(sd, 2), q, {
      count: Math.round(34 * amt), speed: 0.5 * Hc, gravity: 1.1 * Hc, size: 3.4 * k, seed: sd, spread: 0.9,
      mist: 0.35, big: 0.18, light: LIGHT, alpha: ramp, preset: PRESET, color: C.foam,
    });
  });
  // spindrift: la cresta suelta spray hacia atrás y arriba
  bursts(t, 2.6, 3, (q, sd) => {
    drawSpray(ctx, t, G.crest[0] - 0.02 * Hc, G.crest[1] + 0.005 * Hc, -1.15 + 0.3 * (hash(sd, 3) - 0.5), q, {
      count: Math.round(26 * amt), speed: 0.32 * Hc, gravity: 0.25 * Hc, size: 2.6 * k, seed: sd + 5, spread: 0.7,
      mist: 0.55, big: 0.06, light: LIGHT, alpha: ramp, preset: PRESET, color: C.foam,
    });
  });
  // spray de la base hacia adelante y arriba
  bursts(t, 2.8, 3, (q, sd) => {
    drawSpray(ctx, t, G.B[0] - 0.03 * Hc, G.B[1] + 0.05 * Hc, -2.55 + 0.3 * (hash(sd, 4) - 0.5), q, {
      count: Math.round(30 * amt), speed: 0.4 * Hc, gravity: 0.9 * Hc, size: 3.6 * k, seed: sd + 9, spread: 0.8,
      mist: 0.5, big: 0.2, light: LIGHT, alpha: ramp, preset: PRESET, color: C.foam,
    });
  });
  // gotas grandes que caen de la punta al hueco
  for (let i = 0; i < 7; i++) {
    const ph = (t * (1.4 + hash(i, 91) * 0.8) + hash(i, 92)) % 1;
    const x = G.T[0] - (0.0 + 0.06 * hash(i, 93)) * Hc - ph * 0.07 * Hc;
    const y = G.T[1] + ph * ph * 0.42 * Hc;
    const r = (5 + 5 * hash(i, 94)) * k * (1 - 0.3 * ph);
    drawDrop(ctx, x, y, r, -0.07 * Hc, 0.84 * Hc * ph, { C, light: LIGHT, alpha: ramp * Math.min(1, (1 - ph) * 4) });
  }
}

function glints(ctx, t, p, G, C, k) {
  const pts = sub([...G.lomo, G.nose], 0.1, 1, 10);
  for (let i = 0; i < pts.length; i++) {
    const tw = Math.sin(t * (8 + hash(i, 81) * 6) + i * 2.1);
    if (tw < 0.5) continue;
    const [x, y] = pts[i];
    sparkle(ctx, x, y - 6 * k, (10 + 14 * hash(i, 82)) * k * (tw - 0.45) * 1.8, { color: C.spark, alpha: 0.9, rot: 0.3 });
  }
  const fc = sub(G.face, 0.2, 0.8, 4);
  for (let i = 0; i < fc.length; i++) {
    const tw = Math.sin(t * (6 + i) + i * 1.7);
    if (tw < 0.4) continue;
    sparkle(ctx, fc[i][0] + 14 * k, fc[i][1], 12 * k * tw, { color: C.spark, alpha: 0.6 });
  }
}
