/** Derive event status from schedule times (local browser timezone) */

export function localDateKey(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) {
    const s = String(d).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return null;
  }
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey() {
  return localDateKey(new Date());
}

export function tomorrowKey() {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return localDateKey(t);
}

/**
 * Calendar day of the event as YYYY-MM-DD in local time.
 * Handles plain dates and ISO timestamps without UTC day-shift bugs.
 */
export function eventDayKey(ev) {
  if (ev?.event_date == null || ev.event_date === '') return null;
  const raw = String(ev.event_date).trim();
  // Plain date from Postgres DATE column
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // ISO / timestamp — take LOCAL calendar day
  const asDate = new Date(raw);
  if (!Number.isNaN(asDate.getTime())) return localDateKey(asDate);
  const sliced = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(sliced) ? sliced : null;
}

/** Normalize DB time → "HH:mm" or null */
function normalizeTimePart(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?/);
  if (!m) return null;
  const hh = String(Math.min(23, Number(m[1]))).padStart(2, '0');
  const mm = m[2];
  return `${hh}:${mm}`;
}

function isMidnightPlaceholder(timeHHMM) {
  return timeHHMM === '00:00';
}

/** Local Date from YYYY-MM-DD + HH:mm */
export function combineDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const d = String(dateStr).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const y = Number(d.slice(0, 4));
  const mo = Number(d.slice(5, 7)) - 1;
  const day = Number(d.slice(8, 10));
  const t = normalizeTimePart(timeStr);
  if (!t) {
    return new Date(y, mo, day, 12, 0, 0, 0);
  }
  const [hh, mm] = t.split(':').map(Number);
  return new Date(y, mo, day, hh, mm, 0, 0);
}

export function eventStartDate(ev) {
  const day = eventDayKey(ev);
  const st = normalizeTimePart(ev?.start_time);
  if (day && st) {
    const dt = combineDateTime(day, st);
    if (dt && !Number.isNaN(dt.getTime())) return dt;
  }
  // Only fall back to go_live_at when schedule time is missing
  if (ev?.go_live_at) {
    const d = new Date(ev.go_live_at);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (day) return combineDateTime(day, st);
  return null;
}

/**
 * Real end time only. Treats null / '' / 00:00:00 as "no end time".
 * Does NOT use teardown_at (was forcing false Ended).
 */
export function eventEndDate(ev) {
  const day = eventDayKey(ev);
  const et = normalizeTimePart(ev?.end_time);
  if (!day || !et || isMidnightPlaceholder(et)) return null;

  const end = combineDateTime(day, et);
  if (!end || Number.isNaN(end.getTime())) return null;

  const start = eventStartDate(ev);
  if (start && end.getTime() <= start.getTime()) return null;

  return end;
}

export function eventSetupDate(ev) {
  if (ev?.setup_start) {
    const d = new Date(ev.setup_start);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const start = eventStartDate(ev);
  if (start) return new Date(start.getTime() - 30 * 60000);
  return null;
}

/**
 * True only when the event is truly finished:
 * - has a real end_time and now is after it, OR
 * - has NO end_time and the event calendar day is fully over (day < today)
 *
 * A today 6pm event with no end_time → FALSE until after midnight.
 */
export function isEventTrulyFinished(ev) {
  if (!ev) return false;
  if (String(ev.event_status || '') === 'Teardown Complete') return true;

  const explicitEnd = eventEndDate(ev);
  const now = Date.now();
  if (explicitEnd) {
    return now > explicitEnd.getTime();
  }

  const day = eventDayKey(ev);
  const today = todayKey();
  if (day && today && day < today) return true;
  return false;
}

/**
 * Live status from schedule (does not trust DB event_status except Teardown Complete).
 */
export function computeEventStatus(ev) {
  if (!ev) return 'Upcoming';
  if (String(ev.event_status || '') === 'Teardown Complete') return 'Teardown Complete';

  // Hard rule: never "Ended" unless truly finished
  if (isEventTrulyFinished(ev)) return 'Ended';

  const now = Date.now();
  const start = eventStartDate(ev);
  const explicitEnd = eventEndDate(ev);
  const setup = eventSetupDate(ev);

  if (start && now >= start.getTime()) {
    // Started — still on event day (or within explicit end window)
    if (explicitEnd && now > explicitEnd.getTime()) return 'Ended';
    return 'Ongoing';
  }

  // Before start
  if (setup && start && now >= setup.getTime() && now < start.getTime()) {
    return 'Setup in Progress';
  }
  if (start && start.getTime() - now <= 45 * 60000 && now < start.getTime()) {
    return 'Action Required';
  }
  return 'Upcoming';
}

/**
 * Board columns: today / tomorrow / upcoming / past
 */
export function bucketEvents(events) {
  const today = todayKey();
  const tomorrow = tomorrowKey();
  const groups = { today: [], tomorrow: [], upcoming: [], past: [] };

  (events || []).forEach((e) => {
    const start = eventStartDate(e);
    const status = computeEventStatus(e);

    // Past column only when truly finished — never for a future time today
    if (status === 'Ended' || status === 'Teardown Complete' || isEventTrulyFinished(e)) {
      groups.past.push(e);
      return;
    }

    const key = eventDayKey(e) || (start ? localDateKey(start) : null);
    if (key && key === today) groups.today.push(e);
    else if (key && key === tomorrow) groups.tomorrow.push(e);
    else groups.upcoming.push(e);
  });

  const byStartAsc = (a, b) => (eventStartDate(a)?.getTime() || 0) - (eventStartDate(b)?.getTime() || 0);
  const byStartDesc = (a, b) => (eventStartDate(b)?.getTime() || 0) - (eventStartDate(a)?.getTime() || 0);
  groups.today.sort(byStartAsc);
  groups.tomorrow.sort(byStartAsc);
  groups.upcoming.sort(byStartAsc);
  groups.past.sort(byStartDesc);
  return groups;
}

export function countdownLabel(target) {
  if (target == null || target === '') return null;
  const d =
    target instanceof Date
      ? target
      : target && typeof target.getTime === 'function'
        ? target
        : new Date(target);
  if (!d || typeof d.getTime !== 'function' || Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const core = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return ms >= 0 ? `-${core}` : `+${core}`;
}
