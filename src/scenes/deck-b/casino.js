// CASINO (9,375–10,31): la ruleta entra cenital (match con el plato), la cámara se aleja y se inclina sobre la
// mesa, caen las fichas y se abre el abanico de cartas (exp.chips). Luz de lámpara cálida arriba a la izquierda.
import { W, H, cue, beatPulse } from '../../engine/time.js';
import { E, kf, clamp, TAU, lerp } from '../../engine/ease.js';
import { PAL, rgba } from '../../engine/color.js';
import { rng, noise1 } from '../../engine/noise.js';
import { sparkle, rad } from '../../engine/draw.js';
import { tableCam } from './persp.js';
import { initRoulette, drawRoulette, WH } from './roulette.js';
import { initTable, drawTable, drawFloor, TABLE } from './table.js';
import { drawStacks, drawImpactRings } from './chips.js';
import { initCards, drawCards } from './cards.js';
import { initBokeh, bokeh, BOKEH_COLORS } from './bokeh.js';
import { initFgStack, drawFgStack } from './fgstack.js';

const T_IN = 9.375;
let T_CHIPS = 9.84375;
let wallLights = [];
let fgLights = [];

export function initCasino() {
  T_CHIPS = cue('exp.chips');
  initRoulette();
  initTable();
  initCards();
  initBokeh();
  initFgStack();
  const r = rng(5150);
  wallLights = [];
  for (let i = 0; i < 170; i++) {
    const q = r();
    wallLights.push({
      x: -3400 + r() * 6000,
      z: -520 + Math.pow(r(), 1.6) * 1300,
      r: 10 + Math.pow(r(), 2.6) * 62,
      c: q < 0.45 ? BOKEH_COLORS[0] : q < 0.75 ? BOKEH_COLORS[1] : q < 0.88 ? BOKEH_COLORS[5] : q < 0.95 ? BOKEH_COLORS[3] : BOKEH_COLORS[4],
      a: 0.45 + r() * 0.55,
      hz: 0.6 + r() * 2.2,
      ph: r() * TAU,
    });
  }
  fgLights = [
    { x: 1700, y: 120, r: 150, c: BOKEH_COLORS[0], a: 0.16, sp: 1.2 },
    { x: 220, y: 980, r: 120, c: BOKEH_COLORS[1], a: 0.1, sp: 1.5 },
    { x: 1500, y: 60, r: 70, c: BOKEH_COLORS[2], a: 0.14, sp: 0.9 },
  ];
}

/** Giro del rotor (horario, rad): 360°/s en el corte que desacelera. */
export function rotorAngle(t) {
  const dt = Math.max(0, t - T_IN);
  const w0 = TAU, wf = 1.1, k = 2.1;
  return 0.6 + wf * dt + ((w0 - wf) * (1 - Math.exp(-k * dt))) / k;
}
const rotorSpeed = (t) => 1.1 + (TAU - 1.1) * Math.exp(-2.1 * Math.max(0, t - T_IN));

/** Bolita: gira antihoraria en la pista, baja en espiral y cae en un casillero justo en exp.chips. */
function ballAt(t) {
  const tl = T_CHIPS;
  const angFree = (tt) => {
    const dt = tt - T_IN;
    const w0 = 10.5, wf = 3, k = 2.4;
    return 2.2 - (wf * dt + ((w0 - wf) * (1 - Math.exp(-k * dt))) / k);
  };
  if (t < tl) {
    const t1 = tl - 0.2;
    const p = clamp((t - t1) / (tl - t1));
    const r = lerp(186, 119, E.inQuad(p));
    const z = p > 0 ? 16 * Math.abs(Math.sin(p * Math.PI * 2.2)) * (1 - p * 0.6) : 0;
    return { a: angFree(t), r, z, inPocket: r < WH.rotor - 2 };
  }
  const dt = t - tl;
  const delta = angFree(tl) - rotorAngle(tl);
  const rattle = 0.07 * Math.exp(-dt * 9) * Math.sin(dt * 38);
  return {
    a: rotorAngle(t) + delta + rattle,
    r: 119 + 4 * Math.exp(-dt * 8) * Math.sin(dt * 31),
    z: 10 * Math.exp(-dt * 9) * Math.abs(Math.sin(dt * 26)),
    inPocket: true,
    glint: dt < 0.35 ? Math.sin((dt / 0.35) * Math.PI) : 0,
  };
}

