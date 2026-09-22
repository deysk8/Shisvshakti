# Go live on Oracle Cloud — FREE forever

Host ShivaSakti at **₹0/month** using Oracle Always Free + your GoDaddy domain.

**Total ongoing cost:** only GoDaddy domain renewal (~once per year).

---

## FRESH START — do only this (checklist)

Use this if SSH failed, IP assign was stuck, or you want to start over.

**Your IP:** use whatever **Public IP** the new instance gets (see Phase 4).  
**Optional:** reserve that new IP so it never changes on reboot.  
**SSH user:** `ubuntu` (not `root`)  
**SSH private key:** `C:\Users\deyzz\.ssh\oracle-shivshakti` (never use `.pub` with ssh)

### On your PC first

```powershell
# Create key pair (skip if file already exists)
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\oracle-shivshakti" -N '""'

# Copy this WHOLE line — paste into Oracle when CREATING the VM
Get-Content "$env:USERPROFILE\.ssh\oracle-shivshakti.pub"
```

- [ ] Copied the `ssh-ed25519 AAAA...` line to Notepad

### Oracle — clean up

- [ ] **Compute → Instances** → terminate **every** old instance
- [ ] *(Optional)* **Networking → Reserved public IPs** → delete or ignore old `144.24.141.177` — you don’t need it

### Oracle — create NEW instance

| Field | Value |
|-------|--------|
| Name | `shivshaktibuses` |
| Image | Ubuntu 24.04 Minimal |
| Shape | VM.Standard.A1.Flex — **1 OCPU, 6 GB** |
| Availability domain | **AD-2** or **AD-3** (if AD-1 full) |
| Network | **Create new virtual cloud network** |
| Subnet | **Create new public subnet** |
| Public IPv4 | **Yes** |
| SSH keys | **Paste public keys** → paste Notepad line |
| | **Do NOT** use “Generate key pair” |

- [ ] Instance state = **Running**

> SSH keys only work if pasted **here at creation**. Edit later does NOT work.

### Oracle — note your NEW public IP

- [ ] Instance **Running** → **Primary VNIC** → copy **Public IP address** (example: `123.45.67.89`)
- [ ] *(Recommended)* Click that IP → **⋮ → Reserve public IP** (keeps it after reboot)

### Oracle — firewall

New instance → Subnet → Security list → add ingress (source `0.0.0.0/0`, TCP):

- [ ] Port **22**
- [ ] Port **80**
- [ ] Port **443**

### GoDaddy DNS

A records → **YOUR_NEW_PUBLIC_IP**: `@`, `www`, `api`

### SSH test (PC)

```powershell
ssh -i "$env:USERPROFILE\.ssh\oracle-shivshakti" ubuntu@YOUR_NEW_PUBLIC_IP
```

- [ ] You see `ubuntu@...:~$`  ← **stop here and tell me “SSH works”**

### Upload + deploy (after SSH works)

**Window 1 — PC:**

```powershell
cd C:\Users\deyzz\OneDrive\Desktop\ShivaSakti
.\scripts\upload-to-server.ps1 -ServerIp YOUR_NEW_PUBLIC_IP -User ubuntu -SshKey "$env:USERPROFILE\.ssh\oracle-shivshakti"
```

**Window 2 — SSH session:**

```bash
cd /opt/shiva-sakti
bash scripts/server-setup.sh
cp deploy/env.production.example .env
cp deploy/api.env.production.example apps/api/.env
nano .env
nano apps/api/.env
bash scripts/deploy-production.sh
```

---

## Overview

```
GoDaddy DNS          Oracle Cloud (free VM)         Docker on VM
────────────         ──────────────────────         ──────────────
@      ──A──►  PUBLIC_IP  ──►  Caddy :443  ──►  Next.js (web)
www    ──A──►  PUBLIC_IP  ──►  Caddy :443  ──►  NestJS (api)
api    ──A──►  PUBLIC_IP  ──►  Caddy :443  ──►  PostgreSQL (db)
```

---

## Part 1 — Create Oracle account (15 min)

