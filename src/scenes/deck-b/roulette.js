// Ruleta (vista cenital que se inclina con la cámara de mesa). Casilleros coral / navy / teal con trastes dorados.
// Partes: tazón fijo (aro de laca, pista de la bolita, diamantes), rotor que gira (números, casilleros, cono),
// torreta en cruz con altura real y bolita de marfil. Luz principal: arriba a la izquierda.
import { makeCanvas } from '../../engine/env.js';
import { TAU, clamp } from '../../engine/ease.js';
import { PAL, shade, rgba } from '../../engine/color.js';
import { rad, lin, sparkle } from '../../engine/draw.js';
import { DB } from './pal.js';
import { cylFrame, sidePath, capPath, contactShadow } from './solid.js';

export const WH = { R: 230, rimIn: 206, trackOut: 201, trackIn: 168, rotor: 164, numIn: 136, pockOut: 133, pockIn: 106, hub: 30, rimZ: 22, rotorZ: 8 };
const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const K = 2; // resolución de los precalculados
const N = 37;
const SEC = TAU / N;

let bowl = null, rotor = null, rotorLight = null, smearBuf = null;

function annulus(g, r0, r1) {
  g.beginPath();
  g.arc(0, 0, r0, 0, TAU);
  g.arc(0, 0, r1, 0, TAU, true);
  g.closePath();
}
/** Media luna dura: pinta `color` en la parte del anillo (r0..r1) que NO cubre el círculo corrido (dx, dy). */
function crescent(g, r0, r1, rc, dx, dy, color) {
  g.save();
  annulus(g, r0, r1);
  g.clip();
  g.beginPath();
  g.rect(-r0 - 50, -r0 - 50, r0 * 2 + 100, r0 * 2 + 100);
  g.arc(dx, dy, rc, 0, TAU, true);
  g.fillStyle = color;
  g.fill('evenodd');
  g.restore();
}
/** Arco de filo de luz con terminaciones redondeadas. */
function rimArc(g, r, a0, a1, w, color) {
  g.beginPath();
  g.arc(0, 0, r, a0, a1);
  g.strokeStyle = color;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.stroke();
}
function brassRing(g, r0, r1) {
  annulus(g, r0, r1);
  g.fillStyle = DB.brass;
  g.fill();
  crescent(g, r0, r1, r0, -2.5, -2.5, DB.brassDark);
  rimArc(g, (r0 + r1) / 2 + 0.6, Math.PI * 1.02, Math.PI * 1.6, Math.max(1, (r0 - r1) * 0.35), DB.brassHi);
}

