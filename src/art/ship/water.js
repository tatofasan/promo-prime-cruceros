// Lo que el barco le hace al agua (coordenadas locales del barco, flotación y = 0):
// reflejo cortado por ondas, sombra de contacto, estela con espuma que se queda atrás, línea de espuma
// del costado y ola de proa con spray. Todo función pura de t.
import { PAL, mixHex } from '../../engine/color.js';
import { lin, toLayer, blit } from '../../engine/draw.js';
import { TAU, clamp } from '../../engine/ease.js';
import { hash, noise1 } from '../../engine/noise.js';
import { ca } from '../util.js';
import { geom, stemX } from './geom.js';
import { drawSmoke, drawHorn } from './steam.js';

/** Reflejo del barco en el agua: siluetas espejadas y aplastadas, con cortes de onda horizontales. */
export function drawReflection(ctx, t, o) {
  const g = geom();
  const { C, sea, amt } = o;
  if (amt <= 0.01) return;
  const L = toLayer(ctx, (c) => {
    c.save();
    c.scale(1, -0.62);
    c.globalAlpha = 0.38;
    c.fillStyle = mixHex(C.white, sea.reflect, 0.45);
    c.fill(g.sup);
    c.fillStyle = mixHex(C.funnel, sea.reflect, 0.4);
    c.fill(g.funnel);
    c.globalAlpha = 0.6;
    c.fillStyle = mixHex(C.hull, sea.reflect, 0.5);
    c.fill(g.hull);
    c.restore();
    // cortes de onda: franjas que se borran (destination-out) y viajan
    c.save();
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = '#000';
    for (let k = 0; k < 30; k++) {
      const y = 2 + k * 4.2 + k * k * 0.1;
      const th = 1.4 + k * 0.22;
      c.beginPath();
      const ph = t * (1.3 + hash(k, 2)) + k * 1.7;
      for (let x = -540; x <= 540; x += 30) {
        const yy = y + Math.sin(x * 0.03 + ph) * (0.6 + k * 0.05);
        x === -540 ? c.moveTo(x, yy) : c.lineTo(x, yy);
      }
      for (let x = 540; x >= -540; x -= 30) c.lineTo(x, y + th + Math.sin(x * 0.03 + ph + 0.8) * (0.6 + k * 0.05));
      c.closePath();
      c.fill();
    }
    // se desvanece con la distancia a la flotación
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = lin(c, 0, 0, 0, 170, [[0, 'rgba(0,0,0,1)'], [0.5, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
    c.fillRect(-560, -2, 1120, 180);
    c.restore();
  });
  blit(ctx, L, { alpha: amt * 0.6 });
  // sombra de contacto bajo el casco
  ctx.fillStyle = lin(ctx, 0, 0, 0, 12, [[0, ca(PAL.ink, 0.42 * amt)], [1, ca(PAL.ink, 0)]]);
  ctx.beginPath();
  ctx.moveTo(-488, 0); ctx.lineTo(stemX(0) + 4, 0); ctx.lineTo(stemX(0) - 30, 12); ctx.lineTo(-470, 12); ctx.closePath();
  ctx.fill();
}

/** Estela de popa: agua aireada en V que se abre hacia cámara, espuma batida, cintas que se quedan atrás. */
export function drawWake(ctx, t, o) {
  const { amt, speed, len, sea, px } = o;
  if (amt <= 0.01) return;
  const foam = sea.foam;
  const x0 = -486;
  const L = len;
  const big = Math.max(1, Math.sqrt(0.9 / Math.max(0.05, px))); // de lejos la espuma engorda para leerse
  const spread = Math.pow(Math.max(1, L / 520), 0.55); // la V se abre más cuanto más larga
  const nearY = (u) => 3 + u * 84 * spread; // brazo cercano de la V (baja hacia cámara)
  const farY = (u) => 0.5 + u * 5 * spread;
  ctx.save();
  // 1) agua aireada (turquesa claro) dentro de la V
  ctx.globalCompositeOperation = 'screen';
  const aer = mixHex(PAL.aqua300, sea.lit ?? PAL.aqua300, 0.55);
  ctx.fillStyle = lin(ctx, x0, 0, x0 - L, 0, [[0, ca(aer, 0.5 * amt)], [0.4, ca(aer, 0.2 * amt)], [1, ca(aer, 0)]]);
  ctx.beginPath();
  ctx.moveTo(x0 + 4, -1);
  for (let u = 0; u <= 1.001; u += 0.1) ctx.lineTo(x0 - u * L, farY(u));
  for (let u = 1; u >= -0.001; u -= 0.1) ctx.lineTo(x0 - u * L, nearY(u) + 2);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // 2) cintas de espuma: parches que se quedan en el agua (viajan hacia popa a la velocidad del barco)
  const sp = 13;
  const shift = Math.floor((t * speed) / sp);
  const off = (t * speed) % sp;
  ctx.beginPath();
  for (let k = 0; k < L / sp; k++) {
    const d = k * sp + off;
    const u = d / L;
    if (u > 1) break;
    const id = k - shift;
    const fade = Math.pow(1 - u, 1.3);
    // tres cintas: centro, brazo cercano y brazo lejano
    for (let lane = 0; lane < 3; lane++) {
      if (hash(id, lane, 9) > 0.78 - lane * 0.08) continue;
      const y = lane === 0 ? 1.5 + u * 30 : lane === 1 ? nearY(u) : farY(u);
      const w = (8 + 22 * hash(id, lane, 3)) * (0.6 + fade * 0.8) * (1 + u * 1.5);
      const th = (0.5 + fade * (lane === 0 ? 3.2 : 1.8)) * big;
      lensAt(ctx, x0 - d + noise1(id * 0.7, lane) * 4, y + noise1(id * 0.5 + t * 0.4, lane + 5) * 1.5, w, th);
    }
  }
  ctx.fillStyle = ca(foam, 0.88 * amt);
  ctx.fill();
  // 3) espuma batida detrás de la popa (hélices)
  ctx.beginPath();
  for (let k = 0; k < 22; k++) {
    const a = hash(k, 21), b = hash(k, 22);
    const life = 0.5 + 0.5 * Math.sin(t * (3 + b * 3) + k * 2.1);
    const x = x0 - 2 - a * 70 - ((t * speed * 0.5 + k * 7) % 26);
    const y = -1.2 + b * (6 + a * 10);
    const r = (1.4 + 3.6 * (1 - a)) * (0.55 + 0.45 * life) * Math.min(2.2, big);
    ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
  }
  ctx.fillStyle = ca(foam, 0.95 * amt);
  ctx.fill();
  ctx.restore();
}

/** Espuma del costado (línea de flotación) y ola de proa con spray. */
export function drawBowWave(ctx, t, o) {
  const { amt, speed, C, sea, px } = o;
  if (amt <= 0.01) return;
  const foam = sea.foam;
  const sx = stemX(0);
  const big = Math.max(1, Math.sqrt(0.9 / Math.max(0.05, px ?? 1)));
  ctx.save();
  // línea de espuma a lo largo del casco: trazos que corren hacia popa, más densos cerca de proa
  ctx.fillStyle = ca(foam, 0.85 * amt);
  ctx.beginPath();
  const sp = 11;
  const off = (t * speed * 1.05) % sp;
  for (let k = 0; k < 90; k++) {
    const x = sx - 6 - k * sp - off;
    if (x < -484) break;
    const near = clamp(1 - (sx - x) / 320);
    if (hash(k - Math.floor((t * speed * 1.05) / sp), 4) > 0.55 + near * 0.45) continue;
    lensAt(ctx, x, 0.3, (4 + near * 9) * big, (0.7 + near * 1.4) * big);
  }
  ctx.fill();
  // bigote de proa: masa de espuma que sube por la roda y se abre hacia adelante y abajo
  const pulse = 0.85 + 0.15 * Math.sin(t * 4.1) + 0.08 * Math.sin(t * 9.3);
  const hgt = 10 * pulse * amt * Math.min(1.8, big);
  ctx.fillStyle = ca(foam, 0.95);
  ctx.beginPath();
  const fw = Math.min(1.8, big);
  ctx.moveTo(sx - 60, 1.2);
  ctx.quadraticCurveTo(sx - 20, -hgt * 0.4, stemX(-hgt) - 1, -hgt);
  ctx.quadraticCurveTo(sx + 9 * fw, -hgt * 0.95, sx + 18 * pulse * fw, -1);
  ctx.quadraticCurveTo(sx + 26 * pulse * fw, 3, sx + 10, 4.2 * fw);
  ctx.quadraticCurveTo(sx - 24, 3.6 * fw, sx - 60, 2.8);
  ctx.closePath();
  ctx.fill();
  // sombra suave dentro de la espuma (tono 2) y burbujas
  ctx.fillStyle = ca(mixHex(foam, PAL.ocean400, 0.35), 0.8);
  ctx.beginPath();
  ctx.moveTo(sx - 30, 2.4);
  ctx.quadraticCurveTo(sx - 4, -hgt * 0.2, sx + 12 * pulse, 0.5);
  ctx.quadraticCurveTo(sx + 6, 3.2, sx - 30, 3.1);
  ctx.closePath();
  ctx.fill();
  // spray: gotas que saltan desde la roda en ciclos
  ctx.fillStyle = ca(foam, 0.9);
  for (let k = 0; k < 16; k++) {
    const life = ((t * (1.1 + hash(k, 41) * 0.8) + hash(k, 42)) % 1);
    const vx = 8 + hash(k, 43) * 22, vy = -(10 + hash(k, 44) * 16);
    const x = sx - 6 + vx * life * 1.4;
    const y = -hgt * 0.5 + vy * life + 34 * life * life;
    const r = (0.5 + hash(k, 45) * 1.1) * (1 - life * 0.6) * amt;
    if (y > 2) continue;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/** Humo de la chimenea y bocinazo (horn = t del bocinazo): ver ship/steam.js. */
export function drawSteam(ctx, t, o) {
  const g = geom();
  drawSmoke(ctx, t, { x: g.smoke.x, y: g.smoke.y, amt: o.smoke ?? 0, wind: o.wind, light: o.light, C: o.C });
  if (o.horn !== null && o.horn !== undefined) {
    drawHorn(ctx, t, o.horn, { x: g.horn.x, y: g.horn.y - 2, dir: o.hornDir ?? -2.0, curl: o.hornCurl ?? 1, wind: o.wind, light: o.light, C: o.C });
  }
}

/** Lente horizontal (agrega al path actual). */
export function lensAt(ctx, x, y, w, th) {
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x, y - th, x + w / 2, y);
  ctx.quadraticCurveTo(x, y + th * 0.8, x - w / 2, y);
}
