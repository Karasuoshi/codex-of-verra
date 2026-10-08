"""Decode icon .uasset files from the extract_icons.ps1 zips into WebP files under icons/.

Usage: python3 tools/convert_icons.py <folder with icons_*.zip> [--all]
Converts the icons that records link to (build/icon_links.json) and the skill-tree node icons
(build/skill_trees.json); --all converts every texture in the zips. Writes build/icon_files.json
({'/Game/UI/Icons/...': 'relative/path.webp'}). Needs Pillow (and numpy for the float format).
"""
import json, zipfile, glob, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import utexture  # noqa: E402

ROOT = os.path.join(HERE, '..')
BUILD = os.path.join(ROOT, 'build')
OUT = os.path.join(ROOT, 'icons')


def wanted():
    need = set(json.load(open(os.path.join(BUILD, 'icon_links.json'))).values())
    p = os.path.join(BUILD, 'skill_trees.json')
    if os.path.exists(p):
        for t in json.load(open(p)).values():
            for n in t['nodes']:
                for x in [n] + n.get('choice', []):
                    if x.get('icon'):
                        need.add(x['icon'])
    return need


def main(parts, take_all=False):
    need = None if take_all else wanted()
    fp = os.path.join(BUILD, 'icon_files.json')
    files = json.load(open(fp)) if os.path.exists(fp) else {}
    bad = []
    for zf in sorted(glob.glob(os.path.join(parts, 'icons_*.zip'))):
        z = zipfile.ZipFile(zf)
        for n in z.namelist():
            g = '/Game/UI/Icons/' + n[:-len('.uasset')]
            if need is not None and g not in need:
                continue
            rel = n[:-len('.uasset')] + '.webp'
            p = os.path.join(OUT, rel)
            if not (os.path.exists(p) and os.path.getsize(p) > 0):
                try:
                    fmt, size, im = utexture.decode(z.read(n), want=128)
                except Exception as e:
                    bad.append((n, str(e)))
                    continue
                if max(im.size) > 128:
                    im.thumbnail((128, 128))
                os.makedirs(os.path.dirname(p), exist_ok=True)
                im.save(p, 'WEBP', quality=82, method=4)
            files[g] = rel
        print(os.path.basename(zf), len(files), flush=True)
    json.dump(files, open(fp, 'w'))
    print('icons', len(files), 'failed', len(bad), bad[:5])


if __name__ == '__main__':
    main(sys.argv[1], '--all' in sys.argv)
