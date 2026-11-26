# AI AGENT — PROJECT OVERVIEW

Dokumen ini adalah konteks utama bagi AI Agent baru yang masuk ke project ini. Baca seluruh dokumen sebelum mulai bekerja.

> Verifikasi terakhir terhadap kode: **2026-11-26**. Kalau ada perubahan kode, update juga bagian dokumen yang terkait (endpoint, tabel, struktur folder, socket).

---

## 1. Gambaran Project

Project ini adalah **Membership App** — sistem loyalitas point untuk member yang terhubung ke POS (Point of Sale).

Terdiri dari tiga workspace:

| Workspace | Path | Teknologi | Fungsi |
|---|---|---|---|
| Backend API | `c:\nodejs\membership\server` | Node.js >= 24, Express 4, Socket.IO 4, mysql2 (MariaDB) | REST API membership, POS V1, admin, report EJS |
| Member App | `c:\nodejs\membership\user` | Angular 18 (standalone), Tailwind CSS 3, `socket.io-client` | Aplikasi member |
| Admin App | `c:\nodejs\membership\admin` | Angular 18 (standalone), Bootstrap 5.3 (CDN), `@ng-bootstrap/ng-bootstrap` 17 | Dashboard admin office |

Catatan penting: **`members` = customer/member**, **`users` = staff/admin**. Dua tabel ini terpisah dan tidak boleh dicampur. Route member ada di `/api/membership`, route admin di `/api/admin`.

---

## 2. Stack & Port

- **Server**: port `3200` di development (dari `server/.env` → `PORT`). Kalau `PORT` tidak diset, kode fallback ke `3000`.
- **Member App (Angular)**: port `4311` (`user/angular.json` → `serve.options.port`).
- **Admin App (Angular)**: port `4310` (`admin/angular.json` → `serve.options.port`).
- **Database**: MariaDB lokal, nama database `membership` (`DB_NAME=membership`), pool `mysql2` dengan `connectionLimit: 10`.
- **Swagger docs**: `http://localhost:3200/api-docs` (generate ulang: `npm run swagger` di folder `server/`).
- **Health check**: `GET /api/health`; root `GET /` → `{ success: true, message: 'Membership API is running' }`.
- **Node.js**: `>= 24` (`server/package.json` → `engines.node`).
- **Timezone**: backend menyimpan datetime apa adanya dari POS; frontend menampilkan dalam +7 (WIB).

### Environment server yang dipakai

