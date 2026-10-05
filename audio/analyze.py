"""
analyze.py — verificación técnica y de mezcla de public/audio/promo.wav (y de los stems).

    python audio/analyze.py                  # verifica todo y genera audio/analysis/*.png + report.json
    python audio/analyze.py --determinism    # además corre build.py dos veces y compara los SHA-256
    python audio/analyze.py --quick          # sin códecs ni PNG (para iterar la mezcla)

Contrato (docs/PLAN.md §10) — si falla, RESULTADO = FALLA:
- formato: 48 kHz, 24 bit, estéreo, 1 440 000 muestras exactas;
- loudness integrado BS.1770-4: −14 ± 0,5 LUFS (medidor propio; se cruza con pyloudnorm);
- true peak ≤ −1 dBTP en el WAV y DESPUÉS de codificar: AAC 320 kb/s (el de render.mjs), AAC 128 kb/s y
  la «segunda generación» de redes (AAC 320 → AAC 128);
- SFX en su cue: cresta fina (|Hilbert| 2 ms) y cresta de cuerpo (RMS 10 ms), las dos de BANDA COMPLETA y
  con detectores distintos de los que usa sfx.py para calibrar, dentro de ±5 ms (ventana de ±100 ms que no
  invade la mitad del cue vecino);
- los SFX con `dur` (risers/whooshes) culminan en su final (último 30 ms antes del cue o del hueco);
- el hueco de hook.gap en silencio real (toda la mezcla);
- sin clics y el final en cero; gancho 6–8 LU debajo del drop; los dos picos (drop y cierre) arriba del
  cuerpo del tema; determinismo;
- el final con beat (v2, PLAN §12): el RMS de cada corchea entre 28,2 y 29,5 queda a ±6 dB del RMS de
  27,2–28,1 (el último estribillo) y el transitorio del stinger (b(15, 4) = 29,53125) cae a ±5 ms, medido
  en el master con los mismos detectores de banda completa que los SFX; genera `final_zoom.png` (27–30 s).

Mezcla (objetivos de la revisión v1 — se reportan; no rompen el contrato):
- reducción de ganancia del limitador del master (< 3 dB; ≤ 2,5 dB en el drop);
- c2 y c14 ≥ 2 LU sobre el promedio de c3–c9; c1 sube en forma monótona 4–5 LU antes del gap;
- el lead ≥ +4 dB sobre el resto de la música en 400–3000 Hz en cada compás con hook;
- cada SFX: loudness K de 150 ms contra la música y mejor banda de tercio de octava en 80 ms (≥ +3 dB;
  los que tienen `dur` se miden también en sus últimos 150 ms, donde culminan);
- cada corte: la música en > 2 kHz ≥ +4 dB contra un beat con clap;
- centroide del drop ≥ el de c3; bombeo del bajo en el drop (desde el beat 2) ≥ 15 dB;
- simulación de celular, valor vs experiencia, correlación L/R arriba de 8 kHz, suma de stems = master.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from arrangement import build_song, load_cues  # noqa: E402
from dsp import (SR, body_env, bp, fine_env, hp, k_weight, lp, lufs_curve, lufs_integrated, ns,  # noqa: E402
                 read_wav, todb, true_peak_db)

ROOT = os.path.dirname(HERE)
WAV = os.path.join(ROOT, "public", "audio", "promo.wav")
STEMS = os.path.join(HERE, "stems")
OUT = os.path.join(HERE, "analysis")
N_EXPECTED = 1_440_000
STEM_NAMES = ("drums", "bass", "music", "lead", "wall", "fx", "sfx")
MUSIC_STEMS = ("drums", "bass", "music", "lead", "wall", "fx")

SECTION_COLORS = {"hook": "#8a8f98", "reveal": "#2bb6d6", "experience": "#ffb938", "destinations": "#5cc8a8",
                  "value": "#ff6b4a", "close": "#ffd27a"}


def S(t):
    return int(round(t * SR))


def sha256(path):
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def lk(x, t0=None, t1=None):
    """Loudness K sin compuertas de un tramo (para comparar compases y eventos cortos)."""
    seg = x if t0 is None else x[:, S(t0):S(t1)]
    y = k_weight(seg) ** 2
    return float(-0.691 + 10 * np.log10(y.sum(axis=0).mean() + 1e-20))


def centroid(x):
    m = x.mean(axis=0)
    sp = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2
    f = np.fft.rfftfreq(len(m), 1 / SR)
    sel = (f > 40) & (f < 16000)
    return float((f[sel] * sp[sel]).sum() / sp[sel].sum())


# ---------------------------------------------------------------------------
# Contrato
# ---------------------------------------------------------------------------

def check_format(path):
    x, sr, bits = read_wav(path)
    return x, dict(sr=sr, bits=bits, channels=x.shape[0], samples=x.shape[1],
                   ok=(sr == 48000 and bits == 24 and x.shape[0] == 2 and x.shape[1] == N_EXPECTED))


def _ffmpeg(args):
    subprocess.run(["ffmpeg", "-y", "-v", "error", *args], check=True)


def codec_checks(path, workdir):
    """True peak y loudness después de codificar y decodificar con ffmpeg:
    AAC 320 kb/s (render.mjs), AAC 128 kb/s y segunda generación (el AAC 320 recodificado a 128,
    como pasa al subirlo a una red social)."""
    if shutil.which("ffmpeg") is None:
        return None
    tmp = tempfile.mkdtemp(prefix="promo_codec_")
    res = {}
    try:
        m4a320 = os.path.join(workdir, "promo_aac320.m4a")
        _ffmpeg(["-i", path, "-c:a", "aac", "-b:a", "320k", m4a320])
        cases = {"aac320": m4a320}
        m4a128 = os.path.join(tmp, "aac128.m4a")
        _ffmpeg(["-i", path, "-c:a", "aac", "-b:a", "128k", m4a128])
        cases["aac128"] = m4a128
        gen2 = os.path.join(tmp, "gen2.m4a")
        _ffmpeg(["-i", m4a320, "-c:a", "aac", "-b:a", "128k", gen2])
        cases["aac320_to_128"] = gen2
        for name, enc in cases.items():
            dec = os.path.join(tmp, f"{name}.wav")
            _ffmpeg(["-i", enc, "-c:a", "pcm_f32le", "-ar", "48000", dec])
            y, _, _ = read_wav(dec)
            res[name] = dict(tp4=round(true_peak_db(y, 4), 3), tp8=round(true_peak_db(y, 8), 3),
                             lufs=round(lufs_integrated(y), 2), samples=int(y.shape[1]))
        # informativos (no son parte del contrato): otros códecs con los que puede terminar la pieza
        extra = {}
        for name, args, ext in (("opus128", ("-c:a", "libopus", "-b:a", "128k"), "opus"),
                                ("mp3_320", ("-c:a", "libmp3lame", "-b:a", "320k"), "mp3"),
                                ("aac_mf256", ("-c:a", "aac_mf", "-b:a", "256k"), "m4a")):
            try:
                enc = os.path.join(tmp, f"{name}.{ext}")
                dec = os.path.join(tmp, f"{name}.wav")
                _ffmpeg(["-i", path, *args, enc])
                _ffmpeg(["-i", enc, "-c:a", "pcm_f32le", "-ar", "48000", dec])
                y, _, _ = read_wav(dec)
                extra[name] = dict(tp4=round(true_peak_db(y, 4), 3), lufs=round(lufs_integrated(y), 2),
                                   samples=int(y.shape[1]))
            except Exception as exc:  # encoder ausente en este ffmpeg: se informa y sigue
                extra[name] = dict(error=str(exc)[:80])
        res["_extra"] = extra
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return res


def sfx_sync(cues, sfx, gap0):
    """Cresta de cada SFX en el stem sfx con detectores de BANDA COMPLETA: fina (|Hilbert| 2 ms) y
    de cuerpo (RMS Hann 10 ms). Ventana: ±100 ms del cue sin pasar la mitad hacia el cue vecino.
    Además, el «onset» (máxima pendiente del RMS de 1 ms)."""
    fe, be = fine_env(sfx), body_env(sfx)
    e1 = np.sqrt(np.maximum(signal.fftconvolve((sfx ** 2).sum(0), np.ones(48) / 48, mode="same"), 0)) + 1e-9
    l1 = 20 * np.log10(e1)
    times = [c["t"] for c in cues["cues"]]
    rows = []
    for c in cues["cues"]:
        if c["sfx"] == "silence":
            continue
        t = c["t"]
        prev_t = max([u for u in times if u < t - 1e-9], default=-1.0)
        next_t = min([u for u in times if u > t + 1e-9], default=99.0)
        lo = max(0, S(max(t - 0.1, (t + prev_t) / 2)))
        hi = S(min(t + 0.1, (t + next_t) / 2))
        k0 = S(t)
        kf = lo + int(np.argmax(fe[lo:hi]))
        kb = lo + int(np.argmax(be[lo:hi]))
        a1, b1 = max(24, S(t - 0.02)), S(t + 0.02)
        k_on = a1 + int(np.argmax(l1[a1:b1] - l1[a1 - 24:b1 - 24]))
        row = dict(id=c["id"], sfx=c["sfx"], t=t, fine_ms=round((kf - k0) / SR * 1000, 2),
                   body_ms=round((kb - k0) / SR * 1000, 2), onset_ms=round((k_on - k0) / SR * 1000, 2))
        if "dur" in c:
            t_end = min(t + c["dur"], gap0) if t < gap0 else t + c["dur"]
            e20 = body_env(sfx[:, S(t):S(t_end) + 1], 0.02)
            kmax = int(np.argmax(e20))
            prof = [round(float(todb(e20[min(len(e20) - 1, S(f * (t_end - t)))])), 1) for f in (0.1, 0.3, 0.5, 0.7, 0.9)]
            row.update(culm_ms=round((kmax - (len(e20) - 1)) / SR * 1000, 1), culm_t_end=round(t_end, 4),
                       burst_db=round(float(todb(be[S(t):S(t) + ns(0.03)].max())), 1),
                       end_db=round(float(todb(e20[kmax])), 1), profile_db=prof)
        rows.append(row)
    return rows


def music_risers(song, fx):
    """Risers musicales: ¿dónde está el máximo del «piso» del bus fx (mínimo de los 60 ms ANTERIORES del
    RMS de 10 ms, o sea el riser entre golpe y golpe del redoble) respecto del hueco al que apuntan?
    La ventana es hacia atrás: centrada, el silencio del hueco bajaría el piso de los últimos 30 ms."""
    from scipy.ndimage import minimum_filter1d
    w = ns(0.06)
    fl = minimum_filter1d(body_env(fx, 0.01), w, origin=w // 2 - 1)
    out = {}
    for name, t_end in (("riser_hook", song.times["gap0"]), ("riser_close", song.times["gap2_0"])):
        a = S(t_end - 0.6)
        out[name] = round((a + int(np.argmax(fl[a:S(t_end) + ns(0.002)])) - S(t_end)) / SR * 1000, 1)
    return out


def section_loudness(cues, x, gap0):
    rows = []
    for s in cues["sections"]:
        a, b = S(s["from"]), S(s["to"])
        if s["id"] == "hook":
            b = S(gap0)
        rows.append(dict(id=s["id"], label=s["label"], from_=s["from"], to=s["to"],
                         lufs=round(lufs_integrated(x[:, a:b]), 2)))
    return rows


def click_scan(x, thr=12.0):
    """Picos aislados de la banda > 12 kHz que superan `thr` veces su RMS local de 20 ms."""
    from scipy.ndimage import uniform_filter1d
    y = hp(x, 12000.0, order=4)
    a = np.abs(y).max(axis=0)
    loc = np.sqrt(np.maximum(uniform_filter1d(a ** 2, ns(0.02)), 0.0)) + 1e-9
    idx = np.where(a / loc > thr)[0]
    groups = []
    for i in idx:
        if not groups or i - groups[-1] > ns(0.005):
            groups.append(i)
    return dict(count=len(groups), times=[round(i / SR, 4) for i in groups[:20]])


# ---------------------------------------------------------------------------
# El final (v2, PLAN §12): groove liviano hasta el último beat + stinger
# ---------------------------------------------------------------------------

END_REF = (27.2, 28.1)       # el último estribillo, con el CTA, antes del golpe final
END_GROOVE = (28.2, 29.5)    # el groove liviano que sigue después del golpe
END_TOL_DB = 6.0
STINGER_WIN = 0.05           # s alrededor del stinger donde se buscan las crestas
STINGER_TOL_MS = 5.0


def _rms_db(x, t0, t1):
    seg = x[:, S(t0):S(t1)]
    return float(todb(np.sqrt((seg ** 2).mean())))


def _eighths(t0, t1, eighth):
    """Corcheas de la grilla que tocan [t0, t1], recortadas a ese tramo."""
    out = []
    k = int(np.floor(t0 / eighth + 1e-9))
    while k * eighth < t1 - 1e-9:
        out.append((max(k * eighth, t0), min((k + 1) * eighth, t1)))
        k += 1
    return out


def end_groove(x, eighth):
    """¿El final sigue con beat? RMS de cada corchea de la grilla entre 28,2 y 29,5 (las de los bordes,
    recortadas a ese tramo) contra el RMS de 27,2–28,1: todas dentro de ±6 dB. (En la primera v2, sin
    groove después del golpe, caía a −18,8 dBFS en 28,83 y −29,6 en 29,3, con el estribillo en −14,7.)"""
    ref = _rms_db(x, *END_REF)
    rows = []
    for a, b in _eighths(*END_GROOVE, eighth):
        v = _rms_db(x, a, b)
        rows.append(dict(t0=round(a, 4), t1=round(b, 4), rms_dbfs=round(v, 2), rel_db=round(v - ref, 2)))
    ref_rows = [dict(t0=round(a, 4), t1=round(b, 4), rms_dbfs=round(_rms_db(x, a, b), 2))
                for a, b in _eighths(*END_REF, eighth)]
    worst = max(rows, key=lambda r: abs(r["rel_db"]))
    return dict(ref_span=END_REF, ref_dbfs=round(ref, 2), ref_rows=ref_rows, span=END_GROOVE, rows=rows,
                worst_rel_db=worst["rel_db"], worst_t0=worst["t0"], tol_db=END_TOL_DB,
                ok=bool(abs(worst["rel_db"]) <= END_TOL_DB))


def stinger_check(x, t_st):
    """Transitorio del stinger en el master: cresta fina (|Hilbert| 2 ms) y de cuerpo (RMS 10 ms), de
    banda completa, buscadas en ±50 ms; las dos a ±5 ms de b(15, 4). Además se informa el «onset»
    (máxima pendiente del RMS de 1 ms), cuánto se despega del groove (cresta de cuerpo contra la mediana
    de los 200 ms anteriores) y la cola (RMS de 10 ms en algunos instantes hasta 30,0)."""
    a0 = S(t_st - 0.6)                       # segmento con margen: el Hilbert no ve los bordes
    seg = x[:, a0:]
    fe, be = fine_env(seg), body_env(seg)
    k0 = S(t_st) - a0
    lo, hi = k0 - ns(STINGER_WIN), k0 + ns(STINGER_WIN) + 1
    kf = lo + int(np.argmax(fe[lo:hi]))
    kb = lo + int(np.argmax(be[lo:hi]))
    e1 = np.sqrt(np.maximum(signal.fftconvolve((seg ** 2).sum(0), np.ones(48) / 48, mode="same"), 0)) + 1e-9
    l1 = 20 * np.log10(e1)
    a1, b1 = k0 - ns(0.02), k0 + ns(0.02)
    k_on = a1 + int(np.argmax(l1[a1:b1] - l1[a1 - 24:b1 - 24]))
    groove = float(np.median(be[k0 - ns(0.2):k0 - ns(0.005)]))
    tail = {f"{t:.2f}": round(_rms_db(x, t, min(t + 0.01, x.shape[1] / SR)), 1)
            for t in (t_st + 0.1, 29.75, 29.85, 29.9, 29.95, 29.99)}
    fine_ms = round((kf - k0) / SR * 1000, 2)
    body_ms = round((kb - k0) / SR * 1000, 2)
    return dict(t=round(t_st, 5), fine_ms=fine_ms, body_ms=body_ms, onset_ms=round((k_on - k0) / SR * 1000, 2),
                crest_dbfs=round(float(todb(be[kb])), 1), over_groove_db=round(float(todb(be[kb]) - todb(groove)), 1),
                tail_rms10ms_dbfs=tail, tol_ms=STINGER_TOL_MS,
                ok=bool(abs(fine_ms) <= STINGER_TOL_MS and abs(body_ms) <= STINGER_TOL_MS))


# ---------------------------------------------------------------------------
# Mezcla
# ---------------------------------------------------------------------------

def per_bar(x, stems, bar):
    rows = []
    for b in range(16):
        t0, t1 = b * bar, (b + 1) * bar
        rows.append(dict(bar=b, lufs=round(lk(x, t0, t1), 2), centroid=round(centroid(x[:, S(t0):S(t1)])),
                         stems={k: round(max(lk(v, t0, t1), -99.0), 1) for k, v in stems.items()}))
    return rows


def build_curve(x, bar):
    """Loudness momentáneo (400 ms) cada 1/8 de compás en c1: ¿sube de forma monótona hasta el gap?"""
    pts = []
    for k in range(1, 9):
        t = bar + k * bar / 8 - (0.117 if k == 8 else 0.0)
        pts.append(round(lk(x, t - 0.4, t), 2))
    rises = np.diff(pts)
    return dict(points=pts, rise_lu=round(pts[-1] - pts[0], 2), max_dip=round(float(min(0.0, rises.min())), 2))


def lead_vs_rest(stems, bar, bars=(2, 3, 4, 5, 6, 14)):
    lead_b = bp(stems["lead"], 400.0, 3000.0, order=2)
    rest_b = bp(sum(stems[k] for k in ("drums", "bass", "music", "fx")), 400.0, 3000.0, order=2)
    sfx_b = bp(stems["sfx"], 400.0, 3000.0, order=2)
    out = {}
    for b in bars:
        a, z = S(b * bar), S((b + 1) * bar)
        el, er, es = ((v[:, a:z] ** 2).mean() for v in (lead_b, rest_b, sfx_b))
        out[f"c{b}"] = dict(vs_rest_db=round(float(10 * np.log10(el / er)), 1),
                            vs_sfx_db=round(float(10 * np.log10(el / es)), 1))
    return out


def thirds(seg):
    m = seg.mean(axis=0)
    sp = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2
    f = np.fft.rfftfreq(len(m), 1 / SR)
    cs = 1000.0 * 2 ** (np.arange(-12, 13) / 3.0)
    return cs, np.array([sp[(f >= c / 2 ** (1 / 6)) & (f < c * 2 ** (1 / 6))].sum() for c in cs])


def sfx_audibility(cues, stems, gap0):
    """Por cue: LK de 150 ms del SFX contra la música, y la mejor banda de tercio de octava del SFX
    contra la música en los primeros 80 ms (¿hay alguna banda donde gane con claridad?).
    Los SFX con `dur` (whooshes y subidas que crecen) se miden además en sus últimos 150 ms, que es
    donde culminan y se oyen: su arranque es suave a propósito."""
    sfx = stems["sfx"]
    mus = sum(stems[k] for k in MUSIC_STEMS)
    ks, km = k_weight(sfx), k_weight(mus)

    def best_band(a, b):
        cs, es = thirds(sfx[:, a:b])
        _, em = thirds(mus[:, a:b])
        snr = 10 * np.log10(es / (em + 1e-20) + 1e-20)
        i = int(np.argmax(snr))
        return round(float(cs[i])), round(float(snr[i]), 1)

    rows = []
    for c in cues["cues"]:
        if c["sfx"] == "silence":
            continue
        a, b = S(c["t"]), S(c["t"] + 0.15)
        ps = float((ks[:, a:b] ** 2).sum(0).mean())
        pm = float((km[:, a:b] ** 2).sum(0).mean())
        hz, snr = best_band(a, S(c["t"] + 0.08))
        row = dict(id=c["id"], sfx=c["sfx"], lk_rel_db=round(10 * np.log10(ps / (pm + 1e-20) + 1e-20), 1),
                   best_band_hz=hz, best_band_snr_db=snr)
        if "dur" in c:
            t_end = min(c["t"] + c["dur"], gap0) if c["t"] < gap0 else c["t"] + c["dur"]
            hz2, snr2 = best_band(S(t_end - 0.15), S(t_end))
            row.update(culm_band_hz=hz2, culm_band_snr_db=snr2)
        rows.append(row)
    return rows


CUTS = (5.625, 7.5, 9.375, 11.25, 13.125, 18.75, 20.625, 22.5, 24.375, 26.25, 28.125)


def cut_marks(stems, beat):
    """¿La MÚSICA marca cada corte? Energía > 2 kHz de los stems musicales en los 150 ms del corte
    contra los mismos 150 ms de los beats con clap del compás anterior (beats 2 y 4)."""
    mus = hp(sum(stems[k] for k in MUSIC_STEMS), 2000.0, order=4)

    def en(t0):
        seg = mus[:, S(t0):S(t0 + 0.15)]
        return float((seg ** 2).mean())
    out = {}
    for t in CUTS:
        ref = np.mean([en(t - k * beat) for k in (1, 3)])
        out[f"{t:.3f}"] = round(float(10 * np.log10(en(t) / (ref + 1e-20))), 1)
    return out


def pump_depth(bus, bar, beat, bars, from_beat=1):
    """Profundidad del bombeo: envolvente RMS de 5 ms plegada sobre la fase del beat."""
    e = np.sqrt(np.maximum(signal.fftconvolve((bus ** 2).sum(0), np.ones(240) / 240, mode="same"), 0))
    acc = np.zeros(64)
    cnt = 0
    for b in bars:
        for k in range(from_beat, 4):
            idx = S(b * bar + k * beat) + (np.arange(64) * beat / 64 * SR).astype(int)
            acc += e[idx]
            cnt += 1
    p = acc / cnt
    return round(float(20 * np.log10(p.min() / p.max() + 1e-9)), 1)


def phone_loss(cues, x):
    """Parlante de celular (pasa-altos 450 Hz de 4.º orden + pasa-bajos 9 kHz): loudness por sección."""
    xt = lp(hp(x, 450.0, order=4), 9000.0, order=2)
    out = {}
    for s in cues["sections"]:
        out[s["id"]] = dict(full=round(lk(x, s["from"], s["to"]), 2), phone=round(lk(xt, s["from"], s["to"]), 2))
    return out


def stereo_report(x):
    m = 0.5 * (x[0] + x[1])
    s = 0.5 * (x[0] - x[1])
    out = {}
    for name, lo, hi in (("<120", 20, 120), ("120-2k", 120, 2000), (">2k", 2000, 20000)):
        sos = signal.butter(4, [lo, hi], "band", fs=SR, output="sos") if lo > 20 else \
            signal.butter(4, hi, "low", fs=SR, output="sos")
        em = float(np.mean(signal.sosfilt(sos, m) ** 2)) + 1e-20
        es = float(np.mean(signal.sosfilt(sos, s) ** 2)) + 1e-20
        out[f"side_mid_db_{name}"] = round(10 * np.log10(es / em), 1)
    out["corr_LR"] = round(float(np.corrcoef(x[0], x[1])[0, 1]), 3)
    h = hp(x, 8000.0, order=4)
    out["corr_LR_>8k"] = round(float(np.corrcoef(h[0], h[1])[0, 1]), 3)
    out["mono_loss_lu"] = round(lufs_integrated(np.vstack([m, m])) - lufs_integrated(x), 2)
    return out


# ---------------------------------------------------------------------------
# Gráficos
# ---------------------------------------------------------------------------

def _sections(ax, cues, alpha=0.10, labels=True):
    for s in cues["sections"]:
        ax.axvspan(s["from"], s["to"], color=SECTION_COLORS.get(s["id"], "#999"), alpha=alpha, lw=0)
        if labels:
            ax.text((s["from"] + s["to"]) / 2, 1.0, s["label"], transform=ax.get_xaxis_transform(), ha="center",
                    va="bottom", fontsize=8, color="#333")


def logspec(x, nfft=4096, hop=480, fmin=30.0, fmax=20000.0, nbins=420):
    m = x.sum(axis=0) * 0.5
    f, t, Z = signal.stft(m, SR, nperseg=nfft, noverlap=nfft - hop, boundary=None, padded=False)
    P = 20 * np.log10(np.abs(Z) + 1e-9)
    lf = np.geomspace(fmin, fmax, nbins)
    img = np.empty((nbins, P.shape[1]))
    for j in range(P.shape[1]):
        img[:, j] = np.interp(lf, f, P[:, j])
    return t, lf, img


def plots(x, cues, sync, stems, gap0, gap1, gr_by_bar, out_dir):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    T = x.shape[1] / SR
    t = np.arange(x.shape[1]) / SR
    files = []
    ticks = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]

    def yt(ax, lf, fs=None):
        ax.set_yticks([np.searchsorted(lf, f) for f in ticks])
        ax.set_yticklabels([f"{f // 1000}k" if f >= 1000 else str(f) for f in ticks], fontsize=fs)

    # --- forma de onda completa con secciones y cues ---
    fig, ax = plt.subplots(2, 1, figsize=(18, 6), sharex=True)
    for ch in range(2):
        hop = 240
        y = x[ch, :x.shape[1] // hop * hop].reshape(-1, hop)
        tt = np.arange(y.shape[0]) * hop / SR
        ax[ch].fill_between(tt, y.min(axis=1), y.max(axis=1), color="#1f4e79", lw=0)
        ax[ch].set_ylim(-1, 1)
        ax[ch].set_ylabel("LR"[ch])
        _sections(ax[ch], cues, labels=(ch == 0))
        for c in cues["cues"]:
            ax[ch].axvline(c["t"], color="#ff3d00", lw=0.4, alpha=0.5)
        for lvl in (-1, 1):
            ax[ch].axhline(lvl * 10 ** (-1 / 20), color="#c00", lw=0.5, ls="--")
    ax[1].set_xlabel("s")
    ax[1].set_xlim(0, T)
    fig.suptitle("promo.wav — forma de onda (líneas naranjas = cues, roja punteada = −1 dBFS)")
    fig.tight_layout()
    p = os.path.join(out_dir, "waveform.png")
    fig.savefig(p, dpi=110)
    plt.close(fig)
    files.append(p)

    # --- espectrograma completo ---
    ts, lf, img = logspec(x)
    fig, ax = plt.subplots(figsize=(18, 6))
    vmax = np.percentile(img, 99.7)
    ax.imshow(img, origin="lower", aspect="auto", extent=[ts[0], ts[-1], 0, len(lf)], cmap="magma",
              vmin=vmax - 80, vmax=vmax)
    yt(ax, lf)
    for s in cues["sections"]:
        ax.axvline(s["from"], color="w", lw=0.8, alpha=0.7)
        ax.text(s["from"] + 0.05, len(lf) * 0.97, s["label"], color="w", fontsize=8, va="top")
    ax.set_xlabel("s")
    ax.set_ylabel("Hz")
    ax.set_title("Espectrograma (STFT 4096, rango 80 dB)")
    fig.tight_layout()
    p = os.path.join(out_dir, "spectrogram.png")
    fig.savefig(p, dpi=110)
    plt.close(fig)
    files.append(p)

    # --- espectrograma por sección ---
    fig, axs = plt.subplots(2, 3, figsize=(18, 8))
    for ax, s in zip(axs.ravel(), cues["sections"]):
        a, b = S(max(0, s["from"] - 0.1)), S(min(T, s["to"] + 0.1))
        ts2, lf2, img2 = logspec(x[:, a:b], nfft=2048, hop=240)
        ax.imshow(img2, origin="lower", aspect="auto", extent=[s["from"] - 0.1, s["from"] - 0.1 + ts2[-1], 0, len(lf2)],
                  cmap="magma", vmin=vmax - 80, vmax=vmax)
        yt(ax, lf2, 7)
        for c in cues["cues"]:
            if s["from"] - 0.1 <= c["t"] <= s["to"] + 0.1:
                ax.axvline(c["t"], color="#00e5ff", lw=0.6, alpha=0.8)
        ax.set_title(f"{s['label']} ({s['from']:.3f}–{s['to']:.3f} s)", fontsize=10)
    fig.suptitle("Espectrograma por sección (cian = cues)")
    fig.tight_layout()
    p = os.path.join(out_dir, "spectrogram_sections.png")
    fig.savefig(p, dpi=100)
    plt.close(fig)
    files.append(p)

    # --- loudness momentáneo, short-term y reducción del limitador ---
    fig, ax = plt.subplots(figsize=(18, 4.5))
    tm, lm = lufs_curve(x, 0.4, 0.05)
    tsr, lsr = lufs_curve(x, 3.0, 0.1)
    ax.plot(tm, lm, color="#1f4e79", lw=0.8, label="momentáneo (400 ms)")
    ax.plot(tsr, lsr, color="#ff3d00", lw=1.5, label="short-term (3 s)")
    ax.axhline(-14, color="k", ls="--", lw=0.8, label="−14 LUFS")
    if gr_by_bar:
        for b, g in enumerate(gr_by_bar):
            ax.hlines(-44 + g * 2, b * 1.875, (b + 1) * 1.875, color="#7b2cbf", lw=2)
        ax.text(0.1, -43.5, "GR del limitador por compás (×2, base −44)", color="#7b2cbf", fontsize=8)
    _sections(ax, cues)
    ax.set_ylim(-45, -5)
    ax.set_xlim(0, T)
    ax.set_xlabel("s")
    ax.set_ylabel("LUFS")
    ax.legend(loc="lower right", fontsize=8)
    fig.tight_layout()
    p = os.path.join(out_dir, "loudness.png")
    fig.savefig(p, dpi=110)
    plt.close(fig)
    files.append(p)

    # --- zoom de los dos huecos (gancho y segunda ola) ---
    fig, axs = plt.subplots(2, 2, figsize=(18, 7))
    for col, (a_t, b_t, g0, g1, title) in enumerate(((3.0, 4.3, gap0, gap1, "gancho → DROP"),
                                                      (25.6, 26.9, 26.1328, 26.25, "valor → segunda ola"))):
        a, b = S(a_t), S(b_t)
        ax = axs[0, col]
        ax.plot(t[a:b], x[0, a:b], lw=0.4, color="#1f4e79")
        ax.plot(t[a:b], x[1, a:b], lw=0.4, color="#2bb6d6", alpha=0.7)
        ax.axvspan(g0, g1, color="#ff3d00", alpha=0.15)
        for c in cues["cues"]:
            if a_t <= c["t"] <= b_t:
                ax.axvline(c["t"], color="#ff3d00", lw=0.8)
                ax.text(c["t"], 0.95, c["id"], fontsize=7, rotation=90, va="top")
        ax.set_ylim(-1, 1)
        ax.set_title(title)
        ts3, lf3, img3 = logspec(x[:, a:b], nfft=1024, hop=96)
        axs[1, col].imshow(img3, origin="lower", aspect="auto", extent=[a_t, a_t + ts3[-1], 0, len(lf3)],
                           cmap="magma", vmin=vmax - 80, vmax=vmax)
        yt(axs[1, col], lf3, 7)
        axs[1, col].set_xlabel("s")
    fig.suptitle("Los dos huecos de semicorchea (el del gancho es de toda la mezcla; el del cierre, solo música)")
    fig.tight_layout()
    p = os.path.join(out_dir, "gap_drop_zoom.png")
    fig.savefig(p, dpi=110)
    plt.close(fig)
    files.append(p)

    # --- densidad del arreglo: RMS por stem ---
    if stems:
        fig, ax = plt.subplots(len(stems), 1, figsize=(18, 1.3 * len(stems) + 1), sharex=True)
        for axi, (name, st) in zip(ax, stems.items()):
            hop = 2400
            m = st.sum(axis=0)[: st.shape[1] // hop * hop].reshape(-1, hop)
            rms = 20 * np.log10(np.sqrt((m ** 2).mean(axis=1)) + 1e-9)
            tt = np.arange(len(rms)) * hop / SR
            axi.fill_between(tt, -60, rms, color="#1f4e79", alpha=0.8, lw=0)
            axi.set_ylim(-60, 0)
            axi.set_ylabel(name, rotation=0, ha="right", fontsize=9)
            _sections(axi, cues, labels=(axi is ax[0]))
            for s in cues["sections"]:
                axi.axvline(s["from"], color="k", lw=0.4)
        ax[-1].set_xlabel("s")
        ax[-1].set_xlim(0, T)
        fig.suptitle("Densidad del arreglo: RMS (dBFS, ventanas de 50 ms) por stem")
        fig.tight_layout()
        p = os.path.join(out_dir, "stems_density.png")
        fig.savefig(p, dpi=100)
        plt.close(fig)
        files.append(p)

    # --- error de sincronía por SFX (cresta fina y de cuerpo) ---
    if sync:
        fig, ax = plt.subplots(figsize=(18, 4))
        ids = [o["id"] for o in sync]
        xs = np.arange(len(ids))
        for off, key, col in ((-0.2, "fine_ms", "#2b9348"), (0.2, "body_ms", "#1f4e79")):
            v = [o[key] for o in sync]
            ax.bar(xs + off, v, width=0.4, color=[col if abs(e) <= 5 else "#d00000" for e in v],
                   label="cresta fina (|Hilbert| 2 ms)" if key == "fine_ms" else "cresta de cuerpo (RMS 10 ms)")
        ax.axhline(5, color="#d00000", ls="--", lw=0.8)
        ax.axhline(-5, color="#d00000", ls="--", lw=0.8)
        ax.set_xticks(xs)
        ax.set_xticklabels(ids, rotation=90, fontsize=7)
        ax.set_ylabel("cresta − cue (ms)")
        ax.set_ylim(-8, 8)
        ax.legend(fontsize=8)
        ax.set_title("Sincronía SFX vs cues, banda completa (tolerancia ±5 ms)")
        fig.tight_layout()
        p = os.path.join(out_dir, "sfx_sync.png")
        fig.savefig(p, dpi=100)
        plt.close(fig)
        files.append(p)
    return files


def plot_end(x, cues, endg, sting, eighth, out_dir, t0=27.0):
    """El final de cerca (27–30 s): forma de onda, espectrograma y RMS por corchea contra la banda de
    ±6 dB del último estribillo; la línea verde es el stinger."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    T = x.shape[1] / SR
    a = S(t0)
    t_st = sting["t"]
    fig, axs = plt.subplots(3, 1, figsize=(18, 10), sharex=True, gridspec_kw=dict(height_ratios=[1.2, 1.3, 1.0]))
    ax = axs[0]
    hop = 48
    for ch, col in ((0, "#1f4e79"), (1, "#2bb6d6")):
        y = x[ch, a:a + (x.shape[1] - a) // hop * hop].reshape(-1, hop)
        tt = t0 + np.arange(y.shape[0]) * hop / SR
        ax.fill_between(tt, y.min(axis=1), y.max(axis=1), color=col, lw=0, alpha=0.75 if ch else 0.9)
    for c in cues["cues"]:
        if c["t"] >= t0 - 0.05:
            ax.axvline(c["t"], color="#ff3d00", lw=0.9)
            ax.text(c["t"] + 0.01, 0.97, c["id"], fontsize=8, va="top", color="#ff3d00")
    for lvl in (-1, 1):
        ax.axhline(lvl * 10 ** (-1 / 20), color="#c00", lw=0.5, ls="--")
    ax.set_ylim(-1, 1)
    ax.set_ylabel("forma de onda")
    # espectrograma
    ts, lf, img = logspec(x[:, a:], nfft=2048, hop=120)
    vmax = np.percentile(img, 99.7)
    axs[1].imshow(img, origin="lower", aspect="auto", extent=[t0 + ts[0], t0 + ts[-1], 0, len(lf)], cmap="magma",
                  vmin=vmax - 80, vmax=vmax)
    ticks = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
    axs[1].set_yticks([np.searchsorted(lf, f) for f in ticks])
    axs[1].set_yticklabels([f"{f // 1000}k" if f >= 1000 else str(f) for f in ticks], fontsize=8)
    axs[1].set_ylabel("Hz")
    # RMS por corchea (toda la grilla) + RMS de 10 ms + la banda de tolerancia
    ax = axs[2]
    e10 = np.sqrt(np.maximum(signal.fftconvolve((x[:, a:] ** 2).mean(0), np.ones(480) / 480, mode="same"), 0))
    tt = t0 + np.arange(len(e10)) / SR
    ax.plot(tt[::48], todb(e10[::48] + 1e-12), color="#8a8f98", lw=0.6, label="RMS 10 ms")
    for k0 in range(int(np.floor(t0 / eighth)), int(np.ceil(T / eighth))):
        e0, e1 = k0 * eighth, min((k0 + 1) * eighth, T)
        if e1 <= t0:
            continue
        ax.hlines(_rms_db(x, max(e0, t0), e1), max(e0, t0), e1, color="#1f4e79", lw=2.5)
    for r in endg["rows"]:
        ax.hlines(r["rms_dbfs"], r["t0"], r["t1"], color="#2b9348" if abs(r["rel_db"]) <= endg["tol_db"] else "#d00000",
                  lw=4)
    ref = endg["ref_dbfs"]
    ax.axhspan(ref - endg["tol_db"], ref + endg["tol_db"], xmin=0, xmax=1, color="#2b9348", alpha=0.08)
    ax.hlines(ref, *endg["ref_span"], color="#ff3d00", lw=2, label=f"ref 27,2–28,1 ({ref} dBFS)")
    ax.axhline(ref - endg["tol_db"], color="#2b9348", lw=0.8, ls="--", label="ref − 6 dB")
    ax.set_ylim(-90, 0)
    ax.set_ylabel("dBFS")
    ax.legend(loc="lower left", fontsize=8)
    for axi in axs:
        axi.axvline(t_st, color="#00c853", lw=1.2)
        for k in range(int(np.ceil(t0 / eighth)), int(T / eighth) + 1):
            axi.axvline(k * eighth, color="#999", lw=0.3, alpha=0.5)
    axs[0].text(t_st + 0.01, -0.95, f"stinger: cresta fina {sting['fine_ms']:+.1f} ms · cuerpo {sting['body_ms']:+.1f} ms",
                color="#00a040", fontsize=9)
    axs[2].set_xlabel("s")
    axs[2].set_xlim(t0, T)
    fig.suptitle("El final (27–30 s): groove liviano después del golpe de 28,125 y stinger en 29,531 "
                 "(verde: corcheas medidas; rojo: fuera de ±6 dB)")
    fig.tight_layout()
    p = os.path.join(out_dir, "final_zoom.png")
    fig.savefig(p, dpi=110)
    plt.close(fig)
    return p


# ---------------------------------------------------------------------------

def determinism(runs=2):
    """Corre build.py `runs` veces a archivos temporales y compara los SHA-256 con promo.wav."""
    tmp = tempfile.mkdtemp(prefix="promo_det_")
    hashes = []
    for i in range(runs):
        out = os.path.join(tmp, f"run{i}.wav")
        subprocess.run([sys.executable, os.path.join(HERE, "build.py"), "--out", out, "--no-stems", "--quiet"],
                       check=True)
        hashes.append(sha256(out))
    shutil.rmtree(tmp, ignore_errors=True)
    return hashes


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--wav", default=WAV)
    ap.add_argument("--determinism", action="store_true")
    ap.add_argument("--no-aac", action="store_true")
    ap.add_argument("--no-plots", action="store_true")
    ap.add_argument("--quick", action="store_true", help="sin códecs ni PNG")
    args = ap.parse_args(argv)
    if args.quick:
        args.no_aac = args.no_plots = True
    os.makedirs(OUT, exist_ok=True)
    cues = load_cues()
    song = build_song(cues)
    bar, beat = cues["bar"], cues["beat"]
    gap0, gap1 = song.times["gap0"], song.times["gap1"]
    rep, fails, warns = {}, [], []

    x, fmt = check_format(args.wav)
    rep["format"] = fmt
    if not fmt["ok"]:
        fails.append("formato")

    L = lufs_integrated(x)
    rep["lufs_integrated"] = round(L, 3)
    try:
        import pyloudnorm as pyln
        rep["lufs_pyloudnorm"] = round(float(pyln.Meter(SR).integrated_loudness(x.T)), 3)
    except Exception:  # pyloudnorm es opcional (solo cruce)
        rep["lufs_pyloudnorm"] = None
    if abs(L + 14.0) > 0.5:
        fails.append("LUFS")

    rep["true_peak_wav_dbtp_4x"] = round(true_peak_db(x, 4), 3)
    rep["true_peak_wav_dbtp_8x"] = round(true_peak_db(x, 8), 3)
    if max(rep["true_peak_wav_dbtp_4x"], rep["true_peak_wav_dbtp_8x"]) > -1.0:
        fails.append("TP wav")
    if not args.no_aac:
        cod = codec_checks(args.wav, OUT)
        if cod is not None:
            rep["codecs_extra"] = cod.pop("_extra", {})
            for name, r in rep["codecs_extra"].items():
                if "tp4" in r and r["tp4"] > -1.0:
                    warns.append(f"(informativo) {name}: true peak {r['tp4']} dBTP")
        rep["codecs"] = cod
        if cod is None:
            fails.append("sin ffmpeg para los códecs")
        else:
            for name, r in cod.items():
                if max(r["tp4"], r["tp8"]) > -1.0:
                    fails.append(f"TP {name}")
                elif max(r["tp4"], r["tp8"]) > -1.3:
                    warns.append(f"TP {name} con menos de 0,3 dB de margen")
                if r["samples"] != N_EXPECTED:
                    warns.append(f"{name}: {r['samples']} muestras")

    # huecos
    g = x[:, S(gap0) + ns(0.002):S(gap1) - ns(0.002)]
    drop = x[:, S(3.75):S(5.625)]
    rep["gap"] = dict(t0=gap0, t1=gap1, rms_dbfs=round(float(todb(np.sqrt((g ** 2).mean()))), 1),
                      peak_dbfs=round(float(todb(np.abs(g).max())), 1),
                      rel_to_drop_rms_db=round(float(todb(np.sqrt((g ** 2).mean())) - todb(np.sqrt((drop ** 2).mean()))), 1))
    if rep["gap"]["rms_dbfs"] > -45.0:
        fails.append("gap no silencioso")

    rep["clicks"] = click_scan(x)
    if rep["clicks"]["count"]:
        fails.append("clics")
    tail = x[:, -ns(0.010):]
    rep["end"] = dict(last10ms_peak_dbfs=round(float(todb(np.abs(tail).max())), 1),
                      last_sample=[float(x[0, -1]), float(x[1, -1])])
    if rep["end"]["last10ms_peak_dbfs"] > -60.0 or any(v != 0.0 for v in rep["end"]["last_sample"]):
        fails.append("clic final")

    # el final con beat (PLAN §12): groove liviano hasta el último beat y stinger en b(15, 4)
    rep["end_groove"] = end_groove(x, beat / 2)
    if not rep["end_groove"]["ok"]:
        fails.append(f"el final se cae: corchea en {rep['end_groove']['worst_t0']} a "
                     f"{rep['end_groove']['worst_rel_db']} dB del estribillo (±{END_TOL_DB:.0f})")
    rep["stinger"] = stinger_check(x, song.times["stinger"])
    if not rep["stinger"]["ok"]:
        fails.append(f"stinger fuera de ±{STINGER_TOL_MS:.0f} ms (fina {rep['stinger']['fine_ms']}, "
                     f"cuerpo {rep['stinger']['body_ms']})")

    secs = section_loudness(cues, x, gap0)
    rep["sections"] = secs
    d = {s["id"]: s["lufs"] for s in secs}
    rep["hook_vs_drop_lu"] = round(d["reveal"] - d["hook"], 2)
    rep["c0_vs_drop_lu"] = round(d["reveal"] - lufs_integrated(x[:, :S(bar)]), 2)
    if not (6.0 <= rep["hook_vs_drop_lu"] <= 8.0):
        fails.append("gancho vs drop fuera de 6–8 LU")

    stems = {}
    for name in STEM_NAMES:
        p = os.path.join(STEMS, f"{name}.wav")
        if os.path.exists(p):
            stems[name], _, _ = read_wav(p)
    info = {}
    pj = os.path.join(STEMS, "sfx_placement.json")
    if os.path.exists(pj):
        with open(pj, encoding="utf-8") as fh:
            info = json.load(fh).get("master", {})
    rep["master_chain"] = info

    bars = per_bar(x, stems, bar) if stems else []
    rep["bars"] = bars
    if bars:
        body = np.mean([bars[b]["lufs"] for b in range(3, 10)])
        rep["peaks_over_body_lu"] = dict(c2=round(bars[2]["lufs"] - body, 2), c14=round(bars[14]["lufs"] - body, 2),
                                         body_c3_c9=round(float(body), 2))
        if min(rep["peaks_over_body_lu"]["c2"], rep["peaks_over_body_lu"]["c14"]) < 1.0:
            fails.append("los dos picos no se destacan")
        elif min(rep["peaks_over_body_lu"]["c2"], rep["peaks_over_body_lu"]["c14"]) < 2.0:
            warns.append("picos < 2 LU sobre el cuerpo")
        rep["centroid_drop_vs_c3"] = dict(c2=bars[2]["centroid"], c3=bars[3]["centroid"])
        if bars[2]["centroid"] < bars[3]["centroid"]:
            warns.append("drop más oscuro que c3")
    rep["build_c1"] = build_curve(x, bar)
    if rep["build_c1"]["rise_lu"] < 4.0 or rep["build_c1"]["max_dip"] < -0.5:
        warns.append("el build de c1 no sube parejo 4 LU")

    sync, aud = [], []
    if "sfx" in stems:
        sync = sfx_sync(cues, stems["sfx"], gap0)
        wf = max(sync, key=lambda o: abs(o["fine_ms"]))
        wb = max(sync, key=lambda o: abs(o["body_ms"]))
        rep["sfx_sync"] = dict(count=len(sync), worst_fine=(wf["id"], wf["fine_ms"]), worst_body=(wb["id"], wb["body_ms"]),
                               mean_abs_fine=round(float(np.mean([abs(o["fine_ms"]) for o in sync])), 2),
                               mean_abs_body=round(float(np.mean([abs(o["body_ms"]) for o in sync])), 2),
                               rows=sync)
        if abs(wf["fine_ms"]) > 5.0 or abs(wb["body_ms"]) > 5.0:
            fails.append("sincronía SFX")
        for o in sync:
            if "culm_ms" in o and not (-30.0 <= o["culm_ms"] <= 0.5):
                fails.append(f"{o['id']} no culmina en su final ({o['culm_ms']} ms)")
            if "culm_ms" in o and o["end_db"] < o["burst_db"]:
                warns.append(f"{o['id']}: el final queda abajo del arranque")
        aud = sfx_audibility(cues, stems, gap0)
        rep["sfx_audibility"] = aud
        weak = [a for a in aud if max(a["best_band_snr_db"], a.get("culm_band_snr_db", -99.0)) < 3.0]
        if weak:
            warns.append("SFX sin banda propia ≥ 3 dB: " + ", ".join(a["id"] for a in weak))
        loud = [a for a in aud if a["lk_rel_db"] > 0.0]      # PLAN §10: «por debajo de la música»
        if loud:
            warns.append("SFX por encima de la música (LK 150 ms): " + ", ".join(a["id"] for a in loud))
    if "fx" in stems:
        rep["music_risers_peak_ms"] = music_risers(song, stems["fx"])
        for k, v in rep["music_risers_peak_ms"].items():
            if v < -20.0:
                warns.append(f"{k} culmina {v} ms antes del hueco")
    if stems:
        rep["lead_vs_rest_400_3k"] = lead_vs_rest(stems, bar)
        low = [k for k, v in rep["lead_vs_rest_400_3k"].items() if v["vs_rest_db"] < 4.0]
        if low:
            warns.append("lead < +4 dB sobre el resto en " + ", ".join(low))
        rep["cuts_music_hf_vs_clap_db"] = cut_marks(stems, beat)
        flojos = [k for k, v in rep["cuts_music_hf_vs_clap_db"].items() if v < 4.0]
        if flojos:
            warns.append("cortes con < +4 dB en > 2 kHz: " + ", ".join(flojos))
        rep["bass_pump_db"] = dict(drop_from_beat2=pump_depth(stems["bass"], bar, beat, [2], 1),
                                   exp=pump_depth(stems["bass"], bar, beat, [3, 4, 5, 6], 0))
        if rep["bass_pump_db"]["drop_from_beat2"] > -15.0:
            warns.append("bombeo del bajo en el drop < 15 dB")
        ssum = sum(stems.values())
        n = min(ssum.shape[1], x.shape[1])
        res = x[:, :n] - ssum[:, :n]
        rep["stems_sum_vs_master_db"] = round(float(todb(np.sqrt((res ** 2).mean())) - todb(np.sqrt((x ** 2).mean()))), 1)
    rep["phone"] = phone_loss(cues, x)
    rep["stereo"] = stereo_report(x)
    gr = info.get("limiter_gr_max_db")
    if gr is not None and gr >= 3.0:
        warns.append(f"limitador del master con {gr} dB de reducción")
    if gr is not None and info["limiter_gr_by_bar"][2] > 2.5:
        warns.append(f"limitador con {info['limiter_gr_by_bar'][2]} dB en el drop")
    tgr = info.get("total_gr_max_db")
    if tgr is not None and tgr >= 3.0:
        warns.append(f"reducción total instantánea (etapa rápida + limitador) de {tgr} dB (objetivo < 3)")
    m150 = info.get("total_gr_mean150_by_bar")
    if m150 and max(m150) > 2.5:
        warns.append(f"reducción media > 2,5 dB en los 150 ms de algún downbeat ({max(m150)} dB)")
    # PLR por compás (pico de muestra − loudness K del compás): cuánto «respira» cada tramo
    rep["plr_by_bar"] = [round(float(todb(np.abs(x[:, S(b * bar):S((b + 1) * bar)]).max())) - lk(x, b * bar, (b + 1) * bar), 1)
                         for b in range(16)]

    if not args.no_plots:
        rep["plots"] = plots(x, cues, sync, stems, gap0, gap1, info.get("limiter_gr_by_bar"), OUT)
        rep["plots"].append(plot_end(x, cues, rep["end_groove"], rep["stinger"], beat / 2, OUT))

    rep["sha256"] = sha256(args.wav)
    if args.determinism:
        hs = determinism(2)
        rep["determinism"] = dict(run_hashes=hs, wav_hash=rep["sha256"], ok=(hs[0] == hs[1] == rep["sha256"]))
        if not rep["determinism"]["ok"]:
            fails.append("determinismo")

    rep["fails"] = fails
    rep["warnings"] = warns
    rep["ok"] = not fails
    with open(os.path.join(OUT, "report.json"), "w", encoding="utf-8") as fh:
        json.dump(rep, fh, indent=1, ensure_ascii=False)

    # ---- resumen legible ----
    print(f"formato      {fmt}")
    print(f"LUFS         {rep['lufs_integrated']} (pyloudnorm {rep['lufs_pyloudnorm']})")
    print(f"TP wav       4x {rep['true_peak_wav_dbtp_4x']}  8x {rep['true_peak_wav_dbtp_8x']} dBTP")
    for name, r in (rep.get("codecs") or {}).items():
        print(f"TP {name:13s} 4x {r['tp4']:.2f}  8x {r['tp8']:.2f} dBTP  LUFS {r['lufs']:.2f}  muestras {r['samples']}")
    for name, r in (rep.get("codecs_extra") or {}).items():
        print(f"(info) {name:9s} " + (f"TP 4x {r['tp4']:.2f} dBTP  LUFS {r['lufs']:.2f}  muestras {r['samples']}"
                                       if "tp4" in r else r.get("error", "")))
    if info:
        print(f"limitador    GR máx {info['limiter_gr_max_db']} dB en {info['limiter_gr_max_t']} s; por compás "
              f"{info['limiter_gr_by_bar']}")
        print(f"etapa rápida GR máx {info.get('fast_gr_max_db')} dB; por compás {info.get('fast_gr_by_bar')}")
        print(f"GR total     máx {info.get('total_gr_max_db')} dB; media 150 ms tras cada downbeat "
              f"{info.get('total_gr_mean150_by_bar')}")
        print(f"guarda códec {info.get('codec_guard')}  techo mínimo {info.get('ceiling_min_dbtp')} dBTP")
    print(f"gap          {rep['gap']}")
    print(f"final        {rep['end']}   clics {rep['clicks']['count']}")
    eg = rep["end_groove"]
    print(f"groove final RMS por corchea {eg['span'][0]}–{eg['span'][1]} vs {eg['ref_span'][0]}–{eg['ref_span'][1]} "
          f"({eg['ref_dbfs']} dBFS): " + "  ".join(f"{r['t0']:.3f} {r['rel_db']:+.1f}" for r in eg["rows"])
          + f"   peor {eg['worst_rel_db']:+.1f} dB (±{eg['tol_db']:.0f})")
    st = rep["stinger"]
    print(f"stinger      {st['t']} s: cresta fina {st['fine_ms']:+.2f} ms · cuerpo {st['body_ms']:+.2f} ms · onset "
          f"{st['onset_ms']:+.2f} ms · {st['over_groove_db']:+.1f} dB sobre el groove · cola RMS 10 ms "
          f"{st['tail_rms10ms_dbfs']}")
    print("secciones    " + "  ".join(f"{s['id']} {s['lufs']}" for s in secs))
    print(f"gancho vs drop {rep['hook_vs_drop_lu']} LU   (c0 vs drop {rep['c0_vs_drop_lu']} LU)")
    if bars:
        print("compases     " + " ".join(f"c{b['bar']}:{b['lufs']:.1f}" for b in bars))
        print(f"picos        {rep['peaks_over_body_lu']}   centroide c2/c3 {rep['centroid_drop_vs_c3']}")
    print(f"build c1     {rep['build_c1']}")
    print(f"PLR compás   {rep['plr_by_bar']}")
    if sync:
        ss = rep["sfx_sync"]
        print(f"SFX sync     peor fina {ss['worst_fine']} · peor cuerpo {ss['worst_body']} · media |fina| "
              f"{ss['mean_abs_fine']} ms, |cuerpo| {ss['mean_abs_body']} ms")
        for o in sync:
            if "culm_ms" in o:
                print(f"  {o['id']:12s} culmina {o['culm_ms']:+.1f} ms antes de {o['culm_t_end']}  arranque "
                      f"{o['burst_db']} dB → final {o['end_db']} dB  perfil {o['profile_db']}")
    if "music_risers_peak_ms" in rep:
        print(f"risers       {rep['music_risers_peak_ms']}")
    if stems:
        print("lead 400-3k  " + "  ".join(f"{k} {v['vs_rest_db']:+.1f}" for k, v in rep["lead_vs_rest_400_3k"].items()))
        print("cortes >2k   " + "  ".join(f"{k} {v:+.1f}" for k, v in rep["cuts_music_hf_vs_clap_db"].items()))
        print(f"bombeo bajo  {rep['bass_pump_db']}   suma stems − master {rep['stems_sum_vs_master_db']} dB")
    if aud:
        print("SFX (LK150 rel · mejor banda 80 ms):")
        print("  " + "  ".join(f"{a['id']} {a['lk_rel_db']:+.0f}/{a['best_band_snr_db']:+.0f}@{a['best_band_hz']}"
                               + (f"(culm {a['culm_band_snr_db']:+.0f}@{a['culm_band_hz']})" if "culm_band_hz" in a else "")
                               for a in aud))
    print("celular      " + "  ".join(f"{k} {v['full']:.1f}→{v['phone']:.1f}" for k, v in rep["phone"].items()))
    print(f"estéreo      {rep['stereo']}")
    if args.determinism:
        print(f"determinismo {rep['determinism']}")
    print(f"sha256       {rep['sha256']}")
    for w in warns:
        print(f"aviso        {w}")
    print("RESULTADO    " + ("OK" if not fails else "FALLA: " + ", ".join(fails)))
    return rep


if __name__ == "__main__":
    main()
