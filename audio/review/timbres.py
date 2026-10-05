"""
timbres.py — radiografía de los timbres clave (sin oído, con números) + recortes para escuchar.

1. Lead (flauta de pan + vocal chop): amplitud de los armónicos 1–12 de una nota seca, cuánto pesa
   la fundamental y si el «vocal» (F2/F3) se distingue de una flauta senoidal.
2. Bocina del barco: espectro, tiempo de ataque y largo efectivo.
3. Bombo: fundamental, decaimiento y relación pegada/cuerpo.
4. Recortes WAV del master para que un humano escuche: build→drop, cada corte, navieras, cierre.

    python audio/review/timbres.py
"""
from __future__ import annotations

import os

import numpy as np

from comun import SALIDA, SR, S, master
from dsp import mtof, rng_of, write_wav


def armonicos(x, f0, n=12):
    seg = x[int(0.08 * SR):int(0.30 * SR)]
    sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
    f = np.fft.rfftfreq(len(seg), 1 / SR)
    out = []
    for h in range(1, n + 1):
        sel = (f > h * f0 * 0.97) & (f < h * f0 * 1.03)
        out.append(sp[sel].max() if sel.any() else 0.0)
    out = np.array(out)
    return 20 * np.log10(out / out[0] + 1e-12)


def main():
    import instruments as I
    # --- lead seco, C#5 con vocal «a» (la nota más repetida del hook) ---
    m = 73
    f0 = float(mtof(m))
    for nom, kw in (("lead completo", {}), ("solo flauta", dict(chop=0.0)), ("solo vocal chop", dict(flute=0.0))):
        x = I.lead_note(m, 0.375, 1.0, rng_of("rev", 1), vowel="a", vowel_to="a", **kw)
        h = armonicos(x, f0)
        print(f"{nom:16s} H1..H12 (dB rel. H1): " + " ".join(f"{v:5.1f}" for v in h))
    x_full = I.lead_note(m, 0.375, 1.0, rng_of("rev", 1), vowel="a", vowel_to="a")
    x_fl = I.lead_note(m, 0.375, 1.0, rng_of("rev", 1), vowel="a", vowel_to="a", chop=0.0)
    x_ch = I.lead_note(m, 0.375, 1.0, rng_of("rev", 1), vowel="a", vowel_to="a", flute=0.0)
    e = lambda v: float((v ** 2).mean())
    print(f"energía flauta / vocal chop: {10 * np.log10(e(x_fl) / e(x_ch)):+.1f} dB "
          f"(mezcla real: lead = 0,75·flauta + 0,55·chop)")
    # centroide del lead: ¿«brilla» como un vocal chop (1,5–3 kHz) o es una flauta oscura?
    sp = np.abs(np.fft.rfft(x_full * np.hanning(len(x_full)))) ** 2
    f = np.fft.rfftfreq(len(x_full), 1 / SR)
    print(f"centroide del lead: {(f * sp).sum() / sp.sum():.0f} Hz   (f0 = {f0:.0f} Hz)")
    sel = (f > 1500) & (f < 4000)
    print(f"energía 1,5–4 kHz / total: {10 * np.log10(sp[sel].sum() / sp.sum()):.1f} dB")

    # --- bocina ---
    from arrangement import build_song
    from sfx import SfxContext, ship_horn
    song = build_song()
    hx, _ = ship_horn({"id": "reveal.horn", "t": 4.6875}, SfxContext(song, rng_of("rev-horn")))
    hm = hx.mean(axis=0)
    envh = np.abs(hm)
    from scipy.ndimage import maximum_filter1d
    envh = maximum_filter1d(envh, int(0.01 * SR))
    pk = envh.max()
    t90 = np.nonzero(envh > 0.5 * pk)[0]
    print(f"\nbocina: ataque a −6 dB en {t90[0] / SR * 1000:.0f} ms, largo sobre −6 dB {(t90[-1] - t90[0]) / SR:.2f} s, "
          f"largo sobre −20 dB {(np.nonzero(envh > 0.1 * pk)[0][-1]) / SR:.2f} s")
    sp = np.abs(np.fft.rfft(hm[:int(1.0 * SR)])) ** 2
    f = np.fft.rfftfreq(int(1.0 * SR), 1 / SR)
    for a, b in ((60, 250), (250, 1000), (1000, 3000), (3000, 12000)):
        sel = (f >= a) & (f < b)
        print(f"  bocina {a}-{b} Hz: {10 * np.log10(sp[sel].sum() / sp.sum()):6.1f} dB")

    # --- bombo ---
    k = I.kick(1.0, rng=rng_of("kick"))
    envk = np.abs(k)
    envk = maximum_filter1d(envk, int(0.005 * SR))
    t20 = np.nonzero(envk > 0.1 * envk.max())[0][-1] / SR
    spk = np.abs(np.fft.rfft(k)) ** 2
    fk = np.fft.rfftfreq(len(k), 1 / SR)
    lo = spk[(fk < 120)].sum()
    mid = spk[(fk >= 1000) & (fk < 5000)].sum()
    print(f"\nbombo: cae a −20 dB en {t20 * 1000:.0f} ms; energía 1–5 kHz vs <120 Hz: {10 * np.log10(mid / lo):.1f} dB")

    # --- recortes para escuchar ---
    x = master()
    recortes = {"01_build_drop": (2.8, 6.2), "02_experiencia_cortes": (7.0, 11.8), "03_destinos_pines": (13.0, 17.5),
                "04_navieras": (18.3, 21.2), "05_valor_build_cierre": (24.0, 27.2), "06_final": (27.5, 30.0)}
    for nom, (a, b) in recortes.items():
        write_wav(os.path.join(SALIDA, f"{nom}.wav"), x[:, S(a):S(b)], bits=24, dither_seed=None)
    print("\nrecortes en", SALIDA)


if __name__ == "__main__":
    main()
