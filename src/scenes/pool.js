// Pileta en cubierta, vista cenital (iris desde el ojo de buey → match cut flotador → plato). Equipo DECK-A.
// Contrato: docs/PLAN.md §6.3 y §7. Coreografía en deck-a/pool-timeline.js; cada ilustración en su módulo.
// Cámara cenital con perspectiva real (deck-a/util.js): lo alto (tobogán, sombrillas, palmeras) crece y se abre.
import { beatPulse } from '../engine/time.js';
import { E, clamp, prog } from '../engine/ease.js';
import { lightSweep, sparkle } from '../engine/draw.js';
import { addGrade } from '../engine/grade.js';
import { drawPorthole } from '../art/porthole.js';
import { onPlane, put, shadowSprite, project, visibleWorld, scaleAt } from './deck-a/util.js';
import { layer } from '../engine/layer.js';
import { bakeDeck } from './deck-a/pool-deck.js';
import { bakeFloor, drawPool, waterGlints } from './deck-a/pool-water.js';
import { drawSea, drawRail } from './deck-a/pool-sea.js';
import { drawLounger, loungerShadow, drawProp } from './deck-a/lounger.js';
import { initUmbrellas, umbrellaShadow, umbrellaBase, drawUmbrella } from './deck-a/umbrella.js';
import { initSlide, slideShadow, drawSlide, riderShadow, chuteSpill, chuteSpray } from './deck-a/slide.js';
import { gullShadow, drawGull } from './deck-a/gull.js';
import { detailsUnder, detailsOver } from './deck-a/pool-details.js';
import { T_HE } from './deck-a/pool-path.js';
import { initPlants, plantShadow, plantPots, drawPalms, drawForeground } from './deck-a/plants.js';
import { drawSwimmer } from './deck-a/splash.js';
import { crownSurface, crownAir, crownWet } from './deck-a/crown.js';
import { drawFloat, floatSilhouette, ringSilhouette, drawDiver } from './deck-a/float.js';
import { LOUNGERS, UMBRELLAS, DECK_PROPS } from './deck-a/pool-layout.js';
import { FLOOR_H, POOL, shadowOff, SUN } from './deck-a/pool-geo.js';
import { T0, TW3, TR, T1, HIT, IRIS_END, T_SURF, T_TOAST, T_DIVE0, DIVE_OUT, TI, SPLASH_PT, irisR, camAt, floatAt } from './deck-a/pool-timeline.js';

let DECKC = null, FSH = null, FSH_RING = null;
// splash del tobogán: corona alargada en la dirección de la caída (cae en la zona libre de TYPE)
const SLIDE_SPLASH = { x: SPLASH_PT.x, y: SPLASH_PT.y, t0: TI, size: 116, asp: 0.6, dir: 0, seed: 7, drops: 40, fingers: 24, rings: 3 };
// zambullida de la chica del flotador: sale de cabeza hacia donde mira y entra al agua en exp.ring
const DIVE = (() => {
  const f0 = floatAt(T_DIVE0);
  const dir = f0.rot - Math.PI / 2;
  const x = f0.x + Math.cos(dir) * DIVE_OUT, y = f0.y + Math.sin(dir) * DIVE_OUT;
  return { from: [f0.x, f0.y], dir, rot0: f0.rot, out: DIVE_OUT, splash: { x, y, t0: TR, size: 44, asp: 0.8, dir, seed: 11, drops: 16, fingers: 14, rings: 2, column: 0 } };
})();
export { SLIDE_SPLASH };
// dónde queda el trago en el sistema del flotador (mano derecha levantada: ver deck-a/float.js)
const DRINK_LOCAL = [44, -20];

// sombras de lo estático en la cubierta (siluetas → desenfoque sin filter) y objetos encima
function deckShadows(soft, sharp) {
  for (const L of LOUNGERS) loungerShadow(sharp, L);
  for (const u of UMBRELLAS) umbrellaShadow(soft, sharp, u);
  slideShadow(soft, sharp, 0);
  plantShadow(soft, sharp);
}
function deckObjects(c) {
  for (const u of UMBRELLAS) umbrellaBase(c, u);
  plantPots(c);
  for (const L of LOUNGERS) drawLounger(c, L);
  for (const p of DECK_PROPS) {
    c.save(); c.translate(p[1], p[2]); drawProp(c, [p[0], 0, 0, p[3]], SUN); c.restore();
  }
}
function floorShadows(soft, sharp, h0) {
  slideShadow(soft, null, h0);
  for (const u of UMBRELLAS) umbrellaShadow(soft, null, u, h0);
}

