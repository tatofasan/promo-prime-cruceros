// Postal ANTÁRTIDA: iceberg facetado en 3+ tonos con su parte sumergida, cordillera nevada en la bruma,
// témpanos que derivan, pingüino sobre un témpano (aletea y cabecea), nieve y el destello helado.
// 280 × 184, luz arriba-izquierda.
import { PAL, rgba, mixHex } from '../../../engine/color.js';
import { TAU } from '../../../engine/ease.js';
import { sparkle } from '../../../engine/draw.js';
import { hash } from '../../../engine/noise.js';
import { AW, AH, sky, sunGlow, sea, poly, haze } from './kit.js';

const ICE = { hi: PAL.white, base: PAL.aqua100, mid: PAL.aqua200, lo: mixHex(PAL.aqua300, PAL.ocean500, 0.25), deep: PAL.ocean500 };

export function draw(ctx, t, o = {}) {
  const hz = 112;
  sky(ctx, hz, [mixHex(PAL.aqua300, PAL.ocean400, 0.25), [0.55, PAL.aqua200], [1, PAL.foam]]);
  sunGlow(ctx, 52, 46, 10, { core: PAL.white, halo: PAL.aqua100 });
  // cordillera nevada lejana
  const mt = [[0, hz], [0, 96], [22, 78], [36, 88], [58, 66], [76, 84], [94, 74], [118, 92], [140, hz]];
  poly(ctx, mt, mixHex(PAL.aqua200, PAL.white, 0.35));
  poly(ctx, [[58, 66], [76, 84], [70, hz], [56, hz]], mixHex(PAL.aqua200, PAL.ocean400, 0.15));
  poly(ctx, [[22, 78], [36, 88], [30, hz], [20, hz]], mixHex(PAL.aqua200, PAL.ocean400, 0.15));
  haze(ctx, 70, hz, PAL.foam, 0.55);
  sea(ctx, t, hz, { top: PAL.ocean500, bottom: PAL.navy600, line: PAL.aqua200, seed: 13, glint: 5, speed: 0.6 });
  // parte sumergida del iceberg (translúcida)
  ctx.fillStyle = rgba(PAL.aqua300, 0.32);
  ctx.beginPath(); ctx.moveTo(126, hz + 6); ctx.lineTo(262, hz + 6); ctx.lineTo(248, 168); ctx.lineTo(180, 178); ctx.lineTo(140, 150); ctx.closePath(); ctx.fill();
  // iceberg: facetas
  const bob = Math.sin(t * 1.4) * 1.2;
  ctx.save();
  ctx.translate(0, bob);
  const F = [
    [[130, hz + 6], [150, 62], [176, 40], [190, 70], [176, hz + 6]], // cara izquierda iluminada
    [[176, 40], [204, 30], [226, 58], [212, 82], [190, 70]], // cumbre
    [[190, 70], [212, 82], [214, hz + 6], [176, hz + 6]],
    [[212, 82], [226, 58], [252, 76], [264, hz + 6], [214, hz + 6]], // derecha en sombra
  ];
  poly(ctx, F[0], ICE.hi);
  poly(ctx, F[1], ICE.base);
  poly(ctx, F[2], ICE.mid);
  poly(ctx, F[3], ICE.lo);
  poly(ctx, [[204, 30], [226, 58], [218, 56]], ICE.mid);
  poly(ctx, [[150, 62], [160, 54], [176, 40], [168, 66]], ICE.base);
  // grietas y filo de luz
  ctx.strokeStyle = rgba(ICE.deep, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(160, 80); ctx.lineTo(166, 100); ctx.moveTo(232, 86); ctx.lineTo(238, 108); ctx.stroke();
  ctx.strokeStyle = PAL.white;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(131, hz + 5); ctx.lineTo(150, 62); ctx.lineTo(176, 40); ctx.lineTo(204, 30); ctx.stroke();
  // franja de agua en la base
  ctx.fillStyle = rgba(PAL.foam, 0.85);
  ctx.fillRect(128, hz + 4, 138, 2.2);
  ctx.restore();
  // témpanos que derivan
  for (let i = 0; i < 4; i++) {
    const x = ((hash(i, 2) * AW + t * 4 * (0.5 + hash(i, 5))) % (AW + 40)) - 20;
    const y = hz + 12 + hash(i, 3) * 26, w = 10 + hash(i, 4) * 14;
    ctx.fillStyle = ICE.mid;
    ctx.beginPath(); ctx.ellipse(x + 1, y + 1.4, w, w * 0.22, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.white;
    ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.2, 0, 0, TAU); ctx.fill();
  }
  // témpano del pingüino en primer plano
  poly(ctx, [[18, 168], [30, 156], [96, 152], [114, 162], [104, 174], [28, 176]], ICE.mid);
  poly(ctx, [[18, 168], [30, 156], [96, 152], [114, 162], [100, 164], [26, 166]], PAL.white);
  ctx.fillStyle = rgba(PAL.foam, 0.9);
  ctx.fillRect(16, 174 + Math.sin(t * 2) * 0.8, 100, 2);
  penguin(ctx, 62, 158, t);
  // nieve que cae
  ctx.fillStyle = rgba(PAL.white, 0.9);
  for (let i = 0; i < 26; i++) {
    const sp = 9 + hash(i, 8) * 10;
    const x = (hash(i, 6) * AW + Math.sin(t * 1.3 + i) * 6 + AW) % AW;
    const y = (hash(i, 7) * AH + t * sp) % AH;
    ctx.beginPath(); ctx.arc(x, y, 0.8 + hash(i, 9) * 1.1, 0, TAU); ctx.fill();
  }
  // destello helado en la cumbre
  const s = o.flash ?? (0.55 + 0.45 * Math.sin(t * 3));
  sparkle(ctx, 204, 31 + bob, 9 + 12 * s, { alpha: Math.min(1, 0.5 + s), color: PAL.white, rot: t * 0.6 });
}

function penguin(ctx, x, y, t) {
  const bob = Math.abs(Math.sin(t * 3)) * -1.2;
  const flap = Math.sin(t * 7) * 0.35;
  ctx.save();
  ctx.translate(x, y + bob);
  // sombra
  ctx.fillStyle = rgba(PAL.aqua300, 0.6);
  ctx.beginPath(); ctx.ellipse(4, 0, 14, 2.6, 0, 0, TAU); ctx.fill();
  // patas
  ctx.fillStyle = PAL.coral;
  ctx.beginPath(); ctx.ellipse(-4, -0.5, 4, 1.6, 0, 0, TAU); ctx.ellipse(5, -0.5, 4, 1.6, 0, 0, TAU); ctx.fill();
  // cuerpo (espalda negra con filo, panza blanca con sombra a la derecha)
  ctx.fillStyle = PAL.ink;
  ctx.beginPath(); ctx.ellipse(0, -16, 11, 16, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = PAL.navy600;
  ctx.beginPath(); ctx.ellipse(-4.5, -20, 4, 9, 0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = PAL.white;
  ctx.beginPath(); ctx.ellipse(2, -13, 7.2, 12, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = PAL.aqua100;
  ctx.beginPath(); ctx.ellipse(6, -12, 3.4, 10, 0, 0, TAU); ctx.fill();
  // aletas
  ctx.fillStyle = PAL.ink;
  ctx.save(); ctx.translate(-9, -20); ctx.rotate(0.35 + flap); ctx.beginPath(); ctx.ellipse(0, 7, 3, 9, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(9, -20); ctx.rotate(-0.35 - flap); ctx.beginPath(); ctx.ellipse(0, 7, 3, 9, 0, 0, TAU); ctx.fill(); ctx.restore();
  // cabeza, ojo y pico
  ctx.fillStyle = PAL.ink;
  ctx.beginPath(); ctx.arc(1, -33, 8, 0, TAU); ctx.fill();
  ctx.fillStyle = PAL.gold;
  ctx.beginPath(); ctx.ellipse(-1, -28, 4.5, 2.2, 0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = PAL.white;
  ctx.beginPath(); ctx.arc(4, -35, 2.4, 0, TAU); ctx.fill();
  ctx.fillStyle = PAL.ink;
  ctx.beginPath(); ctx.arc(4.6, -35, 1.1, 0, TAU); ctx.fill();
  ctx.fillStyle = PAL.coral;
  ctx.beginPath(); ctx.moveTo(7, -33); ctx.lineTo(14, -31.5); ctx.lineTo(7, -30); ctx.closePath(); ctx.fill();
  ctx.restore();
}
