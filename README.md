# 🛡️ Shadow Security Indonesia — Web App Bimbingan Cyber Security

Aplikasi web bimbingan belajar (bimbel) cyber security, dibangun dengan **Node.js + Express + EJS + SQLite**, siap dijalankan di server (VPS, cloud, atau shared hosting yang mendukung Node.js).

## ✨ Fitur Utama

1. **Lab Praktik Virtual Terintegrasi (Sandbox/CTF)** — terminal simulasi berbasis browser (tanpa instalasi) untuk latihan network recon, Linux privilege escalation, SQL Injection, dan analisis log forensik, lengkap dengan sistem submit flag & poin.
2. **Jalur Pembelajaran Terstruktur (Learning Path)** — kurikulum bertahap: Fundamental → Ethical Hacking → Web Security → Incident Response, dengan kuis pemahaman di tiap modul dan tag selaras sertifikasi industri (CompTIA, CEH, OSCP, dll).
3. **Bimbingan & Evaluasi Mentor** — jadwal kelas live, forum diskusi/Q&A, serta fitur upload & review konfigurasi/laporan pentest oleh mentor.
4. **Sistem Pelacakan Progres** — dashboard skor & statistik, analisis skill gap per kompetensi, rekomendasi modul otomatis, riwayat aktivitas lab, dan papan peringkat (leaderboard).

Role pengguna: **student**, **mentor**, **admin** (kelola seluruh konten).

---

## 📦 Struktur Proyek

```
shadow-security-bimbel/
├── server.js              # entry point aplikasi
├── db/
│   ├── database.js        # koneksi & skema SQLite
│   └── seed.js            # data awal (akun demo, modul, lab, dll)
├── middleware/auth.js      # proteksi login & role
├── routes/                 # auth, dashboard, learning, lab, mentor, admin
├── views/                  # template EJS
├── public/                 # css, js (termasuk simulasi terminal), file upload
└── data/                   # database SQLite (dibuat otomatis saat run)
```

---

## 🚀 Instalasi & Menjalankan di Server

### 1. Prasyarat
- **Node.js versi 18 LTS ke atas** (cek dengan `node -v`)
- **npm** (biasanya sudah termasuk dengan Node.js)
- Server Linux (Ubuntu/Debian/CentOS) dengan akses SSH, atau layanan seperti VPS/Cloud (DigitalOcean, AWS EC2, Railway, Render, dsb.)

### 2. Upload/Clone Proyek ke Server
Upload folder `shadow-security-bimbel` ke server, misalnya ke `/var/www/shadow-security-bimbel`.

### 3. Install Dependencies
```bash
cd shadow-security-bimbel
npm install
```
> Catatan: `better-sqlite3` memerlukan kompilasi native saat instalasi. Jika muncul error terkait `node-gyp`, install build tools terlebih dahulu:
> ```bash
> # Ubuntu/Debian
> sudo apt-get update && sudo apt-get install -y build-essential python3
> ```

### 4. Konfigurasi Environment
```bash
cp .env.example .env
nano .env
```
Isi minimal:
```
PORT=3000
SESSION_SECRET=ganti-dengan-string-acak-panjang
NODE_ENV=production
APP_NAME="Shadow Security Indonesia"
```
Generate secret acak dengan: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 5. Seed Data Awal (opsional tapi disarankan untuk demo)
```bash
npm run seed
```
Ini akan membuat akun demo:
| Role   | Email                          | Password     |
|--------|--------------------------------|--------------|
| Admin  | admin@shadowsecurity.id        | Admin123!    |
| Mentor | mentor@shadowsecurity.id       | Mentor123!   |
| Mentor | sinta@shadowsecurity.id        | Mentor123!   |
| Siswa  | siswa@shadowsecurity.id        | Student123!  |

**⚠️ PENTING:** Ganti/hapus akun demo ini sebelum go-live produksi (lihat bagian Keamanan di bawah).

