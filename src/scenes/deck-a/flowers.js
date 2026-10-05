// Centro de mesa: florero bajo con rosas coral, durazno y crema, hojas, eucalipto y gipsófila (vista cenital).
import { TAU } from '../../engine/ease.js';
import { rng } from '../../engine/noise.js';
import { sprite, shadowSprite } from './util.js';
import { ellipse, blob, tone3 } from './shape.js';

function rose(c, L, x, y, R, col) {
  const [base, dark, light, deep] = col;
  // halo de sombra entre pétalos
  c.fillStyle = deep;
  c.beginPath(); c.arc(x, y, R * 1.02, 0, TAU); c.fill();
  const rings = [[7, 0.66, 0.44, 0.34, 0], [6, 0.44, 0.34, 0.27, 0.4], [5, 0.24, 0.24, 0.2, 0.9]];
  for (const [n, d, rx, ry, off] of rings) {
    for (let k = 0; k < n; k++) {
      const a = off + (k / n) * TAU;
      tone3(c, ellipse(x + Math.cos(a) * R * d, y + Math.sin(a) * R * d, R * rx, R * ry, a + Math.PI / 2),
        { base, dark, light, L, dd: R * 0.08, dl: R * 0.05 });
    }
  }
  // espiral del centro
  c.strokeStyle = deep;
  c.lineWidth = Math.max(1.2, R * 0.06);
  c.lineCap = 'round';
  c.beginPath();
  for (let i = 0; i <= 24; i++) {
    const u = i / 24, a = u * TAU * 1.6, r = R * (0.03 + 0.16 * u);
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i) c.lineTo(px, py); else c.moveTo(px, py);
  }
  c.stroke();
}

function leaf(c, L, x, y, a, len, w) {
  const d = [Math.cos(a), Math.sin(a)], n = [-d[1], d[0]];
  const P = (s, k) => [x + d[0] * s + n[0] * k, y + d[1] * s + n[1] * k];
  const mk = blob([P(0, 0), P(len * 0.3, w), P(len * 0.7, w * 0.8), P(len, 0), P(len * 0.7, -w * 0.8), P(len * 0.3, -w)]);
  tone3(c, mk, { base: '#3F7A45', dark: '#24502E', light: '#7FB777', L, dd: 3, dl: 2 });
  c.strokeStyle = 'rgba(160,210,150,0.6)';
  c.lineWidth = 1.2;
  const [ax, ay] = P(len * 0.05, 0), [bx, by] = P(len * 0.9, 0);
  c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
}

function eucalyptus(c, L, x, y, a, len) {
  const d = [Math.cos(a), Math.sin(a)], n = [-d[1], d[0]];
  c.strokeStyle = '#6E8F7E';
  c.lineWidth = 2;
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + d[0] * len * 0.5 + n[0] * 14, y + d[1] * len * 0.5 + n[1] * 14, x + d[0] * len, y + d[1] * len); c.stroke();
  for (let k = 1; k <= 5; k++) {
    const s = (k / 5.4) * len, side = k % 2 ? 1 : -1, bend = Math.sin((s / len) * Math.PI) * 14;
    const cx = x + d[0] * s + n[0] * (bend + side * 9), cy = y + d[1] * s + n[1] * (bend + side * 9);
    const r = 9 - k * 0.8;
    tone3(c, ellipse(cx, cy, r, r * 0.9, a), { base: '#93B8A5', dark: '#5F8676', light: '#D2E6DA', L, dd: 1.8, dl: 1.2 });
  }
}

/** Sprite del ramo (≈ 300×260) con la luz horneada. */
export function buildFlowers(L) {
  const r = rng(55);
  return sprite(320, 280, (c) => {
    // hojas y eucalipto por debajo
    leaf(c, L, 0, 0, -2.6, 118, 22);
    leaf(c, L, 0, 0, 0.3, 112, 20);
    leaf(c, L, 0, 0, 1.9, 96, 18);
    leaf(c, L, 0, 0, -0.9, 104, 19);
    eucalyptus(c, L, -10, 6, 2.6, 120);
    eucalyptus(c, L, 8, -6, -0.35, 128);
    // gipsófila
    for (let k = 0; k < 26; k++) {
      const a = r() * TAU, d = 70 + r() * 45;
      const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.85;
      c.fillStyle = 'rgba(40,50,40,0.35)';
      c.beginPath(); c.arc(x - L[0] * 2, y - L[1] * 2, 3.4, 0, TAU); c.fill();
      c.fillStyle = '#FFFDF6';
      c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill();
    }
    // rosas
    rose(c, L, -44, 18, 48, ['#FF7A57', '#D94A30', '#FFB79A', '#9E2E1E']);
    rose(c, L, 40, -16, 44, ['#FFC2A6', '#E8906E', '#FFE5D6', '#B4634A']);
    rose(c, L, 22, 50, 34, ['#FFF1DD', '#E3CDAE', '#FFFFFF', '#B59C7A']);
    rose(c, L, -30, -48, 26, ['#FFD27A', '#E0A23C', '#FFF0C9', '#A86E1C']);
  }, 1.5);
}

export const buildFlowersShadow = () => shadowSprite(300, 260, 16, (c) => {
  c.beginPath(); c.ellipse(0, 0, 130, 110, 0, 0, TAU); c.fill();
});
