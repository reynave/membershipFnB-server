# AI AGENT — PROJECT OVERVIEW

Dokumen ini adalah konteks utama bagi AI Agent baru yang masuk ke project ini. Baca seluruh dokumen sebelum mulai bekerja.

---

## 1. Gambaran Project

Project ini adalah **Membership App** — sistem loyalitas point untuk member yang terhubung ke POS (Point of Sale).

Terdiri dari dua workspace:

| Workspace | Path | Teknologi |
|---|---|---|
| Backend API | `c:\nodejs\membership\server` | Node.js, Express, Socket.IO, MariaDB |
| Frontend App | `c:\nodejs\membership\user` | Angular (standalone components), Tailwind CSS |

---

## 2. Stack & Port

- **Server** berjalan di port `3200` (development)
- **Angular** berjalan di port default Angular dev server (`4200`)
- **Database**: MariaDB lokal, nama database `membership`
- **Swagger docs**: `http://localhost:3200/api-docs`

---

## 3. Struktur Folder Server (`server/`)

```
src/
	server.js              # Entry point Express + Socket.IO
	config/
		db.js                # MySQL pool (getPool)
		loadEnv.js           # Load .env
	controllers/
		v1/pos.controller.js # Controller POS endpoint
		membership/          # Controller untuk membership app
		admin/               # Controller admin office
	modules/
		membership/
			point.service.js   # Logic hitung & simpan point
			redeem.service.js  # Logic redeem point
			auth.service.js    # Login, register member
	routes/
		v1/pos.router.js     # Route POS V1
		membership/          # Route membership app
		admin/               # Route admin
	middleware/
		auth.js              # JWT middleware membership
		authPosV1.js         # Auth middleware POS V1
		attachIo.js          # Inject Socket.IO ke req.io
	sockets/index.js       # Socket.IO handler
AI-agent/
	agent.md               # File ini — onboarding AI
	rules.md               # Aturan query SQL wajib
	table.sql              # Schema + seed data database
	membership-point.md    # Flow perolehan point dari POS
	todo-membership-server.md # Task board server
```

---

## 4. Struktur Folder Angular (`user/`)

```
src/app/
	app.config.ts          # Provider global Angular
	app.routes.ts          # Route definitions (lazy load)
	guards/auth.guard.ts   # canActivate — redirect ke /login jika belum login
	interceptors/auth-token.interceptor.ts  # Auto-inject Bearer token
	services/
		auth-session.service.ts      # Simpan/baca session (localStorage)
		membership-auth.service.ts   # API login/register
		membership-point.service.ts  # API balance + history point
	pages/
		login-welcome/        # Halaman login
		dashboard-member-detail/  # Dashboard utama + point balance
		point-history/        # Riwayat point
		redemption-history/   # Riwayat redeem
		voucher-wallet/       # Daftar voucher
		redeem-voucher-qr/    # QR redeem
		loyalty-bonuses/      # Tier + challenge
		f-b-categories/       # Kategori F&B
		profile-user/         # Profil member
		notification/         # Notifikasi socket real-time
AI-AGENT/
	AGENT-USER.md          # Playbook AI vs Developer
	RULES.md               # Aturan Angular wajib
	TODO-USER.md           # Task board frontend
```

---

## 5. Tabel Database

| Tabel | Fungsi |
|---|---|
| `members` | Data member (tierId, phone, email, password_hash, status, presence) |
| `members_code` | QR/redeem code per member (redeemCode, expDateTime, presence=1 artinya belum dipakai) |
| `tier` | Rule perhitungan point (percentOfCashBack, accumulationAmount, maxPercentOfBill, minAmount) |
| `points` | Semua transaksi point (pointIn, pointOut, archived) |
| `transaction` | Semua transaksi dari POS (bill, totalAmount, totalRedeem, syncType) |
| `users_token` | Token autentikasi POS → mapping ke merchantId |
| `merchant` | Data merchant/outlet |

**Konvensi penting:**
- `presence = 1` → data aktif / belum dihapus
- `archived = 0` → data masih berlaku untuk perhitungan
- `status = 1` → aktif
- Semua query balance point wajib filter `archived = 0`

---

## 6. Endpoint API Aktif

### Membership (dipakai oleh Angular app)

