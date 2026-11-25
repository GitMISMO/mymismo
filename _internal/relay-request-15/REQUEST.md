# Relay Request 15: MyMISMO Trivia Leaderboard and Quarterly Championship (for Perry)

Requested by Jonna, Nov 25, 2026. Builds on relay requests 13 and 14 (the same `mymismo` entry in projects.json and the
same private `GitMISMO/mymismo-data`). This is the plan; the patch and its tests follow the same pattern as request 14
once the one open question below is answered.

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
"Player" means a signed-in person (see the open question for who that is).

| Route | Sign-in | What it does |
| --- | --- | --- |
| `GET  /trivia/ready` | none | `{ ok, month: "2026-12", quarter: "2027-Q1", champ: { open, opens, closes, minutes } }` |
| `POST /trivia/round` | player | Starts a ranked round: 10 Hard questions, Mixed (every category at least once, none more than twice), the ones this player hasn't had first. Returns `{ round, count: 10, secs: 15 }`. One open round per player; starting a new one ends the old one as played. |
| `POST /trivia/next` | player | `{ round }` → the next question `{ n, cat, q, choices }` with the choices shuffled on the server. Records when it was handed out. |
| `POST /trivia/answer` | player | `{ round, n, choice }` → `{ right, answer, points, streak, total }`. Time = now minus when the question was handed out; past 15 seconds scores 0. A question can be answered once. |
| `GET  /trivia/board?month=` | none | Top 25 for the month: `{ rank, name, score, right }`, name shown as first name and last initial. With a player token, also `me: { rank, score }`. |
| `GET  /trivia/champ` | none | The quarter's three finalists (names as above), the window, and after it closes the final standings. |
| `POST /trivia/champ/start` | finalist | Only during the window, only once. Starts the clock (`minutes` from projects.json, e.g. 15). Returns the board: 6 categories × 5 values (200 to 1000), no questions yet. |
| `POST /trivia/champ/pick` | finalist | `{ cell }` → that square's question `{ q, choices }`. |
| `POST /trivia/champ/answer` | finalist | `{ cell, choice }` → `{ right, answer, points, total, left }`. Right adds the square's value; wrong adds 0. Refused once the clock has run out. |

## Scoring (the same as the app's test round)

A right answer is worth `floor((1 - (elapsed / 15) / 2) × 1000 × 2)` on Hard (between 1,000 and 2,000); two or more
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

## One Question for Jonna Before the Build

**Who can play ranked rounds?** Today MyMISMO only knows two kinds of signed-in people: MISMO staff and contractors
(MISMO Resources accounts) and summit attendees (request 13, only around a summit). For a year-round monthly board,
anyone in the MISMO community should be able to sign in. The simplest way is the same emailed six-digit code the
attendee sign-in uses (the code email Jonna already approved for MyMISMO), for any email address, with the name they give
shown as first name and last initial.