function buildBowl() {
  const R = WH.R;
  const S = Math.ceil((R + 12) * 2 * K);
  const cv = makeCanvas(S, S);
  const g = cv.getContext('2d');
  g.translate(S / 2, S / 2);
  g.scale(K, K);
  // aro exterior de laca navy (3 tonos: base, sombra dura abajo-derecha, filo arriba-izquierda)
  annulus(g, R, WH.rimIn);
  g.fillStyle = DB.lacq;
  g.fill();
  crescent(g, R, WH.rimIn, R, -9, -9, DB.lacqDark);
  // pared interior del aro: la de arriba-izquierda queda en sombra
  crescent(g, WH.rimIn + 8, WH.rimIn, WH.rimIn + 8, 6, 6, DB.lacqDark);
  g.save();
  annulus(g, R, WH.rimIn);
  g.clip();
  g.fillStyle = rad(g, -90, -90, R * 1.3, [[0, rgba(PAL.aqua200, 0.16)], [1, rgba(PAL.aqua200, 0)]]);
  g.fillRect(-R, -R, R * 2, R * 2);
  g.restore();
  rimArc(g, R - 2.5, Math.PI * 1.05, Math.PI * 1.62, 3.2, shade(DB.lacqLight, 0.35));
  rimArc(g, R - 2.5, Math.PI * 0.12, Math.PI * 0.38, 1.6, rgba(PAL.goldLight, 0.55));
  // filete dorado
  brassRing(g, WH.rimIn, WH.trackOut);
  // pista de la bolita: pendiente pulida (más clara afuera)
  annulus(g, WH.trackOut, WH.trackIn);
  g.fillStyle = rad(g, 0, 0, WH.trackOut, [[WH.trackIn / WH.trackOut, PAL.navy900], [1, PAL.navy600]]);
  g.fill();
  g.save();
  annulus(g, WH.trackOut, WH.trackIn);
  g.clip();
  // brillo especular fijo sobre la pista
  g.globalCompositeOperation = 'screen';
  g.fillStyle = rad(g, -120, -120, 120, [[0, rgba(PAL.aqua100, 0.35)], [1, rgba(PAL.aqua100, 0)]]);
  g.fillRect(-R, -R, R * 2, R * 2);
  g.fillStyle = rad(g, 130, 120, 80, [[0, rgba(PAL.goldLight, 0.18)], [1, rgba(PAL.goldLight, 0)]]);
  g.fillRect(-R, -R, R * 2, R * 2);
  g.restore();
  // diamantes deflectores
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + SEC / 2;
    const r = (WH.trackOut + WH.trackIn) / 2;
    g.save();
    g.rotate(a);
    g.translate(r, 0);
    const long = i % 2 === 0;
    const lw = long ? 9 : 5.5, lh = long ? 4 : 7;
    g.beginPath();
    g.moveTo(-lw, 0); g.lineTo(0, -lh); g.lineTo(lw, 0); g.lineTo(0, lh); g.closePath();
    g.fillStyle = DB.brass; g.fill();
    g.beginPath();
    g.moveTo(-lw, 0); g.lineTo(0, -lh); g.lineTo(0, 0); g.closePath();
    g.fillStyle = DB.brassHi; g.fill();
    g.beginPath();
    g.moveTo(lw, 0); g.lineTo(0, lh); g.lineTo(0, 0); g.closePath();
    g.fillStyle = DB.brassDark; g.fill();
    g.restore();
  }
  brassRing(g, WH.trackIn, WH.rotor);
  return cv;
}

function buildRotor() {
  const R = WH.rotor;
  const S = Math.ceil((R + 4) * 2 * K);
  const cv = makeCanvas(S, S);
  const g = cv.getContext('2d');
  g.translate(S / 2, S / 2);
  g.scale(K, K);
  const colorOf = (n) => (n === 0 ? DB.pockTeal : RED.has(n) ? DB.pockCoral : DB.pockNavy);
  // anillo de números
  for (let i = 0; i < N; i++) {
    const a0 = i * SEC - Math.PI / 2 - SEC / 2;
    g.beginPath();
    g.arc(0, 0, R, a0, a0 + SEC);
    g.arc(0, 0, WH.numIn, a0 + SEC, a0, true);
    g.closePath();
    g.fillStyle = colorOf(ORDER[i]);
    g.fill();
    // casillero (más hundido = más oscuro)
    g.beginPath();
    g.arc(0, 0, WH.pockOut, a0, a0 + SEC);
    g.arc(0, 0, WH.pockIn, a0 + SEC, a0, true);
    g.closePath();
    g.fillStyle = rad(g, 0, 0, WH.pockOut, [[WH.pockIn / WH.pockOut, shade(colorOf(ORDER[i]), -0.55)], [1, shade(colorOf(ORDER[i]), -0.25)]]);
    g.fill();
  }
  // números
  g.fillStyle = PAL.warmWhite;
  g.font = '700 14px Outfit';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < N; i++) {
    const a = i * SEC - Math.PI / 2;
    g.save();
    g.rotate(a);
    g.translate((R + WH.numIn) / 2 + 0.5, 0);
    g.rotate(Math.PI / 2);
    g.fillText(String(ORDER[i]), 0, 0.5);
    g.restore();
  }
  // trastes dorados entre casilleros y separadores de números
  for (let i = 0; i < N; i++) {
    const a = i * SEC - Math.PI / 2 - SEC / 2;
    const c = Math.cos(a), s = Math.sin(a);
    g.beginPath();
    g.moveTo(c * WH.numIn, s * WH.numIn);
    g.lineTo(c * R, s * R);
    g.strokeStyle = rgba(PAL.goldLight, 0.85);
    g.lineWidth = 1.1;
    g.stroke();
    g.beginPath();
    g.moveTo(c * WH.pockIn, s * WH.pockIn);
    g.lineTo(c * WH.pockOut, s * WH.pockOut);
    g.strokeStyle = DB.brassDark;
    g.lineWidth = 3.6;
    g.lineCap = 'round';
    g.stroke();
    g.strokeStyle = DB.brassLight;
    g.lineWidth = 1.6;
    g.stroke();
  }
  brassRing(g, WH.numIn, WH.pockOut);
  brassRing(g, WH.pockIn, WH.pockIn - 4);
  // cono central de laca con incrustaciones doradas
  const rc = WH.pockIn - 4;
  g.beginPath();
  g.arc(0, 0, rc, 0, TAU);
  g.fillStyle = rad(g, 0, 0, rc, [[0, PAL.navy500], [0.45, PAL.navy600], [1, PAL.navy800]]);
  g.fill();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const long = i % 2 === 0;
    g.save();
    g.rotate(a);
    g.beginPath();
    g.moveTo(WH.hub + 4, -1.6);
    g.quadraticCurveTo((WH.hub + rc) / 2, long ? -5 : -3.5, long ? rc - 8 : rc - 30, 0);
    g.quadraticCurveTo((WH.hub + rc) / 2, long ? 5 : 3.5, WH.hub + 4, 1.6);
    g.closePath();
    g.fillStyle = long ? DB.brass : rgba(PAL.goldLight, 0.7);
    g.fill();
    g.restore();
  }
  // cubo dorado
  g.beginPath();
  g.arc(0, 0, WH.hub, 0, TAU);
  g.fillStyle = rad(g, 0, 0, WH.hub, [[0, DB.brassLight], [0.7, DB.brass], [1, DB.brassDark]]);
  g.fill();
  annulus(g, WH.hub - 6, WH.hub - 8);
  g.fillStyle = DB.brassDark;
  g.fill();
  return cv;
}

