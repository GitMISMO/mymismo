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
/* plays a Head to Head board: right on the first n squares (the 200s across, then the 400s), wrong on the next w, then ends it */
const CELLS = [0, 1, 2, 3, 4].flatMap(rw => [0, 1, 2, 3, 4, 5].map(c => c + '-' + rw));
async function play(tok, game, right, ms = 3000, wrong = 0) {
  let last;
  for (let i = 0; i < right + wrong; i++) {
    const q = J(await call('POST', '/mymismo/trivia/play/pick', { tok, body: { cell: CELLS[i], game } })), real = bank.get(q.q), good = q.choices.indexOf(real.choices[real.answer]); T += ms;
    last = J(await call('POST', '/mymismo/trivia/play/answer', { tok, body: { cell: CELLS[i], game, choice: i < right ? good : (good + 1) % 4 } }));
  }
  return { last: J(await call('POST', '/mymismo/trivia/play/end', { tok, body: { game } })) };
}
let r, d;
setProjects({ ...ENTRY, trivia: true });
T = Date.parse('2027-02-10T15:00:00Z');
const pat = (await signIn('pat@example.org', 'Pat', 'Lee', '203.0.113.31')).token, alex = (await signIn('alex@example.org', 'Alex', 'Kim', '203.0.113.32')).token;
const sam = (await signIn('sam@example.org', 'Sam', 'Ray', '203.0.113.33')).token, jo = (await signIn('jo@example.org', 'Jo', 'Day', '203.0.113.34')).token;
ok('four players signed in', pat && alex && sam && jo);
const H = (path, tok, body) => call(body === undefined && !/challenge|find|play|decline|contact/.test(path) ? 'GET' : 'POST', '/mymismo/trivia/h2h' + path, { tok, body: body || {} });
const month = () => file('trivia/board-2027-02.json');

/* finding someone to challenge */
r = await call('GET', '/mymismo/trivia/h2h/players?q=al', { tok: pat }); d = J(r);
ok('players: search by name finds Alex K.', r.statusCode === 200 && d.players.length === 1 && d.players[0].name === 'Alex K.', d);
r = await call('GET', '/mymismo/trivia/h2h/players?q=pa', { tok: pat }); ok('players: never yourself', J(r).players.length === 0);
r = await call('GET', '/mymismo/trivia/h2h/players?q=al'); ok('players: sign-in needed', r.statusCode === 401);
const alexId = (J(await call('GET', '/mymismo/trivia/h2h/players?q=al', { tok: pat }))).players[0].id;

/* Trivia contacts (Jonna, Nov 26, 2026): you can challenge someone once they've accepted you as a contact */
r = await H('/challenge', pat, { to: alexId }); ok('contacts: no challenge before Alex is a contact', r.statusCode === 403 && J(r).error === 'NOT_A_CONTACT', J(r));
r = await H('/contact', pat, { to: alexId, action: 'add' }); ok('contacts: Pat adds Alex (a request)', r.statusCode === 200 && J(r).state === 'sent', J(r));
d = J(await H('', alex)); const patId = d.requests[0] && d.requests[0].id;
ok('contacts: Alex sees Pat’s request', d.requests.length === 1 && d.requests[0].name === 'Pat L.' && d.contacts.length === 0, d);
d = J(await H('', pat)); ok('contacts: Pat sees it as sent', d.sent.length === 1 && d.sent[0].name === 'Alex K.');
r = await H('/challenge', pat, { to: alexId }); ok('contacts: still no challenge until Alex accepts', r.statusCode === 403);
r = await H('/contact', pat, { to: alexId, action: 'accept' }); ok('contacts: Pat can’t accept his own request', r.statusCode === 409);
r = await H('/contact', alex, { to: patId, action: 'accept' }); ok('contacts: Alex accepts', r.statusCode === 200 && J(r).state === 'ok');
d = J(await H('', pat)); ok('contacts: now they’re each other’s contacts', d.contacts.length === 1 && d.contacts[0].id === alexId && J(await H('', alex)).contacts[0].id === patId);
const samId = (J(await call('GET', '/mymismo/trivia/h2h/players?q=sa', { tok: pat }))).players[0].id;
r = await H('/contact', sam, { to: alexId, action: 'add' }); r = await H('/contact', alex, { to: J(await H('', alex)).requests[0].id, action: 'add' });
ok('contacts: adding someone who already asked you makes you contacts', J(r).state === 'ok' && J(await H('', sam)).contacts.length === 1, J(r));
r = await H('/contact', jo, { to: patId, action: 'add' }); r = await H('/contact', pat, { to: J(await H('', pat)).requests[0].id, action: 'decline' });
ok('contacts: Pat declines Jo; it’s gone for both', r.statusCode === 200 && J(await H('', jo)).sent.length === 0 && J(await H('', pat)).requests.length === 0);
r = await H('/contact', pat, { to: 'ffffffffffffffff', action: 'add' }); ok('contacts: only real players', r.statusCode === 404);
r = await H('/contact', pat, { to: alexId, action: 'wave' }); ok('contacts: an unknown action is refused', r.statusCode === 400);

