# RULES — Query SQL & Backend Membership

Aturan wajib saat menulis/mengubah query dan service di `server/`. Ringkasan konteks ada di `agent-server.md` bagian 9.

---

## 1. Wajib parameterized

Semua nilai dari user **harus** lewat placeholder `?`.

```js
// BENAR
const [rows] = await connection.execute(
  'SELECT id, name FROM members WHERE phone = ? AND presence = 1 LIMIT 1',
  [phone]
);

// SALAH
const [rows] = await connection.execute(
  `SELECT id, name FROM members WHERE phone = '${phone}'`
);
```

Gunakan `query(sql, params)` dari `src/config/db.js` untuk query tanpa transaksi, dan `connection.execute()` untuk query di dalam transaksi.

---

## 2. Nama tabel/kolom dinamis harus dari whitelist

Kalau butuh kolom dinamis (mis. cari member by `id` / `phone` / `email`), petakan dulu:

```js
const FIELD_MAP = { id: 'id', phone: 'phone', email: 'email' };
const field = FIELD_MAP[identifier.field];
if (!field) throw createHttpError('Invalid identifier', 422);

const [rows] = await connection.execute(
  `SELECT id, name, email, tierId, status, presence
   FROM members
   WHERE ${field} = ? AND status = 1 AND presence = 1
   LIMIT 1`,
  [value]
);
```

Jangan pernah menempelkan `req.query.field` / `req.body.field` langsung ke SQL.

---

## 3. LIMIT / OFFSET

`LIMIT` dan `OFFSET` tidak bisa di-bind sebagai `?` pada semua driver, jadi boleh diinterpolasi **setelah** divalidasi angka dan dibatasi.

```js
const MAX_LIMIT = 200;
const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const page = toPositiveInt(req.query.page, 1);
const limit = Math.min(MAX_LIMIT, toPositiveInt(req.query.limit, 50));
const offset = (page - 1) * limit;

const rows = await query(
  `SELECT id, name FROM members WHERE presence = 1 ORDER BY id DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`
);
```

Pola ini sudah dipakai di `routes/admin/reports.routes.js` dan controller admin.

---

## 4. Filter point & soft delete

- Saldo point: **selalu** `archived = 0`.

```sql
SELECT COALESCE(SUM(CASE WHEN archived = 0 THEN pointIn ELSE 0 END), 0)  AS totalPointIn,
       COALESCE(SUM(CASE WHEN archived = 0 THEN pointOut ELSE 0 END), 0) AS totalPointOut
FROM points
WHERE memberId = ?
```

- Saldo = `totalPointIn - totalPointOut`.
- Master data (member, tier, voucher, promo, merchant, user) memakai `presence = 1` untuk data aktif.
- `status = 1` = aktif; `archived = 0` = masih dihitung.
- Hapus data = `UPDATE ... SET presence = 0`, **bukan** `DELETE`.

---

## 5. Transaksi database

Operasi yang menulis lebih dari satu tabel wajib dalam satu transaksi.

```js
const pool = await getPool();
const connection = await pool.getConnection();
let started = false;

try {
  await connection.beginTransaction();
  started = true;

  await connection.execute('INSERT INTO points (...) VALUES (...)', [...]);
  await connection.execute('INSERT INTO transaction (...) VALUES (...)', [...]);

  await connection.commit();
} catch (error) {
  if (started) await connection.rollback();
  throw error;
} finally {
  connection.release();
}
```

Jangan memakai `connection` dari pool tanpa `release()` di `finally`.

---

## 6. Error handling

- Service melempar error dengan `statusCode`:

```js
const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};
```

Helper ini ada lokal di `src/modules/membership/point.service.js` dan `redeem.service.js` (belum dipindah ke `src/helpers/`). Kalau butuh di service lain, ekstrak ke helper bersama — jangan duplikasi ketiga.
- `src/middleware/errorHandler.js` membaca `err.statusCode` (default 500) dan mengembalikan `{ success: false, message }`; detail stack hanya di-log saat bukan production.
- Validasi request (`express-validator` + `src/middleware/validateRequest.js`) → `fail(res, message, 422, errors)`.

Status yang dipakai konsisten di kode:
- `400` input tidak valid / saldo kurang / minimum redeem
- `401` token tidak ada / tidak valid / POS user tidak terhubung merchant
- `404` data tidak ditemukan
- `409` konflik (voucher sudah dipakai)
- `410` redeem code sudah dipakai / kedaluwarsa
- `422` validasi body/query
- `500` error tak terduga

---

## 7. Bentuk respons

```js
const success = (res, data, message = 'OK', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

const fail = (res, message = 'Bad Request', statusCode = 400, errors) =>
  res.status(statusCode).json({ success: false, message, errors: errors || null });
```

Selalu `require('../helpers/response')` — jangan menulis `res.json({...})` manual di controller, kecuali:
- report JSON: `{ success, meta, filters, rows }`
- report HTML: `res.send(html)` dengan `Content-Type: text/html; charset=utf-8`
- root `GET /` di `server.js`

---

## 8. Konvensi layer & route

1. Router di `src/routes/<area>/<nama>.routes.js` — hanya definisi path + middleware + pemanggilan controller.
2. Controller di `src/controllers/<area>/` — validasi ringan, panggil service, kirim respons.
3. Service/module di `src/modules/<area>/` — logika bisnis + SQL.
4. Router baru didaftarkan di `src/server.js` (`app.use('/api/...', router)`).
5. Middleware auth: `auth` (JWT member/admin) atau `authPosV1` (token POS). Jangan menghapus `auth` dari route yang sudah memakainya.
6. Route yang masih `/*auth,*/` adalah TODO keamanan — jangan ditambah route baru tanpa auth di file yang sama.

---

## 9. Larangan

- ❌ String concatenation nilai user ke SQL.
- ❌ `SELECT *` di endpoint publik (sebutkan kolom yang dipakai).
- ❌ Menghitung saldo tanpa `archived = 0`.
- ❌ Menulis `points` tanpa `transactionId` / `memberId` / `tierId`.
- ❌ Hard delete data master.
- ❌ Menyimpan password plaintext (pakai `bcryptjs`, `BCRYPT_SALT_ROUNDS`).
- ❌ `console.log` berisi token/password.
- ❌ Mengubah `swagger.json` manual (generate dengan `npm run swagger`).
- ❌ Menjalankan `initDatabase()` sebagai cara membuat tabel (fungsi ada tapi tidak dipanggil di `server.js`).
- ❌ INSERT ke `members` tanpa `id` — kolom `id` VARCHAR(50) tanpa AUTO_INCREMENT; pakai `src/helpers/memberId.js` (`insertMember`) agar ID berbentuk kode POS 20 digit.


