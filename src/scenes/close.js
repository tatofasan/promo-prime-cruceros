// Cierre 26,0–30,0 (equipo CLOSE): la segunda ola (CLOSE_WAVE, de izquierda a derecha) revela el atardecer dorado
// con el crucero en el horizonte. El pin de marca cae DIRECTO en la «o» de cruceros (26,283), la placa blanca nace
// de él y se estira, y las letras hacen pop en cascada desde el pin hacia afuera (logo completo en 26,69, barrido
// en close.word). URL tipeada debajo de la placa, CTA de WhatsApp y golpe final; hasta 30,0 el cuadro sigue vivo
// y el FONDO va con el groove (la marca, la URL y el CTA quedan quietos en su cámara): golpe de zoom con rebote y
// anticipación en cada bombo, vaivén de cubierta, mar que empuja después de cada golpe, ola de luz y destellos que
// viajan, barco que avanza, gaviotas cercanas con parallax y barrido en 29,06. Métrica oficial (tools/energy.mjs):
// todos los beats de 26,72 a 30 ≥ 3,8.
// Contrato: docs/PLAN.md §6.6. Piezas en src/scenes/close/.
import { E, prog, TAU } from '../engine/ease.js';
import { plane, handheld } from '../engine/camera.js';
import { beatPulse, BEAT, W } from '../engine/time.js';
import { drawWaveMask, drawWaveCrest, waveGeom } from '../art/index.js';
import { CLOSE_WAVE } from './waves.js';
import { lockupGeo, T_IN, T_WORD, T_CTA, T_FIN } from './close/layout.js';
import { drawLockup, initLockup } from './close/lockup.js';
import { drawPinDrop, drawLandingLight } from './close/pin-drop.js';
import { drawCta, drawCtaBurst, initCta } from './close/cta.js';
import { drawCtaGlow } from './close/cta-glow.js';
import { initBackdrop, drawBackdrop } from './close/backdrop.js';
import { LOOK } from './close/look.js';

// bombo visual: un golpe por beat que crece un poco hacia el final (el groove de la última frase)
const groove = (t) => 1 + 0.3 * prog(t, 27.9, 29.4);
const KICK_DECAY = 0.13;
const kickAt = (t) => beatPulse(t, { from: T_IN, every: 1, decay: KICK_DECAY }) * groove(t);
// anticipación de cada bombo (§5): en los últimos 0,14 s del beat el fondo «toma aire» (se abre y se apaga un
// poco) y el golpe sale desde ahí. De close.word al stinger (29,53): antes la ola y el logo mandan, y después del
// último golpe no hay nada que anticipar (el cuadro no se apaga al final).
const ANT = 0.14;
const LAST_KICK = T_IN + 7 * BEAT; // 29,53 (stinger): después no hay otro golpe que anticipar
function anticipAt(t) {
  if (t < T_WORD - ANT || t > LAST_KICK + 0.1) return 0;
  const dt = (t - T_IN) % BEAT;
  const u = (dt - (BEAT - ANT)) / ANT;
  return u > 0 ? Math.pow(Math.sin((Math.PI / 2) * u), 2) * groove(t) : 0;
}
// luz del bombo: el mismo golpe con una cola más larga (el atardecer «respira» todo el beat)
const kickLightAt = (t) => beatPulse(t, { from: T_IN, every: 1, decay: 0.22 }) * groove(t) - 0.22 * anticipAt(t);
// rebote del bombo para la cámara del fondo: golpe seco en el beat, vuelve pasándose un poco y asienta
function kickBumpAt(t) {
  if (t < T_IN) return 0;
  const dt = (t - T_IN) % BEAT;
  return Math.exp(-dt * 6.2) * Math.cos(dt * TAU * 2.05) * groove(t) - 0.4 * anticipAt(t);
}
// tiempo del MAR: corre más rápido después de cada bombo (el oleaje «empuja» con el groove: hasta ~3,5× y vuelve
// en ~0,4 s). Integral cerrada del pulso (monótona: sigue siendo función pura de t).
const SEA_SURGE = 2.6, SEA_DECAY = 0.2;
function seaTimeAt(t) {
  if (t < T_IN) return t;
  const n = Math.floor((t - T_IN) / BEAT + 1e-9);
  const local = t - T_IN - n * BEAT;
  const full = SEA_DECAY * (1 - Math.exp(-BEAT / SEA_DECAY));
  return t + SEA_SURGE * groove(t) * (n * full + SEA_DECAY * (1 - Math.exp(-local / SEA_DECAY)));
}

