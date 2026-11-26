# ARCHIVED — Stack import CSV "Member Sales Listing Report"

Folder ini berisi kode yang **tidak dipakai lagi** (dead code), dipindahkan apa adanya
dari lokasi aslinya dan **tidak di-require** oleh aplikasi. Jangan aktifkan kembali
tanpa menambah route mount di `src/routes/admin/index.js`.

Alasan diarsipkan (audit 2026-11-26):

- Halaman frontend `/csv-upload` dan `/csv-upload/:batchId` beserta komponen
  `app-csv-upload-preview` sudah tidak ada (folder `admin/src/app/features/csv-upload`
  dan `admin/src/app/shared` tidak ada, tidak ada route/menu sidebar).
- Tidak ada satu pun pemanggil `/api/admin/imports/member-sales*` di aplikasi.
- Isi DB: `import_batch` = 0 baris, `import_line` = 2.617, `import_member` = 189
  (sisa data yatim). `transaction.syncType` hanya `api` dan `dbf_igourmate`.
- Kolom `transaction.import_batch_id` tidak pernah dibuat (migration belum dijalankan).
- Pengganti yang aktif: import DBF Igourmate (`/api/admin/imports/igourmete`,
  `dbf_import_batch`, `dbf_igourmete_daily`) — lihat `AI-agent/igourmate-dbf-import.md`
  dan `src/modules/import/igourmete*.js`.

## Peta file (lokasi asli → lokasi arsip)

| Lokasi asli | Lokasi arsip |
|---|---|
| `src/routes/admin/admin.member-sales-imports.routes.js` | `ARCHIVED/src/routes/admin/` |
| `src/controllers/admin/admin.member-sales-imports.controller.js` | `ARCHIVED/src/controllers/admin/` |
| `src/modules/import/member-sales.parser.js` | `ARCHIVED/src/modules/import/` |
| `src/modules/import/member-sales.validator.js` | `ARCHIVED/src/modules/import/` |
| `src/modules/import/member-sales.service.js` | `ARCHIVED/src/modules/import/` |
| `scripts/migrate-import-member-sales.js` | `ARCHIVED/scripts/` |
| `scripts/test-member-sales-import.js` | `ARCHIVED/scripts/` |
| `scripts/test-member-sales-import-http.js` | `ARCHIVED/scripts/` |
| `scripts/test-member-sales-parser.js` | `ARCHIVED/scripts/` |
| `AI-agent/member-sales-import.md` | `ARCHIVED/AI-agent/` |
| `AI-agent/agent-upload-igourmate.md` | `ARCHIVED/AI-agent/` |
| `AI-agent/staging-member-sales.sql` | `ARCHIVED/AI-agent/` |
| `AI-agent/AGENT_SPEC_member-sales-parser.md` | `ARCHIVED/AI-agent/` |

## Catatan

- `require` relatif di dalam file arsip menunjuk ke path aslinya, jadi **tidak akan
  jalan** dari folder ini. Itu disengaja: arsip hanya untuk referensi.
- Tabel `import_batch`, `import_line`, `import_member` **tidak di-drop** — masih ada
  di database beserta 2.617 + 189 baris sisa. DDL-nya masih ada di
  `AI-agent/table.sql`.
- Fixture `DATA/MEMBER Sales Listing Report.csv` tidak dipindahkan (dipakai juga
  sebagai contoh data), hanya script test-nya yang diarsipkan.
