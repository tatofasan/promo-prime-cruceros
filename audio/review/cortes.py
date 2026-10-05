"""
cortes.py — ¿la MÚSICA marca los cortes de escena? (no solo los SFX)

Para cada corte compara la energía de los primeros 150 ms después del corte con la de los mismos
150 ms después del beat 3 de los dos compases anteriores (bombo solo, sin clap) y, aparte,
contra los beats con clap. Lo hace:
- en la suma de stems musicales (drums+bass+music+lead+wall+fx), banda ancha y > 2 kHz,
- en el stem sfx y en el master,
- y mira si hay algo que «aspire» hacia el corte (energía de fx en los 400 ms previos).
Un corte bien marcado por la música suele tener ≥ +3 dB en > 2 kHz (crash, stab, fill).

    python audio/review/cortes.py
"""
from __future__ import annotations

import numpy as np

from comun import BEAT, S, master, stems

CORTES = [(5.625, "pool"), (7.5, "dinner"), (9.375, "show"), (11.25, "sunset"), (13.125, "map"),
          (18.75, "navieras"), (20.625, "valor/valija"), (22.5, "tarjeta"), (24.375, "asesoramiento"),
          (26.25, "cierre/ola"), (28.125, "golpe final")]


def energia(x, t0, dur=0.15):
    seg = x[:, S(t0):S(t0 + dur)]
    return float((seg ** 2).mean())


def main():
    from dsp import hp
    st = stems()
    musica = sum(st[k] for k in ("drums", "bass", "music", "lead", "wall", "fx"))
    musica_hi = hp(musica, 2000.0, order=4)
    x = master()
    sfx = st["sfx"]
    print("corte    escena          música(banda)  música(>2k)   sfx(rel.mús)  master   pre-fx(400ms)")
    for t, nom in CORTES:
        def rel(sig):
            # referencia: el beat 3 de los dos compases anteriores (bombo solo, sin clap)
            ref = np.mean([energia(sig, t - k * BEAT) for k in (2, 6)])
            return 10 * np.log10(energia(sig, t) / (ref + 1e-20) + 1e-20)

        def rel_clap(sig):
            # contra los beats 2 y 4 del compás anterior (bombo + clap): ¿el corte pega más que un clap?
            ref = np.mean([energia(sig, t - k * BEAT) for k in (1, 3)])
            return 10 * np.log10(energia(sig, t) / (ref + 1e-20) + 1e-20)
        m_b = rel(musica)
        m_h = rel(musica_hi)
        ms = rel(x)
        mc = rel_clap(musica_hi)
        sfx_vs_mus = 10 * np.log10(energia(sfx, t) / (energia(musica, t) + 1e-20) + 1e-20)
        pre = 10 * np.log10(energia(st["fx"], t - 0.4, 0.4) / (energia(musica, t - 0.4, 0.4) + 1e-20) + 1e-20)
        print(f"{t:7.3f}  {nom:14s}  {m_b:+6.1f} dB      {m_h:+6.1f} dB     {sfx_vs_mus:+6.1f} dB    {ms:+5.1f} dB  "
              f"{pre:+6.1f} dB   vs clap(>2k) {mc:+5.1f} dB")


if __name__ == "__main__":
    main()
