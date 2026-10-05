// Vidrio de la ventana (plano pared, por delante de la ciudad y detrás del marco): gotas pegadas con brillo,
// reflejo frío del interior y unos hilos de agua que bajan en vivo.
import { PAL, rgba } from '../../engine/color.js';
import { lin, fill, rrectPath, circlePath, ellipsePath } from '../../engine/draw.js';
import { rng, hash } from '../../engine/noise.js';
import { bake, put } from './util.js';
import { WIN } from './layout.js';
import { cue, BEAT } from '../../engine/time.js';
import { E, clamp } from '../../engine/ease.js';

/** Gotón que pega contra el vidrio en la corchea después de cal1 y resbala (vive la mitad izquierda). */
const SPLAT = { t: cue('hook.cal1') + BEAT / 2, x: 884, y: 392, r: 19 };

let SPR = null;

export function initGlass() {
  const { x, y, w, h } = WIN;
  SPR = bake(x, y, w, h, 1, (g) => {
    // velo y reflejo diagonal del interior
    fill(g, rrectPath(x, y, w, h, 0), rgba(PAL.ink, 0.2));
    g.save();
    g.translate(x + w * 0.25, y);
    g.rotate(0.42);
    fill(g, rrectPath(0, -100, 150, h * 2, 0), lin(g, 0, 0, 150, 0, [rgba(PAL.white, 0), rgba(PAL.white, 0.07), rgba(PAL.white, 0)]));
    fill(g, rrectPath(220, -100, 40, h * 2, 0), rgba(PAL.white, 0.035));
    g.restore();
    // gotas: refracción oscura, brillo arriba a la izquierda
    const r = rng(19);
    for (let i = 0; i < 90; i++) {
      const dx = x + r() * w, dy = WIN.blind + r() * (y + h - WIN.blind);
      const rr = 1.5 + Math.pow(r(), 2.5) * 6;
      fill(g, ellipsePath(dx, dy, rr, rr * 1.15), rgba(PAL.ink, 0.25));
      fill(g, ellipsePath(dx, dy - rr * 0.1, rr * 0.8, rr * 0.9), rgba(PAL.grey400, 0.18));
      fill(g, circlePath(dx - rr * 0.35, dy - rr * 0.4, rr * 0.32), rgba(PAL.white, 0.6));
    }
  });
}

export function drawGlass(ctx, t) {
  put(ctx, SPR);
  drawSplat(ctx, t);
  // hilos que bajan zigzagueando y dejan rastro
  for (let i = 0; i < 5; i++) {
    const x0 = WIN.x + 60 + hash(i, 1) * (WIN.w - 120);
    const span = WIN.y + WIN.h - WIN.blind;
    const sp = 60 + hash(i, 2) * 90;
    const y = WIN.blind + ((hash(i, 3) * span + t * sp) % span);
    const x = x0 + Math.sin(y * 0.05 + i) * 4;
    const trail = Math.min(140, y - WIN.blind);
    fill(ctx, rrectPath(x - 1.2, y - trail, 2.4, trail, 1.2), lin(ctx, 0, y - trail, 0, y, [rgba(PAL.grey300, 0), rgba(PAL.grey300, 0.3)]));
    fill(ctx, ellipsePath(x, y, 3.6, 4.4), rgba(PAL.ink, 0.3));
    fill(ctx, circlePath(x - 1.2, y - 1.5, 1.4), rgba(PAL.white, 0.8));
  }
}

function drawSplat(ctx, t) {
  const u = t - SPLAT.t;
  if (u < 0 || u > 3.2) return;
  const { x, r } = SPLAT;
  // impacto: se aplasta y salpica gotitas; después resbala acelerando con un hilo que queda atrás
  const hitK = E.backOut(2.2)(clamp(u / 0.08));
  const slide = Math.max(0, u - 0.25);
  const y = SPLAT.y + 30 * slide + 70 * slide * slide;
  const wob = Math.sin(u * 9) * 2 * clamp(slide * 3);
  const trail = y - SPLAT.y;
  if (trail > 2) fill(ctx, rrectPath(x - 2.2 + wob * 0.3, SPLAT.y, 4.4, trail, 2.2), lin(ctx, 0, SPLAT.y, 0, y, [rgba(PAL.grey300, 0.12), rgba(PAL.grey300, 0.38)]));
  const sx = 1 + 0.5 * clamp(1 - u / 0.2), sy = 1 - 0.3 * clamp(1 - u / 0.2);
  const rr = r * hitK;
  fill(ctx, ellipsePath(x + wob, y, rr * sx, rr * 1.15 * sy), rgba(PAL.ink, 0.32));
  fill(ctx, ellipsePath(x + wob, y - rr * 0.12, rr * 0.82 * sx, rr * 0.9 * sy), rgba(PAL.grey300, 0.3));
  fill(ctx, circlePath(x + wob - rr * 0.35, y - rr * 0.42, rr * 0.3), rgba(PAL.white, 0.85));
  // salpicadura del impacto (corona chica)
  if (u < 0.3) {
    const q = u / 0.3;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + hash(i, 41);
      const d = r * (1.2 + 2.6 * E.outCubic(q)) * (0.7 + 0.5 * hash(i, 42));
      fill(ctx, circlePath(x + Math.cos(a) * d, SPLAT.y + Math.sin(a) * d * 0.8, (2.4 + 1.6 * hash(i, 43)) * (1 - q * 0.4)), rgba(PAL.grey200, 0.55 * (1 - q * 0.6)));
    }
  }
}
