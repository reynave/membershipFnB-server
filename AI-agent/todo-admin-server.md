# TODO ADMIN SERVER

Task board khusus backend REST API Admin - Membership System.

## Status Legend
| Simbol | Status |
|---|---|
| ✅ | DONE |
| 🟨 | IN_PROGRESS |
| ⬜ | TODO |
| 🔴 | BLOCKED |

---

## Scope

File ini hanya untuk endpoint dan logic backend admin:
- route `/api/admin/*`
- auth admin JWT
- admin users + POS token management
- dukungan POS V1 yang terkait token admin

---

## Task Board

| Status | ID | Judul | Deskripsi | Owner | Priority | Depends | Notes |
|---|---|---|---|---|---|---|---|
| ✅ | S-001 | Admin Auth Login | Endpoint login admin + JWT payload `sub,email,name` | AI | High | - | Fix kolom `users.inputDate` sudah dilakukan |
| ✅ | S-002 | Admin Members List | GET `/api/admin/members` + search/filter/pagination | AI | High | - | Sudah dipakai frontend |
| ✅ | S-003 | Admin Member Detail | GET `/api/admin/members/:id` + balance + history | AI | High | S-002 | Sudah dipakai frontend |
| ✅ | S-004 | Admin Redemptions List | GET `/api/admin/redemptions` | AI | Medium | - | Sudah dipakai frontend |
| ✅ | S-005 | Admin Redemption Detail | GET `/api/admin/redemptions/:id` | AI | Medium | S-004 | Sudah dipakai frontend |
| ✅ | S-006 | Admin Tiers List | GET `/api/admin/tiers` | AI | Medium | - | Sudah dipakai frontend |
| ✅ | S-007 | Admin Transactions List | GET `/api/admin/transactions` | AI | Medium | - | Sudah dipakai frontend |
| ✅ | S-008 | Admin Transaction Detail | GET `/api/admin/transactions/:id` | AI | Medium | S-007 | Sudah dipakai frontend |
| ✅ | S-009 | Admin Users List | GET `/api/admin/users` + token summary | AI | Medium | - | Sudah dipakai frontend |
| ✅ | S-010 | Admin User Detail | GET `/api/admin/users/:id` + tokens + merchants aktif | AI | Medium | S-009 | Sudah dipakai frontend |
| ✅ | S-011 | Create POS Token | POST `/api/admin/users/:id/tokens` buat opaque token `pos_live_*` | AI | High | S-010 | Token disimpan di `users_token` |
| ✅ | S-012 | Revoke POS Token | DELETE `/api/admin/users/:id/tokens/:tokenId` revoke langsung | AI | High | S-011 | Immediate revoke teruji |
| ✅ | S-013 | POS Auth by Opaque Token | `authPosV1` validasi Bearer token via DB lookup `users_token` | AI | High | S-011 | Bukan JWT lagi |
| ✅ | S-014 | Merchant Binding Fix | Ikat transaksi POS ke `merchantId` dari token yang dipakai | AI | High | S-013 | Cegah merchant mismatch |
| ✅ | S-015 | POS Integration Doc | Dokumen sample endpoint POS untuk tim eksternal | AI | Medium | S-013 | `server/POS-INTEGRATION.md` |
| ✅ | S-017 | Admin Vouchers CRUD | API admin voucher header: list, detail, create, update, soft delete (`presence=0`) | AI | High | - | Route `/api/admin/vouchers` aktif |
| ✅ | S-018 | Admin Voucher Merchant Scope | API admin untuk simpan/ubah relasi merchant per voucher di `voucher_merchant`; kosong = global | AI | High | S-017 | PUT `/api/admin/vouchers/:id/merchants` |
| ✅ | S-019 | Member Detail Voucher History API | Perluas GET `/api/admin/members/:id` agar include list redeem voucher dari `members_voucher` | AI | Medium | S-003, S-017 | Field response: `voucherHistory` |
| ✅ | S-020 | Admin Promos CRUD | API admin promo header: list, detail, create, update, soft delete (`presence=0`) | AI | High | - | Route `/api/admin/promos` aktif |
| ✅ | S-021 | Admin Promo Merchant Scope | API admin untuk simpan/ubah relasi merchant per promo di `promo_merchant`; kosong = global | AI | High | S-020 | PUT `/api/admin/promos/:id/merchants` |
| ✅ | S-023 | Igourmate DBF Import API | Endpoint `/api/admin/imports/igourmete`: POST upload `.dbf` (parser `dbffile`), GET list batch, GET detail + schema kolom, GET rows, POST commit (kirim baris ke `transaction`, `syncType = 'dbf_igourmate'`), DELETE batch. Staging: `dbf_import_batch` + `dbf_igourmete_daily` (termasuk kolom `member` dari `FMEMBER`) | AI | Medium | - | Smoke test service 34 + HTTP 19 assertion. DDL: `AI-agent/igourmete-dbf-staging.sql` |
| ✅ | S-024 | Admin Points List/Detail | GET `/api/admin/points` (paginasi + filter search/type/archived/`inputDateFrom`..`inputDateTo`, plus `summary` total point in/out/net) dan GET `/api/admin/points/:id` (join `transaction`, `members`, `merchant`, `tier`) | AI | Medium | S-003 | Dipakai halaman `/point` + `/point/:id`; HTTP smoke test sukses (list, filter, detail, 404, 422) |
| ✅ | S-025 | Arsip stack import CSV | Endpoint `/api/admin/imports/member-sales` dihapus dari router; route, controller, parser/validator/service, script test/migrasi, dan dokumen CSV dipindah ke `server/ARCHIVED/` | AI | Low | - | Tabel `import_batch`/`import_line`/`import_member` tidak di-drop. Pengganti: DBF import (`S-023`) |
| ⬜ | S-016 | Admin API Test Collection | Siapkan collection test regresi `/api/admin/*` | PAIR | Medium | S-002..S-012 | Next hardening |

