// Personaje-ícono (proporción 1:3): especialista en cruceros con gorra de capitán, vincha con micrófono y
// chaqueta blanca en 3 tonos (blanco, sombra fría al 20 % y filo cálido). Hombros de ≈2,2 cabezas con caída,
// cuello de camisa, brazo que nace del hombro (codo a la altura del pecho) y mano de 4 dedos + pulgar.
// Cabeza y torso son sprites cacheados; cara, brazo, mano, cola de pelo y micrófono se animan en vivo.
// Origen local = centro de la cabeza. El encuadre lo corta a la altura del pecho.
import { PAL, shade, rgba, mixHex } from '../../engine/color.js';
import { TAU, clamp, lerp } from '../../engine/ease.js';
import { drawPin } from '../../brand/pin.js';
import { shade3, gloss } from './shade3.js';
import { tones, sprite, drawSprite, shadowOf } from './util.js';

const SKIN = tones('#F1B38C', -0.15, 0.16);
const HAIR = tones(mixHex(PAL.navy900, PAL.dusk, 0.32), -0.35, 0.3);
// chaqueta: base blanca · sombra fría (blanco con 20 % de océano) · filo cálido
const JK = { base: '#F7FAFD', dark: mixHex('#FFFFFF', PAL.ocean600, 0.2), light: '#FFE6BC' };
const SHIRT = { base: '#FFFFFF', dark: mixHex('#FFFFFF', PAL.ocean500, 0.16), light: '#FFFFFF' };
const NAVY = tones(PAL.navy700, -0.35, 0.28);
const BRASS = tones(PAL.gold, -0.26, 0.5);
const HR = 92;

let HEAD = null, BODY = null, BODY_SH = null, TAIL = null;

/** Torso: base del cuello → caída del hombro → deltoides → costados (≈2,24 cabezas de hombro a hombro). */
function torsoPath(ox = 0, oy = 0) {
  const p = new Path2D();
  p.moveTo(-50 + ox, 104 + oy);
  p.bezierCurveTo(-110 + ox, 112 + oy, -160 + ox, 138 + oy, -188 + ox, 170 + oy);
  p.bezierCurveTo(-204 + ox, 188 + oy, -208 + ox, 208 + oy, -206 + ox, 236 + oy);
  p.lineTo(-198 + ox, 470 + oy); p.lineTo(198 + ox, 470 + oy); p.lineTo(206 + ox, 236 + oy);
  p.bezierCurveTo(208 + ox, 208 + oy, 204 + ox, 188 + oy, 188 + ox, 170 + oy);
  p.bezierCurveTo(160 + ox, 138 + oy, 110 + ox, 112 + oy, 50 + ox, 104 + oy);
  p.closePath();
  return p;
}
/** Manga del brazo que cuelga (lado derecho de pantalla). */
function sleevePath() {
  const p = new Path2D();
  p.moveTo(150, 178);
  p.bezierCurveTo(186, 168, 214, 190, 218, 236);
  p.lineTo(226, 470); p.lineTo(150, 470);
  p.bezierCurveTo(152, 380, 150, 300, 146, 250);
  p.closePath();
  return p;
}
const facePath = (ox = 0, oy = 0) => { const p = new Path2D(); p.ellipse(ox, 4 + oy, HR - 4, HR, 0, 0, TAU); return p; };

