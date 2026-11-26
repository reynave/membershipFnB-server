# SOP: Import "Member Sales Listing Report" (POS) ke Tabel Transaction

Target stack: Angular 18 (frontend) + Node.js/Express REST API.
Tujuan: user upload file report POS, sistem menganalisa dan memvalidasi isinya (preview), lalu menyimpan ke tabel transaction hanya setelah user konfirmasi.

---

## 0. Aturan Kerja untuk Agent

1. Baca struktur project dulu (routing, konvensi folder, koneksi DB, auth/middleware yang sudah ada). Ikuti konvensi yang ada, jangan buat pola baru.
2. Minimal dependency. Tambahan yang diizinkan: `multer` (upload). Tidak perlu library CSV karena format file BUKAN CSV standar.
3. Jangan mengarang nama tabel/kolom tujuan. Inspeksi skema DB yang ada. Kalau tabel transaction tujuan belum jelas, STOP dan tanyakan ke user (lihat bagian 9).
4. Jangan menulis ke tabel transaction sebelum endpoint commit dipanggil. Preview hanya menulis ke tabel staging.
5. Semua operasi commit harus dalam satu DB transaction (all-or-nothing).
6. Kerjakan bertahap sesuai bagian 5. Setelah tiap tahap, jalankan test/verifikasi di bagian 7 sebelum lanjut.
7. File contoh: `MEMBER Sales Listing Report.csv` (periode 01/01/2026 s/d 31/01/2026, outlet THE LEAF, 189 member). Gunakan sebagai fixture test.

---

## 1. Spesifikasi Format File

Ini laporan teks hasil export POS, bukan tabel datar.

- Encoding: **UTF-16LE dengan BOM**, line ending CRLF. Decode: `buf.toString('utf16le')`, buang `﻿` di awal, hapus `\r`.
- Pemisah kolom: koma. Angka diberi padding spasi, jadi selalu `trim()` lalu `parseInt`.
- Tanggal format `dd/mm/yyyy`.

### Header file (baris awal)
```
Member Sales Listing Report
(THE LEAF)                                  <- nama outlet
Bus Date :, 01/01/2026 to 31/01/2026, Printed At :, 05/10/2026 04:44:16 pm
Printed By :, EDP Mitrasys
```
Ambil: `outlet`, `period_from`, `period_to`, `printed_at`, `printed_by`.

### Blok per member (berulang)
```
Member ID:,00002023000000000029,,Member Name:,LUSIANA SETIADI
Check#,,PLU,,Description,,Price,,Qty,,Item Sales,,Item Disc,,Item Total
--------  --------  ...
00033,,ACCH0006,,AYAM KUNG PAO,,   98000,,   1,,   98000,,   0,,   98000    <- baris item PERTAMA check (ada Check#)
ACFR0012,,NS PUTIH,,   12500,,   1,,   12500,,   0,,   12500                <- baris item berikutnya (TANPA Check#)
...
00027,,ACDR0003,,AGAR AGAR GUILING,,...                                      <- check baru dalam member yang sama
-------------------------------------------------------------------------
Total:,,     13,,   517900,,   0,,   517900         <- total per MEMBER (qty, item sales, disc, item total)
Item Sales:,   517900,,#Check:,   1                 <- jumlah check milik member
Item Disc:,   0,,Cover:,   3
Check Disc:,   105945,,Sales/#Check:,   506472      <- hanya muncul di sebagian blok
TAX:,   55674
SC:,   38843
Gross Total:,   506472
```

### Footer file
Setelah blok member terakhir ada total keseluruhan (`TAX:`, `SC:`, `Gross Total:`) dan `<< End of Report >>`.

### Aturan parsing baris item
- Baris item dikenali bila: sedang berada dalam blok member, `c[0]` tidak berakhiran `:`, tidak diawali `-`, bukan `Check#`, dan jumlah kolom >= 13.
- Ada Check# bila `c[0]` hanya digit (mis. `00033`). Kalau ada, nilainya disimpan dan **dibawa (carry-forward)** ke baris item berikutnya sampai muncul Check# baru atau member baru. Reset check saat ketemu `Member ID:`.
- Baca angka **dari kanan** karena `Description` bisa mengandung koma:
  `total=c[L-1]`, `item_disc=c[L-3]`, `item_sales=c[L-5]`, `qty=c[L-7]`, `price=c[L-9]`.
  `plu` ada di `c[0]` (tanpa check) atau `c[2]` (dengan check). `description = c.slice(descIdx, L-10).join(',')` dengan `descIdx` = 2 atau 4.
