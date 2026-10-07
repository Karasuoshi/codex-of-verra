"""Minimal reader for UE5 IoStore TOC files (version 8, unencrypted).

parse_toc(path) -> dict with header, chunk ids, offsets/lengths, compression blocks,
and the directory index as a list of (path, toc_index).
ucas_ranges(toc, idx) -> list of (ucas_offset, size) covering the chunk.
"""
import struct


def _fstring(d, p):
    n, = struct.unpack_from('<i', d, p); p += 4
    if n == 0:
        return '', p
    if n > 0:
        s = d[p:p + n - 1].decode('utf-8', 'replace'); return s, p + n
    n = -n
    s = d[p:p + 2 * n - 2].decode('utf-16le', 'replace'); return s, p + 2 * n


def parse_toc(path):
    d = open(path, 'rb').read()
    assert d[:16] == b'-==--==--==--==-', 'not a utoc'
    ver = d[16]
    (hs, n, nblocks, blksz, ncm, cmlen, cbs, dirsize, parts) = struct.unpack_from('<IIIIIIIII', d, 20)
    cid, = struct.unpack_from('<Q', d, 56)
    flags = d[80]
    nseeds, = struct.unpack_from('<I', d, 84)
    psize, = struct.unpack_from('<Q', d, 88)
    nnohash, = struct.unpack_from('<I', d, 96)
    p = hs
    ids = []
    for i in range(n):
        cidv, = struct.unpack_from('<Q', d, p)
        idx, = struct.unpack_from('>H', d, p + 8)
        typ = d[p + 11]
        ids.append((cidv, idx, typ)); p += 12
    offlen = []
    for i in range(n):
        b = d[p:p + 10]; p += 10
        off = int.from_bytes(b[0:5], 'big'); ln = int.from_bytes(b[5:10], 'big')
        offlen.append((off, ln))
    p += 4 * nseeds + 4 * nnohash
    blocks = []
    for i in range(nblocks):
        b = d[p:p + 12]; p += 12
        off = int.from_bytes(b[0:5], 'little')
        csz = int.from_bytes(b[5:8], 'little'); usz = int.from_bytes(b[8:11], 'little'); m = b[11]
        blocks.append((off, csz, usz, m))
    methods = []
    for i in range(ncm):
        methods.append(d[p:p + cmlen].split(b'\0')[0].decode()); p += cmlen
    if flags & 4:  # signed
        hsz, = struct.unpack_from('<i', d, p); p += 4
        p += hsz * 2 + 20 * nblocks
    files = []
    if flags & 8 and dirsize:
        q = p
        mount, q = _fstring(d, q)
        nd, = struct.unpack_from('<I', d, q); q += 4
        dirs = [struct.unpack_from('<IIII', d, q + 16 * i) for i in range(nd)]; q += 16 * nd
        nf, = struct.unpack_from('<I', d, q); q += 4
        fents = [struct.unpack_from('<III', d, q + 12 * i) for i in range(nf)]; q += 12 * nf
        ns, = struct.unpack_from('<I', d, q); q += 4
        strs = []
        for i in range(ns):
            s, q = _fstring(d, q); strs.append(s)
        NONE = 0xFFFFFFFF

        def walk(di, prefix):
            name, child, sib, ffile = dirs[di]
            here = prefix + (strs[name] + '/' if name != NONE else '')
            f = ffile
            while f != NONE:
                fn, nxt, ud = fents[f]
                files.append((here + strs[fn], ud)); f = nxt
            c = child
            while c != NONE:
                walk(c, here)
                c = dirs[c][2]
        walk(0, mount)
    return {'version': ver, 'flags': flags, 'count': n, 'block_size': cbs, 'ids': ids,
            'offlen': offlen, 'blocks': blocks, 'methods': methods, 'files': files, 'container_id': cid}


def ucas_ranges(toc, i):
    """Byte ranges in the .ucas that hold chunk i (uncompressed containers only)."""
    off, ln = toc['offlen'][i]
    bs = toc['block_size']
    out = []
    b0, b1 = off // bs, (off + ln - 1) // bs
    for b in range(b0, b1 + 1):
        boff, csz, usz, m = toc['blocks'][b]
        assert m == 0, 'compressed block'
        start = off - b * bs if b == b0 else 0
        end = (off + ln) - b * bs if b == b1 else usz
        out.append((boff + start, end - start))
    # merge contiguous
    merged = []
    for o, s in out:
        if merged and merged[-1][0] + merged[-1][1] == o:
            merged[-1] = (merged[-1][0], merged[-1][1] + s)
        else:
            merged.append((o, s))
    return merged
