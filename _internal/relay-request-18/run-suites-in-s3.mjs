/* Relay request 18: runs requests 13 to 17's checks again with MYMISMO_BUCKET set, using a stand-in S3 kept in memory
 * (hot-store-for-tests.mjs), to show every route works the same with MyMISMO's live files in S3.
 * Run: node run-suites-in-s3.mjs  (next to index.mjs and the test files). */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const suites = ['test-mymismo.mjs', 'test-mymismo14.mjs', 'test-mymismo15.mjs', 'test-mymismo16.mjs', 'test-mymismo17.mjs', 'test-mymismo-final.mjs', 'test-mymismo-h2h.mjs'];
let bad = 0;
for (const t of suites) {
  let s = "import './hot-store-for-tests.mjs';\n" + readFileSync(t, 'utf8');
  s = s.replace(/^(const \{[^}]*\} = await import\('\.\/index\.mjs'\);)$/m, "$1\nprocess.env.MYMISMO_BUCKET = 'test'; (await import('./index.mjs')).__setHotStore(globalThis.__hotStore, 'Org/MyMismoData');");
  /* the checks that look inside the stored files read S3 first */
  s = s.replace(/^const file = p => \{ (.*) \};$/m, 'const file = p => globalThis.__hotFile(p, p => { $1 });');
  s = s.replace(/^const file = \(p, r = 'Org\/MyMismoData'\) => \{ (.*) \};$/m, "const file = (p, r = 'Org/MyMismoData') => r === 'Org/MyMismoData' ? globalThis.__hotFile(p, p => { $1 }) : (repo[r + ':' + p] ? repo[r + ':' + p].at(-1).data : null);");
  s = s.replace(/^const checkins = \(\) => .*$/m, "const checkins = () => globalThis.__hotFile('scan/nola/checkins.json', () => ({ docs: {} }));");
  const f = 's3-' + t; writeFileSync(f, s);
  try { const out = execFileSync('node', [f], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); console.log(t + ': ' + out.trim().split('\n').at(-1)); }
  catch (e) { bad++; console.log(t + ': FAILED\n' + String(e.stdout || '').split('\n').filter(l => l.startsWith('FAIL')).join('\n')); }
  rmSync(f);
}
process.exit(bad ? 1 : 0);
