"""
comun.py — utilidades compartidas de la revisión musical (crítica de la v1).

Carga el master y los stems ya renderizados (no re-renderiza nada) y da la grilla de la canción.
Todo lo de acá es de solo lectura: la revisión no toca los archivos de música.
"""
from __future__ import annotations

import os
import sys

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
AUDIO = os.path.dirname(AQUI)
RAIZ = os.path.dirname(AUDIO)
sys.path.insert(0, AUDIO)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from arrangement import load_cues  # noqa: E402
from dsp import SR, k_weight, read_wav  # noqa: E402

WAV = os.path.join(RAIZ, "public", "audio", "promo.wav")
STEMS = os.path.join(AUDIO, "stems")
SALIDA = os.path.join(AQUI, "out")
os.makedirs(SALIDA, exist_ok=True)

NOMBRES_STEMS = ("drums", "bass", "music", "lead", "wall", "fx", "sfx")

CUES = load_cues()
BEAT = CUES["beat"]
BAR = CUES["bar"]
STEP = BEAT / 4.0


def S(t: float) -> int:
    return int(round(t * SR))


def master() -> np.ndarray:
    x, sr, _ = read_wav(WAV)
    assert sr == SR
    return x


def stems() -> dict:
    out = {}
    for k in NOMBRES_STEMS:
        x, sr, _ = read_wav(os.path.join(STEMS, f"{k}.wav"))
        out[k] = x
    return out


def tramo(x: np.ndarray, t0: float, t1: float) -> np.ndarray:
    return x[..., S(t0):S(t1)]


def lufs_bloque(x: np.ndarray) -> float:
    """Loudness K ponderado de un tramo corto (sin compuertas: sirve para comparar compases)."""
    y = k_weight(x) ** 2
    e = y.sum(axis=0).mean()
    return float(-0.691 + 10 * np.log10(e + 1e-20))


def db(v, piso=1e-12):
    return 20 * np.log10(np.maximum(np.abs(v), piso))


def energia_banda(x: np.ndarray, f0: float, f1: float) -> float:
    """Energía (lineal) de un tramo entre f0 y f1 Hz, por FFT de la mezcla L+R."""
    m = x.mean(axis=0) if x.ndim == 2 else x
    sp = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2
    f = np.fft.rfftfreq(len(m), 1 / SR)
    sel = (f >= f0) & (f < f1)
    return float(sp[sel].sum())


def cue(cid: str) -> dict:
    for c in CUES["cues"]:
        if c["id"] == cid:
            return c
    raise KeyError(cid)
