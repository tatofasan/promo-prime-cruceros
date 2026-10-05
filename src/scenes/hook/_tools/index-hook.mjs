// Registro reducido para las pruebas de HOOK (ver reg.mjs). Las escenas que fallen al importar se omiten.
const load = async (p) => { try { return (await import(p)).default; } catch (e) { console.error(`[hook-index] omito ${p}: ${e.message.split('\n')[0]}`); return null; } };
const list = await Promise.all(['../../hook-office.js', '../../reveal-sea.js', '../../pool.js', '../../type-hook.js', '../../type-exp.js'].map(load));
export const SCENES = list.filter(Boolean);
export const OVER_ABOVE = ['reveal-sea', 'close'];
