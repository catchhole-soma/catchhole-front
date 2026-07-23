import { WORK_GENRES, type WorkGenre } from '../../lib/work-contract';
import { C } from './constants';

interface Props {
  value: string;
  onChange: (genre: WorkGenre) => void;
  labelId: string;
  describedBy?: string;
  invalid?: boolean;
}

export function WorkGenreSelector({
  value,
  onChange,
  labelId,
  describedBy,
  invalid = false,
}: Props) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        gap: 8,
        padding: invalid ? 7 : 0,
        borderRadius: 9,
        border: invalid ? `1px solid ${C.danger}99` : '1px solid transparent',
      }}
    >
      {WORK_GENRES.map(genre => {
        const selected = value === genre;
        return (
          <button
            key={genre}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(genre)}
            style={{
              minWidth: 0,
              height: 38,
              padding: '0 6px',
              borderRadius: 7,
              border: `1px solid ${selected ? C.primary : C.border}`,
              background: selected ? C.primary + '22' : C.bg,
              color: selected ? C.primary : C.t2,
              fontSize: 12,
              fontWeight: selected ? 700 : 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'all 0.13s',
            }}
          >
            {genre}
          </button>
        );
      })}
    </div>
  );
}