---

## Change Log

| Tanggal | ID Task | Perubahan | Oleh |
|---|---|---|---|
| 2026-04-21 | S-001 | Fix query login admin (`users.inputDate AS created_at`) | AI |
| 2026-04-21 | S-002..S-010 | Selesaikan endpoint list/detail untuk members, redemptions, tiers, transactions, users | AI |
| 2026-04-21 | S-011..S-012 | Implement create/delete opaque POS token dari admin | AI |
| 2026-04-21 | S-013..S-014 | Rewrite auth POS V1 ke DB token lookup + merchant binding fix | AI |
| 2026-04-21 | S-015 | Tambah dokumentasi integrasi POS untuk external team | AI |
| 2026-04-22 | S-017..S-019 | Tambah planning API admin modul Voucher + relasi merchant + history voucher di member detail | AI |
| 2026-04-22 | S-017..S-019 | Implementasi API admin Voucher selesai + server boot sukses | AI |
| 2026-04-22 | S-020..S-021 | Tambah planning API admin modul Promo + relasi merchant | AI |
| 2026-04-22 | S-020..S-021 | Implementasi API admin Promo selesai + smoke test CRUD/scope sukses | AI |
| 2026-04-22 | QA Visual | Validasi report filter, error handling, datepicker, build fix Angular sukses (frontend) | AI |
| 2026-04-27 | S-022 | Reports & Logs | Tambah endpoints report `members-logs` & `users-logs`, template EJS, tambahkan kolom `userName` pada template, verifikasi HTML output, dan tambah logging login sukses ke `members_logs`. | AI |
| 2026-11-26 | S-023 | Igourmate DBF import API: parser `dbffile`, staging `dbf_import_batch`/`dbf_igourmete_daily`, endpoint upload/list/detail/rows/commit/delete, smoke test service + HTTP | AI |
| 2026-11-26 | S-023 | Commit Igourmate mengirim baris `dbf_igourmete_daily` ke `transaction`: `checkUid`→`checkUid`, `member`→`memberId`, `checkDate.checkNo`→`bill`, `timeOpen`→`billDate`, `syncType='dbf_igourmate'`; upsert via unique `bill` | AI |
| 2026-11-26 | S-024 | Admin points API: `GET /api/admin/points` (paginasi, filter search/type/archived/tanggal, `summary`) + `GET /api/admin/points/:id` (join bill/member/merchant/tier); smoke test lokal 43 baris, filter, 404 & 422 lolos | AI |
| 2026-11-26 | S-007, S-008 | Refactor API transactions: tabel utama `transaction` (sebelumnya `points`), point diagregasi per `transactionId` (`SUM` pointIn/pointOut + baris point terakhir untuk tier/archived), filter `type`/`inputDateFrom`..`inputDateTo` memakai kolom `transaction`, detail & list by `transaction.id`; `memberId` kosong dikembalikan `null` | AI |
| 2026-11-26 | S-025 | Arsip stack import CSV "Member Sales Listing Report": route `/api/admin/imports/member-sales` (8 endpoint), controller, `modules/import/member-sales.{parser,validator,service}.js`, 4 script (migrate + 3 test) dan 4 dokumen dipindah ke `server/ARCHIVED/`; mount di `routes/admin/index.js` dihapus. Tidak ada pemanggil di frontend (halaman `/csv-upload` sudah tidak ada), `import_batch` kosong, `transaction.import_batch_id` tidak pernah dibuat. Import DBF Igourmate (S-023) tetap aktif. | AI |

