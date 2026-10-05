// Hoja de poses de las bailarinas (sandbox).
import { POSES, drawDancer } from './dancer.js';
export const bg = '#16426F';
export function draw(ctx, t) {
  const names = Object.keys(POSES);
  names.forEach((n, i) => {
    const p = { ...POSES[n], since: 1, dir: 1 };
    const col = i % 6, row = Math.floor(i / 6);
    drawDancer(ctx, 160 + col * 320, 470 + row * 520, 1.25, p, t, { lead: i === 2, seed: i, variant: i, sparkle: 1, reflect: 0.2 });
    ctx.fillStyle = '#fff'; ctx.font = '600 24px Outfit'; ctx.fillText(n, 120 + col * 320, 510 + row * 520);
  });
}
