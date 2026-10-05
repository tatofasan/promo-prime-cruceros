// Cena gourmet en cubierta, vista cenital (match cut flotador → plato → ruleta). Equipo DECK-A.
// Contrato: docs/PLAN.md §6.3 y §7. Coreografía en deck-a/dinner-timeline.js; cada ilustración en su módulo.
// Cámara cenital con perspectiva real (deck-a/util.js): lo alto (copas, vela, campana, manos) crece y se abre.
import { E, clamp, prog, lerp } from '../engine/ease.js';
import { lightSweep, sparkle } from '../engine/draw.js';
import { addGrade } from '../engine/grade.js';
import { W, H } from '../engine/time.js';
import { hash } from '../engine/noise.js';
import { CLOTH, buildCloth } from './deck-a/cloth.js';
import { buildPlate, buildPlateLight, drawPlate, PLATE_R } from './deck-a/plate.js';
import { buildCloche, buildHandle, buildHandleShadow, CLOCHE_R } from './deck-a/cloche.js';
import { mixHex } from '../engine/color.js';
import { buildCutlery } from './deck-a/cutlery.js';
import { buildFlowers, buildFlowersShadow } from './deck-a/flowers.js';
import { buildBread, buildBreadShadow } from './deck-a/bread.js';
import { drawWineGlass, wineGlassShadow, drawTumbler, tumblerShadow } from './deck-a/glass.js';
import { drawCandle, drawHalo, drawVotive } from './deck-a/candle.js';
import { drawBottle, drawStream } from './deck-a/bottle.js';
import { drawArm } from './deck-a/hands.js';
import { buildSteam, drawSteam, drawLeak, drawBurst, drawWisps } from './deck-a/steam.js';
import { buildPetals, drawPetals, petalShadows, drawFgPetals, drawGustPetals } from './deck-a/petals.js';
import { floatAt, camAt as poolCamAt } from './deck-a/pool-timeline.js';
import { RING_CORAL } from './deck-a/float.js';
import { clinkStar, twinkle } from './deck-a/glints.js';
import {
  project, onPlane, put, shadowSprite, softDisc, warmDisc, inkDisc, softCapsule, shadowPt, lightAng, LIGHT, flicker, halfBlur,
  hullPath,
} from './deck-a/util.js';
import {
  T0, TC, TP, TK, T1, HIT, camAt, plateRot, plateOmega, clocheState, dropIn, popIn, TABLE, candleLit,
  GLASS1, bottleState, wineLevel, glass1State, arm1State, glass2State, CLINK, platePop, T_EXIT, ARM2_DIR,
} from './deck-a/dinner-timeline.js';

const PLATE = { x: 960, y: 540 };
const FLOWERS = { x: 852, y: 182 };
const BREAD = { x: 1585, y: 828, r: -0.3 };
const TUMBLER = { x: 1150, y: 905 };
const VOTIVE = { x: 318, y: 700 };
const Lat = (x, y) => { const a = lightAng(x, y); return [Math.cos(a), Math.sin(a)]; };

let S = null;
let gradeHooked = false;
// las rayas del flotador siguen en el ala del plato: mismo ángulo en pantalla en el corte
let BAND_OFF = 0;

// ------------------------------------------------------------------ piezas
function flat(ctx, C, t, it, tIn, sc = 1) {
  const d = dropIn(t, tIn);
  if (d.a <= 0) return;
  const [x, y, k] = project(C, it.x, it.y, d.h);
  // sombra en la mesa: se acerca y se afila al aterrizar
  const off = 5 + d.h * 0.25;
  const L = Lat(it.x, it.y);
  onPlane(ctx, C, 0, (c) => put(c, it.sh, it.x - L[0] * off, it.y - L[1] * off, {
    r: it.rot, s: sc * (1 + d.h * 0.0006), alpha: 0.55 * d.a * clamp(1 - d.h / 500),
  }));
  put(ctx, it.img, x, y, { r: it.rot + d.r + C.r, s: k * sc, sx: d.sx, sy: d.sy, alpha: d.a });
}

