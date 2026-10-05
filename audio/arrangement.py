"""
arrangement.py — el arreglo del tema compás por compás (docs/PLAN.md §10).

Lee la grilla y los cues de src/cues.json (fuente única de tiempos) y devuelve un `Song` con:
- la progresión de acordes (La mayor: F#m–D–A–E y variantes),
- la lista de eventos de cada pista (tiempos en segundos, ya con swing y humanización determinista),
- los tiempos clave (gaps, drop, cierre) que usa la mezcla.

No sintetiza nada: eso lo hace build.py con los instrumentos de instruments.py.

Ideas que ordenan el arreglo (v2, después de la crítica):
- **Registros separados.** El hook vive arriba (Mi5–Do#6, con una capa de chop una octava más
  arriba). Marimba, plucks y pad van por debajo de La4; el steel solo dobla el hook en la octava
  de arriba. Así el hook se despega sin subirle el volumen a todo.
- **Dos picos de verdad.** El drop (c2) y el cierre (c14) llevan las capas agudas (impacto de
  ruido, hats abiertos fuertes, steel en octava, plucks abiertos); c3–c10 quedan 2–3 LU abajo.
- **Una firma por escena** (pileta, cena, show, atardecer, destinos, navieras) y un acento musical
  en cada corte: crash, crash invertido de un beat y, antes de los cortes de la experiencia, un fill.
- **El final tiene beat hasta el último beat** (v2, PLAN §12): después del golpe de 28,125 sigue un
  groove liviano (bombo, shaker, hats, congas, stab de marimba por beat y el eco del hook en steel)
  hasta 29,53125 = b(15, 4), donde cierra un stinger corto y brillante en La add9. Ver `_end_groove`.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

from dsp import rng_of

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUES_PATH = os.path.join(ROOT, "src", "cues.json")


def load_cues(path: str = CUES_PATH) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def db(x: float) -> float:
    """dB → factor de amplitud (para escribir las velocidades en dB, que es como se piensa la mezcla)."""
    return float(10.0 ** (x / 20.0))


# ---------------------------------------------------------------------------
# Armonía
# ---------------------------------------------------------------------------

# bass = nota MIDI del bajo; pad = voicing del pad (notas comunes para que las voces se muevan poco);
# pluck = voicing abierto de los plucks, todo por debajo de La4 (el registro de arriba es del hook);
# stab = voicing de los stabs supersaw; tones = clases de altura del acorde (0 = Do) para los SFX.
CHORDS = {
    "F#m": dict(bass=30, pad=[57, 61, 64, 66], pluck=[54, 61, 64, 69], stab=[57, 61, 66, 69, 73],
                tones=[6, 9, 1, 4]),
    "D": dict(bass=38, pad=[57, 62, 64, 66], pluck=[50, 57, 62, 66], stab=[57, 62, 66, 69, 74],
              tones=[2, 6, 9, 4]),
    "A": dict(bass=33, pad=[57, 61, 64, 69], pluck=[52, 57, 61, 69], stab=[57, 61, 64, 69, 73, 76],
              tones=[9, 1, 4, 11]),
    "E": dict(bass=28, pad=[56, 59, 64, 66], pluck=[52, 59, 64, 68], stab=[56, 59, 64, 68, 71],
              tones=[4, 8, 11, 6]),
    # Mi sus4 (Mi–La–Si): el primer stab de las navieras va así para no chocar con el La5 del chip
    "Esus": dict(bass=28, pad=[57, 59, 64, 66], pluck=[52, 59, 64, 69], stab=[57, 59, 64, 69, 71],
                 tones=[4, 9, 11, 6]),
    # acorde final grande de La mayor add9 (PLAN: «el cierre resuelve en La mayor (add9)»)
    "Aadd9": dict(bass=33, pad=[45, 52, 57, 59, 61, 64, 69, 71, 73, 76], pluck=[57, 59, 64, 69],
                  stab=[57, 61, 64, 69, 71, 76], tones=[9, 1, 4, 11]),
}

# (compás, beat_desde, beat_hasta, acorde). Beats de 1 a 5 (5 = fin del compás).
PROGRESSION = [
    (0, 1, 3, "F#m"), (0, 3, 5, "D"),            # build «gris»: la progresión entera, comprimida
    (1, 1, 3, "A"), (1, 3, 5, "E"),              # termina en la dominante → tensión antes del drop
    (2, 1, 5, "A"),                              # DROP en la tónica: máxima resolución
    (3, 1, 5, "F#m"), (4, 1, 5, "D"), (5, 1, 5, "A"), (6, 1, 5, "E"),
    (7, 1, 5, "F#m"), (8, 1, 5, "D"), (9, 1, 5, "A"), (10, 1, 5, "E"),
    (11, 1, 5, "F#m"), (12, 1, 5, "D"), (13, 1, 3, "Esus"), (13, 3, 5, "E"),
    (14, 1, 3, "D"), (14, 3, 5, "E"),            # IV–V…
    (15, 1, 5, "Aadd9"),                         # …–I: golpe final
]

# Hook (La mayor pentatónica). (paso de semicorchea, nota MIDI, duración en pasos, vocal del chop).
# Pregunta: nota repetida en 3-3-2 (Mi5·Mi5·Fa#5) y SALTO de 4.ª a La5, que queda sostenido; después
# silencio (el aire para que conteste la respuesta, o para que pegue el SFX del beat 4).
# Respuesta: el mismo arranque y un salto de 5.ª a Do#6 que baja por grado (Do#6–Si5–La5).
HOOK_CALL = [(0, 76, 3, "o"), (3, 76, 3, "a"), (6, 78, 2, "e"), (8, 81, 4, "a")]
HOOK_ANSWER = [(0, 76, 3, "o"), (3, 76, 3, "a"), (6, 78, 2, "e"), (8, 85, 2, "a"), (10, 83, 2, "e"),
               (12, 81, 2, "o")]
# variante sobre Mi (c6, atardecer): la pregunta salta a Si5 (la quinta de Mi) y queda abierta
HOOK_CALL_E = [(0, 76, 3, "o"), (3, 76, 3, "a"), (6, 78, 2, "e"), (8, 83, 4, "u")]

# Contramelodía de steel drum para los destinos (va en los contratiempos: los pines caen en los beats)
STEEL_COUNTER = {
    7: [(2, 73, 1), (3, 76, 2), (6, 78, 1), (7, 76, 2), (10, 73, 1), (11, 76, 2), (14, 78, 2)],
    8: [(2, 74, 1), (3, 78, 2), (6, 81, 1), (7, 78, 2), (10, 76, 1), (11, 78, 2), (14, 81, 2)],
    9: [(2, 73, 1), (3, 76, 2), (6, 81, 1), (7, 76, 2), (10, 73, 1), (11, 71, 2), (14, 73, 2)],
}

# patrones de 16 pasos
BASS_PAT = [(0, 0, 2.5), (3, 0, 2.5), (6, 12, 1.5), (8, 0, 2.5), (11, 0, 2.5), (14, 12, 1.5)]
BASS_LIGHT = [(0, 0, 3.0), (8, 0, 3.0)]
PLUCK_PAT = [2, 6, 10, 11, 14]
SHAKER_VEL = [0.55, 0.32, 0.85, 0.4] * 4
CONGA_A = [(3, "lo", "open"), (6, "hi", "open"), (7, "hi", "mute"), (10, "lo", "open"), (11, "hi", "slap"), (14, "hi", "open")]
CONGA_B = [(2, "hi", "open"), (3, "lo", "open"), (6, "hi", "slap"), (10, "lo", "open"), (12, "hi", "mute"),
           (14, "hi", "open"), (15, "lo", "mute")]
CONGA_SPARSE = [(3, "lo", "open"), (10, "lo", "open"), (14, "hi", "open")]
CLAVE_PAT = [0, 3, 6, 10, 12]  # clave 3-2 comprimida en un compás
BONGO_PAT = [1, 3, 5, 7, 9, 11, 13, 15]
ARP_IDX = [0, 2, 1, 3, 2, 0, 3, 1]

# Escena de cada compás (PLAN §6): define la firma de cada tramo.
SCENE = {0: "build", 1: "build", 2: "drop", 3: "pool", 4: "dinner", 5: "show", 6: "sunset",
         7: "dest", 8: "dest", 9: "dest", 10: "lines", 11: "value", 12: "value", 13: "vbuild",
         14: "close", 15: "final"}
GROOVE = ("pool", "dinner", "show", "sunset", "dest", "lines")   # el cuerpo (2–3 LU debajo de los picos)
PEAKS = ("drop", "close")

# Final (c15). Pasos de semicorchea dentro del compás 15: el 0 es el golpe final (28,125) y el 12, el
# stinger (29,53125 = b(15, 4)). En el medio, el groove liviano.
END_KICK_STEPS = (4, 8)                       # beats 2 y 3: el bombo sigue (el 4 lo pone el stinger)
END_STINGER_STEP = 12
END_MARIMBA_STAB = [57, 64, 69, 71]           # La add9 en el registro del pad (La3 Mi4 La4 Si4)
# eco del hook en steel: la pregunta (Mi5·Mi5·Fa#5 en 3-3-2) arranca en el beat 2 y su salto a La5
# cae justo en el stinger (paso 12): el tema termina contestándose a sí mismo
END_ECHO = [(4, 76), (7, 76), (10, 78)]
END_CONGAS = [(3, "lo", "open"), (6, "hi", "slap"), (10, "lo", "open")]
STINGER_MARIMBA = [57, 64, 69, 73, 76]        # La add9 sin la 9.ª abajo (la 9.ª la pone la campanita)
STINGER_BELLS = [83, 88, 93]                  # Si5 (la 9.ª), Mi6 y La6: el brillo de arriba

# Cortes de escena que la música marca (crash ≥ 0,7 y, salvo drop/cierre, crash invertido de 1 beat)
CUTS = {3: 1.0, 4: 1.0, 5: 0.9, 6: 0.9, 7: 0.85, 10: 0.8, 11: 0.85, 12: 0.75, 13: 0.75}
REVCRASH_INTO = (4, 5, 6, 7, 10, 11, 12, 13)
# fills de 1 beat antes de los cortes de la experiencia (compás que TERMINA con el fill)
FILLS = {3: "toms", 4: "flam", 5: "congas", 6: "toms32"}

# SFX chicos que ocupan el lugar del clap cuando caen sobre el 2 o el 4 (el clap baja 8 dB ahí)
CLAP_YIELDS_TO = ("confetti_pop", "chip_pop", "sticker_slap", "ticket_tear", "button_pop", "hit", "chips_stack",
                  "whoosh_in", "whoosh_short")
KICK_YIELDS_TO = ("splash_cut", "suitcase_drop", "whip_pan", "final_hit", "sun_swell", "pin_land", "whoosh_in")
# … y los hats/shaker les abren el agudo durante 120 ms (−6 dB)
HATS_YIELD_TO = CLAP_YIELDS_TO + ("whoosh_short", "ticket_whoosh", "hit_soft")


@dataclass
class Song:
    cues: dict
    bpm: float
    beat: float
    bar: float
    step: float
    duration: float
    chords: list = field(default_factory=list)          # (t0, t1, nombre)
    ev: dict = field(default_factory=dict)              # pista → lista de eventos (dict)
    times: dict = field(default_factory=dict)           # tiempos clave

    # --- grilla ---
    def t(self, bar: int, beat: float = 1.0) -> float:
        return bar * self.bar + (beat - 1.0) * self.beat

    def ts(self, bar: int, step: float) -> float:
        return bar * self.bar + step * self.step

    def cue(self, cid: str) -> dict:
        for c in self.cues["cues"]:
            if c["id"] == cid:
                return c
        raise KeyError(cid)

    def chord_at(self, t: float) -> str:
        for t0, t1, name in self.chords:
            if t0 - 1e-9 <= t < t1 - 1e-9:
                return name
        return self.chords[-1][2]

    def add(self, track: str, **e) -> None:
        self.ev.setdefault(track, []).append(e)


def _roll_times(s: Song, bar: int, t_end: float) -> list:
    """Redoble que acelera en un compás: corcheas (beats 1–2) → semicorcheas (3) → fusas (4)."""
    out = []
    t = s.t(bar, 1)
    while t < s.t(bar, 3) - 1e-9:
        out.append(t)
        t += s.beat / 2
    while t < s.t(bar, 4) - 1e-9:
        out.append(t)
        t += s.beat / 4
    while t < t_end - 1e-6:
        out.append(t)
        t += s.beat / 8
    return out


def build_song(cues: dict | None = None) -> Song:
    cues = cues or load_cues()
    s = Song(cues=cues, bpm=cues["bpm"], beat=cues["beat"], bar=cues["bar"], step=cues["beat"] / 4.0,
             duration=cues["duration"])
    rng = rng_of("arreglo")
    SW = 0.11 * s.step   # swing leve: las semicorcheas pares se atrasan ~13 ms (≈ 55 %)

    def sw(step):
        return SW if step % 2 == 1 else 0.0

    def hum(scale=0.0012):
        return float(rng.uniform(-scale, scale))

    def vj(v, amt=0.07):
        return float(v * (1 + rng.uniform(-amt, amt)))

    # ---- acordes ----
    for bar, b0, b1, name in PROGRESSION:
        s.chords.append((s.t(bar, b0), s.t(bar, b1), name))

    gap = s.cue("hook.gap")
    close_t = s.cue("close.in")["t"]
    s.times = dict(
        gap0=gap["t"], gap1=gap["t"] + gap["dur"],
        drop=s.cue("reveal.drop")["t"],
        build_open=s.t(1), close=close_t, final=s.cue("close.final")["t"],
        vsurge=s.cue("val.surge")["t"], end=s.duration,
        # segundo hueco (solo música): la misma semicorchea antes de la segunda ola, para que el
        # cierre rime con el drop. El SFX de val.surge sigue y culmina en su cue (26,25).
        gap2_0=close_t - gap["dur"], gap2_1=close_t,
        horn=s.cue("reveal.horn")["t"],
        lead_end=s.cue("close.final")["t"] + 0.875,   # la nota final del lead se suelta en 29,0
        # el stinger del final, en el último beat (PLAN §12: «cierra con un stinger en el último beat»)
        stinger=s.t(15, 1 + END_STINGER_STEP / 4),
    )

    # =====================================================================
    # BATERÍA
    # =====================================================================
    for bar in range(16):
        sc = SCENE[bar]
        # --- bombo four-on-the-floor ---
        if sc == "build":
            steps = [0, 4, 8, 12] if bar == 0 else [0, 4, 8]       # en c1 se va en el beat 4: tensión del redoble
            for st in steps:
                s.add("kick_wall", t=s.ts(bar, st), vel=0.95 if bar == 0 else 0.6)
        elif sc == "final":
            s.add("kick", t=s.ts(bar, 0), vel=1.0, big=True)
        elif sc == "vbuild":
            for st in (0, 4, 8):                                     # se corta en val.surge (paso 12)
                s.add("kick", t=s.ts(bar, st), vel=0.9, big=False)
        else:
            for st in (0, 4, 8, 12):
                v = {"value": 0.85, "dinner": 0.85}.get(sc, 1.0 if sc in PEAKS else 0.88)
                s.add("kick", t=s.ts(bar, st), vel=v, big=(st == 0 and sc in PEAKS))
        # --- clap en 2 y 4 (atardecer: solo en el 3, sensación half-time) ---
        if sc in ("drop", "pool", "dinner", "show", "dest", "lines", "value", "close"):
            for st in (4, 12):
                v = 1.0 if sc in PEAKS else (0.75 if sc == "dinner" else 0.85)
                s.add("clap", t=s.ts(bar, st), vel=vj(v, 0.04))
        elif sc == "sunset":
            s.add("clap", t=s.ts(bar, 8), vel=vj(1.0, 0.04))
        elif sc == "vbuild":
            s.add("clap", t=s.ts(bar, 4), vel=vj(1.0, 0.04))
        # --- hats abiertos a contratiempo (fuertes en los picos y en la pileta; la cena no lleva) ---
        if sc in ("drop", "pool", "show", "sunset", "dest", "lines", "close"):
            v = {"drop": 1.0, "close": 1.0, "pool": 0.75, "sunset": 0.45}.get(sc, 0.6)
            for st in (2, 6, 10, 14):
                s.add("ohat", t=s.ts(bar, st) + hum(0.0006), vel=vj(v))
        # --- hats cerrados en semicorcheas (picos, show y navieras) ---
        if sc in ("drop", "show", "lines", "close"):
            for st in range(16):
                if st % 4 == 2:
                    continue
                v = 0.5 if st % 2 == 0 else 0.3
                s.add("chat", t=s.ts(bar, st) + sw(st) + hum(), vel=vj(v, 0.12))
        # --- shaker en semicorcheas con swing ---
        if sc not in ("build", "final"):
            k = {"value": 0.8, "vbuild": 0.85, "dinner": 0.8}.get(sc, 1.0)
            for st in range(16):
                s.add("shaker", t=s.ts(bar, st) + sw(st) + hum(), vel=vj(SHAKER_VEL[st] * k, 0.12))
        if sc == "final":
            # el groove liviano del final se arma aparte (_end_groove, con su propia semilla); acá se
            # queman las 12 tiradas que usaba el shaker de la v1, así la secuencia del generador (y con
            # ella cada velocidad del resto del arreglo) queda igual que antes
            rng.uniform(-0.1, 0.1, size=12)
        # --- congas / bongós / claves / rim ---
        if sc in ("drop", "pool", "show", "dest", "lines", "close", "value", "dinner", "sunset"):
            pat = CONGA_A if bar % 2 == 0 else CONGA_B
            if sc in ("sunset", "dinner"):
                pat = CONGA_SPARSE
            kv = {"value": 0.7, "dinner": 0.7, "sunset": 0.75}.get(sc, 1.0)
            for st, drum, kind in pat:
                s.add("conga", t=s.ts(bar, st) + sw(st) + hum(), drum=drum, kind=kind,
                      vel=vj((0.85 if kind != "mute" else 0.55) * kv, 0.1))
        if sc in ("show", "close"):
            for st in BONGO_PAT:
                s.add("bongo", t=s.ts(bar, st) + sw(st) + hum(), hi=(st % 4 == 3), vel=vj(0.6, 0.15))
        if sc in ("dest", "lines", "close"):
            for st in CLAVE_PAT:
                s.add("clave", t=s.ts(bar, st) + hum(0.0006), vel=vj(0.7, 0.08))
        if sc == "dinner":                       # la cena: rim en vez de hat abierto
            for st in (2, 6, 10, 13):
                s.add("rim", t=s.ts(bar, st) + sw(st), vel=vj(0.8 if st != 13 else 0.55))
        if sc == "value":
            for st in (6, 14):
                s.add("rim", t=s.ts(bar, st) + sw(st), vel=vj(0.75))

    # --- el clap le deja el lugar a los SFX chicos que caen en el 2 o el 4 (−8 dB) ---
    for c in cues["cues"]:
        if c["sfx"] not in CLAP_YIELDS_TO:
            continue
        for e in s.ev.get("clap", []):
            if abs(e["t"] - c["t"]) < 0.01:
                e["vel"] *= db(-8.0)
                e["yield"] = c["id"]

    for c in cues["cues"]:
        if c["sfx"] not in HATS_YIELD_TO:
            continue
        for trk in ("ohat", "chat", "shaker"):
            for e in s.ev.get(trk, []):
                if -0.005 < e["t"] - c["t"] < 0.12:
                    e["vel"] *= db(-6.0)

    # --- en los cortes con un SFX grande, el bombo cede 2,5 dB (no se apilan los dos golpes) ---
    for c in cues["cues"]:
        if c["sfx"] in KICK_YIELDS_TO:
            for e in s.ev.get("kick", []):
                if abs(e["t"] - c["t"]) < 0.01:
                    e["vel"] *= db(-2.5)

    # --- crashes en todos los cortes de escena (el del drop y el del cierre, enteros) ---
    s.add("crash", t=s.t(2), vel=0.9, decay=1.1)
    s.add("crash", t=s.t(14), vel=1.0, decay=1.1)
    # el del golpe final: el mismo platillo de la v1 (mismas tiradas, mismo pico: no corre el recorte de
    # todos los crashes), pero su cola se funde desde el stinger hasta 29,95 (no queda sonando en 30,0)
    s.add("crash", t=s.t(15), vel=1.0, decay=1.0, fade=(s.t(15, 1 + END_STINGER_STEP / 4), s.duration - 0.05))
    for bar, v in CUTS.items():
        s.add("crash", t=s.t(bar), vel=v, decay=0.6)

    # --- crashes invertidos de UN beat que CULMINAN en el corte (t_end = corte) ---
    for bar in REVCRASH_INTO:
        s.add("revcrash", t_end=s.t(bar), length=s.beat, vel=1.0)

    # --- fills de 1 beat (beat 4) antes de los cortes de la experiencia ---
    for bar, kind in FILLS.items():
        t4 = s.t(bar, 4)
        if kind == "toms":
            for k, f in enumerate((247.0, 220.0, 185.0, 165.0)):
                s.add("tom", t=t4 + k * s.step, freq=f, vel=0.55 + 0.12 * k)
        elif kind == "toms32":
            for k, f in enumerate((262.0, 247.0, 220.0, 196.0, 185.0, 165.0, 147.0, 139.0)):
                s.add("tom", t=t4 + k * s.step / 2, freq=f, vel=0.45 + 0.07 * k)
        elif kind == "flam":
            for k in range(4):
                v = 0.5 + 0.15 * k
                s.add("fill_snare", t=t4 + k * s.step - 0.012, vel=v * 0.55)   # flam: el «grace» antes
                s.add("fill_snare", t=t4 + k * s.step, vel=v)
        elif kind == "congas":
            for k, (drum, kind2) in enumerate((("hi", "slap"), ("hi", "open"), ("lo", "open"), ("lo", "open"))):
                s.add("conga", t=t4 + k * s.step, drum=drum, kind=kind2, vel=0.7 + 0.1 * k)

    # --- tic-tac del reloj en corcheas durante el build (el primero es el SFX office_tick) ---
    k = 1
    while True:
        t = k * s.beat / 2.0
        if t >= s.times["gap0"] - 0.05:
            break
        s.add("clock", t=t, high=(k % 2 == 0), vel=0.55 + 0.25 * (t / s.times["gap0"]))
        k += 1

    # --- redobles que se aceleran (corcheas → semicorcheas → fusas), velocidad lineal 0,5 → 1 ---
    # (el de c13 va +3 dB: es el que lleva a la segunda ola sin bombo ni bajo y tiene que oírse)
    for bar, t_end, k in ((1, s.times["gap0"], 1.0), (13, s.times["gap2_0"], db(3.0))):
        times = _roll_times(s, bar, t_end)
        for t in times:
            p = (t - s.t(bar)) / (t_end - s.t(bar))
            s.add("roll", t=t, vel=(0.5 + 0.5 * p) * k, pitch=1.0 + 0.35 * p)

    # --- risers: entran a −30 dB en el beat 1 y culminan en el hueco (gancho y segunda ola) ---
    s.add("riser", t=s.t(1), t_end=s.times["gap0"], chord=[64, 68, 71], semis=12.0, vel=1.0, kind="hook")
    s.add("riser", t=s.t(13), t_end=s.times["gap2_0"], chord=[64, 69, 71], semis=12.0, vel=1.1, kind="value")

    # --- impactos: sub, downlifter, stabs y la capa aguda de ruido de los dos picos ---
    s.add("sub", t=s.times["drop"], vel=1.0, f0=100.0)
    s.add("sub", t=s.times["close"], vel=0.85, f0=95.0)
    s.add("sub", t=s.times["final"], vel=0.9, f0=90.0)
    s.add("downlifter", t=s.times["drop"], length=1.6, vel=0.6)
    s.add("downlifter", t=s.times["close"], length=1.4, vel=0.5)
    # la capa aguda de ruido es lo que más marca un corte en > 2 kHz sin sumar pico en el grave; el
    # cierre y el golpe final la llevan más fuerte que el drop (vienen después de un build y de un
    # estribillo, los dos con mucho agudo)
    s.add("impact", t=s.times["drop"], vel=0.75)
    s.add("impact", t=s.times["close"], vel=1.45)
    s.add("impact", t=s.times["final"], vel=1.15)
    for bar, v in ((3, 0.9), (4, 1.3), (5, 0.55), (6, 0.4), (10, 0.4), (11, 0.4)):   # cortes: un impacto chico
        s.add("impact", t=s.t(bar), vel=v)
    # los stabs de los dos picos con ataque de 15 ms: el golpe del primer milisegundo lo dan bombo, crash
    # e impacto; un frente de sierras a pleno en el mismo instante solo sumaba pico (el AAC recodificado
    # lo convierte en pre-eco y el limitador del master lo cobraba bajando todo)
    s.add("stab", t=s.times["drop"], chord="A", vel=1.0, gate=0.35, bright=1.0, attack=0.015)
    s.add("stab", t=s.times["close"], chord="D", vel=0.9, gate=0.3, bright=1.0, attack=0.015)
    # golpes musicales en los cortes que no tenían ninguno (navieras ya tiene los stabs por chip)
    s.add("stab", t=s.t(12), chord="D", vel=0.6, gate=0.18, bright=0.8, attack=0.006)
    s.add("stab", t=s.t(13), chord="Esus", vel=0.6, gate=0.18, bright=0.8, attack=0.006)

    # =====================================================================
    # ARMONÍA Y MELODÍA
    # =====================================================================
    # --- pad (bloques por acorde): −2 dB fuera de los picos; el atardecer crece (swell) ---
    for t0, t1, name in s.chords:
        bar = int(t0 / s.bar + 1e-9)
        sc = SCENE[bar]
        if sc == "build":
            s.add("pad_wall", t=t0, dur=t1 - t0, chord=name, vel=0.8)
        elif sc == "final":
            # se sostiene (bombeando con el groove) hasta el stinger y ahí se suelta: release de 0,25 s
            # que llega a cero exacto a los 0,4 s, antes de 30,0 (+3 dB: el acorde es lo principal)
            s.add("pad", t=t0, dur=s.times["stinger"] - t0, chord=name, vel=db(3.0), final=True)
        else:
            v = {"drop": 1.0, "close": 1.0, "value": db(-4.0), "vbuild": db(-3.5), "dest": db(-4.5),
                 "lines": db(-4.5)}.get(sc, db(-3.0))
            s.add("pad", t=t0, dur=t1 - t0, chord=name, vel=v, final=False, swell=(sc == "sunset"))

    # --- bajo ---
    for bar in range(16):
        sc = SCENE[bar]
        if sc == "final":
            # el golpe final suelta el bajo en el beat 2 (antes: release de 1 s que tapaba el groove)
            s.add("bass", t=s.ts(bar, 0), midi=CHORDS["Aadd9"]["bass"], gate=0.4, vel=0.9, release=0.3)
            continue
        pat = BASS_LIGHT if sc in ("value", "vbuild") else BASS_PAT
        for st, octv, d in pat:
            t = s.ts(bar, st)
            if sc == "vbuild" and t + d * s.step > s.times["vsurge"] - 1e-6:
                continue                                   # se corta en val.surge
            ch = CHORDS[s.chord_at(t + 1e-4)]
            track = "bass_wall" if sc == "build" else "bass"
            vel = 0.75 if sc in ("value", "vbuild") else 1.0
            s.add(track, t=t, midi=ch["bass"] + octv, gate=d * s.step * 0.92, vel=vel)

    # --- lead (hook): cena −3 dB, atardecer −2 dB; nota final −4 dB ---
    lead_plan = {2: (HOOK_CALL, 0.0), 3: (HOOK_ANSWER, 0.0), 4: (HOOK_CALL, -1.0), 5: (HOOK_ANSWER, 0.0),
                 6: (HOOK_CALL_E, -2.0), 14: (HOOK_CALL, 0.0)}
    for bar, (phrase, gdb) in lead_plan.items():
        prev = None
        for i, (st, m, d, vw) in enumerate(phrase):
            nxt = phrase[i + 1][3] if i + 1 < len(phrase) else vw
            # gate al 80 %: deja un respiro entre notas (articulación de «vocal chop», el rebote del 3-3-2)
            # en los downbeats (donde caen los cortes) la consonante va suave: el golpe ya lo dan bombo,
            # crash y SFX, y un frente de ruido más en el mismo milisegundo solo suma pico
            # (y en los dos downbeats grandes, drop y cierre, sin consonante: ahí sumaba al pico del master)
            cons = (0.0 if bar in (2, 14) else 0.3) if st == 0 else 1.0
            s.add("lead", t=s.ts(bar, st), midi=m, gate=d * s.step * (0.8 if d < 4 else 0.9),
                  vel=(1.0 if st % 4 == 0 else 0.92) * db(gdb), prev=prev, vowel=vw, vowel_to=nxt,
                  consonant=cons)
            prev = m
    # nota final en el golpe de 28,125: Do#6 (la tercera, «soleado»), se suelta en 29,0
    s.add("lead", t=s.times["final"], midi=85, gate=s.times["lead_end"] - s.times["final"], vel=db(-4.0),
          prev=81, vowel="o", vowel_to="u", release=0.35, final=True, consonant=0.0)

    # --- marimba lo-fi con el motivo en el build (detrás de la pared) ---
    for bar, phrase in ((0, HOOK_CALL), (1, HOOK_ANSWER)):
        for st, m, d, _ in phrase:
            if bar == 1 and st >= 12:
                continue  # el último pedacito lo tapan el riser y el gap
            s.add("marimba_wall", t=s.ts(bar, st), midi=m, vel=0.9)
            s.add("marimba_wall", t=s.ts(bar, st), midi=m - 12, vel=0.45)

    # --- marimba en el registro del pad (sin el +12): pileta, destinos y valor ---
    pin_steps = {}
    for c in cues["cues"]:
        if c["sfx"] == "pin_pop":
            b = int(c["t"] / s.bar + 1e-9)
            pin_steps.setdefault(b, set()).add(int(round((c["t"] - b * s.bar) / s.step)))
    for bar in (3, 7, 8, 9, 11, 12):
        sc = SCENE[bar]
        for st in range(16):
            if st % 2 == 1 and sc != "value":
                continue
            if st in pin_steps.get(bar, ()):
                continue                               # el pin es la nota de ese beat
            t = s.ts(bar, st)
            ch = CHORDS[s.chord_at(t + 1e-4)]
            tones = sorted(ch["pad"]) + [ch["pad"][0] + 12]
            m = tones[ARP_IDX[st % 8] % len(tones)] + (12 if sc == "value" else 0)
            v = {"value": 0.5, "pool": 0.45}.get(sc, 0.25)
            s.add("marimba", t=t + sw(st), midi=m, vel=vj(v * (1.25 if st % 4 == 0 else 1.0), 0.08))
    # la cena: la marimba contesta en el silencio del hook (pasos 12–15)
    for st, m in ((12, 76), (13, 73), (14, 71), (15, 69)):
        s.add("marimba", t=s.ts(4, st) + sw(st), midi=m, vel=vj(0.62, 0.05))

    # --- piano eléctrico de la cena: acordes a contratiempo, suaves ---
    for st in (2, 6, 10, 14):
        s.add("rhodes", t=s.ts(4, st) + sw(st), chord="D", gate=0.22, vel=vj(0.75, 0.05))

    # --- bronces del show: stabs a contratiempo, por debajo del hook ---
    for st, g in ((2, 0.1), (10, 0.1), (14, 0.16)):
        s.add("brass", t=s.ts(5, st), chord="A", gate=g, vel=vj(0.9, 0.04))

    # --- plucks: voicing abierto por debajo de La4, con delay ---
    for bar in (2, 5, 6, 11, 12, 13, 14):
        sc = SCENE[bar]
        for st in PLUCK_PAT:
            t = s.ts(bar, st)
            ch = CHORDS[s.chord_at(t + 1e-4)]
            vel = {"value": 0.9, "vbuild": 0.85, "drop": 0.8, "close": 0.8}.get(sc, 0.72)
            if sc == "vbuild":
                op = st / 16.0                         # el filtro se abre durante el build
            elif sc in PEAKS:
                op = 0.8                               # +2 kHz de corte en los picos (brillo musical)
            else:
                op = 0.8 if sc == "value" else 0.4
            voicing = [m + 12 for m in ch["pluck"]] if sc in ("value", "vbuild") else ch["pluck"]
            s.add("pluck", t=t, chord=voicing, vel=vel, open=op)

    # --- c10: stabs por chip de naviera, media semicorchea DESPUÉS del chip (le dejan el ataque) ---
    for i, cid in enumerate(("lines.in", "lines.c2", "lines.c3", "lines.c4", "lines.c5", "lines.c6")):
        c = s.cue(cid)
        s.add("stab", t=c["t"] + s.step / 2, chord="Esus" if i == 0 else "E", vel=db(3.0) * 0.6, gate=0.2,
              bright=1.0)

    # --- steel drum ---
    # contramelodía de los destinos: al centro (el ancho lo da el ping-pong) y a −2 dB, porque en c7–c9
    # es LA melodía (no hay hook): más baja, el tramo quedaba oscuro (centroide ~500 Hz)
    for bar, notes in STEEL_COUNTER.items():
        for st, m, d in notes:
            s.add("steel", t=s.ts(bar, st) + sw(st), midi=m, vel=vj(0.8 * db(-2.0), 0.06), pan=0.0)
    for bar in (2, 14):   # dobla la pregunta del hook UNA OCTAVA ARRIBA y a −9 dB en los dos picos
        for st, m, d, _ in HOOK_CALL:
            s.add("steel", t=s.ts(bar, st), midi=m + 12, vel=0.55 * db(-9.0), pan=0.15)
    # pileta: steel «salpicado» después del tobogán (pasos 9–13, después del splash de 6,56)
    for st, m in ((9, 81), (10, 85), (11, 88), (13, 85)):
        s.add("steel", t=s.ts(3, st) + sw(st), midi=m, vel=vj(0.42, 0.06), pan=0.2)
    # navieras: un remate después de los seis chips
    for st, m in ((12, 88), (13, 85)):
        s.add("steel", t=s.ts(10, st) + sw(st), midi=m, vel=vj(0.45, 0.05), pan=0.0)
    # acorde final rasgueado en steel y marimba (+3 dB)
    for i, m in enumerate([69, 73, 76, 81]):
        s.add("steel", t=s.times["final"] + i * 0.028, midi=m, vel=(0.6 - 0.05 * i) * db(3.0), pan=0.0)
    for i, m in enumerate([57, 64, 69, 71, 73, 76]):
        s.add("marimba", t=s.times["final"] + i * 0.022, midi=m, vel=0.55 * db(3.0))

    # --- el final con beat: groove liviano hasta el último beat y stinger (va al final de todo: los
    # eventos nuevos quedan últimos en cada pista y no cambian el round-robin ni las semillas del resto)
    _end_groove(s)
    return s


def _end_groove(s: Song) -> None:
    """Compás 15 después del golpe final (PLAN §12, v2). El CTA de WhatsApp vive con beat hasta el
    final y la flecha que «empuja en cada beat» tiene beat:

    - **groove liviano** (28,125 → 29,53): bombo en los beats 2 y 3, shaker en semicorcheas, hat
      abierto a contratiempo, cerrado suave, tres congas, un stab de marimba en La add9 por beat y el
      eco de la pregunta del hook en steel (Mi5·Mi5·Fa#5, 3-3-2) cuyo salto a La5 cae en el stinger.
      Sin clap, sin línea de bajo ni lead: es la respiración después del golpe, no otro estribillo;
    - **stinger** en b(15, 4) = 29,53125: bombo + clap + nota grave corta + stab supersaw en La add9 +
      marimba rasgueada + La5 de steel + campanitas (Si5, Mi6, La6) + un splash corto + un impacto de
      ruido chico (el «aire» de los cortes), anticipado por un crash invertido de media negra. Todo
      con caídas cortas: en 29,9 ya bajó ~23 dB por sí solo y el fundido del master (desde 29,78)
      solo acompaña los últimos 220 ms.

    Usa su propia semilla: no toca la secuencia del generador del resto del arreglo."""
    rng = rng_of("arreglo", "final")
    bar = 15
    t_st = s.times["stinger"]
    SW = 0.11 * s.step

    def sw(step):
        return SW if step % 2 == 1 else 0.0

    def vj(v, amt=0.07):
        return float(v * (1 + rng.uniform(-amt, amt)))

    def hum(scale=0.0012):
        return float(rng.uniform(-scale, scale))

    # --- groove liviano ---
    for st in END_KICK_STEPS:
        s.add("kick", t=s.ts(bar, st), vel=0.82, big=False)
    for st in range(END_STINGER_STEP):
        s.add("shaker", t=s.ts(bar, st) + sw(st) + hum(), vel=vj(SHAKER_VEL[st] * 0.85, 0.1))
    for st in (2, 6, 10):
        s.add("ohat", t=s.ts(bar, st) + hum(0.0006), vel=vj(0.7))
    for st in range(1, END_STINGER_STEP):
        if st % 4 == 2:
            continue
        s.add("chat", t=s.ts(bar, st) + sw(st) + hum(), vel=vj(0.36 if st % 2 == 0 else 0.22, 0.12))
    for st, drum, kind in END_CONGAS:
        s.add("conga", t=s.ts(bar, st) + sw(st) + hum(), drum=drum, kind=kind, vel=vj(0.62, 0.1))
    for st in END_KICK_STEPS:   # el stab de marimba de cada beat (rasgueo de 5 ms, barra apagada)
        for i, m in enumerate(END_MARIMBA_STAB):
            s.add("marimba", t=s.ts(bar, st) + i * 0.005, midi=m, vel=vj(0.5, 0.05), decay=0.45)
    for st, m in END_ECHO:
        s.add("steel", t=s.ts(bar, st) + sw(st), midi=m, vel=vj(0.62, 0.04), pan=0.0, decay=0.4)

    # --- stinger ---
    s.add("revcrash", t_end=t_st, length=s.beat / 2, vel=0.7)
    s.add("kick", t=t_st, vel=1.0, big=False)
    s.add("clap", t=t_st, vel=0.9)
    s.add("bass", t=t_st, midi=CHORDS["Aadd9"]["bass"], gate=0.12, vel=0.85, release=0.1)
    s.add("stab", t=t_st, chord="Aadd9", vel=0.85, gate=0.08, bright=1.2, attack=0.004, release=0.12)
    for i, m in enumerate(STINGER_MARIMBA):
        s.add("marimba", t=t_st + i * 0.004, midi=m, vel=0.55 * db(2.0), decay=0.3)
    s.add("steel", t=t_st, midi=81, vel=0.7, pan=0.0, decay=0.3)
    for i, m in enumerate(STINGER_BELLS):
        s.add("bell", t=t_st + 0.012 + i * 0.022, midi=m, vel=0.75 - 0.1 * i, pan=-0.35 + 0.35 * i)
    s.add("crash", t=t_st, vel=0.95, decay=0.16, length=s.duration - 0.03 - t_st)   # splash corto y brillante
    # el «aire» de los cortes, chico y corto (termina con su fundido de 0,2 s antes de 30,0)
    s.add("impact", t=t_st, vel=0.55, length=s.duration - 0.03 - t_st)


if __name__ == "__main__":
    song = build_song()
    for k, v in sorted(song.ev.items()):
        print(f"{k:14s} {len(v):4d} eventos")
    print(song.times)