| Method | URL | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/membership/ping` | — | Health check |
| POST | `/api/membership/auth/register` | — | Registrasi member baru |
| POST | `/api/membership/auth/login` | — | Login, return JWT |
| GET | `/api/membership/points/balance` | JWT Bearer | Total point member |
| GET | `/api/membership/points/history` | JWT Bearer | Riwayat point member |

### POS V1 (dipakai oleh software POS)

| Method | URL | Auth | Keterangan |
|---|---|---|---|
| POST | `/api/v1/pos/points/in` | posUserId (body/header/jwt) | Buat transaksi point masuk |
| POST | `/api/v1/pos/redeem` | posUserId | Redeem point member |
| GET | `/api/v1/pos/points/balance` | posUserId | Cek saldo point member |
| GET | `/api/v1/pos/points/history/today` | posUserId | Riwayat point hari ini |

### Admin

| Method | URL | Auth | Keterangan |
|---|---|---|---|
| Berbagai route | `/api/admin/*` | JWT Admin | Manajemen member, report API/HTML berbasis EJS, dll |

---

## 7. Alur Bisnis Utama

### Point Masuk (dari POS)
1. POS kirim POST ke `/api/v1/pos/points/in` dengan body `{ bill, totalAmount, billDate, note, id/phone/email }`
2. Server resolves `posUserId` → query `users_token` → dapat `merchantId`
3. Resolve member by identifier (id / phone / email), auto-create jika by phone dan tidak ditemukan
4. Ambil tier member dari tabel `tier`
5. Hitung point:
	 - Jika `accumulationAmount == 0`: `point = floor(totalAmount * percentOfCashBack / 100)`
	 - Jika `accumulationAmount > 0`: `point = floor(totalAmount / accumulationAmount)`
6. Insert ke `transaction` + `points` dalam 1 DB transaction
7. Emit Socket.IO event `point:in` ke `member:{memberId}`

### Redeem Point (dari POS)
1. POS kirim POST ke `/api/v1/pos/redeem` dengan body `{ redeemCode, amount, transactionId, id/phone/email }`
2. Resolve member (auto-create by phone jika tidak ditemukan)
3. Validasi `amount >= tier.minAmount` (jika minAmount > 0)
4. Hitung `maxRedeemByBill` dari `maxPercentOfBill`
5. Cek saldo point cukup
6. Insert `points.pointOut` + `transaction.totalRedeem` dalam 1 DB transaction
7. Emit Socket.IO event `redeem:success` atau `redeem:failed` ke `member:{memberId}`

---

## 8. Socket.IO

- Room per member: `member:{memberId}`
- Member join room setelah login di Angular
- Events yang diemit server:
	- `point:in` — point masuk dari POS
	- `redeem:success` — redeem berhasil
	- `redeem:failed` — redeem gagal
- Halaman Notification di Angular menampilkan hasil event ini

---

## 9. Aturan Wajib

### Server (lihat `rules.md`)
- Query SQL wajib pakai named parameter dan COALESCE. **Dilarang** raw string concatenation.
- Wajib filter `archived = 0` untuk semua query balance/history point.
- Error response menggunakan `createHttpError(message, statusCode)` pattern.
- Insert transaksi + point harus dalam 1 `connection.beginTransaction()` / `commit()` / `rollback()`.

### Angular (lihat `user/AI-AGENT/RULES.md`)
- Gunakan hanya fitur Angular yang sudah stable/LTS.
- **Dilarang** `loadChildren` di router.
- HTTP request wajib generic `<any>`: `http.get<any>()`, `http.post<any>()`.
- Tombol back wajib `history.back()`, bukan `router.navigate()`.
- Semua page menggunakan standalone components.
- Timezone display: simpan UTC di backend, konversi ke +7 (WIB) di frontend saat tampil.

---

## 10. File Referensi Penting

| File | Isi |
|---|---|
| `server/AI-agent/table.sql` | Schema lengkap + seed data semua tabel |
| `server/AI-agent/membership-point.md` | Flow detail perolehan point dari POS |
| `server/AI-agent/todo-membership-server.md` | Task board backend — cek sebelum mulai |
| `user/AI-AGENT/TODO-USER.md` | Task board frontend — cek sebelum mulai |
| `user/AI-AGENT/AGENT-USER.md` | Playbook pembagian peran AI vs Developer |
| `user/stitchUser/*/code.html` | Desain referensi UI per halaman |
| `server/swagger.json` | Kontrak API (generate ulang: `npm run swagger`) |
| `server/src/reports/templates/*.ejs` | Template report EJS yang bisa diubah customer untuk custom tampilan report |

---

## 11. Konsep Report Admin (EJS First)

Tujuan:
- Report admin dikendalikan dari server menggunakan template EJS.
- Client/customer cukup mengubah file template EJS untuk mengubah tampilan report.
- Angular admin hanya memilih report yang dipanggil dan mengirim filter.

Arsitektur ringkas:
1. Server menyiapkan route report per reportKey.
2. Tiap route memvalidasi auth admin dan filter query (whitelist field).
3. Server ambil data dari DB lalu render template EJS.
4. Endpoint yang sama bisa return HTML atau JSON sesuai kebutuhan.

Konsep frontend Angular:
1. Halaman report memiliki pilihan reportKey dan form filter.
2. Angular memanggil endpoint report di server.
3. Untuk output HTML, Angular merender hasil HTML dari server.
4. Angular tidak menyimpan struktur report hardcoded.

Struktur folder report yang direkomendasikan:
- `src/reports/templates/members-report.ejs`
- `src/reports/templates/redemptions-report.ejs`
- `src/reports/templates/transactions-report.ejs`

Aturan keamanan minimum:
1. Dilarang menerima nama file template langsung dari query user.
2. Wajib pakai report registry: reportKey -> template file -> query builder.
3. SQL wajib parameterized query, dilarang string concatenation.
4. Scope data harus tetap mengikuti role admin dan merchant.

Catatan implementasi:
- Engine Handlebars lama boleh dipertahankan sementara lalu dimigrasi bertahap ke EJS.
- Prioritas implementasi awal: report members sebagai pola standar.

---

## 12. Draft Kontrak Endpoint Report EJS (Simple)

Base URL:
- `/api/admin/reports`

Endpoint 1 - List report yang tersedia
- Method: `GET`
- URL: `/api/admin/reports`
- Auth: JWT Admin
- Tujuan: menampilkan daftar reportKey yang bisa dipanggil Angular.

Contoh response:

```json
{
	"success": true,
	"data": [
		{
			"key": "members",
			"label": "Members Report",
			"supports": ["html", "json"]
		},
		{
			"key": "redemptions",
			"label": "Redemptions Report",
			"supports": ["html", "json"]
		}
	]
}
```

Endpoint 2 - Render report by key
- Method: `GET`
- URL: `/api/admin/reports/:reportKey`
- Auth: JWT Admin
- Query:
	- `format=html|json` (default: `html`)
	- `dateFrom` (optional, format `YYYY-MM-DD`)
	- `dateTo` (optional, format `YYYY-MM-DD`)
	- `merchantId` (optional)
	- `search` (optional)
	- `page` (optional, default `1`, only for json)
	- `limit` (optional, default `50`, max `200`, only for json)

Perilaku response:
1. Jika `format=html`:
	 - `Content-Type: text/html; charset=utf-8`
	 - Body berupa HTML hasil render template EJS.
2. Jika `format=json`:
	 - `Content-Type: application/json`
	 - Body berupa metadata + rows.

Contoh response JSON:

```json
{
	"success": true,
	"meta": {
		"reportKey": "members",
		"generatedAt": "2026-04-22T08:30:00.000Z",
		"page": 1,
		"limit": 50,
		"total": 125
	},
	"filters": {
		"dateFrom": "2026-04-01",
		"dateTo": "2026-04-22",
		"merchantId": null,
		"search": "andi"
	},
	"rows": [
		{
			"id": 101,
			"name": "Andi",
			"email": "andi@mail.com",
			"createdAt": "2026-04-10T03:14:00.000Z"
		}
	]
}
```

Error standar:
- `400` untuk filter tidak valid atau format tidak didukung.
- `401` jika JWT admin tidak valid.
- `403` jika reportKey tidak diizinkan untuk role admin tersebut.
- `404` jika reportKey tidak ditemukan dalam registry.
- `500` untuk error internal.

Catatan registry (wajib):
- reportKey `members` -> template `members-report.ejs` + query builder members.
- reportKey `redemptions` -> template `redemptions-report.ejs` + query builder redemptions.
- reportKey `transactions` -> template `transactions-report.ejs` + query builder transactions.
