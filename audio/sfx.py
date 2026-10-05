"""
sfx.py — los efectos de sonido de cada cue de src/cues.json, sintetizados de cero.

Contrato de cada SFX: `fn(cue, ctx) -> (x, anchor)`
- x: array estéreo (2, n)
- anchor: muestra de x donde está la CRESTA del transitorio. build.py ubica x de modo que esa
  muestra caiga exactamente en round(cue.t · SR). Las anticipaciones (subidas, barridos, «la hoja
  que levanta la esquina») quedan ANTES del anchor y los rebotes/colas DESPUÉS.

La cresta se mide en BANDA COMPLETA, con dos detectores independientes del diseño: la envolvente
fina (|Hilbert| suavizado 2 ms) y la de cuerpo (RMS Hann de 10 ms). El anchor se recalibra al punto
medio de las dos, y cada sonido está diseñado para que estén a pocos ms entre sí: los golpes graves
tienen barridos de tono de ≤ 5 ms y el ataque medio domina la energía del primer instante. Nada de
chasquidos de aire de 1 ms: la cresta es el golpe del propio sonido, no un «tss» pegado encima.

Agua: nada de ruido blanco crudo. Se arma con
- burbujas de Minnaert (senoidales cortas con chirp ascendente, radios al azar),
- espuma (nube densa de micro-burbujas agudas),
- spray (crepitar de gotitas: impulsos dispersos filtrados) y
- rugido (ruido marrón filtrado con modulación lenta).
"""
from __future__ import annotations

import math

import numpy as np

from arrangement import CHORDS
from dsp import (SR, TWO_PI, body_env, bp, brown, env_perc, fade_edges, fine_env, hp, lp, mtof, ns, pan,
                 pan_auto, peq, phase_of, pink, saw, smooth_noise, smoothstep, svf, sync_crests, tanh_sat,
                 tvec, width)

# ---------------------------------------------------------------------------
# Bloques de construcción
# ---------------------------------------------------------------------------


def _z(sec):
    return np.zeros((2, ns(sec)))


def _fit(a, n):
    """Recorta o rellena con ceros a largo n (evita desfasajes de una muestra entre buffers)."""
    if len(a) >= n:
        return a[:n]
    return np.concatenate([a, np.zeros(n - len(a))])


def _put(dst, src, at_sec, gain=1.0, p=0.0):
    """Suma src (mono o estéreo) en dst a partir de at_sec segundos."""
    if src.ndim == 1:
        src = pan(src, p)
    a = ns(at_sec)
    b = min(dst.shape[1], a + src.shape[1])
    if b > a:
        dst[:, a:b] += gain * src[:, :b - a]


def swell_env(n, peak, rise_pow=2.5, tau=0.08, start=0):
    """Sube desde `start` hasta 1 en la muestra `peak` (forma potencia) y cae exponencial (tau s)."""
    e = np.zeros(n)
    k = np.arange(n)
    if peak > start:
        r = (k[start:peak] - start) / (peak - start)
        e[start:peak] = r ** rise_pow
    e[peak:] = np.exp(-(k[peak:] - peak) / (tau * SR))
    return e


def bubble(f0, tau, rise, n=None):
    """Una burbuja de Minnaert: seno amortiguado cuyo tono sube al acercarse a la superficie."""
    L = n or max(16, int(tau * 6 * SR))
    t = tvec(L)
    f = f0 * (1.0 + rise * t / tau)
    b = np.sin(phase_of(f)) * np.exp(-t / tau)
    b *= 1 - np.exp(-t / 0.0003)
    return b


def bubble_cloud(dur, rng, count, fmin, fmax, t_dist=None, tau_k=0.012, rise=(0.2, 0.9),
                 amp_pow=0.35, spread=0.9):
    """Nube de burbujas. t_dist(u) mapea uniformes 0..1 a tiempos (para densidades que decaen)."""
    out = _z(dur)
    for _ in range(count):
        u = rng.random()
        t0 = t_dist(u) if t_dist else u * dur
        f0 = math.exp(rng.uniform(math.log(fmin), math.log(fmax)))
        tau = tau_k * (1000.0 / f0) ** 0.7 * rng.uniform(0.6, 1.4)
        tau = min(max(tau, 0.0012), 0.05)
        b = bubble(f0, tau, rng.uniform(*rise))
        a = (1000.0 / f0) ** amp_pow * rng.uniform(0.3, 1.0)
        _put(out, b, t0, a, rng.uniform(-spread, spread))
    return out


def crackle(n, rng, rate, lo=2500.0, hi=9000.0):
    """Crepitar: impulsos dispersos (rate por segundo) filtrados → gotitas, papel, espuma."""
    imp = (rng.random(n) < rate / SR) * rng.uniform(-1.0, 1.0, n)
    return bp(imp, lo, hi, order=2) * 3.0


def roar(n, rng, fc=550.0, mod_rate=2.5, depth=0.45, hp_fc=90.0):
    """Rugido del agua: ruido marrón con pasa-bajos, sin el sub (pasa-altos en 90 Hz) y con
    modulación lenta de turbulencia."""
    x = lp(brown(n, rng), fc, order=2)
    x = hp(x, hp_fc, order=2)
    m = 1.0 - depth * (0.5 + 0.5 * smooth_noise(n, rng, mod_rate))
    return x * m


def glock(f, tau=0.6, bright=1.0):
    """Campanita tipo glockenspiel (para pines, brillos y destellos)."""
    L = min(3.0, tau * 5)
    n = ns(L)
    t = tvec(n)
    x = np.sin(TWO_PI * f * t) * np.exp(-t / tau)
    if 2.76 * f < 0.45 * SR:
        x += 0.32 * bright * np.sin(TWO_PI * 2.76 * f * t + 0.4) * np.exp(-t / (tau * 0.25))
    if 5.4 * f < 0.4 * SR:
        x += 0.12 * bright * np.sin(TWO_PI * 5.4 * f * t + 1.0) * np.exp(-t / (tau * 0.08))
    x *= 1 - np.exp(-t / 0.0004)
    return fade_edges(x, 0.0001, 0.02)


def snap(n, rng, lo=1500.0, hi=8000.0, amp=1.0, tau=0.003):
    """Ataque corto de ruido (0,5 ms de subida) que define el golpe. Con tope en 9 kHz y caída de
    al menos 2,5 ms: los chasquidos de 1 ms de ruido muy agudo eran los picos más calientes de la
    mezcla (y sonaban a «tss» pegado encima del sonido)."""
    hi = min(hi, 9000.0)
    tau = max(tau, 0.0025)
    return bp(rng.standard_normal(n), lo, hi) * env_perc(n, 0.0005, tau) * amp * 0.5


def tock(n, f=1800.0, tau=0.0012, amp=1.0):
    """Golpecito determinista de banda media (envolvente gamma con pico en `tau`, ~2–3 ms en total):
    es el «toc» del ataque de un objeto. A diferencia de un chasquido de ruido, su envolvente fina
    tiene UN solo máximo, así la cresta del SFX queda inequívoca sin agregar agudos de aire."""
    t = tvec(n)
    return np.sin(TWO_PI * f * t) * (t / tau) * np.exp(1.0 - t / tau) * amp


def pluck_env(n, tau, fast=0.006, mix=0.55, attack=0.0004):
    """Envolvente de «pluck» para SFX afinados: pico nítido al principio + cola más larga."""
    t = tvec(n)
    return (mix * np.exp(-t / fast) + (1 - mix) * np.exp(-t / tau)) * (1 - np.exp(-t / attack))


def thump(f0=110.0, f1=50.0, tau=0.07, sweep=0.004, length=None, att=0.0006):
    """Golpe grave con caída de tono. El barrido es rápido (≤ 5 ms) y la caída corta: si el grave
    dura mucho, el RMS de su segundo semiciclo supera al del ataque y la cresta se corre 10 ms."""
    L = length or tau * 6
    n = ns(L)
    t = tvec(n)
    f = f1 + (f0 - f1) * np.exp(-t / sweep)
    x = np.sin(phase_of(f)) * np.exp(-t / tau) * (1 - np.exp(-t / att))
    return fade_edges(x, 0.0001, 0.01)


def noise_burst(n, rng, lo, hi, attack, tau, order=2):
    return bp(rng.standard_normal(n), lo, hi, order=order) * env_perc(n, attack, tau)


def whoosh(dur, rng, peak_at, f_lo=500.0, f_peak=4500.0, f_end=1200.0, rise_pow=2.6, tau=0.07, q=1.6,
           pan0=-0.7, pan1=0.7):
    """Whoosh con banda que sube hasta el pico y cae después (efecto Doppler), paneo en movimiento."""
    n = ns(dur)
    pk = ns(peak_at)
    k = np.arange(n)
    fc = np.empty(n)
    fc[:pk] = f_lo * (f_peak / f_lo) ** ((k[:pk] / max(pk, 1)) ** 1.5)
    fc[pk:] = f_end + (f_peak - f_end) * np.exp(-(k[pk:] - pk) / (0.08 * SR))
    env = swell_env(n, pk, rise_pow, tau)
    l_ = svf(rng.standard_normal(n), fc, q, "bp")
    r_ = svf(rng.standard_normal(n), fc * 1.04, q, "bp")
    x = np.vstack([l_, r_]) * env
    p = np.linspace(pan0, pan1, n)
    return pan_auto(x, p)


