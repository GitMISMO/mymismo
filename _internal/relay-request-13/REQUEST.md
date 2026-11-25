# Relay Request 13: MyMISMO Attendees (for Perry)

Requested by Jonna, Nov 25, 2026. MyMISMO (resources.mismo.org/mymismo/) is MISMO's own app, replacing the shared
MBA Events app at MISMO's summits. Its agenda, speakers and sponsors already run from public files. This request adds
what needs to know who someone is: a summit's registered attendees sign in with their registration email and a
one-time code, choose whether to be listed in the attendee directory, see the others who chose to be listed, and
message them in the app. Attendees have no MISMO Resources account, so none of these routes use the staff sign-in.

## What to Do

1. **Create the private data repository** `GitMISMO/mymismo-data` (Jonna can create it) and **add it to the relay's
   GitHub token**. The relay also reads Summit HQ's attendee list in `GitMISMO/summit-hq-data`, which the token
   already covers.
2. **Apply the patch** `relay-request-13-mymismo.patch` to `initiative-hub/_dev/aws/index.mjs`, add
   `test-mymismo.mjs` beside the other tests, and deploy. The patch is made against initiative-hub commit `330d7c1`
   (Nov 20, 2026) and applies cleanly on top of relay request 12 (Huddle) as well, in either order; it changes nothing
   shared (it reads its own projects.json entry itself). `node test-mymismo.mjs`: 58 checks, all pass, and every
   existing test file still passes unchanged (test-relay, test-scheduler, test-r9, test-r10, test-r11 and the rest).
3. **projects.json** (GitMISMO.github.io `_internal/projects.json`): add the entry below. `"attendees": true` does
   nothing until the patch is deployed, then switches the routes on. `writable` is empty on purpose: staff pages save
   nothing here yet, and the attendee files can only be reached through these routes.

```json
"mymismo": {
  "repo": "GitMISMO/mymismo-data",
  "branch": "main",
  "origin": "https://resources.mismo.org",
  "writable": [],
  "attendees": true,
  "attendeeFeed": { "repo": "GitMISMO/summit-hq-data", "branch": "main", "path": "data/feed-mymismo-attendees.json" }
}
```

4. **Mail flow:** the code email uses the existing Power Automate mail flow with a new kind, `mymismo-code`. If the
   flow filters on kind, let `mymismo-code` through.

## What the Patch Adds

| Route | Sign-in | What it does |
| --- | --- | --- |
| `GET /mymismo/att/ready` | none | `{ ok, summits: [{ id, name, first, last }] }`: the summits sign-in is open for. Never an attendee. |
| `POST /mymismo/att/code` | none | `{ email, summit, startedAt, website }`. Always answers `{ ok: true }`. If the email is on that summit's attendee list, a 6-digit code is emailed to it (15 minutes, one use). The answer never says whether an address is registered. |
| `POST /mymismo/att/verify` | none | `{ email, summit, code }` → `{ token, me, expiresAt }`. The first sign-in makes the attendee's entry from their registration, **not listed**. |
| `GET /mymismo/att/me` | attendee | Their own entry. |
| `PUT /mymismo/att/profile` | attendee | `{ listed, title, company, about, linkedin }`: only their own entry. Name and email can't be changed. |
| `GET /mymismo/att/directory` | attendee | Listed attendees only: id, name, title, company, about, LinkedIn. Never an email. |
| `GET /mymismo/att/messages` | attendee | Only their own conversations (last 200 messages each). |
| `POST /mymismo/att/message` | attendee | `{ to, text }`: 1,000 characters at most; only to someone listed, or someone already in a conversation with them, and never to or from someone who blocked the other. |
| `POST /mymismo/att/block` | attendee | `{ id, on }`: a blocked person can no longer message them. |

- **Attendee token:** signed with a key derived from `AUTH_SECRET` for this purpose only, so an attendee token can
  never pass the staff sign-in and a staff token can never pass here (both tested). It names the attendee's id and
  summit and lasts until three days after the summit's last day (45 days at most). No new secret is needed.
- **Who may sign in:** only the people on Summit HQ's attendee list (`attendeeFeed`), shape
  `{ updated, summits: { <summit id>: { name, first, last, people: [{ e, first, last, company, title }] } } }`, read
  once a minute at most. Summit HQ's Claude publishes it (Change Notice for Summit HQ).
- **Where things live** (in `mymismo-data`, outside `writable` and `readable`, so `/data`, `/file` and `/commit`
  can't reach them): `att/codes.json` (codes as sha-256 hashes only), `att/<summit>/people.json` and
  `att/<summit>/messages.json`. An attendee id is the first 16 hex characters of sha-256("mymismo:<summit>:<email>"),
  so neither people.json nor messages.json holds an email address.
- **Guards**, as the other public routes: Origin must be resources.mismo.org; hidden field and a 3-second minimum on
  `/code`; per running copy: codes 5 an hour per address, 3 an hour per email, 300 an hour in all; verify 20 an hour
  per address and a code is spent after 5 wrong tries; 60 messages an hour per attendee; 30 profile saves an hour;
  900 reads an hour (the app checks for messages about once a minute while it's open); 16 kB body at most.
- **Email:** the only email ever sent is the sign-in code, to the person who asked for it (kind `mymismo-code`).
  Nothing else is emailed, and no one is told about a message by email.
- **Switched off** until the mymismo entry says `"attendees": true` with a valid `attendeeFeed`; until then every
  route answers 404, exactly as a relay without them does. The app checks `/att/ready` and hides sign-in until then.

## Later (not in this request)

- A staff view (signed in, mymismo access) to see counts and remove a message or a listing if someone reports it.
- Push notifications for new messages and session alerts.
