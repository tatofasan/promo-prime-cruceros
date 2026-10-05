// VALIJA rígida vintage: casco coral laqueado con volumen (frente + tapa + lateral), correas navy con
// hebillas de bronce, esquineros, cerraduras, manija y etiqueta colgante (esta va aparte: se balancea).
// Origen local = centro del borde INFERIOR del frente (punto de apoyo: ahí se aplica el squash).
import { PAL, shade, mixHex, rgba } from '../../engine/color.js';
import { rrectPath, polyPath, circlePath, texture, bake } from '../../engine/draw.js';
import { drawPin } from '../../brand/pin.js';
import { shade3, gloss } from './shade3.js';
import { tones, sprite, drawSprite, shadowOf } from './util.js';

export const SC = { w: 620, h: 460, r: 40, dx: 30, dy: -62 };
const BODY = tones(PAL.coral, -0.2, 0.26);
const LID = tones(shade(PAL.coral, 0.16), -0.1, 0.18);
const SIDE = shade(PAL.coral, -0.36);
const STRAP = tones(PAL.navy600, -0.32, 0.22);
const BRASS = tones(PAL.gold, -0.24, 0.5);
const METAL = tones(mixHex(PAL.goldLight, '#D9E2EA', 0.45), -0.3, 0.32);
const STRAP_X = [-160, 160];
const STRAP_W = 54;

let SPR = null;
let SHADOW = null;

function frontPath() {
  const { w, h, r } = SC;
  return rrectPath(-w / 2, -h, w, h, r);
}

/** Tapa superior (paralelogramo entre el borde de arriba del frente y el de atrás). */
function lidClip(c) {
  const { w, h, dx, dy } = SC;
  c.beginPath();
  c.moveTo(-w / 2 - 80, -h + 1);
  c.lineTo(w / 2, -h + 1);
  c.lineTo(w / 2 + dx, -h + dy);
  c.lineTo(w / 2 + dx, -h + dy - 90);
  c.lineTo(-w / 2 - 80, -h + dy - 90);
  c.closePath();
}

function paintBody(c) {
  const { w, h, r, dx, dy } = SC;
  const front = frontPath();
  // volumen: la silueta del frente repetida hacia atrás (lateral derecho en sombra)
  for (let k = 22; k >= 1; k--) {
    c.save();
    c.translate((dx * k) / 22, (dy * k) / 22);
    c.fillStyle = SIDE;
    c.fill(front);
    c.restore();
  }
  // tapa superior iluminada: la misma extrusión recortada arriba del borde del frente, en 3 tonos
  c.save();
  lidClip(c);
  c.clip();
  for (let k = 22; k >= 0; k--) {
    c.save();
    c.translate((dx * k) / 22, (dy * k) / 22);
    c.fillStyle = LID.base;
    c.fill(front);
    c.restore();
  }
  // caída de luz: más clara al fondo (de donde viene la luz), sombra suave contra el frente
  const lg = c.createLinearGradient(0, -h + dy, 0, -h);
  lg.addColorStop(0, rgba(LID.light, 0.9));
  lg.addColorStop(0.55, rgba(LID.light, 0));
  lg.addColorStop(1, rgba(LID.dark, 0.5));
  c.fillStyle = lg;
  // solo sobre lo ya pintado (la extrusión): no se sale de la silueta
  c.globalCompositeOperation = 'source-atop';
  c.fillRect(-w / 2 - 80, -h + dy - 90, w + dx + 160, -dy + 92);
  c.globalCompositeOperation = 'source-over';
  texture(c, polyPath([[-w / 2 + r * 0.5, -h], [w / 2, -h], [w / 2 + dx, -h + dy], [-w / 2 + r * 0.5 + dx, -h + dy]]), { alpha: 0.08, blend: 'overlay' });
  c.restore();
  // filo de luz en los bordes de arriba (borde trasero de la tapa y canto delantero)
  c.save();
  c.lineCap = 'round';
  c.strokeStyle = rgba('#FFFFFF', 0.75);
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(-w / 2 + r + dx * 0.8, -h + dy + 1.5);
  c.lineTo(w / 2 - r * 0.4 + dx, -h + dy + 1.5);
  c.stroke();
  c.strokeStyle = rgba(PAL.goldPale, 0.85);
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-w / 2 + r, -h - 1);
  c.lineTo(w / 2 - r, -h - 1);
  c.stroke();
  // vivo (ribete) del lateral
  c.strokeStyle = rgba(PAL.goldPale, 0.45);
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(w / 2 + dx * 0.5, -h + dy * 0.5 + r);
  c.lineTo(w / 2 + dx * 0.5, dy * 0.5 - r * 0.6);
  c.stroke();
  c.restore();

  // luz rebotada fría (del fondo cian) en el canto derecho del lateral
  c.save();
  c.strokeStyle = rgba(PAL.aqua200, 0.55);
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(w / 2 + dx - 2, -h + dy + r + 6);
  c.lineTo(w / 2 + dx - 2, dy - r + 4);
  c.stroke();
  c.restore();
  // frente en 3 tonos + grano
  shade3(c, front, BODY, { sh: 18, rim: 4, grain: 0.08 });
  // panel embutido (relieve): ranura oscura + filo claro
  const inset = rrectPath(-w / 2 + 34, -h + 34, w - 68, h - 68, r - 14);
  c.save();
  c.lineWidth = 5;
  c.strokeStyle = shade(PAL.coral, -0.16);
  c.translate(1.5, 1.5);
  c.stroke(inset);
  c.translate(-3, -3);
  c.strokeStyle = shade(PAL.coral, 0.22);
  c.lineWidth = 2.5;
  c.stroke(inset);
  c.restore();
  // costillas horizontales sutiles (casco de época)
  c.save();
  c.clip(front);
  for (let i = 0; i < 5; i++) {
    const y = -h + 86 + i * 64;
    c.fillStyle = rgba('#04101F', 0.07);
    c.fillRect(-w / 2 + 40, y + 3, w - 80, 7);
    c.fillStyle = rgba('#FFFFFF', 0.1);
    c.fillRect(-w / 2 + 40, y, w - 80, 3);
  }
  // sombra de contacto de la tapa sobre el frente (el canto superior hace alero)
  const eg = c.createLinearGradient(0, -h, 0, -h + 26);
  eg.addColorStop(0, rgba(shade(PAL.coral, -0.45), 0.4));
  eg.addColorStop(1, rgba(shade(PAL.coral, -0.45), 0));
  c.fillStyle = eg;
  c.fillRect(-w / 2, -h, w, 26);
  c.restore();
  // brillo laqueado diagonal
  gloss(c, front, -w / 2, -h, w / 2, 0, { alpha: 0.2, width: 0.12, at: 0.24 });
  gloss(c, front, -w / 2, -h, w / 2, 0, { alpha: 0.09, width: 0.05, at: 0.36 });

  // correas sobre la tapa y el frente
  for (const x of STRAP_X) strap(c, x);

  // esquineros de metal (con brillo especular)
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) corner(c, sx, sy);

  // cerraduras de bronce en el borde superior
  for (const x of [-62, 62]) latch(c, x, -h + 22);
}

