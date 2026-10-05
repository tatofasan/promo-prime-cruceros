"""
check_sync.py — sincronía: SFX vs. cue (stem y master), risers/reversos, bombo en la grilla y afinación
de pines/chips. Detectores propios, distintos del pipeline (que usa RMS de 1 ms con pasa-altos de 250 Hz):

  crest_fine : máximo de la envolvente analítica (|Hilbert|, banda completa, suavizada 2 ms)
  crest_body : máximo del RMS Hann de 10 ms (dónde está la ENERGÍA del golpe, no el chasquido)
  rise50     : último instante antes de crest_body en que el RMS de 5 ms está por debajo del 50 %
               (aproxima el «ataque percibido»)
  hf_click   : pico de la banda > 6 kHz (1 ms) y cuánto sobresale del cuerpo del SFX

    python audio/review/check_sync.py  → audio/review/out/sync.json + sync.png
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np
from scipy import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rv_common import (AUDIO, OUT, ROOT, SR, butter, db, hilbert_env, k_weight, load_cues,  # noqa: E402
                       read_wav, rms_env)

STEMS = ["drums", "bass", "music", "lead", "wall", "fx", "sfx"]


def S(t):
    return max(0, int(round(t * SR)))


def load_all():
    st = {k: read_wav(os.path.join(AUDIO, "stems", f"{k}.wav"))[0] for k in STEMS}
    mx, _ = read_wav(os.path.join(ROOT, "public", "audio", "promo.wav"))
    return st, mx


def sfx_sync(st, mx, cues):
    sfx = st["sfx"]
    rest = sum(st[k] for k in STEMS if k != "sfx")
    e_fine = hilbert_env(sfx, 0.002)
    e10 = rms_env(sfx, 0.010)
    e5 = rms_env(sfx, 0.005)
    e1 = rms_env(sfx, 0.001)
    l1 = 20 * np.log10(e1 + 1e-9)
    hf = butter(sfx, 6000.0, "high", 4)
    e_hf = rms_env(hf, 0.001)
    sfx_k = k_weight(sfx)
    rest_k = k_weight(rest)
    mx_hp = butter(mx, 2000.0, "high", 4)
    sfx_hp = butter(sfx, 2000.0, "high", 4)
    rest_hf = rms_env(butter(rest, 6000.0, "high", 4), 0.010)
    times = [c["t"] for c in cues["cues"]]
    rows = []
    for i, c in enumerate(cues["cues"]):
        if c["sfx"] == "silence":
            continue
        t = c["t"]
        # ventana de búsqueda: ±100 ms, sin invadir la mitad del vecino
        prev_t = max([u for u in times if u < t - 1e-9], default=-1.0)
        next_t = min([u for u in times if u > t + 1e-9], default=99.0)
        lo = max(0, S(max(t - 0.1, (t + prev_t) / 2)))
        hi = S(min(t + 0.1, (t + next_t) / 2))
        n0 = S(t)
        k_fine = lo + int(np.argmax(e_fine[lo:hi]))
        k_body = lo + int(np.argmax(e10[lo:hi]))
        pk = e5[k_body]
        k = k_body
        stop = max(lo, k_body - S(0.06))
        while k > stop and e5[k] > 0.5 * pk:
            k -= 1
        k_rise = k
        k_hf = lo + int(np.argmax(e_hf[lo:hi]))
        # inicio = máxima pendiente (dB/muestra, derivada sobre 0,5 ms) del RMS de 1 ms en [t−20 ms, t+20 ms]
        a1, b1 = max(24, S(t - 0.02)), S(t + 0.02)
        slope = l1[a1:b1] - l1[a1 - 24:b1 - 24]
        k_on = a1 + int(np.argmax(slope))
        # ¿el pico de agudos es un chasquido que sobresale del cuerpo del SFX?
        hf_peak_db = float(db(np.abs(hf[:, max(0, n0 - 240):n0 + 240]).max()))
        body_db = float(db(e10[k_body]))
        # nivel del SFX frente al resto de la mezcla (K-weighted, 100 ms desde t−10 ms)
        a, b = S(t - 0.01), S(t + 0.09)
        p_sfx = float((sfx_k[:, a:b] ** 2).sum(0).mean())
        p_rest = float((rest_k[:, a:b] ** 2).sum(0).mean())
        snr = 10 * np.log10((p_sfx + 1e-20) / (p_rest + 1e-20))
        # agudos del SFX frente a los agudos de la música (los «snaps»)
        hf_vs_music = float(db(e_hf[k_hf]) - db(rest_hf[k_hf]))
        # desfasaje stem → master por correlación cruzada (±5 ms), banda > 2 kHz
        a2, b2 = S(t - 0.02), S(t + 0.08)
        ref = sfx_hp[:, a2:b2].sum(0)
        best, best_lag = -1.0, 0
        for lag in range(-240, 241):
            if a2 + lag < 0:
                continue
            seg = mx_hp[:, a2 + lag:b2 + lag].sum(0)
            cc = float(np.dot(ref, seg) / (np.linalg.norm(ref) * np.linalg.norm(seg) + 1e-20))
            if cc > best:
                best, best_lag = cc, lag
        rows.append(dict(
            id=c["id"], sfx=c["sfx"], t=t,
            err_onset_ms=round((k_on - n0) / SR * 1000, 2),
            err_fine_ms=round((k_fine - n0) / SR * 1000, 2),
            err_body_ms=round((k_body - n0) / SR * 1000, 2),
            err_rise50_ms=round((k_rise - n0) / SR * 1000, 2),
            err_hf_ms=round((k_hf - n0) / SR * 1000, 2),
            hf_peak_dbfs=round(hf_peak_db, 1), body_rms10_dbfs=round(body_db, 1),
            hf_click_over_music_db=round(hf_vs_music, 1),
            sfx_vs_rest_k_db=round(snr, 1),
            master_lag_samples=best_lag, master_corr=round(best, 3),
        ))
    return rows


def pitch_check(st, cues):
    """Afinación de pines y chips: pico espectral entre 700 y 2500 Hz, 15–200 ms después del cue."""
    sfx = st["sfx"].sum(0)
    out = []
    for c in cues["cues"]:
        if c["sfx"] not in ("pin_pop", "chip_pop"):
            continue
        a, b = S(c["t"] + 0.015), S(c["t"] + 0.2)
        seg = sfx[a:b] * np.hanning(b - a)
        nfft = 1 << 16
        sp = np.abs(np.fft.rfft(seg, nfft))
        f = np.fft.rfftfreq(nfft, 1 / SR)
        sel = (f > 700) & (f < 2500)
        fpk = float(f[sel][np.argmax(sp[sel])])
        exp_f = 880.0 * 2 ** (c.get("pitch", 0) / 12)
        out.append(dict(id=c["id"], pitch=c.get("pitch"), expected_hz=round(exp_f, 1), measured_hz=round(fpk, 1),
                        cents=round(1200 * np.log2(fpk / exp_f), 1)))
    return out


def riser_check(st, mx, cues):
    """Risers y reversos. El bus fx mezcla riser + redoble: para ver el riser (sostenido) se le saca
    el redoble con una mediana móvil de 61 ms sobre el RMS de 5 ms (los golpes aislados desaparecen)."""
    c = {q["id"]: q for q in cues["cues"]}
    fx = st["fx"]
    sfx = st["sfx"]
    e5 = rms_env(fx, 0.005)
    blk = 48  # 1 ms
    e5b = e5[: (e5.size // blk) * blk].reshape(-1, blk).mean(1)
    e_sust = signal.medfilt(e5b, 61)                      # envolvente «sostenida» (sin redoble), 1 ms/muestra
    e2 = rms_env(fx, 0.002)
    e_sfx = rms_env(sfx, 0.02)
    res = {}
    gap0 = c["hook.gap"]["t"]
    for name, t0, tend in (("riser_hook(fx)", 1.875, gap0), ("riser_value(fx)", 24.375, c["close.in"]["t"])):
        a, b = int(t0 * 1000), int(tend * 1000) + 30
        k = a + int(np.argmax(e_sust[a:b]))
        prof = {f"{d:+d}ms": round(float(db(e_sust[int(tend * 1000) + d])), 1) for d in (-1000, -500, -250, -120, -60, -30, -10, -3, 3)}
        res[name] = dict(t_end=tend, sustained_peak_t=k / 1000, sustained_peak_err_ms=k - tend * 1000,
                         profile_sustained_dbfs=prof)
    for cut in (7.5, 9.375, 11.25, 13.125, 20.625):
        a, b = S(cut - 1.0), S(cut + 0.05)
        k = a + int(np.argmax(e2[a:b]))
        res[f"revcrash@{cut}"] = dict(peak_t=round(k / SR, 5), peak_err_ms=round((k / SR - cut) * 1000, 2),
                                      peak_dbfs=round(float(db(e2[k])), 1),
                                      level_minus_200ms=round(float(db(e2[S(cut - 0.2)])), 1),
                                      level_after_5ms=round(float(db(e2[S(cut + 0.005)])), 1))
    # swells/whooshes del stem de SFX: perfil cada 25 ms desde el cue hasta el final de `dur`
    for cid in ("hook.surge", "reveal.push", "val.surge", "exp.sunset", "close.final"):
        q = c[cid]
        t = q["t"]
        if q.get("dur"):
            tend = t + q["dur"]
            grid = np.arange(t + 0.025, tend + 1e-9, 0.025)
        else:
            tend = t
            grid = np.arange(t - 0.4, t + 0.0251, 0.05)
        prof = {f"{u:.3f}": round(float(db(e_sfx[S(u)])), 1) for u in grid}
        res[cid] = dict(sfx=q["sfx"], t=t, t_end=tend, profile_rms20_dbfs=prof)
    return res


def kick_grid(st, cues):
    """Bombo en la grilla de 128 BPM.
    1) Alineación RELATIVA: cada bombo se correlaciona contra el primero (banda 30–400 Hz, ±10 ms) →
       desfasaje en muestras (0 = todos los bombos idénticamente ubicados).
    2) Alineación ABSOLUTA: inicio del bombo = primer cruce del 10 % del pico de la envolvente RMS de 1 ms
       de la banda 30–400 Hz dentro de [beat−15 ms, beat+40 ms]."""
    beat = cues["beat"]
    out = {}
    for name, x, beats in (("drums", st["drums"], list(range(8, 60)) + [60]), ("wall", st["wall"], [0, 1, 2, 3, 4, 5])):
        lf = butter(x, [30.0, 400.0], "band", 4).sum(0)
        env = rms_env(lf, 0.001)
        rows = []
        tmpl = None
        for bi in beats:
            g = bi * beat
            a, b = S(g - 0.015), S(g + 0.04)
            p = a + int(np.argmax(env[a:b]))
            # inicio = máxima pendiente (en dB) de la envolvente de 1 ms en [beat−10 ms, beat+15 ms]
            a2, b2 = max(1, S(g - 0.010)), S(g + 0.015)
            de = np.diff(20 * np.log10(env[a2 - 1:b2] + 1e-9))
            k = a2 + int(np.argmax(de))
            i0 = S(g) - 480
            seg = np.concatenate([np.zeros(max(0, -i0)), lf[max(0, i0): S(g) + 2400]])
            if tmpl is None:
                tmpl, lag = seg, 0
            else:
                cc = signal.correlate(seg, tmpl, mode="full")
                mid, w = tmpl.size - 1, 480
                lag = int(np.argmax(cc[mid - w: mid + w + 1])) - w
            rows.append(dict(beat=bi, grid=g, onset_err_ms=round((k - S(g)) / SR * 1000, 3),
                             peak_err_ms=round((p - S(g)) / SR * 1000, 3), xcorr_lag_samples=lag,
                             level_db=round(float(db(env[p])), 1)))
        on = np.array([r["onset_err_ms"] for r in rows])
        lg = np.array([r["xcorr_lag_samples"] for r in rows])
        out[name] = dict(count=len(rows), onset_err_ms_min=float(on.min()), onset_err_ms_max=float(on.max()),
                         onset_err_ms_mean=float(on.mean()), onset_err_ms_std=float(on.std()),
                         xcorr_lag_min=int(lg.min()), xcorr_lag_max=int(lg.max()),
                         levels_db_range=[float(min(r["level_db"] for r in rows)), float(max(r["level_db"] for r in rows))],
                         worst=sorted(rows, key=lambda r: -abs(r["onset_err_ms"]))[:3])
    return out


def plot(rows, st, mx, cues):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    sel = [r for r in rows]
    n = len(sel)
    cols = 8
    rws = int(np.ceil(n / cols))
    fig, axs = plt.subplots(rws, cols, figsize=(cols * 2.6, rws * 1.9))
    sfx = st["sfx"]
    e10 = rms_env(sfx, 0.010)
    ef = hilbert_env(sfx, 0.002)
    for ax, r in zip(axs.flat, sel):
        a, b = S(r["t"] - 0.08), S(r["t"] + 0.12)
        tt = (np.arange(a, b) / SR - r["t"]) * 1000
        if b <= a:
            continue
        ax.plot(tt, db(ef[a:b]), lw=0.6, color="#888")
        ax.plot(tt, db(e10[a:b]), lw=1.0, color="#0a6")
        ax.axvline(0, color="r", lw=0.8)
        ax.set_ylim(-70, 0)
        ax.set_title(f"{r['id']} ({r['err_body_ms']:+.0f})", fontsize=7)
        ax.tick_params(labelsize=6)
    for ax in list(axs.flat)[n:]:
        ax.axis("off")
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "sync_cues.png"), dpi=80)
    plt.close(fig)


def main():
    os.makedirs(OUT, exist_ok=True)
    cues = load_cues()
    st, mx = load_all()
    rows = sfx_sync(st, mx, cues)
    rep = dict(sfx=rows)
    for key in ("err_onset_ms", "err_fine_ms", "err_body_ms", "err_rise50_ms"):
        v = np.array([r[key] for r in rows])
        rep[f"summary_{key}"] = dict(max_abs=float(np.abs(v).max()), mean_abs=float(np.abs(v).mean()),
                                     n_over_5ms=int((np.abs(v) > 5).sum()), n_over_10ms=int((np.abs(v) > 10).sum()),
                                     n_over_20ms=int((np.abs(v) > 20).sum()))
    rep["master_lag_nonzero"] = [r["id"] for r in rows if r["master_lag_samples"] != 0]
    rep["pitch"] = pitch_check(st, cues)
    rep["risers"] = riser_check(st, mx, cues)
    rep["kicks"] = kick_grid(st, cues)
    # suma de stems vs. master
    ssum = sum(st.values())
    rep["stems_sum_vs_master_corr"] = float(np.corrcoef(ssum.sum(0), mx.sum(0))[0, 1])
    plot(rows, st, mx, cues)
    with open(os.path.join(OUT, "sync.json"), "w", encoding="utf-8") as fh:
        json.dump(rep, fh, indent=1, ensure_ascii=False, default=float)
    hdr = f"{'cue':14s} {'sfx':15s} {'onset':>7s} {'fine':>7s} {'body':>7s} {'rise':>7s} {'hf':>7s} {'hfpk':>6s} {'body':>6s} {'hf/mus':>6s} {'sfx/rest':>8s} {'lag':>4s}"
    print(hdr)
    for r in rows:
        print(f"{r['id']:14s} {r['sfx']:15s} {r['err_onset_ms']:7.2f} {r['err_fine_ms']:7.2f} {r['err_body_ms']:7.2f} {r['err_rise50_ms']:7.2f} "
              f"{r['err_hf_ms']:7.2f} {r['hf_peak_dbfs']:6.1f} {r['body_rms10_dbfs']:6.1f} {r['hf_click_over_music_db']:6.1f} "
              f"{r['sfx_vs_rest_k_db']:8.1f} {r['master_lag_samples']:4d}")
    print(json.dumps({k: v for k, v in rep.items() if k != "sfx"}, indent=1, ensure_ascii=False, default=float))


if __name__ == "__main__":
    main()
