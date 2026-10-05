// Postal BRASIL: el Pan de Azúcar y el Morro da Urca con el teleférico que viaja, el Corcovado con el Cristo
// a lo lejos (en la bruma), la bahía con velero y la playita con palmera. 280 × 184, luz arriba-izquierda.
import { PAL, rgba, mixHex } from '../../../engine/color.js';
import { TAU } from '../../../engine/ease.js';
import { AW, AH, sky, sunGlow, sea, cloud, gull, sailboat, haze, palm, GREEN, ROCK } from './kit.js';

function shape(ctx, fn) { ctx.beginPath(); fn(ctx); ctx.closePath(); }

export function draw(ctx, t) {
  const hz = 128;
  sky(ctx, hz, [PAL.aqua300, [0.5, PAL.aqua200], [0.85, PAL.peach], [1, PAL.goldPale]]);
  sunGlow(ctx, 40, 30, 10);
  cloud(ctx, 110, 26, 1.0, { a: 0.9 });
  cloud(ctx, 258, 70, 0.6, { a: 0.75 });
  // sierra lejana con el Corcovado y el Cristo (perspectiva atmosférica)
  const far = mixHex(PAL.aqua200, PAL.dusk, 0.22);
  shape(ctx, (c) => {
    c.moveTo(0, hz); c.lineTo(0, 88); c.quadraticCurveTo(18, 80, 30, 84); c.quadraticCurveTo(44, 60, 56, 58);
    c.quadraticCurveTo(66, 60, 74, 78); c.quadraticCurveTo(92, 92, 120, 96); c.lineTo(150, hz);
  });
  ctx.fillStyle = far;
  ctx.fill();
  ctx.fillStyle = mixHex(far, PAL.white, 0.35);
  ctx.fillRect(55, 49, 2.2, 9);
  ctx.fillRect(51.5, 51.5, 9.2, 1.8);
  haze(ctx, 70, hz, PAL.peach, 0.45);
  // ciudad lejana sobre la orilla
  ctx.fillStyle = mixHex(far, PAL.white, 0.5);
  for (let i = 0; i < 12; i++) ctx.fillRect(4 + i * 9, hz - 6 - (i * 7) % 9, 6, 7 + (i * 7) % 9);
  sea(ctx, t, hz, { top: PAL.ocean400, bottom: PAL.ocean600, seed: 5 });
  // Morro da Urca: verde con cara de granito
  const urca = (c) => { c.moveTo(92, hz + 2); c.bezierCurveTo(96, 106, 112, 92, 132, 91); c.bezierCurveTo(152, 92, 164, 108, 170, hz + 2); };
  shape(ctx, urca);
  ctx.fillStyle = GREEN.base;
  ctx.fill();
  ctx.save();
  shape(ctx, urca);
  ctx.clip();
  ctx.fillStyle = GREEN.lo;
  ctx.beginPath(); ctx.ellipse(160, 120, 30, 34, 0, 0, TAU); ctx.fill();
  // cara de granito del morro (del lado de la sombra)
  ctx.fillStyle = ROCK.lo;
  ctx.beginPath(); ctx.moveTo(140, 92); ctx.quadraticCurveTo(152, 98, 156, 118); ctx.lineTo(146, 118); ctx.quadraticCurveTo(146, 102, 136, 94); ctx.fill();
  ctx.fillStyle = ROCK.base;
  ctx.beginPath(); ctx.moveTo(136, 94); ctx.quadraticCurveTo(146, 102, 146, 118); ctx.lineTo(141, 118); ctx.quadraticCurveTo(140, 104, 133, 95); ctx.fill();
  ctx.fillStyle = GREEN.hi;
  ctx.beginPath(); ctx.ellipse(104, 104, 16, 7, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
  // Pan de Azúcar: domo de granito en 3 tonos con vegetación al pie
  const pao = (c) => { c.moveTo(160, hz + 2); c.bezierCurveTo(160, 70, 182, 33, 205, 33); c.bezierCurveTo(228, 33, 244, 72, 250, hz + 2); };
  shape(ctx, pao);
  ctx.fillStyle = ROCK.base;
  ctx.fill();
  ctx.save();
  shape(ctx, pao);
  ctx.clip();
  ctx.fillStyle = ROCK.lo;
  ctx.beginPath(); ctx.ellipse(250, 96, 34, 80, -0.12, 0, TAU); ctx.fill();
  ctx.fillStyle = ROCK.deep;
  ctx.beginPath(); ctx.ellipse(262, 110, 22, 70, -0.1, 0, TAU); ctx.fill();
  ctx.fillStyle = ROCK.hi;
  ctx.beginPath(); ctx.ellipse(178, 70, 12, 36, 0.32, 0, TAU); ctx.fill();
  // vetas verticales del granito
  ctx.strokeStyle = rgba(ROCK.deep, 0.35);
  ctx.lineWidth = 1.2;
  for (const x of [196, 210, 222, 232]) { ctx.beginPath(); ctx.moveTo(x, 44 + (x - 196) * 0.3); ctx.quadraticCurveTo(x + 4, 80, x + 2, hz); ctx.stroke(); }
  // monte verde al pie
  ctx.fillStyle = GREEN.lo;
  ctx.beginPath(); ctx.ellipse(232, 128, 30, 14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = GREEN.base;
  ctx.beginPath(); ctx.ellipse(178, 126, 26, 12, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(206, 124, 14, 9, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = GREEN.hi;
  ctx.beginPath(); ctx.ellipse(172, 120, 12, 4, -0.3, 0, TAU); ctx.fill();
  ctx.restore();
  // filo de luz del domo
  ctx.strokeStyle = rgba(PAL.warmWhite, 0.7);
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(163, 96); ctx.bezierCurveTo(166, 62, 184, 36, 204, 34.5); ctx.stroke();
  // estaciones y teleférico
  ctx.fillStyle = PAL.warmWhite;
  ctx.fillRect(127, 88, 9, 5);
  ctx.fillRect(200, 30, 10, 5);
  ctx.strokeStyle = PAL.navy800;
  ctx.lineWidth = 0.9;
  const cab = (u) => { const v = 1 - u; return [v * v * 133 + 2 * v * u * 170 + u * u * 203, v * v * 89 + 2 * v * u * 72 + u * u * 32]; };
  ctx.beginPath(); ctx.moveTo(133, 89); ctx.quadraticCurveTo(170, 72, 203, 32); ctx.stroke();
  const u = 0.5 + 0.42 * Math.sin(t * 0.9);
  const [cx, cy] = cab(u);
  ctx.save();
  ctx.translate(cx, cy + 6);
  ctx.rotate(Math.sin(t * 2.4) * 0.08);
  ctx.strokeStyle = PAL.navy800;
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, -1); ctx.stroke();
  ctx.fillStyle = PAL.warmWhite;
  ctx.beginPath(); ctx.ellipse(0, 2, 5, 3.6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = PAL.ocean500;
  ctx.fillRect(-3.6, 0.6, 7.2, 1.8);
  ctx.restore();
  // playita y palmera en primer plano
  shape(ctx, (c) => { c.moveTo(0, AH); c.lineTo(0, 160); c.quadraticCurveTo(50, 150, 104, 166); c.quadraticCurveTo(120, 174, 128, AH); });
  ctx.fillStyle = PAL.goldPale;
  ctx.fill();
  ctx.fillStyle = mixHex(PAL.goldPale, PAL.gold, 0.4);
  ctx.beginPath(); ctx.moveTo(60, AH); ctx.quadraticCurveTo(100, 168, 128, AH); ctx.fill();
  ctx.strokeStyle = rgba(PAL.foam, 0.9);
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, 159 + Math.sin(t * 2) * 1.2); ctx.quadraticCurveTo(50, 149, 104, 165 + Math.sin(t * 2) * 1.2); ctx.stroke();
  palm(ctx, 34, 166, 46, t, { lean: 0.12 });
  sailboat(ctx, 128, 146, 0.95, t, 0.4);
  gull(ctx, 136, 52, 0.9, t, 0.5);
  gull(ctx, 150, 62, 0.7, t, 2);
}
