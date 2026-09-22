'use client';

export type PassengerRow = {
  fullName: string;
  age: string;
  gender: string;
  phone: string;
};

type Props = {
  seatLabels: string[];
  rows: PassengerRow[];
  onChange: (rows: PassengerRow[]) => void;
  contactName: string;
  onContactNameChange: (value: string) => void;
};

export function PassengerFormList({
  seatLabels,
  rows,
  onChange,
  contactName,
  onContactNameChange,
}: Props) {
  function updateRow(index: number, patch: Partial<PassengerRow>) {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  }

  function copyContactToFirst() {
    if (!contactName.trim()) return;
    updateRow(0, { fullName: contactName.trim() });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-charcoal">
          Passenger details ({seatLabels.length} seat{seatLabels.length === 1 ? '' : 's'})
        </p>
        {seatLabels.length > 0 && (
          <button
            type="button"
            className="text-xs font-medium text-brand hover:underline"
            onClick={copyContactToFirst}
          >
            Copy contact to passenger 1
          </button>
        )}
      </div>

      {rows.map((row, index) => (
        <div key={seatLabels[index] ?? index} className="rounded-lg border border-gray-100 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Seat {seatLabels[index] ?? index + 1}
          </p>
          <div className="space-y-3">
            <label className="block text-sm">
              Full name
              <input
                required
                value={row.fullName}
                onChange={(e) => updateRow(index, { fullName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                Age (optional)
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={row.age}
                  onChange={(e) => updateRow(index, { age: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Gender (optional)
                <select
                  value={row.gender}
                  onChange={(e) => updateRow(index, { gender: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                >
                  <option value="">—</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
            </div>
            {index === 0 && (
              <label className="block text-sm">
                Phone (optional)
                <input
                  value={row.phone}
                  onChange={(e) => updateRow(index, { phone: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                />
              </label>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function emptyPassengerRows(count: number): PassengerRow[] {
  return Array.from({ length: count }, () => ({
    fullName: '',
    age: '',
    gender: '',
    phone: '',
  }));
}
