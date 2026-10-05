// Cirros altos: hebras finas y largas en el cielo navy que agarran el último rosa del sol desde abajo (panza
// iluminada, lomo en sombra). Dan altura y textura a la franja de arriba sin competir con el logo (muy tenues).
import { W } from '../../engine/time.js';
import { PAL } from '../../engine/color.js';
import { hash } from '../../engine/noise.js';
import { camPt, camZ, ca } from '../../art/util.js';

const DEPTH = 0.12;
const N = 7;

function lens(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + w * 0.2, y - h * 1.1, x + w * 0.6, y - h * 1.2, x + w, y);
  ctx.bezierCurveTo(x + w * 0.72, y + h * 0.5, x + w * 0.28, y + h * 0.45, x, y);
  ctx.fill();
}

export function drawWisps(ctx, t, cam) {
  const zf = camZ(cam, DEPTH);
  ctx.save();
  for (let i = 0; i < N; i++) {
    const span = W + 900;
    const wx = ((hash(i, 401) * span + t * (5 + 6 * hash(i, 402))) % span + span) % span - 450;
    const wy = 70 + hash(i, 403) * 190;
    // el centro alto (detrás del logo) queda casi vacío
    const mid = Math.abs(wx - W / 2) < 520 && wy > 190 ? 0.35 : 1;
    const [x, y] = camPt(cam, DEPTH, wx, wy);
    const w = (260 + 420 * hash(i, 404)) * zf, h = (7 + 9 * hash(i, 405)) * zf;
    const a = (0.1 + 0.12 * hash(i, 406)) * mid;
    lens(ctx, x, y, w, h, ca(PAL.dusk, a * 1.6));                       // cuerpo
    lens(ctx, x + w * 0.1, y + h * 0.35, w * 0.75, h * 0.45, ca(PAL.sunsetPink, a * 1.3)); // panza que agarra la luz
    lens(ctx, x + w * 0.3, y + h * 0.5, w * 0.45, h * 0.22, ca(PAL.peach, a * 1.2));       // filo cálido
  }
  ctx.restore();
}
