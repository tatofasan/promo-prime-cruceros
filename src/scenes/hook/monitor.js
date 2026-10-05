// Monitor (plano D.desk): marco oscuro con filo de luz, mentón con LED, pie metálico y base. Horneado.
// Los post-its van en vivo: flamean en los golpes de c1 y salen volando con el estallido.
import { PAL, mixHex, rgba } from '../../engine/color.js';
import { lin, fill, rrectPath, ellipsePath, polyPath, circlePath, texture } from '../../engine/draw.js';
import { clamp } from '../../engine/ease.js';
import { bake, put, wobble } from './util.js';
import { MON, T } from './layout.js';

let BODY = null;
const DARK = mixHex(PAL.grey900, PAL.ink, 0.35);
const POSTIT = mixHex('#E8E1B0', PAL.grey300, 0.5);

export function initMonitor() {
  const { x, y, w, h, bez, chin, cx } = MON;
  BODY = bake(x - 60, y - 40, w + 120, 480, 1.3, (g) => {
    // pie: cuello metálico (cilíndrico) y base
    const ny = y + h + chin;
    fill(g, rrectPath(cx - 26, ny - 10, 52, 800 - ny + 6, 6), lin(g, cx - 26, 0, cx + 26, 0, [PAL.grey600, PAL.grey300, PAL.grey400, PAL.grey700]));
    fill(g, rrectPath(cx - 10, ny + 40, 20, 26, 8), rgba(PAL.ink, 0.45));
    fill(g, ellipsePath(cx, 800, 124, 15), lin(g, 0, 786, 0, 815, [PAL.grey300, PAL.grey500]));
    fill(g, ellipsePath(cx, 797, 118, 11), lin(g, cx - 118, 0, cx + 118, 0, [PAL.grey200, PAL.grey400, PAL.grey500]));
    fill(g, ellipsePath(cx - 40, 793, 50, 3), rgba(PAL.white, 0.45));
    // marco en tres tonos
    const ox = x - bez, oy = y - bez, ow = w + bez * 2, oh = h + bez + chin;
    fill(g, rrectPath(ox, oy, ow, oh, 13), lin(g, 0, oy, 0, oy + oh, [mixHex(PAL.grey700, DARK, 0.5), DARK, mixHex(DARK, PAL.ink, 0.4)]));
    fill(g, rrectPath(ox + 4, oy, ow - 8, 2.5, 1), rgba(PAL.grey400, 0.9));
    fill(g, rrectPath(ox, oy + 5, 2.5, oh - 10, 1), rgba(PAL.grey500, 0.8));
    fill(g, rrectPath(ox + ow - 3, oy + 6, 3, oh - 12, 1), rgba(PAL.ink, 0.5));
    // mentón: separación, logo ciego y LED
    fill(g, rrectPath(ox + 10, y + h + 4, ow - 20, 1.5, 1), rgba(PAL.white, 0.06));
    fill(g, rrectPath(cx - 18, y + h + 13, 36, 5, 2.5), rgba(PAL.grey600, 0.6));
    fill(g, circlePath(x + w - 10, y + h + 15, 2.2), rgba(PAL.aqua200, 0.85));
    texture(g, rrectPath(ox, oy, ow, oh, 13), { alpha: 0.06 });
    // vidrio apagado (debajo del contenido) con bisel interior
    fill(g, rrectPath(x - 2, y - 2, w + 4, h + 4, 3), PAL.ink);
  });
}

/** Cuerpo del monitor (dx, dy = temblor). */
export function drawMonitor(ctx, dx = 0, dy = 0) {
  put(ctx, BODY, dx, dy);
}

const NOTES = [
  { x: MON.x - 30, y: MON.y - 26, s: 58, r: -0.13, seed: 1, out: [-1, -1] },
  { x: MON.x + MON.w + 6, y: MON.y + 128, s: 52, r: 0.09, seed: 2, out: [1, -0.6] },
];

/** Post-its pegados al marco (por delante del monitor). */
export function drawPostits(ctx, t) {
  for (const n of NOTES) {
    let flap = 0;
    for (const q of T.q) flap += 0.5 * wobble(t, q, { freq: 4, decay: 7 });
    let px = n.x, py = n.y, rot = n.r, sc = 1;
    const u = t - T.surge - 0.02 * n.seed;
    if (u > 0) {
      // el estallido los despega y los manda a volar
      px += n.out[0] * 900 * u + 40 * Math.sin(u * 12);
      py += n.out[1] * 700 * u + 900 * u * u;
      rot += n.out[0] * 6 * u;
      sc = 1 + 1.4 * u;
      flap = Math.sin(u * 30);
    }
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.scale(sc, sc);
    const s = n.s, lift = clamp(0.25 + flap * 0.6, -0.4, 1);
    // sombra, papel y adhesivo arriba
    fill(ctx, rrectPath(4, 6, s, s, 2), rgba(PAL.ink, 0.3));
    const body = polyPath([[0, 0], [s, 0], [s, s - 10 * lift], [s * 0.5, s + 3 * lift], [0, s]]);
    fill(ctx, body, lin(ctx, 0, 0, 0, s, [mixHex(POSTIT, PAL.white, 0.25), POSTIT]));
    fill(ctx, rrectPath(0, 0, s, 9, 1), rgba(PAL.grey600, 0.18));
    // garabatos
    ctx.strokeStyle = rgba(PAL.grey700, 0.75);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const yy = 20 + i * 11, len = s * (0.7 - i * 0.15);
      ctx.moveTo(8, yy);
      for (let k = 1; k <= 6; k++) ctx.lineTo(8 + (k / 6) * len, yy + (k % 2 ? -2.5 : 2));
    }
    ctx.stroke();
    // esquina despegada
    fill(ctx, polyPath([[s, s - 10 * lift], [s * 0.5, s + 3 * lift], [s - 6, s - 2]]), rgba(PAL.grey600, 0.35));
    ctx.restore();
  }
}
