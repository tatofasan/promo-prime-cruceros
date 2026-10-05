// Herramienta de prueba de HOOK: registra un hook de carga que reemplaza src/scenes/index.js por un registro
// reducido (gancho + TYPE + escenas vecinas que carguen bien). Así los renders de prueba no se caen cuando otro
// equipo tiene un archivo a medio editar. Uso: node --import ./src/scenes/hook/_tools/reg.mjs tools/still.mjs …
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);
