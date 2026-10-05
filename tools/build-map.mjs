// Precomputa el mapamundi de la escena `map` (equipo MAP) → src/data/world.json.
//   node tools/build-map.mjs
// Proyección Natural Earth 1 a escala 800 con el origen (0, 0) en lon 0 / lat 0: el mundo entero mide
// ~4380 × 2280 px de mapa y la cámara de la escena panea y hace zoom sobre esas coordenadas.
// Salida: tierra en dos resoluciones (path SVG), retícula, contorno de la esfera y los puntos de cada destino.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature, mesh } from 'topojson-client';
import { geoNaturalEarth1, geoGraticule, geoPath } from 'd3-geo';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCALE = 800;
const proj = geoNaturalEarth1().scale(SCALE).translate([0, 0]).precision(0.1);

const atlas = (name) => JSON.parse(readFileSync(join(root, 'node_modules/world-atlas', name), 'utf8'));
const land50 = feature(atlas('land-50m.json'), atlas('land-50m.json').objects.land);
const land110 = feature(atlas('land-110m.json'), atlas('land-110m.json').objects.land);

// Contexto que junta los anillos proyectados (d3 los pasa ya cortados en el antimeridiano).
function rings(geo) {
  const out = [];
  let cur = null;
  const ctx = {
    moveTo(x, y) { cur = [[x, y]]; out.push(cur); },
    lineTo(x, y) { cur.push([x, y]); },
    closePath() {},
    arc() {}, rect() {},
  };
  geoPath(proj, ctx)(geo);
  return out;
}

// Simplificación radial (distancia mínima entre vértices) + descarte de islitas sin área visible.
function simplify(rs, tol, minArea) {
  const res = [];
  for (const r of rs) {
    let a = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
    if (Math.abs(a / 2) < minArea) continue;
    const k = [r[0]];
    for (let i = 1; i < r.length - 1; i++) {
      const p = k[k.length - 1];
      if (Math.hypot(r[i][0] - p[0], r[i][1] - p[1]) >= tol) k.push(r[i]);
    }
    k.push(r[r.length - 1]);
    if (k.length >= 3) res.push(k);
  }
  return res;
}

const f1 = (v) => +v.toFixed(1);
function toPath(rs) {
  return rs.map((r) => 'M' + r.map((p, i) => (i ? 'L' : '') + f1(p[0]) + ' ' + f1(p[1])).join('').replace(/^L/, '') + 'Z').join('');
}
function bbox(rs) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rs) for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [f1(x0), f1(y0), f1(x1), f1(y1)];
}

const countries = atlas('countries-50m.json');
// fronteras interiores (solo entre países): líneas abiertas, no anillos
const borderGeo = mesh(countries, countries.objects.countries, (a, b) => a !== b);

// Ensenadas angostas que se cierran (vértices del anillo entre dos orillas [lon, lat] de la boca): a la escala
// del mapa son canales de 1–2 px que, de cerca y con el grade cálido del corte, se leían como un trazo oscuro
// «tipo anzuelo» arriba del pin de Buenos Aires. El río Uruguay y el canal del delta del Paraná se tapan desde
// la punta del estuario (la costa del Río de la Plata queda limpia y nítida).
const INLETS = [
  [[-58.204, -34.109], [-58.387, -34.194]],   // río Uruguay + delta del Paraná (orillas de Entre Ríos y Buenos Aires)
];
function closeInlets(rs) {
  for (const [a, b] of INLETS) {
    const pa = proj(a), pb = proj(b);
    let best = null;
    rs.forEach((r, ri) => {
      let ia = -1, ib = -1, da = Infinity, db = Infinity;
      r.forEach(([x, y], i) => {
        const d1 = Math.hypot(x - pa[0], y - pa[1]), d2 = Math.hypot(x - pb[0], y - pb[1]);
        if (d1 < da) { da = d1; ia = i; }
        if (d2 < db) { db = d2; ib = i; }
      });
      if (da < 1.5 && db < 1.5 && (!best || da + db < best.d)) best = { ri, ia, ib, d: da + db };
    });
    if (!best) throw new Error(`ensenada no encontrada: ${JSON.stringify([a, b])}`);
    const r = rs[best.ri];
    const i0 = Math.min(best.ia, best.ib), i1 = Math.max(best.ia, best.ib);
    // se saca el arco más corto entre las dos orillas (la ensenada), no el resto del continente
    if (i1 - i0 > r.length / 2) throw new Error('ensenada: el arco corto cruza el inicio del anillo');
    r.splice(i0 + 1, i1 - i0 - 1);
  }
  return rs;
}

