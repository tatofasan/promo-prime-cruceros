// Telón de terciopelo: paños laterales con pliegues (3 tonos + brillo de terciopelo + flecos dorados) que se
// abren con vaivén, y bambalina superior de guirnaldas con borlas. Precalculado; en vivo solo se escala y ondula.
import { makeCanvas } from '../../engine/env.js';
import { W } from '../../engine/time.js';
import { TAU } from '../../engine/ease.js';
import { PAL, rgba } from '../../engine/color.js';
import { grain } from './grain.js';
import { DB } from './pal.js';

const PW = 760, PH = 1180, FOLDS = 9;
let panel = null, valance = null;

function foldGradient(g, x0, w) {
  const gr = g.createLinearGradient(x0, 0, x0 + w, 0);
  gr.addColorStop(0, DB.velvetDeep);
  gr.addColorStop(0.14, DB.velvetDark);
  gr.addColorStop(0.36, DB.velvet);
  gr.addColorStop(0.55, DB.velvetLight);
  gr.addColorStop(0.61, DB.velvetHi);
  gr.addColorStop(0.67, DB.velvetLight);
  gr.addColorStop(0.84, DB.velvet);
  gr.addColorStop(1, DB.velvetDeep);
  return gr;
}

function buildPanel() {
  const cv = makeCanvas(PW, PH);
  const g = cv.getContext('2d');
  const fw = PW / FOLDS;
  const hemY = PH - 60;
  for (let i = 0; i < FOLDS; i++) {
    const x0 = i * fw;
    // pliegue con dobladillo redondeado abajo
    g.beginPath();
    g.moveTo(x0, 0);
    g.lineTo(x0 + fw, 0);
    g.lineTo(x0 + fw, hemY - 8);
    g.quadraticCurveTo(x0 + fw / 2, hemY + 22, x0, hemY - 8);
    g.closePath();
    g.fillStyle = foldGradient(g, x0, fw);
    g.fill();
  }
  // sombra de la bambalina arriba y oscurecimiento hacia el piso
  const v = g.createLinearGradient(0, 0, 0, PH);
  v.addColorStop(0, rgba(PAL.ink, 0.75));
  v.addColorStop(0.18, rgba(PAL.ink, 0.1));
  v.addColorStop(0.7, rgba(PAL.ink, 0));
  v.addColorStop(1, rgba(PAL.ink, 0.35));
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = v;
  g.fillRect(0, 0, PW, PH);
  g.globalCompositeOperation = 'source-over';
  // flecos dorados siguiendo el dobladillo
  for (let i = 0; i < FOLDS; i++) {
    const x0 = i * fw;
    for (let k = 0; k <= 14; k++) {
      const u = k / 14;
      const x = x0 + u * fw;
      const y = hemY - 8 + 60 * u * (1 - u);
      g.strokeStyle = k % 2 ? DB.brassDark : DB.brass;
      g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 0.5, y + 36); g.stroke();
    }
    g.strokeStyle = DB.brassLight;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x0, hemY - 8);
    g.quadraticCurveTo(x0 + fw / 2, hemY + 22, x0 + fw, hemY - 8);
    g.stroke();
  }
  grain(g, null, { alpha: 0.12, blend: 'overlay' });
  return cv;
}

