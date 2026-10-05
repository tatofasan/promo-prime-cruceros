const INDEX = new URL('./index-hook.mjs', import.meta.url).href;
export async function resolve(specifier, context, next) {
  const r = await next(specifier, context);
  if (r.url.endsWith('/src/scenes/index.js') && !context.parentURL?.endsWith('/index-hook.mjs')) return { ...r, url: INDEX };
  return r;
}
