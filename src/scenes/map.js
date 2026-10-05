// Mapa, ruta, pines y navieras. Equipo MAP. Contrato: docs/PLAN.md §6.4 y §7.
// 13,125 el sol se vuelve el pin de marca sobre Buenos Aires (squash, halo cálido que se enfría) · la cámara se
// aleja y revela el mapamundi · la ruta (siempre por mar) se dibuja sola con el barquito · los pines caen en su
// beat y su postal hace pop con el pico EN el cue y queda quieta en pantalla (con un hilo a su pin) · látigo
// al sur con el pico en map.whip · la red completa brilla con todos los rótulos · navieras sobre el mapa
// desenfocado · látigo hacia ARRIBA hacia `value`.
import { W, H } from '../engine/time.js';
import { makeCanvas } from '../engine/env.js';
import { resetLayers } from '../engine/layer.js';
import { PAL, rgba } from '../engine/color.js';
import { E, clamp, prog, lerp, smoothstep, TAU } from '../engine/ease.js';
import { hash } from '../engine/noise.js';
import { sparkle, lensFlare, lightSweep, bake } from '../engine/draw.js';
import { beatPulse } from '../engine/time.js';
import { PLACES, ROUTES } from './map/world.js';
import { T, WH, AL, Z_IN, camAt, camVel, zoomVel, toScr, pinSizeFor } from './map/mapcam.js';
import { initTerrain, drawOcean, drawLand, drawCities } from './map/terrain.js';
import { initClouds, drawClouds, drawCloudShadows, drawCloudSprite } from './map/clouds.js';
import { drawCompass } from './map/compass.js';
import { initRoutes, drawRoutes, drawShips, networkGlow, LEGS } from './map/route.js';
import { dropState, drawShadedPin, drawPinShadow, drawPing } from './map/pins.js';
import { initSoft, soft, smearSoft, zoomSmear, withPad, fullRect } from './map/soft.js';
import { drawPostcard, CARD_EXT } from './map/postcard.js';
import { pinLabel, labelBox, drawTransLabel, SAFE, TRANS_MID } from './map/labels.js';
import { initLines, drawLines, linesVeil, exitVel, LT } from './map/lines.js';
import * as artUy from './map/art/uy.js';
import * as artBr from './map/art/br.js';
import * as artCar from './map/art/car.js';
import * as artEu from './map/art/eu.js';
import * as artDxb from './map/art/dxb.js';
import * as artAnt from './map/art/ant.js';

// pines de destino (el de Buenos Aires es especial: es el sol del corte)
const PINS = [
  { id: 'uy', at: 'pde', t: T.uy },
  { id: 'br', at: 'rio', t: T.br },
  { id: 'car', at: 'car', t: T.car },
  { id: 'eu', at: 'eu', t: T.eu },
  { id: 'dxb', at: 'dxb', t: T.dxb },
  { id: 'ant', at: 'ant', t: T.ant },
];

// Postales: el pop tiene el pico EN el cue (arranca 0,16 s antes), queda QUIETA en pantalla en su ancla
// (pin en el cue + desplazamiento, dentro del área segura) unida a su pin por un hilo, y en tOut vuelve a
// meterse en el pin ('pin') o se va con el mapa ('follow', en el látigo).
const CARDS = [
  { art: artUy, label: 'URUGUAY', at: 'pde', cue: T.uy, tOut: T.uy + 0.42, off: [-250, -250], rot: -0.05 },
  { art: artBr, label: 'BRASIL', at: 'rio', cue: T.br, tOut: T.br + 0.44, off: [265, 12], rot: 0.045 },
  { art: artCar, label: 'CARIBE', at: 'car', cue: T.car, tOut: T.car + 0.42, off: [-270, -150], rot: -0.04 },
  { art: artEu, label: 'EUROPA', at: 'eu', cue: T.eu, tOut: T.eu + 0.44, off: [-250, -190], rot: 0.045 },
  { art: artDxb, label: 'DUBÁI', at: 'dxb', cue: T.dxb, tOut: WH.w0, off: [250, -185], rot: -0.04, exit: 'follow' },
  { art: artAnt, label: 'ANTÁRTIDA', at: 'ant', cue: T.ant, tOut: T.all - 0.09, off: [280, -170], rot: 0.04, exit: 'pop' },
];
const CARD_LEAD = 0.16;