def chord_midis(ctx, t, lo=79, count=4):
    """Notas del acorde que suena en t, desde la MIDI `lo` para arriba (para SFX afinados)."""
    tones = CHORDS[ctx.song.chord_at(t + 1e-4)]["tones"]
    out = []
    m = lo
    while len(out) < count and m < 120:
        if m % 12 in tones:
            out.append(m)
        m += 1
    return out


def tuned_blip(f, n, rng, drop=0.5, tau=0.07, fast=0.006, h2=0.3, h3=0.0):
    """«Blip/blop» afinado: seno con un pequeño glide de tono hacia la nota y armónicos para que se
    lea en 1–4 kHz (no un seno grave que se pierde debajo del bombo)."""
    t = tvec(n)
    fr = f * (1.0 + drop * np.exp(-t / 0.006))
    ph = phase_of(fr)
    x = np.sin(ph) + h2 * np.sin(2 * ph + 0.4) + h3 * np.sin(3 * ph + 0.9)
    return x * pluck_env(n, tau, fast, 0.55, 0.0005)


# ---------------------------------------------------------------------------
# SFX — gancho
# ---------------------------------------------------------------------------

def office_tick(cue, ctx):
    """Primer tic del reloj de la oficina: seco, cercano, con una pizca de cuarto."""
    rng = ctx.rng
    n = ns(0.25)
    t = tvec(n)
    x = np.sin(TWO_PI * 3100.0 * t) * np.exp(-t / 0.005)
    x += 0.7 * np.sin(TWO_PI * 950.0 * t) * np.exp(-t / 0.007)
    x += bp(rng.standard_normal(n), 2000.0, 8000.0) * np.exp(-t / 0.002) * 0.7
    x *= 1 - np.exp(-t / 0.00008)
    room = lp(rng.standard_normal(n), 3000.0) * np.exp(-t / 0.05) * 0.04 * (t > 0.006)
    y = np.vstack([x + room, x - room])
    return y, 0


def page_flip(cue, ctx):
    """Hoja del calendario arrancada: levanta la esquina (roce), se despega (rrrip con cresta en el cue)
    y cae aleteando (modulación de 18–24 Hz) hacia afuera del cuadro."""
    rng = ctx.rng
    pre = 0.16
    dur = pre + 0.55
    out = _z(dur)
    n = out.shape[1]
    t = tvec(n) - pre
    lift = bp(rng.standard_normal(n), 1500.0, 6000.0) * np.clip((t + pre) / pre, 0, 1) ** 2 * (t < 0) * 0.18
    rip = crackle(n, rng, 2200.0, 1200.0, 8000.0) + 0.5 * bp(rng.standard_normal(n), 1800.0, 7000.0)
    rip_env = np.where(t < 0, np.clip(1 + t / 0.035, 0, 1) ** 3, np.exp(-np.maximum(t, 0) / 0.03))
    tear = bp(rng.standard_normal(n), 1500.0, 7000.0) * np.exp(-np.maximum(t, 0) / 0.006) * (t >= 0) * 0.8
    flap_rate = rng.uniform(17.0, 24.0)
    flap = bp(rng.standard_normal(n), 700.0, 4200.0) * (0.5 + 0.5 * np.sin(TWO_PI * flap_rate * t)) ** 2
    flap_env = np.clip(t / 0.05, 0, 1) * np.exp(-np.maximum(t - 0.05, 0) / 0.18) * (t > 0) * 0.35
    mono = lift + rip * rip_env * 0.9 + tear + flap * flap_env
    p = np.clip(0.25 - 1.2 * np.maximum(t, 0), -0.8, 0.3)
    return pan_auto(mono, p), ns(pre)


def type_hit(cue, ctx):
    """Golpe tipográfico: clac mecánico de máquina de escribir (es la oficina) con un cuerpo grave
    corto debajo. El clac (1–3 kHz) es el que manda en el primer instante."""
    rng = ctx.rng
    k = cue.get("fx", {}).get("punch", 0.008) / 0.008
    n = ns(0.6)
    t = tvec(n)
    body = _fit(thump(105.0 * (1 + 0.05 * (k - 1)), 60.0, 0.045, 0.003, 0.6), n)
    clack = np.sin(TWO_PI * 1150.0 * t) * np.exp(-t / 0.014) * 0.6
    clack += np.sin(TWO_PI * 2350.0 * t + 0.5) * np.exp(-t / 0.008) * 0.4
    clack += bp(rng.standard_normal(n), 800.0, 6000.0) * np.exp(-t / 0.006) * 0.9
    clack *= 1 - np.exp(-t / 0.0003)
    x = body * 0.6 + clack + tock(n, 1700.0, 0.0011, 1.4)
    if cue["id"] == "hook.q3":
        # «VACACIONES…» en dorado: lo único cálido → un brillito afinado (Mi del acorde de La)
        x += _fit(glock(1318.5, 0.35), n) * 0.18 * (t > 0.004)
    return np.vstack([x, x]) * 0.9, 0


def drip(cue, ctx):
    """Gotas que se filtran del monitor: «plip» de agua (burbuja de Minnaert con chirp ASCENDENTE,
    ~800 → 2000 Hz, que es como suena una gota al entrar al agua) con un micro impacto, y el bulto de
    agua que se hincha (glup grave lento). La primera gota es la cresta; dos más chicas después."""
    rng = ctx.rng
    dur = 0.6
    out = _z(dur)
    n = out.shape[1]
    drops = ((0.0, 820.0, 2050.0, 0.018, 1.0, 0.25), (0.105, 950.0, 2300.0, 0.013, 0.55, 0.35),
             (0.19, 720.0, 1800.0, 0.022, 0.42, 0.15))
    for at, f0, f1, tau, a, p in drops:
        L = ns(0.12)
        t = tvec(L)
        f = f0 + (f1 - f0) * (1 - np.exp(-t / (tau * 0.7)))
        d = np.sin(phase_of(f)) * np.exp(-t / tau) * (1 - np.exp(-t / 0.0004))
        d += tock(L, 2600.0, 0.0007, 0.6)
        _put(out, d, at, a, p)
    t = tvec(n)
    bulge = svf(rng.standard_normal(n), 260.0 + 300.0 * t / dur, 4.0, "bp")
    bulge *= np.clip(t / 0.35, 0, 1) ** 2 * np.exp(-np.maximum(t - 0.35, 0) / 0.08) * 0.25
    out += pan(bulge, 0.2)
    return out, 0


def wave_rise(cue, ctx):
    """El agua revienta y se levanta la ola: reventón con spray en el cue y después una masa de agua
    que crece (rugido que se abre, lavado medio, siseo y espuma) y CULMINA al final: en el gancho, en
    el arranque real del silencio (hook.gap); en la segunda ola, en el final de `dur` (26,25)."""
    rng = ctx.rng
    t_cue = cue["t"]
    dur = cue.get("dur", 0.46875)
    gap0 = ctx.song.times["gap0"]
    t_end = min(t_cue + dur, gap0) if t_cue < gap0 else t_cue + dur
    T = t_end - t_cue - 0.004                    # termina ≤ 10 ms antes del hueco o del cue
    total = T + 0.02
    out = _z(total)
    n = out.shape[1]
    t = tvec(n)
    p = np.clip(t / T, 0, 1)
    # reventón inicial (cresta local del cue)
    burst = noise_burst(n, rng, 350.0, 5500.0, 0.0015, 0.03) * 1.3
    burst += _fit(thump(140.0, 70.0, 0.035, 0.004, total), n) * 0.35
    burst += tock(n, 1200.0, 0.0013, 1.4) + tock(n, 2700.0, 0.0008, 0.6)
    out += pan(burst, 0.35)
    out += bubble_cloud(total, rng, 70, 350.0, 2500.0, t_dist=lambda u: 0.035 + u ** 1.6 * 0.2, tau_k=0.01) * 0.3
    # masa de agua que crece (va de derecha a izquierda como la ola) y termina ARRIBA del reventón
    body_env = p ** 2.2 * (1 - smoothstep((t - T + 0.006) / 0.006))
    r = roar(n, rng, fc=750.0, mod_rate=2.0, depth=0.25) * 2.2
    fc = 400.0 * (3500.0 / 400.0) ** p
    wash = np.vstack([svf(rng.standard_normal(n), fc, 0.9, "lp"), svf(rng.standard_normal(n), fc * 1.05, 0.9, "lp")])
    hiss = np.vstack([hp(rng.standard_normal(n), 5000.0), hp(rng.standard_normal(n), 5000.0)]) * p ** 2 * 0.3
    foam = bubble_cloud(total, rng, 300, 1500.0, 7000.0, t_dist=lambda u: T * u ** 0.6, tau_k=0.004) * 0.3
    body = pan_auto(r, 0.5 - 0.6 * p) + wash * 0.7 + hiss + foam * p
    out += body * body_env * (2.0 if t_cue < gap0 else 1.6)   # culmina más fuerte que el reventón
    # gancho: más abajo (el final no puede tapar el build); segunda ola: close.in es la cresta de su ventana
    out *= 0.6   # en la segunda ola, close.in (el golpe del cue) tiene que quedar ~2 dB arriba de este final
    return out, 0