### 6. Jalankan Aplikasi
```bash
npm start
```
Aplikasi berjalan di `http://localhost:3000` (atau port sesuai `.env`).

### 7. Menjalankan Permanen dengan PM2 (Direkomendasikan untuk Produksi)
```bash
sudo npm install -g pm2
pm2 start server.js --name shadow-security-bimbel
pm2 save
pm2 startup   # ikuti instruksi yang muncul agar auto-start saat server reboot
```
Kelola aplikasi:
```bash
pm2 logs shadow-security-bimbel   # lihat log
pm2 restart shadow-security-bimbel
pm2 stop shadow-security-bimbel
```

### 8. Reverse Proxy dengan Nginx + HTTPS (Direkomendasikan)
Contoh konfigurasi Nginx (`/etc/nginx/sites-available/shadow-security`):
```nginx
server {
    listen 80;
    server_name bimbel.shadowsecurity.id;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 10M;
}
```
Aktifkan lalu pasang SSL gratis dengan Let's Encrypt:
```bash
sudo ln -s /etc/nginx/sites-available/shadow-security /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d bimbel.shadowsecurity.id
```
Setelah HTTPS aktif, set `FORCE_HTTPS=true` di `.env` agar cookie sesi memakai flag `secure`.

---

## 🔒 Catatan Keamanan Sebelum Produksi

- Ganti `SESSION_SECRET` dengan string acak yang kuat dan rahasia.
- Hapus atau ganti password akun demo (admin/mentor/siswa) setelah deployment.
- Backup berkala file `data/shadow_security.db` (berisi seluruh data pengguna & progres).
- Batasi ukuran & tipe file upload (sudah diterapkan pada fitur review: maks 5MB, ekstensi terbatas).
- Jalankan di belakang HTTPS (reverse proxy Nginx/Caddy) agar sesi login terenkripsi.
- Lab "sandbox/CTF" pada aplikasi ini merupakan **simulasi edukatif berbasis JavaScript di sisi klien** (bukan mesin virtual/container sungguhan). Jika ke depannya ingin menghadirkan sandbox nyata (mis. container Docker/Kali per siswa), diperlukan infrastruktur tambahan seperti Docker + orchestrator (mis. Apache Guacamole/Kasm Workspaces) yang disarankan diintegrasikan secara terpisah demi keamanan dan isolasi.

---

## 🛠️ Kelola Konten (Sebagai Admin)

Login sebagai admin, lalu buka menu **Admin** di navbar untuk:
- Menambah/menghapus **Learning Path** dan **Modul** (termasuk kuis pemahaman).
- Menambah/menghapus **Lab CTF** baru — termasuk mengatur skenario terminal simulasi via JSON (field `filesystem`, `services`, `webRoutes`, `suidBinaries`, `loginForm`, dsb — lihat contoh pada `db/seed.js`).
- Mengubah role pengguna (student/mentor/admin).

Mentor dapat membuat **Kelas Live** (`/mentor/live-classes/new`) dan memberi **feedback review** laporan/konfigurasi siswa (`/mentor/reviews`).

---

## 🧯 Troubleshooting

| Masalah | Solusi |
|---|---|
| `npm install` gagal di `better-sqlite3` | Install `build-essential` & `python3` (lihat langkah 3), lalu ulangi `npm install`. |
| Port sudah dipakai | Ubah `PORT` di `.env`. |
| Sesi login selalu logout | Pastikan folder `data/` writable oleh user yang menjalankan Node, dan `SESSION_SECRET` konsisten (jangan berubah tiap restart). |
| Ingin reset seluruh data | Hentikan aplikasi, hapus folder `data/`, jalankan ulang `npm run seed` lalu `npm start`. |

---

Dibuat untuk **Shadow Security Indonesia** — Bimbingan Cyber Security. Selamat belajar dan tetap etis! 🛡️
