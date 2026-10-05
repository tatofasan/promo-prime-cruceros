"""
critica_final_v2.py — verificación INDEPENDIENTE (crítico técnico) de la entrega v2 con el final con beat.

    python audio/review/critica_final_v2.py            # todo (incluye códecs con ffmpeg)
    python audio/review/critica_final_v2.py --sin-codec

Solo lee: no toca la música ni los stems. Escribe en audio/review/out/critica_final_v2/.

Para no heredar los errores del productor, los medidores están escritos acá de nuevo:
- lector de WAV propio (chunks RIFF, PCM 24 bit) que además devuelve los enteros crudos;
- BS.1770-4 con los coeficientes K de la norma a 48 kHz (bloques de 400 ms al 75 %, compuertas −70 y −10);
- true peak ×4 y ×8 con un FIR propio (Kaiser, 255/511 coeficientes), además del de ffmpeg (ebur128);
- detectores de cresta propios (RMS rectangular de 5 ms, pendiente del RMS de 1 ms, pico de muestra, flujo
  espectral), distintos del |Hilbert| 2 ms + RMS Hann 10 ms que usan sfx.py y analyze.py.
De arrangement.py/sfx.py solo se usan la grilla y el render AISLADO de cada SFX (para saber dónde está la
cresta de cada sonido y ubicarlo en el stem por correlación cruzada).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile

import numpy as np
from scipy import signal

AQUI = os.path.dirname(os.path.abspath(__file__))
AUDIO = os.path.dirname(AQUI)
RAIZ = os.path.dirname(AUDIO)
WAV = os.path.join(RAIZ, "public", "audio", "promo.wav")
STEMS = os.path.join(AUDIO, "stems")
CUES = os.path.join(RAIZ, "src", "cues.json")
SALIDA = os.path.join(AQUI, "out", "critica_final_v2")
SR = 48000
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def S(t):
    return int(round(t * SR))


def db(v):
    return 20 * np.log10(np.maximum(np.abs(v), 1e-20))


# ---------------------------------------------------------------------------
# WAV propio
# ---------------------------------------------------------------------------

def leer_wav(path):
    """Devuelve (x float64 (ch, n), info del header, enteros crudos o None)."""
    with open(path, "rb") as fh:
        b = fh.read()
    if b[:4] != b"RIFF" or b[8:12] != b"WAVE":
        raise ValueError("no es RIFF/WAVE")
    pos, fmt, data, chunks = 12, None, None, []
    while pos + 8 <= len(b):
        cid, size = b[pos:pos + 4], struct.unpack("<I", b[pos + 4:pos + 8])[0]
        chunks.append((cid.decode("latin1"), size))
        body = b[pos + 8:pos + 8 + size]
        if cid == b"fmt ":
            tag, ch, sr, brate, align, bits = struct.unpack("<HHIIHH", body[:16])
            if tag == 0xFFFE:
                tag = struct.unpack("<H", body[24:26])[0]
            fmt = dict(tag=tag, ch=ch, sr=sr, byte_rate=brate, align=align, bits=bits)
        elif cid == b"data":
            data = body
        pos += 8 + size + (size % 2)
    info = dict(fmt, chunks=chunks, riff_size=struct.unpack("<I", b[4:8])[0], file_bytes=len(b),
                data_bytes=len(data))
    ch, bits = fmt["ch"], fmt["bits"]
    crudo = None
    if fmt["tag"] == 3:
        x = np.frombuffer(data, dtype="<f4").astype(np.float64)
    elif bits == 24:
        u = np.frombuffer(data, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
        v = u[:, 0] | (u[:, 1] << 8) | (u[:, 2] << 16)
        v = np.where(v >= 1 << 23, v - (1 << 24), v)
        crudo = v.reshape(-1, ch).T.copy()
        x = v.astype(np.float64) / 8388608.0
    elif bits == 16:
        x = np.frombuffer(data, dtype="<i2").astype(np.float64) / 32768.0
    else:
        raise ValueError(f"formato no previsto: {fmt}")
    info["samples"] = len(data) // fmt["align"]
    info["resto_bytes"] = len(data) % fmt["align"]
    return x.reshape(-1, ch).T.copy(), info, crudo


# ---------------------------------------------------------------------------
# BS.1770-4 y true peak propios
# ---------------------------------------------------------------------------

_K1 = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585])
_K2 = ([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])


def k_filtro(x):
    return signal.lfilter(*_K2, signal.lfilter(*_K1, x, axis=-1), axis=-1)


def lufs_int(x):
    y = k_filtro(x)
    n, blk, hop = y.shape[1], S(0.4), S(0.1)
    nb = 1 + (n - blk) // hop
    cs = np.concatenate([np.zeros((y.shape[0], 1)), np.cumsum(y ** 2, axis=1)], axis=1)
    st = np.arange(nb) * hop
    z = ((cs[:, st + blk] - cs[:, st]) / blk).sum(axis=0)
    l = -0.691 + 10 * np.log10(z + 1e-30)
    g1 = l > -70.0
    rel = -0.691 + 10 * np.log10(z[g1].mean()) - 10.0
    g2 = g1 & (l > rel)
    return float(-0.691 + 10 * np.log10(z[g2].mean()))


def lk_tramo(x, t0, t1):
    """Loudness K sin compuertas de un tramo corto."""
    a0 = max(0, S(t0) - S(0.5))   # margen para que el filtro K arranque asentado
    y = k_filtro(x[:, a0:S(t1)])[:, S(t0) - a0:]
    return float(-0.691 + 10 * np.log10((y ** 2).mean(axis=1).sum() + 1e-30))


def _fir_os(os_):
    taps = 64 * os_ - 1
    return signal.firwin(taps, 1.0 / os_, window=("kaiser", 10.0)) * os_


def true_peak(x, os_=4, env=False):
    h = _fir_os(os_)
    y = signal.upfirdn(h, x, up=os_, axis=-1)
    d = (len(h) - 1) // 2
    y = y[:, d:d + x.shape[1] * os_]
    a = np.abs(y).max(axis=0)
    if env:
        return a.reshape(-1, os_).max(axis=1)
    return float(db(a.max())), int(np.argmax(a) // os_)


def ffmpeg(args):
    subprocess.run(["ffmpeg", "-y", "-v", "error", *args], check=True)


def ffmpeg_ebur128(path):
    """Integrado y true peak según el filtro ebur128 de ffmpeg (medidor de terceros)."""
    r = subprocess.run(["ffmpeg", "-nostats", "-hide_banner", "-i", path, "-af", "ebur128=peak=true+sample",
                        "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    txt = r.stderr
    summ = txt[txt.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+) LUFS", summ)
    tp = re.search(r"True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS", summ)
    sp = re.search(r"Sample peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS", summ)
    return dict(I=float(i.group(1)) if i else None, tp=float(tp.group(1)) if tp else None,
                sample_peak=float(sp.group(1)) if sp else None)


# ---------------------------------------------------------------------------
# Detectores propios
# ---------------------------------------------------------------------------

def rms_rect(x, win):
    """RMS centrado con ventana rectangular (L²+R²)."""
    e = (np.atleast_2d(x) ** 2).sum(axis=0)
    n = max(1, S(win))
    k = np.ones(n) / n
    return np.sqrt(np.maximum(np.convolve(e, k, mode="same"), 0.0))


def onset_pendiente(x, lo, hi, win=0.001):
    """Instante de máxima subida del RMS de 1 ms (en dB por ms)."""
    e = db(rms_rect(x, win) + 1e-12)
    k = S(win)
    d = e[k:] - e[:-k]
    seg = d[lo - k:hi - k]
    return lo + int(np.argmax(seg))


def flujo_espectral(x, lo, hi, nfft=512, hop=24):
    """Onset por flujo espectral (rectificado) en una ventana; devuelve la muestra del máximo."""
    m = np.atleast_2d(x).mean(axis=0)
    a0, a1 = max(0, lo - nfft), min(len(m), hi + nfft)
    f, t, Z = signal.stft(m[a0:a1], fs=SR, nperseg=nfft, noverlap=nfft - hop, boundary=None, padded=False)
    mag = np.log1p(1000 * np.abs(Z))
    fl = np.maximum(np.diff(mag, axis=1), 0).sum(axis=0)
    centros = a0 + (np.arange(1, mag.shape[1]) * hop + nfft // 2)
    sel = (centros >= lo) & (centros < hi)
    return int(centros[sel][np.argmax(fl[sel])])


# ---------------------------------------------------------------------------
# Controles
# ---------------------------------------------------------------------------

def control_formato(info):
    return dict(sr=info["sr"], bits=info["bits"], canales=info["ch"], muestras=info["samples"],
                resto_bytes=info["resto_bytes"], chunks=info["chunks"], bytes_archivo=info["file_bytes"],
                riff_ok=info["riff_size"] + 8 == info["file_bytes"],
                ok=(info["sr"] == 48000 and info["bits"] == 24 and info["ch"] == 2 and info["samples"] == 1_440_000
                    and info["resto_bytes"] == 0))


def control_codecs(path, x_ref):
    tmp = tempfile.mkdtemp(prefix="crit_codec_")
    res = {}
    try:
        enc = {}
        for nombre, entrada, br in (("aac320", path, "320k"), ("aac128", path, "128k"), ("aac320_a_128", None, "128k"),
                                    ("aac256", path, "256k"), ("aac96", path, "96k"), ("aac320_a_96", None, "96k")):
            src = enc["aac320"] if entrada is None else entrada
            m4a = os.path.join(tmp, f"{nombre}.m4a")
            ffmpeg(["-i", src, "-c:a", "aac", "-b:a", br, m4a])
            enc[nombre] = m4a
            dec = os.path.join(tmp, f"{nombre}.wav")
            ffmpeg(["-i", m4a, "-c:a", "pcm_f32le", "-ar", "48000", dec])
            y, _, _ = leer_wav(dec)
            tp4, k4 = true_peak(y, 4)
            tp8, _ = true_peak(y, 8)
            n = min(y.shape[1], x_ref.shape[1])
            # ¿el decodificado está alineado con el WAV? (correlación en el drop)
            a, b = S(3.6), S(3.9)
            c = signal.correlate(y[0, a:b], x_ref[0, a:b], mode="full")
            lag = int(np.argmax(c) - (b - a - 1))
            eb = ffmpeg_ebur128(dec)
            res[nombre] = dict(tp4_dbtp=round(tp4, 2), tp4_t=round(k4 / SR, 3), tp8_dbtp=round(tp8, 2),
                               lufs=round(lufs_int(y), 2), muestras=int(y.shape[1]), desfase_muestras=lag,
                               ffmpeg_tp=eb["tp"], ffmpeg_I=eb["I"],
                               ultima_muestra=[float(v) for v in y[:, n - 1]],
                               pico_ultimos_10ms_dbfs=round(float(db(np.abs(y[:, n - S(0.01):n]).max())), 1))
        # el camino real de render.mjs: mp4 con -shortest contra un video de 30,000 s
        try:
            vid = os.path.join(tmp, "v.mp4")
            ffmpeg(["-f", "lavfi", "-i", "color=c=black:s=64x36:r=60:d=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", vid])
            mux = os.path.join(tmp, "mux.mp4")
            ffmpeg(["-i", vid, "-i", path, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "320k", "-ar", "48000",
                    "-c:v", "copy", "-movflags", "+faststart", "-shortest", mux])
            dec = os.path.join(tmp, "mux.wav")
            ffmpeg(["-i", mux, "-vn", "-c:a", "pcm_f32le", "-ar", "48000", dec])
            y, _, _ = leer_wav(dec)
            tp4, k4 = true_peak(y, 4)
            res["render_mjs_mp4"] = dict(tp4_dbtp=round(tp4, 2), tp4_t=round(k4 / SR, 3), muestras=int(y.shape[1]),
                                         pico_ultimos_10ms_dbfs=round(float(db(np.abs(y[:, -S(0.01):]).max())), 1))
        except Exception as exc:
            res["render_mjs_mp4"] = dict(error=str(exc)[:120])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return res


def _corcheas(t0, t1, eighth):
    k0 = int(np.floor(t0 / eighth + 1e-9))
    out = []
    k = k0
    while k * eighth < t1 - 1e-9:
        out.append((k * eighth, (k + 1) * eighth))
        k += 1
    return out


def control_groove(x, drums, cues):
    beat = cues["beat"]
    eighth = beat / 2
    rms = lambda z, a, b: float(db(np.sqrt((z[:, S(a):S(b)] ** 2).mean())))
    # referencia: el último estribillo antes del golpe final (los dos rangos: el del productor y el de grilla)
    ref_prod = rms(x, 27.2, 28.1)
    ref_grid = rms(x, 27.1875, 28.125)
    filas = []
    for a, b in _corcheas(27.1875, 30.0, eighth):
        v = rms(x, a, b)
        vd = rms(drums, a, b)
        filas.append(dict(t0=round(a, 5), rms_dbfs=round(v, 2), rel_ref_prod=round(v - ref_prod, 2),
                          rel_ref_grid=round(v - ref_grid, 2), lk=round(lk_tramo(x, a, b), 2),
                          drums_dbfs=round(vd, 2)))
    groove = [f for f in filas if 28.125 - 1e-9 <= f["t0"] < 29.53125 - 1e-9]
    # recorte exacto del productor (28,2–29,5 con los bordes recortados) para comparar con su tabla
    prod = []
    for a, b in _corcheas(28.2, 29.5, eighth):
        a2, b2 = max(a, 28.2), min(b, 29.5)
        prod.append(dict(t0=round(a2, 4), rel=round(rms(x, a2, b2) - ref_prod, 2)))

    # ¿hay beat? bombo por banda (< 150 Hz) en el stem de batería y en el master: cresta del RMS de 10 ms
    def lowband(z):
        sos = signal.butter(4, 150, "lp", fs=SR, output="sos")
        return rms_rect(signal.sosfiltfilt(sos, z, axis=-1), 0.01)

    def hiband(z):
        sos = signal.butter(4, 6000, "hp", fs=SR, output="sos")
        return rms_rect(signal.sosfiltfilt(sos, z, axis=-1), 0.004)

    a0 = S(26.0)
    lo_d, lo_m = lowband(drums[:, a0:]), lowband(x[:, a0:])
    hi_d, hi_m = hiband(drums[:, a0:]), hiband(x[:, a0:])
    beats = []
    for k in range(int(round(27.1875 / beat)), int(round(30.0 / beat))):
        t = k * beat
        i0 = S(t) - a0
        w = (i0 - S(0.02), i0 + S(0.04))
        pre = (i0 - S(0.12), i0 - S(0.05))
        beats.append(dict(t=round(t, 5),
                          kick_drums_db=round(float(db(lo_d[w[0]:w[1]].max())), 1),
                          kick_drums_contraste_db=round(float(db(lo_d[w[0]:w[1]].max()) - db(np.median(lo_d[pre[0]:pre[1]]))), 1),
                          kick_master_contraste_db=round(float(db(lo_m[w[0]:w[1]].max()) - db(np.median(lo_m[pre[0]:pre[1]]))), 1)))
    # shaker / hats: modulación por semicorchea arriba de 6 kHz (pico de cada semicorchea vs. valle)
    step = beat / 4
    semis = []
    for k in range(int(round(27.1875 / step)), int(round(29.53125 / step))):
        t = k * step
        i0 = S(t) - a0
        seg = hi_d[i0 - S(0.005):i0 + S(step) - S(0.005)]
        semis.append(dict(t=round(t, 5), pico_db=round(float(db(seg.max())), 1),
                          mod_db=round(float(db(seg.max()) - db(seg.min() + 1e-9)), 1)))
    pre_mod = [s["mod_db"] for s in semis if s["t"] < 28.125 - 1e-9]
    post_mod = [s["mod_db"] for s in semis if s["t"] >= 28.125 + 0.1]
    pre_pk = [s["pico_db"] for s in semis if s["t"] < 28.125 - 1e-9]
    post_pk = [s["pico_db"] for s in semis if s["t"] >= 28.125 + 0.1]
    worst = max(groove, key=lambda f: abs(f["rel_ref_grid"]))
    return dict(ref_prod_27_2_28_1=round(ref_prod, 2), ref_grilla_27_1875_28_125=round(ref_grid, 2),
                corcheas=filas, peor_groove=worst, recorte_productor=prod, beats=beats,
                semicorcheas_hf=dict(mod_pre_mediana=round(float(np.median(pre_mod)), 1),
                                     mod_post_mediana=round(float(np.median(post_mod)), 1),
                                     pico_pre_mediana=round(float(np.median(pre_pk)), 1),
                                     pico_post_mediana=round(float(np.median(post_pk)), 1),
                                     min_mod_post=round(float(np.min(post_mod)), 1)),
                ok=bool(all(abs(f["rel_ref_grid"]) <= 6.0 for f in groove)))


def control_stinger(x, drums, t_st):
    a0 = S(t_st - 1.0)
    seg, segd = x[:, a0:], drums[:, a0:]
    k0 = S(t_st) - a0
    w50 = (k0 - S(0.05), k0 + S(0.05) + 1)
    w30 = (k0 - S(0.03), k0 + S(0.03) + 1)
    r5 = rms_rect(seg, 0.005)
    r20 = rms_rect(seg, 0.020)
    ms = lambda k: round((k - k0) / SR * 1000, 2)
    sos_hf = signal.butter(4, 2000, "hp", fs=SR, output="sos")
    r5hf = rms_rect(signal.sosfiltfilt(sos_hf, seg, axis=-1), 0.005)
    pk = np.abs(seg).max(axis=0)
    det = dict(
        cresta_rms5ms=ms(w50[0] + int(np.argmax(r5[w50[0]:w50[1]]))),
        cresta_rms20ms=ms(w50[0] + int(np.argmax(r20[w50[0]:w50[1]]))),
        pico_muestra=ms(w50[0] + int(np.argmax(pk[w50[0]:w50[1]]))),
        onset_pendiente_1ms=ms(onset_pendiente(seg, *w30)),
        onset_flujo_espectral=ms(flujo_espectral(seg, *w30)),
        cresta_hf2k_rms5ms=ms(w50[0] + int(np.argmax(r5hf[w50[0]:w50[1]]))),
        drums_onset_pendiente=ms(onset_pendiente(segd, *w30)),
        drums_cresta_rms5ms=ms(w50[0] + int(np.argmax(rms_rect(segd, 0.005)[w50[0]:w50[1]]))),
    )
    # umbral: primer instante en que el RMS de 1 ms pasa la mediana de los 150 ms previos + 10 dB
    r1 = db(rms_rect(seg, 0.001))
    base = float(np.median(r1[k0 - S(0.15):k0 - S(0.01)]))
    idx = np.flatnonzero(r1[k0 - S(0.03):k0 + S(0.03)] > base + 10.0)
    det["onset_umbral_+10dB"] = ms(k0 - S(0.03) + int(idx[0])) if len(idx) else None
    # ¿se despega del groove? cresta de 20 ms vs. la mediana de los beats 2 y 3 del groove
    def cresta(t, w=0.03):
        k = S(t) - a0
        return float(db(r20[k - S(0.01):k + S(w)].max()))
    st = cresta(t_st)
    b2, b3 = cresta(t_st - 0.9375), cresta(t_st - 0.46875)
    golpe = float(db(rms_rect(x[:, S(28.125) - S(0.05):S(28.125) + S(0.1)], 0.02).max()))
    # el TRANSITORIO se juzga con los detectores de arranque y la cresta corta (5 ms). La cresta de 20 ms
    # centrada cae ~+10 ms después de cualquier arranque abrupto por construcción (la ventana entera
    # queda adentro del golpe recién ahí), así que se informa pero no decide.
    criterio = ("cresta_rms5ms", "onset_pendiente_1ms", "onset_flujo_espectral", "onset_umbral_+10dB")
    vals = [det[k] for k in criterio if det.get(k) is not None]
    # ¿se oye como acento? loudness K de 150 ms y > 2 kHz (80 ms) del stinger contra los beats del final
    sos_hf2 = signal.butter(4, 2000, "hp", fs=SR, output="sos")
    def acento(t):
        k = S(t)
        h = signal.sosfiltfilt(sos_hf2, x[:, k - S(0.2):k + S(0.1)], axis=-1)[:, S(0.2):S(0.2) + S(0.08)]
        return round(lk_tramo(x, t, t + 0.15), 2), round(float(db(np.sqrt((h ** 2).mean()))), 2)
    beats = {f"{t:.5f}": acento(t) for t in (27.65625, 28.125, 28.59375, 29.0625, t_st)}
    return dict(t=t_st, detectores_ms=det, criterio=list(criterio), peor_ms=max(vals, key=abs),
                base_previa_1ms_db=round(base, 1),
                cresta20_db=round(st, 1), beat2_db=round(b2, 1), beat3_db=round(b3, 1),
                sobre_beats_db=round(st - max(b2, b3), 1), golpe_28_125_db=round(golpe, 1),
                lk150_y_hf2k_por_beat=beats,
                ok=bool(all(abs(v) <= 5.0 for v in vals)))


def escaneo_clics(x, thr=12.0):
    """Clics en TODO el archivo: picos aislados arriba de 10 kHz que superan `thr` veces su RMS local de
    20 ms (otro detector que el de analyze.py: filtro de fase cero y umbral por canal)."""
    sos = signal.butter(4, 10000, "hp", fs=SR, output="sos")
    h = np.abs(signal.sosfiltfilt(sos, x, axis=-1)).max(axis=0)
    w = S(0.02)
    loc = np.sqrt(np.maximum(np.convolve(h ** 2, np.ones(w) / w, mode="same"), 0.0)) + 1e-9
    idx = np.flatnonzero((h / loc > thr) & (h > 10 ** (-60 / 20)))
    grupos = []
    for i in idx:
        if not grupos or i - grupos[-1] > S(0.005):
            grupos.append(int(i))
    return dict(cantidad=len(grupos), t=[round(g / SR, 4) for g in grupos[:30]])


def control_final(x, crudo):
    n = x.shape[1]
    tail = {}
    for t in (29.6, 29.7, 29.75, 29.8, 29.85, 29.9, 29.95, 29.98, 29.99):
        seg = x[:, S(t):min(n, S(t + 0.01))]
        tail[f"{t:.2f}"] = round(float(db(np.sqrt((seg ** 2).mean()) + 1e-20)), 1)
    last = crudo[:, -8:].tolist() if crudo is not None else None
    # clic = salto de muestra a muestra mucho más grande que lo que trae la señal alrededor
    d = np.abs(np.diff(x, axis=1)).max(axis=0)
    loc = np.sqrt(np.convolve(d ** 2, np.ones(S(0.005)) / S(0.005), mode="same")) + 1e-9
    a = S(29.0)
    rat = d[a:] / loc[a:]
    sos = signal.butter(4, 10000, "hp", fs=SR, output="sos")
    h = np.abs(signal.sosfiltfilt(sos, x[:, a:], axis=-1)).max(axis=0)
    hloc = np.sqrt(np.convolve(h ** 2, np.ones(S(0.02)) / S(0.02), mode="same")) + 1e-9
    hrat = h / hloc
    sospech = np.flatnonzero(hrat > 12)
    grupos = []
    for i in sospech:
        if not grupos or i - grupos[-1] > S(0.005):
            grupos.append(int(i))
    dc = float(x[:, -S(0.1):].mean())
    # el comienzo del archivo también: el tic de t = 0 arranca en la muestra 0
    ini = dict(primeras_muestras=crudo[:, :4].tolist() if crudo is not None else None,
               pico_primer_ms_dbfs=round(float(db(np.abs(x[:, :48]).max())), 1),
               salto_muestra0_dbfs=round(float(db(np.abs(x[:, 0]).max())), 1))
    return dict(cola_rms10ms_dbfs=tail, ultimas_muestras_int=last,
                pico_ultimos_10ms_dbfs=round(float(db(np.abs(x[:, -S(0.01):]).max())), 1),
                pico_ultimo_ms_dbfs=round(float(db(np.abs(x[:, -48:]).max())), 1),
                salto_max_ultimos_5ms=round(float(db(d[-S(0.005):].max())), 1),
                ratio_salto_max_29_30=round(float(rat.max()), 1), ratio_salto_t=round((a + int(np.argmax(rat))) / SR, 4),
                hf_clics_29_30=len(grupos), hf_clics_t=[round((a + g) / SR, 4) for g in grupos[:10]],
                dc_ultimos_100ms=dc, inicio=ini,
                ok=bool(crudo is not None and (crudo[:, -1] == 0).all() and len(grupos) == 0))


def control_gap(x, stems, cues):
    gap = next(c for c in cues["cues"] if c["id"] == "hook.gap")
    t0, t1 = gap["t"], gap["t"] + gap["dur"]
    a, b = S(t0), S(t1)
    seg = x[:, a:b]
    rms = float(db(np.sqrt((seg ** 2).mean())))
    drop = float(db(np.sqrt((x[:, S(3.75):S(4.0)] ** 2).mean())))
    sub = {}
    for k in range(0, int((b - a) / S(0.01)) + 1):
        s0 = a + k * S(0.01)
        s1 = min(b, s0 + S(0.01))
        if s1 > s0:
            sub[f"{(s0 / SR):.3f}"] = round(float(db(np.sqrt((x[:, s0:s1] ** 2).mean()) + 1e-20)), 1)
    por_stem = {k: round(float(db(np.sqrt((v[:, a:b] ** 2).mean()) + 1e-20)), 1) for k, v in stems.items()}
    # bordes: ¿el corte de entrada es un clic? salto muestra a muestra en ±2 ms de 3,6328
    d = np.abs(np.diff(x[:, a - S(0.002):a + S(0.002)], axis=1)).max()
    pre = float(db(np.sqrt((x[:, a - S(0.03):a] ** 2).mean())))
    # tramo realmente silencioso: bloques de 0,5 ms con RMS < −50 dBFS, el tramo contiguo más largo
    blk = S(0.0005)
    nb = (b - a) // blk
    r = np.array([np.sqrt((x[:, a + i * blk:a + (i + 1) * blk] ** 2).mean()) for i in range(nb)])
    sil = db(r + 1e-20) < -50.0
    mejor, cur, ini_m, ini_c = 0, 0, 0, 0
    for i, v in enumerate(sil):
        if v:
            if cur == 0:
                ini_c = i
            cur += 1
            if cur > mejor:
                mejor, ini_m = cur, ini_c
        else:
            cur = 0
    inter = x[:, a + S(0.002):b - S(0.002)]
    return dict(t0=t0, t1=t1, rms_dbfs=round(rms, 1), pico_dbfs=round(float(db(np.abs(seg).max())), 1),
                interior_rms_dbfs=round(float(db(np.sqrt((inter ** 2).mean()))), 1),
                interior_pico_dbfs=round(float(db(np.abs(inter).max())), 1),
                silencio_desde=round((a + ini_m * blk) / SR, 5), silencio_hasta=round((a + (ini_m + mejor) * blk) / SR, 5),
                silencio_ms=round(mejor * blk / SR * 1000, 1),
                drop_rms_dbfs=round(drop, 1), vs_drop_db=round(rms - drop, 1), rms_30ms_antes=round(pre, 1),
                rms_por_10ms=sub, por_stem=por_stem, salto_borde_entrada_dbfs=round(float(db(d)), 1),
                ok=bool(mejor * blk / SR >= 0.100))


def control_sfx(cues, sfx_stem):
    """Para cada cue: (1) render aislado del SFX (sfx.render_cue, misma semilla que build.py) y cresta medida
    con detectores propios; (2) dónde quedó ese sonido en el stem sfx (correlación cruzada de la forma de
    onda, al muestreo); (3) cresta directa en el stem con el RMS rectangular de 5 ms."""
    sys.path.insert(0, AUDIO)
    from arrangement import build_song   # noqa: E402
    from dsp import rng_of               # noqa: E402
    from sfx import SFX_GAIN_DB, render_cue   # noqa: E402
    song = build_song(cues)
    times = sorted(c["t"] for c in cues["cues"])
    filas = []
    r5_stem = rms_rect(sfx_stem, 0.005)
    for c in cues["cues"]:
        if c["sfx"] == "silence":
            continue
        x, anchor = render_cue(c, song, rng_of("sfx", c["id"]))
        k_cue = S(c["t"])
        start_esp = max(0, k_cue - anchor)
        # detectores propios sobre el sonido aislado (búsqueda ±40 ms del anchor calibrado)
        r5 = rms_rect(x, 0.005)
        lo, hi = max(0, anchor - S(0.04)), min(x.shape[1], anchor + S(0.04) + 1)
        k5 = lo + int(np.argmax(r5[lo:hi]))
        # arranque del ataque: primer instante (hasta 60 ms antes de la cresta) en que el RMS de 1 ms
        # llega a la cresta − 20 dB
        r1 = rms_rect(x, 0.001)
        b0 = max(0, k5 - S(0.06))
        sobre = np.flatnonzero(r1[b0:k5 + 1] >= r5[k5] * 0.1)
        kon = b0 + int(sobre[0]) if len(sobre) else k5
        # ubicación real en el stem: correlación de ENVOLVENTES (RMS 1 ms) con búsqueda ±15 ms; la forma
        # de onda no sirve en los tonales (la EQ por bus corre la fase y la correlación salta un período)
        L = min(x.shape[1], S(0.25))
        ref = r1[:L] * 10 ** (SFX_GAIN_DB[c["sfx"]] / 20)
        best, lag_best = -1.0, 0
        env_stem = rms_rect(sfx_stem[:, max(0, start_esp - S(0.02)):start_esp + L + S(0.02)], 0.001)
        off0 = start_esp - max(0, start_esp - S(0.02))
        for lag in range(-S(0.015), S(0.015) + 1):
            i0 = off0 + lag
            if i0 < 0 or i0 + L > len(env_stem):
                continue
            seg = env_stem[i0:i0 + L]
            v = float(np.dot(seg, ref) / (np.linalg.norm(seg) * np.linalg.norm(ref) + 1e-20))
            if v > best:
                best, lag_best = v, lag
        start_real = start_esp + lag_best
        # cresta directa en el stem: ventana ±50 ms sin pasar la mitad hacia el cue vecino
        prev_t = max([u for u in times if u < c["t"] - 1e-9], default=-1.0)
        next_t = min([u for u in times if u > c["t"] + 1e-9], default=99.0)
        wlo = max(0, S(max(c["t"] - 0.05, (c["t"] + prev_t) / 2)))
        whi = S(min(c["t"] + 0.05, (c["t"] + next_t) / 2))
        kst = wlo + int(np.argmax(r5_stem[wlo:whi]))
        fila = dict(id=c["id"], sfx=c["sfx"], t=c["t"], anchor=int(anchor),
                    desplaz_colocacion_muestras=int(start_real - start_esp),
                    corr_env=round(best, 3),
                    cresta_rms5_ms=round((start_real + k5 - k_cue) / SR * 1000, 2),
                    ataque_desde_ms=round((start_real + kon - k_cue) / SR * 1000, 2),
                    stem_cresta_rms5_ms=round((kst - k_cue) / SR * 1000, 2))
        if "dur" in c:
            t_end = c["t"] + c["dur"]
            if c["id"] == "hook.surge":
                t_end = min(t_end, next(u["t"] for u in cues["cues"] if u["id"] == "hook.gap"))
            r5c = rms_rect(sfx_stem[:, k_cue:S(t_end) + S(0.002)], 0.005)
            fila["culmina_ms_vs_fin"] = round((int(np.argmax(r5c)) - (S(t_end) - k_cue)) / SR * 1000, 1)
            fila["fin_vs_arranque_db"] = round(float(db(r5c[-S(0.03):].max()) - db(r5c[:S(0.03)].max())), 1)
            fila["t_fin"] = round(t_end, 4)
        filas.append(fila)
    peor = max(filas, key=lambda f: abs(f["cresta_rms5_ms"]))
    peor_stem = max(filas, key=lambda f: abs(f["stem_cresta_rms5_ms"]))
    malos = [f for f in filas if abs(f["cresta_rms5_ms"]) > 5.0]
    malos_stem = [f for f in filas if abs(f["stem_cresta_rms5_ms"]) > 5.0]
    malos_coloc = [f for f in filas if abs(f["desplaz_colocacion_muestras"]) > S(0.001)]
    return dict(n=len(filas), filas=filas, peor_cresta=peor, peor_stem=peor_stem, fuera_tol=malos,
                fuera_tol_stem=malos_stem, colocacion_distinta=malos_coloc,
                ok=bool(not malos and not malos_coloc))


def grafico(x, drums, cues, res, path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    t0, t1 = 27.0, 30.0
    a, b = S(t0), S(t1)
    t = np.arange(a, b) / SR
    fig, ax = plt.subplots(3, 1, figsize=(14, 9), sharex=True)
    ax[0].plot(t, x[0, a:b], lw=0.3, color="#1d4e89")
    ax[0].set_ylabel("master L")
    r = db(rms_rect(x[:, a:b], 0.01) / np.sqrt(2))
    ax[1].plot(t, r, lw=0.6, color="#333", label="master RMS 10 ms")
    ax[1].plot(t, db(rms_rect(drums[:, a:b], 0.01) / np.sqrt(2)), lw=0.5, color="#e07020", label="drums")
    for f in res["groove"]["corcheas"]:
        ax[1].hlines(f["rms_dbfs"], f["t0"], f["t0"] + cues["beat"] / 2, color="#1a9e4e", lw=2)
    ax[1].axhline(res["groove"]["ref_grilla_27_1875_28_125"], color="#1a9e4e", ls=":", lw=1)
    ax[1].axhspan(res["groove"]["ref_grilla_27_1875_28_125"] - 6, res["groove"]["ref_grilla_27_1875_28_125"] + 6,
                  color="#1a9e4e", alpha=0.06)
    ax[1].set_ylim(-80, 0)
    ax[1].legend(loc="lower left", fontsize=8)
    ax[1].set_ylabel("dBFS")
    f, tt, Z = signal.stft(x[:, a:b].mean(axis=0), fs=SR, nperseg=2048, noverlap=2048 - 240)
    ax[2].pcolormesh(tt + t0, f, 20 * np.log10(np.abs(Z) + 1e-9), vmin=-120, vmax=-30, shading="auto", cmap="magma")
    ax[2].set_yscale("symlog", linthresh=500)
    ax[2].set_ylim(30, 20000)
    for k in range(int(round(t0 / cues["beat"])), int(round(t1 / cues["beat"])) + 1):
        for axx in ax:
            axx.axvline(k * cues["beat"], color="#888", lw=0.4, ls="--")
    for axx in ax:
        axx.axvline(res["stinger"]["t"], color="red", lw=0.8)
    ax[2].set_xlabel("s")
    fig.suptitle("Crítica v2 — final con beat (27–30 s): verde = RMS por corchea, banda ±6 dB; rojo = stinger")
    fig.tight_layout()
    fig.savefig(path, dpi=110)
    plt.close(fig)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--sin-codec", action="store_true")
    ap.add_argument("--wav", default=WAV)
    args = ap.parse_args(argv)
    os.makedirs(SALIDA, exist_ok=True)
    with open(CUES, encoding="utf-8") as fh:
        cues = json.load(fh)
    x, info, crudo = leer_wav(args.wav)
    stems = {k: leer_wav(os.path.join(STEMS, f"{k}.wav"))[0] for k in
             ("drums", "bass", "music", "lead", "wall", "fx", "sfx")}
    res = {}
    res["formato"] = control_formato(info)
    tp4, k4 = true_peak(x, 4)
    tp8, k8 = true_peak(x, 8)
    eb = ffmpeg_ebur128(args.wav) if shutil.which("ffmpeg") else {}
    try:
        import pyloudnorm as pyln
        pl = float(pyln.Meter(SR).integrated_loudness(x.T))
    except Exception:
        pl = None
    res["loudness"] = dict(propio=round(lufs_int(x), 3), pyloudnorm=round(pl, 3) if pl is not None else None,
                           ffmpeg_ebur128=eb.get("I"), ok=bool(abs(lufs_int(x) + 14.0) <= 0.5))
    res["true_peak_wav"] = dict(tp4_dbtp=round(tp4, 3), tp4_t=round(k4 / SR, 4), tp8_dbtp=round(tp8, 3),
                                ffmpeg_tp=eb.get("tp"), sample_peak_dbfs=round(float(db(np.abs(x).max())), 3),
                                ok=bool(tp4 <= -1.0 and tp8 <= -1.0))
    if not args.sin_codec and shutil.which("ffmpeg"):
        cod = control_codecs(args.wav, x)
        cod["ok"] = bool(all(v.get("tp4_dbtp", 99) <= -1.0 for k, v in cod.items()
                             if k in ("aac320", "aac128", "aac320_a_128")))
        res["codecs"] = cod
    t_st = 15 * cues["bar"] + 3 * cues["beat"]
    res["groove"] = control_groove(x, stems["drums"], cues)
    res["stinger"] = control_stinger(x, stems["drums"], t_st)
    res["final"] = control_final(x, crudo)
    res["gap"] = control_gap(x, stems, cues)
    res["clics"] = escaneo_clics(x)
    res["sfx"] = control_sfx(cues, stems["sfx"])
    suma = sum(stems.values())
    res["suma_stems_menos_master_db"] = round(float(db(np.sqrt(((suma - x) ** 2).mean())) - db(np.sqrt((x ** 2).mean()))), 1)
    grafico(x, stems["drums"], cues, res, os.path.join(SALIDA, "final_critica.png"))
    with open(os.path.join(SALIDA, "critica.json"), "w", encoding="utf-8") as fh:
        json.dump(res, fh, indent=1, ensure_ascii=False)
    # resumen corto
    print(json.dumps({k: v.get("ok") if isinstance(v, dict) else v for k, v in res.items()}, ensure_ascii=False))
    return res


if __name__ == "__main__":
    main()