def drop_wave(cue, ctx, scale=1.0, sweep=(0.6, -0.6)):
    """LA OLA del drop: rompe con un golpe de agua (la cresta, que manda en los primeros ms), un
    rugido que llega a su máximo en ~20 ms y barre de derecha a izquierda, lavado espumoso, burbujas y
    spray. Las colas se apagan antes de 1,1 s y bajan 3 dB pasados 300 ms (no tapan al hook)."""
    rng = ctx.rng
    dur = 1.35
    out = _z(dur)
    n = out.shape[1]
    t = tvec(n)
    tail_trim = 10 ** (-3.0 * smoothstep((t - 0.3) / 0.12) / 20.0)      # −3 dB pasados 300 ms
    end = 1 - smoothstep((t - 0.85) / 0.25)                            # todo terminado en 1,1 s
    # golpe de agua: ruido medio con ataque de 1,5 ms + «whump» corto
    crash_l = bp(rng.standard_normal(n), 200.0, 6500.0, order=2) * env_perc(n, 0.003, 0.05) * 1.1
    crash_r = bp(rng.standard_normal(n), 200.0, 6500.0, order=2) * env_perc(n, 0.003, 0.05) * 1.1
    whump = _fit(thump(120.0, 60.0, 0.05, 0.004, dur), n) * 0.3          # −6 dB respecto de la v1
    slap_ = tock(n, 1100.0, 0.0014, 1.0) + tock(n, 2600.0, 0.0008, 0.5)  # el cachetazo del agua
    out += np.vstack([crash_l + whump + slap_, crash_r + whump + slap_])
    # rugido que barre la imagen: máximo en ~20 ms y sin sub (pasa-altos 90 Hz)
    r_env = smoothstep(t / 0.02) * np.exp(-t / 0.45) * tail_trim * end
    r = roar(n, rng, fc=520.0, mod_rate=3.0, depth=0.35) * 2.0 * r_env
    pan_path = sweep[0] + (sweep[1] - sweep[0]) * smoothstep(t / 0.45)
    out += pan_auto(r, pan_path)
    # lavado (surf) en medios
    w_env = smoothstep(t / 0.03) * np.exp(-t / 0.35) * tail_trim * end
    for ch in range(2):
        wsh = bp(pink(n, rng), 400.0, 3500.0) * (0.7 + 0.3 * smooth_noise(n, rng, 6.0))
        out[ch] += wsh * w_env * 0.45
    # espuma: micro-burbujas densas que se apagan
    decay_b = smoothstep((t - 0.01) / 0.06) * np.exp(-t / 0.3) * tail_trim * end
    out += bubble_cloud(dur, rng, 800, 1400.0, 8000.0, t_dist=lambda u: 0.03 + 0.9 * u ** 2.2,
                        tau_k=0.0035, rise=(0.3, 1.2)) * 0.26 * decay_b
    out += bubble_cloud(dur, rng, 110, 280.0, 1400.0, t_dist=lambda u: 0.04 + 0.8 * u ** 1.8,
                        tau_k=0.012, rise=(0.15, 0.6)) * 0.36 * decay_b
    # spray que vuela: siseo + gotitas
    s_env = smoothstep(t / 0.01) * np.exp(-t / 0.2)
    for ch in range(2):
        out[ch] += (lp(hp(rng.standard_normal(n), 5000.0), 11000.0) * 0.22
                    + crackle(n, rng, 900.0, 3000.0, 9000.0) * 0.45) * s_env
    out = width(out, 1.15)
    return fade_edges(out * scale, 0.0005, 0.1), 0


def hit(cue, ctx):
    """«CRUCERO?» enorme: golpe medio cinematográfico (manda en el ataque), bum grave corto y cola
    brillante. El grave va −6 dB respecto de la v1 para no embarrar el drop."""
    rng = ctx.rng
    n = ns(1.0)
    x = _fit(thump(95.0, 48.0, 0.08, 0.004, 1.0), n) * 0.45
    x += bp(rng.standard_normal(n), 180.0, 2200.0) * env_perc(n, 0.001, 0.03) * 1.3
    x += lp(hp(rng.standard_normal(n), 2500.0), 9000.0) * env_perc(n, 0.0008, 0.01) * 0.35
    x += tock(n, 1000.0, 0.0016, 1.6) + tock(n, 2300.0, 0.0009, 0.7)
    tail = np.vstack([lp(hp(rng.standard_normal(n), 6000.0), 12000.0), lp(hp(rng.standard_normal(n), 6000.0), 12000.0)])
    tail *= env_perc(n, 0.004, 0.22) * 0.12
    return np.vstack([x, x]) + tail, 0


def ship_horn(cue, ctx):
    """Bocinazo del crucero en el horizonte. El soplo de vapor de la chimenea es la cresta (en el
    cue) y el TONO crece en ~180 ms subiendo de −1 semitono a la nota (como un silbato de vapor que
    toma presión): dos tubos en La2 y Mi3 con formantes nasales (400–700 Hz) y una caña de 1–2 kHz
    para que se lea en un parlante chico, sin nada debajo de 90 Hz (no pisa al bajo del drop).
    Eco lejano del horizonte (250 ms, pasa-bajos 1,5 kHz) del lado opuesto."""
    rng = ctx.rng
    dur = 2.3
    n = ns(dur)
    t = tvec(n)
    hold = 0.3                       # un bocinazo corto: termina antes del empujón al ojo de buey
    grow = np.clip(t / 0.18, 0, 1)
    env = (grow ** 2) * (3 - 2 * grow)
    env *= 1 - smoothstep((t - hold) / 0.12)
    bend = -1.0 * (1 - smoothstep(t / 0.2))
    x = np.zeros(n)
    for midi, a in ((45, 1.0), (52, 0.7)):
        f = float(mtof(midi)) * 2 ** (bend / 12)
        for det in (-0.07, 0.07):
            ff = f * 2 ** (det / 12)
            x += a * (0.65 * saw(ff, phase=rng.random()) + 0.35 * np.sin(phase_of(ff)))
    x = peq(x, 450.0, 7.0, 1.6)      # formantes nasales
    x = peq(x, 650.0, 5.0, 1.8)
    x = peq(x, 1450.0, 8.0, 1.4)     # la «caña»
    x = lp(x, 3200.0, order=2)
    x = hp(x, 110.0, order=2)
    x = tanh_sat(x * 0.5, 1.6) * env
    steam = bp(rng.standard_normal(n), 900.0, 7000.0) * (env_perc(n, 0.0015, 0.02) * 4.0 + 0.1 * env)
    x = x * 0.55 + steam * 0.4
    d = ns(0.25)
    echo = np.zeros(n)
    echo[d:] = lp(x, 1500.0)[:n - d] * 0.22
    # el barco está a la derecha del cuadro: directo levemente a la derecha, eco del lado opuesto
    y = np.vstack([x * 0.85 + echo, x + 0.3 * echo])
    return fade_edges(y, 0.0005, 0.2), 0


def whoosh_in(cue, ctx):
    """La cámara se dispara al ojo de buey: arrancón (cresta en el cue) y un whoosh que crece en
    curva p³ (≈ +25 dB de recorrido) y CULMINA 10 ms antes del corte, donde pega el splash_cut.
    El arrancón es liviano (un «toc» y un «fwip» afinado con poco cuerpo): su cresta fina marca el
    cue, pero en RMS el final del whoosh queda ~2 dB ARRIBA del arranque (culmina de verdad) y, en
    la mezcla, ~2 dB DEBAJO de la cresta del splash (que es el golpe del corte)."""
    rng = ctx.rng
    dur = cue.get("dur", 0.46875)
    n = ns(dur)
    t = tvec(n)
    kick = _fit(thump(150.0, 80.0, 0.03, 0.004, dur), n) * 0.15
    kick += bp(rng.standard_normal(n), 500.0, 6000.0) * env_perc(n, 0.0008, 0.012) * 0.35
    kick += tock(n, 1400.0, 0.0012, 0.8)
    # «fwip» afinado (La6, con su 2.º armónico) en el arrancón
    kick += tuned_blip(1760.0, n, rng, drop=-0.3, tau=0.03, fast=0.004, h2=0.35) * 0.5
    p = t / dur
    fc = 350.0 * (6000.0 / 350.0) ** (p ** 1.4)
    sw = np.vstack([svf(rng.standard_normal(n), fc, 2.0, "bp"), svf(rng.standard_normal(n), fc * 1.05, 2.0, "bp")])
    close = 1 - smoothstep((t - (dur - 0.016)) / 0.008)
    env = (0.05 + 2.2 * p ** 3) * close
    tone = np.sin(phase_of(220.0 * 2 ** (p * 2.0))) * p ** 3 * 0.2 * close
    y = sw * env * 0.9 + np.vstack([kick + tone, kick + tone])
    return fade_edges(y, 0.0005, 0.005), 0


