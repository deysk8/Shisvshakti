# Go live — www.shivshaktibuses.com (GoDaddy)

**Recommended (free hosting):** [ORACLE-FREE-DEPLOY.md](./ORACLE-FREE-DEPLOY.md) — ₹0/month server + GoDaddy DNS only.

**Paid alternative:** DigitalOcean/Hetzner (~$6–12/month) — steps below.

You need **one small server** (~$6/month) + **3 DNS clicks** in GoDaddy. The app code is ready.

---

## Part A — Buy a server (5 minutes)

1. Go to [DigitalOcean](https://www.digitalocean.com) or [Hetzner](https://www.hetzner.com/cloud) or AWS Lightsail
2. Create a **Ubuntu 24.04** server, **2 GB RAM**, nearest region (Bangalore if available)
3. Note the **public IP** (example: `123.45.67.89`)

---

## Part B — GoDaddy DNS (3 minutes)

1. Login at [godaddy.com](https://www.godaddy.com) → **My Products** → **shivshaktibuses.com** → **DNS**
2. Add or edit these **A records** (TTL: 600 seconds or default):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | YOUR_SERVER_IP | 600 |
| A | `www` | YOUR_SERVER_IP | 600 |
| A | `api` | YOUR_SERVER_IP | 600 |

3. **Delete** any old A records pointing `@` or `www` elsewhere (parking page)
4. Wait 10–30 minutes for DNS to propagate

Test: `ping www.shivshaktibuses.com` should show your server IP.

---

## Part C — Upload project to server

**Option 1 — From your PC (PowerShell):**

```powershell
# Install OpenSSH if needed; replace USER and IP
scp -r C:\Users\deyzz\OneDrive\Desktop\ShivaSakti USER@YOUR_SERVER_IP:/opt/shiva-sakti
```

**Option 2 — Git on server:**

```bash
ssh USER@YOUR_SERVER_IP
sudo mkdir -p /opt/shiva-sakti && sudo chown $USER:$USER /opt/shiva-sakti
git clone YOUR_REPO_URL /opt/shiva-sakti
```

---

## Part D — Server setup (one time)

SSH into the server:

```bash
ssh USER@YOUR_SERVER_IP
cd /opt/shiva-sakti
bash scripts/server-setup.sh
```

---

## Part E — Production secrets

On the server:

```bash
cd /opt/shiva-sakti
cp deploy/env.production.example .env
cp deploy/api.env.production.example apps/api/.env
nano .env          # set POSTGRES_PASSWORD, CADDY_ADMIN_EMAIL
nano apps/api/.env # set JWT secrets, Cashfree PRODUCTION keys, Resend, admin password
```

**Generate random JWT secrets:**

```bash
openssl rand -base64 32
```

**Cashfree (live payments):**

1. [merchant.cashfree.com](https://merchant.cashfree.com) → Production keys
2. Webhook URL: `https://api.shivshaktibuses.com/api/v1/payments/webhook`

---

## Part F — Deploy (one command)

```bash
cd /opt/shiva-sakti
bash scripts/deploy-production.sh
```

Caddy gets **free HTTPS** automatically for www + api.

---

## Part G — Verify before telling customers

1. https://api.shivshaktibuses.com/api/v1/health → `"database":"up"`
2. https://www.shivshaktibuses.com → search tomorrow → 1 bus
3. Book + pay (test with ₹1 seat if possible)
4. Admin login → check booking

---

## What I cannot do from your PC automatically

| Task | Why |
|------|-----|
| Login to GoDaddy | Needs your password |
| Buy a VPS | Needs your payment card |
| Enter Cashfree live keys | Secret — only you should paste them |

**If you give me:** server IP + SSH user/password (or key) **and** open GoDaddy logged in in browser, I can guide each click live.

---

## Quick help

| Problem | Fix |
|---------|-----|
| Site not loading | DNS not propagated yet — wait 30 min |
| SSL error | DNS must point to server before Caddy can get certificate |
| Payment fails | Cashfree production keys + webhook URL |
| Search empty | Re-run `bash scripts/deploy-production.sh` |
