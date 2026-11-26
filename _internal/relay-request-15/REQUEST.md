# Relay Request 15: MyMISMO Trivia (the Board Leaderboard and Head to Head), and App Store Rules for Attendees (for Perry)

Requested by Jonna, Nov 25, 2026. Builds on relay requests 13 and 14 (the same `mymismo` entry in projects.json and the
same private `GitMISMO/mymismo-data`). The patch and its tests follow the same pattern as request 14.

## What Jonna Decided

Updated Nov 25, 2026 (evening): Easy and Medium are 10 questions against the clock, and **Hard is played on the
Board**. What used to be request 16 (Head to Head) is folded in here, so this is the one trivia request.

- **Monthly leaderboard = the Board.** It starts over on the 1st of every month (Eastern time) and ranks each player's
  **single best Board** of the month.
- **The Board:** six categories, five squares each (200 to 1,000; the 200s and 400s lean on Medium questions, 600 up on
  Hard). A right answer adds the square's value, **a wrong answer takes it away**, and letting the 20-second clock run
  out costs nothing. **One hidden square of 600 or more counts double.** The board ends when every square is played or
  the player ends it.
- **Head to Head is Hard only, so it's played on the Board** (Jonna, Nov 26, 2026). Two players get **the same board**:
  the same 30 squares, the same questions, the same Double square, picked in any order. **Highest board score wins**; a
  tie on points goes to whoever spent less time answering. Nobody waits: whoever starts plays first, the other plays when they're
  ready. Two ways to start, the player's choice: **Challenge Someone** (pick a player by name; they have 48 hours to
  play or decline) or **Find Me an Opponent** (take the game that's waited longest, or play first and the next person
  who asks gets your game; an open game waits 7 days). **No computer opponent.** Head to Head never counts for the
  leaderboard.
- **Quarterly Championship: off for now.** The code is still here and stays off until a championship window is set
  (Team HQ or projects.json); the app no longer shows it.
- Nothing in trivia is emailed or pushed except the sign-in code. Head to Head shows Your Turn in the app.

## Why the Relay Has to Do It

The app's test round runs on the phone, with the answers in a public file. That is fine for practice and useless for a
leaderboard: anyone could read the answers or replay a round. For ranked rounds and the championship, the relay:

1. keeps the question bank, **with the answers, in the private `mymismo-data`** (`trivia/questions.json`), never in the app;
2. hands out **one question at a time** (one square at a time on the Board) and times each answer **on the server**;
3. checks each answer and scores it, so the score on the leaderboard is the relay's, not the phone's;
4. makes sure both Head to Head players get the same board, and decides the winner.

## Routes

All under `/mymismo/trivia/`. Every route answers 404 until projects.json's `mymismo` entry has `"trivia": true`.
"Player" means someone signed in with an emailed code.

