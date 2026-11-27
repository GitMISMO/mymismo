/* MyMISMO: name tag scanning and Summit Photos (relay request 17). Run: node test-mymismo17.mjs. A stand-in GitHub and mail
 * flow, as test-mymismo16.mjs. Every person, address and registration number here is made up. */
import { pbkdf2Sync, createHmac } from 'node:crypto';
const ORIGIN = 'https://resources.example';
Object.assign(process.env, { GITHUB_TOKEN: 'ghp_test', AUTH_SECRET: 'mymismo-test-secret', PROJECTS_REPO: 'Org/Config', DIRECTORY_REPO: 'Org/Accounts', MAIL_FLOW_URL: 'https://flow.example/mail' });
let N = 100; const sha = () => (N++).toString(16).padEnd(40, 'c'); const repo = {};
const put = (key, data, message = 'seed', raw = false) => { (repo[key] = repo[key] || []).push({ sha: sha(), data, message, raw }); };
const pb = pw => { const s = 'cc'.repeat(16); return `pbkdf2$1000$${s}$${pbkdf2Sync(pw, Buffer.from(s, 'hex'), 1000, 32, 'sha256').toString('hex')}`; };
const FEED = { repo: 'Org/SummitData', path: 'data/feed-mymismo-attendees.json' };
const ENTRY = { repo: 'Org/MyMismoData', origin: ORIGIN, writable: [], attendeeFeed: FEED, attendees: true };
const setProjects = entry => { put('Org/Config:projects.json', { mymismo: entry, 'summit-hq': { repo: 'Org/SummitData', origin: ORIGIN, writable: ['data/'] } }); __resetProjectsCache(); };
put('Org/Accounts:access.json', { people: {
  'staff@example.org': { name: 'Sky Staff', hash: pb('x'), access: { mymismo: 'admin', 'summit-hq': 'admin' } },
  'fac@example.org': { name: 'Fay Facilitator', hash: pb('x'), access: { mymismo: 'staff', 'meeting-trackers': 'staff' } },
  'view@example.org': { name: 'Vic View', hash: pb('x'), access: { mymismo: 'view', 'summit-hq': 'view' } },
  'none@example.org': { name: 'No App', hash: pb('x'), access: { 'summit-hq': 'admin' } } } });
const LAST = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), FIRST = new Date(Date.now() + 17 * 86400000).toISOString().slice(0, 10);
put('Org/SummitData:data/feed-mymismo-attendees.json', { updated: new Date().toISOString(), summits: {
  nola: { name: '2027 Winter Summit', first: FIRST, last: LAST, people: [
    { e: 'pat@lender.example', first: 'Pat', last: 'Lee', company: 'Lender Co', title: 'CTO', reg: ['1000001'] },
    { e: 'sam@bank.example', first: 'Sam', last: 'Roe', company: 'Bank Inc', title: 'VP Data', reg: ['1000002', 'bad'] }] } } });
const mails = [];
const R = (status, j) => ({ status, ok: status < 300, headers: { get: () => null }, json: async () => j, text: async () => '' });
globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  if (url === 'https://flow.example/mail') { mails.push(JSON.parse(opts.body)); return R(202, {}); }
  const m = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/contents\/([^?]+)/);
  if (!m) return R(404, {});
  const key = m[1] + ':' + decodeURIComponent(m[2]), h = repo[key];
  if (method === 'GET') { const v = h && h[h.length - 1];
    if (!v) { const pre = key + '/', names = Object.keys(repo).filter(k => k.startsWith(pre) && !k.slice(pre.length).includes('/')).map(k => ({ name: k.slice(pre.length), type: 'file' })); return names.length ? R(200, names) : R(404, {}); } return R(200, { sha: v.sha, content: v.raw ? v.data : Buffer.from(JSON.stringify(v.data)).toString('base64') }); }
  if (method === 'PUT') { const body = JSON.parse(opts.body), cur = h && h[h.length - 1];
    if ((cur ? cur.sha : undefined) !== (body.sha || undefined)) return R(409, {});
    let data, raw = false; try { data = JSON.parse(Buffer.from(body.content, 'base64').toString()); } catch (e) { data = body.content; raw = true; }
    put(key, data, body.message, raw); return R(200, { content: { sha: repo[key].at(-1).sha } }); }
  return R(405, {});
};
const { handler, __resetProjectsCache, __resetGithubCache, __resetMyMismoLimits, __setHotStore: __hs } = await import('./index.mjs');
let failed = 0; const ok = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c || d === undefined ? '' : '  ' + JSON.stringify(d).slice(0, 400))); };
const J = r => JSON.parse(r.body);
const call = (m, path, { body, origin = ORIGIN, tok, rawBody } = {}) => { __resetGithubCache(); const [rp, qs] = path.split('?'); return handler({ rawPath: rp, rawQueryString: qs || '', queryStringParameters: qs ? Object.fromEntries(new URLSearchParams(qs)) : undefined, requestContext: { http: { method: m, sourceIp: '203.0.113.1' } },
  headers: { ...(origin ? { origin } : {}), 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: rawBody !== undefined ? rawBody : body ? JSON.stringify(body) : undefined }); };
const file = (p, r = 'Org/MyMismoData') => { const h = repo[r + ':' + p]; return h ? h.at(-1).data : null; };
const checkins = () => { const docs = {}; for (const k of Object.keys(repo)) if (k.startsWith('Org/MyMismoData:scan/nola/checkins/')) Object.assign(docs, repo[k].at(-1).data.docs); return { docs }; };
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const staffTok = email => { const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), bd = b64u(JSON.stringify({ sub: email, name: 'X', iat: now, exp: now + 3600 }));
  return head + '.' + bd + '.' + b64u(createHmac('sha256', process.env.AUTH_SECRET).update(head + '.' + bd).digest()); };