// rótulos de la red completa (map.all): [texto, lugar, lado]
const ALL_LABELS = [
  ['BUENOS AIRES', 'ba', 'l'], ['URUGUAY', 'pde', 'r'], ['BRASIL', 'rio', 'r'], ['CARIBE', 'car', 'l'],
  ['EUROPA', 'eu', 'rd'], ['DUBÁI', 'dxb', 'r'], ['ANTÁRTIDA', 'ant', 'u'],
];
// orden de la cascada (índices; 7 = TRANSATLÁNTICOS) y su arranque: la red se nombra mientras la cámara termina
// de abrirse, así todo está completo antes de 17,95 y se relee hasta que entra el velo de las navieras. EU y
// TRANSATLÁNTICOS van al final porque recién entonces su caja entra en el área segura.
const ALL_ORDER = [0, 1, 2, 3, 5, 6, 7, 4];
const CASCADE_FROM = T.all - 0.175;
const ALL_SIZE = 33;           // mayúscula ≈ 23 px
const LABEL_LEAD = 0.06;       // del inicio del pop a «completo»
const BA_LABEL = { tIn: T.in + 0.27, tOut: T.uy - 0.2, size: 28 };
let ALL_IN = null;             // inicio del pop de cada rótulo de map.all (+ TRANSATLÁNTICOS al final)

const fanFor = (z) => clamp((0.98 - z) / 0.25);

// ------------------------------------------------------------------ postales
function cardState(C, t) {
  const t0 = C.cue - CARD_LEAD;
  if (t < t0) return null;
  const outP = clamp((t - C.tOut) / (C.exit === 'follow' ? 0.4 : C.exit === 'pop' ? 0.18 : 0.22));
  if (outP >= 1) return null;
  const c0 = camAt(C.cue);
  const sz0 = pinSizeFor(c0.z);
  const [px0, py0] = toScr(c0, ...PLACES[C.at]);
  // ancla quieta en pantalla, metida en el área segura (con el rótulo de abajo y el giro)
  const ax = clamp(px0 + C.off[0], SAFE.x0 + CARD_EXT.hw + 8, SAFE.x1 - CARD_EXT.hw - 8);
  const ay = clamp(py0 + C.off[1], SAFE.y0 + CARD_EXT.up + 10, SAFE.y1 - CARD_EXT.down - 10);
  const cam = camAt(t);
  const [px, py] = toScr(cam, ...PLACES[C.at]);
  const head = [px, py - pinSizeFor(cam.z) * 0.62];
  const head0 = [px0, py0 - sz0 * 0.62];
  // entra: escala con overshoot (pico en el cue) y sale disparada de la cabeza del pin hasta el ancla
  const dt = t - t0;
  const sIn = E.backOut(1.9)(clamp(dt / CARD_LEAD)) * (dt > CARD_LEAD ? 1 + 0.035 * Math.exp(-(dt - CARD_LEAD) * 8) * Math.sin((dt - CARD_LEAD) * 24) : 1);
  const fly = E.outCubic(clamp(dt / (CARD_LEAD * 0.75)));
  let x = lerp(head0[0], ax, fly), y = lerp(head0[1], ay, fly), s = Math.max(0, sIn);
  let rot = C.rot + (1 - E.backOut(2)(clamp(dt / 0.3))) * -0.35 + 0.03 * Math.exp(-Math.max(0, dt - CARD_LEAD) * 5) * Math.sin(dt * 13);
  if (t > C.tOut) {
    if (C.exit === 'follow') {
      // se va CON el mapa (el látigo la arrastra con el mismo smear que el resto)
      const c1 = camAt(C.tOut);
      const [qx, qy] = toScr(c1, ...PLACES[C.at]);
      x = ax + (px - qx);
      y = ay + (py - qy);
    } else if (C.exit === 'pop') {
      // se cierra en su lugar (no cruza la red que se está nombrando)
      s *= Math.max(0, 1 - E.backIn(2)(outP));
    } else {
      const e = E.inCubic(outP);
      x = lerp(ax, head[0], e);
      y = lerp(ay, head[1], e);
      s *= Math.max(0, 1 - E.backIn(1.6)(outP));
      rot += outP * 0.4;
    }
  }
  return { x, y, s, rot, head, chipIn: t0 + 0.02 };
}

function drawLeader(ctx, st) {
  const { x, y, s, head } = st;
  if (s < 0.35) return;
  // del borde de la postal más cercano al pin hasta la cabeza del pin (hilo con un punto)
  const dx = head[0] - x, dy = head[1] - y;
  const d = Math.hypot(dx, dy);
  if (d < CARD_EXT.up + 20) return;
  const ex = clamp(dx, -CARD_EXT.hw * 0.8 * s, CARD_EXT.hw * 0.8 * s), ey = clamp(dy, -CARD_EXT.up * 0.8 * s, CARD_EXT.down * 0.9 * s);
  const x0 = x + ex, y0 = y + ey;
  const mx = (x0 + head[0]) / 2, my = (y0 + head[1]) / 2 + Math.min(80, d * 0.12);
  ctx.save();
  ctx.globalAlpha *= clamp((s - 0.35) / 0.4);
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(PAL.ink, 0.35);
  ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(x0 + 2, y0 + 3); ctx.quadraticCurveTo(mx + 2, my + 3, head[0] + 2, head[1] + 3); ctx.stroke();
  ctx.strokeStyle = rgba(PAL.aqua100, 0.85);
  ctx.lineWidth = 2.2;
  ctx.setLineDash([10, 7]);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, head[0], head[1]); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = PAL.white;
  ctx.beginPath(); ctx.arc(head[0], head[1], 4.5, 0, TAU); ctx.fill();
  ctx.restore();
}

