// Pin de marca de Prime Cruceros (la «o» del logo y el favicon): gota naranja con un crucero blanco
// navegando sobre mar cian. Recreado en vector a partir de docs/ref/favicon-logo.png (500×594).
// Lo usan el mapa (pines de destinos), el cierre (logo) y el match cut sol → pin.
import { TAU } from '../engine/ease.js';
import { PAL } from '../engine/color.js';

/** Geometría en el sistema de la referencia (500×594). El ancla de dibujo es la PUNTA (250, 594). */
export const PIN = { w: 500, h: 594, headCx: 250, headCy: 250, headR: 250, innerR: 192, tipX: 250, tipY: 594, horizonY: 310 };

let paths = null;
function build() {
  const { headCx: cx, headCy: cy, headR: R, tipX, tipY } = PIN;
  const d = tipY - cy;
  const a = Math.acos(R / d); // ángulo entre el eje hacia la punta y el punto de tangencia
  const tx = Math.sin(a) * R, ty = Math.cos(a) * R;
  const body = new Path2D();
  // arco grande por arriba entre los dos puntos de tangencia, y las dos rectas a la punta
  const start = Math.PI / 2 + a; // punto izquierdo (x = cx − tx)
  const end = Math.PI / 2 - a + TAU; // punto derecho
  body.moveTo(tipX, tipY);
  body.lineTo(cx - tx, cy + ty);
  body.arc(cx, cy, R, start, end, false);
  body.lineTo(tipX, tipY);
  body.closePath();
  const inner = new Path2D();
  inner.arc(cx, cy, PIN.innerR, 0, TAU);
  inner.closePath();
  // crucero (silueta del favicon)
  const hull = new Path2D('M40 255 L400 255 L316 362 L40 362 Z');
  const deck = new Path2D('M40 142 L215 142 L215 163 L258 163 L258 180 L322 255 L40 255 Z');
  const stripes = [];
  for (const y of [186, 199, 212, 226, 240]) {
    const xEnd = 258 + ((y - 180) * (322 - 258)) / (255 - 180) - 14;
    stripes.push([y, xEnd]);
  }
  paths = { body, inner, hull, deck, stripes };
}

/**
 * Dibuja el pin con la PUNTA en (x, y) y alto total `size` px.
 * o = { alpha, ring (color del anillo), sky, sea, ship (color barco), shipDx (px de referencia: el barco avanza),
 *       bob (px de referencia: cabeceo), gloss (0..1 brillo especular), sweep (0..1 barrido de luz), squash [sx, sy] }
 */
export function drawPin(ctx, x, y, size, o = {}) {
  if (!paths) build();
  const k = size / PIN.h;
  const [sx, sy] = o.squash ?? [1, 1];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k * sx, k * sy);
  ctx.translate(-PIN.tipX, -PIN.tipY);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.fillStyle = o.ring ?? PAL.brandOrange;
  ctx.fill(paths.body);
  // interior
  ctx.save();
  ctx.clip(paths.inner);
  ctx.fillStyle = o.sky ?? PAL.brandSky;
  ctx.fillRect(0, 0, 500, 500);
  ctx.fillStyle = o.sea ?? PAL.brandSea;
  const hz = PIN.horizonY + (o.seaLift ?? 0);
  ctx.fillRect(0, hz, 500, 300);
  ctx.save();
  ctx.translate(o.shipDx ?? 0, o.bob ?? 0);
  ctx.fillStyle = o.ship ?? '#ffffff';
  ctx.fill(paths.deck);
  ctx.fill(paths.hull);
  ctx.fillStyle = o.sky ?? PAL.brandSky;
  for (const [yy, xe] of paths.stripes) ctx.fillRect(40, yy, xe - 40, 4.5);
  ctx.restore();
  if (o.sweep && o.sweep > 0 && o.sweep < 1) {
    const bx = -150 + 800 * o.sweep;
    const g = ctx.createLinearGradient(bx - 90, 0, bx + 90, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 500, 500);
  }
  ctx.restore();
  if (o.gloss) {
    ctx.save();
    ctx.globalAlpha *= o.gloss;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(PIN.headCx, PIN.headCy, PIN.headR - 30, Math.PI * 1.08, Math.PI * 1.42);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** Centro y radio (en pantalla) de la cabeza del pin dibujado con punta en (x, y) y alto size. */
export function pinHead(x, y, size) {
  const k = size / PIN.h;
  return { cx: x + (PIN.headCx - PIN.tipX) * k, cy: y + (PIN.headCy - PIN.tipY) * k, r: PIN.headR * k, inner: PIN.innerR * k };
}
