"""
bombeo.py — medir el sidechain (el «pump» del tropical house) y el groove.

Para cada stem pliega la envolvente RMS (5 ms) sobre la fase del beat (64 casilleros por negra) en
los compases indicados y reporta:
- profundidad del bombeo (dB entre el mínimo justo después del bombo y el máximo del beat),
- en qué fracción del beat se recupera a −1 dB del máximo,
- el perfil de 16 semicorcheas del bombo/bajo para ver el groove.

    python audio/review/bombeo.py
"""
from __future__ import annotations

import os

import numpy as np

from comun import BAR, BEAT, SALIDA, SR, S, master, stems

CASILLEROS = 64


def envolvente(x, win=0.005):
    from scipy.ndimage import uniform_filter1d
    e = (x ** 2).sum(axis=0)
    return np.sqrt(uniform_filter1d(e, max(1, int(win * SR))))


def plegar(env, compases):
    """Promedio de la envolvente por fase del beat sobre los compases dados."""
    acc = np.zeros(CASILLEROS)
    cnt = 0
    for bar in compases:
        for b in range(4):
            t0 = bar * BAR + b * BEAT
            idx = S(t0) + (np.arange(CASILLEROS) * BEAT / CASILLEROS * SR).astype(int)
            acc += env[idx]
            cnt += 1
    return acc / cnt


def main():
    st = stems()
    x = master()
    bloques = {"drop c2": [2], "exp c3-c6": [3, 4, 5, 6], "dest c7-c9": [7, 8, 9], "valor c11-c12": [11, 12],
               "cierre c14": [14]}
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, axs = plt.subplots(1, len(bloques), figsize=(18, 4), sharey=True)
    for ax, (nom, cps) in zip(axs, bloques.items()):
        print(f"\n== {nom} ==")
        for k in ("music", "bass", "lead", "drums"):
            env = envolvente(st[k])
            p = plegar(env, cps)
            pdb = 20 * np.log10(p / p.max() + 1e-9)
            imin = int(np.argmin(pdb[:CASILLEROS // 2]))
            rec = np.nonzero(pdb[imin:] > -1.0)[0]
            rec_frac = (imin + rec[0]) / CASILLEROS if rec.size else float("nan")
            print(f"  {k:6s} profundidad {pdb.min():6.1f} dB  (mín en {imin / CASILLEROS:.2f} beat, "
                  f"vuelve a −1 dB en {rec_frac:.2f} beat = {rec_frac * BEAT * 1000:.0f} ms)")
            ax.plot(np.arange(CASILLEROS) / CASILLEROS, pdb, label=k)
        envm = envolvente(x)
        pm = plegar(envm, cps)
        pmdb = 20 * np.log10(pm / pm.max() + 1e-9)
        ax.plot(np.arange(CASILLEROS) / CASILLEROS, pmdb, "k", lw=2, label="master")
        print(f"  master profundidad {pmdb.min():6.1f} dB")
        ax.set_title(nom)
        ax.set_xlabel("fase del beat")
        ax.grid(alpha=0.3)
    axs[0].set_ylabel("dB rel. máx")
    axs[0].legend()
    fig.tight_layout()
    fig.savefig(os.path.join(SALIDA, "bombeo.png"), dpi=100)
    print("\nPNG:", os.path.join(SALIDA, "bombeo.png"))

    # perfil de 16 semicorcheas del bajo (energía < 150 Hz) y del bombo: ¿el bajo respira o se pelea?
    from dsp import lp
    low_b = lp(st["bass"], 150.0, order=4)
    low_d = lp(st["drums"], 150.0, order=4)
    eb, ed = envolvente(low_b, 0.01), envolvente(low_d, 0.01)
    print("\nperfil por semicorchea en c3–c6 (dB rel. máx, energía < 150 Hz):")
    for nom, e in (("bombo", ed), ("bajo", eb)):
        prof = np.zeros(16)
        for bar in (3, 4, 5, 6):
            for k in range(16):
                a = S(bar * BAR + k * BEAT / 4)
                prof[k] += e[a:a + int(BEAT / 4 * SR)].mean()
        prof = 20 * np.log10(prof / prof.max())
        print(f"  {nom:6s} " + " ".join(f"{v:5.1f}" for v in prof))


if __name__ == "__main__":
    main()
