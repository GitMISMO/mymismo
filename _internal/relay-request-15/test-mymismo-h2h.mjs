/* MyMISMO Trivia Head to Head (relay request 15). Run: node test-mymismo-h2h.mjs.
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
CATS.forEach((c, i) => { for (let k = 0; k < 6; k++) QS.push({ id: `m${i}-${k}`, cat: c, q: `Medium ${c} ${k}?`, choices: ['A' + k, 'B' + k, 'C' + k, 'D' + k], answer: (k + 1) % 4, level: 2, source: 'https://example.org/s' }); });
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
async function play(tok, right, ms = 3000, rd) {
  rd = rd || J(await call('POST', '/mymismo/trivia/round', { tok, body: {} }));
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
setProjects({ ...ENTRY, trivia: true });
T = Date.parse('2027-02-10T15:00:00Z');
const pat = (await signIn('pat@example.org', 'Pat', 'Lee', '203.0.113.31')).token, alex = (await signIn('alex@example.org', 'Alex', 'Kim', '203.0.113.32')).token;
const sam = (await signIn('sam@example.org', 'Sam', 'Ray', '203.0.113.33')).token, jo = (await signIn('jo@example.org', 'Jo', 'Day', '203.0.113.34')).token;
ok('four players signed in', pat && alex && sam && jo);
const H = (path, tok, body) => call(body === undefined && !/challenge|find|play|decline/.test(path) ? 'GET' : 'POST', '/mymismo/trivia/h2h' + path, { tok, body: body || {} });
const board = () => file('trivia/board-2027-02.json');

/* finding someone to challenge */
r = await call('GET', '/mymismo/trivia/h2h/players?q=al', { tok: pat }); d = J(r);
ok('players: search by name finds Alex K.', r.statusCode === 200 && d.players.length === 1 && d.players[0].name === 'Alex K.', d);
r = await call('GET', '/mymismo/trivia/h2h/players?q=pa', { tok: pat }); ok('players: never yourself', J(r).players.length === 0);
r = await call('GET', '/mymismo/trivia/h2h/players?q=al'); ok('players: sign-in needed', r.statusCode === 401);
const alexId = (J(await call('GET', '/mymismo/trivia/h2h/players?q=al', { tok: pat }))).players[0].id;

