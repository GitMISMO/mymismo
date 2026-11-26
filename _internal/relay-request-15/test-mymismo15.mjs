/* MyMISMO Trivia leaderboard and championship (relay request 15). Run: node test-mymismo15.mjs.
 * A stand-in GitHub and mail flow, as test-mymismo14.mjs. Every person, address and question here is made up. */
const ORIGIN = 'https://resources.example';
Object.assign(process.env, { GITHUB_TOKEN: 'ghp_test', AUTH_SECRET: 'mymismo-test-secret', PROJECTS_REPO: 'Org/Config', DIRECTORY_REPO: 'Org/Accounts', MAIL_FLOW_URL: 'https://flow.example/mail' });
let N = 100; const sha = () => (N++).toString(16).padEnd(40, 'c'); const repo = {};
const put = (key, data, message = 'seed') => { (repo[key] = repo[key] || []).push({ sha: sha(), data, message }); };
const realNow = Date.now; let T = Date.parse('2027-01-20T15:00:00Z'); Date.now = () => T;
const ENTRY = { repo: 'Org/MyMismoData', origin: ORIGIN, writable: [] };
const setProjects = entry => { put('Org/Config:projects.json', { mymismo: entry }); __resetProjectsCache(); };
put('Org/Accounts:access.json', { people: {} });
const CATS = ['Standards', 'Life of Loan', 'Glossary', 'How MISMO Works', 'Certs', 'Mortgage'];
const QS = [];
CATS.forEach((c, i) => { for (let k = 0; k < 8; k++) QS.push({ id: `h${i}-${k}`, cat: c, q: `Hard ${c} ${k}?`, choices: ['A' + k, 'B' + k, 'C' + k, 'D' + k], answer: k % 4, level: 3, source: 'https://example.org/s' }); });
QS.push({ id: 'e1', cat: 'Standards', q: 'Easy?', choices: ['a', 'b', 'c', 'd'], answer: 0, level: 1 });
put('Org/MyMismoData:trivia/questions.json', { questions: QS });
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
const { handler, __resetProjectsCache, __resetGithubCache, __resetMyMismoLimits, __resetMyMismo15 } = await import('./index.mjs');
let failed = 0, passed = 0; const ok = (n, c, d) => { if (!c) failed++; else passed++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c || d === undefined ? '' : '  ' + JSON.stringify(d).slice(0, 400))); };
const J = r => JSON.parse(r.body);
const call = (m, path, { body, origin = ORIGIN, ip = '203.0.113.1', tok } = {}) => { __resetGithubCache(); const [rp, qs] = path.split('?'); return handler({ rawPath: rp, rawQueryString: qs || '', queryStringParameters: qs ? Object.fromEntries(new URLSearchParams(qs)) : undefined, requestContext: { http: { method: m, sourceIp: ip } },
  headers: { ...(origin ? { origin } : {}), 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); };
const file = p => { const h = repo['Org/MyMismoData:' + p]; return h ? h.at(-1).data : null; };
const codeFor = email => { const mm = mails.filter(x => x.to === email).at(-1); return mm && (mm.subject.match(/^(\d{6}) /) || [])[1]; };
const bank = new Map(QS.map(q => [q.q, q]));
async function signIn(email, first, last, ip = '203.0.113.9') {
  await call('POST', '/mymismo/trivia/code', { body: { email, startedAt: T - 9000 }, ip });
  return J(await call('POST', '/mymismo/trivia/verify', { body: { email, code: codeFor(email.toLowerCase()), first, last }, ip }));
}
/* plays a whole round; right = how many to get right; ms = how long each answer takes */
async function play(tok, right, ms = 3000) {
  const rd = J(await call('POST', '/mymismo/trivia/round', { tok, body: {} }));
  let last;
  for (let i = 0; i < 10; i++) {
    const q = J(await call('POST', '/mymismo/trivia/next', { tok, body: { round: rd.round } }));
    const real = bank.get(q.q), good = q.choices.indexOf(real.choices[real.answer]);
    T += ms;
    last = J(await call('POST', '/mymismo/trivia/answer', { tok, body: { round: rd.round, n: q.n, choice: i < right ? good : (good + 1) % 4 } }));
  }
  return { rd, last };
}
let r, d;

/* switched off until trivia: true */
setProjects(ENTRY);
r = await call('GET', '/mymismo/trivia/ready'); ok('off: 404 until trivia is true', r.statusCode === 404);
setProjects({ ...ENTRY, trivia: true });
r = await call('GET', '/mymismo/trivia/ready'); d = J(r);
ok('ready: month and quarter in Eastern time', r.statusCode === 200 && d.month === '2027-01' && d.quarter === '2027-Q1' && d.secs === 15 && d.champ === null, d);
r = await call('GET', '/mymismo/trivia/nope'); ok('unknown route 404', r.statusCode === 404);
r = await call('GET', '/mymismo/trivia/round'); ok('wrong method 405', r.statusCode === 405);

/* sign-in */
r = await call('POST', '/mymismo/trivia/code', { body: { email: 'pat@example.org', startedAt: T - 9000 }, origin: 'https://evil.example' }); ok('code: other site refused', r.statusCode === 403);
r = await call('POST', '/mymismo/trivia/code', { body: { email: 'pat@example.org', startedAt: T - 9000, website: 'x' } }); ok('code: robot gets ok, nothing sent', r.statusCode === 200 && mails.length === 0);
r = await call('POST', '/mymismo/trivia/code', { body: { email: 'pat@example.org', startedAt: T - 500 } }); ok('code: too fast gets ok, nothing sent', r.statusCode === 200 && mails.length === 0);
r = await call('POST', '/mymismo/trivia/code', { body: { email: 'not an email', startedAt: T - 9000 } }); ok('code: bad email 400', r.statusCode === 400);
r = await call('POST', '/mymismo/trivia/code', { body: { email: 'Pat@Example.org', startedAt: T - 9000 } });
ok('code: anyone gets a code by email', r.statusCode === 200 && mails.length === 1 && mails[0].kind === 'mymismo-trivia-code' && /^\d{6} is your MyMISMO Trivia sign-in code$/.test(mails[0].subject), mails);
ok('code: only a hash is kept, no email', !JSON.stringify(file('trivia/codes.json')).includes('example.org') && !JSON.stringify(file('trivia/codes.json')).includes(codeFor('pat@example.org')));
r = await call('POST', '/mymismo/trivia/verify', { body: { email: 'pat@example.org', code: '000000', first: 'Pat', last: 'Lee' } });
ok('verify: wrong code 401', r.statusCode === 401 || codeFor('pat@example.org') === '000000');
r = await call('POST', '/mymismo/trivia/verify', { body: { email: 'pat@example.org', code: codeFor('pat@example.org'), first: 'Pat', last: 'lee' } }); d = J(r);
const pat = d.token;
ok('verify: token and name shown as first name and last initial', r.statusCode === 200 && pat && d.me.name === 'Pat L.', d);
r = await call('POST', '/mymismo/trivia/verify', { body: { email: 'pat@example.org', code: codeFor('pat@example.org'), first: 'Pat', last: 'Lee' } });
ok('verify: a code works once', r.statusCode === 401);
ok('players.json keeps no email', !JSON.stringify(file('trivia/players.json')).includes('@'));
await call('POST', '/mymismo/trivia/code', { body: { email: 'sam@example.org', startedAt: T - 9000 }, ip: '203.0.113.20' });
for (let i = 0; i < 5; i++) await call('POST', '/mymismo/trivia/verify', { body: { email: 'sam@example.org', code: '12345' + i, first: 'Sam' }, ip: '203.0.113.21' });
r = await call('POST', '/mymismo/trivia/verify', { body: { email: 'sam@example.org', code: codeFor('sam@example.org'), first: 'Sam' }, ip: '203.0.113.21' });
ok('verify: a code is spent after 5 wrong tries', r.statusCode === 401 || ['123450','123451','123452','123453','123454'].includes(codeFor('sam@example.org')));

/* tokens: an attendee or staff-style token can't play */
r = await call('POST', '/mymismo/trivia/round', { body: {} }); ok('round: needs sign-in', r.statusCode === 401);
r = await call('POST', '/mymismo/trivia/round', { body: {}, tok: 'a.b.c' }); ok('round: a bad token is refused', r.statusCode === 401);
r = await call('POST', '/mymismo/trivia/round', { body: {}, tok: pat, origin: 'https://evil.example' }); ok('round: other site refused', r.statusCode === 403);

/* a round */
r = await call('POST', '/mymismo/trivia/round', { tok: pat, body: {} }); d = J(r);
ok('round: started', r.statusCode === 200 && /^R/.test(d.round) && d.count === 10 && d.secs === 15, d);
const R1 = d.round, saved = file('trivia/rounds.json').docs[R1];
const cats = saved.ids.map(id => QS.find(q => q.id === id).cat);
ok('round: 10 Hard questions only', saved.ids.length === 10 && saved.ids.every(id => QS.find(q => q.id === id).level === 3));
ok('round: Mixed, every category at least once, none more than twice', CATS.every(c => cats.includes(c)) && CATS.every(c => cats.filter(x => x === c).length <= 2), cats);
r = await call('POST', '/mymismo/trivia/next', { tok: pat, body: { round: R1 } }); d = J(r);
ok('next: question without the answer', r.statusCode === 200 && d.n === 0 && d.choices.length === 4 && !('answer' in d) && !r.body.includes('example.org/s'), d);
const q0 = d, real0 = bank.get(q0.q);
T += 4000;
r = await call('POST', '/mymismo/trivia/next', { tok: pat, body: { round: R1 } }); d = J(r);
ok('next: asking again gives the same question and never restarts the clock', d.n === 0 && d.q === q0.q && d.left === 11000, d);
r = await call('POST', '/mymismo/trivia/answer', { tok: pat, body: { round: R1, n: 1, choice: 0 } }); ok('answer: can’t skip ahead', r.statusCode === 409);
const good0 = q0.choices.indexOf(real0.choices[real0.answer]);
r = await call('POST', '/mymismo/trivia/answer', { tok: pat, body: { round: R1, n: 0, choice: good0 } }); d = J(r);
ok('answer: right in 4 seconds (3 after the network allowance) = 1,800', d.right === true && d.points === 1800 && d.total === 1800 && d.answer === good0 && d.done === false, d);
r = await call('POST', '/mymismo/trivia/answer', { tok: pat, body: { round: R1, n: 0, choice: good0 } }); ok('answer: once only', r.statusCode === 409);
r = await call('POST', '/mymismo/trivia/next', { tok: pat, body: { round: R1 } }); const q1 = J(r), real1 = bank.get(q1.q);
T += 1000;
r = await call('POST', '/mymismo/trivia/answer', { tok: pat, body: { round: R1, n: 1, choice: q1.choices.indexOf(real1.choices[real1.answer]) } }); d = J(r);
ok('answer: two in a row adds 200, instant answer 2,000', d.points === 2200 && d.streak === 2 && d.total === 4000, d);
r = await call('POST', '/mymismo/trivia/next', { tok: pat, body: { round: R1 } }); const q2 = J(r), real2 = bank.get(q2.q);
T += 17000;
r = await call('POST', '/mymismo/trivia/answer', { tok: pat, body: { round: R1, n: 2, choice: q2.choices.indexOf(real2.choices[real2.answer]) } }); d = J(r);
ok('answer: past 15 seconds (plus 1) scores 0 even if right', d.right === false && d.points === 0 && d.late === true && d.streak === 0, d);
const sam = (await signIn('sam2@example.org', 'Sam', 'Roe')).token;
r = await call('POST', '/mymismo/trivia/next', { tok: sam, body: { round: R1 } }); ok('next: someone else’s round is refused', r.statusCode === 404);
for (let n = 3; n < 10; n++) {
  const q = J(await call('POST', '/mymismo/trivia/next', { tok: pat, body: { round: R1 } })); T += 1000;
  d = J(await call('POST', '/mymismo/trivia/answer', { tok: pat, body: { round: R1, n: q.n, choice: -1 } }));
}
ok('round: done after 10, saved to January’s board', d.done === true && d.saved === true && d.month === '2027-01' && d.best === 4000, d);
ok('round: removed once finished', !file('trivia/rounds.json').docs[R1]);
ok('seen: the 10 questions are remembered', file('trivia/seen.json').docs && Object.values(file('trivia/seen.json').docs)[0].length === 10);
r = await call('POST', '/mymismo/trivia/next', { tok: pat, body: { round: R1 } }); ok('next: a finished round is over', r.statusCode === 404);

/* the next round prefers questions not seen yet */
r = await call('POST', '/mymismo/trivia/round', { tok: pat, body: {} }); const R2 = J(r).round;
const seen1 = Object.values(file('trivia/seen.json').docs)[0];
ok('round: rotates to questions not seen yet', file('trivia/rounds.json').docs[R2].ids.every(id => !seen1.includes(id)));
r = await call('POST', '/mymismo/trivia/round', { tok: pat, body: {} }); const R3 = J(r).round;
ok('round: a new round ends the old one', !file('trivia/rounds.json').docs[R2] && !!file('trivia/rounds.json').docs[R3]);

/* best round only */
T += 60000; await play(pat, 10, 1000);
let bd = file('trivia/board-2027-01.json').docs; const patId = Object.keys(bd).find(k => bd[k].name === 'Pat L.');
const best = bd[patId].best;
T += 60000; await play(pat, 2, 1000);
bd = file('trivia/board-2027-01.json').docs;
ok('board: keeps only the single best round', bd[patId].best === best && best > 4000 && bd[patId].rounds === 3, bd[patId]);
T += 60000; await play(sam, 10, 2000);
r = await call('GET', '/mymismo/trivia/board?month=2027-01', { tok: sam }); d = J(r);
ok('board: ranked, names only, and “me”', r.statusCode === 200 && d.rows.length === 2 && d.rows[0].name === 'Pat L.' && d.rows[1].name === 'Sam R.' && d.me && d.me.rank === 2 && !r.body.includes('@'), d);
r = await call('GET', '/mymismo/trivia/board?month=2027-13'); ok('board: bad month 400', r.statusCode === 400);

/* the board starts over each month (Eastern time: 11:30 PM Jan 31 in New York is still January) */
T = Date.parse('2027-02-01T04:30:00Z');
r = await call('GET', '/mymismo/trivia/ready'); ok('month: Eastern time decides', J(r).month === '2027-01');
T = Date.parse('2027-02-10T15:00:00Z');
r = await call('GET', '/mymismo/trivia/board'); ok('board: starts over in February', J(r).month === '2027-02' && J(r).rows.length === 0);
await play(pat, 10, 1000); T += 60000; await play(sam, 6, 1000);
const alex = (await signIn('alex@example.org', 'Alex', 'Kim', '203.0.113.40')).token;
T = Date.parse('2027-03-05T15:00:00Z'); await play(pat, 10, 1000); T += 60000; await play(alex, 4, 5000); T += 60000; await play(sam, 3, 5000);

/* championship: Pat won January, February and March; the runner-up rule fills the other spots */
const OPENS = '2027-04-05T13:00:00Z', CLOSES = '2027-04-12T04:00:00Z';
setProjects({ ...ENTRY, trivia: true, triviaChamp: { quarter: '2027-Q1', opens: OPENS, closes: CLOSES, minutes: 15 } });
T = Date.parse('2027-04-01T15:00:00Z');
r = await call('GET', '/mymismo/trivia/champ', { tok: alex }); d = J(r);
ok('champ: finalists by month with the runner-up rule', d.set && d.open === false && d.finalists.map(f => f.name + ' ' + f.month).join(', ') === 'Pat L. 2027-01, Sam R. 2027-02, Alex K. 2027-03' && d.me.finalist === true, d);
r = await call('POST', '/mymismo/trivia/champ/start', { tok: pat, body: {} }); ok('champ: not before the window', r.statusCode === 409 && J(r).error === 'NOT_OPEN');
T = Date.parse('2027-04-06T15:00:00Z');
const other = (await signIn('jo@example.org', 'Jo', 'Doe', '203.0.113.50')).token;
r = await call('POST', '/mymismo/trivia/champ/start', { tok: other, body: {} }); ok('champ: only finalists', r.statusCode === 403);
r = await call('POST', '/mymismo/trivia/champ/start', { tok: pat, body: {} }); d = J(r);
ok('champ: start shows the board, no questions, and a 15-minute deadline', r.statusCode === 200 && d.cats.length === 6 && d.values.join() === '200,400,600,800,1000' && d.left === 900000 && !r.body.includes('Hard '), d);
r = await call('POST', '/mymismo/trivia/champ/start', { tok: pat, body: {} }); ok('champ: one try only', r.statusCode === 409 && J(r).error === 'ALREADY');
r = await call('POST', '/mymismo/trivia/champ/pick', { tok: pat, body: { cell: '0-4' } }); d = J(r);
ok('champ: pick shows the question', r.statusCode === 200 && d.value === 1000 && d.choices.length === 4 && !('answer' in d), d);
const cq = bank.get(d.q);
r = await call('POST', '/mymismo/trivia/champ/pick', { tok: pat, body: { cell: '1-0' } }); ok('champ: answer the open square first', r.statusCode === 409);
r = await call('POST', '/mymismo/trivia/champ/answer', { tok: pat, body: { cell: '0-4', choice: d.choices.indexOf(cq.choices[cq.answer]) } }); d = J(r);
ok('champ: right adds the square’s value', d.right === true && d.points === 1000 && d.total === 1000, d);
r = await call('POST', '/mymismo/trivia/champ/pick', { tok: pat, body: { cell: '0-4' } }); ok('champ: a square is played once', r.statusCode === 409);
r = await call('POST', '/mymismo/trivia/champ/pick', { tok: pat, body: { cell: '2-1' } }); d = J(r); const cq2 = bank.get(d.q);
r = await call('POST', '/mymismo/trivia/champ/answer', { tok: pat, body: { cell: '2-1', choice: (d.choices.indexOf(cq2.choices[cq2.answer]) + 1) % 4 } }); d = J(r);
ok('champ: wrong adds 0', d.right === false && d.points === 0 && d.total === 1000, d);
T += 16 * 60000;
r = await call('POST', '/mymismo/trivia/champ/pick', { tok: pat, body: { cell: '3-0' } }); ok('champ: the clock runs on the server; refused after time', r.statusCode === 409 && J(r).error === 'TIME');
r = await call('POST', '/mymismo/trivia/champ/start', { tok: sam, body: {} }); d = J(r); ok('champ: another finalist starts on their own phone', r.statusCode === 200);
T = Date.parse(CLOSES) - 60000;
r = await call('POST', '/mymismo/trivia/champ/start', { tok: alex, body: {} }); d = J(r);
ok('champ: a late start ends when the window closes', r.statusCode === 200 && d.left === 60000, d);
T = Date.parse(CLOSES) + 1000;
r = await call('GET', '/mymismo/trivia/champ'); d = J(r);
ok('champ: standings after the window closes', d.open === false && d.standings && d.standings[0].name === 'Pat L.' && d.standings[0].total === 1000 && d.standings.length === 3, d);
r = await call('POST', '/mymismo/trivia/champ/start', { tok: sam, body: {} }); ok('champ: closed', r.statusCode === 409);

/* deleting an account */
r = await call('POST', '/mymismo/trivia/delete', { tok: sam, body: {} });
const samGone = !JSON.stringify(file('trivia/players.json')).includes('Sam R.') && !JSON.stringify(file('trivia/board-2027-01.json')).includes('Sam R.') && !JSON.stringify(file('trivia/board-2027-02.json')).includes('Sam R.');
ok('delete: name and scores removed', r.statusCode === 200 && samGone);

/* nothing secret in the repository files a page could read */
const all = JSON.stringify(Object.fromEntries(Object.entries(repo).filter(([k]) => k.startsWith('Org/MyMismoData:trivia/') && !k.endsWith('questions.json')).map(([k, v]) => [k, v.at(-1).data])));
ok('no email address saved anywhere', !all.includes('@example.org'));

/* app store rules for attendees: report, delete, word filter (Apple 1.2 and 5.1.1(v), Google Play user data policy) */
T = realNow();
const FIRST = new Date(T + 17 * 86400000).toISOString().slice(0, 10), LAST = new Date(T + 20 * 86400000).toISOString().slice(0, 10);
put('Org/SummitData:data/feed-mymismo-attendees.json', { updated: new Date(T).toISOString(), summits: { nola: { name: '2027 Winter Summit', first: FIRST, last: LAST, people: [
  { e: 'pat@lender.example', first: 'Pat', last: 'Lee', company: 'Lender Co', title: 'CTO' }, { e: 'alex@vendor.example', first: 'Alex', last: 'Kim', company: 'Vendor LLC', title: 'Engineer' }] } } });
setProjects({ ...ENTRY, trivia: true, attendees: true, attendeeFeed: { repo: 'Org/SummitData', path: 'data/feed-mymismo-attendees.json' }, blockedWords: ['frobnicate'] });
__resetMyMismoLimits();
async function attIn(email, ip) {
  await call('POST', '/mymismo/att/code', { body: { email, summit: 'nola', startedAt: T - 9000 }, ip });
  return J(await call('POST', '/mymismo/att/verify', { body: { email, summit: 'nola', code: codeFor(email) }, ip }));
}
const ap = await attIn('pat@lender.example', '203.0.113.60'), aa = await attIn('alex@vendor.example', '203.0.113.61');
ok('attendees signed in', !!(ap.token && aa.token), [ap, aa]);
await call('PUT', '/mymismo/att/profile', { tok: ap.token, body: { listed: true } });
await call('PUT', '/mymismo/att/profile', { tok: aa.token, body: { listed: true } });
r = await call('POST', '/mymismo/att/message', { tok: ap.token, body: { to: aa.me.id, text: 'Good to meet you at the panel.' } });
ok('message: ordinary words go through', r.statusCode === 200, J(r));
r = await call('POST', '/mymismo/att/message', { tok: aa.token, body: { to: ap.me.id, text: 'What the F-U-C-K, fuck this' } });
ok('filter: profanity in a message is refused', r.statusCode === 400 && J(r).error === 'NOT_ALLOWED_WORDS', J(r));
r = await call('PUT', '/mymismo/att/profile', { tok: aa.token, body: { about: 'I frobnicate loans.' } });
ok('filter: MISMO’s own blockedWords apply to profiles', r.statusCode === 400 && J(r).error === 'NOT_ALLOWED_WORDS', J(r));
r = await call('PUT', '/mymismo/att/profile', { tok: aa.token, body: { about: 'Scunthorpe classic assessment' } });
ok('filter: whole words only (no false alarms inside other words)', r.statusCode === 200, J(r));
r = await call('POST', '/mymismo/att/report', { tok: ap.token, body: { id: aa.me.id, reason: 'harassment', note: 'Rude messages' } });
const reps = file('att/nola/reports.json');
ok('report: kept for the MISMO team', r.statusCode === 200 && reps.reports.length === 1 && reps.reports[0].reason === 'harassment' && reps.reports[0].status === 'open', reps);
r = await call('POST', '/mymismo/att/report', { tok: ap.token, body: { id: ap.me.id } }); ok('report: can’t report yourself', r.statusCode === 400);
await call('POST', '/mymismo/att/block', { tok: ap.token, body: { id: aa.me.id, on: true } });
r = await call('POST', '/mymismo/att/delete', { tok: aa.token, body: {} });
const ppl = file('att/nola/people.json').docs, msgs = file('att/nola/messages.json').docs;
ok('delete: profile, conversations and blocks naming them are gone (only a hidden marker stays)', r.statusCode === 200 && Object.keys(ppl[aa.me.id]).sort().join() === 'at,deleted,hidden' && Object.values(msgs).every(t => !t.p.includes(aa.me.id)) && !(ppl[ap.me.id].blocked || []).includes(aa.me.id), { ppl, msgs });
r = await call('GET', '/mymismo/att/me', { tok: aa.token }); ok('delete: their old sign-in no longer works', r.statusCode === 401);

/* directory from the registration list, headshots and contact details */
r = await call('GET', '/mymismo/att/directory', { tok: ap.token }); d = J(r);
ok('directory: a deleted attendee no longer shows, even though still registered', r.statusCode === 200 && !d.people.some(x => x.name === 'Alex Kim'), d);
const PNG = 'data:image/png;base64,' + Buffer.from('x'.repeat(300)).toString('base64');
r = await call('PUT', '/mymismo/att/my-photo', { tok: ap.token, body: { data: PNG } }); d = J(r);
ok('photo: saved, and the profile says it has one', r.statusCode === 200 && d.me.photo > 0, d);
r = await call('PUT', '/mymismo/att/my-photo', { tok: ap.token, body: { data: 'javascript:alert(1)' } }); ok('photo: anything but an image is refused', r.statusCode === 400);
r = await call('PUT', '/mymismo/att/my-photo', { tok: ap.token, body: { data: 'data:image/png;base64,' + 'A'.repeat(170000) } }); ok('photo: too large is refused', r.statusCode === 413);
r = await call('PUT', '/mymismo/att/profile', { tok: ap.token, body: { phone: '+1 (202) 555-0100', website: 'https://lender.example', showEmail: true } }); d = J(r);
ok('contact details: phone, website and showing their email are saved', r.statusCode === 200 && d.me.phone === '+1 (202) 555-0100' && d.me.website === 'https://lender.example' && d.me.showEmail === true, d);
r = await call('PUT', '/mymismo/att/profile', { tok: ap.token, body: { phone: 'call me maybe' } }); ok('contact details: a phone with letters is refused', r.statusCode === 400);
const at2 = await attIn('alex@vendor.example', '203.0.113.62');
ok('a deleted attendee can sign in again as a new account', !!at2.token && at2.me.listed === true, at2);
r = await call('GET', '/mymismo/att/directory', { tok: at2.token }); d = J(r); const patCard = d.people.find(x => x.name === "Pat Lee");
ok('directory: shows the email only because Pat chose to, with the phone, website and a photo version', patCard && patCard.email === "pat@lender.example" && patCard.phone && patCard.website && patCard.photo > 0, patCard);
r = await call('GET', '/mymismo/att/photo?id=' + ap.me.id, { tok: at2.token }); ok('photo: another signed-in attendee can see it', r.statusCode === 200 && J(r).s === PNG);
r = await call('GET', '/mymismo/att/photo?id=' + ap.me.id); ok('photo: nobody signed out can', r.statusCode === 401);
await call('PUT', '/mymismo/att/profile', { tok: ap.token, body: { listed: false } });
r = await call('GET', '/mymismo/att/photo?id=' + ap.me.id, { tok: at2.token }); ok('photo: hidden once they hide themselves', r.statusCode === 404);
r = await call('POST', '/mymismo/trivia/verify', { body: { email: 'z@example.org', code: '123456', first: 'Fuck', last: 'X' } });
ok('filter: trivia names too', r.statusCode === 400 && J(r).error === 'NOT_ALLOWED_WORDS');

/* the MISMO team sees reports (staff sign-in, alertSenders only) */
put('Org/Accounts:access.json', { people: { 'jc@example.org': { name: 'Jonna C', access: { mymismo: 'admin' }, group: 'staff' } } });
setProjects({ ...ENTRY, trivia: true, attendees: true, attendeeFeed: { repo: 'Org/SummitData', path: 'data/feed-mymismo-attendees.json' }, alertSenders: ['jc@example.org'] });
const { createHmac: hm } = await import('node:crypto');
const b64u = x => Buffer.from(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const staffTok = email => { const now = Math.floor(T / 1000) + 5; const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), bd = b64u(JSON.stringify({ sub: email, name: 'X', iat: now, exp: now + 3600 }));
  return head + '.' + bd + '.' + b64u(hm('sha256', process.env.AUTH_SECRET).update(head + '.' + bd).digest()); };
r = await call('GET', '/mymismo/staff/reports?summit=nola', { tok: ap.token }); ok('reports: an attendee can’t read them', r.statusCode === 403);
r = await call('GET', '/mymismo/staff/reports?summit=nola', { tok: staffTok('jc@example.org') }); d = J(r);
ok('reports: the MISMO team sees them with names', r.statusCode === 200 && d.reports.length === 1 && d.reports[0].byName === 'Pat Lee' && d.reports[0].aboutName === 'Alex Kim', d);
r = await call('POST', '/mymismo/staff/reports', { tok: staffTok('jc@example.org'), body: { summit: 'nola', id: d.reports[0].id, status: 'closed', action: 'Spoke with both.' } });
ok('reports: closing one is saved', r.statusCode === 200 && file('att/nola/reports.json').reports[0].status === 'closed');
r = await call('GET', '/mymismo/staff/reports', { tok: staffTok('jc@example.org') }); d = J(r);
ok('reports: with no summit, every summit’s (for Team HQ), with the open count', r.statusCode === 200 && d.reports.length === 1 && d.reports[0].summit === 'nola' && d.open === 0, d);
Date.now = realNow;
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
