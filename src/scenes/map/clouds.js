// Nubes del mapa: velos de cúmulo translúcidos (alfa 0,35–0,5) teñidos hacia aqua100 con la panza en navy,
// bordes blandos y sombra proyectada sobre el mapa. Pocas y de tamaños variados, cada una vive en su rango
// de zoom (las de Buenos Aires solo de cerca, las de los bordes en la toma amplia). Van en un plano con
// parallax (se mueven 1 + p veces lo que el mapa) PERO siempre DEBAJO de pines, rótulos y postales.
// Regla de lectura: ninguna nube se desplaza más de ~38 px por cuadro; si la cámara la llevaría más rápido
// (paneos, látigo), se apaga antes. Todo función pura de t.
import { W, H } from '../../engine/time.js';
import { PAL, mixHex } from '../../engine/color.js';
import { makeCanvas } from '../../engine/env.js';
import { bake } from '../../engine/draw.js';
import { clamp, smoothstep, TAU } from '../../engine/ease.js';
import { rng } from '../../engine/noise.js';
import { T, camAt } from './mapcam.js';
import { PAD } from './soft.js';

const SW = 512, SH = 320;
let SPR = null;

function puffs(seed) {
  // racimo alargado de bollos (cúmulo visto desde arriba)
  const r = rng(seed);
  const out = [];
  const n = 6 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5;
    out.push([SW / 2 + u * 280 + (r() - 0.5) * 40, SH / 2 + (r() - 0.5) * 50 - Math.cos(u * Math.PI) * 18, 44 + r() * 30 + Math.cos(u * Math.PI) * 24]);
  }
  return out;
}
function shapePath(P, dx = 0, dy = 0, grow = 0) {
  const p = new Path2D();
  for (const [x, y, rr] of P) { p.moveTo(x + dx + rr + grow, y + dy); p.arc(x + dx, y + dy, Math.max(1, rr + grow), 0, TAU); }
  return p;
}

export function initClouds() {
  if (SPR) return;
  SPR = [];
  for (const seed of [3, 11, 29, 47]) {
    const P = puffs(seed);
    // nítida en 3 tonos: panza navy-aqua (abajo-derecha), cara aqua100 corrida hacia la luz, filo claro
    const c = makeCanvas(SW, SH), x = c.getContext('2d');
    const all = shapePath(P);
    x.fillStyle = mixHex(PAL.ocean500, PAL.navy600, 0.35);
    x.fill(all);
    x.save();
    x.clip(all);
    x.fillStyle = mixHex(PAL.aqua200, PAL.ocean400, 0.35);
    x.fill(shapePath(P, -9, -11, -3));
    x.fillStyle = PAL.aqua100;
    x.fill(shapePath(P, -16, -20, -12));
    x.fillStyle = 'rgba(255,255,255,0.55)';
    x.fill(shapePath(P, -22, -26, -26));
    x.restore();
    // bordes blandos: la versión final es la nítida desenfocada apenas
    const s = makeCanvas(SW, SH), xs = s.getContext('2d');
    xs.filter = 'blur(7px)';
    xs.drawImage(c, 0, 0);
    // sombra sobre el mapa
    const sh = makeCanvas(SW, SH), xh = sh.getContext('2d');
    xh.filter = 'blur(16px)';
    xh.fillStyle = PAL.ink;
    xh.fill(all);
    SPR.push({ body: bake(s), shadow: bake(sh) });
  }
}

// [x, y] de mapa · p (parallax: se mueve 1 + p veces el mapa) · ancho en px de mapa · sprite · deriva (px/s)
// · alfa · rango de zoom [desde, hasta] en que se ve
const CLOUDS = [
  // Río de la Plata (solo en el alejamiento del corte)
  [-712, 452, 0.3, 30, 0, 1.0, 0.42, [3.6, 9]], [-612, 540, 0.24, 22, 1, 0.8, 0.38, [3.6, 9]],
  // Atlántico sur y costa de Brasil
  [-430, 400, 0.22, 56, 2, 1.6, 0.45, [1.6, 4.2]], [-640, 205, 0.2, 50, 3, 1.4, 0.38, [1.6, 4.2]],
  // Caribe y Atlántico norte
  [-915, -350, 0.22, 92, 1, 2, 0.45, [0.85, 2.0]], [-380, -330, 0.2, 110, 2, 2, 0.4, [0.85, 2.0]],
  // Mediterráneo y Arabia
  [80, -340, 0.22, 90, 3, 2, 0.4, [1.0, 2.4]], [820, -470, 0.26, 82, 1, 2, 0.42, [1.0, 2.4]],
  // océano austral (llegada del látigo)
  [-860, 860, 0.24, 96, 2, 2, 0.42, [1.2, 2.6]], [-380, 820, 0.2, 110, 0, 2, 0.4, [1.0, 2.6]],
  // toma amplia: entran desde los bordes en map.all
  [-1150, 60, 0.34, 210, 3, 3, 0.4, [0.5, 0.95]], [1050, -110, 0.34, 190, 2, 3, 0.4, [0.5, 0.95]],
  [900, 700, 0.3, 230, 0, 3, 0.36, [0.5, 0.95]],
];

