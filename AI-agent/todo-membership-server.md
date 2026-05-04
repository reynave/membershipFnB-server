### Membership Server Todo

### API yang sudah dibuat

- [x] GET `/api/membership/ping`
	- untuk health check sederhana dari jalur Membership

- [x] POST `/api/membership/auth/register`
	- register member baru

- [x] POST `/api/membership/auth/login`
	- login member dan generate JWT

- [x] POST `/api/membership/points/transactions`
	- terima transaksi POS dari header `token`
	- ambil `merchantId` dari tabel `users_token`
	- validasi member aktif dari tabel `members`
	- ambil rule tier dari tabel `tier`
	- hitung point
	- insert ke tabel `transaction`
	- insert ke tabel `points`

### API yang akan ditambahkan berikutnya

- [x] Member bisa lihat total point masuk
  - GET `/api/membership/points/balance`
  - endpoint melakukan query ke tabel `points`
  - hanya hitung data dengan `archived = 0`
  - total diambil dari penjumlahan `pointIn` minus `pointOut` untuk balance
  - filter berdasarkan `memberId` member yang login via JWT auth
  - return: totalPointIn, totalPointOut, dan balancePoint

- [x] Member bisa lihat riwayat point
	- GET `/api/membership/points/history`
	- endpoint query ke tabel `points`
	- filter: `memberId` dari member login via JWT auth
	- filter: hanya data dengan `archived = 0`
	- urutkan berdasarkan `transactionDate` terbaru
	- return: list riwayat point (pointIn, pointOut, transactionDate, note, dll)

- [x] POS bisa redeem point customer
	- POST `/api/membership/redeem/redeem`
	- header: `token` (identifikasi merchant/POS)
	- body: `{ redeemCode, amount (=pointOut), transactionId }`
	- validasi: redeemCode valid, tidak expired, member punya cukup point
	- validasi: `amount >= tier.minAmount` (jika minAmount > 0), jika kurang return 400
	- return: `{ point, approvalCode, status: 'success' }`
	- insert ke `points` table: `pointOut = amount`
	- insert ke `transaction` table: `totalRedeem = amount`
	- update `members_code`: `presence = 0` (soft delete, tidak bisa pakai lagi)
	- **Socket events:**
		- emit `redeem:success` ke `member:${memberId}` saat redeem berhasil
		- emit `redeem:failed` ke `member:${memberId}` saat ada error (setelah validasi code)

- [x] Member bisa lihat progress tier berdasarkan total transaksi
  - GET `/api/membership/tiers/progress`
  - auth via JWT, hitung `SUM(transaction.totalAmount WHERE archived=0 AND presence=1)`
  - bandingkan dengan `tier.requirementTransactionOfTier` untuk tier berikutnya
  - return: `{ totalTransaction, currentTier, nextTier, canUpgrade, reachedNextTier, pointsToNextTier, progressPercent, isHighestTier, balancePoint }`

- [x] Member bisa upgrade tier
  - POST `/api/membership/tiers/upgrade`
  - auth via JWT, validasi `canUpgrade` (totalTransaction >= requirementTransactionOfTier next tier)
  - update `members.tierId` ke tier berikutnya
  - return: progress terbaru setelah upgrade

- [x] Baca semua tier aktif
  - GET `/api/membership/tiers`
  - tanpa auth, return semua tier dari tabel `tier` yang aktif

### Catatan

- 2026-04-20: Tambah validasi `tier.minAmount` di endpoint redeem POS V1 (`executeRedeemPointV1ByMember`). Jika `minAmount > 0` dan `amount < minAmount`, request ditolak 400. Logika ada di `redeem.service.js`.
- Header untuk API transaksi point sekarang menggunakan `token`, bukan `barrier`.
- Dokumen flow transaksi point sudah diperbarui di `AI-agent/membership-point.md`.
- Dokumentasi API lengkap dengan Swagger sudah dibuat dan terintegrasi ke Express server:
  - Akses di: `http://localhost:3200/api-docs` saat server running
  - Packages: `swagger-ui-express` dan `swagger-autogen`
  - Generate docs: `npm run swagger`
  - Setup: `swagger-config.js` + integrasi di `src/server.js`

## Progress 2026-04-27

- Menambahkan endpoints report untuk `members-logs` dan `users-logs` (`/api/admin/reports/*`) dengan dukungan HTML & JSON, template EJS, dan query LIMIT 30 ORDER BY `inputDate` DESC.
- Menambahkan pencatatan login sukses ke tabel `members_logs` dan memverifikasi insert menggunakan akun `cso1@email.com`.
- Memperbarui tampilan frontend (user) untuk mengambil nama dari `localStorage` (`membership_member`) dan menambahkan getter di komponen serta verifikasi dev server lokal.
- Menambahkan format tanggal pada report menjadi `YYYY-MM-DD HH:MM:SS` di template EJS.
- Menjalankan dan memverifikasi report HTML, lalu membersihkan skrip sementara yang dibuat untuk pemeriksaan.

## Progress 2026-05-04

- Membuat `tiers.controller.js` dengan 3 endpoint: `list`, `progress`, `upgrade`.
- `GET /tiers`: baca semua tier aktif tanpa auth.
- `GET /tiers/progress`: hitung progress tier member berdasarkan `SUM(transaction.totalAmount)` vs `requirementTransactionOfTier`; return `canUpgrade`, `progressPercent`, `pointsToNextTier`, `isHighestTier`, dll.
- `POST /tiers/upgrade`: validasi `canUpgrade`, update `members.tierId` ke tier berikutnya, return progress terbaru.
- Membuat `tiers.routes.js` dan mendaftarkan ke `routes/membership/index.js` sebagai `/tiers`.
- Integrasi frontend Angular: `loyalty-bonuses.page.ts` dan `.html` terhubung ke ketiga endpoint tier, termasuk progress bar dan tombol Upgrade Tier.
- Merchant name join di `membersVoucher.controller.js`: semua endpoint (listMy, listHistory, getById) JOIN tabel `merchant` untuk mendapatkan `usedMerchantName`.
