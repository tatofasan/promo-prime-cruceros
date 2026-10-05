// El pin de marca: cae DIRECTO en la posición y el tamaño finales de la «o» de cruceros, estirado por la
// velocidad y con un smear vertical en sus propios colores (sin copias). Aterriza en T_LAND (2 cuadros después
// de close.in, con la cresta de la ola ya pasada) con squash 1,25×0,8, rebota en el lugar y suelta un anillo de
// LUZ. Desde ahí no viaja más: las letras y la placa nacen de él. Todo función pura de t.
import { E, clamp, prog, TAU } from '../../engine/ease.js';
import { drawPin, PIN } from '../../brand/pin.js';
import { LOGO_COLORS } from '../../brand/logo.js';
import { PAL, rgba } from '../../engine/color.js';
import { sparkle, rad, lin } from '../../engine/draw.js';
import { hash } from '../../engine/noise.js';
import { T_LAND, T_WORD, T_FIN } from './layout.js';

const FALL = 0.2;              // s de caída (12 cuadros): entra en cuadro a mitad de camino y llega a ~73 px/cuadro
const T_FALL = T_LAND - FALL;
const Y0 = -70;                // punta al arrancar (el pin entero fuera de cuadro)
const SMEAR = 250;             // largo máximo del smear (px) a velocidad final
const EPS = 0.002;             // el cuadro del aterrizaje (26,28333…) ya es impacto aunque t llegue redondeado

// resorte de aplastamiento: 1 en el impacto, oscila y se apaga
const squashK = (dt, f = 3.4, d = 9) => (dt < 0 ? 0 : Math.exp(-dt * d) * Math.cos(dt * TAU * f));

/** Estado del pin en t: punta (x, y), alto, squash/stretch (pivote en la punta) y velocidad normalizada v. */
export function pinState(t, G) {
  const P = G.pin;
  if (t < T_FALL) return null;
  if (t < T_LAND - EPS) {
    const u = prog(t, T_FALL, T_LAND);
    return { x: P.x, y: Y0 + (P.y - Y0) * u * u, size: P.size, sx: 1 - 0.2 * u, sy: 1 + 0.3 * u, v: u };
  }
  const k = squashK(t - T_LAND);
  // golpe final: saltito corto con aplastamiento chico (no llega a tocar la «r» ni la «s»)
  const hd = t - T_FIN;
  const hop = hd > 0 && hd < 0.24 ? Math.sin((hd / 0.24) * Math.PI) : 0;
  const k2 = squashK(hd - 0.24, 3.6, 10);
  return {
    x: P.x, y: P.y - 12 * hop, size: P.size,
    sx: 1 + 0.25 * k + 0.06 * k2 - 0.04 * hop, sy: 1 - 0.2 * k - 0.07 * k2 + 0.06 * hop, v: 0,
  };
}

/**
 * Dibuja el pin (con smear direccional durante la caída). Va en la escena (debajo de la cresta, recortado por la
 * máscara de la ola). o.hideRightOf = x de PANTALLA de la cresta: mientras la cresta no pasó el borde derecho del
 * pin, no se dibuja (si no, la cabeza asoma por encima del lomo de la ola, en el cielo que la ola ya pasó).
 */
export function drawPinDrop(ctx, t, G, o = {}) {
  const s = pinState(t, G);
  if (!s) return;
  if (o.hideRightOf !== undefined) {
    const m = ctx.getTransform();
    const rx = G.pin.headX + G.pin.headR * 1.3; // borde derecho de la cabeza (con el ensanche del squash)
    const sx = m.a * rx + m.c * G.pin.headY + m.e;
    if (sx > o.hideRightOf) return;
  }
  if (t < T_LAND - EPS && s.v > 0.2) tail(ctx, s);
  paintPin(ctx, t, s, { shadow: true });
}

/**
 * Smear direccional de la caída en los colores del pin (no copias): la cabeza se estira hacia arriba en una
 * estela afinada, naranja del aro por fuera y cielo/blanco del interior por dentro, que se apaga hacia la cola.
 */
