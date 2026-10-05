"""
dsp.py — caja de herramientas DSP de la promo de Prime Cruceros (escrita de cero).

Convenciones de todo el sistema de audio:
- SR = 48 000 Hz. Señal mono = np.ndarray 1D float64; señal estéreo = array (2, n).
- Nada de azar sin semilla: lo aleatorio sale de `rng_of(...)`, que arma la semilla con crc32
  (el hash() de Python cambia en cada corrida, así que acá no se usa).
- Lo que tiene recursión por muestra (filtros con corte que se mueve, osciladores band-limited,
  compresor, delay, limitador) va en numba; lo demás es numpy/scipy vectorizado.
"""
from __future__ import annotations

import math
import struct
import zlib

import numpy as np
from numba import njit
from scipy import signal
from scipy.ndimage import uniform_filter1d

SR = 48000
TWO_PI = 2.0 * math.pi


# ---------------------------------------------------------------------------
# Utilidades básicas
# ---------------------------------------------------------------------------

def ns(seconds: float) -> int:
    """Segundos → muestras (redondeo al más cercano)."""
    return int(round(seconds * SR))


def tvec(n: int) -> np.ndarray:
    return np.arange(n, dtype=np.float64) / SR


def undb(d):
    return 10.0 ** (np.asarray(d, dtype=np.float64) / 20.0)


def todb(x, floor=1e-12):
    return 20.0 * np.log10(np.maximum(np.abs(x), floor))


def mtof(m):
    """Nota MIDI → Hz (La4 = 69 = 440 Hz)."""
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=np.float64) - 69.0) / 12.0)


def seed_of(*parts) -> int:
    """Semilla estable a partir de cualquier combinación de strings y números."""
    return zlib.crc32("|".join(str(p) for p in parts).encode("utf-8"))


def rng_of(*parts) -> np.random.Generator:
    return np.random.default_rng(seed_of(*parts))


def stereo(x) -> np.ndarray:
    """Garantiza forma (2, n)."""
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        return np.vstack([x, x])
    return x


def pan(x: np.ndarray, p: float = 0.0) -> np.ndarray:
    """Mono → estéreo con ley de potencia constante (p de −1 izquierda a +1 derecha).
    Al centro cada canal queda en 0,707 (−3 dB)."""
    a = (float(p) + 1.0) * math.pi / 4.0
    return np.vstack([x * math.cos(a), x * math.sin(a)])


def pan_auto(x: np.ndarray, p: np.ndarray) -> np.ndarray:
    """Paneo con automatización (p por muestra). Acepta mono o estéreo (si es estéreo hace balance)."""
    a = (np.clip(p, -1, 1) + 1.0) * math.pi / 4.0
    if x.ndim == 1:
        return np.vstack([x * np.cos(a), x * np.sin(a)])
    return np.vstack([x[0] * np.cos(a) * math.sqrt(2), x[1] * np.sin(a) * math.sqrt(2)])


def width(x: np.ndarray, w: float) -> np.ndarray:
    """Ancho estéreo por M/S: w=0 mono, 1 igual, >1 más ancho."""
    m = 0.5 * (x[0] + x[1])
    s = 0.5 * (x[0] - x[1]) * w
    return np.vstack([m + s, m - s])


def place(dst: np.ndarray, src: np.ndarray, start: int, gain: float = 1.0) -> None:
    """Suma `src` en `dst` desde la muestra `start` (recorta lo que cae afuera). Mono o estéreo."""
    n_dst = dst.shape[-1]
    n_src = src.shape[-1]
    a = max(0, start)
    b = min(n_dst, start + n_src)
    if b <= a:
        return
    sa = a - start
    sb = sa + (b - a)
    if dst.ndim == 2 and src.ndim == 1:
        dst[:, a:b] += gain * src[sa:sb]
    elif dst.ndim == 2:
        dst[:, a:b] += gain * src[:, sa:sb]
    else:
        dst[a:b] += gain * src[sa:sb]


def fade_edges(x: np.ndarray, fin: float = 0.0005, fout: float = 0.003) -> np.ndarray:
    """Rampas cortas en los bordes para que ningún evento arranque o corte con clic."""
    n = x.shape[-1]
    a, b = min(n, ns(fin)), min(n, ns(fout))
    env = np.ones(n)
    if a > 0:
        env[:a] = np.sin(0.5 * math.pi * np.arange(a) / a) ** 2
    if b > 0:
        env[n - b:] *= np.cos(0.5 * math.pi * np.arange(1, b + 1) / b) ** 2
    return x * env


# ---------------------------------------------------------------------------
# Ruido
# ---------------------------------------------------------------------------