function cloudAt(i, cam, t) {
  const [mx, my, p, wm, , drift] = CLOUDS[i];
  const k = cam.z * (1 + p);
  const x = mx + (t - T.in) * drift;
  return { x: W / 2 + (x - cam.cx) * k, y: H / 2 + (my - cam.cy) * k, w: wm * k, k };
}

/** Alfa de la nube i en t (0 = no se dibuja). Incluye el límite de velocidad en pantalla. */
function cloudAlpha(i, cam, t) {
  const [, , , , , , a0, [zlo, zhi]] = CLOUDS[i];
  const lz = Math.log(cam.z);
  let a = a0 * smoothstep(Math.log(zlo) - 0.18, Math.log(zlo) + 0.05, lz) * (1 - smoothstep(Math.log(zhi) - 0.05, Math.log(zhi) + 0.18, lz));
  a *= smoothstep(T.in + 0.2, T.in + 0.4, t);
  if (a <= 0.01) return 0;
  const c = cloudAt(i, cam, t);
  if (c.x + c.w < -60 - PAD || c.x - c.w > W + 60 + PAD || c.y + c.w < -60 - PAD || c.y - c.w > H + 60 + PAD) return 0;
  // velocidad en pantalla (px por cuadro): si pasa de ~20 se va apagando y a 36 ya no está
  const h = 1 / 120;
  const a1 = cloudAt(i, camAt(t - h), t - h), b1 = cloudAt(i, camAt(t + h), t + h);
  const v = Math.max(Math.hypot(b1.x - a1.x, b1.y - a1.y), Math.abs(b1.w - a1.w) * 0.5) / (2 * h) / 60;
  a *= 1 - smoothstep(20, 36, v);
  // nada enorme pegado a cámara (ninguna nube pasa de ~300 px)
  a *= 1 - smoothstep(260, 300, c.w);
  return a;
}

/** Sombras de las nubes sobre el mapa (van antes de rutas y pines). */
export function drawCloudShadows(ctx, cam, t) {
  drawAll(ctx, cam, t, true);
}
/** Nubes: arriba del mapa y las rutas, DEBAJO de barcos, pines, rótulos y postales. */
export function drawClouds(ctx, cam, t) {
  drawAll(ctx, cam, t, false);
}

function drawAll(ctx, cam, t, shadow) {
  for (let i = 0; i < CLOUDS.length; i++) {
    const a = cloudAlpha(i, cam, t);
    if (a <= 0.01) continue;
    const c = cloudAt(i, cam, t);
    const S = SPR[CLOUDS[i][4]];
    const hh = (c.w * SH) / SW;
    ctx.save();
    if (shadow) {
      // sombra en el piso: más chica y corrida abajo-derecha (luz arriba-izquierda)
      const off = CLOUDS[i][2] * c.w * 0.5;
      ctx.globalAlpha *= a * 0.32;
      ctx.drawImage(S.shadow, c.x - c.w * 0.45 + off, c.y - hh * 0.45 + off * 1.3, c.w * 0.9, hh * 0.9);
    } else {
      ctx.globalAlpha *= a;
      ctx.drawImage(S.body, c.x - c.w / 2, c.y - hh / 2, c.w, hh);
    }
    ctx.restore();
  }
}

/** Una nube suelta (sprite k = 0..3) centrada en (x, y) con ancho w px de pantalla. */
export function drawCloudSprite(ctx, k, x, y, w, alpha = 1, { shadow = false } = {}) {
  const S = SPR[k % SPR.length];
  const h = (w * SH) / SW;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(shadow ? S.shadow : S.body, x - w / 2, y - h / 2, w, h);
  ctx.restore();
}

/** Para pruebas: nubes visibles en t → [{ i, x, y, w, a }] (px de pantalla). */
export function cloudsAt(t) {
  const cam = camAt(t);
  const out = [];
  for (let i = 0; i < CLOUDS.length; i++) {
    const a = cloudAlpha(i, cam, t);
    if (a > 0.01) out.push({ i, ...cloudAt(i, cam, t), a });
  }
  return out;
}
