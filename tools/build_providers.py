#!/usr/bin/env python3
"""MyMISMO's certification programs, certified provider pages and home-page pictures.

0. Programs: each organization certification's directory page on the website (eClose, RON, eVault, Product, FRAME
   Advisory Partner, Certified Consultant) lists who holds it, with logo and profile page. Written to
   data/programs.json, so the app's Certifications page shows every program with everyone certified in it.

1. Providers: for every company in the certification feeds (resources.mismo.org/certified/new-certifications.json and
   providers.json, published by the Certification Management System), reads its page on the website
   (www.mismo.org/standards-resources/<slug>) and writes data/providers.json: name, tagline, logo, website, the
   certifications held (with their badges) and About. The app shows these in place, exactly as the website says.
2. Pictures: a small picture of each summit sponsor's and certified provider's home page, saved as
   data/peeks/<host>.jpg (600 x 450), so the app shows it at once instead of waiting for it to be made.
   The pictures come from a public screenshot service (s0.wp.com/mshots), asked again until the real picture is ready.

A page or picture that can't be read keeps its last good copy. Run by .github/workflows/guide.yml.
Usage: python3 tools/build_providers.py [--provider-html saved.html]   (the second form only checks the parser)
"""
import io, json, os, re, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(__file__))
from build_guide import Tree, clean_url, write  # noqa: E402

UA = {'User-Agent': 'Mozilla/5.0 (MyMISMO; +https://resources.mismo.org/mymismo/)'}
FEEDS = 'https://resources.mismo.org/certified/'
SR = 'https://www.mismo.org/standards-resources/'
OC = SR + 'certification/organization-certifications/'
# key, the directory page that lists who holds it, the page about the certification
PROGRAMS = [('ron', 'ron-certified-providers', 'ron'), ('eclose', 'eclosing-certified-providers', 'eclose'),
            ('evault', 'evault-certified-providers', 'evault'), ('product', 'certified-product-providers', 'product'),
            ('frame-advisory-partner', 'frame-advisory-partners', 'frame-advisory-partner'),
            ('certified-consultant', 'certified-consultants', 'certified-consultant')]


def get(url, timeout=30, raw=False):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        b = r.read()
        return b if raw else b.decode('utf-8', 'replace')


def parse_provider(html, slug):
    t = Tree(); t.feed(html); root = t.root
    hero = None
    for h1 in root.find_all(lambda x: x.tag == 'h1'):
        box = h1.parent
        if box.find(lambda x: x.tag == 'a' and x.text().lower().startswith('visit')) is not None:
            hero = box; break
    if hero is None:
        return None
    base = 'https://www.mismo.org/standards-resources/'
    h1 = hero.find(lambda x: x.tag == 'h1')
    sub = hero.find(lambda x: x.tag == 'p' and 'data-sub' in x.attrs)
    visit = hero.find(lambda x: x.tag == 'a' and x.text().lower().startswith('visit'))
    logo_img = None
    if hero.parent is not None:
        for sib in hero.parent.elems():
            if sib is not hero:
                logo_img = sib.find(lambda x: x.tag == 'img') or logo_img
    p = {'slug': slug, 'name': h1.text(), 'tagline': sub.text() if sub is not None else '',
         'website': clean_url(visit.attrs.get('href'), base) if visit is not None else '',
         'logo': clean_url(logo_img.attrs.get('src'), base) if logo_img is not None else '',
         'tags': [s.text() for s in hero.find_all(lambda x: x.tag == 'span') if s.text()],
         'certs': [], 'about': []}
    held = root.find(lambda x: x.tag == 'h2' and x.text().lower().startswith('certifications held'))
    if held is not None:
        for a in held.parent.find_all(lambda x: x.tag == 'a'):
            img = a.find(lambda x: x.tag == 'img'); divs = [d.text() for d in a.find_all(lambda x: x.tag == 'div') if d.text()]
            if divs:
                p['certs'].append({'title': divs[0], 'badge': clean_url(img.attrs.get('src'), base) if img is not None else '', 'url': clean_url(a.attrs.get('href'), base)})
    about = root.find(lambda x: x.tag == 'h2' and x.text().lower().startswith('about'))
    if about is not None:
        p['aboutTitle'] = about.text()
        p['about'] = [x.text() for x in about.parent.elems() if x.tag == 'p' and x.text()]
    return p


