"""
build.py — render, mezcla y master de la música + SFX de la promo de Prime Cruceros.

    python audio/build.py                 # → public/audio/promo.wav + audio/stems/*.wav
    python audio/build.py --out X.wav     # otra salida (la usa analyze.py para el test de determinismo)
    python audio/build.py --no-stems

Flujo:
1. arrangement.build_song() arma los eventos desde src/cues.json.
2. Cada pista se sintetiza (instruments.py) y se suma a su BUS:
   drums · bass · music · lead · wall (la música «detrás de la pared» del build) · fx · sfx.
3. Cada bus tiene su proceso: sidechain sincronizado al bombo (bombeo), EQ, compresión, envíos a
   reverb (IR sintetizada) y delay ping-pong, ducking por banda disparado por el lead (el hook
   manda en 400–3000 Hz) y las compuertas de los huecos (hook.gap y el de antes de la segunda ola).
4. Master: solo etapas multiplicativas (fundido final, compresor de pegamento, ganancia de
   loudness iterada hasta −14 LUFS y limitador true-peak). Como todo es una ganancia que varía en
   el tiempo, los stems se escriben con esa MISMA ganancia: su suma es el master.

El final (v2, PLAN §12): el groove liviano sigue hasta el stinger de 29,53125; desde ahí no entra nada
nuevo a los delays, las reverbs se cierran en ~0,35 s y el fundido del master (coseno², desde
stinger + 0,25 s) solo acompaña la cola hasta el cero exacto de la última muestra.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import instruments as I  # noqa: E402
from arrangement import CHORDS, build_song  # noqa: E402
from scipy.ndimage import maximum_filter1d  # noqa: E402

from dsp import (SR, bp, compress, convolve_reverb, high_shelf, hp, low_shelf, lp, lufs_integrated,  # noqa: E402
                 make_ir, mono_below, ns, one_pole_ar, pan, peq, pingpong, place, pump_env, rms_env, rng_of,
                 read_wav, smoothstep, true_peak_env,
                 soft_clip_os, svf, svf4, todb, tp_limiter, true_peak_db, undb, width, write_wav)
from sfx import SFX_GAIN_DB, render_cue  # noqa: E402

ROOT = os.path.dirname(HERE)
OUT_WAV = os.path.join(ROOT, "public", "audio", "promo.wav")
STEM_DIR = os.path.join(HERE, "stems")

TARGET_LUFS = -14.0
CEILING_DBTP = -3.0     # margen para que el AAC (también 128 kb/s y segunda generación) no pase de −1 dBTP
CLIP_OVER_DB = 1.5      # la etapa rápida del master trabaja en techo + 1 dB: toma la punta de los golpes
                        # apilados casi sin release, y el limitador principal queda para el true peak
DOTTED_8TH = 0.75 * 0.46875

# Niveles de cada pista a la entrada de su bus (dB). Se ajustaron mirando el loudness por compás,
# el espectro por sección y la audibilidad de cada SFX (ver README).
LEVEL = {
    "kick": -5.0, "clap": -12.0, "ohat": -14.0, "chat": -20.5, "shaker": -16.5, "perc": -14.0,
    "crash": -7.0,     # alto a propósito: marca los cortes; sus picos se recortan aparte (CRASH_CLIP_DB)
    "bass": -11.0, "sub": -13.0,
    "pad": -13.0, "pluck": -14.0, "marimba": -14.0, "steel": -13.0, "stab": -15.0, "rhodes": -16.0,
    "brass": -17.0, "bell": -14.0,
    "lead": -5.0,
    "wall": -7.0,
    "riser_noise": -24.0, "riser_tone": -27.0, "roll": -19.0, "revcrash": -15.0, "downlifter": -17.0,
    "clock": -19.0, "impact": -12.0,
    "sfx": -1.5,
}
PEAK_BOOST_DB = 2.3      # automatización de los dos picos (drop y cierre) en bajo, música, lead y fx
EXP_TRIM_DB = -1.9       # la experiencia (c3–c6) más abajo: cada compás ≥ 1,5 LU debajo del drop
DEST_TRIM_DB = -0.8      # los destinos (c7–c10) menos recortados: no son un «valle» de 7,5 s
VALUE_TRIM_DB = 0.8      # el valor (c11–c12) queda ~1,5 LU debajo de la experiencia, no 2,5
# recortes suaves ×4 por pista, en dB debajo del máximo de cada una (ver build_mix)
CRASH_CLIP_DB = 13.0     # el ruido del crash tiene picos de 1–2 muestras al nivel del bombo: se
                         # recortan sin cambiar lo que se oye y dejan de apilarse sobre el golpe
IMPACT_CLIP_DB = 10.0
KICK_BUS_CLIP_DB = 5.0   # el bus de batería se recorta al pico TÍPICO de cada bombo − 5 dB: el
                         # primer milisegundo del golpe lo redondea este clipper y no el limitador
                         # del master (que bajaba TODO 1,5 dB durante 150 ms en cada negra)
SFX_CEIL_BELOW_KICK_DB = 1.5   # techo del bus de SFX: el pico típico del bombo (antes del clipper) − 1,5 dB
LEAD_CLIP_DB = 6.0       # las consonantes del chop (ruido de 9 ms) eran picos sueltos del master
LEAD_DUCK = dict(sfx=3.5, music=6.0, perc=3.0)   # dB que el lead le saca a cada bus en 400–3000 Hz
# El final (PLAN §12): el stinger de 29,53 cierra con una cola que se apaga sola antes de 30,0
DELAY_CLOSE_BEFORE_STINGER = 0.25   # s: lo que suena desde acá (el Fa#5 del eco y el stinger) no va al delay
WET_CLOSE = (0.06, 0.40)            # s después del stinger: las reverbs se cierran en ese tramo (coseno)
END_FADE_AFTER_STINGER = 0.25       # s: el fundido del master arranca 0,25 s después del stinger


def S(t: float) -> int:
    return int(round(t * SR))


class Ctx:
    """Contexto compartido del render: largo, canción, triggers de sidechain, compuertas."""

    def __init__(self, song):
        self.song = song
        self.N = int(round(song.duration * SR))       # 1 440 000 muestras exactas
        self.NB = self.N + ns(3.0)                     # buffer con margen para colas (se recorta al final)
        self.t = np.arange(self.NB) / SR
        self.kicks = [S(e["t"]) for e in song.ev.get("kick", [])]
        self.wall_kicks = [S(e["t"]) for e in song.ev.get("kick_wall", [])]
        tm = song.times
        g_hook_dry = self._gap(tm["gap0"], tm["gap1"], floor=0.0)
        g_hook_wet = self._gap(tm["gap0"], tm["gap1"], floor=float(undb(-24.0)))
        g_close_dry = self._gap(tm["gap2_0"], tm["gap2_1"], floor=0.0)
        g_close_wet = self._gap(tm["gap2_0"], tm["gap2_1"], floor=float(undb(-24.0)))
        # música: los dos huecos. SFX: solo el del gancho (el de la segunda ola es solo musical:
        # el SFX de val.surge culmina en su cue). Wall: se cierra en el gap y no vuelve a abrir.
        self.gates = {
            "music": (g_hook_dry * g_close_dry, g_hook_wet * g_close_wet),
            "sfx": (g_hook_dry, g_hook_wet),
            "wall": (self._closed_after(tm["gap0"]), self._closed_after(tm["gap0"])),
        }
        # colas húmedas (reverbs y delays de TODOS los buses) del final: el stinger tiene su ambiente
        # un instante y después se cierra todo, así la cola del tema termina limpia antes de 30,0
        a, b = tm["stinger"] + WET_CLOSE[0], tm["stinger"] + WET_CLOSE[1]
        self.wet_tail = 1.0 - smoothstep((self.t - a) / (b - a))

    def _gap(self, t0, t1, floor):
        """Compuerta de una semicorchea: baja en 2 ms desde t0 y vuelve en 1,5 ms terminando
        0,3 ms antes del golpe siguiente (el ataque queda intacto)."""
        g = np.ones(self.NB)
        a, b = S(t0), S(t1) - ns(0.0003)
        r1, r2 = ns(0.002), ns(0.0015)
        k = np.arange(r1) / r1
        g[a:a + r1] = floor + (1 - floor) * np.cos(0.5 * np.pi * k) ** 2
        g[a + r1:b - r2] = floor
        k = np.arange(r2) / r2
        g[b - r2:b] = floor + (1 - floor) * np.sin(0.5 * np.pi * k) ** 2
        return g

    def _closed_after(self, t0):
        g = np.ones(self.NB)
        a, r = S(t0), ns(0.002)
        g[a:a + r] = np.cos(0.5 * np.pi * np.arange(r) / r) ** 2
        g[a + r:] = 0.0
        return g

    def window(self, t0, t1, ramp=0.03):
        """1 dentro de [t0, t1] con rampas suaves, 0 afuera."""
        r = max(ramp, 1e-4)
        return smoothstep((self.t - t0 + r) / r) * (1 - smoothstep((self.t - t1) / r))

    def z(self):
        return np.zeros((2, self.NB))


def pan_st(x, p):
    """Balance de una señal estéreo (p −1..1) conservando su ancho."""
    a = (p + 1) * np.pi / 4
    return np.vstack([x[0] * np.cos(a) * np.sqrt(2), x[1] * np.sin(a) * np.sqrt(2)])


def rr(fn, count, name, **kw):
    """Round-robin: `count` variantes deterministas de un golpe (como samples alternados)."""
    return [fn(rng=rng_of(name, i), **kw) for i in range(count)]


def mono_from(x, t0, c: Ctx, ramp=0.25):
    """Pasa una señal estéreo a mono desde t0 (rampa): las colas de delay del final no rebotan L/R."""
    m = 0.5 * (x[0] + x[1])
    k = smoothstep((c.t[:x.shape[1]] - t0) / ramp)
    return np.vstack([x[0] * (1 - k) + m * k, x[1] * (1 - k) + m * k])


def lead_key(lead, c: Ctx):
    """Cuánto «está sonando» el lead (0..1), con ataque de 5 ms y release de 120 ms. Es la llave
    de los duckings por banda: cuando canta el hook, SFX y música le abren 400–3000 Hz."""
    e = rms_env(lead, 0.02)
    e_db = todb(e) - float(todb(e.max()))
    amt = smoothstep((e_db + 32.0) / 20.0)
    # ataque de 30 ms y release de 250 ms: el ducking abre lugar a la parte sostenida del hook y no
    # se mete con los transitorios (ni le corre la cresta a un SFX que cae junto con una nota)
    return one_pole_ar(amt, 0.03, 0.25)


# SFX chicos que tienen prioridad sobre la música: durante 150 ms la música les abre 800–5000 Hz
SFX_PRIORITY = ("confetti_pop", "chip_pop", "sticker_slap", "ticket_tear", "button_pop", "ticket_whoosh",
                "whoosh_in", "hit", "hit_soft", "suitcase_drop", "pin_pop", "type_tick", "bubble_pop",
                "chips_stack")
SFX_DUCK_DB = 4.0


def sfx_key(c: Ctx, names=SFX_PRIORITY):
    """Llave 0..1 que vale 1 en los primeros 150 ms de cada SFX de `names` (None = todos), con
    rampas de 5 ms (entrada) y 80 ms (salida)."""
    k = np.zeros(c.NB)
    for cue in c.song.cues["cues"]:
        if cue["sfx"] != "silence" and (names is None or cue["sfx"] in names):
            k = np.maximum(k, c.window(cue["t"] - 0.005, cue["t"] + 0.15, 0.005))
    return one_pole_ar(k, 0.003, 0.08)


def duck_band(x, key, depth_db, lo=400.0, hi=3000.0):
    """EQ dinámico: baja la banda [lo, hi] hasta `depth_db` según la llave (0..1).
    y = x − (1 − g)·BP(x): con g = 1 la señal sale intacta."""
    band = bp(x, lo, hi, order=2)
    g = undb(-depth_db * key)
    return x - (1.0 - g) * band


# ---------------------------------------------------------------------------
# Render de pistas
# ---------------------------------------------------------------------------

def r_drums(c: Ctx):
    s = c.song
    tr = {k: c.z() for k in ("kick", "clap", "ohat", "chat", "shaker", "perc", "crash")}
    k_main = I.kick(1.0, rng=rng_of("kick"))
    k_big = I.kick(1.0, tail=0.15, length=0.5, rng=rng_of("kick-big"))
    for e in s.ev.get("kick", []):
        place(tr["kick"], (k_big if e.get("big") else k_main) * e["vel"], S(e["t"]))
    claps = rr(I.clap, 4, "clap")
    snrs = rr(I.snare, 4, "clap-snare", pitch=1.1, tail=0.09, body=0.6)
    for i, e in enumerate(s.ev.get("clap", [])):
        place(tr["clap"], (claps[i % 4][:, :ns(0.35)] + 0.45 * snrs[i % 4][:, :ns(0.35)]) * e["vel"], S(e["t"]))
    ohs = rr(I.hat, 4, "ohat", decay=0.12, length=0.32)
    for i, e in enumerate(s.ev.get("ohat", [])):
        place(tr["ohat"], pan_st(ohs[i % 4], 0.22) * e["vel"], S(e["t"]))
    chs = rr(I.hat, 6, "chat", decay=0.022)
    for i, e in enumerate(s.ev.get("chat", [])):
        place(tr["chat"], pan_st(chs[i % 6], 0.35) * e["vel"], S(e["t"]))
    shs = rr(I.shaker, 8, "shaker")
    for i, e in enumerate(s.ev.get("shaker", [])):
        place(tr["shaker"], pan_st(shs[i % 8], -0.32) * e["vel"], S(e["t"]))
    # percusión tropical afinada en el tono: congas La3/Mi4, bongós Fa#4/Si4
    conga_f = {"lo": 220.0, "hi": 329.6}
    for i, e in enumerate(s.ev.get("conga", [])):
        x = I.conga(conga_f[e["drum"]], e["vel"], rng_of("conga", i), e["kind"])
        place(tr["perc"], pan(x, -0.38 if e["drum"] == "lo" else 0.3), S(e["t"]))
    for i, e in enumerate(s.ev.get("bongo", [])):
        x = I.conga(493.9 if e["hi"] else 370.0, e["vel"], rng_of("bongo", i), "open")[: ns(0.25)]
        x = x * np.linspace(1, 0, len(x)) ** 0.5
        place(tr["perc"], pan(x, -0.55), S(e["t"]))
    cl = I.clave(1.0)
    for e in s.ev.get("clave", []):
        place(tr["perc"], pan(cl * e["vel"], 0.5), S(e["t"]))
    for i, e in enumerate(s.ev.get("rim", [])):
        place(tr["perc"], pan(I.rim(e["vel"], rng_of("rim", i)), 0.18), S(e["t"]))
    # fills: toms que bajan y flams de redoblante antes de los cortes
    for i, e in enumerate(s.ev.get("tom", [])):
        p = float(np.clip((e["freq"] - 190.0) / 120.0, -0.6, 0.6))
        place(tr["perc"], pan(I.tom(e["freq"], e["vel"], rng_of("tom", i)), p), S(e["t"]))
    for i, e in enumerate(s.ev.get("fill_snare", [])):
        place(tr["clap"], I.snare(e["vel"], rng_of("fill-snare", i), pitch=1.05, tail=0.08), S(e["t"]))
    for i, e in enumerate(s.ev.get("crash", [])):
        d = e.get("decay", 0.9)
        x = I.crash(e["vel"], rng_of("crash", i), length=e.get("length", d * 2.8 + 0.2), decay=d)
        if "fade" in e:   # cola fundida (coseno) entre dos tiempos absolutos; antes del primero, intacta
            f0, f1 = e["fade"]
            x = x * (1.0 - smoothstep((e["t"] + np.arange(x.shape[1]) / SR - f0) / (f1 - f0)))
        place(tr["crash"], x, S(e["t"]))
    return tr


def r_bass(c: Ctx, key="bass"):
    out = c.z()
    for i, e in enumerate(c.song.ev.get(key, [])):
        place(out, I.bass_note(e["midi"], e["gate"], e["vel"], rng_of(key, i), release=e.get("release", 0.035)),
              S(e["t"]))
    return out


def r_pad(c: Ctx, key="pad"):
    out = c.z()
    for i, e in enumerate(c.song.ev.get(key, [])):
        ch = CHORDS[e["chord"]]
        if e.get("final"):
            x = I.pad_chord(ch["pad"], e["dur"], rng_of(key, i), cutoff=3400.0, attack=0.008, release=0.7,
                            detune=0.24)
        elif e.get("swell"):
            # el atardecer: el pad crece durante todo el compás (abre el filtro y sube) desde una base
            # a −10 dB, así el corte al sol no queda vacío de armonía
            n = ns(e["dur"] + 0.28 + 0.05)
            br = np.linspace(0.45, 1.25, n)
            x = I.pad_chord(ch["pad"], e["dur"], rng_of(key, i), cutoff=3600.0, attack=e["dur"] * 0.7,
                            release=0.28, bright_env=br)
            x = x + 0.32 * I.pad_chord(ch["pad"], e["dur"], rng_of(key, i, "base"), cutoff=2800.0, attack=0.03,
                                       release=0.28)
        else:
            x = I.pad_chord(ch["pad"], e["dur"], rng_of(key, i), cutoff=3800.0, attack=0.05, release=0.28)
        place(out, x * e["vel"], S(e["t"]))
    return out


def r_lead(c: Ctx):
    out = c.z()
    for i, e in enumerate(c.song.ev.get("lead", [])):
        x = I.lead_note(e["midi"], e["gate"], e["vel"], rng_of("lead", i), prev_midi=e.get("prev"),
                        vowel=e.get("vowel", "a"), vowel_to=e.get("vowel_to"), release=e.get("release"),
                        consonant=e.get("consonant", 1.0))
        place(out, x, S(e["t"]))
    return out


def r_marimba(c: Ctx, key="marimba"):
    out = c.z()
    for i, e in enumerate(c.song.ev.get(key, [])):
        x = I.marimba(e["midi"], e["vel"], rng_of(key, i), decay=e.get("decay", 1.0))
        p = float(np.clip((e["midi"] - 66) / 14.0, -0.5, 0.5))
        place(out, pan(x, p), S(e["t"]))
    return out


def r_steel(c: Ctx):
    out = c.z()
    for i, e in enumerate(c.song.ev.get("steel", [])):
        x = I.steel_drum(e["midi"], e["vel"], rng_of("steel", i), decay=e.get("decay", 1.0))
        place(out, pan(x, e.get("pan", 0.0)), S(e["t"]))
    return out


def r_bell(c: Ctx):
    """Campanitas del stinger final (Si5, Mi6, La6 en abanico)."""
    out = c.z()
    for i, e in enumerate(c.song.ev.get("bell", [])):
        place(out, pan_st(I.bell(e["midi"], e["vel"], rng_of("bell", i)), e.get("pan", 0.0)), S(e["t"]))
    return out


def r_pluck(c: Ctx):
    out = c.z()
    for i, e in enumerate(c.song.ev.get("pluck", [])):
        cut = 1800.0 + 5200.0 * e.get("open", 0.4)
        for j, m in enumerate(e["chord"]):
            x = I.pluck(m, e["vel"], rng_of("pluck", i, j), gate=0.16, cutoff=cut, decay=0.18, sub=0.0)
            place(out, x / np.sqrt(len(e["chord"])), S(e["t"]))
    return out


def r_stab(c: Ctx):
    """Stabs de acorde (supersaw corto con filtro que se cierra hasta un piso brillante de ~3 kHz):
    drop, cierre, cortes del valor y chips de navieras."""
    out = c.z()
    for i, e in enumerate(c.song.ev.get("stab", [])):
        notes = CHORDS[e["chord"]]["stab"]
        gate = e["gate"]
        n = ns(gate + 0.5)
        rng = rng_of("stab", i)
        x = np.zeros((2, n))
        for m in notes:
            x += I.supersaw(440.0 * 2 ** ((m - 69) / 12), n, rng, voices=5, detune_st=0.3)
        t = np.arange(n) / SR
        floor = 900.0 + 2100.0 * e.get("bright", 1.0)
        fc = floor + 7000.0 * np.exp(-t / (0.06 + gate * 0.3))
        x = I.svf(x / np.sqrt(len(notes)), fc, 1.0, "lp")
        env = I.env_adsr(n, e.get("attack", 0.002), 0.15, 0.5, e.get("release", 0.18), gate)
        x = hp(x * env, 220.0)
        place(out, x * e["vel"], S(e["t"]))
    return out


def r_rhodes(c: Ctx):
    out = c.z()
    for i, e in enumerate(c.song.ev.get("rhodes", [])):
        for j, m in enumerate(CHORDS[e["chord"]]["pad"]):
            place(out, I.rhodes(m, e["gate"], e["vel"], rng_of("rhodes", i, j)) * 0.55, S(e["t"]) + j * ns(0.004))
    return out


def r_brass(c: Ctx):
    out = c.z()
    for i, e in enumerate(c.song.ev.get("brass", [])):
        x = I.brass_stab(CHORDS[e["chord"]]["pluck"], e["gate"], rng_of("brass", i), vel=e["vel"])
        place(out, x, S(e["t"]))
    return out


def r_fx(c: Ctx):
    s = c.song
    tr = {k: c.z() for k in ("riser_noise", "riser_tone", "roll", "revcrash", "downlifter", "clock", "sub",
                             "impact")}
    for i, e in enumerate(s.ev.get("riser", [])):
        L = e["t_end"] - e["t"]
        # entran audibles (−30 dB) en el beat 1 y crecen en dB hasta culminar en el hueco
        nr = I.noise_riser(L, rng_of("riser-n", i), f0=250.0, f1=11000.0, curve=1.0, floor_db=-30.0)
        tn = I.tone_riser(e["chord"], L, rng_of("riser-t", i), semis=e["semis"], curve=1.0, floor_db=-30.0)
        # cierre de 3 ms al final: culmina y corta en seco (sin clic)
        k = ns(0.003)
        for x in (nr, tn):
            x[:, -k:] *= np.cos(0.5 * np.pi * np.arange(1, k + 1) / k) ** 2
        place(tr["riser_noise"], nr * e["vel"], S(e["t"]))
        place(tr["riser_tone"], tn * e["vel"], S(e["t"]))
    for i, e in enumerate(s.ev.get("roll", [])):
        x = I.snare(e["vel"], rng_of("roll-hit", i), pitch=e["pitch"], tail=0.07)
        place(tr["roll"], x, S(e["t"]))
    for i, e in enumerate(s.ev.get("revcrash", [])):
        x = I.reverse_crash(e["length"], rng_of("revcrash", i))
        place(tr["revcrash"], x * e["vel"], S(e["t_end"]) - x.shape[1])
    for i, e in enumerate(s.ev.get("downlifter", [])):
        place(tr["downlifter"], I.downlifter(e["length"], rng_of("down", i)) * e["vel"], S(e["t"]))
    for i, e in enumerate(s.ev.get("clock", [])):
        place(tr["clock"], pan(I.clock_tick(e["high"], e["vel"], rng_of("clock", i)), 0.45), S(e["t"]))
    for e in s.ev.get("sub", []):
        place(tr["sub"], I.sub_boom(f0=e["f0"], vel=e["vel"]), S(e["t"]))
    for i, e in enumerate(s.ev.get("impact", [])):
        place(tr["impact"], I.noise_impact(rng_of("impact", i), vel=e["vel"], length=e.get("length", 1.2)),
              S(e["t"]))
    return tr


def r_sfx(c: Ctx):
    """Cada cue con su SFX: su anchor (la cresta medida) exactamente en round(t·SR)."""
    out = c.z()
    log = []
    for cue in c.song.cues["cues"]:
        if cue["sfx"] == "silence":
            continue
        x, a = render_cue(cue, c.song, rng_of("sfx", cue["id"]))
        start = S(cue["t"]) - a
        if start < 0:  # el primer tic (t = 0): arranca en la muestra 0
            start = 0
        place(out, x * undb(SFX_GAIN_DB[cue["sfx"]]), start)
        log.append(dict(id=cue["id"], sfx=cue["sfx"], t=cue["t"], start=start, anchor=int(a)))
    return out, log


# ---------------------------------------------------------------------------
# Buses
# ---------------------------------------------------------------------------

def wall_filter(c: Ctx, x):
    """La música «detrás de la pared»: pasa-bajos de 24 dB cerrado en c0 que se abre en c1
    (520 Hz → 14 kHz; curva p^1,2: se oye abrir desde ~2,3 s y la tensión crece pareja), con
    resonancia que sube e imagen casi mono al principio. Sin compensación de nivel: el build tiene
    que crecer también en loudness (c0 va 1,5 dB más abajo para cuidar los 6–8 LU contra el drop)."""
    s = c.song
    t = c.t
    t_open, t_gap = s.times["build_open"], s.times["gap0"]
    p = np.clip((t - t_open) / (t_gap - t_open), 0, 1)
    fc = 520.0 * (14000.0 / 520.0) ** (p ** 1.2)
    q = 0.85 + 1.4 * p ** 2
    y = svf4(x, fc, q, "lp")
    # «auriculares ajenos»: un hilito agudo que se cuela
    leak = svf4(x, 3500.0, 1.0, "bp") * float(undb(-24.0))
    y = y + leak * (1 - p)
    w = 0.25 + 0.75 * smoothstep(p)
    m = 0.5 * (y[0] + y[1])
    sd = 0.5 * (y[0] - y[1]) * w
    c0 = undb(-1.5 * (1 - smoothstep((t - t_open) / s.beat)))
    return np.vstack([m + sd, m - sd]) * c0


def tone(x):
    """EQ «de master» aplicada en cada bus ANTES de las compuertas: así ningún filtro IIR queda
    sonando dentro de un silencio. Subsónicos fuera, graves en mono, curva de brillo y nada arriba
    de 16 kHz: el AAC a 128 kb/s (y la recodificación de las redes) corta ahí, y lo que saca de
    los transitorios rearmaba picos de hasta +3 dB sobre el techo. Medido: pasar el master v2 por
    un pasa-bajos de 16 kHz subía su true peak 1,3 dB; con el corte acá, eso ya no pasa."""
    x = hp(x, 24.0, order=4)
    x = mono_below(x, 120.0)
    x = low_shelf(x, 70.0, -2.5)
    x = high_shelf(x, 8000.0, 2.5)
    x = lp(x, 16000.0, order=8)
    return x


def section_gain(c: Ctx, spans, r_s=0.015):
    """Automatización de mezcla por tramos [(t0, t1, dB)], con rampas de 15 ms que terminan justo en
    cada corte (el cambio de nivel cae con el golpe, no antes)."""
    g = np.zeros(c.NB)
    r = ns(r_s)
    k = np.arange(r) / r
    for t0, t1, d in spans:
        a, b = S(t0), min(c.NB, S(t1))
        g[a:b] += d
        g[a - r:a] += d * smoothstep(k)
        if b < c.NB:
            g[b - r:b] -= d * smoothstep(k)
    return undb(g)


def build_mix(song, verbose=True):
    t0 = time.time()
    c = Ctx(song)
    tm = song.times
    log = (lambda *a: print(*a, flush=True)) if verbose else (lambda *a: None)

    def gate(dry, wet=None, kind="music"):
        gd, gw = c.gates[kind]
        y = tone(dry) * gd
        if wet is not None:
            y = y + tone(wet) * gw * c.wet_tail
        return y

    send_gate = c.gates["music"][0]
    ir_room = make_ir(0.9, rt60=(0.7, 0.6, 0.5, 0.38, 0.25), predelay=0.006, seed=11)
    ir_hall = make_ir(3.0, rt60=(2.6, 2.3, 1.9, 1.35, 0.8), predelay=0.022, seed=23)

    pump_hard = pump_env(c.NB, c.kicks, depth=0.72, release=0.32, curve=1.8)    # pads: bombeo marcado
    pump_bass = pump_env(c.NB, c.kicks, depth=0.88, release=0.16, curve=1.4)    # bajo: deja pasar al bombo
    pump_mid = pump_env(c.NB, c.kicks, depth=0.38, release=0.24, curve=1.6)     # plucks / marimba / steel
    pump_soft = pump_env(c.NB, c.kicks, depth=0.18, release=0.2, curve=1.5)     # lead / hats
    # el sub de impacto también bombea: en su propio golpe se corre 10 dB durante el ataque del bombo
    # (el «boom» llega detrás del golpe, sin apilar los dos graves) y desde el beat 2 bombea como el bajo
    sub_ts = [S(e["t"]) for e in song.ev.get("sub", [])]
    on_sub = [k for k in c.kicks if min(abs(k - u) for u in sub_ts) <= ns(0.005)]
    pump_sub = np.minimum(pump_env(c.NB, [k for k in c.kicks if k not in on_sub], depth=0.88, release=0.16,
                                   curve=1.4),
                          pump_env(c.NB, on_sub, depth=0.68, release=0.09, curve=1.4))
    log(f"  contexto e IRs: {time.time() - t0:.1f}s")

    # ---------------- LEAD (primero: es la llave de los duckings) ----------------
    lead = r_lead(c) * undb(LEVEL["lead"])
    lead = hp(lead, 220.0)
    lead = peq(lead, 2900.0, 3.0, 1.0)
    lead = peq(lead, 4200.0, 2.0, 0.8)          # presencia: se lee en un parlante de celular
    lead = compress(lead, thr_db=-20.0, ratio=3.0, attack=0.005, release=0.08)
    lead = soft_clip_os(lead, float(todb(np.abs(lead).max())) - LEAD_CLIP_DB, os=4)  # consonantes, sin picos
    key = lead_key(lead, c)
    # el hook le saca 400–3000 Hz a las COLAS de los SFX (el agua no le tapa la melodía), pero ningún
    # SFX cede en sus primeros 150 ms: si no, uno que cae en la cola de una nota (release de 250 ms
    # de la llave) perdía 3 dB justo en la banda que lo define (pasaba con reveal.push y el golpe final)
    skey = sfx_key(c)                       # SFX prioritarios: la música les abre 800–5000 Hz
    key_for_sfx = key * (1.0 - sfx_key(c, names=None))
    pp_send = 1.0 - smoothstep((c.t - (tm["lead_end"] - 0.1)) / 0.1)      # sin eco del lead desde ~28,9
    # sin eco nuevo desde ~28,9 y los ecos que ya estaban en el lazo de realimentación también se
    # apagan (en 250 ms): la nota final no reaparece como «eco» debajo del fundido
    lwet = pingpong(lead * send_gate * pp_send, DOTTED_8TH, fb=0.34, damp_hz=5000.0, hp_hz=400.0) * 0.32
    lwet = lwet * (1.0 - smoothstep((c.t - (tm["lead_end"] - 0.1)) / 0.25))
    lwet += convolve_reverb(hp(lead, 300.0) * send_gate, ir_hall) * 0.3
    lwet = mono_from(lwet, tm["final"], c)
    lead = gate(lead, lwet) * pump_soft
    log(f"  lead: {time.time() - t0:.1f}s")

    # ---------------- DRUMS ----------------
    d = r_drums(c)
    for k in d:
        d[k] *= undb(LEVEL[k])
    # control de picos por pista (clipper suave ×4): el ruido del crash tiene picos sueltos de
    # 1–2 muestras que no suman energía pero obligaban al limitador del master a bajar todo
    # (el máximo se mide en el tema, hasta el golpe final: el splash del stinger no corre la referencia)
    crash_ref = float(todb(np.abs(d["crash"][:, :S(tm["final"] + 0.2)]).max()))
    d["crash"] = soft_clip_os(d["crash"], crash_ref - CRASH_CLIP_DB, os=4)
    d["kick"] = soft_clip_os(d["kick"], float(todb(np.abs(d["kick"]).max())) - 2.0, os=4)
    d["kick"] = hp(d["kick"], 28.0, order=2)
    d["clap"] = peq(d["clap"], 220.0, -3.0, 1.0)
    for k in ("ohat", "chat", "shaker"):
        d[k] = hp(d[k], 4000.0 if k != "shaker" else 3000.0) * pump_soft
    d["perc"] = duck_band(hp(d["perc"], 100.0) * pump_soft, key, LEAD_DUCK["perc"])
    d["crash"] = hp(d["crash"], 1000.0)
    drums_dry = sum(d.values())
    send_room = d["clap"] * 0.35 + d["perc"] * 0.25 + d["ohat"] * 0.15 + d["shaker"] * 0.12
    drums_dry = compress(drums_dry, thr_db=-16.0, ratio=2.2, attack=0.012, release=0.12, knee=6.0)
    # clipper suave ×4 referido al pico TÍPICO de cada bombo (no al máximo): redondea ~3,5 dB del
    # primer milisegundo de cada golpe y los apilamientos de los cortes; la pegada queda (el cuerpo
    # del bombo dura 100 ms) y el limitador del master deja de trabajar en cada negra. Va ANTES de
    # tone(): los armónicos que genera arriba de 16 kHz se filtran (si no, el AAC rearma picos)
    # (solo los bombos del tema, hasta el golpe final: los del groove liviano y el stinger no corren la
    # referencia, así el recorte de la batería y el techo de los SFX quedan iguales en los 28 s de antes)
    kick_pk = [float(np.abs(drums_dry[:, k:k + ns(0.02)]).max()) for k in c.kicks if k <= S(tm["final"])]
    kick_ref_db = float(todb(np.median(kick_pk)))
    drums_dry = soft_clip_os(drums_dry, kick_ref_db - KICK_BUS_CLIP_DB, os=4)
    drums = gate(drums_dry, convolve_reverb(send_room * send_gate, ir_room) * 0.32)
    log(f"  drums: {time.time() - t0:.1f}s")

    # ---------------- BASS (+ sub de impactos) ----------------
    bass = r_bass(c) * undb(LEVEL["bass"]) * pump_bass
    fx = r_fx(c)
    sub = fx.pop("sub") * undb(LEVEL["sub"]) * pump_sub
    bass = lp(bass, 4500.0, order=2)
    bass = mono_below(bass + sub, 200.0)
    # la bocina del barco tiene su lugar en los graves: el bajo baja 4 dB mientras suena
    bass = bass * undb(-4.0 * c.window(tm["horn"], tm["horn"] + 0.7, 0.04))
    bass = gate(compress(bass, thr_db=-14.0, ratio=3.0, attack=0.02, release=0.15))
    log(f"  bass: {time.time() - t0:.1f}s")

    # ---------------- MUSIC ----------------
    pad = r_pad(c) * undb(LEVEL["pad"]) * pump_hard
    pluck = r_pluck(c) * undb(LEVEL["pluck"]) * pump_mid
    mar = r_marimba(c) * undb(LEVEL["marimba"]) * pump_mid
    steel = r_steel(c) * undb(LEVEL["steel"]) * pump_mid
    stab = r_stab(c) * undb(LEVEL["stab"])
    rho = r_rhodes(c) * undb(LEVEL["rhodes"]) * pump_mid
    brass = r_brass(c) * undb(LEVEL["brass"])
    bell = r_bell(c) * undb(LEVEL["bell"])          # sin bombeo: brilla ENCIMA del bombo del stinger
    pad = peq(width(pad, 1.25), 350.0, -2.5, 0.8)
    pluck = peq(pluck, 3500.0, 2.5, 0.8)          # presencia en 2–5 kHz (celular)
    steel = peq(steel, 3500.0, 2.0, 0.8)
    music_dry = pad + pluck + mar + steel + stab + rho + brass + bell
    send_hall = (pad * 0.18 + pluck * 0.22 + mar * 0.28 + steel * 0.3 + stab * 0.35 + rho * 0.25 + brass * 0.25
                 + bell * 0.3)
    # el final: desde 0,25 s antes del stinger nada nuevo entra al delay (un eco del stinger caería en
    # ~29,88, encima de la cola que tiene que apagarse sola)
    dly_open = 1.0 - smoothstep((c.t - (tm["stinger"] - DELAY_CLOSE_BEFORE_STINGER)) / 0.02)
    send_dly = (pluck * 0.32 + mar * 0.26 + steel * 0.4 + rho * 0.15) * dly_open
    wet = convolve_reverb(hp(send_hall, 300.0) * send_gate, ir_hall) * 0.42
    wet += pingpong(send_dly * send_gate, DOTTED_8TH, fb=0.38, damp_hz=4200.0, hp_hz=350.0) * 0.55
    wet = mono_from(wet * pump_mid, tm["stinger"], c)
    # build de c13: pasa-altos que barre de 200 a 1200 Hz sobre la música (antes de la compuerta)
    t13, t13e = song.t(13), tm["gap2_0"]
    m13 = c.window(t13, tm["gap2_1"], 0.03)
    fc13 = 200.0 * (1200.0 / 200.0) ** np.clip((c.t - t13) / (t13e - t13), 0, 1)
    music_dry = music_dry * (1 - m13) + np.vstack([svf(music_dry[0], fc13, 0.8, "hp"),
                                                   svf(music_dry[1], fc13, 0.8, "hp")]) * m13
    wet = wet * (1 - m13) + np.vstack([svf(wet[0], fc13, 0.8, "hp"), svf(wet[1], fc13, 0.8, "hp")]) * m13
    music_dry = duck_band(music_dry, key, LEAD_DUCK["music"])
    music_dry = duck_band(music_dry, skey, SFX_DUCK_DB, lo=800.0, hi=5000.0)
    music = gate(music_dry, wet)
    music = compress(music, thr_db=-18.0, ratio=2.0, attack=0.02, release=0.2)
    log(f"  music: {time.time() - t0:.1f}s")

    # ---------------- WALL (el build «gris») ----------------
    wk = c.z()
    k_wall = I.kick(1.0, tail=0.22, rng=rng_of("kick-wall"))
    for e in song.ev.get("kick_wall", []):
        place(wk, k_wall * e["vel"], S(e["t"]))
    pump_wall = pump_env(c.NB, c.wall_kicks, depth=0.6, release=0.3, curve=1.6)
    wb = r_bass(c, "bass_wall") * undb(LEVEL["bass"]) * pump_wall
    wp = r_pad(c, "pad_wall") * undb(LEVEL["pad"]) * pump_wall
    wm = r_marimba(c, "marimba_wall") * undb(LEVEL["marimba"] + 4.0)
    wall_dry = wk * undb(LEVEL["kick"] - 2.0) + wb + wp + wm
    wall_dry = wall_dry + convolve_reverb(wm * 0.5 + wp * 0.2, ir_room) * 0.5
    wall = gate(wall_filter(c, wall_dry) * undb(LEVEL["wall"]), kind="wall")
    log(f"  wall: {time.time() - t0:.1f}s")

    # ---------------- FX (risers, redobles, reversos, reloj, impactos) ----------------
    for k in fx:
        fx[k] *= undb(LEVEL[k])
    fx["impact"] = soft_clip_os(fx["impact"], float(todb(np.abs(fx["impact"]).max())) - IMPACT_CLIP_DB, os=4)
    fx["roll"] = hp(fx["roll"], 150.0)
    # los golpes (redoble, reversos, impactos) pasan por un clipper suave; los risers NO: si se los
    # recorta, el final se aplana y dejan de culminar justo en el hueco
    risers = fx["riser_noise"] + fx["riser_tone"]
    hits = sum(v for k, v in fx.items() if k not in ("riser_noise", "riser_tone"))
    hits = soft_clip_os(hits, float(todb(np.abs(hits).max())) - 6.0, os=4)
    fx_dry = hits + risers
    fx_wet = convolve_reverb((fx["roll"] * 0.3 + fx["riser_tone"] * 0.3 + fx["riser_noise"] * 0.2
                              + fx["impact"] * 0.3) * send_gate, ir_hall) * 0.35
    fxb = gate(fx_dry, fx_wet)
    log(f"  fx: {time.time() - t0:.1f}s")

    # ---------------- SFX ----------------
    sfx, sfx_log = r_sfx(c)
    sfx = hp(sfx, 30.0, order=2) * undb(LEVEL["sfx"])
    sfx = duck_band(sfx, key_for_sfx, LEAD_DUCK["sfx"])
    # sin compresor de bus: con ataque de 10 ms y release de 100 ms corría la cresta de los SFX
    # (achicaba el cuerpo de los que crecen y le devolvía nivel a las colas)
    # techo propio del bus, referido al pico típico del bombo ANTES de su clipper (así no se mueve si
    # cambia el recorte de la batería). Primero un clipper suave sobremuestreado (redondea los picos
    # de 1–3 ms sin bombear) y después el limitador true-peak sin latencia.
    sfx_ceiling = kick_ref_db - SFX_CEIL_BELOW_KICK_DB
    sfx = soft_clip_os(sfx, sfx_ceiling + 1.5, os=4)
    sfx, g_sfx = tp_limiter(sfx, sfx_ceiling, lookahead=0.0015, release=0.05, os=4)
    for e in sfx_log:   # cuánto tocó el limitador del bus a cada SFX (si es mucho, se corre la cresta)
        k = S(e["t"])
        e["bus_limiter_gr_db"] = round(float(-todb(g_sfx[max(0, k - ns(0.03)):k + ns(0.1)].min())), 2)
    s_wet = convolve_reverb(hp(sfx, 400.0) * c.gates["sfx"][0], ir_hall) * 0.12
    sfx = gate(sfx, s_wet, kind="sfx")
    log(f"  sfx: {time.time() - t0:.1f}s")

    # los picos crecen en lo sostenido (bajo, armonía, hook, capas agudas), no en el bombo: así
    # el drop y el cierre suben en loudness sin apilar más pico en el limitador del master; y el
    # cuerpo del tema (c3–c10) baja 1 dB en todo, para que los dos picos se despeguen
    s_ = song
    peak = section_gain(c, [(s_.t(2), s_.t(3), PEAK_BOOST_DB), (s_.t(14), s_.duration + 3.0, PEAK_BOOST_DB)])
    body = section_gain(c, [(s_.t(3), s_.t(7), EXP_TRIM_DB), (s_.t(7), s_.t(11), DEST_TRIM_DB),
                            (s_.t(11), s_.t(13), VALUE_TRIM_DB)])
    bass, music, lead, fxb = bass * peak * body, music * peak * body, lead * peak * body, fxb * peak
    drums = drums * body
    buses = dict(drums=drums, bass=bass, music=music, lead=lead, wall=wall, fx=fxb, sfx=sfx)
    return c, buses, sfx_log


# ---------------------------------------------------------------------------
# Master
# ---------------------------------------------------------------------------

def end_fade_curve(c: Ctx):
    """Cola final: desde stinger + 0,25 s (29,78) una curva coseno² lleva todo a cero EXACTO en la
    última muestra (sin clic). El stinger ya viene apagándose solo (caídas cortas, delay cerrado,
    reverbs que se cierran; en 29,9 ya bajó ~23 dB desde su cresta): la curva solo acompaña sus
    últimos 220 ms."""
    N = c.N
    t0 = c.song.times["stinger"] + END_FADE_AFTER_STINGER
    g = np.ones(N)
    a = S(t0)
    k = np.arange(N - a) / (N - 1 - a)
    g[a:] = np.cos(0.5 * np.pi * k) ** 2
    g[-1] = 0.0
    return g


CODEC_TARGET_DBTP = -1.3   # después de codificar: ≤ −1 dBTP con 0,3 dB de margen
CODEC_CASES = (("aac320", ("-c:a", "aac", "-b:a", "320k"), None),
               ("aac128", ("-c:a", "aac", "-b:a", "128k"), None),
               ("aac320_to_128", ("-c:a", "aac", "-b:a", "128k"), "aac320"))


def codec_tp_env(y, tmp):
    """True peak por muestra (dBTP) del peor de los tres caminos de códec: AAC 320 kb/s (el de
    render.mjs), AAC 128 kb/s y la segunda generación de las redes (AAC 320 → AAC 128)."""
    import subprocess
    src = os.path.join(tmp, "m.wav")
    write_wav(src, y, bits=24, dither_seed=20251005)
    worst = np.full(y.shape[1], -200.0)
    made = {}
    for name, args, parent in CODEC_CASES:
        enc = os.path.join(tmp, f"{name}.m4a")
        inp = made[parent] if parent else src
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", inp, *args, enc], check=True)
        made[name] = enc
        dec = os.path.join(tmp, f"{name}.wav")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", enc, "-c:a", "pcm_f32le", "-ar", str(SR), dec], check=True)
        d, _, _ = read_wav(dec)
        n = min(d.shape[1], y.shape[1])
        worst[:n] = np.maximum(worst[:n], todb(true_peak_env(d[:, :n], 4)))
    return worst


def master(c: Ctx, buses, verbose=True):
    """Solo etapas multiplicativas (fundido, compresor, ganancia, limitadores): nada que pueda sonar
    en un hueco, y una ganancia total g(t) que se aplica igual a los stems (suma = master)."""
    import shutil
    import tempfile
    log = (lambda *a: print(*a, flush=True)) if verbose else (lambda *a: None)
    N = c.N
    fade = end_fade_curve(c)
    mix = sum(b[:, :N] for b in buses.values()) * fade
    ref = lufs_integrated(mix)
    pre = float(undb(-18.0 - ref))
    mix = mix * pre
    _, gdb = compress(mix, thr_db=-16.0, ratio=1.8, attack=0.02, release=0.18, knee=8.0, return_gain=True)
    glue = undb(gdb)
    mix = mix * glue

    def chain(g, ceil):
        z = mix * undb(g)
        # etapa rápida (lookahead 3 ms, release 50 ms) que toma la punta de los golpes apilados sin
        # bombear; sus rampas son suaves (≥ 3 ms): con 1,5 ms / 20 ms el AAC rearmaba picos de hasta
        # +2 dB (medido). Después, el limitador true-peak principal (5 ms / 150 ms).
        _, gc_ = tp_limiter(z, ceil + CLIP_OVER_DB, lookahead=0.003, release=0.05, os=4)
        y_, gl_ = tp_limiter(z * gc_, ceil, lookahead=0.005, release=0.15, os=8)
        return y_, gc_, gl_

    def loudness(g, ceil, tag):
        y_ = gc_ = gl_ = None
        for it in range(10):
            y_, gc_, gl_ = chain(g, ceil)
            L = lufs_integrated(y_)
            log(f"  {tag} it{it}: ganancia {g:+.2f} dB → {L:.2f} LUFS, etapa rápida máx {-todb(gc_.min()):.1f} dB, "
                f"limitador máx {-todb(gl_.min()):.1f} dB")
            if abs(L - TARGET_LUFS) < 0.02:
                break
            g += TARGET_LUFS - L
        return g, y_, gc_, gl_

    ceil = np.full(N, CEILING_DBTP)
    g, y, gc, gl = loudness(4.0, ceil, "loudness")
    # --- guarda de códec: donde el AAC (sobre todo recodificado a 128 kb/s) rearma un pico por encima
    # de −1,3 dBTP, el techo baja SOLO ahí: lo que sobra + 0,15 dB, plano desde 80 ms antes hasta 40 ms
    # después (así no cambia la relación entre un SFX y lo que suena justo antes: no corre crestas).
    # El encoder de ffmpeg es determinista, así que el resultado también lo es.
    guard = dict(rounds=0, dips=[])
    if shutil.which("ffmpeg"):
        tmp = tempfile.mkdtemp(prefix="promo_codec_")
        try:
            for rnd in range(4):
                worst = codec_tp_env(y, tmp)
                over = worst - CODEC_TARGET_DBTP
                log(f"  códec ronda {rnd}: peor true peak {worst.max():.2f} dBTP en {np.argmax(worst) / SR:.3f} s")
                if over.max() <= 0.0:
                    break
                exc = np.where(over > 0, over + 0.15, 0.0)
                # ventana asimétrica: −80 ms … +40 ms alrededor de cada exceso, y rampas de 20 ms
                exc = maximum_filter1d(exc, ns(0.12), origin=-ns(0.02))
                exc = np.convolve(exc, np.hanning(ns(0.02)) / np.hanning(ns(0.02)).sum(), mode="same")
                for i in np.flatnonzero((over > 0) & (np.r_[True, over[:-1] <= 0])):
                    guard["dips"].append(dict(t=round(i / SR, 3), db=round(float(over[i:i + ns(0.05)].max() + 0.15), 2)))
                ceil = ceil - exc
                g, y, gc, gl = loudness(g, ceil, f"guarda {rnd}")
                guard["rounds"] = rnd + 1
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    else:
        log("  (sin ffmpeg: no se corre la guarda de códec)")
    y[:, -1] = 0.0
    total = fade * pre * glue * undb(g) * gc * gl
    info = dict(pre_db=round(float(todb(pre)), 2), loud_gain_db=round(g, 2),
                glue_gr_max_db=round(float(-gdb.min()), 2), glue_gr_mean_db=round(float(-gdb[gdb < 0].mean()), 2),
                fast_gr_max_db=round(float(-todb(gc.min())), 2),
                fast_gr_by_bar=[round(float(-todb(gc[S(b * 1.875):S((b + 1) * 1.875)].min())), 2)
                                for b in range(16)],
                limiter_gr_max_db=round(float(-todb(gl.min())), 2),
                limiter_gr_max_t=round(float(np.argmin(gl) / SR), 3),
                total_gr_max_db=round(float(-todb((gc * gl).min())), 2),
                # lo que se percibe como «aplastado»: la reducción media en los 150 ms que siguen a cada
                # downbeat (la etapa rápida suelta en 50 ms; el limitador principal, en 150 ms)
                total_gr_mean150_by_bar=[round(float(-todb(np.mean((gc * gl)[S(b * 1.875):S(b * 1.875 + 0.15)]))), 2)
                                         for b in range(16)],
                limiter_gr_by_bar=[round(float(-todb(gl[S(b * 1.875):S((b + 1) * 1.875)].min())), 2)
                                   for b in range(16)],
                codec_guard=guard, ceiling_min_dbtp=round(float(ceil.min()), 2))
    return y, total, info


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=OUT_WAV)
    ap.add_argument("--no-stems", action="store_true")
    ap.add_argument("--quiet", action="store_true")
    ap.add_argument("--dump-buses", default=None, help="guarda los 7 buses antes del master (.npz) para "
                                                       "probar cambios de master sin re-sintetizar")
    args = ap.parse_args(argv)
    t0 = time.time()
    song = build_song()
    c, buses, sfx_log = build_mix(song, verbose=not args.quiet)
    if args.dump_buses:
        np.savez(args.dump_buses, **{k: v[:, :c.N].astype(np.float32) for k, v in buses.items()})
    y, total, info = master(c, buses, verbose=not args.quiet)
    assert y.shape == (2, c.N), y.shape
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    write_wav(args.out, y, bits=24, dither_seed=20251005)
    if not args.no_stems:
        os.makedirs(STEM_DIR, exist_ok=True)
        for k, v in buses.items():
            # misma ganancia total que el master (fundido + pegamento + loudness + limitador)
            write_wav(os.path.join(STEM_DIR, f"{k}.wav"), v[:, :c.N] * total, bits=32)
        with open(os.path.join(STEM_DIR, "sfx_placement.json"), "w", encoding="utf-8") as fh:
            json.dump(dict(sr=SR, master=info, events=sfx_log), fh, indent=1, ensure_ascii=False)
    with open(args.out, "rb") as fh:
        digest = hashlib.sha256(fh.read()).hexdigest()
    if not args.quiet:
        print(f"OK {args.out}  {c.N} muestras  LUFS {lufs_integrated(y):.2f}  TP {true_peak_db(y, 8):.2f} dBTP"
              f"  GR limitador máx {info['limiter_gr_max_db']} dB en {info['limiter_gr_max_t']} s"
              f"  sha256 {digest[:16]}…  ({time.time() - t0:.1f}s)")
    return digest


if __name__ == "__main__":
    main()