- Baris footer per-member (`Total:`, `Item Sales:`, `#Check:` dst.) dibaca terpisah untuk keperluan validasi, bukan disimpan sebagai item.

---

## 2. Fakta/Risiko Data yang Sudah Diketahui

1. **Tidak ada tanggal per transaksi**, hanya rentang periode di header. Check# yang sama (mis. `00027`) muncul pada banyak member. Belum diketahui apakah Check# unik dalam satu periode. Jangan membuat unique key `(member, check_no)` tanpa konfirmasi user.
2. **`Item Total` tidak selalu sama dengan `Item Sales`** pada sebagian baris (contoh: price 108000 x qty 1, item sales 108000, item total 162000; contoh lain 78000 menjadi 117000). Akibatnya `Total:` member berbeda antara kolom Sales dan Total. Simpan kedua nilai apa adanya, tampilkan sebagai warning, dan tanyakan ke user kolom mana yang menjadi nilai transaksi resmi.
3. Baris `Check Disc` / `Sales/#Check` tidak muncul di semua blok. Parser harus toleran terhadap baris footer yang opsional.
4. Ada beberapa baris dengan pola tidak biasa (mis. PLU `SCAC0002`). Jangan crash, catat sebagai warning bila tidak lolos validasi.

---

## 3. Desain Database

### Tabel staging (dibuat oleh migration baru)
```
import_batch
  id PK, file_name, file_hash (SHA-256) UNIQUE, outlet, period_from, period_to,
  printed_at, printed_by, status ('PREVIEW'|'COMMITTED'|'REJECTED'),
  total_members, total_checks, total_items, total_item_sales, total_item_total,
  error_count, warning_count, created_by, created_at, committed_at NULL

import_line
  id PK, batch_id FK, line_no, member_id, member_name, check_no,
  plu, description, price, qty, item_sales, item_disc, item_total,
  severity NULL ('ERROR'|'WARNING'), message NULL
```
Index: `import_line(batch_id)`, `import_line(batch_id, member_id, check_no)`.

Sesuaikan tipe data dengan DB yang dipakai project (jangan asumsikan MySQL/SQL Server). Nilai uang disimpan sebagai integer/decimal, bukan float.

### Tabel tujuan (transaction)
Tentukan dari skema yang ada. Tambahkan kolom `import_batch_id` (nullable) pada tabel tujuan agar hasil import bisa ditelusuri dan di-rollback per batch.

---

## 4. Kontrak API

Semua endpoint memakai auth/middleware yang sudah ada di project.

| Method | Path | Fungsi |
|---|---|---|
| POST | `/api/imports/member-sales` | Upload (multipart field `file`), parse, simpan ke staging, return ringkasan |
| GET | `/api/imports/:batchId` | Ringkasan batch |
| GET | `/api/imports/:batchId/lines?page=&size=&severity=&member=` | Baris staging, paginasi + filter |
| POST | `/api/imports/:batchId/commit` | Pindahkan staging ke tabel transaction |
| DELETE | `/api/imports/:batchId` | Batalkan batch (hanya status PREVIEW) |

Response upload (contoh):
```json
{
  "batchId": 12, "outlet": "THE LEAF", "periodFrom": "2026-01-01", "periodTo": "2026-01-31",
  "totals": { "members": 189, "checks": 0, "items": 0, "itemSales": 0, "itemTotal": 0 },
  "errorCount": 0, "warningCount": 0, "duplicateOf": null
}
```
Batas upload: 10 MB, hanya `.csv`/`.txt`. Tolak jika bukan header `Member Sales Listing Report` setelah decode.

---

## 5. Langkah Implementasi (urut)

### Tahap A. Backend: parser
1. Buat modul `parseMemberSales(buf: Buffer)` yang murni (tanpa akses DB), return `{ header, members[], lines[], footer, errors[], warnings[] }`.
2. Implementasikan aturan bagian 1. Bungkus parsing tiap baris dalam try/catch; baris gagal dicatat sebagai error dengan nomor baris, parsing tetap lanjut.
3. Tulis unit test memakai fixture file contoh (lihat bagian 7).

### Tahap B. Backend: validasi
Jalankan setelah parse dan simpan hasilnya ke `import_line.severity/message`:

| Aturan | Level |
|---|---|
| `price * qty == item_sales` | ERROR bila beda |
| `item_total == item_sales - item_disc` | WARNING bila beda (lihat risiko #2) |
| Per member: jumlah baris item dan sum `item_sales` sama dengan baris `Total:` member | ERROR bila beda |
| Per member: jumlah Check# unik sama dengan `#Check:` | ERROR bila beda |
| PLU ada di master produk | WARNING bila tidak ada |
| Member ID ada di master member | WARNING bila tidak ada |
| Sum seluruh `item_sales` vs footer file (`Gross Total` dan komponennya) | WARNING bila beda, tampilkan selisih |
| `file_hash` sudah ada di `import_batch` berstatus COMMITTED | ERROR (duplikat file) |
| `outlet + period_from + period_to` sudah pernah COMMITTED | ERROR kecuali user override eksplisit |

### Tahap C. Backend: endpoint
1. Upload: multer memory storage, hitung SHA-256, parse, validasi, insert `import_batch` + `import_line` (bulk insert per chunk 500 baris), return ringkasan.
2. Lines: query staging dengan paginasi dan filter.
3. Commit: syaratnya batch berstatus PREVIEW dan `error_count = 0`. Dalam satu DB transaction: `INSERT ... SELECT` dari `import_line` ke tabel tujuan (set-based, bukan loop per baris), isi `import_batch_id`, update status menjadi COMMITTED + `committed_at`. Commit ulang pada batch yang sudah COMMITTED harus ditolak (idempoten, tidak ada double insert).
4. Delete: hanya untuk status PREVIEW; hapus line lalu batch.

### Tahap D. Frontend (Angular 18, standalone components)
1. Halaman Import: tombol pilih file + drag-drop, validasi ekstensi dan ukuran di sisi client, progress upload.
2. Setelah upload tampilkan panel ringkasan (outlet, periode, jumlah member/check/item, total, jumlah error dan warning).
3. Tabel baris dengan paginasi server-side, filter severity dan member, baris error/warning diberi penanda.
4. Tombol "Simpan" nonaktif selama ada ERROR. Bila hanya WARNING, minta konfirmasi dialog sebelum commit. Tombol "Batal" memanggil DELETE.
5. Setelah commit sukses tampilkan hasil (jumlah baris tersimpan, batchId). Tangani error HTTP dengan pesan jelas.
6. Gunakan service/HttpClient dan pola komponen yang sudah ada di project.

---

## 6. Keamanan dan Operasional

- Semua endpoint wajib terautentikasi dan dibatasi role yang berwenang melakukan import.
- Validasi isi file di server, jangan percaya validasi client. Gunakan query berparameter, tidak ada string concatenation SQL.
- Jangan menulis file upload ke disk publik. Cukup proses di memory dan simpan hash.
- Catat audit: siapa upload, siapa commit, kapan.
- Batch PREVIEW yang tidak di-commit lebih dari 7 hari boleh dibersihkan job terjadwal (opsional).

---

## 7. Verifikasi (wajib sebelum selesai)

Dengan fixture `MEMBER Sales Listing Report.csv`:
- Parser menghasilkan **189 member**.
- Baris dengan Check# carry-forward benar (contoh: member LIN CHIN WEN punya dua check, `00017` dan `00027`, dan item tanpa Check# masuk ke check yang benar).
- Total hasil parse cocok dengan footer file, atau selisihnya muncul sebagai warning yang terbaca jelas.
- Upload file yang sama dua kali: upload kedua ditolak sebagai duplikat setelah commit pertama.
- Commit dua kali pada batch yang sama: tidak ada baris ganda di tabel tujuan.
- Simulasi gagal di tengah commit: tidak ada baris tersimpan di tabel tujuan (rollback).
- File bukan UTF-16 / bukan laporan ini: ditolak dengan pesan jelas, server tidak crash.
- File 800 KB selesai diproses dalam beberapa detik.

---

## 8. Definition of Done

- Migration staging dan kolom `import_batch_id` tersedia dan bisa dijalankan ulang dengan aman.
- Parser, validasi, dan endpoint lolos semua test bagian 7.
- UI upload, preview, dan commit berfungsi end-to-end.
- Tidak ada dependency baru selain `multer`.
- Ringkasan akhir ke user berisi: file yang dibuat/diubah, cara menjalankan, hasil test, dan daftar asumsi yang diambil.

---

## 9. Hentikan dan Tanyakan ke User Jika

1. Tabel dan kolom transaction tujuan belum jelas.
2. Check# unik atau tidak dalam satu periode (menentukan unique key dan strategi anti-duplikat).
3. Kolom mana yang dipakai sebagai nilai resmi: `Item Sales` atau `Item Total` (lihat risiko #2).
4. PLU atau member yang tidak ada di master: ditolak atau dibuat otomatis?
5. Perlu tidaknya fitur rollback batch setelah COMMITTED.