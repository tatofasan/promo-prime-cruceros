"""
instruments.py — los instrumentos del tema (tropical house a 128 BPM), sintetizados de cero.

Cada función devuelve UNA nota/golpe ya listo para ubicar en la grilla:
- mono (1D) para lo que va al centro (bombo, bajo, sub) o
- estéreo (2, n) para lo que tiene ancho propio (pads, plucks, hats, percusión).
La muestra 0 de cada buffer es el instante del golpe en la grilla (salvo que se diga otra cosa).
"""
from __future__ import annotations

import math

import numpy as np

from dsp import (SR, TWO_PI, bp, env_adsr, env_perc, fade_edges, high_shelf, hp, lp, mtof, ns, peq,
                 phase_of, saw, smoothstep, supersaw, svf, svf4, tanh_sat, tvec, width)


# ---------------------------------------------------------------------------
# Batería
# ---------------------------------------------------------------------------

# Correlación del ruido entre canales en hats y shaker: con ruido 100 % independiente el brillo se
# cancela a la mitad al sumar a mono (parlante de celular). Con 40 % común conservan ancho y brillo.
NOISE_CORR = 0.4


def _corr_noise(rng, common, c):
    """Ruido de un canal con una fracción `c` de energía compartida con el otro canal."""
    return math.sqrt(c) * common + math.sqrt(1.0 - c) * rng.standard_normal(common.shape[0])


def kick(vel=1.0, tune=55.0, tail=0.13, length=0.5, click=1.4, rng=None):
    """Bombo redondo y con pegada: seno con barrido de tono rápido (230 → La1 55 Hz), un chasquido
    cortito arriba y una saturación suave. Cola controlada para dejar lugar al bajo."""
    n = ns(length)
    t = tvec(n)
    f = tune + tune * 3.3 * np.exp(-t / 0.022) + 700.0 * np.exp(-t / 0.0016)
    body = np.sin(phase_of(f))
    amp = np.exp(-t / tail) * (1.0 - np.exp(-t / 0.0003))
    amp *= 1.0 - smoothstep((t - length * 0.55) / (length * 0.45))
    x = body * amp
    if click > 0 and rng is not None:
        c = hp(rng.standard_normal(n), 3000.0) * np.exp(-t / 0.0018) * 0.22 * click
        x = x + c
    x = tanh_sat(x * 1.25, 1.4)
    return fade_edges(x * vel, 0.0002, 0.01)


def sub_boom(f0=95.0, f1=40.0, length=0.7, sweep=0.12, tail=0.18, vel=1.0):
    """Sub de impacto para el drop y el cierre: seno que cae de f0 a f1. Cola corta (0,18 s): el
    golpe se siente en el pecho pero a la segunda negra ya dejó lugar al bombeo del bajo."""
    n = ns(length)
    t = tvec(n)
    f = f1 + (f0 - f1) * np.exp(-t / sweep)
    # entra en ~40 ms: deja pasar primero el golpe del bombo (los dos graves no se apilan en el mismo
    # pico) y llega a su máximo cuando el bombo ya cayó: el «boom» se siente DESPUÉS del golpe
    x = np.sin(phase_of(f)) * np.exp(-t / tail) * smoothstep(t / 0.04)
    x = tanh_sat(x * 1.6, 1.8)
    return fade_edges(x * vel, 0.0003, 0.05)


def clap(vel=1.0, rng=None, tail=0.15, tone=1.0):
    """Clap con 4 micro-golpes (flam de manos) y cola de sala; cada canal con su ruido → ancho natural."""
    n = ns(0.5)
    t = tvec(n)
    out = np.zeros((2, n))
    offs = [0.0, 0.0085, 0.0165, 0.025]
    amps = [0.55, 0.7, 0.8, 1.0]
    for ch in range(2):
        nz = bp(rng.standard_normal(n), 850.0 * tone, 3600.0 * tone, order=2)
        env = np.zeros(n)
        for o, a in zip(offs, amps):
            o2 = o + rng.uniform(-0.0004, 0.0004)
            m = t >= o2
            env[m] += a * np.exp(-(t[m] - o2) / 0.0042)
        last = offs[-1]
        m = t >= last
        env[m] += 0.42 * np.exp(-(t[m] - last) / tail)
        out[ch] = nz * env
    out = peq(out, 1250.0 * tone, 3.0, 0.9)
    out = high_shelf(out, 7000.0, 2.0)
    return fade_edges(out * vel * 1.4, 0.0002, 0.02)


