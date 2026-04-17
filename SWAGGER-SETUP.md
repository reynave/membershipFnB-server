# Dokumentasi API Membership dengan Swagger

Dokumentasi API Membership sekarang terintegrasi langsung dengan Express server menggunakan `swagger-ui-express`. Anda bisa akses dokumentasi secara lokal tanpa perlu tools eksternal.

## Akses Swagger UI Lokal (Recommended)

### 1. Pastikan Server Running

```bash
npm start
# atau
npm run dev
```

Server akan berjalan di `http://localhost:3200` (atau port yang dikonfigurasi di `.env`)

### 2. Buka Swagger UI di Browser

Kunjungi URL ini di browser:

```
http://localhost:3200/api-docs
```

Dokumentasi API akan tampil dengan UI interaktif lengkap dengan:
- Daftar semua endpoint
- Request/Response schemas
- Contoh data
- Try it out (testing langsung dari browser)

### 3. Testing Endpoint dari Swagger UI

Klik endpoint yang ingin ditest, lalu:

1. **Isi parameter/body** sesuai contoh
2. Klik tombol **Try it out**
3. Klik **Execute**
4. Response akan tampil di bawah

## Setup yang Sudah Dilakukan

### 1. Install Packages

```bash
npm install swagger-ui-express swagger-autogen
```

### 2. Konfigurasi Swagger (swagger-config.js)

File `swagger-config.js` berisi konfigurasi untuk auto-generate `swagger.json` dari route configuration.

### 3. Integrasi ke Express Server (src/server.js)

Server Express sekarang melayani Swagger UI di endpoint `/api-docs`:

```javascript
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../swagger.json');

app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Membership API Documentation'
}));
```

### 4. Generate Swagger Documentation

Jalankan command berikut untuk generate/update `swagger.json`:

```bash
npm run swagger
```

## File Dokumentasi

- `swagger.json` - OpenAPI 3.0 specification (auto-generated)
- `swagger-config.js` - Konfigurasi swagger-autogen
- `SWAGGER-SETUP.md` - File ini (panduan setup)

## Endpoint yang Terdokumentasi

1. **Health Check**
   - `GET /api/membership/ping`

2. **Authentication**
   - `POST /api/membership/auth/register` - Daftar member baru
   - `POST /api/membership/auth/login` - Login & dapatkan JWT token

3. **Points Management**
   - `POST /api/membership/points/transactions` - Buat transaksi point dari POS
   - `GET /api/membership/points/balance` - Lihat total point balance member

## Testing Endpoint dari Swagger UI

### Contoh 1: Register Member

1. Klik endpoint `POST /api/membership/auth/register`
2. Klik **Try it out**
3. Isi request body:
   ```json
   {
     "name": "John Doe",
     "email": "john@example.com",
     "password": "securepass123"
   }
   ```
4. Klik **Execute**
5. Response akan menampilkan data member yang baru didaftar + JWT token

### Contoh 2: Login

1. Klik endpoint `POST /api/membership/auth/login`
2. Klik **Try it out**
3. Isi request body:
   ```json
   {
     "email": "john@example.com",
     "password": "securepass123"
   }
   ```
4. Klik **Execute**
5. Copy JWT token dari response untuk endpoint yang butuh auth

### Contoh 3: Buat Transaksi Point

1. Klik endpoint `POST /api/membership/points/transactions`
2. Klik **Try it out**
3. Isi header `token`: `tokensimpan.database`
4. Isi request body:
   ```json
   {
     "bill": "INV-2026-001",
     "totalAmount": 500000,
     "billDate": "2026-04-16 14:30:00",
     "note": "Pembelian di POS",
     "memberId": "1"
   }
   ```
5. Klik **Execute**

### Contoh 4: Lihat Point Balance

1. Klik endpoint `GET /api/membership/points/balance`
2. Klik **Try it out**
3. Klik lock icon untuk setup JWT token (atau input di Authorization header)
4. Paste JWT token dari login response
5. Klik **Execute**
6. Response akan menampilkan balance point member

## Catatan Penting

1. **JWT Token**: Semua endpoint dengan prefix `[lock icon]` memerlukan JWT token dari login. Copy token dari login response dan paste di Authorization header.

2. **Token Merchant**: Endpoint transaksi point memerlukan header `token` dengan nilai dari tabel `users_token` (bukan Bearer token).

3. **Member Tier**: Member harus memiliki tier yang valid untuk membuat transaksi point. Default tier adalah 0, perlu di-update ke tier yang ada (1, 2, 3, dll).

4. **Archived Records**: Endpoint balance point hanya menghitung record dengan `archived = 0`.

## Troubleshooting

### Swagger UI tidak muncul?

- Pastikan server sudah running: `npm start`
- Cek URL: `http://localhost:3200/api-docs` (ganti port sesuai `.env` jika berbeda)
- Cek terminal server ada error atau tidak

### Endpoint tidak tersedia di Swagger?

- Jalankan: `npm run swagger` untuk generate ulang dokumentasi
- Restart server: Ctrl+C lalu `npm start`

### JWT token expired?

- Login ulang untuk mendapatkan token baru
- Default expiry: 1 hari (bisa diubah di `.env` dengan `JWT_EXPIRES_IN`)

## Update Dokumentasi

Setiap kali menambah atau mengubah endpoint, jalankan:

```bash
npm run swagger
```

Kemudian reload browser untuk melihat dokumentasi yang ter-update.