| Route | Sign-in | What it does |
| --- | --- | --- |
| `GET  /trivia/ready` | none | `{ ok, month: "2026-12", quarter: "2027-Q1", board: { secs: 20, values }, headToHead: { secs: 20, count: 10 }, champ }` |
| `GET  /trivia/play` | player | The player's Board in progress (add `?game=` for a Head to Head board), to pick up where they left off: `{ active, cats, values, total, right, played: { cell: { right, points } }, open, left }`, or `{ active: false }`. |
| `POST /trivia/play/start` | player | Starts a Board: 6 categories × 5 values, the questions this player hasn't had first. Returns the board without questions. One board at a time; starting a new one scores an unfinished one first. |
| `POST /trivia/play/pick` | player | `{ cell }` (e.g. `"2-4"`: category 2, the 1,000 square) → `{ q, choices, value, double, left }`. Starts that square's 20-second clock; opening it again never restarts it. One open square at a time. |
| `POST /trivia/play/answer` | player | `{ cell, choice }` → `{ right, answer, points, late, total, done }`. Right +value, wrong −value, late or no answer 0. When every square is played: `saved`, `month`, `best`, `newBest`. |
| `POST /trivia/play/end` | player | Ends the board now; its score goes on the month's leaderboard if it's the player's best. |
| (Head to Head) | player | `pick`, `answer` and `end` take `{ game }` too, for that game's board. Its score goes to the game, never the leaderboard; the last answer (or `end`) comes back with `h2h: true` and the game as the player now sees it. |
| `GET  /trivia/board?month=` | none | Top 25 for the month: `{ rank, name, score, right }`, name shown as first name and last initial. With a player token, also `me: { rank, score }`. |
| `POST /trivia/code` | none | Emails a six-digit sign-in code to the address given (always the same answer, so it never says whether an address is known). |
| `POST /trivia/verify` | none | `{ email, code, first, last }` → a player token (180 days) and the name shown. |
| `POST /trivia/delete` | player | Deletes the player's account (see below). |
| `GET  /trivia/h2h` | player | The player's Head to Head games, newest first, each `{ id, mode, state, opponent, made, expires, you, them, result }`. `state`: `playing`, `waiting`, `your-turn`, `done`, `declined`, `expired`; the other player's score and `result` (`won`, `lost`, `tie`) only once both have played. Also `tally`, `yourTurn` and `openGames`. |
| `GET  /trivia/h2h/players?q=` | player | Up to 10 players whose name contains `q` (2 letters at least), never yourself. |
| `POST /trivia/h2h/challenge` | player | `{ to: <player id> }`: starts the challenger's board → `{ game, opponent, second: false, cats, values, ... }` (the board, without questions). |
| `POST /trivia/h2h/find` | player | Takes the open game that has waited longest (`second: true`, with the opponent's name), or starts a new open game. |
| `POST /trivia/h2h/play` | player | `{ game }`: the challenged player starts the same board (once; after that they pick up with `GET /trivia/play?game=`). Once started inside the 48 hours, they have 6 hours to finish. |
| `POST /trivia/h2h/decline` | player | `{ game }`: the challenged player says no. |
| `GET  /trivia/champ`, `POST /trivia/champ/start`, `/pick`, `/answer` | finalist | The Quarterly Championship, **off for now** (answers "not set" until a window is set). Unchanged from before. |

## Scoring

- **The Board:** the square's value (double on the Double square) for a right answer, minus it for a wrong one, 0 when
  the 20 seconds (plus one for the network) run out.
- **Head to Head:** the Board's scoring. The winner has the higher board total; a tie goes to the lower total time spent
  answering (each square counts from opening it to answering, 20 seconds at most).

## Where Things Live (all in the private `mymismo-data`)

- `trivia/questions.json` — the question bank: `{ questions: [{ id, cat, q, choices[4], answer, level, source, champ? }] }`.
  Jonna approves questions in her review doc; the approved set is copied here. `champ: true` marks championship-only questions.
- `trivia/plays.json` — Boards in progress: `{ docs: { <player>: {...}, "<player>:<game>": {...} } }`, each `{ start, cats, cells, picked, open, openAt, total, right, ms }`.
- `trivia/h2h.json` — Head to Head games, by game id: `{ a, aName, b, bName, mode, board: { cats, cells }, made, exp, bStarted, aScore, bScore, status, winner }`.
  Waiting games expire on read (48 hours for a challenge, 7 days for an open game); finished ones are kept 30 days.
- `trivia/board-<YYYY-MM>.json` — `{ docs: { <player>: { name, best, right, at, rounds } } }`: best Board only.
- `trivia/seen.json` — `{ docs: { <player>: [question ids] } }`, so each player's boards rotate through questions they haven't had.
- `trivia/champ-<YYYY-Qn>.json` — finalists (worked out from the three monthly boards with the runner-up rule), each
  finalist's start time, squares picked, answers and total.

## Settings in projects.json (`mymismo` entry)

```
"trivia": true,
"triviaChamp": { "quarter": "2027-Q1", "opens": "2027-04-05T13:00:00Z", "closes": "2027-04-12T04:00:00Z", "minutes": 15 }
```

## Limits (per running copy)

Boards and Head to Head games started: 30 an hour per player. Answers and squares: 600 an hour per player. Leaderboard reads: 600 an hour from one address. At most 10 Head to Head games waiting on other players per person.

## Who Can Play (decided by Jonna, Nov 25, 2026)

**Anyone.** MyMISMO is for anyone to download, and it will be in the Apple App Store and Google Play. What's public on
mismo.org stays public in the app, and what needs a website sign-in today still needs one in the app. Trivia is new to
the app, so: practice rounds are open to everyone, and ranked rounds (the monthly board and the championship) need a
quick sign-in with a six-digit code emailed to the player. The board shows the name they give as first name and last
initial. No email address is kept anywhere except the code's hash for 15 minutes.

## Deleting an Account

Apple and Google require any app that lets people make an account to let them delete it from inside the app.
`POST /trivia/delete` (player) removes their name, their scores from the last 12 months and their question history.

## App Store and Google Play Rules for the Attendee Features (added Nov 25, 2026)

MyMISMO is going to the Apple App Store and Google Play. Both require, for an app where people make an account and
message each other (Apple App Review Guidelines 1.2 and 5.1.1(v); Google Play's User Data policy):

| Route | Sign-in | What it does |
| --- | --- | --- |
| `POST /att/delete` | attendee | Deletes the attendee's account: their directory entry, every conversation they were in, and blocks naming them. |
| `POST /att/report` | attendee | `{ id, reason, note }` → kept in `att/<summit>/reports.json` for the MISMO team. Reasons: harassment, spam, inappropriate, other. |
| `GET  /staff/reports[?summit=]` | staff (alertSenders) | The reports, newest first, with names and the open count; leave out summit for every summit. Team HQ shows them (CN-041). |
| `POST /staff/reports` | staff (alertSenders) | `{ summit, id, status, action }` closes or reopens a report with a note of what was done. |

**A word filter** now checks messages, profile fields and trivia names against a short built-in list of profanity plus
any words in the `mymismo` entry's `"blockedWords": [...]` in projects.json (MISMO can add words without a code change).
Whole words only, so ordinary words that contain them aren't caught.

Nothing is emailed by any of these. The checks are in the same test file (70 in all).

## The Attendee Directory Is the Registration List (decided by Jonna, Nov 25, 2026)

Like the MBA event app, everyone registered for the summit is in the directory with the name, title and company from
their registration, whether or not they have signed in yet. Anyone can hide themselves in their profile. This changes
request 13's rule (listed only if they turned it on); test-mymismo.mjs here is request 13's test with those checks updated.

| Route | Sign-in | What changes |
| --- | --- | --- |
| `GET /att/directory` | attendee | Everyone in the summit's attendee list (Summit HQ's feed), merged with the profiles people filled in; hidden people left out. Each entry has `joined` (signed in yet), `photo` (0 or a version), and phone, website and email only if that person chose to share them. |
| `PUT /att/profile` | attendee | Also takes `phone`, `website` and `showEmail`. `listed: false` hides the attendee (stored as `hidden: true`). |
| `PUT /att/my-photo` | attendee | `{ data }`: a headshot the app has already made into a 320-pixel square JPEG (150 KB at most), or '' to remove it. Kept at `att/<summit>/photos/<id>.json`. |
| `GET /att/photo?id=` | attendee | That person's headshot, for signed-in attendees only, never for someone hidden. |
| `POST /att/message` | attendee | Can start a conversation with anyone registered and not hidden; it waits for them until they sign in. |
| `POST /att/delete` | attendee | Removes everything and leaves only a hidden marker (no name or details), so their registration row doesn't show again. Signing in again later makes a fresh account. |

**MISMO staff are in Summit HQ's list twice** (Jonna, Nov 25, 2026): their registration, with their title, and the staff
roster, which says only "MISMO" with no title. When an entry that is just "MISMO" with no title has the same first and
last name as another entry, it isn't listed; signing in with that address signs in as the same person as their
registration (same directory entry and profile). Staff on the roster only are still listed.

## A Sign-In for the App Store Reviewers (approved by Jonna, Nov 25, 2026)

Apple and Google test every sign-in feature before they approve an app, but their reviewers can't read a MISMO inbox
for the emailed code. So the `mymismo` entry in projects.json can hold:

```
"reviewAccount": { "email": "appreview@mismo.org", "codeSha256": "<sha-256 hex of 'mymismo-review:' followed by a six-digit code>", "contacts": ["jcritchley@mismo.org"] }
```

For that one address: no email is sent; the fixed code signs in to any open summit and to trivia; the reviewer is hidden
from everyone; the reviewer's directory shows only the `contacts` and can message only them, so reviewers never see or
reach real attendees; and a reviewer's trivia rounds never go on the leaderboard. The address doesn't need a mailbox,
since nothing is ever sent to it. Pick the six-digit code with Jonna, put only its hash in projects.json, and give the code
itself only to Jonna for the review notes in App Store Connect and Play Console. Delete the entry to turn it off.

## MISMO Trivia in Team HQ (decided by Jonna, Nov 25, 2026)

Team HQ is MyMISMO's home for the MISMO team's year-round work (summit alerts stay in Summit HQ).

| Route | Sign-in | What it does |
| --- | --- | --- |
| `GET  /staff/trivia` | staff (alertSenders) | This month and the three before, with each month's top 10 (the #1 is that month's winner, for recognition); this quarter's and last quarter's finalists (with the runner-up rule) and, once played, the championship standings; and the championship dates. |
| `POST /staff/trivia` | staff (alertSenders) | `{ champ: { quarter, opens, closes, minutes } }` sets the championship (`champ: null` clears it). Kept in `trivia/settings.json` with who set it, and it wins over `triviaChamp` in projects.json, so nobody needs to edit projects.json for it. |