def white(n: int, rng: np.random.Generator) -> np.ndarray:
    return rng.standard_normal(n)


def colored(n: int, rng: np.random.Generator, slope_db_oct: float) -> np.ndarray:
    """Ruido con pendiente espectral arbitraria (−3 rosa, −6 marrón), normalizado a RMS 1."""
    w = rng.standard_normal(n)
    spec = np.fft.rfft(w)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    f[0] = f[1] if n > 1 else 1.0
    spec *= (f / 1000.0) ** (slope_db_oct / (20.0 * math.log10(2.0)))
    y = np.fft.irfft(spec, n)
    return y / (np.sqrt(np.mean(y ** 2)) + 1e-12)


def pink(n, rng):
    return colored(n, rng, -3.0)


def brown(n, rng):
    return colored(n, rng, -6.0)


def smooth_noise(n: int, rng: np.random.Generator, rate_hz: float) -> np.ndarray:
    """Modulación aleatoria lenta (ruido pasado por pasa-bajos), entre −1 y 1 aprox."""
    x = rng.standard_normal(n)
    y = lp(x, max(0.5, rate_hz), order=2)
    return y / (np.max(np.abs(y)) + 1e-12)


# ---------------------------------------------------------------------------
# Filtros estáticos (biquads / Butterworth con scipy)
# ---------------------------------------------------------------------------

def _sos(order, wn, kind):
    return signal.butter(order, wn, btype=kind, fs=SR, output="sos")


def lp(x, fc, order=2):
    return signal.sosfilt(_sos(order, min(fc, 0.45 * SR), "low"), x, axis=-1)


def hp(x, fc, order=2):
    return signal.sosfilt(_sos(order, max(fc, 5.0), "high"), x, axis=-1)


def bp(x, f1, f2, order=2):
    return signal.sosfilt(_sos(order, [max(f1, 5.0), min(f2, 0.45 * SR)], "band"), x, axis=-1)


def _rbj(kind, f0, gain_db=0.0, q=0.707):
    """Coeficientes RBJ (Audio EQ Cookbook) como sos de una sección."""
    A = 10.0 ** (gain_db / 40.0)
    w0 = TWO_PI * f0 / SR
    cw, sw = math.cos(w0), math.sin(w0)
    alpha = sw / (2.0 * q)
    if kind == "peak":
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]
        a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    elif kind == "lowshelf":
        sa = 2 * math.sqrt(A) * alpha
        b = [A * ((A + 1) - (A - 1) * cw + sa), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sa)]
        a = [(A + 1) + (A - 1) * cw + sa, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sa]
    elif kind == "highshelf":
        sa = 2 * math.sqrt(A) * alpha
        b = [A * ((A + 1) + (A - 1) * cw + sa), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sa)]
        a = [(A + 1) - (A - 1) * cw + sa, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sa]
    else:
        raise ValueError(kind)
    b = np.array(b) / a[0]
    a = np.array(a) / a[0]
    return np.concatenate([b, a])[None, :]


def peq(x, f0, gain_db, q=1.0):
    return signal.sosfilt(_rbj("peak", f0, gain_db, q), x, axis=-1)


def low_shelf(x, f0, gain_db, q=0.707):
    return signal.sosfilt(_rbj("lowshelf", f0, gain_db, q), x, axis=-1)


def high_shelf(x, f0, gain_db, q=0.707):
    return signal.sosfilt(_rbj("highshelf", f0, gain_db, q), x, axis=-1)


def mono_below(x: np.ndarray, fc: float = 120.0) -> np.ndarray:
    """Deja en mono todo lo que está por debajo de fc (pasa-altos al canal lateral)."""
    m = 0.5 * (x[0] + x[1])
    s = 0.5 * (x[0] - x[1])
    s = hp(s, fc, order=4)
    return np.vstack([m + s, m - s])


# ---------------------------------------------------------------------------
# Filtro de variable de estado (TPT/Zavalishin) con corte y Q por muestra
# ---------------------------------------------------------------------------

@njit(cache=True)
def _svf_core(x, fc, q, mode, sr):
    n = x.shape[0]
    y = np.empty(n)
    ic1 = 0.0
    ic2 = 0.0
    lim = 0.45 * sr
    for i in range(n):
        f = fc[i]
        if f < 5.0:
            f = 5.0
        elif f > lim:
            f = lim
        g = math.tan(math.pi * f / sr)
        k = 1.0 / q[i]
        a1 = 1.0 / (1.0 + g * (g + k))
        a2 = g * a1
        a3 = g * a2
        v0 = x[i]
        v3 = v0 - ic2
        v1 = a1 * ic1 + a2 * v3
        v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        if mode == 0:
            y[i] = v2                    # pasa-bajos
        elif mode == 1:
            y[i] = v1 * k                # pasa-banda con pico unitario
        elif mode == 2:
            y[i] = v0 - k * v1 - v2      # pasa-altos
        else:
            y[i] = v0 - k * v1           # notch
    return y