def snare(vel=1.0, rng=None, pitch=1.0, tail=0.11, body=1.0):
    """Redoblante liviano (para el redoble del build y como capa del clap)."""
    n = ns(0.35)
    t = tvec(n)
    f = 190.0 * pitch * (1 + 0.5 * np.exp(-t / 0.006))
    b = np.sin(phase_of(f)) * env_perc(n, 0.0003, 0.045) * 0.8 * body
    b += np.sin(phase_of(f * 1.72)) * env_perc(n, 0.0003, 0.022) * 0.3 * body
    out = np.zeros((2, n))
    for ch in range(2):
        nz = hp(rng.standard_normal(n), 1400.0 * pitch, order=2)
        nz = peq(nz, 4500.0, 4.0, 1.0)
        out[ch] = b + nz * env_perc(n, 0.0004, tail) * 0.75
    return fade_edges(out * vel, 0.0002, 0.02)


def hat(vel=1.0, rng=None, decay=0.035, bright=1.0, length=None):
    """Hi-hat: ruido agudo + resonancias metálicas (bandas angostas inarmónicas)."""
    L = length if length is not None else min(0.9, decay * 7 + 0.02)
    n = ns(L)
    t = tvec(n)
    out = np.zeros((2, n))
    common = rng.standard_normal(n)
    for ch in range(2):
        nz = _corr_noise(rng, common, NOISE_CORR)
        metal = np.zeros(n)
        for f, q, a in ((6900.0, 9.0, 0.7), (8350.0, 12.0, 0.6), (10300.0, 10.0, 0.5), (12900.0, 8.0, 0.4)):
            metal += a * svf(nz, f * (1 + 0.004 * ch), q, "bp")
        x = 0.55 * hp(nz, 7200.0 * bright, order=2) + 0.6 * metal
        env = env_perc(n, 0.0003, decay)
        env *= 1 - smoothstep((t - L * 0.8) / (L * 0.2))
        out[ch] = x * env
    return out * vel * 0.9


def shaker(vel=1.0, rng=None, length=0.11):
    """Shaker: grano de ruido entre 3,5 y 11 kHz con ataque suave (los granitos chocando)."""
    n = ns(length)
    t = tvec(n)
    out = np.zeros((2, n))
    common = rng.standard_normal(n)
    for ch in range(2):
        nz = bp(_corr_noise(rng, common, NOISE_CORR), 3500.0, 11000.0, order=2)
        a = np.clip(t / 0.009, 0, 1) ** 2
        env = a * np.exp(-np.maximum(t - 0.009, 0) / 0.026)
        out[ch] = nz * env
    return fade_edges(out * vel, 0.0005, 0.01)


def conga(freq=210.0, vel=1.0, rng=None, kind="open"):
    """Conga / bongó modal: membrana (seno con caída de tono) + 2 modos superiores + ataque de mano.
    kind: 'open' (tono abierto), 'slap' (cachetazo, más ruido y más corto), 'mute' (apagado)."""
    n = ns(0.6)
    t = tvec(n)
    tau = {"open": 0.15, "slap": 0.05, "mute": 0.03}[kind]
    f = freq * (1 + 0.1 * np.exp(-t / 0.008))
    ph = phase_of(f)
    x = np.sin(ph) * np.exp(-t / tau)
    x += 0.32 * np.sin(1.52 * ph + 0.4) * np.exp(-t / (tau * 0.55))
    x += 0.14 * np.sin(2.29 * ph + 1.1) * np.exp(-t / (tau * 0.3))
    att = rng.standard_normal(n)
    if kind == "slap":
        x += bp(att, 1800.0, 6500.0) * np.exp(-t / 0.006) * 1.3
    else:
        x += bp(att, 500.0, 2600.0) * np.exp(-t / 0.0028) * 0.6
    x *= 1 - np.exp(-t / 0.0003)
    return fade_edges(x * vel, 0.0002, 0.02)


