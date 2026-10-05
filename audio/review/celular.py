"""
celular.py — ¿el «beat claro» sobrevive en un parlante de celular? (la promo es para redes)

Simula un parlante de teléfono (pasa-altos 4.º orden en 450 Hz + pasa-bajos en 9 kHz) y mide:
- cuánto loudness K se pierde por sección (lo que «desaparece» en el celular),
- el perfil por semicorchea (envolvente plegada) del master filtrado en c3–c6: ¿los beats 1 y 3
  (bombo solo) se marcan como golpe o como hueco del sidechain?
- la energía del bombo solo por arriba de 450 Hz (su «click») vs la del clap.

    python audio/review/celular.py
"""
from __future__ import annotations

import numpy as np
from scipy.ndimage import uniform_filter1d

from comun import BAR, BEAT, CUES, SR, S, STEP, lufs_bloque, master, stems
from dsp import hp, lp


def telefono(x):
    return lp(hp(x, 450.0, order=4), 9000.0, order=2)


def main():
    x = master()
    xt = telefono(x)
    print("sección        LUFS full  LUFS celular  pérdida")
    for s in CUES["sections"]:
        a, b = s["from"], s["to"]
        lf = lufs_bloque(x[:, S(a):S(b)])
        lt = lufs_bloque(xt[:, S(a):S(b)])
        print(f"  {s['id']:13s} {lf:7.2f}   {lt:7.2f}     {lt - lf:+5.1f} dB")

    e = np.sqrt(uniform_filter1d((xt ** 2).sum(axis=0), int(0.01 * SR)))
    prof = np.zeros(16)
    for bar in (3, 4, 5, 6):
        for k in range(16):
            a = S(bar * BAR + k * STEP)
            prof[k] += e[a:a + int(0.06 * SR)].max()
    prof = 20 * np.log10(prof / prof.max())
    print("\nperfil del master 'celular' por semicorchea (pico de 60 ms, dB rel. máx), c3–c6:")
    print("  " + " ".join(f"{k + 1:>5d}" for k in range(16)))
    print("  " + " ".join(f"{v:5.1f}" for v in prof))
    print("  (beats: 1=semicorchea 1, 2=5 (clap), 3=9, 4=13 (clap); contratiempos 3,7,11,15 = hat abierto)")

    st = stems()
    dt = telefono(st["drums"])
    ed = np.sqrt(uniform_filter1d((dt ** 2).sum(axis=0), int(0.01 * SR)))
    b1 = np.mean([ed[S(bar * BAR):S(bar * BAR + 0.06)].max() for bar in range(3, 7)])
    b3 = np.mean([ed[S(bar * BAR + 2 * BEAT):S(bar * BAR + 2 * BEAT + 0.06)].max() for bar in range(3, 7)])
    b2 = np.mean([ed[S(bar * BAR + BEAT):S(bar * BAR + BEAT + 0.06)].max() for bar in range(3, 7)])
    print(f"\nbatería en el celular: beat 3 (bombo) vs beat 2 (bombo+clap): {20 * np.log10(b3 / b2):+.1f} dB;"
          f" beat 1 (bombo+crash) vs beat 2: {20 * np.log10(b1 / b2):+.1f} dB")


if __name__ == "__main__":
    main()