function scaledAt(ctx, x, y, s, fn) {
  if (s <= 0.001) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.translate(-x, -y);
  fn(ctx);
  ctx.restore();
}

// El charco cálido está horneado en el mantel. Antes de encender la vela la mesa está en penumbra fría;
// después, la llama titila sobre el mantel con un respiro de luz chico (barato).
function candleAir(ctx, C, t, lit, flare) {
  onPlane(ctx, C, 0, (c) => {
    if (lit < 1) {
      const R = 1300;
      const g = c.createRadialGradient(LIGHT.x, LIGHT.y + 60, 0, LIGHT.x, LIGHT.y + 60, R);
      g.addColorStop(0, `rgba(6,18,38,${0.5 * (1 - lit)})`);
      g.addColorStop(0.6, `rgba(6,18,38,${0.3 * (1 - lit)})`);
      g.addColorStop(1, `rgba(6,18,38,${0.1 * (1 - lit)})`);
      c.fillStyle = g;
      c.fillRect(LIGHT.x - R, LIGHT.y + 60 - R, R * 2, R * 2);
    }
    if (lit > 0) {
      const f = flicker(t) - 1;
      const a = lit * (0.05 + f * 0.35 + flare * 0.25);
      if (a > 0.005) {
        c.globalCompositeOperation = 'lighter';
        put(c, warmDisc(), LIGHT.x, LIGHT.y + 40, { s: 520 / 64, alpha: Math.min(1, a) });
      }
    }
  });
}

function wineGlass1(ctx, C, t) {
  const pin = popIn(t, TABLE.wine, 0.4, 1.15);
  if (pin <= 0) return;
  const g = glass1State(t);
  const level = wineLevel(t);
  const ripple = t > TK - HIT ? prog(t, TK - HIT, TK + 0.55) : prog(t, TP - HIT, TP + 0.5);
  const slosh = t > TK ? [6 * Math.exp(-(t - TK) * 6) * Math.cos((t - TK) * 30), -5 * Math.exp(-(t - TK) * 6) * Math.cos((t - TK) * 30)] : [0, 0];
  const A = arm1State(t);
  const [fx, fy] = project(C, g.x, g.y, g.lift);
  scaledAt(ctx, fx, fy, pin, (c) => drawWineGlass(c, C, {
    ...g, level, swirl: level > 0 ? (t - TP) * 9 - 3 * E.outCubic(prog(t, TP, 8.75)) : 0, ripple, slosh, t, seed: 1,
    mid: A.alpha > 0 ? (cc) => drawArm(cc, C, { ...A, who: 'a' }) : null,
  }));
}

function wineGlass2(ctx, C, t) {
  const g = glass2State(t);
  if (g.alpha <= 0) return;
  const ripple = t > TK ? prog(t, TK, TK + 0.55) : 0;
  const slosh = t > TK ? [-6 * Math.exp(-(t - TK) * 6) * Math.cos((t - TK) * 30), 5 * Math.exp(-(t - TK) * 6) * Math.cos((t - TK) * 30)] : [0, 0];
  drawWineGlass(ctx, C, {
    ...g, level: 0.5, swirl: 0, ripple, slosh, t, seed: 2,
    mid: (cc) => drawArm(cc, C, { x: g.x, y: g.y, h: g.lift + 58, dir: ARM2_DIR, who: 'b', grip: 1 }),
  });
}

// sombra de un brazo sobre la mesa (lo ancla: sin esto parece pegado encima)
function armShadow(ctx, C, A) {
  if (!A || A.alpha <= 0.01) return;
  const cd = Math.cos(A.dir), sd = Math.sin(A.dir);
  const [x0, y0] = shadowPt(A.x, A.y, Math.min(260, A.h));
  const [x1, y1] = shadowPt(A.x + cd * 420, A.y + sd * 420, Math.min(300, A.h + 200));
  onPlane(ctx, C, 0, (c) => softCapsule(c, x0, y0, x1, y1, 120, 0.26 * A.alpha * clamp(1 - A.h / 600)));
}