_SVF_MODES = {"lp": 0, "bp": 1, "hp": 2, "notch": 3}


def svf(x, fc, q=0.707, mode="lp"):
    """SVF de 12 dB/oct con corte (Hz) y Q que pueden ser escalares o arrays por muestra."""
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 2:
        return np.vstack([svf(c, fc, q, mode) for c in x])
    n = x.shape[0]
    fca = np.ascontiguousarray(np.broadcast_to(np.asarray(fc, dtype=np.float64), (n,)))
    qa = np.ascontiguousarray(np.broadcast_to(np.asarray(q, dtype=np.float64), (n,)))
    return _svf_core(np.ascontiguousarray(x), fca, qa, _SVF_MODES[mode], float(SR))


def svf4(x, fc, q=0.707, mode="lp"):
    """Dos SVF en cascada (24 dB/oct). La resonancia la pone la primera etapa."""
    return svf(svf(x, fc, q, mode), fc, 0.707, mode)


# ---------------------------------------------------------------------------
# Osciladores band-limited (PolyBLEP)
# ---------------------------------------------------------------------------

@njit(cache=True)
def _blep(t, dt):
    if t < dt:
        t = t / dt
        return t + t - t * t - 1.0
    elif t > 1.0 - dt:
        t = (t - 1.0) / dt
        return t * t + t + t + 1.0
    return 0.0


@njit(cache=True)
def _saw_core(freq, ph0, sr):
    n = freq.shape[0]
    y = np.empty(n)
    ph = ph0
    for i in range(n):
        dt = freq[i] / sr
        y[i] = 2.0 * ph - 1.0 - _blep(ph, dt)
        ph += dt
        while ph >= 1.0:
            ph -= 1.0
    return y


@njit(cache=True)
def _pulse_core(freq, pw, ph0, sr):
    n = freq.shape[0]
    y = np.empty(n)
    ph = ph0
    for i in range(n):
        dt = freq[i] / sr
        w = pw[i]
        v = 1.0 if ph < w else -1.0
        v += _blep(ph, dt)
        p2 = ph - w
        if p2 < 0.0:
            p2 += 1.0
        v -= _blep(p2, dt)
        y[i] = v
        ph += dt
        while ph >= 1.0:
            ph -= 1.0
    return y


def _arr(v, n):
    return np.ascontiguousarray(np.broadcast_to(np.asarray(v, dtype=np.float64), (n,)))


def saw(freq, n=None, phase=0.0):
    """Diente de sierra band-limited. `freq` escalar (con n) o array por muestra."""
    if n is None:
        n = len(freq)
    return _saw_core(_arr(freq, n), float(phase % 1.0), float(SR))


def pulse(freq, n=None, pw=0.5, phase=0.0):
    if n is None:
        n = len(freq)
    return _pulse_core(_arr(freq, n), _arr(pw, n), float(phase % 1.0), float(SR))


def phase_of(freq, n=None, phase=0.0):
    """Fase acumulada (radianes) para una frecuencia por muestra; arranca en `phase`."""
    f = _arr(freq, n if n is not None else len(freq))
    ph = np.cumsum(f) * (TWO_PI / SR)
    return ph - ph[0] + phase


def sine(freq, n=None, phase=0.0):
    return np.sin(phase_of(freq, n, phase))


def supersaw(freq, n, rng, voices=7, detune_st=0.22, spread=0.9):
    """Supersaw estéreo: `voices` sierras desafinadas con fase al azar, paneadas en abanico.
    `freq` puede ser escalar o array (para glissandos)."""
    f = _arr(freq, n)
    out = np.zeros((2, n))
    offs = np.linspace(-1.0, 1.0, voices)
    offs = np.sign(offs) * np.abs(offs) ** 1.4  # más voces cerca del centro (como el JP-8000)
    for k, o in enumerate(offs):
        ratio = 2.0 ** (o * detune_st / 12.0)
        v = saw(f * ratio, phase=rng.random())
        p = spread * (o if voices > 1 else 0.0)
        out += pan(v, p)
    return out / math.sqrt(voices)


# ---------------------------------------------------------------------------
# Envolventes
# ---------------------------------------------------------------------------

