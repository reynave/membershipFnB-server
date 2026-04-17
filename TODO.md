# TODO Membership API (Server)

Dokumen ini untuk tracking pekerjaan backend Membership API.

## Backlog

- [x] Setup boilerplate Express di src
- [x] Setup koneksi MySQL pool (mysql2)
- [x] Buat module auth (register/login)
- [x] Implement JWT middleware (protect route)
- [x] Implement hashing password dengan bcryptjs
- [x] Implement endpoint profile member
- [x] Implement endpoint point history
- [ ] Implement endpoint redeem voucher
- [x] Implement event Socket.IO dasar (join room, ping/pong)
- [ ] Implement event redeem voucher realtime
- [ ] Implement template report Handlebars redemptions
- [x] Implement template report Handlebars members
- [x] Tambahkan validasi request (express-validator)
- [x] Tambahkan security middleware (helmet, cors)
- [x] Tambahkan logging request (morgan)
- [x] Tambahkan error handling global
- [ ] Buat dokumentasi endpoint (Swagger/OpenAPI)
- [ ] Tambahkan unit/integration test (Jest + Supertest)

## In Progress

- [ ] (isi saat ada task aktif)

## Done

- [x] Menyusun README awal server Membership API
- [x] Generate boilerplate backend Express yang executable
- [x] Menambahkan .env.example, package.json, dan struktur src dasar

## Notes

- Alur bisnis final menunggu flowchart dari tim produk.
- Setelah flowchart siap, breakdown task per modul auth/member/points/redeem/reports.