def clave(vel=1.0, freq=2450.0):
    """Claves de madera: resonancia aguda muy corta."""
    n = ns(0.12)
    t = tvec(n)
    x = np.sin(TWO_PI * freq * t) * np.exp(-t / 0.018)
    x += 0.25 * np.sin(TWO_PI * freq * 2.71 * t) * np.exp(-t / 0.006)
    x *= 1 - np.exp(-t / 0.0002)
    return fade_edges(x * vel, 0.0001, 0.01)


def rim(vel=1.0, rng=None):
    """Rimshot: golpe de aro (madera + metal) con chasquido de ruido."""
    n = ns(0.12)
    t = tvec(n)
    x = 0.8 * np.sin(TWO_PI * 1720.0 * t) * np.exp(-t / 0.012)
    x += 0.6 * np.sin(TWO_PI * 520.0 * t) * np.exp(-t / 0.009)
    x += hp(rng.standard_normal(n), 2500.0) * np.exp(-t / 0.003) * 0.6
    x *= 1 - np.exp(-t / 0.0002)
    return fade_edges(x * vel, 0.0001, 0.01)


def crash(vel=1.0, rng=None, length=2.6, decay=0.9, bright=1.0):
    """Platillo crash: ruido + bosque de parciales inarmónicos, cola larga, cada canal distinto."""
    n = ns(length)
    t = tvec(n)
    out = np.zeros((2, n))
    common = rng.standard_normal(n)
    for ch in range(2):
        nz = hp(_corr_noise(rng, common, NOISE_CORR), 3800.0 * bright, order=2)
        metal = np.zeros(n)
        for _ in range(28):
            f = rng.uniform(3200.0, 13000.0)
            metal += np.sin(TWO_PI * f * t + rng.random() * TWO_PI) * rng.uniform(0.2, 1.0)
        metal = hp(metal, 3000.0) / 6.0
        # ataque de ~2 ms (no instantáneo): el frente de ruido agudo a pleno es lo que el AAC
        # recodificado convierte en pre-eco y picos, sobre todo después de un hueco de silencio
        att = 1 - np.exp(-t / 0.0015)
        env = np.exp(-t / decay) * att
        env2 = np.exp(-t / (decay * 0.35)) * att
        # el «chick» de los primeros 80 ms es lo que marca el corte (más que la cola)
        out[ch] = (0.7 * nz + 0.5 * metal) * env + 0.9 * nz * env2 * (1 - smoothstep((t - 0.06) / 0.04))
    out = lp(out, 15000.0)
    return fade_edges(out * vel * 0.6, 0.0002, 0.2)


def clock_tick(high=True, vel=1.0, rng=None):
    """Tic-tac del reloj de pared: clic seco con una resonancia aguda (tic) o algo más grave (tac)."""
    n = ns(0.06)
    t = tvec(n)
    f = 3300.0 if high else 2500.0
    x = np.sin(TWO_PI * f * t) * np.exp(-t / 0.004)
    x += 0.6 * np.sin(TWO_PI * (f * 0.31) * t) * np.exp(-t / 0.006)
    x += bp(rng.standard_normal(n), 2000.0, 9000.0) * np.exp(-t / 0.0012) * 0.8
    x *= 1 - np.exp(-t / 0.00015)
    return fade_edges(x * vel, 0.0001, 0.005)


# ---------------------------------------------------------------------------
# Instrumentos melódicos
# ---------------------------------------------------------------------------

def marimba(midi, vel=1.0, rng=None, bright=1.0, length=None, decay=1.0):
    """Marimba modal: fundamental + parciales de barra (×3,93 y ×9,24) + golpe de maza.
    Los graves duran más que los agudos, como en el instrumento real. `decay` < 1 apaga la barra
    con la mano (stabs cortos y el stinger del final, que tiene que estar en silencio antes de 30,0)."""
    f = float(mtof(midi))
    tau1 = float(np.clip(0.55 * (262.0 / f) ** 0.6, 0.12, 1.1)) * decay
    L = length if length is not None else min(2.5, tau1 * 5 + 0.05)
    n = ns(L)
    t = tvec(n)
    x = np.zeros(n)
    for ratio, amp, tr in ((1.0, 1.0, 1.0), (3.93, 0.30 * bright, 0.22), (9.24, 0.10 * bright, 0.07)):
        if f * ratio < 0.45 * SR:
            x += amp * np.sin(TWO_PI * f * ratio * t + 0.3 * ratio) * np.exp(-t / (tau1 * tr))
    mallet = lp(rng.standard_normal(n), 1800.0 * bright) * np.exp(-t / 0.0012) * 0.25
    x += mallet
    x *= 1 - np.exp(-t / 0.0006)
    return fade_edges(x * vel, 0.0002, 0.03)


