"""Extract localized texts (FText) from an Ashes of Creation DesignData cache (.dbc).

FText layout found in rows: u32 flags, u8 history(0), FString namespace, FString key (32 hex), FString source.
FString: int32 len (incl. NUL); negative len = UTF-16LE.
"""
import re, struct, sys, json

def load(path):
    d = open(path, 'rb').read()
    n = struct.unpack('<Q', d[20:28])[0]
    pool_off = struct.unpack('<I', d[0x28:0x2c])[0]; pool_size = struct.unpack('<I', d[0x30:0x34])[0]
    tables = []
    for i in range(n):
        b = 0x38 + i * 32
        chash = d[b:b + 4].hex(); tid = d[b + 4:b + 12].hex()
        off, _, size, _, rows = struct.unpack('<IIIII', d[b + 12:b + 32])
        tables.append({'index': i, 'id': tid, 'hash': chash, 'offset': off, 'size': size, 'rows': rows})
    return d, tables, (pool_off, pool_size)

def read_fstring(d, p, end):
    if p + 4 > end: return None, p
    ln = struct.unpack('<i', d[p:p + 4])[0]
    if ln == 0: return '', p + 4
    if ln > 0:
        if ln > 1 << 20 or p + 4 + ln > end or d[p + 4 + ln - 1] != 0: return None, p
        raw = d[p + 4:p + 4 + ln - 1]
        try: return raw.decode('utf-8'), p + 4 + ln
        except UnicodeDecodeError: return raw.decode('latin-1'), p + 4 + ln
    ln = -ln
    if ln > 1 << 20 or p + 4 + 2 * ln > end: return None, p
    raw = d[p + 4:p + 4 + 2 * ln - 2]
    try: return raw.decode('utf-16-le'), p + 4 + 2 * ln
    except UnicodeDecodeError: return None, p

KEY = re.compile(rb'\x21\x00\x00\x00[0-9A-F]{32}\x00')

def texts(d, t):
    s, e = t['offset'], t['offset'] + t['size']
    out = []
    for m in KEY.finditer(d, s, e):
        kp = m.start()
        key = d[kp + 4:kp + 36].decode()
        src, after = read_fstring(d, kp + 37, e)
        if src is None: continue
        # namespace precedes key: find FString ending right at kp
        ns = ''
        for L in range(1, 80):
            q = kp - 4 - L
            if q < s: break
            if struct.unpack('<i', d[q:q + 4])[0] == L and d[kp - 1] == 0:
                ns = d[q + 4:kp - 1].decode('latin-1'); break
        out.append({'pos': kp - s, 'ns': ns, 'key': key, 'text': src})
    return out

if __name__ == '__main__':
    d, T, pool = load(sys.argv[1])
    res = {}
    for t in T:
        tx = texts(d, t)
        if tx: res[t['index']] = {'table': t, 'texts': tx}
    json.dump(res, open(sys.argv[2], 'w'), ensure_ascii=False)
    print(len(res), 'tables with text,', sum(len(v['texts']) for v in res.values()), 'texts')
