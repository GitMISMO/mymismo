/* MyMISMO: MISMO Matters and Mic'd Up notifications (relay request 16). Run: node test-mymismo16.mjs. A stand-in GitHub and mail flow, as test-huddle.mjs.
 * Every person and address here is made up. */
import { pbkdf2Sync, createECDH, randomBytes, createHmac, createDecipheriv, createPublicKey, verify as cryptoVerify } from 'node:crypto';
const ORIGIN = 'https://resources.example';
Object.assign(process.env, { GITHUB_TOKEN: 'ghp_test', AUTH_SECRET: 'mymismo-test-secret', PROJECTS_REPO: 'Org/Config', DIRECTORY_REPO: 'Org/Accounts', MAIL_FLOW_URL: 'https://flow.example/mail' });
let N = 100; const sha = () => (N++).toString(16).padEnd(40, 'c'); const repo = {};
const put = (key, data, message = 'seed') => { (repo[key] = repo[key] || []).push({ sha: sha(), data, message }); };
const pb = pw => { const s = 'cc'.repeat(16); return `pbkdf2$1000$${s}$${pbkdf2Sync(pw, Buffer.from(s, 'hex'), 1000, 32, 'sha256').toString('hex')}`; };
const FEED = { repo: 'Org/SummitData', path: 'data/feed-mymismo-attendees.json' };
const ENTRY = { repo: 'Org/MyMismoData', origin: ORIGIN, writable: [], attendeeFeed: FEED };
const setProjects = entry => { put('Org/Config:projects.json', { mymismo: entry, 'summit-hq': { repo: 'Org/SummitData', origin: ORIGIN, writable: ['data/'] }, huddle: { repo: 'Org/Polls', origin: ORIGIN, writable: ['data/'], attendees: true, attendeeFeed: FEED } }); __resetProjectsCache(); };
put('Org/Accounts:access.json', { people: { 'jc@example.org': { name: 'Jonna C', hash: pb('jonna-pass-123456789'), access: { 'mymismo': 'admin', 'summit-hq': 'admin' }, group: 'staff' } } });
const LAST = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), FIRST = new Date(Date.now() + 17 * 86400000).toISOString().slice(0, 10);
put('Org/SummitData:data/feed-mymismo-attendees.json', { updated: new Date().toISOString(), summits: {
  nola: { name: '2027 Winter Summit', first: FIRST, last: LAST, people: [
    { e: 'pat@lender.example', first: 'Pat', last: 'Lee', company: 'Lender Co', title: 'CTO' },
    { e: 'Sam@Bank.Example', first: 'Sam', last: 'Roe', company: 'Bank Inc', title: 'VP Data' },
    { e: 'alex@vendor.example', first: 'Alex', last: 'Kim', company: 'Vendor LLC', title: 'Engineer' },
    { e: 'not-an-email', first: 'Bad', last: 'Row' }] },
  old: { name: '2025 Fall Summit', first: '2025-09-15', last: '2025-09-18', people: [{ e: 'pat@lender.example', first: 'Pat', last: 'Lee' }] } } });
