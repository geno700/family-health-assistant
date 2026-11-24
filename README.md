# Family Health Assistant / منظّم صحة البيت

A household keeps every family member's medicines, today's doses and its **home pharmacy** (which
medicines are at home, how much is left, when they expire) in one place, shared between the
family's phones. At the doctor's or the pharmacy you can check whether a medicine is already at home. **Health records are encrypted in the browser with the family's
own key before they reach the server**, so the server stores only data it cannot read.

Demo version. Plain HTML, CSS and JavaScript modules: no framework, no build step, no npm.
Arabic (default, right-to-left) and English. Installable on a phone (PWA).

## Run it locally

```bash
python -m http.server 8080
```

Open http://localhost:8080/. With no Supabase values in `config.js` (or with `?demo` in the
URL) it runs in **demo mode**: a sample household in this browser's storage, a "Demo" badge,
and a "View as…" switcher in Settings to see the app as owner, caregiver, patient or viewer.
Demo sign-in accepts any password for `owner@example.com`, `sara@example.com`,
`mama@example.com` or `khaled@example.com`.

## Connect Supabase (shared "github apps" project)

1. **Run the schema.** Supabase Dashboard → SQL Editor → paste `supabase/schema.sql` → Run.
   It only touches schema `fha` and is safe to run again.
2. **Expose the schema.** Project Settings → Data API → *Exposed schemas* → add `fha` → Save.
3. **Auth redirect.** Authentication → URL Configuration → *Redirect URLs* → add
   `https://algebratronics.com/family-health-assistant/` (and `http://localhost:8080/` for
   local tests). Email confirmation and password reset links come back to this page.
4. **config.js.** Fill in `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (the publishable /
   anon key). **Never** put the service_role or a secret key in any file.
5. **Platform owner (optional).** To see `#/owner`, run once in the SQL editor with your user id:
   `insert into fha.platform_admins(user_id) values ('<your-user-id>') on conflict do nothing;`

## Publish on GitHub Pages

Repo `family-health-assistant` → Settings → Pages → *Deploy from a branch* → `main` / root.
It is served at https://algebratronics.com/family-health-assistant/. All paths are relative
(`./`), and `.nojekyll` makes Pages serve every file as is. When you change any app file, bump
`VERSION` in `sw.js` so installed phones show "New version, reload".

## Phase 2 to try in the demo
- Family → Appointments: add one, open it, "add to the phone's calendar" downloads an .ics file.
- Red "Emergency" button (top): each person's card, call 123 or their contact, share as text.
- Turn on airplane mode after opening the app once: the offline screen still opens the cards.

## How privacy works

- Creating a household makes a 256-bit **family key** in the owner's browser and shows it once
  (52 letters/digits). The owner keeps it safe and sends it to each approved member, who types
  it once per device. It is never sent to the server.
- Every person, medicine and dose is encrypted with AES-256-GCM (Web Crypto) before upload.
  The server can see account emails, the household name, membership and roles, and how many
  records changed when, but no names, medicines, doses or times.
- **If the family key is lost on every device, the data cannot be recovered.**
- Permissions are enforced in the database (Row Level Security + security definer functions):
  owner / admin manage members; caregiver edits records; patient marks only their own doses;
  viewer reads only.

## Not a medical device

The app stores, reminds and organizes. It doesn't diagnose, set or change doses, or advise.
Reminders only work while the app is open. In an emergency in Egypt, call 123.

## License

MIT — see `LICENSE`.
