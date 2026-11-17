/**
 * Event date control: day + text month + year.
 * Value is always ISO YYYY-MM-DD (or '') for API compatibility.
 * Display month as Jan, Feb, Mar … Dec.
 */
const MONTHS = [
  { value: '01', label: 'Jan' },
  { value: '02', label: 'Feb' },
  { value: '03', label: 'Mar' },
  { value: '04', label: 'Apr' },
  { value: '05', label: 'May' },
  { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' },
  { value: '08', label: 'Aug' },
  { value: '09', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
];

function parseIso(iso) {
  const m = String(iso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { y: '', m: '', d: '' };
  return { y: m[1], m: m[2], d: m[3] };
}

function daysInMonth(year, month) {
  const y = Number(year);
  const mo = Number(month);
  if (!y || !mo) return 31;
  return new Date(y, mo, 0).getDate();
}

function toIso(y, m, d) {
  if (!y || !m || !d) return '';
  const max = daysInMonth(y, m);
  let day = Number(d);
  if (day > max) day = max;
  if (day < 1) return '';
  return `${y}-${m}-${String(day).padStart(2, '0')}`;
}

export function formatEventDateDisplay(iso) {
  const { y, m, d } = parseIso(iso);
  if (!y || !m || !d) return '';
  const mon = MONTHS.find((x) => x.value === m)?.label || m;
  return `${Number(d)} ${mon} ${y}`;
}

export default function EventDateInput({ value, onChange, className = '', required = false }) {
  const parts = parseIso(value);
  const yearNow = new Date().getFullYear();
  const years = [];
  for (let y = yearNow - 1; y <= yearNow + 5; y += 1) years.push(String(y));
  // Ensure current year in list even if value is outside range
  if (parts.y && !years.includes(parts.y)) years.unshift(parts.y);
  years.sort();

  const maxDay = daysInMonth(parts.y || yearNow, parts.m || '01');
  const dayOptions = Array.from({ length: maxDay }, (_, i) => String(i + 1).padStart(2, '0'));

  function emit(next) {
    const iso = toIso(next.y, next.m, next.d);
    onChange?.(iso);
  }

  const selectCls =
    className ||
    'dark-input h-10 text-sm font-semibold';

  return (
    <div className="grid grid-cols-3 gap-1.5 w-full">
      <select
        aria-label="Day"
        required={required}
        className={selectCls}
        value={parts.d}
        onChange={(e) => emit({ ...parts, d: e.target.value })}
      >
        <option value="">Day</option>
        {dayOptions.map((d) => (
          <option key={d} value={d}>
            {Number(d)}
          </option>
        ))}
      </select>
      <select
        aria-label="Month"
        required={required}
        className={selectCls}
        value={parts.m}
        onChange={(e) => emit({ ...parts, m: e.target.value })}
      >
        <option value="">Month</option>
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Year"
        required={required}
        className={selectCls}
        value={parts.y}
        onChange={(e) => emit({ ...parts, y: e.target.value })}
      >
        <option value="">Year</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