| Key | Fungsi |
|---|---|
| `PORT` | Port server (`3200` di dev) |
| `NODE_ENV` | `development` / `production` (production mematikan log error detail) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` | Koneksi MariaDB (port fallback `3306`) |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | JWT member & admin (`360d` di dev) |
| `BCRYPT_SALT_ROUNDS` | Salt bcrypt (`4` di dev) |
| `POS_V1_JWT_REQUIRED` | `true` → `/api/v1/pos/*` wajib Bearer token POS; `false` → middleware auth di-skip |
| `JWT_SECRET_MERCHANT` | Secret tambahan untuk kebutuhan merchant |

---

## 3. Struktur Folder Server (`server/`)

```
src/
	server.js                  # Entry point Express + Socket.IO + Swagger (mount /api/health, /api/admin, /api/membership, /api/v1/pos)
	config/
		db.js                    # Pool mysql2: getPool(), query(), initDatabase()
		loadEnv.js               # Load .env
	controllers/
		v1/pos.controller.js     # Controller POS V1
		membership/              # auth, point, redeem, tiers, promos, vouchers, voucherRedeem, membersVoucher, sample
		admin/                   # admin.members, admin.redemptions, admin.tiers, admin.transactions,
		                         # admin.points, admin.users, admin.vouchers, admin.promos,
		                         # admin.uploads, admin.igourmete-imports, sample
	helpers/
		response.js              # success(res, data, message, status) & fail(res, message, status, errors)
	modules/
		membership/
			point.service.js     # Hitung & simpan point masuk (+ auto-create member by phone)
			redeem.service.js    # Redeem point (legacy & POS V1) + emit socket
			auth.service.js      # Login, register member
		auth/auth.service.js     # Login/register/profil admin (tabel users)
		member/member.service.js # History point untuk route legacy admin/member
		import/
			igourmete-dbf.parser.js
			igourmete.service.js
	routes/
		index.js                 # Router /api (hanya health) — saat ini tidak dipakai server.js
		health.routes.js         # GET /api/health
		v1/pos.router.js         # Route POS V1
		membership/
			index.js             # mount: auth, points, redeem, promos, tiers, vouchers,
			                     # voucher-redeem, members-voucher, ping
			auth.routes.js       # /api/membership/auth/*
			point.routes.js      # /api/membership/points/*
			redeem.routes.js     # /api/membership/redeem/redeem
			tiers.routes.js      # /api/membership/tiers/*
			promos.routes.js     # /api/membership/promos/*
			vouchers.routes.js   # /api/membership/vouchers/*
			voucher-redeem.routes.js   # /api/membership/voucher-redeem
			members-voucher.routes.js  # /api/membership/members-voucher/*
		admin/
			index.js             # mount: auth, member, reports, members, redemptions, tiers,
			                     # transactions, points, uploads, users, vouchers, promos, imports, ping
			auth.routes.js       # /api/admin/auth/*
			member.routes.js     # /api/admin/member/profile, /points/history (legacy)
			reports.routes.js    # /api/admin/reports/*
			admin.members.routes.js
			admin.redemptions.routes.js
			admin.tiers.routes.js
			admin.transactions.routes.js
			admin.points.routes.js
			admin.users.routes.js
			admin.vouchers.routes.js
			admin.promos.routes.js
			admin.uploads.routes.js
			admin.igourmete-imports.routes.js   # di-mount di /api/admin/imports
	middleware/
		auth.js                  # JWT middleware member & admin (Bearer)
		authPosV1.js             # Auth POS V1: lookup Bearer token ke users_token + merchant
		attachIo.js              # Inject Socket.IO ke req.io
		errorHandler.js          # Global error handler (pakai err.statusCode)
		validateRequest.js       # Hasil express-validator -> 422
	sockets/index.js           # Socket.IO handler (member:join, ping/pong)
	reports/templates/         # EJS: members-report, transactions-daily-report, members-logs, users-logs
public/upload/               # Upload gambar (disajikan sebagai /public/upload/<file>)
scripts/                     # Smoke test import igourmete (service + HTTP)
AI-agent/                    # Dokumen onboarding & task board (lihat bagian 10)
ARCHIVED/                    # Stack import CSV lama (member-sales) — tidak dipakai
swagger.json                 # Kontrak API (generate: npm run swagger)
swagger-config.js            # Konfigurasi swagger-autogen
```

Catatan:
- `initDatabase()` ada di `config/db.js`, tetapi pemanggilannya di `server.js` di-comment → tabel **tidak** dibuat otomatis dari kode. Schema sumber kebenaran: `AI-agent/table.sql`.
- Envelope respons standar: `{ success, message, data }` (helper `helpers/response.js`). Pengecualian: report JSON `{ success, meta, filters, rows }`.
- Error dari service dilempar sebagai `Error` dengan `statusCode`, lalu diubah `errorHandler` menjadi `{ success: false, message }`.

---

## 4. Struktur Folder Frontend

### 4.1 Member App (`user/`)

```
src/app/
	app.config.ts
	app.routes.ts          # Semua route pakai loadComponent (bukan loadChildren)
	guards/auth.guard.ts
	interceptors/auth-token.interceptor.ts
	services/
		auth-session.service.ts      # Simpan/baca session (localStorage)
		membership-auth.service.ts   # API login/register
		membership-point.service.ts  # API balance + history point
		socket.service.ts            # Koneksi Socket.IO
		socket-notification.service.ts # Handler notifikasi real-time
	pages/
		login-welcome/
		dashboard-member-detail/
		point-history/
		redemption-history/
		voucher-wallet/
		vouchers/            # list (`/vouchers`) + detail (`/vouchers/:id`)
		redeem-voucher-qr/
		loyalty-bonuses/
		f-b-categories/
		profile-user/
		notification/
		promos/              # list (`/promos`) + detail (`/promos/:id`)
		my-gift/             # `/my-gift`
		my-gift-detail/      # `/my-gift/:id`
AI-AGENT/
	AGENT-USER.md          # Playbook AI vs Developer
	RULES.md               # Aturan Angular wajib
	TODO-USER.md           # Task board frontend
	table.sql              # Salinan schema untuk referensi frontend
stitchUser/*/code.html   # Desain referensi UI per halaman
```

Route member (dari `user/src/app/app.routes.ts`): `login`, `dashboard`, `loyalty-bonuses`, `categories`, `vouchers`, `vouchers/:id`, `my-gift`, `my-gift/:id`, `voucher-wallet`, `redeem-voucher-qr`, `redemption-history`, `point-history`, `promos`, `promos/:id`, `profile`, `notification`. Path kosong dan `**` redirect ke `dashboard`; route selain `login` memakai `authGuard`.

### 4.2 Admin App (`admin/`)

```
src/app/
	app.config.ts
	app.routes.ts          # Semua route pakai component/import langsung (bukan loadChildren)
	core/
		guards/auth.guard.ts
		interceptors/auth-token.interceptor.ts
		layout/admin-shell.component.ts|html
		services/auth-session.service.ts
	features/
		auth/login/
		members/list/ + detail/          # termasuk voucherHistory
		redemptions/list/ + detail/
		tiers/list/
		transactions/list/ + detail/
		points/list/ + detail/           # route `/point`, `/point/:id`
		vouchers/list/ + detail/
		promos/list/ + detail/
		users/list/ + detail/            # admin users + POS token
		reports/                         # report EJS (html/json)
		igourmete/ + batch/              # import DBF
AI-AGENT/
	AGENT-ADMIN.md         # Onboarding admin + aturan ng-bootstrap
	RULES-ADMIN.md         # Aturan Angular admin
	TODO-ADMIN.md          # Task board frontend admin
	CSV-sales-report.md    # Dokumen lama; stack import CSV sudah diarsipkan
