// Pines de marca sobre el mapa: caen con aceleración y estiramiento, aplastan en el beat exacto (cuadro de
// impacto = cue), rebotan con un saltito y se asientan. Llevan sombra proyectada sobre el mapa (luz arriba-
// izquierda), sombreado en 3 tonos sobre el naranja de marca, anillos de «ping» en el piso y chispas.
import { drawPin, PIN } from '../../brand/pin.js';
import { PAL, rgba, shade } from '../../engine/color.js';
import { E, clamp, TAU } from '../../engine/ease.js';
import { sparkle } from '../../engine/draw.js';
import { hash } from '../../engine/noise.js';

// silueta del cuerpo del pin (misma geometría que src/brand/pin.js, para sombras y sombreado)
let BODY = null;
export function pinBody() {
  if (BODY) return BODY;
  const { headCx: cx, headCy: cy, headR: R, tipX, tipY } = PIN;
  const a = Math.acos(R / (tipY - cy));
  const p = new Path2D();
  p.moveTo(tipX, tipY);
  p.lineTo(cx - Math.sin(a) * R, cy + Math.cos(a) * R);
  p.arc(cx, cy, R, Math.PI / 2 + a, Math.PI / 2 - a + TAU, false);
  p.closePath();
  BODY = p;
  return p;
}

/**
 * Física de la caída: devuelve { y (offset px, negativo = arriba), sx, sy, a (alfa), h (0..1 altura) } o null.
 * fall = duración de la caída antes del impacto en tLand.
 */
export function dropState(t, tLand, size, { fall = 0.24, height = 2.4 } = {}) {
  const dt = t - tLand;
  if (dt < -fall) return null;
  if (dt < 0) {
    const p = 1 + dt / fall; // 0 → 1
    const h = 1 - p * p; // caída libre
    return { y: -height * size * h, sx: 1 - 0.14 * p * p, sy: 1 + 0.26 * p * p, a: clamp(p / 0.3), h };
  }
  // impacto: aplastamiento máximo en el cuadro del cue, rebote con resorte y saltito
  const sq = Math.exp(-dt * 10.5) * Math.cos(dt * TAU * 3.6);
  const sy = 1 - 0.3 * sq;
  const sx = 1 + 0.24 * sq;
  const hop = dt < 0.3 ? -size * 0.16 * Math.sin((Math.PI * dt) / 0.3) * Math.exp(-dt * 2) : 0;
  return { y: hop, sx, sy, a: 1, h: hop / (-size * 1.5) };
}

/** Sombra del pin sobre el mapa: silueta aplastada y corrida hacia abajo-derecha + mancha de contacto.
 *  long (0..1) = cuánto de la sombra larga proyectada se ve (el pin de Buenos Aires ES el sol del corte: no
 *  proyecta sombra larga hasta que el grade cálido se fue). */