/** Luz fija sobre el rotor (no gira con él): sombra del tazón arriba-izquierda y brillo del cono. */
function buildRotorLight() {
  const R = WH.rotor;
  const S = Math.ceil((R + 4) * 2 * K);
  const cv = makeCanvas(S, S);
  const g = cv.getContext('2d');
  g.translate(S / 2, S / 2);
  g.scale(K, K);
  // sombra proyectada por la pared del tazón (dura, semitransparente)
  crescent(g, R + 1, 0.01, R, 16, 16, rgba(PAL.ink, 0.5));
  // brillo del cono y sombra del lado contrario
  g.save();
  g.beginPath();
  g.arc(0, 0, WH.pockIn - 4, 0, TAU);
  g.clip();
  g.globalCompositeOperation = 'screen';
  g.fillStyle = rad(g, -38, -40, 70, [[0, rgba(PAL.aqua100, 0.5)], [1, rgba(PAL.aqua100, 0)]]);
  g.fillRect(-R, -R, R * 2, R * 2);
  g.globalCompositeOperation = 'source-over';
  g.beginPath();
  g.moveTo(-R, R); g.lineTo(R, -R); g.lineTo(R, R); g.closePath();
  g.fillStyle = rgba(PAL.ink, 0.2);
  g.fill();
  g.restore();
  // brillo cálido que rebota en los casilleros de abajo a la derecha
  g.save();
  annulus(g, R, WH.pockIn);
  g.clip();
  g.globalCompositeOperation = 'screen';
  g.fillStyle = rad(g, 100, 100, 110, [[0, rgba(PAL.goldLight, 0.22)], [1, rgba(PAL.goldLight, 0)]]);
  g.fillRect(-R, -R, R * 2, R * 2);
  g.restore();
  return cv;
}

export function initRoulette() {
  if (bowl) return;
  bowl = buildBowl();
  rotor = buildRotor();
  rotorLight = buildRotorLight();
  smearBuf = makeCanvas(400, 400);
}

function drawImgCentered(ctx, img, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, -img.width / (2 * K), -img.height / (2 * K), img.width / K, img.height / K);
}

/** Posición de la bolita en coordenadas locales de la rueda (imagen): ángulo, radio y altura. */
function ballPos(b) {
  return { u: Math.cos(b.a) * b.r, v: Math.sin(b.a) * b.r };
}

/**
 * Dibuja la ruleta con centro (x, y) en el plano de la mesa.
 * o = { phi: ángulo del rotor (horario +), smear: arco de barrido en rad, ball: { a, r, z, inPocket }, flash }
 */
