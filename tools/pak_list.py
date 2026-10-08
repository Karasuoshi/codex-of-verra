"""List files of an IoStore container and their byte ranges in the matching .ucas.

The extract_*.ps1 scripts read these ranges on Windows and pack the raw .uasset bytes into zips.
Usage: python3 tools/pak_list.py <container.utoc> <path prefix> <regex> > list.tsv
  e.g. pakchunk0-WindowsClient.utoc  ../../../AOC/Content/UI/Icons/  '\\.uasset$'
Output lines: <path relative to prefix> TAB <ucas offset> TAB <size>
Only uncompressed containers are supported (true for the 2026-01-20 client).
"""
import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iostore import parse_toc, ucas_ranges


def main(utoc, prefix, pattern):
    toc = parse_toc(utoc)
    rx = re.compile(pattern)
    for path, i in sorted(toc['files']):
        if not path.startswith(prefix) or not rx.search(path):
            continue
        rs = ucas_ranges(toc, i)
        if len(rs) != 1:
            print(f'skip {path}: {len(rs)} ranges', file=sys.stderr)
            continue
        print(f'{path[len(prefix):]}\t{rs[0][0]}\t{rs[0][1]}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