def steel_drum(midi, vel=1.0, rng=None, length=None, decay=1.0):
    """Steel drum (steelpan): fundamental, octava y doceava afinadas; la octava «florece» un instante
    después del golpe (la transferencia de energía que le da el «wah» característico).
    `decay` < 1 acorta todas las caídas (notas «staccato» del eco del hook y del stinger final)."""
    f = float(mtof(midi))
    L = length if length is not None else 1.4 * decay
    n = ns(L)
    t = tvec(n)
    x = np.sin(TWO_PI * f * t) * np.exp(-t / (0.75 * decay))
    bloom = (1 - np.exp(-t / 0.014)) * np.exp(-t / (0.42 * decay))
    x += 0.85 * np.sin(TWO_PI * 2.003 * f * t + 0.5) * bloom
    x += 0.32 * np.sin(TWO_PI * 3.007 * f * t + 1.1) * np.exp(-t / (0.2 * decay))
    if 4.12 * f < 0.45 * SR:
        x += 0.12 * np.sin(TWO_PI * 4.12 * f * t) * np.exp(-t / (0.06 * decay))
    ping = bp(rng.standard_normal(n), 2.5 * f, min(6 * f, 15000.0)) * np.exp(-t / 0.004) * 0.25
    x = (x + ping) * (1 - np.exp(-t / 0.0005))
    x *= 1 + 0.03 * np.sin(TWO_PI * 5.5 * t)
    return fade_edges(x * vel * 0.8, 0.0002, 0.05)



def bell(midi, vel=1.0, rng=None, tau=0.14):
    """Campanita tipo glockenspiel para el brillo del stinger final: barra metálica con los parciales
    inarmónicos de una lámina (×2,76 y ×5,40, que se apagan mucho antes que la fundamental), un
    «tin» de ataque de 1 ms y un batido leve entre canales (dos láminas apenas desafinadas: brilla
    sin ser un seno quieto). La caída es corta a propósito: a 0,47 s del golpe ya está ~30 dB abajo."""
    f = float(mtof(midi))
    n = ns(min(1.2, tau * 7.0))
    t = tvec(n)
    out = np.zeros((2, n))
    for ch, cents in ((0, -3.0), (1, 3.0)):
        fc = f * 2 ** (cents / 1200.0)
        x = np.sin(TWO_PI * fc * t) * np.exp(-t / tau)
        if 2.76 * fc < 0.45 * SR:
            x += 0.30 * np.sin(TWO_PI * 2.76 * fc * t + 0.4) * np.exp(-t / (tau * 0.3))
        if 5.40 * fc < 0.40 * SR:
            x += 0.10 * np.sin(TWO_PI * 5.40 * fc * t + 1.0) * np.exp(-t / (tau * 0.1))
        out[ch] = x
    if rng is not None:
        tin = bp(rng.standard_normal(n), 2.0 * f, min(7.0 * f, 14000.0)) * np.exp(-t / 0.001) * 0.18
        out += tin
    out *= 1 - np.exp(-t / 0.0004)
    return fade_edges(out * vel * 0.7, 0.0001, 0.02)

def rhodes(midi, gate, vel=1.0, rng=None, tremolo=0.1):
    """Piano eléctrico tipo Rhodes (FM 1:1 con índice que decae + «tine» agudo del martillo),
    trémolo estéreo lento. Es el color de la cena: cálido, redondo y sin ataque agresivo."""
    f = float(mtof(midi))
    L = gate + 0.7
    n = ns(L)
    t = tvec(n)
    ph0 = rng.random() * TWO_PI if rng is not None else 0.0
    idx = (1.5 * vel) * np.exp(-t / 0.22) + 0.22
    x = np.sin(TWO_PI * f * t + ph0 + idx * np.sin(TWO_PI * f * t))
    if 7.0 * f < 0.45 * SR:
        x += 0.16 * vel * np.sin(TWO_PI * 7.0 * f * t) * np.exp(-t / 0.012)
    x += 0.12 * np.sin(TWO_PI * 2.0 * f * t + 0.7) * np.exp(-t / 0.4)
    amp = np.exp(-t / 1.6) * env_adsr(n, 0.002, 1.0, 1.0, 0.25, gate)
    x = x * amp
    trem = tremolo * np.sin(TWO_PI * 4.6 * t + ph0)
    return np.vstack([x * (1 - trem), x * (1 + trem)]) * vel * 0.5