export function drawRoulette(ctx, cam, x, y, o) {
  const { phi = 0, smear = 0, ball = null } = o;
  // sombra del aparato sobre el paño
  contactShadow(ctx, cam, x, y, WH.R * 0.98, { alpha: 0.6, dx: 24, dy: -26, soft: 1.18 });
  // costado exterior del aro
  const Fo = cylFrame(cam, x, y, 0, WH.R, WH.rimZ);
  const side = sidePath(Fo, Fo.th0, Fo.th0 + Math.PI, 24);
  const a = Fo.P(Fo.th0), c = Fo.P(Fo.th0 + Math.PI);
  ctx.fillStyle = lin(ctx, a[0], a[1], c[0], c[1], [[0, PAL.navy600], [0.35, PAL.navy800], [1, PAL.ink]]);
  ctx.fill(side);
  // pared interior (se ve del lado lejano)
  ctx.fillStyle = PAL.navy900;
  ctx.fill(capPath(cylFrame(cam, x, y, WH.rimZ - 2, WH.rotor + 2, 0), true, 40));

  // rotor con barrido rotacional
  const m = cam.aff(x, y, WH.rotorZ);
  const rotorDraw = (c2, ang) => {
    c2.save();
    c2.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    c2.rotate(ang);
    drawImgCentered(c2, rotor);
    c2.restore();
  };
  if (smear > 0.01) {
    // barrido rotacional: n copias promediadas en un lienzo chico del tamaño del rotor (no a pantalla completa)
    const S = smearBuf.width, half = S / 2, k = S / (2 * (WH.rotor + 4));
    const b = smearBuf.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.globalAlpha = 1;
    b.clearRect(0, 0, S, S);
    b.globalCompositeOperation = 'lighter';
    const n = Math.min(14, 4 + Math.ceil(smear / 0.05));
    b.globalAlpha = 1 / n;
    for (let i = 0; i < n; i++) {
      b.setTransform(k, 0, 0, k, half, half);
      b.rotate(phi - smear * (i / (n - 1)));
      b.drawImage(rotor, -rotor.width / (2 * K), -rotor.height / (2 * K), rotor.width / K, rotor.height / K);
    }
    ctx.save();
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.drawImage(smearBuf, -half / k, -half / k, S / k, S / k);
    ctx.restore();
  } else {
    rotorDraw(ctx, phi);
  }
  ctx.save();
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  drawImgCentered(ctx, rotorLight);
  ctx.restore();

  if (ball && ball.inPocket) drawBall(ctx, cam, x, y, ball);

  // tazón fijo encima (tapa la parte cercana del rotor)
  const mb = cam.aff(x, y, WH.rimZ);
  ctx.save();
  ctx.transform(mb[0], mb[1], mb[2], mb[3], mb[4], mb[5]);
  drawImgCentered(ctx, bowl);
  ctx.restore();

  drawTurret(ctx, cam, x, y, phi, smear);
  if (ball && !ball.inPocket) drawBall(ctx, cam, x, y, ball);
}

