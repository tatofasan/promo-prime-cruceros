// Cuerpo del crucero (casco + superestructura + cubierta superior) en coordenadas locales.
// Sombreado en 3 tonos: base, sombra plana dura y filo de luz del lado de la luz; grano sutil adentro.
import { W, H } from '../../engine/time.js';
import { PAL, mixHex } from '../../engine/color.js';
import { lin, rad, texture, smoothPath, sparkle } from '../../engine/draw.js';
import { TAU } from '../../engine/ease.js';
import { hash } from '../../engine/noise.js';
import { drawPin } from '../../brand/pin.js';
import { resolve, litColor } from '../presets.js';
import { drawPorthole } from '../porthole.js';
import { ca } from '../util.js';
import { geom, TOP_Y, stemX, SEG_W } from './geom.js';

/** Rango de tramos visibles [i0, i1] según la transformación actual (null = todos). */
function visibleSegs(ctx) {
  const m = ctx.getTransform();
  const det = m.a * m.d - m.b * m.c;
  if (!det) return null;
  let lo = Infinity, hi = -Infinity;
  for (const [X, Y] of [[0, 0], [W, 0], [0, H], [W, H]]) {
    const lx = (m.d * (X - m.e) - m.c * (Y - m.f)) / det;
    lo = Math.min(lo, lx); hi = Math.max(hi, lx);
  }
  const i0 = Math.max(0, Math.floor((lo + 500) / SEG_W) - 1), i1 = Math.min(9, Math.floor((hi + 500) / SEG_W) + 1);
  return i0 === 0 && i1 === 9 ? null : [i0, i1];
}
/** Rellena un camino segmentado (solo los tramos en cuadro) o un Path2D común. */
function fillP(ctx, P, vis) {
  if (!P.segmented) { ctx.fill(P); return; }
  if (!vis) { ctx.fill(P.all); return; }
  ctx.fill(P.long);
  for (let i = vis[0]; i <= vis[1]; i++) ctx.fill(P.seg[i]);
}

const BOAT = mixHex(PAL.brandOrange, PAL.gold, 0.28);

/** Colores del barco para un preset (cacheados por objeto de preset). */
const colCache = new WeakMap();
export function shipColors(preset) {
  const P = resolve(preset);
  let c = colCache.get(P.sky);
  if (c) return c;
  const L = P.sky.light;
  c = {
    white: L.white,
    whiteShade: L.whiteShade,
    whiteDeep: mixHex(L.whiteShade, PAL.navy800, 0.35),
    rim: L.rim,
    key: L.key,
    hull: litColor(PAL.navy700, P),
    hullShade: litColor(mixHex(PAL.navy900, PAL.navy700, 0.25), P),
    hullRim: mixHex(PAL.aqua100, L.rim, 0.3),
    warmRim: mixHex(L.rim, L.key, 0.35),
    boot: litColor(PAL.brandCyan, P, 0.6),
    pinstripe: litColor(PAL.brandOrange, P, 0.6),
    glassTop: mixHex(PAL.navy600, P.sky.stops[1][1], 0.35),
    glassBot: litColor(PAL.navy800, P),
    rail: mixHex(L.white, PAL.aqua200, 0.25),
    recess: mixHex(L.whiteShade, PAL.navy700, 0.55),
    boat: litColor(BOAT, P, 0.7),
    boatShade: litColor(mixHex(BOAT, PAL.coral, 0.2), P, 1.4),
    boatDark: mixHex(BOAT, PAL.navy800, 0.45),
    funnel: litColor(PAL.brandOrange, P, 0.6),
    funnelShade: litColor(mixHex(PAL.brandOrange, '#8A1E00', 0.35), P, 1.2),
    cyan: litColor(PAL.brandCyan, P, 0.6),
    ink: PAL.ink,
    metal: mixHex('#C9D5DF', L.ambient, L.ambientA),
    lights: L.lights,
    sky: P.sky,
    preset: P,
  };
  colCache.set(P.sky, c);
  return c;
}

/**
 * Dibuja el cuerpo del barco. ctx ya está en coordenadas locales.
 * o = { t, C (colores), detail 0|1|2, lsx (+1 luz desde proa / −1 desde popa), px (px por unidad), lights, lightsOn }
 */
