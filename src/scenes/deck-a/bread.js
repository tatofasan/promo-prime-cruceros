// Platito de pan: porcelana con filo dorado, pancito de corteza tostada con cortes y harina, rulo de manteca
// y cuchillo de untar apoyado en el borde (vista cenital).
import { TAU } from '../../engine/ease.js';
import { rng } from '../../engine/noise.js';
import { sprite, shadowSprite } from './util.js';
import { ellipse, blob, tone3, crescent } from './shape.js';

export function buildBread(L) {
  const r = rng(808);
  return sprite(220, 220, (c) => {
    // platito
    const g = c.createRadialGradient(0, 0, 40, 0, 0, 82);
    g.addColorStop(0, '#FCF8F1');
    g.addColorStop(0.85, '#F3EBDD');
    g.addColorStop(1, '#E2D5C1');
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, 82, 0, TAU); c.fill();
    c.strokeStyle = '#C38A2C';
    c.lineWidth = 3.5;
    c.beginPath(); c.arc(0, 0, 79, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.8)';
    c.lineWidth = 1.4;
    const a = Math.atan2(L[1], L[0]);
    c.beginPath(); c.arc(0, 0, 81, a - 1, a + 1); c.stroke();
    crescent(c, ellipse(0, 0, 56, 56), L[0] * 4, L[1] * 4, 'rgba(150,120,90,0.18)');
    // pancito
    const roll = ellipse(-6, 4, 44, 33, -0.35);
    c.save();
    c.shadowColor = 'rgba(90,55,25,0.5)';
    c.shadowBlur = 12;
    c.shadowOffsetX = -L[0] * 8; c.shadowOffsetY = -L[1] * 8;
    c.fillStyle = '#B9692A';
    c.fill(roll());
    c.restore();
    tone3(c, roll, { base: '#D98B3C', dark: '#9C4E1C', light: '#F6C27A', L, dd: 8, dl: 5 });
    // cortes con miga clara
    c.save();
    c.clip(roll());
    for (const k of [-1, 0, 1]) {
      const cx = -6 + k * 20, cy = 4 - k * 7;
      const cut = ellipse(cx, cy, 6, 24, 0.55);
      c.fillStyle = '#F6DDAE';
      c.fill(cut());
      crescent(c, cut, -L[0] * 3, -L[1] * 3, 'rgba(160,90,40,0.7)');
    }
    // harina
    for (let k = 0; k < 40; k++) {
      const x = -40 + r() * 70, y = -24 + r() * 52;
      c.fillStyle = `rgba(255,252,240,${0.35 + r() * 0.4})`;
      c.beginPath(); c.arc(x, y, 0.8 + r() * 1.4, 0, TAU); c.fill();
    }
    c.restore();
    // rulo de manteca
    const butter = blob([[40, 30], [58, 26], [66, 40], [60, 56], [42, 58], [34, 44]]);
    tone3(c, butter, { base: '#FFE7A0', dark: '#E6C366', light: '#FFF8DA', L, dd: 3, dl: 2 });
    c.strokeStyle = 'rgba(210,170,80,0.6)';
    c.lineWidth = 1.2;
    for (const k of [0, 1, 2]) { c.beginPath(); c.arc(50, 42, 6 + k * 5, 0.5 + k, 3 + k); c.stroke(); }
    // cuchillo de untar en el borde
    c.save();
    c.translate(10, -58);
    c.rotate(-0.12);
    tone3(c, blob([[-74, -5], [10, -6], [44, -8], [72, -2], [74, 3], [44, 6], [10, 5], [-74, 5], [-78, 0]]),
      { base: '#C3CDD8', dark: '#77849A', light: '#FAFCFE', L: [L[0], L[1]], dd: 2.5, dl: 1.5 });
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(-66, -1); c.lineTo(66, -2); c.stroke();
    c.restore();
  }, 1.5);
}

export const buildBreadShadow = () => shadowSprite(176, 176, 10, (c) => {
  c.beginPath(); c.arc(0, 0, 84, 0, TAU); c.fill();
});
