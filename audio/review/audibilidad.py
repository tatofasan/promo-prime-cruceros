"""
audibilidad.py — para los SFX que en loudness quedan > 12 dB debajo de la música: ¿hay alguna banda de
tercio de octava donde el SFX le gane a la música en los primeros 120 ms? (si no hay ninguna, está
enmascarado de verdad; si gana en alguna banda aguda, se oye como «tic» pero no como evento).

    python audio/review/audibilidad.py
"""
from __future__ import annotations

import numpy as np

from comun import CUES, SR, S, stems

IDS = ["exp.confetti", "map.route", "map.uy", "map.br", "map.car", "map.eu", "map.dxb", "map.ant", "lines.in",
       "lines.c3", "lines.c5", "val.s1", "val.s2", "val.s3", "val.pass", "val.tear", "val.b1", "val.b2",
       "close.url", "close.cta", "exp.pour", "exp.chips"]


def tercios(seg):
    m = seg.mean(axis=0)
    sp = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2
    f = np.fft.rfftfreq(len(m), 1 / SR)
    cs = 1000.0 * 2 ** (np.arange(-12, 13) / 3.0)
    return cs, np.array([sp[(f >= c / 2 ** (1 / 6)) & (f < c * 2 ** (1 / 6))].sum() for c in cs])


def main():
    st = stems()
    mus = sum(st[k] for k in ("drums", "bass", "music", "lead", "wall", "fx"))
    for c in CUES["cues"]:
        if c["id"] not in IDS:
            continue
        a, b = S(c["t"]), S(c["t"] + 0.12)
        cs, es = tercios(st["sfx"][:, a:b])
        _, em = tercios(mus[:, a:b])
        snr = 10 * np.log10(es / (em + 1e-20) + 1e-20)
        i = int(np.argmax(snr))
        gana = [f"{cs[k]:.0f}" for k in range(len(cs)) if snr[k] > 0]
        print(f"{c['id']:13s} mejor banda {cs[i]:6.0f} Hz: {snr[i]:+5.1f} dB   bandas donde gana: {gana}")


if __name__ == "__main__":
    main()