def parse_directory(html):
    """A directory page: its title, and each a.mismo-provider-card (logo, name, profile slug)."""
    t = Tree(); t.feed(html); root = t.root
    h1s = [h for h in root.find_all(lambda x: x.tag == 'h1') if h.text()]
    title = h1s[1].text() if len(h1s) > 1 else (h1s[0].text() if h1s else '')
    members = []
    # cards are a.mismo-provider-card on most pages; FRAME's page has the same card without the class
    for a in root.find_all(lambda x: x.tag == 'a' and ('mismo-provider-card' in x.classes() or (
            x.find(lambda y: y.tag == 'img') is not None and 'view profile' in x.text().lower()))):
        spans = [x for x in a.elems() if x.tag == 'span']
        name = next((x.text() for x in spans if x.text() and not x.text().lower().startswith('view profile')), '')
        img = a.find(lambda x: x.tag == 'img')
        slug = (a.attrs.get('href') or '').split('?')[0].rstrip('/').rsplit('/', 1)[-1]
        if name and re.match(r'^[a-z0-9-]+$', slug):
            members.append({'name': name, 'slug': slug, 'logo': clean_url(img.attrs.get('src'), SR) if img is not None else ''})
    return {'title': re.sub(r'\s+', ' ', title), 'members': members}


def program_blurb(html):
    t = Tree(); t.feed(html); root = t.root
    h1s = [h for h in root.find_all(lambda x: x.tag == 'h1') if h.text()]
    title = h1s[1].text() if len(h1s) > 1 else (h1s[0].text() if h1s else '')
    p = next((x.text() for x in root.find_all(lambda x: x.tag == 'p') if len(x.text()) > 70), '')
    return re.sub(r'\s+', ' ', title), p


def host_of(url):
    try:
        return urllib.parse.urlparse(url).hostname.replace('www.', '') if url else ''
    except Exception:
        return ''


def peek(url, out_dir, index):
    """Save a 600x450 picture of url's home page; True when saved (or already fresh, under a week old)."""
    host = host_of(url)
    if not host or not re.match(r'^[a-z0-9.-]+$', host):
        return False
    path = os.path.join(out_dir, host + '.jpg')
    if os.path.exists(path) and time.time() - index.get(host, 0) < 7 * 86400:
        return True
    from PIL import Image
    src = 'https://s0.wp.com/mshots/v1/' + urllib.parse.quote(url, safe='') + '?w=1200&h=900'
    for n in range(8):
        try:
            b = get(src + ('&r=%d' % n if n else ''), timeout=40, raw=True)
            im = Image.open(io.BytesIO(b))
            if im.width >= 1000:
                im = im.convert('RGB').resize((600, 450), Image.LANCZOS)
                os.makedirs(out_dir, exist_ok=True)
                im.save(path, 'JPEG', quality=78, optimize=True, progressive=True)
                index[host] = int(time.time())
                return True
        except Exception as e:
            print('  picture try', n, host, e)
        time.sleep(5)
    return False


