// Prueba: las 6 postales a 2× en una grilla (solo para revisar la ilustración).
import { AW, AH } from './art/kit.js';
const names = ['uy', 'br', 'car', 'eu', 'dxb', 'ant'];
const mods = [];
export async function init() {
  for (const n of names) { try { mods.push(await import(`./art/${n}.js`)); } catch { mods.push(null); } }
}
export const bg = '#1b2430';
export function draw(ctx, t) {
  mods.forEach((m, i) => {
    if (!m) return;
    const x = 40 + (i % 3) * 620, y = 60 + Math.floor(i / 3) * 480;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(2, 2);
    ctx.beginPath(); ctx.rect(0, 0, AW, AH); ctx.clip();
    m.draw(ctx, t);
    ctx.restore();
  });
}
