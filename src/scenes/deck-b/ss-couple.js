// La pareja en la baranda, a contraluz y de perfil: ella a la izquierda (capelina que sujeta con una mano, mechones
// cortos y ondulados que flamean y vestido largo que flamea hacia atrás), él a la derecha (camisa de lino y chinos).
// Los dos a CONTRALUZ: base navy800/ink, sombra ink, filo dorado en los bordes que dan al sol y un rebote coral
// mínimo (≤ 15 %) al frente. Brindan en exp.cheers:
// anticipan bajando las copas, las suben y chocan delante de la mitad de abajo del sol, rebotan y se quedan
// arriba; después se inclinan uno hacia el otro. Se diseñan a escala 1 con los pies en y = 930 y se dibujan
// agrandados con los pies en FOOT_Y. Coordenadas del plano de la pareja (z = 1).
import { PAL, rgba, mixHex, rgb } from '../../engine/color.js';
import { E, clamp, lerp, smoothstep, TAU } from '../../engine/ease.js';
import { lin, sparkle } from '../../engine/draw.js';
import { addSmooth, addEllipse, ik2, place, silhouette } from './ss-geom.js';
import { drawCoupe } from './ss-coupe.js';
import { T_CHEERS } from './ss-time.js';

export const WOMAN = { x: 872, y: 930 };
export const MAN = { x: 1052, y: 930 };
export const CLINK = { x: 960, y: 628 };
export const SCALE = 1.35, FOOT_Y = 985;
/** Diseño → plano (para sombras y destellos). */
export const toPlane = (x, y) => [960 + (x - 960) * SCALE, FOOT_Y + (y - 930) * SCALE];

