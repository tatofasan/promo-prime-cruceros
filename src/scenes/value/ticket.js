// TARJETA DE EMBARQUE: papel con troquel, talón con código de barras, franja navy, campos rioplatenses,
// contador tipo odómetro, sello y el talón que se arranca. Origen local = centro de la tarjeta.
import { PAL, shade, rgba, mixHex } from '../../engine/color.js';
import { E, clamp, TAU } from '../../engine/ease.js';
import { rrectPath, texture } from '../../engine/draw.js';
import { hash, rng } from '../../engine/noise.js';
import { fontStr } from '../../engine/text.js';
import { drawPin } from '../../brand/pin.js';
import { sprite, drawSprite, shadowOf, rr, label } from './util.js';
import { gloss } from './shade3.js';

export const TK = { w: 1300, h: 520, perf: 318, r: 30, notch: 27, band: 104 };
/** Centro de la ventana del precio (y del sello) en coords locales. */
export const PRICE = [20, 86];
const X0 = -TK.w / 2, Y0 = -TK.h / 2;
const PAPER = PAL.warmWhite;
const INKN = PAL.navy800;

let BODY = null, STUB = null, BODY_SH = null, STUB_SH = null, TEAR = null;

/** Línea de rotura del troquel (zigzag fino determinista), de arriba a abajo. */
function tearLine() {
  const pts = [];
  const n = 46;
  for (let i = 0; i <= n; i++) {
    const y = Y0 + (TK.h * i) / n;
    pts.push([TK.perf + (i % 2 ? 3.5 : -3.5) + (hash(i, 17) - 0.5) * 5, y]);
  }
  return pts;
}

function paperPath() {
  // rectángulo redondeado con dos muescas semicirculares en el troquel
  const p = new Path2D();
  const { w, h, r, perf, notch } = TK;
  p.moveTo(X0 + r, Y0);
  p.lineTo(perf - notch, Y0);
  p.arc(perf, Y0, notch, Math.PI, 0, true);
  p.lineTo(X0 + w - r, Y0);
  p.arcTo(X0 + w, Y0, X0 + w, Y0 + r, r);
  p.lineTo(X0 + w, Y0 + h - r);
  p.arcTo(X0 + w, Y0 + h, X0 + w - r, Y0 + h, r);
  p.lineTo(perf + notch, Y0 + h);
  p.arc(perf, Y0 + h, notch, 0, Math.PI, true);
  p.lineTo(X0 + r, Y0 + h);
  p.arcTo(X0, Y0 + h, X0, Y0 + h - r, r);
  p.lineTo(X0, Y0 + r);
  p.arcTo(X0, Y0, X0 + r, Y0, r);
  p.closePath();
  return p;
}

function smallShip(c, x, y, s, col) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(-40, 0); c.lineTo(36, 0); c.lineTo(24, 16); c.lineTo(-40, 16); c.closePath(); c.fill();
  c.beginPath();
  c.moveTo(-36, 0); c.lineTo(-36, -14); c.lineTo(-4, -14); c.lineTo(-4, -22); c.lineTo(8, -22); c.lineTo(8, -14);
  c.lineTo(14, -14); c.lineTo(24, 0); c.closePath(); c.fill();
  c.fillStyle = PAL.brandOrange;
  c.fillRect(-2, -30, 9, 9);
  c.restore();
}