function paintBody(c) {
  // cuello (en sombra bajo la mandíbula)
  const neck = new Path2D();
  neck.moveTo(-34, 60); neck.lineTo(34, 60); neck.lineTo(38, 132); neck.lineTo(-38, 132); neck.closePath();
  shade3(c, neck, SKIN, { sh: 14, rim: 0 });
  c.fillStyle = rgba(shade(SKIN.base, -0.32), 0.6);
  c.beginPath(); c.ellipse(0, 78, 38, 20, 0, 0, TAU); c.fill();
  // torso: chaqueta blanca en 3 tonos (sombra fría abajo-derecha, filo cálido arriba-izquierda)
  const body = torsoPath();
  shade3(c, body, JK, { sh: 30, rim: 4, grain: 0.06 });
  // caída de luz hacia abajo (la luz viene de arriba)
  c.save();
  c.clip(body);
  const fall = c.createLinearGradient(0, 260, 0, 470);
  fall.addColorStop(0, rgba(JK.dark, 0));
  fall.addColorStop(1, rgba(JK.dark, 0.75));
  c.fillStyle = fall;
  c.fillRect(-230, 260, 460, 220);
  // axila del brazo levantado
  c.fillStyle = rgba(JK.dark, 0.9);
  c.beginPath(); c.ellipse(-196, 262, 26, 60, 0.1, 0, TAU); c.fill();
  c.restore();
  // solapas (cuello de la chaqueta): forma con sombra y filo
  for (const s of [-1, 1]) {
    const lap = new Path2D();
    lap.moveTo(s * 46, 108); lap.lineTo(s * 86, 150); lap.lineTo(s * 70, 176); lap.lineTo(s * 92, 196);
    lap.lineTo(s * 40, 320); lap.lineTo(s * 14, 246); lap.closePath();
    shade3(c, lap, JK, { sh: 7, rim: 2.5 });
    c.strokeStyle = rgba(JK.dark, 0.9);
    c.lineWidth = 3;
    c.stroke(lap);
  }
  // camisa en V y cuello de camisa (dos puntas)
  const v = new Path2D();
  v.moveTo(-40, 104); v.lineTo(40, 104); v.lineTo(10, 238); v.lineTo(-10, 238); v.closePath();
  shade3(c, v, SHIRT, { sh: 6, rim: 0 });
  for (const s of [-1, 1]) {
    const col = new Path2D();
    col.moveTo(s * 6, 112); col.lineTo(s * 40, 98); col.lineTo(s * 62, 150); col.lineTo(s * 18, 140); col.closePath();
    c.save(); c.translate(s * 3, 5); c.fillStyle = rgba(PAL.navy700, 0.18); c.fill(col); c.restore();
    shade3(c, col, SHIRT, { sh: 5, rim: 0 });
    c.strokeStyle = rgba(SHIRT.dark, 1);
    c.lineWidth = 2;
    c.stroke(col);
  }
  // corbata coral
  const tie = new Path2D();
  tie.moveTo(-15, 140); tie.lineTo(15, 140); tie.lineTo(20, 222); tie.lineTo(0, 246); tie.lineTo(-20, 222); tie.closePath();
  shade3(c, tie, tones(PAL.coral, -0.22, 0.25), { sh: 6, rim: 2 });
  const knot = new Path2D();
  knot.moveTo(-16, 124); knot.lineTo(16, 124); knot.lineTo(12, 146); knot.lineTo(-12, 146); knot.closePath();
  shade3(c, knot, tones(PAL.coral, -0.28, 0.3), { sh: 4, rim: 2 });
  // manga del brazo que cuelga, separada del torso por un pliegue en sombra
  const sl = sleevePath();
  c.save(); c.translate(-6, 0); c.fillStyle = rgba(JK.dark, 1); c.fill(sl); c.restore();
  shade3(c, sl, JK, { sh: 16, rim: 3, grain: 0.05 });
  // botones dorados (doble fila; el encuadre corta en el pecho)
  for (const x of [-34, 34]) {
    for (const y of [300, 372, 444]) {
      c.fillStyle = BRASS.dark; c.beginPath(); c.arc(x + 1.5, y + 2, 9.5, 0, TAU); c.fill();
      c.fillStyle = BRASS.base; c.beginPath(); c.arc(x, y, 9.5, 0, TAU); c.fill();
      c.fillStyle = BRASS.light; c.beginPath(); c.arc(x - 3, y - 3, 3.2, 0, TAU); c.fill();
    }
  }
  // charreteras sobre la caída del hombro
  for (const s of [-1, 1]) {
    c.save();
    c.translate(s * 142, 150);
    c.rotate(s * 0.46);
    const ep = new Path2D();
    ep.moveTo(-46, -14); ep.lineTo(46, -14); ep.quadraticCurveTo(56, 0, 46, 14); ep.lineTo(-46, 14); ep.closePath();
    shade3(c, ep, NAVY, { sh: 5, rim: 2 });
    c.fillStyle = PAL.gold;
    for (const k of [-20, -4, 12]) c.fillRect(k, -10, 7, 20);
    c.fillStyle = BRASS.base; c.beginPath(); c.arc(s * -34, 0, 6.5, 0, TAU); c.fill();
    c.restore();
  }
  // pin de marca como identificación en el pecho
  drawPin(c, 118, 300, 52, { gloss: 0.7 });
  c.strokeStyle = rgba(JK.dark, 1);
  c.lineWidth = 3.5;
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(88, 342); c.lineTo(150, 338); c.stroke();
}

