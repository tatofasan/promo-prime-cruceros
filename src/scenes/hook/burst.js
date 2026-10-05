// Reventón del monitor en hook.surge (plano D.desk): el mar se escapa de la pantalla como un DOMO DE AGUA que
// se hincha hacia cámara. Hasta ~3,40 el domo es una lente translúcida (la playa saturada se ve a través, con el
// filo oscuro de una lente de agua); después se carga y toma el color de la ola. Desde ~3,51 la ola de ART que
// entra por la derecha lo CHUPA: el domo se estira y se desliza abajo a la derecha hasta quedar como la base
// batida de esa ola (un solo sistema de agua) y la máscara de reveal-sea lo tapa.
// Piezas (todas con el vocabulario de agua de ART: waveColors, drawFoamLace, drawDrop): domo en 3 tonos con
// brillo especular y vetas de flujo, labio de encaje arriba, gotas grandes con sombra, chorros que caen sobre el
// escritorio con coronas y charquitos, y pocas astillas de vidrio. El destello del golpe es aqua y dura 3 cuadros.
import { waveColors, drawFoamLace, drawDrop } from '../../art/index.js';
import { PAL, rgba } from '../../engine/color.js';
import { lin, rad, fill, circlePath, ellipsePath, polyPath, smoothPath, sparkle } from '../../engine/draw.js';
import { E, clamp, prog, lerp, TAU } from '../../engine/ease.js';
import { hash } from '../../engine/noise.js';
import { MON, T } from './layout.js';
import { crackOrigin } from './screen.js';

export const burstCenter = [MON.cx, MON.cy + 10];
const C0 = burstCenter;
const N = 72;        // puntos del contorno
const BOTTOM = 712;  // la panza del domo no baja de acá (flota delante de la pantalla)
const LAND = 856;    // donde pegan los chorros (escritorio, delante de la base del monitor)
const DROPS = [], SHARDS = [];
let C = null;

export function initBurst() {
  // paleta del agua de ART (la misma de la ola): el domo es la misma agua que después la alimenta
  C = waveColors('golden');
  // gotas grandes: nacen en el borde del domo y salen disparadas (más hacia arriba y a los costados)
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI * (0.06 + 0.88 * hash(i, 31)) + (hash(i, 37) < 0.25 ? Math.PI * 0.85 : 0);
    DROPS.push({ a, ub: 0.01 + hash(i, 32) * 0.17, sp: 700 + hash(i, 33) * 800, r: 7 + Math.pow(hash(i, 34), 1.5) * 15 });
  }
  // pocas astillas de vidrio (el protagonista es el agua)
  const [ox, oy] = crackOrigin();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * 0.95 + hash(i, 21) * Math.PI * 1.1;
    const pts = [];
    for (let k = 0; k < 3; k++) { const b = (k / 3) * TAU + hash(i, k, 24) * 0.9; const r = 8 + hash(i, k, 25) * 16; pts.push([Math.cos(b) * r, Math.sin(b) * r]); }
    const sp = 900 + hash(i, 26) * 900;
    SHARDS.push({ x: ox + Math.cos(a) * 30, y: oy + Math.sin(a) * 20, pts, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 250, spin: (hash(i, 27) - 0.5) * 22 });
  }
}

// ------------------------------------------------------------------ forma del domo
/** Estado del domo en u = t − surge. m = cuánto lo chupó la ola (0 → 1 entre 3,51 y 3,61). */
function domeState(u) {
  // hinchado: sale con la forma de la pantalla, se redondea y crece con sobrepaso
  const g = E.backOut(1.4)(clamp(u / 0.13)) + 0.75 * E.inOutSine(clamp((u - 0.1) / 0.16));
  const n = lerp(6, 2.1, E.outCubic(clamp(u / 0.07)));
  const lean = E.inOutSine(clamp((u - 0.08) / 0.16));
  const m = E.inCubic(prog(u, 0.215, 0.3));
  // globo de agua: late (se estira y se aplasta) mientras se hincha
  const jig = 0.05 * Math.sin(u * 34) * Math.exp(-u * 4) * clamp(u / 0.03);
  const rx = (MON.w / 2 + 6 + 90 * g) * (1 + 0.35 * m) * (1 + jig), ry = (MON.h / 2 + 6 + 80 * g) * (1 - 0.5 * m) * (1 - jig);
  const cx = C0[0] + 50 * lean + 980 * m;
  const cy = C0[1] - 14 * g + 360 * m;
  return { g, rx, ry, n, lean, m, cx, cy };
}

