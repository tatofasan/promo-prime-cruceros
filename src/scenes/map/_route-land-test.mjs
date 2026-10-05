// Prueba automática del equipo MAP: NINGUNA ruta pisa tierra.
//   node src/scenes/map/_route-land-test.mjs            (--step=1 grados · --fine para ver también cada 0,1°)
// Toma la curva EXACTA que dibuja la escena (puntos de paso de world.json + Catmull-Rom de routegeo.js), la
// lleva a lon/lat con la inversa de la proyección (d3-geo) y la muestrea cada `step` grados de arco. Cada
// muestra se prueba contra la tierra de world.json (la que se ve en pantalla, en coordenadas de mapa) y contra
// la tierra 50m original de world-atlas (d3.geoContains). Exentos: los puertos de origen y destino (radio
// chico, porque el puerto está en la costa) y el canal de Suez (vía navegable que el dato de tierra cierra).
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoNaturalEarth1, geoDistance, geoContains, geoInterpolate } from 'd3-geo';
import { feature } from 'topojson-client';
import { buildLeg } from './routegeo.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const STEP = Number(flags.step ?? 1);
const WORLD = JSON.parse(readFileSync(join(root, 'src/data/world.json'), 'utf8'));
const proj = geoNaturalEarth1().scale(WORLD.scale).translate([0, 0]);
const atlas = JSON.parse(readFileSync(join(root, 'node_modules/world-atlas/land-50m.json'), 'utf8'));
const land50 = feature(atlas, atlas.objects.land);

// tierra de world.json → anillos con caja (par-impar, respeta los huecos como el Caspio)
const rings = [];
for (const sub of WORLD.land.split('M').filter(Boolean)) {
  const nums = sub.replace(/[LZ]/g, ' ').trim().split(/\s+/).map(Number);
  const r = [];
  for (let i = 0; i + 1 < nums.length; i += 2) r.push([nums[i], nums[i + 1]]);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  rings.push({ r, x0, y0, x1, y1 });
}
function onLandMap(x, y) {
  let inside = false;
  for (const R of rings) {
    if (x < R.x0 || x > R.x1 || y < R.y0 || y > R.y1) continue;
    const r = R.r;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

const LEGS = { A: ['ba', 'pde'], B: ['pde', 'rio'], C: ['rio', 'car'], D: ['car', 'eu'], E: ['eu', 'dxb'], F: ['ba', 'ant'], G: ['ba', 'eu'] };
const PORT_R = { default: 0.6 };
const CANALS = [{ name: 'canal de Suez', lon: [32.15, 32.75], lat: [29.85, 31.35] }];
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

function sampleLeg(id, step) {
  const L = buildLeg(WORLD.routes[id]);
  // polilínea densa → lon/lat → muestras cada `step` grados de arco (interpolando por gran círculo)
  const ll = L.pts.map((p) => proj.invert(p));
  const out = [];
  let acc = 0, next = 0;
  for (let i = 1; i < ll.length; i++) {
    const d = deg(geoDistance(ll[i - 1], ll[i]));
    const it = geoInterpolate(ll[i - 1], ll[i]);
    while (next <= acc + d + 1e-9) { out.push(it(d > 0 ? (next - acc) / d : 0)); next += step; }
    acc += d;
  }
  out.push(ll[ll.length - 1]);
  return { samples: out, arc: acc };
}

function testLeg(id, step) {
  const [a, b] = LEGS[id];
  const ends = [WORLD.lonlat[a], WORLD.lonlat[b]];
  const { samples, arc } = sampleLeg(id, step);
  const bad = [];
  const exempt = [];
  for (const ll of samples) {
    const [x, y] = proj(ll);
    const hitMap = onLandMap(x, y), hit50 = geoContains(land50, ll);
    if (!hitMap && !hit50) continue;
    const port = ends.some((e) => deg(geoDistance(e, ll)) <= (PORT_R[a] ?? PORT_R.default));
    const canal = CANALS.find((c) => ll[0] >= c.lon[0] && ll[0] <= c.lon[1] && ll[1] >= c.lat[0] && ll[1] <= c.lat[1]);
    if (port || canal) { exempt.push(canal ? canal.name : 'puerto'); continue; }
    bad.push({ lon: +ll[0].toFixed(2), lat: +ll[1].toFixed(2), worldJson: hitMap, land50m: hit50 });
  }
  return { leg: id, from: a, to: b, arcDeg: +arc.toFixed(1), samples: samples.length, onLand: bad.length, exempt: exempt.join(', ') || 'ninguna', bad: bad.slice(0, 12) };
}

const res = Object.keys(LEGS).map((id) => testLeg(id, STEP));
const report = { step: STEP, ok: res.every((r) => r.onLand === 0), legs: res };
if (flags.fine) report.fine = Object.keys(LEGS).map((id) => testLeg(id, 0.1)).map(({ leg, samples, onLand, bad }) => ({ leg, samples, onLand, bad }));
console.log(JSON.stringify(report, null, 1));
process.exit(report.ok ? 0 : 1);
