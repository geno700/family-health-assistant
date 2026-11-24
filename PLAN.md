# Family Health Assistant / منظّم صحة البيت — Plan

Status: **approved 2026-11-24** (Arabic name منظّم صحة البيت; server-visible names/emails accepted; demo, so alarm and voice limits accepted). Phase 1 built and tested in demo mode (2026-11-24). Owner asked the same day for Modern Standard Arabic texts and for the home pharmacy now (moved forward from phase 2): both built and tested in demo mode. Live on the real Supabase project and tested by the owner with two accounts (2026-11-24). Phase 2 (appointments, emergency cards) built the same day and checked on the owner's phone. Phase 3 (encrypted papers, doctor report) built the same day and checked on the owner's phone. Phase 4 helpers (family key change, box-photo reading) built and tested in demo mode the same day; push reminders skipped by the owner. All planned phases done.

- Repo and URL: `family-health-assistant` → https://algebratronics.com/family-health-assistant/
- One line: one household keeps every family member's medicines, doses and health papers in
  one place, shared between the family's phones, readable only by the family.
- Group type: **household** (بيت).
- Languages: Arabic (default, RTL) + English. Currency: none.
- Supabase project "github apps", schema **`fha`**.
- Replaces the Android app (`../family-health-organizer`, paused). Its plan and lessons carry
  over where they fit a web app.

## 1. The privacy design (decided 2026-11-24)

Your template stores records readable on Supabase. This app holds health data, and Egypt's
data law (151/2020) treats a server that can read it as a data controller needing a license,
with Supabase hosted abroad. So **every health record is encrypted in the browser before it is
sent. Supabase stores only scrambled text it cannot read.**

- **The family key** (كود العيلة السري): a random 256-bit key made in the owner's browser when
  the household is created. It is shown once as 52 letters/digits in groups of 4, to keep on
  paper or in a password manager. The server never gets it.
- **Joining:** the 6-character join code (server side, as in your other apps) → the owner or an
  admin approves → the new member types the family key once on each device. The browser
  checks it against an encrypted test value, then keeps it in that device's storage.
- **If every copy of the family key is lost, the data cannot be recovered**, not even by us.
  That is the price of the server not being able to read it. The app says so clearly at
  creation and asks the owner to confirm they saved the key.
- **What the server can see:** account emails, household name, who belongs to which household
  and their roles, how many records of each kind exist and when they changed, and a random id
  for each family member (used for permissions). **It cannot see:** names, ages, medicines,
  doses, times, notes, papers or anything health-related. The app will suggest a household
  name that doesn't identify the family (e.g. "البيت").
- A removed member's browser may still hold the key, but the database stops giving them any
  records (Row Level Security). Rotating the key after removal is a later feature.
- Encryption: AES-256-GCM with a fresh 12-byte IV per record, via the browser's Web Crypto API.
  No crypto library.

## 2. What a web app cannot do (accepted, "replaces Android")

- **No reliable alarm when the phone is locked or the browser is closed.** Phase 1 reminds
  only while the app is open (Today screen + browser notification at dose time). Web push was
  considered for phase 4 and skipped (it still isn't a ringing alarm and needs the server to know
  dose *times*). Families who need a real alarm should also set the phone's own clock alarm.
- **Voice input:** Chrome's built-in speech recognition sends audio to Google, which breaks
  the privacy design, so voice is cut. Box-photo reading can run in the browser (Tesseract.js)
  in a later phase.

## 3. Roles

| Role | Can do |
|---|---|
| **owner** | Everything; the only one who can delete the household or transfer ownership |
| **admin** | Approve/reject joiners, change roles (not owner), remove members, new join code, rename household, activity log, export, plus everything a caregiver can do |
| **caregiver** | Add, edit, stop and delete people, medicines, schedules (and later stock, papers, appointments); mark any dose |
| **patient** | Sees and marks **their own** doses (taken / skipped / undo); reads their own record only |
| **viewer** | Reads everything, writes nothing (e.g. a relative abroad) |

A patient member is linked to one family-member record ("this account is Mama") when approved.

## 4. Data model (schema `fha`)

Every table: `id uuid`, `group_id uuid`, `created_at`, `created_by`. Encrypted content is stored
as `cipher text` (base64) + `iv text`.

