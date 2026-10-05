// HOJA DE FIGURA HUMANA del kit (ART). Un solo «estudio» para toda la gente de la pieza: bañistas, pareja del
// atardecer, bailarines, especialista. Reglas (ver README §13):
//   · proporción cabeza/cuerpo: ADULTO 1:6,5 (alto total = 6,5 cabezas) · PERSONAJE-ÍCONO 1:3
//   · miembros con forma: muslo más ancho que la pantorrilla, brazo más ancho que el antebrazo, panza en el
//     gemelo y el antebrazo, rodilla y codo insinuados (cintura en la articulación)
//   · manos con el pulgar separado (adulto: mitón + pulgar · ícono: 4 dedos + pulgar)
//   · piel en 3 tonos: base, sombra (~20 % del ancho, del lado opuesto a la luz) y filo de luz
//   · pelo en 3–4 mechones con brillo
//   · CONTRALUZ: base navy800/ink y filo dorado de 2–4 px del lado del sol (sin cara ni sombra interna)
// Las formas son ANILLOS de puntos ([[x,y]…]): así se pueden correr para la sombra y el filo sin Path2D.addPath.
// API: drawFigure(ctx, t, o) · limbRing(pts, widths) · drawHand(ctx, x, y, ang, size, o) · paint3(ctx, ring, tones, o)
//      ringPath(ring, dx, dy, into) · SKINS · HAIRS · skinTones(base) · FIG (proporciones)
import { PAL, mixHex } from '../engine/color.js';
import { TAU } from '../engine/ease.js';
import { lightOf } from './presets.js';
import { ca, unit } from './util.js';

/** Proporciones (en altos de cabeza H; pies en y = 0, arriba negativo). */
export const FIG = {
  adult: { heads: 6.5, headW: 0.76, neckW: 0.3, chinY: -5.5, shoulderY: -5.2, shoulderW: 0.9, waistY: -3.95, waistW: 0.52,
    hipY: -3.35, hipW: 0.76, crotchY: -3.05, armLen: [1.32, 1.12], armW: [0.38, 0.28, 0.19], hand: 0.7,
    hipJoint: 0.39, legLen: [1.62, 1.5], legW: [0.66, 0.37, 0.21], foot: 0.62 },
  icon: { heads: 3, headW: 0.98, neckW: 0.24, chinY: -2.06, shoulderY: -1.96, shoulderW: 0.6, waistY: -1.42, waistW: 0.48,
    hipY: -1.1, hipW: 0.54, crotchY: -0.98, armLen: [0.42, 0.38], armW: [0.27, 0.22, 0.18], hand: 0.36,
    hipJoint: 0.24, legLen: [0.5, 0.42], legW: [0.34, 0.25, 0.2], foot: 0.36 },
};

/** Tonos de piel (base) del kit. */
export const SKINS = ['#F2C7A5', '#E3AA82', '#C98B63', '#A86A45', '#7D4A2E'];
/** Pelo: { base, dark, light }. */
export const HAIRS = [
  { base: '#3A2418', dark: '#22140C', light: '#8A6040' },
  { base: '#1E1B22', dark: '#0E0C10', light: '#5E5A6C' },
  { base: '#B5743A', dark: '#7E4C22', light: '#EAB26E' },
  { base: '#E2BC72', dark: '#B08840', light: '#FFEBB8' },
];

/** Piel en 3 tonos a partir de la base: sombra ~20 % más oscura y filo de luz teñido por la luz key. */
export function skinTones(base, key = '#FFE3A8') {
  return { base, shade: mixHex(base, '#5A2E2A', 0.24), rim: mixHex(mixHex(base, '#ffffff', 0.4), key, 0.3) };
}
/** Tonos de una tela (ropa) con la misma regla. */
export function clothTones(base, key = '#FFE3A8') {
  return { base, shade: mixHex(base, PAL.navy900, 0.25), rim: mixHex(mixHex(base, '#ffffff', 0.35), key, 0.25) };
}

