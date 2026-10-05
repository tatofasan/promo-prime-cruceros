"""
check_codecs.py — true peak, loudness, largo y desfasaje DESPUÉS de codificar (lo que llega a la gente).

Codifica public/audio/promo.wav con ffmpeg en varios códecs/bitrates (el de tools/render.mjs es AAC
nativo de ffmpeg a 320 kb/s), decodifica a float y mide con el medidor propio:
true peak ×4, LUFS integrado, cantidad de muestras y desfasaje contra el original (correlación).

    python audio/review/check_codecs.py [tmpdir] → audio/review/out/codecs.json
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from scipy import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rv_common import OUT, ROOT, SR, lufs_integrated, read_wav, true_peak  # noqa: E402

WAV = os.path.join(ROOT, "public", "audio", "promo.wav")

CASES = [
    # nombre, extensión, argumentos de codificación
    ("aac_ffmpeg_320k(render.mjs)", "m4a", ["-c:a", "aac", "-b:a", "320k", "-ar", "48000"]),
    ("aac_ffmpeg_256k", "m4a", ["-c:a", "aac", "-b:a", "256k"]),
    ("aac_ffmpeg_128k", "m4a", ["-c:a", "aac", "-b:a", "128k"]),
    ("aac_mediafoundation_192k", "m4a", ["-c:a", "aac_mf", "-b:a", "192k"]),
    ("aac_mediafoundation_128k", "m4a", ["-c:a", "aac_mf", "-b:a", "128k"]),
    ("opus_128k(youtube-like)", "webm", ["-c:a", "libopus", "-b:a", "128k"]),
    ("opus_96k", "webm", ["-c:a", "libopus", "-b:a", "96k"]),
    ("mp3_lame_320k", "mp3", ["-c:a", "libmp3lame", "-b:a", "320k"]),
    ("mp3_lame_128k", "mp3", ["-c:a", "libmp3lame", "-b:a", "128k"]),
]


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[-800:])
    return r


def main():
    tmp = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(prefix="rv_codec_")
    os.makedirs(tmp, exist_ok=True)
    ref, _ = read_wav(WAV)
    refm = ref.sum(0)
    rep = dict(tmpdir=tmp, original=dict(tp4=true_peak(ref, 4)[0], lufs=lufs_integrated(ref)))
    rows = {}
    for name, ext, args in CASES:
        enc = os.path.join(tmp, f"{name.split('(')[0]}.{ext}")
        dec = os.path.join(tmp, f"{name.split('(')[0]}_dec.wav")
        try:
            run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", "0", "-t", "30", "-i", WAV, *args, enc])
            run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", enc, "-c:a", "pcm_f32le", "-ar", "48000", dec])
        except Exception as e:  # noqa: BLE001
            rows[name] = dict(error=str(e)[:300])
            continue
        y, info = read_wav(dec)
        tp, ch, idx = true_peak(y, 4)
        # desfasaje contra el original (correlación en los primeros 10 s, ±4000 muestras)
        n = min(y.shape[1], refm.size, 10 * SR)
        cc = signal.correlate(y.sum(0)[:n], refm[:n], mode="full", method="fft")
        mid = n - 1
        w = 4000
        lag = int(np.argmax(cc[mid - w: mid + w + 1])) - w
        # cola: ¿el final sigue limpio? (últimos 10 ms)
        tail = float(20 * np.log10(np.abs(y[:, -480:]).max() + 1e-12))
        rows[name] = dict(true_peak_x4_dbtp=round(tp, 2), tp_t=round(idx / SR, 3), lufs=round(lufs_integrated(y), 2),
                          samples=int(y.shape[1]), samples_diff=int(y.shape[1] - ref.shape[1]), lag_samples=lag,
                          last10ms_peak_dbfs=round(tail, 1), margin_to_m1_dbtp=round(-1.0 - tp, 2))
        print(name, rows[name], flush=True)
    rep["codecs"] = rows
    with open(os.path.join(OUT, "codecs.json"), "w", encoding="utf-8") as fh:
        json.dump(rep, fh, indent=1, ensure_ascii=False, default=float)


if __name__ == "__main__":
    main()