export function drawBody(ctx, o) {
  const g = geom();
  const { C, detail, lsx, px, t } = o;
  const vis = px > 1.6 ? visibleSegs(ctx) : null;
  // ---------------------------------------------------------------- superestructura
  ctx.fillStyle = C.white;
  ctx.fill(g.sup);
  ctx.save();
  ctx.clip(g.sup);
  // vidrio de balcones / ventanas con reflejo de cielo arriba
  const glassFill = lin(ctx, 0, TOP_Y, 0, -86, [[0, C.glassTop], [1, C.glassBot]]);
  ctx.fillStyle = glassFill;
  if (detail === 0) {
    ctx.fill(g.glassMid);
  } else {
    fillP(ctx, g.glass, vis);
    fillP(ctx, g.bigWins, vis);
    fillP(ctx, g.wins, vis);
    ctx.fill(g.deck0Wins);
    ctx.fillStyle = ca(C.rail, 0.3);
    fillP(ctx, g.rail, vis);
    // sombra del alero sobre el vidrio (arriba de cada fila)
    ctx.fillStyle = ca(PAL.ink, 0.35);
    fillP(ctx, g.glassShadow, vis);
    if (detail > 1 || px > 1.4) { ctx.fillStyle = ca(C.white, 0.85); fillP(ctx, g.railCap, vis); }
    if (detail > 1) {
      // reflejos diagonales en los paños (degradé a rayas: sin recorte, barato)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = stripes(ctx);
      fillP(ctx, g.glass, vis);
      fillP(ctx, g.bigWins, vis);
      ctx.restore();
    }
    ctx.fillStyle = C.white;
    fillP(ctx, g.cols, vis);
    if (detail > 1 || px > 1.1) {
      fillP(ctx, g.fins, vis);
      ctx.fillStyle = ca(C.whiteShade, 0.9);
      fillP(ctx, g.finShade, vis);
    }
    // reflejo de cielo que barre los vidrios (diagonal)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = lin(ctx, -500, TOP_Y, 500, -60, [[0, ca(C.key, 0)], [0.32, ca(C.key, 0.12)], [0.38, ca(C.key, 0)], [0.62, ca(C.key, 0)], [0.7, ca(C.key, 0.1)], [0.76, ca(C.key, 0)]]);
    fillP(ctx, g.glass, vis);
    fillP(ctx, g.bigWins, vis);
    ctx.restore();
  }
  // sombras planas bajo cada losa + filo de luz arriba
  ctx.fillStyle = C.whiteShade;
  ctx.fill(g.slabShade);
  ctx.fillStyle = ca(mixHex(C.white, C.rim, 0.55), 0.95);
  ctx.fill(g.slabTop);
  // caras de las terrazas: la que mira a la luz se ilumina, la otra queda en sombra
  ctx.fillStyle = lsx > 0 ? C.whiteShade : ca(C.rim, 0.85);
  ctx.fill(g.aftFaces);
  ctx.fillStyle = lsx > 0 ? ca(C.rim, 0.75) : C.whiteShade;
  ctx.fill(g.fwdFaces);
  // galería de botes en sombra
  ctx.fillStyle = lin(ctx, 0, -84, 0, -60, [[0, C.whiteDeep], [0.14, C.whiteDeep], [0.16, C.recess], [1, mixHex(C.recess, C.whiteShade, 0.4)]]);
  ctx.fill(g.recess);
  if (detail > 0) {
    ctx.fillStyle = ca(C.whiteShade, 0.9);
    ctx.fill(g.recessPosts);
    ctx.fillStyle = ca(C.white, 0.9);
    ctx.fillRect(g.recessX[0], -63.2, g.recessX[1] - g.recessX[0], 1.1);
    ctx.fillStyle = ca(C.white, 0.45);
    ctx.fillRect(g.recessX[0], -66.5, g.recessX[1] - g.recessX[0], 0.5);
  }
  // luces de cabinas (atardecer/noche)
  if (o.lights > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= o.lights;
    ctx.fillStyle = ca(PAL.goldLight, 0.85);
    fillP(ctx, g.lit, vis);
    ctx.fillStyle = ca(PAL.coralLight, 0.6);
    fillP(ctx, g.litWarm, vis);
    ctx.restore();
  }
  // volumen: el lado que no mira a la luz se apaga un poco; lo alto recibe más luz
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = lin(ctx, -500 * lsx, 0, 500 * lsx, 0, [[0, mixHex(C.whiteShade, '#ffffff', 0.45)], [0.6, '#ffffff'], [1, '#ffffff']]);
  ctx.fillRect(-510, TOP_Y - 10, 1020, 160);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = lin(ctx, 0, TOP_Y, 0, -90, [[0, ca(C.key, 0.16)], [1, ca(C.key, 0)]]);
  ctx.fillRect(-510, TOP_Y - 10, 1020, 120);
  ctx.restore();
  if (detail > 0 && px < 2.5) texture(ctx, g.sup, { alpha: 0.07, scale: 0.6 / px }); // de muy cerca alcanza el grano global
  // filo cálido en los frentes y bordes que miran a la luz (se apaga hacia el lado en sombra)
  ctx.lineJoin = 'round';
  ctx.strokeStyle = lin(ctx, -500 * lsx, 0, 500 * lsx, 0, [[0, ca(C.warmRim, 0)], [0.5, ca(C.warmRim, 0)], [0.8, ca(C.warmRim, 0.55)], [1, ca(C.warmRim, 0.95)]]);
  ctx.lineWidth = Math.min(6, Math.max(1.6, 2.6 / px));
  ctx.stroke(g.sup);
  ctx.restore();

  // ---------------------------------------------------------------- cubierta superior
  drawTop(ctx, o, g);

  // ---------------------------------------------------------------- botes salvavidas
  drawBoats(ctx, o, g);

  // ---------------------------------------------------------------- casco
  ctx.fillStyle = C.hull;
  ctx.fill(g.hull);
  ctx.save();
  ctx.clip(g.hull);
  // volumen a lo largo: más oscuro hacia el lado contrario a la luz
  ctx.fillStyle = lin(ctx, -500 * lsx, 0, 500 * lsx, 0, [[0, ca(C.hullShade, 0.55)], [0.55, ca(C.hullShade, 0)], [1, ca(C.hullRim, 0.08)]]);
  ctx.fillRect(-510, -80, 1020, 92);
  ctx.fillStyle = ca(C.hullShade, 0.9);
  ctx.fill(g.hullShade);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = lin(ctx, 0, -16, 0, -5, [[0, ca(PAL.ocean400, 0)], [1, ca(PAL.ocean400, 0.22)]]);
  ctx.fill(g.hullBounce);
  ctx.restore();
  if (detail > 1) {
    // soldadura: línea oscura de 1 px y, justo debajo, una clara (el canto que agarra luz)
    const lw = Math.max(0.12, 1 / px);
    ctx.lineWidth = lw;
    ctx.strokeStyle = ca(C.hullShade, 0.8);
    ctx.stroke(g.seams);
    ctx.save();
    ctx.translate(lw * 0.9 * (lsx > 0 ? -1 : 1), lw);
    ctx.strokeStyle = ca(C.hullRim, 0.22);
    ctx.stroke(g.seams);
    ctx.restore();
    if (px > 3.5) { ctx.fillStyle = ca(C.hullRim, 0.3); ctx.fill(g.rivets); }
  }
  // librea: ola cian con brillo + filete naranja
  ctx.fillStyle = lin(ctx, -480, 0, 470, 0, [[0, ca(C.cyan, 0.85)], [0.6, C.cyan], [1, mixHex(C.cyan, PAL.aqua300, 0.35)]]);
  ctx.fill(g.swoosh);
  ctx.fillStyle = ca(PAL.aqua100, 0.35);
  ctx.save(); ctx.clip(g.swoosh); ctx.translate(0, 1.6); ctx.fill(g.swooshLine); ctx.restore();
  ctx.fillStyle = C.pinstripe;
  ctx.fill(g.swooshLine);
  // filete naranja y línea de flotación cian
  ctx.fillStyle = C.pinstripe;
  ctx.fill(g.pinstripe);
  ctx.fillStyle = C.boot;
  ctx.fill(g.boot);
  ctx.fillStyle = ca('#ffffff', 0.35);
  ctx.fillRect(-490, -6.6, 960, 0.7);
  // ventanas rectangulares, puertas, ancla
  if (detail > 0) {
    ctx.fillStyle = lin(ctx, 0, -47, 0, -42, [[0, C.glassTop], [1, C.ink]]);
    ctx.fill(g.hullWindows);
    ctx.strokeStyle = ca(C.hullRim, 0.45);
    ctx.lineWidth = Math.max(0.15, 0.6 / px);
    ctx.stroke(g.hullDoors);
    drawAnchor(ctx, g.anchor, C, px);
  }
  drawPortholes(ctx, o, g);
  if (detail > 0 && px < 2.5) texture(ctx, g.hull, { alpha: 0.09, scale: 0.6 / px });
  ctx.restore();
  // filo de luz en el borde del casco (arrufo) y en la roda si la luz viene de proa
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ca(C.hullRim, 0.85);
  ctx.lineWidth = Math.max(0.5 / px, 1.1);
  ctx.stroke(smoothPath(g.sheerPts));
  if (lsx > 0) {
    // la proa mira al sol: filo cálido marcado en la roda
    ctx.strokeStyle = ca(C.warmRim, 0.9);
    ctx.lineWidth = Math.max(1.4 / px, 2.2);
    ctx.stroke(smoothPath(g.stemPts));
  }
  // destello en la roda
  if (detail > 0) sparkle(ctx, stemX(-58) - 1, -60, 9 * (0.6 + 0.4 * Math.sin(t * 1.7)), { alpha: 0.55, color: C.key });
}