# ---------------------------------------------------------------------------
# SFX — experiencia
# ---------------------------------------------------------------------------

def _splash(ctx, dur, size=1.0, pre=0.0, tail=0.25):
    """Salpicadura: cachetazo de superficie + cuerpo de agua + corona de spray (todo con su pico en
    los primeros 5 ms), zambullida grave corta y un burbujeo que se apaga en `tail` s."""
    rng = ctx.rng
    out = _z(dur + pre)
    n = out.shape[1]
    m = ns(pre)
    nn = n - m
    t = tvec(nn)
    plunge = _fit(thump(115.0 * (1.1 - 0.1 * size), 60.0, 0.04 * size, 0.004, dur), nn) * 0.5 * size
    slap = bp(rng.standard_normal(nn), 500.0, 7000.0) * env_perc(nn, 0.0008, 0.008) * 1.2
    slap += tock(nn, 1200.0, 0.0013, 1.6) + tock(nn, 2800.0, 0.0008, 0.7)
    body_l = bp(rng.standard_normal(nn), 280.0, 4500.0) * env_perc(nn, 0.002, 0.04 * size)
    body_r = bp(rng.standard_normal(nn), 280.0, 4500.0) * env_perc(nn, 0.002, 0.04 * size)
    out[:, m:] += np.vstack([plunge + slap + body_l, plunge + slap + body_r])
    crown = env_perc(nn, 0.003, 0.08 * size)
    for ch in range(2):
        # gotitas densas y chicas: un impulso suelto grande corría la cresta fina 20 ms
        out[ch, m:] += (lp(hp(rng.standard_normal(nn), 3500.0), 11000.0) * 0.3
                        + crackle(nn, rng, 5000.0, 2500.0, 9000.0) * 0.25) * crown
    # el burbujeo entra de a poco (sin ataques sueltos que le roben la cresta al cachetazo)
    fade_b = smoothstep((t - 0.01) / 0.08) * np.exp(-np.maximum(t - 0.05, 0) / (tail * 0.45))
    out[:, m:] += fade_b * bubble_cloud(dur, rng, int(160 * size), 380.0, 2800.0,
                                        t_dist=lambda u: 0.02 + tail * u ** 1.7, tau_k=0.011, rise=(0.3, 1.1)) * 0.4
    out[:, m:] += fade_b * bubble_cloud(dur, rng, int(320 * size), 1800.0, 7500.0,
                                        t_dist=lambda u: 0.015 + tail * 0.8 * u ** 2.0, tau_k=0.003,
                                        rise=(0.4, 1.4)) * 0.2
    for _ in range(int(8 * size)):   # gotas que vuelven a caer
        at = rng.uniform(0.12, 0.12 + tail)
        _put(out, bubble(rng.uniform(900.0, 2600.0), 0.012, 0.8), pre + at, rng.uniform(0.06, 0.16),
             rng.uniform(-0.7, 0.7))
    return out


def splash_cut(cue, ctx):
    """Corte al iris de la pileta: splash con un burbujeo corto (0,25 s)."""
    out = _splash(ctx, 0.8, 1.0, tail=0.25)
    return fade_edges(out, 0.0003, 0.1), 0


def pop(cue, ctx):
    """«Pop» de palabra: blip afinado en el acorde (con armónicos, se lee en 1–4 kHz)."""
    rng = ctx.rng
    notes = chord_midis(ctx, cue["t"], 80, 3)    # arriba del Mi5 que canta el lead en ese momento
    m = notes[0] if cue["id"] == "exp.w2" else notes[min(1, len(notes) - 1)]
    f = float(mtof(m))
    n = ns(0.35)
    x = tuned_blip(f, n, rng, drop=1.0, tau=0.05, h2=0.35)
    x += _fit(glock(f * 2, 0.15), n) * 0.2
    x += snap(n, rng, 1500.0, 7000.0, 1.0)
    return pan(x, -0.15 if cue["id"] == "exp.w2" else 0.15) * 1.2, 0


def slide_splash(cue, ctx):
    """Bajada por el tobogán (agua que corre, ondulando) y ¡SPLASH! grande en el cue, con el
    cachetazo y la corona en su pico en los primeros 5 ms."""
    rng = ctx.rng
    pre = 0.5
    out = _splash(ctx, 1.0, 1.3, pre=pre, tail=0.25)
    n_pre = ns(pre)
    t = tvec(n_pre)
    p = t / pre
    fc = 900.0 + 2600.0 * p
    run = np.vstack([svf(rng.standard_normal(n_pre), fc, 2.5, "bp"), svf(rng.standard_normal(n_pre), fc * 1.05, 2.5, "bp")])
    ripple = 0.65 + 0.35 * np.sin(TWO_PI * (11.0 + 8.0 * p) * t)
    env = (0.1 + 0.6 * p ** 1.5) * (1 - smoothstep((t - (pre - 0.035)) / 0.02))
    run = pan_auto(run * ripple * env * 0.4, -0.6 + 0.6 * p)
    out[:, :n_pre] += run
    return fade_edges(out, 0.005, 0.1), n_pre


def whoosh_short(cue, ctx):
    """Whoosh corto con pico en el cue (anticipaciones y salidas). La cresta es el pico del propio
    whoosh; el «aire» quedó 12 dB más abajo, con pasa-bajos en 9 kHz y estirado a ~9 ms."""
    rng = ctx.rng
    pre = 0.14
    up = cue["id"] == "lines.out"
    x = whoosh(pre + 0.3, rng, pre, f_lo=400.0, f_peak=4200.0 if not up else 6000.0,
               f_end=1500.0 if not up else 5000.0, rise_pow=3.0, tau=0.04, pan0=-0.5, pan1=0.5)
    n = x.shape[1]
    t = tvec(n) - pre
    air = lp(hp(rng.standard_normal(n), 2500.0), 9000.0) * np.exp(-np.abs(t) / 0.009) * 0.38
    m = ns(pre)
    air[m:] += tock(n - m, 1900.0, 0.0012, 0.9)
    x += np.vstack([air, air])
    return x * 1.1, ns(pre)


def plate_cut(cue, ctx):
    """Flotador → plato: el plato de cerámica se apoya girando (clac con modos inarmónicos + toc de mesa)."""
    rng = ctx.rng
    pre = 0.18
    dur = pre + 0.9
    out = _z(dur)
    n = ns(dur - pre)
    t = tvec(n)
    x = np.zeros(n)
    for f, a, tau in ((1340.0, 0.55, 0.22), (2290.0, 0.4, 0.14), (3870.0, 0.28, 0.08), (5230.0, 0.2, 0.05)):
        x += a * np.sin(TWO_PI * f * t + rng.random()) * np.exp(-t / tau)
    x += _fit(thump(200.0, 130.0, 0.025, 0.003, 0.4), n) * 0.7
    x += bp(rng.standard_normal(n), 1500.0, 8000.0) * env_perc(n, 0.0004, 0.003) * 0.7
    x += tock(n, 2300.0, 0.0009, 1.4)
    x *= 1 - np.exp(-t / 0.0002)
    _put(out, np.vstack([x, x * 0.95]), pre)
    sw = whoosh(pre + 0.05, rng, pre - 0.01, f_lo=600.0, f_peak=3000.0, f_end=1500.0, rise_pow=2.0,
                tau=0.02, pan0=0.4, pan1=-0.1) * 0.3
    _put(out, sw, 0.0)
    return out, ns(pre)


def cloche_shimmer(cue, ctx):
    """Se levanta la campana plateada: «shiiing» metálico (parciales inarmónicos con batido), brillos
    afinados que suben y el aire de la campana que sale volando arriba a la derecha."""
    rng = ctx.rng
    dur = 1.6
    out = _z(dur)
    n = out.shape[1]
    t = tvec(n)
    metal = np.zeros((2, n))
    for _ in range(14):
        f = rng.uniform(1800.0, 9500.0)
        tau = rng.uniform(0.25, 0.9)
        a = rng.uniform(0.3, 1.0) * (2000.0 / f) ** 0.3
        for ch in range(2):
            metal[ch] += a * np.sin(TWO_PI * f * (1 + 0.0015 * ch) * t + rng.random() * 6) * np.exp(-t / tau)
    metal *= (1 - np.exp(-t / 0.0006)) / 5.0
    clink = bp(rng.standard_normal(n), 2500.0, 9000.0) * env_perc(n, 0.0004, 0.004) * 0.6
    clink += tock(n, 3100.0, 0.0008, 1.2)
    out += metal + np.vstack([clink, clink])
    for i, m in enumerate(chord_midis(ctx, cue["t"], 86, 5)):
        _put(out, glock(float(mtof(m)), 0.4), 0.05 + 0.04 * i, 0.16, 0.2 + 0.12 * i)
    sw = whoosh(0.6, rng, 0.12, f_lo=1500.0, f_peak=5000.0, f_end=3000.0, rise_pow=1.5, tau=0.18,
                pan0=0.0, pan1=0.85) * 0.25
    _put(out, sw, 0.02)
    return fade_edges(out, 0.0002, 0.2), 0


