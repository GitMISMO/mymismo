/* MyMISMO: name tag scanning and Summit Photos (relay request 17). Run: node test-mymismo17.mjs. A stand-in GitHub and mail
 * flow, as test-mymismo16.mjs. Every person, address and registration number here is made up. */
import { pbkdf2Sync, createHmac, createHash } from 'node:crypto';
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
const { handler, __resetProjectsCache, __resetGithubCache, __resetMyMismoLimits } = await import('./index.mjs');
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

/* ---------- off until switched on ---------- */
setProjects(ENTRY); __resetMyMismoLimits();
r = await call('GET', '/mymismo/scan/me', { tok: ST });
ok('scanning is off until scan: true', r.statusCode === 404, r.statusCode);
r = await call('POST', '/mymismo/photos', { tok: ST, body: { summit: 'nola' } });
ok('photos are off until photos: true', r.statusCode === 404, r.statusCode);
setProjects({ ...ENTRY, scan: true, photos: true, mediaReviewers: ['Staff@example.org'], mediaInbox: { repo: 'Org/MediaData', dir: 'incoming/summit-photos' } }); __resetMyMismoLimits();

/* ---------- who can scan ---------- */
r = await call('GET', '/mymismo/scan/me', { tok: ST }); d = J(r);
ok('staff (MyMISMO and Summit HQ) scan as staff', r.statusCode === 200 && d.role === 'staff', d);
r = await call('GET', '/mymismo/scan/me', { tok: FA }); d = J(r);
ok('facilitators (MyMISMO and Meeting Trackers) scan as facilitators', r.statusCode === 200 && d.role === 'facilitator', d);
r = await call('GET', '/mymismo/scan/me', { tok: VI });
ok('view-only MyMISMO can\'t scan', r.statusCode === 403, r.statusCode);
r = await call('GET', '/mymismo/scan/me', { tok: NO });
ok('no MyMISMO, no scanning', r.statusCode === 403, r.statusCode);
r = await call('GET', '/mymismo/scan/me', {});
ok('no sign-in, no scanning', r.statusCode === 401, r.statusCode);
r = await call('GET', '/mymismo/scan/me', { tok: ST, origin: 'https://evil.example' });
ok('only from MISMO\'s own site', r.statusCode === 403, r.statusCode);

/* ---------- lookup: name, title, company; never an email ---------- */
r = await call('POST', '/mymismo/scan/lookup', { tok: FA, body: { summit: 'nola', regs: ['1000001', '1000002', '9999999', 'x'] } }); d = J(r);
ok('lookup finds both registrations', r.statusCode === 200 && d.people['1000001'].name === 'Pat Lee' && d.people['1000002'].company === 'Bank Inc' && !d.people['9999999'], d);
ok('lookup never gives an email', !JSON.stringify(d).includes('@'), d);

/* ---------- check-ins: a retry doesn't count twice ---------- */
const items = [{ id: 'c-aaaaaa', ses: 'tp:WG01', reg: '1000001', at: Date.now() }, { id: 'c-bbbbbb', ses: 'tp:WG01', name: 'Walk In', company: 'Example Title Co.', manual: true, at: Date.now() }];
r = await call('POST', '/mymismo/scan/checkins', { tok: FA, body: { summit: 'nola', items } }); d = J(r);
ok('check-ins saved', r.statusCode === 200 && d.saved === 2 && d.have === 2, d);
r = await call('POST', '/mymismo/scan/checkins', { tok: FA, body: { summit: 'nola', items } }); d = J(r);
ok('the same check-ins sent again aren\'t counted twice', r.statusCode === 200 && d.saved === 0 && d.have === 2, d);
ok('each check-in records who scanned it', checkins().docs['c-aaaaaa'].by === 'fac@example.org', checkins());
r = await call('POST', '/mymismo/scan/checkins', { tok: ST, body: { summit: 'nola', items: [{ id: 'short', ses: 'tp:WG01', reg: '1000001' }, { id: 'c-cccccc', ses: '', reg: '1000001' }] } });
ok('bad check-ins are refused', r.statusCode === 400, r.statusCode);
r = await call('GET', '/mymismo/scan/checkins?summit=nola', { tok: FA }); d = J(r);
ok('Attendance Now gets everyone\'s check-ins, with names', r.statusCode === 200 && d.items.length === 2 && d.items.find(x => x.id === 'c-aaaaaa').name === 'Pat Lee' && !JSON.stringify(d.items).includes('@'), d);
r = await call('GET', '/mymismo/scan/checkins?summit=nola&since=' + (Date.now() + 1000), { tok: FA }); d = J(r);
ok('since= gives only newer ones', d.items.length === 0, d);
r = await call('POST', '/mymismo/scan/checkins', { tok: ST, rawBody: JSON.stringify({ summit: 'nola', items: [], pad: 'x'.repeat(70000) }) });
ok('a body over 64 KB is refused', r.statusCode === 413, r.statusCode);