def brass_stab(midis, gate, rng, vel=1.0, bright=1.0):
    """Stab de «bronces» supersaw para el show: el filtro se abre en 25 ms (el soplido del
    metal), un scoop de tono de 1/4 de semitono y caída rápida. Estéreo ancho."""
    n = ns(gate + 0.35)
    t = tvec(n)
    scoop = 2.0 ** (-0.25 * np.exp(-t / 0.02) / 12.0)
    out = np.zeros((2, n))
    for m in midis:
        out += supersaw(float(mtof(m)) * scoop, n, rng, voices=5, detune_st=0.18, spread=0.8)
    out /= math.sqrt(len(midis))
    fc = (700.0 + 5200.0 * bright * (1 - np.exp(-t / 0.025)) * np.exp(-t / (0.09 + 0.4 * gate)))
    out = svf(out, fc, 1.6, "lp")
    out = hp(out, 220.0, order=2)
    env = env_adsr(n, 0.004, 0.08, 0.55, 0.06, gate)
    return out * env * vel


def tom(freq, vel=1.0, rng=None):
    """Tom / conga grave para los fills: membrana con caída de tono y golpe de palillo."""
    n = ns(0.45)
    t = tvec(n)
    f = freq * (1 + 0.28 * np.exp(-t / 0.018))
    ph = phase_of(f)
    x = np.sin(ph) * np.exp(-t / 0.16) + 0.25 * np.sin(1.59 * ph + 0.3) * np.exp(-t / 0.06)
    x += bp(rng.standard_normal(n), 900.0, 5000.0) * np.exp(-t / 0.004) * 0.5
    x *= 1 - np.exp(-t / 0.0004)
    return fade_edges(x * vel, 0.0002, 0.03)


def pluck(midi, vel=1.0, rng=None, gate=0.25, cutoff=4200.0, decay=0.22, detune=0.09, q=1.2, sub=0.35):
    """Pluck de house: dos sierras desafinadas por canal (+ sub octava opcional), filtro con
    envolvente rápida. Con voicings graves va con sub=0 para no meterse en la zona del bajo."""
    f = float(mtof(midi))
    L = gate + 0.45
    n = ns(L)
    t = tvec(n)
    fc = 220.0 + cutoff * vel * np.exp(-t / 0.075) + 2.2 * f
    out = np.zeros((2, n))
    for ch, s in ((0, -1.0), (1, 1.0)):
        o = saw(f * 2 ** (s * detune / 12), n, rng.random())
        o += 0.7 * saw(f * 2 ** (-s * detune * 0.35 / 12), n, rng.random())
        if sub > 0:
            o += sub * np.sin(phase_of(f / 2.0, n))
        out[ch] = svf(o, fc, q, "lp")
    amp = env_perc(n, 0.0015, decay) * env_adsr(n, 0.0001, 1.0, 1.0, 0.08, gate)
    return out * amp * vel * 0.5


def pad_chord(midis, length, rng, cutoff=2400.0, attack=0.25, release=0.35, detune=0.2,
              voices=7, bright_env=None):
    """Pad supersaw cálido: 7 sierras por nota, abanico estéreo, pasa-bajos de 24 dB y
    pasa-altos para dejarle el grave al bajo. `bright_env` (array) modula el corte en el tiempo."""
    n = ns(length + release + 0.05)
    out = np.zeros((2, n))
    for m in midis:
        out += supersaw(float(mtof(m)), n, rng, voices=voices, detune_st=detune, spread=0.95)
    out /= math.sqrt(len(midis))
    fc = cutoff if bright_env is None else cutoff * np.concatenate(
        [bright_env, np.full(n - len(bright_env), bright_env[-1])])[:n]
    out = svf4(out, fc, 0.8, "lp")
    out = hp(out, 180.0, order=2)
    env = env_adsr(n, attack, 0.6, 0.85, release, length)
    return out * env


