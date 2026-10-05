// EL CRUCERO de Prime Cruceros, de perfil. Protagonista de la marca: se ve bien chico en el horizonte
// (~300 px), mediano (~1000 px) y MUY de cerca (×6–8 y hasta un ojo de buey a pantalla completa).
// Coordenadas locales: eslora 1000 (x −500 popa → +500 proa), flotación y = 0, arriba negativo.
// El ancla de drawShip (x, y) es el MEDIO del barco sobre la línea de flotación.
import { seaOf, lightOf } from './presets.js';
import { geom, TOP_Y, stemX, hullTop } from './ship/geom.js';
import { drawBody, shipColors } from './ship/body.js';
import { drawReflection, drawWake, drawBowWave, drawSteam } from './ship/water.js';
export { drawHorn, drawSmoke } from './ship/steam.js';
import { unit } from './util.js';

const g0 = geom();
const heroIdx = g0.portholes.reduce((best, p, i) => (Math.abs(p.x - 300) < Math.abs(g0.portholes[best].x - 300) ? i : best), 0);

/** Metadatos del barco (coordenadas locales). */
export const SHIP = {
  length: 1000,
  height: -(g0.funnelBox.top - 9), // flotación → tope de los caños de la chimenea (~263)
  airDraft: -(g0.mast.top), // flotación → tope del mástil
  waterline: 0,
  bbox: { x0: -500, x1: 500, y0: g0.mast.top - 8, y1: 10 },
  bow: { x: 500, y: hullTop(500) },
  stern: { x: -497, y: hullTop(-497) },
  stemWaterline: { x: stemX(0), y: 0 },
  deckTop: TOP_Y,
  /** ojos de buey del casco: { x, y, r } (r = radio del vidrio; el aro llega a r·1,3) */
  portholes: g0.portholes,
  /** índice del ojo de buey «héroe» para el push-in: a proa, sobre casco navy limpio (sin librea alrededor) */
  hero: heroIdx,
  funnel: { x: (g0.funnelBox.x0 + g0.funnelBox.x1) / 2, y: (g0.funnelBox.top + g0.funnelBox.base) / 2, top: g0.funnelBox.top, x0: g0.funnelBox.x0, x1: g0.funnelBox.x1, base: g0.funnelBox.base },
  horn: g0.horn,
  smoke: g0.smoke,
  mast: { x: g0.mast.x, y: g0.mast.top },
  boats: g0.boats.length,
};

/** Cabeceo del barco en t (heave en unidades locales, pitch en rad). bob = multiplicador. */
export function shipBob(t, bob = 1) {
  return { heave: Math.sin(t * 0.9) * 0.9 * bob + Math.sin(t * 2.1 + 1) * 0.25 * bob, pitch: Math.sin(t * 0.7 + 1) * 0.0032 * bob };
}

/**
 * Punto local (lx, ly) del barco → coordenadas donde vive drawShip (las del ctx al llamar).
 * Si pasás t, incluye el cabeceo (bob) — imprescindible para encuadrar un ojo de buey de cerca.
 */
export function shipPoint(o, lx, ly, t) {
  const s = o.scale ?? 1, d = o.dir ?? 1;
  let x = lx, y = ly;
  if (t !== undefined && (o.bob ?? 1) > 0) {
    const b = shipBob(t, o.bob ?? 1);
    const c = Math.cos(b.pitch), sn = Math.sin(b.pitch);
    [x, y] = [x * c - y * sn, x * sn + y * c + b.heave];
  }
  return [(o.x ?? 960) + x * s * d, (o.y ?? 660) + y * s];
}
/** Ojo de buey i en pantalla: { x, y, r } (r = radio del vidrio). */
export function shipPorthole(o, i = SHIP.hero, t) {
  const p = SHIP.portholes[i];
  const [x, y] = shipPoint(o, p.x, p.y, t);
  return { x, y, r: p.r * (o.scale ?? 1) };
}
/**
 * Pose { x, y, scale } para que el ojo de buey i quede centrado en (cx, cy) con radio de vidrio r.
 * Ej.: interpolá scale en escala logarítmica entre la pose de partida y esta para el push-in de HOOK.
 */
export function shipPoseFor(i, cx, cy, r, dir = 1) {
  const p = SHIP.portholes[i];
  const scale = r / p.r;
  return { x: cx - p.x * scale * dir, y: cy - p.y * scale, scale, dir };
}

