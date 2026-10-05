// ESCENARIO (10,31–11,25): telón que se abre, reflectores que barren, bailarinas en silueta que cambian de pose
// en cada corchea, piso que refleja, público en primer plano, confeti en exp.confetti y salida: la cabeza
// central gira a cámara y su lente se vuelve un disco cálido enceguecedor en (960, 430) r = 160 a las 11,25.
import { W, H, BEAT, cue, beatPulse } from '../../engine/time.js';
import { E, clamp, lerp, spring, kf, TAU } from '../../engine/ease.js';
import { PAL, rgba } from '../../engine/color.js';
import { plane, handheld } from '../../engine/camera.js';
import { rad, lensFlare, toLayer, blit } from '../../engine/draw.js';
import { DB } from './pal.js';
import { initStageBg, drawWall, drawSunburst, drawBacklight, drawRing, RING } from './stage-bg.js';
import { initCurtain, drawPanel, drawValance } from './curtain.js';
import { initBeams, beam } from './beams.js';
import { initFixtures, drawTruss, drawHead, lensGlow, TRUSS_Y } from './fixture.js';
import { POSES, mirror, poseAt, drawDancer } from './dancer.js';
import { initCrowd, drawCrowdRow, CROWD_ROWS } from './crowd.js';
import { initConfetti, drawConfetti, drawCannonPop } from './confetti.js';

let T_SHOW = 10.3125, T_CONF = 10.78125;
const T_END = 11.25;
const T_EXIT = 11.0;
const FLOOR_BACK = 770, FLOOR_LIP = 905;
const HEAD_Y = TRUSS_Y + 52;
const LENS_Y = HEAD_Y + 4; // centro de la lente cuando mira a cámara
const LENS_R = 34;
const DISC = { x: 960, y: 430, r: 160 };
const Z_END = DISC.r / LENS_R;
const HEADS = [
  { x: 560, color: DB.beamCyan, ph: 0.0 },
  { x: 760, color: DB.beamWarm, ph: 1.3 },
  { x: 960, color: DB.beamWarm, ph: 0.0, lead: true },
  { x: 1160, color: DB.beamWarm, ph: 2.1 },
  { x: 1360, color: DB.beamCoral, ph: 3.0 },
];
// alturas, vestuario y poses distintos; espejo alternado (no simétrico respecto de la protagonista) y canon de
// 1 cuadro entre bailarinas en cada cambio de pose (la protagonista primero)
const F1 = 1 / 60;
const DANCERS = [
  { x: 522, foot: 824, s: 1.06, i: 0, seq: 'A', mir: false, variant: 1, off: 3 * F1 },
  { x: 740, foot: 836, s: 1.2, i: 1, seq: 'B', mir: true, variant: 2, off: 1 * F1 },
  { x: 960, foot: 852, s: 1.32, i: 2, lead: true, seq: 'L', mir: false, variant: 0, off: 0 },
  { x: 1180, foot: 830, s: 1.13, i: 3, seq: 'A', mir: false, variant: 0, off: 2 * F1 },
  { x: 1398, foot: 820, s: 1.02, i: 4, seq: 'B', mir: true, variant: 1, off: 4 * F1 },
];
const RIM2 = [PAL.aqua300, PAL.aqua300, PAL.aqua200, PAL.coralLight, PAL.coralLight];
let SEQS = {};