function outline(u, s) {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = -Math.PI + (i / N) * TAU;
    const ca = Math.cos(a), sa = Math.sin(a);
    const R = Math.pow(Math.pow(Math.abs(ca) / s.rx, s.n) + Math.pow(Math.abs(sa) / s.ry, s.n), -1 / s.n);
    // ondulación suave (pocos lóbulos, sin dientes)
    const wob = 1 + Math.min(1, s.g) * (0.055 * Math.sin(3 * a + 1.3 + u * 12) + 0.035 * Math.sin(4 * a - u * 17) + 0.02 * Math.sin(7 * a + u * 9));
    let x = s.cx + ca * R * wob, y = s.cy + sa * R * wob;
    // el lado derecho se estira hacia la ola; con la succión el lado izquierdo se arrastra (cola)
    if (ca > 0) { x += 60 * s.lean * ca * ca; y -= 60 * s.lean * ca * Math.max(0, -sa); }
    else x -= 260 * s.m * ca * ca * (1 - s.m);
    // la panza flota delante de la pantalla (no se apoya en el escritorio)
    const floor = BOTTOM + 260 * s.m;
    if (y > floor) y = floor + (y - floor) * 0.25;
    pts.push([x, y]);
  }
  return pts;
}

/** Tramo de arriba del contorno (para el labio de encaje): de ~170° a ~10°. */
function upperArc(pts) {
  const out = [];
  for (let i = 0; i < N; i++) {
    const a = -Math.PI + (i / N) * TAU;
    if (a > -Math.PI * 0.94 && a < -Math.PI * 0.06) out.push(pts[i]);
  }
  return out;
}

// ------------------------------------------------------------------ piezas
/** Gota grande de ART (tres tonos + especular) con su sombra corrida. */
function bigDrop(ctx, x, y, r, vx, vy, a = 1) {
  ctx.save();
  ctx.globalAlpha *= a;
  fill(ctx, ellipsePath(x + r * 0.4, y + r * 0.6, r * 1.15, r * 0.9, Math.atan2(vy, vx)), rgba(PAL.navy700, 0.24));
  drawDrop(ctx, x, y, r, vx, vy, { preset: 'golden' });
  ctx.restore();
}

function drawShards(ctx, u) {
  if (u > 0.6) return;
  for (const s of SHARDS) {
    const x = s.x + s.vx * u, y = s.y + s.vy * u + 1600 * u * u;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(s.spin * u);
    ctx.scale(1 + u * 1.5, (1 + u * 1.5) * Math.cos(u * 10 + s.spin));
    const p = polyPath(s.pts);
    fill(ctx, p, rgba(PAL.aqua100, 0.4));
    ctx.strokeStyle = rgba(PAL.white, 0.95);
    ctx.lineWidth = 1.6;
    ctx.stroke(p);
    ctx.restore();
    const gl = Math.max(0, Math.sin(u * 18 + s.spin * 3));
    if (gl > 0.6) sparkle(ctx, x, y, 22 * (gl - 0.6) * 2.5, { alpha: 1, rot: s.spin });
  }
}

function drawDrops(ctx, u) {
  for (const d of DROPS) {
    const du = u - d.ub;
    if (du <= 0 || du > 0.75) continue;
    const s0 = domeState(d.ub);
    const ca = Math.cos(d.a), sa = Math.sin(d.a);
    const R0 = Math.pow(Math.pow(Math.abs(ca) / s0.rx, s0.n) + Math.pow(Math.abs(sa) / s0.ry, s0.n), -1 / s0.n);
    const vx = ca * d.sp + 120, vy = sa * d.sp - 180;
    const x = s0.cx + ca * R0 + vx * du, y = s0.cy + sa * R0 + vy * du + 1300 * du * du;
    const r = d.r * (1 + du * 0.9);
    bigDrop(ctx, x, y, r, vx, vy + 2600 * du, clamp((0.75 - du) / 0.2));
  }
}

/**
 * Cortina de agua que se derrama por el borde de abajo del monitor (ancha, con lenguas que se cortan en gotas) y
 * dos chorros en arco que salen de las esquinas. Donde pega en el escritorio queda una línea de espuma y rebotan
 * gotas.
 */