function paintHead(c) {
  // pelo de atrás (cae a los costados)
  const back = new Path2D();
  back.moveTo(-98, -30); back.quadraticCurveTo(-112, 60, -84, 92); back.lineTo(84, 92);
  back.quadraticCurveTo(112, 60, 98, -30); back.closePath();
  shade3(c, back, HAIR, { sh: 10, rim: 0 });
  // orejas
  for (const s of [-1, 1]) {
    const ear = new Path2D();
    ear.ellipse(s * 90, 16, 17, 22, 0, 0, TAU);
    shade3(c, ear, SKIN, { sh: 6, rim: 0 });
  }
  // cara
  const face = facePath();
  shade3(c, face, SKIN, { sh: 16, rim: 3, grain: 0.05 });
  // flequillo bajo la visera
  const fr = new Path2D();
  fr.moveTo(-92, -10); fr.quadraticCurveTo(-90, -62, -40, -62); fr.lineTo(60, -62);
  fr.quadraticCurveTo(96, -60, 94, -6); fr.quadraticCurveTo(70, -36, 30, -30);
  fr.quadraticCurveTo(-10, -26, -40, -40); fr.quadraticCurveTo(-70, -30, -92, -10); fr.closePath();
  shade3(c, fr, HAIR, { sh: 7, rim: 2 });
  // gorra: copa blanca, banda navy, visera con brillo y cordón dorado
  c.save();
  c.rotate(-0.06);
  const crown = new Path2D();
  crown.moveTo(-104, -66); crown.bezierCurveTo(-132, -112, -100, -150, 0, -152);
  crown.bezierCurveTo(100, -150, 132, -112, 104, -66); crown.closePath();
  shade3(c, crown, JK, { sh: 16, rim: 3, grain: 0.05 });
  c.fillStyle = rgba(JK.dark, 0.6);
  c.beginPath(); c.ellipse(0, -108, 70, 9, 0, 0, TAU); c.fill();
  const band = new Path2D();
  band.moveTo(-100, -86); band.lineTo(100, -86); band.lineTo(98, -54); band.lineTo(-98, -54); band.closePath();
  shade3(c, band, NAVY, { sh: 5, rim: 2 });
  c.fillStyle = PAL.gold;
  c.fillRect(-96, -60, 192, 5);
  drawPin(c, 0, -60, 44, { gloss: 0.6 });
  const visor = new Path2D();
  visor.moveTo(-98, -56); visor.quadraticCurveTo(0, -60, 98, -56); visor.quadraticCurveTo(70, -22, 0, -20);
  visor.quadraticCurveTo(-70, -22, -98, -56); visor.closePath();
  shade3(c, visor, tones(PAL.navy900, -0.4, 0.4), { sh: 6, rim: 2.5 });
  gloss(c, visor, -98, -60, 98, -20, { alpha: 0.35, width: 0.08, at: 0.3 });
  c.restore();
}

function paintTail(c) {
  // cola de pelo (cuelga desde (0,0) hacia abajo)
  const p = new Path2D();
  p.moveTo(-14, 0); p.bezierCurveTo(-46, 40, -40, 120, -6, 150);
  p.bezierCurveTo(10, 120, 26, 60, 16, 0); p.closePath();
  shade3(c, p, HAIR, { sh: 9, rim: 2.5 });
  c.fillStyle = PAL.coral;
  c.beginPath(); c.ellipse(0, 4, 17, 10, 0, 0, TAU); c.fill();
}

export function initSpecialist() {
  if (HEAD) return;
  HEAD = sprite(300, 300, 150, 175, 1.5, paintHead);
  BODY = sprite(520, 420, 260, -50, 1.25, paintBody);
  BODY_SH = shadowOf(BODY, { blur: 20 });
  TAIL = sprite(100, 180, 50, 14, 1.5, paintTail);
}

/**
 * Dibuja al personaje. o = {
 *   breath (0..1), headDy (px), headSq (0..1 aplastamiento de la cabeza al asentir), look (px: rasgos hacia abajo),
 *   tilt (rad de cabeza), tail (rad de la cola), blink (0..1), wink (0..1, ojo derecho de pantalla), happy (0..1),
 *   mouth (0..1), led (0..1), arm: { pose: 0 (saludo) → 1 (pulgar arriba), wave (rad), swing (px), pop (escala de la mano) } }
 */
