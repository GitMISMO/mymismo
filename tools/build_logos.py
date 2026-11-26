#!/usr/bin/env python3
"""Which sponsor logos have a see-through background (Jonna, Nov 25, 2026).

In dark mode the dashboard's Summit Sponsors tile shows a logo in white straight on the dark tile, instead of on a white
box. That only works for a logo drawn on a see-through background; a logo on its own white rectangle would turn into a
white block, so it keeps a small rounded light plate. This reads each summit's sponsor feed
(resources.mismo.org/sponsors/<season>-<year>.json, the summits named in summit-agenda/agenda.json), looks at each logo
and writes data/logo-bg.json: { updated, logos: { <logo address>: "clear" | "solid" | { kind: "clear", src } } }.
A logo on a plain white rectangle (a JPEG, say) gets a copy with that white taken away, saved as data/logo-clear/<name>.png
and listed as { kind: "clear", src }, so it can show in white on the dark tile too. A logo that can't be read is left out,
and the app treats it as "solid". Run by .github/workflows/guide.yml.
"""
import hashlib, io, json, os, re, sys, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from build_guide import write  # noqa: E402
UA = {'User-Agent': 'Mozilla/5.0 (MyMISMO; +https://resources.mismo.org/mymismo/)'}


def get(url, raw=False):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        b = r.read()
        return b if raw else b.decode('utf-8', 'replace')


def slug(name):
    m = re.search(r'(\d{4})\s+(winter|spring|summer|fall|autumn)', name or '', re.I) or re.search(r'(winter|spring|summer|fall|autumn)\s+(\d{4})', name or '', re.I)
    if not m:
        return ''
    a, b = m.group(1), m.group(2)
    y, s = (a, b) if a.isdigit() else (b, a)
    return s.lower().replace('autumn', 'fall') + '-' + y


def kind(png):
    from PIL import Image
    im = Image.open(io.BytesIO(png)).convert('RGBA')
    im.thumbnail((200, 200))
    w, h = im.size
    px = im.load()
    alpha = [px[x, y][3] for x in range(w) for y in range(h)]
    clear = sum(1 for a in alpha if a < 20) / len(alpha)
    corners = [px[0, 0][3], px[w - 1, 0][3], px[0, h - 1][3], px[w - 1, h - 1][3]]
    return 'clear' if clear > 0.12 and max(corners) < 40 else 'solid'


def clear_copy(png, url):
    """Take away a plain white (or near-white) background that touches the edges; None if there isn't one."""
    from PIL import Image, ImageDraw
    im = Image.open(io.BytesIO(png)).convert('RGBA')
    if max(im.size) > 1200:
        im.thumbnail((1200, 1200))
    w, h = im.size
    px = im.load()
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    if not all(min(px[c][:3]) >= 225 for c in corners):
        return None
    for c in corners:
        if px[c][3] != 0:
            ImageDraw.floodfill(im, c, (255, 255, 255, 0), thresh=60)
    alpha = im.getchannel('A')
    clear = sum(1 for a in alpha.getdata() if a == 0) / (w * h)
    if clear < 0.12:
        return None
    os.makedirs('data/logo-clear', exist_ok=True)
    name = 'data/logo-clear/' + hashlib.sha1(url.encode()).hexdigest()[:16] + '.png'
    im.save(name, optimize=True)
    return name


def main():
    try:
        prev = json.load(open('data/logo-bg.json')).get('logos', {})
    except Exception:
        prev = {}
    agenda = json.loads(get('https://resources.mismo.org/summit-agenda/agenda.json'))
    logos = {}
    for s in (agenda.get('summits') or {}).values():
        sl = slug(s.get('name', ''))
        if not sl:
            continue
        try:
            feed = json.loads(get('https://resources.mismo.org/sponsors/' + sl + '.json'))
        except Exception:
            continue
        for sp in feed.get('sponsors', []):
            u = sp.get('logo') or ''
            if not u or u in logos:
                continue
            try:
                raw = get(u, raw=True)
                k = kind(raw)
                src = clear_copy(raw, u) if k == 'solid' else None
                logos[u] = {'kind': 'clear', 'src': src} if src else k
            except Exception as e:
                if u in prev:
                    logos[u] = prev[u]
                print('logo not read:', u, e, file=sys.stderr)
    if logos:
        write('data/logo-bg.json', {'logos': logos}, 'Sponsor logo backgrounds')
    print(sum(1 for v in logos.values() if v == 'clear'), 'clear,', sum(1 for v in logos.values() if isinstance(v, dict)), 'made clear,', sum(1 for v in logos.values() if v == 'solid'), 'solid')


if __name__ == '__main__':
    main()
