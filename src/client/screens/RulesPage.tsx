import { useMemo } from 'react';
import { createGame } from '../../shared/engine/rules';
import { Board } from '../components/Board';
import { IconBack } from '../components/Icons';
import { SoundToggles } from '../components/SoundToggles';

export function RulesPage({ onBack }: { onBack: () => void }) {
  const game = useMemo(() => createGame(), []);
  return (
    <div className="screen rules-page">
      <header className="topbar">
        <button className="icon-btn" aria-label="Kembali" onClick={onBack}>
          <IconBack />
        </button>
        <div className="topbar-title">Cara Main</div>
        <SoundToggles />
      </header>
      <article className="rules-article">
        <div className="rules-board">
          <Board game={game} label="Posisi awal papan dam-daman" />
          <p className="caption">Posisi awal: 16 bidak per pemain, baris tengah kosong.</p>
        </div>
        <div className="rules-text">
          <h2>Papan</h2>
          <p>
            Papan dam-daman terdiri dari persegi 5×5 titik bergaris diagonal dan dua <em>gunungan</em> segitiga di atas dan
            bawah, total 37 titik. Bidak berdiri di titik persimpangan garis.
          </p>
          <h2>Jalan</h2>
          <ul>
            <li>Pemain bergantian menjalankan satu bidak satu langkah, mengikuti garis ke titik kosong di sebelahnya.</li>
            <li>Bidak biasa boleh maju, ke samping, atau serong maju, tapi tidak boleh mundur.</li>
          </ul>
          <h2>Makan dan ngeracik</h2>
          <ul>
            <li>Bidak lawan dimakan dengan melompatinya lurus mengikuti garis ke titik kosong tepat di belakangnya. Makan boleh ke segala arah.</li>
            <li>
              Kalau setelah makan bidak yang sama masih bisa makan lagi, lanjutkan. Makan beruntun ini disebut <strong>ngeracik</strong>.
            </li>
          </ul>
          <h2>DAM!</h2>
          <p>
            Di mode Tradisional, makan tidak dipaksa. Tapi kalau pemain bisa makan dan malah jalan biasa, atau berhenti ngeracik
            terlalu cepat, lawan boleh teriak <strong>DAM!</strong> di giliran berikutnya dan mengambil 3 bidaknya (jumlahnya bisa
            diatur). Kalau lawan tidak teriak dan langsung jalan, kesempatan itu hangus. Di daerah lain hukuman ini juga disebut das
            atau kedaman.
          </p>
          <p>Di mode Wajib Makan, kamu harus makan sampai habis setiap kali bisa, dan tidak ada DAM.</p>
          <h2>Raja</h2>
          <p>
            Bidak yang berhenti di ujung gunungan lawan (3 titik paling luar) naik pangkat jadi raja. Raja boleh bergerak ke segala
            arah, sejauh apa pun sepanjang garis kosong, dan makan dari jauh. Pilihan lain: raja langkah ganjil (1, 3, atau 5 titik)
            atau tanpa raja.
          </p>
          <h2>Menang dan seri</h2>
          <ul>
            <li>Menang kalau bidak lawan habis, atau lawan tidak bisa jalan lagi.</li>
            <li>Seri kalau 50 langkah tiap pemain lewat tanpa ada yang makan, posisi yang sama terulang 3 kali, atau kedua pemain sepakat.</li>
            <li>Di main online, kehabisan waktu giliran 3 kali berturut-turut atau terputus lebih dari 2 menit berarti kalah.</li>
          </ul>
          <h2>Cara memakai</h2>
          <ul>
            <li>Ketuk bidakmu, lalu ketuk titik tujuan yang ditandai. Titik bercincin emas berarti makan.</li>
            <li>Saat ngeracik, ketuk titik berikutnya satu per satu.</li>
            <li>Kalau lawan lupa makan, tombol DAM muncul. Ketuk, lalu pilih bidak lawan yang mau diambil.</li>
          </ul>
        </div>
      </article>
    </div>
  );
}