```

Route admin (dari `admin/src/app/app.routes.ts`): `login`, lalu di dalam `AdminShellComponent` (dengan `authGuard`): `members`, `members/:id`, `redemptions`, `redemptions/:id`, `tiers`, `transactions`, `transactions/:id`, `vouchers`, `vouchers/:id`, `promos`, `promos/:id`, `users`, `users/:id`, `reports`, `point`, `point/:id`, `igourmete`, `igourmete/:batchId`. Default redirect ke `members`.

Catatan admin app:
- Bootstrap **5.3.8** (CSS + `bootstrap.bundle.min.js`) dan `bootstrap-icons` dimuat lewat CDN di `admin/src/index.html`; `angular.json` build hanya memakai `src/styles.css` (entri `node_modules/bootstrap/...` hanya ada di konfigurasi Karma/test).
- Komponen interaktif memakai `@ng-bootstrap/ng-bootstrap` v17 (di-import per komponen standalone).
- Label/teks UI admin memakai bahasa Inggris (lihat `AGENT-ADMIN.md`).

---

## 5. Tabel Database

Sumber kebenaran schema + seed: `AI-agent/table.sql`. Dump master lengkap (besar): `AI-agent/membership-master-table.sql`.

| Tabel | Fungsi |
|---|---|
| `members` | Data member/customer (tierId, phone, email, password_hash, status, verified, activated, presence) |
| `members_code` | QR/redeem code per member (redeemCode, expDateTime, presence=1 artinya belum dipakai) |
| `members_logs` | Log login member (`userId` → `members.id`, note, success) |
| `members_voucher` | Voucher milik member (voucherId, barcode, amount, expiredDate, used, usedDate, usedMarchantId) |
| `tier` | Rule point & tier (percentOfCashBack, accumulationAmount, minAmount, maxPercentOfBill, requirementTransactionOfTier) |
| `points` | Buku besar point (pointIn, pointOut, transactionId, memberId, merchantId, tierId, archived, presence) |
| `transaction` | Transaksi POS (bill, totalAmount, totalRedeem, redeemCode, approvalCode, billDate, syncType, memberId VARCHAR, archived) |
| `users` | Akun admin/staff (name, email, password_hash) |
| `users_logs` | Log login admin |
| `users_token` | Token POS opaque (`pos_live_*`) → mapping ke `merchantId` |
| `merchant` | Data merchant/outlet |
| `voucher` | Master voucher (pointsRequired, pointsAmount, startDate, endDate, quota, presence) |
| `voucher_merchant` | Scope merchant per voucher (kolom `marchantId`, salah eja historis; ada `quota` per merchant); kosong = global |
| `promo` | Master promo (birthdayMember, birthdayAfter, birthdayBefore, startDate, endDate, presence) |
| `promo_merchant` | Scope merchant per promo; kosong = global |
| `import_batch`, `import_line`, `import_member` | Sisa stack import CSV yang sudah diarsipkan (tidak dipakai) |
| `dbf_import_batch` | Staging batch import DBF Igourmate |
| `dbf_igourmete_daily` | Baris staging DBF harian (checkUid, member, checkDate, checkNo, checkTot, timeOpen, rawJson) |

`dbf_import_batch` + `dbf_igourmete_daily` DDL-nya ada di `AI-agent/igourmete-dbf-staging.sql` (tidak ada di `table.sql`).

**Konvensi penting:**
- `presence = 1` → data aktif / belum dihapus
- `archived = 0` → data masih berlaku untuk perhitungan
- `status = 1` → aktif
- Semua query balance/history point wajib filter `archived = 0` (dan umumnya `presence = 1`)
- Saldo point = `SUM(pointIn) - SUM(pointOut)`

**Jebakan tipe data:**
- `transaction.memberId` bertipe `VARCHAR`, sedangkan `members.id` bertipe `INT`. Selalu konversi (`String(memberId)` / cast) saat membandingkan atau join.
- `voucher_merchant.marchantId` (salah eja) sudah dipakai di kode dan UI; jangan diganti tanpa migrasi.
- `members_voucher.usedMarchantId` juga memakai ejaan `Marchant`.

---

## 6. Endpoint API Aktif

### 6.1 Membership (dipakai oleh Member App)

| Method | URL | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/membership/ping` | — | Health check jalur membership |
| POST | `/api/membership/auth/register` | — | Registrasi member baru (`name`, `email`, `password`) |
| POST | `/api/membership/auth/login` | — | Login member, return JWT |
| POST | `/api/membership/points/transactions` | header `token` | Point masuk dari POS (legacy: `token` = `users_token.token`, `memberId` wajib di body) |
| GET | `/api/membership/points/balance` | JWT Bearer | Balance member (`{ memberId, balancePoint }`) |
| GET | `/api/membership/points/history` | JWT Bearer | Riwayat point member |
| POST | `/api/membership/redeem/redeem` | header `token` | Redeem point dari POS (legacy: `redeemCode`, `amount`, `transactionId`) |
| GET | `/api/membership/tiers` | JWT Bearer | Daftar tier aktif (route memakai `auth`) |
| GET | `/api/membership/tiers/progress` | JWT Bearer | Progress tier member |
| POST | `/api/membership/tiers/upgrade` | JWT Bearer | Upgrade tier jika `canUpgrade = true` |
| GET | `/api/membership/promos` | — | List promo (auth masih di-comment di route) |
| GET | `/api/membership/promos/:id` | — | Detail promo |
| GET | `/api/membership/vouchers` | — | Katalog voucher (auth masih di-comment di route) |
| GET | `/api/membership/vouchers/:id` | — | Detail voucher + `selectedMerchants` |
| POST | `/api/membership/voucher-redeem` | JWT Bearer | Tukar point dengan voucher → insert `members_voucher` + `points.pointOut` |
| GET | `/api/membership/members-voucher` | JWT Bearer | List voucher milik member |
| GET | `/api/membership/members-voucher/history` | JWT Bearer | Riwayat voucher member |
| GET | `/api/membership/members-voucher/:id` | JWT Bearer | Detail voucher member (+ `usedMerchantName`) |