let stripeStops = null;
/** Degradé diagonal a rayas (reflejos de vidrio): período ~37 unidades. */
function stripes(ctx) {
  if (!stripeStops) {
    stripeStops = [];
    const n = 30;
    for (let i = 0; i < n; i++) {
      const a = i / n, w = 0.22 / n;
      const al = 0.1 + 0.06 * Math.sin(i * 2.3);
      stripeStops.push([a, 'rgba(255,255,255,0)'], [a + w * 0.5, `rgba(255,255,255,${al.toFixed(3)})`], [a + w, 'rgba(255,255,255,0)']);
    }
  }
  return lin(ctx, -560, -200, 560, -60 + 300, stripeStops);
}

function drawPortholes(ctx, o, g) {
  const { C, px, t, detail } = o;
  const rs = 3.3 * px; // radio en pantalla
  if (rs < 7) {
    // versión barata: aro claro + vidrio + punto de brillo
    const ring = new Path2D(), glass = new Path2D(), hi = new Path2D();
    for (const p of g.portholes) {
      ring.moveTo(p.x + p.r * 1.3, p.y); ring.arc(p.x, p.y, p.r * 1.3, 0, TAU);
      glass.moveTo(p.x + p.r, p.y); glass.arc(p.x, p.y, p.r, 0, TAU);
      if (detail > 0) { hi.moveTo(p.x + p.r * 0.75, p.y - p.r * 0.35); hi.arc(p.x + p.r * 0.35, p.y - p.r * 0.35, p.r * 0.4, 0, TAU); }
    }
    ctx.fillStyle = C.metal;
    ctx.fill(ring);
    ctx.fillStyle = lin(ctx, 0, -31, 0, -23, [[0, C.glassTop], [1, C.ink]]);
    ctx.fill(glass);
    if (detail > 0) { ctx.fillStyle = ca('#ffffff', 0.55); ctx.fill(hi); }
    if (o.lights > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = ca(PAL.goldLight, 0.7 * o.lights);
      const litP = new Path2D();
      g.portholes.forEach((p, i) => { if (hash(i, 17) < 0.55) { litP.moveTo(p.x + p.r * 0.8, p.y); litP.arc(p.x, p.y, p.r * 0.8, 0, TAU); } });
      ctx.fill(litP);
      ctx.restore();
    }
    return;
  }
  // de cerca: el ojo de buey completo (el mismo de porthole.js), solo los que están en pantalla
  const m = ctx.getTransform();
  for (let i = 0; i < g.portholes.length; i++) {
    const p = g.portholes[i];
    const sx = m.a * p.x + m.c * p.y + m.e, sy = m.b * p.x + m.d * p.y + m.f;
    if (sx < -rs * 2 || sx > W + rs * 2 || sy < -rs * 2 || sy > H + rs * 2) continue;
    drawPorthole(ctx, t, p.x, p.y, p.r, { preset: C.preset, detail: rs > 60 ? 2 : 1, lite: rs < 45, lit: o.lights > 0.01 && hash(i, 17) < 0.55 ? o.lights * 0.8 : 0, lightDir: o.lightDirLocal });
  }
}