/** inWorld: true = solo las que se van CON el mapa (van dentro del smear); false = las quietas en pantalla. */
function drawCards(ctx, t, inWorld = null) {
  for (const C of CARDS) {
    if (inWorld !== null && (C.exit === 'follow' && t > C.tOut) !== inWorld) continue;
    const st = cardState(C, t);
    if (!st || st.s <= 0.01) continue;
    drawLeader(ctx, st);
    const artOpts = C.at === 'ant' ? { flash: 0.55 + 0.45 * Math.sin(t * 3) + 1.4 * Math.exp(-Math.max(0, t - T.ant - 0.15) * 5) } : {};
    drawPostcard(ctx, t, { art: C.art, label: C.label, x: st.x, y: st.y, s: st.s, rot: st.rot, tIn: C.cue - CARD_LEAD, chipIn: st.chipIn, artOpts });
  }
}

// ------------------------------------------------------------------ rótulos
/** Agenda de map.all: cada rótulo hace pop apenas su caja queda dentro del área segura (y se queda), con 2
 *  cuadros de escalonado entre rótulos. Se calcula una vez (la cámara es función pura de t). */
function scheduleAll() {
  const from = T.all - 0.2, until = T.lines - 0.16;
  const inside = (b) => b[0] >= SAFE.x0 + 4 && b[2] <= SAFE.x1 - 4 && b[1] >= SAFE.y0 + 4 && b[3] <= SAFE.y1 - 4;
  const okAt = (i, t) => {
    const cam = camAt(t);
    if (i === ALL_LABELS.length) {
      // TRANSATLÁNTICOS: el medio del Atlántico del arco D con lugar para las letras
      const [x, y] = toScr(cam, ...transMid());
      return inside([x - 230, y - 75, x + 230, y + 5]);
    }
    const [text, at, side] = ALL_LABELS[i];
    const [x, y] = toScr(cam, ...PLACES[at]);
    const sz = pinSizeFor(cam.z);
    // caja SIN el recorte al área segura: tiene que entrar sola
    const raw = labelBox(text, x, y, sz, { side, size: ALL_SIZE });
    const off = sz * 0.42;
    const hy = y - sz * (side === 'rd' ? -0.05 : 0.62);
    const x0 = side === 'l' ? x - off - raw.w : side === 'u' ? x - raw.w / 2 : x + off;
    const y0 = side === 'u' ? y - sz * 1.18 - raw.h : hy - raw.h / 2;
    return inside([x0, y0, x0 + raw.w, y0 + raw.h]);
  };
  const ready = [];
  for (let i = 0; i <= ALL_LABELS.length; i++) {
    let r = until;
    for (let t = from; t < until; t += 1 / 120) {
      let ok = true;
      for (let u = t; u < until; u += 1 / 30) if (!okAt(i, u)) { ok = false; break; }
      if (ok) { r = t; break; }
    }
    ready.push(r);
  }
  // cascada de 2 cuadros en orden fijo (la Antártida al final: su postal termina de irse)
  const out = new Array(ALL_LABELS.length + 1);
  let last = -Infinity;
  for (const i of ALL_ORDER) {
    const st = Math.max(ready[i] - LABEL_LEAD, last + 2 / 60, CASCADE_FROM);
    out[i] = st;
    last = st;
  }
  return out;
}
let TMID = null;
function transMid() {
  if (TMID) return TMID;
  const L = LEGS.find((l) => l.id === 'D');
  const s = L.len[transGib(L)] * TRANS_MID;
  let k = 1;
  while (k < L.len.length - 1 && L.len[k] < s) k++;
  TMID = L.pts[k];
  return TMID;
}
function transGib(L) {
  const g = ROUTES.D[6];
  let best = 0, bd = Infinity;
  L.pts.forEach(([x, y], i) => { const d = Math.hypot(x - g[0], y - g[1]); if (d < bd) { bd = d; best = i; } });
  return best;
}

/** Rótulo de Buenos Aires: va en la pasada de UI (fuera del barrido radial del alejamiento) para leerse nítido
 *  aunque la cámara se dispare en map.route. */
function drawBALabel(ctx, cam, t) {
  if (t >= BA_LABEL.tOut + 0.25) return;
  const [x, y] = toScr(cam, ...PLACES.ba);
  pinLabel(ctx, t, 'BUENOS AIRES', x, y, baSize(cam), { tIn: BA_LABEL.tIn, side: 'l', size: BA_LABEL.size, tOut: BA_LABEL.tOut, dur: 0.3 });
}

