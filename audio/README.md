# Audio — Prime Cruceros (tropical house, 128 BPM, La mayor) · v2

Música y SFX de la promo de 30 s, **sintetizados de cero** en Python (numpy, scipy y numba). No hay
samples externos ni código reutilizado de otros proyectos: osciladores, filtros, reverb, limitadores y
medidor de loudness están escritos acá. La v2 aplica las dos revisiones de la v1 (ver «Qué cambió») y el
cambio de contrato del final (PLAN §10/§12): **después del golpe de 28,125 el groove sigue liviano hasta
el último beat y cierra con un stinger en La add9** (ver «El final»).

## Cómo regenerar

```bash
python audio/build.py                   # → public/audio/promo.wav + audio/stems/*.wav   (~3 min)
python audio/analyze.py                 # verificación + audio/analysis/*.png + report.json
python audio/analyze.py --quick         # sin códecs ni PNG (para iterar la mezcla, ~10 s)
python audio/analyze.py --determinism   # además corre build.py dos veces y compara los SHA-256
npm run audio                           # = python audio/synth.py (build + análisis; exit 1 si algo falla)
python audio/build.py --dump-buses x.npz   # guarda los 7 buses antes del master (para probar el master)
```

Requisitos: Python 3.12 con `numpy`, `scipy` y `numba`; `matplotlib` para los PNG; **`ffmpeg` en el PATH**
(la guarda de códec del master y las pruebas de códec lo usan; sin ffmpeg el build sale igual, sin guarda) y
`pyloudnorm` (opcional) para cruzar el loudness.

La única entrada es **`src/cues.json`** (grilla, secciones y cues). Si el director mueve un cue, alcanza con
volver a correr `build.py`: los SFX se recolocan solos, el arreglo sale de la misma grilla y los «ceder el
lugar» (clap, hats, bombo, ducking de la música) se recalculan a partir de los cues.

## Estructura

| archivo | qué hace |
|---|---|
| `dsp.py` | Caja de herramientas DSP: PolyBLEP (sierra, pulso, supersaw), SVF TPT con corte/Q por muestra (numba), biquads RBJ, Butterworth, ruidos coloreados, ADSR, saturación, compresor con rodilla, seguidor de envolvente A/R, bombeo sincronizado al bombo, IR de reverb sintetizada por bandas, ping-pong, **clipper suave ×4**, **limitador true-peak con techo por muestra**, BS.1770-4, **detectores de cresta de banda completa** (`fine_env` = \|Hilbert\| 2 ms, `body_env` = RMS Hann 10 ms) y WAV propio. |
| `instruments.py` | Batería (bombo, clap, redoblante, hats y shaker con ruido 40 % correlacionado entre canales, congas/bongós, claves, rim, crash, **tom**), melódicos (marimba y steel drum con `decay` para notas apagadas, pluck, pad supersaw, bajo con capa de armónicos para celular, **Rhodes**, **bronces**, **lead vocal chop + flauta de pan**, **campanita** del stinger), transiciones (risers con piso audible, crash invertido, downlifter, sub de impacto, **impacto de ruido**, tic-tac). |
| `arrangement.py` | El arreglo compás por compás (PLAN §10): progresión, hook, firmas por escena, cortes, fills, builds y el final (`_end_groove`: groove liviano + stinger). No sintetiza. |
| `sfx.py` | Los 41 tipos de SFX (64 cues con sonido + el `silence`) y su ganancia (`SFX_GAIN_DB`). |
| `build.py` | Render de pistas, buses, duckings, compuertas, automatización y master con guarda de códec. |
| `analyze.py` | Verificación (contrato + objetivos de mezcla, incluido el final con beat) y gráficos. |
| `synth.py` | Punto de entrada de `npm run audio`. |
| `review/` | Scripts y salidas de la revisión de la v1 (críticos). Los WAV de `review/out/0*.wav` son recortes del master v2 para escuchar (`python audio/review/timbres.py` los regenera). |

Salidas:
- `public/audio/promo.wav`: 48 kHz, 24 bit, estéreo, 1 440 000 muestras.
- `audio/stems/{drums,bass,music,lead,wall,fx,sfx}.wav` (32 bit float). Cada stem es la salida de su bus
  **multiplicada por la misma ganancia total del master** (fundido + pegamento + loudness + etapa rápida +
  limitador): como todo el master es una ganancia que varía en el tiempo, **la suma de los 7 stems es el
  master** (residuo −127 dB, solo el dither del WAV de 24 bit). Sirven para remezclar sin cambiar el balance.
