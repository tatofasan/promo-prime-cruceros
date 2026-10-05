// Capas fuera de pantalla de tamaño completo (W×H) que se reciclan en cada cuadro.
// Uso: const L = layer(); const c = L.getContext('2d'); …dibujar…; ctx.drawImage(L, 0, 0);
// El compositor llama resetLayers() al empezar cada cuadro: NO guardes una capa entre cuadros.
// Para cachés que sí duran (texturas, siluetas pre-dibujadas) usá makeCanvas() de env.js en init().
import { makeCanvas } from './env.js';
import { W, H } from './time.js';

const pool = [];
let used = 0;
const halfPool = [];
let halfUsed = 0;

function clean(c) {
  const x = c.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-over';
  x.filter = 'none';
  x.shadowColor = 'rgba(0,0,0,0)';
  x.shadowBlur = 0;
  x.clearRect(0, 0, c.width, c.height);
  return c;
}

export function layer() {
  let c = pool[used];
  if (!c) { c = makeCanvas(W, H); pool.push(c); }
  used++;
  return clean(c);
}

/** Capa a MEDIA resolución (W/2 × H/2), reciclada por cuadro: para desenfoques y barridos baratos. */
export function layerHalf() {
  let c = halfPool[halfUsed];
  if (!c) { c = makeCanvas(W / 2, H / 2); halfPool.push(c); }
  halfUsed++;
  return clean(c);
}

export function resetLayers() { used = 0; halfUsed = 0; }
export const layersInUse = () => used;