function tail(ctx, s) {
  const k = s.size / PIN.h;
  const R = PIN.headR * k * s.sx;
  const hx = s.x, hy = s.y - (PIN.tipY - PIN.headCy) * k * s.sy;
  const len = SMEAR * Math.pow(s.v, 1.3);
  const shape = (w0, w1, l) => {
    ctx.beginPath();
    ctx.moveTo(hx - w0, hy);
    ctx.bezierCurveTo(hx - w0, hy - l * 0.35, hx - w1, hy - l * 0.7, hx - w1 * 0.3, hy - l);
    ctx.lineTo(hx + w1 * 0.3, hy - l);
    ctx.bezierCurveTo(hx + w1, hy - l * 0.7, hx + w0, hy - l * 0.35, hx + w0, hy);
    ctx.closePath();
  };
  ctx.save();
  shape(R * 0.98, R * 0.42, len);
  ctx.fillStyle = lin(ctx, 0, hy, 0, hy - len, [[0, rgba(LOGO_COLORS.prime, 0.85)], [0.45, rgba(PAL.coral, 0.35)], [1, rgba(PAL.coral, 0)]]);
  ctx.fill();
  shape(R * 0.72, R * 0.26, len * 0.8);
  ctx.fillStyle = lin(ctx, 0, hy, 0, hy - len * 0.8, [[0, rgba(LOGO_COLORS.sky, 0.9)], [0.5, rgba(LOGO_COLORS.sky, 0.3)], [1, rgba(LOGO_COLORS.sky, 0)]]);
  ctx.fill();
  shape(R * 0.34, R * 0.1, len * 0.6);
  ctx.fillStyle = lin(ctx, 0, hy, 0, hy - len * 0.6, [[0, 'rgba(255,255,255,0.85)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fill();
  ctx.restore();
}

// silueta del pin (cabeza + tangentes a la punta) en el sistema de PIN, para proyectar UNA sola sombra
let silhouette = null;
function pinSilhouette() {
  if (silhouette) return silhouette;
  const { headCx: cx, headCy: cy, headR: R, tipX, tipY } = PIN;
  const a = Math.acos(R / (tipY - cy));
  const p = new Path2D();
  p.moveTo(tipX, tipY);
  p.arc(cx, cy, R, Math.PI / 2 + a, Math.PI / 2 - a + TAU, false);
  p.closePath();
  silhouette = p;
  return p;
}

function paintPin(ctx, t, s, o = {}) {
  const h = s.size;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(s.sx, s.sy);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.shadow) {
    // sombra corta y suave: el pin apoya en la placa como las letras (que son planas)
    const k = h / PIN.h;
    const air = t < T_LAND - EPS ? 1 : 0.45;
    ctx.save();
    ctx.shadowColor = `rgba(16,24,60,${(0.3 * air).toFixed(3)})`;
    ctx.shadowBlur = 14 * air + 6;
    ctx.shadowOffsetX = -3;
    ctx.shadowOffsetY = 4 + 6 * air;
    ctx.scale(k, k);
    ctx.translate(-PIN.tipX, -PIN.tipY);
    ctx.fillStyle = PAL.navy800;
    ctx.fill(pinSilhouette());
    ctx.restore();
  }
  // barrido de luz cuando la banda de close.word (y la de 29,06) pasa por la «o»
  const sw = Math.max(prog(t, T_WORD + 0.12, T_WORD + 0.3) * (t < T_WORD + 0.3 ? 1 : 0), prog(t, T_FIN + 1.06, T_FIN + 1.24) * (t < T_FIN + 1.24 ? 1 : 0));
  drawPin(ctx, 0, 0, h, {
    sky: LOGO_COLORS.sky, sea: LOGO_COLORS.sea, ring: LOGO_COLORS.prime,
    shipDx: Math.sin(t * 1.7) * 4, bob: Math.sin(t * 3.1) * 2.5,
    gloss: 0.75, sweep: sw > 0 && sw < 1 ? sw : 0,
  });
  ctx.restore();
}

/**
 * Anillo de LUZ del aterrizaje (va DEBAJO de las letras y encima de la placa): destello cálido, dos aros (dorado y
 * cian de marca) que se abren desde la cabeza del pin y chispas que saltan en abanico.
 */
export function drawLandingLight(ctx, t, G) {
  const dt = Math.max(0, t - T_LAND);
  if (t < T_LAND - EPS || dt > 0.5) return;
  const P = G.pin;
  const cx = P.headX, cy = P.headY, R = P.headR;
  // destello (sobre el cielo, antes de que llegue la placa)
  const f = Math.exp(-dt * 14);
  if (f > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const Rg = R * 3.4;
    ctx.fillStyle = rad(ctx, cx, cy, Rg, [[0, rgba('#FFF4D6', 0.9 * f)], [0.35, rgba(PAL.goldLight, 0.45 * f)], [1, rgba(PAL.gold, 0)]]);
    ctx.fillRect(cx - Rg, cy - Rg, Rg * 2, Rg * 2);
    ctx.restore();
  }
  for (let k = 0; k < 2; k++) {
    const d = dt - k * 0.045;
    if (d <= 0) continue;
    const p = E.outCubic(clamp(d / 0.3));
    if (p >= 1) continue;
    const r = R * (1.06 + (k ? 1.0 : 1.35) * p);
    ctx.save();
    ctx.globalAlpha = Math.pow(1 - p, 1.4) * (k ? 0.75 : 0.95);
    ctx.strokeStyle = k ? PAL.brandCyan : PAL.gold;
    ctx.lineWidth = (k ? 5 : 9) * (1 - p) + 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  for (let i = 0; i < 9; i++) {
    const a = TAU * (i / 9) + (hash(i, 61) - 0.5) * 0.5 - Math.PI / 2;
    const p = E.outCubic(clamp(dt / 0.42));
    const dist = R * (1.15 + (1.1 + 0.9 * hash(i, 62)) * p);
    const life = 1 - clamp((dt - 0.08 - hash(i, 63) * 0.12) / 0.3);
    if (life <= 0) continue;
    const sz = (9 + 10 * hash(i, 64)) * (0.4 + 0.6 * life);
    sparkle(ctx, cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, sz, { alpha: life, color: i % 3 ? PAL.goldLight : PAL.brandCyan, rot: dt * 4 + i });
  }
}

export const PIN_TIMES = { T_FALL, FALL };
