# Deploy ke VPS (dam.punyasurya.com)

Setiap push ke `main`, GitHub Actions menjalankan tes dan build, lalu mengirim hasilnya ke VPS lewat SSH:

- Tampilan web (`dist/`) ke `/var/www/dam.punyasurya.com` (folder virtualhost dari SinarPanel).
- Server room online (`dist-server/server.mjs`, satu file tanpa `node_modules`) ke `/opt/dam-daman`, dijalankan oleh systemd sebagai service `dam-daman` di `127.0.0.1:3747`.
- Apache meneruskan `/socket.io/` (WebSocket) dan `/api/` ke server itu.

Kalau secret belum diisi, langkah deploy dilewati dengan peringatan dan CI tetap hijau.

## Setup sekali saja

### 1. Siapkan VPS

Butuh user biasa untuk deploy (contoh: `surya`) yang bisa login lewat SSH.

```bash
# di komputer sendiri: salin folder deploy ke VPS
scp -r deploy surya@IP_VPS:~/dam-daman-deploy

# di VPS
sudo bash ~/dam-daman-deploy/setup-vps.sh surya
```

Skrip ini (aman dijalankan ulang):

1. Memasang Node.js 22 kalau belum ada.
2. Membuat `/opt/dam-daman` dan memberi user deploy izin tulis ke `/var/www/dam.punyasurya.com`.
3. Memasang service systemd `dam-daman`.
4. Menambah aturan sudoers supaya user deploy hanya boleh menjalankan `systemctl restart dam-daman` tanpa password.
5. Mengaktifkan modul Apache `proxy proxy_http proxy_wstunnel rewrite headers`, menyalin `deploy/apache-dam-daman.conf` ke `/etc/apache2/dam-daman.conf`, dan menambah satu baris `Include /etc/apache2/dam-daman.conf` di `dam.punyasurya.com-le-ssl.conf` (file lama dicadangkan dulu). Kalau `apache2ctl configtest` gagal, file dikembalikan dari cadangan.

> Catatan SinarPanel: kalau suatu saat SinarPanel membuat ulang file `dam.punyasurya.com-le-ssl.conf` (misalnya saat SSL diperpanjang atau virtualhost diedit dari panel), baris `Include` bisa hilang. Jalankan lagi skrip setup, atau tambahkan baris itu manual di dalam `<VirtualHost *:443>`.

### 2. Kunci SSH khusus deploy

```bash
# di komputer sendiri
ssh-keygen -t ed25519 -f ~/.ssh/dam-daman-deploy -C "github-actions dam-daman" -N ""
ssh-copy-id -i ~/.ssh/dam-daman-deploy.pub surya@IP_VPS
```

### 3. Isi secret di GitHub

Buka **Settings › Secrets and variables › Actions** di repo, lalu tambahkan:

| Secret | Isi |
| --- | --- |
| `SSH_HOST` | IP atau hostname VPS |
| `SSH_USER` | user deploy, misalnya `surya` |
| `SSH_PRIVATE_KEY` | isi file `~/.ssh/dam-daman-deploy` (kunci privat) |
| `SSH_PORT` | opsional, kalau SSH bukan port 22 |
| `SSH_KNOWN_HOSTS` | opsional tapi disarankan: hasil `ssh-keyscan -H IP_VPS` |

Variabel opsional (tab **Variables**) kalau lokasinya berbeda: `WEB_PATH`, `SERVER_PATH`, `SITE_URL`.

### 4. Jalankan

Push ke `main`, atau buka tab **Actions › CI dan Deploy › Run workflow**. Langkah terakhir mengecek `https://dam.punyasurya.com/api/health`.

## Perintah berguna di VPS

```bash
systemctl status dam-daman          # status server game
journalctl -u dam-daman -f          # log server game
curl http://127.0.0.1:3747/api/health
```

## Catatan

- Room online disimpan di memori server. Setiap deploy me-restart server, jadi permainan online yang sedang berjalan saat deploy akan terputus. Pemain cukup membuat room baru.
- Server hanya mendengarkan `127.0.0.1`, jadi port 3747 tidak terbuka ke internet.
- Kalau port 3747 sudah dipakai aplikasi lain (cek dengan `sudo ss -ltnp | grep 3747`), pilih port lain lalu ganti di `/etc/systemd/system/dam-daman.service` (baris `Environment=PORT=`) dan di `/etc/apache2/dam-daman.conf`, kemudian `sudo systemctl daemon-reload && sudo systemctl restart dam-daman && sudo systemctl reload apache2`.