function paintTicket(c) {
  const paper = paperPath();
  // papel con caída de luz suave (arriba-izquierda más clara)
  const g = c.createLinearGradient(X0, Y0, X0 + TK.w, Y0 + TK.h);
  g.addColorStop(0, '#FFFDF8');
  g.addColorStop(1, mixHex(PAPER, '#E9DCC7', 0.6));
  c.fillStyle = g;
  c.fill(paper);
  c.save();
  c.clip(paper);
  // franja superior navy (cuerpo y talón) con rayado diagonal sutil
  c.fillStyle = PAL.navy700;
  c.fillRect(X0, Y0, TK.w, TK.band);
  c.save();
  c.beginPath(); c.rect(X0, Y0, TK.w, TK.band); c.clip();
  c.strokeStyle = rgba(PAL.navy500, 0.35);
  c.lineWidth = 10;
  for (let x = X0 - 200; x < X0 + TK.w + 200; x += 34) { c.beginPath(); c.moveTo(x, Y0 + TK.band + 10); c.lineTo(x + 120, Y0 - 10); c.stroke(); }
  c.restore();
  // filo de luz bajo la franja y línea dorada
  c.fillStyle = PAL.gold;
  c.fillRect(X0, Y0 + TK.band, TK.w, 7);
  c.fillStyle = rgba(PAL.navy900, 0.12);
  c.fillRect(X0, Y0 + TK.band + 7, TK.w, 5);
  // pie: olitas cian y dorado
  c.fillStyle = PAL.brandCyan;
  c.beginPath();
  c.moveTo(X0, Y0 + TK.h);
  for (let x = X0; x <= X0 + TK.w; x += 10) c.lineTo(x, Y0 + TK.h - 30 + Math.sin(x * 0.045) * 6);
  c.lineTo(X0 + TK.w, Y0 + TK.h);
  c.closePath();
  c.fill();
  c.fillStyle = PAL.ocean600;
  c.beginPath();
  c.moveTo(X0, Y0 + TK.h);
  for (let x = X0; x <= X0 + TK.w; x += 10) c.lineTo(x, Y0 + TK.h - 16 + Math.sin(x * 0.045 + 2) * 5);
  c.lineTo(X0 + TK.w, Y0 + TK.h);
  c.closePath();
  c.fill();
  // marca de agua: rosa náutica muy suave en el cuerpo
  c.save();
  c.translate(-40, 70);
  c.strokeStyle = rgba(PAL.navy500, 0.07);
  c.lineWidth = 3;
  for (const r of [70, 120, 170]) { c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    c.beginPath(); c.moveTo(Math.cos(a) * 40, Math.sin(a) * 40); c.lineTo(Math.cos(a) * 190, Math.sin(a) * 190); c.stroke();
  }
  c.restore();
  c.restore();
  // título de la franja con el pin de marca
  drawPin(c, X0 + 66, Y0 + 88, 66, { gloss: 0.6 });
  label(c, 'TARJETA DE EMBARQUE', X0 + 112, Y0 + 66, { font: fontStr(800, 42), color: '#FFFFFF', tracking: 42 * 0.09 });
  // barquito y trazo punteado en la franja (lado derecho del cuerpo)
  c.save();
  c.setLineDash([2, 12]);
  c.lineCap = 'round';
  c.strokeStyle = rgba(PAL.aqua200, 0.7);
  c.lineWidth = 5;
  c.beginPath(); c.moveTo(78, Y0 + 62); c.quadraticCurveTo(150, Y0 + 30, 226, Y0 + 58); c.stroke();
  c.setLineDash([]);
  c.restore();
  smallShip(c, 262, Y0 + 58, 0.9, '#FFFFFF');
  // talón: pin grande en círculo y código de barras
  const sx = (TK.perf + X0 + TK.w) / 2;
  c.fillStyle = PAL.aqua100;
  c.beginPath(); c.arc(sx, Y0 + 52, 34, 0, TAU); c.fill();
  drawPin(c, sx, Y0 + 80, 52, {});
  const bx0 = TK.perf + 46, bx1 = X0 + TK.w - 42, by0 = Y0 + TK.band + 52, by1 = Y0 + TK.h - 64;
  const r = rng(355);
  let x = bx0;
  c.fillStyle = PAL.navy900;
  while (x < bx1) {
    const w = 3 + Math.floor(r() * 4) * 3;
    if (x + w > bx1) break;
    c.fillRect(x, by0, w, by1 - by0);
    x += w + 4 + Math.floor(r() * 3) * 3;
  }
  // los dígitos chicos bajo el código son trazos, no números (sin datos inventados)
  c.fillStyle = rgba(PAL.navy900, 0.55);
  for (let i = 0; i < 14; i++) c.fillRect(bx0 + i * ((bx1 - bx0) / 14) + 2, by1 + 12, (bx1 - bx0) / 14 - 8, 6);
  // sello holográfico redondo
  const hx = 238, hy = Y0 + TK.band + 70;
  const hg = c.createLinearGradient(hx - 40, hy - 40, hx + 40, hy + 40);
  hg.addColorStop(0, PAL.aqua200); hg.addColorStop(0.35, PAL.goldPale); hg.addColorStop(0.6, PAL.peach); hg.addColorStop(1, PAL.aqua300);
  c.fillStyle = hg;
  c.beginPath(); c.arc(hx, hy, 38, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.8)';
  c.lineWidth = 3;
  c.beginPath(); c.arc(hx, hy, 28, 0, TAU); c.stroke();
  smallShip(c, hx + 2, hy + 4, 0.5, rgba(PAL.navy700, 0.7));
  // troquel: agujeritos
  c.fillStyle = rgba(PAL.navy900, 0.28);
  for (let y = Y0 + TK.notch + 14; y < Y0 + TK.h - TK.notch - 8; y += 15) {
    c.beginPath(); c.arc(TK.perf, y, 3.2, 0, TAU); c.fill();
  }
  // grano de papel
  texture(c, paper, { alpha: 0.09, blend: 'multiply' });
  gloss(c, paper, X0, Y0, X0 + TK.w, Y0 + TK.h, { alpha: 0.18, width: 0.1, at: 0.22 });
}

