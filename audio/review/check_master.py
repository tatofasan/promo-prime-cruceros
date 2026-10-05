"""
check_master.py — controles del master (formato, loudness, true peak, DC, fase, final, clics, gap y drop).

    python audio/review/check_master.py   → imprime y guarda audio/review/out/master.json
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np
from scipy import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rv_common import (OUT, ROOT, SR, butter, db, load_cues, loudness_curve, lufs_integrated,  # noqa: E402
                       lufs_segment, read_wav, rms_env, sha256, true_peak)

WAV = os.path.join(ROOT, "public", "audio", "promo.wav")


def fmt_check(info):
    return dict(
        tag=info["tag"], channels=info["channels"], sr=info["sr"], bits=info["bits"],
        block_align=info["block_align"], byte_rate=info["byte_rate"], frames=info["frames"],
        seconds=info["frames"] / info["sr"], chunks=info["chunks"], riff_size_ok=info["riff_ok"],
        ok=(info["tag"] == 1 and info["channels"] == 2 and info["sr"] == 48000 and info["bits"] == 24
            and info["frames"] == 1_440_000 and info["riff_ok"]),
    )


def dc_check(x):
    out = dict(global_mean=[float(x[c].mean()) for c in range(2)],
               global_dbfs=[float(db(x[c].mean())) for c in range(2)])
    # DC por ventana de 1 s (un offset lento escondido en una sección)
    w = SR
    m = x[:, : (x.shape[1] // w) * w].reshape(2, -1, w).mean(axis=2)
    i = np.unravel_index(np.argmax(np.abs(m)), m.shape)
    out["worst_1s_window"] = dict(ch=int(i[0]), t=float(i[1]), mean=float(m[i]), dbfs=float(db(m[i])))
    # componente < 5 Hz (pasa-bajos) en RMS
    lo = butter(x, 5.0, "low", 2)
    out["sub5hz_rms_dbfs"] = float(db(np.sqrt((lo ** 2).mean())))
    return out


def phase_check(x):
    L, R = x
    corr = float(np.corrcoef(L, R)[0, 1])
    M, S = 0.5 * (L + R), 0.5 * (L - R)
    win = int(0.1 * SR)
    nw = x.shape[1] // win
    Lw = L[: nw * win].reshape(nw, win)
    Rw = R[: nw * win].reshape(nw, win)
    num = (Lw * Rw).sum(1)
    den = np.sqrt((Lw ** 2).sum(1) * (Rw ** 2).sum(1)) + 1e-20
    cw = num / den
    active = (Lw ** 2 + Rw ** 2).mean(1) > 10 ** (-60 / 10)
    cwa = cw[active]
    worst = int(np.argmin(np.where(active, cw, 9)))
    # loudness de la suma mono (L+R)/2 en los dos canales vs. el estéreo
    mono = np.vstack([M, M])
    l_st = lufs_integrated(x)
    l_mono = lufs_integrated(mono)
    # correlación por banda
    bands = {}
    for name, (lo, hi) in {"<120": (None, 120), "120-500": (120, 500), "500-2k": (500, 2000),
                           "2k-8k": (2000, 8000), ">8k": (8000, None)}.items():
        if lo is None:
            y = butter(x, hi, "low")
        elif hi is None:
            y = butter(x, lo, "high")
        else:
            y = butter(x, [lo, hi], "band")
        bands[name] = dict(corr=float(np.corrcoef(y[0], y[1])[0, 1]),
                           side_over_mid_db=float(db(np.sqrt(((0.5 * (y[0] - y[1])) ** 2).mean()))
                                                  - db(np.sqrt(((0.5 * (y[0] + y[1])) ** 2).mean()))))
    return dict(corr_global=corr, corr_100ms_min=float(cwa.min()), corr_100ms_min_t=worst * 0.1,
                corr_100ms_p5=float(np.percentile(cwa, 5)), frac_windows_negative=float((cwa < 0).mean()),
                frac_windows_below_0_3=float((cwa < 0.3).mean()),
                lufs_stereo=l_st, lufs_mono_fold=l_mono, mono_loss_db=l_st - l_mono, bands=bands)


def clicks_check(x):
    """Busca discontinuidades: picos de la 2ª derivada (y de un pasa-altos de 12 kHz) que sobresalen
    mucho de su vecindario de 10 ms. Una señal musical continua no tiene saltos aislados."""
    res = {}
    d1 = np.diff(x, axis=1)
    d2 = np.diff(x, n=2, axis=1)
    i1 = np.unravel_index(np.argmax(np.abs(d1)), d1.shape)
    res["max_abs_diff1"] = dict(value=float(abs(d1[i1])), dbfs=float(db(d1[i1])), t=float(i1[1] / SR), ch=int(i1[0]))
    hp = butter(x, 12000.0, "high", 6)
    found = []
    for name, sig in (("d2", d2), ("hp12k", hp)):
        a = np.abs(sig).max(axis=0)
        # vecindario: mediana móvil de 10 ms (por bloques de 1 ms, rápido)
        blk = 48
        nb = a.size // blk
        bmax = a[: nb * blk].reshape(nb, blk).max(1)
        bmed = np.median(a[: nb * blk].reshape(nb, blk), axis=1)
        ref = signal.medfilt(bmed, 11) + 1e-9
        ratio = bmax / ref
        cand = np.where((ratio > 40) & (bmax > 10 ** (-60 / 20)))[0]
        for b in cand:
            found.append(dict(kind=name, t=round(b * blk / SR, 5), ratio=float(ratio[b]), level_dbfs=float(db(bmax[b]))))
    res["isolated_spikes"] = sorted(found, key=lambda d: -d["ratio"])[:40]
    res["count"] = len(found)
    return res


def end_check(x, ints):
    n = x.shape[1]
    last10 = x[:, n - int(0.010 * SR):]
    last50 = x[:, n - int(0.050 * SR):]
    t = np.arange(n) / SR
    env = rms_env(x, 0.05)
    def at(tt):
        return float(db(env[int(tt * SR)]))
    return dict(last_samples_int=[[int(v) for v in ints[c, -4:]] for c in range(2)],
                first_samples_int=[[int(v) for v in ints[c, :6]] for c in range(2)],
                last10ms_peak_dbfs=float(db(np.abs(last10).max())), last50ms_peak_dbfs=float(db(np.abs(last50).max())),
                rms50_dbfs={f"{tt:.2f}": at(tt) for tt in (28.2, 28.6, 29.0, 29.3, 29.35, 29.5, 29.7, 29.9, 29.97)},
                final_jump=float(abs(x[:, -1] - x[:, -2]).max()), start_jump=float(abs(x[:, 1] - x[:, 0]).max()))


def gap_drop_check(x, cues):
    c = {q["id"]: q for q in cues["cues"]}
    g0 = c["hook.gap"]["t"]
    g1 = g0 + c["hook.gap"]["dur"]
    a, b = int(round(g0 * SR)), int(round(g1 * SR))
    seg = x[:, a:b]
    # núcleo del hueco (sin las rampas de entrada/salida de 2–3 ms)
    core = x[:, a + int(0.004 * SR): b - int(0.002 * SR)]
    drop = x[:, b: b + int(0.25 * SR)]
    pre = x[:, a - int(0.25 * SR): a]
    e1 = rms_env(x, 0.001)
    # ¿cuándo cae realmente la señal al empezar el gap? (−40 dB respecto de los 50 ms previos)
    ref_pre = float(np.sqrt((x[:, a - int(0.05 * SR): a] ** 2).mean(axis=1).sum()))
    k = a - int(0.01 * SR)
    while k < b and e1[k] > ref_pre * 10 ** (-40 / 20):
        k += 1
    fall_t = k / SR
    # ¿cuándo arranca el drop? primera muestra que supera −40 dBFS y −20 dBFS después del núcleo del gap
    m = np.abs(x).max(axis=0)
    def first_over(level_db, start):
        idx = np.where(m[start:] > 10 ** (level_db / 20))[0]
        return (start + int(idx[0])) / SR if idx.size else None
    st = a + int(0.02 * SR)
    hf = butter(x, 2000.0, "high", 4)
    lf = butter(x, 150.0, "low", 4)
    # cresta del bombo/sub en el drop (banda baja) y del golpe en agudos
    lf_env = rms_env(lf, 0.002)
    hf_env = rms_env(hf, 0.001)
    w0, w1 = b - int(0.01 * SR), b + int(0.06 * SR)
    lf_onset = None
    pk = lf_env[w0:w1].max()
    idx = np.where(lf_env[w0:w1] > 0.1 * pk)[0]
    if idx.size:
        lf_onset = (w0 + idx[0]) / SR
    hf_pk = (w0 + int(np.argmax(hf_env[w0:w1]))) / SR
    return dict(
        gap=[g0, g1],
        gap_rms_dbfs=float(db(np.sqrt((seg ** 2).mean()))), gap_peak_dbfs=float(db(np.abs(seg).max())),
        gap_core_rms_dbfs=float(db(np.sqrt((core ** 2).mean()))), gap_core_peak_dbfs=float(db(np.abs(core).max())),
        pre_gap_250ms_rms_dbfs=float(db(np.sqrt((pre ** 2).mean()))),
        drop_250ms_rms_dbfs=float(db(np.sqrt((drop ** 2).mean()))),
        gap_vs_drop_db=float(db(np.sqrt((core ** 2).mean())) - db(np.sqrt((drop ** 2).mean()))),
        signal_falls_40db_at=fall_t, fall_delay_ms=(fall_t - g0) * 1000,
        first_over_m40_after_gap=first_over(-40, st), first_over_m20_after_gap=first_over(-20, st),
        drop_lowband_onset_10pct=lf_onset, drop_lowband_onset_err_ms=None if lf_onset is None else (lf_onset - g1) * 1000,
        drop_hf_crest=hf_pk, drop_hf_crest_err_ms=(hf_pk - g1) * 1000,
        gap_profile_1ms_dbfs=[round(float(db(e1[i])), 1) for i in range(a - 96, b + 96, 48)],
    )


def section_loudness(x, cues):
    out = {}
    for s in cues["sections"]:
        out[s["id"]] = lufs_segment(x, s["from"], s["to"])
    out["c0"] = lufs_segment(x, 0, 1.875)
    out["c1"] = lufs_segment(x, 1.875, 3.6)
    out["hook_vs_drop_LU"] = out["reveal"] - out["hook"]
    out["c0_vs_drop_LU"] = out["reveal"] - out["c0"]
    t, st = loudness_curve(x, 3.0, 0.1)
    t2, mo = loudness_curve(x, 0.4, 0.05)
    out["short_term_max"] = dict(v=float(st.max()), t=float(t[np.argmax(st)]))
    out["momentary_max"] = dict(v=float(mo.max()), t=float(t2[np.argmax(mo)]))
    # momentáneo máximo por sección
    out["momentary_max_by_section"] = {s["id"]: float(mo[(t2 >= s["from"]) & (t2 < s["to"])].max()) for s in cues["sections"]}
    # rango de loudness (LRA aproximado, percentiles 10–95 del corto plazo con gating)
    sel = st[st > -70]
    rel = 10 * np.log10(np.mean(10 ** (sel / 10))) - 20
    sel = sel[sel > rel]
    out["LRA_approx"] = float(np.percentile(sel, 95) - np.percentile(sel, 10))
    return out, (t, st, t2, mo)


def main():
    os.makedirs(OUT, exist_ok=True)
    cues = load_cues()
    x, info = read_wav(WAV)
    rep = dict(file=WAV, sha256=sha256(WAV))
    rep["format"] = fmt_check(info)
    rep["lufs_integrated_own"] = lufs_integrated(x)
    try:
        import pyloudnorm as pyln
        rep["lufs_integrated_pyloudnorm"] = float(pyln.Meter(SR).integrated_loudness(x.T))
    except Exception as e:  # noqa: BLE001
        rep["lufs_integrated_pyloudnorm"] = f"error {e}"
    rep["sample_peak_dbfs"] = float(db(np.abs(x).max()))
    for k in (4, 8, 16):
        v, ch, i = true_peak(x, k)
        rep[f"true_peak_x{k}"] = dict(dbtp=v, ch=ch, t=i / SR)
    rep["dc"] = dc_check(x)
    rep["phase"] = phase_check(x)
    rep["clicks"] = clicks_check(x)
    rep["end"] = end_check(x, info["ints"])
    rep["gap_drop"] = gap_drop_check(x, cues)
    sl, curves = section_loudness(x, cues)
    rep["sections"] = sl
    np.save(os.path.join(OUT, "loud_curves.npy"), np.array([curves[0], curves[1]], dtype=object), allow_pickle=True)
    with open(os.path.join(OUT, "master.json"), "w", encoding="utf-8") as fh:
        json.dump(rep, fh, indent=1, ensure_ascii=False, default=float)
    print(json.dumps(rep, indent=1, ensure_ascii=False, default=float))


if __name__ == "__main__":
    main()
