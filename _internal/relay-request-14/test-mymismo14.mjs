/* MyMISMO alerts and slides (relay request 14). Run: node test-mymismo14.mjs. A stand-in GitHub and mail flow, as test-huddle.mjs.
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

/* ---------- the encryption itself ---------- */
{ const p = phone(); const enc = mm14encrypt('{"title":"Hello"}', b64u(p.e.getPublicKey()), b64u(p.auth));
  ok('RFC 8291: the phone can decrypt what the relay sends', decrypt(enc, p) === '{"title":"Hello"}');
  ok('...record size 4096 and the 65-byte key id in the header', enc.readUInt32BE(16) === 4096 && enc[20] === 65);
  const q = phone(); let threw = false; try { decrypt(enc, q); } catch (e) { threw = true; } ok('...and another phone can not', threw); }

/* ---------- off until projects.json says push: true ---------- */
setProjects({ ...ENTRY, attendees: true });
r = await call('GET', '/mymismo/push/ready'); ok('push off by default: ready is 404', r.statusCode === 404);
r = await call('POST', '/mymismo/push/subscribe', { body: { summit: 'nola', sub: subOf(phone(), 'https://fcm.googleapis.com/fcm/send/abc') } }); ok('...subscribe is 404 and nothing kept', r.statusCode === 404 && !file('push/subs.json'));
setProjects({ ...ENTRY, push: true, alertSenders: ['JC@example.org'] });
r = await call('GET', '/mymismo/push/ready'); ok('push needs attendees: true too (it reads the same entry)', r.statusCode === 404);
setProjects({ ...ENTRY, attendees: true, push: true, alertSenders: ['JC@example.org'] });
const keep = process.env.MYMISMO_VAPID_PRIVATE; process.env.MYMISMO_VAPID_PRIVATE = '';
r = await call('GET', '/mymismo/push/ready'); ok('no VAPID key on the function: still off', r.statusCode === 404);
process.env.MYMISMO_VAPID_PRIVATE = keep; __resetMyMismoLimits();
r = await call('GET', '/mymismo/push/ready'); d = J(r);
ok('on: ready gives the public key and the open summits', r.statusCode === 200 && d.publicKey === process.env.MYMISMO_VAPID_PUBLIC && d.summits.join() === 'nola', d);
ok('...and never the private key', !r.body.includes(process.env.MYMISMO_VAPID_PRIVATE));

/* ---------- subscribe ---------- */
const A = phone(), B = phone(), C = phone(), OLD = phone();
r = await call('POST', '/mymismo/push/subscribe', { body: { summit: 'nola', sub: subOf(A, 'https://fcm.googleapis.com/fcm/send/aaa') } });
ok('a phone turns alerts on', r.statusCode === 200 && Object.keys(file('push/subs.json').docs).length === 1);
await call('POST', '/mymismo/push/subscribe', { body: { summit: 'nola', sub: subOf(A, 'https://fcm.googleapis.com/fcm/send/aaa') } });
ok('...the same phone twice is kept once', Object.keys(file('push/subs.json').docs).length === 1);
await call('POST', '/mymismo/push/subscribe', { body: { summit: 'nola', sub: subOf(B, 'https://web.push.apple.com/QBbb') } });
await call('POST', '/mymismo/push/subscribe', { body: { summit: 'nola', sub: subOf(OLD, 'https://fcm.googleapis.com/fcm/send/gone') } });
await call('POST', '/mymismo/push/subscribe', { body: { summit: 'slc', sub: subOf(C, 'https://fcm.googleapis.com/fcm/send/ccc') } });
ok('...an iPhone and other summits too', Object.keys(file('push/subs.json').docs).length === 4);
ok('...no IP address, name or email kept', !/203\.0\.113|@/.test(JSON.stringify(file('push/subs.json'))));
r = await call('POST', '/mymismo/push/subscribe', { body: { summit: 'nola', sub: subOf(phone(), 'https://evil.example/collect') } }); ok('an address that is not a push service: refused', r.statusCode === 400);
r = await call('POST', '/mymismo/push/subscribe', { body: { summit: 'nola', sub: { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'short', auth: 'x' } } } }); ok('bad keys: refused', r.statusCode === 400);
r = await call('POST', '/mymismo/push/subscribe', { body: { summit: '../x', sub: subOf(phone(), 'https://fcm.googleapis.com/x') } }); ok('a bad summit id: refused', r.statusCode === 400);
r = await call('POST', '/mymismo/push/subscribe', { origin: 'https://evil.example', body: { summit: 'nola', sub: subOf(phone(), 'https://fcm.googleapis.com/x') } }); ok('another site: 403', r.statusCode === 403);
r = await call('GET', '/mymismo/push/subscribe'); ok('wrong method: 405', r.statusCode === 405);