/** Centros de los esquineros (coords locales) para los destellos animados. */
export const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => [sx * (SC.w / 2 - 26), sy < 0 ? -SC.h + 26 : -26]);

function corner(c, sx, sy) {
  const { w, h } = SC;
  const L = 82;
  const x0 = sx < 0 ? -w / 2 : w / 2, y0 = sy < 0 ? -h : 0;
  const ix = x0 - sx * L, iy = y0 - sy * L;
  // pieza de metal que abraza la esquina (se recorta al frente para respetar el radio)
  const full = new Path2D();
  full.moveTo(ix, y0 + sy * 3);
  full.lineTo(x0 + sx * 3, y0 + sy * 3);
  full.lineTo(x0 + sx * 3, iy);
  full.quadraticCurveTo(ix, iy, ix, y0 + sy * 3);
  full.closePath();
  c.save();
  c.clip(frontPath());
  // sombra plana que el esquinero proyecta sobre el casco
  c.save();
  c.translate(5, 6);
  c.fillStyle = rgba(shade(PAL.coral, -0.5), 0.45);
  c.fill(full);
  c.restore();
  shade3(c, full, METAL, { sh: 8, rim: 3 });
  // brillo especular: banda curva clara + punto de luz
  c.save();
  c.clip(full);
  c.strokeStyle = rgba('#FFFFFF', 0.85);
  c.lineWidth = 5;
  c.lineCap = 'round';
  const k = 0.55;
  c.beginPath();
  c.moveTo(x0 - sx * 10, y0 - sy * L * k);
  c.quadraticCurveTo(x0 - sx * L * k, y0 - sy * L * k, x0 - sx * L * k, y0 - sy * 10);
  c.stroke();
  c.restore();
  c.restore();
  // remaches
  for (const [ax, ay] of [[x0 - sx * 17, y0 - sy * 50], [x0 - sx * 50, y0 - sy * 17]]) rivet(c, ax, ay, 6);
}

function rivet(c, x, y, r) {
  c.fillStyle = BRASS.dark;
  c.beginPath(); c.arc(x + 1, y + 1.5, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = BRASS.base;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = BRASS.light;
  c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.42, 0, Math.PI * 2); c.fill();
}

