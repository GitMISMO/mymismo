#!/usr/bin/env python3
"""Which sponsor logos have a see-through background (Jonna, Nov 25, 2026).

In dark mode the dashboard's Summit Sponsors tile shows a logo in white straight on the dark tile, instead of on a white
box. That only works for a logo drawn on a see-through background; a logo on its own white rectangle would turn into a
white block, so it keeps a small rounded light plate. This reads each summit's sponsor feed
(resources.mismo.org/sponsors/<season>-<year>.json, the summits named in summit-agenda/agenda.json), looks at each logo
and writes data/logo-bg.json: { updated, logos: { <logo address>: "clear" | "solid" | { kind: "clear", src } } }.
A logo on a plain white rectangle (a JPEG, say) gets a copy with that white taken away, saved as data/logo-clear/<name>.png
and listed as { kind: "clear", src }, so it can show in white on the dark tile too. A logo with a colored frame and white
inside it (ICE's) has the plain white taken away everywhere instead. A logo that can't be read is left out,
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
    edge = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    light = [p for p in edge if px[p][3] > 0 and min(px[p][:3]) >= 200]
    print('   edge of', url.rsplit('/', 1)[-1][:40], ':', round(len(light) / len(edge), 2), 'light; corner', px[0, 0][:3], file=sys.stderr)
    if len(light) < 0.85 * len(edge):
        return white_inside(im, px, w, h, edge, url)
    for p in light[::7]:
        if px[p][3] != 0:
            ImageDraw.floodfill(im, p, (255, 255, 255, 0), thresh=70)
    alpha = im.getchannel('A')
    clear = sum(1 for a in alpha.getdata() if a == 0) / (w * h)
    if clear < 0.12:
        return None
    return save_copy(im, url)


def white_inside(im, px, w, h, edge, url):
    """A logo drawn on a colored frame with white inside it (ICE's blue square, say): its edge isn't white, so the white
    can't be cleared from the edges. When the picture has no see-through parts and a good share of it is plain white,
    take all the plain white away instead (soft at the edges), so the frame and lettering show in white on the dark tile."""
    if any(px[p][3] < 250 for p in edge[::5]):
        return None
    total = w * h
    whites = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lo = min(r, g, b)
            if max(r, g, b) - lo < 40 and lo >= 180:
                px[x, y] = (r, g, b, int(255 * (255 - lo) / 75))
                whites += lo >= 225
    print('   ', url.rsplit('/', 1)[-1][:40], ': plain white inside', round(whites / total, 2), file=sys.stderr)
    if whites < 0.2 * total:
        return None
    return save_copy(im, url)


def save_copy(im, url):
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
