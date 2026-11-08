# Finvest

Situs edukasi investasi untuk pemula dan dashboard pemantau pasar. Satu halaman HTML tanpa framework.
Harga berupa **data tertunda**, bukan real-time. Kalau data belum termuat, halaman memakai data simulasi yang berlabel SIMULASI.

## Cara kerja

1. GitHub Actions menjalankan `scripts/fetch-market.mjs` tiap 30 menit.
2. Skrip mengambil harga harian (1 tahun) dan per jam (7 hari) lalu menulis `data/market.json`.
3. `index.html` membaca `data/market.json` dan menampilkan statusnya sebagai TERTUNDA, lengkap dengan waktu data terakhir.

Aset: IHSG, BBCA, BBRI, TLKM, ASII, Bitcoin, Ethereum, USD/IDR, S&P 500, dan emas.
Harga emas dihitung dari emas berjangka dunia (USD per ons) dikali kurs USD/IDR per gram. Ini bukan harga Antam atau toko emas.

## Pasang di GitHub Pages

1. Buat repo baru, lalu unggah semua isi folder ini (termasuk folder `.github`).
2. Settings > Actions > General > Workflow permissions: pilih **Read and write permissions**.
3. Settings > Pages: Source **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Tab Actions > **Perbarui data pasar** > Run workflow, supaya `data/market.json` terisi tanpa menunggu jadwal.
5. Buka alamat Pages Anda. Banner di atas halaman harus berubah dari SIMULASI menjadi TERTUNDA.

## Catatan penting

- Sumber data adalah endpoint chart Yahoo Finance yang **tidak resmi**. Ketentuan penggunaannya perlu Anda periksa sendiri, dan endpoint bisa berubah atau berhenti kapan saja. Untuk produk publik jangka panjang, pertimbangkan penyedia data yang resmi.
- Jika sebuah aset gagal diambil, skrip memakai data terakhir yang berhasil untuk aset itu. Waktu "Data per" di panel detail menunjukkan umur datanya.
- Jadwal GitHub Actions tidak presisi dan bisa telat beberapa menit. Untuk repo yang lama tidak aktif, GitHub dapat menghentikan jadwal otomatis. Jalankan manual dari tab Actions jika itu terjadi.
- Watchlist, alert, tata letak, dan progres belajar disimpan di browser masing-masing pengunjung.
- Edukasi di situs ini bersifat umum dan bukan saran membeli atau menjual.
