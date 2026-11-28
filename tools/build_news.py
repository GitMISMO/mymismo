#!/usr/bin/env python3
"""Build MyMISMO's News tile from the website's News page.

Reads the public page https://www.mismo.org/about-mismo/news (kept by the website's Claude) and writes data/news.json:
the newest releases first, each with its date, title, one-line summary and link (most go to the MBA newsroom).
Run by .github/workflows/guide.yml with the other website pages. If the page can't be read, or comes back with no
releases, nothing is written: the app keeps the last good list and the job fails, so the Failure Watcher sees it.

Usage: python3 tools/build_news.py [--html saved.html] [--out data/news.json]
"""
import json, re, sys, urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser

URL = 'https://www.mismo.org/about-mismo/news'
KEEP = 24


class News(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items, self.cur, self.field, self.depth = [], None, None, 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs); cls = (a.get('class') or '').split()
        if tag == 'a' and 'nwc' in cls:
            self.cur = {'url': a.get('href') or '', 'date': '', 'title': '', 'summary': ''}; self.depth = 0; return
        if self.cur is None: return
        if tag == 'a': self.depth += 1
        if tag == 'span' and 'nwd' in cls: self.field = 'date'
        elif tag in ('h3', 'h4'): self.field = 'title'
        elif tag == 'p' and not self.cur['summary']: self.field = 'summary'

    def handle_endtag(self, tag):
        if self.cur is None: return
        if tag == 'a':
            if self.depth: self.depth -= 1; return
            c = {k: re.sub(r'\s+', ' ', v).strip() for k, v in self.cur.items()}
            if c['title'] and c['url']: self.items.append(c)
            self.cur = None; self.field = None; return
        if tag in ('span', 'h3', 'h4', 'p'): self.field = None

    def handle_data(self, d):
        if self.cur is not None and self.field: self.cur[self.field] += d


def iso(d):
    for f in ('%B %d, %Y', '%b %d, %Y'):
        try: return datetime.strptime(d, f).strftime('%Y-%m-%d')
        except ValueError: pass
    return ''


def build(html):
    p = News(); p.feed(html)
    seen, out = set(), []
    for it in p.items:
        if it['url'] in seen: continue
        seen.add(it['url'])
        when = iso(it['date'])
        if not when: continue
        out.append({'date': when, 'title': it['title'], 'summary': it['summary'][:260], 'url': it['url']})
    out.sort(key=lambda x: x['date'], reverse=True)
    return out[:KEEP]


def main():
    args = sys.argv[1:]
    src = args[args.index('--html') + 1] if '--html' in args else None
    dest = args[args.index('--out') + 1] if '--out' in args else 'data/news.json'
    try:
        if src: html = open(src, encoding='utf-8').read()
        else:
            req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0 (MyMISMO news; +https://resources.mismo.org/mymismo/)', 'Accept': 'text/html'})
            html = urllib.request.urlopen(req, timeout=40).read().decode('utf-8', 'replace')
    except Exception as e:
        print('Could not read the News page:', e); sys.exit(1)
    items = build(html)
    if len(items) < 3:
        print('The News page came back with', len(items), 'releases; keeping the last good list.'); sys.exit(1)
    data = {'source': URL, 'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'items': items}
    old = None
    try: old = json.load(open(dest))
    except Exception: pass
    if old and old.get('items') == items: print('No change.'); return
    json.dump(data, open(dest, 'w'), indent=1, ensure_ascii=False); open(dest, 'a').write('\n')
    print('Saved', len(items), 'releases, newest', items[0]['date'], items[0]['title'][:60])


if __name__ == '__main__':
    main()
