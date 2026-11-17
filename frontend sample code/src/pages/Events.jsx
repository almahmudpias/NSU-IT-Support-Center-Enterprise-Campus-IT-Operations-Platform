import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi } from '../lib/api';
import { eventPath, eventEditPath } from '../lib/ids';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { isAdmin, isEngineerOnly } from '../lib/rbac';
import { bucketEvents, computeEventStatus, eventStartDate } from '../lib/eventStatus';

function EventBadge({ status }) {
  const s = status || 'Upcoming';
  if (s === 'Action Required' || s === 'Setup in Progress')
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
        {s}
      </span>
    );
  if (s === 'Ongoing' || s === 'Standby/Monitoring')
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
        {s}
      </span>
    );
  if (s === 'Ended' || s === 'Teardown Complete')
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-rose-500/15 text-rose-300 border border-rose-500/30">
        {s}
      </span>
    );
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-500/15 text-blue-300 border border-blue-500/30">
      Upcoming
    </span>
  );
}

function bucket(events) {
  // Prefer shared bucketEvents so Today / Tomorrow / Upcoming stay consistent
  // and event_date (not go_live_at timezone) drives the day column.
  const b = bucketEvents(events || []);
  return {
    today: b.today || [],
    tomorrow: b.tomorrow || [],
    upcoming: b.upcoming || [],
  };
}