const hi = closeInlets(simplify(rings(land50), 0.32, 0.25));
const lo = simplify(rings(land110), 0.9, 2);

// fronteras: polilíneas simplificadas (sin filtro de área)
function simplifyLines(ls, tol) {
  return ls.map((r) => {
    const k = [r[0]];
    for (let i = 1; i < r.length - 1; i++) {
      const p = k[k.length - 1];
      if (Math.hypot(r[i][0] - p[0], r[i][1] - p[1]) >= tol) k.push(r[i]);
    }
    k.push(r[r.length - 1]);
    return k;
  }).filter((r) => r.length >= 2);
}
const borders = simplifyLines(rings(borderGeo), 0.7);
const toLinePath = (ls) => ls.map((r) => 'M' + r.map((p, i) => (i ? 'L' : '') + f1(p[0]) + ' ' + f1(p[1])).join('').replace(/^L/, '')).join('');

// luces de ciudades (puntitos dorados): grandes ciudades y puertos, [lon, lat, peso]
const CITIES = [
  [-58.4, -34.6, 1], [-56.2, -34.9, 0.7], [-57.9, -34.9, 0.5], [-60.7, -32.9, 0.6], [-64.2, -31.4, 0.6], [-68.8, -32.9, 0.5],
  [-57.5, -38, 0.5], [-62.3, -38.7, 0.4], [-65.4, -24.8, 0.4], [-43.2, -22.9, 1], [-46.6, -23.5, 1], [-51.2, -30, 0.6],
  [-49.3, -25.4, 0.5], [-48.5, -27.6, 0.4], [-38.5, -12.97, 0.7], [-34.9, -8.05, 0.6], [-38.5, -3.7, 0.6], [-47.9, -15.8, 0.6],
  [-44, -19.9, 0.6], [-60, -3.1, 0.5], [-48.5, -1.45, 0.5], [-70.6, -33.4, 0.8], [-71.6, -33, 0.5], [-77, -12.05, 0.8],
  [-78.5, -0.2, 0.5], [-74.1, 4.7, 0.8], [-75.6, 6.25, 0.5], [-66.9, 10.5, 0.7], [-79.5, 9, 0.5], [-90.5, 14.6, 0.5],
  [-99.1, 19.4, 1], [-103.3, 20.7, 0.6], [-100.3, 25.7, 0.6], [-86.8, 21.2, 0.5], [-82.4, 23.1, 0.6], [-69.9, 18.5, 0.6],
  [-66.1, 18.4, 0.6], [-76.8, 18, 0.4], [-80.2, 25.8, 0.8], [-84.4, 33.7, 0.6], [-95.4, 29.8, 0.7], [-97, 32.8, 0.6],
  [-90.1, 30, 0.5], [-77, 38.9, 0.7], [-74, 40.7, 1], [-71.1, 42.4, 0.7], [-87.6, 41.9, 0.8], [-79.4, 43.7, 0.7],
  [-73.6, 45.5, 0.6], [-118.2, 34, 0.9], [-122.4, 37.8, 0.7], [-0.1, 51.5, 1], [2.35, 48.85, 1], [-3.7, 40.4, 0.8],
  [2.17, 41.4, 0.7], [-9.14, 38.7, 0.6], [12.5, 41.9, 0.8], [9.2, 45.5, 0.7], [14.25, 40.85, 0.5], [5.4, 43.3, 0.5],
  [13.4, 52.5, 0.8], [4.9, 52.4, 0.6], [16.4, 48.2, 0.6], [21, 52.2, 0.6], [23.7, 37.98, 0.7], [28.98, 41, 0.9],
  [32.85, 39.9, 0.5], [31.2, 30, 0.9], [29.9, 31.2, 0.6], [35.5, 33.9, 0.5], [34.8, 32.1, 0.5], [46.7, 24.7, 0.7],
  [39.2, 21.5, 0.6], [51.5, 25.3, 0.5], [54.4, 24.5, 0.5], [55.3, 25.2, 0.9], [58.4, 23.6, 0.5], [44.4, 33.3, 0.6],
  [51.4, 35.7, 0.8], [67, 24.9, 0.8], [72.9, 19.1, 0.9], [77.2, 28.6, 0.9], [88.4, 22.6, 0.7], [80.3, 13.1, 0.6],
  [-7.6, 33.6, 0.6], [3.05, 36.75, 0.5], [10.2, 36.8, 0.5], [13.2, 32.9, 0.4], [-17.4, 14.7, 0.5], [3.4, 6.5, 0.8],
  [-0.2, 5.6, 0.5], [36.8, -1.3, 0.6], [39.3, -6.8, 0.5], [28, -26.2, 0.8], [18.4, -33.9, 0.7], [31, -29.9, 0.5],
  [13.2, -8.8, 0.5], [15.3, -4.3, 0.6], [32.6, 0.3, 0.4], [38.7, 9, 0.6], [45.3, 2, 0.4], [47.5, -18.9, 0.4],
  [37.6, 55.75, 0.9], [30.3, 59.9, 0.7], [30.5, 50.45, 0.6], [24.1, 56.95, 0.4], [18.1, 59.3, 0.6], [10.75, 59.9, 0.5],
  [-6.26, 53.35, 0.5], [-4.25, 55.85, 0.4], [12.6, 55.7, 0.5],
];
const cities = CITIES.map(([lon, lat, w]) => [...proj([lon, lat]).map(f1), w]);

