# MyMISMO

MISMO's own app, at **resources.mismo.org/mymismo/**. It is a web app that installs on a phone like any other app (Add to Home Screen on iPhone, Install on Android), and it is the code that will later be packaged for the Apple App Store and Google Play. Owner: Jonna Critchley.

This first draft is the **summit section**: it replaces what MISMO uses the shared MBA Events app for.

## What It Does

| Page | What people can do |
| --- | --- |
| Home | The summit at a glance (countdown, or Day 2 of 4 during the summit), figure boxes, what is on now and next, the General Sessions and the top-tier sponsors |
| Agenda | Every session of the week by day, filtered by type or searched across all four days; a session opens in a panel with its room, time, sponsor, what else is on at the same time, Add to Schedule and Add to Calendar |
| My Schedule | The sessions a person starred, by day, with overlaps flagged, Add All to Calendar (with a reminder 15 minutes before each), and sessions worth adding |
| Speakers | Everyone in the General Sessions running order, with photo, title, company and what they speak on |
| Sponsors | The summit's approved sponsors by tier, each with logo, website and the sessions they sponsor |

## Where the Information Comes From

Nothing is typed into this app. It reads only public feeds already on resources.mismo.org:

- `/summit-agenda/agenda.json`: Summit HQ's website agenda (the week from the Summit HQ Schedule, once Show on the Website Agenda is on for that summit, and the General Sessions running order with speakers and headshots). Built by `GitMISMO.github.io/summit-agenda/build-agenda.mjs`.
- `/sponsors/<season>-<year>.json` (for example `winter-2027.json`): the Sponsorship Portal's approved sponsors, with tier, logo, website and sponsored sessions.

The app shows the next summit whose last day hasn't passed. A person's starred sessions stay on their own phone (browser storage key `tools:mymismo:schedule:<summit>`); nothing about them is sent anywhere.

## Testing

- Add `?now=2027-01-12T10:30` to the address to see the app as it would look at that date and time in the summit's own time zone (Day 2, what's on now).
- Add `?page=agenda` (or `mine`, `speakers`, `sponsors`) to open on a page.
- Offline: open it once with a connection; after that it opens and shows the last agenda without one (`sw.js`).

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole app: styles, pages and script |
| `manifest.webmanifest` | Name, icon and colors used when it is installed on a phone |
| `sw.js` | Offline support: keeps the app and the last copy of the feeds on the phone |
| `icons/` | The app icon (the MISMO S on navy, matching mismo.org's icon) |

## Rules

- MISMO navy and sky, Title Case, squared-off buttons and tags (never pill shapes; circles are fine), no monospace type, no big empty spaces.
- Every page has the one shared icon line in `<head>` pointing at `https://resources.mismo.org/assets/favicon-48x48.png`.
- Back button: the shared `/assets/back.js`; each bottom tab is a page and each open panel is a layer.
- Stay in your lane: this app only reads other systems' public feeds. If it needs something new from Summit HQ or the Sponsorship Portal, ask that system's Claude to add it to its feed.
