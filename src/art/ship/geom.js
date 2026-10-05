// Geometría del crucero en coordenadas LOCALES (se arma una sola vez):
//   eslora 1000 → x de −500 (popa) a +500 (proa) · línea de flotación y = 0 · arriba = y negativo.
// Proporciones de un crucero moderno tipo MSC/Royal: casco alto con arrufo hacia proa, roda lanzada,
// 10 cubiertas blancas con popa en terrazas y frente redondeado, chimenea a popa inclinada hacia atrás.
import { smoothstep } from '../../engine/ease.js';
import { hash } from '../../engine/noise.js';

export const DECK = 12.4;
export const DECK0_TOP = -86;
export const NDECKS = 10; // k = 0 (cubierta de botes) … 9
export const hullTop = (x) => -58 - 9 * Math.pow(smoothstep(-200, 500, x), 1.6);
/** x de la roda (proa) para una altura y (0 = flotación … hullTop(500)). Curva convexa lanzada. */
export const stemX = (y) => 452 + 48 * (1 - Math.pow(Math.max(0, 1 + y / -hullTop(500)), 1.7));
const AFT_STEP = [0, 3, 7, 12, 19, 28, 40, 55, 73, 95];
export const deckAft = (k) => -478 + AFT_STEP[k];
export const deckFwd = (k) => 410 - 3 * k - 0.95 * k * k;
export const deckTop = (k) => DECK0_TOP - k * DECK;
export const deckBot = (k) => (k === 0 ? null : DECK0_TOP - (k - 1) * DECK);
export const TOP_Y = deckTop(9); // −197.6

const SEGS = 10; // tramos de 100 unidades (de −500 a 500) para no procesar lo que queda fuera de cuadro
export const SEG_W = 1000 / SEGS;
/** Camino multi-rectángulo partido por tramos de x: .all (todo junto), .seg[i] (rectángulos de ese tramo,
 *  enteros: sin cortes que dejen costuras) y .long (los largos, que se dibujan siempre). */
function segPath() {
  return { all: new Path2D(), seg: Array.from({ length: SEGS }, () => new Path2D()), long: new Path2D(), segmented: true };
}
const rect = (p, x, y, w, h) => {
  if (!p.segmented) { p.rect(x, y, w, h); return; }
  p.all.rect(x, y, w, h);
  if (w > SEG_W * 0.5) { p.long.rect(x, y, w, h); return; }
  const i = Math.max(0, Math.min(SEGS - 1, Math.floor((x + w / 2 + 500) / SEG_W)));
  p.seg[i].rect(x, y, w, h);
};

/** x del frente curvo de la superestructura a la altura y (entre la cubierta 0 y la 9). */
export function frontX(y) {
  if (y >= DECK0_TOP) return deckFwd(0) + 2;
  if (y <= TOP_Y) return deckFwd(9);
  const k = (DECK0_TOP - y) / DECK;
  return deckFwd(0) - 3 * k - 0.95 * k * k;
}

let G = null;
export function geom() {
  if (G) return G;
  G = build();
  return G;
}

