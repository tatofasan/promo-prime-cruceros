"""
check_dynamics.py — ¿cuánto comprime el master y dónde? ¿los SFX se escuchan?

1) Reducción de ganancia del master: master / (suma de stems), con envolventes RMS de 5 ms. La suma de
   stems ya trae la ganancia de loudness (README), así que el cociente es la acción del compresor de
   pegamento + limitador. Se reporta el máximo global y alrededor de cada cue.
2) Perceptibilidad de los SFX: por tercio de octava, SFX vs. resto de la mezcla en [cue, cue+80 ms].
   Si en ninguna banda el SFX supera al resto, es probable que quede enmascarado.
3) Chasquidos de los SFX: pico de la banda > 6 kHz y su duración por encima de −20 dB del pico.

    python audio/review/check_dynamics.py → audio/review/out/dynamics.json + gr.png
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rv_common import AUDIO, OUT, ROOT, SR, butter, db, load_cues, read_wav, rms_env  # noqa: E402

STEMS = ["drums", "bass", "music", "lead", "wall", "fx", "sfx"]


def S(t):
    return max(0, int(round(t * SR)))


def third_octave_levels(x, a, b):
    """Energía por tercio de octava (FFT) de x[:, a:b] (suma de canales). Devuelve (fc, dB)."""
    seg = x[:, a:b] * np.hanning(b - a)
    sp = (np.abs(np.fft.rfft(seg, 8192, axis=1)) ** 2).sum(0)
    f = np.fft.rfftfreq(8192, 1 / SR)
    fcs = 1000 * 2 ** (np.arange(-17, 13) / 3)   # 20 Hz … 16 kHz
    out = []
    for fc in fcs:
        lo, hi = fc / 2 ** (1 / 6), fc * 2 ** (1 / 6)
        sel = (f >= lo) & (f < hi)
        out.append(10 * np.log10(sp[sel].sum() + 1e-20))
    return fcs, np.array(out)


def main():
    os.makedirs(OUT, exist_ok=True)
    cues = load_cues()
    st = {k: read_wav(os.path.join(AUDIO, "stems", f"{k}.wav"))[0] for k in STEMS}
    mx, _ = read_wav(os.path.join(ROOT, "public", "audio", "promo.wav"))
    ssum = sum(st.values())
    rest = ssum - st["sfx"]
    em = rms_env(mx, 0.005)
    es = rms_env(ssum, 0.005)
    act = es > 10 ** (-50 / 20)
    gr = np.where(act, db(em) - db(es), 0.0)
    # tramo final con fundido aparte (el fundido coseno de 29,35 s también es «reducción»)
    sel = np.arange(gr.size) < S(29.3)
    i = int(np.argmin(np.where(sel, gr, 99)))
    rep = dict(gr_min_db=float(gr[i]), gr_min_t=i / SR, gr_median_db=float(np.median(gr[act & sel])))
    # por sección
    rep["gr_by_section"] = {s["id"]: dict(min=float(gr[S(s["from"]):S(min(s["to"], 29.3))].min()),
                                         median=float(np.median(gr[S(s["from"]):S(min(s["to"], 29.3))])))
                            for s in cues["sections"]}
    # estimar ganancia «de base» (la mediana) y la reducción extra alrededor de cada cue (±60 ms)
    base = float(np.median(gr[act & sel]))
    rows = []
    for c in cues["cues"]:
        if c["sfx"] == "silence":
            continue
        t = c["t"]
        a, b = S(t - 0.005), S(t + 0.15)
        dip = float(gr[a:b].min() - base)
        # SFX vs resto por tercio de octava en [t, t+80 ms]
        a2, b2 = S(t), S(t + 0.08)
        fcs, ls = third_octave_levels(st["sfx"], a2, b2)
        _, lr = third_octave_levels(rest, a2, b2)
        diff = ls - lr
        k = int(np.argmax(diff))
        n_above = int((diff > 0).sum())
        # chasquido agudo: pico > 6 kHz y su ancho a −20 dB
        hf = butter(st["sfx"][:, max(0, S(t) - 2400): S(t) + 2400], 6000.0, "high", 4)
        m = np.abs(hf).max(0)
        p = int(np.argmax(m))
        width = int((m > m[p] * 0.1).sum())
        # ventana corta (30 ms): para los «pops» la energía está en los primeros 10–20 ms
        _, ls30 = third_octave_levels(st["sfx"], S(t - 0.002), S(t + 0.03))
        _, lr30 = third_octave_levels(rest, S(t - 0.002), S(t + 0.03))
        d30 = ls30 - lr30
        rows.append(dict(id=c["id"], sfx=c["sfx"], t=t, master_gr_dip_db=round(dip, 2),
                         best_band30_sfx_minus_rest_db=round(float(d30.max()), 1),
                         best_band30_hz=round(float(fcs[int(np.argmax(d30))])),
                         best_band_hz=round(float(fcs[k])), best_band_sfx_minus_rest_db=round(float(diff[k]), 1),
                         bands_where_sfx_wins=n_above,
                         hf_peak_dbfs=round(float(db(m[p])), 1), hf_click_ms_above_m20db=round(width / SR * 1000, 2)))
    rep["base_gr_db"] = base
    rep["cues"] = rows
    rep["worst_gr_dips"] = sorted(rows, key=lambda r: r["master_gr_dip_db"])[:10]
    rep["least_audible"] = sorted(rows, key=lambda r: max(r["best_band_sfx_minus_rest_db"], r["best_band30_sfx_minus_rest_db"]))[:12]
    # reducción de ganancia en beats CON cue vs. SIN cue (para separar SFX de bombo)
    beat = cues["beat"]
    cue_beats = {round(c["t"] / beat, 3) for c in cues["cues"]}
    w_cue, wo_cue = [], []
    for bi in range(8, 61):
        tb = bi * beat
        v = float(gr[S(tb - 0.005):S(tb + 0.15)].min() - base)
        (w_cue if round(bi, 3) in cue_beats else wo_cue).append((round(tb, 4), round(v, 2)))
    rep["gr_dip_beats_with_cue"] = dict(mean=float(np.mean([v for _, v in w_cue])), min=float(min(v for _, v in w_cue)), n=len(w_cue))
    rep["gr_dip_beats_without_cue"] = dict(mean=float(np.mean([v for _, v in wo_cue])), min=float(min(v for _, v in wo_cue)),
                                           n=len(wo_cue), list=wo_cue)
    # gráfico
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(2, 1, figsize=(18, 6), sharex=True)
    t = np.arange(gr.size) / SR
    d = 48
    ax[0].plot(t[::d], gr[::d], lw=0.5)
    ax[0].set_ylabel("master − suma stems (dB)")
    ax[0].set_ylim(-12, 3)
    for c in cues["cues"]:
        ax[0].axvline(c["t"], color="r", lw=0.3)
    ax[1].plot(t[::d], db(em[::d]), lw=0.5, label="master")
    ax[1].plot(t[::d], db(rms_env(st["sfx"], 0.005)[::d]), lw=0.5, label="sfx")
    ax[1].set_ylim(-60, 0)
    ax[1].legend()
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "gr.png"), dpi=90)
    with open(os.path.join(OUT, "dynamics.json"), "w", encoding="utf-8") as fh:
        json.dump(rep, fh, indent=1, ensure_ascii=False, default=float)
    print(json.dumps({k: v for k, v in rep.items() if k != "cues"}, indent=1, ensure_ascii=False, default=float))
    print(f"{'cue':14s} {'sfx':15s} {'GRdip':>6s} {'band':>6s} {'sfx-rest':>8s} {'b30':>6s} {'s-r30':>6s} {'nb':>3s} {'hfpk':>6s} {'hf_ms':>6s}")
    for r in rows:
        print(f"{r['id']:14s} {r['sfx']:15s} {r['master_gr_dip_db']:6.2f} {r['best_band_hz']:6d} "
              f"{r['best_band_sfx_minus_rest_db']:8.1f} {r['best_band30_hz']:6d} {r['best_band30_sfx_minus_rest_db']:6.1f} {r['bands_where_sfx_wins']:3d} {r['hf_peak_dbfs']:6.1f} {r['hf_click_ms_above_m20db']:6.2f}")


if __name__ == "__main__":
    main()
