# CLAUDE.md — Family Health Assistant / منظّم صحة البيت (web app)

Read this and `PLAN.md` before changing anything. PLAN.md is the feature plan; this file holds
the rules and decisions. The Android app in `../family-health-organizer` is paused (this web
app replaces it as a demo); its lessons apply where they fit.

## What it is
- A household (بيت) keeps every family member's medicines, doses and health papers, shared
  between the family's phones. Mobile-first PWA, Arabic (default, RTL) + English.
- Status: **demo**. Accepted limits: no reliable alarm when the phone is locked or the browser
  is closed (reminders only while the app is open); no voice input. A phone app can come back later.
- Repo `family-health-assistant`, hosted at https://algebratronics.com/family-health-assistant/.
  Supabase project "github apps", schema `fha`.

## Privacy rules (never break)
1. **Every health record is encrypted in the browser** (AES-256-GCM, Web Crypto, fresh 12-byte
   IV) with the household's **family key** before it reaches Supabase. The server stores only
   `cipher` + `iv`. Never send a name, medicine, dose, time, note or photo in clear text.
2. The family key is made in the owner's browser, shown once (52 chars in groups of 4), and
   kept only on devices (`localStorage`). It is never sent to the server. Lost key = lost data;
   the UI says so.
3. Plain on the server (accepted by the owner 2026-11-24): account emails, household name,
   membership, roles, record kind/counts/timestamps, random person ids (for permissions).
   The #/owner page shows only these, never health content.
4. Store, remind, organize — never diagnose, suggest or change doses, judge results, or call a
   medicine safe/unsafe. First-launch disclaimer stays.
5. Only fake sample data. config.js holds only the Supabase URL and the publishable key; never
   the service_role or secret key.

## Stack rules (same as the owner's other apps)
- Plain HTML, CSS, JavaScript ES modules. No framework, no build step, no npm.
- GitHub Pages under /family-health-assistant/: every path relative (`./`), never starting with `/`.
- `js/data.js` picks `data-demo.js` or `data-supabase.js`; both expose the same functions.
  Views never call Supabase directly; they use `js/store.js`, which encrypts/decrypts.
- Demo mode when config.js has no Supabase values or the URL has `?demo`: sample data in
  localStorage, same features, "Demo" badge, a demo-only role switcher in Settings.
- Every label in `js/i18n.js`; `dir="rtl"` for Arabic; Arabic and Latin digits both accepted.
- Arabic texts are in **Modern Standard Arabic** (فصحى), not colloquial (owner, 2026-11-24).
  Counted nouns follow Arabic number agreement through `countWords()` (قرص واحد، قرصان، 3 أقراص، 11 قرصًا).
- Latin text inside Arabic (drug names, doses, times) goes through `ltr()` (Unicode isolate)
  or it shows reversed.
- Supabase: everything in schema `fha`; schema.sql safe to run again; RLS on every table via
  `fha.is_member` / `fha.has_role` (security definer, fixed search_path); membership changes
  only through security definer RPCs; constraints in the database; activity_log via trigger.
- Roles: owner, admin, caregiver, patient (own doses only, linked to one person), viewer.

## Decisions log
- 2026-11-24: web app replaces Android (demo); encrypted-in-browser Supabase storage; roles
  owner/admin/caregiver/patient/viewer; Arabic name منظّم صحة البيت; voice input cut.
- 2026-11-24: the family key accepts 0/1/8 typed for O/I/B (base32 has no 0, 1, 8).
- 2026-11-24: a backup restored into another household gets fresh record ids (ids are global
  primary keys on the server); same household → same ids, replaced in place.
