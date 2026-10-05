// Datos del mapamundi (precomputados por tools/build-map.mjs) y sus Path2D, armados una sola vez.
// Coordenadas «de mapa»: Natural Earth 1 a escala 800, origen en lon 0 / lat 0 (x → este, y → sur).
import WORLD from '../../data/world.json' with { type: 'json' };

export const PLACES = WORLD.places;
export const BOUNDS = WORLD.bounds;
export const CITIES = WORLD.cities;
/** Rutas por mar: puntos de paso proyectados (tools/build-map.mjs). */
export const ROUTES = WORLD.routes;
/** Aguas bajas (estuarios playos) en coordenadas de mapa: { nombre: [[x, y], …] }. */
export const SHALLOW = WORLD.shallow ?? {};

let built = null;
/** Path2D de la tierra (alta y baja resolución), retícula y contorno de la esfera. */
export function geo() {
  if (built) return built;
  const grat = new Path2D();
  for (const l of WORLD.graticule) {
    for (let i = 0; i < l.length; i += 2) (i ? grat.lineTo(l[i], l[i + 1]) : grat.moveTo(l[i], l[i + 1]));
  }
  const outline = new Path2D();
  const o = WORLD.outline;
  for (let i = 0; i < o.length; i += 2) (i ? outline.lineTo(o[i], o[i + 1]) : outline.moveTo(o[i], o[i + 1]));
  outline.closePath();
  built = { land: new Path2D(WORLD.land), landLo: new Path2D(WORLD.landLo), borders: new Path2D(WORLD.borders), grat, outline };
  return built;
}