function drawSpill(ctx, u, s, t) {
  const fade = 1 - E.inQuad(clamp(s.m * 1.6));
  const uc = u - 0.02;
  if (fade <= 0.02 || uc <= 0) return;
  const V0 = 700, G = 2600;
  const yTop = BOTTOM - 8;
  const fall = Math.min(LAND - yTop, V0 * uc + 0.5 * G * uc * uc);
  const landed = yTop + fall >= LAND - 1;
  const x0 = s.cx - 0.6 * s.rx, x1 = s.cx + 0.5 * s.rx;
  // borde de abajo: lenguas que bajan a destiempo; solo las puntas llegan al escritorio (nada de borde recto)
  const fallP = fall / (LAND - yTop);
  const tongueAt = (x) => clamp(0.5 + 0.55 * Math.sin(x * 0.021 + 1.3 + t * 3) * Math.sin(x * 0.0083 + 0.4 - t * 2));
  const bot = (x) => Math.min(LAND, yTop + (LAND - yTop + 40) * fallP * (0.45 + 0.55 * tongueAt(x)) + 8 * Math.sin(x * 0.05 + t * 11));
  const top = [], btm = [];
  for (let x = x0; x <= x1 + 1; x += 22) {
    const e = clamp(Math.min(x - x0, x1 - x) / 50);
    top.push([x, yTop + 6 * (1 - e)]);
    btm.push([x, lerp(yTop + 6, bot(x), e)]);
  }
  const body = smoothPath([...top, ...btm.reverse()], true, 0.4);
  fill(ctx, body, lin(ctx, 0, yTop, 0, LAND, [rgba(C.face1, 0.95 * fade), rgba(C.face2, 0.85 * fade)]));
  ctx.save();
  ctx.clip(body);
  // vetas verticales que corren hacia abajo (claras y oscuras)
  for (let i = 0; i < 16; i++) {
    const x = x0 + hash(i, 71) * (x1 - x0);
    const y = yTop + ((t * 700 + hash(i, 72) * 200) % 200) - 40;
    ctx.fillStyle = rgba(i % 3 ? C.drop : C.face3, (i % 3 ? 0.45 : 0.25) * fade);
    ctx.fillRect(x, y, 3 + 3 * hash(i, 73), 40 + 70 * hash(i, 74));
  }
  ctx.restore();
  // filo de luz arriba (donde el agua dobla sobre el borde del monitor)
  ctx.strokeStyle = rgba(C.edge, 0.85 * fade);
  ctx.lineWidth = 3;
  ctx.beginPath(); top.forEach(([x, y], k) => (k ? ctx.lineTo(x, y + 4) : ctx.moveTo(x, y + 4))); ctx.stroke();
  // gotas que se sueltan de las lenguas
  for (let i = 0; i < 10; i++) {
    const x = x0 + 30 + hash(i, 75) * (x1 - x0 - 60);
    const q = (t * 2.6 + hash(i, 76)) % 1;
    const y = bot(x) + 10 + q * 90;
    if (y > LAND) continue;
    drawDrop(ctx, x, y, (4 + 4 * hash(i, 77)) * fade, 0, 600, { preset: 'golden', C });
  }
  // chorros en arco desde las esquinas
  for (const [sx, vx, w] of [[x0 + 10, -420, 30], [x1 - 10, 380, 24]]) {
    const pts = [];
    const tip = Math.min(uc, 0.3);
    for (let k = 0; k <= 12; k++) {
      const q = (k / 12) * tip;
      const y = yTop + 200 * q + 0.5 * G * q * q;
      if (y > LAND) break;
      pts.push([sx + vx * q, y]);
    }
    if (pts.length < 3) continue;
    const L = [], R = [];
    for (let k = 0; k < pts.length; k++) {
      const p0 = pts[Math.max(0, k - 1)], p1 = pts[Math.min(pts.length - 1, k + 1)];
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1;
      const ww = w * (1 - 0.5 * (k / 12)) * fade;
      L.push([pts[k][0] - (dy / l) * ww / 2, pts[k][1] + (dx / l) * ww / 2]);
      R.push([pts[k][0] + (dy / l) * ww / 2, pts[k][1] - (dx / l) * ww / 2]);
    }
    fill(ctx, smoothPath([...L, ...R.reverse()], true, 0.5), lin(ctx, 0, yTop, 0, LAND, [C.face1, C.face2]));
    ctx.strokeStyle = rgba(C.edge, 0.8 * fade);
    ctx.lineWidth = 2;
    ctx.beginPath(); L.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    const [ex, ey] = pts[pts.length - 1];
    drawDrop(ctx, ex, ey, w * 0.5 * fade, vx, 900, { preset: 'golden', C });
  }
  if (!landed) return;
  // espuma solo donde las lenguas tocan el escritorio, y gotas que rebotan
  const lu = uc - (-V0 + Math.sqrt(V0 * V0 + 2 * G * (LAND - yTop))) / G;
  let seg = [];
  const flush = () => { if (seg.length >= 3) drawFoamLace(ctx, t, seg, { width: (18 + 20 * clamp(lu / 0.15)) * fade, seed: 21 + seg.length, flow: 50, preset: 'golden', grain: 0.6, rag: 1.4, taper: [0.3, 0.3] }); seg = []; };
  for (let x = x0 - 10; x <= x1 + 10; x += 18) {
    if (bot(x) >= LAND - 2) seg.push([x, LAND + 4 + 4 * Math.sin(x * 0.04 + t * 8)]); else flush();
  }
  flush();
  for (let i = 0; i < 12; i++) {
    const q = ((lu * (1.4 + hash(i, 78)) + hash(i, 79)) % 0.32);
    const a = -Math.PI * (0.15 + 0.7 * hash(i, 80));
    const v = 260 + 240 * hash(i, 81);
    const x = x0 + hash(i, 82) * (x1 - x0) + Math.cos(a) * v * q, y = LAND + Math.sin(a) * v * q + 1400 * q * q;
    drawDrop(ctx, x, y, (3 + 3 * hash(i, 83)) * fade, Math.cos(a) * v, Math.sin(a) * v + 2800 * q, { preset: 'golden', C });
  }
}

