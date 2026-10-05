// Atardecer en cubierta (reflector → sol; sol → pin). Equipo DECK-B. Contrato: docs/PLAN.md §6.3.
// 11,25 el sol en (960, 430) r = 160 con el cuadro lavado de luz (match con el reflector del show): el lavado
// pasa en 6 cuadros (E.outExpo) y va DEBAJO de la pareja y el primer plano; los rayos del reflector siguen en el
// sol. La cámara se aleja y baja (grúa): baranda, pareja, reposeras y tragos entran desde abajo, opacos y con
// desenfoque de profundidad de campo los primeros cuadros. Beat 2: la cámara aterriza y se prenden las luces;
// sigue un dolly lento (z 1 → 1,05) con deriva lateral y el sol baja. exp.cheers: chin-chin con anticipación,
// squash de las copas, estrella y flare que crece. exp.out: golpe de empuje y empuje E.inExpo hacia el sol;
// en el último cuadro, disco naranja liso en (960, 520) r = 120 (match con el pin de map).
import { plane } from '../engine/camera.js';
import { W, H, beatPulse } from '../engine/time.js';
import { E, clamp, prog } from '../engine/ease.js';
import { PAL, rgba } from '../engine/color.js';
import { rad, blurred } from '../engine/draw.js';
import { addFx } from '../engine/fx.js';
import { initArt } from '../art/index.js';
import { initGrain } from './deck-b/grain.js';
import { sunsetCam, sunR, sunRWorld, lensZ, entryBlur, D, T0, T_B2, T_CHEERS, T_WASH } from './deck-b/ss-time.js';
import { drawSkyBack, drawTheSun, drawSea, drawFlock, drawHeroGull, sunScreen, drawEntryRays, drawCheersFlare } from './deck-b/ss-sky.js';
import { initRail, drawRail, RAIL } from './deck-b/ss-rail.js';
import { drawLifeRing } from './deck-b/ss-ring.js';
import { initDeck, drawDeck } from './deck-b/ss-deck.js';
import { drawCouple, toPlane, WOMAN, MAN, CLINK } from './deck-b/ss-couple.js';
import { drawClink } from './deck-b/ss-clink.js';
import { initLoungers, drawLounger } from './deck-b/ss-lounger.js';
import { initDrinks, drawTableDrinks } from './deck-b/ss-drinks.js';
import { drawLights, drawNearLights } from './deck-b/ss-lights.js';
import { drawExitVignette, drawPushStreaks, drawFlatDisc } from './deck-b/ss-exit.js';

// gancho de perfilado (solo lo usa shots/deck-b/_ssprof.mjs; en el render es null)
const lap = (name) => globalThis.__ssLap?.(name);

/** Punto de pantalla → coordenadas del plano de profundidad d. */
function inPlane(cam, d, sx, sy) {
  const z = Math.pow(cam.z, d);
  return [cam.cx + (sx - cam.cx) / z + cam.x * d, cam.cy + (sy - cam.cy) / z + cam.y * d];
}
const unit = (dx, dy) => { const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };

/** Lavado de la entrada: pico en el corte (sigue al del show) y cae con E.outExpo en 5 cuadros. */
const washK = (t) => (t < T0 + 1 / 60 ? 1 : 1 - E.outExpo(prog(t, T0 + 1 / 60, T_WASH)));

