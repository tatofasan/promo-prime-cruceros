"""
dinamica.py — ¿el master le come la pegada al drop? y ¿el final se apaga solo o lo apagan?

- Reducción de ganancia del pegamento + limitador: envolvente (10 ms) del master / suma de stems
  (los stems salen antes del compresor de pegamento y del limitador, con la misma ganancia).
- PLR (pico / loudness) por compás: cuánto «aire» tienen los golpes.
- Cola final 28,125–30: nivel cada 100 ms en el master y en la suma de stems (¿llega a −40 dB solo,
  o el fundido de build.py la corta mientras todavía suena?).

    python audio/review/dinamica.py
"""
from __future__ import annotations

import numpy as np
from scipy.ndimage import uniform_filter1d

from comun import BAR, SR, S, lufs_bloque, master, stems


def env(x, win=0.01):
    e = (x ** 2).sum(axis=0)
    return np.sqrt(np.maximum(uniform_filter1d(e, int(win * SR)), 1e-20))


def main():
    x = master()
    st = stems()
    suma = sum(st.values())
    gr = 20 * np.log10(env(x) / env(suma))
    print("compás  GR media  GR máx (dB)   PLR master (pico−LUFS)")
    for bar in range(16):
        a, b = S(bar * BAR), S((bar + 1) * BAR)
        g = gr[a:b]
        seg = x[:, a:b]
        plr = 20 * np.log10(np.abs(seg).max()) - lufs_bloque(seg)
        print(f"c{bar:<5d} {g.mean():+6.1f}   {g.min():+6.1f}        {plr:5.1f} dB")
    a = S(3.75)
    print("\nGR en el drop (cada 25 ms desde 3,75):",
          " ".join(f"{gr[a + S(0.025 * k)]:+.1f}" for k in range(12)))

    print("\nCola final (dBFS RMS de 100 ms): master | suma de stems sin fundido")
    for k in range(int((30.0 - 28.1) / 0.1)):
        t0 = 28.1 + 0.1 * k
        u, v = S(t0), S(t0 + 0.1)
        m = 10 * np.log10((x[:, u:v] ** 2).mean() + 1e-20)
        s = 10 * np.log10((suma[:, u:v] ** 2).mean() + 1e-20)
        print(f"  {t0:5.2f}s  {m:6.1f}  | {s:6.1f}")


if __name__ == "__main__":
    main()
