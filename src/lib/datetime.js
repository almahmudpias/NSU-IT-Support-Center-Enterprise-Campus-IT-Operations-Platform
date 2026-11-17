const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function asDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** e.g. 17 Oct 2026 (no weekday) */
export function formatDate(value) {
  const d = asDate(value);
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** e.g. 1:15 PM */
export function formatTime(value) {
  const d = asDate(value);
  if (!d) return '';
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

/** Format a plain time string (HH:mm or HH:mm:ss) as 12-hour, e.g. 16:30 → 4:30 PM */
export function formatTimeString(value) {
  if (value == null || value === '') return '—';
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return s;
  let h = Number(m[1]);
  if (Number.isNaN(h)) return s;
  const min = m[2];
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ap}`;
}

/** e.g. Sat, 1:15 PM — weekday with time */
export function formatTimeWithDay(value) {
  const d = asDate(value);
  if (!d) return '';
  return `${DAYS[d.getDay()]}, ${formatTime(d)}`;
}

/** e.g. 17 Oct 2026 · Sat, 1:15 PM */
export function formatDateTime(value) {
  const d = asDate(value);
  if (!d) return '—';
  return `${formatDate(d)} · ${formatTimeWithDay(d)}`;
}
