# Relay Request 16: MyMISMO Trivia Head to Head (for Perry)

Requested by Jonna, Nov 25, 2026. **Apply after relay request 15**: it builds on request 15's trivia sign-in, question
bank and rounds, in the same `mymismo` entry and the same private `GitMISMO/mymismo-data`.

## What Jonna Decided

- **Two players, the same 10 questions, highest score wins.** Scoring is the ranked round's: faster right answers score
  more, with the streak bonus. **A tie on points goes to whoever spent less time answering**; the same points and the same
  time is a tie.
- **Nobody waits for the other.** Whoever starts plays first; the other plays the same questions when they're ready.
- **Two ways to start, the player's choice:**
  - **Challenge Someone:** search for a player by name (shown as on the leaderboard: first name, last initial). Once the
    challenger has played, it's the other person's turn, to play or decline, **for 48 hours**.
  - **Find Me an Opponent:** if someone else's open game is waiting, you play its questions against their score (the
    game that has waited longest goes first). If none is waiting, you play first and **the next person who asks gets your
    game. An open game waits 7 days.**
- **No computer opponent.**
- Head to Head games **never count for the monthly leaderboard**.
- **Nothing is emailed or pushed.** The app shows Your Turn the next time it asks (Jonna's rule: no automatic sends).

## Routes

All under `/mymismo/trivia/h2h`, with a player's sign-in from request 15. Off whenever trivia is off.

| Route | What it does |
| --- | --- |
| `GET /trivia/h2h` | The player's games, newest first, each `{ id, mode, state, opponent, made, expires, you, them, result }`. `state` is `playing`, `waiting`, `your-turn`, `done`, `declined` or `expired`; `them` and `result` (`won`, `lost`, `tie`) only once both have played. Also `tally` (won, lost, tied), `yourTurn` (how many) and `openGames` (how many open games from others are waiting). |
| `GET /trivia/h2h/players?q=` | Up to 10 players whose name contains `q` (2 letters at least), never yourself. |
| `POST /trivia/h2h/challenge` | `{ to: <player id> }`: starts the challenger's round. Answers `{ game, round, count, secs, opponent, second: false }`. |
| `POST /trivia/h2h/find` | Takes the open game that has waited longest (`second: true`, with the opponent's name), or starts a new open game (`second: false`). |
| `POST /trivia/h2h/play` | `{ game }`: the challenged player starts their round. |
| `POST /trivia/h2h/decline` | `{ game }`: the challenged player says no. |

Rounds are played with request 15's `/trivia/next` and `/trivia/answer`. The last answer of a Head to Head round comes
back with `h2h: true` and the game as the player now sees it.

## How It Works

- Games are kept in `trivia/h2h.json`, by game id. Rounds in `trivia/rounds.json` carry the game's id (`h`) and now
  also each answer's time (`ms`), for the tie-break.
- A challenge isn't shown to the other player until the challenger's score is in; a starter who never finishes (1 hour)
  is dropped.
- Waiting games expire on read (48 hours for a challenge, 7 days for an open game). Finished, declined and expired games
  are kept 30 days, then dropped.
- At most **10 games waiting on other players** per person, so nobody can flood others with challenges.
- **Deleting a trivia account** (request 15's `/trivia/delete`) also removes their waiting games and shows them as "A
  former player" in finished ones.
- **App reviewers** (request 15's review account) can challenge and be matched only with the MISMO staff in
  `reviewAccount.contacts`, and their open games are never offered to anyone else.
- No email address is saved in the games file: players are kept by their player id.

## Files

- `relay-request-16-mymismo-head-to-head.patch`: the change, against index.mjs after request 15.
- `test-mymismo16.mjs`: 32 checks with a stand-in GitHub and mail flow and made-up players and questions. Run
  `node test-mymismo16.mjs` next to index.mjs. Request 15's, 14's and 13's tests still pass.