function build() {
  const g = {};
  // ---------------------------------------------------------------- casco
  const hull = new Path2D();
  hull.moveTo(-483, 9);
  hull.lineTo(-485, 0);
  hull.lineTo(-497, hullTop(-497) + 2);
  for (let x = -497; x <= 500; x += 8) hull.lineTo(x, hullTop(x));
  const yb = hullTop(500);
  for (let y = yb; y <= 0.001; y += 3) hull.lineTo(stemX(y), y);
  hull.lineTo(stemX(0), 0);
  hull.lineTo(449, 9);
  hull.closePath();
  g.hull = hull;
  // sombra plana bajo la cubierta de botes (la superestructura da sombra al casco arriba)
  const hullShade = new Path2D();
  hullShade.moveTo(-497, hullTop(-497));
  for (let x = -497; x <= 420; x += 8) hullShade.lineTo(x, hullTop(x));
  for (let x = 420; x >= -497; x -= 8) hullShade.lineTo(x, hullTop(x) + 7 + 3 * smoothstep(300, 420, -x));
  hullShade.closePath();
  g.hullShade = hullShade;
  // franja de rebote del agua cerca de la flotación (más clara)
  const hullBounce = new Path2D();
  hullBounce.rect(-490, -14, 990, 9);
  g.hullBounce = hullBounce;
  // línea de flotación cian (boot-top) y filete fino arriba
  const boot = new Path2D();
  boot.moveTo(-486, -6);
  boot.lineTo(stemX(-6), -6);
  boot.lineTo(stemX(1), 1);
  boot.lineTo(-485, 1);
  boot.closePath();
  g.boot = boot;
  const pin = new Path2D();
  pin.moveTo(-495, hullTop(-495) + 4.2);
  for (let x = -495; x <= 496; x += 8) pin.lineTo(x, hullTop(x) + 4.2);
  for (let x = 496; x >= -495; x -= 8) pin.lineTo(x, hullTop(x) + 5.6);
  pin.closePath();
  g.pinstripe = pin;
  // filo de luz del borde superior del casco y de la roda
  const sheer = [];
  for (let x = -497; x <= 500; x += 8) sheer.push([x, hullTop(x)]);
  g.sheerPts = sheer;
  const stem = [];
  for (let y = yb; y <= 0.001; y += 3) stem.push([stemX(y), y]);
  g.stemPts = stem;

  // librea del casco: ola cian que sube de popa a proa + filete naranja (pintura de marca)
  const sw = new Path2D(), swLine = new Path2D();
  const cl = (x) => { const u = (x + 480) / 950; return -12 - 40 * Math.pow(Math.max(0, u), 1.7); };
  const th = (x) => { const u = (x + 480) / 950; return 1 + 13 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u))), 0.8) * (0.4 + 0.6 * u); };
  const xs = [];
  for (let x = -480; x <= 470; x += 10) xs.push(x);
  xs.forEach((x, i) => (i ? sw.lineTo(x, cl(x) - th(x) * 0.5) : sw.moveTo(x, cl(x) - th(x) * 0.5)));
  for (let i = xs.length - 1; i >= 0; i--) sw.lineTo(xs[i], cl(xs[i]) + th(xs[i]) * 0.5);
  sw.closePath();
  xs.forEach((x, i) => (i ? swLine.lineTo(x, cl(x) - th(x) * 0.5 - 3) : swLine.moveTo(x, cl(x) - th(x) * 0.5 - 3)));
  for (let i = xs.length - 1; i >= 0; i--) swLine.lineTo(xs[i], cl(xs[i]) - th(xs[i]) * 0.5 - 3 - 0.4 - th(xs[i]) * 0.09);
  swLine.closePath();
  g.swoosh = sw;
  g.swooshLine = swLine;

  // ojos de buey del casco (fila baja) y ventanas rectangulares (fila alta)
  g.portholes = [];
  for (let x = -440; x <= 400; x += 13) {
    const y = -27;
    if (x > stemX(y) - 22) continue;
    if (Math.abs(x - 210) < 9 || Math.abs(x + 160) < 9) continue; // puertas de casco
    g.portholes.push({ x, y, r: 3.3 });
  }
  const winH = new Path2D();
  for (let x = -432; x <= 392; x += 13) {
    if (x > stemX(-44) - 26) continue;
    rect(winH, x - 4.5, -46.5, 9, 4.6);
  }
  g.hullWindows = winH;
  // puertas de casco (tender) y ancla
  const doors = new Path2D();
  rect(doors, 201, -36, 18, 17);
  rect(doors, -169, -36, 18, 17);
  g.hullDoors = doors;
  g.anchor = { x: 468, y: -47 };
  // costuras de chapas (solo de cerca)
  // uniones de chapas como SOLDADURAS: tracas horizontales y juntas verticales de largo desparejo, trabadas
  // como ladrillos (nada de regla de interfaz); remaches solo sobre las uniones
  const seams = new Path2D(), rivets = new Path2D();
  const strakes = [-4, -13, -37, -52];
  for (const y of strakes.slice(1)) { seams.moveTo(-490, y); seams.lineTo(stemX(y) - 2, y); }
  for (let k = 0; k < strakes.length; k++) {
    const yb = strakes[k], yt = k + 1 < strakes.length ? strakes[k + 1] : null;
    let x = -490 + 12 + 30 * hash(k, 41);
    for (let j = 0; x < 430; j++) {
      const top = yt ?? hullTop(x) + 6;
      if (yb - top > 2) { seams.moveTo(x, yb); seams.lineTo(x, top); }
      x += 34 + 30 * hash(k, j, 42);
    }
  }
  for (const y of strakes.slice(1)) {
    for (let x = -486; x < stemX(y) - 6; x += 4.6) { rivets.moveTo(x + 0.36, y + 1.6); rivets.arc(x, y + 1.6, 0.36, 0, Math.PI * 2); }
  }
  g.seams = seams;
  g.rivets = rivets;

  // ---------------------------------------------------------------- superestructura
  const sup = new Path2D();
  sup.moveTo(deckAft(0), hullTop(deckAft(0)) + 4);
  for (let k = 0; k < NDECKS; k++) {
    sup.lineTo(deckAft(k), deckTop(k));
    if (k < NDECKS - 1) sup.lineTo(deckAft(k + 1), deckTop(k));
  }
  for (let k = NDECKS - 1; k >= 0; k--) {
    const y = deckTop(k);
    const x = deckFwd(k);
    if (k === NDECKS - 1) sup.lineTo(x - 5, y);
    sup.quadraticCurveTo(x, y, x, y + 4);
    if (k > 0) sup.lineTo(deckFwd(k - 1) - 1, deckTop(k - 1) - 1);
  }
  sup.lineTo(deckFwd(0) + 2, hullTop(deckFwd(0)) + 4);
  sup.closePath();
  g.sup = sup;

  // caras verticales de las terrazas de popa (miran hacia popa) y del frente (miran a proa)
  const aftFaces = new Path2D(), fwdFaces = new Path2D();
  for (let k = 0; k < NDECKS; k++) {
    const yT = deckTop(k), yB = k === 0 ? hullTop(deckAft(0)) : deckTop(k - 1);
    rect(aftFaces, deckAft(k), yT, 3.2, yB - yT);
  }
  for (let k = 0; k < NDECKS; k++) {
    const yT = deckTop(k), yB = k === 0 ? hullTop(deckFwd(0)) + 4 : deckTop(k - 1);
    rect(fwdFaces, deckFwd(k) - 4, yT + 3, 4, yB - yT - 3);
  }
  g.aftFaces = aftFaces;
  g.fwdFaces = fwdFaces;

  // filos superiores de cada cubierta (losas) y bandas de sombra bajo cada losa
  const slabTop = new Path2D(), slabShade = new Path2D();
  for (let k = 0; k < NDECKS; k++) {
    const y = deckTop(k);
    const x0 = deckAft(k), x1 = deckFwd(k) - 3;
    rect(slabTop, x0, y, x1 - x0, 0.9);
    rect(slabShade, x0 + 1, y + 1.8, x1 - x0 - 2, 1.5);
  }
  g.slabTop = slabTop;
  g.slabShade = slabShade;

  // balcones: vidrio oscuro, baranda de vidrio clara, aletas blancas; ventanas en zonas de proa/popa
  const glass = segPath(), rail = segPath(), fins = segPath(), finShade = segPath(), cols = segPath();
  const wins = segPath(), bigWins = segPath(), lit = segPath(), litWarm = segPath();
  const glassMid = new Path2D(); // versión de media distancia (banda continua)
  const glassShadow = segPath(), railCap = segPath();
  for (let k = 1; k < NDECKS; k++) {
    const yT = deckTop(k), yB = deckBot(k);
    const xa = deckAft(k) + 8, xf = deckFwd(k) - 12;
    const gy0 = yT + 1.8, gy1 = yB - 1.8;
    const ry0 = yB - 5.4;
    rect(glassMid, xa, gy0, frontX(gy1) - 10 - xa, gy1 - gy0);
    if (k > 2) {
      rect(glassShadow, xa, gy0, xf - 46 - xa, 1.6);
      rect(railCap, xa + 14, ry0 - 0.25, xf - 46 - xa - 14, 0.5);
    }
    if (k <= 2) {
      // salones públicos: ventanales
      for (let x = xa; x + 15 < xf; x += 20) {
        rect(bigWins, x, gy0 + 0.6, 16, gy1 - gy0 - 0.8);
        if (hash(x, k, 3) < 0.75) rect(lit, x + 0.8, gy0 + 1.2, 14.4, gy1 - gy0 - 2);
      }
      continue;
    }
    const balEnd = xf - 46;
    for (let x = xa; x < xf; x += 7.4) {
      const zoneCol = ((x + 500) % 148) < 7.4; // columnas estructurales cada ~148
      if (zoneCol) { rect(cols, x, gy0, 6, gy1 - gy0); continue; }
      if (x > balEnd || x < xa + 14) {
        // cabinas sin balcón: ventanita
        rect(wins, x + 1.2, yT + 3.6, 5, 4.6);
        if (hash(x, k, 5) < 0.6) rect(lit, x + 1.6, yT + 4, 4.2, 3.8);
        continue;
      }
      rect(glass, x, gy0, 7.4, gy1 - gy0);
      rect(rail, x, ry0, 7.4, gy1 - ry0);
      rect(fins, x, gy0, 1.3, gy1 - gy0);
      rect(finShade, x + 1.3, gy0, 0.6, gy1 - gy0);
      if (hash(x, k, 7) < 0.62) rect(hash(x, k, 8) < 0.5 ? lit : litWarm, x + 1.9, gy0 + 0.6, 5, ry0 - gy0 - 0.4);
    }
  }
  Object.assign(g, { glass, rail, fins, finShade, cols, wins, bigWins, lit, litWarm, glassMid, glassShadow, railCap });

  // cubierta de botes (k = 0): galería en sombra y botes salvavidas en grupos de 4
  const recess = new Path2D();
  const rx0 = deckAft(0) + 46, rx1 = deckFwd(0) - 70;
  rect(recess, rx0, -83.5, rx1 - rx0, 23);
  g.recess = recess;
  g.recessX = [rx0, rx1];
  g.boats = [];
  let bx = rx0 + 10;
  while (bx + 24 < rx1 - 6) {
    for (let q = 0; q < 4 && bx + 24 < rx1 - 6; q++) { g.boats.push({ x: bx, y: -76.5, w: 24, h: 10 }); bx += 29; }
    bx += 22;
  }
  // ventanitas de la pared fuera de la galería
  const w0 = new Path2D();
  for (let x = deckAft(0) + 6; x < rx0 - 6; x += 9) rect(w0, x, -78, 5, 5);
  for (let x = rx1 + 6; x < deckFwd(0) - 10; x += 9) rect(w0, x, -78, 5, 5);
  g.deck0Wins = w0;

  // ---------------------------------------------------------------- cubierta superior
  const T = TOP_Y;
  g.sunDeck = { x0: deckAft(9) + 8, x1: deckFwd(9) - 16, y: T, h: 5.5 };
  // chimenea: cuerpo inclinado hacia popa con frente redondeado
  const fBase = T - 4, fTop = T - 56;
  const funnel = new Path2D();
  funnel.moveTo(-262, fBase);
  funnel.lineTo(-160, fBase);
  funnel.bezierCurveTo(-166, fBase - 22, -176, fTop + 14, -190, fTop);
  funnel.lineTo(-282, fTop + 1);
  funnel.lineTo(-262, fBase);
  funnel.closePath();
  g.funnel = funnel;
  g.funnelBox = { x0: -282, x1: -160, top: fTop, base: fBase };
  // banda cian (paralelogramo que sigue la inclinación) y tapa
  const fx = (y, side) => {
    const u = (fBase - y) / (fBase - fTop);
    return side < 0 ? -262 - 20 * u : -160 - 30 * Math.pow(u, 1.25);
  };
  g.funnelX = fx;
  const band = new Path2D();
  const b0 = fTop + 16, b1 = fTop + 24;
  band.moveTo(fx(b1, -1), b1); band.lineTo(fx(b1, 1), b1); band.lineTo(fx(b0, 1), b0); band.lineTo(fx(b0, -1), b0); band.closePath();
  g.funnelBand = band;
  const cap = new Path2D();
  const c0 = fTop, c1 = fTop + 6;
  cap.moveTo(fx(c1, -1), c1); cap.lineTo(fx(c1, 1), c1); cap.lineTo(fx(c0, 1) + 2, c0); cap.lineTo(fx(c0, -1), c0); cap.closePath();
  g.funnelCap = cap;
  const pipes = new Path2D();
  rect(pipes, -262, fTop - 7, 6, 8);
  rect(pipes, -246, fTop - 9, 7, 10);
  rect(pipes, -230, fTop - 6, 5, 7);
  g.funnelPipes = pipes;
  g.horn = { x: -186, y: fTop + 10 }; // silbato en el frente de la chimenea
  g.smoke = { x: -246, y: fTop - 9 };
  // pin de marca en la chimenea
  // pin de marca: cabeza de ~40 unidades (≥ 22 px con el barco de 550 px), punta sobre la base de la chimenea
  g.funnelPin = { x: -219, y: fBase - 4, size: 47 };

  // cúpula de vidrio sobre la pileta
  g.dome = { x0: -130, x1: 40, y: T - 5, h: 24 };
  // bloque deportivo / club a proa y puente con alerones
  g.fwdBlock = { x0: 140, x1: 268, y: T - 16, h: 16 };
  g.bridge = { y: deckTop(8) + 1.8, h: 6.5, x0: deckFwd(8) - 70, x1: deckFwd(8) + 2, wing: deckFwd(8) + 10 };
  // mástil con domos de radar
  g.mast = { x: 282, base: T - 16, top: T - 74 };
  // sombrillas en la cubierta de sol
  g.umbrellas = [];
  for (let x = -330, i = 0; x < -170; x += 17, i++) g.umbrellas.push({ x, i });
  for (let x = 60, i = 10; x < 130; x += 17, i++) g.umbrellas.push({ x, i });
  // toboganes: torre y tubos (polilíneas suaves)
  g.slideTower = { x: -352, base: T - 4, top: T - 52 };
  g.slides = [
    { c: 'coral', pts: [[-352, T - 46], [-372, T - 51], [-398, T - 47], [-417, T - 35], [-424, T - 21], [-415, T - 11], [-401, T - 16], [-404, T - 29], [-420, T - 31], [-435, T - 19], [-443, T - 1], [-446, T + 13]] },
    { c: 'gold', pts: [[-352, T - 34], [-366, T - 27], [-382, T - 30], [-394, T - 21], [-389, T - 11], [-377, T - 14], [-380, T - 24], [-397, T - 24], [-408, T - 9], [-414, T + 9]] },
    { c: 'cyan', pts: [[-352, T - 22], [-339, T - 14], [-326, T - 20], [-314, T - 12], [-321, T - 4], [-334, T - 1]] },
  ];
  // versión simple (detail 0–1): dos lazos claros
  g.slidesSimple = [
    { c: 'coral', pts: [[-352, T - 46], [-380, T - 52], [-410, T - 42], [-418, T - 24], [-404, T - 14], [-392, T - 26], [-408, T - 33], [-430, T - 22], [-444, T + 10]] },
    { c: 'gold', pts: [[-352, T - 30], [-370, T - 27], [-384, T - 16], [-376, T - 8], [-366, T - 15], [-378, T - 22], [-396, T - 12], [-404, T + 8]] },
  ];
  // pilotes blancos que sostienen los tubos
  g.slideLegs = [[-398, T - 46, T - 4], [-420, T - 31, T - 4], [-443, T - 1, T + 12], [-366, T - 27, T - 4], [-397, T - 24, T - 4], [-326, T - 20, T - 4]];
  // parantes de la galería de botes
  const posts = new Path2D();
  for (let x = rx0 + 4; x < rx1; x += 29) rect(posts, x, -84, 1.3, 23);
  g.recessPosts = posts;
  // pasarela/barandas del techo de la cubierta de botes (filete)
  return g;
}

/** Ojos de buey en coordenadas locales (x, y, r). */
export function portholes() { return geom().portholes; }
