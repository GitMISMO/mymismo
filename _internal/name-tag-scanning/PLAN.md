# Name Tag Scanning (planned, Nov 27, 2026)

Sponsors scan attendees' name tags during networking to keep leads; MISMO staff (Amy) scan for engagement conversations.
Attendees don't need the app to be scanned.

## The name tag
- The barcode is Code 39 and holds only the Aptify **registration_id** from the SummitHQ_Registration report
  (checked: Jonna's Winter 2026 tag 1899894 is her MISMO Summit 2026 Winter registration_id). A new number each summit.
- MyMISMO reads it with its own Code 39 reader (no library), so it works on iPhone and Android.

## What has to be built
1. **Summit HQ** (CN-055, posted Nov 27): add `reg` (the person's registration_id list for that summit, in person first)
   to each person in data/feed-mymismo-attendees.json.
2. **MyMISMO**: Scan a Name Tag (camera), the lead card (name, title, company, a note, Hot / Warm / Cold), My Leads
   with download, and a Test Badge screen showing your own registration barcode so another phone can scan it.
3. **Save relay** (a new request for Perry): sponsors sign in and scan; leads stored per sponsor company, each sponsor
   sees only its own; staff scans go on to Member 360; scans of a number not yet on the list are kept and filled in
   when the list catches up (onsite registrations).
4. **Member 360** (a notice when this part is built): staff engagement scans land on the person's record.

## Decisions (Jonna)
- **No emails to sponsors unless the person gave it** (Nov 27, 2026). A sponsor's lead has name, title and company only.
  The email is added only if the attendee chose to share it: a switch in their MyMISMO profile, "Share my email with
  sponsors who scan my name tag", off unless they turn it on. A sponsor can also type in an email the person handed them
  (a business card) on the lead.

## Testing before the relay
Once Summit HQ adds `reg`, staff can test the whole scan with real Winter 2027 registrations, using two phones and the
Test Badge screen; scans stay on the phone that scanned until the relay part is live.
