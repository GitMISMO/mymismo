# MyMISMO

MISMO's own app, at **resources.mismo.org/mymismo/**. It is a web app that installs on a phone like any other app (Add to Home Screen on iPhone, Install on Android), and it is the code that will later be packaged for the Apple App Store and Google Play. Owner: Jonna Critchley.

This first part is the **summit section**: it replaces what MISMO uses the shared MBA Events app for. It works in portrait and landscape (in landscape on a phone the tab bar becomes a rail down the left).

## What It Does

| Page | What people can do |
| --- | --- |
| My Dashboard | Opens first. Each person picks their tiles the first time (stored on the phone): MISMO Summit (with the summit's sponsors in a strip along its foot), Webinars, MISMO Mic'd Up, MISMO Matters, Certifications, Join a Workgroup, MISMO Trivia, Sponsor a Summit, Submit an Idea, mismo.org. Tiles show live content and open the thing. Sponsor a Summit (CN-072) opens the Sponsorship Portal's phone prospectus (resources.mismo.org/Sponsorship-Prospectus/app/?from=mymismo) in the same window, so the phone's Back (and the page's own back arrow on its first step) returns to MyMISMO; a Sponsor a Summit button also sits beside See All Sponsors in the sponsor band (Explore, Home and the summit pages). Join a Workgroup opens a phone version of the website's Workgroup Meeting Schedule: who's meeting now and next, the next two weeks day by day, every group with search and topics, and each group's dates, leaders, current work, summit sessions, Join and Add to Calendar. It reads Meeting Trackers' published schedule.json, leadership.json, agendas.json and calendars/feeds.json, the website's group pages (data/workgroups.json) and the schedule page's sponsor tags (data/wg-sponsors.json, from the guide job). The S in the top bar comes back here. |
| Home | The summit at a glance (countdown, or Day 2 of 4 during the summit), figure boxes, what is on now and next, the General Sessions and the top-tier sponsors |
| Agenda | Every session of the week by day, filtered by type or searched across all four days; a session opens in a panel with its room, time, sponsor, what else is on at the same time, Add to Schedule and Add to Calendar |
| My Schedule | The sessions a person starred, by day, with overlaps flagged, Add All to Calendar (with a reminder 15 minutes before each), and sessions worth adding |
| People | Speakers (everyone in the General Sessions running order, with photo, title, company and what they speak on) and, once relay request 13 is live, Attendees: the attendees who chose to be listed, with Message, LinkedIn and Block |
| Messages and My Profile | Once relay request 13 is live: sign in with the registration email and a 6-digit code, choose whether to be listed, edit title, company, a few sentences about you and your work, and LinkedIn, and message other attendees |
| Explore | The hotel and room block (Book Your Room, Directions), Getting Here and Around, Where to Eat and Things to Do from the website's Hotel and Travel page; the summit's sponsors by tier (logo, website, sponsored sessions and breaks); MISMO Mic'd Up episodes played in the app; MISMO Matters; Submit an Idea; and mismo.org links |

## Where the Information Comes From

Nothing is typed into this app. It reads only public feeds already on resources.mismo.org:

- `/summit-agenda/agenda.json`: Summit HQ's website agenda (the week from the Summit HQ Schedule, once Show on the Website Agenda is on for that summit, and the General Sessions running order with speakers and headshots). Built by `GitMISMO.github.io/summit-agenda/build-agenda.mjs`. The Champions Lounge row at the top of each Agenda day comes from its `summits.<id>.lounges` (title, room, days, desc; CN-070) (CN-071: a missing `lounges` field means no lounges). Only until Summit HQ's feed is first rewritten with lounges (its `sourceUpdated` from 2026-11-28T01:30Z on, or any summit carrying `lounges`) does the app use `lounges` in `data/agenda-extras.json` (CN-069) instead; that copy is dropped once the feed has them.
- `/sponsors/<season>-<year>.json` (for example `winter-2027.json`): the Sponsorship Portal's approved sponsors, with tier, logo, website and sponsored sessions.
- `/sponsors/prospectus-app.json`: which sponsorship programs the Sponsorship Portal publishes on MyMISMO (`{"pages": {"series-winter", "spring", "fall", "spring-fall": true or false}, "updated"}`), written by the website's sponsors job (CN-072). Sponsor a Summit shows while any page is true, and also while the file doesn't exist yet (Series + Winter is on until the Portal first saves a box); with every page false it is hidden.
- `data/guide.json`: the website's Hotel and Travel page (www.mismo.org/events/hotel), copied twice a day by `.github/workflows/guide.yml` running `tools/build_guide.py`. Shown only when its dates match the summit's. If the page can't be read, nothing is written and the job fails.
- `/podcast/micdup.json`: MISMO Media's Mic'd Up episode list (YouTube ids, titles, dates).
- `data/event.json`: the Summit page's welcome (www.mismo.org/events/summit): title, subtitle, paragraphs, At a Glance, Register Now. Same job as the guide.
- `data/agenda-tags.json`: the website agenda's session logos (Sponsored by, Presented by, Powered by) and each group's Learn More video. Same job as the guide.
- `data/programs.json`: each organization certification and everyone who holds it, from the website's directory pages (eClose, RON, eVault, Product, FRAME Advisory Partner, Certified Consultant). `data/providers.json`: each certified company's page (logo, About, certifications held, website). `data/peeks/`: pictures of sponsors' and providers' home pages. All made by `tools/build_providers.py` in the same job; a page that can't be read keeps its last good copy.
- `/webinars/webinars.json` (upcoming MISMO webinars), `/marketing-hq/matters/editions.json` (MISMO Matters editions), `/certified/new-certifications.json` and `/certified/individuals.json` (certifications): read only, for the dashboard.
- The General Sessions live stream plays MISMO's YouTube channel's live stream in the app, from 30 minutes before the General Sessions until they end.

Attendee sign-in, the directory and messages go through the save relay's MyMISMO routes (relay request 13, `_internal/relay-request-13/`). The app asks `/mymismo/att/ready` first and shows none of that until the relay answers, so the app works the same before the request is deployed. The relay reads who may sign in from Summit HQ's attendee list (`summit-hq-data` `data/feed-mymismo-attendees.json`). The only email ever sent is the sign-in code, to the person who asked for it.

The app shows the next summit whose last day hasn't passed. A person's starred sessions stay on their own phone (browser storage key `tools:mymismo:schedule:<summit>`); nothing about them is sent anywhere.

## Testing

- Add `?now=2027-01-12T10:30` to the address to see the app as it would look at that date and time in the summit's own time zone (Day 2, what's on now).
- Add `?page=agenda` (or `mine`, `people`, `explore`) to open on a page.
- Add `?holiday=preview` to see December's santa hat on the O of the header logo and the snow (the shared `/assets/holiday.js`, CN-052; the loading-screen logo and the header logo are both marked `data-mismo-logo`, so the hat is on the first logo people see). Only the app itself loads it, never the public privacy, support or delete-account pages.
- Offline: open it once with a connection; after that it opens and shows the last agenda without one (`sw.js`).

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole app: styles, pages and script |
| `manifest.webmanifest` | Name, icon and colors used when it is installed on a phone |
| `sw.js` | Offline support: keeps the app and the last copy of the feeds on the phone |
| `icons/` | The app icon (the MISMO S on navy, matching mismo.org's icon) |
| `_internal/relay-request-13/` | The relay request for attendees (for Perry): REQUEST.md, the patch and its 58 checks |
| `CHANGELOG.md` | One line per change people would notice, newest first |

## Rules

- MISMO navy and sky, Title Case, squared-off buttons and tags (never pill shapes; circles are fine), no monospace type, no big empty spaces.
- Every page has the one shared icon line in `<head>` pointing at `https://resources.mismo.org/assets/favicon-48x48.png`.
- Back button: the shared `/assets/back.js`; each bottom tab is a page and each open panel is a layer.
- Stay in your lane: this app only reads other systems' public feeds. If it needs something new from Summit HQ or the Sponsorship Portal, ask that system's Claude to add it to its feed.

## MISMO Trivia: How It Will Work (decided by Jonna, Nov 25, 2026)

- **Questions:** draft set in `data/trivia-draft.json` (96, each with a public source and a level: 1 Easy, 2 Medium, 3 Hard). No Wikipedia sources. Reviewed in Jonna's question review doc before going live.
- **Test Run (now):** MISMO staff signed in, a `?trivia=test` link, or the reviewer code in Settings. Scores stay on the phone.
- **Scoring:** like Kahoot. A right answer is worth up to 1,000 points (times 1, 1.5 or 2 for Easy, Medium, Hard), less the slower it comes but never below half; two or more right in a row add 100 (times the level). Study rounds have no clock and no points.
- **Monthly leaderboard:** starts over on the 1st of every month. Ranks each player's single best round, and only Hard rounds of Mixed questions count. The questions must be well mixed and drawn from a big enough Hard pool that players can't memorize them.
- **Quarterly Championship:** the three monthly champions play a harder Championship Board. If someone wins two months in one quarter, that later month's next-highest scorer takes the spot. Each plays on their own phone during a set championship window; once they start, a set time runs until they finish (no pausing, no restarting). The highest score is recognized at the next MISMO Summit and wins a prize.
- **Still to build:** the leaderboard and championship need a save relay request (scores checked on the server, questions served by the relay so answers aren't in the app, the championship clock kept on the server).

- **Who can play (Nov 25, 2026):** anyone can download MyMISMO (it is headed for the Apple App Store and Google Play). What's public on mismo.org stays public in the app; what needs a website sign-in still needs one. Practice rounds are open to everyone; ranked rounds need a sign-in with an emailed six-digit code, and players can delete their account in the app. Relay request 15 (_internal/relay-request-15) has the patch and 57 checks.

## Store Privacy Answers and Permission Messages (Nov 28, 2026)
- **Location (weather by the date):** asked only after someone taps Show Weather; rounded to about a mile, kept on the phone, sent to Open-Meteo for the forecast (and to weather.com only if they tap Open The Weather Channel). Apple App Privacy: Coarse Location, App Functionality, not linked to the user, not used for tracking. Google Play Data safety: Approximate location, collected, optional, App functionality, not shared. Privacy policy wording: CN-080.
- **Permission messages for the iPhone build:** NSCameraUsageDescription "MyMISMO uses the camera to scan name tags, take summit photos and add pictures to Who I Met." and NSLocationWhenInUseUsageDescription "MyMISMO uses your rough location to show the weather where you are."
- **Payments:** Pay the Fund, Apply for Membership and Sponsor a Summit open MISMO's own pages for memberships and sponsorships used outside the app, so no in-app purchase is involved.

## Screen Orientation (Jonna, Nov 27, 2026)
- **Phones: portrait only.** The Android app (store/android/twa-manifest.json) and the installed web app (manifest.webmanifest) are set to portrait. Full-screen video (Mic'd Up, the General Sessions live stream) still turns sideways and turns back when it closes.
- **Tablets: any way up.** Android 16 and later let large screens turn whatever the app asks, and the iPhone build must list iPad as supporting all four orientations (Apple requires it for iPad multitasking). For the iPhone build: UISupportedInterfaceOrientations = portrait only; UISupportedInterfaceOrientations~ipad = all four.
- The landscape layout stays in the page for anyone using it in a browser or on a tablet.
