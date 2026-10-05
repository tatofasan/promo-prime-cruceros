// Tonos propios de DECK-B derivados de PAL: paño teal del casino y terciopelo del telón.
// (El teal y el carmesí no están en PAL: los pide el storyboard; todo lo demás sale de la paleta oficial.)
import { PAL, mixHex, shade } from '../../engine/color.js';

export const DB = {
  // paño de casino (teal: océano con un toque de verde)
  feltDeep: '#043A3F',
  feltDark: '#06505A',
  felt: '#0A6A72',
  feltLight: '#14878A',
  feltHi: '#3FB5A8',
  // terciopelo del telón (coral profundo hacia el dusk)
  velvetDeep: '#2A0618',
  velvetDark: '#4E0B24',
  velvet: '#86162F',
  velvetLight: '#B92A3E',
  velvetHi: '#F0645A',
  // metal dorado (latón)
  brassDeep: '#5E3A0C',
  brassDark: '#9C6516',
  brass: PAL.gold,
  brassLight: PAL.goldLight,
  brassHi: PAL.goldPale,
  // laca navy de la ruleta
  lacq: PAL.navy700,
  lacqDark: PAL.navy900,
  lacqLight: PAL.navy500,
  // fichas
  chipCoral: PAL.coral,
  chipNavy: PAL.navy600,
  chipGold: PAL.gold,
  chipTeal: '#0E8C8C',
  chipWhite: PAL.warmWhite,
  ivory: '#FFF6E6',
  // casilleros de la ruleta
  pockCoral: mixHex(PAL.coral, '#C0283A', 0.35),
  pockNavy: PAL.navy800,
  pockTeal: '#0E8C8C',
  // escenario
  stageWall: PAL.navy900,
  floor: '#071A30',
  beamWarm: '#FFE3A6',
  beamCyan: PAL.aqua300,
  beamCoral: PAL.coralLight,
};

/** Tres tonos de una superficie: base, sombra dura y filo de luz. */
export const tri = (hex, dark = -0.22, light = 0.3) => [hex, shade(hex, dark), shade(hex, light)];
