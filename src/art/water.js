// VOCABULARIO DE AGUA compartido (ART). La ola, el reventón del monitor (HOOK), el splash del tobogán (DECK-A)
// y cualquier gota de la pieza hablan el MISMO idioma:
//   · espuma = ENCAJE: manchas irregulares (fbm) con agujeros reales, sombra plana y sin contornos
//   · gota   = cuerpo + medialuna de sombra del lado opuesto a la luz + brillo + punto especular
//   · spray  = abanico direccional de gotitas estiradas por la velocidad + bruma suave
//   · splash = cráter → lámina en anillo (corona) con dedos que sueltan gotas → chorro central → anillos y
//              espuma que queda flotando
// Todo es función pura de (t, p): sin estado entre cuadros, sin Math.random. Paleta: waveColors(preset).
import { TAU, clamp, E, lerp, smoothstep } from '../engine/ease.js';
import { hash, noise1 } from '../engine/noise.js';
import { PAL, mixHex } from '../engine/color.js';
import { rad, sparkle } from '../engine/draw.js';
import { resolve, skyOf, seaOf } from './presets.js';
import { ca, unit } from './util.js';

// ------------------------------------------------------------------ paleta
const colCache = new Map();
const colWeak = new WeakMap();
/**
 * Paleta del agua (la de la ola) para la luz de un preset. La luz ambiente tiñe un poco (0 de día, ~0,3 al
 * atardecer). Campos:
 *  lipBack (lomo del labio a contraluz) · lipFace · lipBelly (panza oscura) · edge (filo brillante)
 *  face1 (aqua bajo el labio) · face2 (ocean500) · face3 (navy de la base; la ola v3 ya no lo usa) ·
 *  faceHi / faceLo (degradé teal de la cara cóncava de la ola v3, sin navy) · throat (garganta del tubo) ·
 *  wall (paredes del tubo) · back / backDeep (espalda: se funde con el mar del preset)
 *  foam · foamShade (sombra plana) · foamDeep · hole (fondo de los agujeros pintados) · drop · dropShade ·
 *  glow · rim · spark · light ([x,y] hacia la luz, en pantalla)
 */
export function waveColors(preset = 'golden') {
  const key = typeof preset === 'string' ? preset : null;
  const hit = key ? colCache.get(key) : colWeak.get(preset);
  if (hit) return hit;
  const R = resolve(preset);
  const S = R.sky, SEA = R.sea;
  const warm = S.light.rim;
  const w = Math.min(0.45, S.light.ambientA * 1.4);
  const C = {
    lipBack: mixHex(PAL.aqua200, S.light.key, w * 0.5),
    lipFace: mixHex(PAL.ocean400, SEA.mid, w * 0.5),
    lipBelly: mixHex(mixHex(PAL.ocean700, PAL.ocean600, 0.25), SEA.near, w),
    edge: mixHex('#ffffff', warm, 0.25),
    face1: mixHex(mixHex(PAL.aqua300, PAL.ocean400, 0.45), SEA.lit ?? SEA.mid, w * 0.6),
    face2: mixHex(PAL.ocean500, SEA.mid, w),
    face3: mixHex(mixHex(PAL.navy600, PAL.ocean700, 0.35), SEA.deep, w),
    // v3 (ola en barril): cara cóncava en degradé TEAL sin navy (faceHi arriba → faceLo en la base)
    faceHi: mixHex(mixHex(PAL.aqua300, PAL.ocean400, 0.35), SEA.lit ?? SEA.mid, w * 0.45),
    faceLo: mixHex(mixHex(PAL.ocean600, PAL.ocean500, 0.3), SEA.mid, w * 0.4),
    throat: mixHex(PAL.ocean700, SEA.near, w * 0.8),
    wall: mixHex(PAL.ocean500, SEA.mid, w * 0.7),
    back: mixHex(mixHex(PAL.ocean600, SEA.mid, 0.5), SEA.mid, w),
    backDeep: mixHex(SEA.near, SEA.deep, 0.35),
    foam: mixHex(PAL.foam, SEA.foam ?? PAL.foam, 0.22),
    foamShade: mixHex(mixHex(PAL.aqua100, PAL.aqua200, 0.55), S.light.shade, w * 0.6),
    foamDeep: mixHex(mixHex(PAL.aqua200, PAL.ocean400, 0.35), S.light.shade, w * 0.6),
    hole: mixHex(PAL.ocean400, SEA.mid, w),
    drop: mixHex(PAL.aqua100, S.light.key, w * 0.4),
    dropShade: mixHex(mixHex(PAL.aqua300, PAL.ocean400, 0.5), SEA.mid, w * 0.6),
    glow: mixHex(PAL.aqua100, warm, 0.25),
    rim: mixHex('#ffffff', warm, 0.35),
    spark: mixHex('#ffffff', warm, 0.3),
    light: unit(S.light.dir),
  };
  if (key) colCache.set(key, C); else colWeak.set(preset, C);
  return C;
}

