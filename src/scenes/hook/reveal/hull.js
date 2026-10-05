// El casco de cerca (final del disparo): chapas con juntas biseladas y remaches, un brillo cálido del sol que
// resbala por el metal, el reflejo del mar que baila (cáusticas suaves, más fuertes abajo) y un brillo que cruza
// el vidrio del ojo de buey al aterrizar. Coordenadas LOCALES del barco: todo escala con el zoom y no se despega.
import { PAL, rgba } from '../../../engine/color.js';
import { clamp, prog, smoothstep, TAU } from '../../../engine/ease.js';
import { rad as radG, sparkle } from '../../../engine/draw.js';
import { hash, noise1 } from '../../../engine/noise.js';
import { shipBob, shipPorthole, SHIP, drawPorthole } from '../../../art/index.js';
import { W, H } from '../../../engine/time.js';
import { R, PRESET } from './time.js';

const HERO = SHIP.portholes[SHIP.hero];
const PITCH = 13; // separación de los ojos de buey (unidades locales)

function toLocal(ctx, o, t) {
  ctx.translate(o.x, o.y);
  ctx.scale(o.scale * (o.dir ?? 1), o.scale);
  const b = shipBob(t, o.bob ?? 1);
  ctx.translate(0, b.heave);
  ctx.rotate(b.pitch);
}

/** Rectángulo local visible (con margen) para no dibujar de más. */
function view(o, pad) {
  const s = o.scale;
  return { x0: -o.x / s - pad, x1: (W - o.x) / s + pad, y0: -o.y / s - pad, y1: (H - o.y) / s + pad };
}

/** Juntas de chapa biseladas (sombra arriba, filo abajo) y remaches con brillo. */
function plates(ctx, o, amt, v) {
  const ys = [-34.2, -19.6];
  const xs = [];
  for (let x = HERO.x - PITCH * 6 + PITCH / 2; x < HERO.x + PITCH * 6; x += PITCH) if (x > v.x0 && x < v.x1) xs.push(x);
  ctx.save();
  ctx.lineCap = 'butt';
  for (const y of ys) {
    if (y < v.y0 || y > v.y1) continue;
    ctx.fillStyle = rgba(PAL.ink, 0.38 * amt);
    ctx.fillRect(v.x0, y - 0.07, v.x1 - v.x0, 0.12);
    ctx.fillStyle = rgba(PAL.aqua200, 0.14 * amt);
    ctx.fillRect(v.x0, y + 0.05, v.x1 - v.x0, 0.06);
  }
  for (const x of xs) {
    ctx.fillStyle = rgba(PAL.ink, 0.32 * amt);
    ctx.fillRect(x - 0.06, ys[0], 0.1, ys[1] - ys[0]);
    ctx.fillStyle = rgba(PAL.aqua200, 0.1 * amt);
    ctx.fillRect(x + 0.05, ys[0], 0.05, ys[1] - ys[0]);
  }
  // remaches a lo largo de las juntas (tres tonos, un path por tono)
  const pts = [];
  for (const y of ys) {
    if (y < v.y0 - 1 || y > v.y1 + 1) continue;
    for (let x = Math.ceil(v.x0 / 0.75) * 0.75; x < v.x1; x += 0.75) pts.push([x, y - 0.42]);
  }
  for (const x of xs) for (let y = ys[0] + 0.7; y < ys[1] - 0.4; y += 0.75) pts.push([x - 0.42, y]);
  for (const [dx, dy, r, col, a] of [[0.03, 0.04, 0.11, PAL.ink, 0.45], [0, 0, 0.1, '#3B5778', 1], [0.03, -0.035, 0.04, PAL.aqua100, 0.55]]) {
    ctx.fillStyle = rgba(col, a * amt);
    ctx.beginPath();
    for (const [x, y] of pts) { ctx.moveTo(x + dx + r, y + dy); ctx.arc(x + dx, y + dy, r, 0, TAU); }
    ctx.fill();
  }
  ctx.restore();
}

/** Brillo cálido que resbala por el casco (el sol arriba a la derecha) y sombra abajo a la izquierda. */
function sheen(ctx, t, amt, v) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const cx = HERO.x + 5 + 1.5 * Math.sin(t * 0.8), cy = HERO.y - 6;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
  g.addColorStop(0, rgba(PAL.goldPale, 0.12 * amt));
  g.addColorStop(0.5, rgba(PAL.aqua200, 0.05 * amt));
  g.addColorStop(1, rgba(PAL.aqua200, 0));
  ctx.fillStyle = g;
  ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  ctx.globalCompositeOperation = 'multiply';
  const d = ctx.createLinearGradient(HERO.x - 10, HERO.y + 6, HERO.x + 4, HERO.y - 6);
  d.addColorStop(0, rgba('#5E7390', amt));
  d.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = d;
  ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  ctx.restore();
}

/**
 * Reflejo del mar en el casco: trazos de luz ondulados y afinados que tiemblan y derivan (como los filos de
 * brillo del mar del kit), más densos y fuertes cerca del agua. Un solo path por tanda (barato).
 */
