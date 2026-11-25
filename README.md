# MyMISMO

MISMO's own app, at **resources.mismo.org/mymismo/**. It is a web app that installs on a phone like any other app (Add to Home Screen on iPhone, Install on Android), and it is the code that will later be packaged for the Apple App Store and Google Play. Owner: Jonna Critchley.

This first part is the **summit section**: it replaces what MISMO uses the shared MBA Events app for. It works in portrait and landscape (in landscape on a phone the tab bar becomes a rail down the left).

## What It Does

| Page | What people can do |
| --- | --- |
| My Dashboard | Opens first. Each person picks their tiles the first time (stored on the phone): MISMO Summit, Webinars, MISMO Mic'd Up, MISMO Matters, Certifications, Summit Sponsors, Submit an Idea, mismo.org. Tiles show live content and open the thing. The S in the top bar comes back here. |
| Home | The summit at a glance (countdown, or Day 2 of 4 during the summit), figure boxes, what is on now and next, the General Sessions and the top-tier sponsors |
| Agenda | Every session of the week by day, filtered by type or searched across all four days; a session opens in a panel with its room, time, sponsor, what else is on at the same time, Add to Schedule and Add to Calendar |
| My Schedule | The sessions a person starred, by day, with overlaps flagged, Add All to Calendar (with a reminder 15 minutes before each), and sessions worth adding |
| People | Speakers (everyone in the General Sessions running order, with photo, title, company and what they speak on) and, once relay request 13 is live, Attendees: the attendees who chose to be listed, with Message, LinkedIn and Block |
| Messages and My Profile | Once relay request 13 is live: sign in with the registration email and a 6-digit code, choose whether to be listed, edit title, company, what you'd like to talk about and LinkedIn, and message other attendees |
| Explore | The hotel and room block (Book Your Room, Directions), Getting Here and Around, Where to Eat and Things to Do from the website's Hotel and Travel page; the summit's sponsors by tier (logo, website, sponsored sessions and breaks); MISMO Mic'd Up episodes played in the app; MISMO Matters; Submit an Idea; and mismo.org links |

## Where the Information Comes From

Nothing is typed into this app. It reads only public feeds already on resources.mismo.org:

- `/summit-agenda/agenda.json`: Summit HQ's website agenda (the week from the Summit HQ Schedule, once Show on the Website Agenda is on for that summit, and the General Sessions running order with speakers and headshots). Built by `GitMISMO.github.io/summit-agenda/build-agenda.mjs`.
- `/sponsors/<season>-<year>.json` (for example `winter-2027.json`): the Sponsorship Portal's approved sponsors, with tier, logo, website and sponsored sessions.
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