/* ---------- send ---------- */
const before = pushes.length;
r = await call('POST', '/mymismo/push/send', { body: { summit: 'nola', title: 'Room Change', body: 'Origination COP moved to La Salle C.' } }); ok('send with no sign-in: refused', r.statusCode === 403 && pushes.length === before);
r = await call('POST', '/mymismo/push/send', { tok: staffTok('kb@example.org'), body: { summit: 'nola', title: 'Room Change', body: 'x' } }); ok('a staff member not on alertSenders: refused', r.statusCode === 403 && pushes.length === before);
r = await call('POST', '/mymismo/push/send', { tok: 'x.' + staffTok('jc@example.org').split('.')[1] + '.y', body: { summit: 'nola', title: 'T', body: 'x' } }); ok('a forged token: refused', r.statusCode === 403);
const attTok = (await (async () => { await call('POST', '/mymismo/att/code', { body: { email: 'pat@lender.example', summit: 'nola', startedAt: ago() }, ip: '203.0.113.50' }); return J(await call('POST', '/mymismo/att/verify', { body: { email: 'pat@lender.example', summit: 'nola', code: codeFor('pat@lender.example') }, ip: '203.0.113.50' })).token; })());
r = await call('POST', '/mymismo/push/send', { tok: attTok, body: { summit: 'nola', title: 'T', body: 'x' } }); ok('an attendee token can never send', r.statusCode === 403 && pushes.length === before);
r = await call('POST', '/mymismo/push/send', { tok: staffTok('jc@example.org'), body: { summit: 'nola', title: '', body: '' } }); ok('an empty alert: refused', r.statusCode === 400);
r = await call('POST', '/mymismo/push/send', { tok: staffTok('jc@example.org'), body: { summit: 'nola', title: 'Room Change', body: 'Origination COP moved to La Salle C.', session: 's-orig-mon' } }); d = J(r);
ok('Jonna sends: 200, two delivered, one gone', r.statusCode === 200 && d.sent === 2 && d.failed === 1 && d.removed === 1, d);
const sent = pushes.slice(before);
ok('...only this summit’s phones were sent to', sent.length === 3 && !sent.some(x => x.url.includes('/ccc')));
const toA = sent.find(x => x.url.endsWith('/aaa')), msg = JSON.parse(decrypt(Buffer.from(toA.opts.body), A));
ok('...the phone reads the title, words and where it opens', msg.title === 'Room Change' && msg.body === 'Origination COP moved to La Salle C.' && msg.url.includes('open=s-orig-mon'), msg);
const toB = sent.find(x => x.url.includes('apple')); ok('...the iPhone gets its own encryption', JSON.parse(decrypt(Buffer.from(toB.opts.body), B)).id === msg.id);
const [vt, vk2] = toA.opts.headers.Authorization.replace('vapid t=', '').split(', k=');
const [jh, jb, js] = vt.split('.'); const claims = JSON.parse(Buffer.from(jb, 'base64url').toString());
const pub = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(vk.getPublicKey().subarray(1, 33)), y: b64u(vk.getPublicKey().subarray(33)) }, format: 'jwk' });
ok('...VAPID: signed with the function’s key, for the push service’s origin', vk2 === process.env.MYMISMO_VAPID_PUBLIC && claims.aud === 'https://fcm.googleapis.com' && cryptoVerify('sha256', Buffer.from(jh + '.' + jb), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(js, 'base64url')), claims);
ok('...the gone phone was removed', Object.keys(file('push/subs.json').docs).length === 3 && !JSON.stringify(file('push/subs.json')).includes('/gone'));
const al = file('push/alerts.json').alerts; ok('...the alert is kept with who sent it', al.length === 1 && al[0].by === 'jc@example.org' && al[0].sent === 2, al);

/* ---------- the inbox ---------- */
r = await call('GET', '/mymismo/push/alerts?summit=nola'); d = J(r);
ok('alerts inbox: this summit’s alerts', r.statusCode === 200 && d.alerts.length === 1 && d.alerts[0].title === 'Room Change', d);
ok('...without who sent it or how many got it', !/jc@|"sent"|"by"/.test(r.body));
r = await call('GET', '/mymismo/push/alerts?summit=slc'); ok('...another summit sees none of them', J(r).alerts.length === 0);

