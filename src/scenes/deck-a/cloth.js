// Mantel navy de jacquard: base con manchas suaves, dibujo tono sobre tono, trama, pliegues de planchado y
// grano. Se pinta una sola vez (init) en un lienzo de mundo más grande que el cuadro (cubre paneos y alejadas).
import { makeCanvas } from '../../engine/env.js';
import { rng } from '../../engine/noise.js';
import { texture } from '../../engine/draw.js';
import { TAU } from '../../engine/ease.js';
import { flatten, LIGHT } from './util.js';

export const CLOTH = { x0: -280, y0: -190, w: 2480, h: 1460 };

function motif(c, x, y, s) {
  // flor de cuatro pétalos con zarcillos (damasco simplificado)
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  for (let k = 0; k < 4; k++) {
    c.rotate(TAU / 4);
    c.beginPath();
    c.moveTo(0, -6);
    c.bezierCurveTo(10, -18, 8, -34, 0, -40);
    c.bezierCurveTo(-8, -34, -10, -18, 0, -6);
    c.fill();
    c.beginPath();
    c.moveTo(4, -44);
    c.bezierCurveTo(22, -52, 30, -36, 20, -30);
    c.stroke();
  }
  c.beginPath();
  c.arc(0, 0, 5, 0, TAU);
  c.fill();
  c.restore();
}

