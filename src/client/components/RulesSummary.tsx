import type { Settings } from '../../shared/engine/rules';

/** Ringkasan aturan sesuai pengaturan permainan yang sedang berjalan. */
export function RulesSummary({ settings, online, heading = true }: { settings: Settings; online?: boolean; heading?: boolean }) {
  const tradisional = settings.mode === 'tradisional';
  const raja =
    settings.raja === 'terbang'
      ? 'Raja boleh jalan ke segala arah sejauh garis kosong, dan makan dari jauh.'
      : settings.raja === 'ganjil'
        ? 'Raja boleh jalan ke segala arah sejauh 1, 3, atau 5 titik.'
        : 'Tidak ada raja: bidak di ujung gunungan lawan tetap bidak biasa.';
  return (
    <div className="rules-summary">
      {heading && <h3>Aturan</h3>}
      <dl>
        <dt>Jalan</dt>
        <dd>Satu langkah mengikuti garis ke titik kosong. Boleh maju, ke samping, atau serong maju. Tidak boleh mundur.</dd>
        <dt>Makan</dt>
        <dd>
          Lompati bidak lawan ke titik kosong tepat di belakangnya, ke segala arah. Masih bisa makan lagi? Lanjutkan
          (<em>ngeracik</em>).
        </dd>
        {tradisional ? (
          <>
            <dt>DAM!</dt>
            <dd>
              Makan tidak wajib. Tapi kalau lawan bisa makan dan tidak makan, tekan <strong>DAM</strong> di giliranmu untuk
              mengambil {settings.damPenalty} bidaknya.
            </dd>
          </>
        ) : (
          <>
            <dt>Wajib makan</dt>
            <dd>Kalau bisa makan, harus makan sampai habis. Tidak ada DAM.</dd>
          </>
        )}
        <dt>Raja</dt>
        <dd>Bidak yang berhenti di 3 titik terluar gunungan lawan jadi raja. {raja}</dd>
        <dt>Menang</dt>
        <dd>Habiskan bidak lawan, atau buat lawan tidak bisa jalan.</dd>
        <dt>Seri</dt>
        <dd>
          {Math.round(settings.drawPlies / 2)} langkah tiap pemain tanpa makan, posisi sama terulang 3 kali, atau sepakat seri.
          {online && ' Kehabisan waktu 3 kali berturut-turut berarti kalah.'}
        </dd>
      </dl>
    </div>
  );
}