### 6.2 POS V1 (dipakai software POS)

Middleware `authPosV1` hanya aktif kalau `POS_V1_JWT_REQUIRED=true` (default di `.env` dev: `true`). Token POS = opaque token `pos_live_*` yang disimpan di `users_token.token`, dan merchant harus `status = 1` + `presence = 1`.

Aturan request:
- Identitas POS (`posUserId`): dari `req.posUser.id` (hasil lookup token), fallback header `x-pos-user-id`, fallback body `userId`, default `'1'`.
- Identifier member: isi **tepat satu** dari `id` / `phone` / `email` (query untuk GET, body untuk POST). Kosong atau lebih dari satu → `422`.

| Method | URL | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/v1/pos/members/balance` | Bearer POS | Saldo point member (query `id`/`phone`/`email`) |
| GET | `/api/v1/pos/members/history/today` | Bearer POS | Riwayat point hari ini |
| POST | `/api/v1/pos/points/in` | Bearer POS | Point masuk (`bill`, `totalAmount`, `billDate`, `note`, identifier) |
| POST | `/api/v1/pos/redeem` | Bearer POS | Redeem point (`amount`, `transactionId`, identifier) |
| POST | `/api/v1/pos/redeem-voucher` | Bearer POS | Tandai voucher member terpakai berdasarkan `barcode` |

Contoh body point masuk:

```json
{
  "bill": "TA1",
  "totalAmount": 500000,
  "billDate": "2026-04-16T07:34:32Z",
  "note": "POS paid transaction",
  "phone": "08123456789"
}
```

### 6.3 Admin (dipakai Admin App)

Auth admin = JWT Bearer dari `POST /api/admin/auth/login` (tabel `users`).

| Method | URL | Auth | Keterangan |
|---|---|---|---|
| POST | `/api/admin/auth/register` | — | Registrasi akun admin |
| POST | `/api/admin/auth/login` | — | Login admin, return JWT |
| GET | `/api/admin/ping` | — | Health check jalur admin |
| GET | `/api/admin/member/profile` | JWT | Profil user admin yang login |
| GET | `/api/admin/member/points/history` | JWT | History point untuk user admin |
| GET | `/api/admin/members` | JWT | List member (search/filter/pagination) |
| GET | `/api/admin/members/:id` | JWT | Detail member + balance + history + `voucherHistory` |
| GET | `/api/admin/redemptions` | JWT | List redeem point |
| GET | `/api/admin/redemptions/:id` | JWT | Detail redeem |
| GET | `/api/admin/tiers` | JWT | List tier |
| GET | `/api/admin/transactions` | JWT | Ledger transaksi (tabel utama `transaction`, point diagregasi per `transactionId`, filter search/type/rentang tanggal) |
| GET | `/api/admin/transactions/:id` | JWT | Detail transaksi by `transaction.id` |
| GET | `/api/admin/points` | JWT | Buku besar point + filter (search/type/archived/rentang tanggal) + `summary` |
| GET | `/api/admin/points/:id` | JWT | Detail satu baris `points` (join bill, member, merchant, tier) |
| GET | `/api/admin/users` | JWT | List admin user + ringkasan token |
| POST | `/api/admin/users` | JWT | Create admin user |
| GET | `/api/admin/users/:id` | JWT | Detail user + tokens + merchant aktif |
| PUT | `/api/admin/users/:id` | JWT | Update user |
| DELETE | `/api/admin/users/:id` | JWT | Soft delete user |
| POST | `/api/admin/users/:id/tokens` | JWT | Buat token POS (`pos_live_*`) |
| DELETE | `/api/admin/users/:id/tokens/:tokenId` | JWT | Revoke token POS |
| GET | `/api/admin/vouchers` | JWT | List voucher |
| POST | `/api/admin/vouchers` | JWT | Create voucher |
| GET | `/api/admin/vouchers/:id` | JWT | Detail voucher + merchant scope |
| PUT | `/api/admin/vouchers/:id` | JWT | Update voucher |
| PUT | `/api/admin/vouchers/:id/merchants` | JWT | Set relasi `voucher_merchant` (kosong = global) |
| DELETE | `/api/admin/vouchers/:id` | JWT | Soft delete voucher (`presence = 0`) |
| GET | `/api/admin/promos` | — | List promo (**auth masih di-comment**) |
| POST | `/api/admin/promos` | — | Create promo (**auth masih di-comment**) |
| GET | `/api/admin/promos/:id` | — | Detail promo (**auth masih di-comment**) |
| PUT | `/api/admin/promos/:id` | — | Update promo (**auth masih di-comment**) |
| PUT | `/api/admin/promos/:id/merchants` | — | Set relasi `promo_merchant` (**auth masih di-comment**) |
| DELETE | `/api/admin/promos/:id` | — | Soft delete promo (**auth masih di-comment**) |
| POST | `/api/admin/uploads/image` | JWT | Upload gambar (multipart field `image`, max 5 MB) → `{ fileName, url }`, URL `/public/upload/<file>` |
| GET | `/api/admin/imports/igourmete` | JWT | List batch import DBF |
| POST | `/api/admin/imports/igourmete` | JWT | Upload file `.dbf` (multipart field `file`, max 20 MB) |
| GET | `/api/admin/imports/igourmete/:batchId` | JWT | Detail batch + schema kolom |
| GET | `/api/admin/imports/igourmete/:batchId/rows` | JWT | Baris staging (page/pageSize/severity/search) |
| POST | `/api/admin/imports/igourmete/:batchId/commit` | JWT | Commit baris ke tabel `transaction` |
| DELETE | `/api/admin/imports/igourmete/:batchId` | JWT | Hapus batch `STAGED` |
| GET | `/api/admin/reports` | — | List report registry (**auth masih di-comment**) |
| GET | `/api/admin/reports/:reportKey` | — | Render report `html`/`json` (**auth masih di-comment**) |

Catatan keamanan (penting):
- Route yang masih memakai `/*auth,*/` **belum** terproteksi: `routes/admin/reports.routes.js`, `routes/admin/admin.promos.routes.js`, `routes/membership/promos.routes.js`, `routes/membership/vouchers.routes.js`. Perlakukan sebagai TODO, bukan kontrak final.
- Detail kontrak import DBF: `AI-agent/igourmate-dbf-import.md`.
- Detail integrasi POS untuk tim eksternal: `server/POS-INTEGRATION.md`.

---

## 7. Alur Bisnis Utama

### 7.1 Point Masuk (akumulasi belanja)

Perhitungan point (`calculatePoint` di `point.service.js`):

```
point = floor( totalAmount * percentOfCashBack / accumulationAmount )
```

Contoh: `percentOfCashBack = 5`, `accumulationAmount = 100` → belanja 500.000 menghasilkan `floor(500000 * 5 / 100) = 25000` point.

Alur POS V1 (`POST /api/v1/pos/points/in`):
1. Middleware `authPosV1` (jika `POS_V1_JWT_REQUIRED=true`) → `req.posUser = { id, merchantId }`.
2. `resolveMerchantByAccess()` — pakai `merchantId` dari token; kalau 0, fallback ke `users_token` terbaru milik `posUserId`.
3. `resolveMemberByIdentifier()` dengan `autoCreateByPhone: true` — kalau `phone` tidak ditemukan, member dibuat otomatis (`Guest <4 digit akhir phone>`, email `auto-...@guest.membership.local`, tier aktif pertama, password acak bcrypt). Member lama yang `status`/`presence` bukan 1 akan diaktifkan kembali.
4. Ambil tier aktif member (`status = 1`, `presence = 1`); tidak ada → `404/422`.
5. Hitung point, lalu insert `transaction` + `points` (`pointIn`) dalam satu DB transaction (`syncType = 'api'`).
6. Emit `point:in` ke room `member:{memberId}`.

Alur legacy (`POST /api/membership/points/transactions`): header `token` divalidasi ke `users_token`, `memberId` **wajib** di body (tanpa auto-create), tidak emit socket.

### 7.2 Redeem Point

POS V1 (`POST /api/v1/pos/redeem`), field: `amount`, `transactionId`, identifier member.

1. Resolve member (auto-create by phone) + tier (`minAmount`, `maxPercentOfBill`).
2. `minAmount > 0` dan `amount < minAmount` → `400 Minimum redeem amount is X`.
3. `totalAmount = amount` (di V1, `amount` diperlakukan sebagai nilai bill), lalu `maxRedeemByBill = floor(amount * maxPercentOfBill / 100)`; kalau `<= 0` → `400`.
4. Cek saldo: `SUM(pointIn) - SUM(pointOut)` (`archived = 0`) harus `>= maxRedeemByBill`, kalau tidak → `400 Insufficient point balance`.
5. Insert `points` (`pointOut = maxRedeemByBill`) + `transaction` (`totalRedeem = maxRedeemByBill`, `approvalCode` di-generate) dalam satu DB transaction.
6. Emit `redeem:success` / `redeem:failed`; respons mengembalikan `{ point: maxRedeemByBill, approvalCode, maxPercentOfBill, maxAllowedPoint, totalAmount }`.

> Perhatian: yang **dipotong** adalah `maxRedeemByBill`, bukan `amount`. `amount` hanya dipakai untuk validasi minimum dan sebagai basis perhitungan bill.

Legacy (`POST /api/membership/redeem/redeem`), field: `redeemCode` (wajib), `amount`, `transactionId`, opsional `phone`.
1. `redeemCode` harus ada di `members_code`; tidak ada → `404`, `presence = 0` → `410 has been used`, lewat `expDateTime` → `410 has expired`.
2. Member dari `members_code.memberId`; kalau tidak aktif dan `phone` dikirim → auto-create dan `members_code.memberId` di-update.
3. Cek saldo `>= amount`; insert `points` (`pointOut = amount`) + `transaction` (`bill = transactionId`, `totalAmount = 0`, `totalRedeem = amount`).
4. `UPDATE members_code SET presence = 0` (code hangus).
5. Emit `redeem:success` / `redeem:failed`.

### 7.3 Redeem Voucher

Member app (`POST /api/membership/voucher-redeem`, body `{ voucherId }`):
1. Ambil voucher (`pointsRequired`, `pointsAmount`, `endDate`); `pointsRequired` tidak valid → `422`.
2. Barcode = `V-{voucherId}-M-{memberId}-{Date.now().toString(36)}`.
3. `expiredDate` = `voucher.endDate` atau 1 tahun dari sekarang; `amount` = `pointsRequired`.
4. Cek saldo member `>= pointsRequired`, lalu dalam satu DB transaction insert `members_voucher` + `points` (`pointOut = pointsRequired`).

POS (`POST /api/v1/pos/redeem-voucher`, body `{ barcode }`):
1. `barcode` kosong → `422`; cari `members_voucher` dengan `barcode = ? AND presence = 1`; tidak ada → `404`.
2. `used != 0` → `409 Voucher already used`.
3. `UPDATE members_voucher SET used = 1, usedDate = ?, updateDate = ?, usedMarchantId = ?`.

### 7.4 Tier

- `GET /api/membership/tiers` → daftar tier aktif.
- `GET /api/membership/tiers/progress` → total belanja/transaksi member vs `requirementTransactionOfTier` + `accumulationAmount`, plus `canUpgrade`.
- `POST /api/membership/tiers/upgrade` → hanya jalan kalau `canUpgrade = true`; kalau tidak → `400`.

---

## 8. Socket.IO

File: `src/sockets/index.js` (`registerSocketHandlers(io)`), CORS `origin: '*'`, path default `/socket.io`.

| Arah | Event | Payload | Keterangan |
|---|---|---|---|
| server → client | `socket:connected` | `{ socketId, at }` | Dikirim saat client connect |
| client → server | `member:join` | `memberId` | Join room `member:{memberId}` |
| client → server | `ping` | — | Server balas `pong` `{ at }` |
| server → client | `point:in` | `{ transactionId, pointIn, bill, totalAmount, tier, timestamp }` | Setelah point masuk berhasil (POS V1) |
| server → client | `redeem:success` | `{ point, approvalCode, status: 'success', redeemCode?/transactionId?, timestamp }` | Redeem point berhasil |
| server → client | `redeem:failed` | `{ status: 'failed', message, redeemCode?/transactionId?, timestamp }` | Redeem gagal (hanya kalau `error.statusCode` ada) |

Catatan:
- Emit selalu ke room `member:{memberId}`, bukan broadcast global.
- Member App: `services/socket.service.ts` (koneksi) + `services/socket-notification.service.ts` (handler); halaman `notification` menampilkan event yang masuk.
- Dokumentasi integrasi untuk tim lain: `server/SOCKET-INTEGRATION.md`.

---

## 9. Aturan Wajib untuk AI Agent

### 9.1 Backend (Node/Express/MySQL)

1. **Query parameterized.** Selalu pakai placeholder `?` lewat `connection.execute(sql, params)` atau helper `query()`. Dilarang menyisipkan nilai dari user langsung ke string SQL.
2. **Identifier tabel/kolom dinamis** (mis. `field` pada lookup member) hanya boleh berasal dari whitelist internal, bukan dari input.
3. **`LIMIT`/`OFFSET`** di endpoint list/report diinterpolasi setelah divalidasi `Number.parseInt` dan dibatasi (`MAX_LIMIT = 200`). Ikuti pola yang sudah ada di `admin.*.controller.js`.
4. **Filter point wajib.** Semua perhitungan saldo/history memakai `archived = 0` (dan `presence = 1` untuk master data). Saldo = `SUM(pointIn) - SUM(pointOut)`.
5. **Transaksi DB.** Setiap operasi yang menulis lebih dari satu tabel (`transaction` + `points`, `members_voucher` + `points`) wajib `beginTransaction()` / `commit()` / `rollback()` dan `finally { connection.release() }`.
6. **Error handling.** Service melempar `createHttpError(message, statusCode)` (helper lokal di `point.service.js` & `redeem.service.js`) lalu `errorHandler` mengubahnya jadi `{ success: false, message }` dengan status yang sama. Validasi request memakai `fail(res, message, 422, errors)`.
7. **Envelope respons.** Sukses: `success(res, data, message, statusCode)` → `{ success: true, message, data }`. Jangan mengembalikan bentuk lain kecuali report (`{ success, meta, filters, rows }`) dan render HTML EJS.
8. **Jangan mencampur `members` dan `users`.** Token member hanya valid untuk `/api/membership`, token admin hanya untuk `/api/admin`, token POS hanya untuk `/api/v1/pos`.
9. **Jangan hardcode kredensial.** Semua secret/DB config lewat `.env` (`config/loadEnv.js`).
10. **Jangan mengubah schema dari kode.** `initDatabase()` tidak dipanggil; perubahan tabel dilakukan di `AI-agent/table.sql` + migrasi manual.
11. **Route baru** didaftarkan di `src/server.js` (mount point) → file router di `src/routes/...` → controller → service. Ikuti pemisahan layer yang sudah ada. Catatan realita kode: hanya `point`, `redeem`, `auth`, `member`, dan `import` yang punya service sendiri; controller `tiers`, `promos`, `vouchers`, dan sebagian besar `admin.*` masih memuat query SQL langsung. Untuk perubahan besar, pertimbangkan memindahkan SQL ke service baru tanpa memecah pola endpoint lama.
12. **Soft delete** memakai `presence = 0` (bukan `DELETE`), konsisten dengan implementasi voucher/promo/user.

### 9.2 Frontend (Angular 18, standalone)

1. **Standalone components** + `loadComponent` di route. Tidak ada `NgModule` baru.
2. **State via service + `localStorage`** (`auth-session.service.ts`); jangan menyimpan token di tempat lain.
3. **HTTP lewat `HttpClient`** dengan `auth-token.interceptor.ts` yang menambahkan header `Authorization: Bearer <token>`.
4. **API base URL** memakai environment (`apiBaseUrl`), jangan hardcode `localhost` di service.
5. **Tailwind (member) / Bootstrap + ng-bootstrap (admin)** sesuai workspace; jangan mencampur dua sistem di satu app.
6. **Ikuti desain referensi**: `user/stitchUser/*/code.html` untuk member app.
7. **Angular 18 API**: `@if`/`@for` boleh dipakai; `*ngIf`/`*ngFor` juga masih ada di kode lama — ikuti file yang sedang diedit agar konsisten.
8. **Socket** hanya lewat `socket.service.ts`; jangan buka koneksi baru di komponen.

---

## 10. Referensi Dokumen

| Dokumen | Isi |
|---|---|
| `server/AI-agent/agent-server.md` | Dokumen ini — konteks utama project |
| `server/AI-agent/rules.md` | Aturan query SQL wajib (ringkasan; detail di bagian 9) |
| `server/AI-agent/table.sql` | Schema + seed database |
| `server/AI-agent/igourmete-dbf-staging.sql` | DDL tabel staging import DBF |
| `server/AI-agent/membership-point.md` | Flow point masuk dari POS (jalur legacy `/api/membership/points/transactions`) |
| `server/AI-agent/igourmate-dbf-import.md` | Kontrak import DBF Igourmate (endpoint, kolom, severity, commit) |
| `server/AI-agent/todo-membership-server.md` | Task board backend membership |
| `server/AI-agent/todo-admin-server.md` | Task board backend admin |
| `server/POS-INTEGRATION.md` | Panduan integrasi POS V1 untuk tim eksternal |
| `server/SOCKET-INTEGRATION.md` | Panduan integrasi Socket.IO |
| `server/SWAGGER-SETUP.md` | Cara generate & akses swagger |
| `server/swagger.json` | Kontrak API hasil generate |
| `user/AI-AGENT/AGENT-USER.md` | Playbook AI vs Developer untuk member app |
| `user/AI-AGENT/RULES.md` | Aturan Angular member app |
| `user/AI-AGENT/TODO-USER.md` | Task board member app |
| `user/stitchUser/*/code.html` | Desain referensi UI member |
| `admin/AI-AGENT/AGENT-ADMIN.md` | Playbook admin app |
| `admin/AI-AGENT/RULES-ADMIN.md` | Aturan Angular admin app |
| `admin/AI-AGENT/TODO-ADMIN.md` | Task board admin app |
| `admin/AI-AGENT/CSV-sales-report.md` | Dokumen lama (stack CSV sudah diarsipkan) |

---

## 11. Report (EJS) — SUDAH DIIMPLEMENTASI

Implementasi: `src/routes/admin/reports.routes.js` + template `src/reports/templates/*.ejs`.

| `reportKey` | Label | Template | Filter |
|---|---|---|---|
| `members` | Members Report | `members-report.ejs` | `page`, `limit` (default 50 JSON / 200 HTML, max 200), `search` (name/email/phone), `tierId`, `dateFrom`, `dateTo` (`YYYY-MM-DD`) |
| `transactions-daily` | Transactions Daily Report | `transactions-daily-report.ejs` | `dateFrom` **wajib**, `dateTo` **wajib** (`YYYY-MM-DD`) |
| `members-logs` | Members Logs | `members-logs.ejs` | tidak ada; limit 30, urut `inputDate DESC` |
| `users-logs` | Users Logs | `users-logs.ejs` | tidak ada; limit 30, urut `inputDate DESC` |

Cara pakai:
- `GET /api/admin/reports` → daftar `{ key, label, supports }`.
- `GET /api/admin/reports/:reportKey?format=html` → HTML (default) yang dirender EJS.
- `GET /api/admin/reports/:reportKey?format=json` → `{ success, meta, filters, rows }`.

Catatan:
- `format` selain `html`/`json` → `400`; `reportKey` tidak dikenal → `404`.
- Error di mode HTML dikirim sebagai fragmen `<div class="alert alert-danger">...</div>`, bukan halaman error.
- `auth` masih di-comment di kedua route report → belum terproteksi.
- Quirk: `buildUsersLogsReport` melakukan `JOIN members m ON u.userId = m.id` pada tabel `users_logs` (log admin di-join ke `members`), sehingga `userName` bisa tidak akurat. Perbaiki kalau menyentuh report ini.

---

## 12. Import DBF Igourmate — SUDAH DIIMPLEMENTASI

Implementasi: `src/modules/import/igourmete-dbf.parser.js` + `igourmete.service.js`, route `src/routes/admin/admin.igourmete-imports.routes.js` (di-mount di `/api/admin/imports`), UI `admin/src/app/features/igourmete/*`.

- Upload `.dbf` (multipart field `file`, max 20 MB) → parsing header DBF → simpan baris ke staging `dbf_igourmete_daily` dengan status batch.
- Endpoint: list batch, detail batch (+schema kolom), rows (page/pageSize/severity/search), commit, delete batch `STAGED`.
- Commit menulis ke tabel `transaction` dengan `syncType = 'dbf_igourmate'`, **tidak** membuat baris `points`.
- Detail kolom & aturan validasi: lihat `server/AI-agent/igourmate-dbf-import.md` (dokumen acuan, jangan diduplikasi di sini).

---

## 13. Status Implementasi & Known Gaps

Sudah jalan:
- Auth member (`/api/membership/auth/*`), auth admin (`/api/admin/auth/*`), JWT middleware.
- Point masuk legacy + POS V1, redeem point legacy + POS V1, redeem voucher (member & POS).
- Tier list/progress/upgrade, promo & voucher read (membership), CRUD voucher/promo/user (admin).
- Ledger admin: members, redemptions, tiers, transactions, points.
- Upload gambar, report EJS (4 report), import DBF Igourmate (staging + commit).
- Socket notification (`point:in`, `redeem:success`, `redeem:failed`).

Belum / perlu perhatian:
1. **Auth masih di-comment** di route report, promo (admin & membership), dan voucher (membership) — lihat bagian 6.3.
2. **`rules.md`** sebelumnya kosong; sekarang diisi ringkasan aturan SQL. Kalau menambah aturan baru, update di sana.
3. **`initDatabase()` tidak dipanggil** → schema harus disiapkan manual dari `table.sql`.
4. **`users-logs` report** join ke `members` (lihat bagian 11).
5. **Import DBF** hanya menulis `transaction`, tidak membuat `points` — kalau butuh akumulasi point dari data historis, itu pekerjaan terpisah.
6. **Tidak ada test otomatis** (unit/e2e). `server/scripts/test-igourmete-import*.js` hanya smoke test manual.
7. **`src/routes/index.js` tidak dipakai** `server.js` (mount langsung per-router). Jangan bingung kalau isinya cuma health.

---

## 14. Checklist Sebelum Mulai Kerja

1. Baca dokumen ini + `rules.md` + dokumen fitur terkait (bagian 10).
2. Cek `git status` dan file yang sedang berubah; jangan menimpa pekerjaan orang lain.
3. Kalau menyentuh endpoint: cek route → controller → service → tabel, lalu pastikan filter `archived`/`presence` benar.
4. Kalau menyentuh DB: ubah `AI-agent/table.sql` dan jalankan migrasi manual; jangan andalkan `initDatabase()`.
5. Kalau menambah endpoint: daftarkan router di `src/server.js`, tambahkan `auth` bila perlu, dan generate ulang `swagger.json` (`npm run swagger`).
6. Kalau menyentuh frontend: ikuti pola standalone component + service + interceptor yang ada; jangan ubah konfigurasi build/port.
7. Jalankan server (`npm run dev` / `npm start`) dan app terkait sebelum menyatakan selesai.
8. Update dokumen ini bila ada perubahan struktur, endpoint, tabel, atau event socket.

### Perintah yang sering dipakai

```bash
# backend
cd server
npm install
npm run dev          # nodemon
npm start            # production
npm run swagger      # regenerate swagger.json

# member app (port 4311)
cd user
npm start

# admin app (port 4310)
cd admin
npm start
```

---

## 15. Changelog Dokumen

- **2026-11-26** — Audit menyeluruh terhadap kode:
  - Menambah workspace `admin` (sebelumnya tidak terdokumentasi) beserta struktur folder & route-nya.
  - Melengkapi struktur folder server (`helpers/`, `modules/import/`, `controllers/admin/`, `reports/templates/`).
  - Mengganti tabel endpoint ringkas dengan inventaris lengkap membership (18), POS V1 (5), admin (42).
  - Menambah tabel DB yang hilang (`promo`, `promo_merchant`, `voucher_merchant`, `members_voucher`, `members_logs`, `users_logs`, `users_token`, `merchant`, tabel staging DBF).
  - Memperbaiki aturan redeem POS V1: point yang dipotong = `floor(amount * maxPercentOfBill / 100)`.
  - Menegaskan event socket yang benar (`socket:connected`, `member:join`, `point:in`, `redeem:success`, `redeem:failed`).
  - Menandai report EJS & import DBF sebagai **sudah diimplementasi** (bukan draft), dan mencatat route yang belum terproteksi.
  - Menambah bagian known gaps, checklist, dan perintah harian.