def bass_note(midi, gate, vel=1.0, rng=None, bright=0.6, drive=1.8, release=0.035, upper=0.22):
    """Bajo cálido y profundo: seno fundamental + sierra filtrada, saturado. La capa `upper` (una
    octava arriba, filtrada en 150–1100 Hz) es la que «dibuja» la línea en un parlante de celular,
    que no reproduce nada debajo de ~300 Hz: el oído reconstruye la fundamental con los armónicos."""
    f = float(mtof(midi))
    n = ns(gate + 0.08 + 1.6 * release)
    t = tvec(n)
    sub = np.sin(phase_of(f, n))
    s = saw(f, n, 0.0)
    fc = f * 3.0 + 1100.0 * bright * np.exp(-t / 0.06)
    s = svf(s, fc, 0.9, "lp")
    x = 0.6 * sub + 0.5 * bright * s
    x = tanh_sat(x * drive, drive) / drive * 1.3
    up = bp(saw(2.0 * f, n, 0.25), 150.0, 1100.0, order=2)
    up = tanh_sat(up * 2.0, 2.0) * upper * (0.55 + 0.45 * np.exp(-t / 0.12))
    env = env_adsr(n, 0.003, 0.18, 0.75, release, gate)
    return (x + up) * env * vel


# Formantes (Hz, ancho de banda Hz, ganancia) de vocales tipo voz femenina, para el «vocal chop».
# F3/F4 van levantados a propósito: un vocal chop de tropical house es una voz aguda, procesada y
# brillante; el «aire» de 2–4 kHz es lo que la hace leer como voz y no como flauta.
VOWELS = {
    "a": ((800.0, 90.0, 0.8), (1150.0, 100.0, 0.7), (2900.0, 140.0, 0.62), (3900.0, 200.0, 0.34)),
    # la «o» lleva F3/F4 más altos que una o hablada: es la vocal del Mi5 repetido del hook y con
    # F3 en 0,36 esa nota quedaba en 980 Hz de centroide (se leía flauta); con 0,5 queda en 1,25 kHz
    "o": ((480.0, 80.0, 0.8), (850.0, 90.0, 0.6), (2800.0, 120.0, 0.5), (3600.0, 200.0, 0.28)),
    "e": ((420.0, 70.0, 0.7), (2000.0, 110.0, 0.75), (2750.0, 140.0, 0.55), (3600.0, 220.0, 0.28)),
    "u": ((340.0, 60.0, 0.8), (700.0, 70.0, 0.45), (2700.0, 160.0, 0.22), (3500.0, 220.0, 0.12)),
}
FORMANT_WIDEN = 1.7   # anchos ×1,7 (Q ≈ 4–5): así el banco deja pasar los armónicos de la sierra


def _formant_bank(src, vowel, vowel_to, gate, n, widen=FORMANT_WIDEN):
    """Pasa `src` por los 4 formantes de la vocal, con glide de vocal a lo largo de la nota."""
    t = tvec(n)
    v0 = VOWELS[vowel]
    v1 = VOWELS[vowel_to or vowel]
    mix = smoothstep(t / max(gate, 0.05))
    out = np.zeros(n)
    for (fa, ba, ga), (fb, bb, gb) in zip(v0, v1):
        fcf = fa + (fb - fa) * mix
        bw = (ba + (bb - ba) * mix) * widen
        g = ga + (gb - ga) * mix
        # Q tope 5: los formantes altos (F3/F4) también quedan anchos y dejan pasar armónicos en
        # cualquier nota (con Q 12 el brillo dependía de si un armónico caía justo en el pico)
        out += g * svf(src, fcf, np.minimum(fcf / bw, 5.0), "bp")
    return out


