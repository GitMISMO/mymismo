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
const { handler, __resetProjectsCache, __resetGithubCache, __resetMyMismoLimits, __resetMmBudget } = await import('./index.mjs');
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
/* ---- MyMISMO's own GitHub budget (Nov 27, 2026 load test). Every name and number here is made up. ---- */
let pass = 0; const fail0 = () => failed;
const seenAuth = []; const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => { const m = String(url).match(/api\.github\.com\/repos\/([^/]+\/[^/]+)\//); if (m) seenAuth.push({ repo: m[1], method: (opts.method || 'GET').toUpperCase(), auth: (opts.headers || {}).Authorization }); return realFetch(url, opts); };
setProjects({ ...ENTRY, scan: true, photos: true }); __resetMyMismoLimits();
const item = i => ({ id: 'c-' + String(i).padStart(6, 'a'), ses: 'tp:WG01', reg: '1000001', at: Date.now(), manual: false });
/* 1. No MyMISMO token yet: MyMISMO is held to its hourly share, everything else carries on */
process.env.MYMISMO_WRITE_CAP = '3'; delete process.env.MYMISMO_GITHUB_TOKEN; __resetMmBudget();   /* the relay must pick out MyMISMO's repository by itself */
const saved = [];
for (let i = 0; i < 5; i++) { r = await call('POST', '/mymismo/scan/checkins', { tok: ST, body: { summit: 'nola', items: [item(i)] } }); saved.push(r.statusCode); }
ok('MyMISMO saves stop at its hourly share (3 here) instead of using up the shared account', saved.filter(s => s === 200).length === 3 && saved.slice(3).every(s => s >= 400), saved);
ok('the check-ins that waited are not lost: the app keeps them and sends them later (the relay said not saved)', saved.slice(3).every(s => s !== 200), saved);
const before = seenAuth.length;
put('Org/SummitData:data/note.json', { a: 1 });
r = await call('GET', '/summit-hq/file/data/note.json', { tok: ST });
ok('other systems still read and work while MyMISMO is at its share', r.statusCode === 200, r.statusCode);
ok('every GitHub call so far used the main account (no MyMISMO token is set)', seenAuth.every(a => a.auth === 'Bearer ghp_test'), seenAuth.slice(-3));
/* 2. With MyMISMO's own account set: its repositories use that token, other systems keep the main one, no cap */
process.env.MYMISMO_GITHUB_TOKEN = 'ghp_mymismo_own'; seenAuth.length = 0;
const s2 = [];
for (let i = 10; i < 16; i++) { r = await call('POST', '/mymismo/scan/checkins', { tok: ST, body: { summit: 'nola', items: [item(i)] } }); s2.push(r.statusCode); }
ok('with its own account, MyMISMO saves are not capped', s2.every(s => s === 200), s2);
__resetProjectsCache(); r = await call('GET', '/summit-hq/file/data/note.json', { tok: ST });
const mmCalls = seenAuth.filter(a => a.repo === 'Org/MyMismoData'), others = seenAuth.filter(a => a.repo !== 'Org/MyMismoData');
ok('MyMISMO\'s data repository is reached with MyMISMO\'s own token', mmCalls.length > 0 && mmCalls.every(a => a.auth === 'Bearer ghp_mymismo_own'), mmCalls.slice(0, 2));
ok('sign-in, settings and Summit HQ files still use the main token', others.length > 0 && others.every(a => a.auth === 'Bearer ghp_test'), others.slice(0, 3));
seenAuth.length = 0; r = await call('GET', '/summit-hq/file/data/note.json', { tok: ST });
ok('another system\'s request never uses MyMISMO\'s token', seenAuth.length > 0 && seenAuth.every(a => a.auth === 'Bearer ghp_test'), seenAuth);
delete process.env.MYMISMO_GITHUB_TOKEN; delete process.env.MYMISMO_WRITE_CAP;
console.log(failed ? failed + ' FAILED' : 'all passed'); process.exit(failed ? 1 : 0);