def env_adsr(n: int, a: float, d: float, s: float, r: float, gate: float) -> np.ndarray:
    """ADSR clásica. a/d/r en segundos, s nivel 0..1, gate = duración de la nota (s).
    Ataque con curva seno, decaimiento y release exponenciales."""
    t = tvec(n)
    env = np.empty(n)
    a = max(a, 1e-4)
    att = np.clip(t / a, 0, 1)
    att = np.sin(0.5 * math.pi * att) ** 2
    dec = s + (1 - s) * np.exp(-np.maximum(t - a, 0) / max(d, 1e-4))
    env = np.where(t < a, att, dec)
    g = ns(gate)
    if g < n:
        lvl = env[g - 1] if g > 0 else 0.0
        tr = t[g:] - t[g]
        env[g:] = lvl * np.exp(-tr / max(r, 1e-4) * 4.0)  # llega a ~2 % en r
        # cierre exacto a cero para que la cola no deje escalón
        tail = np.clip(1 - tr / (r * 1.6), 0, 1)
        env[g:] *= tail
    return env


def env_perc(n: int, attack: float, tau: float, curve: float = 1.0) -> np.ndarray:
    """Envolvente percusiva: ataque seno (s) + caída exponencial con constante tau (s)."""
    t = tvec(n)
    att = np.clip(t / max(attack, 1e-5), 0, 1)
    att = np.sin(0.5 * math.pi * att) ** 2
    dec = np.exp(-np.maximum(t - attack, 0) / tau) ** curve
    return att * dec


def ramp(n: int, x0: float, x1: float, shape: float = 1.0) -> np.ndarray:
    """Rampa de x0 a x1 con forma potencia (shape>1 arranca lento y acelera)."""
    p = np.linspace(0.0, 1.0, n) ** shape
    return x0 + (x1 - x0) * p


def exp_ramp(n: int, f0: float, f1: float, shape: float = 1.0) -> np.ndarray:
    """Rampa exponencial (para barridos de frecuencia)."""
    p = np.linspace(0.0, 1.0, n) ** shape
    return f0 * (f1 / f0) ** p


def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


# ---------------------------------------------------------------------------
# Saturación
# ---------------------------------------------------------------------------

def tanh_sat(x, drive: float = 1.0):
    """Saturación suave normalizada (1 → 1)."""
    return np.tanh(drive * x) / math.tanh(drive)


def warm_sat(x, drive: float = 1.5, asym: float = 0.08):
    """Saturación tipo cinta con un toque asimétrico (agrega 2.º armónico), sin DC."""
    y = np.tanh(drive * (x + asym)) - math.tanh(drive * asym)
    y /= math.tanh(drive)
    return hp(y, 12.0, order=1)


# ---------------------------------------------------------------------------
# Dinámica
# ---------------------------------------------------------------------------

@njit(cache=True)
def _comp_core(level_db, thr, ratio, knee, att_c, rel_c):
    n = level_db.shape[0]
    g = np.empty(n)
    gr = 0.0
    slope = 1.0 / ratio - 1.0
    for i in range(n):
        over = level_db[i] - thr
        if 2.0 * over < -knee:
            target = 0.0
        elif 2.0 * abs(over) <= knee:
            target = slope * (over + knee / 2.0) ** 2 / (2.0 * knee)
        else:
            target = slope * over
        if target < gr:
            gr = att_c * gr + (1.0 - att_c) * target
        else:
            gr = rel_c * gr + (1.0 - rel_c) * target
        g[i] = gr
    return g


def compress(x, thr_db=-18.0, ratio=3.0, attack=0.01, release=0.15, knee=6.0,
             makeup_db=0.0, key=None, rms_win=0.004, return_gain=False):
    """Compresor feed-forward con rodilla suave, detector RMS corto y enlace estéreo.
    `key` = señal de detección externa (sidechain)."""
    src = stereo(x if key is None else key)
    det = np.max(src ** 2, axis=0)
    if rms_win > 0:
        det = uniform_filter1d(det, max(1, ns(rms_win)), mode="nearest")
    # la suma corrida del filtro puede dejar valores apenas negativos (error de redondeo):
    # sin este piso, log10 da NaN y el estado recursivo del compresor lo propaga a toda la pista
    det = np.maximum(det, 0.0)
    lvl = 10.0 * np.log10(det + 1e-14)
    att_c = math.exp(-1.0 / (attack * SR))
    rel_c = math.exp(-1.0 / (release * SR))
    gdb = _comp_core(lvl, float(thr_db), float(ratio), float(knee), att_c, rel_c)
    g = undb(gdb + makeup_db)
    y = x * g
    return (y, gdb) if return_gain else y


