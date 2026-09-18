#!/usr/bin/env python3
import json
import math
import os
import struct
import sys
import zlib

OUT = sys.argv[1] if len(sys.argv) > 1 else 'AppIcon.appiconset'
os.makedirs(OUT, exist_ok=True)

def clamp(v, lo=0, hi=255):
    return max(lo, min(hi, int(v)))

def mix(a, b, t):
    return tuple(clamp(a[i] + (b[i] - a[i]) * t) for i in range(3))

def render(size):
    rows = []
    top = (5, 23, 54)
    bottom = (4, 133, 199)
    white = (247, 252, 255)
    aqua = (65, 220, 246)
    gold = (255, 196, 56)

    for y in range(size):
        yn = y / max(1, size - 1)
        row = bytearray()
        for x in range(size):
            xn = x / max(1, size - 1)
            base = mix(top, bottom, yn * 0.95)

            dx, dy = xn - 0.73, yn - 0.22
            glow = max(0.0, 1.0 - math.sqrt(dx*dx + dy*dy) / 0.58)
            c = mix(base, (32, 170, 229), glow * 0.33)

            r = math.sqrt((xn - 0.50)**2 + (yn - 0.52)**2)
            if r < 0.135:
                edge = max(0.0, min(1.0, (0.135 - r) / 0.018))
                c = mix(c, gold, 0.82 + edge * 0.18)

            if yn > 0.57:
                ocean_t = min(1.0, (yn - 0.57) / 0.43)
                c = mix(c, (2, 63, 112), 0.34 + ocean_t * 0.36)

            wave_y = 0.63 - 0.075 * math.sin((xn * 1.13 + 0.03) * math.pi * 2.0)
            thickness = 0.052
            d = abs(yn - wave_y)
            if d < thickness:
                edge = 1.0 - d / thickness
                c = mix(c, white, min(1.0, 0.78 + edge * 0.22))

            wave2_y = 0.735 - 0.050 * math.sin((xn * 1.08 + 0.41) * math.pi * 2.0)
            d2 = abs(yn - wave2_y)
            if d2 < 0.038:
                edge2 = 1.0 - d2 / 0.038
                c = mix(c, aqua, 0.64 + edge2 * 0.30)

            in_stem = 0.463 <= xn <= 0.537 and 0.205 <= yn <= 0.515
            in_cap = 0.34 <= xn <= 0.66 and 0.205 <= yn <= 0.285
            if in_stem or in_cap:
                c = mix(c, white, 0.98)

            shadow_stem = 0.475 <= xn <= 0.548 and 0.285 <= yn <= 0.525
            if shadow_stem and not (in_stem or in_cap):
                c = mix(c, (2, 38, 76), 0.18)

            row.extend(c)
        rows.append(bytes(row))
    return rows

def write_png(path, size):
    rows = render(size)
    raw = b''.join(b'\x00' + row for row in rows)
    def chunk(kind, data):
        return (
            struct.pack('>I', len(data))
            + kind
            + data
            + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
        )

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)

specs = [
    ('iphone', '20x20', '2x', 40, 'Icon-20@2x.png'),
    ('iphone', '20x20', '3x', 60, 'Icon-20@3x.png'),
    ('iphone', '29x29', '2x', 58, 'Icon-29@2x.png'),
    ('iphone', '29x29', '3x', 87, 'Icon-29@3x.png'),
    ('iphone', '40x40', '2x', 80, 'Icon-40@2x.png'),
    ('iphone', '40x40', '3x', 120, 'Icon-40@3x.png'),
    ('iphone', '60x60', '2x', 120, 'Icon-60@2x.png'),
    ('iphone', '60x60', '3x', 180, 'Icon-60@3x.png'),
    ('ipad', '20x20', '1x', 20, 'Icon-iPad-20.png'),
    ('ipad', '20x20', '2x', 40, 'Icon-iPad-20@2x.png'),
    ('ipad', '29x29', '1x', 29, 'Icon-iPad-29.png'),
    ('ipad', '29x29', '2x', 58, 'Icon-iPad-29@2x.png'),
    ('ipad', '40x40', '1x', 40, 'Icon-iPad-40.png'),
    ('ipad', '40x40', '2x', 80, 'Icon-iPad-40@2x.png'),
    ('ipad', '76x76', '1x', 76, 'Icon-iPad-76.png'),
    ('ipad', '76x76', '2x', 152, 'Icon-iPad-76@2x.png'),
    ('ipad', '83.5x83.5', '2x', 167, 'Icon-iPad-83.5@2x.png'),
    ('ios-marketing', '1024x1024', '1x', 1024, 'Icon-1024.png'),
]

images = []
for idiom, logical_size, scale, pixels, filename in specs:
    write_png(os.path.join(OUT, filename), pixels)
    images.append({
        'idiom': idiom,
        'size': logical_size,
        'scale': scale,
        'filename': filename,
    })

with open(os.path.join(OUT, 'Contents.json'), 'w', encoding='utf-8') as f:
    json.dump({'images': images, 'info': {'author': 'xcode', 'version': 1}}, f, indent=2)
    f.write('\n')

print(f'Generated {len(specs)} Tiderun app icons in {OUT}')