/* Challenge Someone: Pat plays the board first, then it's Alex's turn on the same board */
r = await H('/challenge', pat, { to: alexId }); d = J(r);
ok('challenge: starts Pat’s board straight away', r.statusCode === 200 && d.game && d.opponent === 'Alex K.' && d.second === false && d.cats.length === 6 && d.squares === 30 && !r.body.includes('Hard '), d);
const g1 = d.game, gdoc = file('trivia/h2h.json').docs[g1];
ok('challenge: a full Board (Hard), one Double square', Object.keys(gdoc.board.cells).length === 30 && Object.values(gdoc.board.cells).filter(x => x.dbl).length === 1);
d = J(await H('', alex)); ok('challenge: Alex doesn’t see it while Pat is still playing', d.games.length === 0, d);
r = await call('POST', '/mymismo/trivia/play/start', { tok: pat, body: { game: g1 } }); ok('board: a game’s board starts from the game, not /play/start', r.statusCode === 400);
r = await call('POST', '/mymismo/trivia/play/pick', { tok: alex, body: { cell: '0-0', game: g1 } }); ok('board: not Alex’s turn yet', r.statusCode === 409);
r = await call('POST', '/mymismo/trivia/play/pick', { tok: pat, body: { cell: '0-0', game: g1 } }); d = J(r);
ok('board: Pat opens a square of the game’s board', r.statusCode === 200 && d.value === 200 && d.choices.length === 4 && !('answer' in d), d);
r = await call('POST', '/mymismo/trivia/play/pick', { tok: pat, body: { cell: '0-0' } }); ok('board: the game’s board is separate from Pat’s leaderboard board', r.statusCode === 409 && J(r).error === 'NOT_STARTED');
let fin = await play(pat, g1, 7, 4000);
ok('challenge: Pat’s score is in, the game is waiting for Alex', fin.last.done && fin.last.h2h && fin.last.game.state === 'waiting' && fin.last.game.you.right === 7, fin.last);
ok('challenge: a Head to Head board never goes on the leaderboard', !month(), month());
d = J(await H('', alex)); const g1a = d.games.find(x => x.id === g1);
ok('challenge: now it’s Alex’s turn, without Pat’s score showing', g1a && g1a.state === 'your-turn' && g1a.opponent === 'Pat L.' && !g1a.them && d.yourTurn === 1, d);
r = await H('/play', sam, { game: g1 }); ok('challenge: only Alex can play it', r.statusCode === 404);
r = await H('/play', alex, { game: g1 }); d = J(r);
ok('challenge: Alex gets the game’s board', r.statusCode === 200 && d.second === true && d.opponent === 'Pat L.' && d.squares === 30, d);
const alexPlay = file('trivia/plays.json').docs[Object.keys(file('trivia/plays.json').docs).find(k => k.endsWith(':' + g1))];
ok('challenge: the same squares, questions and Double square for both', JSON.stringify(alexPlay.cells) === JSON.stringify(gdoc.board.cells));
r = await H('/play', alex, { game: g1 }); ok('challenge: starting again doesn’t give a fresh board', r.statusCode === 409);
r = await call('GET', '/mymismo/trivia/play?game=' + g1, { tok: alex }); ok('board: Alex can pick up where he left off', J(r).active === true && J(r).squares === 30);
fin = await play(alex, g1, 9, 4000);
ok('challenge: higher score wins', fin.last.game.state === 'done' && fin.last.game.result === 'won' && fin.last.game.them.right === 7 && fin.last.game.you.right === 9, fin.last.game);
d = J(await H('', pat)); const g1p = d.games.find(x => x.id === g1);
ok('challenge: Pat sees the loss and both scores', g1p.result === 'lost' && g1p.you.right === 7 && g1p.them.right === 9 && d.tally.lost === 1, g1p);
r = await H('/play', alex, { game: g1 }); ok('challenge: can’t play it twice', r.statusCode === 409);

/* wrong answers take points away; a tie on points goes to whoever was quicker */
r = await H('/challenge', sam, { to: alexId }); const g2 = J(r).game; fin = await play(sam, g2, 4, 6000, 1);
r = await H('/play', alex, { game: g2 }); fin = await play(alex, g2, 4, 2000, 1);
const g2doc = file('trivia/h2h.json').docs[g2];
ok('wrong: a wrong answer takes the square’s value away', g2doc.aScore.total === 800 - 200 && g2doc.bScore.total === 600, g2doc);
ok('tie: same points, Alex answered faster, Alex wins', g2doc.winner === 'b' && g2doc.bScore.ms < g2doc.aScore.ms && fin.last.game.result === 'won', g2doc);
r = await H('/challenge', sam, { to: alexId }); const g2b = J(r).game; await play(sam, g2b, 2, 3000);
r = await H('/play', alex, { game: g2b }); await play(alex, g2b, 2, 3000);
ok('tie: same points at the same speed is a tie', file('trivia/h2h.json').docs[g2b].winner === 'tie');