- **groups**: id, name, join_code (unique, 6 chars), key_check_cipher, key_check_iv (proves a
  typed family key is right), disabled (bool), created_at, created_by.
- **members**: id, group_id, user_id, role (check: owner/admin/caregiver/patient/viewer),
  status (check: pending/active/removed), person_id (uuid, null unless patient), display name
  (as typed at join, visible to admins), created_at, created_by. Unique (group_id, user_id).
- **records**: id, group_id, kind (check: person / medicine / dose_log; later stock,
  appointment, paper), person_id (uuid, the family member it belongs to; null for kind person
  where it equals id), cipher, iv, version (int, for "someone else changed this"), created_at,
  created_by, updated_at, updated_by, deleted_at. The decrypted contents:
  - person: name, birth year, blood type, allergies, conditions, emergency contacts, meal times, color
  - medicine: name, strength, form, dose amount, schedule type, times, every-N-days, food
    timing, start, end, stopped
  - dose_log: medicine id, planned time, status (taken/skipped), acted at, acted by
- **activity_log**: id, group_id, user_id, at, action (insert/update/delete/approve/role…),
  kind, record_id, before_cipher/iv, after_cipher/iv (encrypted, so the log is readable only
  inside the family).
- **platform_admins**: user_id.

**Database rules:** RLS on every table. Helpers `fha.is_member(g)`, `fha.has_role(g, roles[])`,
`fha.is_patient_of(g, person)` (security definer, fixed `search_path`), all requiring an
active member of a non-disabled group. Records: select = member (patient: own person only);
insert/update/delete = owner/admin/caregiver, or patient for `dose_log` of their own person.
RPCs (security definer, check rights themselves): `create_group`, `join_group(code)`,
`approve_member`, `reject_member`, `set_role`, `remove_member`, `leave_group`,
`regenerate_join_code`, `rename_group`, `transfer_ownership`, `delete_group`, and for #/owner:
`owner_stats`, `owner_groups(search)`, `owner_set_disabled`, `owner_activity`. A trigger writes
activity_log on record changes. Constraints (not null, checks, foreign keys) in the database.

## 5. Screens

**Phase 1**
- Sign up, log in, log out, reset password (email).
- First launch: disclaimer (same rules as the Android app: stores, reminds, organizes; no advice).
- No household yet: create one (→ family key shown once, "I saved it" checkbox) or join with a code.
- Waiting for approval; then "type the family key" (with "I don't have it" → ask the owner).
- Header: household switcher, language, Demo badge.
- **Today**: everyone's doses grouped by now / missed / later / done; taken / skip / undo; as-needed doses.
- **Medicines**: by person; add/edit form (name, strength, form, dose, how often, times, food,
  how long); stop, resume, delete. Search, filter by person, sort.
- **Family**: people list; person page (details, their medicines); add/edit person.
- **Settings**: language, backup to JSON (decrypted, for the user) and restore, CSV export
  (medicines, doses), sign out, "show family key" (re-type password first).
- **Household admin** (owner/admin): members, approve/reject (choose role, link patient to a
  person), change roles, remove, new join code, rename, activity log (decrypted on screen),
  export.
- **#/owner** (platform admins): groups/users/activity per week, search groups, disable /
  re-enable, activity counts (the platform owner sees no health content, by design).
- Demo mode (no config or `?demo`): sample household in localStorage, same screens, "Demo" badge.

