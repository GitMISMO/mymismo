#!/usr/bin/env python3
"""Build MyMISMO's Hotel and Travel guide from the website.

Reads the public page https://www.mismo.org/events/hotel (kept by the website's Claude in Higher Logic) and writes
data/guide.json, so the app always says exactly what the website says: the venue, the room block and its booking
link, getting here and around, what to expect, where to eat and things to do.

Run by .github/workflows/guide.yml every morning, on any change to this file, and by hand (Run workflow).
If the page can't be read, or comes back without its venue and cards, nothing is written: the app keeps the last
good guide and the job fails, so the Failure Watcher sees it.

Usage: python3 tools/build_guide.py [--html saved.html] [--out data/guide.json]
"""
import json, os, re, sys, urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser

URL = 'https://www.mismo.org/events/hotel'
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}


class Node:
    def __init__(self, tag, attrs, parent):
        self.tag, self.attrs, self.parent, self.kids = tag, dict(attrs), parent, []

    def text(self):
        out = []
        for k in self.kids:
            out.append(k if isinstance(k, str) else ('' if k.tag in ('script', 'style', 'svg') else k.text()))
        return re.sub(r'\s+', ' ', ' '.join(out)).strip()

    def elems(self):
        return [k for k in self.kids if isinstance(k, Node)]

    def find_all(self, pred):
        found = []
        for k in self.elems():
            if pred(k):
                found.append(k)
            found.extend(k.find_all(pred))
        return found

    def find(self, pred):
        r = self.find_all(pred)
        return r[0] if r else None

    def classes(self):
        return (self.attrs.get('class') or '').split()


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node('root', [], None)
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur)
        self.cur.kids.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.kids.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is not self.root:
            self.cur = n.parent

    def handle_data(self, data):
        if data.strip():
            self.cur.kids.append(data)


def clean_url(u):
    u = (u or '').strip()
    return u if re.match(r'^https://[^\s"<>]+$', u) else ''


def card(n):
    """A .mismo-grid-card: kind and distance (two spans), name (h3), then its paragraphs; a link when it is an <a>."""
    spans = [s.text() for s in n.find_all(lambda x: x.tag == 'span')]
    h3 = n.find(lambda x: x.tag == 'h3')
    ps = [p.text() for p in n.find_all(lambda x: x.tag == 'p') if p.text()]
    c = {'name': h3.text() if h3 else ''}
    if len(spans) >= 2:
        c['kind'], c['distance'] = spans[0], spans[1]
    elif spans:
        c['kind'] = spans[0]
    if n.tag == 'a':
        c['url'] = clean_url(n.attrs.get('href'))
        if ps:
            c['address'] = ps[0]
        if len(ps) > 1:
            c['text'] = ' '.join(ps[1:])
    else:
        c['text'] = '\n\n'.join(ps)
    return c


def build(html):
    t = Tree()
    t.feed(html)
    root = t.root
    out = {'source': URL}
    # The site's own header can carry an h1 of its own, so the hero is the h1 whose box holds the dates and venue line.
    heroes = [h.parent for h in root.find_all(lambda x: x.tag == 'h1')
              if h.parent.find(lambda x: x.tag == 'span' and x.parent.tag == 'p')]
    if heroes:
        hero = heroes[0]
        ps = [p for p in hero.elems() if p.tag == 'p']
        if ps:
            out['summit'] = ps[0].text()
        spans = [s.text() for s in hero.find_all(lambda x: x.tag == 'span' and x.parent.tag == 'p')]
        if spans:
            out['dates'] = spans[0]
            if len(spans) > 1:
                out['venue'] = spans[1]
        addr = [p.text() for p in ps if re.search(r'\d{5}', p.text())]
        if addr:
            out['address'] = addr[0]
    book = root.find(lambda x: x.tag == 'a' and 'book your room' in x.text().lower())
    if book is not None:
        out['book'] = clean_url(book.attrs.get('href'))
    sections = []
    for h2 in root.find_all(lambda x: x.tag == 'h2'):
        box = h2.parent
        sibs = box.elems()
        i = sibs.index(h2)
        eyebrow = sibs[i - 1].text() if i > 0 and sibs[i - 1].tag == 'p' else ''
        intro = next((s.text() for s in sibs[i + 1:] if s.tag == 'p' and s.text()), '')
        cards = [card(c) for c in box.find_all(lambda x: 'mismo-grid-card' in x.classes())]
        cards = [c for c in cards if c.get('name')]
        notes = [s.text() for s in sibs[i + 1:] if s.tag == 'p' and s.text() and s.text() != intro]
        sec = {'id': re.sub(r'[^a-z0-9]+', '-', eyebrow.lower()).strip('-') or re.sub(r'[^a-z0-9]+', '-', h2.text().lower()).strip('-'),
               'eyebrow': eyebrow, 'title': h2.text(), 'intro': intro, 'cards': cards}
        if notes:
            sec['note'] = notes[-1]
        rb = box.find(lambda x: x.tag == 'h3' and x.find(lambda y: False) is None and 'reserve' in x.text().lower())
        if rb is not None:
            rbox = rb.parent
            rps = [p.text() for p in rbox.elems() if p.tag == 'p' and p.text()]
            sec['roomBlock'] = {'eyebrow': rps[0] if rps else '', 'title': rb.text(), 'text': ' '.join(rps[1:])}
        if cards or sec.get('roomBlock'):
            sections.append(sec)
    out['sections'] = sections
    # If the hero couldn't be read, the room block names the hotel and the dates.
    rb = next((x['roomBlock'] for x in sections if x.get('roomBlock')), None)
    venue = next((x for x in sections if x['id'] == 'the-venue'), None)
    if venue and not out.get('venue'):
        out['venue'] = venue['title']
    if not out.get('address'):
        hit = root.find(lambda x: x.tag == 'p' and re.fullmatch(r'\d+ [^,]+, [^,]+, [A-Z]{2} \d{5}', x.text() or ''))
        if hit is not None:
            out['address'] = hit.text()
    if rb and not out.get('dates'):
        m = re.search(r'([A-Z][a-z]+ \d{1,2}\s*[\u2013-]\s*\d{1,2}, \d{4})', rb['text'])
        if m:
            out['dates'] = m.group(1)
    return out


def good(g):
    """Only a guide with the venue, the booking link and at least eight cards is published."""
    n = sum(len(s['cards']) for s in g.get('sections', []))
    return bool(g.get('venue') and g.get('dates') and g.get('book') and n >= 8)


def main(argv):
    src, out = None, 'data/guide.json'
    for k, v in zip(argv[::2], argv[1::2]):
        if k == '--html':
            src = v
        elif k == '--out':
            out = v
    if src:
        html = open(src, encoding='utf-8').read()
    else:
        req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0 (MyMISMO guide; +https://resources.mismo.org/mymismo/)', 'Accept': 'text/html'})
        html = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')
    g = build(html)
    if not good(g):
        print('The Hotel and Travel page did not have its venue, booking link and cards; nothing written.', file=sys.stderr)
        print(json.dumps(g, indent=1)[:2000], file=sys.stderr)
        return 1
    try:
        prev = json.load(open(out, encoding='utf-8'))
    except Exception:
        prev = None
    if prev and {k: v for k, v in prev.items() if k != 'updated'} == g:
        print('No change.')
        return 0
    g = {'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), **g}
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(g, f, indent=1, ensure_ascii=False)
        f.write('\n')
    print('Wrote', out, sum(len(s['cards']) for s in g['sections']), 'cards')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
