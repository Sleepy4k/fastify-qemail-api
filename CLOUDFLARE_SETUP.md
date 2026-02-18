# Cloudflare Setup Guide – QEmail

Panduan lengkap untuk menghubungkan backend QEmail dengan Cloudflare Email Routing.

---

## Prasyarat

- Domain sudah di-manage di Cloudflare (nameserver pointing ke CF)
- Cloudflare account dengan akses ke zona domain tersebut
- Node.js ≥ 20 atau Bun ≥ 1.0 terinstall
- Backend API sudah berjalan dan bisa diakses publik (HTTPS)

---

## Bagian 1 – Cloudflare API Token

1. Buka **dash.cloudflare.com → My Profile → API Tokens**
2. Klik **Create Token** → pilih template **Edit zone DNS** atau buat custom:
   - **Zone:Email Routing** → Edit
   - **Zone:Zone** → Read
   - **Account:Email Routing Addresses** → Edit
   - Zone Resources: Include → Specific zone → pilih domain kamu
3. Salin token yang muncul (hanya tampil sekali)
4. Masukkan ke file `.env` backend:

```env
CF_API_TOKEN=your_token_here
CF_ACCOUNT_ID=your_account_id_here   # dari URL dashboard, bukan zone ID
CF_WEBHOOK_SECRET=buat-random-string-panjang
CF_WORKER_NAME=qemail-worker
```

> **CF_ACCOUNT_ID** ada di sidebar kanan dashboard Cloudflare, bagian "Account ID".

---

## Bagian 2 – Jalankan Migrasi Database

```bash
# Jalankan migrasi awal (jika belum)
bun run db:migrate

# Jalankan migrasi kedua (tambah kolom cloudflare_rule_id)
# Eksekusi langsung ke MySQL:
mysql -u root -p qemail_db < database/migrations/002_cloudflare_sync.sql
```

---

## Bagian 3 – Deploy Cloudflare Worker

### 3.1 Install Wrangler

```bash
cd cloudflare-worker
npm install -g wrangler
# atau
npx wrangler --version
```

### 3.2 Login ke Cloudflare

```bash
npx wrangler login
```

Browser akan terbuka untuk otorisasi. Setelah berhasil, lanjutkan.

### 3.3 Set secrets Worker

```bash
# Jalankan dari folder cloudflare-worker/
npx wrangler secret put API_ENDPOINT
# → masukkan: https://api.yourdomain.com/api/v1/webhook/incoming-email

npx wrangler secret put WEBHOOK_SECRET
# → masukkan: nilai yang sama dengan CF_WEBHOOK_SECRET di backend .env
```

### 3.4 Deploy Worker

```bash
npx wrangler deploy
```

Output sukses:
```
✅ Successfully published your script 'qemail-worker'
```

Catat nama Worker (`qemail-worker`) – ini adalah nilai `CF_WORKER_NAME` di `.env`.

---

## Bagian 4 – Aktifkan Email Routing pada Domain

### 4.1 Via Dashboard Cloudflare (manual, pertama kali)

1. Buka **dash.cloudflare.com → pilih domain → Email → Email Routing**
2. Klik **Enable Email Routing**
3. Cloudflare akan meminta kamu menambah DNS records MX. Klik **Add records automatically**
4. Tunggu status menjadi **Active**

### 4.2 Via API (otomatis saat createDomain)

Setelah konfigurasi `CF_API_TOKEN` yang benar, endpoint admin `POST /api/v1/admin/domains` akan:
1. Memverifikasi zone aktif di CF
2. Memanggil `enableEmailRouting` otomatis
3. Menyimpan ke database

---

## Bagian 5 – Konfigurasi Email Routing Rules

Setiap kali user membuat temp email baru via `POST /api/v1/email/generate`, backend secara otomatis:

1. Membuat **Email Routing Rule** di CF untuk alamat tersebut (forward ke Worker)
2. Menyimpan `cloudflare_rule_id` ke database
3. Saat akun dihapus, rule CF ikut dihapus

### Verifikasi via Dashboard

1. **dash.cloudflare.com → domain → Email → Email Routing → Routing Rules**
2. Kamu akan melihat rules berbentuk:
   ```
   alice@yourdomain.com  →  Worker: qemail-worker
   ```

---

## Bagian 6 – Alur Kerja Lengkap

```
[Email masuk ke alice@yourdomain.com]
         ↓
[Cloudflare Email Routing]
         ↓  (match rule: alice@yourdomain.com → Worker)
[qemail-worker / index.ts]
         ↓  POST https://api.yourdomain.com/api/v1/webhook/incoming-email
         ↓  Header: X-Webhook-Secret: <CF_WEBHOOK_SECRET>
[Fastify Backend / WebhookController]
         ↓  verifikasi secret
         ↓  cari account by email di DB
         ↓  INSERT ke tabel emails
[User fetch inbox via GET /api/v1/email/inbox/:token]
```

---

## Bagian 7 – Variabel Environment Lengkap

```env
# Backend .env
CF_API_TOKEN=eyJhbGci...          # API Token dari dash.cloudflare.com
CF_ACCOUNT_ID=abc123def456        # Account ID (bukan Zone ID)
CF_WEBHOOK_SECRET=random-secret   # Shared secret antara Worker dan Backend
CF_WORKER_NAME=qemail-worker      # Nama Worker yang di-deploy

# Worker secrets (set via wrangler secret put)
API_ENDPOINT=https://api.yourdomain.com/api/v1/webhook/incoming-email
WEBHOOK_SECRET=random-secret      # Sama dengan CF_WEBHOOK_SECRET di atas
```

---

## Troubleshooting

| Masalah | Kemungkinan Penyebab | Solusi |
|---------|---------------------|--------|
| `POST /generate` error 422 | Zone ID salah atau zona tidak aktif | Pastikan domain sudah di Cloudflare dan Email Routing aktif |
| Worker tidak memforward email | Worker belum di-deploy atau rule belum dibuat | Deploy ulang worker; cek Routing Rules di dashboard |
| Webhook 401 Unauthorized | `WEBHOOK_SECRET` tidak cocok | Pastikan nilai sama di `.env` backend dan `wrangler secret` |
| Inbox kosong meski email terkirim | Account sudah expired atau email dikirim ke alamat salah | Cek `expires_at` di DB; cek `to` address di Worker log |
| CF API error "zone not active" | Domain baru ditambah ke CF dan belum propagasi | Tunggu DNS propagasi (dapat hingga 24 jam) |

### Melihat log Worker secara real-time

```bash
cd cloudflare-worker
npx wrangler tail
```