function drawLabels(ctx, cam, t) {
  if (t < T.all - 0.1) return;
  const size = pinSizeFor(cam.z);
  ALL_LABELS.forEach(([text, at, side], i) => {
    const [x, y] = toScr(cam, ...PLACES[at]);
    pinLabel(ctx, t, text, x, y, size, { tIn: ALL_IN[i], side, size: ALL_SIZE, dur: 0.2 });
  });
}

/** Tamaño del pin de BA: 285 px en el corte (z = Z_IN), atado al alejamiento de la cámara. */
function baSize(cam) {
  const f = clamp((Math.log(cam.z) - Math.log(Z_IN * 0.375)) / (Math.log(Z_IN) - Math.log(Z_IN * 0.375)));
  const end = pinSizeFor(cam.z) * 1.1;
  return lerp(end, 285, Math.pow(f, 1.15));
}

/** Latido de los pines en map.all (cascada desde Buenos Aires) y la inspiración de map.hold. */
function allBeat(t, i) {
  const t0 = T.all + 0.03 * i;
  const dt = t - t0;
  if (dt < 0) return 0;
  const hold = -0.6 * E.inOutSine(prog(t, T.hold, T.lines - 0.06)) * (1 - prog(t, T.lines - 0.06, T.lines + 0.08));
  return Math.exp(-dt * 7) * Math.sin(dt * 26) + hold;
}

/** Squash del pin de BA al aterrizar: 1,25×0,8 a los 3 cuadros y rebote de resorte. */
function baSquash(t) {
  const dt = t - T.in;
  if (dt <= 0) return 0;
  if (dt < 0.05) return Math.sin((Math.PI / 2) * (dt / 0.05));
  const q = dt - 0.05;
  return Math.cos((TAU * q) / 0.2) * Math.exp(-q * 9);
}

function drawPins(ctx, cam, t) {
  const size = pinSizeFor(cam.z);
  const fan = fanFor(cam.z);
  const items = [];
  // Buenos Aires
  {
    const [x, y] = toScr(cam, ...PLACES.ba);
    const dt = t - T.in;
    const a = baSquash(t);
    const b = allBeat(t, 0);
    items.push({
      y: y - 1, draw: () => {
        const sz = baSize(cam);
        drawPinShadow(ctx, x, y, sz, { alpha: clamp(dt / 0.15), long: smoothstep(T.in + 0.22, T.in + 0.5, t) });
        drawPing(ctx, x, y, sz, t, T.in, { big: 0.9, seed: 3 });
        drawPing(ctx, x, y, size, t, T.all, { seed: 9 });
        drawPing(ctx, x, y, size * 0.8, t, T.route, { seed: 5, color: PAL.goldLight });
        drawShadedPin(ctx, x, y, sz * (1 + 0.12 * b), {
          sx: 1 + 0.25 * a - 0.06 * b, sy: 1 - 0.2 * a + 0.08 * b, t, rot: -0.3 * fan,
        });
      },
    });
  }
  PINS.forEach((P, i) => {
    const d = dropState(t, P.t, size);
    if (!d) return;
    const [x, y] = toScr(cam, ...PLACES[P.at]);
    const b = allBeat(t, i + 1);
    const rot = P.at === 'pde' ? 0.3 * fan : 0;
    items.push({
      y, draw: () => {
        drawPinShadow(ctx, x, y, size, { h: Math.max(0, d.h), alpha: d.a });
        drawPing(ctx, x, y, size, t, P.t, { seed: 11 + i });
        drawPing(ctx, x, y, size, t, T.all + 0.03 * (i + 1), { seed: 21 + i });
        drawShadedPin(ctx, x, y + d.y, size * (1 + 0.12 * b), { sx: d.sx - 0.06 * b, sy: d.sy + 0.08 * b, alpha: d.a, t, rot });
      },
    });
  });
  items.sort((a, c) => a.y - c.y).forEach((it) => it.draw());
}

/** Destello helado al caer el pin de la Antártida. */
function iceFlash(ctx, cam, t) {
  const dt = t - T.ant;
  if (dt < -0.02 || dt > 0.6) return;
  const k = dt < 0 ? 0 : Math.exp(-dt * 6);
  const [x, y] = toScr(cam, ...PLACES.ant);
  const size = pinSizeFor(cam.z);
  lensFlare(ctx, x, y - size * 0.6, { intensity: 0.9 * k, tint: PAL.aqua200, streak: 700, core: 70, ghosts: false });
  sparkle(ctx, x - size * 0.2, y - size * 1.05, size * 0.75 * k, { alpha: k, color: PAL.white, rot: dt * 2 });
}

