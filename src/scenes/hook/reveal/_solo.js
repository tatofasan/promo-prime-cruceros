// Banco de pruebas del tramo de HOOK (oficina + mar) armado como el compositor, sin las demás escenas.
//   node src/art/_tools/sbx.mjs --module=src/scenes/hook/reveal/_solo.js --from=3.45 --to=3.95 --step=0.016667 --sheet --cols=6
// HOOK_FX=1 suma los golpes globales (flash, sacudón, punch) de los cues.
import { layer } from '../../../engine/layer.js';
import { fxAt } from '../../../engine/fx.js';
import { W, H } from '../../../engine/time.js';
import office from '../../hook-office.js';
import sea from '../../reveal-sea.js';

const FX = globalThis.process?.env?.HOOK_FX === '1';

export async function init() { await office.init(); await sea.init(); }

function drawScene(sc, s, t) {
  if (t < s.from || t >= s.to) return;
  if (s.mask) {
    const L = layer();
    const lc = L.getContext('2d');
    s.draw(lc, t);
    const M = layer();
    s.mask(M.getContext('2d'), t);
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'destination-in';
    lc.drawImage(M, 0, 0);
    sc.drawImage(L, 0, 0);
  } else { sc.save(); s.draw(sc, t); sc.restore(); }
  if (s.over) { sc.save(); s.over(sc, t); sc.restore(); }
}

export function draw(ctx, t) {
  const S = layer();
  const sc = S.getContext('2d');
  sc.fillStyle = '#04101F';
  sc.fillRect(0, 0, W, H);
  drawScene(sc, office, t);
  drawScene(sc, sea, t);
  const f = FX ? fxAt(t) : { punch: 0, sx: 0, sy: 0, sr: 0, flash: 0 };
  ctx.save();
  const z = 1 + f.punch + 2 * Math.max(Math.abs(f.sx) / W, Math.abs(f.sy) / H);
  ctx.translate(W / 2 + f.sx, H / 2 + f.sy);
  ctx.rotate(f.sr);
  ctx.scale(z, z);
  ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(S, 0, 0);
  ctx.restore();
  if (f.flash > 0.002) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = f.flash;
    ctx.fillStyle = f.flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