const C0 = {
  body: mixHex(PAL.navy800, PAL.ink, 0.3),
  shirt: mixHex(mixHex(PAL.navy800, PAL.ink, 0.36), PAL.dusk, 0.04),
  shade: PAL.ink,
  far: mixHex(PAL.ink, PAL.navy900, 0.4),
  rim: PAL.goldLight,
  hot: PAL.goldPale,
  dress: mixHex(PAL.navy800, PAL.dusk, 0.28),
  dressDeep: mixHex(PAL.ink, PAL.dusk, 0.1),
  dressLit: mixHex(PAL.dusk, PAL.coral, 0.45),
  straw: mixHex(mixHex(PAL.navy800, PAL.dusk, 0.3), PAL.coral, 0.12),
  hair: mixHex(PAL.ink, PAL.navy900, 0.6),
};
let C = C0;
/** En la entrada (11,25–11,6), cuerpo y camisa un 18 % más hacia ink: se separan del cielo todavía encendido. */
function palette(t) {
  const dk = 0.18 * (1 - smoothstep(11.42, 11.62, t));
  if (dk <= 0.001) return C0;
  return { ...C0, body: mixHex(C0.body, PAL.ink, dk), shirt: mixHex(C0.shirt, PAL.ink, dk), dress: mixHex(C0.dress, PAL.ink, dk), straw: mixHex(C0.straw, PAL.ink, dk) };
}
/** 'rgba(r,g,b,A)': plantilla para el degradé de volumen de silhouette(). */
const tpl = (hex) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},A)`; };
const GLOW = tpl(PAL.coral);

// cabezas de perfil (radio 1, mirando a +x)
const HEAD_F = [[0.05, -1.0], [0.55, -0.88], [0.86, -0.52], [0.95, -0.2], [0.93, -0.06], [1.14, 0.2], [1.0, 0.29], [1.04, 0.39], [0.97, 0.46], [1.01, 0.53], [0.89, 0.63], [0.9, 0.78], [0.72, 0.92], [0.4, 0.9], [0.38, 1.3], [0.32, 1.7], [-0.34, 1.72], [-0.4, 1.12], [-0.7, 0.66], [-0.98, 0.06], [-0.8, -0.62]];
const HEAD_M = [[0.05, -1.0], [0.6, -0.84], [0.9, -0.46], [1.0, -0.18], [0.97, -0.05], [1.2, 0.24], [1.02, 0.33], [1.06, 0.42], [0.99, 0.5], [1.03, 0.58], [0.93, 0.68], [0.98, 0.86], [0.78, 1.0], [0.42, 0.98], [0.44, 1.32], [0.42, 1.68], [-0.44, 1.7], [-0.48, 1.12], [-0.8, 0.7], [-1.04, 0.06], [-0.84, -0.62]];
const HAIR_M = [[-1.08, 0.12], [-1.0, -0.72], [-0.3, -1.2], [0.5, -1.12], [0.92, -0.7], [0.98, -0.48], [0.62, -0.68], [0.12, -0.86], [-0.44, -0.74], [-0.72, 0.22]];

// ------------------------------------------------------------------ tiempos del brindis
const TA = T_CHEERS - 0.3; // bajan las copas
const TR = T_CHEERS - 0.21; // suben y se acercan
const TW = T_CHEERS - 3 / 60; // anticipación de 3 cuadros: se separan apenas (carga)
const TS = T_CHEERS - 1 / 60; // y chocan de golpe
function raise(t) {
  if (t < TA) return 0;
  if (t < TR) return -0.14 * E.outCubic((t - TA) / (TR - TA));
  if (t < TW) return lerp(-0.14, 0.88, E.inOutSine((t - TR) / (TW - TR)));
  if (t < TS) return lerp(0.88, 0.72, E.outQuad((t - TW) / (TS - TW)));
  if (t < T_CHEERS) return lerp(0.72, 1, (t - TS) / (T_CHEERS - TS));
  return 1;
}
const recoil = (t) => (t < T_CHEERS ? 0 : 12 * Math.exp(-(t - T_CHEERS) / 0.1) * Math.sin((t - T_CHEERS) * TAU * 3.6) + 6 * smoothstep(T_CHEERS, T_CHEERS + 0.25, t));
/** Inclinación del torso hacia el otro: atrás en la anticipación, adelante después del brindis. */
const lean = (t) => {
  const r = raise(t);
  return (r < 0 ? r * 0.25 : 0) + 0.06 * smoothstep(T_CHEERS + 0.06, T_CHEERS + 0.4, t) + 0.006 * Math.sin(t * 2.1);
};
const tilt = (t) => {
  const wob = t < T_CHEERS ? 0 : 0.17 * Math.exp(-(t - T_CHEERS) / 0.15) * Math.sin((t - T_CHEERS) * TAU * 4.2);
  return 0.2 * clamp(raise(t)) + wob;
};

function handAt(t, who) {
  const rest = who === 1 ? [914, 716] : [1006, 712];
  // con la copa inclinada 0,2 rad el borde queda a ±24,8 px y 26,6 px arriba de la mano: se tocan en CLINK
  const hit = who === 1 ? [CLINK.x - 24.8, CLINK.y + 26.6] : [CLINK.x + 24.8, CLINK.y + 26.6];
  const r = raise(t);
  const lift = -5 * smoothstep(T_CHEERS + 0.05, T_CHEERS + 0.45, t) + Math.sin(t * 1.7 + who) * 1.2;
  if (r < 0) {
    const k = -r / 0.14;
    return [rest[0] - who * 5 * k, rest[1] + 12 * k];
  }
  return [lerp(rest[0], hit[0], r) - who * recoil(t), lerp(rest[1], hit[1], r) - 14 * Math.sin(Math.PI * r) + lift];
}

const rot = (px, py, [ox, oy], a) => {
  if (!a) return [px, py];
  const c = Math.cos(a), s = Math.sin(a), dx = px - ox, dy = py - oy;
  return [ox + dx * c - dy * s, oy + dx * s + dy * c];
};

/** Brazo como UNA forma suave: hombro → codo → muñeca con anchos (deltoides, codo, muñeca) y mano. */
function armShape(sx, sy, hx, hy, L1, L2, bend, w) {
  const [ex, ey] = ik2(sx, sy, hx, hy, L1, L2, bend);
  const chain = [[sx, sy], [(sx + ex) / 2, (sy + ey) / 2], [ex, ey], [(ex + hx) / 2, (ey + hy) / 2], [hx, hy]];
  const wid = [w * 1.15, w, w * 0.78, w * 0.74, w * 0.55];
  const L = [], R = [];
  for (let i = 0; i < chain.length; i++) {
    const a = chain[Math.max(0, i - 1)], b = chain[Math.min(chain.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    L.push([chain[i][0] - dy * wid[i], chain[i][1] + dx * wid[i]]);
    R.push([chain[i][0] + dy * wid[i], chain[i][1] - dx * wid[i]]);
  }
  const [dx, dy] = [hx - ex, hy - ey];
  const l = Math.hypot(dx, dy) || 1;
  const tip = [hx + (dx / l) * w * 1.1, hy + (dy / l) * w * 1.1];
  const p = new Path2D();
  addSmooth(p, [...L, tip, ...R.reverse(), [sx - (dx / l) * w * 0.4, sy - (dy / l) * w * 0.9]]);
  // mano que abraza el tallo: óvalo a lo largo del antebrazo y pulgar arriba
  const a = Math.atan2(dy, dx);
  addEllipse(p, hx - (dx / l) * w * 0.2, hy - (dy / l) * w * 0.2, w * 1.05, w * 0.62, a);
  addEllipse(p, hx + Math.cos(a - 1.2) * w * 0.55, hy + Math.sin(a - 1.2) * w * 0.55, w * 0.42, w * 0.26, a - 0.9);
  return p;
}

// ------------------------------------------------------------------ ella (mira a +x)
function woman(t) {
  const { x, y } = WOMAN;
  const L = lean(t) + 0.01 * Math.sin(t * 1.3);
  const pv = [8, -214];
  const up = (pts) => place(pts.map(([px, py]) => rot(px, py, pv, L)), x, y);
  const look = -0.08 * clamp(raise(t)) + L * 0.7;
  const wv = (k, a = 1) => a * Math.sin(t * 6.3 - k * 0.9);
  // torso (corpiño) y cuello
  const torso = new Path2D();
  addSmooth(torso, up([[2, -300], [-6, -286], [-9, -262], [-7, -236], [-4, -212], [22, -212], [26, -236], [36, -255], [34, -268], [25, -283], [20, -296], [22, -306]]));
  const hc = rot(14, -322, pv, L);
  addSmooth(torso, place(HEAD_F, x + hc[0], y + hc[1], 19, 1, look));
  // nuca: el pelo recogido bajo el ala (los mechones sueltos van aparte)
  addSmooth(torso, up([[-2, -336], [-14, -330], [-20, -318], [-16, -306], [-4, -304], [4, -318]]));
  // mechones cortos y ondulados que flamean hacia atrás (cada uno con su fase: el viento los recorre)
  const hair = new Path2D();
  const gust = 1 + 0.35 * Math.sin(t * 1.9) ;
  for (let k = 0; k < 4; k++) {
    const r0 = [-10 - 3 * k, -330 + 8 * k];
    const len = (30 + 9 * ((k + 1) % 2) - 2 * k) * (0.92 + 0.08 * gust);
    const Lp = [], Rp = [];
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const wav = (2.5 + 5 * u) * u * Math.sin(t * 8.2 - u * 3.4 - k * 1.4) * gust;
      const px = r0[0] - len * u, py = r0[1] + (6 + 3 * k) * u * u + wav;
      const wd = 5.2 * (1 - u) + 0.7;
      // normal aproximada (el mechón va hacia -x): arriba/abajo
      Lp.push([px, py - wd]);
      Rp.push([px, py + wd * 0.8]);
    }
    addSmooth(hair, up([...Lp, ...Rp.reverse()]), 0.45);
  }
  // falda larga: se pega adelante (viento de frente) y vuela atrás
  const skirt = new Path2D();
  const tail = (k) => [wv(k, 9) + 3 * Math.sin(t * 2.2 + k), wv(k + 1, 7)];
  const sk = [[-6, -216], [24, -216], [30, -186], [34, -130], [38, -70], [42, -18], [46, -4], [30, 0], [4, 0], [-24, -4]];
  const back = [[-60, -18], [-98, -40], [-118, -64], [-100, -78], [-72, -112], [-44, -160], [-16, -200]];
  addSmooth(skirt, place([...sk, ...back.map(([px, py], i) => [px + tail(i)[0] * (1 - i / 7), py + tail(i)[1] * (1 - i / 7)])], x, y));
  // capelina: copa y ala ancha flexible (la mano de atrás la sujeta)
  const hat = new Path2D();
  const ht = rot(16, -338, pv, L);
  const fl = 0.04 * Math.sin(t * 5.2) + look - 0.1;
  addSmooth(hat, place([[-20, 4], [-19, -12], [-8, -23], [10, -24], [22, -14], [25, 4]], x + ht[0], y + ht[1], 1, 1, fl));
  addSmooth(hat, place([[-54, 9 + 4 * Math.sin(t * 5.6)], [-34, -1], [0, -4], [40, -3], [62, 4 + 3 * Math.sin(t * 4.8 + 1)], [42, 7], [0, 7], [-34, 11]], x + ht[0], y + ht[1], 1, 1, fl));
  const sh = place([rot(13, -280, pv, L)], x, y)[0];
  const shFar = place([rot(0, -282, pv, L)], x, y)[0];
  const hatHand = place([[ht[0] - 34, ht[1] + 2]], x, y)[0];
  // mechones con luz dentro del pelo (siguen el viento)
  const strands = [0, 1].map((k) => up([[-12 - k * 3, -328 + k * 9], [-24 - k * 3, -325 + k * 10 + wv(1 + k, 2)], [-34 - k * 3, -320 + k * 11 + wv(2 + k, 3)]]));
  const ear = place([rot(8, -318, pv, L)], x, y)[0];
  return { torso, skirt, hat, hair, sh, shFar, hatHand, ear, strands };
}

// ------------------------------------------------------------------ él (se diseña mirando a +x y se espeja)
function man(t) {
  const { x, y } = MAN;
  const L = lean(t) * 0.8 + 0.008 * Math.sin(t * 1.1 + 2);
  const pv = [6, -180];
  const up = (pts) => place(pts.map(([px, py]) => rot(px, py, pv, L)), x, y, 1, -1);
  const look = -0.08 * clamp(raise(t)) + L * 0.6;
  const fl = 2.5 * Math.sin(t * 6.1);
  const shirt = new Path2D();
  addSmooth(shirt, up([[-4, -318], [-18, -305], [-24, -270], [-22, -232], [-27, -186 + fl], [6, -180], [31, -186 - fl * 0.5], [30, -214], [38, -248], [41, -276], [31, -302], [24, -320]]));
  const hc = rot(16, -342, pv, L);
  const head = new Path2D();
  addSmooth(head, place(HEAD_M, x - hc[0], y + hc[1], 21, -1, -look));
  const hair = new Path2D();
  addSmooth(hair, place(HAIR_M, x - hc[0], y + hc[1], 21, -1, -look));
  // chinos: dos piernas en paso (con el hueco entre las dos)
  const legs = new Path2D();
  addSmooth(legs, place([[-26, -188], [38, -188], [38, -150], [34, -96], [30, -40], [29, -13], [52, -5], [52, 1], [12, 1], [12, -12], [14, -44], [12, -92], [6, -122], [2, -92], [-4, -44], [-4, -14], [10, -5], [10, 1], [-30, 1], [-27, -12], [-25, -50], [-20, -96], [-23, -146]], x, y, 1, -1), 0.35);
  const sh = place([rot(10, -290, pv, L)], x, y, 1, -1)[0];
  const shFar = place([rot(-6, -292, pv, L)], x, y, 1, -1)[0];
  const ear = place([rot(10, -338, pv, L)], x, y, 1, -1)[0];
  return { shirt, head, hair, legs, sh, shFar, ear };
}

/** Dibuja la pareja; sunP = sol en el plano. Devuelve las manos de las copas (plano). */
export function drawCouple(ctx, t, sunP) {
  const sun = [960 + (sunP[0] - 960) / SCALE, 930 + (sunP[1] - FOOT_Y) / SCALE];
  const lightTo = (px, py) => { const dx = sun[0] - px, dy = sun[1] - py, l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  ctx.save();
  ctx.translate(960, FOOT_Y);
  ctx.scale(SCALE, SCALE);
  ctx.translate(-960, -930);
  C = palette(t);
  const w = woman(t), m = man(t);
  const lW = lightTo(WOMAN.x, 680), lM = lightTo(MAN.x, 680);
  const hW = handAt(t, 1), hM = handAt(t, -1);
  const glint = t >= T_CHEERS ? Math.exp(-(t - T_CHEERS) / 0.18) : 0;

  // ---- brazos de atrás (más oscuros): ella sujeta el ala de la capelina, él tiene la mano en el bolsillo
  const farW = armShape(w.shFar[0], w.shFar[1], w.hatHand[0], w.hatHand[1], 50, 48, -1, 4.6);
  silhouette(ctx, farW, lW, { base: C.far, shade: C.far, rim: rgba(C.rim, 0.85), rimW: 1.8, shadeW: 2 });
  const farM = armShape(m.shFar[0], m.shFar[1], MAN.x + 12, MAN.y - 186, 58, 54, 1, 6.2);
  silhouette(ctx, farM, lM, { base: C.far, shade: C.far, rim: rgba(C.rim, 0.75), rimW: 2, shadeW: 2 });

  // ---- ella: vestido translúcido (el sol lo atraviesa: se adivinan las piernas) con su canto encendido
  ctx.save();
  ctx.fillStyle = rgba(PAL.goldLight, 0.95);
  ctx.fill(w.skirt);
  ctx.clip(w.skirt);
  ctx.translate(-lW[0] * 2.2, -lW[1] * 2.2);
  // tela a contraluz: solo el canto que da al sol deja pasar la luz (coral tenue), el resto es navy/ink
  ctx.fillStyle = lin(ctx, WOMAN.x + 46, 0, WOMAN.x - 130, 0, [[0, C.dressLit], [0.1, C.dress], [0.55, C.dressDeep], [1, mixHex(C.dress, C.dressDeep, 0.5)]]);
  ctx.fill(w.skirt);
  ctx.clip(w.skirt);
  const lx = WOMAN.x;
  // pliegues que siguen el viento
  ctx.strokeStyle = rgba(C.dressLit, 0.2);
  ctx.lineWidth = 1.8;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(lx - 8 - k * 9, 735);
    ctx.quadraticCurveTo(lx - 30 - k * 22, 820, lx - 52 - k * 26 + 5 * Math.sin(t * 6 - k), 905);
    ctx.stroke();
  }
  ctx.restore();
  silhouette(ctx, w.torso, lW, { base: C.body, shade: C.shade, rim: C.rim, rimW: 2.4, shadeW: 6, glow: [WOMAN.x, 640, 60, GLOW, 0.12] });
  // mechones al viento con su filo de luz
  silhouette(ctx, w.hair, lW, { base: C.hair, shade: PAL.ink, rim: C.rim, rimW: 1.8, shadeW: 3 });
  ctx.strokeStyle = rgba(PAL.goldLight, 0.45);
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  for (const st of w.strands) {
    ctx.beginPath();
    st.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  }
  silhouette(ctx, w.hat, lW, { base: C.straw, shade: C.body, rim: C.rim, rimW: 2, shadeW: 3 });
  // cinta de la capelina y lazo del vestido
  ctx.save();
  ctx.clip(w.hat);
  ctx.fillStyle = rgba(PAL.coral, 0.75);
  const ht = place([[16 - 22, -338 - 6]], WOMAN.x, WOMAN.y)[0];
  ctx.fillRect(ht[0] - 4, ht[1] - 2, 54, 6);
  ctx.restore();
  // ---- él
  silhouette(ctx, m.legs, lM, { base: mixHex(C.body, PAL.ink, 0.25), shade: C.shade, rim: C.rim, rimW: 2.2, shadeW: 6 });
  silhouette(ctx, m.shirt, lM, { base: C.shirt, shade: C.shade, rim: C.rim, rimW: 2.6, shadeW: 7, glow: [MAN.x, 660, 64, GLOW, 0.12] });
  silhouette(ctx, m.head, lM, { base: C.body, shade: C.shade, rim: C.rim, rimW: 2.4, shadeW: 5 });
  // pelo: un tono más oscuro con su propio filo (se separa de la cara)
  silhouette(ctx, m.hair, lM, { base: mixHex(PAL.ink, PAL.navy900, 0.5), shade: PAL.ink, rim: C.rim, rimW: 2.2, shadeW: 4 });
  // cuello de la camisa y tapeta (detalle de lino a contraluz)
  ctx.save();
  ctx.clip(m.shirt);
  ctx.strokeStyle = rgba(PAL.goldLight, 0.22);
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const cx = MAN.x - 26, cy = MAN.y - 318;
  ctx.moveTo(cx, cy); ctx.lineTo(cx + 9, cy + 16); ctx.lineTo(cx + 2, cy + 24);
  ctx.moveTo(cx + 8, cy + 18); ctx.quadraticCurveTo(cx - 4, cy + 80, cx - 2, cy + 130);
  ctx.stroke();
  ctx.restore();
  // aro de ella y reloj de él (detalles para la segunda mirada)
  sparkle(ctx, w.ear[0] + 1, w.ear[1] + 9, 5 + 2 * Math.sin(t * 5), { color: PAL.goldPale, alpha: 0.9, halo: 0.8 });

  // ---- copas y brazos de adelante
  const aW = tilt(t), aM = -tilt(t);
  drawCoupe(ctx, t, hW[0], hW[1], aW, 1, glint);
  drawCoupe(ctx, t, hM[0], hM[1], aM, -1, glint);
  const armW = armShape(w.sh[0] - 3, w.sh[1] + 2, hW[0] - 1, hW[1] + 3, 58, 54, 1, 6);
  silhouette(ctx, armW, lW, { base: C.body, shade: C.shade, rim: C.rim, rimW: 2, shadeW: 4 });
  const armM = armShape(m.sh[0] + 3, m.sh[1] + 2, hM[0] + 1, hM[1] + 3, 64, 60, -1, 8);
  silhouette(ctx, armM, lM, { base: C.shirt, shade: C.shade, rim: C.rim, rimW: 2.2, shadeW: 5 });
  // puño de la camisa arremangada
  const [ex, ey] = ik2(m.sh[0], m.sh[1], hM[0] + 1, hM[1] + 3, 64, 60, -1);
  ctx.strokeStyle = rgba(C.rim, 0.5);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const cuff = [lerp(ex, hM[0], 0.18), lerp(ey, hM[1], 0.18)];
  const ang = Math.atan2(hM[1] - ey, hM[0] - ex) + Math.PI / 2;
  ctx.moveTo(cuff[0] - Math.cos(ang) * 7, cuff[1] - Math.sin(ang) * 7);
  ctx.lineTo(cuff[0] + Math.cos(ang) * 7, cuff[1] + Math.sin(ang) * 7);
  ctx.stroke();
  sparkle(ctx, lerp(ex, hM[0], 0.86), lerp(ey, hM[1], 0.86), 3.5 + 3 * glint, { color: PAL.goldPale, alpha: 0.8, halo: 0.5 });
  ctx.restore();
  return { hW: toPlane(hW[0], hW[1]), hM: toPlane(hM[0], hM[1]) };
}
