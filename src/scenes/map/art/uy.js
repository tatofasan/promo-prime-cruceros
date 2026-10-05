// Postal URUGUAY: el faro de Punta del Este sobre las rocas, con su haz girando, la casita del farero,
// el skyline lejano de la península, velero y gaviotas. 280 × 184, luz arriba-izquierda.
import { PAL, rgba, mixHex } from '../../../engine/color.js';
import { TAU } from '../../../engine/ease.js';
import { AW, AH, sky, sunGlow, sea, cloud, gull, sailboat, poly, haze } from './kit.js';

const ROCK = { hi: '#8DA3B8', base: '#56708A', lo: '#38506A', deep: '#253A52' };

export function draw(ctx, t) {
  const hz = 118;
  sky(ctx, hz, [PAL.aqua300, [0.55, PAL.aqua200], [1, PAL.goldPale]]);
  sunGlow(ctx, 46, 34, 11);
  cloud(ctx, 128, 30, 1.15, { a: 0.95 });
  cloud(ctx, 236, 56, 0.75, { a: 0.85 });
  // skyline lejano de la península (bruma)
  const far = mixHex(PAL.aqua200, PAL.ocean400, 0.35);
  ctx.fillStyle = far;
  const towers = [[6, 9, 14], [17, 7, 22], [26, 8, 17], [36, 6, 26], [44, 9, 19], [55, 7, 24], [64, 8, 15], [74, 10, 12]];
  for (const [x, w, h] of towers) ctx.fillRect(x, hz - h, w, h + 1);
  ctx.fillRect(0, hz - 4, 96, 5);
  haze(ctx, hz - 30, hz, PAL.goldPale, 0.45);
  sea(ctx, t, hz, { top: PAL.ocean400, bottom: PAL.ocean600, seed: 3 });
  sailboat(ctx, 98, hz + 4, 0.75, t, 1);
  // haz del faro (barre el cielo)
  const lx = 198, ly = 52;
  const ang = Math.PI + 0.32 + Math.sin(t * 1.3) * 0.5;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const L = 240;
  const bg = ctx.createRadialGradient(lx, ly, 6, lx, ly, L);
  bg.addColorStop(0, rgba(PAL.goldPale, 0.42));
  bg.addColorStop(0.5, rgba(PAL.goldPale, 0.14));
  bg.addColorStop(1, rgba(PAL.goldLight, 0));
  ctx.fillStyle = bg;
  for (const [da, w] of [[0, 0.07], [0, 0.15]]) {
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.arc(lx, ly, L, ang + da - w, ang + da + w);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // rocas: 3 tonos por bloque
  const rocks = [
    [[128, 184], [134, 150], [152, 138], [176, 136], [190, 146], [184, 184]],
    [[170, 184], [176, 142], [198, 132], [226, 134], [246, 146], [252, 184]],
    [[226, 184], [232, 150], [252, 140], [280, 142], [280, 184]],
  ];
  for (const r of rocks) {
    poly(ctx, r, ROCK.base);
    ctx.save();
    ctx.beginPath(); r.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
    poly(ctx, r.map(([x, y]) => [x + 9, y + 6]), ROCK.lo);
    poly(ctx, r.map(([x, y]) => [x + 16, y + 14]), ROCK.deep);
    ctx.strokeStyle = ROCK.hi;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(r[0][0], r[0][1]);
    for (let i = 1; i < 3; i++) ctx.lineTo(r[i][0], r[i][1]);
    ctx.stroke();
    ctx.restore();
  }
  // espuma que rompe contra el pie de las rocas
  ctx.fillStyle = rgba(PAL.foam, 0.92);
  const foam = [[131, 170], [136, 156], [150, 182], [174, 178], [229, 176], [236, 158], [122, 178]];
  foam.forEach(([x, y], i) => {
    const k = Math.max(0, Math.sin(t * 3.2 + i * 1.9));
    ctx.beginPath();
    ctx.ellipse(x, y, 4 + 5 * k, 1.6 + 1.4 * k, 0, 0, TAU);
    ctx.fill();
    if (k > 0.6) { ctx.beginPath(); ctx.arc(x - 3, y - 4 - 6 * k, 1.4, 0, TAU); ctx.arc(x + 4, y - 3 - 4 * k, 1, 0, TAU); ctx.fill(); }
  });
  // casita del farero
  poly(ctx, [[160, 140], [160, 124], [182, 124], [182, 140]], PAL.warmWhite);
  poly(ctx, [[176, 140], [176, 124], [182, 124], [182, 140]], mixHex(PAL.aqua100, PAL.grey300, 0.45));
  poly(ctx, [[157, 125], [171, 114], [185, 125]], PAL.coral);
  poly(ctx, [[171, 114], [185, 125], [178, 125]], mixHex(PAL.coral, PAL.navy900, 0.3));
  ctx.fillStyle = PAL.navy700;
  ctx.fillRect(165, 131, 4, 9);
  ctx.fillStyle = PAL.ocean500;
  ctx.fillRect(171, 128, 3.5, 3.5);
  // torre (base, sombra a la derecha, filo a la izquierda)
  poly(ctx, [[186, 140], [190, 62], [206, 62], [210, 140]], PAL.warmWhite);
  poly(ctx, [[199, 140], [199, 62], [206, 62], [210, 140]], mixHex(PAL.aqua100, PAL.grey300, 0.5));
  ctx.strokeStyle = PAL.white;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(186.8, 139); ctx.lineTo(190.6, 63); ctx.stroke();
  ctx.fillStyle = PAL.navy700;
  for (const y of [84, 104, 122]) ctx.fillRect(196, y, 3, 6);
  // balcón, linterna y cúpula
  ctx.fillStyle = PAL.navy900;
  ctx.fillRect(185, 58, 26, 4.5);
  ctx.fillStyle = PAL.navy700;
  for (let x = 187; x <= 209; x += 4.4) ctx.fillRect(x, 53, 1.2, 5);
  const glow = 0.7 + 0.3 * Math.sin(t * 6);
  const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 26);
  lg.addColorStop(0, rgba(PAL.white, 0.95 * glow));
  lg.addColorStop(0.3, rgba(PAL.goldLight, 0.5 * glow));
  lg.addColorStop(1, rgba(PAL.gold, 0));
  ctx.fillStyle = PAL.goldLight;
  ctx.fillRect(191, 44, 14, 14);
  ctx.fillStyle = PAL.navy800;
  for (const x of [191, 197.5, 203.6]) ctx.fillRect(x, 44, 1.4, 14);
  ctx.beginPath();
  ctx.ellipse(198, 44, 9, 7, 0, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = PAL.navy500;
  ctx.beginPath();
  ctx.ellipse(195.5, 41.5, 3, 2, -0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = PAL.navy900;
  ctx.fillRect(197.4, 33, 1.4, 5);
  ctx.beginPath(); ctx.arc(198.1, 32.5, 1.8, 0, TAU); ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = lg;
  ctx.fillRect(lx - 26, ly - 26, 52, 52);
  ctx.restore();
  gull(ctx, 84, 62, 1, t, 0);
  gull(ctx, 104, 74, 0.8, t, 1.3);
  gull(ctx, 250, 28, 0.7, t, 2.1);
}