/* Challenge Someone: Pat plays first, then it's Alex's turn */
r = await H('/challenge', pat, { to: alexId }); d = J(r);
ok('challenge: starts Pat’s round straight away', r.statusCode === 200 && d.round && d.game && d.opponent === 'Alex K.' && d.second === false, d);
const g1 = d.game, R1 = d.round, saved = file('trivia/rounds.json').docs[R1], cats = saved.ids.map(id => QS.find(q => q.id === id).cat);
let fin;
ok('round: 10 Medium questions, Mixed (every category, none more than twice)', saved.ids.length === 10 && saved.ids.every(id => QS.find(q => q.id === id).level === 2) && CATS.every(c => cats.includes(c) && cats.filter(x => x === c).length <= 2), cats);
d = J(await H('', alex)); ok('challenge: Alex doesn’t see it while Pat is still playing', d.games.length === 0, d);
r = await call('POST', '/mymismo/trivia/next', { tok: pat, body: { round: R1 } }); d = J(r);
ok('next: question without the answer, 20 seconds', r.statusCode === 200 && d.n === 0 && d.choices.length === 4 && !('answer' in d) && d.secs === 20 && !r.body.includes('example.org/s'), d);
const q0 = d, real0 = bank.get(q0.q); T += 4000;
d = J(await call('POST', '/mymismo/trivia/next', { tok: pat, body: { round: R1 } }));
ok('next: asking again never restarts the clock', d.n === 0 && d.left === 16000, d);
r = await call('POST', '/mymismo/trivia/answer', { tok: pat, body: { round: R1, n: 1, choice: 0 } }); ok('answer: can’t skip ahead', r.statusCode === 409);
r = await call('POST', '/mymismo/trivia/answer', { tok: pat, body: { round: R1, n: 0, choice: q0.choices.indexOf(real0.choices[real0.answer]) } }); d = J(r);
ok('answer: right in 4 seconds (3 after the network allowance) = 1,387', d.right === true && d.points === 1387 && d.done === false, d);
r = await call('POST', '/mymismo/trivia/answer', { tok: pat, body: { round: R1, n: 0, choice: 0 } }); ok('answer: once only', r.statusCode === 409);
const q1 = J(await call('POST', '/mymismo/trivia/next', { tok: pat, body: { round: R1 } })), real1 = bank.get(q1.q); T += 1000;
d = J(await call('POST', '/mymismo/trivia/answer', { tok: pat, body: { round: R1, n: 1, choice: q1.choices.indexOf(real1.choices[real1.answer]) } }));
ok('answer: two in a row adds 150, instant answer 1,500', d.points === 1650 && d.streak === 2, d);
const q2 = J(await call('POST', '/mymismo/trivia/next', { tok: pat, body: { round: R1 } })), real2 = bank.get(q2.q); T += 22000;
d = J(await call('POST', '/mymismo/trivia/answer', { tok: pat, body: { round: R1, n: 2, choice: q2.choices.indexOf(real2.choices[real2.answer]) } }));
ok('answer: past 20 seconds (plus 1) scores 0 even if right', d.right === false && d.points === 0 && d.late === true && d.streak === 0, d);
r = await call('POST', '/mymismo/trivia/next', { tok: alex, body: { round: R1 } }); ok('next: someone else’s round is refused', r.statusCode === 404);
for (let n = 3; n < 10; n++) {
  const q = J(await call('POST', '/mymismo/trivia/next', { tok: pat, body: { round: R1 } })), real = bank.get(q.q); T += 4000;
  fin = { last: J(await call('POST', '/mymismo/trivia/answer', { tok: pat, body: { round: R1, n: q.n, choice: n < 8 ? q.choices.indexOf(real.choices[real.answer]) : (q.choices.indexOf(real.choices[real.answer]) + 1) % 4 } })) };
}
ok('round: removed once finished', !file('trivia/rounds.json').docs[R1]);
ok('challenge: Pat’s score is in, the game is waiting for Alex', fin.last.done && fin.last.h2h && fin.last.game.state === 'waiting' && fin.last.game.you.total > 0, fin.last);
ok('challenge: a Head to Head round never goes on the leaderboard', !board(), board());
d = J(await H('', alex)); const g1a = d.games.find(x => x.id === g1);
ok('challenge: now it’s Alex’s turn, without Pat’s score showing', g1a && g1a.state === 'your-turn' && g1a.opponent === 'Pat L.' && !g1a.them && d.yourTurn === 1, d);
r = await H('/play', sam, { game: g1 }); ok('challenge: only Alex can play it', r.statusCode === 404);
r = await H('/play', alex, { game: g1 }); d = J(r);
ok('challenge: Alex gets the same game', r.statusCode === 200 && d.second === true && d.opponent === 'Pat L.', d);
const patIds = file('trivia/h2h.json').docs[g1].ids, alexRound = file('trivia/rounds.json').docs[d.round];
ok('challenge: the same 10 questions for both', JSON.stringify(alexRound.ids) === JSON.stringify(patIds));
fin = await play(alex, 9, 4000, { round: d.round });
ok('challenge: higher score wins', fin.last.game.state === 'done' && fin.last.game.result === 'won' && fin.last.game.them.right === 7, fin.last.game);
d = J(await H('', pat)); const g1p = d.games.find(x => x.id === g1);
ok('challenge: Pat sees the loss and both scores', g1p.result === 'lost' && g1p.you.right === 7 && g1p.them.right === 9 && d.tally.lost === 1, g1p);
r = await H('/play', alex, { game: g1 }); ok('challenge: can’t play it twice', r.statusCode === 409);