// ------------------------------------------------------------------ el domo
function paintDome(ctx, u, s, t) {
  const pts = outline(u, s);
  // chupado por la ola: se deshace en espuma y spray (no queda una figura aparte)
  ctx.save();
  ctx.globalAlpha *= 1 - 0.9 * E.inQuad(s.m);
  const dome = smoothPath(pts, true, 0.5);
  // claridad del centro: lente translúcida hasta ~3,40, después agua cargada
  const clear = 1 - E.inQuad(prog(u, 0.07, 0.19));
  const aC = lerp(0.96, 0.2, clear);
  const Rg = Math.max(s.rx, s.ry) * 1.15;
  const lx = s.cx - 0.28 * s.rx, ly = s.cy - 0.32 * s.ry;
  // sombra que el domo proyecta sobre la pantalla y el escritorio
  ctx.save();
  ctx.translate(16, 24);
  fill(ctx, dome, rgba(PAL.navy700, 0.3 * (1 - clear * 0.6)));
  ctx.restore();
  // cuerpo: centro claro y transparente → cara turquesa → filo profundo (Fresnel)
  fill(ctx, dome, rad(ctx, lx, ly, 0, s.cx, s.cy, Rg, [
    [0, rgba(C.lipBack, aC * 0.75)], [0.38, rgba(C.face1, lerp(aC, 1, 0.25))], [0.66, rgba(C.face1, lerp(aC, 1, 0.75))],
    [0.86, rgba(C.face2, 1)], [1, rgba(C.face3, 1)],
  ]));
  ctx.save();
  ctx.clip(dome);
  // vetas de flujo: el agua corre desde el centro hacia el borde por la superficie del domo
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + hash(i, 51) * 0.4 + u * 0.8;
    const r0 = 0.2 + ((u * 1.6 + hash(i, 52)) % 1) * 0.55;
    const r1 = r0 + 0.16 + 0.12 * hash(i, 53);
    const w = 0.05 + 0.04 * hash(i, 54);
    const P = (r, da) => [s.cx + Math.cos(a + da) * s.rx * r, s.cy + Math.sin(a + da) * s.ry * r];
    fill(ctx, polyPath([P(r0, -w * 0.3), P((r0 + r1) / 2, -w), P(r1, 0), P((r0 + r1) / 2, w), P(r0, w * 0.3)]), rgba(C.glow, 0.16 + 0.12 * hash(i, 55)));
  }
  ctx.globalCompositeOperation = 'source-over';
  // volumen: sombra plana abajo a la derecha
  fill(ctx, dome, lin(ctx, s.cx - s.rx, s.cy - s.ry, s.cx + s.rx, s.cy + s.ry, [[0, rgba(C.face3, 0)], [0.6, rgba(C.face3, 0)], [1, rgba(C.face3, 0.45)]]));
  ctx.restore();
  // luz: brillo ancho y blando arriba a la izquierda (no un reflejo de vidrio) y cáusticas que ondulan
  ctx.save();
  ctx.clip(dome);
  fill(ctx, dome, rad(ctx, s.cx - 0.42 * s.rx, s.cy - 0.48 * s.ry, s.rx * 0.75, [[0, rgba(PAL.white, 0.34 * (1 - s.m))], [1, rgba(PAL.white, 0)]]));
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const yy = s.cy - s.ry * 0.7 + i * s.ry * 0.28;
    ctx.strokeStyle = rgba(C.glow, (0.2 + 0.1 * hash(i, 61)) * (1 - s.m));
    ctx.lineWidth = 2.5 + 2 * hash(i, 62);
    ctx.beginPath();
    for (let k = 0; k <= 16; k++) {
      const x = s.cx - s.rx + (k / 16) * 2 * s.rx;
      const y = yy + 10 * Math.sin(x * 0.02 + u * 14 + i * 1.7) + 5 * Math.sin(x * 0.051 - u * 9);
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  for (let i = 0; i < 4; i++) {
    const tw = Math.max(0, Math.sin(u * (14 + 5 * i) + i * 2));
    sparkle(ctx, s.cx + s.rx * (hash(i, 63) - 0.6) * 1.2, s.cy + s.ry * (hash(i, 64) - 0.65) * 1.1, (14 + 16 * hash(i, 65)) * tw * (1 - s.m), { alpha: tw, rot: 0.3 });
  }
  // filo de luz arriba a la izquierda
  ctx.strokeStyle = lin(ctx, s.cx - s.rx, s.cy - s.ry, s.cx + 0.1 * s.rx, s.cy + 0.1 * s.ry, [rgba(C.edge, 0.95), rgba(C.edge, 0)]);
  ctx.lineWidth = 4;
  ctx.stroke(dome);
  // labio de encaje: espuma donde el agua desborda (arriba), más batida cuando la chupa la ola
  ctx.restore();
  drawFoamLace(ctx, t, upperArc(pts), { width: 34 + 16 * Math.min(1.2, s.g) + 40 * s.m, seed: 3, flow: 80, preset: 'golden', grain: 0.9, holes: 0.5, taper: [0.2, 0.2] });
}

