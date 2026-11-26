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

## Where Things Live

`mymismo-data`: `push/subs.json` entries gain `news` (true or false; `summit` may now be empty), and `push/news.json`
(`{ items: [...] }`, the last 200, with who sent each and how many got it). Both outside `writable` and `readable`.

## Checks

`node test-mymismo16.mjs` (32 checks, made-up people and phones). Requests 13, 14 and 15's tests still pass (48, 100,
43, 59) and so does test-relay.mjs (184).
