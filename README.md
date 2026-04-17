# Membership REST API (Server)

Backend untuk aplikasi membership berbasis **Node.js + Express** dengan **MySQL**, autentikasi **JWT**, enkripsi password **bcryptjs**, konfigurasi environment via **dotenv**, realtime update via **Socket.IO**, dan pembuatan **report HTML menggunakan Handlebars**.

## Tech Stack

- Node.js **v24.x (LTS)**
- Express
- MySQL
- Socket.IO
- Handlebars (reports)
- JWT (jsonwebtoken)
- dotenv
- bcryptjs

Dependency tambahan yang direkomendasikan:

- cors
- helmet
- morgan
- express-validator
- nodemon (dev)

## Fitur Utama

- REST API untuk auth dan data membership
- Login dengan JWT token
- Password hashing menggunakan bcryptjs
- Realtime event (contoh: update poin, redemption status) via Socket.IO
- Report membership/voucher/redemption dalam format HTML (Handlebars)
- Konfigurasi environment terpisah menggunakan dotenv

## Prasyarat

Pastikan sudah terpasang:

1. Node.js `24.x` versi LTS
2. MySQL `8.x` (atau kompatibel)
3. npm `10+`

Cek versi:

```bash
node -v
npm -v
mysql --version
```

## Persiapan Project

Masuk ke folder server:

```bash
cd server
```

Inisialisasi project (jika belum ada `package.json`):

```bash
npm init -y
```

Install dependency utama:

```bash
npm install express mysql2 socket.io jsonwebtoken dotenv bcryptjs handlebars
```

Install dependency tambahan yang direkomendasikan:

```bash
npm install cors helmet morgan express-validator
npm install -D nodemon
```

## Konfigurasi Environment

Buat file `.env` di folder `server` (bisa copy dari `.env.example`):

```bash
cp .env.example .env
```

Isi default `.env.example`:

```env
APP_NAME=membership-api
PORT=3000
NODE_ENV=development

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=your_password
DB_NAME=membership_db

JWT_SECRET=replace_with_long_random_secret
JWT_EXPIRES_IN=1d

BCRYPT_SALT_ROUNDS=10
```

Catatan:

- Jangan commit file `.env` ke repository.
- Gunakan secret panjang dan acak untuk `JWT_SECRET`.

## Setup Database (MySQL)

Script schema tersedia di:

- `AI-agent/table.sql`

Contoh import:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS membership_db"
mysql -u root -p membership_db < AI-agent/table.sql
```

## Struktur Folder (Server)

```text
server/
	AI-agent/
		agent.md
		table.sql
	README.md
	.env
	package.json
	src/
		server.js          ← entry point tunggal (Express + Socket.IO + startup)
		config/
		controllers/
			admin/
			membership/
		modules/
		helpers/
		routes/
		middleware/
		sockets/
		reports/
			templates/
```

## Anatomi server.js

Semua konfigurasi ada dalam satu file `src/server.js` dengan urutan berikut:

```
src/server.js
  ├── dotenv.config()              → load .env
  ├── express() + http.createServer() → buat app dan HTTP server
  ├── initSocket(server)           → daftarkan Socket.IO
  ├── helmet, cors, morgan, json   → middleware global
  ├── GET /                        → root check
	├── /api/admin/* & /api/membership/* routes
  ├── 404 handler
  ├── errorHandler()
  └── server.listen(PORT)          → startup + inisialisasi DB
```

## Peran Folder Inti

- `src/middleware/`
  Berisi middleware Express yang dipakai di request pipeline, contoh: verifikasi JWT, validasi request, dan global error handler.
- `src/sockets/`
  Berisi handler event Socket.IO untuk koneksi realtime, emit event, room management, dan event listener.
- `src/helpers/`
  Berisi fungsi global reusable yang stateless, contoh: formatter tanggal, response helper, parser util sederhana.

Aturan praktis:

- Jika fungsi dipakai lintas modul dan tidak memuat business logic utama, taruh di `helpers`.
- Jika logic melekat ke alur bisnis membership, taruh di `modules` atau `services` (jika nanti ditambahkan folder `services/`).

## Menjalankan Aplikasi

Tambahkan script berikut di `package.json`:

```json
{
	"scripts": {
		"dev": "nodemon src/server.js",
		"start": "node src/server.js"
	}
}
```

Install dependency dulu:

```bash
npm install
```

Jalankan mode development:

```bash
npm run dev
```

Jalankan mode production:

```bash
npm start
```

Catatan startup:

- Server tetap akan hidup walaupun database belum tersedia (limited mode).
- Endpoint yang butuh DB (auth/profile/report) baru normal setelah MySQL dan DB siap.
- Saat pertama kali DB terhubung, tabel `users` dan `members` akan dibuat otomatis jika belum ada.

Server aktif di:

- `http://localhost:3000`

## Contoh Endpoint REST API

Base URL:

- `/api`

Contoh endpoint:

- `GET /api/health`
- `GET /api/admin/ping`
- `GET /api/membership/ping`
- `POST /api/membership/auth/register`
- `POST /api/membership/auth/login`

Header untuk endpoint yang butuh auth:

```http
Authorization: Bearer <jwt_token>
```

## Socket.IO (Realtime)

Gunakan namespace/event untuk notifikasi realtime, misalnya:

- `points:updated`
- `voucher:redeemed`
- `member:status_changed`

Contoh use case:

- Setelah proses redeem sukses, backend emit event `voucher:redeemed` ke client terkait.

## Reports dengan Handlebars

Template report disimpan di folder:

- `src/reports/templates/`

Alur umum:

1. Query data dari MySQL
2. Render template Handlebars dengan data
3. Kembalikan hasil HTML (atau lanjut ke PDF jika diperlukan)

Contoh route report:

- `GET /api/v1/reports/members`
- `GET /api/v1/reports/redemptions`

## Keamanan Dasar yang Disarankan

- Gunakan `helmet` untuk secure HTTP header
- Batasi CORS hanya ke domain frontend yang valid
- Validasi body/query/params request
- Hash password dengan `bcryptjs`
- Simpan JWT secret di env, bukan hardcoded
- Terapkan rate limiting untuk endpoint login (opsional tapi direkomendasikan)

## Status API

Dokumen ini menyiapkan fondasi server API membership. Jika ingin, langkah berikutnya bisa ditambahkan:

- Swagger/OpenAPI docs
- Unit/integration test (Jest + Supertest)
- Dockerfile + docker-compose untuk MySQL
- CI pipeline (lint + test)

---

Jika kamu mau, saya bisa lanjut sekalian bikin:

1. skeleton struktur `src` untuk Express
2. boilerplate koneksi MySQL
3. middleware auth JWT
4. contoh endpoint login + profile + realtime event
