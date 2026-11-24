# Dam-Daman

Permainan papan tradisional Indonesia di browser. Main online dengan kode room, lawan komputer, atau berdua di satu layar.

**Main di:** https://dam.punyasurya.com

## Fitur

- Papan dam-daman Jawa: persegi 5×5 bergaris diagonal dan dua gunungan segitiga, 37 titik, 16 bidak per pemain.
- Aturan tradisional: jalan tidak boleh mundur, makan dengan melompat, **ngeracik** (makan beruntun), raja, dan hukuman **DAM** kalau lupa makan. Ada juga mode Wajib Makan, pilihan raja, dan jumlah bidak hukuman.
- Main online lewat kode room 5 huruf atau link `/r/KODE`, dengan batas waktu giliran, sambung ulang otomatis, tawaran seri, emote, dan main lagi (rematch).
- Lawan komputer tiga tingkat (Si Kancil, Pak Utan, Raja Rimba). AI berjalan di Web Worker supaya tampilan tidak macet.
- 8 avatar hewan Indonesia yang bereaksi saat makan, kalah, atau berpikir.
- Musik latar bernuansa gamelan slendro dan efek suara, semuanya dibuat langsung dengan Web Audio (tanpa file rekaman, bebas lisensi). Ada tombol mute dan pengatur volume.
- Responsif untuk HP dan desktop, bisa dipakai dengan keyboard.

Aturan lengkap ada di halaman **Cara main** di dalam game.

## Struktur

```
src/shared/engine/   aturan permainan (papan, langkah sah, DAM, raja, akhir permainan)
src/shared/ai/       AI (negamax + alpha-beta, iterative deepening)
src/shared/protocol.ts  tipe pesan klien-server
src/server/          server room online (Node.js + Socket.IO)
src/client/          tampilan React, audio, avatar
tests/               tes otomatis (Vitest)
deploy/              konfigurasi Apache, systemd, skrip setup VPS
```

## Menjalankan di komputer sendiri

Butuh Node.js 20 atau lebih baru.

```bash
npm install
npm run dev        # web di http://localhost:5173, server room di port 3001
npm test           # tes otomatis
npm run typecheck
npm run build      # hasil: dist/ (web) dan dist-server/server.mjs (server)
```

## Deploy

GitHub Actions menjalankan tes dan build di setiap pull request, lalu deploy ke VPS setiap ada push ke `main`. Langkah setup VPS dan secret yang perlu diisi ada di [docs/DEPLOY.md](docs/DEPLOY.md).
