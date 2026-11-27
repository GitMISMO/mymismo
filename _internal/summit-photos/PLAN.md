# Summit Photos (Jonna, Nov 27, 2026)

Jonna: "can i also have a summit your summit selfies or friend photos to encourage engagement?" and "can amy have the
ability to take photos and review the summit photo submissions to send to MISMO media who would then create the draft
post for amy to review and determine if she wants to post?"

## Built (in the app now; phone-only until the relay part is live)
- **Summit Photos card** on the Summit page: Take a Selfie, Take a Photo, From My Photos, and a **Photo Challenge** strip
  (a selfie at the General Sessions, you and someone you just met, your workgroup, a New Orleans bite, the streetcar,
  your team, something you learned). Tapping a challenge opens the selfie camera with it chosen.
- **Your Photo**: the photo cropped to 4:5 (Instagram and LinkedIn friendly) with a frame: Summit Frame (navy band with
  the MISMO logo, the city, the summit and its dates), Corner Badge, or No Frame. Caption, Photo Challenge, Who's In It
  (names from Who I Met suggested). Save to My Photos (also downloads it), Share (the phone's own share sheet), and
  **Send to MISMO**, which needs the box "MISMO may use this photo in its posts and newsletter, and everyone in it is OK
  with that."
- **My Photos**: what's on the phone and what was sent; delete any.
- **Review Submissions** (MISMO Media reviewers: staff with MISMO Media access, e.g. Amy): New, Picked, Sent to MISMO
  Media, Passed. Pick or Pass each one; a note for MISMO Media on picks; Take a Photo and Add From My Photos for Amy's
  own photos (they go straight into the submissions); **Send N Photos to MISMO Media** only when she presses it.
- MISMO Media drafts the summit post from the picks for Amy to review; she decides whether it posts. Nothing posts on
  its own (MISMO Media isn't doing automatic LinkedIn posting).

## To go live
- **Relay (Perry)**: `POST /mymismo/photos` (signed-in attendee or staff; JPEG up to 2 MB; caption, challenge, tags,
  consent required for attendees) stored in private `GitMISMO/mymismo-data` photos/<summit>/; `GET /mymismo/photos`
  and `POST /mymismo/photos/<id>` (pick, pass, note) for MISMO Media reviewers; `POST /mymismo/photos/send` writes the
  picks to MISMO Media's incoming folder. Rate limit per person. To be added to the scanning relay request.
- **MISMO Media** (CN-057): an incoming Summit Photos list on its Summits tab; a draft post per batch for Amy.
- Photos never show to other attendees in the app unless MISMO picks them (a summit gallery can come later).