const mails = [], pushes = [];
const R = (status, j) => ({ status, ok: status < 300, headers: { get: () => null }, json: async () => j, text: async () => '' });
globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  if (String(url).startsWith('https://fcm.googleapis.com/') || String(url).startsWith('https://web.push.apple.com/')) { pushes.push({ url, opts }); return R(String(url).includes('/gone') ? 410 : 201, {}); }
  if (url === 'https://flow.example/mail') { mails.push(JSON.parse(opts.body)); return R(202, {}); }
  const m = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/contents\/([^?]+)/);
  if (!m) return R(404, {});
  const key = m[1] + ':' + decodeURIComponent(m[2]), h = repo[key];
  if (method === 'GET') { const v = h && h[h.length - 1]; if (!v) return R(404, {}); return R(200, { sha: v.sha, content: Buffer.from(JSON.stringify(v.data)).toString('base64') }); }
  if (method === 'PUT') { const body = JSON.parse(opts.body), cur = h && h[h.length - 1];
    if ((cur ? cur.sha : undefined) !== (body.sha || undefined)) return R(409, {});
    put(key, JSON.parse(Buffer.from(body.content, 'base64').toString()), body.message); return R(200, { content: { sha: repo[key].at(-1).sha } }); }
  return R(405, {});
};
/* the function's VAPID key pair (made up for the test) */
const vk = createECDH('prime256v1'); vk.generateKeys();
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
process.env.MYMISMO_VAPID_PUBLIC = b64u(vk.getPublicKey()); process.env.MYMISMO_VAPID_PRIVATE = b64u(vk.getPrivateKey());
const { handler, __resetProjectsCache, __resetGithubCache, __resetMyMismoLimits, __resetMyMismo14, mm14encrypt } = await import('./index.mjs');
let failed = 0; const ok = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c || d === undefined ? '' : '  ' + JSON.stringify(d).slice(0, 400))); };
const J = r => JSON.parse(r.body);
const call = (m, path, { body, origin = ORIGIN, ip = '203.0.113.1', tok } = {}) => { __resetGithubCache(); const [rp, qs] = path.split('?'); return handler({ rawPath: rp, rawQueryString: qs || '', queryStringParameters: qs ? Object.fromEntries(new URLSearchParams(qs)) : undefined, requestContext: { http: { method: m, sourceIp: ip } },
  headers: { ...(origin ? { origin } : {}), 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); };
const file = p => { const h = repo['Org/MyMismoData:' + p]; return h ? h.at(-1).data : null; };
const ago = () => Date.now() - 9000;
const codeFor = email => { const mm = mails.filter(x => x.to === email).at(-1); return mm && (mm.subject.match(/^(\d{6}) /) || [])[1]; };
async function signIn(email, ip = '203.0.113.9') {
  await call('POST', '/mymismo/att/code', { body: { email, summit: 'nola', startedAt: ago() }, ip });
  const r = await call('POST', '/mymismo/att/verify', { body: { email, summit: 'nola', code: codeFor(email.toLowerCase()) }, ip });
  return J(r);
}
let r, d;
const phone = () => { const e = createECDH('prime256v1'); e.generateKeys(); return { e, auth: randomBytes(16) }; };
const subOf = (p, endpoint) => ({ endpoint, keys: { p256dh: b64u(p.e.getPublicKey()), auth: b64u(p.auth) } });
const H = (k, d) => createHmac('sha256', k).update(d).digest();
function decrypt(buf, p) {   /* the phone's side of RFC 8291 */
  const salt = buf.subarray(0, 16), idlen = buf[20], asPub = buf.subarray(21, 21 + idlen), ct = buf.subarray(21 + idlen);
  const ua = p.e.getPublicKey(), shared = p.e.computeSecret(asPub);
  const ikm = H(H(p.auth, shared), Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub, Buffer.from([1])]));
  const prk = H(salt, ikm);
  const cek = H(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
  const nonce = H(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);
  const dc = createDecipheriv('aes-128-gcm', cek, nonce); dc.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([dc.update(ct.subarray(0, ct.length - 16)), dc.final()]);
  return pt[pt.length - 1] === 2 ? pt.subarray(0, pt.length - 1).toString() : null;
}
const staffTok = (email, iatAgo = 0) => { const now = Math.floor(Date.now() / 1000) - iatAgo;
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), bd = b64u(JSON.stringify({ sub: email, name: 'X', iat: now, exp: now + 3600 }));
  return head + '.' + bd + '.' + b64u(createHmac('sha256', process.env.AUTH_SECRET).update(head + '.' + bd).digest()); };
put('Org/Accounts:access.json', { people: { 'jc@example.org': { name: 'Jonna C', hash: pb('jonna-pass-123456789'), access: { 'summit-hq': 'admin' }, group: 'staff' }, 'kb@example.org': { name: 'Kelly B', hash: pb('kelly-pass-123456789'), access: { 'summit-hq': 'editor' }, group: 'staff' } } });
setProjects({ ...ENTRY, attendees: true, push: true, alertSenders: ['JC@example.org'] }); __resetMyMismoLimits();
const A = phone(), B = phone(), C = phone(), D = phone();
const subs = () => file('push/subs.json').docs, one = ep => Object.values(subs()).find(s => s.endpoint === ep);
const EA = 'https://fcm.googleapis.com/fcm/send/aaa', EB = 'https://web.push.apple.com/QBbb', EC = 'https://fcm.googleapis.com/fcm/send/ccc', ED = 'https://fcm.googleapis.com/fcm/send/gone';

