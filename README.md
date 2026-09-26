# Solar Stock Manager

A shared warehouse inventory tool for solar panels, inverters and batteries,
split across five business owners. Plain HTML/JS frontend, [Supabase](https://supabase.com)
for the database, realtime sync and login.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project (free tier is enough).
2. Once it's created, open **SQL Editor** → New query, paste in the contents of
   [`schema.sql`](./schema.sql), and run it. This creates the tables and locks
   every one of them down so only signed-in users can read or write.
3. Open **Project Settings → API**. Copy the **Project URL** and the
   **anon public key**.

## 2. Add your users

There's no public sign-up screen on purpose — this is a private tool for your
five business owners. Add each person yourself:

- Supabase dashboard → **Authentication → Users → Add user**
- Give each owner an email + password (a real email isn't required to work —
  something like `owner1@yourcompany.internal` is fine, but a real one lets
  them use "forgot password").

## 3. Configure the app

Open `config.js` and paste in your Project URL and anon key:

```js
window.CONFIG = {
  SUPABASE_URL: "https://your-project-ref.supabase.co",
  SUPABASE_ANON_KEY: "your-anon-public-key",
};
```

The anon key is safe to commit to a public GitHub repo — it's designed to be
used from the browser, and the RLS policies in `schema.sql` are what actually
restrict access (signed-in users only).

## 4. Push to GitHub

```bash
git init
git add .
git commit -m "Solar stock manager"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/solar-stock.git
git push -u origin main
```

## 5. Deploy

Pick any static host — no build step needed, it's already plain HTML/JS/CSS:

- **GitHub Pages**: repo → Settings → Pages → Deploy from branch `main`, root folder.
- **Netlify** or **Vercel**: "Import from GitHub", leave build settings blank,
  it deploys as-is. Both auto-redeploy on every push to `main`.

## What's included

- `index.html` — page shell, loads Tailwind and the Supabase JS client from CDN
- `app.js` — all app logic (auth, data loading/realtime sync, every screen)
- `config.js` — your Supabase project URL + anon key (only file you need to edit)
- `schema.sql` — table definitions + row-level security policies

## What's tracked

Every stock addition, outgoing job, correction and transfer writes a row to the
`movements` table with the date, item, quantity, owner, reference, a
human-readable note, and now **which signed-in user made the change**
(`performed_by`, their login email) — visible as a "By" column in the Log tab
and included in the CSV export. Since accounts are created individually per
owner in the Supabase dashboard, this gives you real per-person accountability,
not just a description of what changed.

## Notes

- Five default owners ("Owner 1"–"Owner 5") are created automatically the
  first time someone signs in with an empty `owners` table — rename them
  in the Admin tab.
- All data updates live across every signed-in browser (Supabase Realtime).
- To add another user later, just add them in the Supabase dashboard —
  nothing to change in the code.
