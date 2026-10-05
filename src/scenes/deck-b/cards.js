// Escalera real de corazones que se abre en abanico sobre el paño (exp.chips).
// Caras precalculadas en init (papel cálido con grano, índices, figuras con panel navy y corona dorada).
import { makeCanvas } from '../../engine/env.js';
import { TAU, clamp, E } from '../../engine/ease.js';
import { PAL, shade, rgba } from '../../engine/color.js';
import { texture, rrectPath } from '../../engine/draw.js';
import { DB } from './pal.js';

export const CARD = { w: 92, h: 128, r: 8, k: 1.35 };
const K = 2.5;
const RANKS = ['10', 'J', 'Q', 'K', 'A'];
const HEART = PAL.coral;
const HEART_DARK = shade(PAL.coral, -0.3);
let faces = null;

function heart(g, cx, cy, s, color = HEART, shadeIt = true) {
  const p = new Path2D();
  p.moveTo(cx, cy + s * 0.9);
  p.bezierCurveTo(cx - s * 1.25, cy + s * 0.05, cx - s * 0.95, cy - s * 0.95, cx, cy - s * 0.35);
  p.bezierCurveTo(cx + s * 0.95, cy - s * 0.95, cx + s * 1.25, cy + s * 0.05, cx, cy + s * 0.9);
  p.closePath();
  g.fillStyle = color;
  g.fill(p);
  if (shadeIt) {
    g.save();
    g.clip(p);
    g.fillStyle = HEART_DARK;
    g.fillRect(cx + s * 0.08, cy - s * 2, s * 3, s * 4);
    g.beginPath();
    g.arc(cx - s * 0.48, cy - s * 0.38, s * 0.22, 0, TAU);
    g.fillStyle = rgba(PAL.white, 0.7);
    g.fill();
    g.restore();
  }
  return p;
}

function crown(g, cx, cy, s) {
  g.beginPath();
  g.moveTo(cx - s, cy + s * 0.5);
  g.lineTo(cx - s, cy - s * 0.35);
  g.lineTo(cx - s * 0.5, cy + s * 0.05);
  g.lineTo(cx, cy - s * 0.6);
  g.lineTo(cx + s * 0.5, cy + s * 0.05);
  g.lineTo(cx + s, cy - s * 0.35);
  g.lineTo(cx + s, cy + s * 0.5);
  g.closePath();
  g.fillStyle = DB.brass;
  g.fill();
  g.fillStyle = DB.brassDark;
  g.fillRect(cx - s, cy + s * 0.32, s * 2, s * 0.18);
  for (const dx of [-1, 0, 1]) {
    g.beginPath();
    g.arc(cx + dx * s * (dx ? 1 : 0), cy - (dx ? s * 0.35 : s * 0.6) - s * 0.12, s * 0.13, 0, TAU);
    g.fillStyle = DB.brassHi;
    g.fill();
  }
}

function buildFace(rank) {
  const { w, h, r } = CARD;
  const cv = makeCanvas(Math.ceil(w * K), Math.ceil(h * K));
  const g = cv.getContext('2d');
  g.scale(K, K);
  const body = rrectPath(0, 0, w, h, r);
  g.fillStyle = PAL.warmWhite;
  g.fill(body);
  texture(g, body, { alpha: 0.12, blend: 'multiply', scale: 0.5 });
  g.strokeStyle = rgba(PAL.gold, 0.55);
  g.lineWidth = 1;
  g.stroke(rrectPath(4.5, 4.5, w - 9, h - 9, r - 3));
  // índices
  const idx = (rot) => {
    g.save();
    if (rot) { g.translate(w, h); g.rotate(Math.PI); }
    g.fillStyle = HEART;
    g.font = `800 ${rank === '10' ? 17 : 19}px Outfit`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillText(rank, 14, 25);
    heart(g, 14, 35, 5.5, HEART, false);
    g.restore();
  };
  idx(false);
  idx(true);
  const cx = w / 2, cy = h / 2;
  if (rank === 'A') {
    heart(g, cx, cy + 2, 25);
  } else if (rank === '10') {
    const cols = [w * 0.33, w * 0.67];
    const rows = [0.2, 0.4, 0.6, 0.8].map((q) => h * (0.12 + q * 0.76) - 2);
    for (const x of cols) for (const y of rows) heart(g, x, y, 7.2);
    heart(g, cx, h * 0.31, 7.2);
    heart(g, cx, h * 0.69, 7.2);
  } else {
    const px = 22, py = 16;
    const panel = rrectPath(px, py, w - px * 2, h - py * 2, 5);
    g.fillStyle = PAL.navy800;
    g.fill(panel);
    g.save();
    g.clip(panel);
    g.fillStyle = PAL.navy700;
    g.beginPath(); g.moveTo(px, py); g.lineTo(w - px, py); g.lineTo(px, h - py); g.closePath(); g.fill();
    g.restore();
    g.strokeStyle = DB.brass;
    g.lineWidth = 1.6;
    g.stroke(panel);
    crown(g, cx, cy - 22, rank === 'K' ? 13 : rank === 'Q' ? 11 : 9);
    g.fillStyle = PAL.goldLight;
    g.font = '900 34px Outfit';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(rank, cx, cy + 7);
    heart(g, cx, cy + 34, 6.5);
  }
  return cv;
}