// ------------------------------------------------------------------ el estallido completo
export function drawBurst(ctx, t) {
  const u = t - T.surge;
  if (u < 0) return;
  const s = domeState(u);
  if (s.m >= 1) return; // ya es parte de la ola (debajo de la máscara)
  drawSpill(ctx, u, s, t);
  // bruma de agua alrededor
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const mr = 420 + 460 * Math.min(1.2, s.g);
  fill(ctx, circlePath(s.cx, s.cy, mr), rad(ctx, s.cx, s.cy - 40, mr, [[0, rgba(PAL.aqua200, 0.12 * Math.min(1, s.g))], [1, rgba(PAL.aqua200, 0)]]));
  ctx.restore();
  // (la succión es tan rápida que el desenfoque de movimiento del render final ya la barre)
  paintDome(ctx, u, s, t);
  drawDrops(ctx, u);
  drawShards(ctx, u);
  // destello del golpe: aqua, 3 cuadros
  const fl = u < 0.05 ? [0.75, 0.42, 0.15][Math.min(2, Math.floor(u * 60))] : 0;
  if (fl > 0) {
    const [ox, oy] = crackOrigin();
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    fill(ctx, circlePath(ox, oy, 560), rad(ctx, ox, oy, 560, [[0, rgba(PAL.aqua100, fl)], [0.35, rgba(PAL.aqua200, 0.5 * fl)], [1, rgba(PAL.aqua200, 0)]]));
    ctx.restore();
  }
}
