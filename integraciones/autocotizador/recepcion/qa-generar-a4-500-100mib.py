"""QA efímera: PDF A4 de 500 páginas, 100 MiB con JPEG reales únicos.
El archivo se genera en el runner; no va a GitHub, R2, TUS ni al servidor."""
import io
import os
import sys
import fitz
import numpy as np
from PIL import Image

target = 100 * 1024 * 1024
path = sys.argv[1]
doc = fitz.open()
rng = np.random.default_rng(20261110)
for i in range(500):
    page = doc.new_page(width=595.28, height=841.89)
    image = rng.integers(0, 256, size=(400, 600, 3), dtype=np.uint8)
    buf = io.BytesIO()
    Image.fromarray(image, 'RGB').save(buf, format='JPEG', quality=89)
    page.insert_image(page.rect, stream=buf.getvalue(), keep_proportion=False)
    if (i + 1) % 100 == 0:
        print('QA_JPEG_PAGE_COUNT=' + str(i + 1), flush=True)
doc.save(path, garbage=3, deflate=False)
doc.close()
size = os.path.getsize(path)
print('QA_PDF_REAL_IMAGE_BYTES=' + str(size), flush=True)
if size > target or size < 85 * 1024 * 1024:
    raise RuntimeError('PDF sintetico con JPEG inesperado: tamaño fuera de 85-100 MiB')
with open(path, 'rb') as f:
    raw = f.read()
marker = b'startxref'
pos = raw.rfind(marker)
if pos < 0 or not raw.startswith(b'%PDF-'):
    raise RuntimeError('PDF sin tabla xref')
pad = target - len(raw)
# Los offsets originales de objetos y xref se conservan porque insertamos
# pocos espacios DESPUÉS de la tabla xref y ANTES del marcador startxref.
# A diferencia del fixture anterior, la mayor parte de los 100 MiB son
# 500 JPEG auténticos distribuidos entre las páginas.
with open(path, 'wb') as f:
    f.write(raw[:pos])
    f.write(b' ' * pad)
    f.write(raw[pos:])
assert os.path.getsize(path) == target
check = fitz.open(path)
assert check.page_count == 500
for i in (0, 249, 499):
    p = check.load_page(i)
    assert abs(p.rect.width - 595.28) < 0.03
    assert abs(p.rect.height - 841.89) < 0.03
check.close()
print('QA_PDF_500_A4_100MIB_JPEG_ESTRUCTURAL_VALIDO', flush=True)
