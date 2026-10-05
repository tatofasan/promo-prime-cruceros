// Postal de destino: sale de la cabeza del pin con overshoot y giro, se balancea (acción secundaria), lleva
// borde de papel, sombra proyectada abajo-derecha, brillo que la barre al llegar y el rótulo (chip) pegado
// en el borde inferior. Al salir vuelve a meterse en el pin.
import { PAL, rgba } from '../../engine/color.js';
import { clamp } from '../../engine/ease.js';
import { lightSweep } from '../../engine/draw.js';
import { drawChip } from '../../engine/text.js';
import { drawPin } from '../../brand/pin.js';
import { AW, AH } from './art/kit.js';

const B = 10; // borde de papel
export const CARD_W = AW + 2 * B, CARD_H = AH + 2 * B;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Ícono del chip: pin de marca chiquito. */
const pinIcon = (c, h) => drawPin(c, h * 0.36, h * 0.48, h * 0.98);

/**
 * Postal en su estado ya resuelto por la escena (posición, escala y giro los decide map.js).
 * o = { art (módulo con draw(ctx, t, opts)), label, x, y (centro en pantalla), s (escala), rot, tIn (para el
 *       brillo que la barre), chipIn (inicio del pop del rótulo), artOpts }
 */
export function drawPostcard(ctx, t, o) {
  const s = o.s ?? 1;
  if (s <= 0.01) return;
  const dt = t - o.tIn;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(o.rot ?? 0);
  ctx.scale(s, s);
  // sombra proyectada (en espacio de pantalla, luz arriba-izquierda)
  ctx.save();
  ctx.shadowColor = rgba(PAL.ink, 0.5);
  ctx.shadowBlur = 26 * s;
  ctx.shadowOffsetX = 10 * s;
  ctx.shadowOffsetY = 16 * s;
  ctx.fillStyle = PAL.warmWhite;
  rr(ctx, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 14);
  ctx.fill();
  ctx.restore();
  // papel: borde con leve degradé (más claro arriba-izquierda) y filo
  const pg = ctx.createLinearGradient(-CARD_W / 2, -CARD_H / 2, CARD_W / 2, CARD_H / 2);
  pg.addColorStop(0, PAL.white);
  pg.addColorStop(1, '#EFE6D8');
  ctx.fillStyle = pg;
  rr(ctx, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 14);
  ctx.fill();
  // ilustración
  ctx.save();
  rr(ctx, -AW / 2, -AH / 2, AW, AH, 8);
  ctx.clip();
  ctx.translate(-AW / 2, -AH / 2);
  o.art.draw(ctx, t, o.artOpts ?? {});
  ctx.restore();
  // sombra interior del marco y brillo que barre al llegar
  ctx.save();
  rr(ctx, -AW / 2, -AH / 2, AW, AH, 8);
  ctx.strokeStyle = rgba(PAL.navy900, 0.22);
  ctx.lineWidth = 2;
  ctx.stroke();
  const clip = new Path2D();
  clip.rect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H);
  lightSweep(ctx, clip, { x: -CARD_W / 2, y: -CARD_H / 2, w: CARD_W, h: CARD_H }, clamp((dt - 0.1) / 0.45), { alpha: 0.55, width: 0.3 });
  ctx.restore();
  // rótulo pegado al borde inferior (pop con el pico en el cue)
  if (o.label) {
    drawChip(ctx, o.label, {
      t, in: o.chipIn ?? o.tIn, x: 0, y: CARD_H / 2 + 2, anchor: [0.5, 0.5], size: 29, weight: 800, tracking: 0.06,
      upper: true, bg: PAL.navy900, fg: PAL.white, padX: 0.62, padY: 0.42, icon: pinIcon, dur: 0.36,
      shadow: { color: rgba(PAL.ink, 0.45), blur: 12, y: 5 }, border: { color: rgba(PAL.gold, 0.85), width: 2.5 },
    });
  }
  ctx.restore();
}

/** Extensión de la postal con su rótulo respecto del centro: medio ancho y alto arriba/abajo (px a escala 1). */
export const CARD_EXT = { hw: CARD_W / 2 + 6, up: CARD_H / 2 + 8, down: CARD_H / 2 + 30 };
