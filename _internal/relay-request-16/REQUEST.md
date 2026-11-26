# Relay Request 16: MISMO Matters and Mic'd Up Notifications in MyMISMO (for Perry)

Requested by Jonna, Nov 26, 2026. Builds on relay request 14 (MyMISMO alerts): the same `mymismo` entry in projects.json,
the same `push: true` switch, the same VAPID keys and `alertSenders`, and the same private `GitMISMO/mymismo-data`.
Apply requests 13, 14 and 15 first, then `relay-request-16-mymismo-news.patch`. No new settings and no new library.

## What Jonna Decided

- People can turn on a **second, separate** notification in MyMISMO's Settings: **MISMO Matters and Mic'd Up**. It's off
  until they turn it on, and they can turn it off there any time (Apple's guideline 4.5.4 and Google Play's notification
  policy: opt-in with clear wording, an in-app way out, and the app works the same without it).
- MISMO Media gets a **Push to MyMISMO** button on each published MISMO Matters edition and each Mic'd Up episode. The
  words are filled in for her and **she can edit them** before she sends. Nothing is ever sent unless a person presses it.
- A pushed Mic'd Up episode shows in the app's Mic'd Up list right away, without waiting for the website's 3-hourly job.

## Routes

| Route | Who | What |
|---|---|---|
| `POST /mymismo/push/subscribe` | none | Now `{ summit?, news?, sub }`: a summit's alerts, MISMO news (`news: true`), or both. Each keeps the other on the same phone. |
| `POST /mymismo/push/unsubscribe` | none | Now `{ endpoint, what? }`: `what: 'summit'` or `'news'` turns off just that one; without `what` the phone is removed, as before. |
| `POST /mymismo/push/news` | **staff**, `alertSenders` only | `{ kind: 'matters' or 'micdup', ref, title (80), body (300), url?, video?, again? }`. Sends to phones with news on, 50 at a time. `url` must be on www.mismo.org or resources.mismo.org. For `micdup`, `video: { id (the YouTube id, same as ref), title, published, duration }`. The same `kind` and `ref` a second time answers **409 ALREADY_SENT** with when, unless `again: true`. |
| `GET /mymismo/push/news` | none | The newest 20 pushes `{ id, kind, ref, title, body, url, video, at }`, never who sent them or how many got them. |

Summit alerts (`/push/send`) still go only to that summit's phones; a news-only phone never gets them.

## The Board: Answer First, Pick the Question

Jonna, Nov 26, 2026: the Board is played game-show style. Each square shows the answer (`clue`) and players pick the
question (`responses`, e.g. "What is the eNote?"). Questions in `trivia/questions.json` may now carry `clue` and
`responses` (four strings in the same order as `choices`); `/trivia/play/pick` passes them through, in the same
shuffled order as the choices. Scoring is unchanged (the same index is right). A question without them works as before.

## Head to Head: Trivia Contacts, and No Deadlines

Jonna, Nov 26, 2026: you challenge your **Trivia contacts**. Find a player by name and add them; once they accept, either
of you can challenge the other (`/trivia/h2h/challenge` answers 403 NOT_A_CONTACT otherwise). **No deadlines:** a challenge
waits until it's accepted and played (or declined), an open game waits until someone takes it, and a started board can be
finished later. The Board's own 20-second clock on each square is the only timer. Same board for both; highest score wins.

| Route | Who | What |
|---|---|---|
| `POST /mymismo/trivia/h2h/contact` | signed-in player | `{ to, action: 'add' or 'accept' or 'decline' or 'remove' }`. Adding someone who already asked you makes you contacts at once. Decline and remove are quiet and take it off both sides. At most 300 contacts and 50 requests waiting. |
| `GET /mymismo/trivia/h2h` | signed-in player | Now also `contacts`, `requests` (waiting for you) and `sent`, each `[{ id, name }]` (first name and last initial). `expires` is always null. |

Kept in `trivia/contacts.json` (`{ docs: { <player id>: { <other id>: { s: 'sent' or 'got' or 'ok', at } } } }`). Deleting a
trivia account takes the player off everyone's contacts. `test-mymismo-h2h.mjs` here replaces request 15's (56 checks).

## The Board: a Round Clock and the Final Square

Jonna, Nov 26, 2026. **Round clock:** a board has 6 minutes (plus 3 seconds while it lights up) to play as many squares
as you can; after that no new square opens (a square already open can still be answered). **Final Square:** when the
board is over (every square, End Game, or the clock), the player sees the category, wagers up to their total (up to
1,000 at zero or below), gets the answer, and has 30 seconds to type the question. Right adds the wager; wrong, blank or
late takes it away. The board is scored (leaderboard, or Head to Head) only after the Final Square, or when it's skipped.
Head to Head players get the same Final Square (it's picked with the board). A board with no squares played has none.

| Route | What |
|---|---|
| `POST /mymismo/trivia/play/pick` | After the round clock: `{ roundOver: true, done: false, final: { cat, max } }` instead of a square. |
| `POST /mymismo/trivia/play/answer`, `/end` | When the board is over: `{ done: false, final: { cat, max } }`. |
| `POST /mymismo/trivia/play/wager` | `{ wager, game? }`: locked in (capped at the max); answers `{ cat, clue, wager, secs: 30 }`. |
| `POST /mymismo/trivia/play/say` | `{ text, game? }`: checked on the relay; answers `{ right, late, points, total, response, done }`. "What is" and "the" optional, punctuation ignored, a small slip in a longer answer counts, numbers exact. |
| `POST /mymismo/trivia/play/skip` | Ends the board without the Final Square. |
| `GET /mymismo/trivia/play` | Now also `roundLeft`, `phase` ('board' or 'final') and `final`. |

Final Squares live in `trivia/questions.json` as `finals: [{ id, cat, clue, answers: [...], response, source }]`, kept
private like the rest of the bank (the accepted answers never leave the relay). MyMISMO's Claude adds them from Jonna's
review, as with the questions. `test-mymismo-final.mjs` (20 checks).

## Where Things Live

`mymismo-data`: `push/subs.json` entries gain `news` (true or false; `summit` may now be empty), and `push/news.json`
(`{ items: [...] }`, the last 200, with who sent each and how many got it). Both outside `writable` and `readable`.

## Checks

`node test-mymismo16.mjs` (32 checks, made-up people and phones), `test-mymismo-h2h.mjs` (56) and `test-mymismo-final.mjs` (20). Requests 13, 14 and 15's tests still pass (48, 100,
43, 59) and so does test-relay.mjs (184).