/* a tie on points goes to whoever was quicker */
r = await H('/challenge', sam, { to: alexId }); const g2 = J(r).game; await play(sam, 5, 2000, { round: J(r).round });
r = await H('/play', alex, { game: g2 }); fin = await play(alex, 5, 2000, { round: J(r).round });
const g2doc = file('trivia/h2h.json').docs[g2];
ok('tie: same answers at the same speed is a tie', g2doc.aScore.total === g2doc.bScore.total && g2doc.winner === 'tie' && fin.last.game.result === 'tie', g2doc);

/* declining, and running out of time */
r = await H('/challenge', pat, { to: alexId }); const g3 = J(r).game; await play(pat, 3, 3000, { round: J(r).round });
r = await H('/decline', alex, { game: g3 }); ok('decline: Alex can say no', r.statusCode === 200 && file('trivia/h2h.json').docs[g3].status === 'declined');
d = J(await H('', pat)); ok('decline: Pat sees it was declined', d.games.find(x => x.id === g3).state === 'declined');
r = await H('/challenge', pat, { to: alexId }); const g4 = J(r).game; await play(pat, 3, 3000, { round: J(r).round });
T += 49 * 3_600_000;
r = await H('/play', alex, { game: g4 }); ok('expiry: 48 hours to play a challenge', r.statusCode === 409 && J(r).error === 'NOT_YOUR_TURN', J(r));
d = J(await H('', pat)); ok('expiry: shows as expired', d.games.find(x => x.id === g4).state === 'expired');

/* Find Me an Opponent: nobody waiting, so Jo plays first and waits; Sam takes Jo's game */
r = await H('/find', jo); d = J(r); const g5 = d.game;
ok('find: nobody waiting, Jo plays first', r.statusCode === 200 && d.second === false && !d.opponent, d);
await play(jo, 6, 3000, { round: d.round });
d = J(await H('', jo)); ok('find: Jo’s game waits for anyone (7 days)', d.games.find(x => x.id === g5).state === 'waiting' && file('trivia/h2h.json').docs[g5].status === 'open');
d = J(await H('', sam)); ok('find: Sam is told a game is waiting', d.openGames === 1, d);
r = await H('/find', sam); d = J(r);
ok('find: Sam gets Jo’s game, against Jo', r.statusCode === 200 && d.game === g5 && d.second === true && d.opponent === 'Jo D.', d);
fin = await play(sam, 4, 3000, { round: d.round });
ok('find: Jo wins with the higher score', fin.last.game.result === 'lost' && J(await H('', jo)).games.find(x => x.id === g5).result === 'won');
r = await H('/find', jo); const g6 = J(r).game; await play(jo, 6, 3000, { round: J(r).round });
r = await H('/find', jo); d = J(r); ok('find: never matched with your own waiting game', d.game !== g6 && d.second === false, d);
T += 8 * 86_400_000;
d = J(await H('', jo)); ok('find: an open game nobody took expires after 7 days', d.games.find(x => x.id === g6).state === 'expired', d.games);

/* limits and leaving */
r = await H('/challenge', pat, { to: 'ffffffffffffffff' }); ok('challenge: only real players', r.statusCode === 404);
r = await H('/challenge', pat, {}); ok('challenge: someone has to be picked', r.statusCode === 400);
let lastR;
for (let i = 0; i < 11; i++) { lastR = await H('/challenge', pat, { to: alexId }); if (lastR.statusCode === 200) await play(pat, 1, 1000, { round: J(lastR).round }); }
ok('limit: 10 games waiting at most', lastR.statusCode === 429 && J(lastR).error === 'TOO_MANY_WAITING', J(lastR));
r = await call('POST', '/mymismo/trivia/delete', { tok: alex, body: {} });
const docs = file('trivia/h2h.json').docs;
ok('delete: Alex’s waiting games are gone; finished ones say "A former player"', r.statusCode === 200 && Object.values(docs).every(g => g.a !== alexId && g.b !== alexId)
  && docs[g1].bName === 'A former player' && !Object.values(docs).some(g => g.status === 'theirs' && g.bName === 'Alex K.'), docs[g1]);
ok('nothing secret saved: no email addresses in the games file', !JSON.stringify(docs).includes('@'));
Date.now = realNow;
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