// cámara del fondo: la ola la deja «adentro» (z 1,1) y se abre hasta 1; después dolly lento 1 → 1,03, deriva en
// mano, vaivén de cubierta y un golpe de zoom con rebote en cada bombo (sólo el fondo: la marca y el CTA van en
// su propia cámara y no se mueven)
function bgCam(t) {
  const reveal = 0.1 * (1 - E.outCubic(prog(t, 26.0, 26.95)));
  const push = 0.03 * E.inOutSine(prog(t, T_WORD, 30.0));
  const bump = kickBumpAt(t);
  const c = handheld({ x: 0, y: 0, z: 1 + reveal + push + 0.042 * bump }, t, { amp: 12, hz: 0.7, rollAmp: 0.0026, seed: 41 });
  // vaivén de cubierta: el fondo se mece una vez cada dos beats (el mar de adelante sube y baja, el horizonte rola)
  const on = E.inOutSine(prog(t, T_IN, T_WORD));
  const sway = Math.sin((Math.PI * (t - T_IN)) / BEAT);
  c.y += -20 * bump + 30 * sway * on;
  c.r += 0.0045 * Math.sin((Math.PI * (t - T_IN)) / BEAT + 0.6) * on;
  return c;
}
// cámara de la marca: dolly-out 1,08 → 1 mientras nace el logo (quieta desde 26,70) y después casi quieta
// (deriva ≤ 2 px y empuje de 0,6 %: la URL y el CTA se mueven < 6 px en todo el tramo)
export function uiCam(t) {
  const dolly = 0.08 * (1 - E.outCubic(prog(t, T_IN, T_WORD - 0.02)));
  const push = 0.006 * E.inOutSine(prog(t, T_WORD, 30.0));
  return handheld({ x: 0, y: 0, z: 1 + dolly + push }, t, { amp: 1.4, hz: 0.25, rollAmp: 0.0002, seed: 42 });
}

// x de pantalla de la cresta de la segunda ola (ltr: el lienzo canónico va espejado) · +∞ si no hay ola
function crestScreenX(t) {
  if (t < CLOSE_WAVE.t0) return -Infinity;
  if (t > CLOSE_WAVE.t1) return Infinity;
  return W - waveGeom(CLOSE_WAVE.p(t), { dir: CLOSE_WAVE.dir }).crest[0];
}

// flare del sol: vivo desde la revelación, sube hacia el golpe final, pico (1,5) en close.final y queda alto
function flareAt(t) {
  if (t < T_FIN) return 0.55 + 0.35 * E.inQuad(prog(t, T_CTA - 0.3, T_FIN));
  return 0.8 + 0.7 * Math.exp(-(t - T_FIN) * 2.2);
}
const sunPulseAt = (t) => 0.5 * kickAt(t) + (t >= T_FIN ? 0.9 * Math.exp(-(t - T_FIN) * 3) : 0);
const glintAt = (t) => (t >= T_FIN ? Math.exp(-(t - T_FIN) * 1.6) : 0);

const scene = {
  id: 'close',
  team: 'CLOSE',
  from: 26.0,
  to: 30.0,
  maskUntil: CLOSE_WAVE.t1, // después de la ola la máscara es todo el cuadro: no se paga
  z: 90,
  async init() {
    await initBackdrop();
    const G = lockupGeo();
    initLockup(G);
    initCta(G);
  },
  draw(ctx, t) {
    const G = lockupGeo();
    drawBackdrop(ctx, t, bgCam, { flare: flareAt(t), sunPulse: sunPulseAt(t), horn: T_FIN - 0.12, glint: glintAt(t), kick: kickAt(t), light: kickLightAt(t), seaT: seaTimeAt(t), groove: groove(t) });
    plane(ctx, uiCam(t), 1, (c) => {
      drawLockup(c, t, G, (c2) => drawLandingLight(c2, t, G));
      drawCtaGlow(c, t, G);
      drawCtaBurst(c, t, G);
      drawCta(c, t, G);
      // el pin va en la escena (no en over): la máscara de la ola lo recorta y la cresta lo tapa; además no se
      // dibuja hasta que la CRESTA pasó su x (26,25): nunca asoma por encima del lomo de la ola
      drawPinDrop(c, t, G, { hideRightOf: crestScreenX(t) });
    });
  },
  mask(ctx, t) {
    drawWaveMask(ctx, CLOSE_WAVE.p(t), { dir: CLOSE_WAVE.dir });
  },
  over(ctx, t) {
    if (CLOSE_WAVE.active(t)) drawWaveCrest(ctx, t, CLOSE_WAVE.p(t), { dir: CLOSE_WAVE.dir, preset: LOOK });
  },
};
export default scene;
