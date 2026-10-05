// Color: paleta de la pieza + mezclas. Las escenas usan estos tokens (no inventar azules nuevos sin motivo).

export const PAL = {
  // marca (sacada de primecruceros.com.ar)
  brandOrange: '#FF3D00', // «prime» y el pin del logo
  brandCyan: '#00A7CE',   // «cruceros» (theme-primary de la web)
  brandSky: '#6BBFD2',    // cielo dentro del pin
  brandSea: '#00A7CE',    // mar dentro del pin
  // navy profundo
  ink: '#04101F',
  navy900: '#061629',
  navy800: '#0A2340',
  navy700: '#0F3157',
  navy600: '#16426F',
  navy500: '#1E5688',
  // océano
  ocean700: '#0B5C8A',
  ocean600: '#0E76A8',
  ocean500: '#1391C4',
  ocean400: '#2FB3DD',
  aqua300: '#6FD6EC',
  aqua200: '#A9EBF6',
  aqua100: '#DDF8FC',
  foam: '#F3FDFF',
  // blancos
  white: '#FFFFFF',
  warmWhite: '#FFF8EE',
  // atardecer / acentos cálidos
  gold: '#FFB938',
  goldLight: '#FFD27A',
  goldPale: '#FFE9B8',
  coral: '#FF6B4A',
  coralLight: '#FF9273',
  peach: '#FFB59A',
  sunsetPink: '#F2668B',
  dusk: '#5B3F8C',
  // rutina gris (gancho)
  grey900: '#2B3036',
  grey700: '#454C55',
  grey600: '#5E6670',
  grey500: '#7B828C',
  grey400: '#9AA0A8',
  grey300: '#B7BCC3',
  grey200: '#D3D6DA',
  // WhatsApp (solo el CTA)
  wa: '#25D366',
  waDark: '#128C4B',
};

const cache = new Map();
/** '#rrggbb' | '#rgb' → [r, g, b] (0..255). */
export function rgb(hex) {
  let v = cache.get(hex);
  if (v) return v;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  cache.set(hex, v);
  return v;
}
/** Color con alfa: rgba('#00A7CE', 0.5). */
export function rgba(hex, a = 1) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${+a.toFixed(4)})`;
}
/** Mezcla lineal de dos colores (p 0..1) → 'rgb(...)'. */
export function mix(a, c, p, alpha = 1) {
  const A = rgb(a), C = rgb(c);
  const q = Math.min(1, Math.max(0, p));
  const r = Math.round(A[0] + (C[0] - A[0]) * q), g = Math.round(A[1] + (C[1] - A[1]) * q), bl = Math.round(A[2] + (C[2] - A[2]) * q);
  return alpha >= 1 ? `rgb(${r},${g},${bl})` : `rgba(${r},${g},${bl},${+alpha.toFixed(4)})`;
}
/** Igual que mix pero devuelve '#rrggbb' (sirve para encadenar mezclas). */
export function mixHex(a, c, p) {
  const A = rgb(a), C = rgb(c);
  const q = Math.min(1, Math.max(0, p));
  return '#' + [0, 1, 2].map((k) => Math.round(A[k] + (C[k] - A[k]) * q).toString(16).padStart(2, '0')).join('');
}
/** Aclara (amt>0) u oscurece (amt<0) hacia blanco/negro. */
export const shade = (hex, amt) => (amt >= 0 ? mixHex(hex, '#ffffff', amt) : mixHex(hex, '#000000', -amt));
/** Rampa: color en la posición p de una lista de colores repartidos parejo. */
export function ramp(colors, p) {
  const q = Math.min(1, Math.max(0, p)) * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(q));
  return mixHex(colors[i], colors[i + 1], q - i);
}
