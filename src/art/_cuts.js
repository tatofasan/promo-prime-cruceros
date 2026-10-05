// Usos de los cortes: ola 'up', iris del ojo de buey (rimOnly) y sol → disco liso (flat). 2×2.
import { W, H } from '../engine/time.js';
import { PAL } from '../engine/color.js';
import { drawWaveMask, drawWaveCrest } from './wave.js';
import { drawPorthole } from './porthole.js';
import { drawSun } from './sun.js';
import { drawSky } from './sky.js';
import { drawOcean } from './ocean.js';

function cell(ctx, i, fn) {
  ctx.save();
  ctx.translate((i % 2) * W / 2, Math.floor(i / 2) * H / 2);
  ctx.scale(0.5, 0.5);
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  fn(ctx);
  ctx.restore();
}
export function draw(ctx, t) {
  // 0: ola 'up' a mitad de camino
  cell(ctx, 0, (c) => {
    c.fillStyle = PAL.grey600; c.fillRect(0, 0, W, H);
    c.save(); c.fillStyle = PAL.coral;
    const M = new Path2D(); M.rect(0, 0, W, H);
    c.restore();
    c.save();
    const L = (cc) => { cc.fillStyle = PAL.coral; cc.fillRect(0, 0, W, H); };
    c.save(); drawWaveMask(c, 0.45, { dir: 'up', color: PAL.coral }); c.restore();
    drawWaveCrest(c, t, 0.45, { dir: 'up', preset: 'golden' });
    c.restore();
    void L;
  });
  // 1: ola ltr con la máscara inversa (lo que TYPE ve)
  cell(ctx, 1, (c) => {
    c.fillStyle = PAL.navy700; c.fillRect(0, 0, W, H);
    drawWaveMask(c, 0.5, { dir: 'ltr', inverse: true, color: PAL.grey300 });
    c.fillStyle = PAL.navy900; c.font = '900 120px Outfit'; c.fillText('máscara inversa', 900, 560);
  });
  // 2: iris del ojo de buey (aro solo, girando) sobre la pileta
  cell(ctx, 2, (c) => {
    c.fillStyle = PAL.navy800; c.fillRect(0, 0, W, H);
    c.fillStyle = PAL.aqua300; c.beginPath(); c.arc(960, 540, 420, 0, Math.PI * 2); c.fill();
    drawPorthole(c, t, 960, 540, 420, { preset: 'golden', rimOnly: true, spin: t * 0.5 });
  });
  // 3: sol que se vuelve disco liso (flat 0 → 1, de izquierda a derecha)
  cell(ctx, 3, (c) => {
    drawSky(c, t, { preset: 'sunset', horizonY: 900, sunX: 960, sunY: 430 });
    drawOcean(c, t, { preset: 'sunset', horizonY: 900, sunX: 960, sunY: 430 });
    [0, 0.35, 0.7, 1].forEach((f, k) => drawSun(c, t, 300 + k * 440, 430, 120 + 0 * k, { preset: 'sunset', flat: f, flatColor: PAL.brandOrange, flare: 0.4, ghosts: false }));
  });
}
