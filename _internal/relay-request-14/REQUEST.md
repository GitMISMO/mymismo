# Relay Request 14: MyMISMO Alerts and Presentation Slides (for Perry)

Requested by Jonna, Nov 25, 2026. Builds on relay request 13 (MyMISMO attendees): same `mymismo` entry in
projects.json, same private `GitMISMO/mymismo-data`. Apply request 13 first.

- **Alerts:** people using MyMISMO turn on alerts on their phone (Web Push; on an iPhone, once MyMISMO is on the
  Home Screen). MISMO staff write an alert in Summit HQ, and only the people named in `alertSenders` can send one.
- **Presentation slides:** the MISMO team uploads a session's slides in Summit HQ. Only attendees signed in to
  MyMISMO (request 13's sign-in) can download them.

## What to Do

1. **Make the push key pair** (once) and put both values in the function's environment. Run this anywhere with Node:

   ```
   node -e "const c=require('crypto').createECDH('prime256v1');c.generateKeys();const k=c.getPrivateKey();const d=Buffer.concat([Buffer.alloc(32-k.length),k]);console.log('MYMISMO_VAPID_PUBLIC='+c.getPublicKey().toString('base64url'));console.log('MYMISMO_VAPID_PRIVATE='+d.toString('base64url'))"
   ```

   `MYMISMO_VAPID_PRIVATE` is a secret: keep it only in the function's environment, never in a repository or page.
   The public half is meant to be public (the app reads it from `/push/ready`). If the private key is ever replaced,
   every phone has to turn alerts on again.
2. **Apply the patch** `relay-request-14-mymismo-alerts-slides.patch` to `initiative-hub/_dev/aws/index.mjs` (made
   on top of relay request 13), add `test-mymismo14.mjs` beside the other tests, and deploy.
   `node test-mymismo14.mjs`: 48 checks, all pass. `test-mymismo.mjs` (request 13) and every other test file still
   pass unchanged.
3. **projects.json** (Forms and shared pages posts this as a Change Notice; listed here so you see the whole picture):
   the `mymismo` entry gains `"push": true`, `"alertSenders": ["jcritchley@mismo.org"]` and
   `"slidesFeed": { "repo": "GitMISMO/summit-hq-data", "branch": "main", "path": "data/feed-mymismo-slides.json" }`.
   Each piece stays off until its line is there.

No new library: the push encryption (RFC 8291, aes128gcm) and the VAPID signature (RFC 8292, ES256) are done with
`node:crypto`, and the tests decrypt each message the way a phone does and check the signature.

## What the Patch Adds

| Route | Sign-in | What it does |
| --- | --- | --- |
| `GET /mymismo/push/ready` | none | `{ ok, publicKey, summits }`. 404 until `push: true` and both keys are set. |
| `POST /mymismo/push/subscribe` | none | `{ summit, sub: { endpoint, keys: { p256dh, auth } } }`. Only real push services' addresses (Google, Apple, Mozilla, Microsoft). The same phone is kept once. |
| `POST /mymismo/push/unsubscribe` | none | `{ endpoint }`. |
| `GET /mymismo/push/alerts?summit=` | none | The alerts already sent for that summit (title, words, session, time), for the app's inbox. Never who sent it or how many got it. |
| `POST /mymismo/push/send` | **staff**, `alertSenders` only | `{ summit, title (80), body (300), session }`. Sends to that summit's phones, 50 at a time; a phone the push service says is gone (404/410) is removed. An attendee token can never send. |
| `GET /mymismo/slides/have?summit=` | none | `{ sessions: { <id>: count } }`: counts only, so the app can show that slides exist. |
| `GET /mymismo/att/slides?session=` | attendee | The files for that session in the attendee's own summit: name, type, size, parts. |
| `GET /mymismo/att/slide?session=&n=&part=` | attendee | One part of the file (Summit HQ's chunked format), joined by the app. Keeps each answer well under Lambda's 6 MB limit. |

## Where Things Live

- `mymismo-data`: `push/subs.json` (`{ docs: { <16 hex>: { endpoint, keys, summit, at } } }`; a push address names no
  person, and no IP address, name or email is kept) and `push/alerts.json` (what was sent, by whom, how many got it).
  Both outside `writable` and `readable`, so only these routes reach them.
- `summit-hq-data`: `data/feed-mymismo-slides.json`
  (`{ updated, summits: { <summit id>: { sessions: { <session id>: [{ name, type, size, file, parts }] } } } }`) and
  the files it lists, in Summit HQ's chunked format. Only files listed there, with a `data/…json` path, can be read,
  and only by an attendee of that summit.

## Limits (per running copy)

Subscribe and unsubscribe: 30 an hour from one address. Sends: 30 an hour per sender. Inbox and slide counts: 600 an
hour from one address. Slide reads: 600 an hour per attendee. 20,000 phones at most.