## What's Here

- `relay-request-15-mymismo-trivia.patch`: the change to `_dev/aws/index.mjs`, on top of requests 13 and 14. It adds one
  block (all names start `mm15`) and one routing line. Nothing shared is changed.
- `test-mymismo.mjs`: request 13's test, with the directory checks updated to the new rule. Replace the old copy with this one.
- `test-mymismo15.mjs`: 100 checks (sign-in, the Board, the leaderboard, the championship, attendees and app store rules) with a stand-in GitHub and mail flow and made-up people and questions. Run
  `node test-mymismo15.mjs` next to index.mjs.
- `test-mymismo-h2h.mjs`: 43 Head to Head checks (the shared board, scoring, challenges, Find Me an Opponent, ties,
  declining, expiry, limits, deleting an account, the app reviewers). Run `node test-mymismo-h2h.mjs` the same way.
  Requests 13 and 14's tests and test-relay.mjs still pass.

**Head to Head and deleting an account:** a player's waiting games are removed and finished ones show them as "A former
player". **The app reviewers** (below) can challenge and be matched only with the MISMO staff in `reviewAccount.contacts`,
and their open games are never offered to anyone else.

## To Switch It On

1. Deploy the patch. Nothing changes until step 3.
2. Put the approved Hard questions in `mymismo-data/trivia/questions.json` (MyMISMO's Claude does this from Jonna's review doc).
3. Add `"trivia": true` to the `mymismo` entry in projects.json. Add `triviaChamp` once the first championship's window is set.
4. Tell MyMISMO's Claude it's live (a Change Notice for MyMISMO) so the app switches from its beta boards to ranked ones.