def lead_note(midi, gate, vel=1.0, rng=None, prev_midi=None, vowel="a", vowel_to=None,
              flute=0.36, chop=1.8, chop_oct=0.63, vib_depth=0.16, consonant=1.0, release=None):
    """Lead del hook: VOCAL CHOP (sierra por un banco de formantes con glide de vocal, más una
    segunda capa una octava arriba a −4 dB y una consonante de ruido al arranque) sobre una capa
    de FLAUTA DE PAN (seno con armónicos impares, soplo de banda ancha que sigue a la envolvente y
    «chiff»). El chop manda: la flauta le da cuerpo y aire, no al revés.
    Ligadura desde la nota anterior (portamento corto) y vibrato que entra tarde."""
    f = float(mtof(midi))
    rel_fl, rel_ch = (0.07, 0.04) if release is None else (release, release * 0.9)
    L = gate + max(0.25, 1.6 * rel_fl + 0.05)
    n = ns(L)
    t = tvec(n)
    # pitch: scoop desde abajo o glide desde la nota anterior + vibrato demorado
    if prev_midi is not None and abs(prev_midi - midi) <= 7:
        glide = (prev_midi - midi) * np.exp(-t / 0.022)
    else:
        glide = -0.6 * np.exp(-t / 0.03)
    vib = vib_depth * smoothstep((t - 0.12) / 0.2) * np.sin(TWO_PI * 5.3 * t)
    fr = f * 2.0 ** ((glide + vib) / 12.0)
    ph = phase_of(fr)
    # --- flauta de pan: impares marcados (H3 ≈ −12 dB), como un tubo cerrado ---
    fl = np.sin(ph) + 0.1 * np.sin(2 * ph + 0.3) + 0.25 * np.sin(3 * ph + 0.9) + 0.08 * np.sin(5 * ph + 1.7)
    fl_env = env_adsr(n, 0.02, 0.25, 0.8, rel_fl, gate)
    # soplo de banda ancha (1,5–8 kHz) que sigue la envolvente, ~−18 dB respecto del tono
    breath = bp(rng.standard_normal(n), 1500.0, 8000.0) * 0.16
    breath += svf(rng.standard_normal(n), fr, 7.0, "bp") * 0.3
    chiff = svf(rng.standard_normal(n), min(3.0 * f, 12000.0), 3.0, "bp") * np.exp(-t / 0.018) * 0.5
    flute_sig = (fl + breath) * fl_env + chiff * (1 - np.exp(-t / 0.002))
    # --- vocal chop: fundamental + capa una octava arriba (−4 dB) por el mismo banco ---
    ch_env = env_adsr(n, 0.005, 0.12, 0.72, rel_ch, gate * 0.92)
    # fases FIJAS (no al azar): con fases aleatorias la octava del chop y la flauta se sumaban o se
    # cancelaban distinto en cada repetición del hook (hasta 6 dB de diferencia entre c2 y c14)
    src = saw(fr, phase=0.5) + 0.04 * rng.standard_normal(n)
    chop_sig = _formant_bank(src, vowel, vowel_to, gate, n)
    # la octava va en cuadratura con el 2.º armónico de la sierra (fase 1/8 de ciclo de 2f): sus
    # energías se suman parejo en todas las notas, sin reforzar ni cancelar el H2
    src2 = saw(2.0 * fr, phase=0.125)
    chop_sig = chop_sig + chop_oct * _formant_bank(src2, vowel, vowel_to, gate, n)
    # brillo de «vocal procesada»: con +5,5 dB todas las notas del hook (Mi5–Do#6) quedan con el
    # centroide en seco ≥ 1,2 kHz y la banda 1,5–4 kHz ≥ −11 dB del total
    chop_sig = high_shelf(chop_sig, 2000.0, 5.5)
    # consonante: soplo corto de ruido (20–30 ms) al arranque, tipo «t/ch» de un sample cortado
    cons = bp(rng.standard_normal(n), 2500.0, 9000.0) * env_perc(n, 0.001, 0.009) * (t < 0.03)
    chop_sig = chop_sig * ch_env + consonant * cons * 0.35
    x = flute * flute_sig + chop * chop_sig
    return fade_edges(x * vel * 0.5, 0.001, 0.02)


# ---------------------------------------------------------------------------
# Transiciones musicales (risers, redobles, reversos)
# ---------------------------------------------------------------------------

def _riser_amp(p, curve, floor_db):
    """Nivel del riser: con `floor_db` arranca audible (p. ej. −30 dB) y sube en dB hasta 0;
    sin piso, es la forma potencia clásica (arranca en silencio)."""
    if floor_db is None:
        return p ** curve
    return 10.0 ** (floor_db * (1.0 - p) ** curve / 20.0)


