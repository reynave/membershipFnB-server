### Membership Point Flow dari Transaction POS

Dokumen ini merangkum alur perolehan point untuk Membership dari transaksi POS, tabel yang terlibat, rumus perhitungan, dan endpoint API yang dipakai.

### Endpoint API

- Method: `POST`
- URL: `/api/membership/points/transactions`
- Header wajib: `token`
- Nilai header `token` diambil dari tabel `users_token.token`

Contoh request:

```http
POST /api/membership/points/transactions
token: tokensimpan.database
Content-Type: application/json
```

```json
{
  "bill": "TA1",
  "totalAmount": 500000,
  "billDate": "2026-04-16T07:34:32Z",
  "note": "POS paid transaction",
  "memberId": "1"
}
```

### Flow Proses

1. POS mengirim transaksi ke API Membership menggunakan header `token` dan body JSON.
2. Sistem membaca nilai `token`, lalu query ke tabel `users_token` untuk mendapatkan `merchantId`.
3. Jika token tidak ditemukan, request ditolak dengan status unauthorized.
4. Jika token valid, sistem cek data member ke tabel `members` berdasarkan `memberId`.
5. Member harus dalam kondisi aktif, yaitu `status = 1` dan `presence = 1`.
6. Dari data member, sistem mengambil `tierId`, lalu query ke tabel `tier`.
7. Tier juga harus aktif, yaitu `status = 1` dan `presence = 1`.
8. Setelah merchant, member, dan tier valid, data transaksi di-insert ke tabel `transaction` dengan `syncType = 'api'`.
9. Sistem menghitung point berdasarkan rule di tabel `tier`.
10. Hasil point disimpan ke tabel `points.pointIn` dengan relasi ke `transactionId`, `memberId`, `merchantId`, dan `tierId`.
11. Insert ke tabel `transaction` dan `points` harus berjalan dalam 1 database transaction agar tidak ada data setengah tersimpan.

### Rumus Perhitungan Point

Rule perhitungan mengacu ke tabel `tier`:

1. Jika `accumulationAmount == 0`, maka point dihitung dari cashback percentage:

	`point = floor(totalAmount * percentOfCashBack / 100)`

	Contoh:
	- `totalAmount = 500000`
	- `percentOfCashBack = 10`
	- hasil `point = 50000`

2. Jika `accumulationAmount > 0`, maka point dihitung dari pembagian nominal:

	`point = floor(totalAmount / accumulationAmount)`

	Case ini ada, tapi saat ini diperkirakan jarang dipakai.

### Tabel yang Terlibat

1. `users_token`
	- untuk validasi `token`
	- untuk mendapatkan `merchantId`

2. `members`
	- untuk validasi member
	- untuk mendapatkan `tierId`

3. `tier`
	- untuk rule perhitungan point
	- field utama: `percentOfCashBack`, `accumulationAmount`

4. `transaction`
	- menyimpan transaksi POS yang masuk dari API

5. `points`
	- menyimpan hasil point masuk ke field `pointIn`

### Default Insert

Untuk tabel `transaction` dan `points`, field berikut mengikuti default tabel:

- `presence = 1`
- `status` memakai default bawaan tabel
- `inputDate` otomatis tanggal saat insert
- `updateDate` otomatis tanggal saat insert dan update

### Validasi dan Error yang Perlu Dijaga

- Header `token` wajib ada.
- `memberId` wajib ada dan harus ditemukan di tabel `members`.
- `bill` wajib ada.
- `totalAmount` wajib angka dan harus lebih besar dari 0.
- `billDate` wajib tanggal valid.
- `tierId` member harus valid.
- Jika token, member, atau tier tidak ditemukan, proses insert tidak boleh lanjut.

### Response yang Diharapkan

API sebaiknya mengembalikan ringkasan hasil proses, minimal:

- `transactionId`
- `merchantId`
- `memberId`
- `tierId`
- `pointIn`
- data transaksi yang berhasil disimpan

### Catatan Teknis

- Kolom `transaction.memberId` bertipe `varchar`, sedangkan `members.id` bertipe `int`. Secara logic masih bisa dipakai, tetapi skema ini sebaiknya diseragamkan jika nanti dilakukan revisi schema.
- Nilai `percentOfCashBack` di tabel `tier` dibaca sebagai persen utuh, misalnya `10` berarti `10%`, sehingga rumusnya harus dibagi `100` saat perhitungan.