export function initTicket() {
  if (BODY) return;
  TEAR = tearLine();
  const full = sprite(TK.w + 20, TK.h + 20, TK.w / 2 + 10, TK.h / 2 + 10, 1, paintTicket);
  const cut = (left) => {
    const p = new Path2D();
    const ext = left ? X0 - 20 : X0 + TK.w + 20;
    p.moveTo(ext, Y0 - 20);
    p.lineTo(TEAR[0][0], Y0 - 20);
    for (const [x, y] of TEAR) p.lineTo(x, y);
    p.lineTo(TEAR[TEAR.length - 1][0], Y0 + TK.h + 20);
    p.lineTo(ext, Y0 + TK.h + 20);
    p.closePath();
    return p;
  };
  BODY = sprite(TK.w + 20, TK.h + 20, TK.w / 2 + 10, TK.h / 2 + 10, 1, (c) => { c.clip(cut(true)); drawSprite(c, full); });
  STUB = sprite(TK.w + 20, TK.h + 20, TK.w / 2 + 10, TK.h / 2 + 10, 1, (c) => { c.clip(cut(false)); drawSprite(c, full); });
  BODY_SH = shadowOf(BODY, { blur: 16 });
  STUB_SH = shadowOf(STUB, { blur: 16 });
}

/** Odómetro: «USD» + 3 dígitos que ruedan hasta value (continuo). Caja centrada en (x, y). */
export function drawOdometer(c, x, y, value, { size = 118, blur = 0 } = {}) {
  const font = fontStr(900, size);
  c.save();
  c.font = font;
  const dw = c.measureText('0').width * 0.98;
  c.font = fontStr(800, size * 0.42);
  const uw = c.measureText('USD').width;
  const total = uw + 18 + dw * 3;
  const x0 = x - total / 2;
  label(c, 'USD', x0, y + size * 0.36 - size * 0.38, { font: fontStr(800, size * 0.42), color: PAL.navy500, tracking: size * 0.02 });
  const lh = size * 1.02;
  c.beginPath();
  c.rect(x0 + uw + 10, y - size * 0.52, dw * 3 + 16, size * 1.04);
  c.clip();
  c.font = font;
  c.fillStyle = INKN;
  c.textBaseline = 'alphabetic';
  for (let k = 0; k < 3; k++) {
    const pw = Math.pow(10, 2 - k);
    const r = value / pw;
    const lower = value % pw;
    // estilo odómetro: la columna gira sólo cuando la de abajo pasa de 9 a 0
    const frac = k === 2 ? r - Math.floor(r) : clamp(lower - (pw - 1));
    const d = Math.floor(r) % 10;
    const dx = x0 + uw + 18 + k * dw;
    const off = frac * lh;
    for (let j = 0; j < 2; j++) {
      const dig = (d + j) % 10;
      const yy = y + size * 0.36 - off + j * lh;
      c.globalAlpha = 1;
      c.fillText(String(dig), dx, yy);
      if (blur > 0.05 && k === 2) {
        c.globalAlpha = 0.25 * blur;
        c.fillText(String(dig), dx, yy - lh * 0.18);
        c.fillText(String(dig), dx, yy + lh * 0.18);
      }
    }
  }
  c.restore();
}

/** Campo de la tarjeta: rótulo chico + valor grande, con tipeo (p 0..1). */
function field(c, x, y, lab, val, p, valSize = 56) {
  if (p <= 0) return;
  const pl = clamp(p / 0.45), pv = clamp((p - 0.25) / 0.75);
  c.save();
  c.beginPath(); c.rect(x - 4, y - 60, 1000 * E.outCubic(pl), 40); c.clip();
  label(c, lab, x, y - 30, { font: fontStr(700, 27), color: PAL.navy500, tracking: 27 * 0.12 });
  c.restore();
  const chars = [...val];
  const n = Math.ceil(chars.length * pv);
  if (n > 0) {
    const s = chars.slice(0, n).join('');
    // micro-pop de la última letra
    label(c, s, x + 3, y + valSize * 0.8 + 4, { font: fontStr(900, valSize), color: rgba(PAL.navy900, 0.12), tracking: -valSize * 0.005 });
    label(c, s, x, y + valSize * 0.8, { font: fontStr(900, valSize), color: INKN, tracking: -valSize * 0.005 });
  }
}

