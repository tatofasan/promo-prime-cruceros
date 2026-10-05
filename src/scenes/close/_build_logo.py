# Vectoriza docs/ref/logo-principal.png (2651×334) letra por letra y escribe los paths en src/brand/logo.js
# (entre los marcadores // <glifos> … // </glifos>). Contornos subpíxel con marching squares sobre el alfa
# (nivel 0,5 = el borde real del vector original) y simplificación Douglas-Peucker con tolerancia chica.
#   python src/scenes/close/_build_logo.py [--tol=0.28]
import sys, json, re
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage import measure

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / 'docs/ref/logo-principal.png'
OUT = ROOT / 'src/brand/logo.js'
tol = float(next((a.split('=')[1] for a in sys.argv[1:] if a.startswith('--tol=')), 0.28))

im = np.array(Image.open(SRC).convert('RGBA')).astype(np.float64)
alpha = im[..., 3] / 255.0
H, W = alpha.shape

# columnas de cada letra (x del PNG). La «o» es el pin: no se vectoriza, la dibuja drawPin.
LETTERS = [
    ('p', 0, 0, 240), ('r', 0, 265, 365), ('i', 0, 375, 425), ('m', 0, 485, 855), ('e', 0, 880, 1095),
    ('c', 1, 1110, 1330), ('r', 1, 1355, 1450), ('u', 1, 1465, 1670), ('c', 1, 1700, 1920), ('e', 1, 1930, 2140),
    ('r', 1, 2175, 2262), ('o', 1, 2265, 2505), ('s', 1, 2515, 2651),
]

lab, n = ndi.label(alpha > 0.02)
objs = ndi.find_objects(lab)
cents = {i + 1: (s[1].start + s[1].stop) / 2 for i, s in enumerate(objs)}

def letter_of(cx):
    for k, (_, _, x0, x1) in enumerate(LETTERS):
        if x0 <= cx < x1:
            return k
    raise ValueError(cx)

owner = {c: letter_of(x) for c, x in cents.items()}

def fmt(v):
    s = f'{v:.1f}'
    return s[:-2] if s.endswith('.0') else s

glyphs = []
total_pts = 0
for k, (ch, word, x0, x1) in enumerate(LETTERS):
    comps = [c for c, o in owner.items() if o == k]
    m = np.isin(lab, comps)
    m = ndi.binary_dilation(m, iterations=2)
    a = np.where(m, alpha, 0.0)
    ys, xs = np.where(a > 0.02)
    bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    if ch == 'o':
        glyphs.append({'ch': ch, 'word': word, 'pin': True, 'box': [int(bx0), int(by0), int(bx1), int(by1)]})
        continue
    pad = np.pad(a, 1)
    cs = measure.find_contours(pad, 0.5)
    parts = []
    xmin = ymin = 1e9; xmax = ymax = -1e9
    for c in cs:
        if len(c) < 8:
            continue
        c = measure.approximate_polygon(c, tolerance=tol)
        pts = [(p[1] - 0.5, p[0] - 0.5) for p in c]  # (x, y) en px del PNG (centro de píxel = +0,5)
        if pts[0] == pts[-1]:
            pts = pts[:-1]
        total_pts += len(pts)
        xs_ = [p[0] for p in pts]; ys_ = [p[1] for p in pts]
        xmin = min(xmin, min(xs_)); xmax = max(xmax, max(xs_)); ymin = min(ymin, min(ys_)); ymax = max(ymax, max(ys_))
        d = 'M' + fmt(pts[0][0]) + ' ' + fmt(pts[0][1])
        px, py = pts[0]
        for (x, y) in pts[1:]:
            d += 'l' + fmt(x - px) + ' ' + fmt(y - py)
            px, py = round(px + round(x - px, 1), 1), round(py + round(y - py, 1), 1)
        d += 'Z'
        parts.append(d)
    glyphs.append({'ch': ch, 'word': word, 'd': ''.join(parts), 'box': [round(xmin, 1), round(ymin, 1), round(xmax, 1), round(ymax, 1)]})

# pin: círculo de la cabeza ajustado por mínimos cuadrados al contorno exterior y la punta = punto más bajo
cs = measure.find_contours(np.pad(np.where((np.arange(W) >= 2265)[None, :] & (np.arange(W) < 2505)[None, :], alpha, 0), 1), 0.5)
c = max(cs, key=len)
x = c[:, 1] - 0.5; y = c[:, 0] - 0.5
sel = y < 170
A = np.c_[2 * x[sel], 2 * y[sel], np.ones(sel.sum())]
bb = x[sel] ** 2 + y[sel] ** 2
cx, cy, c0 = np.linalg.lstsq(A, bb, rcond=None)[0]
R = float(np.sqrt(c0 + cx ** 2 + cy ** 2))
pin = {'cx': round(float(cx), 2), 'cy': round(float(cy), 2), 'r': round(R, 2), 'tipY': round(float(y.max()), 2)}

block = '// <glifos> (generado por src/scenes/close/_build_logo.py, no editar a mano)\n'
block += f'const GLYPHS = {json.dumps(glyphs, ensure_ascii=False, separators=(",", ":"))};\n'
block += f'const PIN_FIT = {json.dumps(pin)};\n'
block += '// </glifos>'
src = OUT.read_text(encoding='utf-8')
src2 = re.sub(r'// <glifos>.*?// </glifos>', lambda _: block, src, flags=re.S)
if src2 == src and '// <glifos>' not in src:
    raise SystemExit('faltan los marcadores en logo.js')
OUT.write_text(src2, encoding='utf-8')
print(json.dumps({'tol': tol, 'points': total_pts, 'bytes': len(block), 'pin': pin, 'letters': [(g['ch'], g['box']) for g in glyphs]}))