export function drawSpecialist(c, o = {}) {
  initSpecialist();
  const br = o.breath ?? 0;
  // sombra del conjunto
  c.save();
  c.globalAlpha *= 0.3;
  c.translate(20, 26);
  drawSprite(c, BODY_SH);
  c.restore();
  c.save();
  // respiración: el torso se infla desde abajo
  c.translate(0, 470);
  c.scale(1 + 0.006 * br, 1 + 0.012 * br);
  c.translate(0, -470);
  drawSprite(c, BODY);
  c.restore();
  drawArm(c, o.arm ?? {});
  c.save();
  c.translate(0, (o.headDy ?? 0) - 5 * br);
  c.rotate(o.tilt ?? 0);
  if (o.headSq) c.scale(1 + 0.03 * o.headSq, 1 - 0.05 * o.headSq);
  // cola de pelo detrás de la cabeza
  c.save();
  c.translate(-86, -24);
  c.rotate(0.5 + (o.tail ?? 0));
  drawSprite(c, TAIL);
  c.restore();
  drawSprite(c, HEAD);
  c.save();
  c.translate(0, o.look ?? 0);
  drawFace(c, o);
  c.restore();
  drawHeadset(c, o.led ?? 0, o.mouth ?? 0);
  c.restore();
}

function drawFace(c, o) {
  const blink = clamp(o.blink ?? 0), happy = clamp(o.happy ?? 0), wink = clamp(o.wink ?? 0);
  // cachetes
  c.fillStyle = rgba(PAL.coral, 0.28 + 0.12 * Math.max(happy, wink));
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 52, 42 - 3 * wink * (s > 0 ? 1 : 0), 17, 11, 0, 0, TAU); c.fill(); }
  // cejas (la del guiño baja)
  c.strokeStyle = HAIR.base;
  c.lineWidth = 7;
  c.lineCap = 'round';
  for (const s of [-1, 1]) {
    const w = s > 0 ? wink : 0;
    c.beginPath();
    c.moveTo(s * 20, -20 - happy * 4 + 6 * w);
    c.quadraticCurveTo(s * 36, -32 - happy * 6 + 4 * w, s * 52, -22 - happy * 3 + 2 * w);
    c.stroke();
  }
  // ojos: abiertos → parpadeo → felices (arquitos) · guiño en el derecho de pantalla
  for (const s of [-1, 1]) {
    const x = s * 35, y = 6;
    const closed = s > 0 ? Math.max(wink, blink) : blink;
    if (happy > 0.5 && !(s > 0 && wink > 0.5)) {
      c.strokeStyle = PAL.navy900;
      c.lineWidth = 7;
      c.beginPath(); c.moveTo(x - 12, y + 4); c.quadraticCurveTo(x, y - 12, x + 12, y + 4); c.stroke();
      continue;
    }
    if (s > 0 && wink > 0.5) {
      // guiño: arco hacia abajo con pestañita
      c.strokeStyle = PAL.navy900;
      c.lineWidth = 7;
      c.beginPath(); c.moveTo(x - 13, y - 2); c.quadraticCurveTo(x, y + 9, x + 13, y - 2); c.stroke();
      c.lineWidth = 4;
      c.beginPath(); c.moveTo(x + 12, y - 1); c.lineTo(x + 20, y - 8); c.stroke();
      continue;
    }
    const ry = 13 * (1 - closed * 0.92);
    c.fillStyle = PAL.navy900;
    c.beginPath(); c.ellipse(x, y, 10, Math.max(1.5, ry), 0, 0, TAU); c.fill();
    if (closed < 0.5) {
      c.fillStyle = '#FFFFFF';
      c.beginPath(); c.arc(x + 3, y - 4, 3.6, 0, TAU); c.fill();
    }
  }
  // nariz
  c.fillStyle = SKIN.dark;
  c.beginPath(); c.ellipse(4, 32, 9, 7, 0.2, 0, TAU); c.fill();
  // boca: sonrisa abierta (se abre más al hablar; se ladea con el guiño)
  const m = 0.55 + 0.45 * clamp(o.mouth ?? 0);
  const lw = 4 * wink;
  const mouth = new Path2D();
  mouth.moveTo(-30, 54 + lw);
  mouth.quadraticCurveTo(0, 60, 30, 54 - lw);
  mouth.quadraticCurveTo(26, 54 + 34 * m, 0, 56 + 34 * m);
  mouth.quadraticCurveTo(-26, 54 + 34 * m, -30, 54 + lw);
  mouth.closePath();
  c.fillStyle = shade(PAL.coral, -0.55);
  c.fill(mouth);
  c.save();
  c.clip(mouth);
  c.fillStyle = '#FFFFFF';
  c.fillRect(-32, 50, 64, 11);
  c.fillStyle = PAL.coral;
  c.beginPath(); c.ellipse(4, 58 + 34 * m, 18, 12, 0, 0, TAU); c.fill();
  c.restore();
}