/** Barrido de luz diagonal sobre todo el mapa cuando la red se enciende (map.all). */
function mapSweep(ctx, t) {
  const p = prog(t, T.all + 0.05, T.all + 0.75);
  if (p <= 0 || p >= 1) return;
  const full = new Path2D();
  full.rect(0, 0, W, H);
  lightSweep(ctx, full, { x: 0, y: 0, w: W, h: H }, E.inOutSine(p), { angle: -0.5, width: 0.3, color: PAL.aqua100, alpha: 0.24, blend: 'screen' });
}

// ------------------------------------------------------------------ entrada (corte con el sol)
/**
 * Grade cálido de la entrada: el atardecer termina luminoso y cálido; el mapa arranca con un velo
 * durazno/coral que se enfría hacia el navy en 8 cuadros mientras la cámara se aleja (sin salto de luma), y un
 * halo coral alrededor del pin que se apaga en 6–8 cuadros.
 */
function entryGrade(ctx, cam, t) {
  const k = 1 - smoothstep(T.in, T.in + 0.135, t);
  if (k <= 0.002) return;
  const [x, y] = toScr(cam, ...PLACES.ba);
  const sz = baSize(cam);
  const cx = x, cy = y - (sz * (594 - 250)) / 594;
  ctx.save();
  // grade cálido (continúa el cielo del atardecer) que se enfría: el mapa toma el tono del sol ('color':
  // tono y saturación del degradé, luminosidad del mapa) y se aclara un poco ('screen') para no saltar de luz
  ctx.globalCompositeOperation = 'color';
  const g = ctx.createRadialGradient(cx, cy, sz * 0.3, cx, cy, W * 0.8);
  g.addColorStop(0, rgba(PAL.gold, 0.95 * k));
  g.addColorStop(0.35, rgba(PAL.coral, 0.92 * k));
  g.addColorStop(1, rgba(PAL.sunsetPink, 0.85 * k));
  ctx.fillStyle = g;
  ctx.fillRect(...fullRect());
  ctx.globalCompositeOperation = 'screen';
  const g2 = ctx.createRadialGradient(cx, cy, sz * 0.3, cx, cy, W * 0.8);
  g2.addColorStop(0, rgba(PAL.peach, 0.42 * k));
  g2.addColorStop(1, rgba(PAL.coral, 0.26 * k));
  ctx.fillStyle = g2;
  ctx.fillRect(...fullRect());
  // halo coral/naranja pegado al pin
  ctx.globalCompositeOperation = 'lighter';
  const r = sz * 0.75;
  const h = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.4);
  h.addColorStop(0, rgba(PAL.coral, 0.55 * k));
  h.addColorStop(0.5, rgba(PAL.brandOrange, 0.2 * k));
  h.addColorStop(1, rgba(PAL.brandOrange, 0));
  ctx.fillStyle = h;
  ctx.fillRect(cx - r * 2.4, cy - r * 2.4, r * 4.8, r * 4.8);
  ctx.restore();
}

/** Rayos del sol que siguen girando un instante y se apagan (puente de forma con `sunset`). */
function sunResidue(ctx, cam, t) {
  const k = 1 - clamp((t - T.in) / 0.2);
  if (k <= 0) return;
  const [x, y] = toScr(cam, ...PLACES.ba);
  const sz = baSize(cam);
  const cx = x, cy = y - (sz * (594 - 250)) / 594;
  const r = sz * 0.5;
  ctx.save();
  const e = E.outCubic(1 - k);
  const L = r * (2.6 + 2.2 * e);
  ctx.translate(cx, cy);
  ctx.rotate(0.25 + (t - T.in) * 0.9);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + hash(i, 63) * 0.2;
    const w = 0.03 + 0.02 * hash(i, 61);
    const len = L * (0.75 + 0.45 * hash(i, 62));
    const rg = ctx.createRadialGradient(0, 0, r * 1.1, 0, 0, len);
    rg.addColorStop(0, rgba(PAL.goldLight, 0));
    rg.addColorStop(0.3, rgba(PAL.goldLight, 0.28 * k * k));
    rg.addColorStop(1, rgba(PAL.gold, 0));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, len, a - w, a + w);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Ondas de luz sobre el mapa: «ping» que se expande en cada aterrizaje y al arrancar la ruta (dorado, más
 *  fuerte: la ruta «sale» con un golpe de luz) y, en map.hold, un anillo dorado que se CONTRAE hacia Buenos Aires
 *  (la red toma aire antes de las navieras). [lugar, t, { color, a (alfa), dur, reach (px), dir: 'out' | 'in' }] */
