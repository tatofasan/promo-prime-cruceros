"""
sfx_vs_musica.py — ¿cada SFX se oye (y no tapa)? Medida perceptual, no de cresta.

Para cada cue: loudness K de 150 ms desde el cue en el stem sfx y en la suma de stems musicales.
- relación sfx − música (dB): < −12 dB → se pierde; > 0 dB → el SFX le pasa por encima a la música.
- además, en la banda del lead (400–3000 Hz) durante los compases con hook: cuánto del espectro del
  lead queda tapado por los SFX (relación lead / sfx en esa banda por semicorchea).

    python audio/review/sfx_vs_musica.py
"""
from __future__ import annotations

import numpy as np

from comun import BAR, CUES, S, STEP, master, stems
from dsp import bp, k_weight


def lk(x, t0, dur=0.15):
    seg = x[:, S(t0):S(t0 + dur)]
    y = k_weight(seg) ** 2
    return float(-0.691 + 10 * np.log10(y.sum(axis=0).mean() + 1e-20))


def main():
    st = stems()
    musica = sum(st[k] for k in ("drums", "bass", "music", "lead", "wall", "fx"))
    print("cue              sfx              sfx(LK)  música(LK)  rel")
    perdidos, encima = [], []
    for c in CUES["cues"]:
        if c["sfx"] == "silence":
            continue
        a, m = lk(st["sfx"], c["t"]), lk(musica, c["t"])
        r = a - m
        marca = "  <-- se pierde" if r < -12 else ("  <-- encima de la música" if r > 0 else "")
        if r < -12:
            perdidos.append(c["id"])
        if r > 0:
            encima.append(c["id"])
        print(f"{c['id']:16s} {c['sfx']:15s} {a:7.1f}  {m:8.1f}  {r:+6.1f}{marca}")
    print("\nse pierden (< −12 dB):", perdidos)
    print("encima de la música (> 0 dB):", encima)

    # --- enmascaramiento del hook por los SFX en la banda del lead ---
    lead_b = bp(st["lead"], 400.0, 3000.0, order=2)
    sfx_b = bp(st["sfx"], 400.0, 3000.0, order=2)
    resto_b = bp(sum(st[k] for k in ("drums", "bass", "music", "fx")), 400.0, 3000.0, order=2)
    print("\nlead vs sfx y vs resto en 400–3000 Hz, por compás con hook (dB, energía):")
    for bar in (2, 3, 4, 5, 6, 14):
        a, b = S(bar * BAR), S((bar + 1) * BAR)
        el = (lead_b[:, a:b] ** 2).mean()
        es = (sfx_b[:, a:b] ** 2).mean()
        er = (resto_b[:, a:b] ** 2).mean()
        # semicorcheas donde el sfx supera al lead en esa banda
        peor = 0
        for k in range(16):
            u, v = S(bar * BAR + k * STEP), S(bar * BAR + (k + 1) * STEP)
            if (sfx_b[:, u:v] ** 2).mean() > (lead_b[:, u:v] ** 2).mean():
                peor += 1
        print(f"  c{bar:<2d} lead−sfx {10 * np.log10(el / es):+5.1f} dB   lead−resto {10 * np.log10(el / er):+5.1f} dB"
              f"   semicorcheas con sfx > lead: {peor}/16")


if __name__ == "__main__":
    main()