function drawHeadset(c, led, mouth) {
  // auricular (izq. de ella) con aro cian y brazo del micrófono hasta la boca
  const cup = new Path2D();
  cup.ellipse(94, 14, 26, 34, 0, 0, TAU);
  shade3(c, cup, NAVY, { sh: 6, rim: 2.5 });
  c.strokeStyle = PAL.brandCyan;
  c.lineWidth = 5;
  c.beginPath(); c.ellipse(94, 14, 15, 22, 0, 0, TAU); c.stroke();
  c.strokeStyle = NAVY.base;
  c.lineWidth = 10;
  c.beginPath(); c.moveTo(94, -16); c.quadraticCurveTo(100, -46, 92, -60); c.stroke();
  c.lineCap = 'round';
  c.strokeStyle = NAVY.dark;
  c.lineWidth = 8;
  c.beginPath(); c.moveTo(90, 40); c.quadraticCurveTo(84, 82, 40 - mouth * 2, 76); c.stroke();
  c.strokeStyle = NAVY.light;
  c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(88, 40); c.quadraticCurveTo(82, 78, 42, 73); c.stroke();
  const cap = new Path2D();
  cap.ellipse(34, 76, 15, 10, -0.15, 0, TAU);
  shade3(c, cap, NAVY, { sh: 4, rim: 2 });
  c.fillStyle = rgba(PAL.coral, 0.5 + 0.5 * led);
  c.beginPath(); c.arc(28, 75, 3.6, 0, TAU); c.fill();
  if (led > 0.05) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = rgba(PAL.coralLight, 0.35 * led);
    c.beginPath(); c.arc(28, 75, 11, 0, TAU); c.fill();
    c.restore();
  }
}

/** Cápsula de (x0,y0) a (x1,y1) con radios w0 y w1. */
function capsule(x0, y0, x1, y1, w0, w1) {
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
  const p = new Path2D();
  p.moveTo(x0 + nx * w0, y0 + ny * w0);
  p.lineTo(x1 + nx * w1, y1 + ny * w1);
  p.arc(x1, y1, w1, a + Math.PI / 2, a - Math.PI / 2, true);
  p.lineTo(x0 - nx * w0, y0 - ny * w0);
  p.arc(x0, y0, w0, a - Math.PI / 2, a + Math.PI / 2, true);
  p.closePath();
  return p;
}

// articulaciones del brazo levantado: hombro (dentro del deltoides), codo a la altura del pecho, muñeca
const SHO = [-176, 206];
const ELB = [[-300, 300], [-282, 296]];   // saludo · pulgar arriba
const WRI = [[-292, 124], [-258, 150]];