// retícula cada 15° (meridianos y paralelos), muestreada fina para que curve bien
const grat = geoGraticule().step([15, 15]).precision(1.5).lines();
const gratLines = grat.map((g) => rings(g).flat().flatMap(([x, y]) => [f1(x), f1(y)]));
const outline = rings({ type: 'Sphere' })[0].flatMap(([x, y]) => [f1(x), f1(y)]);

// destinos [lon, lat]
const LL = {
  ba: [-58.38, -34.6],        // Buenos Aires
  mvd: [-56.17, -34.9],       // Montevideo
  pde: [-54.95, -34.96],      // Punta del Este
  rio: [-43.17, -22.91],      // Río de Janeiro
  car: [-64.93, 18.34],       // Caribe (Saint Thomas)
  eu: [25.43, 36.4],          // Mediterráneo (Santorini)
  dxb: [55.27, 25.2],         // Dubái
  ush: [-68.3, -54.8],        // Ushuaia
  ant: [-62.6, -64.6],        // Península Antártica (Neko Harbour)
  // referencias para curvar rutas por mar
  recife: [-32.5, -7.5],
  gib: [-5.6, 35.95],
  suez: [32.55, 29.95],
  hormuz: [56.6, 26.4],
  horn: [-67.3, -56.1],
};
const places = Object.fromEntries(Object.entries(LL).map(([k, ll]) => [k, proj(ll).map(f1)]));