function buildValance() {
  const VW = W + 200, VH = 300;
  const cv = makeCanvas(VW, VH);
  const g = cv.getContext('2d');
  // barra superior de terciopelo
  g.fillStyle = DB.velvetDark;
  g.fillRect(0, 0, VW, 92);
  g.fillStyle = DB.velvet;
  g.fillRect(0, 0, VW, 70);
  g.fillStyle = rgba(DB.velvetHi, 0.5);
  g.fillRect(0, 54, VW, 4);
  // guirnaldas (swags)
  const n = 6;
  const sw = VW / n;
  for (let i = 0; i < n; i++) {
    const x0 = i * sw, x1 = x0 + sw;
    const depth = 150;
    // bandas concéntricas de pliegues
    for (let b = 5; b >= 0; b--) {
      const off = b * 24;
      g.beginPath();
      g.moveTo(x0 - 4, 60);
      g.quadraticCurveTo((x0 + x1) / 2, 60 + depth * 2 - off * 1.6, x1 + 4, 60);
      g.lineTo(x1 + 4, 40);
      g.lineTo(x0 - 4, 40);
      g.closePath();
      g.fillStyle = [DB.velvetDark, DB.velvet, DB.velvetLight, DB.velvet, DB.velvetDark, DB.velvetDeep][b];
      g.fill();
      if (b === 2 || b === 4) {
        g.strokeStyle = rgba(DB.velvetHi, 0.55);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x0 + 10, 64);
        g.quadraticCurveTo((x0 + x1) / 2, 60 + depth * 2 - off * 1.6 - 6, x1 - 10, 64);
        g.stroke();
      }
    }
    // fleco dorado del borde inferior de la guirnalda
    for (let k = 0; k <= 40; k++) {
      const u = k / 40;
      const x = x0 + u * sw;
      const y = 60 + 2 * u * (1 - u) * (depth * 2) * 0.5 * 2 - 2;
      g.strokeStyle = k % 2 ? DB.brassDark : DB.brass;
      g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 22); g.stroke();
    }
    g.strokeStyle = DB.brassLight;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(x0, 60);
    g.quadraticCurveTo((x0 + x1) / 2, 60 + depth * 2, x1, 60);
    g.stroke();
  }
  // borlas en las uniones
  for (let i = 0; i <= n; i++) {
    const x = i * sw;
    g.strokeStyle = DB.brass;
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(x, 58); g.lineTo(x, 150); g.stroke();
    g.beginPath(); g.ellipse(x, 150, 11, 14, 0, 0, TAU); g.fillStyle = DB.brass; g.fill();
    g.beginPath(); g.moveTo(x - 13, 160); g.lineTo(x + 13, 160); g.lineTo(x + 9, 205); g.lineTo(x - 9, 205); g.closePath();
    g.fillStyle = DB.brassDark; g.fill();
    g.fillStyle = DB.brass; g.fillRect(x - 9, 160, 6, 45);
    g.beginPath(); g.arc(x - 3, 146, 4, 0, TAU); g.fillStyle = DB.brassHi; g.fill();
  }
  // filete dorado arriba
  g.fillStyle = DB.brassDark; g.fillRect(0, 0, VW, 14);
  g.fillStyle = DB.brass; g.fillRect(0, 0, VW, 9);
  g.fillStyle = DB.brassHi; g.fillRect(0, 2, VW, 2);
  grain(g, null, { alpha: 0.1, blend: 'overlay' });
  return cv;
}

export function initCurtain() {
  if (panel) return;
  panel = buildPanel();
  valance = buildValance();
}

/**
 * Paño lateral. side -1 = izquierda (anclado al borde izquierdo), +1 = derecha.
 * edge = x (px) del borde interior del paño · sway = desfase del ruedo (px, lo empuja la inercia) · y0 = arriba.
 */
export function drawPanel(ctx, side, edge, { sway = 0, y0 = -40, t = 0 } = {}) {
  const outer = side < 0 ? -60 : W + 60;
  const w = Math.abs(edge - outer);
  // terciopelo que sigue fuera de cuadro (se ve durante el látigo)
  ctx.fillStyle = DB.velvetDark;
  ctx.fillRect(side < 0 ? outer - 1400 : outer, y0, 1400, PH);
  if (w < 4) return;
  const strips = 24;
  const sh = PH / strips;
  const off = (q) => sway * q * q + Math.sin(t * 2.2 + q * 3 + side) * 4 * q * q;
  const wid = (q) => w * (1 + 0.04 * q);
  // cada tira se corta con un sesgo para que sus bordes empalmen con las vecinas (curva continua, sin escalones)
  for (let i = 0; i < strips; i++) {
    const q0 = i / strips, q1 = (i + 1) / strips;
    const yTop = y0 + i * sh;
    const x0 = side < 0 ? outer + off(q0) : outer - wid(q0) + off(q0);
    const x1 = side < 0 ? outer + off(q1) : outer - wid(q1) + off(q1);
    const slope = (x1 - x0) / sh;
    const ww = wid((q0 + q1) / 2);
    ctx.save();
    ctx.transform(1, 0, slope, 1, x0 - slope * yTop, 0);
    ctx.drawImage(panel, 0, i * sh, PW, sh + 0.5, 0, yTop, ww, sh + 0.5);
    ctx.restore();
  }
}

/** Bambalina superior (en el plano del telón). */
export function drawValance(ctx, { dy = 0 } = {}) {
  ctx.drawImage(valance, -100, -12 + dy);
}

export const CURTAIN_H = PH;