export function initStage() {
  T_SHOW = cue('exp.show');
  T_CONF = cue('exp.confetti');
  initStageBg();
  initCurtain();
  initBeams([DB.beamWarm, DB.beamCyan, DB.beamCoral]);
  initFixtures();
  initCrowd();
  initConfetti();
  const e8 = BEAT / 2;
  SEQS = {
    L: [[9.9, POSES.kick], [T_SHOW, POSES.vup], [T_SHOW + e8, POSES.hip], [T_CONF - 0.085, POSES.crouch], [T_CONF, POSES.star], [T_CONF + e8, POSES.point]],
    A: [[9.9, POSES.vup], [T_SHOW, POSES.kick], [T_SHOW + e8, POSES.attitude], [T_CONF - 0.085, POSES.crouch], [T_CONF, POSES.starA], [T_CONF + e8, POSES.wave]],
    B: [[9.9, POSES.open], [T_SHOW, POSES.lunge], [T_SHOW + e8, POSES.passe], [T_CONF - 0.085, POSES.crouch], [T_CONF, POSES.starB], [T_CONF + e8, POSES.open]],
  };
}

// ------------------------------------------------------------------ tiempos derivados (puros)
/** Apertura del telón 0..1 (con rebote al llegar). */
const curtainOpen = (t) => spring(t, T_SHOW + 0.04, { from: 0.12, to: 1, freq: 1.7, damp: 4.6 });
/** Giro de la cabeza central hacia cámara: anticipa hacia atrás y gira con overshoot chico. */
function leadTilt(t) {
  return kf(t, [
    [T_EXIT - 0.03, 0],
    [T_EXIT + 0.03, -0.18, E.outQuad],
    [T_EXIT + 0.17, Math.PI / 2 + 0.06, E.inOutCubic],
    [T_EXIT + 0.21, Math.PI / 2, E.outSine],
  ]);
}
/** Progreso del empuje final (acelera hacia el corte). */
const pushU = (t) => E.inQuad(clamp((t - T_EXIT) / (T_END - 1 / 60 - T_EXIT)));

export function stageCam(t) {
  // respiración: leve push-in durante el show con golpe en el confeti
  const zLive = 1 + 0.035 * E.inOutSine(clamp((t - T_SHOW) / 0.7)) + (t >= T_CONF ? 0.025 * Math.exp(-(t - T_CONF) / 0.12) : 0);
  const c = handheld({ x: 0, y: 0, z: zLive, r: 0 }, t, { amp: 4, hz: 0.5, rollAmp: 0.0025, seed: 19 });
  const u = pushU(t);
  if (u <= 0) return c;
  // empuje a la lente central (en el plano focal): pantalla = 540 + (LENS_Y − 540 − cam.y)·z
  const z = zLive * Math.pow(Z_END / zLive, u);
  const e = E.outSine(u);
  const s0x = 960 - c.x * zLive, s0y = 540 + (LENS_Y - 540 - c.y) * zLive;
  const sx = lerp(s0x, DISC.x, e), sy = lerp(s0y, DISC.y, e);
  return { x: -(sx - 960) / z, y: LENS_Y - 540 - (sy - 540) / z, z, r: c.r * (1 - u) };
}

// ------------------------------------------------------------------ partes
function drawFloor(ctx, t, beams) {
  // piso brillante con tablas que fugan al centro
  const g = ctx.createLinearGradient(0, FLOOR_BACK, 0, FLOOR_LIP);
  g.addColorStop(0, PAL.navy800);
  g.addColorStop(1, DB.floor);
  ctx.fillStyle = g;
  ctx.fillRect(-400, FLOOR_BACK, W + 800, FLOOR_LIP - FLOOR_BACK);
  ctx.save();
  ctx.strokeStyle = rgba(PAL.aqua300, 0.08);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = -14; i <= 14; i++) {
    const xb = 960 + i * 70, xf = 960 + i * 150;
    ctx.moveTo(xb, FLOOR_BACK); ctx.lineTo(xf, FLOOR_LIP);
  }
  ctx.stroke();
  ctx.restore();
  // reflejo del aro de lamparitas y de los pozos de luz
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rad(ctx, RING.x, FLOOR_BACK + 30, 520, [[0, rgba(PAL.gold, 0.28)], [1, rgba(PAL.gold, 0)]]);
  ctx.save();
  ctx.translate(0, FLOOR_BACK + 30);
  ctx.scale(1, 0.16);
  ctx.translate(0, -(FLOOR_BACK + 30));
  ctx.fillRect(RING.x - 520, FLOOR_BACK + 30 - 520, 1040, 1040);
  ctx.restore();
  for (const b of beams) {
    if (b.a <= 0.01) continue;
    const px = b.x + Math.tan(b.ang) * (FLOOR_BACK + 60 - b.y);
    const R = 120 + 40 * Math.abs(Math.tan(b.ang));
    ctx.save();
    ctx.translate(px, FLOOR_BACK + 62);
    ctx.scale(1, 0.22);
    ctx.fillStyle = rad(ctx, 0, 0, R, [[0, rgba(b.color, 0.55 * b.a)], [0.6, rgba(b.color, 0.18 * b.a)], [1, rgba(b.color, 0)]]);
    ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.restore();
  }
  ctx.restore();
}

