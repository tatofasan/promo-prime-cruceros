"""
plot_review.py — gráficos propios de la revisión: panorama (onda + loudness + cues), zoom del gap/drop,
zoom del final y espectrograma del build.

    python audio/review/plot_review.py → audio/review/out/{overview,gap_drop,end,build_spec}.png
"""
from __future__ import annotations

import os
import sys

import matplotlib
import numpy as np
from scipy import signal

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rv_common import OUT, ROOT, SR, db, load_cues, loudness_curve, read_wav  # noqa: E402


def main():
    cues = load_cues()
    x, _ = read_wav(os.path.join(ROOT, "public", "audio", "promo.wav"))
    t = np.arange(x.shape[1]) / SR

    # --- panorama ---
    fig, ax = plt.subplots(3, 1, figsize=(20, 9), sharex=True)
    d = 96
    ax[0].plot(t[::d], x[0, ::d], lw=0.3, color="#2a6")
    ax[0].plot(t[::d], -x[1, ::d], lw=0.3, color="#26a")
    ax[0].set_ylabel("L / −R")
    tm, mo = loudness_curve(x, 0.4, 0.05)
    ts, st = loudness_curve(x, 3.0, 0.1)
    ax[1].plot(tm, mo, lw=0.8, label="momentáneo")
    ax[1].plot(ts, st, lw=1.2, label="corto plazo")
    ax[1].axhline(-14, color="k", lw=0.5, ls="--")
    ax[1].set_ylim(-40, -8)
    ax[1].legend(fontsize=8)
    f, tt, Z = signal.spectrogram(x.sum(0), SR, nperseg=2048, noverlap=1536)
    ax[2].pcolormesh(tt, f, 10 * np.log10(Z + 1e-14), shading="auto", vmin=-110, vmax=-30, cmap="magma")
    ax[2].set_yscale("symlog", linthresh=200)
    ax[2].set_ylim(20, 20000)
    for c in cues["cues"]:
        for a in ax[:2]:
            a.axvline(c["t"], color="r", lw=0.3, alpha=0.6)
    for s in cues["sections"]:
        for a in ax:
            a.axvline(s["from"], color="k", lw=1.0)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "overview.png"), dpi=80)
    plt.close(fig)

    # --- gap / drop ---
    a, b = int(3.55 * SR), int(3.80 * SR)
    fig, ax = plt.subplots(2, 1, figsize=(14, 6), sharex=True)
    ax[0].plot(t[a:b], x[0, a:b], lw=0.4)
    ax[0].plot(t[a:b], x[1, a:b], lw=0.4)
    ax[1].plot(t[a:b], db(np.abs(x[:, a:b]).max(0)), lw=0.4)
    ax[1].set_ylim(-100, 0)
    for v in (3.6328125, 3.75):
        for aa in ax:
            aa.axvline(v, color="r", lw=0.8)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "gap_drop.png"), dpi=90)
    plt.close(fig)

    # --- final ---
    a = int(27.9 * SR)
    fig, ax = plt.subplots(2, 1, figsize=(14, 6), sharex=True)
    ax[0].plot(t[a:], x[0, a:], lw=0.3)
    ax[1].plot(t[a:], db(np.abs(x[:, a:]).max(0)), lw=0.3)
    ax[1].set_ylim(-120, 0)
    ax[1].axvline(29.35, color="r", lw=0.6)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "end.png"), dpi=90)
    plt.close(fig)


if __name__ == "__main__":
    main()
