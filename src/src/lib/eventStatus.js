/** Derive event status from schedule times (local) */

export function localDateKey(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) {
    // plain YYYY-MM-DD
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

/** Build local Date from event_date + time (HH:mm) */
export function combineDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const d = String(dateStr).slice(0, 10);
  if (!timeStr) {
    // noon local to avoid timezone day-shift
    return new Date(`${d}T12:00:00`);
  }
  const tm = String(timeStr).length === 5 ? `${timeStr}:00` : String(timeStr);
  return new Date(`${d}T${tm}`);
}

export function eventStartDate(ev) {
  if (ev.go_live_at) {
    const d = new Date(ev.go_live_at);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return combineDateTime(ev.event_date, ev.start_time);
}

export function eventEndDate(ev) {
  if (ev.teardown_at) {
    const d = new Date(ev.teardown_at);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (ev.event_date && ev.end_time) return combineDateTime(ev.event_date, ev.end_time);
  return null;
}

export function eventSetupDate(ev) {
  if (ev.setup_start) {
    const d = new Date(ev.setup_start);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const start = eventStartDate(ev);
  if (start) return new Date(start.getTime() - 30 * 60000);
  return null;
}

/** End of local calendar day when an event has no explicit end time. */
function endOfEventDay(ev, start) {
  const dayKey =
    (ev.event_date != null && /^\d{4}-\d{2}-\d{2}$/.test(String(ev.event_date).slice(0, 10))
      ? String(ev.event_date).slice(0, 10)
      : null) || (start ? localDateKey(start) : null);
  if (!dayKey) return null;
  const d = new Date(`${dayKey}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Auto status from clock:
 * - before setup window → Upcoming
 * - within 45m of setup or past setup before start → Action Required / Setup in Progress
 * - between start and end → Ongoing
 * - after explicit end, or end of event day when end time is missing → Ended
 */
export function computeEventStatus(ev) {
  const now = Date.now();
  const start = eventStartDate(ev);
  const end = eventEndDate(ev) || endOfEventDay(ev, start);
  const setup = eventSetupDate(ev);
  if (!start) return ev.event_status || 'Upcoming';

  if (ev.event_status === 'Teardown Complete') return 'Teardown Complete';

  if (end && now > end.getTime()) {
    return 'Ended';
  }
  if (now >= start.getTime() && (!end || now <= end.getTime())) {
    return 'Ongoing';
  }
  if (setup && now >= setup.getTime() && now < start.getTime()) {
    return 'Setup in Progress';
  }
  // Within 45 minutes of start
  if (start.getTime() - now <= 45 * 60000 && now < start.getTime()) {
    return 'Action Required';
  }
  return 'Upcoming';
}

/**
 * Board columns:
 *  today / tomorrow / upcoming (future beyond tomorrow) / past (ended)
 */
export function bucketEvents(events) {
  const today = todayKey();
  const tomorrow = tomorrowKey();
  const now = Date.now();
  const groups = { today: [], tomorrow: [], upcoming: [], past: [] };

  (events || []).forEach((e) => {
    const start = eventStartDate(e);
    const end = eventEndDate(e);
    const status = computeEventStatus(e);

    // Past / completed: explicit end or end of the event day passed
    const isPast =
      status === 'Ended' ||
      status === 'Teardown Complete' ||
      (end && end.getTime() < now);

    if (isPast) {
      groups.past.push(e);
      return;
    }

    const key = start ? localDateKey(start) : localDateKey(e.event_date);
    if (key && key === today) groups.today.push(e);
    else if (key && key === tomorrow) groups.tomorrow.push(e);
    else groups.upcoming.push(e);
  });

  // Sort past newest-first; others soonest-first
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