function drawLip(ctx, t, hit) {
  // canto del escenario: filete dorado, candilejas y frente oscuro
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(-400, FLOOR_LIP, W + 800, 120);
  ctx.fillStyle = DB.brassDark;
  ctx.fillRect(-400, FLOOR_LIP, W + 800, 8);
  ctx.fillStyle = DB.brass;
  ctx.fillRect(-400, FLOOR_LIP, W + 800, 4);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 22; i++) {
    const x = -60 + i * 96;
    const k = 0.55 + 0.45 * hit;
    ctx.fillStyle = rad(ctx, x, FLOOR_LIP - 4, 46, [[0, rgba(PAL.goldPale, 0.85 * k)], [0.25, rgba(PAL.gold, 0.4 * k)], [1, rgba(PAL.coral, 0)]]);
    ctx.fillRect(x - 46, FLOOR_LIP - 50, 92, 92);
  }
  ctx.restore();
}

/** Ángulos y brillo de los haces de la parrilla en t. */
function beamState(t) {
  const lt = t - T_SHOW;
  const conf = t >= T_CONF ? Math.exp(-(t - T_CONF) / 0.25) : 0;
  const pulse = beatPulse(t, { from: T_SHOW, every: 0.5, decay: 0.09 });
  return HEADS.map((h, i) => {
    const dir = i % 2 ? 1 : -1;
    // barrido: cruzan en cada beat (período de 2 beats), en el confeti se abren en abanico
    let ang = dir * 0.42 * Math.sin((lt / (BEAT * 2)) * TAU + h.ph) + (h.x - 960) * 0.00035;
    ang = lerp(ang, (h.x - 960) * 0.0016, conf * 0.8);
    let tilt = 0;
    let a = 0.55 + 0.25 * pulse + 0.5 * conf;
    if (h.lead) {
      ang = 0.05 * Math.sin(lt * 3);
      tilt = leadTilt(t);
      a = 0.7 + 0.3 * pulse + 0.5 * conf;
    } else if (t > T_EXIT) {
      // los demás también se vuelven hacia cámara, escalonados
      const p = E.inOutCubic(clamp((t - T_EXIT - 0.04 - Math.abs(i - 2) * 0.03) / 0.18));
      tilt = p * Math.PI * 0.5;
    }
    return { x: h.x, y: HEAD_Y, ang, tilt, a, color: h.color, lead: h.lead };
  });
}

function drawBeams(ctx, B, len = 760) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of B) {
    const fore = Math.cos(b.tilt);
    if (fore <= 0.02) continue;
    beam(ctx, b.x, b.y + 6, b.ang, (len / Math.cos(b.ang)) * fore, 330 + 90 * Math.abs(Math.sin(b.ang)), b.color, b.a * (0.6 + 0.4 * fore));
  }
  ctx.restore();
}

