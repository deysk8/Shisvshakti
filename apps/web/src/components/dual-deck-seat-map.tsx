'use client';

import { SeatMapItem, displaySeatPrice, formatInr } from '@/lib/seat-pricing';

function SteeringWheel() {
  return (
    <svg className="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path stroke="currentColor" strokeWidth="1.5" d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    </svg>
  );
}

type Props = {
  seats: SeatMapItem[];
  selected: string[];
  heldSeatIds?: string[];
  baseFare: number;
  onToggle: (id: string, status: SeatMapItem['status']) => void;
};

function SeatCell({
  seat,
  price,
  isSelected,
  isHeldByYou,
  onToggle,
}: {
  seat: SeatMapItem;
  price: number;
  isSelected: boolean;
  isHeldByYou?: boolean;
  onToggle: () => void;
}) {
  const isSleeper = seat.seatType === 'SLEEPER';
  const sold = seat.status === 'booked';
  const locked = seat.status === 'locked' && !isHeldByYou;
  const disabled = sold || locked;

  let boxClass =
    'relative flex flex-col items-center justify-end border-2 transition ';
  if (sold) {
    boxClass += 'border-transparent bg-gray-200 text-gray-400 cursor-not-allowed ';
  } else if (locked) {
    boxClass += 'border-amber-300 bg-amber-50 cursor-not-allowed ';
  } else if (isSelected) {
    boxClass += 'border-brand bg-brand text-white shadow-md ';
  } else if (isHeldByYou) {
    boxClass += 'border-brand/60 bg-brand-light/40 hover:border-brand cursor-pointer ';
  } else {
    boxClass += 'border-emerald-600 bg-white hover:border-brand cursor-pointer ';
  }

  const sizeClass = isSleeper ? 'h-[4.5rem] w-11 sm:h-20 sm:w-12' : 'h-11 w-11 sm:h-12 sm:w-12';

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={`${boxClass} ${sizeClass} rounded-md`}
        aria-label={`Seat ${seat.label}`}
      >
        {!sold && (
          <span
            className={`mb-1 h-1.5 w-6 rounded-full ${isSelected ? 'bg-white/80' : 'bg-emerald-600/30'}`}
          />
        )}
      </button>
      {sold ? (
        <span className="text-[10px] font-medium text-gray-400">Sold</span>
      ) : (
        <span className={`text-[10px] font-medium ${isSelected ? 'text-brand' : 'text-gray-600'}`}>
          {formatInr(price)}
        </span>
      )}
    </div>
  );
}

function DeckPanel({
  title,
  deck,
  seats,
  baseFare,
  selected,
  heldSeatIds = [],
  onToggle,
  lowerSeaterRows = 12,
  upperSleeperRows = 7,
}: Props & { title: string; deck: string; lowerSeaterRows?: number; upperSleeperRows?: number }) {
  const deckSeats = seats.filter((s) => s.deck === deck);

  const col1 = deckSeats.filter((s) => s.colIndex === 1).sort((a, b) => (a.rowIndex ?? 0) - (b.rowIndex ?? 0));
  const col2 = deckSeats.filter((s) => s.colIndex === 2).sort((a, b) => (a.rowIndex ?? 0) - (b.rowIndex ?? 0));
  const col3 = deckSeats.filter((s) => s.colIndex === 3).sort((a, b) => (a.rowIndex ?? 0) - (b.rowIndex ?? 0));

  const maxRows = deck === 'lower' ? lowerSeaterRows : upperSleeperRows;

  return (
    <div className="flex-1 rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-charcoal sm:text-base">{title}</h3>
        <SteeringWheel />
      </div>

      <div className="flex justify-center gap-3 sm:gap-4">
        <div className="flex flex-col gap-2 pt-6">
          {col1.map((seat) => (
            <SeatCell
              key={seat.id}
              seat={seat}
              price={displaySeatPrice(baseFare, seat)}
              isSelected={selected.includes(seat.id)}
              isHeldByYou={heldSeatIds.includes(seat.id)}
              onToggle={() => onToggle(seat.id, seat.status)}
            />
          ))}
        </div>

        <div className="w-4 shrink-0 border-l border-dashed border-gray-200 sm:w-6" aria-hidden />

        <div className="flex gap-2 sm:gap-3">
          {[col2, col3].map((col, idx) => (
            <div key={idx} className="flex flex-col gap-2">
              {Array.from({ length: maxRows }, (_, i) => i + 1).map((row) => {
                const seat = col.find((s) => s.rowIndex === row);
                if (!seat) return <div key={row} className="h-[4.5rem] w-11 sm:h-20 sm:w-12" />;
                return (
                  <SeatCell
                    key={seat.id}
                    seat={seat}
                    price={displaySeatPrice(baseFare, seat)}
                    isSelected={selected.includes(seat.id)}
                    isHeldByYou={heldSeatIds.includes(seat.id)}
                    onToggle={() => onToggle(seat.id, seat.status)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DualDeckSeatMap({ seats, selected, heldSeatIds = [], baseFare, onToggle }: Props) {
  const hasUpper = seats.some((s) => s.deck === 'upper');

  return (
    <div className="rounded-2xl bg-[#eef0f8] p-4 sm:p-6">
      <div className="mb-4 flex justify-end">
        <p className="border-b-4 border-brand pb-1 text-lg font-bold text-brand">1. Select seats</p>
      </div>

      <div className={`flex flex-col gap-4 ${hasUpper ? 'lg:flex-row' : ''}`}>
        <DeckPanel
          title="Lower deck"
          deck="lower"
          seats={seats}
          selected={selected}
          heldSeatIds={heldSeatIds}
          baseFare={baseFare}
          onToggle={onToggle}
        />
        {hasUpper && (
          <DeckPanel
            title="Upper deck"
            deck="upper"
            seats={seats}
            selected={selected}
            heldSeatIds={heldSeatIds}
            baseFare={baseFare}
            onToggle={onToggle}
            upperSleeperRows={7}
          />
        )}
      </div>

      <p className="mt-6 text-center text-sm font-semibold text-charcoal">Know your seat types</p>
      <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded border-2 border-emerald-600 bg-white" /> Available
        </span>
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-brand" /> Selected
        </span>
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-gray-200" /> Sold
        </span>
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded border-2 border-amber-300 bg-amber-50" /> Locked
        </span>
      </div>
    </div>
  );
}
