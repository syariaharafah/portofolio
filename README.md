# Portofolio Siti Syariah Arafah

Portofolio statis yang ringan dengan panel admin ramah pengguna dan dukungan Supabase.

## Menjalankan di komputer

1. Buka terminal pada folder proyek.
2. Jalankan `python -m http.server 8080`.
3. Buka `http://localhost:8080/` untuk portofolio.
4. Buka `http://localhost:8080/admin/` untuk admin.

Jika Supabase belum tersambung, admin menawarkan **mode demo lokal**. Semua formulir dan pratinjau dapat dicoba, tetapi perubahan hanya tersimpan pada browser tersebut.

## Menyambungkan Supabase

1. Buat proyek Supabase baru.
2. Jalankan migration `supabase/migrations/202611240001_portfolio_cms.sql` melalui Supabase CLI atau SQL Editor.
3. Salin Project URL dan publishable key ke `site-config.js`.
4. Pada Authentication → URL Configuration, gunakan `https://syariaharafah.github.io/portofolio/` sebagai Site URL dan tambahkan `https://syariaharafah.github.io/portofolio/admin/` sebagai Redirect URL.
5. Buka `/admin/`, isi kata sandi minimal delapan karakter, lalu tekan **Aktifkan akun admin pertama**.
6. Konfirmasi email `cantiksyariah348@gmail.com` jika diminta.
7. Masuk ke admin dan tekan **Masukkan data awal** pada halaman Ringkasan.

Akun lain tidak mendapatkan akses admin. Secret key atau service-role key tidak boleh dimasukkan ke repository.

## Pengelolaan konten

Admin dapat mengubah seluruh tulisan publik, biodata, pendidikan, pencapaian, kegiatan, organisasi, bagian tambahan, foto, sertifikat, dokumen, warna, serta sakura. Item dapat disimpan sebagai draft sebelum ditayangkan.

Saat sertifikat diunggah, browser menyimpan berkas asli dan membuat thumbnail WebP maksimal 720 piksel. Halaman publik mengambil seluruh data dalam satu permintaan, memakai cache lokal, dan tetap memiliki data cadangan jika Supabase sedang tidak tersedia.

## Pengujian

Jalankan:

```powershell
npm test
```

Push ke GitHub dilakukan manual oleh pemilik repository.
