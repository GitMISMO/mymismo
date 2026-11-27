# Relay Request 18: MyMISMO's Live Files in Amazon S3 (for Perry)

Requested by Jonna, Nov 27, 2026, after the 200-person load test. Apply after relay requests 13 to 17:
`relay-request-18-mymismo-live-files-s3.patch` (against index.mjs with 13 to 17 on). Plan: request 17 goes in first
(about the first week of December); this one after, before the Winter Summit (January 11 to 14, 2027).

## Why

GitHub lets one account make about 500 saves an hour, and generally no more than 80 a minute. Request 17 gives MyMISMO
its own GitHub account so it can't use up the budget the other systems share, which carries a summit to about 100
people saving things in a busy hour. Past that, MyMISMO itself would answer "not saved". Moving MyMISMO's busy files to
S3, which takes thousands of saves a second, carries a summit well past 1,000 people. GitHub then gets only the 15-minute copy of the
check-in files for Meeting Trackers and Member 360 (below): a few dozen saves an hour at a busy summit, well inside
MyMISMO's own budget.

## What Moves, What Stays

| Kept in S3 | Stays on GitHub |
|---|---|
| `att/` sign-in codes (one file per person), profiles, messages, reports, headshots | `trivia/questions.json` (the question bank) |
| `scan/` check-ins, Who I Met, touchpoints (copied to GitHub, below) | `trivia/settings.json` |
| `photos/` summit photos and their list | `push/news.json` (MISMO Media's MISMO Matters and Mic'd Up alerts) |
| `push/subs.json`, `push/alerts.json` | projects.json, People & Access, every other system |
| `trivia/` boards in play (one file per player), codes, leaderboards, contacts, Head to Head | MISMO Media's photo inbox (Send to MISMO Media still writes to GitHub) |

How it works:
- **Nothing outside the relay changes.** Every route answers exactly as before. Only two functions choose where a file lives (`readFile` and `updateRepoJson`), plus the two folder listings.
- **Saves never overwrite each other.** Each save is checked against the copy it changed, using S3 conditional writes (like GitHub's sha). If someone saved first, the relay reads again and retries for up to 12 seconds.
- **Sign-in codes and Trivia boards in play are one file per person**, so people don't wait on each other.
- **Nothing is lost on the switch.** A file that isn't in S3 yet is read from GitHub once and saved to S3 on its next change.
- **The rest of MISMO still sees the files it reads.** Meeting Trackers and Member 360 read `scan/` from GitHub. A scheduled run every 15 minutes copies only the `scan/` files that changed. Team HQ and MISMO Media read MyMISMO through the relay's routes, which read S3.
- **Turning it off:** with `MYMISMO_BUCKET` unset, the relay behaves exactly as request 17.

## Setup (AWS, about 20 minutes)

1. **Create the bucket.** Use a new S3 bucket in the relay's account and region, for example `mismo-mymismo-live`.
   - Block all public access.
   - Versioning on, so every earlier copy is kept, like GitHub's history.
   - Default encryption SSE-S3.
2. **Give the relay's Lambda role access to that bucket only:**
   ```json
   { "Version": "2012-10-17", "Statement": [
     { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject"], "Resource": "arn:aws:s3:::mismo-mymismo-live/*" },
     { "Effect": "Allow", "Action": "s3:ListBucket", "Resource": "arn:aws:s3:::mismo-mymismo-live" } ] }
   ```
3. **Set the bucket on the function.** Add the environment variable `MYMISMO_BUCKET=mismo-mymismo-live`.
4. **Check the runtime.** The code uses the AWS SDK built into the Node.js 20 or 22 Lambda runtime (`@aws-sdk/client-s3`), so there's no new library to bundle. It needs S3's conditional writes (`IfMatch`, `IfNoneMatch`). If the built-in SDK is older than about November 2024 and rejects them, bundle a current `@aws-sdk/client-s3`.
5. **Raise the timeout.** Set the Lambda timeout to at least 20 seconds. In a burst (a room signing in at once) a save can wait its turn for up to 12 seconds.
6. **Check concurrency.** In the Lambda console, Account concurrency should be 1,000, the usual default. Some new accounts start at 10. Ask AWS to raise it if so.
7. **Schedule the copy.** In EventBridge Scheduler, run the relay every 15 minutes (`rate(15 minutes)`) with the input `{"mymismoMirror": true}`. The relay only accepts that from the schedule, never from a web request. It answers `{ ok, copied, failed }`; a failure shows in the function's logs.
8. **Apply the patch and run the checks below.** Then deploy.

Cost: S3 charges fractions of a cent per thousand saves. A summit is a few dollars at most.

## Checks

- `node test-mymismo18.mjs`: 18 checks, run with a stand-in S3 that has real-world delays. They cover:
  - sign-in, profiles, check-ins, touchpoints, Attendance Now and MISMO Media's numbers all work from S3, with no GitHub saves
  - a file already on GitHub is kept, nothing lost
  - six saves to one file at the same moment all kept
  - the question bank, settings and news stay on GitHub
  - the 15-minute copy puts `scan/` on GitHub, copies only what changed, and can't be started by a web request
  - **600 people signing in, 50 at the same moment, all signed in, no GitHub saves (about 38 seconds for all 600)**
- `node run-suites-in-s3.mjs`: runs requests 13 to 17's checks (368) again with S3 on. All pass.
- Requests 13 to 17's checks and the other systems' tests (test-relay.mjs and the rest) still pass with `MYMISMO_BUCKET` unset.

## One Other Limit: Sign-In Code Emails

Attendees get their sign-in code by email through the MAIL_FLOW_URL flow (Outlook). One Outlook mailbox sends 30
messages a minute, and Microsoft holds anything over that for the next minute, so nothing is lost. If 300 people ask
for a code in the same five minutes (a keynote saying "get the app now"), the last codes could arrive about 10 minutes
late, close to the 15 minutes a code lasts. To avoid the wait, invite attendees to sign in before the summit (the beta QR code
and emails), or send codes from a second mailbox or Amazon SES. That's a later choice and not part of this patch.

## If It Has to Be Undone

Unset `MYMISMO_BUCKET`. The relay goes back to GitHub at once. Only the `scan/` files are on GitHub by then, so first
copy the rest of the bucket's files back into `GitMISMO/mymismo-data` (same paths). For the per-person sign-in code and
Trivia board files, nothing is needed: codes last minutes and a board in play just restarts.