/* ---------- Who I Met and touchpoints ---------- */
r = await call('POST', '/mymismo/scan/notes', { tok: FA, body: { summit: 'nola', items: [{ id: 'n-111111', kind: 'touch', reg: '1000001', name: 'Pat Lee' }] } });
ok('facilitators can\'t log touchpoints', r.statusCode === 403, r.statusCode);
r = await call('POST', '/mymismo/scan/notes', { tok: FA, body: { summit: 'nola', items: [{ id: 'n-222222', kind: 'met', reg: '1000002', name: 'Sam Roe', note: 'Talk about eNotes', rate: 'Warm' }] } }); d = J(r);
ok('facilitators save Who I Met', r.statusCode === 200 && d.saved === 1, d);
r = await call('POST', '/mymismo/scan/notes', { tok: ST, body: { summit: 'nola', items: [{ id: 'n-333333', kind: 'touch', reg: '1000001', name: 'Pat Lee', note: 'Renewal next quarter', email: 'pat@lender.example', rate: 'Hot' }] } }); d = J(r);
ok('staff log a touchpoint', r.statusCode === 200, d);
ok('touchpoints also go to the list for Member 360', file('scan/nola/touchpoints.json').docs['n-333333'].byName === 'Sky Staff', file('scan/nola/touchpoints.json'));
r = await call('GET', '/mymismo/scan/notes?summit=nola', { tok: FA }); d = J(r);
ok('each person reads only their own notes', d.items.length === 1 && d.items[0].id === 'n-222222', d);
r = await call('POST', '/mymismo/scan/notes', { tok: ST, body: { summit: 'nola', items: [{ id: 'n-333333', kind: 'touch', deleted: true }] } });
ok('deleting a touchpoint takes it off the Member 360 list too', r.statusCode === 200 && !file('scan/nola/touchpoints.json').docs['n-333333'], file('scan/nola/touchpoints.json'));


/* ---------- helpers: one session, a few hours ---------- */
r = await call('POST', '/mymismo/scan/helper', { tok: FA, body: { summit: 'nola', ses: 'tp:WS01', name: 'Rusty', hours: 4 } }); d = J(r);
ok('a facilitator makes a helper link', r.statusCode === 200 && typeof d.token === 'string', d);
const HT = d.token;
r = await call('GET', '/mymismo/scan/me', { tok: HT }); d = J(r);
ok('the helper scans as a helper, for that session', r.statusCode === 200 && d.role === 'helper' && d.ses === 'tp:WS01' && d.name === 'Rusty', d);
r = await call('POST', '/mymismo/scan/checkins', { tok: HT, body: { summit: 'nola', items: [{ id: 'c-h11111', ses: 'tp:WS01', reg: '1000002' }, { id: 'c-h22222', ses: 'tp:OTHER', reg: '1000001' }] } }); d = J(r);
ok('the helper checks people in to that session only', r.statusCode === 200 && d.saved === 1 && checkins().docs['c-h11111'].by === 'helper:Rusty via fac@example.org' && !checkins().docs['c-h22222'], d);
r = await call('POST', '/mymismo/scan/lookup', { tok: HT, body: { summit: 'nola', regs: ['1000002'] } }); d = J(r);
ok('the helper sees names', r.statusCode === 200 && d.people['1000002'].name === 'Sam Roe', d);
r = await call('GET', '/mymismo/scan/checkins?summit=nola', { tok: HT });
ok('the helper can\'t read everyone\'s check-ins', r.statusCode === 403, r.statusCode);
r = await call('POST', '/mymismo/scan/notes', { tok: HT, body: { summit: 'nola', items: [{ id: 'n-h33333', kind: 'met', name: 'X' }] } });
ok('the helper can\'t save notes', r.statusCode === 403, r.statusCode);
r = await call('POST', '/mymismo/scan/helper', { tok: HT, body: { summit: 'nola', ses: 'tp:WS01', name: 'Someone Else' } });
ok('a helper can\'t make more helpers', r.statusCode === 403, r.statusCode);
r = await call('POST', '/mymismo/scan/checkins', { tok: HT, body: { summit: 'other', items: [{ id: 'c-h44444', ses: 'tp:WS01', reg: '1000002' }] } });
ok('the helper link is for that summit only', r.statusCode === 403, r.statusCode);

