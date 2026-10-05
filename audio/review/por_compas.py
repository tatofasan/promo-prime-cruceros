"""
por_compas.py — «escuchar» la forma del tema compás por compás.

- loudness K (sin compuertas) del master y de cada stem por compás,
- balance de bandas del master por compás (dB relativos al total),
- espectro promedio de largo plazo (LTAS) por sección en tercios de octava, comparado con una
  inclinación de referencia de −4,5 dB/oct (aprox. la de una mezcla pop/EDM comercial),
- centroide espectral por compás (proxy del «brillo»).

    python audio/review/por_compas.py
"""
from __future__ import annotations

import json
import os

import numpy as np

from comun import BAR, CUES, SALIDA, SR, lufs_bloque, master, stems, tramo

BANDAS = (("sub<60", 20, 60), ("low60-250", 60, 250), ("lowmid250-2k", 250, 2000),
          ("pres2-6k", 2000, 6000), ("air6k+", 6000, 20000))


def espectro(x):
    m = x.mean(axis=0)
    w = np.hanning(len(m))
    sp = np.abs(np.fft.rfft(m * w)) ** 2
    f = np.fft.rfftfreq(len(m), 1 / SR)
    return f, sp


def bandas(x):
    f, sp = espectro(x)
    tot = sp[(f >= 20) & (f < 20000)].sum()
    return {k: float(10 * np.log10(sp[(f >= a) & (f < b)].sum() / tot + 1e-20)) for k, a, b in BANDAS}


def centroide(x):
    f, sp = espectro(x)
    sel = (f >= 40) & (f < 16000)
    return float((f[sel] * sp[sel]).sum() / sp[sel].sum())


def tercios(x):
    """Nivel por tercio de octava (dB, energía por banda) de 31,5 Hz a 16 kHz."""
    f, sp = espectro(x)
    cs = 1000.0 * 2 ** (np.arange(-15, 13) / 3.0)
    out = []
    for c in cs:
        a, b = c / 2 ** (1 / 6), c * 2 ** (1 / 6)
        out.append(10 * np.log10(sp[(f >= a) & (f < b)].sum() + 1e-20))
    return cs, np.array(out)


def main():
    x = master()
    st = stems()
    filas = []
    print("compás  t0      LUFS   | drums  bass   music  lead   wall   fx     sfx   | centroide | sub  low  lmid pres air")
    for bar in range(16):
        t0, t1 = bar * BAR, (bar + 1) * BAR
        seg = tramo(x, t0, t1)
        fila = dict(bar=bar, t0=t0, lufs=lufs_bloque(seg), cent=centroide(seg), bands=bandas(seg),
                    stems={k: lufs_bloque(tramo(v, t0, t1)) for k, v in st.items()})
        filas.append(fila)
        s = fila["stems"]
        b = fila["bands"]
        print(f"c{bar:<5d} {t0:6.3f}  {fila['lufs']:6.2f} | " +
              " ".join(f"{max(s[k], -99):6.1f}" for k in ("drums", "bass", "music", "lead", "wall", "fx", "sfx")) +
              f" | {fila['cent']:7.0f} Hz | " + " ".join(f"{b[k]:5.1f}" for k, _, _ in BANDAS))

    # medio compás: los cortes que no caen en el compás (18,75 / 22,5 / 24,375 ya caen en compás)
    print("\nLTAS por sección (tercios de octava, normalizado a 1 kHz) vs referencia −4,5 dB/oct:")
    secciones = {s["id"]: (s["from"], s["to"]) for s in CUES["sections"]}
    ltas = {}
    for sid, (a, b) in secciones.items():
        cs, lv = tercios(tramo(x, a, b))
        ref_1k = lv[np.argmin(np.abs(cs - 1000))]
        rel = lv - ref_1k
        ref = -4.5 * np.log2(cs / 1000.0)
        ltas[sid] = dict(cs=cs.tolist(), rel=rel.tolist(), dev=(rel - ref).tolist())
        marcas = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 12500]
        txt = []
        for mk in marcas:
            i = int(np.argmin(np.abs(cs - mk)))
            txt.append(f"{mk:>6g}:{rel[i] - ref[i]:+5.1f}")
        print(f"  {sid:13s} " + " ".join(txt))

    with open(os.path.join(SALIDA, "por_compas.json"), "w", encoding="utf-8") as fh:
        json.dump(dict(bars=filas, ltas=ltas), fh, indent=1)

    # --- gráfico de LTAS ---
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(11, 5))
    for sid, d in ltas.items():
        ax.semilogx(d["cs"], d["rel"], label=sid, lw=1.6)
    cs = np.array(ltas["reveal"]["cs"])
    ax.semilogx(cs, -4.5 * np.log2(cs / 1000.0), "k--", lw=1.2, label="ref −4,5 dB/oct")
    ax.set_xlabel("Hz")
    ax.set_ylabel("dB (rel. 1 kHz)")
    ax.set_title("LTAS por sección (tercios de octava)")
    ax.grid(True, which="both", alpha=0.3)
    ax.legend()
    fig.tight_layout()
    fig.savefig(os.path.join(SALIDA, "ltas.png"), dpi=110)
    print("\nPNG:", os.path.join(SALIDA, "ltas.png"))


if __name__ == "__main__":
    main()