def pump_env(n: int, triggers, depth: float = 0.7, release: float = 0.22,
             curve: float = 2.0, pre: float = 0.004, hold: float = 0.012) -> np.ndarray:
    """Envolvente de sidechain sincronizada a los bombos (estilo LFO de bombeo).
    Baja a (1−depth) en `pre` s antes del golpe, sostiene `hold` y vuelve con forma potencia en `release`."""
    env = np.ones(n)
    t_pre, t_hold, t_rel = ns(pre), ns(hold), ns(release)
    shape_len = t_pre + t_hold + t_rel
    k = np.arange(shape_len)
    shp = np.ones(shape_len)
    shp[:t_pre] = 1.0 - depth * smoothstep(k[:t_pre] / max(t_pre, 1))
    shp[t_pre:t_pre + t_hold] = 1.0 - depth
    r = (k[t_pre + t_hold:] - t_pre - t_hold) / max(t_rel, 1)
    shp[t_pre + t_hold:] = 1.0 - depth * (1.0 - smoothstep(r) ** (1.0 / curve))
    for s in triggers:
        a = s - t_pre
        lo, hi = max(0, a), min(n, a + shape_len)
        if hi <= lo:
            continue
        env[lo:hi] = np.minimum(env[lo:hi], shp[lo - a:hi - a])
    return env


@njit(cache=True)
def _ar_core(x, ac, rc):
    n = x.shape[0]
    y = np.empty(n)
    cur = 0.0
    for i in range(n):
        v = x[i]
        if v > cur:
            cur = ac * cur + (1.0 - ac) * v
        else:
            cur = rc * cur + (1.0 - rc) * v
        y[i] = cur
    return y


def one_pole_ar(x, attack: float, release: float) -> np.ndarray:
    """Seguidor de envolvente de un polo con ataque y release distintos (s)."""
    return _ar_core(np.ascontiguousarray(np.asarray(x, dtype=np.float64)),
                    math.exp(-1.0 / (attack * SR)), math.exp(-1.0 / (release * SR)))


def soft_clip_os(x: np.ndarray, ceiling_db: float, os: int = 4, knee_db: float = 4.0) -> np.ndarray:
    """Clipper suave sobremuestreado ×os: lineal hasta `ceiling − knee` y tanh por encima, sin
    pasar nunca de `ceiling`. Redondea picos de pocos ms sin bombear (no tiene tiempos) y, al
    trabajar sobremuestreado, la distorsión que genera no se pliega como aliasing."""
    x = stereo(x)
    n = x.shape[1]
    c = float(undb(ceiling_db))
    thr = c * float(undb(-knee_db))
    up = signal.resample_poly(x, os, 1, axis=1, window=("kaiser", 10.0))
    a = np.abs(up)
    over = a > thr
    a2 = np.where(over, thr + (c - thr) * np.tanh((a - thr) / (c - thr)), a)
    y = np.sign(up) * a2
    return signal.resample_poly(y, 1, os, axis=1, window=("kaiser", 10.0))[:, :n]


# ---------------------------------------------------------------------------
# Espacio: reverb por convolución con IR sintetizada y delay ping-pong
# ---------------------------------------------------------------------------

def make_ir(length=2.4, rt60=(2.2, 1.9, 1.5, 1.0, 0.6), bands=(250.0, 1000.0, 4000.0, 9000.0),
            predelay=0.015, fade_in=0.008, early=10, seed=1, hp_fc=150.0, lp_fc=11000.0) -> np.ndarray:
    """IR estéreo sintética: ruido gaussiano partido en bandas, cada una con su RT60
    (los agudos se apagan antes, como en una sala real), reflexiones tempranas dispersas
    y pre-delay. Canales con semillas distintas → reverb ancha y decorrelacionada."""
    n = ns(length)
    t = tvec(n)
    edges = [0.0] + list(bands) + [SR / 2.0]
    out = np.zeros((2, n))
    for ch in range(2):
        rng = np.random.default_rng(seed * 1009 + ch * 7919)
        noise = rng.standard_normal(n)
        acc = np.zeros(n)
        for b in range(len(edges) - 1):
            lo_f, hi_f = edges[b], edges[b + 1]
            if lo_f == 0.0:
                sos = _sos(4, hi_f, "low")
            elif hi_f >= SR / 2.0:
                sos = _sos(4, lo_f, "high")
            else:
                sos = _sos(2, [lo_f, hi_f], "band")
            acc += signal.sosfilt(sos, noise) * np.exp(-6.9078 * t / rt60[b])
        acc *= 1.0 - np.exp(-t / fade_in)
        # reflexiones tempranas: pocas, nítidas, filtradas
        er = np.zeros(n)
        for _ in range(early):
            d = ns(rng.uniform(0.004, 0.045))
            er[d] += rng.uniform(0.25, 0.7) * (1 if rng.random() < 0.5 else -1) * math.exp(-d / SR / 0.03)
        er = lp(er, 7000.0)
        acc = acc / (np.sqrt(np.sum(acc ** 2)) + 1e-12) + 0.35 * er
        pd = ns(predelay)
        acc = np.concatenate([np.zeros(pd), acc[:n - pd]])
        acc = hp(acc, hp_fc, order=2)
        acc = lp(acc, lp_fc, order=2)
        out[ch] = acc
    out /= np.sqrt(np.mean(np.sum(out ** 2, axis=1)))
    return out


