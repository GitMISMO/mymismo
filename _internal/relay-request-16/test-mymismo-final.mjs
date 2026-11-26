/* MyMISMO Trivia: the round clock and the Final Square (relay request 16). Run: node test-mymismo-final.mjs.
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
const FINALS = [{ id: 'f1', cat: 'Mortgage', clue: 'This agency directs the Uniform Mortgage Data Program.', answers: ['federal housing finance agency', 'fhfa'], response: 'What is the Federal Housing Finance Agency (FHFA)?', source: 'https://example.org/f' }, { id: 'f2', cat: 'Certs', clue: 'This score passes the made-up exam.', answers: ['75', '75 percent'], response: 'What is 75%?', source: 'https://example.org/f' }];
put('Org/MyMismoData:trivia/questions.json', { questions: QS, finals: FINALS });
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
const sam = (await signIn('sam@example.org', 'Sam', 'Ray', '203.0.113.33')).token, jo = (await signIn('jo@example.org', 'Jo', 'Day', '203.0.113.34')).token;
const P = (step, tok, body = {}) => call('POST', '/mymismo/trivia/play/' + step, { tok, body });
const pickRight = async (tok, cell, game) => { const q = J(await P('pick', tok, { cell, game })); const real = bank.get(q.q); return J(await P('answer', tok, { cell, game, choice: q.choices.indexOf(real.choices[real.answer]) })); };
let r, d;
setProjects({ ...ENTRY, trivia: true });
T = Date.parse('2027-02-10T15:00:00Z');
const pat = (await signIn('pat@example.org', 'Pat', 'Lee', '203.0.113.31')).token, alex = (await signIn('alex@example.org', 'Alex', 'Kim', '203.0.113.32')).token;
ok('two players signed in', pat && alex);

/* the round clock */
r = await P('start', pat); d = J(r); ok('start: the board has a 4-minute round clock', r.statusCode === 200 && d.roundLeft > 239000 && d.roundLeft <= 243000 && d.phase === 'board', d);
ok('start: the Final Square is picked with the board, and its answers never leave the relay', !!file('trivia/plays.json').docs[Object.keys(file('trivia/plays.json').docs)[0]].final && !r.body.includes('fhfa') && !r.body.includes('What is 75'));
d = await pickRight(pat, '0-0'); T += 2000; ok('board: a right answer still scores 200', d.right && d.total === 200, d);
r = await P('wager', pat, { wager: 100 }); ok('final: no wagering before the board is over', r.statusCode === 409 && J(r).error === 'NOT_FINAL');
T += 4 * 60_000 + 5_000;
r = await P('pick', pat, { cell: '1-0' }); d = J(r);
ok('round: after 4 minutes no new square opens; it’s the Final Square', r.statusCode === 200 && d.roundOver && d.final && d.final.cat && d.final.max === 200 && !d.q, d);
r = await P('pick', pat, { cell: '1-0' }); ok('round: still no new squares', r.statusCode === 409 && J(r).error === 'FINAL');
r = await call('GET', '/mymismo/trivia/play', { tok: pat }); d = J(r); ok('resume: the app sees the Final Square is next', d.phase === 'final' && d.final.max === 200 && d.final.wager === null, d);

/* the Final Square */
const fin1 = file('trivia/plays.json').docs[Object.keys(file('trivia/plays.json').docs).find(k => !k.includes(':'))], F1 = FINALS.find(f => f.id === fin1.final);
r = await P('wager', pat, { wager: 5000 }); d = J(r);
ok('final: the wager is capped at the score; the answer comes after it', r.statusCode === 200 && d.wager === 200 && d.clue === F1.clue && d.secs === 30, d);
r = await P('wager', pat, { wager: 50 }); ok('final: the wager can’t change once locked in', r.statusCode === 409);
T += 12_000;
r = await P('say', pat, { text: F1.id === 'f1' ? 'What is the FHFA?' : 'what is 75%' }); d = J(r);
ok('final: a right question adds the wager; the board is done and scored', r.statusCode === 200 && d.right && d.points === 200 && d.total === 400 && d.done && d.response === F1.response, d);
const month = file('trivia/board-2027-02.json'); ok('leaderboard: the best Board includes the Final Square', month && Object.values(month.docs)[0].best === 400, month);

