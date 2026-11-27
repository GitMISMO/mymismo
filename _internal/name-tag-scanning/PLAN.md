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

## Built in MyMISMO (Nov 27, 2026, staff test)
- Scan a Name Tag on the Summit page (staff who can open Summit HQ): camera, its own Code 39 reader (checked against Jonna's real
  name tag photo, also upside down) or BarcodeDetector where the phone has it; Type the Number; the scan card (who it is,
  Engagement Conversation or Sponsor Lead, Hot / Warm / Cold, note, email only if they gave it); My Scans with Download (CSV);
  My Test Badge (your own registration barcode once CN-055 is done, or type any number).
- My Profile: Share My Email with Sponsors Who Scan My Name Tag (`shareLead`, sent with the profile; the relay request
  must keep it and use it).

## Session Check-In and Attendance Now (Nov 27, 2026, staff test; Jonna: "yes" to replacing TrackPod and live stats)
- **Session Check-In** (Summit page, and Check People In on each session): pick the session (the one on now is chosen
  for you), scan tag after tag at the door; each one beeps, flashes the name and adds to the count; the same person twice
  shows Already Checked In. Kept on the phone in the test.
- **Attendance Now**: people checked in, sessions scanned, in sessions now, a bar per session (the ones on now marked),
  and the companies with the most people checked in. Refreshes every few seconds.
- **To go live (relay request)**: check-ins sent as they happen and kept on the phone until sent when the Wi-Fi drops;
  everyone's check-ins in Attendance Now; a feed Meeting Trackers reads in place of TrackPod's exports (a Change Notice
  to Meeting Trackers when it's built); Summit HQ shows the live counts too. Members vs non-members and new vs returning
  need the member class from the registration report (a field to add to CN-055's feed) and Meeting Trackers' history.
- **Plan for Winter**: run TrackPod as usual and the app at a few sessions, compare the counts; if they match, switch
  for Spring.

## Who gets which (Jonna, Nov 27, 2026)
- **Staff** (MyMISMO and Summit HQ access): Scan a Name Tag, Session Check-In, Attendance Now. Nobody else sees these.
- **Sponsors**: turned on automatically for a sponsor's registered people (the sponsor companies in Summit HQ's sponsor
  list for that summit, matched to their registrations): Scan a Name Tag for their own leads only. No check-in or stats.
- **Attendees (networking)**: any signed-in attendee can scan someone's tag to remember who they met: People I Met, with
  a note, the person's name, title and company (what the directory already shows), and their profile and Message if
  they've signed in. Same email rule: only if the person shares it. Needs attendee sign-in (relay request 13).

## Sessions and fixing details
- Check-in sessions come from Summit HQ: the same sessions and codes as its TrackPod Scanner Sheet (CN-056), so
  Meeting Trackers matches them like TrackPod's exports. Until that's published, the agenda's sessions.
- Anything the scanner gets wrong or can't read can be done by hand: Find by Name (the attendee list), Add Someone Not on
  the List (name, title, company), Type the Number, and the scan card's Name, Title and Company can be fixed.

## Testing before the relay
Once Summit HQ adds `reg`, staff can test the whole scan with real Winter 2027 registrations, using two phones and the
Test Badge screen; scans stay on the phone that scanned until the relay part is live.

## One scanner, by role (Jonna, Nov 27, 2026)
- The scan button in the top bar (and Scan Name Tags on People, Scan) opens one scanner with a mode bar at the top.
  - **Staff** (MyMISMO and Summit HQ access): Check-In, Who I Met, Touchpoint (Log a Touchpoint, which goes to Member 360
    when scanning goes live).
  - **Facilitators** (MyMISMO and Meeting Trackers access, no Summit HQ): Check-In and Who I Met. Until the relay part
    is live they don't see the attendee list, so a scan shows the registration number and they type the name.
  - **Sponsors**: their own leads, turned on when the relay part is live (unchanged from above).
- **Session picker**: a big button showing the session name, day, time and room; it opens Pick a Session, with day
  buttons, search, the session on now marked On Now, and the facilitator's own sessions at the top under Yours once
  Summit HQ's check-in list carries a `facilitator` field (CN-058).
- **Meeting Trackers**: staff and facilitators open the live Meeting Trackers (every meeting, any time) from the Scan tab
  and from Attendance Now.
