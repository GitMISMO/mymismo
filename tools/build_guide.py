#!/usr/bin/env python3
"""Build MyMISMO's Hotel and Travel guide, and the summit's welcome, from the website.

Reads the public page https://www.mismo.org/events/hotel (kept by the website's Claude in Higher Logic) and writes
data/guide.json, so the app always says exactly what the website says: the venue, the room block and its booking
link, getting here and around, what to expect, where to eat and things to do.

Run by .github/workflows/guide.yml every morning, on any change to this file, and by hand (Run workflow).
If the page can't be read, or comes back without its venue and cards, nothing is written: the app keeps the last
good guide and the job fails, so the Failure Watcher sees it.

It also reads https://www.mismo.org/events/summit for the summit's welcome on MyMISMO's summit Home: the title and
subtitle (The Next Chapter Starts in New Orleans; New Orleans. New Ideas. Lasting Change.), the paragraphs under
them, At a Glance and the Register Now link, into data/event.json. Each page is checked on its own; one that can't
be read keeps its last good copy.

And it reads https://www.mismo.org/events/agenda for the logos the website shows on sessions ("Sponsored by",
"Presented by", "Powered by"), with each one's day, start time and title, into data/agenda-tags.json, so the app
tags the same sessions the website does (MISMO Link Office Hours, sponsored workgroups and breaks).

Usage: python3 tools/build_guide.py [--html saved.html] [--out data/guide.json] [--summit-html saved.html] [--event-out data/event.json] [--agenda-html saved.html] [--tags-out data/agenda-tags.json]
"""
import json, os, re, sys, urllib.parse, urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser

URL = 'https://www.mismo.org/events/hotel'
SUMMIT_URL = 'https://www.mismo.org/events/summit'
AGENDA_URL = 'https://www.mismo.org/events/agenda'
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


def clean_url(u, base='https://www.mismo.org/events/'):
    u = (u or '').strip()
    if u and not re.match(r'^[a-z]+:', u, re.I) and not u.startswith('#'):
        u = urllib.parse.urljoin(base, u)
    return u if re.match(r'^https://[^\s"<>]+$', u) else '' if re.match(r'^https://[^\s"<>]+$', u) else ''


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


MONTH = r'(January|February|March|April|May|June|July|August|September|October|November|December)'


def build_event(html):
    """The summit page: the hero (name, dates, venue, Register Now) and the welcome section under it."""
    t = Tree()
    t.feed(html)
    root = t.root
    ev = {'source': SUMMIT_URL}
    heroes = [h.parent for h in root.find_all(lambda x: x.tag == 'h1')
              if any(p.tag == 'p' and re.search(MONTH + r' \d', p.text()) for p in h.parent.elems())]
    if heroes:
        hero = heroes[0]
        ev['name'] = hero.find(lambda x: x.tag == 'h1').text()
        ps = [p for p in hero.elems() if p.tag == 'p' and p.text()]
        m = re.match(MONTH + r' [\d\u2013\-, ]+\d{4}', ps[0].text())
        if m:
            ev['dates'] = m.group(0).strip()
            ev['venue'] = ps[0].text()[m.end():].strip()
        if len(ps) > 1:
            ev['tagline'] = ps[1].text()
    reg = root.find(lambda x: x.tag == 'a' and x.text().lower().startswith('register now'))
    if reg is not None:
        ev['register'] = clean_url(reg.attrs.get('href'))
    for h2 in root.find_all(lambda x: x.tag == 'h2'):
        sibs = h2.parent.elems()
        i = sibs.index(h2)
        after = sibs[i + 1:]
        body = next((d for d in after if d.tag == 'div' and len(d.find_all(lambda x: x.tag == 'p')) >= 3), None)
        if body is None:
            continue
        ev['eyebrow'] = sibs[i - 1].text().title() if i > 0 and sibs[i - 1].tag == 'p' else ''
        ev['title'] = h2.text()
        sub = next((p for p in after if p.tag == 'p' and p.text()), None)
        ev['subtitle'] = sub.text() if sub is not None else ''
        cols = body.elems()
        paras, glance = [], []
        for col in cols:
            ps = [p for p in col.find_all(lambda x: x.tag == 'p') if p.text()]
            if ps and ps[0].text().strip().lower() == 'at a glance':
                rest = [p.text() for p in ps[1:]]
                k = 0
                while k < len(rest):
                    if re.match(MONTH + r' \d', rest[k]) and k + 1 < len(rest) and not re.match(MONTH + r' \d', rest[k + 1]):
                        glance.append({'when': rest[k], 'what': rest[k + 1]})
                        k += 2
                    else:
                        k += 1
            else:
                for p in ps:
                    # a paragraph that is only a link (the "Will you join us?" line) is the Register button in the app
                    # the short closing question ("Will you join us to create lasting change?") leads into Register Now
                    if len(p.text()) < 90 and p.text().endswith('?'):
                        ev['closer'] = p.text()
                        continue
                    paras.append(p.text())
        ev['paragraphs'] = paras
        ev['glance'] = glance
        break
    return ev