function bottle(ctx, C, t) {
  const b = bottleState(t);
  if (!b.on) return;
  // sombra de la botella en la mesa
  const cd = Math.cos(b.dir), sd = Math.sin(b.dir);
  const [s0x, s0y] = shadowPt(b.mx, b.my, Math.min(420, b.mh));
  const [s1x, s1y] = shadowPt(b.mx + cd * 300, b.my + sd * 300, Math.min(440, b.mh + 120));
  onPlane(ctx, C, 0, (c) => softCapsule(c, s0x, s0y, s1x, s1y, 90, 0.18));
  const m = drawBottle(ctx, C, b);
  if (m && b.flow > 0) {
    const level = Math.max(0.04, wineLevel(t));
    const [wx, wy] = project(C, GLASS1.x, GLASS1.y, 112 + level * 80);
    const r = b.reach;
    drawStream(ctx, m[0], m[1], lerp(m[0], wx, r), lerp(m[1], wy, r), 9 * (m[2] / 15), b.flow, t);
    // salpicón al tocar
    const sp = t - (TP - HIT);
    if (sp > -0.01 && sp < 0.25) {
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9 + 0.3, d = 6 + E.outCubic(clamp(sp / 0.2)) * 26;
        sparkle(ctx, wx + Math.cos(a) * d, wy + Math.sin(a) * d, 5 * (1 - sp / 0.25), { color: '#FFC9D2', alpha: 1 - sp / 0.25, halo: 0.3 });
      }
    }
  }
}

function cloche(ctx, C, t, rot) {
  const cs = clocheState(t);
  if (!cs.on) return;
  const wx = PLATE.x + cs.dx, wy = PLATE.y + cs.dy;
  const L = Lat(PLATE.x, PLATE.y);
  // sombra proyectada: larga hacia abajo a la izquierda; se va y se desvanece al levantar
  const shA = 0.5 * clamp(1 - cs.h / 380);
  if (shA > 0.01) {
    const [sx, sy] = shadowPt(wx, wy, Math.min(420, cs.h + 130));
    onPlane(ctx, C, 0, (c) => {
      put(c, inkDisc(), wx - L[0] * 6, wy - L[1] * 6, { s: (CLOCHE_R * 1.12) / 64, alpha: shA });
      softCapsule(c, wx, wy, sx, sy, CLOCHE_R * 1.7, shA * 0.75);
    });
  }
  // luz que escapa bajo el labio (anticipación)
  if (cs.leak > 0.01) {
    const [x, y, k] = project(C, wx, wy, 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = `rgba(255,190,90,${0.9 * cs.leak})`;
    ctx.shadowBlur = 30;
    ctx.strokeStyle = `rgba(255,214,140,${0.75 * cs.leak})`;
    ctx.lineWidth = 6 * k;
    ctx.beginPath(); ctx.arc(x, y, (CLOCHE_R + 2) * k, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    drawLeak(ctx, C, t, { px: wx, py: wy, p: cs.leak, R: CLOCHE_R });
  }
  // la campana (con estela de velocidad cuando vuela)
  const draw1 = (c, st, alpha) => {
    const px = PLATE.x + st.dx, py = PLATE.y + st.dy;
    const [x, y, k] = project(C, px, py, st.h + 60);
    put(c, S.cloche, x, y, { r: st.spin + C.r, s: k * st.squash, alpha });
    const [hx, hy, hk] = project(C, px, py, st.h + 175);
    put(c, S.handleSh, x + (hx - x) * 0.4 - L[0] * 12 * k, y + (hy - y) * 0.4 - L[1] * 12 * k, { r: rot + st.spin + C.r, s: k, alpha: 0.5 * alpha });
    put(c, S.handle, hx, hy, { r: rot + st.spin + C.r, s: hk * st.squash, alpha });
  };
  if (cs.q > 0.02) {
    // estela gráfica: envolvente plateada que se desvanece + líneas de velocidad, y la campana nítida encima
    const st0 = clocheState(t - 0.04);
    const [x0, y0, k0] = project(C, PLATE.x + st0.dx, PLATE.y + st0.dy, st0.h + 60);
    const [x1, y1, k1] = project(C, wx, wy, cs.h + 60);
    const r0 = CLOCHE_R * k0 * 0.85, r1 = CLOCHE_R * k1 * 0.97;
    const sp = Math.hypot(x1 - x0, y1 - y0);
    if (sp > 8) {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(180,196,214,0)');
      g.addColorStop(0.7, 'rgba(205,216,228,0.32)');
      g.addColorStop(1, 'rgba(225,233,242,0.6)');
      ctx.fillStyle = g;
      ctx.fill(hullPath(x0, y0, r0, x1, y1, r1));
      const ux = (x1 - x0) / sp, uy = (y1 - y0) / sp;
      ctx.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        const off = (k / 5 - 0.5) * 1.5 * r1, len = sp * (0.6 + hash(k, 77) * 0.9);
        const bx = x1 - uy * off - ux * r1 * 0.4, by = y1 + ux * off - uy * r1 * 0.4;
        const lg = ctx.createLinearGradient(bx, by, bx - ux * len, by - uy * len);
        lg.addColorStop(0, 'rgba(255,255,255,0.55)');
        lg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = lg;
        ctx.lineWidth = 2 + (k % 3);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - ux * len, by - uy * len); ctx.stroke();
      }
    }
    for (let k = 0; k < 4; k++) draw1(ctx, clocheState(t - k * 0.0018), 1 / (k + 1));
  } else draw1(ctx, cs, 1);
  // destello en el domo
  if (cs.q < 0.4) {
    const [x, y, k] = project(C, wx, wy, cs.h + 120);
    const a = lightAng(PLATE.x, PLATE.y) + C.r;
    sparkle(ctx, x + Math.cos(a) * 62 * k, y + Math.sin(a) * 62 * k, 22 * k * (0.7 + 0.3 * Math.sin(t * 9)), { color: '#FFF4D8', alpha: 0.9 * (1 - cs.q * 2.5), halo: 0.7 });
  }
}