def main(argv):
    opts = dict(zip(argv[::2], argv[1::2]))
    if '--directory-html' in opts:
        d = parse_directory(open(opts['--directory-html'], encoding='utf-8').read())
        print(json.dumps(d, indent=1))
        return 0 if len(d['members']) >= 3 and d['title'] else 1
    if '--provider-html' in opts:
        p = parse_provider(open(opts['--provider-html'], encoding='utf-8').read(), 'test')
        ok = p and p['name'] and p['website'] and p['certs'] and p['about']
        print(json.dumps(p, indent=1))
        return 0 if ok else 1
    failed = 0
    new = json.loads(get(FEEDS + 'new-certifications.json'))
    prov = json.loads(get(FEEDS + 'providers.json'))
    slugs = []
    for c in new.get('certifications', []) + prov.get('providers', []):
        s = c.get('slug')
        if s and re.match(r'^[a-z0-9-]+$', s) and s not in slugs:
            slugs.append(s)
    # the programs and everyone in them
    try:
        prevp = {p['key']: p for p in json.load(open('data/programs.json', encoding='utf-8')).get('programs', [])}
    except Exception:
        prevp = {}
    progs = []
    for key, directory, about in PROGRAMS:
        try:
            d = parse_directory(get(SR + directory))
            ttl, blurb = program_blurb(get(OC + about))
            if not d['members']:
                raise ValueError('no members')
            progs.append({'key': key, 'title': ttl or d['title'], 'blurb': blurb, 'about': OC + about, 'directory': SR + directory, 'members': d['members']})
        except Exception as e:
            print('program', key, e)
            if key in prevp:
                progs.append(prevp[key])
        time.sleep(0.5)
    if len(progs) >= 4:
        write('data/programs.json', {'source': SR + 'certification', 'programs': progs}, 'Certification programs')
    else:
        print('Fewer than 4 certification programs could be read; nothing written.', file=sys.stderr); failed = 1
    for pg in progs:
        for m in pg['members']:
            if m['slug'] not in slugs:
                slugs.append(m['slug'])
    try:
        prev = json.load(open('data/providers.json', encoding='utf-8')).get('providers', {})
    except Exception:
        prev = {}
    out = {}
    for s in slugs:
        try:
            p = parse_provider(get('https://www.mismo.org/standards-resources/' + s), s)
        except Exception as e:
            p = None; print('provider page', s, e)
        if p and p['name']:
            out[s] = p
        elif s in prev:
            out[s] = prev[s]
        time.sleep(0.5)
    if len(out) >= 10:
        write('data/providers.json', {'source': 'https://www.mismo.org/standards-resources/', 'providers': out}, 'Certified providers')
    else:
        print('Fewer than 10 provider pages could be read; nothing written.', file=sys.stderr); failed = 1
    # pictures: sponsors of every summit in the agenda, and the providers' websites
    sites = [p.get('website') for p in out.values() if p.get('website')]
    try:
        ag = json.loads(get('https://resources.mismo.org/summit-agenda/agenda.json'))
        for s in ag.get('summits', {}).values():
            m = re.match(r'^(\d{4})\s+(\w+)', s.get('name', ''))
            if not m:
                continue
            try:
                sp = json.loads(get('https://resources.mismo.org/sponsors/%s-%s.json' % (m.group(2).lower(), m.group(1))))
                sites += [x.get('url') for x in sp.get('sponsors', []) if x.get('url')]
            except Exception:
                pass
    except Exception as e:
        print('agenda', e)
    # the restaurants and things to do on Explore (from the Hotel and Travel guide): their home pages
    try:
        for sec in json.load(open('data/guide.json', encoding='utf-8')).get('sections', []):
            for c in sec.get('cards', []):
                u = c.get('url') or ''
                if u.startswith('https://') and host_of(u):
                    sites.append('https://' + urllib.parse.urlsplit(u).netloc + '/')
    except Exception as e:
        print('guide places', e)
    try:
        index = json.load(open('data/peeks/index.json', encoding='utf-8'))
    except Exception:
        index = {}
    seen = set(); made = 0
    for u in sites:
        h = host_of(u)
        if not h or h in seen:
            continue
        seen.add(h)
        if peek(u, 'data/peeks', index):
            made += 1
    os.makedirs('data/peeks', exist_ok=True)
    with open('data/peeks/index.json', 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=1, sort_keys=True); f.write('\n')
    print('Pictures ready:', made, 'of', len(seen))
    return failed


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