/* ---------- subscribe: summit alerts, MISMO news, or both ---------- */
r = await call('POST', '/mymismo/push/subscribe', { body: { news: true, sub: subOf(A, EA) } });
ok('a phone turns on MISMO Matters and Mic\'d Up with no summit', r.statusCode === 200 && one(EA).news === true && one(EA).summit === '', one(EA));
r = await call('POST', '/mymismo/push/subscribe', { body: { summit: 'nola', sub: subOf(A, EA) } });
ok('...then summit alerts too: both kept on one phone', r.statusCode === 200 && one(EA).news === true && one(EA).summit === 'nola' && Object.keys(subs()).length === 1, one(EA));
await call('POST', '/mymismo/push/subscribe', { body: { summit: 'nola', sub: subOf(B, EB) } });
await call('POST', '/mymismo/push/subscribe', { body: { news: true, sub: subOf(B, EB) } });
ok('...the other order keeps both too', one(EB).news === true && one(EB).summit === 'nola', one(EB));
await call('POST', '/mymismo/push/subscribe', { body: { summit: 'nola', sub: subOf(C, EC) } });
await call('POST', '/mymismo/push/subscribe', { body: { news: true, sub: subOf(D, ED) } });
ok('summit-only and news-only phones', one(EC).news === false && one(ED).news === true && one(ED).summit === '');
r = await call('POST', '/mymismo/push/subscribe', { body: { sub: subOf(phone(), 'https://fcm.googleapis.com/fcm/send/zzz') } });
ok('neither a summit nor news: refused', r.statusCode === 400);
r = await call('POST', '/mymismo/push/subscribe', { body: { news: 'yes', sub: subOf(phone(), 'https://fcm.googleapis.com/fcm/send/zzz') } });
ok('news must be true, not just truthy', r.statusCode === 400);
ok('no IP address, name or email kept', !/203\.0\.113|@/.test(JSON.stringify(file('push/subs.json'))));

/* ---------- summit alerts still go only to the summit's phones ---------- */
let before = pushes.length;
r = await call('POST', '/mymismo/push/send', { tok: staffTok('jc@example.org'), body: { summit: 'nola', title: 'Room Change', body: 'Moved to La Salle C.' } });
ok('a summit alert reaches A, B and C, never the news-only phone', r.statusCode === 200 && pushes.length - before === 3 && !pushes.slice(before).some(x => x.url === ED), J(r));

/* ---------- push a MISMO Matters edition ---------- */
const MAT = { kind: 'matters', ref: '2026-12', title: 'MISMO Matters: December 2026', body: 'The Vieaux Point: A Year of Standards in Motion', url: 'https://www.mismo.org/about-mismo/mismo-matters/december-2026' };
before = pushes.length;
r = await call('POST', '/mymismo/push/news', { body: MAT }); ok('no sign-in: refused', r.statusCode === 403 && pushes.length === before);
r = await call('POST', '/mymismo/push/news', { tok: staffTok('kb@example.org'), body: MAT }); ok('staff not on alertSenders: refused', r.statusCode === 403);
r = await call('POST', '/mymismo/push/news', { tok: staffTok('jc@example.org'), origin: 'https://evil.example', body: MAT }); ok('another site: refused', r.statusCode === 403);
r = await call('POST', '/mymismo/push/news', { tok: staffTok('jc@example.org'), body: { ...MAT, kind: 'ad' } }); ok('an unknown kind: refused', r.statusCode === 400);
r = await call('POST', '/mymismo/push/news', { tok: staffTok('jc@example.org'), body: { ...MAT, url: 'https://evil.example/x' } }); ok('a link off MISMO\'s sites: refused', r.statusCode === 400);
r = await call('POST', '/mymismo/push/news', { tok: staffTok('jc@example.org'), body: { ...MAT, title: '' } }); ok('no title: refused', r.statusCode === 400 && pushes.length === before);
r = await call('POST', '/mymismo/push/news', { tok: staffTok('jc@example.org'), body: MAT }); d = J(r);
ok('Jonna pushes it: 200, sent to the three news phones, the gone one removed', r.statusCode === 200 && d.sent === 2 && d.failed === 1 && d.removed === 1, d);
const got = pushes.slice(before);
ok('...only phones with news on (A, B, the gone one), not the summit-only phone', got.length === 3 && !got.some(x => x.url === EC));
const mA = JSON.parse(decrypt(Buffer.from(got.find(x => x.url === EA).opts.body), A));
ok('...the phone reads her words and opens the app on it', mA.title === MAT.title && mA.body === MAT.body && mA.url === '/mymismo/?page=dash&news=' + d.id, mA);
ok('...the gone phone is removed from the list', !one(ED));
r = await call('POST', '/mymismo/push/news', { tok: staffTok('jc@example.org'), body: MAT }); d = J(r);
ok('pressing it again: 409 ALREADY_SENT with when, nothing sent', r.statusCode === 409 && d.error === 'ALREADY_SENT' && d.at > 0 && pushes.length === before + 3, d);
r = await call('POST', '/mymismo/push/news', { tok: staffTok('jc@example.org'), body: { ...MAT, body: 'Corrected wording', again: true } });
ok('...unless she says send again (with edited words)', r.statusCode === 200 && J(r).sent === 2);