const ST = staffTok('staff@example.org'), FA = staffTok('fac@example.org'), VI = staffTok('view@example.org'), NO = staffTok('none@example.org');
let r, d;
/* ---- Relay request 18: MyMISMO's live files in S3 (Nov 27, 2026). A stand-in S3 kept in memory, with real-world delays;
 * every person, address and number is made up. ---- */
const { __setHotStore } = await import('./index.mjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const S3 = new Map(); let tag = 1, s3Puts = 0, s3Conflicts = 0, delay = [8, 30];
const lag = () => sleep(delay[0] + Math.random() * (delay[1] - delay[0]));
const store = {
  async get(k) { await lag(); const v = S3.get(k); return v ? { status: 200, body: v.body, etag: v.etag } : { status: 404 }; },
  async put(k, body, etag) { await lag(); const v = S3.get(k); s3Puts++;
    if (etag ? !v || v.etag !== etag : !!v) { s3Conflicts++; return { status: 409 }; }
    const e = '"e' + (tag++) + '"'; S3.set(k, { body, etag: e }); return { status: 200, etag: e }; },
  async list(prefix, deep) { await lag(); return [...S3.keys()].filter(k => k.startsWith(prefix) && (deep || !k.slice(prefix.length).includes('/'))).map(k => ({ name: k.slice(prefix.length), sha: S3.get(k).etag })); }
};
const ghWrites = []; const inner = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => { const m = String(url).match(/api\.github\.com\/repos\/([^/]+\/[^/]+)\/contents\/([^?]+)/); if (m && (opts.method || 'GET').toUpperCase() === 'PUT') ghWrites.push(m[1] + ':' + decodeURIComponent(m[2])); return inner(url, opts); };
const s3json = k => S3.has(k) ? JSON.parse(S3.get(k).body) : null;
const mmGh = () => ghWrites.filter(w => w.startsWith('Org/MyMismoData:'));
process.env.MYMISMO_BUCKET = 'mymismo-live-test'; __setHotStore(store, 'Org/MyMismoData');
setProjects({ ...ENTRY, scan: true, photos: true, alertSenders: ['staff@example.org'], mediaReviewers: ['Staff@example.org'], mediaInbox: { repo: 'Org/MediaData', dir: 'incoming/summit-photos' } }); __resetMyMismoLimits();

const codeFor = email => { const mm = mails.filter(x => x.to === email).at(-1); return mm && (mm.subject.match(/^(\d{6}) /) || [])[1]; };
/* 1. a file already on GitHub is read from there once, then kept in S3 with nothing lost */
put('Org/MyMismoData:att/nola/people.json', { docs: { old1: { name: 'Earlier Person', title: 'VP', company: 'Bank Inc' } } });

r = await call('POST', '/mymismo/att/code', { body: { email: 'pat@lender.example', summit: 'nola', startedAt: Date.now() - 9000 } });
ok('a sign-in code is asked for and emailed as before', r.statusCode === 200 && !!codeFor('pat@lender.example'), r.body);
r = await call('POST', '/mymismo/att/verify', { body: { email: 'pat@lender.example', summit: 'nola', code: codeFor('pat@lender.example') } }); d = J(r);
ok('the code signs them in', r.statusCode === 200 && !!d.token, r.body);
const ppl = s3json('att/nola/people.json');
ok('their profile is kept in S3, and the person already on GitHub is still there', ppl && Object.keys(ppl.docs).length === 2 && ppl.docs.old1 && ppl.docs.old1.name === 'Earlier Person', ppl);
ok('sign-in codes and profiles made no GitHub saves', mmGh().length === 0, mmGh());

/* 2. check-ins, Who I Met, touchpoints and the live attendance */
const items = n => Array.from({ length: n }, (_, i) => ({ id: 'c-' + String(i).padStart(6, 'a'), ses: 'tp:WG01', reg: '1000001', at: Date.now(), manual: false }));
r = await call('POST', '/mymismo/scan/checkins', { tok: ST, body: { summit: 'nola', items: items(3) } }); d = J(r);
ok('check-ins save', r.statusCode === 200 && d.saved === 3, d);
r = await call('POST', '/mymismo/scan/notes', { tok: ST, body: { summit: 'nola', items: [{ id: 'n-aaaaaa', kind: 'touch', reg: '1000002', note: 'Wants the API guide', at: Date.now() }] } });
ok('a touchpoint saves', r.statusCode === 200, r.body);
r = await call('GET', '/mymismo/scan/checkins?summit=nola', { tok: FA }); d = J(r);
ok('Attendance Now reads the check-ins from S3', r.statusCode === 200 && d.items.length === 3, d);
ok('none of it went to GitHub', mmGh().length === 0, mmGh());
r = await call('GET', '/mymismo/staff/stats?summit=nola', { tok: ST }); d = J(r);
ok('MISMO Media\'s numbers read from S3 too', r.statusCode === 200 && d.summits[0].signedIn === 2 && d.summits[0].checkins === 3 && d.summits[0].touchpoints === 1, d);

/* 3. two saves to one file at the same moment: both kept */
await Promise.all([1, 2, 3, 4, 5, 6].map(i => call('POST', '/mymismo/scan/notes', { tok: ST, body: { summit: 'nola', items: [{ id: 'n-bbbbb' + i, kind: 'met', reg: '1000001', at: Date.now() }] } })));
const mine = Object.keys(S3).length; const notesKey = [...S3.keys()].find(k => k.startsWith('scan/nola/notes/'));
ok('six saves to the same file at once: all six kept (S3 checks each save against the copy it changed)', notesKey && Object.keys(s3json(notesKey).docs).length === 7, notesKey && Object.keys(s3json(notesKey).docs));

/* 4. what stays on GitHub */
put('Org/MyMismoData:trivia/settings.json', { s: 1 });
ok('the question bank, Trivia settings and news alerts are not moved', !S3.has('trivia/questions.json') && !S3.has('trivia/settings.json') && !S3.has('push/news.json'));

/* 5. the 15-minute copy to GitHub for Meeting Trackers and Member 360 */
r = await handler({ mymismoMirror: true }); const c1 = mmGh().filter(w => w.includes(':scan/'));
ok('the scheduled copy puts every scan/ file on GitHub', r.ok && r.copied >= 3 && c1.length === r.copied, r);
ok('...and only scan/ files (profiles, codes and messages stay in S3)', mmGh().every(w => w.includes(':scan/')), mmGh());
const ghCi = repo['Org/MyMismoData:' + c1.find(w => w.includes('/checkins/')).split(':')[1]];
ok('the copy on GitHub is the same as the live one', ghCi && Object.keys(ghCi.at(-1).data.docs).length === 3, ghCi && ghCi.at(-1).data);
r = await handler({ mymismoMirror: true });
ok('nothing changed: the next copy saves nothing on GitHub', r.ok && r.copied === 0, r);
await call('POST', '/mymismo/scan/checkins', { tok: ST, body: { summit: 'nola', items: items(5) } });
r = await handler({ mymismoMirror: true });
ok('one scanner\'s file changed: one GitHub save', r.ok && r.copied === 1, r);
r = await call('POST', '/mymismo/scan/checkins', { tok: ST, body: { mymismoMirror: true } });
ok('a web request can\'t start the copy', r.statusCode !== 200 || !J(r).copied, r.statusCode);

/* 6. a summit's worth of people at once */
delay = [20, 80]; __resetMyMismoLimits(); ghWrites.length = 0;
const NP = 600, t0 = Date.now();
const people = Array.from({ length: NP }, (_, i) => 'guest' + i + '@lender.example');
put('Org/SummitData:data/feed-mymismo-attendees.json', { updated: new Date().toISOString(), summits: { nola: { name: '2027 Winter Summit', first: FIRST, last: LAST, people: people.map((e, i) => ({ e, first: 'Guest', last: String(i), company: 'Lender Co', title: 'Analyst', reg: [String(2000000 + i)] })) } } });
__resetProjectsCache(); __resetMyMismoLimits();
const asks = []; for (let i = 0; i < NP; i += 50) asks.push(...await Promise.all(people.slice(i, i + 50).map(e => call('POST', '/mymismo/att/code', { body: { email: e, summit: 'nola', startedAt: Date.now() - 9000 }, ip: '198.51.100.' + (i / 50) }))));
const ins = []; for (let i = 0; i < NP; i += 50) ins.push(...await Promise.all(people.slice(i, i + 50).map(e => call('POST', '/mymismo/att/verify', { body: { email: e, summit: 'nola', code: codeFor(e) }, ip: '198.51.100.' + (i / 50) }))));
const okIns = ins.filter(x => x.statusCode === 200).length;
console.log(`  ${NP} people signing in, 50 at a time: ${okIns} signed in, ${s3Conflicts} S3 retries, ${mmGh().length} GitHub saves, ${Math.round((Date.now() - t0) / 1000)} s`);
ok(`${NP} people sign in, 50 at the same moment, with no GitHub saves`, okIns === NP && mmGh().length === 0, { okIns, codes: asks.filter(x => x.statusCode === 200).length, gh: mmGh().length });
console.log(failed ? failed + ' FAILED' : 'all passed'); process.exit(failed ? 1 : 0);