function reveal(ctx, C, t, rot) {
  const d = t - (TC - HIT);
  const [x, y, k] = project(C, PLATE.x, PLATE.y, 0);
  if (d > -0.06 && d < 0.6) {
    const a = d < 0 ? clamp((d + 0.06) / 0.06) : Math.exp(-d / 0.16);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    put(ctx, softDisc(), x, y, { s: (PLATE_R * 1.4 * k) / 64, alpha: 0.2 * a });
    ctx.restore();
    const clip = new Path2D();
    clip.arc(x, y, PLATE_R * k, 0, Math.PI * 2);
    lightSweep(ctx, clip, { x: x - PLATE_R * k, y: y - PLATE_R * k, w: PLATE_R * 2 * k, h: PLATE_R * 2 * k }, prog(t, TC - 0.03, TC + 0.32),
      { angle: -0.5, width: 0.3, color: '#FFF1D0', alpha: 0.42 });
  }
  // brillos que titilan sobre la comida (giran con el plato)
  if (d > -0.03) {
    const pts = [[-30, 8, 1], [8, 2, 2], [40, -4, 3], [70, -60, 4], [88, 86, 5], [-60, 100, 6], [44, -102, 7], [-92, 32, 8]];
    const burst = d < 0.35 ? Math.exp(-Math.abs(d) / 0.12) : 0;
    for (const [px, py, s] of pts) {
      const c = Math.cos(rot), sn = Math.sin(rot);
      const [sx, sy] = project(C, PLATE.x + (px * c - py * sn) * 1.08, PLATE.y + (px * sn + py * c) * 1.08, 20);
      twinkle(ctx, sx, sy, t, s, 13 * k, 1.1);
      if (burst > 0.02) sparkle(ctx, sx, sy, (10 + s * 2) * k * burst, { color: '#FFF6DE', alpha: burst, rot: 0.3 * s, halo: 0.6 });
    }
  }
}

