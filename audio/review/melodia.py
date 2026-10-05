"""
melodia.py — extraer el hook del stem del lead (YIN) y revisar la armonía (croma por beat).

1. Pitch del lead por YIN cada 5 ms → nota por semicorchea en los compases con hook.
   Métricas del hook: ámbito, intervalos, notas repetidas, saltos (lo que lo hace «pegadizo»).
2. Croma por beat del master (de 110 Hz a 4 kHz): proporción de energía en notas del acorde vs. fuera
   del acorde, para detectar choques (SFX afinados, bocina, pines) contra la progresión.

    python audio/review/melodia.py
"""
from __future__ import annotations

import os

import numpy as np

from comun import BAR, BEAT, SALIDA, SR, S, STEP, master, stems

NOTAS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def nombre(m):
    m = int(round(m))
    return f"{NOTAS[m % 12]}{m // 12 - 1}"


def yin(x, fmin=180.0, fmax=1400.0, win=0.03, hop=0.005, thr=0.15):
    """YIN clásico (diferencia acumulada normalizada) sobre mono. Devuelve (t, f0 o nan, aperiodicidad)."""
    W = int(win * SR)
    H = int(hop * SR)
    tmin, tmax = int(SR / fmax), int(SR / fmin)
    ts, fs, ap = [], [], []
    for a in range(0, len(x) - W - tmax, H):
        fr = x[a:a + W + tmax]
        # función diferencia por FFT
        d = np.zeros(tmax + 1)
        x0 = fr[:W]
        e0 = (x0 ** 2).sum()
        if e0 < 1e-9:
            ts.append(a / SR)
            fs.append(np.nan)
            ap.append(1.0)
            continue
        cs = np.concatenate([[0], np.cumsum(fr ** 2)])
        corr = np.correlate(fr[:W + tmax], x0, mode="valid")[:tmax + 1]
        for tau in range(1, tmax + 1):
            et = cs[tau + W] - cs[tau]
            d[tau] = e0 + et - 2 * corr[tau]
        cmnd = np.ones(tmax + 1)
        cmnd[1:] = d[1:] * np.arange(1, tmax + 1) / np.maximum(np.cumsum(d[1:]), 1e-12)
        cand = np.nonzero(cmnd[tmin:] < thr)[0]
        if cand.size:
            tau = cand[0] + tmin
            while tau + 1 <= tmax and cmnd[tau + 1] < cmnd[tau]:
                tau += 1
            # interpolación parabólica
            if 1 <= tau < tmax:
                a1, b1, c1 = cmnd[tau - 1], cmnd[tau], cmnd[tau + 1]
                den = a1 - 2 * b1 + c1
                tau = tau + (0.5 * (a1 - c1) / den if abs(den) > 1e-12 else 0.0)
            fs.append(SR / tau)
            ap.append(float(cmnd[int(round(tau))]))
        else:
            fs.append(np.nan)
            ap.append(float(cmnd[tmin:].min()))
        ts.append(a / SR)
    return np.array(ts), np.array(fs), np.array(ap)


def hook():
    st = stems()
    lead = st["lead"].mean(axis=0)
    print("== HOOK extraído del stem del lead (nota por semicorchea; '.' = sin nota/eco) ==")
    todas = {}
    for bar in (2, 3, 4, 5, 6, 14, 15):
        a = S(bar * BAR)
        b = S((bar + 1) * BAR)
        t, f, ap = yin(lead[a:b])
        midi = 69 + 12 * np.log2(f / 440.0)
        fila = []
        for k in range(16):
            sel = (t >= k * STEP + 0.02) & (t < (k + 1) * STEP) & (ap < 0.12)
            if sel.sum() >= 3:
                m = np.nanmedian(midi[sel])
                fila.append(nombre(m))
                todas.setdefault(bar, []).append((k, m))
            else:
                fila.append(".")
        print(f"  c{bar:<2d} " + " ".join(f"{s:>4s}" for s in fila))
    # afinación: desvío medio en cents respecto del semitono más cercano
    devs = [100 * (m - round(m)) for v in todas.values() for _, m in v]
    print(f"  desvío de afinación (mediana |cents|): {np.median(np.abs(devs)):.1f}")


def croma():
    x = master().mean(axis=0)
    from arrangement import CHORDS, build_song
    song = build_song()
    print("\n== Croma por beat (110 Hz–4 kHz): % de energía fuera del acorde (solo > 30 %) ==")
    malos = []
    for bar in range(16):
        for b in range(4):
            t0 = bar * BAR + b * BEAT
            seg = x[S(t0):S(t0 + BEAT)]
            sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
            f = np.fft.rfftfreq(len(seg), 1 / SR)
            sel = (f >= 110) & (f <= 4000)
            pc = (np.round(12 * np.log2(f[sel] / 440.0)) + 9) % 12
            ch = np.zeros(12)
            np.add.at(ch, pc.astype(int), sp[sel])
            ch /= ch.sum()
            nombre_ac = song.chord_at(t0 + 1e-3)
            tonos = set(CHORDS[nombre_ac]["tones"])
            fuera = sum(ch[i] for i in range(12) if i not in tonos)
            top = np.argsort(ch)[::-1][:3]
            if fuera > 0.30:
                malos.append((t0, nombre_ac, fuera, [NOTAS[i] for i in top]))
                print(f"  {t0:6.3f}s c{bar}b{b + 1} acorde {nombre_ac:6s} fuera {100 * fuera:4.0f}%  "
                      f"dominantes {[NOTAS[i] for i in top]}")
    if not malos:
        print("  (ninguno)")


if __name__ == "__main__":
    hook()
    croma()
