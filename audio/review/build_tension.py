"""
build_tension.py — ¿el gancho (c0–c1) y el pre-cierre (c13) construyen tensión de verdad?

Por cada 1/8 de compás mide: loudness K momentáneo (400 ms), centroide espectral, y el peso de cada
stem (fx = riser/redoble, wall = música detrás de la pared, sfx). Compara el build del gancho con
el de c13 (el que lleva a la segunda ola).

    python audio/review/build_tension.py
"""
from __future__ import annotations

import numpy as np

from comun import BAR, SR, S, lufs_bloque, master, stems


def centroide(x):
    m = x.mean(axis=0)
    sp = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2
    f = np.fft.rfftfreq(len(m), 1 / SR)
    sel = (f > 40) & (f < 16000)
    return float((f[sel] * sp[sel]).sum() / sp[sel].sum())


def recorrer(x, st, t0, t1, paso):
    print("    t      LK(400ms)  centroide |  wall    fx    sfx   drums  music")
    t = t0
    while t < t1 - 1e-6:
        a, b = max(0.0, t + paso - 0.4), t + paso
        lk = lufs_bloque(x[:, S(a):S(b)])
        c = centroide(x[:, S(t):S(t + paso)])
        fila = [lufs_bloque(st[k][:, S(a):S(b)]) for k in ("wall", "fx", "sfx", "drums", "music")]
        print(f"  {t + paso:6.3f}   {lk:6.1f}    {c:6.0f} Hz | " + " ".join(f"{max(v, -99):5.1f}" for v in fila))
        t += paso


def main():
    x = master()
    st = stems()
    print("== GANCHO (build 1) ==")
    recorrer(x, st, 0.0, 3.75, BAR / 8)
    print("\n== c13 (build 2, hacia la segunda ola) ==")
    recorrer(x, st, 13 * BAR, 14 * BAR + BAR / 4, BAR / 8)


if __name__ == "__main__":
    main()
