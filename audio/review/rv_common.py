"""
rv_common.py — utilidades de la revisión técnica INDEPENDIENTE del audio.

Nada de acá importa código del pipeline (dsp.py, analyze.py, etc.): el lector de WAV, el medidor
BS.1770-4, el true peak y las envolventes están escritos de nuevo para no heredar los mismos errores.
"""
from __future__ import annotations

import json
import os
import struct

import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO = os.path.dirname(HERE)
ROOT = os.path.dirname(AUDIO)
OUT = os.path.join(HERE, "out", "tecnico")  # carpeta propia (otros revisores escriben en out/)
SR = 48000


# ---------------------------------------------------------------------------
# WAV: parser RIFF propio (no usamos scipy.io.wavfile a propósito: queremos ver cada chunk)
# ---------------------------------------------------------------------------

def read_wav(path: str):
    """Devuelve (x[canales, n] float64, info). Soporta PCM 16/24/32 y float 32."""
    with open(path, "rb") as fh:
        raw = fh.read()
    if raw[:4] != b"RIFF" or raw[8:12] != b"WAVE":
        raise ValueError("no es RIFF/WAVE")
    riff_size = struct.unpack("<I", raw[4:8])[0]
    pos = 12
    chunks = []
    fmt = None
    data = None
    while pos + 8 <= len(raw):
        cid = raw[pos:pos + 4]
        size = struct.unpack("<I", raw[pos + 4:pos + 8])[0]
        body = raw[pos + 8:pos + 8 + size]
        chunks.append((cid.decode("latin1"), size))
        if cid == b"fmt ":
            tag, ch, sr, brate, align, bits = struct.unpack("<HHIIHH", body[:16])
            fmt = dict(tag=tag, channels=ch, sr=sr, byte_rate=brate, block_align=align, bits=bits)
        elif cid == b"data":
            data = body
        pos += 8 + size + (size & 1)
    if fmt is None or data is None:
        raise ValueError("faltan fmt o data")
    ch, bits, tag = fmt["channels"], fmt["bits"], fmt["tag"]
    nframes = len(data) // fmt["block_align"]
    if tag == 1 and bits == 24:
        b = np.frombuffer(data[:nframes * 3 * ch], dtype=np.uint8).reshape(-1, 3).astype(np.int32)
        v = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
        v = np.where(v >= 1 << 23, v - (1 << 24), v)
        x = v.astype(np.float64) / 8388608.0
        ints = v.reshape(-1, ch).T
    elif tag == 1 and bits == 16:
        v = np.frombuffer(data[:nframes * 2 * ch], dtype="<i2").astype(np.int32)
        x = v / 32768.0
        ints = v.reshape(-1, ch).T
    elif tag == 3 and bits == 32:
        x = np.frombuffer(data[:nframes * 4 * ch], dtype="<f4").astype(np.float64)
        ints = None
    else:
        raise ValueError(f"formato no soportado: {fmt}")
    x = x.reshape(-1, ch).T.copy()
    info = dict(fmt, frames=nframes, riff_size=riff_size, file_size=len(raw), chunks=chunks,
                riff_ok=(riff_size == len(raw) - 8), ints=ints)
    return x, info


def sha256(path: str) -> str:
    import hashlib
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for blk in iter(lambda: fh.read(1 << 20), b""):
            h.update(blk)
    return h.hexdigest()


def load_cues():
    with open(os.path.join(ROOT, "src", "cues.json"), encoding="utf-8") as fh:
        return json.load(fh)


# ---------------------------------------------------------------------------
# BS.1770-4 (implementación propia)
# ---------------------------------------------------------------------------

# Coeficientes de la norma para 48 kHz (Tabla 1 y 2 de ITU-R BS.1770-4)
_K1_B = [1.53512485958697, -2.69169618940638, 1.19839281085285]
_K1_A = [1.0, -1.69065929318241, 0.73248077421585]
_K2_B = [1.0, -2.0, 1.0]
_K2_A = [1.0, -1.99004745483398, 0.99007225036621]


def k_weight(x: np.ndarray) -> np.ndarray:
    y = signal.lfilter(_K1_B, _K1_A, x, axis=-1)
    return signal.lfilter(_K2_B, _K2_A, y, axis=-1)