/**
 * Push-in a un ojo de buey: opciones de drawShip en el progreso k (0 = pose de partida o0, 1 = el ojo de
 * buey i centrado en (cx, cy) con radio de vidrio r). La escala avanza en logaritmo (velocidad de zoom
 * pareja) y el ojo de buey viaja en línea recta en pantalla al mismo ritmo, así no «se escapa» del cuadro.
 * El cabeceo se apaga al acercarse (en k = 1 el encuadre es exacto). Aplicale tu easing a k.
 */
export function shipZoom(o0, k, { i = SHIP.hero, cx = 960, cy = 540, r = 300 } = {}) {
  const p = SHIP.portholes[i];
  const d = o0.dir ?? 1;
  const s0 = o0.scale ?? 1, s1 = r / p.r;
  const q = Math.min(1, Math.max(0, k));
  const s = Math.exp(Math.log(s0) + (Math.log(s1) - Math.log(s0)) * q);
  const [px0, py0] = shipPoint(o0, p.x, p.y);
  const X = px0 + (cx - px0) * q, Y = py0 + (cy - py0) * q;
  return { ...o0, scale: s, x: X - p.x * s * d, y: Y - p.y * s, bob: (o0.bob ?? 1) * (1 - q) * (1 - q) };
}

/**
 * drawShip(ctx, t, { x, y, scale, dir, wake, lights, preset, detail, reflect, smoke, horn, speed, bob, bowWave, wind, wakeLen })
 *  - x, y: medio del barco sobre la flotación (def 960, 660) · scale: 1 = 1000 px de eslora
 *  - dir: 1 = proa a la derecha, −1 = a la izquierda
 *  - wake 0..1 (estela en V; wakeLen def 1500 = 1,5 esloras) · bowWave 0..1 · reflect 0..1 (reflejo en el agua) · smoke 0..1 (humo leve)
 *  - horn: t del bocinazo (chorro con rulo, flash y anillo de presión) · hornDir (rad, en coordenadas locales;
 *    def −2,0 = arriba y hacia popa) · hornCurl (±1) · lights 0..1 (def la del preset: atardecer/noche)
 *  - detail 0|1|2 (def automático por tamaño en pantalla) · speed: unidades/s del agua (def 60)
 *  - bob: cabeceo (def 1; usá 0 si necesitás el barco quieto en un primer plano extremo)
 */
export function drawShip(ctx, t, o = {}) {
  const preset = o.preset ?? 'golden';
  const C = shipColors(preset);
  const sea = seaOf(preset);
  const s = o.scale ?? 1, dir = o.dir ?? 1;
  const m = ctx.getTransform();
  const px = s * Math.hypot(m.a, m.b);
  const detail = o.detail ?? (px * 1000 < 480 ? 0 : px * 1000 < 1800 ? 1 : 2);
  const [lxW, lyW] = unit(lightOf(preset).dir);
  const lsx = Math.sign(lxW * dir) || 1;
  const lights = o.lights ?? C.lights;
  const speed = o.speed ?? 60;
  const wind = o.wind ?? 1;

  ctx.save();
  ctx.translate(o.x ?? 960, o.y ?? 660);
  ctx.scale(s * dir, s);

  // agua: reflejo y estela (en el marco del agua, sin cabeceo)
  if ((o.reflect ?? 1) > 0.01) drawReflection(ctx, t, { C, sea, amt: o.reflect ?? 1 });
  drawWake(ctx, t, { amt: o.wake ?? 1, speed, len: o.wakeLen ?? 1500, C, sea, px });

  // cuerpo con cabeceo, recortado en la flotación
  const b = shipBob(t, o.bob ?? 1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-620, -500, 1240, 501.2);
  ctx.clip();
  ctx.translate(0, b.heave);
  ctx.rotate(b.pitch);
  drawBody(ctx, { t, C, detail, lsx, px, lights, dir, lightDirLocal: [lxW * dir, lyW] });
  drawSteam(ctx, t, { smoke: o.smoke ?? 0, horn: o.horn, hornDir: o.hornDir, hornCurl: o.hornCurl, C, wind, light: [lxW * dir, lyW] });
  ctx.restore();

  drawBowWave(ctx, t, { amt: o.bowWave ?? 1, speed, C, sea, px });
  ctx.restore();
}

/** Precalcula la geometría (lo hace solo la primera vez; se puede llamar en init). */
export function initShip() { geom(); }
