"""
mapa_arreglo.py — mapa de qué pistas suenan en cada compás (desde arrangement.build_song, sin render).
Sirve para ver si cada sección visual tiene identidad propia o si es «lo mismo con un detalle».

    python audio/review/mapa_arreglo.py
"""
from __future__ import annotations

from comun import BAR
from arrangement import build_song


def main():
    s = build_song()
    pistas = sorted(s.ev.keys())
    print("pista            " + " ".join(f"c{b:<2d}" for b in range(16)))
    for p in pistas:
        cuenta = [0] * 16
        for e in s.ev[p]:
            t = e.get("t", e.get("t_end", 0.0) - 1e-3)
            b = int(t / BAR + 1e-9)
            if 0 <= b < 16:
                cuenta[b] += 1
        print(f"{p:16s} " + " ".join(f"{c:3d}" if c else "  ." for c in cuenta))


if __name__ == "__main__":
    main()
