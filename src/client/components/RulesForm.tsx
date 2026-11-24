import type { RajaMode, RuleMode, Settings } from '../../shared/engine/rules';
import type { FirstMove, TurnSeconds } from '../../shared/protocol';

interface Props {
  rules: Settings;
  onRules: (s: Settings) => void;
  turnSeconds?: TurnSeconds;
  onTurnSeconds?: (t: TurnSeconds) => void;
  firstMove?: FirstMove;
  onFirstMove?: (f: FirstMove) => void;
  disabled?: boolean;
}

function Seg<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="seg-field" disabled={disabled}>
      <legend>{label}</legend>
      <div className="seg">
        {options.map(([v, text]) => (
          <button type="button" key={String(v)} className={v === value ? 'on' : ''} aria-pressed={v === value} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function RulesForm(p: Props) {
  const r = p.rules;
  return (
    <div className="rules-form">
      <Seg<RuleMode>
        label="Mode aturan"
        value={r.mode}
        disabled={p.disabled}
        options={[
          ['tradisional', 'Tradisional (DAM)'],
          ['wajib', 'Wajib makan'],
        ]}
        onChange={(mode) => p.onRules({ ...r, mode })}
      />
      <p className="hint">
        {r.mode === 'tradisional'
          ? 'Makan tidak dipaksa. Kalau lawan lupa makan, kamu boleh teriak DAM dan mengambil bidaknya.'
          : 'Kalau bisa makan, harus makan sampai habis. Tidak ada DAM.'}
      </p>
      {r.mode === 'tradisional' && (
        <Seg<1 | 2 | 3>
          label="Hukuman DAM"
          value={r.damPenalty}
          disabled={p.disabled}
          options={[
            [1, '1 bidak'],
            [2, '2 bidak'],
            [3, '3 bidak'],
          ]}
          onChange={(damPenalty) => p.onRules({ ...r, damPenalty })}
        />
      )}
      <Seg<RajaMode>
        label="Raja"
        value={r.raja}
        disabled={p.disabled}
        options={[
          ['terbang', 'Terbang'],
          ['ganjil', 'Langkah ganjil'],
          ['tanpa', 'Tanpa raja'],
        ]}
        onChange={(raja) => p.onRules({ ...r, raja })}
      />
      {p.onTurnSeconds && p.turnSeconds !== undefined && (
        <Seg<TurnSeconds>
          label="Waktu per giliran"
          value={p.turnSeconds}
          disabled={p.disabled}
          options={[
            [0, 'Bebas'],
            [30, '30 dtk'],
            [60, '60 dtk'],
            [120, '2 mnt'],
          ]}
          onChange={p.onTurnSeconds}
        />
      )}
      {p.onFirstMove && p.firstMove && (
        <Seg<FirstMove>
          label="Jalan pertama"
          value={p.firstMove}
          disabled={p.disabled}
          options={[
            ['undi', 'Diundi'],
            ['merah', 'Merah'],
            ['biru', 'Biru'],
          ]}
          onChange={p.onFirstMove}
        />
      )}
    </div>
  );
}