/** Torreta en cruz: domo dorado, cuatro brazos finos con perillas y un huso corto. Gira con el rotor. */
function drawTurret(ctx, cam, x, y, phi, smear) {
  const z0 = WH.rotorZ + 6, zArm = z0 + 15, zTop = z0 + 24;
  // domo de la base
  const Fd = cylFrame(cam, x, y, z0, 22, 9);
  const da = Fd.P(Fd.th0), dc = Fd.P(Fd.th0 + Math.PI);
  ctx.fillStyle = lin(ctx, da[0], da[1], dc[0], dc[1], [[0, DB.brassLight], [0.4, DB.brass], [1, DB.brassDeep]]);
  ctx.fill(sidePath(Fd, Fd.th0, Fd.th0 + Math.PI, 12));
  ctx.fillStyle = DB.brass;
  ctx.fill(capPath(Fd, true, 24));
  // brazos (ordenados de lejos a cerca)
  const arms = [];
  for (let i = 0; i < 4; i++) {
    const ang = phi + (i * Math.PI) / 2 + Math.PI / 4;
    const u = Math.cos(ang) * 54, v = Math.sin(ang) * 54;
    arms.push({ tip: cam.p(x + u, y - v, zArm), mid: cam.p(x + u * 0.5, y - v * 0.5, zArm + 2), depth: v });
  }
  arms.sort((p, q) => p.depth - q.depth);
  const ctr = cam.p(x, y, zArm + 3);
  const s = ctr.s;
  const fade = clamp(1 - smear * 1.6, 0.35, 1);
  // huso central
  const F = cylFrame(cam, x, y, zArm - 4, 6, zTop - zArm + 4);
  const a = F.P(F.th0), c = F.P(F.th0 + Math.PI);
  for (const arm of arms) {
    ctx.save();
    ctx.globalAlpha *= fade;
    ctx.lineCap = 'round';
    ctx.strokeStyle = DB.brassDeep;
    ctx.lineWidth = 6 * s;
    ctx.beginPath(); ctx.moveTo(ctr.x, ctr.y + 1.5 * s); ctx.quadraticCurveTo(arm.mid.x, arm.mid.y + 1.5 * s, arm.tip.x, arm.tip.y + 1.5 * s); ctx.stroke();
    ctx.strokeStyle = DB.brass;
    ctx.lineWidth = 4.2 * s;
    ctx.beginPath(); ctx.moveTo(ctr.x, ctr.y); ctx.quadraticCurveTo(arm.mid.x, arm.mid.y, arm.tip.x, arm.tip.y); ctx.stroke();
    ctx.strokeStyle = rgba(PAL.goldPale, 0.9);
    ctx.lineWidth = 1.3 * s;
    ctx.beginPath(); ctx.moveTo(ctr.x - s, ctr.y - 1.3 * s); ctx.quadraticCurveTo(arm.mid.x - s, arm.mid.y - 1.3 * s, arm.tip.x - s, arm.tip.y - 1.3 * s); ctx.stroke();
    knob(ctx, arm.tip.x, arm.tip.y, 6.4 * s);
    ctx.restore();
  }
  ctx.fillStyle = lin(ctx, a[0], a[1], c[0], c[1], [[0, DB.brassHi], [0.35, DB.brass], [1, DB.brassDeep]]);
  ctx.fill(sidePath(F, F.th0, F.th0 + Math.PI, 8));
  const top = cam.p(x, y, zTop);
  knob(ctx, top.x, top.y, 7.5 * s);
}

/** Perilla dorada esférica: base, sombra dura y punto especular. */
function knob(ctx, x, y, r) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = DB.brass; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 1.05, 0, TAU);
  ctx.rect(x + r * 3, y - r * 3, -r * 6, r * 6);
  ctx.fillStyle = DB.brassDark;
  ctx.fill('evenodd');
  ctx.restore();
  ctx.beginPath(); ctx.arc(x - r * 0.38, y - r * 0.4, r * 0.32, 0, TAU); ctx.fillStyle = DB.brassHi; ctx.fill();
}

/** Bolita de marfil con sombra de apoyo. */
function drawBall(ctx, cam, x, y, b) {
  const { u, v } = ballPos(b);
  const baseZ = b.inPocket ? WH.rotorZ + 2 : WH.rimZ - 6;
  const g = cam.p(x + u + 3, y - v - 3, baseZ);
  const p = cam.p(x + u, y - v, baseZ + 7 + (b.z || 0));
  const r = 7.2 * p.s;
  // sombra
  ctx.beginPath();
  ctx.ellipse(g.x, g.y, r * 1.1, r * 0.75, 0, 0, TAU);
  ctx.fillStyle = rgba(PAL.ink, 0.45 * clamp(1 - (b.z || 0) / 40));
  ctx.fill();
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fillStyle = DB.ivory; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.clip();
  ctx.beginPath(); ctx.arc(p.x - r * 0.3, p.y - r * 0.32, r * 1.02, 0, TAU);
  ctx.rect(p.x + r * 3, p.y - r * 3, -r * 6, r * 6);
  ctx.fillStyle = '#CDBFA8';
  ctx.fill('evenodd');
  ctx.restore();
  ctx.beginPath(); ctx.arc(p.x - r * 0.36, p.y - r * 0.38, r * 0.3, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
  if (b.glint > 0.01) sparkle(ctx, p.x - r * 0.3, p.y - r * 0.35, r * 3.2 * b.glint, { alpha: b.glint });
}