function drawAnchor(ctx, a, C, px) {
  ctx.fillStyle = ca(C.hullShade, 0.95);
  ctx.beginPath(); ctx.ellipse(a.x, a.y, 7, 5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = ca(C.hullRim, 0.5);
  ctx.lineWidth = Math.max(0.15, 0.5 / px);
  ctx.stroke();
  ctx.fillStyle = C.metal;
  ctx.fillRect(a.x - 0.8, a.y - 3.2, 1.6, 6);
  ctx.beginPath(); ctx.arc(a.x, a.y + 1.4, 2.6, 0.1, Math.PI - 0.1); ctx.lineWidth = 1.1; ctx.strokeStyle = C.metal; ctx.stroke();
}

function drawBoats(ctx, o, g) {
  const { C, detail, px } = o;
  const body = new Path2D(), shade = new Path2D(), canopy = new Path2D(), hi = new Path2D(), win = new Path2D(), davit = new Path2D(), rub = new Path2D();
  for (const b of g.boats) {
    const { x, y, w, h } = b;
    // casco del bote (cápsula)
    body.moveTo(x + h * 0.5, y);
    body.lineTo(x + w - h * 0.5, y);
    body.quadraticCurveTo(x + w + 1, y, x + w, y + h * 0.55);
    body.quadraticCurveTo(x + w - 2, y + h, x + w * 0.5, y + h);
    body.quadraticCurveTo(x + 2, y + h, x, y + h * 0.55);
    body.quadraticCurveTo(x - 1, y, x + h * 0.5, y);
    canopy.rect(x - 1, y - 1, w + 2, h * 0.42 + 1);
    shade.rect(x - 1, y + h * 0.68, w + 2, h * 0.5);
    rub.rect(x - 1, y + h * 0.42, w + 2, 0.8);
    hi.rect(x + 3, y + 0.5, w - 7, 0.9);
    if (detail > 0) for (let k = 0; k < 4; k++) win.rect(x + 4.6 + k * 4.4, y + h * 0.5 + 0.6, 2.4, 1.7);
    if (detail > 0) {
      davit.moveTo(x + 3, -84); davit.quadraticCurveTo(x + 1, y - 4, x + 5, y - 0.5);
      davit.moveTo(x + w - 3, -84); davit.quadraticCurveTo(x + w - 1, y - 4, x + w - 5, y - 0.5);
    }
  }
  if (detail > 0) {
    ctx.strokeStyle = mixHex(C.metal, C.whiteShade, 0.4);
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.stroke(davit);
    ctx.strokeStyle = ca('#ffffff', 0.55);
    ctx.lineWidth = 0.45;
    ctx.save(); ctx.translate(-0.35, -0.2); ctx.stroke(davit); ctx.restore();
  }
  ctx.fillStyle = C.boat;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = mixHex(C.boat, '#ffffff', 0.22);
  ctx.fill(canopy);
  ctx.fillStyle = C.boatShade;
  ctx.fill(shade);
  ctx.fillStyle = ca('#ffffff', 0.8);
  ctx.fill(rub);
  ctx.fillStyle = ca(C.rim, 0.9);
  ctx.fill(hi);
  ctx.fillStyle = ca(C.boatDark, 0.9);
  ctx.fill(win);
  ctx.restore();
  // sombra de los botes sobre la galería
  if (detail > 0 && px > 0.6) {
    ctx.fillStyle = ca(PAL.navy900, 0.2);
    for (const b of g.boats) ctx.fillRect(b.x + 2, b.y + b.h, b.w - 2, 2.6);
  }
}

function drawTop(ctx, o, g) {
  const { C, detail, lsx, px, t } = o;
  const T = TOP_Y;
  // losa de la cubierta de sol con rompevientos de vidrio
  const sd = g.sunDeck;
  ctx.fillStyle = C.white;
  ctx.fillRect(sd.x0, sd.y - sd.h, sd.x1 - sd.x0, sd.h + 0.5);
  ctx.fillStyle = C.whiteShade;
  ctx.fillRect(sd.x0, sd.y - 1.6, sd.x1 - sd.x0, 1.6);
  ctx.fillStyle = ca(C.rim, 0.9);
  ctx.fillRect(sd.x0, sd.y - sd.h, sd.x1 - sd.x0, 0.8);
  if (detail > 0) {
    ctx.fillStyle = ca(PAL.aqua200, 0.32);
    ctx.fillRect(sd.x0 + 4, sd.y - sd.h - 5, sd.x1 - sd.x0 - 8, 5);
    ctx.fillStyle = ca('#ffffff', 0.5);
    ctx.fillRect(sd.x0 + 4, sd.y - sd.h - 5, sd.x1 - sd.x0 - 8, 0.6);
  }
  // bloque de proa (club/observatorio) con ventanal
  const fb = g.fwdBlock;
  ctx.fillStyle = C.white;
  roundRect(ctx, fb.x0, fb.y - 0.5, fb.x1 - fb.x0, fb.h + 1, 4);
  ctx.fillStyle = lin(ctx, 0, fb.y + 4, 0, fb.y + 10, [[0, C.glassTop], [1, C.glassBot]]);
  ctx.fillRect(fb.x0 + 6, fb.y + 4, fb.x1 - fb.x0 - 14, 6);
  ctx.fillStyle = ca(C.rim, 0.85);
  ctx.fillRect(fb.x0 + 3, fb.y - 0.5, fb.x1 - fb.x0 - 6, 0.8);
  ctx.fillStyle = C.whiteShade;
  ctx.fillRect(lsx > 0 ? fb.x0 : fb.x1 - 4, fb.y + 2, 4, fb.h - 2);
  // puente: ventanal oscuro corrido y alerones
  const br = g.bridge;
  ctx.save();
  ctx.clip(g.sup);
  ctx.fillStyle = lin(ctx, 0, br.y, 0, br.y + br.h, [[0, C.glassTop], [0.5, C.glassBot], [1, C.ink]]);
  ctx.fillRect(br.x0, br.y, br.x1 - br.x0 + 20, br.h);
  ctx.fillStyle = ca('#ffffff', 0.35);
  ctx.fillRect(br.x0, br.y + 0.6, br.x1 - br.x0 + 20, 0.6);
  ctx.restore();
  ctx.fillStyle = C.white;
  ctx.fillRect(br.x1 - 8, br.y - 1.6, br.wing - br.x1 + 8, 2.8);
  ctx.fillStyle = C.whiteShade;
  ctx.fillRect(br.x1 - 8, br.y + 0.6, br.wing - br.x1 + 8, 0.6);
  ctx.fillStyle = ca(C.rim, 0.9);
  ctx.fillRect(br.x1 - 8, br.y - 1.6, br.wing - br.x1 + 8, 0.7);
  // cúpula de vidrio de la pileta
  drawDome(ctx, g.dome, C, t, detail);
  // sombrillas de colores
  if (detail > 0) {
    const cols = [PAL.coral, PAL.gold, PAL.brandCyan, PAL.sunsetPink, PAL.coralLight];
    for (const u of g.umbrellas) {
      const c = cols[u.i % cols.length];
      ctx.fillStyle = C.metal;
      ctx.fillRect(u.x - 0.35, T - 13, 0.7, 7.5);
      ctx.fillStyle = litColor(c, C.preset, 0.6);
      ctx.beginPath(); ctx.moveTo(u.x - 6, T - 12); ctx.quadraticCurveTo(u.x, T - 19, u.x + 6, T - 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = ca(C.rim, 0.6);
      ctx.beginPath(); ctx.moveTo(u.x - 3, T - 14.5); ctx.quadraticCurveTo(u.x, T - 18.2, u.x + 3.8, T - 14.6); ctx.lineTo(u.x, T - 16); ctx.closePath(); ctx.fill();
    }
  }
  // toboganes (detrás de la chimenea no: van a popa)
  drawSlides(ctx, g, C, detail, px, t);
  // chimenea
  drawFunnel(ctx, g, C, lsx, detail, px, o.dir ?? 1);
  // mástil con radar
  drawMast(ctx, g, C, lsx, detail, t, px);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function drawDome(ctx, d, C, t, detail) {
  const cx = (d.x0 + d.x1) / 2, rx = (d.x1 - d.x0) / 2;
  ctx.fillStyle = C.white;
  ctx.fillRect(d.x0 - 2, d.y - 3, d.x1 - d.x0 + 4, 3.5);
  ctx.beginPath();
  ctx.ellipse(cx, d.y - 3, rx, d.h, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, 0, d.y - 3 - d.h, 0, d.y - 3, [[0, mixHex(C.sky.stops[0][1], '#ffffff', 0.35)], [1, C.glassBot]]);
  ctx.fill();
  if (detail > 0) {
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = ca(C.white, 0.85);
    ctx.lineWidth = 1;
    for (let k = -4; k <= 4; k++) {
      ctx.beginPath(); ctx.moveTo(cx + k * rx * 0.24, d.y); ctx.lineTo(cx + k * rx * 0.3, d.y - d.h * 1.2); ctx.stroke();
    }
    ctx.beginPath(); ctx.ellipse(cx, d.y - 3, rx * 0.98, d.h * 0.55, 0, Math.PI, TAU); ctx.stroke();
    ctx.fillStyle = ca('#ffffff', 0.35);
    ctx.beginPath(); ctx.ellipse(cx + rx * 0.25, d.y - d.h * 0.7, rx * 0.35, d.h * 0.14, -0.2, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

function drawSlides(ctx, g, C, detail, px, t) {
  const st = g.slideTower;
  // torre: estructura blanca con escalera
  ctx.fillStyle = C.white;
  ctx.fillRect(st.x - 5, st.top, 10, st.base - st.top);
  ctx.fillStyle = C.whiteShade;
  ctx.fillRect(st.x + 1.5, st.top, 3.5, st.base - st.top);
  ctx.fillStyle = ca(C.rim, 0.9);
  ctx.fillRect(st.x - 6, st.top - 1.5, 12, 1.8);
  const COL = { coral: PAL.coral, gold: PAL.gold, cyan: PAL.brandCyan };
  ctx.fillStyle = C.whiteShade;
  if (detail > 1) for (const [x, y0, y1] of g.slideLegs) ctx.fillRect(x - 0.7, y0, 1.4, y1 - y0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // de lejos y a media distancia: solo 2 lazos claros (coral y dorado), más gruesos; de cerca, los 3
  const list = detail < 2 ? g.slidesSimple : g.slides;
  const k = detail < 2 ? 1.35 : 1;
  for (const s of list) {
    const base = litColor(COL[s.c], C.preset, 0.6);
    const path = smoothPath(s.pts, false, 0.55);
    ctx.strokeStyle = mixHex(base, PAL.navy900, 0.35);
    ctx.lineWidth = 5.6 * k;
    ctx.save(); ctx.translate(0.6, 0.9); ctx.stroke(path); ctx.restore();
    ctx.strokeStyle = base;
    ctx.lineWidth = 4.6 * k;
    ctx.stroke(path);
    if (detail > 0) {
      ctx.strokeStyle = ca(mixHex(base, '#ffffff', 0.55), 0.9);
      ctx.lineWidth = 1.1;
      ctx.save(); ctx.translate(-0.4, -1.2); ctx.stroke(path); ctx.restore();
    }
  }
}

function drawFunnel(ctx, g, C, lsx, detail, px, dir) {
  const fb = g.funnelBox;
  ctx.fillStyle = C.funnel;
  ctx.fill(g.funnel);
  ctx.save();
  ctx.clip(g.funnel);
  // sombra plana del lado contrario a la luz (franja vertical inclinada)
  ctx.fillStyle = C.funnelShade;
  ctx.beginPath();
  if (lsx > 0) { ctx.moveTo(fb.x0 - 5, fb.top - 2); ctx.lineTo(fb.x0 + 28, fb.top - 2); ctx.lineTo(fb.x0 + 38, fb.base + 2); ctx.lineTo(fb.x0 - 5, fb.base + 2); } else {
    ctx.moveTo(fb.x1 + 5, fb.top - 2); ctx.lineTo(fb.x1 - 52, fb.top - 2); ctx.lineTo(fb.x1 - 34, fb.base + 2); ctx.lineTo(fb.x1 + 5, fb.base + 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.cyan;
  ctx.fill(g.funnelBand);
  ctx.fillStyle = ca('#ffffff', 0.5);
  ctx.save(); ctx.translate(0, -0.2); ctx.clip(g.funnelBand); ctx.fillRect(fb.x0, fb.top + 16, fb.x1 - fb.x0 + 20, 1); ctx.restore();
  ctx.fillStyle = C.ink;
  ctx.fill(g.funnelCap);
  if (detail > 0) texture(ctx, g.funnel, { alpha: 0.1, scale: 0.6 / px });
  ctx.restore();
  // filo de luz del borde que mira a la luz
  ctx.strokeStyle = ca(C.rim, 0.95);
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (lsx > 0) {
    ctx.moveTo(-160.5, fb.base - 1);
    ctx.bezierCurveTo(-166.5, fb.base - 22, -176.5, fb.top + 14, -190.5, fb.top + 0.8);
  } else {
    ctx.moveTo(-262, fb.base - 1); ctx.lineTo(-281, fb.top + 2);
  }
  ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.fill(g.funnelPipes);
  // pin de marca blanco en la chimenea
  if (detail > 0) {
    const p = g.funnelPin;
    ctx.save();
    if (dir < 0) { ctx.translate(p.x, 0); ctx.scale(-1, 1); ctx.translate(-p.x, 0); } // el pin nunca se espeja
    // pin de marca LEGIBLE: contorno blanco + pin naranja con cielo, mar cian y crucero (como el favicon)
    drawPin(ctx, p.x, p.y + p.size * 0.07, p.size * 1.14, { ring: '#ffffff', sky: '#ffffff', sea: '#ffffff', ship: '#ffffff' });
    drawPin(ctx, p.x, p.y, p.size, { ring: litColor(PAL.brandOrange, C.preset, 0.3), sky: litColor(PAL.brandSky, C.preset, 0.3), sea: litColor(PAL.brandSea, C.preset, 0.3), ship: '#ffffff' });
    ctx.restore();
  }
}

function drawMast(ctx, g, C, lsx, detail, t, px) {
  const m = g.mast;
  ctx.fillStyle = C.white;
  ctx.beginPath();
  ctx.moveTo(m.x - 3.2, m.base); ctx.lineTo(m.x + 3.2, m.base); ctx.lineTo(m.x + 1, m.top); ctx.lineTo(m.x - 1, m.top);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.whiteShade;
  ctx.fillRect(lsx > 0 ? m.x - 2.6 : m.x + 0.4, m.base - 30, 2.2, 30);
  // vergas
  ctx.fillRect(m.x - 18, m.top + 22, 36, 1.6);
  ctx.fillRect(m.x - 11, m.top + 10, 22, 1.2);
  // domos de radar
  for (const [dx, dy, r] of [[-16, 30, 6.5], [14, 34, 5.5]]) {
    const x = m.x + dx, y = m.top + dy;
    ctx.fillStyle = C.metal;
    ctx.fillRect(x - 0.6, y, 1.2, m.base - y);
    ctx.fillStyle = C.white;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = C.whiteShade;
    ctx.beginPath(); ctx.arc(x, y, r, lsx > 0 ? Math.PI * 0.55 : -Math.PI * 0.45, lsx > 0 ? Math.PI * 1.45 : Math.PI * 0.45); ctx.fill();
    ctx.fillStyle = ca(C.rim, 0.95);
    ctx.beginPath(); ctx.arc(x + lsx * r * 0.35, y - r * 0.4, r * 0.3, 0, TAU); ctx.fill();
  }
  // antena de radar que gira (en perfil se acorta y se alarga)
  const a = Math.cos(t * 3.2);
  ctx.fillStyle = C.ink;
  ctx.fillRect(m.x - 12 * Math.abs(a), m.top + 18, 24 * Math.abs(a) + 0.8, 1.6);
  // luz de tope
  if (C.lights > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rad(ctx, m.x, m.top, 9, [[0, ca('#ffffff', 0.9 * C.lights)], [1, ca('#ffffff', 0)]]);
    ctx.fillRect(m.x - 9, m.top - 9, 18, 18);
    ctx.restore();
  }
}