def pour(cue, ctx):
    """Se sirve vino: el chorro pega en la copa (cresta) y la resonancia sube a medida que se llena
    (gorgoteo irregular + burbujitas)."""
    rng = ctx.rng
    dur = 0.44
    out = _z(dur)
    n = out.shape[1]
    t = tvec(n)
    hit_ = bp(rng.standard_normal(n), 900.0, 7000.0) * env_perc(n, 0.001, 0.012) * 1.4
    hit_ += bp(rng.standard_normal(n), 700.0, 5000.0) * env_perc(n, 0.002, 0.03) * 0.5
    p = np.clip(t / 0.4, 0, 1)
    fc = 520.0 * (1500.0 / 520.0) ** p
    gurgle = 0.55 + 0.45 * smooth_noise(n, rng, 13.0)
    stream = svf(rng.standard_normal(n), fc, 5.0, "bp") * gurgle
    stream += svf(rng.standard_normal(n), fc * 2.1, 6.0, "bp") * 0.4 * gurgle
    s_env = np.clip(t / 0.03, 0, 1) * (1 - smoothstep((t - 0.33) / 0.09)) * 0.55
    mono = hit_ + stream * s_env
    out += pan(mono, -0.2)
    out += bubble_cloud(dur, rng, 90, 900.0, 3200.0, t_dist=lambda u: 0.03 + 0.33 * u, tau_k=0.006) * 0.16
    return fade_edges(out, 0.0003, 0.05), 0


def glass_clink(cue, ctx):
    """Chin-chin: dos copas de cristal con modos (1 : 2,32 : 3,86) afinados al acorde, batido entre ellas."""
    rng = ctx.rng
    dur = 1.8
    n = ns(dur)
    t = tvec(n)
    notes = chord_midis(ctx, cue["t"], 93, 2)
    out = np.zeros((2, n))
    for k, m in enumerate(notes):
        f = float(mtof(m)) * (1 + 0.002 * k)
        x = np.zeros(n)
        for ratio, a, tau in ((1.0, 1.0, 1.1), (2.32, 0.35, 0.45), (3.86, 0.14, 0.2)):
            if f * ratio < 0.4 * SR:
                ph0 = rng.random()
                # anillo + «strike» (el mismo modo con caída de 12 ms): el golpe queda arriba del anillo
                x += a * np.sin(TWO_PI * f * ratio * t + ph0) * (np.exp(-t / tau) + 1.4 * np.exp(-t / 0.012))
        x *= 1 + 0.04 * np.sin(TWO_PI * (2.5 + k) * t)
        out += pan(x, -0.3 + 0.6 * k)
    tick = lp(hp(rng.standard_normal(n), 3000.0), 9000.0) * env_perc(n, 0.0004, 0.004) * 1.4
    out += np.vstack([tick, tick])
    out *= (1 - np.exp(-t / 0.0002)) * 0.45
    return fade_edges(out, 0.0001, 0.2), 0


def roulette(cue, ctx):
    """Plato → ruleta: arrancón del giro (cresta) y la bolita que repiquetea sobre los trastes cada vez
    más lento, girando en el estéreo."""
    rng = ctx.rng
    dur = 1.4
    out = _z(dur)
    n = out.shape[1]
    t = tvec(n)
    spin = bp(rng.standard_normal(n), 900.0, 4500.0) * (0.6 + 0.4 * np.sin(TWO_PI * 28.0 * t)) * env_perc(n, 0.002, 0.25) * 0.5
    clack = bp(rng.standard_normal(n), 2000.0, 8000.0) * env_perc(n, 0.0005, 0.005) * 1.0
    clack += np.sin(TWO_PI * 3600.0 * t) * env_perc(n, 0.0003, 0.006) * 0.4
    out += pan(spin + clack, 0.0)
    rate = 22.0 * (8.0 / 22.0) ** (t / dur)
    ph = np.cumsum(rate) / SR
    hits = np.nonzero(np.diff(np.floor(ph)) > 0)[0]
    for h in hits:
        tt = h / SR
        if tt < 0.06:
            continue
        L = ns(0.02)
        tk = tvec(L)
        c = bp(rng.standard_normal(L), 2200.0, 7000.0) * np.exp(-tk / 0.0025)
        a = (1 - tt / dur) ** 1.2 * rng.uniform(0.35, 0.7)
        _put(out, c, tt, a, 0.6 * math.sin(TWO_PI * 1.6 * tt))
    rumble = lp(rng.standard_normal(n), 700.0) * (1 - t / dur) * 0.15
    out += np.vstack([rumble, rumble])
    return fade_edges(out, 0.0002, 0.1), 0


def chips_stack(cue, ctx):
    """Fichas de arcilla que caen sobre la pila (clac fuerte en el cue + rebotes que se asientan) y
    cartas que se abren en abanico (riffle de papel)."""
    rng = ctx.rng
    dur = 0.9
    out = _z(dur)

    def chip(a, f):
        L = ns(0.06)
        tk = tvec(L)
        c = svf(rng.standard_normal(L), f, 9.0, "bp") * np.exp(-tk / 0.006) * 2.0
        c += bp(rng.standard_normal(L), 2500.0, 9000.0) * env_perc(L, 0.0004, 0.002)
        return c * a

    times = [0.0, 0.042, 0.075, 0.1, 0.12, 0.136, 0.149, 0.16]
    for i, at in enumerate(times):
        _put(out, chip(1.0 if i == 0 else 0.55 * 0.82 ** i, rng.uniform(2800.0, 3800.0)), at, 1.0,
             -0.25 + rng.uniform(-0.1, 0.1))
    for k in range(10):
        at = 0.2 + k * 0.024
        L = ns(0.03)
        tk = tvec(L)
        flick = bp(rng.standard_normal(L), 1800.0, 7000.0) * np.exp(-tk / 0.004) * 0.3
        _put(out, flick, at, 1.0, 0.1 + 0.05 * k)
    return fade_edges(out, 0.0002, 0.05), 0


def whip_pan(cue, ctx):
    """Látigo de cámara: swish muy rápido con pico en el cue y un golpecito grave de peso.
    exp.show = paneo horizontal (izq→der); map.whip = hacia el sur (el tono cae)."""
    rng = ctx.rng
    pre = 0.13
    south = cue["id"] == "map.whip"
    if south:
        x = whoosh(pre + 0.35, rng, pre, f_lo=2500.0, f_peak=6000.0, f_end=500.0, rise_pow=3.0, tau=0.05,
                   q=2.2, pan0=0.15, pan1=-0.15)
    else:
        x = whoosh(pre + 0.3, rng, pre, f_lo=500.0, f_peak=5500.0, f_end=1800.0, rise_pow=3.0, tau=0.045,
                   q=2.0, pan0=-0.9, pan1=0.9)
    n = x.shape[1]
    w = np.zeros(n)
    th = thump(110.0, 70.0, 0.03, 0.003, 0.3) * 0.4 + tock(ns(0.3), 1500.0, 0.0012, 0.8)
    w[ns(pre):ns(pre) + len(th)] += th[:n - ns(pre)]
    x += np.vstack([w, w])
    return x * 1.05, ns(pre)


def confetti_pop(cue, ctx):
    """Cañón de papelitos: ¡pop! de corcho (agudo, sin grave que se esconda debajo del bombo) y una
    lluvia de papel crujiente con brillitos afinados en el acorde. Banda propia: 1–9 kHz."""
    rng = ctx.rng
    dur = 1.5
    out = _z(dur)
    n = out.shape[1]
    t = tvec(n)
    popx = bp(rng.standard_normal(n), 900.0, 7000.0) * env_perc(n, 0.0006, 0.007) * 1.4
    popx += np.sin(phase_of(780.0 * (1 + 0.8 * np.exp(-t / 0.004)))) * env_perc(n, 0.0004, 0.014) * 0.7
    out += np.vstack([popx, popx])
    rain_env = np.clip((t - 0.02) / 0.06, 0, 1) * np.exp(-np.maximum(t - 0.08, 0) / 0.42)
    for ch in range(2):
        rain = crackle(n, rng, 650.0, 2200.0, 9000.0) + 0.25 * bp(rng.standard_normal(n), 3000.0, 8000.0)
        out[ch] += rain * rain_env * 0.8                    # +6 dB respecto de la v1
    for i, m in enumerate(chord_midis(ctx, cue["t"], 88, 6)):
        _put(out, glock(float(mtof(m)), 0.25), 0.05 + 0.07 * i + rng.uniform(0, 0.03), 0.16,
             rng.uniform(-0.8, 0.8))
    out = width(out, 1.2)
    return fade_edges(out, 0.0002, 0.1), 0


