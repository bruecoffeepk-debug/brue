# BRUE — Coffee Shop Website + Admin + POS

A chic, terracotta-toned Next.js 14 site for a Karachi specialty coffee bar.
Public marketing pages, a live **open/closed** indicator, a self-serve
**admin** for the menu, a real-time **orders queue** that syncs with a
public receipt page (save-as-PDF), and an in-store **POS** — all in one app.
Backed by Supabase, deployed to Vercel.

## What's in here

- **Public** — `/`, `/home`, `/menu`, `/about`, `/find-us`
  - Live menu pulled from Supabase. Browse-by-category, search, cart, checkout.
  - **Checkout drawer** collects name, phone, pickup or delivery, delivery method
    (Bykea / inDrive / WhatsApp), GPS-verified address, and notes.
    Enforces a **2 km delivery radius** using the browser Geolocation API +
    haversine distance.
  - **Live open/closed chip** in the nav + a soft **closed-right-now modal**
    that greets visitors when the shop is shut (dismissable for the session,
    auto-closes when the shop opens).
  - Hero video slot (`/public/hero-pull.mp4` + `/public/hero-pull.webm`) for a
    looping espresso-pull clip; falls back to a still photo if the files are
    missing.
- **Receipts** — `/r/[id]`
  - Public, unindexed, print-to-PDF receipt. Status chip reflects live order
    state (pending → accepted → preparing → out → completed). Customers bookmark
    or get this link via WhatsApp.
- **Admin** — `/admin` (auth-required)
  - Dashboard with active/sold-out counts
  - **Orders queue** — `/admin/orders` — real operations centre. Tabs
    (Queue / Today / All), one-tap status advance, **Send update on WhatsApp**
    button that opens `wa.me` with a pre-filled message + receipt link,
    payment-method picker, cancel.
  - **Drinks CRUD** — add, edit, delete; toggle stock; toggle visibility; upload photos
  - **Categories CRUD** — add categories like *Sweets*, *Coffee*, *Frappés*; reorder
  - Image uploads go to Supabase Storage (`drink-photos` bucket, public read)
- **POS** — `/pos` (auth-required) — tap-to-order terminal for in-store
- **Login** — `/login` — Supabase email/password, redirects back to `next` param

## Stack

- **Next.js 14** (App Router, Server Actions, ISR)
- **TypeScript**
- **Tailwind CSS** with a custom design system (Instrument Serif + Fraunces + Inter Tight + Caveat)
- **Supabase** — Postgres + Auth + Storage, accessed via `@supabase/ssr`
- **Vercel** for deploy (auto from GitHub)
- No WhatsApp Cloud API — status updates are `wa.me` deep links that staff tap.
- No PDF library — receipts use the browser's print dialog + `@media print` CSS.

---

## 1 · Local development

```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_WHATSAPP_NUMBER

npm install
npm run dev
```

Open <http://localhost:3000>. Public pages work without sign-in.
To use `/admin` or `/pos`, create a user (see step 2.3 below) and visit `/login`.

---

## 2 · Supabase setup (first-time)

1. **Create a Supabase project** at <https://supabase.com>.

2. **Run the schema** — open the SQL editor and run the files in order:
   - `supabase/schema.sql` — base tables (`menu_items`, `orders`, `customers`, `expenses`) + RLS + seeds the original 50 drinks.
   - `supabase/migrations/002_categories_and_stock.sql` — adds the `categories` table, `in_stock` and `category_id` columns on `menu_items`, the `drink-photos` storage bucket, RLS policies, and seeds 9 default categories.
   - `supabase/migrations/003_orders_intake.sql` — extends `orders` with
     `delivery_method`, `delivery_lat/lng`, `delivery_distance_km`, and the
     lifecycle timestamps (`accepted_at`, `ready_at`, `out_for_delivery_at`,
     `completed_at`). Adds the RLS policies that let the anonymous key
     insert a new `customer` + `order` + `order_items` row (narrowly gated to
     `status = 'pending'` and `channel in ('web', 'whatsapp')`), plus the
     public-read-by-id policy the receipt page needs.

   All three migrations are **idempotent** (`if not exists` / `drop policy if exists`)
   so they're safe to re-run.

3. **Create your first admin user** — Supabase dashboard → **Authentication → Users → Add user → Create new user**. Use any email + password; that becomes your admin login. Repeat for each staff member.

4. **(Optional) verify the storage bucket** — **Storage → Buckets** should now have `drink-photos` (public). If not, the migration creates it automatically; re-run `002_categories_and_stock.sql` if missing.