function fmtWhen(ev) {
  const start = eventStartDate(ev);
  if (start) {
    return start.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return ev.event_date || '—';
}

export default function EventsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const eng = isEngineerOnly(user);
  const canManage = isAdmin(user);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // slide panel event
  const [filter, setFilter] = useState('');
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      let list = await eventsApi.list();
      list = Array.isArray(list) ? list : [];
      if (eng) {
        const names = [user?.fullName, user?.username].filter(Boolean).map((s) => String(s).toLowerCase());
        list = list.filter((e) => {
          const a = String(e.assigned_engineer || e.primary_it || '').toLowerCase();
          const b = String(e.backup_it || '').toLowerCase();
          return names.includes(a) || names.includes(b);
        });
      }
      setEvents(list);
    } catch (e) {
      showToast('error', 'Failed to load events', e.message);
    } finally {
      setLoading(false);
    }
  }, [eng, user, showToast]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const enriched = useMemo(
    () =>
      events.map((e) => ({
        ...e,
        event_status: computeEventStatus(e),
      })),
    [events]
  );
  const groups = useMemo(() => bucketEvents(enriched), [enriched]);
  const kpis = useMemo(() => {
    const live = enriched.filter((e) => ['Ongoing', 'Standby/Monitoring'].includes(e.event_status)).length;
    const setup = enriched.filter((e) =>
      ['Upcoming', 'Action Required', 'Setup in Progress'].includes(e.event_status || 'Upcoming')
    ).length;
    const crew = enriched.filter((e) => e.assigned_engineer || e.primary_it).length;
    const unassigned = enriched.filter((e) => !e.assigned_engineer && !e.primary_it).length;
    return { live, setup, crew, unassigned };
  }, [enriched]);

  const filtered = useMemo(() => {
    let list = [...enriched];
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(
        (e) =>
          String(e.id).includes(q) ||
          (e.name || '').toLowerCase().includes(q) ||
          (e.assigned_engineer || e.primary_it || '').toLowerCase().includes(q) ||
          (e.venue || '').toLowerCase().includes(q) ||
          (e.department || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [enriched, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const tableRows = useMemo(() => {
    const p = Math.min(page, totalPages);
    const start = (p - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize, totalPages]);

  function DayCol({ title, items, accent }) {
    const shown = items.slice(0, 6);
    const extra = items.length > 6;
    return (
      <div className={`rounded-2xl border border-slate-700/50 bg-slate-900/70 backdrop-blur border-t-2 ${accent} flex flex-col`}>
        <div className="px-4 py-3 border-b border-slate-700/50 shrink-0">
          <h3 className="text-xs font-bold text-white">
            {title} <span className="text-slate-500 font-normal">({items.length})</span>
          </h3>
        </div>
        <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto custom-scroll">
          {items.length === 0 && <p className="text-[10px] text-slate-500 italic text-center py-8">No events</p>}
          {shown.map((ev) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => setSelected(ev)}
              className="w-full text-left p-3 rounded-xl border border-slate-700/50 bg-slate-950/50 hover:border-indigo-500/40 transition"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs font-bold text-white truncate">{ev.name}</span>
                <EventBadge status={ev.event_status} />
              </div>
              <p className="text-[10px] text-slate-500 truncate">{ev.venue || `${ev.building || ''} ${ev.room || ''}` || 'Venue TBD'}</p>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">{fmtWhen(ev)}</p>
              <p className="text-[10px] text-indigo-300 mt-1 truncate">
                {ev.assigned_engineer || ev.primary_it || 'Unassigned'}
              </p>
            </button>
          ))}
          {extra && (
            <p className="text-[10px] text-center text-slate-500 pt-1">
              +{items.length - 6} more — see table below
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="px-6 py-5 border-b border-slate-800 bg-[#0B0F19]/90 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">
            {eng ? 'Event Itinerary' : 'Event Command Center'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Campus AV, seminars, and technical deployments.</p>
        </div>
        {canManage && (
          <Link
            to="/events/new"
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-900/30"
          >
            + Schedule Event
          </Link>
        )}
      </header>

      <main className="flex-1 overflow-y-auto custom-scroll p-6 space-y-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <Kpi label="Live Now" value={kpis.live} tone="emerald" pulse={kpis.live > 0} />
          <Kpi label="Setup Pending" value={kpis.setup} tone="amber" />
          <Kpi label="Crew Deployed" value={kpis.crew} tone="indigo" />
          <Kpi label="Unassigned" value={kpis.unassigned} tone="rose" />
        </div>

        {loading ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DayCol title="Today" items={groups.today} accent="border-t-emerald-500/60" />
            <DayCol title="Tomorrow" items={groups.tomorrow} accent="border-t-amber-500/60" />
            <DayCol title="Upcoming" items={groups.upcoming} accent="border-t-blue-500/40" />
          </div>
        )}

        {/* Master events table */}
        <section className="rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-900/90 to-slate-950/80 overflow-hidden shadow-2xl shadow-black/20">
          <div className="px-5 py-4 border-b border-slate-700/50 flex flex-wrap items-center justify-between gap-3 bg-slate-900/50">
            <div>
              <h3 className="text-sm font-black text-white tracking-tight">All Events</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Searchable master register · department · venue · crew</p>
            </div>
            <input
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setPage(1); }}
              placeholder="Search id, name, dept, venue…"
              className="dark-input py-2 w-56 text-[11px] bg-[#0B0F19] rounded-xl"
            />
          </div>
          <div className="overflow-x-auto custom-scroll">
            <table className="w-full text-left min-w-[900px] text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-widest text-slate-500 border-b border-slate-700/50 bg-slate-950/40">
                  <th className="px-5 py-3.5 font-bold">ID</th>
                  <th className="px-5 py-3.5 font-bold">Event</th>
                  <th className="px-5 py-3.5 font-bold">Department</th>
                  <th className="px-5 py-3.5 font-bold">When</th>
                  <th className="px-5 py-3.5 font-bold">Venue</th>
                  <th className="px-5 py-3.5 font-bold">Lead</th>
                  <th className="px-5 py-3.5 font-bold">Status</th>
                  <th className="px-5 py-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((ev) => (
                  <tr
                    key={ev.id}
                    className="border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer"
                    onClick={() => setSelected(ev)}
                  >
                    <td className="px-5 py-3.5 font-mono font-bold text-indigo-400">#{ev.id}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-white">{ev.name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {ev.department || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 font-mono text-[10px]">{fmtWhen(ev)}</td>
                    <td className="px-5 py-3 text-slate-400">{ev.venue || `${ev.building || ''} ${ev.room || ''}` || '—'}</td>
                    <td className="px-5 py-3 text-slate-300">
                      {ev.assigned_engineer || ev.primary_it || <span className="text-slate-500 italic">unassigned</span>}
                    </td>
                    <td className="px-5 py-3">
                      <EventBadge status={ev.event_status} />
                    </td>
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Link
                        to={eventPath(ev.id)}
                        className="text-[10px] font-bold text-indigo-400 hover:underline"
                      >
                        Full view
                      </Link>
                    </td>
                  </tr>
                ))}
                {!loading && tableRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-slate-500 italic">
                      No events found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-700/50 flex flex-wrap items-center justify-between gap-3 bg-slate-950/30">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>Rows</span>
              {[15, 50, 100].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { setPageSize(n); setPage(1); }}
                  className={`px-2.5 py-1 rounded-lg font-bold border ${
                    pageSize === n
                      ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                      : 'border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
              <span className="text-slate-600">·</span>
              <span>
                {filtered.length === 0 ? 0 : (Math.min(page, totalPages) - 1) * pageSize + 1}
                –
                {Math.min(Math.min(page, totalPages) * pageSize, filtered.length)} of {filtered.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-bold text-slate-300 disabled:opacity-30"
              >
                Prev
              </button>
              <span className="text-[11px] text-slate-400 font-mono">
                {Math.min(page, totalPages)} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-bold text-slate-300 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Slide-in detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)} aria-label="Close" />
          <div className="relative w-full max-w-md h-full overflow-y-auto custom-scroll border-l border-slate-700/50 bg-slate-900/95 backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="font-mono text-indigo-400 text-xs font-bold">#{selected.id}</p>
                <h2 className="text-lg font-black text-white mt-1">{selected.name}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-400 hover:text-white text-sm font-bold">
                ✕
              </button>
            </div>
            <div className="mb-4">
              <EventBadge status={selected.event_status} />
            </div>
            <dl className="space-y-3 text-xs">
              <Row label="When" value={fmtWhen(selected)} />
              <Row label="Venue" value={selected.venue || `${selected.building || ''} ${selected.room || ''}` || '—'} />
              <Row label="Contact" value={selected.onsite_coordinator || selected.vip_contact || selected.organizer || '—'} />
              <Row label="Primary lead" value={selected.assigned_engineer || selected.primary_it || '—'} />
              <Row label="Backup" value={selected.backup_it || '—'} />
              <Row label="Type" value={selected.event_type || '—'} />
            </dl>
            {Array.isArray(selected.av_manifest) && selected.av_manifest.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">Equipment</p>
                <ul className="space-y-1">
                  {selected.av_manifest.map((m, i) => (
                    <li key={i} className="text-xs text-slate-300">
                      {m.checked ? '✓' : '○'} {m.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6 flex flex-col gap-2">
              <Link
                to={eventPath(selected.id)}
                className="block text-center py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
              >
                Full view
              </Link>
              {canManage && (
                <Link
                  to={`/events/${encodeRef ? '' : ''}`}
                  className="block text-center py-2.5 rounded-xl border border-slate-600 text-slate-300 text-xs font-bold hover:bg-slate-800"
                >
                  Edit event
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value }) {
  return (
    <div>
      <dt className="text-[9px] font-bold uppercase text-slate-500">{label}</dt>
      <dd className="text-white font-semibold mt-0.5">{value}</dd>
    </div>
  );
}

function Kpi({ label, value, tone, pulse }) {
  const map = {
    emerald: 'text-emerald-400 border-l-emerald-500',
    amber: 'text-amber-400 border-l-amber-500',
    indigo: 'text-indigo-400 border-l-indigo-500',
    rose: 'text-rose-400 border-l-rose-500',
  };
  return (
    <div className={`rounded-2xl border border-slate-700/50 bg-slate-900/70 p-4 border-l-2 ${map[tone]}`}>
      <p className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 ${map[tone].split(' ')[0]}`}>
        {pulse && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
        {label}
      </p>
      <p className="text-3xl font-black text-white mt-1">{value}</p>
    </div>
  );
}