def sun_swell(cue, ctx):
    """Reflector → SOL: un acorde cálido invertido que crece y florece en el cue (núcleo dorado)."""
    rng = ctx.rng
    pre = 0.45
    dur = pre + 1.6
    out = _z(dur)
    n = out.shape[1]
    notes = chord_midis(ctx, cue["t"], 76, 4)
    rev = np.zeros(ns(pre))
    tr = tvec(len(rev))
    for m in notes:
        rev += np.sin(TWO_PI * float(mtof(m)) * tr + rng.random())
    rev *= (tr / pre) ** 2.6 * 0.18
    rev += svf(rng.standard_normal(len(rev)), 1200.0 + 3000.0 * tr / pre, 1.0, "bp") * (tr / pre) ** 3 * 0.25
    rev = rev * (1 - smoothstep((tr - (pre - 0.02)) / 0.02))
    out[:, :len(rev)] += pan(rev, 0.0)
    m0 = ns(pre)
    nn = n - m0
    t = tvec(nn)
    bloom = np.zeros(nn)
    for m in notes:
        bloom += np.sin(TWO_PI * float(mtof(m)) * t + rng.random()) * np.exp(-t / 0.7)
    bloom *= (1 - np.exp(-t / 0.002)) * 0.2
    fwoom = lp(rng.standard_normal(nn), 2600.0) * env_perc(nn, 0.0015, 0.04) * 0.9
    fwoom += _fit(thump(95.0, 60.0, 0.05, 0.004, 1.0), nn) * 0.35
    out[:, m0:] += np.vstack([bloom + fwoom, bloom * 0.9 + fwoom])
    return fade_edges(width(out, 1.2), 0.002, 0.2), m0


def whoosh_down(cue, ctx):
    """El sol se encoge y baja: «zip» en el cue y un barrido que cae (banda y tono) hacia el pin."""
    rng = ctx.rng
    dur = 0.5
    n = ns(dur)
    t = tvec(n)
    p = t / dur
    fc = 4500.0 * (280.0 / 4500.0) ** (p ** 0.8)
    x = np.vstack([svf(rng.standard_normal(n), fc, 1.8, "bp"), svf(rng.standard_normal(n), fc * 1.04, 1.8, "bp")])
    env = env_perc(n, 0.002, 0.2) * 0.8 + 0.25 * (1 - p)
    env *= 1 - smoothstep((t - (dur - 0.06)) / 0.05)
    tone = np.sin(phase_of(1200.0 * (300.0 / 1200.0) ** p)) * (1 - p) * 0.12 * env
    zip_ = lp(hp(rng.standard_normal(n), 2500.0), 9000.0) * env_perc(n, 0.0005, 0.006) * 0.5
    zip_ += tock(n, 2400.0, 0.001, 0.9)
    x = x * env + np.vstack([tone + zip_, tone + zip_])
    return fade_edges(x * 1.1, 0.0003, 0.01), 0


# ---------------------------------------------------------------------------
# SFX — destinos y navieras
# ---------------------------------------------------------------------------

def pin_land(cue, ctx):
    """El sol aterriza como PIN: golpe con squash + «boing» elástico afinado + anillo de ping."""
    rng = ctx.rng
    dur = 1.0
    n = ns(dur)
    t = tvec(n)
    x = _fit(thump(170.0, 80.0, 0.04, 0.004, dur), n) * 0.6
    f = 220.0 * (1 + 0.1 * np.exp(-t / 0.14) * np.sin(TWO_PI * 11.0 * t))
    x += np.sin(phase_of(f)) * env_perc(n, 0.001, 0.22) * 0.45
    x += bp(rng.standard_normal(n), 400.0, 4000.0) * env_perc(n, 0.0008, 0.012) * 1.0
    x += snap(n, rng, 1500.0, 7000.0, 1.0)
    x += tock(n, 1500.0, 0.0012, 1.3)
    x += _fit(glock(1760.0, 0.4), n) * 0.12
    return np.vstack([x, x]), 0


def route_start(cue, ctx):
    """Arranca la ruta: «blip» ascendente brillante + trazo de marcador que sigue dibujando."""
    rng = ctx.rng
    dur = 0.7
    n = ns(dur)
    t = tvec(n)
    f = 700.0 * (1 + 1.6 * (1 - np.exp(-t / 0.03)))
    blip = np.sin(phase_of(f)) * env_perc(n, 0.001, 0.08) * 0.6
    blip += np.sin(2 * phase_of(f) + 0.3) * env_perc(n, 0.001, 0.05) * 0.2
    draw = bp(rng.standard_normal(n), 1500.0, 6000.0) * (0.6 + 0.4 * np.sin(TWO_PI * 24.0 * t)) ** 2
    draw *= np.clip(t / 0.03, 0, 1) * np.exp(-t / 0.3) * 0.25
    click = snap(n, rng, 2500.0, 8000.0, 0.8) + tock(n, 2200.0, 0.0009, 0.9)
    x = blip + draw + click
    return pan_auto(np.vstack([x, x]) * 0.707, -0.3 + 0.5 * t / dur), 0


def pin_pop(cue, ctx):
    """Pin que cae en un destino: pop corto + campanita afinada (La5 + `pitch` semitonos). Es la
    nota del beat: la marimba se corre de ese lugar."""
    rng = ctx.rng
    f = float(mtof(81 + cue.get("pitch", 0)))
    dur = 1.4
    n = ns(dur)
    t = tvec(n)
    x = _fit(glock(f, 0.55), n) * 0.5
    x *= 0.6 + 0.4 * np.exp(-t / 0.01)
    x += tuned_blip(f * 0.5, n, rng, drop=1.2, tau=0.035, fast=0.005, h2=0.5) * 0.6
    x += snap(n, rng, 2000.0, 8000.0, 1.0)
    p = {0: -0.35, 2: 0.0, 4: -0.5, 5: 0.45, 7: 0.6, 9: 0.0}.get(cue.get("pitch", 0), 0.0)
    return pan(x, p) * 1.15, 0


def route_whoosh(cue, ctx):
    """La ruta cruza el Atlántico en arco: whoosh largo que viaja de izquierda (América) a derecha
    (Europa), con el pico en el cue y caída Doppler después."""
    rng = ctx.rng
    pre = 0.28
    x = whoosh(pre + 0.6, rng, pre, f_lo=500.0, f_peak=3200.0, f_end=700.0, rise_pow=2.0, tau=0.16, q=1.4,
               pan0=-0.85, pan1=0.85)
    n = x.shape[1]
    t = tvec(n) - pre
    tone = np.sin(phase_of(880.0 * 2 ** (-np.clip(t, 0, None) * 1.5))) * np.exp(-np.abs(t) / 0.12) * 0.08
    tp = np.maximum(t, 0)
    accent = bp(rng.standard_normal(n), 400.0, 4000.0) * (t >= 0) * (1 - np.exp(-tp / 0.0008)) * np.exp(-tp / 0.012) * 0.5
    accent += (t >= 0) * tock(n, 1300.0, 0.0014, 1.0)[np.clip(np.arange(n) - ns(pre), 0, n - 1)]
    x += np.vstack([tone + accent, tone + accent])
    return x * 1.2, ns(pre)


def network_glow(cue, ctx):
    """Toda la red de rutas brilla: florece un acorde etéreo con zumbido eléctrico suave y un arpegio
    de destellos que sube."""
    rng = ctx.rng
    dur = 1.8
    out = _z(dur)
    n = out.shape[1]
    t = tvec(n)
    notes = chord_midis(ctx, cue["t"], 81, 4)
    pad_ = np.zeros(n)
    for m in notes:
        f = float(mtof(m))
        pad_ += np.sin(TWO_PI * f * t + rng.random()) + 0.3 * np.sin(TWO_PI * 2 * f * t)
    pad_ *= env_perc(n, 0.004, 0.7) * (1 + 0.15 * np.sin(TWO_PI * 12.0 * t)) * 0.12
    zap = bp(rng.standard_normal(n), 2500.0, 9000.0) * env_perc(n, 0.001, 0.015) * 0.5
    zap += tock(n, 2600.0, 0.0009, 0.8)
    out += np.vstack([pad_ + zap, pad_ * 0.95 + zap])
    for i, m in enumerate(chord_midis(ctx, cue["t"], 88, 6)):
        _put(out, glock(float(mtof(m)), 0.35), 0.03 + i * 0.045, 0.13, -0.6 + 0.24 * i)
    return fade_edges(width(out, 1.2), 0.0003, 0.2), 0


def chip_pop(cue, ctx):
    """Chip de naviera: blip redondo afinado (La5 + `pitch`) con armónicos y un clic de plástico
    en 2–5 kHz. Banda propia: el stab de la música entra media semicorchea después."""
    rng = ctx.rng
    f = float(mtof(81 + cue.get("pitch", 0)))
    n = ns(0.6)
    x = tuned_blip(f, n, rng, drop=0.6, tau=0.09, fast=0.006, h2=0.4, h3=0.15) * 0.75
    x += bp(rng.standard_normal(n), 2000.0, 5500.0) * env_perc(n, 0.0005, 0.005) * 0.6
    p = -0.4 + 0.8 * (cue.get("pitch", 0) / 9.0)
    return pan(x, p) * 1.1, 0


# ---------------------------------------------------------------------------
# SFX — valor
# ---------------------------------------------------------------------------

