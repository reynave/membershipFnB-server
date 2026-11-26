# Kontrak REST API: Igourmate DBF Import

Status: **implemented** (server + admin UI connected).
Konsumen: halaman admin Angular `/igourmete` dan `/igourmete/:batchId`
(`admin/src/app/features/igourmete/`).

DBF reader: [`dbffile`](https://www.npmjs.com/package/dbffile) v1.14.1
(dBase III / IV / Visual FoxPro; text decoded with `iconv-lite`).

Implementasi server:

| File | Isi |
|---|---|
| `src/modules/import/igourmete-dbf.parser.js` | Header + field descriptor + record reader (`dbffile`), encoding resolution, dataset detection, per-row severity |
| `src/modules/import/igourmete.service.js` | Staging batch/row persistence, list, detail, rows, commit, delete |
| `src/controllers/admin/admin.igourmete-imports.controller.js` | Multer memory upload (20 MB, `.dbf`), response envelope |
| `src/routes/admin/admin.igourmete-imports.routes.js` | `/api/admin/imports/igourmete` routes |
| `scripts/test-igourmete-import.js` | Service smoke test (29 assertions) |
| `scripts/test-igourmete-import-http.js` | HTTP/route smoke test (16 assertions) |
| `AI-agent/igourmete-dbf-staging.sql` | Applied DDL for `dbf_import_batch` + `dbf_igourmete_daily` |

Referensi bisnis: `AI-agent/agent-upload-igourmate.md`.
Referensi pola staging yang sudah ada: `AI-agent/member-sales-import.md`.

Semua endpoint memakai middleware `auth` (Bearer JWT admin) dan envelope standar:

```json
{ "success": true, "message": "Import batches", "data": { } }
```

---

## 1. Ringkasan endpoint

| Method | Path | Keterangan |
|---|---|---|
| POST | `/api/admin/imports/igourmete` | Upload `.dbf` (multipart). File disimpan apa adanya + header DBF diparse server-side |
| GET | `/api/admin/imports/igourmete` | Daftar batch staging: `page`, `pageSize`, `status`, `search` |
| GET | `/api/admin/imports/igourmete/:batchId` | Ringkasan batch + schema kolom DBF |
| GET | `/api/admin/imports/igourmete/:batchId/rows` | Baris staging: `page`, `pageSize`, `severity`, `search` |
| POST | `/api/admin/imports/igourmete/:batchId/commit` | Tandai batch `COMMITTED` (baris tetap di `dbf_igourmete_daily`) |
| DELETE | `/api/admin/imports/igourmete/:batchId` | Hapus batch yang masih `STAGED` |

Catatan penting: **tidak ada parser DBF di frontend**. Halaman Angular hanya berisi
tampilan (pilih file, upload, daftar batch, detail batch). File `.dbf` dikirim apa adanya
dan seluruh pembacaan header/record dilakukan server.

---

## 2. POST `/api/admin/imports/igourmete`

`Content-Type: multipart/form-data`

| Field | Wajib | Isi |
|---|---|---|
| `file` | ya | File `.dbf` asli, maksimal 20 MB (`multer` memory storage, `fileFilter` ekstensi `.dbf`) |
| `dataset` | tidak | Diabaikan. Server mendeteksi sendiri dari nama field (`FCHECKUID`+`FDATE`+`FCHECK` → `DAILY_CHECK`, `MEMBERID`+`FIRSTNAME` → `MEMBER_PROFILE`, dst.) |
| `encoding` | tidak | Dikirim hanya kalau user memilih encoding selain `Auto`, mis. `windows-1252`. Bila kosong server memakai language driver byte 29 |
| `override` | tidak | `1` untuk memaksa upload walau `file_hash` sudah ada |

Aturan yang diharapkan:

1. Hitung `file_hash` (sha256) untuk cegah upload file yang sama dua kali → `409` bila
   sudah ada batch `STAGED`/`COMMITTED` dengan hash tersebut, kecuali `override=1`.
2. Tolak `422` bila file bukan DBF valid (header < 32 byte, `headerLength` tidak masuk akal,
   tidak ada field descriptor).
3. Parse header DBF: `version`, `lastUpdated`, `recordCount`, `headerLength`,
   `recordLength`, `languageDriver`, daftar field (`name`, `type`, `length`, `decimals`, `offset`).
4. Simpan semua record (termasuk yang bertanda hapus) ke tabel staging, lalu tandai
   baris dengan deletion flag `0x2A` sebagai `severity = 'WARNING'` + `message`
   `'Record is marked as deleted in the DBF file.'` (bukan `ERROR`, agar tetap bisa di-commit).
5. Simpan schema kolom (JSON) di batch agar halaman detail bisa menampilkan tab **Field schema**
   tanpa perlu menyimpan file mentah permanen.

Response `201`:

```json
{
  "success": true,
  "message": "DBF stored as staging batch",
  "data": {
    "batchId": 12,
    "status": "STAGED",
    "fileName": "MEMBER.DBF",
    "fileHash": "8f14e45f...",
    "dataset": "MEMBER_PROFILE",
    "datasetLabel": "Member profile",
    "encoding": "windows-1252",
    "recordCount": 4210,
    "rowCount": 4210,
    "errorCount": 0,
    "warningCount": 3,
    "dbfVersionLabel": "dBase III",
    "dbfLastUpdated": "2026-11-02",
    "uploadedAt": "2026-11-26 10:15:04",
    "uploadedBy": "admin@membership.local",
    "columns": [
      { "name": "MEMBERID", "type": "C", "length": 20, "decimals": 0 },
      { "name": "FIRSTNAME", "type": "C", "length": 30, "decimals": 0 }
    ],
    "notices": []
  }
}
```

`data.batchId` **wajib** ada — frontend langsung redirect ke `/igourmete/:batchId`.

---

## 3. GET `/api/admin/imports/igourmete`

Query: `page` (default 1), `pageSize` (default 10, maksimal 200), `status`
(`STAGED` \| `COMMITTED` \| `REJECTED`), `search` (nama file atau `batchId`).

Response `200`:

```json
{
  "success": true,
  "message": "Import batches",
  "data": {
    "total": 3,
    "page": 1,
    "pageSize": 10,
    "batches": [
      {
        "batchId": 12,
        "status": "STAGED",
        "fileName": "MEMBER.DBF",
        "dataset": "MEMBER_PROFILE",
        "datasetLabel": "Member profile",
        "rowCount": 4210,
        "errorCount": 0,
        "warningCount": 3,
        "uploadedAt": "2026-11-26 10:15:04",
        "committedAt": null
      }
    ]
  }
}
```

Frontend membaca `data.batches` dan `data.total`.

---

## 4. GET `/api/admin/imports/igourmete/:batchId`

Response `200` (bentuk inilah yang dipakai halaman `/igourmete/:batchId`):

```json
{
  "success": true,
  "message": "Import batch detail",
  "data": {
    "batchId": 12,
    "status": "STAGED",
    "fileName": "MEMBER.DBF",
    "dataset": "MEMBER_PROFILE",
    "datasetLabel": "Member profile",
    "encoding": "windows-1252",
    "recordCount": 4210,
    "rowCount": 4210,
    "errorCount": 0,
    "warningCount": 3,
    "dbfVersionLabel": "dBase III",
    "dbfLastUpdated": "2026-11-02",
    "uploadedAt": "2026-11-26 10:15:04",
    "uploadedBy": "admin@membership.local",
    "committedAt": null,
    "columns": [
      { "name": "MEMBERID", "type": "C", "length": 20, "decimals": 0 }
    ],
    "notices": [
      "Memo fields contain only block numbers."
    ]
  }
}
```

`404` bila batch tidak ada.

---

## 5. GET `/api/admin/imports/igourmete/:batchId/rows`

Query: `page`, `pageSize` (default 50), `severity` (`ERROR` \| `WARNING` \| `OK`),
`search` (cari di semua kolom + `message`).

Response `200`:

```json
{
  "success": true,
  "message": "Import batch rows",
  "data": {
    "total": 4210,
    "page": 1,
    "pageSize": 50,
    "columns": [
      { "name": "MEMBERID", "type": "C", "length": 20, "decimals": 0 }
    ],
    "rows": [
      {
        "rowNo": 1,
        "member": "00012345",
        "severity": "OK",
        "message": null,
        "data": { "MEMBERID": "00012345", "FIRSTNAME": "BUDI" }
      }
    ]
  }
}
```

`data.rows[].data` adalah objek bebas: key = nama kolom DBF, value = string hasil
normalisasi server (tanggal `YYYY-MM-DD`, logika `TRUE`/`FALSE`). Frontend
merender kolom tabel secara dinamis dari `data.columns`.

---

## 6. POST `/api/admin/imports/igourmete/:batchId/commit`

Body tidak dipakai saat ini (boleh kosong). Batch harus `STAGED` dan `errorCount = 0`;
selain itu `409`. Dalam satu DB transaction, commit:

1. Mengunci batch (`SELECT ... FOR UPDATE`) dan memvalidasi status.
2. Mengirim setiap baris layak (`severity <> 'ERROR'`, `isDeleted = 0`) ke tabel
   `transaction` (upsert berdasarkan unique key `transaction.bill`):

   | Sumber `dbf_igourmete_daily` | Tujuan `transaction` |
   |---|---|
   | `checkUid` | `checkUid` |
   | `member` (`FMEMBER`) | `memberId` (string 20 digit, tidak di-cast) |
   | `checkDate` + `checkNo` | `bill` → `YYYY-MM-DD.checkNo`, contoh `2026-11-25.00001` |
   | `timeOpen` | `billDate` (fallback `checkDate 00:00:00` bila kosong) |
   | `checkTot` | `totalAmount` (dibulatkan) |
   | — | `merchantId = 0`, `syncType = 'dbf_igourmate'` |

   Karena `bill` unik, commit ulang file yang sama lewat batch baru akan memperbarui
   baris lama (`updated`), bukan membuat duplikat.
3. Menandai batch `COMMITTED` + `committed_by`/`committed_at`.

Baris staging **tidak dihapus**. `inserted`/`updated`/`skipped` pada response adalah
hasil pengiriman ke `transaction`; `skipped` = baris error/terhapus + baris tanpa
`checkDate`/`checkNo`. Penulisan `points` belum termasuk commit ini (lihat bagian 8).

Response `200`:

```json
{
  "success": true,
  "message": "Import batch committed",
  "data": {
    "batchId": 12,
    "status": "COMMITTED",
    "inserted": 10,
    "updated": 0,
    "skipped": 0,
    "transactions": {
      "inserted": 10,
      "updated": 0,
      "skipped": 0,
      "syncType": "dbf_igourmate"
    },
    "message": "Batch #12 committed — 10 transaction row(s) inserted."
  }
}
```

Frontend membaca `data.inserted`, `data.updated`, `data.skipped`, `data.message`.
`DELETE /:batchId` menolak batch `COMMITTED` dengan `409`; batch `STAGED` dihapus
bersama seluruh barisnya.

---

## 7. Skema staging (sudah diterapkan)

DDL lengkap ada di `AI-agent/igourmete-dbf-staging.sql`. Dua tabel yang dipakai:

### `dbf_import_batch` (header batch)

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | BIGINT UNSIGNED PK | batch id |
| `file_name` | VARCHAR(255) | nama file asli |
| `file_hash` | CHAR(64) | SHA-256 isi file (guard duplikat) |
| `dataset` | VARCHAR(32) | `DAILY_CHECK` \| `MEMBER_PROFILE` \| `MEMBER_CLASS` \| `SALES` \| `UNKNOWN` |
| `encoding` | VARCHAR(32) | encoding yang dipakai (`windows-1252`, `cp437`, ...) |
| `dbf_version` | TINYINT UNSIGNED | byte versi DBF (0x03 = dBase III) |
| `dbf_last_updated` | DATE | tanggal last-update dari header DBF |
| `record_count` | INT UNSIGNED | jumlah record di header |
| `row_count` | INT UNSIGNED | jumlah baris yang benar-benar di-stage |
| `columns_json` | JSON | field descriptor (`name`, `type`, `length`, `decimals`, `offset`) |
| `notices_json` | JSON | catatan parser (language driver 0, memo, deleted rows) |
| `status` | ENUM | `STAGED` \| `COMMITTED` \| `REJECTED` |
| `error_count`, `warning_count` | INT UNSIGNED | rekap severity |
| `created_by`, `created_at` | | siapa & kapan upload |
| `committed_by`, `committed_at` | | siapa & kapan commit |

### `dbf_igourmete_daily` (baris staging)

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | BIGINT UNSIGNED PK | surrogate key |
| `batchId` | BIGINT UNSIGNED FK | → `dbf_import_batch.id` (`ON DELETE CASCADE`) |
| `rowNo` | INT UNSIGNED | nomor record DBF (1-based) |
| `checkUid` | VARCHAR(50) | `FCHECKUID` |
| `member` | VARCHAR(50) | `FMEMBER` (20 digit POS member id) |
| `checkDate` | DATE | `FDATE` |
| `checkNo` | VARCHAR(50) | `FCHECK` |
| `checkTot` | DECIMAL(15,4) | `FCKTOT` (di export lain `FCHECKTOT`) |
| `timeOpen` | DATETIME | `FTIMEOPEN` |
| `isDeleted` | TINYINT(1) | deletion flag DBF (`0x2A`) |
| `severity` | ENUM | `OK` \| `WARNING` \| `ERROR` |
| `message` | VARCHAR(500) | penjelasan warning/error |
| `rawJson` | JSON | record DBF lengkap (`{ "FCHECK": "00001", ... }`) |

`rawJson` menyimpan record apa adanya sehingga seluruh 73 field `CHECK.DBF` tetap
tersedia walau hanya 6 kolom yang diproyeksikan ke kolom tetap (`checkUid`, `member`,
`checkDate`, `checkNo`, `checkTot`, `timeOpen`). `(batchId, rowNo)`
unik per batch dan `checkUid` bukan lagi primary key, sehingga file yang sama boleh
diimpor ulang sebagai batch baru.

---

## 8. Mapping dataset (masih terbuka)

| Dataset | Deteksi server (field wajib) | Target tabel | Catatan |
|---|---|---|---|
| `DAILY_CHECK` | `FCHECKUID` + `FDATE` + `FCHECK` | `dbf_igourmete_daily` → `transaction` | **Sudah diimplementasi**; commit mengirim baris layak ke `transaction` (`syncType = 'dbf_igourmate'`) |
| `MEMBER_PROFILE` | `MEMBERID` + (`FIRSTNAME` \| `DISPLAYNAME`) | `members` | Field baru (`cardNo`, alamat, dll.) belum ada di skema |
| `MEMBER_CLASS` | `CLASSID` \| `MEMBERCLASSID` | `tier` | Perlu konfirmasi apakah class Igourmate = tier membership |
| `SALES` | `CHECKNO` \| `BILLNO` \| `PLU` | `transaction` + `points` | Harus diputuskan apakah memakai jalur `member-sales` yang sudah ada |
| `UNKNOWN` | selain di atas | - | Baris tetap di-stage, tetapi commit ke membership belum diizinkan |

Belum diputuskan (jangan diasumsikan di implementasi):

1. `FMEMBER` sudah di-stage di `dbf_igourmete_daily.member` dan dikirim apa adanya ke
   `transaction.memberId` (VARCHAR(50)). Kolom tujuan di tabel `members` belum diputuskan.
2. Apakah `SALES` DBF memakai logika `transaction.bill` deterministik seperti
   `member-sales` (supaya tidak dobel) atau memakai `bill` dari file.
3. `DAILY_CHECK` → `transaction` sudah diputuskan: `bill = checkDate.checkNo`,
   `billDate = timeOpen`, `syncType = 'dbf_igourmate'`, `merchantId = 0`. Penulisan `points`
   belum termasuk.

---

## 9. Status implementasi

| Bagian | Status |
|---|---|
| Parser DBF server-side | ✅ `dbffile` + validasi header + fallback encoding |
| `POST`/`GET`/`GET`/`GET`/`POST`/`DELETE` | ✅ semua endpoint aktif & teruji |
| Database staging | ✅ `dbf_import_batch` + `dbf_igourmete_daily` (bagian 7) |
| `/igourmete` + `/igourmete/:batchId` | ✅ terhubung ke API; `ng build` sukses |
| Mapping ke tabel membership (T-035) | 🟨 `DAILY_CHECK` → `transaction` selesai; `SALES`/`members` masih terbuka |
| Commit ke `transaction`/`points` | 🟨 `transaction` ✅ (`syncType = 'dbf_igourmate'`); `points` ⬜ |