def noise_riser(length, rng, f0=300.0, f1=9000.0, curve=2.0, q0=1.2, q1=3.5, w0=0.3, w1=1.3, floor_db=None):
    """Riser de ruido: pasa-banda que sube exponencialmente, nivel creciente y estéreo que se abre."""
    n = ns(length)
    p = np.linspace(0, 1, n)
    fc = f0 * (f1 / f0) ** (p ** 1.3)
    q = q0 + (q1 - q0) * p
    out = np.vstack([svf(rng.standard_normal(n), fc, q, "bp"), svf(rng.standard_normal(n), fc * 1.03, q, "bp")])
    out = width(out, 1.0)
    out = out * _riser_amp(p, curve, floor_db)
    w = w0 + (w1 - w0) * p
    m = 0.5 * (out[0] + out[1])
    s = 0.5 * (out[0] - out[1]) * w
    return np.vstack([m + s, m - s])


def tone_riser(midis, length, rng, semis=12.0, curve=1.8, cutoff0=600.0, cutoff1=9000.0, floor_db=None):
    """Riser tonal: acorde supersaw que sube `semis` semitonos con el filtro abriéndose."""
    n = ns(length)
    p = np.linspace(0, 1, n)
    bend = 2.0 ** (semis * p ** 2.2 / 12.0)
    out = np.zeros((2, n))
    for m in midis:
        out += supersaw(float(mtof(m)) * bend, n, rng, voices=5, detune_st=0.25)
    out /= math.sqrt(len(midis))
    fc = cutoff0 * (cutoff1 / cutoff0) ** (p ** 1.5)
    out = svf(out, fc, 1.4, "lp")
    return out * _riser_amp(p, curve, floor_db)


def reverse_crash(length, rng, bright=1.0):
    """Crash invertido que culmina EXACTO en el final del buffer (se ubica terminando en el cue)."""
    c = crash(1.0, rng, length=max(length, 0.2) + 0.2, decay=length * 0.45, bright=bright)
    c = c[:, :ns(length)][:, ::-1].copy()
    p = np.linspace(0, 1, c.shape[1])
    c *= p ** 1.5
    return fade_edges(c, 0.01, 0.002)


def noise_impact(rng, length=1.2, vel=1.0, corr=0.5):
    """Impacto de ruido blanco brillante (capa aguda de los dos picos: drop y cierre). Ataque de
    1 ms, cuerpo de 100 ms y una cola de aire que se apaga; casi nada debajo de 2 kHz."""
    n = ns(length)
    t = tvec(n)
    common = rng.standard_normal(n)
    out = np.zeros((2, n))
    for ch in range(2):
        nz = math.sqrt(corr) * common + math.sqrt(1 - corr) * rng.standard_normal(n)
        nz = hp(nz, 2200.0, order=2)
        # ataque de 8 ms (no 1 ms): un frente de ruido a pleno justo después de un hueco de silencio
        # es lo que el AAC, al recodificarse (redes), convierte en pre-eco y picos (pasaba en el cierre)
        # cuerpo de 120 ms más parejo (menos pico, la misma energía en los primeros 150 ms)
        env = 0.65 * env_perc(n, 0.008, 0.12) + 0.3 * np.exp(-t / 0.45) * (1 - np.exp(-t / 0.012))
        out[ch] = nz * env
    out = high_shelf(out, 9000.0, -3.0)
    return fade_edges(out * vel * 0.6, 0.0002, 0.2)


def downlifter(length, rng, f0=7000.0, f1=180.0):
    """Barrido descendente de ruido (después de un impacto, para que «caiga» la energía)."""
    n = ns(length)
    p = np.linspace(0, 1, n)
    fc = f0 * (f1 / f0) ** (p ** 0.6)
    out = np.vstack([svf(rng.standard_normal(n), fc, 1.6, "bp"), svf(rng.standard_normal(n), fc * 1.05, 1.6, "bp")])
    # entra en ~25 ms: es la caída DESPUÉS del golpe, no parte del golpe (no suma al pico del downbeat)
    amp = (1 - p) ** 1.6 * smoothstep(p * n / SR / 0.025)
    return out * amp