def suitcase_drop(cue, ctx):
    """Cae la valija rígida: clac del casco y golpe del cuerpo (los dos en los primeros ms), traqueteo
    de herrajes y polvito."""
    rng = ctx.rng
    dur = 0.9
    out = _z(dur)
    n = out.shape[1]
    x = _fit(thump(100.0, 60.0, 0.05, 0.004, dur), n) * 0.6
    x += bp(rng.standard_normal(n), 250.0, 1400.0) * env_perc(n, 0.001, 0.025) * 1.2
    x += tock(n, 900.0, 0.0018, 1.5) + tock(n, 2400.0, 0.0009, 0.6)
    x += bp(rng.standard_normal(n), 1500.0, 7000.0) * env_perc(n, 0.0005, 0.006) * 0.5
    out += np.vstack([x, x])
    for at in (0.028, 0.051, 0.07):
        L = ns(0.02)
        tk = tvec(L)
        c = svf(rng.standard_normal(L), rng.uniform(3200.0, 4800.0), 7.0, "bp") * np.exp(-tk / 0.003) * 0.6
        _put(out, c, at, 1.0, rng.uniform(-0.4, 0.4))
    dust = np.vstack([lp(pink(n, rng), 2000.0), lp(pink(n, rng), 2000.0)]) * env_perc(n, 0.012, 0.18) * 0.07
    out += dust
    return fade_edges(out, 0.0002, 0.1), 0


def sticker_slap(cue, ctx):
    """Calco que se pega de un golpe: palmada plástica (1,5–5 kHz) con un «thwip» afinado en el
    acorde (cada calco una nota más arriba) y el asentamiento del papel."""
    rng = ctx.rng
    k = {"val.s1": 0, "val.s2": 1, "val.s3": 2}.get(cue["id"], 0)
    dur = 0.5
    n = ns(dur)
    t = tvec(n)
    x = bp(rng.standard_normal(n), 1200.0 + 150 * k, 5500.0 + 400 * k) * env_perc(n, 0.0005, 0.012) * 1.3
    note = chord_midis(ctx, cue["t"], 79 + 2 * k, 1)[0]
    x += tuned_blip(float(mtof(note)), n, rng, drop=0.35, tau=0.05, fast=0.004, h2=0.3) * 0.65
    x += np.sin(phase_of(170.0 + 15 * k + 60.0 * np.exp(-t / 0.006))) * env_perc(n, 0.0005, 0.018) * 0.3
    settle = crackle(n, rng, 700.0, 2000.0, 8000.0) * np.clip((t - 0.02) / 0.01, 0, 1) * np.exp(-t / 0.05) * 0.3
    x += settle
    return pan(x, (-0.25, 0.1, 0.3)[k]) * 1.25, 0


def ticket_whoosh(cue, ctx):
    """Entra la tarjeta de embarque: swish de papel que llega y aterriza (flap) en el cue."""
    rng = ctx.rng
    pre = 0.22
    x = whoosh(pre + 0.3, rng, pre, f_lo=700.0, f_peak=4000.0, f_end=2000.0, rise_pow=2.2, tau=0.04, q=1.3,
               pan0=0.7, pan1=0.0) * 0.6
    n = x.shape[1]
    t = tvec(n) - pre
    tp = np.maximum(t, 0)
    flap = bp(rng.standard_normal(n), 900.0, 5500.0) * np.exp(-tp / 0.018) * (1 - np.exp(-tp / 0.0006)) * (t >= 0) * 1.0
    flap += np.sin(TWO_PI * 140.0 * tp) * np.exp(-tp / 0.02) * (t >= 0) * 0.3
    m = ns(pre)
    flap[m:] += tock(n - m, 1300.0, 0.0012, 1.1)
    x += np.vstack([flap, flap])
    return x, ns(pre)


def stamp(cue, ctx):
    """Sello de goma «DESDE USD 355»: ¡TUNK! seco con cuerpo de madera; el golpe medio manda en el
    ataque y el grave es corto (sin chasquido agudo de 1 ms)."""
    rng = ctx.rng
    dur = 0.8
    n = ns(dur)
    x = _fit(thump(130.0, 65.0, 0.05, 0.004, dur), n) * 0.75
    x += bp(rng.standard_normal(n), 180.0, 1200.0) * env_perc(n, 0.0008, 0.045) * 1.4
    x += lp(hp(rng.standard_normal(n), 1800.0), 8000.0) * env_perc(n, 0.0005, 0.005) * 0.35
    x += tock(n, 800.0, 0.0018, 1.6) + tock(n, 2000.0, 0.001, 0.6)
    sq = np.zeros(n)
    d = ns(0.006)
    sq[d:] = bp(rng.standard_normal(n - d), 900.0, 3000.0) * env_perc(n - d, 0.002, 0.04) * 0.2
    x += sq
    return np.vstack([x, x]) * 1.1, 0


def ticket_tear(cue, ctx):
    """Se arranca el talón por el troquel: rrrip crujiente (cresta en el cue, centrado en 3–6 kHz,
    por encima del shaker) y el talón que sale girando."""
    rng = ctx.rng
    pre = 0.06
    dur = pre + 0.45
    out = _z(dur)
    n = out.shape[1]
    t = tvec(n) - pre
    rip = crackle(n, rng, 3200.0, 2500.0, 7000.0) + 0.5 * bp(rng.standard_normal(n), 2800.0, 6500.0)
    env = np.where(t < 0, np.clip(1 + t / pre, 0, 1) ** 2.5, np.exp(-np.maximum(t, 0) / 0.05))
    tear = bp(rng.standard_normal(n), 2500.0, 7000.0) * np.exp(-np.maximum(t, 0) / 0.008) * (t >= 0) * 1.0
    out += pan(rip * env * 0.9 + tear, 0.1)
    sw = whoosh(0.3, rng, 0.08, f_lo=1500.0, f_peak=4500.0, f_end=2500.0, rise_pow=1.5, tau=0.08,
                pan0=0.1, pan1=0.8) * 0.25
    _put(out, sw, pre + 0.03)
    return fade_edges(out, 0.003, 0.05), ns(pre)


def hit_soft(cue, ctx):
    """Golpe suave para «ASESORAMIENTO…»: bombo de fieltro + maza afinada al acorde."""
    rng = ctx.rng
    dur = 1.0
    n = ns(dur)
    x = _fit(thump(115.0, 65.0, 0.04, 0.004, dur), n) * 0.45
    m = chord_midis(ctx, cue["t"], 76, 1)[0]
    f = float(mtof(m))
    x += tuned_blip(f, n, rng, drop=0.2, tau=0.25, fast=0.01, h2=0.35, h3=0.12) * 0.45
    x += lp(rng.standard_normal(n), 3500.0) * env_perc(n, 0.0008, 0.012) * 1.0
    x += tock(n, 1100.0, 0.0015, 1.3)
    return np.vstack([x, x]), 0


def bubble_pop(cue, ctx):
    """Globo de chat: «blup» redondo que sube (b1 pregunta, b2 respuesta con su check «ding»)."""
    rng = ctx.rng
    second = cue["id"] == "val.b2"
    notes = chord_midis(ctx, cue["t"], 83, 3)
    f = float(mtof(notes[1] if second else notes[0]))
    dur = 0.8
    n = ns(dur)
    t = tvec(n)
    fr = f * (0.62 + 0.38 * (1 - np.exp(-t / 0.012)))
    x = np.sin(phase_of(fr)) * pluck_env(n, 0.07, 0.008, 0.5, 0.0008) * 0.7
    x += snap(n, rng, 1500.0, 7000.0, 1.0) + tock(n, 2000.0, 0.0009, 0.6)
    if second:
        d = ns(0.07)
        g = glock(float(mtof(notes[2])), 0.3)
        x[d:d + len(g)] += g[:n - d] * 0.25
    return pan(x, 0.3 if second else -0.3) * 1.2, 0


# ---------------------------------------------------------------------------
# SFX — cierre
# ---------------------------------------------------------------------------

def wave_logo(cue, ctx):
    """Segunda OLA (rima con el drop): mismo vocabulario de agua, algo más liviana y con brillo de marca."""
    x, a = drop_wave(cue, ctx, scale=0.85, sweep=(0.55, -0.55))
    for i, m in enumerate(chord_midis(ctx, cue["t"], 86, 4)):
        _put(x, glock(float(mtof(m)), 0.45), 0.12 + 0.05 * i, 0.12, -0.4 + 0.25 * i)
    return x, a