5. **Grab your API keys** — **Settings → API**. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   You do **not** need the `service_role` key. Public order intake relies on the
   anon key + the narrow RLS policies from migration 003.

---

## 3 · Configure the shop (`lib/shop.ts`)

Every piece of customer-facing info — name, pin, socials, hours, delivery
radius, delivery methods — lives in one file: **`lib/shop.ts`**. Nothing
else hard-codes these. Edit once, it updates everywhere (find-us page,
footer, checkout, receipt, open/closed chip).

You must personalise:

| Field | What to do |
| --- | --- |
| `lat`, `lng` | **The values shipped are placeholders.** Open Google Maps, right-click the exact BRUE pin, click the coordinates at the top of the menu — they copy to your clipboard as `24.xxxxx, 67.xxxxx`. Paste into `lib/shop.ts`. The 2 km delivery check and "Directions" button both depend on this. |
| `googleMapsLink` | The customer-facing share link (`https://share.google/…`). Used on `/find-us` to open the pin in Google Maps. |
| `instagram.handle` / `instagram.url` | Your real Instagram. Used on `/find-us` and in the footer. |
| `phoneDisplay` / `phoneTel` | Optional — only fill in if you want the phone chip on `/find-us` visible. |
| `hours` | Array of `{ day, open, close }` per day of week. `close > 24` means past midnight (`25` = 1 am next day). |
| `hoursSummary` | Short human string shown in the nav / footer, e.g. `"Mon — Sun · 8 am — late"`. |
| `delivery.radiusKm` | Defaults to `2`. Checkout will refuse addresses further than this. |
| `delivery.methods` | Edit labels / notes for Bykea, inDrive, WhatsApp. |

Also set `NEXT_PUBLIC_WHATSAPP_NUMBER` in env (digits only, country code first,
no `+`) — that's where all WhatsApp deep links land.

### Asset slots