function strap(c, x) {
  const { h, dx, dy } = SC;
  const sw = STRAP_W;
  // tramo sobre la tapa superior (paralelogramo)
  const top = polyPath([[x - sw / 2, -h + 1], [x + sw / 2, -h + 1], [x + sw / 2 + dx, -h + dy], [x - sw / 2 + dx, -h + dy]]);
  c.fillStyle = STRAP.light;
  c.fill(top);
  // sombra plana dura que proyecta la correa sobre el casco y sobre la tapa (luz de arriba a la izquierda)
  c.save();
  c.clip(frontPath());
  c.fillStyle = rgba(shade(PAL.coral, -0.45), 0.6);
  c.fillRect(x + sw / 2, -h, 13, h);
  c.restore();
  c.fillStyle = rgba(shade(PAL.coral, -0.4), 0.5);
  c.fill(polyPath([[x + sw / 2, -h + 1], [x + sw / 2 + 13, -h + 1], [x + sw / 2 + 13 + dx, -h + dy], [x + sw / 2 + dx, -h + dy]]));
  // frente de la correa
  const fr = rrectPath(x - sw / 2, -h - 2, sw, h + 6, 6);
  shade3(c, fr, STRAP, { sh: 8, rim: 3, grain: 0.12 });
  // costuras
  c.save();
  c.setLineDash([9, 7]);
  c.strokeStyle = rgba(PAL.goldPale, 0.5);
  c.lineWidth = 2;
  for (const ox of [-sw / 2 + 7, sw / 2 - 7]) {
    c.beginPath(); c.moveTo(x + ox, -h + 4); c.lineTo(x + ox, -6); c.stroke();
  }
  c.setLineDash([]);
  c.restore();
  // pasador (presilla) y hebilla
  const by = -h + 150;
  const keeper = rrectPath(x - sw / 2 - 5, by + 52, sw + 10, 20, 5);
  shade3(c, keeper, STRAP, { sh: 5, rim: 2 });
  buckle(c, x, by);
  // agujeros de la correa
  for (let i = 0; i < 3; i++) {
    const hy = by + 96 + i * 30;
    c.fillStyle = shade(PAL.navy600, -0.55);
    c.beginPath(); c.ellipse(x, hy, 5, 4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = rgba('#ffffff', 0.18);
    c.beginPath(); c.ellipse(x + 1, hy + 2.5, 4, 1.5, 0, 0, Math.PI * 2); c.fill();
  }
}

function buckle(c, x, y) {
  const bw = 78, bh = 62;
  const outer = rrectPath(x - bw / 2, y, bw, bh, 12);
  const inner = rrectPath(x - bw / 2 + 12, y + 12, bw - 24, bh - 24, 5);
  // sombra proyectada
  c.save();
  c.translate(5, 6);
  c.fillStyle = rgba('#04101F', 0.28);
  c.fill(outer);
  c.restore();
  c.save();
  // aro de bronce (evenodd)
  c.beginPath();
  rrSub(c, x - bw / 2, y, bw, bh, 12);
  rrSub(c, x - bw / 2 + 12, y + 12, bw - 24, bh - 24, 5);
  c.clip('evenodd');
  shade3(c, outer, BRASS, { sh: 5, rim: 2.5 });
  c.restore();
  // la correa pasa por adentro: tramo más oscuro visible
  c.fillStyle = shade(PAL.navy600, -0.2);
  c.fill(inner);
  // lengüeta (púa)
  c.fillStyle = BRASS.dark;
  c.fillRect(x - 3, y + 10, 7, bh - 14);
  c.fillStyle = BRASS.light;
  c.fillRect(x - 3, y + 10, 3, bh - 14);
}

function rrSub(c, x, y, w, h, r) {
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function latch(c, x, y) {
  const p = rrectPath(x - 26, y - 12, 52, 34, 9);
  c.save(); c.translate(3, 4); c.fillStyle = rgba('#04101F', 0.25); c.fill(p); c.restore();
  shade3(c, p, BRASS, { sh: 5, rim: 2.5 });
  c.fillStyle = shade(PAL.gold, -0.55);
  c.beginPath(); c.arc(x, y + 3, 4.5, 0, Math.PI * 2); c.fill();
  c.fillRect(x - 1.8, y + 3, 3.6, 9);
}

/** Manija (se dibuja dentro del sprite, sobre la tapa). */
function paintHandle(c) {
  const { h, dx, dy } = SC;
  const cx = dx * 0.5, by = -h + dy * 0.5;
  // monturas de bronce
  for (const sx of [-1, 1]) {
    const m = rrectPath(cx + sx * 74 - 18, by - 10, 36, 18, 6);
    shade3(c, m, BRASS, { sh: 4, rim: 2 });
  }
  // arco de cuero (trazo grueso en 3 pasadas: sombra, base y filo)
  const arc = (o) => {
    c.beginPath();
    c.moveTo(cx - 74, by - 4 + o);
    c.bezierCurveTo(cx - 74, by - 92 + o, cx + 74, by - 92 + o, cx + 74, by - 4 + o);
  };
  c.lineCap = 'round';
  arc(4); c.strokeStyle = rgba('#04101F', 0.25); c.lineWidth = 24; c.stroke();
  arc(0); c.strokeStyle = STRAP.dark; c.lineWidth = 24; c.stroke();
  arc(-3); c.strokeStyle = STRAP.base; c.lineWidth = 17; c.stroke();
  arc(-7); c.strokeStyle = STRAP.light; c.lineWidth = 4; c.stroke();
}

export function initSuitcase() {
  if (SPR) return;
  SPR = sprite(760, 660, 350, 600, 1.25, (c) => {
    paintBody(c);
    paintHandle(c);
  });
  SHADOW = shadowOf(SPR, { blur: 14, color: '#04101F' });
}

/** Punto de anclaje de la etiqueta: argolla en la esquina de arriba del lateral (cuelga por el costado y no tapa
 *  los calcos del frente), en coords locales. */
export const TAG_PIVOT = [SC.w / 2 + SC.dx * 0.62, -SC.h + SC.dy * 0.62 + 34];

/** Etiqueta de equipaje colgante: navy con ojal de bronce y el pin de marca. ang en rad. */
export function drawTag(c, ang) {
  const [px, py] = TAG_PIVOT;
  c.save();
  c.translate(px, py);
  c.rotate(ang);
  // correa de la etiqueta
  c.strokeStyle = STRAP.dark;
  c.lineWidth = 7;
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(10, 30, 4, 58); c.stroke();
  c.strokeStyle = STRAP.base;
  c.lineWidth = 4;
  c.beginPath(); c.moveTo(-1, 0); c.quadraticCurveTo(9, 30, 3, 58); c.stroke();
  // cuerpo
  c.translate(4, 58);
  c.rotate(-0.05);
  const body = new Path2D();
  body.moveTo(-28, 14); body.lineTo(-14, 0); body.lineTo(14, 0); body.lineTo(28, 14);
  body.lineTo(28, 118); body.quadraticCurveTo(28, 128, 18, 128); body.lineTo(-18, 128);
  body.quadraticCurveTo(-28, 128, -28, 118); body.closePath();
  c.save(); c.translate(6, 8); c.fillStyle = rgba('#04101F', 0.3); c.fill(body); c.restore();
  shade3(c, body, tones(PAL.navy700, -0.35, 0.3), { sh: 6, rim: 2.5 });
  // ventanita blanca con el pin
  const win = rrectPath(-19, 34, 38, 80, 7);
  c.fillStyle = PAL.warmWhite;
  c.fill(win);
  drawPin(c, 0, 100, 52, {});
  // ojal
  rivet(c, 0, 14, 7);
  c.fillStyle = shade(PAL.navy700, -0.5);
  c.beginPath(); c.arc(0, 14, 3, 0, Math.PI * 2); c.fill();
  c.restore();
}

/**
 * Dibuja la valija con el apoyo en (0,0) del contexto actual.
 * o = { sx, sy (squash desde el apoyo), shadow (0..1, sombra de contacto), lift (px en el aire), tagAng, behind(c), front(c) }
 */
export function drawSuitcase(c, o = {}) {
  initSuitcase();
  const lift = o.lift ?? 0;
  // sombra de contacto en el piso (se achica y aclara cuando la valija sube)
  const k = 1 / (1 + lift / 160);
  c.save();
  c.globalAlpha *= (o.shadow ?? 1) * 0.5 * k;
  c.fillStyle = 'rgba(4,16,31,0.6)';
  c.beginPath();
  c.ellipse(SC.dx * 0.6 + 10, 6, (SC.w * 0.56) * (o.sx ?? 1) * (0.7 + 0.3 * k), 26 * k, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
  c.save();
  c.translate(0, -lift);
  c.scale(o.sx ?? 1, o.sy ?? 1);
  // sombra proyectada suave (hacia abajo a la derecha)
  c.save();
  c.globalAlpha *= 0.32 * (o.shadow ?? 1);
  c.translate(16, 18);
  drawSprite(c, SHADOW);
  c.restore();
  if (o.behind) o.behind(c);
  drawSprite(c, SPR);
  if (o.front) o.front(c);
  drawTag(c, o.tagAng ?? 0);
  c.restore();
}
