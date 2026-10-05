// Mar estilizado del horizonte para abajo. Filas de oleaje en perspectiva (más chicas, juntas y claras hacia el
// horizonte), cada una en su propio plano de profundidad: con la cámara, las de adelante se mueven y crecen más
// (parallax real de un plano de suelo). Por fila: cara iluminada en degradé, filo de brillo cortado en trazos,
// espuma en las crestas cercanas, columna de luz y destellos del sol que titilan.
import { W, H } from '../engine/time.js';
import { applyCam } from '../engine/camera.js';
import { lin, sparkle } from '../engine/draw.js';
import { hash } from '../engine/noise.js';
import { TAU, clamp } from '../engine/ease.js';
import { mixHex } from '../engine/color.js';
import { seaOf } from './presets.js';
import { SKY_DEPTH, skyPoint } from './sky.js';
import { ca } from './util.js';

export const SEA_NEAR_DEPTH = 1.25;
const BOTTOM = H + 90;

/** Fracción de perspectiva (0 horizonte → 1 borde de abajo) de un punto del agua en y (mundo). */
export const seaFrac = (y, horizonY = 620) => clamp((y - horizonY) / (BOTTOM - horizonY));
/** Profundidad de cámara que le corresponde a algo apoyado en el agua en y (mundo): usala con plane(). */
export const seaDepth = (y, horizonY = 620) => SKY_DEPTH + (SEA_NEAR_DEPTH - SKY_DEPTH) * seaFrac(y, horizonY);

/**
 * drawOcean(ctx, t, { preset, horizonY, cam, glitter, sunX, sunY, swell, foam, rows, speed, lines, grain })
 *  En PANTALLA (transformación identidad), igual que drawSky; la cámara entra por `cam`.
 *  - horizonY: igual que en drawSky (def 620) · sunX/sunY: los MISMOS del cielo (plano del cielo)
 *  - glitter 0..1.5 (destellos + columna de luz) · swell 0..2 (alto de las olas) · foam 0..1.5
 *  - rows: filas de oleaje (def 22) · speed: velocidad del mar (def 1) · lines 0..1 (filos de brillo)
 *  Devuelve { hy } (y del horizonte en pantalla).
 */