Drop these files into `/public/` (they don't ship with the repo — staff/design adds them):

| Path | What |
| --- | --- |
| `/public/hero-pull.mp4` *(and optional `.webm`)* | 4-8 s looping espresso-pull clip. Silent — `<video>` is `muted autoplay loop`. 720p is plenty. |
| `/public/drinks/*.jpg` | Hero fallback + drink photos. Uploads from `/admin/drinks/new` also end up here (via Supabase Storage). |

If `hero-pull.mp4` is missing, the landing page falls back to the poster
image silently — no error.

---

## 4 · Deploy to Vercel via GitHub

1. **Push to GitHub**

   ```bash
   git init
   git add .
   git commit -m "BRUE v3 — chic site + admin + POS"
   git branch -M main
   git remote add origin https://github.com/<your-user>/brue-coffee.git
   git push -u origin main
   ```

2. **Import to Vercel**
   - Go to <https://vercel.com/new>
   - Pick the GitHub repo
   - Framework preset: **Next.js** (auto-detected)
   - Build command / output dir: leave defaults

3. **Add environment variables** (Project → Settings → Environment Variables — add to *Production*, *Preview*, and *Development*):

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` |
   | `NEXT_PUBLIC_WHATSAPP_NUMBER` | `923XXXXXXXXX` (digits only, country code first, no `+`) |

4. **Deploy.** Vercel runs `npm install && npm run build`, then serves the app. Subsequent pushes to `main` redeploy automatically.

5. **(After first deploy) configure your custom domain** under Project → Settings → Domains.

---

## 5 · Day-to-day: running the shop

Sign in at `/login` with the user you created in step 2.3.

### Handling an incoming order

1. A customer places an order via `/menu`. Their details go into `customers`,
   the order goes into `orders` with `status = 'pending'` and `channel = 'web'`,
   and they're shown their receipt at `/r/<id>`.
2. You see it at **`/admin/orders`** (the "Queue" tab — count is shown on the tab).
3. Tap **Accept** → status becomes `accepted`, `accepted_at` is stamped.
4. Tap **Send update on WhatsApp** — this opens `wa.me/<customer>` in a new tab
   with a pre-filled message ("Brewing now — your receipt is at …"). You send
   it; it's **not auto-sent**, by design.
5. Work through **Start making → Mark out for delivery → Mark delivered**. Each
   transition stamps its timestamp and revalidates the receipt page, so the
   customer's bookmarked `/r/<id>` reflects reality within one request.
6. Need to cancel? Tap **Cancel** — the customer's receipt shows *Cancelled*.

The receipt page has a **Save as PDF** button — that just invokes the browser
print dialog with print-only CSS (clean white background, no chrome). Works
for staff too if you want a kitchen-print copy.

### Managing the menu

- **`/admin`** — at-a-glance stats and recently-edited drinks
- **`/admin/drinks`** — search + filter; the **In stock** toggle here flips the public menu instantly. The trash icon deletes; *Edit* opens the full form.
- **`/admin/drinks/new`** — add a drink. Upload a photo (drag/drop or pick) or paste a URL. The category dropdown reads from `/admin/categories`.
- **`/admin/categories`** — add new sections like "Sweets" or "Pastries". Each row shows how many drinks live in it; deleting a category leaves the drinks intact (they just lose their category until re-assigned).

All admin writes call `revalidatePath()` so the public menu updates within the next request — no manual cache flush needed.

---

## 6 · Project layout

```
app/
  (public)/       # / · /home · /menu · /about · /find-us — ISR, no auth
  (admin)/        # /admin · /admin/drinks · /admin/categories · /admin/orders — auth-gated
  (pos)/          # /pos — auth-gated tap terminal
  api/orders/     # POST endpoint — validates, geo-checks, writes customer + order + items
  r/[id]/         # public printable receipt (noindex)
  login/          # /login — Supabase email/password
  globals.css     # design tokens + .btn/.input/.field-group/.display
  layout.tsx      # font CSS variables + providers
components/
  public/         # Nav, Footer, MenuClient, HeroVisual, OpenStatus (chip + closed modal), …
  admin/          # AdminNav, OrdersClient, DrinkForm, CategoriesClient, ImageUpload, StockToggle, …
lib/
  supabase/       # browser + server SSR clients
  shop.ts         # SINGLE source of truth for shop info (see § 3)
  hours.ts        # Karachi-time open/closed logic (server-TZ-independent)
  geo.ts          # haversineKm + getBrowserPosition
  utils.ts        # MenuItem, Category types, slugify(), money helpers
supabase/
  schema.sql                                # base tables + 50 seeded drinks
  migrations/002_categories_and_stock.sql   # categories, in_stock, storage bucket
  migrations/003_orders_intake.sql          # orders lifecycle, delivery fields, anon RLS
middleware.ts     # gates /admin, /pos, etc. behind a Supabase session
```

---

## 7 · Brand notes

- Terracotta `#c44526` (`--terra`), bone `#fcf7eb` (`--bone`), ink `#1c1712` (`--ink`).
- Fonts: **Instrument Serif** (display + italic accents), **Fraunces** (secondary serif), **Inter Tight** (UI), **Caveat** (script — used sparingly).
- The wordmark is always rendered as an `<Image>` from `/Brue.png`, `/Brue_W.png`, or
  `/Brue_DP_Orange.png` — never typed as plain text.
- A faint SVG grain (`.grain`) overlays large surfaces for that print-y feel. Tune with `--grain-opacity`.

---

## 8 · Troubleshooting

- **`/admin` redirects to `/login`** — expected when not signed in. Create a user in Supabase → Authentication → Users.
- **Checkout says "outside delivery zone" for a nearby address** — the `lat`/`lng` in `lib/shop.ts` are still the placeholder. Replace with the real BRUE pin from Google Maps (see § 3).
- **Checkout can't detect location** — browsers only allow `navigator.geolocation` on `https://` (or `localhost`). Vercel's deploy URL is HTTPS, so it'll work there. The customer can also type the address manually.
- **"Send update" on WhatsApp opens with no number** — the customer didn't give a phone. The Send button only shows when a phone is on file.
- **Receipt page shows stale status after I accepted** — the server action calls `revalidatePath('/r/<id>')`. Edge cache may need one more request; the customer refreshing once is enough.
- **Image upload fails with permission error** — re-run `supabase/migrations/002_categories_and_stock.sql`. It creates the `drink-photos` bucket and the storage policies.
- **Public menu doesn't reflect a stock change** — server actions call `revalidatePath` for `/`, `/home`, `/menu`. Vercel's edge cache may take one extra request to invalidate; hard-reload once.
- **Supabase image domain rejected by `next/image`** — confirm `next.config.js` `images.remotePatterns` includes your Supabase host (it ships with `*.supabase.co` allowed).
- **Build fails on Vercel with "Missing env vars"** — env vars must be set for the *Production* environment specifically before the first deploy.
- **Open/closed chip says the wrong thing** — it reads from `SHOP.hours` in `lib/shop.ts` and computes time in Karachi regardless of server TZ. Edit `lib/shop.ts`, redeploy.