export function buildCloth() {
  const { x0, y0, w, h } = CLOTH;
  const cv = makeCanvas(w, h);
  const c = cv.getContext('2d');
  c.translate(-x0, -y0);
  // base: navy600 bajo el plato que cae a navy900 en los bordes (la mesa se ilumina desde el centro)
  {
    const g = c.createRadialGradient(960, 540, 0, 960, 540, 1250);
    g.addColorStop(0, '#16426F');
    g.addColorStop(0.32, '#123A63');
    g.addColorStop(0.62, '#0B2546');
    g.addColorStop(1, '#061629');
    c.fillStyle = g;
    c.fillRect(x0, y0, w, h);
  }
  const r = rng(311);
  // manchas grandes muy sutiles (la tela nunca es un plano muerto)
  for (let i = 0; i < 70; i++) {
    const x = x0 + r() * w, y = y0 + r() * h, rad = 120 + r() * 320;
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    const light = r() > 0.5;
    g.addColorStop(0, light ? 'rgba(40,80,130,0.06)' : 'rgba(2,8,18,0.07)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // jacquard: retícula en diamante de motivos tono sobre tono
  c.fillStyle = 'rgba(96,150,210,0.13)';
  c.strokeStyle = 'rgba(96,150,210,0.12)';
  c.lineWidth = 3;
  c.lineCap = 'round';
  const step = 190;
  for (let j = -1, row = 0; y0 + j * step * 0.5 < y0 + h + step; j++, row++) {
    const yy = y0 + j * step * 0.5;
    const off = (row % 2) * step * 0.5;
    for (let xx = x0 - step + off; xx < x0 + w + step; xx += step) motif(c, xx, yy, row % 2 ? 0.55 : 0.9);
  }
  // trama fina (tejido)
  c.globalAlpha = 0.05;
  c.strokeStyle = '#5E86B5';
  c.lineWidth = 1;
  c.beginPath();
  for (let x = x0; x < x0 + w; x += 4) { c.moveTo(x + 0.5, y0); c.lineTo(x + 0.5, y0 + h); }
  c.stroke();
  c.strokeStyle = '#020A16';
  c.beginPath();
  for (let y = y0; y < y0 + h; y += 4) { c.moveTo(x0, y + 0.5); c.lineTo(x0 + w, y + 0.5); }
  c.stroke();
  c.globalAlpha = 1;
  // pliegues de planchado: banda de sombra suave + filo de luz
  const crease = (vertical, at, seed) => {
    const rr = rng(seed);
    const pts = [];
    const len = vertical ? h : w;
    for (let s = -40; s <= len + 40; s += 120) pts.push([s, at + (rr() - 0.5) * 10]);
    const P = (dx) => {
      const p = new Path2D();
      pts.forEach(([s, a], i) => {
        const X = vertical ? a + dx : x0 + s, Y = vertical ? y0 + s : a + dx;
        if (i) p.lineTo(X, Y); else p.moveTo(X, Y);
      });
      return p;
    };
    c.save();
    c.filter = 'blur(9px)';
    c.strokeStyle = 'rgba(1,6,14,0.42)';
    c.lineWidth = 16;
    c.stroke(P(9));
    c.filter = 'blur(5px)';
    c.strokeStyle = 'rgba(60,105,160,0.20)';
    c.lineWidth = 8;
    c.stroke(P(-6));
    c.filter = 'none';
    c.strokeStyle = 'rgba(150,195,240,0.34)';
    c.lineWidth = 1.8;
    c.stroke(P(-1));
    c.strokeStyle = 'rgba(255,214,150,0.16)';
    c.lineWidth = 1;
    c.stroke(P(-2.5));
    c.restore();
  };
  crease(true, 300, 1);
  crease(true, 1620, 2);
  crease(false, 30, 3);
  crease(false, 1050, 4);
  // pool de luz cálida bajo el plato (goldPale, r ≈ 500): la mesa ya está iluminada en el corte
  {
    const R0 = 560;
    const g = c.createRadialGradient(960, 540, 0, 960, 540, R0);
    g.addColorStop(0, 'rgba(255,233,184,0.30)');
    g.addColorStop(0.45, 'rgba(255,233,184,0.2)');
    g.addColorStop(0.8, 'rgba(255,214,150,0.06)');
    g.addColorStop(1, 'rgba(255,214,150,0)');
    c.globalCompositeOperation = 'screen';
    c.fillStyle = g;
    c.fillRect(960 - R0, 540 - R0, R0 * 2, R0 * 2);
    const g2 = c.createRadialGradient(960, 540, 0, 960, 540, 470);
    g2.addColorStop(0, 'rgba(255,170,90,0.5)');
    g2.addColorStop(0.6, 'rgba(255,160,90,0.22)');
    g2.addColorStop(1, 'rgba(255,150,80,0)');
    c.globalCompositeOperation = 'soft-light';
    c.fillStyle = g2;
    c.fillRect(960 - 470, 540 - 470, 940, 940);
    c.globalCompositeOperation = 'source-over';
  }
  // charco de luz cálida de la vela (horneado: la vela no se mueve en el mundo)
  const R = 1150, cy = LIGHT.y + 60;
  const g = c.createRadialGradient(LIGHT.x, cy, 0, LIGHT.x, cy, R);
  g.addColorStop(0, 'rgba(255,196,120,0.62)');
  g.addColorStop(0.32, 'rgba(255,166,92,0.31)');
  g.addColorStop(0.7, 'rgba(240,140,80,0.075)');
  g.addColorStop(1, 'rgba(240,140,80,0)');
  c.globalCompositeOperation = 'soft-light';
  c.fillStyle = g;
  c.fillRect(LIGHT.x - R, cy - R, R * 2, R * 2);
  const R2 = 650;
  const g2 = c.createRadialGradient(LIGHT.x, LIGHT.y, 0, LIGHT.x, LIGHT.y, R2);
  g2.addColorStop(0, 'rgba(255,170,90,0.124)');
  g2.addColorStop(1, 'rgba(255,170,90,0)');
  c.globalCompositeOperation = 'screen';
  c.fillStyle = g2;
  c.fillRect(LIGHT.x - R2, LIGHT.y - R2, R2 * 2, R2 * 2);
  c.globalCompositeOperation = 'source-over';
  // grano dentro de la tela
  texture(c, (() => { const p = new Path2D(); p.rect(x0, y0, w, h); return p; })(), { alpha: 0.11, blend: 'overlay', scale: 1.2 });
  return flatten(cv);
}