def _block_powers(xk: np.ndarray, win: float, hop: float) -> np.ndarray:
    """Potencia media (suma de canales con G=1) por bloque de `win` s con salto `hop` s."""
    n = xk.shape[1]
    W, H = int(round(win * SR)), int(round(hop * SR))
    if n < W:
        return np.zeros(0)
    cs = np.concatenate([[0.0], np.cumsum((xk ** 2).sum(axis=0))])
    starts = np.arange(0, n - W + 1, H)
    return (cs[starts + W] - cs[starts]) / W


def lufs_integrated(x: np.ndarray) -> float:
    xk = k_weight(x)
    z = _block_powers(xk, 0.4, 0.1)
    lk = -0.691 + 10 * np.log10(np.maximum(z, 1e-30))
    z1 = z[lk > -70.0]
    if z1.size == 0:
        return -np.inf
    rel = -0.691 + 10 * np.log10(z1.mean()) - 10.0
    z2 = z1[(-0.691 + 10 * np.log10(z1)) > rel]
    return float(-0.691 + 10 * np.log10(z2.mean()))


def loudness_curve(x: np.ndarray, win: float, hop: float = 0.1):
    """Curva de loudness (momentáneo: win=0,4; corto plazo: win=3). Devuelve (t_centro, LUFS)."""
    xk = k_weight(x)
    z = _block_powers(xk, win, hop)
    t = np.arange(z.size) * hop + win / 2
    return t, -0.691 + 10 * np.log10(np.maximum(z, 1e-30))


def lufs_segment(x: np.ndarray, t0: float, t1: float) -> float:
    """Loudness integrado (con el gating de la norma) de un tramo, filtrando la señal completa
    para que el filtro K no arranque en frío en el borde."""
    xk = k_weight(x)[:, int(round(t0 * SR)):int(round(t1 * SR))]
    z = _block_powers(xk, 0.4, 0.1)
    if z.size == 0:
        return float("nan")
    lk = -0.691 + 10 * np.log10(np.maximum(z, 1e-30))
    z1 = z[lk > -70]
    if z1.size == 0:
        return -np.inf
    rel = -0.691 + 10 * np.log10(z1.mean()) - 10
    z2 = z1[(-0.691 + 10 * np.log10(z1)) > rel]
    return float(-0.691 + 10 * np.log10(z2.mean()))


def true_peak(x: np.ndarray, os_factor: int = 4) -> tuple[float, int, int]:
    """True peak por sobremuestreo polifásico (sinc con ventana Kaiser, filtro largo).
    Devuelve (dBTP, canal, índice en muestras originales)."""
    best = (-np.inf, 0, 0)
    for ch in range(x.shape[0]):
        y = signal.resample_poly(x[ch], os_factor, 1, window=("kaiser", 12.0), padtype="constant")
        i = int(np.argmax(np.abs(y)))
        v = 20 * np.log10(max(abs(y[i]), 1e-30))
        if v > best[0]:
            best = (float(v), ch, i // os_factor)
    return best


def db(v):
    return 20 * np.log10(np.maximum(np.abs(v), 1e-30))


# ---------------------------------------------------------------------------
# Envolventes (distintas de las del pipeline a propósito)
# ---------------------------------------------------------------------------

def rms_env(x: np.ndarray, win_s: float) -> np.ndarray:
    """RMS centrado con ventana Hann de `win_s` segundos sobre la energía L²+R² (o mono)."""
    e = (x ** 2).sum(axis=0) if x.ndim == 2 else x ** 2
    n = max(3, int(round(win_s * SR)) | 1)
    w = np.hanning(n)
    w /= w.sum()
    return np.sqrt(np.maximum(signal.fftconvolve(e, w, mode="same"), 0.0))


def hilbert_env(x: np.ndarray, smooth_s: float = 0.002) -> np.ndarray:
    """Envolvente analítica (|Hilbert|) de banda completa, suavizada (para la cresta fina)."""
    if x.ndim == 2:
        a = np.sqrt((np.abs(signal.hilbert(x, axis=-1)) ** 2).sum(axis=0))
    else:
        a = np.abs(signal.hilbert(x))
    n = max(3, int(round(smooth_s * SR)) | 1)
    w = np.hanning(n)
    w /= w.sum()
    return signal.fftconvolve(a, w, mode="same")


def butter(x, f, kind, order=4):
    sos = signal.butter(order, f, btype=kind, fs=SR, output="sos")
    return signal.sosfiltfilt(sos, x, axis=-1)
