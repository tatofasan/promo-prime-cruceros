"""
synth.py — punto de entrada de `npm run audio` (package.json llama a `python audio/synth.py`).

Regenera public/audio/promo.wav y los stems (build.py) y después corre la verificación (analyze.py).
    python audio/synth.py            # build + análisis
    python audio/synth.py --no-check # solo build
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import analyze  # noqa: E402
import build  # noqa: E402

if __name__ == "__main__":
    build.main([])
    if "--no-check" not in sys.argv:
        rep = analyze.main([])
        sys.exit(0 if rep["ok"] else 1)