function reflections(ctx, t, amt, v) {
  const y1 = Math.min(-1, v.y1);
  if (y1 < v.y0) return;
  ctx.save();
  // recortado fuera de todos los ojos de buey a la vista (evenodd)
  ctx.beginPath();
  ctx.rect(v.x0, v.y0, v.x1 - v.x0, y1 - v.y0);
  for (let q = -6; q <= 6; q++) {
    const px = HERO.x + q * PITCH;
    if (px < v.x0 - 6 || px > v.x1 + 6) continue;
    ctx.moveTo(px + HERO.r * 1.34, HERO.y);
    ctx.arc(px, HERO.y, HERO.r * 1.34, 0, TAU);
  }
  ctx.clip('evenodd');
  ctx.globalCompositeOperation = 'screen';
  const rowH = 1.3;
  const j0 = Math.floor(v.y0 / rowH), j1 = Math.ceil(y1 / rowH);
  const n = 14;
  for (const tone of [0, 1]) {
    ctx.fillStyle = rgba(tone ? PAL.goldPale : PAL.aqua100, amt * (tone ? 0.07 : 0.1));
    ctx.beginPath();
    for (let j = j0; j <= j1; j++) {
      const y = j * rowH;
      const fall = Math.pow(clamp(1 + y / 40), 1.4);
      const drift = t * (1.1 + hash(j, 3) * 0.9) * (j % 2 ? 1 : -1);
      const iA = Math.floor((v.x0 - HERO.x + 14 - 8) / 4.2), iB = Math.ceil((v.x1 - HERO.x + 14) / 4.2);
      for (let i = iA; i <= iB; i++) {
        if (hash(j, i, 4 + tone) > 0.2 + 0.6 * fall) continue;
        const len = 1.8 + hash(j, i, 6) * 4.5;
        const x0 = HERO.x - 14 + i * 4.2 + hash(j, i, 7) * 3 + (drift % 4.2);
        if (x0 > v.x1 || x0 + len < v.x0) continue;
        const th = (0.04 + 0.09 * hash(j, i, 8)) * (0.5 + 0.5 * fall);
        const yy = y + 0.3 * noise1(t * 1.6 + i * 1.7 + j, 11);
        const ph = hash(j, i, 9) * TAU + t * 3.2;
        // trazo en lente (afinado en las puntas) que ondula suave
        for (let k = 0; k <= n; k++) {
          const u = k / n;
          const w = Math.sin(Math.PI * u) * th;
          const yw = yy + 0.13 * Math.sin(u * 4 + ph);
          k ? ctx.lineTo(x0 + len * u, yw - w) : ctx.moveTo(x0 + len * u, yw - w);
        }
        for (let k = n; k >= 0; k--) {
          const u = k / n;
          ctx.lineTo(x0 + len * u, yy + 0.13 * Math.sin(u * 4 + ph) + Math.sin(Math.PI * u) * th);
        }
        ctx.closePath();
      }
    }
    ctx.fill();
  }
  ctx.restore();
}

/** Lo que va encima del casco ya de cerca. k = progreso del disparo. */
export function drawHullFx(ctx, t, o, k) {
  // aparece cuando el casco ya llena el cuadro (antes sería un mar de trazos invisibles y caros)
  const amt = clamp((o.scale - 26) / 26);
  if (amt <= 0) return;
  ctx.save();
  toLocal(ctx, o, t);
  const v = view(o, 1);
  sheen(ctx, t, amt, v);
  plates(ctx, o, amt, v);
  reflections(ctx, t, amt, v);
  ctx.restore();
  // brillo que cruza el vidrio al aterrizar (mismo dibujo que el ojo de buey del casco)
  const sw = prog(t, R.land - 0.16, R.land + 0.12);
  if (sw > 0 && sw < 1 && k > 0.85) {
    const e = shipPorthole(o, SHIP.hero, t);
    drawPorthole(ctx, t, e.x, e.y, e.r, { preset: PRESET, sweep: sw, shadow: 0 });
  }
}

/**
 * Luz de entrada (últimos 3 cuadros antes de 5,625): al llegar, el vidrio del ojo de buey se enciende con el sol
 * del otro lado: un núcleo blanco que nace en el vidrio y se derrama sobre el casco, con un destello en el brillo
 * diagonal. Sube a la par del flash del corte de pool y se corta en 5,625: lleva el brillo del casco al nivel del
 * iris, sin salto de luz. e = { x, y, r } del ojo de buey en pantalla.
 */
export function drawEntryGlow(ctx, t, e) {
  if (t >= R.land) return;
  const g = smoothstep(R.land - 0.075, R.land - 0.008, t);
  if (g <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // halo amplio y frío (todo el casco recibe un poco de luz)
  ctx.fillStyle = radG(ctx, e.x, e.y, 1300, [[0, rgba(PAL.aqua100, 0.24 * g)], [0.55, rgba(PAL.aqua200, 0.09 * g)], [1, rgba(PAL.aqua200, 0)]]);
  ctx.fillRect(0, 0, W, H);
  // núcleo: el vidrio se enciende y la luz se abre desde él
  const rb = Math.max(420, e.r * 3.4);
  ctx.fillStyle = radG(ctx, e.x, e.y, rb, [[0, rgba(PAL.white, 0.62 * g)], [Math.min(0.5, (e.r * 1.1) / rb), rgba(PAL.white, 0.5 * g)], [0.58, rgba(PAL.aqua100, 0.3 * g)], [1, rgba(PAL.aqua100, 0)]]);
  ctx.fillRect(e.x - rb, e.y - rb, 2 * rb, 2 * rb);
  ctx.restore();
  // destello en el brillo diagonal del vidrio
  sparkle(ctx, e.x - e.r * 0.4, e.y - e.r * 0.42, (30 + 0.45 * e.r) * g, { alpha: 0.85 * g, rot: 0.3 });
}