/** El mismo lavado cálido con el que termina el show (solo cielo y mar: va debajo de todo lo que está cerca). */
function drawWash(ctx, t, x, y) {
  const w = washK(t);
  if (w <= 0.003) return;
  ctx.save();
  ctx.fillStyle = rad(ctx, x, y, W * 0.85, [[0, rgba(PAL.warmWhite, 0.97 * w)], [0.3, rgba(PAL.goldLight, 0.86 * w)], [0.7, rgba(PAL.gold, 0.8 * w)], [1, rgba(PAL.gold, 0.78 * w)]]);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
/** El disco blanco-dorado que viene del reflector, siempre nítido encima del lavado. */
function drawEntryDisc(ctx, t, x, y) {
  const w = Math.min(1, washK(t) * 3);
  if (w <= 0.003) return;
  const r = sunR(t);
  ctx.save();
  ctx.globalAlpha *= w;
  ctx.fillStyle = rad(ctx, x, y, r, [[0, '#FFFFFF'], [0.55, '#FFFDF6'], [0.88, PAL.warmWhite], [1, PAL.goldPale]]);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Dibuja fn con el desenfoque de entrada que corresponda (barato: solo los cuadros en que asoma). */
const dof = (ctx, px, fn) => (px > 0.4 ? blurred(ctx, px, fn) : fn(ctx));

let fxDone = false;

const scene = {
  id: 'sunset',
  team: 'DECK-B',
  from: 11.25,
  to: 13.125,
  z: 60,
  async init() {
    await initArt({ clouds: ['sunset'], seeds: [1, 2, 3] });
    initGrain();
    initRail();
    initDeck();
    initLoungers();
    initDrinks();
    if (!fxDone) {
      fxDone = true;
      // golpecitos propios: la cámara que aterriza y se prenden las luces, y el brindis
      // (y un pulso chico en cada corchea: el bombo empuja la cámara)
      addFx((t) => {
        if (t < T_B2 || t > T_CHEERS + 0.6) return null;
        const a = t - T_B2, c = t - T_CHEERS;
        const e8 = beatPulse(t, { from: T_B2, to: T_CHEERS + 0.47, every: 0.5, decay: 0.09 });
        return { punch: 0.026 * Math.exp(-a / 0.14) + (c >= 0 ? 0.034 * Math.exp(-c / 0.16) : 0) + 0.008 * e8 };
      });
    }
  },
  draw(ctx, t) {
    const cam = sunsetCam(t);
    // sol en el mundo de la cámara (wx, wy) y en pantalla (ssx, ssy): la órbita corre todo el cuadro ox
    const [wx, wy] = sunScreen(cam);
    const ssx = wx + cam.ox, ssy = wy;
    const r = sunR(t);
    // zoom de lente del golpe y el empuje final (alrededor del sol): el mundo entero crece; los efectos van afuera
    const lz = lensZ(t);
    ctx.save();
    if (Math.abs(lz - 1) > 0.0001) { ctx.translate(ssx, ssy); ctx.scale(lz, lz); ctx.translate(-ssx, -ssy); }
    ctx.translate(cam.ox, 0);
    drawSkyBack(ctx, t, cam); lap('sky');
    drawEntryRays(ctx, t, wx, wy, r);
    drawTheSun(ctx, t, cam); lap('sun');
    drawCheersFlare(ctx, t, wx, wy, r, false);
    drawFlatDisc(ctx, t, wx, wy, sunRWorld(t));
    // borde de arriba del zócalo de la baranda en pantalla (el mar de más abajo queda tapado por la cubierta)
    const kickY = cam.cy + (RAIL.kick - cam.cy - cam.y * D.rail) * Math.pow(cam.z, D.rail) + 2;
    drawSea(ctx, t, cam, kickY); lap('sea');
    drawFlock(ctx, t, cam);
    drawHeroGull(ctx, t, cam); lap('gulls');
    // lavado de la entrada: debajo de la cubierta, la baranda, la pareja y el primer plano (no se transparentan)
    drawWash(ctx, t, wx, wy);
    drawEntryDisc(ctx, t, wx, wy);

    // cubierta (antes que la baranda: su borde queda escondido detrás del zócalo) y baranda con el salvavidas;
    // los planos que entran juntos comparten la capa de desenfoque (más barato)
    const sDeck = inPlane(cam, D.deck, wx, wy);
    const fW = toPlane(WOMAN.x, WOMAN.y), fM = toPlane(MAN.x, MAN.y);
    const sRail = inPlane(cam, D.rail, wx, wy);
    const sweep = clamp((t - (T_B2 - 0.06)) / 0.42);
    const glint = t >= T_B2 ? Math.exp(-(t - T_B2) / 0.2) : 0;
    const bDeck = Math.max(entryBlur(t, 905, D.deck, 12), entryBlur(t, RAIL.top - 10, D.rail, 12));
    dof(ctx, bDeck, (cc) => {
      plane(cc, cam, D.deck, (c) => drawDeck(c, t, { sx: sDeck[0], people: [{ x: fW[0], w: 46, y: fW[1] }, { x: fM[0], w: 58, y: fM[1] }] }));
      plane(cc, cam, D.rail, (c) => {
        drawRail(c, t, { sx: sRail[0], sweep, glint });
        const hx = 1612, hy = RAIL.top + 6;
        // el salvavidas se hamaca: aterrizaje de la cámara, brindis y el viento
        const land = Math.max(0, t - (T_B2 + 0.05));
        const ch = Math.max(0, t - T_CHEERS);
        const swing = 0.05 * Math.sin(t * 2.6 + 0.6) + 0.02 * Math.sin(t * 5.3)
          + (t > T_B2 + 0.05 ? 0.1 * Math.exp(-land / 0.4) * Math.sin(land * 9) : 0)
          + (t > T_CHEERS ? 0.05 * Math.exp(-ch / 0.35) * Math.sin(ch * 11) : 0);
        drawLifeRing(c, t, hx, hy, 74, 43, unit(sRail[0] - hx, sRail[1] - (hy + 90)), swing);
      });
    });
    lap('rail');
    const sCouple = inPlane(cam, D.couple, wx, wy);
    dof(ctx, entryBlur(t, 490, D.couple, 14), (cc) => plane(cc, cam, D.couple, (c) => {
      drawCouple(c, t, sCouple);
      const [cx, cy] = toPlane(CLINK.x, CLINK.y);
      drawClink(c, t, cx, cy);
    }));
    lap('couple');

    // primer plano: reposeras y mesita con los tragos
    const sFg = inPlane(cam, D.fg, wx, wy);
    const kick = t >= T_CHEERS ? Math.exp(-(t - T_CHEERS) / 0.3) : 0;
    const pulse = beatPulse(t, { from: T0, every: 1, decay: 0.12 });
    const bFg = Math.max(entryBlur(t, 760, D.fg, 18), entryBlur(t, 650, D.table, 18));
    dof(ctx, bFg, (cc) => {
      plane(cc, cam, D.fg, (c) => {
        drawLounger(c, t, 70, 1132, 1.12, 1, unit(sFg[0] - 70, sFg[1] - 900));
        drawLounger(c, t, 1858, 1132, 1.12, -1, unit(sFg[0] - 1858, sFg[1] - 900));
      });
      plane(cc, cam, D.table, (c) => drawTableDrinks(c, t, 1318, 868, 1.22, [0, -1], { pulse, kick }));
    });
    lap('fg');
    // las luces cuelgan sobre la cámara: sin la grúa, entran desde arriba al alejarse y salen por arriba al empujar
    const camL = { ...cam, y: cam.y - cam.tilt };
    plane(ctx, camL, D.lights, (c) => drawLights(c, t));
    plane(ctx, camL, D.near, (c) => drawNearLights(c, t));
    lap('lights');

    ctx.restore();

    // lente: flare del brindis, viñeta de salida, estrías del empuje y el disco liso
    drawCheersFlare(ctx, t, ssx, ssy, r, true);
    drawExitVignette(ctx, t, ssx, ssy, r);
    drawPushStreaks(ctx, t, ssx, ssy, r);
    lap('fx');
  },
};
export default scene;
