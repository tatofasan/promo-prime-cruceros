// Colores de la cubierta de la pileta: derivados de PAL (la madera y la piel son los únicos tonos propios).
import { PAL, mixHex } from '../../engine/color.js';

export const TEAK = {
  light: '#E0BC94', base: '#CDA077', mid: '#BA8C63', dark: '#976B45', seam: '#5A4232', grain: '#80562F',
};
export const STONE = { base: '#F3EEE4', light: '#FFFFFF', dark: '#CFC4B2', joint: '#B8AC98', speck: '#A99C88' };
export const WATER = {
  shallow: '#86DDEE', mid: '#45C3E3', deep: '#1E9DD0', wall: '#A9E7F3', wallLo: '#5CC6E3', band: '#145E92',
  line: PAL.aqua100, foam: PAL.foam,
};
export const MOSAIC_COLS = [
  [PAL.ocean500, 5], [PAL.ocean400, 5], [PAL.brandCyan, 4], [PAL.aqua300, 3], [PAL.ocean600, 3], [PAL.navy500, 2],
  [PAL.aqua200, 2], ['#FFFFFF', 2], [PAL.gold, 0.6],
];
/** Sombra fría del sol (sobre madera, piedra o agua). */
export const SHADE = 'rgb(16,44,82)';
export const SHADE_A = 0.36;
export const METAL = { base: '#DDE5EB', light: '#FFFFFF', dark: '#97A8B8' };
export const SKIN = [
  { base: '#F2B793', dark: '#D58E6B', light: '#FFD9C0', lip: '#D9675A' },
  { base: '#C98C61', dark: '#A16743', light: '#E8B285', lip: '#A9483F' },
  { base: '#8D5A3B', dark: '#673F28', light: '#B27D57', lip: '#7A332D' },
];
export const HAIR = [
  { base: '#4A2C25', light: '#7C4C3A' }, { base: '#1E1A1D', light: '#4A4048' }, { base: '#C98B44', light: '#EDBD6E' },
  { base: '#6B3B22', light: '#A3623A' },
];
export const shadeOf = (hex, k) => mixHex(hex, PAL.navy800, k);