function drawArm(c, a) {
  const k = clamp(a.pose ?? 0);
  const sw = a.swing ?? 0;
  const E0 = [lerp(ELB[0][0], ELB[1][0], k) + sw * 0.3, lerp(ELB[0][1], ELB[1][1], k)];
  const W0 = [lerp(WRI[0][0], WRI[1][0], k) + sw, lerp(WRI[0][1], WRI[1][1], k) - Math.abs(sw) * 0.2];
  // sombra del brazo sobre la chaqueta
  c.save();
  c.translate(12, 10);
  c.fillStyle = rgba(PAL.navy700, 0.16);
  c.fill(capsule(SHO[0], SHO[1], E0[0], E0[1], 38, 33));
  c.restore();
  // brazo y antebrazo: manga blanca en 3 tonos
  shade3(c, capsule(SHO[0], SHO[1], E0[0], E0[1], 38, 33), JK, { sh: 14, rim: 3.5 });
  shade3(c, capsule(E0[0], E0[1], W0[0], W0[1], 33, 28), JK, { sh: 12, rim: 3.5 });
  // pliegues del codo
  c.strokeStyle = rgba(JK.dark, 1);
  c.lineWidth = 4;
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(E0[0] + 10, E0[1] - 30); c.quadraticCurveTo(E0[0] + 22, E0[1] - 8, E0[0] + 12, E0[1] + 14); c.stroke();
  c.beginPath(); c.moveTo(E0[0] + 18, E0[1] - 44); c.lineTo(E0[0] + 26, E0[1] - 34); c.stroke();
  const fa = Math.atan2(W0[1] - E0[1], W0[0] - E0[0]);
  c.save();
  c.translate(W0[0], W0[1]);
  c.rotate(fa + Math.PI / 2);
  // puño de la manga con galones
  const cuff = new Path2D();
  cuff.moveTo(-30, -6); cuff.lineTo(30, -6); cuff.lineTo(31, 22); cuff.lineTo(-31, 22); cuff.closePath();
  shade3(c, cuff, NAVY, { sh: 4, rim: 1.5 });
  c.fillStyle = PAL.gold;
  c.fillRect(-29, 3, 58, 4.5);
  c.fillRect(-29, 12, 58, 4.5);
  c.translate(0, -4);
  c.rotate(a.wave ?? 0);
  const ps = a.pop ?? 1;
  c.scale(ps, ps);
  if (k < 0.5) drawOpenHand(c); else drawThumbUp(c);
  c.restore();
}

/** Mano abierta que saluda: palma, 4 dedos y pulgar (hacia la cabeza), en 3 tonos de piel. */
function drawOpenHand(c) {
  const fingers = [[-21, 40, -0.16], [-7, 49, -0.05], [7, 47, 0.05], [21, 38, 0.15]];
  for (const [x, L, a] of fingers) {
    const x1 = x + Math.sin(a) * L, y1 = -52 - Math.cos(a) * L;
    shade3(c, capsule(x, -46, x1, y1, 8, 7.2), SKIN, { sh: 4, rim: 1.5 });
  }
  // pulgar hacia afuera (lado de la cabeza)
  shade3(c, capsule(22, -16, 46, -50, 9.5, 8), SKIN, { sh: 4, rim: 1.5 });
  const palm = new Path2D();
  palm.moveTo(-29, -50); palm.quadraticCurveTo(-30, -2, -18, 2); palm.lineTo(20, 2);
  palm.quadraticCurveTo(30, -4, 29, -50); palm.quadraticCurveTo(0, -58, -29, -50); palm.closePath();
  shade3(c, palm, SKIN, { sh: 8, rim: 2.5 });
  // líneas de la palma y nudillos
  c.strokeStyle = rgba(SKIN.dark, 0.9);
  c.lineWidth = 2.5;
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(-18, -34); c.quadraticCurveTo(-2, -28, 14, -38); c.stroke();
  c.beginPath(); c.moveTo(-10, -18); c.quadraticCurveTo(4, -22, 16, -14); c.stroke();
}

/** Pulgar arriba: puño con los 4 dedos doblados (de frente) y el pulgar hacia arriba. */
function drawThumbUp(c) {
  // pulgar
  shade3(c, capsule(-14, -48, -10, -104, 12, 11), SKIN, { sh: 5, rim: 2 });
  c.fillStyle = rgba('#FFFFFF', 0.55);
  c.beginPath(); c.ellipse(-12, -104, 6, 7, 0, 0, TAU); c.fill();
  // puño
  const fist = new Path2D();
  fist.moveTo(-30, -50); fist.quadraticCurveTo(-32, 0, -16, 2); fist.lineTo(20, 2);
  fist.quadraticCurveTo(34, -2, 32, -30); fist.quadraticCurveTo(30, -56, 0, -56); fist.quadraticCurveTo(-24, -56, -30, -50); fist.closePath();
  shade3(c, fist, SKIN, { sh: 8, rim: 2.5 });
  // dedos doblados: cuatro rollitos apilados del lado de afuera
  for (let i = 0; i < 4; i++) {
    const y = -50 + i * 13;
    shade3(c, capsule(4, y + 6, 30, y + 6, 6.8, 6.8), SKIN, { sh: 3.5, rim: 1.2 });
  }
}
