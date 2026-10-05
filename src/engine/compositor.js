// Compositor: arma el cuadro t a partir de las escenas activas (src/scenes/index.js), aplica los golpes
// globales (fx) y la terminación (grade). Es lo único que corre por cuadro además de las escenas.
//
// Contrato de una escena (ver docs/PLAN.md §7):
//   export default {
//     id: 'pool', team: 'DECK-A', from: 5.625, to: 7.5, z: 30,
//     async init() {}            // precomputar paths, cargar imágenes (una vez)
//     draw(ctx, t) {}            // pinta la escena COMPLETA en t sobre ctx (1920×1080, transformación identidad)
//     mask(ctx, t) {}            // opcional: si existe, la escena se recorta con el alfa de lo que pinte mask
//     maskFrom, maskUntil        // opcional: la máscara solo se aplica en [maskFrom, maskUntil] (ahorra 3 pasadas)
//     over(ctx, t) {}            // opcional: se pinta encima después (crestas de ola, borde de un iris…)
//     overAbove                  // opcional (o en OVER_ABOVE de index.js): el over va en una pasada FINAL, encima
//                                // de todas las escenas (por ejemplo la cresta de la ola tapando los titulares)
//   }
// Las escenas se dibujan en orden de z (menor primero) mientras from ≤ t < to.
import { SCENES, OVER_ABOVE } from '../scenes/index.js';
import { resetLayers, layer } from './layer.js';
import { fxAt } from './fx.js';
import { applyGrade } from './grade.js';
import { W, H, DUR, FPS, BPM, BEAT, BAR, CUES, SECTIONS, FORMAT } from './time.js';

export const BASE = '#04101F';
export const errors = [];

export async function initScenes() {
  for (const s of SCENES) {
    if (s.init) await s.init();
  }
}

export function activeScenes(t) {
  return SCENES
    .filter((s) => t >= s.from - 1e-9 && (t < s.to - 1e-9 || (s.to >= DUR && t <= DUR + 1e-9)))
    .sort((a, c) => (a.z ?? 0) - (c.z ?? 0));
}

export const info = () => ({
  FORMAT, W, H, DUR, FPS, BPM, BEAT, BAR, cues: CUES, sections: SECTIONS,
  scenes: SCENES.map((s) => ({ id: s.id, team: s.team, from: s.from, to: s.to, z: s.z ?? 0 })),
});

const maskOn = (s, t) => !!s.mask && (s.maskFrom === undefined || t >= s.maskFrom) && (s.maskUntil === undefined || t <= s.maskUntil);

function drawScene(sc, s, t) {
  if (maskOn(s, t)) {
    const L = layer();
    const lc = L.getContext('2d');
    s.draw(lc, t);
    const M = layer();
    s.mask(M.getContext('2d'), t);
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalAlpha = 1;
    lc.globalCompositeOperation = 'destination-in';
    lc.drawImage(M, 0, 0);
    sc.drawImage(L, 0, 0);
  } else {
    sc.save();
    s.draw(sc, t);
    sc.restore();
  }
  if (s.over && !overAbove(s)) {
    sc.save();
    s.over(sc, t);
    sc.restore();
  }
}

const overAbove = (s) => !!s.overAbove || OVER_ABOVE.includes(s.id);

/**
 * Dibuja el cuadro t en `out` (contexto 2D de W×H).
 * strict = true (render final / herramientas): un error en una escena corta todo.
 * strict = false (vista previa): la escena rota se marca en rojo y el resto sigue.
 */
export function renderFrame(out, t, { strict = false, fx = true, grade = true } = {}) {
  resetLayers();
  const stage = layer();
  const sc = stage.getContext('2d');
  sc.fillStyle = BASE;
  sc.fillRect(0, 0, W, H);
  const act = activeScenes(t);
  const late = act.filter((s) => s.over && overAbove(s));
  for (const s of [...act, ...late.map((x) => ({ lateOver: x }))]) {
    try {
      if (s.lateOver) { sc.save(); s.lateOver.over(sc, t); sc.restore(); continue; }
      drawScene(sc, s, t);
    } catch (e) {
      if (strict) throw new Error(`escena ${s.id ?? s.lateOver?.id} en t=${t.toFixed(3)}: ${e?.stack || e}`);
      const msg = `${s.id ?? s.lateOver?.id} @${t.toFixed(2)}: ${e?.message || e}`;
      if (!errors.includes(msg)) { errors.push(msg); console.error(e); }
      sc.save();
      sc.setTransform(1, 0, 0, 1, 0, 0);
      sc.fillStyle = 'rgba(200,0,0,0.85)';
      sc.fillRect(20, 20 + 40 * (errors.length % 8), 1200, 34);
      sc.fillStyle = '#fff';
      sc.font = '600 22px Outfit';
      sc.fillText(msg.slice(0, 110), 30, 44 + 40 * (errors.length % 8));
      sc.restore();
    }
  }

  out.save();
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalAlpha = 1;
  out.globalCompositeOperation = 'source-over';
  out.filter = 'none';
  out.fillStyle = BASE;
  out.fillRect(0, 0, W, H);
  const f = fx ? fxAt(t) : { flash: 0, shake: 0, punch: 0, rgb: 0, sx: 0, sy: 0, sr: 0 };
  // sobre-escaneo: el sacudón nunca deja ver bordes
  const over = 2 * Math.max(Math.abs(f.sx) / W, Math.abs(f.sy) / H) + Math.abs(f.sr) * 1.2;
  const z = 1 + f.punch + over;
  out.translate(W / 2 + f.sx, H / 2 + f.sy);
  if (f.sr) out.rotate(f.sr);
  out.scale(z, z);
  out.translate(-W / 2, -H / 2);
  if (f.rgb > 0.01) rgbSplit(out, stage, f.rgb * 9);
  else out.drawImage(stage, 0, 0);
  out.restore();

  if (f.flash > 0.002) {
    out.save();
    out.globalCompositeOperation = 'screen';
    out.globalAlpha = f.flash;
    const g = out.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.75);
    g.addColorStop(0, f.flashColor);
    g.addColorStop(1, f.flashColor + '99');
    out.fillStyle = g;
    out.fillRect(0, 0, W, H);
    out.restore();
  }
  if (grade) applyGrade(out, t);
}

function rgbSplit(out, stage, d) {
  const chan = (color) => {
    const L = layer();
    const c = L.getContext('2d');
    c.drawImage(stage, 0, 0);
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = color;
    c.fillRect(0, 0, W, H);
    return L;
  };
  const R = chan('#ff0000'), G = chan('#00ff00'), B = chan('#0000ff');
  out.fillStyle = '#000';
  out.fillRect(0, 0, W, H);
  out.globalCompositeOperation = 'lighter';
  out.drawImage(R, d, 0);
  out.drawImage(G, 0, 0);
  out.drawImage(B, -d, 0);
  out.globalCompositeOperation = 'source-over';
}