const CAM = [
  [9.375, { D: 1600, pitch: 0, yaw: 0, tx: 0, ty: 0 }],
  [9.43, { D: 1550, pitch: 0.012, yaw: 0.012, tx: 0, ty: 0 }, E.outQuad],
  [9.84, { D: 1080, pitch: 1.19, yaw: -0.39, tx: -410, ty: 95 }, (p) => E.inOutCubic(Math.pow(p, 0.8))],
  [10.32, { D: 1000, pitch: 1.24, yaw: -0.46, tx: -400, ty: 120 }, E.outSine],
];

/** Contramovimiento antes del látigo: la cámara retrocede a la izquierda con un push leve (4 cuadros). */
export const ANT_A = 10.19, ANT_B = 10.255;
const antic = (t) => E.outCubic(clamp((t - ANT_A) / (ANT_B - ANT_A)));

export function casinoCam(t) {
  const k = kf(t, CAM);
  // cámara viva: deriva suave de rumbo y altura
  const live = clamp((t - 9.5) / 0.4);
  const a = antic(t);
  return tableCam({
    ...k,
    tx: k.tx - 42 * a,
    D: k.D * (1 - 0.035 * a),
    yaw: k.yaw + 0.012 * noise1(t * 0.9, 41) * live - 0.02 * a,
    pitch: k.pitch + 0.01 * noise1(t * 0.8, 43) * live,
    roll: 0.006 * noise1(t * 0.7, 47) * live,
    F: 1600,
  });
}

/** Pared del salón con luces fuera de foco (detrás de la mesa) y el resplandor cálido de las arañas. */
function drawWall(ctx, cam, t) {
  const wy = TABLE.wallY;
  const base = cam.p(-400, wy, -520);
  const g = ctx.createLinearGradient(0, base.y - 700, 0, base.y + 60);
  g.addColorStop(0, PAL.ink);
  g.addColorStop(0.55, PAL.navy900);
  g.addColorStop(1, PAL.navy700);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (base.y < -60) return;
  const pulse = beatPulse(t, { from: 9.375, decay: 0.12 });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // resplandor de arañas: dos manchas cálidas grandes sobre el horizonte
  for (const [wx, wz, rr, a] of [[-1100, 200, 900, 0.34], [500, 120, 760, 0.3], [-2400, 300, 700, 0.25]]) {
    const p = cam.p(wx, wy, wz);
    const R = rr * p.s;
    ctx.globalAlpha = 1;
    ctx.fillStyle = rad(ctx, p.x, p.y, R, [[0, rgba(PAL.gold, a)], [0.4, rgba(PAL.coral, a * 0.35)], [1, rgba(PAL.coral, 0)]]);
    ctx.fillRect(p.x - R, p.y - R, R * 2, R * 2);
  }
  for (const L of wallLights) {
    const p = cam.p(L.x, wy, L.z);
    if (p.y < -80 || p.y > base.y + 40 || p.x < -100 || p.x > W + 100) continue;
    const tw = 0.7 + 0.3 * Math.sin(t * L.hz * TAU + L.ph);
    bokeh(ctx, p.x, p.y, L.r * (1 + 0.15 * pulse), L.c, L.a * tw * (0.85 + 0.35 * pulse));
  }
  ctx.restore();
}

/** Luces cálidas fuera de foco delante de todo (se mueven más que la mesa). */
function drawForeground(ctx, cam, t) {
  const amt = clamp((t - 9.55) / 0.3);
  if (amt <= 0) return;
  const c = cam.p(-480, -40, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const L of fgLights) {
    const x = L.x + (c.x - 960) * 0.5 * L.sp - (t - 10) * 60 * L.sp;
    const y = L.y + (c.y - 540) * 0.5 * L.sp;
    bokeh(ctx, x, y, L.r, L.c, L.a * amt, true);
  }
  ctx.restore();
}

