# Relay Request 15: MyMISMO Trivia, and App Store Rules for Attendees (for Perry)

Requested by Jonna, Nov 25, 2026. Builds on relay requests 13 and 14 (the same `mymismo` entry in projects.json and the
same private `GitMISMO/mymismo-data`). The patch and its tests follow the same pattern as request 14.

## What Jonna Decided

- **Monthly leaderboard:** starts over on the 1st of every month (Eastern time). It ranks each player's **single best
  round**, and only **Hard rounds of Mixed questions** count.
- **Quarterly Championship:** the three monthly champions of the quarter play a harder Championship Board. If one person
  wins two months in the same quarter, **that later month's next-highest scorer** takes the spot.
- **How the championship is played:** each finalist plays on their own phone during a set championship window. **Once
  they start, a set time runs until they finish**: no pausing, no restarting, one try.
- The champion is recognized at the next MISMO Summit and gets a prize (MISMO handles both; nothing here).

## Why the Relay Has to Do It

The app's test round runs on the phone, with the answers in a public file. That is fine for practice and useless for a
leaderboard: anyone could read the answers or replay a round. For ranked rounds and the championship, the relay:

1. keeps the question bank, **with the answers, in the private `mymismo-data`** (`trivia/questions.json`), never in the app;
2. hands out **one question at a time** and times each answer **on the server**;
3. checks each answer and scores it, so the score on the board is the relay's, not the phone's;
4. keeps the championship clock on the server, from the moment a finalist starts.

## Routes

All under `/mymismo/trivia/`. Every route answers 404 until projects.json's `mymismo` entry has `"trivia": true`.
"Player" means someone signed in with an emailed code.

| Route | Sign-in | What it does |
| --- | --- | --- |
| `GET  /trivia/ready` | none | `{ ok, month: "2026-12", quarter: "2027-Q1", champ: { open, opens, closes, minutes } }` |
| `POST /trivia/round` | player | Starts a ranked round: 10 Hard questions, Mixed (every category at least once, none more than twice), the ones this player hasn't had first. Returns `{ round, count: 10, secs: 15 }`. One open round per player; starting a new one ends the old one as played. |
| `POST /trivia/next` | player | `{ round }` → the next question `{ n, cat, q, choices }` with the choices shuffled on the server. Records when it was handed out. |
| `POST /trivia/answer` | player | `{ round, n, choice }` → `{ right, answer, points, streak, total }`. Time = now minus when the question was handed out; past 15 seconds scores 0. A question can be answered once. |
| `GET  /trivia/board?month=` | none | Top 25 for the month: `{ rank, name, score, right }`, name shown as first name and last initial. With a player token, also `me: { rank, score }`. |
| `POST /trivia/code` | none | Emails a six-digit sign-in code to the address given (always the same answer, so it never says whether an address is known). |
| `POST /trivia/verify` | none | `{ email, code, first, last }` → a player token (180 days) and the name shown. |
| `POST /trivia/delete` | player | Deletes the player's account (see below). |
| `GET  /trivia/champ` | none | The quarter's three finalists (names as above), the window, and after it closes the final standings. |
| `POST /trivia/champ/start` | finalist | Only during the window, only once. Starts the clock (`minutes` from projects.json, e.g. 15). Returns the board: 6 categories × 5 values (200 to 1000), no questions yet. |
| `POST /trivia/champ/pick` | finalist | `{ cell }` → that square's question `{ q, choices }`. |
| `POST /trivia/champ/answer` | finalist | `{ cell, choice }` → `{ right, answer, points, total, left }`. Right adds the square's value; wrong adds 0. Refused once the clock has run out. |

## Scoring (the same as the app's test round)

A right answer is worth `floor((1 - (elapsed / 15) / 2) × 1000 × 2)`, with one second allowed for the network, on Hard (between 1,000 and 2,000); two or more
right in a row add 200; a wrong or late answer is 0. Championship squares are worth their face value.

## Where Things Live (all in the private `mymismo-data`)

- `trivia/questions.json` — the question bank: `{ questions: [{ id, cat, q, choices[4], answer, level, source, champ? }] }`.
  Jonna approves questions in her review doc; the approved set is copied here. `champ: true` marks championship-only questions.
- `trivia/rounds.json` — open rounds: `{ docs: { <round>: { p, ids[10], at[], picks[], total, streak, started } } }`;
  a round is removed once finished or after an hour.
- `trivia/board-<YYYY-MM>.json` — `{ docs: { <player>: { name, best, right, at, rounds } } }`: best round only.
- `trivia/seen.json` — `{ docs: { <player>: [question ids] } }`, so each player's rounds rotate through questions they haven't had.
- `trivia/champ-<YYYY-Qn>.json` — finalists (worked out from the three monthly boards with the runner-up rule), each
  finalist's start time, squares picked, answers and total.

## Settings in projects.json (`mymismo` entry)

```
"trivia": true,
"triviaChamp": { "quarter": "2027-Q1", "opens": "2027-04-05T13:00:00Z", "closes": "2027-04-12T04:00:00Z", "minutes": 15 }
```

## Limits (per running copy)

Rounds: 30 an hour per player. Answers: 600 an hour per player. Board reads: 600 an hour from one address.

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
| `GET  /staff/reports?summit=` | staff (alertSenders) | The reports, newest first, with names. Summit HQ shows them (CN-040). |
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

## What's Here

- `relay-request-15-mymismo-trivia.patch`: the change to `_dev/aws/index.mjs`, on top of requests 13 and 14. It adds one
  block (all names start `mm15`) and one routing line. Nothing shared is changed.
- `test-mymismo.mjs`: request 13's test, with the directory checks updated to the new rule. Replace the old copy with this one.
- `test-mymismo15.mjs`: 81 checks with a stand-in GitHub and mail flow and made-up people and questions. Run
  `node test-mymismo15.mjs` next to index.mjs. Requests 13 and 14's tests and test-relay.mjs still pass.

## To Switch It On

1. Deploy the patch. Nothing changes until step 3.
2. Put the approved Hard questions in `mymismo-data/trivia/questions.json` (MyMISMO's Claude does this from Jonna's review doc).
3. Add `"trivia": true` to the `mymismo` entry in projects.json. Add `triviaChamp` once the first championship's window is set.
4. Tell MyMISMO's Claude it's live (a Change Notice for MyMISMO) so the app switches from the test round to ranked rounds.