def logo_name(src):
    """viant-eye-logo_viant-eye-primary-logo….png -> Viant Eye; cotality-logo.png -> Cotality; xactus_logo_color….png -> Xactus"""
    f = src.rsplit('/', 1)[-1].split('?')[0]
    base = re.split(r'[-_]logo', f, maxsplit=1, flags=re.I)[0]
    base = re.sub(r'\.[a-z]+$', '', base, flags=re.I)
    return ' '.join(w.capitalize() for w in re.split(r'[-_\s]+', base) if w)


def build_tags(html):
    """The website agenda's "Sponsored by" / "Presented by" plates, each with its day, start time and session title."""
    t = Tree()
    t.feed(html)
    root = t.root
    out = {'source': AGENDA_URL, 'tags': []}
    day, cards = None, 0
    def walk(n):
        nonlocal day, cards
        for k in n.elems():
            cls = k.classes()
            if 'agd-dayhead' in cls:
                m = re.search(MONTH + r' (\d{1,2}), (\d{4})', k.text())
                if m:
                    mon = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].index(m.group(1)) + 1
                    day = '%s-%02d-%02d' % (m.group(3), mon, int(m.group(2)))
                continue
            if 'agd-card' in cls or 'agd-break' in cls:
                cards += 1
                plate = k.find(lambda x: 'agd-sp' in x.classes() or 'agd-bsp' in x.classes())
                if plate is not None and day:
                    if 'agd-card' in cls:
                        h3 = k.find(lambda x: x.tag == 'h3')
                        title = h3.text() if h3 is not None else ''
                        tm = k.find(lambda x: 'agd-time' in x.classes())
                        when = tm.text() if tm is not None else ''
                    else:
                        st = k.find(lambda x: x.tag == 'strong')
                        title = st.text() if st is not None else ''
                        b = k.find(lambda x: x.tag == 'b')
                        when = b.text() if b is not None else ''
                    lab = plate.find(lambda x: x.tag == 'span')
                    label = lab.text() if lab is not None else 'Sponsored by'
                    pw = re.search(r',?\s*Powered by (.+)$', title)
                    a = plate.find(lambda x: x.tag == 'a')
                    img = plate.find(lambda x: x.tag == 'img')
                    logo = clean_url(img.attrs.get('src')) if img is not None else ''
                    tag = {'date': day, 'start': (re.match(r'\d{1,2}:\d{2}\s*[AP]M', when.strip()) or [''])[0],
                           'title': title[:pw.start()].strip() if pw else title,
                           'label': 'Powered by' if pw else label,
                           'name': pw.group(1).strip() if pw else logo_name(logo),
                           'url': clean_url(a.attrs.get('href')) if a is not None else '', 'logo': logo}
                    if tag['title'] and tag['logo']:
                        out['tags'].append(tag)
                continue
            walk(k)
    walk(root)
    out['cards'] = cards
    return out


def good_event(e):
    return bool(e.get('title') and e.get('subtitle') and e.get('dates') and e.get('paragraphs'))


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (MyMISMO guide; +https://resources.mismo.org/mymismo/)', 'Accept': 'text/html'})
    return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')


def write(out, g, what):
    try:
        prev = json.load(open(out, encoding='utf-8'))
    except Exception:
        prev = None
    if prev and {k: v for k, v in prev.items() if k != 'updated'} == g:
        print(what + ': no change.')
        return
    g = {'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), **g}
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(g, f, indent=1, ensure_ascii=False)
        f.write('\n')
    print(what + ': wrote', out)


def main(argv):
    opts = dict(zip(argv[::2], argv[1::2]))
    only_files = '--html' in opts or '--summit-html' in opts or '--agenda-html' in opts
    failed = 0
    if '--html' in opts or not only_files:
        html = open(opts['--html'], encoding='utf-8').read() if '--html' in opts else fetch(URL)
        g = build(html)
        if good(g):
            write(opts.get('--out', 'data/guide.json'), g, 'Hotel and Travel')
        else:
            print('The Hotel and Travel page did not have its venue, booking link and cards; nothing written.', file=sys.stderr)
            print(json.dumps(g, indent=1)[:2000], file=sys.stderr)
            failed = 1
    if '--summit-html' in opts or not only_files:
        html = open(opts['--summit-html'], encoding='utf-8').read() if '--summit-html' in opts else fetch(SUMMIT_URL)
        e = build_event(html)
        if good_event(e):
            write(opts.get('--event-out', 'data/event.json'), e, 'Summit welcome')
        else:
            print('The Summit page did not have its title, subtitle, dates and paragraphs; nothing written.', file=sys.stderr)
            print(json.dumps(e, indent=1)[:2000], file=sys.stderr)
            failed = 1
    if '--agenda-html' in opts or not only_files:
        html = open(opts['--agenda-html'], encoding='utf-8').read() if '--agenda-html' in opts else fetch(AGENDA_URL)
        tg = build_tags(html)
        if tg.get('cards', 0) >= 4:
            tg.pop('cards')
            write(opts.get('--tags-out', 'data/agenda-tags.json'), tg, 'Agenda sponsor tags')
        else:
            print('The Agenda page did not have its day and session cards; nothing written.', file=sys.stderr)
            failed = 1
    return failed


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