/* ---------- Summit Photos ---------- */
const JPG = 'data:image/jpeg;base64,' + Buffer.alloc(3000, 7).toString('base64');
r = await call('POST', '/mymismo/photos', { body: { summit: 'nola', data: JPG } });
ok('no sign-in, no photo', r.statusCode === 401, r.statusCode);
r = await call('POST', '/mymismo/photos', { tok: FA, body: { summit: 'nola', data: 'data:image/png;base64,AAAA' } });
ok('only a JPEG', r.statusCode === 400, r.statusCode);
r = await call('POST', '/mymismo/photos', { tok: FA, body: { summit: 'nola', data: JPG, caption: 'Day one!', challenge: 'You and Someone You Just Met', tags: ['Sam Roe'] } }); d = J(r);
ok('a facilitator sends a photo', r.statusCode === 200 && /^P/.test(d.id), d);
const pid = d.id;
r = await call('POST', '/mymismo/photos', { tok: ST, body: { summit: 'nola', data: JPG } }); const pid2 = J(r).id;
r = await call('GET', '/mymismo/photos/list?summit=nola', { tok: FA });
ok('only reviewers see submissions', r.statusCode === 403, r.statusCode);
r = await call('GET', '/mymismo/photos/list?summit=nola', { tok: ST }); d = J(r);
ok('the reviewer sees both, without the picture data', r.statusCode === 200 && d.items.length === 2 && !JSON.stringify(d).includes('base64'), d);
r = await call('GET', '/mymismo/photos/one?summit=nola&id=' + pid, { tok: ST }); d = J(r);
ok('the reviewer opens one', r.statusCode === 200 && d.s === JPG, r.statusCode);
r = await call('POST', '/mymismo/photos/send', { tok: ST, body: { summit: 'nola' } });
ok('nothing picked, nothing sent', r.statusCode === 400, r.statusCode);
r = await call('POST', '/mymismo/photos/review', { tok: ST, body: { summit: 'nola', id: pid, status: 'picked', note: 'Great for LinkedIn' } });
ok('pick a photo', r.statusCode === 200 && file('photos/nola/index.json').docs[pid].status === 'picked', r.body);
r = await call('POST', '/mymismo/photos/review', { tok: ST, body: { summit: 'nola', id: pid2, status: 'passed' } });
r = await call('POST', '/mymismo/photos/send', { tok: ST, body: { summit: 'nola' } }); d = J(r);
ok('send the picks to MISMO Media', r.statusCode === 200 && d.count === 1, d);
const batch = file(`incoming/summit-photos/nola/${d.batch}.json`, 'Org/MediaData');
ok('MISMO Media gets the list with the reviewer\'s note', batch && batch.photos.length === 1 && batch.photos[0].note === 'Great for LinkedIn' && batch.photos[0].challenge === 'You and Someone You Just Met', batch);
ok('and the JPEG beside it', repo[`Org/MediaData:incoming/summit-photos/nola/${d.batch}/${pid}.jpg`] && repo[`Org/MediaData:incoming/summit-photos/nola/${d.batch}/${pid}.jpg`].at(-1).raw === true, Object.keys(repo));
ok('the passed photo stays behind', !batch.photos.some(p => p.id === pid2) && file('photos/nola/index.json').docs[pid2].status === 'passed', batch);
ok('the sent photo is marked sent', file('photos/nola/index.json').docs[pid].status === 'sent', file('photos/nola/index.json').docs[pid]);
r = await call('POST', '/mymismo/photos/review', { tok: ST, body: { summit: 'nola', id: pid, status: 'new' } });
ok('a sent photo can\'t be changed', r.statusCode === 404, r.statusCode);