/** Iris de entrada: el mantel navy del plato se abre en anillo desde la ruleta y deja ver el paño. */
function drawEntryIris(ctx, cam, t) {
  const dt = t - T_IN;
  if (dt < 0 || dt > 0.26) return;
  const c = cam.p(0, 0, WH.rimZ);
  const R0 = (WH.R + 6) * c.s;
  const rr = R0 + 1500 * E.outQuart(dt / 0.26);
  const soft = 60 + 120 * (dt / 0.26);
  const R = rr + soft;
  ctx.save();
  ctx.fillStyle = rad(ctx, c.x, c.y, R, [[Math.max(0, (rr - 4) / R), rgba(PAL.navy800, 0)], [Math.min(1, (rr + 2) / R), rgba(PAL.navy800, 0.85)], [1, rgba(PAL.navy900, 0.95)]]);
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.fill();
  ctx.restore();
}

/**
 * Puente de valor con el plato crema: en los primeros 3–4 cuadros la ruleta arranca bañada por un halo cálido
 * (crema / goldPale) que se apaga rápido, así el corte no invierte el valor de golpe.
 */
function drawEntryGlow(ctx, cam, t) {
  const dt = t - T_IN;
  if (dt < 0 || dt > 0.12) return;
  const k = Math.exp(-dt / 0.034);
  const c = cam.p(0, 0, WH.rimZ);
  const R = (WH.R + 60) * c.s;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = rad(ctx, c.x, c.y, R, [[0, rgba(PAL.warmWhite, 0.88 * k)], [0.5, rgba(PAL.goldPale, 0.8 * k)], [0.78, rgba(PAL.goldPale, 0.64 * k)], [0.9, rgba(PAL.gold, 0.3 * k)], [1, rgba(PAL.gold, 0)]]);
  ctx.fillRect(c.x - R, c.y - R, R * 2, R * 2);
  ctx.restore();
}

/** Golpe del corte: onda dorada que se expande desde el borde de la ruleta. */
function drawEntryRing(ctx, cam, t) {
  const dt = t - T_IN;
  if (dt < 0 || dt > 0.42) return;
  const p = E.outCubic(dt / 0.42);
  const m = cam.aff(0, 0, WH.rimZ);
  ctx.save();
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  ctx.beginPath();
  ctx.arc(0, 0, WH.R + 4 + p * 230, 0, TAU);
  ctx.strokeStyle = rgba(PAL.gold, 0.85 * (1 - p));
  ctx.lineWidth = 16 * (1 - p) + 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, WH.R + 4 + p * 150, 0, TAU);
  ctx.strokeStyle = rgba(PAL.goldPale, 0.9 * (1 - p));
  ctx.lineWidth = 4 * (1 - p) + 0.5;
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.5;
    const rr = WH.R + 8 + p * 120;
    sparkle(ctx, Math.cos(a) * rr, Math.sin(a) * rr, 20 * (1 - p), { alpha: 1 - p, color: PAL.goldPale, rot: p, halo: 0.5 });
  }
  ctx.restore();
}

/** Dibuja el casino completo en t. */
export function drawCasino(ctx, t, camOverride = null) {
  const cam = camOverride ?? casinoCam(t);
  drawWall(ctx, cam, t);
  drawFloor(ctx, cam);
  const lamp = 1 + 0.12 * beatPulse(t, { from: 9.375, decay: 0.15 });
  drawTable(ctx, cam, t, { lamp });
  drawImpactRings(ctx, cam, t, T_CHIPS);
  const w = rotorSpeed(t);
  // barrido rotacional proporcional a la velocidad (≈ 360°/s en el corte) más el arrastre del plato que gira
  // rapidísimo: decae con la desaceleración en los primeros cuadros
  const smear = w * 0.06 + 0.55 * Math.exp(-(t - T_IN) / 0.06);
  drawRoulette(ctx, cam, 0, 0, { phi: rotorAngle(t), smear, ball: ballAt(t) });
  drawEntryGlow(ctx, cam, t);
  drawEntryRing(ctx, cam, t);
  drawStacks(ctx, cam, t, T_CHIPS);
  drawCards(ctx, cam, t, T_CHIPS, { sweepT: 10.03, px: -300, py: -300, baseRot: 0.55, k: 1.3 });
  drawEntryIris(ctx, cam, t);
  drawFgStack(ctx, cam, -395, -470, clamp((t - 9.62) / 0.15));
  drawForeground(ctx, cam, t);
}
