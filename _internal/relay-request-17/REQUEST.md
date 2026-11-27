# Relay Request 17: Name Tag Scanning and Summit Photos in MyMISMO (for Perry)

Requested by Jonna, Nov 27, 2026. Builds on relay requests 13 to 16: the same `mymismo` entry in projects.json and the
same private `GitMISMO/mymismo-data`. Apply 13, 14, 15 and 16 first, then `relay-request-17-mymismo-scan-photos.patch`.
No new secrets and no new library.

## What Jonna Decided

- **Who scans name tags.** MISMO staff (MyMISMO plus Summit HQ in People & Access) get Workgroup Check-In, Who I Met and
  Log a Touchpoint. Facilitators (MyMISMO plus Meeting Trackers) get Check-In and Who I Met. View-only access can't scan.
- **Emails.** A name tag lookup gives a name, title and company, never an email address. An email is kept with a scan
  only when the person gave it (typed in from a business card, or their own opt-in later).
- **Check-ins replace TrackPod's exports.** Check-ins are sent as they happen; when the hotel Wi-Fi drops the phone keeps
  them and sends them later. Each has an id made on the phone, so a retry is never counted twice. Meeting Trackers reads
  `scan/<summit>/checkins.json` (a Change Notice to Meeting Trackers will follow once this is live).
- **Touchpoints go to Member 360.** Staff touchpoints are also kept together in `scan/<summit>/touchpoints.json` for
  Member 360 to read (Change Notice to follow).
- **Summit Photos.** Attendees (with the box checked saying MISMO may use the photo) and staff send photos. Only the
  people in `mediaReviewers` (Amy, and whoever Jonna adds) see the submissions, pick or pass them, and press **Send to
  MISMO Media**. The picks then go to MISMO Media's inbox (CN-057), where MISMO Media drafts the post for Amy to approve.
  Nothing is ever posted automatically.
- **Sponsors** scanning for their own leads is a later request (it needs to know which registrations are a sponsor's).

## Switches (projects.json, the mymismo entry)

```json
"scan": true,
"photos": true,
"mediaReviewers": ["amoses@mismo.org", "jcritchley@mismo.org"],
"mediaInbox": { "repo": "GitMISMO/marketing-hq-data", "branch": "main", "dir": "incoming/summit-photos" }
```

`scan` and `photos` are off unless `true`. `mediaInbox` must be a repository of the same owner. The relay's GitHub token
needs write access to that repository's contents (it already writes to the other MISMO data repositories).

## Routes

| Route | Who | What |
|---|---|---|
| `GET /mymismo/scan/me` | staff or facilitator | `{ role, name }` |
| `POST /mymismo/scan/lookup` | staff or facilitator | `{ summit, regs: [up to 50] }` → `{ people: { <reg>: { name, title, company } } }` from the attendee list's `reg` (CN-055). |
| `POST /mymismo/scan/checkins` | staff or facilitator | `{ summit, items: [up to 200 { id, ses, reg or name/title/company, manual, at }] }` → `{ ok, saved, have }`. Up to 64 KB. |
| `GET /mymismo/scan/checkins?summit=&since=` | staff or facilitator | Everyone's check-ins for Attendance Now, with names; no emails. |
| `POST /mymismo/scan/notes` | staff or facilitator | `{ summit, items: [up to 100 { id, kind: 'met' or 'touch', reg, name, title, company, rate, note, email, at, deleted }] }`. Touchpoints are staff only. |
| `GET /mymismo/scan/notes?summit=` | staff or facilitator | Only your own. |
| `POST /mymismo/scan/helper` | staff or facilitator | `{ summit, ses, name, hours (1 to 12) }` → `{ token, exp }`: a link that lets someone else (a volunteer, a chair who likes to scan) check people in to that one session for those hours. With it, only `/scan/me`, `/scan/lookup` and `POST /scan/checkins` for that session work; each check-in records `helper:<name> via <who made the link>`. |
| `POST /mymismo/photos` | signed-in attendee or staff with MyMISMO | `{ summit, data (JPEG data: URL, up to about 1.6 MB), caption, challenge, tags, consent }` → `{ ok, id }`. 30 an hour each. |
| `GET /mymismo/photos/list?summit=` | mediaReviewers | Every submission, newest first, without the picture data. |
| `GET /mymismo/photos/one?summit=&id=` | mediaReviewers | `{ s }`, the picture. |
| `POST /mymismo/photos/review` | mediaReviewers | `{ summit, id, status: 'new', 'picked' or 'passed', note }`. A sent photo can't be changed. |
| `POST /mymismo/photos/send` | mediaReviewers | Sends every picked photo to `mediaInbox`: `<dir>/<summit>/<batch>/<id>.jpg` plus `<dir>/<summit>/<batch>.json` (the list, with each reviewer's note). |

## Where Things Live (GitMISMO/mymismo-data)

- `scan/<summit>/checkins.json` `{ docs: { <id>: { ses, reg, name, title, company, manual, at, by, saved } } }`
- `scan/<summit>/notes/<hash of the scanner's email>.json` each person's Who I Met and touchpoints
- `scan/<summit>/touchpoints.json` every staff touchpoint, with who logged it (for Member 360)
- `photos/<summit>/index.json` the submissions and their status; `photos/<summit>/<id>.json` each picture

The attendee list reader (`mmFeed`) now also keeps each person's `reg` numbers and an index by number. Nothing else that
existing routes return changes.

## Checks

`node test-mymismo17.mjs`: 45 checks (who can scan, helper links limited to one session and summit, no emails in lookups, a retried batch counted once, touchpoints staff
only and mirrored for Member 360, photos JPEG only, reviewers only, send writes the JPEG and the list to MISMO Media and
marks them sent, a sent photo can't be changed). Requests 13 to 16's suites still pass with this patch applied.