function cornerBeams(ctx, t) {
  const lt = t - T_SHOW;
  const sw = 0.18 * Math.sin((lt / (BEAT * 4)) * TAU);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  beam(ctx, -60, 40, -0.66 + sw, 1150, 520, DB.beamWarm, 0.34);
  beam(ctx, W + 60, 40, 0.66 - sw, 1150, 520, DB.beamWarm, 0.34);
  ctx.restore();
}

/** Bruma volumétrica detrás de las bailarinas: nubes suaves que derivan y toman el color de los haces. */
function drawHaze(ctx, t, B) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const blobs = [[700, 640, 420, DB.beamWarm, 0.16], [1230, 610, 460, DB.beamWarm, 0.14], [480, 700, 360, DB.beamCyan, 0.13], [1450, 690, 380, DB.beamCoral, 0.12], [960, 720, 520, PAL.goldLight, 0.12]];
  blobs.forEach(([bx, by, R, col, a], i) => {
    const x = bx + 60 * Math.sin(t * 0.7 + i * 1.9), y = by + 20 * Math.sin(t * 0.9 + i);
    const k = a * (0.8 + 0.3 * Math.min(1, B[i % B.length].a));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.45);
    ctx.fillStyle = rad(ctx, 0, 0, R, [[0, rgba(col, k)], [0.5, rgba(col, k * 0.45)], [1, rgba(col, 0)]]);
    ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.restore();
  });
  ctx.restore();
}

// ------------------------------------------------------------------ escena
export function drawStage(ctx, t, lap = null) {
  const cam = stageCam(t);
  const u = pushU(t);
  const hit = beatPulse(t, { from: T_SHOW, every: 0.5, decay: 0.1 });
  const conf = t >= T_CONF ? Math.exp(-(t - T_CONF) / 0.3) : 0;
  const B = beamState(t);

  // fondo
  plane(ctx, cam, 0.5, (c) => drawWall(c, t, 1 - clamp(u / 0.3)));
  lap?.('wall');
  plane(ctx, cam, 0.62, (c) => {
    drawSunburst(c, t, 0.8 + 0.6 * conf);
    drawBacklight(c, t, 0.85 + 0.35 * hit + 0.6 * conf);
    drawRing(c, t, { hit: Math.max(hit * 0.6, conf) });
  });
  lap?.('sunburst+ring');
  const confA = 1 - clamp((u - 0.25) / 0.45);
  if (confA > 0) plane(ctx, cam, 0.92, (c) => { c.globalAlpha *= confA; drawConfetti(c, t, T_CONF, 0); });
  // piso, haces y bailarinas (plano focal)
  plane(ctx, cam, 1, (c) => {
    drawFloor(c, t, B);
    lap?.('floor');
    cornerBeams(c, t);
    drawBeams(c, B);
    lap?.('beams');
    // bailarinas: si se están desvaneciendo (empuje final) van a una capa para que no se transparenten por partes
    const fadeD = 1 - clamp((u - 0.12) / 0.4);
    const dancers = (cc) => {
      for (const d of DANCERS) {
        let p = poseAt(t - d.off, SEQS[d.seq]);
        if (d.mir) p = { ...mirror(p), since: p.since, dir: -p.dir };
        const sparkleK = (d.lead ? 0.6 + 0.4 * hit : 0.35 * hit + conf * 0.6) * (1 - clamp(u / 0.1));
        drawDancer(cc, d.x, d.foot, d.s, p, t, { lead: d.lead, seed: d.i * 1.7, variant: d.variant, sparkle: sparkleK, reflect: 0.24, rim: d.lead ? PAL.goldPale : PAL.goldLight, rim2: RIM2[d.i] });
      }
    };
    drawHaze(c, t, B);
    if (fadeD >= 0.999) dancers(c);
    else if (fadeD > 0.01) blit(c, toLayer(c, dancers), { alpha: fadeD });
    lap?.('dancers');
    drawLip(c, t, hit);
    drawTruss(c);
    for (const b of B) {
      const L = drawHead(c, b.x, b.y, { tilt: b.tilt, pan: b.ang, glow: b.a, s: 1 });
      lensGlow(c, L, Math.min(1, b.a) * (b.lead ? 1 : 0.8), b.color);
    }
  });
  lap?.('lip+truss+heads');
  // telón (más cerca que el escenario)
  const op = curtainOpen(t);
  const vel = (op - curtainOpen(t - 1 / 60)) * 60;
  plane(ctx, cam, 1.12, (c) => {
    const edgeL = lerp(960, 330, op), edgeR = lerp(960, W - 330, op);
    drawPanel(c, -1, edgeL, { sway: -vel * 55, t });
    drawPanel(c, 1, edgeR, { sway: vel * 55, t });
    drawValance(c, { dy: -8 * Math.exp(-Math.max(0, t - T_SHOW) * 6) * Math.sin(Math.max(0, t - T_SHOW) * 20) });
  });
  lap?.('curtains');
  plane(ctx, cam, 1.05, (c) => {
    if (confA > 0) {
      c.save();
      c.globalAlpha *= confA;
      drawConfetti(c, t, T_CONF, 1);
      c.restore();
    }
    drawCannonPop(c, t, T_CONF);
  });
  lap?.('confetti');
  // público
  for (let k = 0; k < CROWD_ROWS.length; k++) {
    plane(ctx, cam, CROWD_ROWS[k].depth, (c) => drawCrowdRow(c, t, k, { tUp: T_CONF - 0.05, glow: 0.8 + 0.4 * conf }));
  }
  lap?.('crowd');
  if (u < 0.35) plane(ctx, cam, 1.4, (c) => { c.globalAlpha *= 1 - u / 0.35; drawConfetti(c, t, T_CONF, 2); });
  drawGlare(ctx, t, cam, u);
  lap?.('glare');
}