export function drawOcean(ctx, t, o = {}) {
  const S = seaOf(o.preset ?? 'day');
  const cam = o.cam || { x: 0, y: 0, z: 1, r: 0 };
  const horizonY = o.horizonY ?? 620;
  const N = o.rows ?? 22;
  const swell = o.swell ?? 1;
  const foam = o.foam ?? 1;
  const glit = o.glitter ?? 1;
  const lines = o.lines ?? 1;
  const speed = o.speed ?? 1;
  const hasSun = o.sunX !== undefined && o.sunX !== null;
  const [sunSX] = hasSun ? skyPoint(cam, o.sunX, o.sunY ?? 260) : [W / 2];

  // horizonte en pantalla y relleno base (por si quedan huecos entre filas)
  const hy = rowScreenY(cam, horizonY, 0);
  ctx.save();
  ctx.fillStyle = lin(ctx, 0, hy, 0, H, [[0, S.far], [0.25, S.mid], [0.6, S.near], [1, S.deep]]);
  ctx.fillRect(0, hy, W, H - hy + 2);
  ctx.restore();

  const rowsData = [];
  for (let i = 0; i <= N + 1; i++) {
    const f = Math.pow((i + 0.35) / N, 1.9);
    rowsData.push({ i, f, y: horizonY + (BOTTOM - horizonY) * f, d: SKY_DEPTH + (SEA_NEAR_DEPTH - SKY_DEPTH) * f });
  }

  for (let i = 0; i < N; i++) {
    const R = rowsData[i], R2 = rowsData[Math.min(N + 1, i + 2)];
    const z = Math.pow(cam.z || 1, R.d);
    const sy = rowScreenY(cam, R.y, R.d);
    if (sy > H + 40) break;
    const gap = (R2.y - R.y) * 0.5; // separación (mundo del plano) hasta la fila siguiente
    const amp = swell * gap * (0.46 + 0.16 * R.f) + 0.6;
    const lam = 90 + 760 * R.f;
    const sp = speed * (10 + 46 * R.f);
    const seed = i * 13.7;

    ctx.save();
    applyCam(ctx, cam, R.d);
    // rango de x visible en el plano de la fila
    const cx = W / 2, mx = (cam.x || 0) * R.d;
    const halfW = (W / 2) / z + 160 + Math.abs(cam.r || 0) * W;
    const x0 = cx + mx - halfW, x1 = cx + mx + halfW;
    const step = Math.max(lam / 9, 10 / z);
    const wave = (x) => {
      const u = x / lam;
      const c = 0.5 + 0.5 * Math.sin(TAU * u + t * 1.1 * speed + seed);
      const peak = Math.pow(c, 1.8) * 2 - 1; // crestas en punta, valles anchos
      return amp * (0.66 * peak
        + 0.24 * Math.sin(TAU * u * 2.13 - t * 0.7 * speed + seed * 1.7)
        + 0.14 * Math.sin(TAU * (u * 0.47 + (t * sp) / lam) + seed * 0.3));
    };
    const pts = [];
    for (let x = x0; x <= x1 + step; x += step) pts.push([x, R.y - wave(x)]);

    // banda: del filo de la cresta hasta pasada la fila siguiente
    const yBot = R2.y + (R2.y - R.y) * 0.4 + 6 / z + amp * 2;
    const base = rowColor(S, R.f, i);
    const litC = mixHex(base, S.lit, 0.62 * (1 - R.f * 0.35));
    const crestC = mixHex(litC, S.line, 0.22 + 0.14 * (1 - R.f));
    const lowC = mixHex(base, S.trough, 0.36 + 0.3 * R.f);
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.lineTo(x1 + step, yBot);
    ctx.lineTo(x0, yBot);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, R.y - amp, 0, yBot, [[0, crestC], [0.1, litC], [0.3, mixHex(litC, base, 0.6)], [0.6, base], [1, lowC]]);
    ctx.fill();

    // columna de luz del sol sobre esta fila
    if (glit > 0.01 && hasSun) {
      const sx = (sunSX - cx) / z + cx + mx; // x del sol en el plano de la fila
      const spread = (60 + 620 * R.f) / Math.max(0.6, z * 0.7);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = lin(ctx, sx - spread, 0, sx + spread, 0, [[0, ca(S.glow, 0)], [0.5, ca(S.glow, S.glowA * glit * (0.85 - R.f * 0.5))], [1, ca(S.glow, 0)]]);
      ctx.fill();
      ctx.restore();
    }

    // picado: marquitas oscuras afinadas en la cara de la ola (textura de agua, solo filas cercanas)
    if (R.f > 0.22 && lines > 0.01) {
      const th = (1 + 3.5 * R.f) / Math.max(0.5, Math.sqrt(z));
      ctx.fillStyle = ca(S.trough, 0.22 + 0.12 * R.f);
      ctx.beginPath();
      const offc = (t * sp * 0.35 + hash(i, 9) * lam) % lam;
      for (let k = Math.floor((x0 - offc) / (lam * 0.5)) - 1; k * lam * 0.5 + offc < x1; k++) {
        if (hash(k, i, 51) < 0.35) continue;
        const xc = k * lam * 0.5 + offc + hash(k, i, 52) * lam * 0.3;
        const dy = (R2.y - R.y) * (0.12 + 0.22 * hash(k, i, 53));
        crestLens(ctx, xc, lam * (0.12 + 0.16 * hash(k, i, 54)), th, (x) => wave(x) * 0.6 - dy, R.y, step * 0.6);
      }
      ctx.fill();
    }

    // filos de brillo: lentes afinadas en las puntas que viajan sobre las crestas
    if (lines > 0.01) {
      const th = (0.9 + 4.2 * R.f) / Math.max(0.5, Math.sqrt(z));
      const la = S.lineA * lines * (0.35 + 0.65 * (1 - Math.abs(R.f - 0.4)));
      ctx.fillStyle = ca(S.line, la);
      const off = (t * sp * 0.6 + hash(i, 3) * lam) % lam;
      ctx.beginPath();
      for (let k = Math.floor((x0 - off) / lam) - 1; k * lam + off < x1; k++) {
        const h = hash(k, i, 41);
        if (h < 0.28) continue;
        const len = lam * (0.22 + 0.42 * hash(k, i, 42));
        const xc = k * lam + off + h * lam * 0.35;
        crestLens(ctx, xc, len, th, wave, R.y, step * 0.5);
      }
      ctx.fill();
    }

    // espuma en las crestas cercanas
    if (foam > 0.01 && R.f > 0.18) drawFoamCaps(ctx, t, R, i, x0, x1, lam, wave, foam, S, z);

    // destellos del sol (titilan)
    if (glit > 0.01 && hasSun) drawRowGlitter(ctx, t, R, i, sunSX, wave, glit, S, z, cx, mx);
    ctx.restore();
  }

  // filo del horizonte
  ctx.save();
  ctx.fillStyle = lin(ctx, 0, hy - 3, 0, hy + 6, [[0, ca(S.horizonLine, 0)], [0.35, ca(S.horizonLine, 0.85)], [1, ca(S.horizonLine, 0)]]);
  ctx.fillRect(0, hy - 3, W, 9);
  ctx.restore();
  return { hy };
}

function rowScreenY(cam, y, d) {
  const cy = H / 2;
  const z = Math.pow(cam.z || 1, d);
  return cy + (y - cy - (cam.y || 0) * d) * z;
}