- 2026-11-24: the backup file (JSON) is decrypted and readable; the UI/README say keep it safe.
- 2026-11-24: sw.js does not cache on localhost, so local testing always sees fresh files.
- 2026-11-24: store.setUser() forgets decrypted data whenever the signed-in user changes.
- 2026-11-24: Arabic UI switched from Egyptian colloquial to Modern Standard Arabic.
- 2026-11-24: home pharmacy built now (was phase 2). Boxes are `stock` records owned by the
  household (person_id = household id, so patients don't see them). Remaining amounts are
  computed in `js/stock.js` from count + countedAt minus taken dose logs (first to expire first),
  never written back, so undo needs nothing and patients need no write access to stock. Each
  dose log keeps the amount taken. Matching is by name + strength only, never by ingredient.
- 2026-11-24: demo storage key is now `fha.demo.db.v3` (sample appointments added); bump it when
  sample data changes. sw.js VERSION is now fha-v5; bump it on every app file change.
- 2026-11-24 (phase 2): appointments are `appointment` records (person_id = the person). Real
  reminders with the app closed come from an .ics file for the phone's calendar, not the app.
- 2026-11-24 (phase 4): family key change = `store.changeKey` + `fha.rotate_key` (one transaction,
  count check). Every record write sends `key_id` (= group.key_check_iv); `records_before` refuses a
  mismatch with 'key_changed', and the app then drops the old key and asks for the new one. On
  start, `store.keyStillValid()` does the same check. sw.js VERSION fha-v7.
- 2026-11-24 (phase 4): box-photo reading (`js/box-reader.js`, port of the Android BoxTextParser,
  node tests in the scratchpad passed 5/5) uses Tesseract.js 5.1.1 + tesseract.js-core 5.1.1 +
  @tesseract.js-data/eng 1.0.0 from jsDelivr, reading at full and half size. Fills name, strength,
  form (+ count, expiry in the pharmacy); never dose, times or duration.
- 2026-11-24 (phase 3): paper pages are encrypted in the browser (`encryptBytes`) and stored in
  the private bucket `fha-papers` (accepts only application/octet-stream, 6 MB) at
  `<household>/<person>/<file>`; storage policies call `fha.paper_path_ok`. The demo keeps files in
  IndexedDB (`fha-demo-files`). A paper's person can't change (the path depends on it). Deleting a
  household removes its files from the browser first (Supabase blocks deleting storage rows in SQL).
  Demo data is `fha.demo.db.v4`; sw.js VERSION fha-v6.
- 2026-11-24 (phase 2): emergency cards are saved on the device as `fha.sos.<householdId>`,
  encrypted with the family key, refreshed after every change, deleted on sign out. They open
  offline from the offline screen. On phones the header hides the app name (icon only) to fit
  the household switcher and the red Emergency button.

## Status
- Phase 1 built and clicked through in demo mode (Arabic + English, 375 px) on 2026-11-24:
  disclaimer, sign up/in/out, create household + key, join by code, approve, enter key,
  household switcher, Today (take/skip/undo), medicines (add/edit/stop/delete), family
  (add/edit/delete, Arabic digits), settings, admin (code, rename, roles, activity, delete
  guard), owner page, backup/restore, role limits in the demo backend.
- Home pharmacy and Modern Standard Arabic texts built and clicked through the same day.
- 2026-11-24: pushed to https://github.com/geno700/family-health-assistant (public, `main`),
  GitHub Pages on from `main` / root.
- 2026-11-24: schema.sql run on "github apps" (project gzvknfvqyqfynainxgur); `fha` added to
  Data API exposed schemas (anon gets "permission denied", as intended); redirect URL
  `https://algebratronics.com/**` was already allowed. config.js now has the URL + publishable
  key (same as home-finance), so the live site runs for real; `?demo` still opens the demo.
- 2026-11-24: the owner tested the live site with two real accounts (sign up, household, join
  + approve + key, shared data, roles, pharmacy hidden for a patient): all worked.
- Platform owner (#/owner): run the SQL line at the end of schema.sql with your user id.
- Phase 2 (appointments, emergency cards with offline copy) built and clicked through in demo mode
  (Arabic + English, 375 px, patient view, offline simulated) on 2026-11-24. No schema change was
  needed (the records kind check already allowed 'appointment').
- 2026-11-24: the owner checked phase 2 on a real phone: emergency cards open in airplane mode,
  and the calendar file adds the appointment with its reminders. All worked.
- Phase 3 (papers, doctor report) built and clicked through in demo mode (Arabic + English, 375 px,
  patient view, encrypted bytes checked) on 2026-11-24. schema.sql re-run on Supabase the same day:
  bucket private, three storage policies, anonymous upload refused. The owner then checked it on a
  phone with a real account (camera photo of a paper, reopening it, report saved as PDF): all worked.
- Phase 4 helpers (key change, box-photo reading) built and clicked through in demo mode (Arabic +
  English, 375 px; key change kept all 73 items and re-locked paper photos; a phone with the old key
  is refused and asked for the new one) on 2026-11-24. schema.sql re-run on Supabase the same day.
  Not yet tried with real accounts. Push reminders not built: waiting for the owner's decision.