/* ---- attendees' Who I Met: a name tag's name, title and company, nothing for hidden people (Jonna, Nov 27, 2026) ---- */
const attTok = (email, summit = 'nola') => { const now = Math.floor(Date.now() / 1000), sec = createHmac('sha256', process.env.AUTH_SECRET).update('mymismo-attendee-token-v1').digest('hex');
  const id = createHmac ? require_id(summit, email) : ''; const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), bd = b64u(JSON.stringify({ kind: 'mymismo-attendee', sub: id, s: summit, e: email, n: 'X', iat: now, exp: now + 3600 }));
  return head + '.' + bd + '.' + b64u(createHmac('sha256', sec).update(head + '.' + bd).digest()); };
function require_id(summit, email) { return createHash('sha256').update(`mymismo:${summit}:${email}`).digest('hex').slice(0, 16); }
const AT = attTok('pat@lender.example');
r = await call('POST', '/mymismo/scan/lookup', { tok: AT, body: { summit: 'nola', regs: ['1000002'] } }); d = J(r);
ok('a signed-in attendee scanning a name tag gets the name, title and company', r.statusCode === 200 && d.people['1000002'] && d.people['1000002'].name === 'Sam Roe' && d.people['1000002'].company === 'Bank Inc', d);
ok('...and never an email', !JSON.stringify(d).includes('@'), d);
put('Org/MyMismoData:att/nola/people.json', { docs: { [require_id('nola', 'sam@bank.example')]: { name: 'Sam Roe', hidden: true } } });
r = await call('POST', '/mymismo/scan/lookup', { tok: AT, body: { summit: 'nola', regs: ['1000002'] } }); d = J(r);
ok('someone hidden from the directory: nothing comes back', r.statusCode === 200 && !d.people['1000002'], d);
r = await call('POST', '/mymismo/scan/lookup', { tok: AT, body: { summit: 'other', regs: ['1000002'] } });
ok('only for their own summit', r.statusCode === 403, r.statusCode);
r = await call('POST', '/mymismo/scan/checkins', { tok: AT, body: { summit: 'nola', items: [] } });
ok('attendees can\'t check people in or read anything else', r.statusCode === 401 || r.statusCode === 403, r.statusCode);

/* ---- MyMISMO's numbers for MISMO Media's Results page (Jonna, Nov 27, 2026) ---- */
setProjects({ ...ENTRY, scan: true, photos: true, alertSenders: ['staff@example.org'], mediaReviewers: ['Staff@example.org'], mediaInbox: { repo: 'Org/MediaData', dir: 'incoming/summit-photos' } }); __resetMyMismoLimits();
put('Org/MyMismoData:att/nola/people.json', { docs: { a1: { name: 'Pat Lee' }, a2: { name: 'Sam Roe', hidden: true }, a3: { deleted: true }, r1: { name: 'App Review', review: true } } });
put('Org/MyMismoData:att/nola/messages.json', { docs: { 'a1|a2': { p: ['a1', 'a2'], m: [{ f: 'a1', t: 'Hello', at: 1 }, { f: 'a2', t: 'Hi', at: 2 }] } } });
put('Org/MyMismoData:push/subs.json', { docs: { x1: { summit: 'nola', news: true }, x2: { summit: '', news: true }, x3: { summit: 'nola' } } });
put('Org/MyMismoData:push/alerts.json', { alerts: [{ summit: 'nola', title: 'Room change', sent: 40 }, { summit: 'other', sent: 9 }] });
r = await call('GET', '/mymismo/staff/stats?summit=nola', { tok: FA }); ok('stats are only for the MISMO team people (alertSenders)', r.statusCode === 403, r.statusCode);
r = await call('GET', '/mymismo/staff/stats?summit=nola', { tok: ST }); d = J(r); const sn = (d.summits || [])[0] || {};
ok('stats count people signed in (not deleted accounts or the store reviewer)', r.statusCode === 200 && sn.signedIn === 2, d);
ok('stats count conversations and messages, never their words', sn.conversations === 1 && sn.messages === 2 && !JSON.stringify(d).includes('Hello'), sn);
ok('stats count phones with alerts on and alerts sent for the summit', d.phones && d.phones.summitAlerts === 2 && d.phones.newsAlerts === 2 && sn.alertsSent === 1 && sn.alertsDelivered === 40, d);
ok('stats count check-ins, sessions and scanners from every scanner\'s file', sn.checkins >= 3 && sn.sessions >= 1 && sn.scanners >= 2, sn);
ok('stats count photos by where they are', sn.photos && sn.photos.submitted >= 1 && sn.photos.sent >= 1, sn.photos);
ok('stats carry no names or emails', !/@|Pat Lee|Sam Roe/.test(JSON.stringify(d)), d);

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
