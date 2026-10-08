"""Decoder for DesignData loot tables (table 255, record type RewardTableDef).

Wire format learned from AshesCodex samples + byte comparison:
  ref       = u64 guid, u64 table id, u32 pool-ref of name ("None")      -> 20 bytes
  string    = u32 pool-ref (expressions, enums, names)
  array     = u32 count + elements
  bool      = u8
  FText     = u32 flags, i8 history; history 0 -> FString ns, key, source; history -1 -> u32 hasInvariant(+FString)
  curve     = string externalCurve, array<key>, f32 default, string preExtrap, string postExtrap, u32 handles(0)
"""
import struct, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from dbc_text import read_fstring

class R:
    def __init__(self, d, p, end, pool, tables):
        self.d, self.p, self.end, self.pool, self.tables = d, p, end, pool, tables
    def u8(self): v = self.d[self.p]; self.p += 1; return v
    def u32(self): v = struct.unpack_from('<I', self.d, self.p)[0]; self.p += 4; return v
    def i32(self): v = struct.unpack_from('<i', self.d, self.p)[0]; self.p += 4; return v
    def f32(self): v = struct.unpack_from('<f', self.d, self.p)[0]; self.p += 4; return v
    def u64(self): v = struct.unpack_from('<Q', self.d, self.p)[0]; self.p += 8; return v
    def s(self):
        o = self.u32(); po, ps = self.pool
        if o >= ps: raise ValueError('bad pool ref %x at %d' % (o, self.p))
        v, _ = read_fstring(self.d, po + o, po + ps)
        if v is None: raise ValueError('bad string at %d' % self.p)
        return v
    def ref(self):
        g = self.u64(); tid = self.d[self.p:self.p + 8].hex(); self.p += 8; nm = self.s()
        out = {'guid': str(g), 'table': self.tables.get(tid, tid)}
        if nm != 'None': out['name'] = nm
        return out
    def arr(self, fn):
        n = self.u32()
        if n > 100000: raise ValueError('bad count %d at %d' % (n, self.p))
        return [fn() for _ in range(n)]
    def fstring(self):
        v, self.p = read_fstring(self.d, self.p, self.end)
        if v is None: raise ValueError('bad fstring at %d' % self.p)
        return v
    def ftext(self):
        flags = self.u32(); h = struct.unpack('b', bytes([self.u8()]))[0]
        if h == -1:
            has = self.u32()
            return self.fstring() if has else ''
        if h == 0:
            ns = self.fstring(); key = self.fstring(); return self.fstring()
        raise ValueError('ftext history %d at %d' % (h, self.p))
    def curve(self):
        ext = self.s()
        keys = self.arr(lambda: [self.u8(), self.u8(), self.u8(), self.f32(), self.f32(), self.f32(), self.f32(), self.f32(), self.f32()])
        default = self.f32(); pre = self.s(); post = self.s()
        c = {'keys': [[k[3], k[4]] for k in keys]}
        if ext not in ('', 'None'): c['external'] = ext
        return c

def enum(v): return v.split('::', 1)[1] if '::' in v else v

def item_reward(r):
    item = r.ref(); var = r.ref(); qty = r.s(); prio = r.u8()
    out = {'item': item, 'quantity': qty}
    if var['guid'] != '0': out['variation'] = var
    if prio: out['prioritize_quality'] = True
    return out

def xp_reward(r):
    return {'type': enum(r.s()), 'value': r.s(), 'context': r.ref(), 'profession': r.ref(),
            'gathering_resource': r.ref(), 'crafting_recipe': r.ref()}

def reward(r):
    name = r.ftext()
    cur_flag = r.u32()
    currency = r.arr(lambda: {'currency': r.ref(), 'amount': r.s()})
    items = r.arr(lambda: item_reward(r))
    xp = r.arr(lambda: xp_reward(r))
    out = {}
    if name: out['display_name'] = name
    if currency: out['currency'] = currency
    if cur_flag: out['currency_flag'] = cur_flag
    if items: out['items'] = items
    if xp: out['experience'] = xp
    return out

def container(r):
    pred = r.s(); alg = enum(r.s()); nsel = r.u32(); method = enum(r.s())
    wcurve = r.curve(); weights = r.arr(r.i32); wexpr = r.arr(r.s); pct = r.arr(r.s); maxc = r.u32()
    rewards = r.arr(lambda: reward(r)); icon = r.s()
    out = {'selection': alg, 'grant': method, 'rewards': rewards}
    if pred: out['predicate'] = pred
    if nsel: out['number_to_select'] = nsel
    if weights: out['weights'] = weights
    if pct: out['drop_percent'] = pct
    if maxc: out['max_choices'] = maxc
    if wexpr: out['weight_expressions'] = wexpr
    if wcurve['keys'] or 'external' in wcurve: out['weight_curve'] = wcurve
    return out

def loot_table(r):
    pred = r.s(); callout = enum(r.s())
    containers = r.arr(lambda: container(r))
    sub_alg = enum(r.s()); nsub = r.u32(); sw = r.arr(r.i32); swexpr = r.arr(r.s); sp = r.arr(r.s); scurve = r.curve()
    subs = r.arr(r.ref)
    out = {'containers': containers}
    if pred: out['predicate'] = pred
    if callout != 'None': out['callout'] = callout
    if subs:
        out['subtables'] = {'selection': sub_alg, 'number_to_select': nsub, 'tables': subs}
        if sw: out['subtables']['weights'] = sw
        if sp: out['subtables']['percent'] = sp
        if swexpr: out['subtables']['weight_expressions'] = swexpr
    return out


def decode_table(d, t, pool, tables):
    """Sequentially decode every record of the loot table: record body, then trailer
    (u64 guid, 8 zero bytes, u32 name ref). Small gaps between parts are zero padding."""
    s, e = t['offset'], t['offset'] + t['size']
    p, out, errors = s, [], []
    while p < e - 20:
        rec = None
        for k in range(0, 12):
            rd = R(d, p + k, e, pool, tables)
            try:
                body = loot_table(rd)
            except Exception:
                continue
            # find trailer within a few bytes
            for j in range(0, 6):
                q = rd.p + j
                if q + 20 > e: break
                if d[q + 8:q + 16] == b'\x00' * 8:
                    g = struct.unpack_from('<Q', d, q)[0]
                    try:
                        nm = R(d, q + 16, e, pool, tables).s()
                    except Exception:
                        continue
                    if g and nm != 'None':
                        rec = {'guid': str(g), 'name': nm, **body}; p = q + 20; break
            if rec: break
        if not rec:
            errors.append(p - s)
            # resync: skip to next trailer-like position
            nxt = d.find(b'\x00' * 8, p + 1, e)
            if nxt < 0: break
            p = nxt + 12
            continue
        out.append(rec)
    return out, errors