/** Salida: el disco de la lente enceguece y lava el cuadro de luz cálida. */
function drawGlare(ctx, t, cam, u) {
  if (t < T_EXIT) return;
  const open = Math.sin(clamp(leadTilt(t), 0, Math.PI / 2));
  const z = cam.z;
  const cx = W / 2 + (960 - W / 2 - cam.x) * z;
  const cy = H / 2 + (LENS_Y - H / 2 - cam.y) * z;
  const r = LENS_R * z;
  const k = clamp(open * 0.4 + u * 0.9);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // halo amplio
  const R = r * (2.2 + 3 * k);
  ctx.fillStyle = rad(ctx, cx, cy, R, [[0, rgba(PAL.goldPale, 0.7 * k)], [0.35, rgba(PAL.gold, 0.32 * k)], [0.7, rgba(PAL.coral, 0.1 * k)], [1, rgba(PAL.coral, 0)]]);
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.restore();
  lensFlare(ctx, cx, cy, { intensity: k * 1.2, tint: PAL.goldLight, streak: 700 + 900 * k, core: r * 0.9, ghosts: true });
  // lavado cálido de todo el cuadro hacia el corte (enceguece: lo que queda alrededor del sol es dorado)
  const wash = E.inQuad(clamp((t - (T_END - 0.2)) / (0.2 - 1 / 60)));
  if (wash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rad(ctx, cx, cy, W * 0.85, [[0, rgba(PAL.warmWhite, 0.98 * wash)], [0.3, rgba(PAL.goldLight, 0.9 * wash)], [0.7, rgba(PAL.gold, 0.75 * wash)], [1, rgba(PAL.coral, 0.65 * wash)]]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // el disco liso (núcleo blanco-dorado) que recibe el sol
  const dk = clamp((u - 0.55) / 0.4);
  if (dk > 0) {
    ctx.save();
    ctx.globalAlpha *= dk;
    ctx.fillStyle = rad(ctx, cx, cy, r, [[0, '#FFFFFF'], [0.55, '#FFFDF6'], [0.88, PAL.warmWhite], [1, PAL.goldPale]]);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
