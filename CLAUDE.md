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
- 2026-11-24: demo storage key is now `fha.demo.db.v2` (new sample data); sw.js VERSION fha-v2.

## Status
- Phase 1 built and clicked through in demo mode (Arabic + English, 375 px) on 2026-11-24:
  disclaimer, sign up/in/out, create household + key, join by code, approve, enter key,
  household switcher, Today (take/skip/undo), medicines (add/edit/stop/delete), family
  (add/edit/delete, Arabic digits), settings, admin (code, rename, roles, activity, delete
  guard), owner page, backup/restore, role limits in the demo backend.
- Home pharmacy and Modern Standard Arabic texts built and clicked through the same day.
- 2026-11-24: pushed to https://github.com/geno700/family-health-assistant (public, `main`),
  GitHub Pages on from `main` / root; live in demo mode (config.js empty) at the URL above.
- Not yet run: schema.sql against the real Supabase project; two real accounts.
