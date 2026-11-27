/* MyMISMO's attendee routes (relay request 13). Run: node test-mymismo.mjs. A stand-in GitHub and mail flow, as test-huddle.mjs.
 * Every person and address here is made up. */
import { pbkdf2Sync } from 'node:crypto';
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
const mails = [];
const R = (status, j) => ({ status, ok: status < 300, headers: { get: () => null }, json: async () => j, text: async () => '' });
globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
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
const { handler, __resetProjectsCache, __resetGithubCache, __resetMyMismoLimits } = await import('./index.mjs');
let failed = 0; const ok = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c || d === undefined ? '' : '  ' + JSON.stringify(d).slice(0, 400))); };
const J = r => JSON.parse(r.body);
const call = (m, path, { body, origin = ORIGIN, ip = '203.0.113.1', tok } = {}) => { __resetGithubCache(); return handler({ rawPath: path, requestContext: { http: { method: m, sourceIp: ip } },
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

/* ---------- off until projects.json says attendees: true ---------- */
setProjects(ENTRY);
r = await call('GET', '/mymismo/att/ready'); ok('off by default: ready is 404', r.statusCode === 404);
r = await call('POST', '/mymismo/att/code', { body: { email: 'pat@lender.example', summit: 'nola', startedAt: ago() } });
ok('...code is 404, nothing written, nobody emailed', r.statusCode === 404 && !file('att/codes.json') && mails.length === 0);
setProjects({ ...ENTRY, attendees: 'yes' });
r = await call('GET', '/mymismo/att/ready'); ok('anything but exactly true stays off', r.statusCode === 404);
r = await call('GET', '/huddle/att/ready'); ok('...and another project can never switch them on', r.statusCode === 404);
setProjects({ ...ENTRY, attendees: true, attendeeFeed: { repo: 'Elsewhere/Repo', path: 'data/x.json' } });
r = await call('GET', '/mymismo/att/ready'); ok('a feed in another owner’s repository: off', r.statusCode === 404);
setProjects({ ...ENTRY, attendees: true, attendeeFeed: { repo: 'Org/SummitData', path: '../secrets.json' } });
r = await call('GET', '/mymismo/att/ready'); ok('a feed path outside data/: off', r.statusCode === 404);
setProjects({ ...ENTRY, attendees: true });
__resetMyMismoLimits();

/* ---------- ready ---------- */
r = await call('GET', '/mymismo/att/ready'); d = J(r);
ok('on: ready lists only summits whose sign-in is open', r.statusCode === 200 && d.summits.length === 1 && d.summits[0].id === 'nola' && d.summits[0].name === '2027 Winter Summit', d);
ok('...and never an attendee', !/lender|Pat|Lee/.test(r.body));

/* ---------- code ---------- */
r = await call('POST', '/mymismo/att/code', { body: { email: 'Pat@Lender.example', summit: 'nola', startedAt: ago() } });
ok('registered: 200 and a code emailed to them', r.statusCode === 200 && mails.length === 1 && mails[0].to === 'pat@lender.example' && mails[0].kind === 'mymismo-code' && /^\d{6} is your MyMISMO sign-in code$/.test(mails[0].subject), mails);
const codes = file('att/codes.json').docs, cid = Object.keys(codes)[0];
ok('...the code kept only as a hash, with no email in the file', Object.keys(codes).length === 1 && /^[0-9a-f]{16}$/.test(cid) && !JSON.stringify(codes).includes(codeFor('pat@lender.example')) && !JSON.stringify(codes).includes('@'), codes);
r = await call('POST', '/mymismo/att/code', { body: { email: 'stranger@nowhere.example', summit: 'nola', startedAt: ago() } });
ok('not registered: the very same answer, nothing sent', r.statusCode === 200 && r.body === JSON.stringify({ ok: true }) && mails.length === 1);
r = await call('POST', '/mymismo/att/code', { body: { email: 'pat@lender.example', summit: 'old', startedAt: ago() } });
ok('a past summit: the same answer, nothing sent', r.statusCode === 200 && mails.length === 1);
r = await call('POST', '/mymismo/att/code', { body: { email: 'pat@lender.example', summit: 'nola', startedAt: ago(), website: 'spam.example' } });
ok('hidden field filled: as if sent, nothing sent', r.statusCode === 200 && mails.length === 1);
r = await call('POST', '/mymismo/att/code', { body: { email: 'pat@lender.example', summit: 'nola', startedAt: Date.now() } });
ok('sent within 3 seconds: as if sent, nothing sent', r.statusCode === 200 && mails.length === 1);
r = await call('POST', '/mymismo/att/code', { body: { email: 'pat@lender.example', summit: 'nola', startedAt: ago() }, origin: 'https://evil.example' });
ok('another site: 403', r.statusCode === 403);
r = await call('POST', '/mymismo/att/code', { body: { email: 'nope', summit: 'nola', startedAt: ago() } });
ok('a malformed email: 400', r.statusCode === 400 && J(r).error === 'INVALID');

/* ---------- verify ---------- */
const PAT = codeFor('pat@lender.example');
r = await call('POST', '/mymismo/att/verify', { body: { email: 'pat@lender.example', summit: 'nola', code: PAT === '000000' ? '000001' : '000000' } });
ok('wrong code: 401', r.statusCode === 401 && J(r).error === 'WRONG_CODE');
ok('...one try counted', file('att/codes.json').docs[cid].tries === 1);
r = await call('POST', '/mymismo/att/verify', { body: { email: 'sam@bank.example', summit: 'nola', code: PAT } });
ok('someone else’s code: 401', r.statusCode === 401);
r = await call('POST', '/mymismo/att/verify', { body: { email: 'pat@lender.example', summit: 'nola', code: PAT } }); d = J(r);
const TOK_PAT = d.token;
ok('right code: a token and their own entry, in the directory unless they hide (request 15)', r.statusCode === 200 && typeof d.token === 'string' && d.me.name === 'Pat Lee' && d.me.company === 'Lender Co' && d.me.listed === true && d.me.hidden === false && d.me.email === 'pat@lender.example', d);
ok('...the code is spent', !file('att/codes.json').docs[cid]);
r = await call('POST', '/mymismo/att/verify', { body: { email: 'pat@lender.example', summit: 'nola', code: PAT } }); ok('...and can’t be used twice', r.statusCode === 401);
ok('...people.json holds no email', !JSON.stringify(file('att/nola/people.json')).includes('@'));
/* five wrong tries spend a code */
await call('POST', '/mymismo/att/code', { body: { email: 'alex@vendor.example', summit: 'nola', startedAt: ago() }, ip: '198.51.100.7' });
const ALEX = codeFor('alex@vendor.example'), bad = ALEX === '111111' ? '222222' : '111111';
for (let i = 0; i < 5; i++) await call('POST', '/mymismo/att/verify', { body: { email: 'alex@vendor.example', summit: 'nola', code: bad }, ip: '198.51.100.7' });
r = await call('POST', '/mymismo/att/verify', { body: { email: 'alex@vendor.example', summit: 'nola', code: ALEX }, ip: '198.51.100.7' });
ok('after five wrong tries even the right code is refused', r.statusCode === 401);

/* ---------- the token ---------- */
r = await call('GET', '/mymismo/att/me', { tok: TOK_PAT }); ok('me: their own entry', r.statusCode === 200 && J(r).me.name === 'Pat Lee');
r = await call('GET', '/mymismo/att/me'); ok('no token: 401', r.statusCode === 401);
r = await call('GET', '/mymismo/att/me', { tok: TOK_PAT.slice(0, -2) + 'xx' }); ok('a tampered token: 401', r.statusCode === 401);
r = await call('GET', '/mymismo/data/anything', { tok: TOK_PAT }); ok('an attendee token never passes the staff sign-in', r.statusCode === 401 || r.statusCode === 403, r.statusCode);
const login = await call('POST', '/mymismo/auth/login', { body: { email: 'jc@example.org', password: 'jonna-pass-123456789' } });
const STAFF = J(login).token;
r = await call('GET', '/mymismo/att/me', { tok: STAFF }); ok('...and a staff token never passes here', r.statusCode === 401, r.statusCode);
r = await call('GET', '/mymismo/att/me', { tok: TOK_PAT, origin: 'https://evil.example' }); ok('another site, even with a token: 403', r.statusCode === 403);

/* ---------- profile and directory ---------- */
const sam = await signIn('Sam@Bank.Example', '203.0.113.20'), TOK_SAM = sam.token;
ok('a second attendee signs in (email matched whatever its case)', !!TOK_SAM && sam.me.name === 'Sam Roe', sam);
r = await call('GET', '/mymismo/att/directory', { tok: TOK_SAM }); d = J(r);
ok('directory: everyone registered shows from the registration list, never an email (request 15)', r.statusCode === 200 && d.people.map(x => x.name).join() === 'Alex Kim,Pat Lee' && d.people.find(x => x.name === 'Alex Kim').joined === false && !r.body.includes('@'), d);
r = await call('PUT', '/mymismo/att/profile', { tok: TOK_PAT, body: { listed: true, about: 'Data standards nerd.', linkedin: 'https://www.linkedin.com/in/pat-lee', title: 'Chief Technology Officer' } }); d = J(r);
ok('profile saved and listed', r.statusCode === 200 && d.me.listed === true && d.me.title === 'Chief Technology Officer' && d.me.about === 'Data standards nerd.', d);
r = await call('PUT', '/mymismo/att/profile', { tok: TOK_PAT, body: { linkedin: 'javascript:alert(1)' } }); ok('a LinkedIn address that isn’t LinkedIn: 400', r.statusCode === 400);
r = await call('PUT', '/mymismo/att/profile', { tok: TOK_PAT, body: { name: 'Someone Else', email: 'x@y.example' } }); d = J(r);
ok('name and email can’t be changed', r.statusCode === 200 && d.me.name === 'Pat Lee' && d.me.email === 'pat@lender.example');
r = await call('GET', '/mymismo/att/directory', { tok: TOK_SAM }); d = J(r);
ok('directory: Pat shows with their profile, with no email', r.statusCode === 200 && d.people.find(x => x.name === 'Pat Lee').about === 'Data standards nerd.' && d.people.find(x => x.name === 'Pat Lee').joined === true && !r.body.includes('@'), d);
r = await call('GET', '/mymismo/att/directory', { tok: TOK_PAT }); ok('...and you never see yourself', !J(r).people.some(x => x.name === 'Pat Lee'));
const PAT_ID = J(await call('GET', '/mymismo/att/me', { tok: TOK_PAT })).me.id, SAM_ID = sam.me.id;

/* ---------- messages ---------- */
await call('PUT', '/mymismo/att/profile', { tok: TOK_SAM, body: { listed: false } });
r = await call('GET', '/mymismo/att/directory', { tok: TOK_PAT }); ok('someone who hides themselves leaves the directory', !J(r).people.some(x => x.name === 'Sam Roe'));
r = await call('POST', '/mymismo/att/message', { tok: TOK_PAT, body: { to: SAM_ID, text: 'Hi Sam' } });
ok('can’t start a conversation with someone hidden', r.statusCode === 403 && J(r).error === 'CANT_MESSAGE');
r = await call('POST', '/mymismo/att/message', { tok: TOK_SAM, body: { to: PAT_ID, text: 'Hi Pat, coffee at the break?' } }); d = J(r);
ok('can message someone listed', r.statusCode === 200 && d.ok === true);
r = await call('POST', '/mymismo/att/message', { tok: TOK_PAT, body: { to: SAM_ID, text: 'Sure, see you by the registration desk.' } });
ok('...and they can reply, though the sender is hidden', r.statusCode === 200);
r = await call('GET', '/mymismo/att/messages', { tok: TOK_PAT }); d = J(r);
ok('Pat sees the one conversation, both messages, which is theirs', r.statusCode === 200 && d.threads.length === 1 && d.threads[0].with.name === 'Sam Roe' && d.threads[0].m.length === 2 && d.threads[0].m[0].mine === false && d.threads[0].m[1].mine === true, d);
ok('...with no email anywhere', !r.body.includes('@'));
const alexTok = (await signIn('alex@vendor.example', '198.51.100.30')).token;
r = await call('GET', '/mymismo/att/messages', { tok: alexTok }); ok('a third attendee sees none of it', J(r).threads.length === 0);
r = await call('POST', '/mymismo/att/message', { tok: TOK_SAM, body: { to: PAT_ID, text: 'x'.repeat(1001) } }); ok('over 1,000 characters: 400', r.statusCode === 400);
r = await call('POST', '/mymismo/att/message', { tok: TOK_SAM, body: { to: PAT_ID, text: '   ' } }); ok('empty: 400', r.statusCode === 400);
r = await call('POST', '/mymismo/att/message', { tok: TOK_SAM, body: { to: SAM_ID, text: 'me' } }); ok('to yourself: 400', r.statusCode === 400);
/* block */
r = await call('POST', '/mymismo/att/block', { tok: TOK_PAT, body: { id: SAM_ID, on: true } }); ok('Pat blocks Sam', r.statusCode === 200 && J(r).me.blocked.includes(SAM_ID));
r = await call('POST', '/mymismo/att/message', { tok: TOK_SAM, body: { to: PAT_ID, text: 'Hello?' } }); ok('...Sam can no longer message Pat', r.statusCode === 403);
r = await call('POST', '/mymismo/att/message', { tok: TOK_PAT, body: { to: SAM_ID, text: 'test' } }); ok('...nor Pat Sam, while blocked', r.statusCode === 403);
r = await call('POST', '/mymismo/att/block', { tok: TOK_PAT, body: { id: SAM_ID, on: false } }); ok('unblocked', r.statusCode === 200 && !J(r).me.blocked.includes(SAM_ID));
/* limits */
__resetMyMismoLimits();
let last;
for (let i = 0; i < 61; i++) last = await call('POST', '/mymismo/att/message', { tok: TOK_SAM, body: { to: PAT_ID, text: 'm' + i } });
ok('61st message in an hour: 429', last.statusCode === 429);
__resetMyMismoLimits();
{ const st = []; for (let i = 0; i < 601; i++) st.push((await call('POST', '/mymismo/att/code', { body: { email: 'person' + i + '@hotel.example', summit: 'nola', startedAt: ago() }, ip: '192.0.2.50' })).statusCode);
  ok('a hotel\'s Wi-Fi (one address): 600 people can ask for codes in an hour', st.slice(0, 600).every(x => x === 200), st.slice(0, 600).filter(x => x !== 200));
  ok('601st code from one address in an hour: 429', st[600] === 429, st[600]); }
const before = mails.length; __resetMyMismoLimits();
for (let i = 0; i < 4; i++) await call('POST', '/mymismo/att/code', { body: { email: 'pat@lender.example', summit: 'nola', startedAt: ago() }, ip: '192.0.2.' + (60 + i) });
ok('at most 3 codes an hour to one email, whatever the address', mails.length - before === 3, mails.length - before);
/* only the codes go out by email */
ok('the only emails ever sent are sign-in codes, each to the person who asked', mails.every(m => m.kind === 'mymismo-code'));
/* staff /data and /commit can't reach the attendee files */
r = await call('GET', '/mymismo/data/att%2Fnola%2Fmessages', { tok: STAFF }); ok('staff data route can’t read the messages', r.statusCode !== 200, r.statusCode);
r = await call('POST', '/mymismo/commit', { tok: STAFF, body: { files: [{ path: 'att/nola/people.json', content: '{}' }], message: 'x' } }); ok('...nor write the attendee files', r.statusCode !== 200, r.statusCode);
r = await call('PUT', '/mymismo/att/me', { tok: TOK_PAT, body: {} }); ok('wrong method: 405', r.statusCode === 405);
r = await call('GET', '/mymismo/att/nothing', { tok: TOK_PAT }); ok('unknown attendee route: 404', r.statusCode === 404);

console.log(failed ? `\n${failed} FAILED` : '\nAll passed');
process.exit(failed ? 1 : 0);
