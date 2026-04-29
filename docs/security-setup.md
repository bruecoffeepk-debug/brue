# BRUE · security setup checklist

After every push, work through this list once. All items are configured
in dashboards, not code — so they don't ship in commits and have to be
done manually per environment.

---

## 1. Supabase migrations to apply (in order)

In Supabase Dashboard → SQL Editor → paste & run, in this order:

1. `supabase/migrations/004_menu_pivot.sql` (already done if you ran it)
2. `supabase/migrations/005_dedupe_and_finalize.sql` (cleans duplicates)
3. `supabase/migrations/006_security_lockdown.sql` (locks anon out of orders/cost)
4. `supabase/migrations/007_fix_menu_view_visibility.sql` (fixes empty menu)

Re-runnable. Each is wrapped in `BEGIN/COMMIT`. Look at the final
`SELECT … as ...` row to confirm counts after each.

---

## 2. Vercel environment variables

Project → **Settings → Environment Variables**. Add each, apply to
**Production + Preview + Development**, then redeploy (or push any
commit to trigger a build).

| Variable | Where to get it | Required? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` key | ✅ (else /api/orders + /r/[id] return 500) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Your shop WhatsApp, digits only with country code | ✅ |
| `UPSTASH_REDIS_REST_URL` | https://upstash.com → Redis DB → REST tab | Recommended (fails open) |
| `UPSTASH_REDIS_REST_TOKEN` | same | Recommended (fails open) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | https://dash.cloudflare.com → Turnstile → site | Recommended (fails open) |
| `TURNSTILE_SECRET_KEY` | same | Recommended (fails open) |

---

## 3. Cloudflare Turnstile (CAPTCHA, free, ~3 min)

1. https://dash.cloudflare.com → top-right, switch to your account
2. Left sidebar → **Turnstile** → **Add site**
3. Settings:
   - **Site name:** `bruecoffeepk`
   - **Domains:** `bruecoffeepk.com`, `*.vercel.app` (so preview deploys work too), and `localhost` if you want to test locally
   - **Widget mode:** **Managed** (Cloudflare decides when to challenge)
4. Click **Create**
5. Copy:
   - **Site Key** → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Vercel
   - **Secret Key** → `TURNSTILE_SECRET_KEY` in Vercel
6. Redeploy

The widget is invisible by default — users only see a checkbox if
Cloudflare's bot detection scores them as suspicious.

---

## 4. Upstash Redis (rate limit storage, free)

1. https://upstash.com → sign in with Google
2. **Create database** → name `brue-ratelimit` → region nearest your
   Vercel deploy (Mumbai or Singapore for PK traffic) → **Free tier**
3. Inside the DB → top tab **REST API**
4. Copy:
   - REST URL → `UPSTASH_REDIS_REST_URL` in Vercel
   - REST Token → `UPSTASH_REDIS_REST_TOKEN` in Vercel
5. Redeploy

Free tier: 10,000 commands/day. Each order = 2 commands → ~5,000
order attempts/day before hitting the cap.

---

## 5. Vercel Firewall rules (free tier covers this)

Goes beyond the per-IP rate limit on `/api/orders` — these rules apply
at the edge BEFORE the request hits your function, so they're free
even when blocked traffic spikes.

Project → **Settings → Firewall**.

### Recommended rules

**Rule A — Geo-fence to Pakistan (and trusted markets)**
> If you only deliver in Karachi, drop everything outside PK at the
> edge. Cheap and effective.

- **Name:** `geo-allow-pk-only`
- **Condition:** `Country` *is not in* `Pakistan`, `United States` *(for you visiting from elsewhere)*
- **Action:** `Challenge` (NOT `Block` — you don't want to brick yourself if you travel)
- **Priority:** 1

**Rule B — Block known bad bot user-agents**

- **Name:** `block-known-bots`
- **Condition:** `User Agent` *contains* `(bot|crawler|spider|scraper|curl|wget|python-requests)` *(use the regex match)*
- **AND** `Path` *starts with* `/api/`
- **Action:** `Block`
- **Priority:** 2

(Legitimate bots like Googlebot don't hit `/api/`, so this is safe.)

**Rule C — Aggressive rate cap on /api/orders at the edge**

- **Name:** `api-orders-edge-cap`
- **Condition:** `Path` *equals* `/api/orders` AND `Request Method` *equals* `POST`
- **Action:** `Rate Limit` → 20 requests / 60 seconds per IP → action: `Block` for 600s
- **Priority:** 3

This is a layer ABOVE the in-app Upstash limit (5/min). Edge limit
catches real flooding that would otherwise burn through your Upstash
quota or your Vercel function invocations.

**Rule D — Block direct Supabase REST traffic from your domain proxy**

Skip this one — Supabase's URL is on supabase.co, not your domain, so
it can't be proxied through Vercel WAF. The RLS lockdown (migration
006) is the protection there.

### How to apply

- After saving, rules go live immediately (no redeploy needed)
- Each rule has a **Test mode** toggle — flip it ON for a few hours,
  watch the **Logs** tab to make sure you're not blocking real traffic,
  then flip OFF to enforce
- Vercel free tier includes WAF with 100k+ blocked requests/month

---

## 6. Verifying everything works

Open the live site, then:

| Test | Expected |
|---|---|
| Browse menu | All 47 drinks load with photos |
| Open browser DevTools console, paste the SELECT * snippet from migration 006 docs | Returns `[]` (empty) |
| Place an order normally | Success, redirects to `/r/<id>` |
| Open `/r/<that-id>` in incognito | Receipt loads |
| Open `/r/<random-uuid-you-made-up>` | 404 |
| `curl` POST `/api/orders` 6 times in 60s | 6th returns 429 |
| Open admin → orders → mark accepted (signed in) | Works |
| Sign out, repeat the action via DevTools | "Unauthorised" error |
| (If Turnstile is on) Open checkout, look at console | Cloudflare `api.js` loads, no errors |

---

## 7. If something breaks

- **Empty menu** → migration 007 not yet applied
- **`/r/[id]` 500** → `SUPABASE_SERVICE_ROLE_KEY` missing in Vercel
- **`/api/orders` 500** → same as above, or Upstash URL/token wrong
- **`/api/orders` 403 "Bot check failed"** → Turnstile site key/secret mismatch (or browser blocking the Cloudflare script)
- **`/api/orders` 429 immediately** → Upstash limiter is working, you tripped your own limit; wait 60s

For each, check Vercel → Project → Logs → Functions, filter to the
endpoint, and read the actual error.