/* ---------- unsubscribe ---------- */
r = await call('POST', '/mymismo/push/unsubscribe', { body: { endpoint: 'https://fcm.googleapis.com/fcm/send/aaa' } });
ok('a phone turns alerts off', r.statusCode === 200 && Object.keys(file('push/subs.json').docs).length === 2);
const b2 = pushes.length;
await call('POST', '/mymismo/push/send', { tok: staffTok('jc@example.org'), body: { summit: 'nola', title: 'Two', body: 'Second.' } });
ok('...and gets nothing after', !pushes.slice(b2).some(x => x.url.endsWith('/aaa')) && pushes.length - b2 === 1);

/* ---------- slides ---------- */
r = await call('GET', '/mymismo/slides/have?summit=nola'); ok('slides off until slidesFeed is set', r.statusCode === 404);
r = await call('GET', '/mymismo/att/slides?session=s1', { tok: attTok }); ok('...and the attendee route too', r.statusCode === 404);
put('Org/SummitData:data/feed-mymismo-slides.json', { updated: 'x', summits: { nola: { sessions: {
  s1: [{ name: 'Origination COP.pdf', type: 'application/pdf', size: 1234, file: 'data/slides-nola-s1-0.json', parts: 2 }, { name: 'bad.pdf', file: '../../access.json' }],
  s2: [] } }, slc: { sessions: { s9: [{ name: 'Other.pdf', type: 'application/pdf', file: 'data/slides-slc-s9-0.json' }] } } } });
put('Org/SummitData:data/slides-nola-s1-0.json', { chunked: { ver: 'v1', n: 2 } });
put('Org/SummitData:data/slides-nola-s1-0--v1-0.json', { s: 'data:application/pdf;base64,JVBER' });
put('Org/SummitData:data/slides-nola-s1-0--v1-1.json', { s: 'i0xLjQK' });
put('Org/SummitData:data/slides-slc-s9-0.json', { s: 'data:application/pdf;base64,SECRET' });
setProjects({ ...ENTRY, attendees: true, push: true, alertSenders: ['jc@example.org'], slidesFeed: { repo: 'Org/SummitData', path: 'data/feed-mymismo-slides.json' } }); __resetMyMismo14();
r = await call('GET', '/mymismo/slides/have?summit=nola'); d = J(r);
ok('on: counts per session, no names, bad file paths left out', r.statusCode === 200 && JSON.stringify(d.sessions) === '{"s1":1}', d);
r = await call('GET', '/mymismo/att/slides?session=s1'); ok('the file list needs sign-in', r.statusCode === 401);
r = await call('GET', '/mymismo/att/slides?session=s1', { tok: staffTok('jc@example.org') }); ok('...a staff token is not an attendee sign-in', r.statusCode === 401);
r = await call('GET', '/mymismo/att/slides?session=s1', { tok: attTok }); d = J(r);
ok('a signed-in attendee sees the files', r.statusCode === 200 && d.files.length === 1 && d.files[0].name === 'Origination COP.pdf' && d.files[0].parts === 2, d);
const p0 = J(await call('GET', '/mymismo/att/slide?session=s1&n=0&part=0', { tok: attTok })), p1 = J(await call('GET', '/mymismo/att/slide?session=s1&n=0&part=1', { tok: attTok }));
ok('...and downloads it in parts that join into the file', p0.parts === 2 && (p0.s + p1.s) === 'data:application/pdf;base64,JVBERi0xLjQK', [p0, p1]);
r = await call('GET', '/mymismo/att/slide?session=s1&n=0&part=5', { tok: attTok }); ok('...a part past the end: 404', r.statusCode === 404);
r = await call('GET', '/mymismo/att/slide?session=s1&n=1&part=0', { tok: attTok }); ok('...a file with a bad path can never be read', r.statusCode === 404);
r = await call('GET', '/mymismo/att/slide?session=s9&n=0', { tok: attTok }); ok('...another summit’s slides: not for this attendee', r.statusCode === 404);
r = await call('GET', '/mymismo/att/slides?session=s1', { tok: attTok, origin: 'https://evil.example' }); ok('...from another site: 403', r.statusCode === 403);

/* ---------- nothing else changed ---------- */
r = await call('GET', '/mymismo/att/ready'); ok('relay request 13 routes still answer', r.statusCode === 200);
r = await call('GET', '/huddle/push/ready'); ok('another project can never reach these routes', r.statusCode === 404);

console.log(failed ? `\n${failed} FAILED` : '\nAll passed.');
process.exit(failed ? 1 : 0);