// ------------------------------------------------------------------ formas
/** Agrega a P una mancha irregular cerrada (radio r, 9 vértices con fbm) con SU PROPIO moveTo. */
export function blobInto(P, x, y, r, seed, t = 0, wob = 0.26, sx = 1, sy = 1) {
  const n = 9;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash(seed, 1) * 0.7;
    const k = 1 + wob * (2 * hash(seed, i + 3) - 1) + 0.08 * Math.sin(t * (2.2 + hash(seed, 2) * 2) + i * 1.7 + seed);
    pts.push([x + Math.cos(a) * r * k * sx, y + Math.sin(a) * r * k * sy]);
  }
  // Catmull-Rom cerrado → Bézier
  const q = 0.5 / 3;
  P.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    P.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * q, p1[1] + (p2[1] - p0[1]) * q, p2[0] - (p3[0] - p1[0]) * q, p2[1] - (p3[1] - p1[1]) * q, p2[0], p2[1]);
  }
  P.closePath();
  return P;
}

/** Puntos repartidos por largo a lo largo de una polilínea, con normal (izquierda del avance) y largo total. */
export function alongPath(pts, n, closed = false) {
  const P = closed ? [...pts, pts[0]] : pts;
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const tot = L[L.length - 1] || 1;
  const out = [];
  let j = 1;
  for (let q = 0; q < n; q++) {
    const s = closed ? q / n : q / Math.max(1, n - 1);
    const d = s * tot;
    while (j < P.length - 1 && L[j] < d) j++;
    const a = P[j - 1], b = P[j];
    const f = (d - L[j - 1]) / (L[j] - L[j - 1] || 1);
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    out.push({ x: a[0] + dx * f, y: a[1] + dy * f, tx: dx / l, ty: dy / l, nx: dy / l, ny: -dx / l, s, d });
  }
  out.length && (out.total = tot);
  return out;
}

/** Punto a una distancia d sobre la polilínea (con tangente y normal). */
function pointAt(P, L, d) {
  let j = 1;
  while (j < P.length - 1 && L[j] < d) j++;
  const a = P[j - 1], b = P[j];
  const f = (d - L[j - 1]) / (L[j] - L[j - 1] || 1);
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  return { x: a[0] + dx * f, y: a[1] + dy * f, nx: dy / l, ny: -dx / l };
}

// ------------------------------------------------------------------ encaje de espuma
/**
 * drawFoamLace(ctx, t, path, o): banda de espuma de ENCAJE a lo largo de una polilínea `path` ([[x,y]…]).
 *  Manchas irregulares que hierven y derivan, AGUJEROS reales (se ve lo de abajo), sombra plana desplazada
 *  hacia el lado opuesto a la luz, medialuna de sombra interna y jirones sueltos en el borde. Sin contornos.
 * o = {
 *   width 60      ancho de la banda (px)
 *   seed 1 · density 1 (manchas por ancho) · holes 0.55 (0..1) · rag 1 (jirones sueltos)
 *   side 0        corre la banda sobre la normal (-1..1; + = izquierda del sentido del trazo)
 *   taper [0.12, 0.12]  fundido de entrada/salida (fracción del largo)
 *   flow 0        deriva a lo largo del trazo (px/s) · boil 1 (cuánto respiran las manchas)
 *   closed false  polilínea cerrada (anillos de espuma)
 *   preset 'golden' · color · shade · deep · light [x,y] · alpha 1 · shadow 1 (0 apaga la sombra plana)
 *   grain 1       tamaño de las manchas (0,5 = espuma más fina y batida, con el doble de manchas)
 *   holeColor     si se pasa, los agujeros se PINTAN de ese color en vez de calar (espuma que cuelga sobre
 *                 otra cosa: el borde de la ola, la base adelante del frente)
 * }
 */