/**
 * Dibuja la tarjeta en coords locales. o = {
 *   fields: [p1, p2, p3] (progreso de tipeo), odo: valor del contador (o null), odoBlur, odoA,
 *   tear: { a (ángulo del talón antes de soltarse), gone: { x, y, r, s } | null }, stamp: fn(c) (dibuja el sello encima),
 *   shadow: alfa de la sombra, lift (px de despegue para la sombra), sweep: 0..1 }
 */
export function drawTicket(c, o = {}) {
  initTicket();
  const lift = o.lift ?? 0;
  const sa = o.shadow ?? 1;
  const tear = o.tear ?? {};
  // sombra del cuerpo
  c.save();
  c.globalAlpha *= 0.34 * sa;
  c.translate(18 + lift * 0.4, 24 + lift * 0.55);
  drawSprite(c, BODY_SH);
  if (!tear.gone) drawSprite(c, STUB_SH);
  c.restore();
  // talón (todavía pegado: se dobla desde la muesca inferior)
  const drawStub = (cc) => {
    if (tear.gone) return;
    cc.save();
    if (tear.a) {
      cc.translate(TK.perf, Y0 + TK.h);
      cc.rotate(tear.a);
      cc.translate(-TK.perf, -(Y0 + TK.h));
    }
    drawSprite(cc, STUB);
    cc.restore();
  };
  drawSprite(c, BODY);
  drawStub(c);
  // campos
  const f = o.fields ?? [1, 1, 1];
  field(c, X0 + 52, -92, 'PASAJERO/A:', 'VOS', f[0]);
  field(c, X0 + 330, -92, 'SALIDA:', 'BUENOS AIRES', f[1]);
  field(c, X0 + 52, 58, 'EMBARQUE:', '¡YA!', f[2], 64);
  // ventana del precio (marco punteado)
  const [px, py] = PRICE;
  if (o.odo !== undefined && o.odo !== null && (o.odoA ?? 1) > 0.01) {
    c.save();
    c.globalAlpha *= o.odoA ?? 1;
    if (o.odoK && o.odoK !== 1) { c.translate(px, py); c.scale(o.odoK, o.odoK); c.translate(-px, -py); }
    c.fillStyle = rgba(PAL.goldPale, 0.7);
    c.beginPath(); rr(c, px - 250, py - 70, 500, 150, 22); c.fill();
    c.setLineDash([10, 8]);
    c.strokeStyle = rgba(PAL.gold, 0.9);
    c.lineWidth = 3;
    c.stroke();
    c.setLineDash([]);
    drawOdometer(c, px, py, o.odo, { size: 112, blur: o.odoBlur ?? 0 });
    c.restore();
  }
  if (o.stamp) o.stamp(c, px - 6, py + 2);
  if (o.sweep > 0 && o.sweep < 1) {
    const p = o.sweep;
    c.save();
    c.beginPath(); c.rect(X0, Y0, tear.gone ? TK.perf - X0 : TK.w, TK.h); c.clip();
    c.globalCompositeOperation = 'screen';
    const bx = X0 - 300 + (TK.w + 600) * p;
    const g = c.createLinearGradient(bx - 160, 0, bx + 160, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,240,200,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.transform(1, 0, -0.45, 1, 0, 0);
    c.fillRect(X0 - 400, Y0, TK.w + 1200, TK.h);
    c.restore();
  }
  return { X0, Y0 };
}

/** El talón suelto volando (coords locales de la tarjeta). */
export function drawLooseStub(c, { x, y, r, s, smear = 0 }) {
  initTicket();
  const cx = (TK.perf + X0 + TK.w) / 2, cy = 0;
  const one = (dx, dy, a) => {
    c.save();
    c.globalAlpha *= a;
    c.translate(cx + x + dx, cy + y + dy);
    c.rotate(r);
    c.scale(s, s);
    c.translate(-cx, -cy);
    drawSprite(c, STUB);
    c.restore();
  };
  c.save();
  c.globalAlpha *= 0.3;
  c.translate(30, 40);
  c.translate(cx + x, cy + y);
  c.rotate(r);
  c.scale(s, s);
  c.translate(-cx, -cy);
  drawSprite(c, STUB_SH);
  c.restore();
  if (smear > 2) for (let k = 2; k >= 1; k--) one(-smear * k * 0.3, smear * k * 0.36, 0.14);
  one(0, 0, 1);
}

export const TEAR_TOP = () => [TK.perf, Y0];