// destellos del filo dorado que viajan con el giro (salida)
function rimGlints(ctx, C, t, rot, om, pp = 1) {
  const a = Math.pow(clamp(om / 1.6), 0.7);
  if (a <= 0.01) return;
  const [x, y, k0] = project(C, PLATE.x, PLATE.y, 4);
  const k = k0 * pp;
  const R = (PLATE_R - 4) * k;
  // estelas de giro sobre el ala (oro y porcelana): largo ∝ ω, siguen al timón, al ancla y a los puntos
  ctx.save();
  ctx.lineCap = 'round';
  const len = Math.min(1.3, 0.12 + 0.2 * om);
  // líneas de giro por fuera del ala (se leen como rotación aunque el plato recién arranque)
  for (const [off, rf, w] of [[0.3, 1.08, 5], [1.9, 1.14, 3.5], [3.5, 1.1, 4.5], [5.0, 1.17, 3]]) {
    const ang = rot + off + C.r, rr = PLATE_R * rf * k;
    const g = ctx.createLinearGradient(x + Math.cos(ang - len) * rr, y + Math.sin(ang - len) * rr, x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
    g.addColorStop(0, 'rgba(255,240,205,0)');
    g.addColorStop(1, `rgba(255,240,205,${0.8 * a})`);
    ctx.strokeStyle = g;
    ctx.lineWidth = w * k;
    ctx.beginPath(); ctx.arc(x, y, rr, ang - len, ang); ctx.stroke();
  }
  for (const [off, rr, w, col] of [[-Math.PI / 2, PLATE_R - 32, 9, '255,222,150'], [Math.PI / 2, PLATE_R - 32, 7, '255,222,150'],
    [0.6, PLATE_R - 22, 3, '255,236,190'], [2.3, PLATE_R - 22, 3, '255,236,190'], [3.9, PLATE_R - 22, 3, '255,236,190'], [5.2, PLATE_R - 22, 3, '255,236,190'],
    [1.4, PLATE_R - 60, 5, '255,255,255'], [4.4, PLATE_R - 60, 5, '255,255,255']]) {
    const ang = rot + off + C.r;
    const g = ctx.createLinearGradient(x + Math.cos(ang - len) * rr * k, y + Math.sin(ang - len) * rr * k, x + Math.cos(ang) * rr * k, y + Math.sin(ang) * rr * k);
    g.addColorStop(0, `rgba(${col},0)`);
    g.addColorStop(1, `rgba(${col},${0.75 * a})`);
    ctx.strokeStyle = g;
    ctx.lineWidth = w * k;
    ctx.beginPath(); ctx.arc(x, y, rr * k, ang - len, ang); ctx.stroke();
  }
  ctx.restore();
  for (const [off, s] of [[-1.0, 1], [2.1, 0.7], [0.4, 0.5]]) {
    const ang = rot + off;
    const sx = x + Math.cos(ang) * R, sy = y + Math.sin(ang) * R;
    sparkle(ctx, sx, sy, 22 * s * k, { alpha: a, color: '#FFF2C8', rot: ang, halo: 0.7 });
    // estela del destello a lo largo del filo
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,220,140,${0.5 * a * s})`;
    ctx.lineWidth = 3 * k;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, R, ang - Math.min(1.2, 0.05 + om * 0.15), ang); ctx.stroke();
    ctx.restore();
  }
}

function grade(ctx, C, t, amb, flare) {
  const f = flicker(t);
  const [lx, ly] = project(C, LIGHT.x, LIGHT.y, 0);
  // calidez de la vela sobre todo (la viñeta navy la pone grade.js con addGrade)
  ctx.save();
  const g = ctx.createRadialGradient(lx, ly + 120, 0, lx, ly + 120, 1500);
  g.addColorStop(0, `rgba(255,186,105,${(0.42 + 0.25 * flare) * amb * f})`);
  g.addColorStop(0.45, `rgba(255,160,90,${0.16 * amb})`);
  g.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // grade cálido de la vela: goldPale en screen (~12 %) centrado en la llama
  const [fx, fy] = project(C, LIGHT.x, LIGHT.y, LIGHT.h);
  const w = ctx.createRadialGradient(fx, fy, 0, fx, fy, 1250);
  w.addColorStop(0, `rgba(255,233,184,${0.15 * f})`);
  w.addColorStop(0.5, 'rgba(255,233,184,0.07)');
  w.addColorStop(1, 'rgba(255,233,184,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = w;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ------------------------------------------------------------------ el corte desde el flotador
/** Rayas coral/blancas del flotador reflejadas en el ala: 3 cuadros enteras y se angostan hacia el filo dorado. */
function rimBand(c, t, rot) {
  const d = t - T0;
  if (d < 0 || d > 0.1) return;
  const q = E.inOutSine(clamp((d - 0.035) / 0.065));
  const r1 = PLATE_R - 4, r0 = lerp(CLOCHE_R + 4, PLATE_R - 11, q);
  const N = 8;
  for (let k = 0; k < N; k++) {
    const a0 = rot + BAND_OFF + (k / N) * Math.PI * 2, a1 = a0 + (Math.PI * 2) / N;
    c.fillStyle = k % 2 ? mixHex('#FFF9F2', '#F2CD78', q) : mixHex(RING_CORAL, '#C38A2C', q);
    c.beginPath(); c.arc(PLATE.x, PLATE.y, r1, a0, a1); c.arc(PLATE.x, PLATE.y, r0, a1, a0, true); c.closePath(); c.fill();
  }
  // brillo especular del vinilo que sigue a la vela
  const la = lightAng(PLATE.x, PLATE.y);
  c.strokeStyle = `rgba(255,255,255,${0.7 * (1 - q)})`;
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.beginPath(); c.arc(PLATE.x, PLATE.y, (r0 + r1) / 2 + 4, la - 0.5, la + 0.4); c.stroke();
}
/** Destello en anillo de 3 cuadros en el corte: el filo dorado se enciende y suelta una onda de luz hacia afuera. */
function cutFlash(ctx, C, t, pp) {
  const d = t - T0;
  if (d < 0 || d >= 0.05) return;
  const q = d / 0.05;
  const [x, y, k] = project(C, PLATE.x, PLATE.y, 0);
  const K = k * pp;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // filo que se enciende (adentro del borde: el contorno del plato queda nítido en el corte)
  ctx.strokeStyle = `rgba(255,214,140,${0.75 * (1 - q)})`;
  ctx.lineWidth = 10 * K;
  ctx.beginPath(); ctx.arc(x, y, (PLATE_R - 9) * K, 0, Math.PI * 2); ctx.stroke();
  // onda de luz que sale (desde el cuadro siguiente)
  if (q > 0.2) {
    const u = (q - 0.2) / 0.8;
    ctx.strokeStyle = `rgba(255,236,190,${0.85 * (1 - u)})`;
    ctx.lineWidth = (18 - 12 * u) * K;
    ctx.beginPath(); ctx.arc(x, y, (PLATE_R + 14 + 70 * E.outCubic(u)) * K, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - u)})`;
    ctx.lineWidth = (4 - 3 * u) * K;
    ctx.beginPath(); ctx.arc(x, y, (PLATE_R + 8 + 36 * E.outCubic(u)) * K, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
// ------------------------------------------------------------------ escena
const scene = {
  id: 'dinner',
  team: 'DECK-A',
  from: 7.5,
  to: 9.375,
  z: 40,
  async init() {
    const la = lightAng(PLATE.x, PLATE.y);
    S = {
      cloth: buildCloth(),
      plate: buildPlate([Math.cos(la), Math.sin(la)]),
      plateLight: buildPlateLight(la),
      plateSh: shadowSprite(420, 420, 12, (c) => { c.beginPath(); c.arc(0, 0, PLATE_R + 2, 0, Math.PI * 2); c.fill(); }),
      plateAo: shadowSprite(420, 420, 34, (c) => { c.beginPath(); c.arc(0, 0, PLATE_R + 10, 0, Math.PI * 2); c.fill(); }),
      cloche: buildCloche(la),
      handle: buildHandle(),
      handleSh: buildHandleShadow(),
      cut: buildCutlery(Lat),
      flowers: buildFlowers(Lat(FLOWERS.x, FLOWERS.y)),
      flowersSh: buildFlowersShadow(),
      bread: buildBread(Lat(BREAD.x, BREAD.y)),
      breadSh: buildBreadShadow(),
    };
    S.breadItem = { ...BREAD, img: S.bread, sh: S.breadSh, rot: BREAD.r };
    {
      const e = 1e-4;
      BAND_OFF = floatAt(T0 - e).rot + poolCamAt(T0 - e).r - plateRot(T0) - camAt(T0).r;
    }
    buildSteam();
    buildPetals();
    if (!gradeHooked) {
      gradeHooked = true;
      // viñeta navy más cerrada en la cena: la única luz es la vela
      addGrade((t) => (t >= scene.from && t < scene.to ? { vignette: 0.5, vignetteColor: '4,12,28' } : null));
    }
  },
  draw(ctx, t) {
    const C = camAt(t);
    const rot = plateRot(t);
    const om = plateOmega(t);
    const pp = platePop(t);
    const { lit, flare, amb } = candleLit(t);
    // cambio de foco al plato antes del corte: entra fundiendo en 3 cuadros y crece de 4 a 11 px
    const focusIn = prog(t, 9.15, 9.2);
    const focus = 4 + 7 * E.inQuad(prog(t, 9.2, T1));
    // profundidad de campo en el corte: lo alto (vela, flores, vasos) entra desenfocado y hace foco en 5 cuadros
    const dof = 14 * (1 - E.outCubic(prog(t, T0, T0 + 0.085)));

    // ---- mesa: lo que está apoyado (plano) y lo alto
    const flatPart = (c) => {
      onPlane(c, C, 0, (cc) => cc.drawImage(S.cloth, CLOTH.x0, CLOTH.y0));
      candleAir(c, C, t, lit, flare);
      petalShadows(c, C, t);
      const cut = S.cut;
      flat(c, C, t, cut.napkin, TABLE.napkin);
      flat(c, C, t, cut.fork2, TABLE.fork2, 0.88);
      flat(c, C, t, cut.fork, TABLE.fork);
      flat(c, C, t, cut.knife, TABLE.knife);
      flat(c, C, t, cut.spoon, TABLE.spoon);
      flat(c, C, t, S.breadItem, TABLE.bread);
      // sombras de lo alto
      const [sx, sy] = shadowPt(FLOWERS.x, FLOWERS.y, 150);
      onPlane(c, C, 0, (cc) => put(cc, S.flowersSh, (FLOWERS.x + sx) / 2, (FLOWERS.y + sy) / 2, { s: 1.05, alpha: 0.32 }));
      tumblerShadow(c, C, { ...TUMBLER, alpha: 1 });
      wineGlassShadow(c, C, { ...glass1State(t), level: wineLevel(t), alpha: 1 });
      const g2 = glass2State(t);
      if (g2.alpha > 0) {
        wineGlassShadow(c, C, { ...g2, level: 0.5 });
        armShadow(c, C, { x: g2.x, y: g2.y, h: g2.lift + 58, dir: ARM2_DIR, alpha: g2.alpha });
      }
      armShadow(c, C, arm1State(t));
      onPlane(c, C, 0, (cc) => put(cc, inkDisc(), LIGHT.x, LIGHT.y + 6, { s: 70 / 64, alpha: 0.6 }));
      onPlane(c, C, 0, (cc) => put(cc, inkDisc(), VOTIVE.x + 6, VOTIVE.y + 8, { s: 46 / 64, alpha: 0.5 }));
      drawPetals(c, C, t);
    };
    const tallPart = (c) => {
      drawTumbler(c, C, { ...TUMBLER, t });
      drawCandle(c, C, { pop: 1, lit, t });
      drawVotive(c, C, t, VOTIVE.x, VOTIVE.y, 1, 1);
      const [x, y, k] = project(C, FLOWERS.x, FLOWERS.y, 170);
      put(c, S.flowers, x, y, { r: 0.02 * Math.sin(t * 1.7) + C.r, s: k });
    };
    const table = (c) => { flatPart(c); tallPart(c); };
    if (focusIn <= 0) {
      flatPart(ctx);
      if (dof > 1.2) halfBlur(ctx, dof, tallPart); else tallPart(ctx);
    } else if (focusIn < 1) { table(ctx); halfBlur(ctx, focus, table, focusIn); } else halfBlur(ctx, focus, table);

    // ---- antes del corte: la luz se cierra sobre el plato (foco y rima con la ruleta)
    const spot = E.inCubic(prog(t, 9.06, T1));
    if (spot > 0.003) {
      const [px, py, pk] = project(C, PLATE.x, PLATE.y, 0);
      const r0 = PLATE_R * pk * 1.06;
      const g = ctx.createRadialGradient(px, py, r0, px, py, r0 + 760);
      g.addColorStop(0, 'rgba(4,12,28,0)');
      g.addColorStop(0.3, `rgba(4,12,28,${0.62 * spot})`);
      g.addColorStop(1, `rgba(4,12,28,${0.92 * spot})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    // ---- plato (gira como cuerpo rígido; smear rotacional proporcional a ω) y la campana encima, con el pop
    const [ppx, ppy] = project(C, PLATE.x, PLATE.y, 0);
    scaledAt(ctx, ppx, ppy, pp, (c0) => {
      onPlane(c0, C, 0, (c) => {
        const L = Lat(PLATE.x, PLATE.y);
        put(c, S.plateAo, PLATE.x - L[0] * 14, PLATE.y - L[1] * 14, { alpha: 0.5 });
        put(c, S.plateSh, PLATE.x - L[0] * 6, PLATE.y - L[1] * 6, { alpha: 0.6 });
        const smearAng = om > 0.3 ? Math.min(0.45, om * (4 / 60)) : 0;
        drawPlate(c, S.plate, S.plateLight, PLATE.x, PLATE.y, rot, smearAng, 10);
        rimBand(c, t, rot);
      });
      reveal(c0, C, t, rot);
      rimGlints(c0, C, t, rot, t > T_EXIT ? om : 0);
      // vapor
      drawBurst(c0, C, t, { px: PLATE.x, py: PLATE.y, p: prog(t, TC - 0.06, TC + 0.8) });
      drawSteam(c0, C, t, { px: PLATE.x, py: PLATE.y, from: TC - 0.1, strength: clamp((t - TC + 0.1) / 0.3), spin: rot });
      {
        const [x, y, k] = project(C, PLATE.x, PLATE.y, 30);
        drawWisps(c0, t, { x, y, k, from: TC - 0.05, strength: clamp((t - TC + 0.05) / 0.25) * (1 - spot * 0.6), spin: rot });
      }
      // la campana (vuela por encima de todo)
      cloche(c0, C, t, rot);
    });
    cutFlash(ctx, C, t, pp);
    // ---- vino, manos, brindis
    wineGlass1(ctx, C, t);
    wineGlass2(ctx, C, t);
    bottle(ctx, C, t);

    // ---- luz
    const tk = t - (TK - HIT);
    drawHalo(ctx, C, t, lit, flare + (tk > 0 ? 0.8 * Math.exp(-tk / 0.2) : 0));
    if (tk > -0.02 && tk < 0.9) {
      const [x, y, k] = project(C, CLINK.x, CLINK.y, CLINK.h);
      clinkStar(ctx, x, y, tk, 165 * k);
    }
    // pétalos de primer plano (desenfocados, parallax fuerte); se van hacia afuera en el empuje final
    drawFgPetals(ctx, C, t, E.inCubic(prog(t, 8.95, 9.3)));
    drawGustPetals(ctx, C, t);
    grade(ctx, C, t, amb, flare);
  },
};
export default scene;
