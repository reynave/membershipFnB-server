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