/* ---------- push a Mic'd Up episode ---------- */
const EP = { kind: 'micdup', ref: 'dQw4w9WgXcQ', title: 'New MISMO Mic\'d Up Episode', body: 'Data Standards and AI, with a made-up guest', video: { id: 'dQw4w9WgXcQ', title: 'Data Standards and AI', published: '2026-12-02T15:00:00Z', duration: '24:10' } };
r = await call('POST', '/mymismo/push/news', { tok: staffTok('jc@example.org'), body: { ...EP, video: { id: 'not-a-video' } } }); ok('a Mic\'d Up push needs the YouTube id', r.statusCode === 400);
r = await call('POST', '/mymismo/push/news', { tok: staffTok('jc@example.org'), body: { ...EP, ref: 'aaaaaaaaaaa' } }); ok('...the same as ref', r.statusCode === 400);
r = await call('POST', '/mymismo/push/news', { tok: staffTok('jc@example.org'), body: EP }); ok('a Mic\'d Up episode pushed', r.statusCode === 200 && J(r).sent === 2, J(r));

/* ---------- the list the app reads ---------- */
r = await call('GET', '/mymismo/push/news'); d = J(r);
ok('GET /push/news: newest first, with the episode for the app\'s list', r.statusCode === 200 && d.items.length === 3 && d.items[0].kind === 'micdup' && d.items[0].video.id === 'dQw4w9WgXcQ' && d.items[0].video.duration === '24:10', d);
ok('...without who sent it or how many got it', !/jc@|"sent"|"by"|"failed"/.test(r.body));
r = await call('PUT', '/mymismo/push/news'); ok('wrong method: 405', r.statusCode === 405);
ok('the record keeps who sent each one', file('push/news.json').items.every(x => x.by === 'jc@example.org'));

/* ---------- turning one off keeps the other ---------- */
await call('POST', '/mymismo/push/unsubscribe', { body: { endpoint: EA, what: 'news' } });
ok('A turns off MISMO news: summit alerts stay', one(EA) && one(EA).news === false && one(EA).summit === 'nola');
await call('POST', '/mymismo/push/unsubscribe', { body: { endpoint: EB, what: 'summit' } });
ok('B turns off summit alerts: MISMO news stays', one(EB) && one(EB).news === true && one(EB).summit === '');
await call('POST', '/mymismo/push/unsubscribe', { body: { endpoint: EB, what: 'news' } });
ok('...and then news: the phone is gone', !one(EB));
await call('POST', '/mymismo/push/unsubscribe', { body: { endpoint: EA } });
ok('no what: the whole phone is removed (as before)', !one(EA));

/* ---------- off until push: true ---------- */
setProjects({ ...ENTRY, attendees: true });
r = await call('GET', '/mymismo/push/news'); ok('push off: /push/news is 404', r.statusCode === 404);
console.log(failed ? failed + ' FAILED' : 'All passed'); process.exit(failed ? 1 : 0);