export function drawFoamLace(ctx, t, path, o = {}) {
  if (!path || path.length < 2) return;
  const Wd = o.width ?? 60;
  if (Wd < 1) return;
  const C = waveColors(o.preset);
  const seed = o.seed ?? 1;
  const closed = !!o.closed;
  const P = closed ? [...path, path[0]] : path;
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const tot = L[L.length - 1];
  if (tot < 1) return;
  const grain = o.grain ?? 1;
  const step = (Wd * 0.38 * grain) / (o.density ?? 1);
  const n = Math.max(2, Math.ceil(tot / step) + (closed ? 0 : 1));
  const [lx, ly] = o.light ? unit(o.light) : C.light;
  const holesAmt = o.holes ?? 0.55;
  const side = (o.side ?? 0) * Wd * 0.5;
  const [ta, tb] = o.taper ?? [0.12, 0.12];
  const flow = (o.flow ?? 0) * t;
  const boil = o.boil ?? 1;
  const body = new Path2D(), holes = new Path2D(), rags = new Path2D(), holesOnly = new Path2D();
  const paintHoles = !!o.holeColor;
  holes.rect(-1e5, -1e5, 2e5, 2e5);
  let any = false;
  for (let i = 0; i < n; i++) {
    // posición a lo largo (con deriva) y envolvente de las puntas
    // la deriva da la vuelta (cerrada: sobre el largo; abierta: sobre n·step, y lo que cae afuera no se dibuja)
    const span = closed ? tot : n * step;
    let d = i * step + flow + (hash(i, seed, 1) - 0.5) * step * 0.6;
    d = ((d % span) + span) % span;
    if (!closed && d > tot) continue;
    const s = d / tot;
    const env = closed ? 1 : Math.min(1, ta > 0 ? s / ta : 1, tb > 0 ? (1 - s) / tb : 1);
    if (env <= 0.04) continue;
    const q = pointAt(P, L, d);
    const across = (hash(i, seed, 2) - 0.5) * Wd * 0.55 + side;
    const breathe = 1 + 0.12 * boil * Math.sin(t * (5 + hash(i, seed, 3) * 4) + i * 1.9);
    const r = Wd * (0.2 + 0.2 * hash(i, seed, 4)) * grain * Math.sqrt(env) * breathe;
    const x = q.x + q.nx * across, y = q.y + q.ny * across;
    blobInto(body, x, y, r, seed * 131 + i, t * boil);
    any = true;
    // mancha secundaria hacia el borde (borde dentado)
    if (hash(i, seed, 5) < 0.6) {
      const sgn = hash(i, seed, 6) < 0.5 ? -1 : 1;
      const a2 = across + sgn * Wd * (0.25 + 0.12 * hash(i, seed, 7)) * (0.6 + 0.4 * grain);
      blobInto(body, q.x + q.nx * a2, q.y + q.ny * a2, r * (0.42 + 0.2 * hash(i, seed, 8)), seed * 137 + i, t * boil);
    }
    // agujeros (encaje): adentro de la banda, nunca en las puntas
    if (hash(i, seed, 9) < holesAmt && env > 0.5) {
      const hr = r * (0.22 + 0.22 * hash(i, seed, 10));
      const ha = across + (hash(i, seed, 11) - 0.5) * r * 0.8;
      const hd = (hash(i, seed, 12) - 0.5) * step * 0.7;
      blobInto(paintHoles ? holesOnly : holes, q.x + q.nx * ha - q.ny * hd, q.y + q.ny * ha + q.nx * hd, hr, seed * 139 + i, t * boil * 0.5, 0.35, 1.25, 0.85);
    }
    // jirones sueltos afuera del borde
    if ((o.rag ?? 1) > 0 && hash(i, seed, 13) < 0.45 * (o.rag ?? 1)) {
      const sgn = hash(i, seed, 14) < 0.5 ? -1 : 1;
      const a3 = side + sgn * Wd * (0.55 + 0.3 * hash(i, seed, 15));
      blobInto(rags, q.x + q.nx * a3, q.y + q.ny * a3, Wd * (0.04 + 0.05 * hash(i, seed, 16)) * env, seed * 149 + i, t);
    }
  }
  if (!any) return;
  const off = Wd * 0.07;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (!paintHoles) ctx.clip(holes, 'evenodd');
  // 1) sombra plana (desplazada al lado opuesto a la luz)
  if ((o.shadow ?? 1) > 0) {
    ctx.save();
    ctx.translate(-lx * off, -ly * off + off * 0.4);
    ctx.fillStyle = ca(o.deep ?? C.foamDeep, 0.42 * (o.shadow ?? 1));
    ctx.fill(body);
    ctx.restore();
  }
  // 2) cuerpo con medialuna de sombra (volumen): el cuerpo en tono de sombra y encima el mismo cuerpo corrido
  //    hacia la luz en el tono claro → queda la medialuna del lado opuesto (sin recortes: es barato)
  ctx.fillStyle = o.shade ?? C.foamShade;
  ctx.fill(body);
  ctx.save();
  ctx.translate(lx * off * 1.3, ly * off * 1.3);
  ctx.fillStyle = o.color ?? C.foam;
  ctx.fill(body);
  ctx.restore();
  ctx.fillStyle = o.color ?? C.foam;
  ctx.fill(rags);
  if (paintHoles) {
    ctx.fillStyle = o.holeColor;
    ctx.fill(holesOnly);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ gotas
/** Una gota en (x, y) con radio r, estirada hacia (vx, vy) (px/s; 0 = redonda). Tres tonos + especular. */
export function drawDrop(ctx, x, y, r, vx = 0, vy = 0, o = {}) {
  if (r < 0.3) return;
  const C = o.C ?? waveColors(o.preset);
  const [lx, ly] = o.light ? unit(o.light) : C.light;
  const sp = Math.hypot(vx, vy);
  const st = Math.min(3.2, 1 + (sp / 900) * (o.stretch ?? 1));
  const ang = sp > 1 ? Math.atan2(vy, vx) : -Math.PI / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  // forma de lágrima: cabeza redonda adelante (+x), cola afinada atrás
  const tail = r * st * 1.15;
  const drop = new Path2D();
  drop.moveTo(r, 0);
  drop.bezierCurveTo(r, r * 0.62, r * 0.35, r, 0, r);
  drop.bezierCurveTo(-r * 0.6, r, -tail * 0.75, r * 0.38, -tail, 0);
  drop.bezierCurveTo(-tail * 0.75, -r * 0.38, -r * 0.6, -r, 0, -r);
  drop.bezierCurveTo(r * 0.35, -r, r, -r * 0.62, r, 0);
  drop.closePath();
  // luz en el marco rotado
  const ca_ = Math.cos(-ang), sa_ = Math.sin(-ang);
  const Lx = lx * ca_ - ly * sa_, Ly = lx * sa_ + ly * ca_;
  const a = o.alpha ?? 1;
  ctx.fillStyle = ca(o.shade ?? C.dropShade, a);
  ctx.fill(drop);
  ctx.save();
  ctx.clip(drop);
  ctx.translate(Lx * r * 0.32, Ly * r * 0.32);
  ctx.scale(0.86, 0.86);
  ctx.fillStyle = ca(o.color ?? C.drop, a);
  ctx.fill(drop);
  ctx.restore();
  if (r > 1.2) {
    ctx.fillStyle = ca('#ffffff', a * 0.95);
    ctx.beginPath();
    ctx.ellipse(Lx * r * 0.42, Ly * r * 0.42, r * 0.3, r * 0.18, Math.atan2(Ly, Lx) + Math.PI / 2, 0, TAU);
    ctx.fill();
    // reflejo tenue del lado de la sombra (gota de agua, no bolita)
    ctx.fillStyle = ca(C.glow, a * 0.5);
    ctx.beginPath();
    ctx.ellipse(-Lx * r * 0.5, -Ly * r * 0.5, r * 0.22, r * 0.1, Math.atan2(Ly, Lx) + Math.PI / 2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * drawDroplets(ctx, t, area, p, o): gotas que salen de `area` ({x,y,w,h}; w = h = 0 → un punto) y vuelan en
 *  parábola mientras p va 0 → 1. Cada gota: medialuna de sombra, cuerpo, brillo y especular; se estiran con la
 *  velocidad y se apagan al final de su vida.
 * o = { count 24, seed 3, angle -π/2 (dirección media de salida), spread 0.9 (rad), speed 900 (px por vida),
 *       gravity 1800 (px por vida²), size 7 (radio px), sizeVar 0.7, delay 0.25 (retraso máx. de salida),
 *       life 0.75 (fracción de p que vive cada gota), preset, color, shade, light, alpha, stretch 1 }
 */
export function drawDroplets(ctx, t, area, p, o = {}) {
  if (p <= 0) return;
  const C = waveColors(o.preset);
  const n = o.count ?? 24, seed = o.seed ?? 3;
  const ang0 = o.angle ?? -Math.PI / 2, spr = o.spread ?? 0.9;
  const V = o.speed ?? 900, G = o.gravity ?? 1800, S = o.size ?? 7, var_ = o.sizeVar ?? 0.7;
  const dl = o.delay ?? 0.25, life = o.life ?? 0.75;
  const oo = { C, light: o.light, color: o.color, shade: o.shade, stretch: o.stretch };
  for (let i = 0; i < n; i++) {
    const d0 = hash(i, seed, 1) * dl;
    const tau = (p - d0) / life;
    if (tau <= 0 || tau >= 1) continue;
    const a = ang0 + (hash(i, seed, 2) - 0.5) * spr;
    const v = V * (0.45 + 0.55 * hash(i, seed, 3));
    const ex = area.x + hash(i, seed, 4) * (area.w ?? 0), ey = area.y + hash(i, seed, 5) * (area.h ?? 0);
    const tt = tau * life;
    const x = ex + Math.cos(a) * v * tt, y = ey + Math.sin(a) * v * tt + 0.5 * G * tt * tt;
    const vx = Math.cos(a) * v, vy = Math.sin(a) * v + G * tt;
    const r = S * (1 - var_ + var_ * hash(i, seed, 6)) * (1 - 0.35 * tau);
    oo.alpha = (o.alpha ?? 1) * Math.min(1, (1 - tau) * 4) * Math.min(1, tau * 12);
    drawDrop(ctx, x, y, r, vx * 0.8, vy * 0.8, oo);
  }
}

// ------------------------------------------------------------------ spray direccional
/**
 * drawSpray(ctx, t, x, y, dir, p, o): abanico de spray que sale de (x, y) hacia `dir` (rad) mientras p 0 → 1.
 *  Gotitas finas estiradas (estrías), algunas gotas grandes con brillo y una bruma blanda que se abre.
 * o = { spread 0.55 · count 60 · speed 700 (px por vida) · gravity 900 · size 3.2 · seed 5 · mist 0.6 ·
 *       big 0.15 (fracción de gotas grandes) · preset · color · alpha · life 0.8 }
 */
export function drawSpray(ctx, t, x, y, dir, p, o = {}) {
  if (p <= 0 || p >= 1) return;
  const C = waveColors(o.preset);
  const n = o.count ?? 60, seed = o.seed ?? 5, spr = o.spread ?? 0.55;
  const V = o.speed ?? 700, G = o.gravity ?? 900, S = o.size ?? 3.2;
  const life = o.life ?? 0.8, A = o.alpha ?? 1;
  const col = o.color ?? C.foam;
  ctx.save();
  // bruma: bocanadas que se abren y se apagan
  const mist = o.mist ?? 0.6;
  if (mist > 0.01) {
    ctx.globalCompositeOperation = 'screen';
    for (let k = 0; k < 4; k++) {
      const q = clamp((p - k * 0.06) / 0.9);
      if (q <= 0 || q >= 1) continue;
      const dd = V * 0.55 * E.outCubic(q) * (0.45 + 0.25 * k);
      const a = dir + (hash(k, seed, 31) - 0.5) * spr * 0.6;
      const mx = x + Math.cos(a) * dd, my = y + Math.sin(a) * dd + G * 0.08 * q * q;
      const r = S * 12 * (0.6 + 1.6 * q) * (0.7 + 0.3 * hash(k, seed, 32));
      const al = mist * 0.32 * Math.sin(Math.PI * q) * A;
      ctx.fillStyle = rad(ctx, mx, my, r, [[0, ca(col, al)], [0.6, ca(col, al * 0.4)], [1, ca(col, 0)]]);
      ctx.fillRect(mx - r, my - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  const bigF = o.big ?? 0.15;
  const oo = { C, alpha: 1, light: o.light };
  for (let i = 0; i < n; i++) {
    const d0 = hash(i, seed, 1) * (1 - life);
    const tau = (p - d0) / life;
    if (tau <= 0 || tau >= 1) continue;
    const a = dir + (hash(i, seed, 2) - 0.5) * spr * (0.4 + 0.6 * hash(i, seed, 7));
    const v = V * (0.35 + 0.65 * hash(i, seed, 3));
    const tt = tau * life;
    const px = x + Math.cos(a) * v * tt, py = y + Math.sin(a) * v * tt + 0.5 * G * tt * tt;
    const vx = Math.cos(a) * v, vy = Math.sin(a) * v + G * tt;
    const al = A * Math.min(1, (1 - tau) * 3) * Math.min(1, tau * 10);
    if (hash(i, seed, 4) < bigF) {
      oo.alpha = al;
      drawDrop(ctx, px, py, S * (1.4 + 1.4 * hash(i, seed, 5)), vx, vy, oo);
      continue;
    }
    // gotita fina: estría a lo largo de la velocidad (afinada, sin contorno)
    const r = S * (0.4 + 0.6 * hash(i, seed, 6)) * (1 - 0.4 * tau);
    const sp = Math.hypot(vx, vy) || 1;
    const len = r * (1.5 + Math.min(5, sp / 260));
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(vy, vx));
    ctx.fillStyle = ca(col, al * 0.9);
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.quadraticCurveTo(0, r, -len, 0);
    ctx.quadraticCurveTo(0, -r, r, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ splash
/** Degradé vertical de un color con alfa a0 (abajo, y0) → a1 (arriba, y1). */
function lin2(ctx, y0, y1, col, a0, a1) {
  const g = ctx.createLinearGradient(0, y0, 0, Math.min(y1, y0 - 1));
  g.addColorStop(0, ca(col, a0));
  g.addColorStop(1, ca(col, a1));
  return g;
}
/** Elipse como polilínea (para encaje en anillo). */
function ellipsePts(x, y, rx, ry, n = 28, a0 = 0, a1 = TAU) {
  const out = [];
  const closed = Math.abs(a1 - a0 - TAU) < 1e-6;
  const m = closed ? n : n + 1;
  for (let i = 0; i < m; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]);
  }
  return out;
}

/**
 * drawSplash(ctx, t, x, y, p, o): salpicadura de impacto en (x, y) = punto de impacto sobre la superficie.
 *  p 0..1 = vida (arrancá en el impacto; ~0,9–1,4 s queda bien). Etapas:
 *   0–0,12 cráter oscuro y destello · 0,03–0,6 LÁMINA EN ANILLO (corona) que sube abriéndose, con dedos que
 *   sueltan gotas · 0,3–0,85 chorro central con gota en la punta · 2–3 anillos que se abren · espuma de encaje
 *   que queda flotando hasta el final.
 * o = { size 120 (radio de la corona en px; probado de 60 a 450), tilt 0.38 (achatamiento: 1 = cenital),
 *       seed 9, preset 'golden', drops 26, ring true, crown true, column true, foam true, flash true,
 *       color, shade }
 */
export function drawSplash(ctx, t, x, y, p, o = {}) {
  if (p <= 0 || p >= 1) return;
  const S = o.size ?? 120;
  const seed = o.seed ?? 9;
  const C = waveColors(o.preset);
  const col = o.color ?? C.foam;
  const shade = o.shade ?? C.foamShade;
  const flat = o.tilt ?? 0.38;
  const k = S / 120;
  ctx.save();
  // 1) anillos que se abren (cresta clara + valle oscuro debajo, finos y blandos)
  if (o.ring !== false) {
    for (let r = 0; r < 3; r++) {
      const q = clamp((p - 0.08 - r * 0.13) / 0.8);
      if (q <= 0 || q >= 1) continue;
      const R = S * (0.6 + 1.7 * E.outCubic(q));
      const a = (1 - q) * (0.75 - r * 0.15);
      const lw = Math.max(1, S * 0.05 * (1 - q * 0.6));
      ctx.lineWidth = lw;
      ctx.strokeStyle = ca(C.hole, a * 0.7);
      ctx.beginPath(); ctx.ellipse(x, y + lw * 0.6, R, R * flat, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = ca(col, a);
      ctx.lineWidth = lw * 0.7;
      ctx.beginPath(); ctx.ellipse(x, y - lw * 0.3, R, R * flat, 0, 0, TAU); ctx.stroke();
    }
  }
  // 2) cráter (los primeros cuadros)
  const cq = clamp(p / 0.22);
  if (cq < 1) {
    const cr = S * 0.5 * (0.6 + 0.6 * E.outCubic(cq));
    ctx.fillStyle = ca(C.lipBelly, 0.55 * (1 - cq));
    ctx.beginPath(); ctx.ellipse(x, y, cr, cr * flat, 0, 0, TAU); ctx.fill();
  }
  // 3) espuma que queda flotando (encaje en anillo + parche central que crece cuando cae la corona)
  if (o.foam !== false) {
    const fq = E.outCubic(clamp(p / 0.7));
    const fa = Math.min(1, (1 - p) * 5) * Math.min(1, p * 8);
    const Rf = S * (0.5 + 0.55 * fq);
    drawFoamLace(ctx, t, ellipsePts(x, y, Rf, Rf * flat, 26), { closed: true, width: S * 0.3 * (1 - 0.35 * p) * (0.35 + 0.65 * E.outCubic(clamp(p / 0.4))), seed: seed + 3, holes: 0.6, preset: o.preset, alpha: fa, light: o.light, flow: 0 });
    const cp = clamp((p - 0.4) / 0.3);
    if (cp > 0) {
      const Rc = S * 0.34 * E.outCubic(cp);
      drawFoamLace(ctx, t, ellipsePts(x, y, Rc * 0.55, Rc * 0.55 * flat, 10), { closed: true, width: Rc * 0.9, seed: seed + 7, holes: 0.5, preset: o.preset, alpha: fa, light: o.light, rag: 0.4 });
    }
  }
  // 4) LÁMINA EN ANILLO (corona): pared fina y translúcida que sube abriéndose como un tulipán, con el borde
  //    de encaje y dedos cortos que sueltan gotas. Orden: mitad de atrás → boca → chorro central → mitad de
  //    adelante → borde → dedos.
  const up = Math.pow(Math.sin(Math.PI * clamp((p - 0.02) / 0.62)), 0.75);
  const R0 = S * 0.4 * (1 + 0.6 * p);
  const R1 = R0 * (1.45 + 0.55 * p);
  const hgt = S * 0.78 * up;
  const yt = y - hgt;
  const crownOn = o.crown !== false && up > 0.01;
  const wall = (front) => {
    const P = new Path2D();
    const a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : TAU;
    const sx0 = front ? 1 : -1;
    P.moveTo(x + sx0 * R0, y);
    P.ellipse(x, y, R0, R0 * flat, 0, a0, a1);
    // flanco: curva cóncava hacia afuera (la lámina se abre)
    P.quadraticCurveTo(x - sx0 * R0 * 1.04, y - hgt * 0.62, x - sx0 * R1, yt);
    P.ellipse(x, yt, R1, R1 * flat, 0, a1, a0, true);
    P.quadraticCurveTo(x + sx0 * R0 * 1.04, y - hgt * 0.62, x + sx0 * R0, y);
    P.closePath();
    return P;
  };
  if (crownOn) {
    ctx.fillStyle = lin2(ctx, y, yt, C.dropShade, 0.7, 0.35);
    ctx.fill(wall(false));
    // boca: arriba se ve la cara interna de la pared de atrás (clara), abajo el hueco (oscuro)
    const mg = ctx.createLinearGradient(0, yt - R1 * flat, 0, yt + R1 * flat);
    mg.addColorStop(0, ca(C.face1, 0.85));
    mg.addColorStop(0.45, ca(C.hole, 0.85));
    mg.addColorStop(1, ca(C.face2, 0.9));
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.ellipse(x, yt, R1 * 0.97, R1 * flat * 0.92, 0, 0, TAU); ctx.fill();
  }
  // 5) chorro central (rebote), adentro de la corona
  if (o.column !== false) {
    const q = clamp((p - 0.3) / 0.55);
    const hc = Math.sin(Math.PI * q) * S * 1.3;
    if (hc > 2) {
      const w = S * 0.085 * (0.6 + 0.4 * Math.sin(Math.PI * q));
      const colP = new Path2D();
      colP.moveTo(x - w, y);
      colP.quadraticCurveTo(x - w * 0.2, y - hc * 0.55, x, y - hc);
      colP.quadraticCurveTo(x + w * 0.2, y - hc * 0.55, x + w, y);
      colP.closePath();
      ctx.fillStyle = ca(C.drop, 0.95);
      ctx.fill(colP);
      ctx.save();
      ctx.clip(colP);
      ctx.fillStyle = ca(C.dropShade, 0.85);
      const sd = C.light[0] >= 0 ? -1 : 1;
      ctx.fillRect(x + sd * w * 0.25, y - hc, sd * w * 1.2, hc);
      ctx.restore();
      const rr = w * 1.05 * clamp(hc / (S * 0.35));
      drawDrop(ctx, x, y - hc - rr * 0.6, rr, 0, -260 * Math.cos(Math.PI * q), { C, light: o.light });
    }
  }
  if (crownOn) {
    const front = wall(true);
    ctx.fillStyle = lin2(ctx, y, yt, C.drop, 0.78, 0.3);
    ctx.fill(front);
    ctx.save();
    ctx.clip(front);
    // sombra del lado opuesto a la luz y vetas que suben
    ctx.fillStyle = ca(C.dropShade, 0.45);
    ctx.beginPath(); ctx.ellipse(x - C.light[0] * R1 * 0.75, y - hgt * 0.4, R1 * 0.55, hgt * 1.1, 0, 0, TAU); ctx.fill();
    ctx.lineCap = 'round';
    for (let s = 0; s < 5; s++) {
      const u = -0.75 + (s / 4) * 1.5 + (hash(s, seed, 40) - 0.5) * 0.18;
      const yb = y + Math.sqrt(Math.max(0, 1 - u * u)) * R0 * flat;
      const ytt = yt + Math.sqrt(Math.max(0, 1 - u * u)) * R1 * flat;
      ctx.strokeStyle = ca('#ffffff', 0.28 + 0.2 * hash(s, seed, 45));
      ctx.lineWidth = Math.max(1, S * 0.014 * (0.6 + hash(s, seed, 41)));
      ctx.beginPath();
      ctx.moveTo(x + u * R0, yb - (yb - ytt) * 0.2);
      ctx.quadraticCurveTo(x + u * R0 * 1.05, lerp(yb, ytt, 0.55), x + u * R1 * 0.93, lerp(yb, ytt, 0.9));
      ctx.stroke();
    }
    ctx.restore();
    // filos de luz en los flancos (la lámina brilla en los bordes)
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, S * 0.018);
    for (const sx0 of [-1, 1]) {
      const lit = sx0 * C.light[0] > 0 ? 0.85 : 0.4;
      ctx.strokeStyle = ca('#ffffff', lit);
      ctx.beginPath();
      ctx.moveTo(x + sx0 * R0, y);
      ctx.quadraticCurveTo(x + sx0 * R0 * 1.04, y - hgt * 0.62, x + sx0 * R1, yt);
      ctx.stroke();
    }
    // borde de la corona: encaje
    drawFoamLace(ctx, t, ellipsePts(x, yt, R1, R1 * flat, 26), { closed: true, width: S * 0.1, seed: seed + 11, holes: 0.25, preset: o.preset, rag: 0.5, shadow: 0.5, light: o.light });
    // dedos: chorritos cortos y curvos que salen del borde con la gota en la punta (se sueltan al final)
    const nf = Math.round(9 + 3 * Math.min(2, k));
    for (let f = 0; f < nf; f++) {
      const a = (f / nf) * TAU + hash(f, seed, 42) * 0.45;
      const ca_ = Math.cos(a), sa_ = Math.sin(a);
      const bx = x + ca_ * R1, by = yt + sa_ * R1 * flat;
      const fl = S * (0.1 + 0.2 * hash(f, seed, 43)) * up;
      const ex = bx + ca_ * fl * 0.7, ey = by - fl * 0.8;
      const fw = S * (0.022 + 0.014 * hash(f, seed, 46));
      ctx.strokeStyle = sa_ > -0.15 ? col : shade;
      ctx.lineWidth = fw;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + ca_ * fl * 0.05, by - fl * 0.6, ex, ey);
      ctx.stroke();
      const rel = clamp((p - 0.32) / 0.5);
      const dx = ca_ * S * 1.4 * rel, dy = -S * 0.9 * rel + S * 3.0 * rel * rel;
      const rr = fw * (1.25 + 0.5 * hash(f, seed, 44)) * (1 - 0.3 * rel);
      drawDrop(ctx, ex + dx, ey + dy, rr, ca_ * 300 * rel, (-180 + 800 * rel) * rel, { C, light: o.light });
    }
  }
  // 6) gotas que vuelan en parábola desde el borde
  const nd = o.drops ?? 26;
  if (nd > 0) {
    for (let i = 0; i < nd; i++) {
      const a = hash(i, seed, 4) * TAU;
      const tau = (p - hash(i, seed, 8) * 0.15) / 0.85;
      if (tau <= 0 || tau >= 1) continue;
      const v = S * (1.3 + 2.4 * hash(i, seed, 5));
      const vy = S * (2.6 + 3.2 * hash(i, seed, 6));
      const dx = Math.cos(a) * v * tau, dy = Math.sin(a) * v * tau * flat - vy * tau + 5.6 * S * tau * tau;
      if (dy > S * 0.25) continue;
      const r = S * (0.028 + 0.045 * hash(i, seed, 7)) * (1 - tau * 0.45);
      drawDrop(ctx, x + Math.cos(a) * S * 0.5 + dx, y + Math.sin(a) * S * 0.5 * flat + dy, r, Math.cos(a) * v, -vy + 11.2 * S * tau, { C, light: o.light, alpha: Math.min(1, (1 - tau) * 5) });
    }
  }
  // 7) destello en el pico
  if (o.flash !== false) {
    const fl = Math.exp(-Math.pow((p - 0.12) / 0.07, 2));
    if (fl > 0.02) sparkle(ctx, x - S * 0.12, y - S * 0.5, S * 0.3 * fl, { alpha: fl, color: C.spark, halo: 0.4 });
  }
  ctx.restore();
}