const SONAR = [
  ['ba', T.route, { color: PAL.goldLight, a: 0.42, dur: 0.7, reach: 1500 }],
  ['pde', T.uy], ['rio', T.br], ['car', T.car], ['eu', T.eu], ['dxb', T.dxb], ['ant', T.ant],
  ['ba', T.hold, { color: PAL.goldLight, a: 0.4, dur: T.lines - 0.06 - T.hold, reach: 1500, dir: 'in' }],
];
function sonar(ctx, cam, t) {
  for (const [at, te, o = {}] of SONAR) {
    const dur = o.dur ?? 0.6;
    const dt = t - te;
    if (dt < 0 || dt > dur) continue;
    const q = dt / dur;
    const col = o.color ?? PAL.aqua100;
    const [x, y] = toScr(cam, ...PLACES[at]);
    let r, w, a;
    if (o.dir === 'in') {
      // entra desde afuera del cuadro y se cierra acelerando sobre el pin (se enciende y se apaga en los bordes)
      const e = E.inQuad(q);
      r = 30 + (o.reach - 30) * (1 - e);
      w = 90 + 200 * (1 - q);
      a = o.a * Math.sin(Math.PI * Math.min(1, q * 1.08)) ** 0.5;
    } else {
      r = 30 + (o.reach ?? 1250) * E.outCubic(q);
      w = 60 + 160 * q;
      a = (o.a ?? 0.3) * (1 - q) * (1 - q);
    }
    if (a <= 0.004) continue;
    const R = r + w * 0.4;
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    const i0 = Math.max(0, (r - w) / R), i1 = r / R;
    g.addColorStop(0, rgba(col, 0));
    g.addColorStop(i0, rgba(col, 0));
    g.addColorStop(i1, rgba(col, a));
    g.addColorStop(1, rgba(col, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    const x0 = Math.max(-PADW(), x - R), y0 = Math.max(-PADW(), y - R);
    ctx.fillRect(x0, y0, Math.min(W + PADW(), x + R) - x0, Math.min(H + PADW(), y + R) - y0);
    ctx.restore();
  }
}
const PADW = () => -fullRect()[0];

/** UI quieta en pantalla (postales y TRANSATLÁNTICOS): va FUERA de los smears para leerse nítida. */
function drawUI(ctx, cam, t) {
  drawBALabel(ctx, cam, t);
  drawTransLabel(ctx, cam, t, { phase2In: ALL_IN[ALL_LABELS.length] });
  drawCards(ctx, t, false);
}

/** Brillo de los continentes: la red encendida (map.all) + un latido con el bombo. */
function landGlow(t) {
  // el primer golpe (map.all) enciende los continentes de una: la red completa «se prende»
  return Math.min(1, networkGlow(t) * 0.6 + 0.5 * beatPulse(t, { from: T.all, every: 1, decay: 0.13 }));
}

function drawWorld(ctx, cam, t, { ui = true } = {}) {
  // fondo NÍTIDO también en el corte: desenfocado de cerca, el estuario se leía como una mancha (una «mano»)
  // señalando el pin; la costa del Río de la Plata tiene que verse limpia desde el primer cuadro
  drawOcean(ctx, cam);
  drawCompass(ctx, cam, t);
  drawLand(ctx, cam, t, { glow: landGlow(t) });
  drawCities(ctx, cam, t, { boost: networkGlow(t) });
  drawCloudShadows(ctx, cam, t);
  drawRoutes(ctx, cam, t);
  sonar(ctx, cam, t);
  drawClouds(ctx, cam, t);
  entryGrade(ctx, cam, t);
  sunResidue(ctx, cam, t);
  if (ui) drawTransLabel(ctx, cam, t, { phase2In: ALL_IN[ALL_LABELS.length] });
  drawShips(ctx, cam, t, clamp(pinSizeFor(cam.z) * 0.92, 50, 86));
  drawPins(ctx, cam, t);
  if (ui) drawBALabel(ctx, cam, t);
  drawLabels(ctx, cam, t);
  drawCards(ctx, t, ui ? null : true);
  iceFlash(ctx, cam, t);
  mapSweep(ctx, t);
}

// ------------------------------------------------------------------ navieras: mapa desenfocado precalculado
// Desde TS el mapa de fondo está velado y desenfocado 14 px: en vez de redibujarlo entero en cada cuadro, se
// pinta UNA vez en init (con margen, sobre todo abajo por el látigo hacia arriba) y se reubica con la cámara
// viva (push-in y paneo: parallax contra el bloque). Encima van pines que laten, bokeh y las navieras.
const TS = 18.9;
const SNAP = { l: 220, r: 220, t: 200, b: 760 };
let SNAPC = null;
function buildSnap() {
  const w = Math.ceil((W + SNAP.l + SNAP.r) / 2), h = Math.ceil((H + SNAP.t + SNAP.b) / 2);
  const a = makeCanvas(w, h), ac = a.getContext('2d');
  ac.setTransform(0.5, 0, 0, 0.5, SNAP.l / 2, SNAP.t / 2);
  withPad(Math.max(SNAP.l, SNAP.b), () => drawWorld(ac, camAt(TS), TS));
  const b = makeCanvas(w, h), bc = b.getContext('2d');
  bc.filter = 'blur(4.5px)';
  bc.drawImage(a, 0, 0);
  SNAPC = bake(b);
}
function drawSnap(ctx, cam) {
  const s = camAt(TS);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  if (cam.r) ctx.rotate(cam.r);
  ctx.scale(cam.z, cam.z);
  ctx.translate(s.cx - cam.cx, s.cy - cam.cy);
  ctx.scale(1 / s.z, 1 / s.z);
  if (s.r) ctx.rotate(-s.r);
  ctx.translate(-W / 2, -H / 2);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(SNAPC, -SNAP.l, -SNAP.t, W + SNAP.l + SNAP.r, H + SNAP.t + SNAP.b);
  ctx.restore();
}

function veilOver(c, veil, t) {
  c.save();
  // el velo «respira» con el bombo: el mapa de fondo se ilumina un instante en cada beat
  const kick = 1 - 0.42 * beatPulse(t, { from: LT.t0, every: 1, decay: 0.14 }) - 0.18 * beatPulse(t, { from: LT.t0, every: 1, decay: 0.1, offset: 0.5 });
  const g = c.createRadialGradient(W / 2, H * 0.5, 100, W / 2, H * 0.5, W * 0.7);
  g.addColorStop(0, rgba(PAL.navy900, 0.4 * veil * kick));
  g.addColorStop(1, rgba(PAL.ink, 0.7 * veil * kick));
  c.fillStyle = g;
  c.fillRect(...fullRect());
  c.restore();
}

/** Nubes de primer plano en las navieras: velos grandes y blandos en un plano MÁS CERCANO que el mapa
 *  desenfocado (se mueven 2,6× lo que viaja el mapa + su deriva): profundidad y vida detrás del bloque. Van
 *  arriba del velo y debajo del texto, y nunca pasan por el centro del bloque con alfa alto. */
const NCLOUDS = [
  // [x, y en pantalla en TS, ancho, sprite, deriva px/s, alfa]
  [180, 170, 760, 0, -60, 0.2], [1700, 260, 680, 2, -45, 0.17], [1500, 930, 900, 1, -70, 0.2], [420, 990, 820, 3, -50, 0.18],
  [2450, 620, 760, 2, -55, 0.16],
];
/** Parallax del bokeh de las navieras: el viaje de la cámara desde TS, amplificado (plano más cercano). */
function bokehPar(cam) {
  const s = camAt(TS);
  return [-(cam.cx - s.cx) * cam.z * 1.8, -(cam.cy - s.cy) * cam.z * 1.8];
}
function linesClouds(ctx, cam, t, veil) {
  if (veil < 0.05) return;
  const s = camAt(TS);
  const k = 1.6; // parallax extra
  for (const [x0, y0, w, sp, drift, a] of NCLOUDS) {
    // posición del ancla de pantalla según la cámara viva (mapa) amplificada por el parallax
    const dz = cam.z / s.z;
    const mx = (x0 - W / 2) * dz * (1 + 0.6 * (dz - 1)) + W / 2 - (cam.cx - s.cx) * cam.z * k + drift * (t - TS);
    const my = (y0 - H / 2) * dz * (1 + 0.6 * (dz - 1)) + H / 2 - (cam.cy - s.cy) * cam.z * k;
    drawCloudSprite(ctx, sp, mx, my, w * dz, a * veil);
  }
}

/** Pines que laten en el desenfoque (navieras): halos naranja/dorado en el bombo, en cascada. */
function beacons(ctx, cam, t, veil) {
  if (veil < 0.05) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const ids = ['ba', 'pde', 'rio', 'car', 'eu', 'dxb', 'ant'];
  ids.forEach((id, i) => {
    const [x, y0] = toScr(cam, ...PLACES[id]);
    const y = y0 - 30;
    const p = beatPulse(t, { from: LT.t0, every: 1, decay: 0.16, offset: i * 0.14 });
    const r = 55 + 165 * p;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(PAL.coralLight, (0.22 + 0.7 * p) * veil));
    g.addColorStop(0.4, rgba(PAL.brandOrange, (0.1 + 0.26 * p) * veil));
    g.addColorStop(1, rgba(PAL.brandOrange, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  });
  ctx.restore();
}

/** Líneas de velocidad del látigo: trazos finos que cruzan en la dirección del movimiento. */
function speedLines(ctx, t, vx, vy, k) {
  if (k <= 0.01) return;
  const v = Math.hypot(vx, vy);
  const ux = vx / v, uy = vy / v;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const h1 = hash(i, 71), h2 = hash(i, 72), h3 = hash(i, 73);
    const off = (h1 - 0.5) * 2400;
    const along = ((h2 * 3000 + t * 9000 * (0.7 + h3)) % 3600) - 1800;
    const cx = W / 2 - uy * off + ux * along, cy = H / 2 + ux * off + uy * along;
    const len = (160 + 380 * h3) * k;
    const g = ctx.createLinearGradient(cx - ux * len, cy - uy * len, cx + ux * len, cy + uy * len);
    g.addColorStop(0, rgba(PAL.aqua100, 0));
    g.addColorStop(0.5, rgba(PAL.white, 0.5 * k * (0.4 + 0.6 * h2)));
    g.addColorStop(1, rgba(PAL.aqua100, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.5 + 2.5 * h1;
    ctx.beginPath(); ctx.moveTo(cx - ux * len, cy - uy * len); ctx.lineTo(cx + ux * len, cy + uy * len); ctx.stroke();
  }
  ctx.restore();
}

const scene = {
  id: 'map',
  team: 'MAP',
  from: 13.125,
  to: 20.625,
  z: 70,
  async init() {
    initTerrain();
    initRoutes();
    initSoft();
    initClouds();
    initLines();
    ALL_IN = scheduleAll();
    buildSnap();
    // precalentado: el primer uso de los bitmaps grandes, sprites y fuentes cuesta ~1 s en Skia; lo pago
    // acá (una vez por proceso) y no en el primer cuadro del render
    const warm = makeCanvas(W, H).getContext('2d');
    for (const t of [13.2, 13.3, 14.3, 15.5, 16.7, 16.9, 17.0, 17.6, 18.0, 18.7, 19.95, 20.55]) {
      warm.save();
      scene.draw(warm, t);
      warm.restore();
      resetLayers();
    }
  },
  draw(ctx, t) {
    const cam = camAt(t);
    const veil = linesVeil(t);
    // postales y TRANSATLÁNTICOS quedan fuera de los smears (antes del velo de las navieras)
    const uiOut = veil <= 0.01 && t < TS;
    const render = (c) => {
      if (t >= TS) {
        drawSnap(c, cam);
        veilOver(c, veil, t);
      } else if (veil > 0.01) {
        // navieras: el mapa se desenfoca y se oscurece detrás
        soft(c, 2 + veil * 7, (cc) => drawWorld(cc, cam, t));
        veilOver(c, veil, t);
      } else {
        drawWorld(c, cam, t, { ui: !uiOut });
      }
      linesClouds(c, cam, t, veil);
      beacons(c, cam, t, veil);
      drawLines(c, t, { par: bokehPar(cam) });
      // la estela de la salida se tiñe hacia el cian de `value` en los últimos cuadros
      const cy = smoothstep(LT.end - 0.045, LT.end, t);
      if (cy > 0) {
        c.save();
        c.globalCompositeOperation = 'screen';
        c.fillStyle = rgba(PAL.ocean400, 0.62 * cy);
        c.fillRect(...fullRect());
        c.restore();
      }
    };
    // LÁTIGO al sur: smear direccional con el pico en map.whip (la capa tiene margen: no se ven bordes)
    if (t > WH.w0 && t < WH.w2 + 0.08) {
      const [vx, vy] = camVel(t);
      const vf = Math.hypot(vx, vy) / 60;
      // obturador: casi nada en el contramovimiento lento, todo en el pico (EN map.whip)
      const L = 600 * (1 - Math.exp(-vf / 520)) * smoothstep(25, 110, vf);
      if (L > 5) {
        const ux = vx / Math.hypot(vx, vy), uy = vy / Math.hypot(vx, vy);
        smearSoft(ctx, ux * L, uy * L, render);
        speedLines(ctx, t, vx, vy, clamp((vf - 40) / 500));
        if (uiOut) drawUI(ctx, cam, t);
        return;
      }
    }
    // LÁTIGO hacia ARRIBA en la salida
    if (t > LT.whip) {
      const L = Math.min(600, Math.abs(exitVel(t)) * 0.032 + Math.abs(camVel(t)[1]) * 0.03);
      if (L > 5) { smearSoft(ctx, 0, -L, render); if (uiOut) drawUI(ctx, cam, t); return; }
    }
    // alejamientos rápidos: barrido radial (zoom blur) proporcional a la velocidad del zoom
    const zv = Math.abs(zoomVel(t)) / 60;
    // + golpe radial en map.all (la red «se abre» con el cue)
    const burst = t > T.all ? 0.03 * Math.exp(-(t - T.all) / 0.05) : 0;
    // en el arranque del alejamiento (corte con el sol) el barrido va suave: la costa del Río de la Plata tiene
    // que leerse nítida; el motion blur del render final ya pone el resto
    const soft0 = lerp(0.35, 1, smoothstep(T.in + 0.2, T.in + 0.42, t));
    const amt = Math.max(zv > 0.028 ? Math.min(0.1, (zv - 0.02) * 1.6) * soft0 : 0, burst);
    if (amt > 0.004 && t < TS) {
      zoomSmear(ctx, amt, render);
      if (uiOut) drawUI(ctx, cam, t);
      return;
    }
    render(ctx);
    if (uiOut) drawUI(ctx, cam, t);
  },
};
export default scene;