// cubierta horneada: solo el rectángulo de mundo que se ve (Skia no recorre el lienzo entero)
function drawDeck(ctx, C) {
  const [vx0, vy0, vx1, vy1] = visibleWorld(C, 0, 4);
  const x0 = Math.max(DECKC.x, Math.floor(vx0)), y0 = Math.max(DECKC.y, Math.floor(vy0));
  const x1 = Math.min(DECKC.x + DECKC.w, Math.ceil(vx1)), y1 = Math.min(DECKC.y + DECKC.h, Math.ceil(vy1));
  if (x1 <= x0 || y1 <= y0) return;
  onPlane(ctx, C, 0, (c) => c.drawImage(DECKC.c, x0 - DECKC.x, y0 - DECKC.y, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0));
}

// brindis: sube el trago a cámara en el beat y lo baja antes de la zambullida
const raiseAt = (t) => E.outCubic(prog(t, T_TOAST - 0.09, T_TOAST)) * (1 - E.inOutSine(prog(t, TR - 0.12, TR + 0.05)));

/** La escena por capas, en orden de dibujo: [nombre, fn(ctx)] (deck-a/_prof.mjs las mide por separado). */
export function parts(t) {
  const C = camAt(t);
  const pulse = beatPulse(t, { from: T0, every: 1, decay: 0.12 });
  const fl = floatAt(t);
  const sweepP = prog(t, TW3 - 0.06, TW3 + 0.42);
  return [
    ['sea', (ctx) => drawSea(ctx, C, t)],
    ['pool', (ctx) => drawPool(ctx, C, t, {
      pulse,
      under: (c) => {
        onPlane(c, C, FLOOR_H, (q) => {
          const [ox, oy] = shadowOff(0, FLOOR_H);
          put(q, t < T_DIVE0 ? FSH : FSH_RING, fl.x + ox, fl.y + oy, { r: fl.rot, s: fl.bob, alpha: 0.42 });
        });
        detailsUnder(c, C, t);
      },
      surface: (c) => { chuteSpill(c, C, t); crownSurface(c, C, t, SLIDE_SPLASH); crownSurface(c, C, t, DIVE.splash); },
    })],
    ['deck', (ctx) => drawDeck(ctx, C)],
    ['shadows', (ctx) => { crownWet(ctx, C, t, SLIDE_SPLASH); riderShadow(ctx, C, t); gullShadow(ctx, C, t); }],
    ['glints', (ctx) => waterGlints(ctx, C, t, pulse, sweepP > 0 && sweepP < 1 ? (x, y) => {
      const d = (x - POOL.x0) / (POOL.x1 - POOL.x0) - (y - POOL.y0) / (POOL.y1 - POOL.y0) * 0.35 - (sweepP * 1.6 - 0.4);
      return Math.exp(-d * d / 0.004);
    } : null)],
    ['details', (ctx) => detailsOver(ctx, C, t)],
    ['float', (ctx) => onPlane(ctx, C, 0, (c) => {
      drawFloat(c, t, fl, { raise: raiseAt(t), rider: t < T_DIVE0, warm: E.inQuad(prog(t, T1 - 0.11, T1)), warmAng: -1.1 - C.r });
      drawDiver(c, t, prog(t, T_DIVE0, TR), DIVE);
    })],
    ['dive-splash', (ctx) => crownAir(ctx, C, t, DIVE.splash)],
    ['swimmer', (ctx) => drawSwimmer(ctx, C, t, T_SURF)],
    ['rail', (ctx) => drawRail(ctx, C, t)],
    ['umbrellas', (ctx) => { for (const u of UMBRELLAS) drawUmbrella(ctx, C, t, u); }],
    ['slide', (ctx) => { drawSlide(ctx, C, t); chuteSpray(ctx, C, t, T_HE); }],
    ['splash', (ctx) => crownAir(ctx, C, t, SLIDE_SPLASH)],
    ['palms', (ctx) => drawPalms(ctx, C, t)],
    ['gull', (ctx) => drawGull(ctx, C, t)],
    ['fg', (ctx) => drawForeground(ctx, C, t, 1 - E.inOutSine(prog(t, TR, TR + 0.1)))],
    ['fx', (ctx) => {
      // barrido de luz sobre el agua en exp.w3
      if (sweepP > 0 && sweepP < 1) {
        const clip = new Path2D();
        const [x0, y0] = project(C, POOL.x0, POOL.y0, 0), [x1, y1] = project(C, POOL.x1, POOL.y1, 0);
        clip.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
        lightSweep(ctx, clip, { x: 0, y: 0, w: 1920, h: 1080 }, sweepP, { angle: 0.5, width: 0.16, color: '#E9FCFF', alpha: 0.35 });
      }
      // el sol está arriba a la derecha (fuera de cuadro): resplandor cálido en esa esquina
      {
        const g = ctx.createRadialGradient(2050, -120, 60, 2050, -120, 1100);
        g.addColorStop(0, 'rgba(255,236,190,0.42)');
        g.addColorStop(0.4, 'rgba(255,214,150,0.14)');
        g.addColorStop(1, 'rgba(255,214,150,0)');
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = g;
        ctx.fillRect(950, 0, 970, 980);
        ctx.globalCompositeOperation = 'source-over';
      }
      // exp.ring: «ping» que engancha la mirada en el flotador justo antes de la zambullida
      {
        const d = t - (TR - HIT);
        if (d > 0 && d < 0.3) {
          const q = E.outCubic(d / 0.3);
          ctx.save();
          onPlane(ctx, C, 0, (c) => {
            c.strokeStyle = `rgba(255,250,235,${0.85 * (1 - q)})`;
            c.lineWidth = 6 * (1 - q) + 1;
            c.beginPath(); c.arc(fl.x, fl.y, 70 + 110 * q, 0, Math.PI * 2); c.stroke();
            c.strokeStyle = `rgba(255,214,140,${0.6 * (1 - q)})`;
            c.lineWidth = 3 * (1 - q) + 0.5;
            c.beginPath(); c.arc(fl.x, fl.y, 66 + 60 * q, 0, Math.PI * 2); c.stroke();
          });
          ctx.restore();
        }
      }
      // brindis del flotador: destello en el vaso
      {
        const d = t - T_TOAST;
        if (d > -0.03 && d < 0.4 && t < T_DIVE0 + 0.05) {
          const a = (d < 0 ? 1 + d / 0.03 : Math.exp(-d / 0.12)) * (1 - prog(t, T_DIVE0, T_DIVE0 + 0.05));
          const [lx, ly] = DRINK_LOCAL;
          const c = Math.cos(fl.rot), sn = Math.sin(fl.rot);
          const [x, y, k] = project(C, fl.x + (lx * c - ly * sn) * fl.bob, fl.y + (lx * sn + ly * c) * fl.bob, 60);
          sparkle(ctx, x, y, 46 * k * a, { alpha: a, color: '#FFF4D6', rot: 0.4, halo: 0.9 });
          // rayitas de "¡salud!" alrededor del vaso
          ctx.strokeStyle = `rgba(255,244,214,${0.9 * a})`;
          ctx.lineWidth = 3 * k;
          ctx.lineCap = 'round';
          for (let i = 0; i < 5; i++) {
            const an = -2.4 + i * 0.5 + C.r, r1 = (34 + 30 * (1 - a)) * k, r2 = r1 + 16 * k * a;
            ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * r1, y + Math.sin(an) * r1); ctx.lineTo(x + Math.cos(an) * r2, y + Math.sin(an) * r2); ctx.stroke();
          }
        }
      }
      // sombra interior del aro mientras se abre el iris
      if (t < IRIS_END) {
        const R = irisR(t);
        const g = ctx.createRadialGradient(960, 540, R * 0.8, 960, 540, R);
        g.addColorStop(0, 'rgba(4,16,31,0)');
        g.addColorStop(1, `rgba(4,16,31,${0.55 * (1 - clamp((t - T0) / 0.24))})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1920, 1080);
      }
    }],
    ['dive', (ctx) => dive(ctx, t)],
  ];
}

const VIG0 = 7.35, VIG1 = 7.475;
// zambullida: desenfoque radial de zoom (copias escaladas promediadas) y un túnel navy que se cierra sobre el
// flotador para que el corte al mantel oscuro de la cena empalme en luminancia
function dive(ctx, t) {
  const u = prog(t, TR + 0.03, T1);
  if (u <= 0 && t < VIG0) return;
  const K = (q) => scaleAt(camAt(q), 0);
  const amt = Math.min(0.14, (K(t + 1 / 100) / K(t) - 1) * 0.9);
  const src = ctx.canvas;
  if (src && amt > 0.004) {
    const L = layer();
    const lc = L.getContext('2d');
    lc.drawImage(src, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const n = 4;
    for (let i = 1; i <= n; i++) {
      const s = 1 + (amt * i) / n;
      ctx.globalAlpha = 1 / (i + 1);
      ctx.drawImage(L, 960 - 960 * s, 540 - 540 * s, 1920 * s, 1080 * s);
    }
    ctx.restore();
  }
  // viñeta: el agua se va a teal profundo (empalma en luminancia con el mantel de la cena). Rampa repartida en
  // 8 cuadros (7,35–7,475): a 30 fps el último cuadro de la pileta (7,467) ya está casi tan oscuro como el mantel
  // y el corte no salta de luz (Δ luma ≤ 25 en tools/energy.mjs).
  const v = E.inOutSine(prog(t, VIG0, VIG1));
  if (v > 0.003) {
    const g = ctx.createRadialGradient(960, 540, 205, 960, 540, 1100);
    g.addColorStop(0, 'rgba(4,46,66,0)');
    g.addColorStop(0.08, `rgba(4,46,66,${0.42 * v})`);
    g.addColorStop(0.4, `rgba(4,40,60,${0.72 * v})`);
    g.addColorStop(1, `rgba(3,26,44,${0.9 * v})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1920, 1080);
  }
}

let gradeHooked = false;
const scene = {
  id: 'pool',
  team: 'DECK-A',
  from: 5.625,
  to: 7.5,
  z: 30,
  maskUntil: IRIS_END + 0.02, // iris abierto: sin máscara
  async init() {
    if (!gradeHooked) {
      gradeHooked = true;
      // día de sol: viñeta más liviana que el resto de la pieza (solo en esta ventana)
      addGrade((t) => (t >= T0 && t < T1 ? { vignette: 0.26 + 0.3 * E.inOutSine(prog(t, TR, VIG1)) } : null));
    }
    if (DECKC) return;
    initUmbrellas();
    initSlide();
    initPlants();
    FSH = shadowSprite(260, 300, 7, floatSilhouette, 'rgb(16,44,82)');
    FSH_RING = shadowSprite(260, 300, 7, ringSilhouette, 'rgb(16,44,82)');
    bakeFloor(floorShadows);
    DECKC = bakeDeck(deckShadows, deckObjects);
  },
  draw(ctx, t) {
    for (const [, fn] of parts(t)) { ctx.save(); fn(ctx); ctx.restore(); }
  },
  mask(ctx, t) {
    const R = irisR(t);
    ctx.fillStyle = '#fff';
    if (R > 1200) { ctx.fillRect(0, 0, 1920, 1080); return; }
    ctx.beginPath(); ctx.arc(960, 540, R, 0, Math.PI * 2); ctx.fill();
  },
  over(ctx, t) {
    if (t >= IRIS_END) return;
    const R = irisR(t);
    // sombra del aro hacia afuera (sobre el casco): la del kit también oscurece el interior con rimOnly
    const R1 = R * 1.3;
    const g = ctx.createRadialGradient(960 - 12, 540 + 14, R1 * 0.98, 960 - 12, 540 + 14, R1 * 1.16);
    g.addColorStop(0, 'rgba(2,8,18,0.5)');
    g.addColorStop(1, 'rgba(2,8,18,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(960 - 12, 540 + 14, R1 * 1.16, 0, Math.PI * 2); ctx.arc(960, 540, R1 * 0.99, 0, Math.PI * 2, true); ctx.fill('evenodd');
    drawPorthole(ctx, t, 960, 540, R, { preset: 'golden', rimOnly: true, shadow: 0, spin: 0.5 * (t - T0) });
  },
};
export default scene;
