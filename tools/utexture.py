"""Decode cooked UE5 UTexture2D packages (inline mips) into RGBA images.

Finds the platform-data FString 'PF_xxx' (SizeX, SizeY, PackedData just before it),
then FirstMip i32, NumMips i32 and per mip: i32 bulk index, [inline payload], SizeX, SizeY, SizeZ.
"""
import re, struct
SRGB = True
from PIL import Image

BPB = {'PF_DXT1': 8, 'PF_BC4': 8, 'PF_DXT3': 16, 'PF_DXT5': 16, 'PF_BC5': 16, 'PF_BC7': 16, 'PF_BC6H': 16}
DECODER = {'PF_DXT1': ('bcn', 1), 'PF_DXT3': ('bcn', 2), 'PF_DXT5': ('bcn', 3), 'PF_BC4': ('bcn', 4),
           'PF_BC5': ('bcn', 5), 'PF_BC7': ('bcn', 7)}


def mip_bytes(fmt, w, h):
    if fmt == 'PF_B8G8R8A8' or fmt == 'PF_R8G8B8A8':
        return w * h * 4
    if fmt == 'PF_G8':
        return w * h
    if fmt == 'PF_FloatRGBA':
        return w * h * 8
    b = BPB[fmt]
    return max(1, (w + 3) // 4) * max(1, (h + 3) // 4) * b


def find_platform(d):
    for m in re.finditer(rb'PF_[A-Za-z0-9_]{2,20}\x00', d):
        p = m.start() - 4
        if p < 12:
            continue
        n, = struct.unpack_from('<i', d, p)
        if n != len(m.group()):
            continue
        sx, sy, packed = struct.unpack_from('<iiI', d, p - 12)
        if 0 < sx <= 8192 and 0 < sy <= 8192:
            return m.group()[:-1].decode(), sx, sy, packed, p + 4 + n
    return None


def decode(d, want=128):
    pf = find_platform(d)
    if not pf:
        raise ValueError('no platform data')
    fmt, sx, sy, packed, q = pf
    if packed & (1 << 30):  # has optional data
        q += 8
    first, nmips = struct.unpack_from('<ii', d, q); q += 8
    mips = []
    w, h = sx, sy
    for k in range(nmips):
        idx, = struct.unpack_from('<i', d, q); q += 4
        size = mip_bytes(fmt, w, h)
        # inline payload present if the next 12 bytes are not the mip size triple
        nxt = struct.unpack_from('<iii', d, q) if q + 12 <= len(d) else None
        if nxt == (w, h, 1):
            payload = None
        else:
            payload = d[q:q + size]; q += size
            nxt = struct.unpack_from('<iii', d, q)
        mw, mh, mz = nxt; q += 12
        mips.append((mw, mh, payload))
        w, h = max(1, w // 2), max(1, h // 2)
    avail = [m for m in mips if m[2] is not None and len(m[2]) == mip_bytes(fmt, m[0], m[1])]
    if not avail:
        raise ValueError('no inline mip')
    pick = next((m for m in avail if m[0] <= want), avail[-1])
    if pick[0] < want and avail[0][0] >= want:
        pick = avail[0]
    mw, mh, data = pick
    if fmt == 'PF_B8G8R8A8':
        im = Image.frombytes('RGBA', (mw, mh), data, 'raw', 'BGRA')
    elif fmt == 'PF_R8G8B8A8':
        im = Image.frombytes('RGBA', (mw, mh), data)
    elif fmt == 'PF_FloatRGBA':
        import numpy as np
        a = np.frombuffer(data, dtype='<f2').reshape(mh, mw, 4).astype('float32')
        a = np.nan_to_num(a)
        rgb = np.clip(a[..., :3], 0, 1)
        rgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * np.power(rgb, 1 / 2.4) - 0.055) if SRGB else rgb
        al = np.clip(a[..., 3:4], 0, 1)
        im = Image.fromarray((np.concatenate([rgb, al], -1) * 255 + 0.5).astype('uint8'), 'RGBA')
    elif fmt == 'PF_G8':
        im = Image.frombytes('L', (mw, mh), data).convert('RGBA')
    else:
        dec, n = DECODER[fmt]
        im = Image.frombytes('RGBA', (mw, mh), data, dec, n)
    return fmt, (sx, sy), im
