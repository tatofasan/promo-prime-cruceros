// Ícono de WhatsApp vectorial propio (globo de diálogo con colita abajo a la izquierda + auricular adentro),
// construido con geometría en una caja de 100×100 centrada en (0, 0). Solo se usa en el CTA del cierre.
//   drawWhatsApp(ctx, cx, cy, 96, { color: '#fff' })            → contorno blanco (para la píldora verde)
//   drawWhatsApp(ctx, cx, cy, 96, { color: '#fff', bg: PAL.wa })  → con relleno de globo
// o.phone (0..1.3) escala sólo el auricular (para un pop interno) · o.ring (grosor relativo del aro).
import { smoothPath } from '../engine/draw.js';

const D2R = Math.PI / 180;
let geo = null;

// globo: círculo r 45 con la colita en la esquina inferior izquierda (se abre entre 112° y 152°)
function bubblePath(r = 45) {
  const p = new Path2D();
  const a0 = 152 * D2R, a1 = (112 + 360) * D2R;
  p.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
  p.arc(0, 0, r, a0, a1, false);
  p.lineTo(-49, 49);
  p.closePath();
  return p;
}

// auricular: lomo en «L» redondeada (de la cápsula de arriba a la izquierda a la de abajo a la derecha)
// con dos cápsulas gruesas que apuntan hacia adentro; todo inclinado un poco.
function phonePath() {
  // contorno exterior (lado de afuera del lomo) y luego el interior, en sentido horario
  const pts = [
    // cápsula superior (auricular de oreja)
    [-25, -18], [-22.5, -24.5], [-17, -26.5], [-12.5, -25], [-8.5, -16.5], [-7.5, -12.5], [-9, -9.5],
    [-12.5, -7.5], [-14, -5], [-12.5, -0.5],
    // lomo interior (concavidad hacia arriba a la derecha)
    [-8, 6.5], [-2, 11.5], [4.5, 14], [7.5, 13], [10, 9.5], [13, 8.5],
    // cápsula inferior (micrófono)
    [21.5, 12.5], [25, 15.5], [25.5, 19.5], [22, 24.5], [16, 27], [9, 27],
    // lomo exterior
    [-3, 23.5], [-13.5, 16], [-21, 6], [-25.5, -5], [-26.5, -12],
  ];
  return { p: smoothPath(pts, true, 0.5), pts };
}

function build() {
  const ph = phonePath();
  geo = { bubble: bubblePath(45), phone: ph.p, phonePts: ph.pts };
}

/**
 * Dibuja el ícono centrado en (cx, cy) con lado `size`.
 * o = { color, bg, ring (0.085), phone (escala del auricular), rot, alpha }
 */
export function drawWhatsApp(ctx, cx, cy, size, o = {}) {
  if (!geo) build();
  const k = size / 100;
  const color = o.color ?? '#ffffff';
  ctx.save();
  ctx.translate(cx, cy);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(k, k);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.bg) { ctx.fillStyle = o.bg; ctx.fill(geo.bubble); }
  // aro del globo
  ctx.strokeStyle = color;
  ctx.lineWidth = 100 * (o.ring ?? 0.085);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(geo.bubble);
  // auricular (relleno + trazo fino para redondear las esquinas del polígono)
  const s = o.phone ?? 1;
  if (s > 0.01) {
    ctx.save();
    ctx.translate(-1, 0.5);
    ctx.scale(s, s);
    ctx.fillStyle = color;
    ctx.fill(geo.phone);
    ctx.restore();
  }
  ctx.restore();
}

/** Para máscaras o sombras: el globo como Path2D en la caja de 100. */
export function waBubblePath() { if (!geo) build(); return geo.bubble; }
export const WA_BOX = 100;