/* declining; and no deadlines (Jonna, Nov 26, 2026) */
r = await H('/challenge', pat, { to: alexId }); const g3 = J(r).game; await play(pat, g3, 3, 3000);
r = await H('/decline', alex, { game: g3 }); ok('decline: Alex can say no', r.statusCode === 200 && file('trivia/h2h.json').docs[g3].status === 'declined');
d = J(await H('', pat)); ok('decline: Pat sees it was declined', d.games.find(x => x.id === g3).state === 'declined');
r = await H('/challenge', pat, { to: alexId }); const g4 = J(r).game; await play(pat, g4, 3, 3000);
T += 10 * 86_400_000;
d = J(await H('', alex)); ok('no deadline: ten days later the challenge is still Alex’s turn', d.games.find(x => x.id === g4).state === 'your-turn' && d.games.find(x => x.id === g4).expires === null);
r = await H('/play', alex, { game: g4 }); T += 2 * 86_400_000;
fin = await play(alex, g4, 2, 3000);
ok('no deadline: Alex accepts, plays days later and the game finishes', r.statusCode === 200 && fin.last.game && fin.last.game.state === 'done', fin.last);

/* Find Me an Opponent: nobody waiting, so Jo plays first and waits; Sam takes Jo's game */
r = await H('/find', jo); d = J(r); const g5 = d.game;
ok('find: nobody waiting, Jo plays first', r.statusCode === 200 && d.second === false && !d.opponent && d.squares === 30, d);
await play(jo, g5, 6, 3000);
d = J(await H('', jo)); ok('find: Jo’s game waits for anyone', d.games.find(x => x.id === g5).state === 'waiting' && file('trivia/h2h.json').docs[g5].status === 'open');
d = J(await H('', sam)); ok('find: Sam is told a game is waiting', d.openGames === 1, d);
r = await H('/find', sam); d = J(r);
ok('find: Sam gets Jo’s game, against Jo', r.statusCode === 200 && d.game === g5 && d.second === true && d.opponent === 'Jo D.', d);
fin = await play(sam, g5, 4, 3000);
ok('find: Jo wins with the higher score', fin.last.game.result === 'lost' && J(await H('', jo)).games.find(x => x.id === g5).result === 'won');
r = await H('/find', jo); const g6 = J(r).game; await play(jo, g6, 6, 3000);
r = await H('/find', jo); d = J(r); ok('find: never matched with your own waiting game', d.game !== g6 && d.second === false, d);
T += 12 * 86_400_000;
d = J(await H('', jo)); ok('find: an open game keeps waiting, with no deadline', d.games.find(x => x.id === g6).state === 'waiting', d.games);

/* limits and leaving */
r = await H('/challenge', pat, { to: 'ffffffffffffffff' }); ok('challenge: only real players', r.statusCode === 404);
r = await H('/challenge', pat, {}); ok('challenge: someone has to be picked', r.statusCode === 400);
let lastR;
for (let i = 0; i < 11; i++) { lastR = await H('/challenge', pat, { to: alexId }); if (lastR.statusCode === 200) await play(pat, J(lastR).game, 1, 1000); }
ok('limit: 10 games waiting at most', lastR.statusCode === 429 && J(lastR).error === 'TOO_MANY_WAITING', J(lastR));
r = await H('/challenge', alex, { to: Object.keys(file('trivia/players.json').docs).find(k => file('trivia/players.json').docs[k].name === 'Sam R.') }); const gA = J(r).game;
r = await call('POST', '/mymismo/trivia/delete', { tok: alex, body: {} });
const docs = file('trivia/h2h.json').docs, plays = file('trivia/plays.json').docs;
ok('delete: Alex’s waiting games are gone; finished ones say "A former player"', r.statusCode === 200 && Object.values(docs).every(g => g.a !== alexId && g.b !== alexId)
  && docs[g1].bName === 'A former player' && !docs[gA] && !Object.values(docs).some(g => g.status === 'theirs' && g.bName === 'Alex K.'), docs[g1]);
ok('delete: Alex’s boards in progress are gone too', !Object.keys(plays).some(k => k.startsWith(alexId)));
ok('nothing secret saved: no email addresses in the games file', !JSON.stringify(docs).includes('@'));
const cts = file('trivia/contacts.json').docs;
ok('delete: Alex is off everyone’s Trivia contacts', !cts[alexId] && !Object.values(cts).some(m => m && m[alexId]), cts);
ok('nothing secret saved: no email addresses in the contacts file', !JSON.stringify(cts).includes('@'));
Date.now = realNow;
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