export function initCards() {
  if (!faces) faces = RANKS.map(buildFace);
}

/** Abanico con pivote (px, py) en la mesa. Cada carta gira desde el mazo con overshoot y se levanta un poco. */
export function drawCards(ctx, cam, t, tCue, { px = -170, py = -400, baseRot = 0.18, sweepT = 0, k = 1 } = {}) {
  const w = CARD.w * k, h = CARD.h * k, r = CARD.r * k;
  const n = faces.length;
  const body = rrectPath(-w / 2, -h + 18 * k, w, h, r);
  for (let i = 0; i < n; i++) {
    const t0 = tCue + 0.02 + i * 0.04;
    const p = clamp((t - t0) / 0.32);
    const e = E.backOut(2.2)(p);
    const fanA = (i - (n - 1) / 2) * 0.25;
    const ang = baseRot + (i - (n - 1) / 2) * 0.012 + (fanA - (i - (n - 1) / 2) * 0.012) * e;
    const lift = Math.sin(Math.PI * p) * 9;
    const z = 1 + i * 0.9 + lift;
    const s = cam.p(px, py, z).s;
    // canto (espesor) + sombra proyectada
    const me = cam.aff(px, py, z - 1.6);
    ctx.save();
    ctx.shadowColor = rgba(PAL.ink, 0.42);
    ctx.shadowBlur = (10 + lift * 1.5) * s;
    ctx.shadowOffsetX = (7 + lift) * s;
    ctx.shadowOffsetY = (9 + lift) * s;
    ctx.transform(me[0], me[1], me[2], me[3], me[4], me[5]);
    ctx.rotate(ang);
    ctx.fillStyle = shade(PAL.warmWhite, -0.3);
    ctx.fill(body);
    ctx.restore();
    // cara
    const m = cam.aff(px, py, z);
    ctx.save();
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.rotate(ang);
    ctx.drawImage(faces[i], -w / 2, -h + 18 * k, w, h);
    // brillo en cascada carta por carta
    const sp = (t - sweepT) / 0.45 - i * 0.12;
    if (sweepT && sp > 0 && sp < 1) {
      ctx.save();
      ctx.clip(body);
      ctx.globalCompositeOperation = 'screen';
      const bx = -w + sp * w * 2.4;
      const g = ctx.createLinearGradient(bx - 26, 0, bx + 26, -20);
      g.addColorStop(0, rgba(PAL.goldPale, 0));
      g.addColorStop(0.5, rgba(PAL.goldPale, 0.65));
      g.addColorStop(1, rgba(PAL.goldPale, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-w, -h - 20, w * 2, h + 60);
      ctx.restore();
    }
    // filo de luz en el borde izquierdo-superior
    ctx.strokeStyle = rgba(PAL.white, 0.6);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 0.8, 18 * k - r);
    ctx.lineTo(-w / 2 + 0.8, -h + 18 * k + r);
    ctx.arcTo(-w / 2 + 0.8, -h + 18 * k + 0.8, -w / 2 + r, -h + 18 * k + 0.8, r);
    ctx.lineTo(w / 2 - r, -h + 18 * k + 0.8);
    ctx.stroke();
    ctx.restore();
  }
}
