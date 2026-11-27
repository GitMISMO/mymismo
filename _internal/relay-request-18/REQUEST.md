# Relay Request 18: MyMISMO's Busy Live Data Off GitHub (for Perry)

Requested by Jonna, Nov 27, 2026, after the 200-person load test (see relay request 17, "Load"). Needed before the
2027 Winter Summit (January 11 to 14, 2027). Builds on 13 to 17.

## Why

GitHub lets one account make about 500 saves an hour. Relay request 17 gives MyMISMO its own GitHub account (or caps
it at 250 an hour on the shared one) so it can't stop the other systems. But a busy summit hour with 200 people on
MyMISMO needs roughly 1,000 saves, so on GitHub alone MyMISMO itself would start saying "not saved" at the worst time.

## What Moves

A DynamoDB table in the relay's own AWS account (on-demand billing; at summit volumes this is pennies a month), holding
only MyMISMO's fast-changing data:

| Data | Saves today | Why it's busy |
|---|---|---|
| Attendee sign-in codes | 3 per sign-in | Everyone signs in on day one |
| Trivia plays (the Board) | 25 to 30 per game | One per pick and per answer, checked on the server so nobody can look up answers |
| Check-ins, Who I Met, touchpoints | 1 per batch | Every session start |
| Messages and push subscriptions | 1 each | All day |

The routes and what they answer stay exactly the same, so the app doesn't change.

## What Stays on GitHub

Everything people read or other systems use: an hourly summary job writes the check-ins to
`scan/<summit>/checkins/` for Meeting Trackers, the touchpoints for Member 360, the leaderboard for Team HQ, and the
photo picks to MISMO Media, as today. Settings, People & Access and projects.json don't move.

## What Perry Decides

- Whether a DynamoDB table (and the Lambda role's permission to read and write it) is OK in the relay's account.
- The table name. Once he says yes, Jonna's MyMISMO chat writes the patch and its checks the same way as 13 to 17.
