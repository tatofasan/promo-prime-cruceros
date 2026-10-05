"""
espectros.py — espectrogramas por tramo, separando MÚSICA (suma de stems musicales) y SFX, para ver
quién ocupa qué banda en el drop, la experiencia, las navieras y el cierre.

    python audio/review/espectros.py   → audio/review/out/espectros_tramos.png
"""
from __future__ import annotations

import os

import numpy as np

from comun import SALIDA, SR, S, stems

TRAMOS = [(3.4, 5.7, "drop (3,75)"), (7.3, 11.4, "experiencia: dinner/show"), (18.5, 21.0, "navieras → valor"),
          (25.4, 30.0, "pre-cierre → cierre → final")]


def logspec(x, nfft=2048, hop=240):
    from scipy.signal import stft
    m = x.mean(axis=0)
    f, t, Z = stft(m, SR, nperseg=nfft, noverlap=nfft - hop)
    return f, t, 20 * np.log10(np.abs(Z) + 1e-9)


def main():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    st = stems()
    mus = sum(st[k] for k in ("drums", "bass", "music", "lead", "wall", "fx"))
    fig, axs = plt.subplots(3, len(TRAMOS), figsize=(22, 11))
    for j, (a, b, nom) in enumerate(TRAMOS):
        for i, (lab, sig) in enumerate((("música", mus), ("lead", st["lead"]), ("sfx", st["sfx"]))):
            f, t, Z = logspec(sig[:, S(a):S(b)])
            ax = axs[i, j]
            ax.pcolormesh(t + a, f, Z, vmin=-110, vmax=-30, cmap="magma", shading="auto")
            ax.set_yscale("log")
            ax.set_ylim(40, 16000)
            ax.set_title(f"{lab} — {nom}", fontsize=9)
    fig.tight_layout()
    p = os.path.join(SALIDA, "espectros_tramos.png")
    fig.savefig(p, dpi=80)
    print("PNG:", p)


if __name__ == "__main__":
    main()
