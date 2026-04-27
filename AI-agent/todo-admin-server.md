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
