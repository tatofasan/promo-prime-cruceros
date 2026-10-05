// Entorno de dibujo: el MISMO código de escenas corre en el navegador (vista previa en vivo) y en Node
// (render cuadro a cuadro con @napi-rs/canvas, que usa Skia igual que Chrome). Las diferencias de plataforma
// viven solo acá: crear lienzos fuera de pantalla, cargar imágenes y resolver rutas de assets.
//
// Reglas para las escenas:
//  - Nunca `document.createElement('canvas')` ni `new Image()`: usar makeCanvas() y loadImage().
//  - Path2D es global en los dos entornos (en Node lo instala tools/node-env.mjs antes de importar escenas).
//  - Las imágenes se cargan en init() (async), nunca dentro de draw().

const state = {
  platform: 'browser',
  createCanvas: null,
  loadImage: null,
  assetUrl: (p) => '/' + p.replace(/^\/+/, ''),
};

export function setEnv(patch) { Object.assign(state, patch); }
export const platform = () => state.platform;

/** Lienzo fuera de pantalla de w×h (en el navegador, un <canvas> desprendido; en Node, un Canvas de Skia). */
export function makeCanvas(w, h) {
  if (state.createCanvas) return state.createCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const imgCache = new Map();
/** Carga una imagen de `public/<ruta>` (ej. 'brand/logo-principal.png'). Cachea por ruta. */
export function loadImage(path) {
  if (!imgCache.has(path)) {
    const p = state.loadImage
      ? state.loadImage(state.assetUrl(path))
      : new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error(`no se pudo cargar ${path}`));
        im.src = state.assetUrl(path);
      });
    imgCache.set(path, p);
  }
  return imgCache.get(path);
}
