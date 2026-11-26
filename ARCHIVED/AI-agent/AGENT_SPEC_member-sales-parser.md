# Spec untuk AI Agent: Parser "Member Sales Listing Report"

## Tugas
Revisi kode parser (Node.js, tanpa dependency baru) supaya membaca file export app desktop lama
"Member Sales Listing Report" secara **tahan terhadap variasi format**.
Referensi implementasi awal: `parse-member-sales.js`.

## Prinsip (wajib)
1. **Jangan memperbaiki data.** Sumber data kadang tidak konsisten. Parser hanya membaca,
   menyimpan nilai asli apa adanya, dan melaporkan ketidakcocokan.
2. **Jangan hardcode posisi.** Tidak boleh ada nomor baris, indeks kolom tetap, atau daftar
   prefix PLU (`AC`, `DM`, dst.) di dalam logika parsing.
3. **Klasifikasi baris berdasarkan bentuknya**, bukan urutannya.
4. **Tidak ada baris yang dibuang diam-diam.** Baris tak dikenal masuk `warnings` beserta nomor barisnya.
5. **ID tetap string** (Member ID berawalan nol, Check#, PLU).

## Karakteristik format
- Encoding bisa UTF-16 LE/BE (dengan BOM), UTF-8 (dengan/tanpa BOM). Line ending CRLF atau LF.
- Ini laporan cetak, bukan CSV murni. Kolom dipisah `,,` dan nilai diberi padding spasi.
- Header kolom ada di baris `Check#,,PLU,,Description,,...`. Nama dan urutan kolom bisa berubah.
- **Kolom pertama (`Check#`) hanya diisi di item pertama tiap check.** Item berikutnya dalam check
  yang sama menghilangkan kolom itu, jadi jumlah kolomnya satu lebih sedikit dan semua nilai bergeser.
- Satu file berisi banyak member. Bisa ada beberapa blok laporan (header diulang di tengah file).
- Setiap member punya footer ringkasan berisi pasangan `Label:,nilai` (satu atau dua pasangan per baris).
- Nomor check **tidak unik** (bisa sama dua kali dalam satu member). Laporan tidak memuat tanggal per check.

## Algoritma

### 1. Decode
- Cek BOM: `FF FE` → UTF-16 LE, `FE FF` → UTF-16 BE, `EF BB BF` → UTF-8.
- Tanpa BOM: jika ada banyak byte `0x00` selang-seling → UTF-16 LE, selain itu UTF-8.
- Buang BOM, normalisasi `\r\n` → `\n`.

### 2. Klasifikasi tiap baris (trim dulu, urutan ini)
| Urutan | Kelas | Ciri |
|---|---|---|
| 1 | `blank` | kosong |
| 2 | `separator` | `^-{3,}` (garis atau `--------  --------`) |
| 3 | `end` | diawali `<<` |
| 4 | `report_title` | sama dengan judul laporan; jika muncul lagi di tengah file, mulai blok laporan baru |
| 5 | `meta` | `Bus Date`, `Printed At`, `Printed By`, nama outlet `(...)` |
| 6 | `member` | `Member ID:,<digit>,,Member Name:,<teks>` |
| 7 | `column_header` | diawali `Check#` / mengandung nama kolom (`PLU`, `Description`, `Qty`...) |
| 8 | `footer_total` | `Total:` diikuti beberapa angka |
| 9 | `footer_kv` | `Label:,angka` dengan pasangan kedua opsional `,,Label:,angka` |
| 10 | `item` | sisanya, jika lolos aturan di langkah 4 |
| 11 | `unknown` | selain itu → `warnings` |

### 3. Petakan kolom dari header (bukan hardcode)
- Dari `column_header`, split `,,` lalu trim → daftar nama kolom, mis. `[Check#, PLU, Description, Price, Qty, Item Sales, Item Disc, Item Total]`.
- Normalisasi nama ke kunci internal lewat tabel alias (`Item Sales` → `itemSales`, dst.).
  Kolom baru yang tak dikenal tetap disimpan di `extra[nama]`.
- Simpan peta ini per blok laporan. Jika header berubah di tengah file, pakai yang terbaru.

### 4. Parsing baris item, dengan jangkar di kanan
Karena kolom pertama bisa hilang, jangan baca dari kiri.
1. `cols = line.split(',,').map(trim)`.
2. `n = jumlah kolom header`. Jika `cols.length == n` → baris punya Check#.
   Jika `cols.length == n - 1` → baris lanjutan (Check# tidak ada).
   Selain itu → coba fallback langkah 5, kalau gagal masuk `warnings`.
3. Ambil dari **kanan**: kolom numerik (Price, Qty, Item Sales, Item Disc, Item Total) sesuai peta header.
4. Sisa di kiri: `[check?] PLU Description`. Description adalah semua yang ada di antara PLU dan kolom numerik pertama.
5. Fallback jika Description mengandung koma/`,,`: ambil token numerik dari kanan sebanyak jumlah kolom numerik, sisanya digabung kembali sebagai teks.
6. Angka: buang spasi, dukung tanda minus (retur/void), dan desimal bila ada. Jangan memakai `parseInt` yang diam-diam menelan teks. Jika bukan angka valid → `warnings`.

### 5. State machine
```
state: report, member, check
on member      -> member = baru; check = null
on item:
    jika punya Check#  -> check = { seq: member.checks.length + 1, no: Check#, items: [] }; member.checks.push(check)
    jika tanpa Check#  -> pakai check saat ini
    jika check == null -> warning "item tanpa check" (jangan menebak)
    check.items.push(item)
on footer_total / footer_kv -> simpan ke member.footer (kunci hasil normalisasi label)
on end / EOF -> tutup member terakhir
```
- Kunci unik check = `(memberId, seq)`, **bukan** `no`.
- Jika file terpotong (footer tidak ada), member tetap disimpan dengan `footer = {}` dan `warnings`.

### 6. Validasi (hanya melaporkan, tidak mengubah data)
Per member, bandingkan nilai footer dengan hitungan ulang dari item:
- `footer.qty == Σ qty`, `footer.itemSales == Σ itemSales`, `footer.itemTotal == Σ itemTotal`
- `footer.checkCount == jumlah check`
- `footer.grossTotal == footer.itemTotal − checkDisc + tax + sc`

Per item:
- `price × qty == itemSales`
- `itemSales − itemDisc == itemTotal`

Setiap selisih → `issues[]` dengan `{memberId, checkSeq, plu, type, expected, actual}`.
Hanya cek yang kolom/footer-nya ada. Jika tidak ada, lewati, jangan error.

### 7. Kebijakan nilai yang dipakai
Simpan **kedua** nilai (`itemSales` dan `itemTotal`) apa adanya. Sediakan opsi konfigurasi
`amountSource: 'itemTotal' | 'itemSales' | 'computed'` (computed = `price × qty − itemDisc`)
supaya keputusan "mana yang benar" tidak tertanam di parser.

## Output
```json
{
  "outlet": "THE LEAF",
  "dateFrom": "2026-01-01", "dateTo": "2026-01-31",
  "printedAt": "...", "printedBy": "...",
  "members": [{
    "memberId": "00002023000000000250", "name": "VEDA ANGELA",
    "checks": [{ "seq": 1, "no": "00039",
      "items": [{ "plu": "...", "description": "...", "price": 0, "qty": 0,
                  "itemSales": 0, "itemDisc": 0, "itemTotal": 0, "extra": {} }] }],
    "footer": { "qty": 0, "itemSales": 0, "itemDisc": 0, "itemTotal": 0, "checkCount": 0,
                "cover": 0, "checkDisc": 0, "salesPerCheck": 0, "tax": 0, "sc": 0, "grossTotal": 0 }
  }],
  "warnings": [{ "line": 0, "text": "..." }],
  "issues": []
}
```
Tanggal `dd/mm/yyyy` diubah ke ISO `yyyy-mm-dd`. `printedAt` tetap string asli karena formatnya ambigu.

## Kriteria selesai (uji dengan file contoh)
1. `sales test.csv` (versi asli yang kolomnya bergeser): 1 member, 1 check, 13 item, qty 16,
   `itemSales` 968400. Terdeteksi 1 selisih: `ACKL0004` (expected 82000, actual 164000).
2. `MEMBER_Sales_Listing_Report.csv`: 189 member, 274 check, 2617 item, 0 warning.
   Semua pengecekan footer lolos. 196 selisih `item.total` (hampir semuanya PLU berawalan `AC`).
3. Uji sintetis (buat sendiri):
   - file UTF-8 tanpa BOM dan file UTF-16 BE
   - header kolom dengan urutan berbeda atau kolom tambahan
   - Description berisi koma
   - Qty atau harga negatif (retur)
   - dua check bernomor sama dalam satu member
   - blok laporan yang diulang di tengah file
   - footer hilang (file terpotong)
   - baris sampah → harus muncul di `warnings`, parser tidak crash
4. Tidak ada angka kolom, nomor baris, atau prefix PLU yang tertanam di logika.
