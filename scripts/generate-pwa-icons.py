"""Render the repository-owned WF vector monogram with only Python's stdlib."""
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parent.parent / 'public' / 'icons'
# Coordinates share a 512-unit canvas. All ink is inside the maskable safe circle.
POLYGONS = [
    [(116, 194), (140, 194), (158, 274), (178, 220), (196, 220),
     (216, 274), (234, 194), (258, 194), (229, 318), (207, 318),
     (187, 264), (167, 318), (145, 318)],
    [(282, 194), (372, 194), (372, 218), (308, 218), (308, 246),
     (362, 246), (362, 270), (308, 270), (308, 318), (282, 318)],
]


def inside(x, y, polygon):
    hit = False
    previous = polygon[-1]
    for current in polygon:
        ax, ay = previous
        bx, by = current
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            hit = not hit
        previous = current
    return hit


def render(size, filename):
    bg, fg = (2, 6, 23), (190, 242, 100)
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            coverage = sum(any(inside((x + (sx + .5) / 2) * 512 / size,
                                      (y + (sy + .5) / 2) * 512 / size, p)
                               for p in POLYGONS) for sx in range(2) for sy in range(2)) / 4
            rows.extend(round(a + (b - a) * coverage) for a, b in zip(bg, fg))
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', size, size, 8, 2, 0, 0, 0))
    (ROOT / filename).write_bytes(png + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b''))


if __name__ == '__main__':
    ROOT.mkdir(parents=True, exist_ok=True)
    for size, name in [(192, 'pwa-192.png'), (512, 'pwa-512.png'),
                       (512, 'maskable-512.png'), (180, 'apple-touch-icon.png')]:
        render(size, name)