1. Open [oracle.com/cloud/free](https://www.oracle.com/cloud/free/)
2. Click **Start for free**
3. Complete signup (email, address, **credit/debit card for verification** — stays on free tier = no charge)
4. Choose **Home Region** close to India if available:
   - **India West (Mumbai)** — best latency
   - **India South (Hyderabad)** — try if Mumbai is full

---

## Part 2 — Create the free server (20 min)

### 2a. Compute instance

1. Oracle Console → **☰ Menu** → **Compute** → **Instances** → **Create instance**

2. **Name:** `shivshaktibuses`

3. **Placement:** keep default compartment

4. **Image:** **Ubuntu 24.04** (or 22.04) — Minimal

5. **Shape:** click **Change shape**
   - **Ampere** → **VM.Standard.A1.Flex** (Always Free-eligible)
   - **OCPUs:** `2`
   - **Memory (GB):** `12`
   - Click **Select shape**

   > Free tier allows up to 4 OCPUs + 24 GB RAM total across all A1 VMs.  
   > 2 OCPUs + 12 GB is enough for ShivaSakti.

6. **Networking**
   - Create new virtual cloud network (default is fine)
   - **Assign a public IPv4 address:** **Yes** ✓

7. **Add SSH keys**
   - **Generate a key pair for me** → Download private key (`.key` file) — keep it safe
   - Or paste your existing public key if you know how

8. **Boot volume:** 50 GB (default is fine)

9. Click **Create**

10. Wait until state = **Running**. Copy the **Public IP address** (example: `132.145.xxx.xxx`)

### 2b. Reserve the public IP (important)

Without this, your IP can change after a reboot and break GoDaddy DNS.

1. **☰ Menu** → **Networking** → **IP Management** → **Reserved public IPs**
2. **Reserve public IP address**
3. Compartment: same as VM → **Reserve**
4. Click the new reserved IP → **⋮** → **Assign** → select instance `shivshaktibuses`
5. Note the **reserved IP** — use this in GoDaddy DNS

### 2c. Open firewall ports (Oracle Security List)

Oracle blocks traffic until you allow ports 80 and 443.

1. On the instance page, click the **Subnet** link (under Primary VNIC)
2. Click the **Security list** link
3. **Add ingress rules** (click **Add ingress rules** for each):

| Source CIDR | IP Protocol | Destination port | Description |
|-------------|-------------|------------------|-------------|
| `0.0.0.0/0` | TCP | `22` | SSH |
| `0.0.0.0/0` | TCP | `80` | HTTP (Let's Encrypt) |
| `0.0.0.0/0` | TCP | `443` | HTTPS |

4. Save

### 2d. If "Out of host capacity" error

Ampere VMs are popular. Try:

- Different **availability domain** (AD-1 → AD-2)
- Different region (Hyderabad instead of Mumbai)
- Retry after a few hours (early morning IST often works)

---

## Part 3 — GoDaddy DNS (5 min)

1. [godaddy.com](https://www.godaddy.com) → **My Products** → **shivshaktibuses.com** → **DNS**

2. Add or edit **A records**:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `YOUR_ORACLE_RESERVED_IP` | 600 |
| A | `www` | `YOUR_ORACLE_RESERVED_IP` | 600 |
| A | `api` | `YOUR_ORACLE_RESERVED_IP` | 600 |

3. **Delete** old `@` / `www` records pointing to GoDaddy parking or website builder

4. Wait **15–30 minutes**, then test:

```powershell
ping www.shivshaktibuses.com
```

Should show your Oracle IP.

---

## Part 4 — Connect to the server (Windows)

### 4a. Fix SSH key permissions (one time)

Save Oracle’s `.key` file to e.g. `C:\Users\deyzz\.ssh\oracle-shivshakti.key`

In PowerShell:

```powershell
icacls "$env:USERPROFILE\.ssh\oracle-shivshakti.key" /inheritance:r
icacls "$env:USERPROFILE\.ssh\oracle-shivshakti.key" /grant:r "$env:USERNAME:(R)"
```

### 4b. SSH in

Replace `YOUR_IP` with reserved public IP:

```powershell
ssh -i "$env:USERPROFILE\.ssh\oracle-shivshakti.key" ubuntu@YOUR_IP
```

> Oracle Ubuntu images use user **`ubuntu`**, not `root`.

---

## Part 5 — Upload your project

### From your PC (new PowerShell window, not SSH):

```powershell
cd C:\Users\deyzz\OneDrive\Desktop\ShivaSakti
.\scripts\upload-to-server.ps1 -ServerIp YOUR_IP -User ubuntu -SshKey "$env:USERPROFILE\.ssh\oracle-shivshakti.key"
```

If you don’t have the upload script updated for SSH key, use manual scp:

```powershell
scp -i "$env:USERPROFILE\.ssh\oracle-shivshakti.key" -r `
  apps, packages, docker, deploy, scripts, docs, package.json, package-lock.json `
  ubuntu@YOUR_IP:/opt/shiva-sakti/
```

### On the server (SSH session):

```bash
sudo mkdir -p /opt/shiva-sakti
sudo chown -R ubuntu:ubuntu /opt/shiva-sakti
# re-upload if needed after chown
cd /opt/shiva-sakti
bash scripts/server-setup.sh
```

---

## Part 6 — Production secrets

On the server:

```bash
cd /opt/shiva-sakti
cp deploy/env.production.example .env
cp deploy/api.env.production.example apps/api/.env
```

Generate random passwords:

```bash
openssl rand -base64 24   # use for POSTGRES_PASSWORD
openssl rand -base64 32   # use for JWT_ACCESS_SECRET
openssl rand -base64 32   # use for JWT_REFRESH_SECRET
openssl rand -base64 16   # use for PROD_ADMIN_PASSWORD
```

Edit both files:

```bash
nano .env
nano apps/api/.env
```

### Minimum fields to fill

**`.env` (root):**
- `POSTGRES_PASSWORD` — strong random password
- `CADDY_ADMIN_EMAIL` — your real email (SSL expiry notices)

**`apps/api/.env`:**
- `DATABASE_URL` — same password as `POSTGRES_PASSWORD` in the URL
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- `PROD_ADMIN_EMAIL` — e.g. `admin@shivshaktibuses.com`
- `PROD_ADMIN_PASSWORD` — strong password (your admin login)
- `CASHFREE_APP_ID` / `CASHFREE_SECRET_KEY` — **Production** keys from [merchant.cashfree.com](https://merchant.cashfree.com)
- `RESEND_API_KEY` — from [resend.com](https://resend.com) (ticket emails)

Save: `Ctrl+O`, Enter, `Ctrl+X`

---

## Part 7 — Deploy (one command)

```bash
cd /opt/shiva-sakti
bash scripts/deploy-production.sh
```

First build takes **10–20 minutes** on Oracle ARM (normal).

Watch progress:

```bash
docker compose -f docker/docker-compose.prod.yml logs -f
```

Press `Ctrl+C` to stop watching logs.

---

## Part 8 — Cashfree webhook

In Cashfree merchant dashboard → **Developers** → **Webhooks**:

```
https://api.shivshaktibuses.com/api/v1/payments/webhook
```

Enable payment success / failure events.

---

## Part 9 — Verify before launch

| Check | URL / action |
|-------|----------------|
| API health | https://api.shivshaktibuses.com/api/v1/health |
| Website | https://www.shivshaktibuses.com |
| Search tomorrow | Jharsuguda → Bangalore, date **2026-09-23** → 1 bus, 7:00 AM |
| Admin login | https://www.shivshaktibuses.com/admin |
| Set fare | Admin → Operations → Seat prices → stop **1 → 9** |
| Test booking | Book 1 seat + pay (small amount test) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Site not loading | DNS not propagated — wait 30 min; confirm A records |
| Connection timeout | Oracle Security List missing ports 80/443 |
| SSL certificate error | DNS must point to server **before** deploy; re-run deploy after DNS works |
| `Out of host capacity` | Try Hyderabad region or different availability domain |
| Docker build slow | Normal on free ARM — wait 15–20 min |
| Payment fails | Cashfree production keys + webhook URL |
| Search shows no buses | Re-run `bash scripts/deploy-production.sh` (seed) |

---

## After go-live

**Restart everything:**

```bash
cd /opt/shiva-sakti
docker compose -f docker/docker-compose.prod.yml restart
```

**View logs:**

```bash
docker compose -f docker/docker-compose.prod.yml logs api --tail 100
```

**Update app later:** upload changed files from PC, then:

```bash
cd /opt/shiva-sakti
docker compose -f docker/docker-compose.prod.yml up -d --build
```

---

## Paste your IP here

When you finish **Part 2**, send me your **reserved public IP** and I’ll reply with the exact GoDaddy DNS rows and a shortened copy-paste deploy checklist.
