#!/bin/sh
# borrador corto de la cena + métrica oficial (beats 7,97 y 8,44)
cd /c/Users/tatof/Documents/Proyectos/Inspiracion/promo-prime-cruceros
node tools/render.mjs --draft --noaudio --from=7.9 --to=9.0 --out=out/draft-deck-a-e.mp4 >/dev/null 2>&1
node tools/energy.mjs --video=out/draft-deck-a-e.mp4 --offset=7.9 --from=7.9 --to=9.0 --out=shots/deck-a/energy-e >/dev/null && cat shots/deck-a/energy-e/energy.csv