// ------------------------------------------------------------------ anillos y pintura
/** Anillo → Path2D suave (Catmull-Rom cerrado), corrido (dx, dy), con su propio moveTo (sirve para unir). */
export function ringPath(ring, dx = 0, dy = 0, into = null, tension = 0.42) {
  const P = into || new Path2D();
  const n = ring.length;
  const q = tension / 3;
  const g = (i) => ring[(i + n) % n];
  P.moveTo(ring[0][0] + dx, ring[0][1] + dy);
  for (let i = 0; i < n; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    P.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * q + dx, p1[1] + (p2[1] - p0[1]) * q + dy,
      p2[0] - (p3[0] - p1[0]) * q + dx, p2[1] - (p3[1] - p1[1]) * q + dy, p2[0] + dx, p2[1] + dy);
  }
  P.closePath();
  return P;
}
/** Elipse como anillo. */
export function ellipseRing(cx, cy, rx, ry, n = 12, rot = 0) {
  const out = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

/**
 * Pinta un anillo en 3 tonos: base, SOMBRA del lado opuesto a la luz (franja de shadeW px) y FILO de luz
 * (rimW px) del lado de la luz. tones = { base, shade, rim }. o = { L: [x,y] hacia la luz, shadeW 4, rimW 2,
 * backlit (sin sombra interna: base plana + filo) }.
 */
export function paint3(ctx, ring, tones, o = {}) {
  const [lx, ly] = unit(o.L ?? [0.6, -0.8]);
  const sw = o.shadeW ?? 4, rw = o.rimW ?? 2;
  const P = ringPath(ring);
  ctx.save();
  ctx.clip(P);
  if (o.backlit) {
    ctx.fillStyle = tones.base;
    ctx.fill(P);
  } else {
    ctx.fillStyle = tones.shade;
    ctx.fill(P);
    ctx.fillStyle = tones.base;
    ctx.fill(ringPath(ring, lx * sw, ly * sw));
  }
  if (rw > 0.2) {
    // filo = la forma MENOS la forma corrida −L·rw
    const Q = new Path2D();
    Q.rect(-1e5, -1e5, 2e5, 2e5);
    ringPath(ring, -lx * rw, -ly * rw, Q);
    ctx.clip(Q, 'evenodd');
    ctx.fillStyle = tones.rim;
    ctx.fill(P);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ miembros y manos
/**
 * Miembro afinado como anillo: articulaciones pts ([[x,y]…], p. ej. hombro→codo→muñeca) y anchos en cada una.
 * Entre articulaciones mete una «panza» (bulge) y en las intermedias una cintura (codo/rodilla insinuados).
 * Extremos redondeados.
 */
export function limbRing(pts, widths, { bulge = 0.14, waist = 0.07 } = {}) {
  const C = [], Wd = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    for (let k = 0; k < 4; k++) {
      const f = k / 4;
      C.push([x0 + (x1 - x0) * f, y0 + (y1 - y0) * f]);
      // panza corrida hacia el primer tercio (gemelo, antebrazo, bíceps)
      const b = Math.sin(Math.PI * Math.pow(f, 0.8));
      let w = widths[i] + (widths[i + 1] - widths[i]) * f;
      w *= 1 + bulge * b - (k === 0 && i > 0 ? waist : 0);
      Wd.push(w);
    }
  }
  C.push(pts[pts.length - 1]);
  Wd.push(widths[widths.length - 1]);
  const n = C.length;
  const Lft = [], Rgt = [];
  for (let i = 0; i < n; i++) {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l, h = Wd[i] / 2;
    Lft.push([C[i][0] + nx * h, C[i][1] + ny * h]);
    Rgt.push([C[i][0] - nx * h, C[i][1] - ny * h]);
  }
  const cap = (c, w, dx, dy) => {
    const out = [];
    const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
    for (const a of [0.55, 1.05, 1.57, 2.09, 2.59]) {
      // de la izquierda a la derecha pasando por la punta
      const ca_ = Math.cos(a), sa_ = Math.sin(a);
      out.push([c[0] + (-uy * ca_ + ux * sa_) * w / 2, c[1] + (ux * ca_ + uy * sa_) * w / 2]);
    }
    return out;
  };
  const e = C[n - 1], e0 = C[n - 2], s = C[0], s1 = C[1];
  return [...Lft, ...cap(e, Wd[n - 1], e[0] - e0[0], e[1] - e0[1]), ...Rgt.slice().reverse(), ...cap(s, Wd[0], s[0] - s1[0], s[1] - s1[1])];
}

/**
 * Mano en (x, y) = muñeca, apuntando hacia ang (rad), largo size. o = { icon (4 dedos + pulgar), side (+1/−1:
 * de qué lado sale el pulgar), tones, L, backlit, rimW }.
 */
export function drawHand(ctx, x, y, ang, size, o = {}) {
  const tones = o.tones ?? skinTones(SKINS[1]);
  const side = o.side ?? 1;
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = (u, v) => [x + c * u - s * v * side, y + s * u + c * v * side]; // u a lo largo, v de costado
  const opt = { L: o.L, backlit: o.backlit, rimW: o.rimW ?? Math.max(0.8, size * 0.06), shadeW: size * 0.12 };
  // pulgar: sale de la base de la palma, separado ~40° del resto
  const thumb = limbRing([P(size * 0.14, size * 0.19), P(size * 0.34, size * 0.38), P(size * 0.52, size * 0.43)], [size * 0.21, size * 0.17, size * 0.14], { bulge: 0.08, waist: 0.03 });
  paint3(ctx, thumb, tones, opt);
  if (o.icon) {
    const palm = [P(0, -size * 0.2), P(size * 0.42, -size * 0.3), P(size * 0.56, -size * 0.06), P(size * 0.54, size * 0.2), P(size * 0.3, size * 0.27), P(0, size * 0.2)];
    for (let f = 0; f < 4; f++) {
      const v = (f - 1.6) * size * 0.135;
      const len = size * (0.46 - Math.abs(f - 1.4) * 0.06);
      const finger = limbRing([P(size * 0.42, v), P(size * 0.42 + len * 0.55, v * 1.12), P(size * 0.42 + len, v * 1.2)], [size * 0.15, size * 0.14, size * 0.13], { bulge: 0.03, waist: 0.05 });
      paint3(ctx, finger, tones, opt);
    }
    paint3(ctx, palm, tones, opt);
  } else {
    // mitón: palma ancha + dedos juntos que se afinan hacia una punta redondeada
    const mitt = [P(0, -size * 0.17), P(size * 0.3, -size * 0.25), P(size * 0.62, -size * 0.24), P(size * 0.9, -size * 0.16), P(size * 1.0, -size * 0.02),
      P(size * 0.95, size * 0.12), P(size * 0.7, size * 0.21), P(size * 0.35, size * 0.25), P(0, size * 0.18)];
    paint3(ctx, mitt, tones, opt);
    if (!o.backlit && size > 14) {
      // separación de dedos insinuada
      ctx.save();
      ctx.strokeStyle = ca(tones.shade, 0.85);
      ctx.lineWidth = Math.max(0.8, size * 0.035);
      ctx.lineCap = 'round';
      for (const v of [-0.1, 0.0, 0.1]) {
        const [ax, ay] = P(size * 0.62, v * size), [bx, by] = P(size * 0.86, v * size * 1.1);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
      ctx.restore();
    }
  }
}

// ------------------------------------------------------------------ figura completa
const D = (a) => [Math.sin(a), Math.cos(a)]; // dirección desde «hacia abajo», girando hacia +x

/**
 * drawFigure(ctx, t, o): persona de FRENTE, parada, pies en (x, y), alto total h (px).
 * o = {
 *   type 'adult' | 'icon' · x, y, h · skin (hex de SKINS) · hair (de HAIRS) · hairStyle 'short' | 'long' | 'bun'
 *   top (remera / malla) · bottom (short / pollera) · skirt (bool) · swim (malla entera: top = bottom)
 *   pose { armL: [hombro, codo], armR, legL: [cadera, rodilla], legR } en rad: 0 = colgando; + = hacia afuera
 *   backlit (contraluz: silueta navy con filo dorado) · preset (luz) · L ([x,y] hacia la luz, pisa al preset)
 *   face (def h ≥ 150 y sin contraluz) · rimW (def 2–4 px según tamaño) · sway (balanceo leve, def 1)
 *   hold: 'drink' en la mano derecha (copa) · glasses (anteojos de sol)
 * }
 * Devuelve { hands: [[x,y],[x,y]], head: [x,y,r] } para colgar objetos.
 */
export function drawFigure(ctx, t, o = {}) {
  const type = o.type ?? 'adult';
  const F = FIG[type];
  const icon = type === 'icon';
  const h = o.h ?? 300;
  const H = h / F.heads;
  const Ls = o.L ? unit(o.L) : unit(lightOf(o.preset ?? 'golden').dir);
  const key = lightOf(o.preset ?? 'golden').key;
  const backlit = !!o.backlit;
  const rimW = o.rimW ?? Math.max(2, Math.min(4, h / 120));
  const sil = o.silhouette ?? PAL.navy800;
  const gold = o.gold ?? PAL.gold;
  const sk = backlit ? { base: sil, shade: sil, rim: gold } : skinTones(o.skin ?? SKINS[1], key);
  const topT = backlit ? { base: mixHex(sil, PAL.ink, 0.35), shade: sil, rim: gold } : clothTones(o.top ?? PAL.coral, key);
  const botT = backlit ? { base: mixHex(sil, PAL.ink, 0.2), shade: sil, rim: gold } : clothTones(o.bottom ?? PAL.navy600, key);
  const hr = o.hair ?? HAIRS[0];
  const hairT = backlit ? { base: mixHex(sil, PAL.ink, 0.4), shade: sil, rim: gold } : { base: hr.base, shade: hr.dark, rim: hr.light };
  const opt = (w) => ({ L: Ls, backlit, rimW: rimW * (backlit ? 1 : 0.8), shadeW: w * 0.2 });
  const sway = (o.sway ?? 1) * Math.sin(t * 1.7) * 0.02;
  const pose = { armL: [0.12, 0.08], armR: [0.12, 0.08], legL: [0.04, 0], legR: [0.04, 0], ...(o.pose || {}) };
  ctx.save();
  ctx.translate(o.x ?? 0, o.y ?? 0);
  ctx.rotate(sway);
  // ---- articulaciones
  const hipL = [-F.hipJoint * H, F.hipY * H + 0.12 * H], hipR = [F.hipJoint * H, F.hipY * H + 0.12 * H];
  const leg = (hip, sgn, [a1, a2]) => {
    const d1 = D(sgn * a1), d2 = D(sgn * (a1 + a2));
    const knee = [hip[0] + d1[0] * F.legLen[0] * H, hip[1] + d1[1] * F.legLen[0] * H];
    const ankle = [knee[0] + d2[0] * F.legLen[1] * H, knee[1] + d2[1] * F.legLen[1] * H];
    return [hip, knee, ankle];
  };
  const LL = leg(hipL, -1, pose.legL), LR = leg(hipR, 1, pose.legR);
  const shL = [-F.shoulderW * H * 0.93, F.shoulderY * H + 0.16 * H], shR = [F.shoulderW * H * 0.93, F.shoulderY * H + 0.16 * H];
  const arm = (sh, sgn, [a1, a2]) => {
    const d1 = D(sgn * a1), d2 = D(sgn * (a1 + a2));
    const el = [sh[0] + d1[0] * F.armLen[0] * H, sh[1] + d1[1] * F.armLen[0] * H];
    const wr = [el[0] + d2[0] * F.armLen[1] * H, el[1] + d2[1] * F.armLen[1] * H];
    return [sh, el, wr, Math.atan2(d2[1], d2[0])];
  };
  const AL = arm(shL, -1, pose.armL), AR = arm(shR, 1, pose.armR);
  // ---- piernas (detrás del torso), con pies
  for (const [Lg, sgn] of [[LL, -1], [LR, 1]]) {
    const ring = limbRing(Lg, F.legW.map((w) => w * H));
    paint3(ctx, ring, sk, opt(F.legW[0] * H));
    if (h >= 300 && !backlit && !icon) elbowHint(ctx, Lg, F.legW[1] * H, sk);
    const [ax, ay] = Lg[2];
    const fw = F.foot * H * 0.5, fh = F.legW[2] * H * 1.1, fx = ax + sgn * fw * 0.3, fy = ay + fh * 0.35;
    const shoe = [[fx - fw * 0.95, fy], [fx - fw * 0.8, fy - fh * 0.55], [fx - fw * 0.2, fy - fh * 0.85], [fx + fw * 0.45, fy - fh * 0.7], [fx + fw, fy - fh * 0.15], [fx + fw * 0.9, fy + fh * 0.12], [fx - fw * 0.9, fy + fh * 0.12]];
    paint3(ctx, shoe, backlit ? sk : clothTones(o.shoes ?? '#F4F1EA', key), opt(fw * 0.5));
    if (!backlit && h >= 200) {
      ctx.fillStyle = mixHex(o.shoes ?? '#F4F1EA', PAL.navy800, 0.35);
      ctx.fillRect(fx - fw * 0.92, fy - fh * 0.02, fw * 1.84, fh * 0.14);
    }
  }
  // ---- torso
  const sw = F.shoulderW * H, ww = F.waistW * H, hw = F.hipW * H;
  const torso = [
    [-F.neckW * H * 0.55, F.shoulderY * H - 0.05 * H], [-sw * 0.7, F.shoulderY * H + 0.02 * H], [-sw, F.shoulderY * H + 0.22 * H],
    [-sw * 0.86, F.shoulderY * H + 0.8 * H], [-ww, F.waistY * H], [-hw, F.hipY * H], [-hw * 0.92, F.crotchY * H + 0.12 * H],
    [0, F.crotchY * H + 0.05 * H],
    [hw * 0.92, F.crotchY * H + 0.12 * H], [hw, F.hipY * H], [ww, F.waistY * H], [sw * 0.86, F.shoulderY * H + 0.8 * H],
    [sw, F.shoulderY * H + 0.22 * H], [sw * 0.7, F.shoulderY * H + 0.02 * H], [F.neckW * H * 0.55, F.shoulderY * H - 0.05 * H],
  ];
  // short / pollera / malla sobre la cadera (debajo de la remera)
  const bottomRing = o.skirt
    ? [[-ww * 1.02, F.waistY * H + 0.1 * H], [ww * 1.02, F.waistY * H + 0.1 * H], [hw * 1.32, (F.crotchY + 0.75) * H], [0, (F.crotchY + 0.82) * H], [-hw * 1.32, (F.crotchY + 0.75) * H]]
    : [[-ww * 1.02, F.waistY * H + 0.1 * H], [ww * 1.02, F.waistY * H + 0.1 * H], [hw * 1.04, F.hipY * H], [hw * 1.02, (F.crotchY + (o.swim ? 0.1 : 0.55)) * H],
      [F.hipJoint * H * 0.2, (F.crotchY + (o.swim ? 0.02 : 0.5)) * H], [0, F.crotchY * H + 0.05 * H], [-F.hipJoint * H * 0.2, (F.crotchY + (o.swim ? 0.02 : 0.5)) * H],
      [-hw * 1.02, (F.crotchY + (o.swim ? 0.1 : 0.55)) * H], [-hw * 1.04, F.hipY * H]];
  paint3(ctx, torso, o.swim ? topT : sk, opt(sw));
  paint3(ctx, bottomRing, o.swim ? topT : botT, opt(hw));
  // ---- brazos y manos (con la manga); la remera va después y tapa la costura del hombro
  const hands = [];
  const drawArms = () => {
    for (const [A, sgn] of [[AL, -1], [AR, 1]]) {
      const ring = limbRing(A.slice(0, 3), F.armW.map((w) => w * H));
      paint3(ctx, ring, sk, opt(F.armW[0] * H));
      if (h >= 300 && !backlit && !icon) elbowHint(ctx, A, F.armW[1] * H, sk);
      if (!o.swim) {
        const m = [A[0][0] + (A[1][0] - A[0][0]) * 0.48, A[0][1] + (A[1][1] - A[0][1]) * 0.48];
        const sleeve = limbRing([[A[0][0] - sgn * 0.1 * H, A[0][1] - 0.05 * H], m], [F.armW[0] * H * 1.3, F.armW[0] * H * 1.2], { bulge: 0.02, waist: 0 });
        paint3(ctx, sleeve, topT, opt(F.armW[0] * H));
      }
      drawHand(ctx, A[2][0], A[2][1], A[3], F.hand * H * (icon ? 1 : 0.86), { tones: sk, L: Ls, backlit, rimW: rimW * 0.7, icon, side: -sgn });
      hands.push(A[2]);
    }
  };
  if (!o.armsFront) drawArms();
  if (!o.swim) {
    // remera: del cuello a la cintura
    const shirt = [...torso.slice(0, 5), [-ww * 1.04, F.waistY * H + 0.2 * H], [ww * 1.04, F.waistY * H + 0.2 * H], ...torso.slice(11)];
    paint3(ctx, shirt, topT, opt(sw));
  }
  if (o.armsFront) drawArms();
  // ---- cuello y cabeza
  const neck = [[-F.neckW * H / 2, F.chinY * H - 0.1 * H], [F.neckW * H / 2, F.chinY * H - 0.1 * H], [F.neckW * H * 0.56, F.shoulderY * H + 0.05 * H], [-F.neckW * H * 0.56, F.shoulderY * H + 0.05 * H]];
  paint3(ctx, neck, backlit ? sk : { ...sk, base: sk.shade }, opt(F.neckW * H));
  const hcY = (F.chinY - 0.5) * H, hrx = F.headW * H / 2, hry = 0.52 * H;
  if (!icon) for (const sgn of [-1, 1]) paint3(ctx, ellipseRing(sgn * hrx * 0.98, hcY + 0.05 * H, 0.1 * H, 0.15 * H, 8), sk, opt(0.1 * H));
  const head = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    const jaw = Math.sin(a) > 0 ? 1 - 0.18 * Math.pow(Math.sin(a), 3) * (icon ? 0.3 : 1) : 1; // mentón más angosto
    head.push([Math.cos(a) * hrx * jaw, hcY + Math.sin(a) * hry]);
  }
  // pelo de atrás (largo) antes de la cabeza
  if (o.hairStyle === 'long') {
    const back = [[-hrx * 1.12, hcY - 0.1 * H], [hrx * 1.12, hcY - 0.1 * H], [hrx * 1.2, hcY + 1.05 * H], [hrx * 0.4, hcY + 1.2 * H], [-hrx * 0.4, hcY + 1.2 * H], [-hrx * 1.2, hcY + 1.05 * H]];
    paint3(ctx, back, { ...hairT, base: hairT.shade }, opt(hrx));
  }
  paint3(ctx, head, sk, opt(hrx * 2));
  const face = o.face ?? (!backlit && h >= 150);
  if (face) drawFace(ctx, H, hcY, hrx, hry, icon, o, sk);
  drawHair(ctx, t, H, hcY, hrx, hry, o.hairStyle ?? 'short', hairT, opt(hrx * 2), backlit, h);
  ctx.restore();
  const m = (p) => [p[0] + (o.x ?? 0), p[1] + (o.y ?? 0)];
  return { hands: hands.map(m), head: [...m([0, hcY]), hry] };
}

/** Codo / rodilla insinuados: arquito de sombra y brillito en la articulación del medio. */
function elbowHint(ctx, J, w, sk) {
  const [a, b, c] = J;
  const d1x = b[0] - a[0], d1y = b[1] - a[1], d2x = c[0] - b[0], d2y = c[1] - b[1];
  const ang = Math.atan2(d1y + d2y, d1x + d2x);
  ctx.save();
  ctx.translate(b[0], b[1]);
  ctx.rotate(ang);
  ctx.lineCap = 'round';
  ctx.strokeStyle = ca(sk.shade, 0.45);
  ctx.lineWidth = Math.max(1, w * 0.06);
  ctx.beginPath(); ctx.arc(-w * 0.05, 0, w * 0.3, Math.PI * 0.72, Math.PI * 1.28); ctx.stroke();
  ctx.restore();
}

function drawFace(ctx, H, cy, rx, ry, icon, o, sk) {
  ctx.save();
  const ey = cy + (icon ? 0.05 : 0.02) * H, ex = rx * (icon ? 0.42 : 0.4);
  const er = (icon ? 0.1 : 0.055) * H;
  if (o.glasses) {
    ctx.fillStyle = PAL.ink;
    const gr = icon ? er * 1.35 : er * 2.1;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * ex, ey, gr, gr * 0.72, 0, 0, TAU); ctx.fill(); }
    ctx.fillRect(-ex, ey - er * 0.4, ex * 2, er * 0.5);
    ctx.fillStyle = ca('#ffffff', 0.55);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * ex - gr * 0.3, ey - gr * 0.25, gr * 0.3, gr * 0.17, -0.4, 0, TAU); ctx.fill(); }
  } else {
    ctx.fillStyle = PAL.ink;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * ex, ey, er * 0.85, er * (icon ? 1.15 : 1.05), 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ffffff';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * ex + er * 0.3, ey - er * 0.35, er * 0.32, 0, TAU); ctx.fill(); }
  }
  // cejas
  ctx.strokeStyle = (o.hair ?? HAIRS[0]).dark;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, 0.035 * H);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * ex - er * 1.4, ey - er * 2.2); ctx.quadraticCurveTo(s * ex, ey - er * 2.9, s * ex + er * 1.4, ey - er * 2.3); ctx.stroke(); }
  // nariz (sombra) y boca (sonrisa)
  ctx.strokeStyle = sk.shade;
  ctx.lineWidth = Math.max(1, 0.03 * H);
  ctx.beginPath(); ctx.moveTo(0.02 * H, ey + 0.08 * H); ctx.quadraticCurveTo(0.06 * H, ey + 0.17 * H, -0.01 * H, ey + 0.19 * H); ctx.stroke();
  ctx.strokeStyle = mixHex(sk.shade, '#7A2E2A', 0.4);
  ctx.lineWidth = Math.max(1, 0.035 * H);
  const my = ey + (icon ? 0.3 : 0.28) * H, mw = rx * (icon ? 0.32 : 0.3);
  ctx.beginPath(); ctx.moveTo(-mw, my); ctx.quadraticCurveTo(0, my + mw * 0.7, mw, my); ctx.stroke();
  // cachetes (ícono)
  if (icon) {
    ctx.fillStyle = ca(PAL.coral, 0.32);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * rx * 0.62, my - 0.08 * H, rx * 0.16, rx * 0.1, 0, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

/** Pelo: gorro base + 3–4 mechones afinados + brillo. */
function drawHair(ctx, t, H, cy, rx, ry, style, T, opt, backlit, h) {
  const top = cy - ry;
  const cap = [[-rx * 1.06, cy + 0.05 * H], [-rx * 1.04, cy - ry * 0.5], [-rx * 0.6, top - 0.08 * H], [0, top - 0.11 * H], [rx * 0.6, top - 0.08 * H],
    [rx * 1.04, cy - ry * 0.5], [rx * 1.06, cy + 0.02 * H], [rx * 0.86, cy - ry * 0.25], [rx * 0.3, cy - ry * 0.55], [-rx * 0.2, cy - ry * 0.42], [-rx * 0.86, cy - ry * 0.2]];
  paint3(ctx, cap, T, opt);
  // mechones: lenguas curvas que caen sobre la frente y los costados
  const locks = [
    [[-rx * 0.1, top - 0.06 * H], [-rx * 0.5, cy - ry * 0.4], [-rx * 0.72, cy - ry * 0.12]],
    [[rx * 0.15, top - 0.08 * H], [rx * 0.42, cy - ry * 0.55], [rx * 0.6, cy - ry * 0.25]],
    [[-rx * 0.55, top], [-rx * 0.95, cy - ry * 0.3], [-rx * 1.0, cy + (style === 'long' ? 0.5 : 0.08) * H]],
    [[rx * 0.6, top + 0.02 * H], [rx * 0.98, cy - ry * 0.25], [rx * 1.02, cy + (style === 'long' ? 0.5 : 0.06) * H]],
  ];
  for (let i = 0; i < locks.length; i++) {
    const sw = Math.sin(t * 2 + i) * 0.01 * H;
    const pts = locks[i].map(([x, y], j) => [x + sw * j, y]);
    const ring = limbRing(pts, [0.22 * H, 0.16 * H, 0.04 * H], { bulge: 0.2, waist: 0 });
    paint3(ctx, ring, T, opt);
  }
  if (style === 'bun') paint3(ctx, ellipseRing(0, top - 0.14 * H, 0.26 * H, 0.2 * H, 10), T, opt);
  // brillo del pelo (arco claro)
  if (!backlit && h >= 90) {
    ctx.save();
    ctx.strokeStyle = ca(T.rim, 0.75);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.2, 0.045 * H);
    ctx.beginPath();
    ctx.ellipse(-rx * 0.1, cy - ry * 0.1, rx * 0.72, ry * 0.75, 0, Math.PI * 1.15, Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();
  }
}