function rowColor(S, f, i) {
  const c = f < 0.3 ? mixHex(S.far, S.mid, f / 0.3) : f < 0.65 ? mixHex(S.mid, S.near, (f - 0.3) / 0.35) : mixHex(S.near, S.deep, (f - 0.65) / 0.35);
  return i % 2 ? mixHex(c, '#ffffff', 0.025) : c;
}

function drawFoamCaps(ctx, t, R, i, x0, x1, lam, wave, foam, S, z) {
  const k0 = Math.floor(x0 / (lam * 0.5)), k1 = Math.ceil(x1 / (lam * 0.5));
  ctx.fillStyle = ca(S.foam, 0.9);
  for (let k = k0; k <= k1; k++) {
    const h = hash(k, i, 77);
    if (h > (0.3 + 0.25 * R.f) * foam) continue;
    const life = 0.5 + 0.5 * Math.sin(t * (0.9 + h * 1.4) + k * 2.3 + i);
    if (life < 0.25) continue;
    const xc = (k + hash(k, i, 78)) * lam * 0.5;
    const len = lam * (0.1 + 0.2 * hash(k, i, 79)) * life;
    const th = (2 + 10 * R.f) * life / Math.max(0.6, Math.sqrt(z));
    ctx.globalAlpha = Math.min(1, life * 1.4) * (0.6 + 0.4 * R.f);
    // sombra de la espuma (tono 2) y la espuma (tono 1)
    ctx.fillStyle = ca(S.trough, 0.35);
    ctx.beginPath();
    crestLens(ctx, xc + len * 0.04, len * 0.9, th * 0.7, (x) => wave(x) - th * 0.55, R.y, len / 7);
    ctx.fill();
    ctx.fillStyle = ca(S.foam, 0.95);
    ctx.beginPath();
    crestLens(ctx, xc, len, th, wave, R.y, len / 7);
    ctx.fill();
    // burbujitas sueltas debajo
    if (R.f > 0.4) {
      for (let q = 0; q < 3; q++) {
        const bx = xc + (hash(k, q, 80) - 0.5) * len * 1.2;
        const by = R.y - wave(bx) + th * (1.6 + q * 0.9);
        ctx.beginPath();
        ctx.arc(bx, by, th * (0.18 + 0.14 * hash(k, q, 81)), 0, TAU);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

/** Lente sobre la cresta: lomo arriba (0,4·th) y panza abajo (th), afinada en las puntas. */
function crestLens(ctx, xc, len, th, wave, y0, step) {
  const n = Math.max(4, Math.min(16, Math.ceil(len / Math.max(1, step))));
  for (let j = 0; j <= n; j++) {
    const x = xc - len / 2 + (len * j) / n;
    const y = y0 - wave(x) - Math.sin((j / n) * Math.PI) * th * 0.4;
    j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  for (let j = n; j >= 0; j--) {
    const x = xc - len / 2 + (len * j) / n;
    ctx.lineTo(x, y0 - wave(x) + Math.sin((j / n) * Math.PI) * th * 0.6);
  }
  ctx.closePath();
}

function drawRowGlitter(ctx, t, R, i, sunSX, wave, glit, S, z, cx, mx) {
  const sx = (sunSX - cx) / z + cx + mx;
  const spread = (40 + 560 * R.f) / Math.max(0.6, z * 0.7);
  const n = Math.round((6 + 20 * R.f) * Math.min(1.5, glit));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const h1 = hash(k, i, 5), h2 = hash(k, i, 6), h3 = hash(k, i, 7);
    // distribución con más densidad en el centro de la columna
    const u = (h1 + hash(k, i, 8) + h2 - 1.5) / 1.5;
    const x = sx + u * spread + Math.sin(t * 0.8 + k) * 6 * (1 + R.f);
    const tw = Math.sin(t * (2.2 + h3 * 4) + h2 * TAU);
    if (tw < 0.15) continue;
    const a = Math.pow(tw, 1.5) * glit * (1 - Math.abs(u) * 0.7);
    const len = (3 + 46 * R.f) * (0.4 + h3);
    const y = R.y - wave(x) + 1;
    ctx.strokeStyle = ca(S.glitter, Math.min(1, a));
    ctx.lineWidth = (0.9 + 3.4 * R.f) * (0.6 + 0.4 * tw) / Math.max(0.6, Math.sqrt(z));
    ctx.beginPath();
    ctx.moveTo(x - len / 2, y);
    ctx.lineTo(x + len / 2, y);
    ctx.stroke();
    if (tw > 0.95 && R.f > 0.12 && h2 > 0.72) sparkle(ctx, x, y - 1, (4 + 13 * R.f) * (tw - 0.9) * 10 / Math.max(0.6, Math.sqrt(z)), { color: S.glitter, alpha: Math.min(1, a), halo: 0.5 });
  }
  ctx.restore();
}
