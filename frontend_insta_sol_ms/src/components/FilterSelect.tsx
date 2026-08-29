interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  /** Label for the "no filter" option. */
  allLabel?: string;
}

/** Labelled dropdown used by every filter bar, sized to the 44px touch floor. */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel = 'All',
}: FilterSelectProps) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-touch min-w-[9rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm capitalize text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
