// Ola + mar abierto + crucero + disparo al ojo de buey (3,5–5,9). Equipo HOOK. Contrato: docs/PLAN.md §6.2.
// La ola de ART barre la oficina (mask = lo que ya pasó, over = la cresta); detrás aparece el mar de día
// dorado con el crucero en el horizonte. Push-in con parallax, bocinazo con flare que barre, y en reveal.push
// la cámara se dispara al casco hasta que UN ojo de buey queda en (960, 540) r 300 en 5,625.
// Planos: cielo y sol (0–0,08) · nubes (0,1–0,26) · gaviotas lejanas (0,3) · barco (0,16) · mar (0,08–1,25)
// · gaviotas rasantes (1,05) · oleaje de primer plano (1,5) · estelas y gaviotas pegadas a la cámara (pantalla).
// Drop con jerarquía: el barco manda; cada beat tiene su golpe (loma de primer plano + golpe de lente en
// «CRUCERO?», gaviota rozando el lente en la corchea, flash de 2–3 cuadros y chorro de vapor en el bocinazo, otra
// loma y otra gaviota detrás) y nada flota en el cielo. En los últimos 3 cuadros el vidrio se enciende (corte 5,625).
import { W, H } from '../engine/time.js';
import { initArt, drawWaveMask, drawWaveCrest, waveFrontX, drawShip, shipPorthole, SHIP } from '../art/index.js';
import { HOOK_WAVE } from './waves.js';
import { PRESET } from './hook/reveal/time.js';
import { seaCam, pushK, pushRate, lensPunch, lensJolt } from './hook/reveal/cam.js';
import { drawBackdrop } from './hook/reveal/backdrop.js';
import { shipPoseAt, shipCovers } from './hook/reveal/ship.js';
import { drawSkyGulls, drawLowGulls, drawFunnelGulls, drawWhipGull, drawNearGulls, drawFlock } from './hook/reveal/birds.js';
import { drawSwell } from './hook/reveal/swell.js';
import { drawHornRings, drawHornSteam, drawHornRipple, drawFlareSweep } from './hook/reveal/horn.js';
import { zoomBlur, initZoomBlur } from './hook/reveal/zoomblur.js';
import { drawStreaks } from './hook/reveal/streaks.js';
import { drawHullFx, drawEntryGlow } from './hook/reveal/hull.js';
import { drawFallout } from './hook/reveal/rain.js';
import { drawLensDrops } from './hook/reveal/lens.js';

/**
 * Rolido global con sobre-escaneo (el kit dibuja el cielo en pantalla y no rota): se apaga al llegar al vidrio.
 * sq = aplastamiento vertical de la anticipación del disparo · zm = golpe de lente en el beat (zoom uniforme) ·
 * jolt = sacudón de lente [dx, dy] (con el sobre-escaneo justo para no mostrar bordes).
 */
function withRoll(ctx, r, fn, sq = 1, zm = 1, jolt = [0, 0]) {
  if (Math.abs(r) < 1e-5 && Math.abs(sq - 1) < 1e-4 && Math.abs(zm - 1) < 1e-5 && !jolt[0] && !jolt[1]) { fn(ctx); return; }
  const ov = (1 + Math.abs(r) * 1.95) * zm * (1 + 2 * Math.max(Math.abs(jolt[0]) / W, Math.abs(jolt[1]) / H));
  ctx.save();
  ctx.translate(W / 2 + jolt[0], H / 2 + jolt[1]);
  ctx.rotate(r);
  ctx.scale(ov, ov * sq);
  ctx.translate(-W / 2, -H / 2);
  fn(ctx);
  ctx.restore();
}

const scene = {
  id: 'reveal-sea',
  team: 'HOOK',
  from: 3.5,
  to: 5.9,
  maskUntil: HOOK_WAVE.t1, // después de la ola la máscara es todo el cuadro: no se paga
  z: 20,
  async init() {
    await initArt({ clouds: [PRESET], seeds: [1, 2, 3, 5] });
    initZoomBlur();
  },
  draw(ctx, t) {
    const k = pushK(t);
    const c0 = seaCam(t);
    const fade = (1 - k) * (1 - k);
    // la cámara del mar sigue el disparo (el agua cercana pasa volando); el rolido lo pone withRoll
    const cam = { ...c0, r: 0, z: c0.z * Math.exp(1.35 * k) };
    const o = shipPoseAt(t, { ...c0, r: 0 });
    const eye = shipPorthole(o, SHIP.hero, t);
    const rate = pushRate(t);
    const blur = Math.min(0.14, 0.036 * rate);
    // con el desenfoque fuerte el detalle fino no se ve: el barco va en detalle medio (la mitad de costo)
    if (blur > 0.06 && o.scale < 9) o.detail = 1;
    const covered = shipCovers(o);
    let sun = null;
    // mientras entra la ola solo se ve lo que ya pasó el frente (el resto lo descarta la máscara)
    const wp = HOOK_WAVE.p(t);
    const cut = wp > 0 && wp < 1 ? waveFrontX(wp, HOOK_WAVE.dir) - 500 : -1;
    if (cut > 0) { ctx.save(); ctx.beginPath(); ctx.rect(cut, 0, W - cut, H); ctx.clip(); }
    withRoll(ctx, c0.r * fade, (c) => {
      zoomBlur(c, eye.x, eye.y, blur, (g) => {
        if (!covered) {
          sun = drawBackdrop(g, t, cam);
          drawSkyGulls(g, t, cam);
        }
        drawHornRipple(g, t, o);
        drawShip(g, t, o);
        drawFunnelGulls(g, t, o);
        drawHornSteam(g, t, o);
        drawHornRings(g, t, o);
        if (!covered) {
          drawFlock(g, t, cam);
          drawLowGulls(g, t, cam);
          drawSwell(g, t, cam);
        }
        drawHullFx(g, t, o, k);
      });
      drawFallout(c, t);
      if (sun) drawFlareSweep(c, t, sun);
    }, c0.sq ?? 1, lensPunch(t), lensJolt(t));
    if (cut > 0) ctx.restore();
    drawEntryGlow(ctx, t, eye);
    drawLensDrops(ctx, t);
    drawNearGulls(ctx, t);
    drawStreaks(ctx, t, eye.x, eye.y, rate);
    drawWhipGull(ctx, t);
  },
  mask(ctx, t) {
    drawWaveMask(ctx, HOOK_WAVE.p(t), { dir: HOOK_WAVE.dir });
  },
  over(ctx, t) {
    if (!HOOK_WAVE.active(t)) return;
    drawWaveCrest(ctx, t, HOOK_WAVE.p(t), { dir: HOOK_WAVE.dir, preset: PRESET, spray: 1.35, foam: 1.2 });
  },
};
export default scene;