export function drawPinShadow(ctx, x, y, size, { h = 0, alpha = 1, long = 1 } = {}) {
  const k = size / PIN.h;
  ctx.save();
  ctx.globalAlpha *= alpha * (1 - h * 0.6);
  // mancha de contacto
  const r = size * 0.2 * (1 + h * 0.8);
  const g = ctx.createRadialGradient(x + 3, y + 2, 0, x + 3, y + 2, r);
  g.addColorStop(0, rgba(PAL.ink, 0.55));
  g.addColorStop(1, rgba(PAL.ink, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 2, r, r * 0.42, 0, 0, TAU);
  ctx.fill();
  if (long <= 0.01) { ctx.restore(); return; }
  ctx.globalAlpha *= long;
  // sombra larga proyectada (la silueta se acuesta sobre el piso)
  ctx.translate(x + h * size * 0.5, y + h * size * 0.3);
  ctx.transform(1, 0, -0.62, -0.32, 0, 0);
  ctx.scale(k, k);
  ctx.translate(-PIN.tipX, -PIN.tipY);
  ctx.fillStyle = rgba(PAL.ink, 0.3);
  ctx.fill(pinBody());
  ctx.restore();
}

/**
 * Pin de marca con sombreado: tono base (marca), sombra plana abajo-derecha, filo de luz arriba-izquierda,
 * brillo especular y destello. o = { sx, sy, alpha, iris (0..1 abre la ventana), shine (0..1), t }
 */
export function drawShadedPin(ctx, x, y, size, o = {}) {
  if (o.rot) {
    // inclinado sobre la punta (abanico de pines vecinos en la toma amplia)
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.rot);
    ctx.translate(-x, -y);
    drawShadedPin(ctx, x, y, size, { ...o, rot: 0 });
    ctx.restore();
    return;
  }
  const k = size / PIN.h;
  const sx = o.sx ?? 1, sy = o.sy ?? 1;
  const t = o.t ?? 0;
  drawPin(ctx, x, y, size, {
    squash: [sx, sy], alpha: o.alpha, gloss: 0, shipDx: Math.sin(t * 2.1) * 6, bob: Math.sin(t * 3.3) * 3,
    sweep: o.sweep,
  });
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k * sx, k * sy);
  ctx.translate(-PIN.tipX, -PIN.tipY);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const body = pinBody();
  // ventana que se abre (iris) desde el disco naranja liso
  if (o.iris !== undefined && o.iris < 1) {
    const ir = PIN.innerR * clamp(o.iris);
    const p = new Path2D();
    p.arc(PIN.headCx, PIN.headCy, PIN.innerR + 1.5, 0, TAU);
    p.arc(PIN.headCx, PIN.headCy, Math.max(0, ir), 0, TAU, true);
    ctx.fillStyle = PAL.brandOrange;
    ctx.fill(p);
  }
  // aro naranja = cuerpo menos la ventana
  const ring = new Path2D();
  ring.addPath(body);
  ring.arc(PIN.headCx, PIN.headCy, PIN.innerR, 0, TAU);
  ctx.save();
  ctx.save();
  ctx.clip(ring, 'evenodd');
  // sombra plana abajo-derecha: todo lo que queda fuera de un círculo corrido hacia arriba-izquierda
  ctx.fillStyle = shade(PAL.brandOrange, -0.22);
  ctx.beginPath();
  ctx.rect(-50, -50, 600, 700);
  ctx.arc(PIN.headCx - 46, PIN.headCy - 40, PIN.headR + 22, 0, TAU);
  ctx.fill('evenodd');
  // filo de luz arriba-izquierda (medialuna dentro de la cabeza)
  ctx.beginPath();
  ctx.arc(PIN.headCx, PIN.headCy, PIN.headR, 0, TAU);
  ctx.clip();
  ctx.fillStyle = rgba(PAL.peach, 0.9);
  ctx.beginPath();
  ctx.rect(-50, -50, 600, 700);
  ctx.arc(PIN.headCx + 15, PIN.headCy + 17, PIN.headR, 0, TAU);
  ctx.fill('evenodd');
  ctx.restore();
  ctx.clip(body);
  // brillo especular sobre el vidrio de la ventana
  ctx.strokeStyle = rgba(PAL.white, 0.5);
  ctx.lineWidth = 15;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(PIN.headCx, PIN.headCy, PIN.innerR - 26, Math.PI * 1.1, Math.PI * 1.38);
  ctx.stroke();
  ctx.fillStyle = rgba(PAL.white, 0.45);
  ctx.beginPath();
  ctx.arc(PIN.headCx - 112, PIN.headCy - 58, 10, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.restore();
  if (o.shine > 0.01) {
    const hx = x + (PIN.headCx - 60 - PIN.tipX) * k * sx, hy = y + (PIN.headCy - 120 - PIN.tipY) * k * sy;
    sparkle(ctx, hx, hy, size * 0.32 * o.shine, { alpha: o.shine, rot: t * 1.5 });
  }
}

/** Anillos de «ping» en el piso, destello de impacto y chispas que salen disparadas. */
export function drawPing(ctx, x, y, size, t, tLand, { color = PAL.aqua100, seed = 1, big = 1 } = {}) {
  const dt = t - tLand;
  if (dt < 0 || dt > 0.9) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // destello de impacto
  if (dt < 0.22) {
    const f = 1 - dt / 0.22;
    const r = size * (0.5 + dt * 3) * big;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(PAL.goldPale, 0.7 * f));
    g.addColorStop(0.5, rgba(PAL.gold, 0.25 * f));
    g.addColorStop(1, rgba(PAL.gold, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.5, 0, 0, TAU);
    ctx.fill();
  }
  // dos anillos escalonados
  for (const [d0, mul] of [[0, 1], [0.1, 0.72]]) {
    const q = (dt - d0) / 0.62;
    if (q <= 0 || q >= 1) continue;
    const e = E.outCubic(q);
    const rx = size * (0.12 + 0.95 * e) * mul * big;
    ctx.strokeStyle = rgba(color, (1 - q) * 0.95);
    ctx.lineWidth = 1 + 4.5 * (1 - q);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, rx * 0.4, 0, 0, TAU);
    ctx.stroke();
  }
  // chispas
  const n = 7;
  for (let i = 0; i < n; i++) {
    const q = dt / (0.45 + 0.2 * hash(i, seed));
    if (q >= 1) continue;
    const ang = (i / n) * TAU + hash(i, seed + 3) * 0.6;
    const d = size * (0.2 + 0.85 * E.outCubic(q)) * big;
    const sx = x + Math.cos(ang) * d, sy = y + Math.sin(ang) * d * 0.45 - size * 0.25 * Math.sin(Math.PI * q);
    sparkle(ctx, sx, sy, size * 0.07 * (1 - q), { alpha: 1 - q, color: i % 3 ? PAL.white : PAL.goldLight, halo: 0.4 });
  }
  ctx.restore();
}