**Phase 1b — home pharmacy (added 2026-11-24 at the owner's request)**
- Why: when a doctor prescribes something or you are at the pharmacy, you can check whether the
  medicine is already at home, so you don't buy it twice.
- **Pharmacy tab**: big search "is it at home?" with a clear yes / no answer (and "add it" on no);
  every medicine with what is left, how many days it lasts, who takes it, and each box with its
  expiry; filters low / expiring / expired; share a shopping list; add / edit / re-count / remove
  a box. Medicine page shows what the pharmacy holds for it. Today shows a banner for out, low
  or expired medicines. CSV export.
- How the count works: a box is counted once (count + date). Taken doses after that date are
  subtracted automatically, from the box that expires first; undo puts them back. The
  subtraction is worked out from the dose logs, so a patient marking their own dose needs no
  right to change the pharmacy, and two phones never overwrite each other's counts.
- Matching is by name (and strength when both have one), not by active ingredient: the app never
  says one medicine can replace another.
- Privacy: each box is an encrypted `stock` record; its server person_id is the household id
  (it belongs to the house, not one person), so patients don't see the pharmacy.

**Phase 2 — safety (built 2026-11-24)**
- **Appointments** (encrypted `appointment` records, server person_id = the person, so a patient
  sees only their own): doctor or place, date and time, where, notes. Family tab → "Appointments"
  (coming up / past), a person's page lists theirs, Today shows today's and tomorrow's. Owner,
  admin and caregiver add / edit / delete. Reminders: a phone notification 2 hours before while
  the app is open, and "add to the phone's calendar" (an .ics file with alarms a day before and
  2 hours before) for a real reminder with the app closed.
- **Emergency card** per person: red "Emergency" button in the header on every screen, and on each
  person's page. Name, age, blood type, allergies (in red), long-term conditions, current
  medicines with doses, emergency contact; buttons to call 123 and the contact; share as text.
- **Offline:** after every change the cards are saved on the phone, encrypted with the family key
  (the same protection as the key already kept there). With no internet the app shows an
  offline screen that still opens the cards, with the time they were saved. Signing out deletes
  the saved cards. The service worker also keeps the Supabase library so the app can start offline.
**Phase 3 — papers and report (built 2026-11-24)**
- **Papers** on each person's page: title, type (prescription, lab test, scan, medical report,
  other), date, doctor or place, notes, and one or more pages (camera photo, photos from the
  phone, or PDF up to 5 MB). Photos are shrunk to 1600 px JPEG, then **encrypted on the phone**
  and uploaded to the private Storage bucket `fha-papers` at `<household>/<person>/<file>`; the
  record keeps only the path and IV. Pages are downloaded and decrypted only when opened. Add
  pages, delete a page, edit details, delete the paper (its files go too). Storage policies use
  the same rules as records (patient: own person only; writers add/remove). The app never reads
  what a paper says. Backups keep paper details, not the photos.
- **Report for the doctor** (`#/report/<person>`): details, current and stopped medicines,
  doses taken / skipped / not recorded in the last 14 days, as-needed count, upcoming
  appointments, papers list, and a footer saying it holds no diagnosis or advice. "Print or save
  as PDF" uses the phone's print dialog; print styles hide the app's header and buttons.
**Phase 4 — helpers (2026-11-24)**
- **Changing the family key** (owner/admin, Household admin → "Change the family key"): a new key
  is shown once; paper pages are re-encrypted into new files, then every live record and the key
  check are swapped in one database transaction (`fha.rotate_key`; if records changed meanwhile,
  nothing changes and it can be retried). Records carry `key_id` (the key check IV they were
  locked with) and the database refuses writes made with an old key. Other phones are asked for
  the new key on their next start or save. Older activity-log entries (locked with the old key)
  show without names.
- **Reading a medicine box photo** (add-medicine and add-box forms): Tesseract.js runs in the
  browser (pinned from jsDelivr, about 7 MB the first time, then kept by the service worker); the
  photo never leaves the phone. Read at full and half size (big brand names are otherwise missed)
  and parsed by the rules ported from the Android BoxTextParser: name candidates (tap the right
  one), strength, form, and for the pharmacy also count and expiry. Dose, times and duration are
  never read. Nothing is saved until the user checks the form and taps Save.
- **Push reminders while the app is closed: skipped (owner, 2026-11-24).** They would need a
  server job, a new secret (VAPID key) and dose times on the server. For the demo, reminders work
  while the app is open, and appointments use the phone's calendar. A phone app can bring real
  alarms back later.

## 6. Phase 1 is done when
- Runs locally (`python -m http.server`); every screen clicked through in demo mode, Arabic and
  English, at phone width.
- RLS checked on paper: viewer can't write, patient can only touch their own doses, non-member
  sees nothing, removed member loses access, disabled group is closed.
- Server tables hold only ciphertext for health content (checked in demo by inspecting what
  `data-supabase.js` sends).
- No secrets in any file; README covers running locally, schema.sql, exposing `fha`, the
  redirect URL and GitHub Pages; a short two-account test list.

## 7. Open points for the owner
1. Arabic name: "مساعد صحة العيلة" (matches the English) or keep "منظّم صحة البيت"?
2. Is it OK that the household name and member emails are visible to the server (and to you
   as platform owner), while all health content is not?