- `audio/stems/sfx_placement.json`: dónde quedó cada SFX (anchor, reducción del limitador del bus) y el
  resumen de la cadena del master (reducciones por compás, guarda de códec).
- `audio/analysis/`: `waveform.png`, `spectrogram.png`, `spectrogram_sections.png`, `loudness.png`,
  `gap_drop_zoom.png` (los dos huecos), `final_zoom.png` (27–30 s: forma de onda, espectrograma y RMS
  por corchea contra la banda de ±6 dB), `stems_density.png`, `sfx_sync.png`, `report.json` y
  `promo_aac320.m4a` (el AAC con el que se mide el true peak de render.mjs).

## La música

**Armonía.** La mayor. Build con la progresión comprimida (F#m–D | A–E) que termina en la dominante; drop en
la tónica; desde c3, F#m–D–A–E por compás; valor F#m–D–Esus/E; cierre D–E y **La add9** en 28,125, que
se queda hasta el stinger del último beat (29,53125), también en La add9.

**Hook.** Pentatónico y con aire:
- **pregunta**: Mi5·Mi5·Fa#5 en 3-3-2 → **salto de 4.ª a La5** sostenido → silencio (pasos 12–15);
- **respuesta**: el mismo arranque → **salto de 5.ª a Do#6** que baja Si5–La5 → silencio (14–15);
- variante sobre Mi (c6): salta a Si5 y queda abierta. Final: Do#6 sobre el La add9 y, en c15, el **eco
  de la pregunta en steel** (Mi5·Mi5·Fa#5 en 3-3-2 desde el beat 2) cuyo salto a La5 cae en el stinger:
  el tema termina contestándose.

Los silencios dejan respirar la pregunta-respuesta y son el lugar de los SFX de beat 4 (el CTA cae en el
silencio del último estribillo).

**Registros separados.** El hook vive en Mi5–Do#6 (más su capa de chop una octava arriba). Marimba, plucks
(voicings abiertos con la nota de arriba ≤ La4) y pad van abajo; el steel solo dobla el hook **una octava
arriba y a −9 dB** en los picos. En el valor, que no tiene hook, el acompañamiento sube una octava (se lee
en el celular). Resultado: el lead queda **+4,2 a +5,6 dB sobre el resto** en 400–3000 Hz en cada compás con hook.

**Lead.** Vocal chop (sierra por 4 formantes ensanchados ×1,7 con Q tope 5, glide de vocal, capa una octava
arriba a −4 dB en cuadratura, consonante de ruido de ~25 ms, shelf de +5,5 dB desde 2 kHz de «vocal
procesada») sobre una flauta de pan (impares: H3 ≈ −12 dB, soplo 1,5–8 kHz siguiendo la envolvente). Fases
fijas: la nota suena igual en cada repetición. En seco, las cuatro notas del hook (Mi5 «o», Fa#5 «e», La5
«a», Do#6 «a») tienen centroide 1,25 / 1,89 / 1,32 / 1,47 kHz y la banda 1,5–4 kHz en −3,6 … −11 dB del
total; con el script de la crítica (Do#5 seco): H2 +2,7 dB, H3 −14,7, H5 −10,7, chop 7,2 dB sobre la flauta.

**Arreglo** (las frases empiezan donde empiezan las secciones visuales):

| compases | qué suena |
|---|---|
| c0–c1 build «gris» | Bus *wall* (bombo, bajo, pad y marimba con el motivo) detrás de un pasa-bajos de 24 dB que se abre en c1 con curva p^1,2 (se oye abrir desde ~2,3 s), sin compensación de nivel; c0 va 1,5 dB abajo. Tic-tac en corcheas, redoble que acelera (corcheas → semicorcheas → fusas, velocidad lineal 0,5 → 1) y riser de ruido + tono que **entra a −30 dB en el beat 1** y culmina en el hueco. El momentáneo sube 6,3 LU de forma pareja. **Semicorchea de silencio de toda la mezcla** en 3,6328–3,75; el *wall* no vuelve a abrir. |
| c2 DROP | Sub de impacto (corto y bombeado), bombo grande, crash, **impacto de ruido** (la capa aguda), stab de La (ataque de 15 ms, piso de filtro en 3 kHz), downlifter (entra en 25 ms) y `drop_wave`. Banda completa con hats abiertos fuertes, plucks +2 kHz, hook y steel en octava. +2,3 dB de automatización en lo sostenido (no en el bombo). |
| c3 pileta | Hats abiertos y steel «salpicado» después del tobogán; marimba en el registro del pad. |
| c4 cena | Batería liviana (sin hat abierto, rim, congas mínimas), Rhodes a contratiempo, lead −1 dB y la marimba **contesta** en el silencio del hook. |
| c5 show | Bronces supersaw a contratiempo, bongós y hats cerrados en semicorcheas, plucks. |
| c6 atardecer | Swell de pad (desde una base a −10 dB), **clap solo en el 3** (half-time), lead −2 dB, plucks. |
| c7–c9 destinos | **Contramelodía de steel** al centro, a −2 dB (es LA melodía del tramo) y con delay; marimba en el registro del pad que **se corre de los beats con pin** (el pin es la nota). Sin hats cerrados en c9. |
| c10 navieras | Stabs de Mi **media semicorchea después** de cada chip (le dejan el ataque), gate 0,2, +3 dB; el primero en Mi sus4 (no choca con el La5 del chip). Remate de steel después de los seis chips. |
| c11–c12 valor | Bajo liviano, plucks y marimba arriba, rim; stabs en 22,5 y 24,375 con crash. |
| c13 build 2 | Bombo y bajo se cortan en `val.surge` (25,78); **pasa-altos de 200 a 1200 Hz** sobre la música; redoble +3 dB sobre el del gancho y riser; **semicorchea de silencio SOLO de la música** en 26,133–26,25 (rima con el hook.gap). |
| c14 cierre | Último estribillo (+2,3 dB) con la pregunta del hook; el CTA cae en su silencio. |
| c15 final | **Golpe final** en 28,125 (sigue siendo el golpe principal): bombo grande, crash, sub, impacto, La add9 en pad (+3 dB), steel y marimba rasgueados (+3 dB), bajo (release 0,3 s), lead Do#6 −4 dB hasta 29,0 (release 0,35 s). **Groove liviano** hasta el último beat: bombo en los beats 2 y 3, shaker en semicorcheas, hat abierto a contratiempo y cerrado suave, tres congas, stab de marimba en La add9 por beat y el eco del hook en steel; el pad se sostiene bombeando. **Stinger** en b(15, 4) = 29,53125 (ver «El final»). |

**El final** (PLAN §12, `_end_groove` en arrangement.py). En la primera v2 después del golpe de 28,125
no había más bombo ni hats: solo el acorde que se apagaba (RMS −18,8 dBFS en 28,83 y −29,6 en 29,3, casi
silencio desde 29,5). El CTA de WhatsApp vivía 1,9 s sin beat y en autoplay se sentía como un fundido.
Ahora:
- **groove liviano** de 28,125 a 29,53: sin clap, sin línea de bajo ni lead (es la respiración después
  del golpe, no otro estribillo), pero con beat claro en cada negra (la flecha del CTA empuja con él);
- **stinger** en el último beat (29,53125): bombo + clap + La1 corto + stab supersaw en La add9 (ataque
  4 ms, release 0,12 s) + marimba rasgueada + La5 de steel (la respuesta del eco) + campanitas Si5–Mi6–La6
  en abanico + splash corto + impacto de ruido chico (el «aire» de los cortes), anticipado por un crash
  invertido de media negra. Es más chico que el golpe de 28,125 (−0,6 dB en banda completa, −3 dB arriba
  de 2 kHz) y brilla +6,8 dB sobre los beats del groove. Todo con caídas cortas (marimba y steel
  «apagados» con `decay`, el pad se suelta en el stinger con release de 0,25 s);
- **cola limpia**: desde 0,25 s antes del stinger no entra nada nuevo al delay, las reverbs de todos los
  buses se cierran entre stinger + 0,06 y + 0,40 s, el crash del golpe final se funde desde el stinger
  y el fundido del master (coseno²) arranca en stinger + 0,25 s (29,78): solo acompaña la cola, que ya
  viene apagándose sola, hasta el cero exacto de la última muestra;
- **nada cambia antes de 28,125**: los eventos nuevos usan su propia semilla y quedan últimos en cada
  pista (mismos round-robin), el crash del golpe final es el mismo de antes (solo se funde su cola) y las
  referencias de los recortadores (pico típico del bombo, máximo del crash) se miden en el tema, hasta el
  golpe final. Medido: los 7 buses son idénticos a la entrega anterior hasta 28,1; el master solo se
  corre −0,02 dB (la ganancia de loudness es global) y la guarda de códec ya no recorta en 5,628.

**Cortes.** En todos: crash ≥ 0,75 de velocidad (nivel −7 dB), crash invertido de **un beat** (nivel −15,
velocidad 1) que culmina en el corte, impacto de ruido (más fuerte en 7,5, 26,25 y 28,125: vienen después
de un fill, de un build y de un estribillo) y **fills de un beat** antes de 7,5 (toms), 9,375 (flam de
redoblante), 11,25 (congas) y 13,125 (toms en fusas).

## Mezcla

- **Bombeo** sincronizado a cada bombo: pads −11 dB/320 ms, bajo −18 dB/160 ms (en el drop, −24 dB desde el
  beat 2), plucks/marimba/steel −4 dB, hats/lead −1,7 dB. El sub de impacto también bombea: en su propio
  golpe cede 10 dB durante el ataque del bombo y llega detrás (el «boom» no se apila con el bombo).
- **El hook manda en 400–3000 Hz**: un EQ dinámico disparado por el lead (ataque 30 ms, release 250 ms) baja
  esa banda 6 dB en la música, 3 dB en la percusión y 3,5 dB en las **colas** de los SFX (ningún SFX cede en
  sus primeros 150 ms: su ataque es lo que lo identifica).
- **Los SFX chicos tienen su lugar**: la música les abre 800–5000 Hz (−4 dB, 150 ms); el clap cede 8 dB en
  los beats con confetti/chip/stickers/talón/CTA (y en «CRUCERO?», fichas, el empujón al ojo de buey y el
  whoosh de `map.hold`); hats y shaker ceden 6 dB por 120 ms; el bombo cede 2,5 dB debajo de splash, valija,
  látigos, golpe final.
- **Bocina**: el bus de bajo baja 4 dB mientras suena.
- **Automatización**: picos (c2 y c14–c15) +2,3 dB en bajo, música, lead y fx; experiencia (c3–c6) −1,9 dB y
  destinos (c7–c10) −0,8 dB en todo (los destinos no quedan como un valle de 7,5 s); valor (c11–c12) +0,8 dB.
- **Control de picos por pista** (antes de la EQ de master, así sus armónicos se filtran), para que el
  limitador del master no tenga que bajar todo en cada golpe:
  - crash recortado a su máximo −13 dB e impactos a −10 dB (clipper suave ×4: el ruido tiene picos de 1–2
    muestras al nivel del bombo que no suman sonoridad);
  - bus de batería recortado al pico **típico** de cada bombo −5 dB (redondea el primer milisegundo; el
    cuerpo del bombo queda);
  - lead a su máximo −6 dB (las consonantes del chop);
  - bus de SFX con clipper ×4 + limitador true-peak con techo en el pico típico del bombo −1,5 dB (anclado
    antes del recorte de la batería, así no se mueve si cambia ese recorte);
  - en los tres golpes grandes (drop, cierre, final) el primer milisegundo lo dan bombo, crash e impacto: el
    stab entra en 15 ms, el downlifter en 25 ms, el lead no lleva consonante y las olas y el golpe final van
    más bajos (ver SFX).
- **EQ de master por bus** (`tone()`, antes de las compuertas): subsónicos, graves en mono < 120 Hz, shelves y
  **pasa-bajos de 16 kHz** (el AAC a 128 kb/s corta ahí; lo que sacaba de los transitorios rearmaba picos).

## Los SFX

**Contrato.** Cada función devuelve `(audio, anchor)`, con `anchor` = cresta del transitorio; `build.py` la
ubica exactamente en `round(t·48000)`. La cresta se mide en **banda completa** con dos detectores: la fina
(\|Hilbert\| suavizado 2 ms) y la de cuerpo (RMS Hann de 10 ms). El anchor es el punto medio de las dos.
Para que la cresta sea inequívoca sin chasquidos de aire, los golpes llevan un **«toc» determinista** de
banda media (envolvente gamma de 2–3 ms: un solo máximo, sin el ruido aleatorio que la corría) y los graves
tienen barridos ≤ 5 ms y caídas cortas. Los whooshes no llevan el «tss» de 1 ms (−12 dB, pasa-bajos 9 kHz,
estirado a ~9 ms). Los que tienen `dur` **culminan** en su final, más fuertes que su arranque: `hook.surge`
en el arranque real del hueco (3,633), `val.surge` en 26,25 (sigue sonando dentro del hueco musical: es el
agua que sube) y `reveal.push` en 5,625 (−10 ms): arrancón liviano, whoosh p³ que termina 3 dB arriba del
arranque y ~2 dB debajo de la cresta del splash del corte.

**Agua** (burbujas de Minnaert, espuma, spray, rugido de ruido marrón):
- `drop_wave`/`wave_logo`: cachetazo (toc + ruido medio), whump −6 dB, rugido sin sub (pasa-altos 90 Hz) con
  máximo en ~20 ms que barre de derecha a izquierda, colas −3 dB pasados 300 ms y terminadas antes de 1,1 s.
  Van bajos en la mezcla (−11 y −10 dB): caen con el bombo grande, el crash y el impacto, y el golpe lo da la
  música; el SFX aporta el agua (rugido, espuma, brillo);
- `splash_cut`/`slide_splash`: cachetazo y corona con su pico en los primeros 5 ms, burbujeo 0,25 s;
- `drip`: chirp de Minnaert **ascendente** (≈ 820 → 2050 Hz, τ 13–22 ms) con micro impacto + el bulto que se hincha.

**Otros**: bocina con el soplo de vapor como cresta y el tono que crece en 180 ms subiendo de −1 semitono,
formantes nasales (450/650 Hz), caña en 1,45 kHz, pasa-altos 110 Hz y eco lejano (250 ms, pasa-bajos
1,5 kHz) del otro lado; confetti con pop agudo y lluvia +6 dB; stickers, chips, talón y CTA con banda propia y
afinados al acorde (el CTA, «blop» con chispa en 1,5–4 kHz, es el SFX más audible); golpe final con
destellos afinados en La add9.

**Niveles** (`SFX_GAIN_DB`): ningún SFX pasa a la música en loudness K de 150 ms (PLAN §10: «por debajo de la
música pero perceptibles») y todos ganan en algún tercio de octava por ≥ 3 dB (ver la tabla de abajo).

## Master

Fundido final (coseno² desde stinger + 0,25 s = 29,78) → compresor de pegamento 1,8:1 → ganancia de
loudness iterada → **etapa rápida** (limitador true-peak con lookahead 3 ms y release 50 ms, techo +1,5 dB:
toma la punta de los golpes apilados) →
**limitador true-peak principal** (×8, lookahead 5 ms, release 150 ms) con techo **−3,0 dBTP** →
**guarda de códec**: codifica con ffmpeg a AAC 320 kb/s, AAC 128 kb/s y AAC 320 → 128 (segunda generación,
como en las redes) y, si algún camino rearma un pico por encima de −1,3 dBTP, baja el techo solo ahí
(−80 … +40 ms) y repite. En esta entrega no hizo falta (peor camino −1,67 dBTP); en la anterior bajó
0,4 dB en 5,628 (el splash de la pileta): los picos del AAC cambian con diferencias mínimas de ganancia.

## Verificación (última corrida, `analyze.py --determinism`)

| control | resultado | criterio |
|---|---|---|
| formato | 48 000 Hz · 24 bit · 2 canales · 1 440 000 muestras | exacto |
| loudness integrado | −14,01 LUFS (pyloudnorm −14,05) | −14 ± 0,5 |
| true peak WAV (×4 / ×8) | −3,00 / −3,00 dBTP | ≤ −1 |
| AAC 320 kb/s (render.mjs) | −2,66 dBTP · 1 440 000 muestras | ≤ −1 (+0,3 de margen) |
| AAC 128 kb/s | −1,67 dBTP | ≤ −1 (+0,3 de margen) |
| AAC 320 → 128 (redes) | −1,71 dBTP | ≤ −1 (+0,3 de margen) |
| informativos | Opus 128k −2,16 · MP3 320k −2,87 · aac_mf 256k −2,68 dBTP (aac_mf agrega 768 muestras al final) | — |
| sincronía SFX (64 cues, banda completa) | peor cresta fina −1,75 ms (`val.surge`), peor de cuerpo +1,88 ms (`hook.open`); media 0,52 / 0,51 ms | ±5 ms |
| SFX con `dur` | culminan a −17,5 / −21,9 / −18,3 ms (RMS 20 ms) y terminan 2–3 dB arriba de su arranque | culminan en su final |
| risers musicales | piso máximo a −3,0 ms (gancho) y −2,0 ms (cierre) del hueco | culminan |
| hueco `hook.gap` | −63,5 dBFS RMS, pico −51,8 (−48,7 dB vs. drop) | silencio real |
| **groove del final** (RMS por corchea 28,2–29,5 vs. 27,2–28,1 = −14,69 dBFS) | +1,2 · +0,1 · −0,2 · −2,6 · −1,1 · −3,7 dB (peor −3,7 en 29,30; la entrega anterior daba −5,4 en 29,06 y −12,7 en 29,30: no pasaba) | ±6 dB |
| **stinger** (b(15, 4) = 29,53125, en el master) | cresta fina +2,92 ms, de cuerpo +3,77 ms, onset +0,10 ms; +7,5 dB sobre el groove; > 2 kHz +6,8 dB sobre el beat 3 y 3 dB debajo del golpe de 28,125 | ±5 ms |
| cola del stinger (RMS 10 ms) | 29,75 −20,7 · 29,85 −28,6 · 29,90 −38,3 · 29,95 −57,6 · 29,99 −93,8 dBFS | se apaga antes de 30,0 |
| final | últimos 10 ms con pico −82,7 dBFS, última muestra = 0; 0 clics | < −60 dBFS, sin clic |
| gancho vs. drop | 7,74 LU (c0 vs. drop: 9,2 LU) | 6–8 LU |
| los dos picos | c2 +2,2 LU y c14 +2,5 LU sobre el promedio de c3–c9 | drop y cierre |
| loudness por sección | gancho −19,4 · drop −11,7 · experiencia −13,6 · destinos −14,6 · valor −14,9 · cierre −12,0 | — |
| reducción de ganancia del master | total instantánea (etapa rápida + limitador) **máx 2,76 dB**; media de los 150 ms tras el downbeat: drop 1,56, cierre 1,94 dB | < 3; ≤ 2,5 en el drop |
| lead vs. resto (400–3000 Hz) | c2 +5,5 · c3 +4,4 · c4 +4,2 · c5 +5,6 · c6 +5,2 · c14 +4,6 dB | ≥ +4 |
| cortes (música > 2 kHz vs. beat con clap) | 4,3 · 4,4 · 4,6 · 4,0 · 6,8 · 11,0 · 8,3 · 6,9 · 7,1 · 4,1 · 4,3 dB | ≥ +4 |
| centroide drop / c3 | 1260 / 1125 Hz | drop ≥ c3 |
| bombeo del bajo en el drop (desde el beat 2) | −23,5 dB | ≥ 15 dB |
| SFX: mejor tercio de octava (80 ms; los de `dur`, también sus últimos 150 ms) | 64/64 ≥ +3 dB (CTA +24, chips +14…+24, pines +9,5…+22, stickers +7,5…+14, talón +15, confetti +7,7, ola +5,6, golpe final +3,9; el más justo, `hook.q3` +3,0) | ≥ +3 dB |
| SFX vs. música (LK 150 ms) | todos ≤ 0; el más alto es el CTA (−0,8 LU) | por debajo de la música |
| celular (HP 450 Hz) | experiencia −15,9 · destinos −18,1 · valor −18,5 LUFS | — |
| estéreo | S/M < 120 Hz −34,8 dB; corr. L/R 0,82; corr. > 8 kHz 0,32; pérdida en mono −0,7 LU | — |
| suma de stems − master | −127 dB | = master |
| antes de 28,125 vs. la entrega anterior | los 7 buses idénticos (ninguna muestra difiere más de 1e-7); el master, −0,02 dB de ganancia de loudness y sin el recorte de la guarda en 5,628 (+0,29 dB ahí) | sin cambios |
| determinismo | 2 corridas + el WAV: el mismo SHA-256 (`efee7c43…`) | idéntico |

## Qué cambió (v1 → v2)

Resumen de lo aplicado de las dos revisiones y del cambio de contrato del final (detalle arriba):

| crítica | qué se hizo |
|---|---|
| Lead «flauta senoidal» | Chop 1,8 / flauta 0,36; formantes ×1,7 (Q ≤ 5); capa de chop una octava arriba (−4 dB); consonante; flauta con impares y soplo; shelf +5,5 dB y F3 de la «o» más alto. |
| Todo en la misma octava / hook «noodle» | Hook reescrito con silencios y saltos (4.ª y 5.ª), registros separados (ver arriba). Lead ≥ +4,2 dB sobre el resto en 400–3 kHz. |
| Energía en meseta y limitador en el drop | Automatización por tramo; c2/c14 +2,2/+2,5 LU sobre c3–c9; control de picos por pista; GR total máx 2,79 dB (era 6,3). |
| Drop pesado y oscuro | Sub corto y bombeado, whump −6 dB, rugido sin sub, thump del hit −6 dB, stab con piso de 3 kHz, plucks +2 kHz, impacto de ruido; centroide del drop 1260 Hz (> c3). |
| Balance de SFX | Agua más baja y con colas cortas; los chicos con banda propia y más nivel; clap que cede en sus beats; ducking por el hook solo en las colas; métricas LK 150 ms + tercios de octava. |
| Los cortes no se oyen en la música | Crash a −7 dB (velocidad ≥ 0,75), crash invertido de un beat, impactos, fills; los 11 cortes ≥ +4 dB. |
| Escenas iguales / c10 cae | Firma por escena (pileta, cena, show, atardecer, destinos, navieras); stabs por chip; Esus4. |
| Build sin tensión / c13 no construye | Curva p^1,2, riser desde el beat 1, redoble audible; en c13 corte de bombo y bajo, pasa-altos 200→1200 Hz y hueco de semicorchea. |
| Final «corte + eco» | Pad y acorde con release, lead hasta 29,0, delay apagado y en mono, fundido coseno² (hoy reemplazado por el groove + stinger, abajo). |
| Bocina, gotas, pines | Bocina con tono que crece, formantes y eco lejano; gotas con chirp ascendente; pines con banda propia y fuera de los beats de la marimba; steel al centro. |
| Snaps de aire, techo y códecs | Sin «tss» de 1 ms; techo −3,0 dBTP; guarda de códec con AAC 128 y segunda generación. |
| Crestas de banda completa | Anchors con detectores de banda completa; whooshes y subidas que culminan; slide y golpes graves en ±2 ms. |
| Wall que reabre, stems, estéreo | Wall cerrado después del hueco; stems = master; ruido de hats/shaker 40 % correlacionado. |
| **Contrato v2 (PLAN §10/§12): el final sin beat** | Después del golpe de 28,125 solo quedaba el acorde (−18,8 dBFS en 28,83, −29,6 en 29,3, casi silencio desde 29,5): el CTA vivía 1,9 s sin beat y en autoplay sonaba a fundido. Ahora el groove sigue liviano hasta el último beat y cierra un stinger en La add9 en 29,53125, con cola limpia (ver «El final»). `analyze.py` lo verifica (RMS por corchea ±6 dB, stinger ±5 ms) y dibuja `final_zoom.png`. |

## Para ajustar

- **Niveles de pista** en `LEVEL` (build.py) y de cada SFX en `SFX_GAIN_DB` (sfx.py); `analyze.py --quick`
  muestra en segundos el loudness por compás, la audibilidad de cada SFX, el lead vs. el resto y los cortes.
- **Picos vs. cuerpo**: `PEAK_BOOST_DB`, `EXP_TRIM_DB`, `DEST_TRIM_DB`, `VALUE_TRIM_DB` (build.py).
- **Control de picos**: `CRASH_CLIP_DB`, `IMPACT_CLIP_DB`, `KICK_BUS_CLIP_DB`, `LEAD_CLIP_DB`,
  `SFX_CEIL_BELOW_KICK_DB`, `CEILING_DBTP` (build.py).
- **Quién cede a quién**: `CLAP_YIELDS_TO`, `HATS_YIELD_TO`, `KICK_YIELDS_TO` (arrangement.py), `SFX_PRIORITY`,
  `SFX_DUCK_DB` y `LEAD_DUCK` (build.py).
- **Hook, contramelodía y patrones**: `HOOK_*`, `STEEL_COUNTER`, `*_PAT`, `SCENE`, `CUTS`, `FILLS` (arrangement.py).
- **El final**: `END_KICK_STEPS`, `END_MARIMBA_STAB`, `END_ECHO`, `END_CONGAS`, `STINGER_MARIMBA`,
  `STINGER_BELLS` y `_end_groove` (arrangement.py); `LEVEL["bell"]`, `DELAY_CLOSE_BEFORE_STINGER`,
  `WET_CLOSE` y `END_FADE_AFTER_STINGER` (build.py); tolerancias `END_TOL_DB` y `STINGER_TOL_MS` (analyze.py).