def convolve_reverb(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    """Reverb mono-in/estéreo-out (L+R alimenta las dos respuestas decorrelacionadas)."""
    x = stereo(x)
    n = x.shape[1]
    m = 0.5 * (x[0] + x[1])
    side = 0.5 * (x[0] - x[1])
    yl = signal.oaconvolve(m + 0.5 * side, ir[0])[:n]
    yr = signal.oaconvolve(m - 0.5 * side, ir[1])[:n]
    return np.vstack([yl, yr])


@njit(cache=True)
def _pingpong_core(xin, d, fb, damp_c, hp_c):
    n = xin.shape[0]
    bl = np.zeros(d)
    br = np.zeros(d)
    yl = np.empty(n)
    yr = np.empty(n)
    lpl = 0.0
    lpr = 0.0
    hpl = 0.0
    hpr = 0.0
    idx = 0
    for i in range(n):
        dl = bl[idx]
        dr = br[idx]
        yl[i] = dl
        yr[i] = dr
        # amortiguación (pasa-bajos) y limpieza de graves (pasa-altos) en la realimentación
        lpl += damp_c * (dl - lpl)
        lpr += damp_c * (dr - lpr)
        hpl += hp_c * (lpl - hpl)
        hpr += hp_c * (lpr - hpr)
        fl = lpl - hpl
        fr = lpr - hpr
        bl[idx] = xin[i] + fb * fr   # la entrada va a la izquierda y la realimentación cruza
        br[idx] = fb * fl
        idx += 1
        if idx >= d:
            idx = 0
    return yl, yr


def pingpong(x: np.ndarray, delay_s: float, fb: float = 0.45, damp_hz: float = 4500.0,
             hp_hz: float = 250.0) -> np.ndarray:
    """Delay ping-pong sincronizable (devuelve solo la señal húmeda, estéreo)."""
    x = stereo(x)
    xin = np.ascontiguousarray(0.5 * (x[0] + x[1]))
    damp_c = 1.0 - math.exp(-TWO_PI * damp_hz / SR)
    hp_c = 1.0 - math.exp(-TWO_PI * hp_hz / SR)
    yl, yr = _pingpong_core(xin, ns(delay_s), float(fb), damp_c, hp_c)
    return np.vstack([yl, yr])


# ---------------------------------------------------------------------------
# True peak, limitador con lookahead y loudness BS.1770-4
# ---------------------------------------------------------------------------

def true_peak_env(x: np.ndarray, os: int = 4) -> np.ndarray:
    """Pico real por muestra: máximo |x| de la señal sobremuestreada `os` veces en [n, n+1),
    enlazado entre canales."""
    x = stereo(x)
    up = signal.resample_poly(x, os, 1, axis=1, window=("kaiser", 10.0))
    n = x.shape[1]
    a = np.abs(up[:, :n * os]).reshape(2, n, os).max(axis=(0, 2))
    return np.maximum(a, np.abs(x).max(axis=0))


def true_peak_db(x: np.ndarray, os: int = 4) -> float:
    return float(todb(true_peak_env(x, os).max()))


@njit(cache=True)
def _fwd_min(req, L):
    n = req.shape[0]
    out = np.empty(n)
    for i in range(n):
        m = req[i]
        j_end = i + L
        if j_end > n:
            j_end = n
        for j in range(i + 1, j_end):
            if req[j] < m:
                m = req[j]
        out[i] = m
    return out


@njit(cache=True)
def _release(g, rel_c):
    n = g.shape[0]
    out = np.empty(n)
    cur = 1.0
    for i in range(n):
        if g[i] < cur:
            cur = g[i]
        else:
            cur = rel_c * cur + (1.0 - rel_c) * g[i]
        out[i] = cur
    return out


def tp_limiter(x: np.ndarray, ceiling_db=-1.5, lookahead: float = 0.003,
               release: float = 0.09, os: int = 4):
    """Limitador true-peak sin latencia (offline): la ganancia requerida en cada pico real se
    adelanta con un mínimo móvil hacia el futuro de `lookahead` s y se suaviza con un
    promedio móvil del mismo largo, así la rampa termina justo en el pico. `ceiling_db` puede ser
    un escalar o un array por muestra (techo variable). Devuelve (y, ganancia)."""
    x = stereo(x)
    c = undb(np.asarray(ceiling_db, dtype=np.float64))
    p = true_peak_env(x, os)
    req = np.minimum(1.0, c / np.maximum(p, 1e-12))
    L = max(2, ns(lookahead))
    g1 = _fwd_min(np.ascontiguousarray(req), L)
    g2 = _release(g1, math.exp(-1.0 / (release * SR)))
    cs = np.concatenate([[0.0], np.cumsum(g2)])
    idx = np.arange(len(g2))
    lo = np.maximum(0, idx - L + 1)
    g3 = (cs[idx + 1] - cs[lo]) / (idx + 1 - lo)
    return x * g3, g3


# filtros K de BS.1770-4 (coeficientes oficiales a 48 kHz)
_K1_B = np.array([1.53512485958697, -2.69169618940638, 1.19839281085285])
_K1_A = np.array([1.0, -1.69065929318241, 0.73248077421585])
_K2_B = np.array([1.0, -2.0, 1.0])
_K2_A = np.array([1.0, -1.99004745483398, 0.99007225036621])


def k_weight(x: np.ndarray) -> np.ndarray:
    return signal.lfilter(_K2_B, _K2_A, signal.lfilter(_K1_B, _K1_A, x, axis=-1), axis=-1)


def _block_ms(x: np.ndarray, block: float, hop: float):
    """Energía media por canal en bloques (K ponderado). Devuelve array (bloques,)."""
    y = k_weight(stereo(x)) ** 2
    e = y.sum(axis=0)
    B, H = ns(block), ns(hop)
    if e.shape[0] < B:
        return np.array([e.mean()]) if e.shape[0] else np.array([0.0])
    cs = np.concatenate([[0.0], np.cumsum(e)])
    starts = np.arange(0, e.shape[0] - B + 1, H)
    return (cs[starts + B] - cs[starts]) / B


def lufs_integrated(x: np.ndarray) -> float:
    """Loudness integrado BS.1770-4 (bloques de 400 ms con 75 % de solape, compuertas −70 y −10)."""
    z = _block_ms(x, 0.4, 0.1)
    lk = -0.691 + 10 * np.log10(z + 1e-20)
    g1 = z[lk > -70.0]
    if g1.size == 0:
        return -120.0
    rel = -0.691 + 10 * np.log10(g1.mean()) - 10.0
    g2 = z[(lk > -70.0) & (lk > rel)]
    if g2.size == 0:
        return -120.0
    return float(-0.691 + 10 * np.log10(g2.mean()))


def lufs_curve(x: np.ndarray, window: float = 3.0, hop: float = 0.1):
    """Loudness por ventana (3 s = short-term, 0,4 s = momentáneo). Devuelve (tiempos centro, LUFS)."""
    z = _block_ms(x, window, hop)
    t = np.arange(len(z)) * hop + window / 2
    return t, -0.691 + 10 * np.log10(z + 1e-20)


# ---------------------------------------------------------------------------
# Envolventes y crestas de banda completa (sfx.py calibra con ellas; analyze.py verifica igual)
# ---------------------------------------------------------------------------

def rms_env(x: np.ndarray, win: float = 0.001) -> np.ndarray:
    """RMS centrado (sin retardo) de 1 ms por defecto, enlazado entre canales."""
    e = np.sum(stereo(x) ** 2, axis=0)
    return np.sqrt(np.maximum(uniform_filter1d(e, max(1, ns(win)), mode="constant"), 0.0))


def _hann_smooth(e: np.ndarray, win: float) -> np.ndarray:
    n = max(3, int(round(win * SR)) | 1)
    w = np.hanning(n)
    return signal.fftconvolve(e, w / w.sum(), mode="same")


def fine_env(x: np.ndarray, smooth: float = 0.002) -> np.ndarray:
    """Envolvente fina de banda completa: |Hilbert| (enlazado entre canales) suavizado con una
    Hann de 2 ms. Marca la cresta del golpe tal como la ve un detector independiente."""
    x = stereo(x)
    a = np.sqrt((np.abs(signal.hilbert(x, axis=-1)) ** 2).sum(axis=0))
    return _hann_smooth(a, smooth)


def body_env(x: np.ndarray, win: float = 0.010) -> np.ndarray:
    """Envolvente de cuerpo de banda completa: RMS con ventana Hann de 10 ms sobre L²+R²."""
    e = (stereo(x) ** 2).sum(axis=0)
    return np.sqrt(np.maximum(_hann_smooth(e, win), 0.0))


def sync_crests(x: np.ndarray, lo: int, hi: int, fine: np.ndarray | None = None,
                body: np.ndarray | None = None) -> tuple[int, int]:
    """(cresta fina, cresta de cuerpo) de banda completa dentro de [lo, hi)."""
    f = fine_env(x) if fine is None else fine
    b = body_env(x) if body is None else body
    lo, hi = max(0, lo), min(f.shape[0], hi)
    return lo + int(np.argmax(f[lo:hi])), lo + int(np.argmax(b[lo:hi]))


# ---------------------------------------------------------------------------
# WAV (lectura y escritura propias: 24 bit PCM y 32 bit float)
# ---------------------------------------------------------------------------

def write_wav(path: str, x: np.ndarray, bits: int = 24, dither_seed: int | None = 1234) -> None:
    """Escribe WAV estéreo. bits=24 → PCM entero con dither TPDF (solo donde hay señal, así el
    silencio digital queda en cero exacto); bits=32 → IEEE float."""
    x = stereo(x)
    n = x.shape[1]
    if bits == 24:
        scale = 8388607.0
        y = x * scale
        if dither_seed is not None:
            rng = np.random.default_rng(dither_seed)
            d = rng.random(y.shape) - rng.random(y.shape)
            y = y + d * (np.abs(x) > 0)
        q = np.clip(np.round(y), -8388608, 8388607).astype("<i4")
        inter = q.T.reshape(-1)
        raw = inter.view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
        fmt = struct.pack("<HHIIHH", 1, 2, SR, SR * 2 * 3, 2 * 3, 24)
        chunks = [b"fmt " + struct.pack("<I", len(fmt)) + fmt]
    elif bits == 32:
        raw = np.ascontiguousarray(x.T.astype("<f4")).tobytes()
        fmt = struct.pack("<HHIIHHH", 3, 2, SR, SR * 2 * 4, 2 * 4, 32, 0)
        fact = struct.pack("<I", n)
        chunks = [b"fmt " + struct.pack("<I", len(fmt)) + fmt, b"fact" + struct.pack("<I", 4) + fact]
    else:
        raise ValueError("bits debe ser 24 o 32")
    data = b"data" + struct.pack("<I", len(raw)) + raw
    if len(raw) % 2:
        data += b"\x00"
    body = b"WAVE" + b"".join(chunks) + data
    with open(path, "wb") as fh:
        fh.write(b"RIFF" + struct.pack("<I", len(body)) + body)


def read_wav(path: str):
    """Lee WAV PCM 16/24/32 o float 32. Devuelve (array (canales, n) float64, sr, bits)."""
    with open(path, "rb") as fh:
        b = fh.read()
    assert b[:4] == b"RIFF" and b[8:12] == b"WAVE", "no es WAV"
    pos = 12
    fmt = None
    data = None
    while pos + 8 <= len(b):
        cid = b[pos:pos + 4]
        size = struct.unpack("<I", b[pos + 4:pos + 8])[0]
        body = b[pos + 8:pos + 8 + size]
        if cid == b"fmt ":
            fmt = struct.unpack("<HHIIHH", body[:16])
            if fmt[0] == 0xFFFE and len(body) >= 26:
                # WAVE_FORMAT_EXTENSIBLE: el formato real está en los 2 primeros bytes del GUID
                fmt = (struct.unpack("<H", body[24:26])[0],) + fmt[1:]
        elif cid == b"data":
            data = body
        pos += 8 + size + (size % 2)
    tag, ch, sr, _, _, bits = fmt
    if tag == 3:
        x = np.frombuffer(data, dtype="<f4").astype(np.float64)
    elif bits == 16:
        x = np.frombuffer(data, dtype="<i2").astype(np.float64) / 32768.0
    elif bits == 24:
        u = np.frombuffer(data, dtype=np.uint8).reshape(-1, 3)
        v = (u[:, 0].astype(np.int32) | (u[:, 1].astype(np.int32) << 8) | (u[:, 2].astype(np.int32) << 16))
        v = np.where(v >= 1 << 23, v - (1 << 24), v)
        x = v.astype(np.float64) / 8388608.0
    elif bits == 32:
        x = np.frombuffer(data, dtype="<i4").astype(np.float64) / 2147483648.0
    else:
        raise ValueError(f"bits no soportados: {bits}")
    return x.reshape(-1, ch).T.copy(), sr, bits