/* wrong, late, and starting at zero */
await P('start', pat); T += 1000;
const q0 = J(await P('pick', pat, { cell: '0-0' })), real0 = bank.get(q0.q);
await P('answer', pat, { cell: '0-0', choice: (q0.choices.indexOf(real0.choices[real0.answer]) + 1) % 4 }); T += 1000;
r = await P('end', pat); d = J(r); ok('end game: at −200 it’s still the Final Square, wager up to 1,000', r.statusCode === 200 && !d.done && d.final.max === 1000, d);
r = await P('wager', pat, { wager: 1000 }); T += 31_500;
r = await P('say', pat, { text: 'anything at all' }); d = J(r); ok('final: too late counts as wrong and takes the wager away', d.late && !d.right && d.points === -1000 && d.total === -1200, d);
await P('start', pat); T += 1000; await pickRight(pat, '0-0'); r = await P('end', pat); r = await P('skip', pat); d = J(r);
ok('final: skipping it ends the board as it stands', r.statusCode === 200 && d.done && d.finalSkipped && d.total === 200, d);
await P('start', pat); T += 1000; r = await P('end', pat); d = J(r); ok('a board with no squares played has no Final Square', d.done && !d.final, d);

/* Head to Head: the same Final Square for both */
const alexId = J(await call('GET', '/mymismo/trivia/h2h/players?q=al', { tok: pat })).players[0].id;
await call('POST', '/mymismo/trivia/h2h/contact', { tok: pat, body: { to: alexId, action: 'add' } });
const patId = J(await call('GET', '/mymismo/trivia/h2h', { tok: alex })).requests[0].id;
await call('POST', '/mymismo/trivia/h2h/contact', { tok: alex, body: { to: patId, action: 'accept' } });
r = await call('POST', '/mymismo/trivia/h2h/challenge', { tok: pat, body: { to: alexId } }); const g = J(r).game;
const gFinal = file('trivia/h2h.json').docs[g].board.final;
await pickRight(pat, '0-0', g); r = await P('end', pat, { game: g }); r = await P('wager', pat, { game: g, wager: 0 }); const patClue = J(r).clue;
r = await P('say', pat, { game: g, text: 'no idea' }); d = J(r); ok('h2h: Pat’s board is recorded after the Final Square', d.done && d.h2h && d.game.state === 'waiting', d);
await call('POST', '/mymismo/trivia/h2h/play', { tok: alex, body: { game: g } });
await pickRight(alex, '0-0', g); await P('end', alex, { game: g }); r = await P('wager', alex, { game: g, wager: 100 });
ok('h2h: Alex gets the same Final Square', J(r).clue === patClue && !!gFinal);
const FG = FINALS.find(f => f.id === gFinal);
r = await P('say', alex, { game: g, text: FG.answers[0] }); d = J(r);
ok('h2h: highest total after the Final Square wins', d.done && d.game.state === 'done' && d.game.result === 'won' && d.total === 300, d);

/* the typed-question checks */
const { mm16FinalRight } = await import('./index.mjs');
const C = [['What is the FHFA?', ['federal housing finance agency', 'fhfa'], true], ['federal housing finance agncy', ['federal housing finance agency'], true], ['HUD', ['fhfa'], false],
  ['What is 75%?', ['75', '75 percent'], true], ['76', ['75'], false], ['175', ['75'], false], ['', ['x'], false]];
ok('checking: "What is" optional, small slips fine, numbers exact', C.every(([t, a, w]) => mm16FinalRight(t, a) === w));
Date.now = realNow;
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
