# Go live — Vercel (website) + Render (API + database)

No SSH. No Oracle. Estimated time: **1–2 hours**.

| Service | Hosts | URL |
|---------|--------|-----|
| **Vercel** | Next.js website | `https://www.shivshaktibuses.com` |
| **Render** | NestJS API + PostgreSQL | `https://api.shivshaktibuses.com` |
| **GoDaddy** | Domain DNS only | Already owned |

---

## Part 1 — Put code on GitHub (20 min)

### 1a. Create GitHub repo

1. [github.com/new](https://github.com/new)
2. Name: `shiva-sakti` (private recommended)
3. **Do not** add README — create empty repo
4. Copy the repo URL (example: `https://github.com/YOURUSER/shiva-sakti.git`)

### 1b. Push from your PC

PowerShell:

```powershell
cd C:\Users\deyzz\OneDrive\Desktop\ShivaSakti
git init
git add .
git commit -m "Initial commit — ShivaSakti booking platform"
git branch -M main
git remote add origin https://github.com/YOURUSER/shiva-sakti.git
git push -u origin main
```

> `.env` files are gitignored — secrets stay on your PC.

---

## Part 2 — Render: API + database (25 min)

### 2a. Create from Blueprint

1. [render.com](https://render.com) → sign up (GitHub login is easiest)
2. **New +** → **Blueprint**
3. Connect GitHub → select `shiva-sakti` repo
4. Render reads `render.yaml` → **Apply**

Wait for **shivasakti-api** and **shivasakti-db** to deploy (first build ~10 min).

### 2b. Set environment variables

**Render → shivasakti-api → Environment** → add (copy from `deploy/render.env.example`):

| Key | Value |
|-----|--------|
| `CORS_ORIGINS` | `https://www.shivshaktibuses.com,https://shivshaktibuses.com` |
| `APP_PUBLIC_URL` | `https://www.shivshaktibuses.com` |
| `API_PUBLIC_URL` | `https://api.shivshaktibuses.com/api/v1` |
| `PROD_ADMIN_EMAIL` | your admin email |
| `PROD_ADMIN_PASSWORD` | strong password (12+ chars) |
| `EMAIL_FROM` | `bookings@shivshaktibuses.com` |
| `RESEND_API_KEY` | from resend.com |
| `CASHFREE_APP_ID` | production key |
| `CASHFREE_SECRET_KEY` | production key |
| `CASHFREE_WEBHOOK_SECRET` | from Cashfree dashboard |

Click **Save Changes** → service redeploys.

### 2c. Custom domain for API

1. **shivasakti-api → Settings → Custom Domains**
2. Add: `api.shivshaktibuses.com`
3. Render shows a **CNAME** target (example: `shivasakti-api.onrender.com`)

### 2d. Cashfree webhook

```
https://api.shivshaktibuses.com/api/v1/payments/webhook
```

### 2e. Test API

Open (after DNS in Part 4):

```
https://api.shivshaktibuses.com/api/v1/health
```

Should show `"database":"up"`.

---

## Part 3 — Vercel: website (15 min)

### 3a. Import project

1. [vercel.com/new](https://vercel.com/new) → import GitHub `shiva-sakti`
2. **Root Directory:** click Edit → set to **`apps/web`**
3. Framework: **Next.js** (auto-detected)

### 3b. Environment variables

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_API_URL` | `https://api.shivshaktibuses.com/api/v1` |
| `NEXT_PUBLIC_CASHFREE_ENV` | `production` |

### 3c. Deploy

Click **Deploy** → wait ~3–5 min.

### 3d. Custom domains

**Vercel → Project → Settings → Domains**

Add:
- `www.shivshaktibuses.com`
- `shivshaktibuses.com`

Vercel shows DNS records to add in GoDaddy.

---

## Part 4 — GoDaddy DNS (10 min)

GoDaddy → **shivshaktibuses.com** → **DNS**

### For Vercel (website)

Use records **Vercel shows you** (typical setup):

| Type | Name | Value |
|------|------|--------|
| A | `@` | `76.76.21.21` (Vercel — confirm in Vercel dashboard) |
| CNAME | `www` | `cname.vercel-dns.com` (confirm in Vercel dashboard) |

### For Render (API)

| Type | Name | Value |
|------|------|--------|
| CNAME | `api` | `shivasakti-api.onrender.com` (confirm in Render dashboard) |

**Delete** old A records pointing to Oracle IPs (`144.24.141.177`, `129.225.98.90`, etc.).

Wait 15–30 minutes for DNS.

---

## Part 5 — Verify

| Check | URL |
|-------|-----|
| API health | https://api.shivshaktibuses.com/api/v1/health |
| Website | https://www.shivshaktibuses.com |
| Search | Jharsuguda → Bangalore, date **2026-09-23** |
| Admin | https://www.shivshaktibuses.com/admin |
| Fares | Admin → Operations → Seat prices → stop **1 → 9** |

---

## Free tier limits (important)

| Limit | What it means |
|-------|----------------|
| Render **free web** sleeps after ~15 min idle | First visit after sleep takes **30–60 sec** |
| Render **free DB** expires after **90 days** | Upgrade to Starter (~$7/mo) before launch day |
| Vercel hobby | Fine for your traffic |

For real launch day: upgrade Render API to **Starter ($7/mo)** so it never sleeps.

---

## Redeploy after code changes

```powershell
git add .
git commit -m "Your change"
git push
```

Render and Vercel auto-redeploy from GitHub.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails on Render | **Logs** tab — usually missing env var |
| CORS error in browser | Fix `CORS_ORIGINS` on Render |
| Search empty | Check API health; re-run deploy on Render |
| Payment fails | Cashfree production keys + webhook URL |
| Admin login fails | Check `PROD_ADMIN_EMAIL` / `PROD_ADMIN_PASSWORD` on Render |
