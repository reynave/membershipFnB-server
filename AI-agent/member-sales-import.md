# Catatan Implementasi: Import "Member Sales Listing Report" (POS)

Referensi SOP: `agent-upload-igourmate.md`. Dokumen ini mencatat hasil implementasi,
keputusan teknis, dan hal yang masih terbuka.

---

## 1. File yang dibuat/diubah

| File | Isi |
|---|---|
| `AI-agent/staging-member-sales.sql` | DDL staging `import_batch`, `import_member`, `import_line` (+ `check_seq`) |
| `scripts/migrate-import-member-sales.js` | Migration idempoten: `import_line.check_seq`, index `ix_line_check_seq`, `transaction.import_batch_id` + index |
| `src/modules/import/member-sales.parser.js` | Parser murni (UTF-16LE, carry-forward Check#, `checkSeq`, `rawLine` pada error) |
| `src/modules/import/member-sales.validator.js` | Validasi per baris, per member, dan total footer |
| `src/modules/import/member-sales.service.js` | Preview, detail, lines, commit, delete |
| `src/controllers/admin/admin.member-sales-imports.controller.js` | Multer memory storage (20MB, `.csv`/`.txt`) |
| `src/routes/admin/admin.member-sales-imports.routes.js` | Endpoint `/api/admin/imports/member-sales` |
| `scripts/test-member-sales-import.js` | Smoke test service (32 assertion) |
| `scripts/test-member-sales-import-http.js` | Smoke test HTTP/route (14 assertion) |

Tidak ada dependency baru selain `multer`.

---

## 2. Endpoint

| Method | Path | Keterangan |
|---|---|---|
| POST | `/api/admin/imports/member-sales` | multipart field `file`, query `override=1` bila laporannya memang diupload ulang |
| GET | `/api/admin/imports/member-sales` | daftar batch `import_batch` (id terbesar dulu): `page`, `pageSize`, `status`, `search` (file/outlet/uploader) — sumber tabel "Staging batches" di halaman upload |
| GET | `/api/admin/imports/member-sales/:batchId` | ringkasan + `canCommit`, `lineSeverities`, `memberIssues`, `footerComparison` |
| GET | `/api/admin/imports/member-sales/:batchId/lines` | `page`, `pageSize`, `severity`, `memberId`, `checkNo`, `search` |
| GET | `/api/admin/imports/member-sales/:batchId/members` | `page`, `pageSize`, `severity`, `search` (member id/nama) — sumber tab "Members" di UI |
| POST | `/api/admin/imports/member-sales/:batchId/commit` | body `{ amountBasis, billDate, merchantId }` |
| DELETE | `/api/admin/imports/member-sales/:batchId` | hanya status PREVIEW |

Semua endpoint memakai middleware `auth` yang sudah ada (Bearer JWT).

---

## 3. Keputusan teknis

1. **Check# tidak unik dalam satu periode.** POS me-reset Check# setiap hari: fixture
   274 check hanya punya 269 pasangan unik `(member, check_no)`. Karena itu parser
   menyimpan `check_seq` (urutan token Check# di dalam blok member) dan commit
   mengelompokkan baris per `(member_id, check_no, check_seq)`.
2. **Bill number** dibuat deterministik:
   `IGR-{YYYYMMDD periode_from}-{check_no}-{sha256(outlet|periode|member|check_seq)[0..10]}`.
   Kolom `transaction.bill` UNIQUE, jadi commit kedua pada laporan yang sama ditolak
   (409) dan tidak mungkin dobel. Karena deterministik, satu laporan tidak bisa
   di-commit dua kali dengan amount basis berbeda tanpa menghapus transaksi lama.
3. **Amount basis.** Default `item_total` (kolom `Item Total`, termasuk nilai yang
   berbeda dari `Item Sales - Item Disc`). Pilihan lain: `item_sales`, `gross_total`.
   Untuk `gross_total`, nilai per check = `member footer Gross Total x (Item Total check / Item Total member)`
   (fallback ke `Item Total` check bila footer member tidak lengkap).
4. **Merchant.** Report hanya membawa nama outlet. Commit mencari
   `merchant.name` = outlet (case-insensitive, `presence = 1`). Bila tidak ada,
   transaksi disimpan dengan `merchantId = 0` dan response berisi `merchantMatched: false`
   + `warnings`. Pemanggil bisa mengirim `merchantId` di body commit untuk memaksa
   merchant tertentu (divalidasi harus ada, kalau tidak 404).
5. **Traceability.** `transaction.import_batch_id` diisi saat commit, sehingga
   rollback per batch cukup `DELETE FROM transaction WHERE import_batch_id = ?`
   (belum diekspos sebagai endpoint, lihat bagian 5).
6. **Duplikat.** Upload ditolak 409 bila `file_hash` sama ATAU `outlet + periode` sudah
   pernah COMMITTED, kecuali `override=1`. Batch yang masih PREVIEW tidak menghalangi
   upload ulang.
7. **Validasi yang dilewati** (`skippedChecks` di response): PLU master dan member
   master, karena skema saat ini tidak punya tabel produk dan tidak ada kolom untuk
   20-digit POS Member ID di `members`.

---

## 4. Hasil verifikasi (fixture `DATA/MEMBER Sales Listing Report.csv`)

| Item | Nilai |
|---|---|
| Member | 189 |
| Check (member + checkSeq) | 274 |
| Baris item | 2617 |
| WARNING (Item Total <> Item Sales - Item Disc) | 196 |
| ERROR | 0 |
| Total Item Sales | 246.408.200 |
| Total Item Total | 267.153.200 |
| Gross Total footer | 274.137.917 |

Menjalankan test (database harus aktif, migration sudah dijalankan):

```bash
node scripts/migrate-import-member-sales.js
node scripts/test-member-sales-import.js
node scripts/test-member-sales-import-http.js
```

Kedua test membersihkan sendiri batch dan transaksi yang dibuatnya. Jalankan
bergantian (bukan paralel), karena bill number deterministik sehingga dua proses
yang meng-commit laporan yang sama akan saling bentrok.

### UI admin (Angular 18)

Alurnya dibagi menjadi **dua halaman terpisah** (bukan satu halaman gabungan):

| Route | Component | Isi |
| --- | --- | --- |
| `/csv-upload` | `features/csv-upload/csv-upload.page.ts` | Halaman **Upload report**: drag & drop / pilih file `.csv`/`.txt` (maks 20 MB), checkbox `override`, tombol *Upload to staging*, plus tabel **Staging batches** (`GET /member-sales`) berisi batch yang ada di `import_batch` dengan filter status/search, page size, paginasi, dan tombol *Open* per baris. |
| `/csv-upload/:batchId` | `features/csv-upload/batch/csv-upload-batch.page.ts` | Halaman **Staging batch #ID**: ringkasan `import_batch`, tab *Item lines* (`import_line`), tab *Members* (`import_member`), filter severity/search, page size, paginasi, tombol *Reload from DB* dan *Upload another report*. |

Alur kerjanya:

1. Upload (multipart field `file`, opsi `override`) → `POST /api/admin/imports/member-sales`.
   Tidak ada parsing di browser; server menyimpan baris ke `import_batch` /
   `import_member` / `import_line` lalu mengembalikan `batchId`.
2. Setelah sukses, halaman upload langsung `router.navigate(['/csv-upload', batchId])`.
   Halaman batch **hanya** memakai `batchId` dari URL dan membaca ulang semuanya dari
   database: `GET /:batchId`, `GET /:batchId/lines`, `GET /:batchId/members`.
3. `batchId` tidak valid → redirect ke `/csv-upload`; batch 404 → tampil peringatan
   dengan link kembali ke halaman upload.
4. Commit belum ada di UI — tahap berikutnya.

---

## 5. Masih terbuka

1. **Amount basis resmi**: `Item Sales` atau `Item Total`? Sampai ada keputusan,
   default `item_total`, bisa diubah per commit lewat body.
2. **Merchant "THE LEAF"** belum ada di tabel `merchant` (saat ini hanya
   POS Supermarket, Putien, Crystal jade). Perlu dibuat/di-mapping agar transaksi
   hasil import punya `merchantId` yang benar, atau kirim `merchantId` saat commit.
3. **Rollback batch COMMITTED** belum tersedia sebagai endpoint (delete sengaja
   diblokir). Bila dibutuhkan, tambahkan `POST /:batchId/rollback` yang menghapus
   `transaction WHERE import_batch_id = ?` lalu mengembalikan status batch ke REJECTED.
4. **UI Angular 18 commit** belum dibuat (halaman staging/upload sudah ada).
5. Batch PREVIEW yang terbengkalai bisa dibersihkan dengan query di bagian akhir
   `staging-member-sales.sql` (opsional, belum dijadwalkan).