def shimmer(cue, ctx):
    """Barrido de luz sobre el logo: un «ting» nítido en el cue y enseguida un glissando de
    campanitas que sube con un brillo de aire (entran 35–45 ms después para no empastar la cresta)."""
    rng = ctx.rng
    dur = 1.6
    out = _z(dur)
    n = out.shape[1]
    t = tvec(n)
    notes = chord_midis(ctx, cue["t"], 81, 8)
    first = _fit(glock(float(mtof(notes[0])), 0.3), n) * (0.45 + 0.55 * np.exp(-t / 0.006))
    out += pan(first * 0.8 + snap(n, rng, 3000.0, 9000.0, 1.0) + tock(n, 3300.0, 0.0008, 0.6), -0.4)
    for i, m in enumerate(notes[1:]):
        _put(out, glock(float(mtof(m)), 0.3), 0.045 + i * 0.032, 0.16 * (1 - 0.05 * i), -0.5 + 0.17 * i)
    td = np.maximum(t - 0.035, 0)
    shine = np.vstack([svf(rng.standard_normal(n), 4000.0 + 6000.0 * np.clip(td / 0.4, 0, 1), 2.0, "bp"),
                       svf(rng.standard_normal(n), 4200.0 + 6000.0 * np.clip(td / 0.4, 0, 1), 2.0, "bp")])
    shine *= smoothstep(td / 0.03) * np.exp(-td / 0.18) * 0.14 * (t > 0.035)
    out += shine
    return fade_edges(out, 0.0002, 0.2), 0


def type_tick(cue, ctx):
    """Se tipea «primecruceros.com.ar»: ráfaga de teclas (la primera es la cresta)."""
    rng = ctx.rng
    dur = 0.75
    out = _z(dur)
    at = 0.0
    for k in range(14):
        L = ns(0.04)
        tk = tvec(L)
        c = bp(rng.standard_normal(L), 1500.0, 7000.0) * env_perc(L, 0.0004, 0.002) * 1.4
        c += np.sin(TWO_PI * rng.uniform(1100.0, 1400.0) * tk) * np.exp(-tk / 0.006) * 0.45
        c *= 1 - np.exp(-tk / 0.0002)
        a = 1.0 if k == 0 else rng.uniform(0.35, 0.6)
        _put(out, c, at, a, rng.uniform(-0.2, 0.2))
        at += rng.uniform(0.03, 0.045)
    return fade_edges(out, 0.0001, 0.02), 0


def button_pop(cue, ctx):
    """Pop del botón de WhatsApp (el CTA: el SFX chico más audible de la pieza). Un «blop» afinado
    una octava más arriba que en la v1, con armónicos y una chispa en 1,5–4 kHz; nada en 80 Hz,
    donde pega el bombo del mismo beat."""
    rng = ctx.rng
    dur = 1.0
    n = ns(dur)
    notes = chord_midis(ctx, cue["t"], 81, 3)
    f = float(mtof(notes[0]))
    x = tuned_blip(f, n, rng, drop=-0.35, tau=0.1, fast=0.008, h2=0.45, h3=0.2) * 0.8
    x += bp(rng.standard_normal(n), 1500.0, 4500.0) * env_perc(n, 0.0005, 0.007) * 0.8
    out = np.vstack([x, x])
    for i, m in enumerate(notes[1:]):
        _put(out, glock(float(mtof(m + 12)), 0.35), 0.03 + 0.04 * i, 0.22, -0.3 + 0.6 * i)
    return out * 1.1, 0


def final_hit(cue, ctx):
    """Golpe final: succión invertida que culmina en el cue, impacto (crack medio + bum corto) y cola
    brillante afinada en La mayor que se apaga sola."""
    rng = ctx.rng
    pre = 0.35
    dur = pre + 1.6
    out = _z(dur)
    m0 = ns(pre)
    tr = tvec(m0)
    suck = np.vstack([lp(hp(rng.standard_normal(m0), 2500.0), 10000.0), lp(hp(rng.standard_normal(m0), 2500.0), 10000.0)])
    suck *= (tr / pre) ** 3 * 0.35 * (1 - smoothstep((tr - (pre - 0.012)) / 0.01))
    out[:, :m0] += suck
    nn = out.shape[1] - m0
    x = _fit(thump(85.0, 45.0, 0.09, 0.004, dur - pre), nn) * 0.6
    x += bp(rng.standard_normal(nn), 200.0, 3500.0) * env_perc(nn, 0.0008, 0.035) * 1.5
    x += lp(hp(rng.standard_normal(nn), 3000.0), 9000.0) * env_perc(nn, 0.0005, 0.008) * 0.35
    x += tock(nn, 1000.0, 0.0016, 1.6) + tock(nn, 2400.0, 0.0009, 0.6)
    out[:, m0:] += np.vstack([x, x])
    # destellos afinados (La add9): son lo que se oye del SFX por encima del crash y del impacto
    for i, m in enumerate(chord_midis(ctx, cue["t"], 81, 5)):
        _put(out, glock(float(mtof(m)), 0.6), pre + 0.01 + 0.03 * i, 0.22, -0.6 + 0.3 * i)
    return fade_edges(out, 0.003, 0.3), m0


# ---------------------------------------------------------------------------
# Registro y render
# ---------------------------------------------------------------------------

SFX = {
    "office_tick": office_tick, "page_flip": page_flip, "type_hit": type_hit, "drip": drip,
    "wave_rise": wave_rise, "drop_wave": drop_wave, "hit": hit, "ship_horn": ship_horn,
    "whoosh_in": whoosh_in, "splash_cut": splash_cut, "pop": pop, "slide_splash": slide_splash,
    "whoosh_short": whoosh_short, "plate_cut": plate_cut, "cloche_shimmer": cloche_shimmer, "pour": pour,
    "glass_clink": glass_clink, "roulette": roulette, "chips_stack": chips_stack, "whip_pan": whip_pan,
    "confetti_pop": confetti_pop, "sun_swell": sun_swell, "whoosh_down": whoosh_down, "pin_land": pin_land,
    "route_start": route_start, "pin_pop": pin_pop, "route_whoosh": route_whoosh,
    "network_glow": network_glow, "chip_pop": chip_pop, "suitcase_drop": suitcase_drop,
    "sticker_slap": sticker_slap, "ticket_whoosh": ticket_whoosh, "stamp": stamp,
    "ticket_tear": ticket_tear, "hit_soft": hit_soft, "bubble_pop": bubble_pop, "wave_logo": wave_logo,
    "shimmer": shimmer, "type_tick": type_tick, "button_pop": button_pop, "final_hit": final_hit,
}

# Ganancia de cada SFX en la mezcla (dB). Regla (PLAN §10): por debajo de la música pero perceptibles.
# Medido en analyze.py: ningún SFX pasa a la música en loudness K de 150 ms (los brindis y el sol que se
# encoge llegaban a +0,2 … +1,2 LU), todos ganan en algún tercio de octava por ≥ 3 dB, el agua grande no
# tapa al hook y el CTA (button_pop) es el más audible de los chicos.
SFX_GAIN_DB = {
    # las dos olas y el golpe final van bajos: caen junto con el bombo grande, el crash y el impacto, y
    # con más nivel su golpe era la mitad del pico que el master tenía que limitar (5,6 dB en el drop).
    # En esos tres downbeats el golpe lo da la música; el SFX aporta el rugido, la espuma y los brillos
    "office_tick": -8, "page_flip": -8, "type_hit": -13, "drip": -10, "wave_rise": -10, "drop_wave": -11,
    "hit": -6, "ship_horn": -8, "whoosh_in": -13, "splash_cut": -10.5, "pop": -6, "slide_splash": -11,
    "whoosh_short": -10, "plate_cut": -11, "cloche_shimmer": -11, "pour": -11, "glass_clink": -11.5,
    "roulette": -10, "chips_stack": -8, "whip_pan": -9, "confetti_pop": -3, "sun_swell": -11,
    "whoosh_down": -13.5, "pin_land": -9, "route_start": -9, "pin_pop": -7, "route_whoosh": -11,
    "network_glow": -10, "chip_pop": -6, "suitcase_drop": -7, "sticker_slap": -4, "ticket_whoosh": -5,
    "stamp": -8, "ticket_tear": -6, "hit_soft": -7, "bubble_pop": -7, "wave_logo": -10, "shimmer": -7,
    "type_tick": -4, "button_pop": -3, "final_hit": -8.5,
}

SYNC_RADIUS = 0.025     # s alrededor del anchor de diseño donde se buscan las crestas


class SfxContext:
    def __init__(self, song, rng):
        self.song = song
        self.rng = rng


def calibrate_anchor(x: np.ndarray, a: int, radius: float = SYNC_RADIUS) -> tuple[int, int, int]:
    """Anchor = punto medio entre la cresta fina (|Hilbert| 2 ms) y la de cuerpo (RMS 10 ms) de banda
    completa, buscadas cerca del anchor de diseño. Devuelve (anchor, fina, cuerpo)."""
    r = ns(radius)
    fine, body = sync_crests(x, a - r, a + r + 1, fine_env(x), body_env(x))
    return int(round(0.5 * (fine + body))), fine, body


def render_cue(cue: dict, song, rng) -> tuple[np.ndarray, int]:
    """Renderiza el SFX de un cue y devuelve (x, anchor) con el anchor recalibrado a la cresta medida."""
    fn = SFX[cue["sfx"]]
    x, a = fn(cue, SfxContext(song, rng))
    x = np.ascontiguousarray(np.asarray(x, dtype=np.float64))
    if x.ndim == 1:
        x = np.vstack([x, x])
    a, _, _ = calibrate_anchor(x, a)
    return x, a