// RUTAS POR MAR: puntos de paso [lon, lat] sobre el océano (el primero y el último son los puertos). La escena
// traza una Catmull-Rom centrípeta por estos puntos (src/scenes/map/routegeo.js) y la prueba
// src/scenes/map/_route-land-test.mjs verifica que ninguna ruta pise tierra.
const P = LL;
const PLATA_OUT = [[-57.9, -34.72], [-57.05, -35.08]];               // salida del Río de la Plata
const GIB_MED = [                                                    // Gibraltar → Mediterráneo → Santorini
  [-8.6, 35.9], [-5.6, 35.95], [-3.2, 36.15], [2.0, 37.3], [7.6, 37.75], [11.55, 37.42], [14.75, 36.3],
  [18.6, 35.95], [23.15, 36.02], [24.6, 36.25],
];
const SEA = {
  A: [P.ba, ...PLATA_OUT, [-55.95, -35.15], P.pde],
  B: [P.pde, [-53.7, -35.35], [-50.9, -33.5], [-48.0, -29.2], [-45.6, -25.4], [-43.6, -23.45], P.rio],
  C: [P.rio, [-42.0, -23.75], [-38.6, -19.6], [-36.3, -13.2], [-34.1, -7.4], [-34.0, -3.2], [-40.5, 1.9],
    [-49.0, 5.6], [-55.5, 9.1], [-58.6, 14.4], [-61.1, 18.7], [-63.9, 19.25], [-64.85, 18.8], P.car],
  D: [P.car, [-64.3, 19.7], [-57.5, 24.8], [-42.0, 31.6], [-24.5, 34.6], ...GIB_MED, P.eu],
  E: [P.eu, [25.9, 35.95], [26.62, 35.42], [29.4, 33.6], [32.1, 31.6], [32.33, 30.95], [32.55, 29.9],
    [32.62, 29.55], [33.0, 28.9], [33.55, 28.2], [34.3, 27.3], [36.3, 24.6], [38.6, 20.6], [40.9, 16.6],
    [42.7, 13.9], [43.33, 12.6], [44.6, 12.25], [47.5, 12.5], [51.0, 13.4], [54.5, 14.75], [57.4, 16.9],
    [59.4, 19.6], [60.25, 22.35], [58.3, 24.45], [56.95, 25.8], [56.55, 26.52], [55.95, 26.1], [55.45, 25.5], P.dxb],
  F: [P.ba, ...PLATA_OUT, [-56.55, -35.75], [-55.8, -37.6], [-58.4, -41.2], [-61.4, -45.6], [-64.4, -50.5],
    [-63.55, -54.2], [-62.8, -55.7], [-62.3, -59.6], [-63.6, -62.4], [-63.15, -64.05], P.ant],
  G: [P.ba, ...PLATA_OUT, [-56.0, -35.5], [-50.6, -34.4], [-40.3, -24.1], [-32.2, -8.6], [-27.6, 2.0],
    [-21.6, 12.9], [-20.0, 21.0], [-19.6, 27.6], [-14.2, 33.4], ...GIB_MED, P.eu],
};
const routes = Object.fromEntries(Object.entries(SEA).map(([k, wp]) => [k, wp.map((ll) => proj(ll).map(f1))]));

// AGUAS BAJAS: polígonos [lon, lat] que la escena pinta en un turquesa medio (desenfocado, debajo de la tierra,
// que tapa lo que se mete en la costa). El Río de la Plata es un estuario playo: pintado como el océano profundo,
// de cerca era una cuña oscura que «señalaba» el pin de Buenos Aires; claro, se lee como agua de costa.
const SHALLOW = {
  plata: [
    [-58.9, -34.0], [-58.2, -33.85], [-57.5, -34.2], [-56.9, -34.45], [-56.2, -34.72], [-55.5, -34.75],
    [-54.95, -34.85], [-54.85, -35.15], [-55.6, -35.5], [-56.35, -36.05], [-56.75, -36.45], [-57.35, -36.2],
    [-57.55, -35.5], [-58.05, -35.0], [-58.6, -34.85], [-59.1, -34.4],
  ],
};
const shallow = Object.fromEntries(Object.entries(SHALLOW).map(([k, ll]) => [k, ll.map((p) => proj(p).map(f1))]));

const world = {
  _: 'Generado por tools/build-map.mjs (no editar a mano). Natural Earth 1, escala 800, origen en lon 0 / lat 0.',
  scale: SCALE,
  bounds: bbox(hi),
  land: toPath(hi),
  landLo: toPath(lo),
  graticule: gratLines,
  outline,
  borders: toLinePath(borders),
  cities,
  places,
  lonlat: LL,
  routes,
  routesLL: SEA,
  shallow,
};
const outFile = join(root, 'src/data/world.json');
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(world));
const nPts = hi.reduce((s, r) => s + r.length, 0);
console.log(JSON.stringify({
  out: outFile, bytes: JSON.stringify(world).length, rings: hi.length, points: nPts,
  ringsLo: lo.length, pointsLo: lo.reduce((s, r) => s + r.length, 0), bounds: world.bounds, places,
}, null, 1));
