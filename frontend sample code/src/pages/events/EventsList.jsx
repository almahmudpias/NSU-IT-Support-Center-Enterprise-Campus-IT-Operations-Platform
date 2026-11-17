import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { eventsApi } from '../../lib/api';
import { eventPath, eventEditPath, eventNewPath, encodeRef, resolveParamId } from '../../lib/ids';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';
import { isAdmin, isEngineerOnly } from '../../lib/rbac';
import { bucketEvents, computeEventStatus, eventStartDate } from '../../lib/eventStatus';
import { formatDate, formatTimeWithDay, formatDateTime } from '../../lib/datetime';
import { useRealtimeSync } from '../../lib/realtime';

function EventBadge({ status, approval }) {
  if (String(approval || '').toLowerCase() === 'pending') {
    return (
      <span className="inline-flex items-center justify-center w-[7.5rem] h-7 px-2 rounded-md text-[10px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-300 border border-amber-500/40 whitespace-nowrap">
        Pending
      </span>
    );
  }
  const s = status || 'Upcoming';
  const map = {
    'Action Required': 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    'Setup in Progress': 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    Ongoing: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    'Standby/Monitoring': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    Ended: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    'Teardown Complete': 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  };
  const cls = map[s] || 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  const short =
    s === 'Action Required'
      ? 'Action req.'
      : s === 'Setup in Progress'
        ? 'Setup'
        : s === 'Teardown Complete'
          ? 'Teardown'
          : s === 'Standby/Monitoring'
            ? 'Standby'
            : s;
  return (
    <span
      className={`inline-flex items-center justify-center w-[7.5rem] h-7 px-2 rounded-md text-[10px] font-bold uppercase tracking-wide border whitespace-nowrap truncate ${cls}`}
      title={s}
    >
      {short}
    </span>
  );
}

/** Neutral meta box — matches campus support category chip (no colored text/border) */
function MetaChip({ value }) {
  const text = value && String(value).trim() ? String(value).trim() : '—';
  return (
    <span
      className="inline-flex items-center justify-center w-[8.25rem] min-h-[2.25rem] px-2.5 py-1.5 text-[10px] font-semibold tracking-wide bg-[#0B0F19] border border-[#1F2937] text-gray-400 rounded-lg text-center whitespace-normal break-words leading-snug"
      title={text}
    >
      {text}
    </span>
  );
}

function engineerEventRole(ev, user) {
  if (!user || !ev) return null;
  const names = [user.fullName, user.username, user.full_name]
    .filter(Boolean)
    .map((s) => String(s).trim().toLowerCase());
  if (!names.length) return null;
  const match = (v) => names.includes(String(v || '').trim().toLowerCase());
  // Primary: assigned_engineer or primary_it
  if (match(ev.assigned_engineer) || match(ev.primary_it)) return 'Primary';
  if (match(ev.backup_it)) return 'Backup';
  return null;
}

function EventCard({ ev, myRole }) {
  const start = eventStartDate(ev);
  return (
    <Link
      to={eventPath(ev.id, { action: 'view' })}
      className="block p-4 bg-[#0B0F19]/50 border border-[#1F2937] rounded-xl hover:border-indigo-500/40 transition"
    >
      <div className="flex justify-between items-start gap-2 mb-2">
        <p className="text-sm font-bold text-white leading-snug line-clamp-2">{ev.name || 'Untitled'}</p>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <EventBadge status={ev.event_status} approval={ev.approval_status || ev.status} />
          {myRole ? (
            <span
              className={`inline-flex items-center h-6 px-2 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
                myRole === 'Primary'
                  ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40'
                  : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
              }`}
            >
              {myRole}
            </span>
          ) : null}
        </div>
      </div>
      <p className="text-[10px] font-mono text-slate-500 mb-2">EV-{ev.id}</p>
      <div className="text-[11px] text-slate-400 space-y-1">
        <p>
          {start ? (
            <>
              {formatDate(start)} · {formatTimeWithDay(start)}
            </>
          ) : (
            ev.event_date || '—'
          )}
        </p>
        <p className="truncate">{ev.venue || '—'}</p>
        <p className="text-emerald-400/90 font-semibold truncate">
          {ev.assigned_engineer || ev.primary_it || 'Unassigned'}
        </p>
      </div>
    </Link>
  );
}

function BoardCol({ title, sub, colorDot, items, user }) {
  return (
    <div className="flex flex-col min-h-0 bg-[#111827] border border-[#1F2937] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1F2937] bg-[#0B0F19]/60 shrink-0">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${colorDot}`} />
          {title}
          <span className="ml-auto text-[10px] font-bold text-slate-500 tabular-nums">{items.length}</span>
        </h3>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{sub}</p>
      </div>
      <div className="flex-1 overflow-y-auto custom-scroll p-3 space-y-2.5">
        {items.length === 0 ? (
          <p className="text-center text-xs text-slate-600 italic py-10">No events</p>
        ) : (
          items.map((ev) => (
            <EventCard key={ev.id} ev={ev} myRole={engineerEventRole(ev, user)} />
          ))
        )}
      </div>
    </div>
  );
}

export default function EventsList() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const eng = isEngineerOnly(user);
  const canManage = isAdmin(user);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState('board');
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedId, setExpandedId] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [approving, setApproving] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const data = await eventsApi.all();
        setEvents(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!silent) showToast('error', 'Failed to load events', e.message);
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    load(false);
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  useRealtimeSync(() => { try { load(true); } catch { load(); } }, { enabled: true, debounceMs: 1200 });

  useEffect(() => {
    const raw = searchParams.get('preview');
    if (!raw) {
      setExpandedId(null);
      return;
    }
    const id = resolveParamId(raw);
    setExpandedId(id != null ? Number(id) || id : null);
  }, [searchParams]);

  function togglePreview(id) {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next == null) p.delete('preview');
        else p.set('preview', encodeRef('event', next));
        return p;
      },
      { replace: true }
    );
    if (viewMode !== 'sheet') setViewMode('sheet');
  }

  async function confirmApprove() {
    if (!approveTarget) return;
    setApproving(true);
    try {
      await eventsApi.approve(approveTarget.id);
      showToast('success', 'Event approved', 'Engineers notified by email.');
      setApproveTarget(null);
      setExpandedId(null);
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.delete('preview');
        return p;
      }, { replace: true });
      await load(true);
    } catch (e) {
      showToast('error', 'Approval failed', e.message);
    } finally {
      setApproving(false);
    }
  }

  const enriched = useMemo(() => {
    let list = (events || []).map((e) => ({
      ...e,
      event_status: computeEventStatus(e) || e.event_status || 'Upcoming',
    }));
    if (eng) {
      const me = user?.fullName || '';
      list = list.filter(
        (e) =>
          e.assigned_engineer === me ||
          e.primary_it === me ||
          e.backup_it === me ||
          (Array.isArray(e.additional_crew) && e.additional_crew.includes(me))
      );
    }
    const q = filter.trim().toLowerCase();
    if (q) {
      list = list.filter((e) =>
        [e.name, e.venue, e.department, e.assigned_engineer, e.primary_it, e.organizer]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    return list;
  }, [events, eng, user, filter]);

  const columns = useMemo(() => {
    const b = bucketEvents(enriched);
    // Active board only — past excluded from columns
    return {
      today: b.today || [],
      tomorrow: b.tomorrow || [],
      upcoming: b.upcoming || [],
    };
  }, [enriched]);

  // Sheet: active first, then past at bottom (no past column on board)
  const sheetRows = useMemo(() => {
    const b = bucketEvents(enriched);
    return [...(b.today || []), ...(b.tomorrow || []), ...(b.upcoming || []), ...(b.past || [])];
  }, [enriched]);

  const expanded = useMemo(
    () => enriched.find((e) => String(e.id) === String(expandedId)) || null,
    [enriched, expandedId]
  );

  const isPending = (ev) => String(ev?.approval_status || ev?.status || '').toLowerCase() === 'pending';

  return (
    <>
      {/* System-standard top bar (matches Incident Stream) */}
      <header className="h-20 flex items-center justify-between px-8 bg-[#111827] border-b border-[#1F2937] shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Event Manager</h2>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            {eng
              ? 'Your assigned events only · view-only (edits are disabled for engineers)'
              : 'University IT event deployments · primary & backup leads'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-9 rounded-lg border border-[#374151] overflow-hidden bg-[#0B0F19]">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`px-3 text-[11px] font-bold transition ${
                viewMode === 'board' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode('sheet')}
              className={`px-3 text-[11px] font-bold transition ${
                viewMode === 'sheet' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sheet
            </button>
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            className="h-9 w-9 rounded-lg bg-[#1F2937] border border-[#374151] text-gray-400 hover:text-white flex items-center justify-center"
            title="Refresh"
          >
            ↻
          </button>
          {canManage && (
            <Link
              to={eventNewPath()}
              className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center shadow-lg shadow-indigo-900/30"
            >
              + Schedule event
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col px-6 py-4 gap-3">
        <div className="shrink-0 flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search events, venue, lead…"
              className="w-full h-9 pl-3 pr-3 rounded-lg bg-[#111827] border border-[#374151] text-xs text-white outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {loading && !events.length ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : viewMode === 'board' ? (
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">
            <BoardCol title="Today" sub="In progress & due today" colorDot="bg-emerald-400" items={columns.today} user={user} />
            <BoardCol title="Tomorrow" sub="Next calendar day" colorDot="bg-amber-400" items={columns.tomorrow} user={user} />
            <BoardCol title="Upcoming" sub="Beyond tomorrow" colorDot="bg-blue-400" items={columns.upcoming} user={user} />
          </div>
        ) : (
          <div className="flex-1 min-h-0 bg-[#111827] border border-[#1F2937] rounded-xl overflow-hidden flex flex-col shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="px-4 py-2 border-b border-[#1F2937] bg-gradient-to-r from-[#0B0F19] via-[#111827]/80 to-[#0B0F19] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Event sheet · <span className="text-indigo-300">{sheetRows.length}</span> records
                </p>
              </div>
              <p className="text-[10px] text-slate-600">Click a row for quick preview</p>
            </div>
            <div className="overflow-auto custom-scroll flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-[#0d1320]/95 backdrop-blur-sm border-b border-[#1F2937]">
                  <tr className="text-[10px] uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-2.5 font-bold w-20">ID</th>
                    <th className="px-4 py-2.5 font-bold">Event</th>
                    <th className="px-4 py-2.5 font-bold w-32">When</th>
                    <th className="px-4 py-2.5 font-bold">Department</th>
                    <th className="px-4 py-2.5 font-bold">Venue</th>
                    <th className="px-4 py-2.5 font-bold">Primary lead</th>
                    <th className="px-4 py-2.5 font-bold w-36 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!sheetRows.length ? (
                    <tr>
                      <td colSpan={7} className="text-center text-slate-500 text-sm py-16 italic">
                        No events
                      </td>
                    </tr>
                  ) : (
                    sheetRows.map((ev) => {
                      const start = eventStartDate(ev);
                      const open = String(expandedId) === String(ev.id);
                      return (
                        <Fragment key={ev.id}>
                          <tr
                            onClick={() => togglePreview(ev.id)}
                            className={`border-b border-[#1F2937]/70 hover:bg-indigo-500/[0.07] cursor-pointer transition ${
                              open
                                ? 'bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/25'
                                : 'even:bg-[#0B0F19]/35'
                            }`}
                          >
                            <td className="px-4 py-3 text-[11px] font-mono font-bold text-indigo-400 align-middle whitespace-nowrap">
                              EV-{ev.id}
                            </td>
                            <td className="px-4 py-3 max-w-[240px] align-middle">
                              <p className="text-sm font-semibold text-white leading-snug line-clamp-2 break-words">
                                {ev.name || 'Untitled'}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-300 align-middle whitespace-nowrap">
                              {start ? (
                                <>
                                  <div className="font-medium text-slate-200">{formatDate(start)}</div>
                                  <div className="text-slate-500 text-[11px]">{formatTimeWithDay(start)}</div>
                                </>
                              ) : (
                                ev.event_date || '—'
                              )}
                            </td>
                            <td className="px-4 py-3 align-middle">
                              <MetaChip value={ev.department} />
                            </td>
                            <td className="px-4 py-3 align-middle">
                              <MetaChip value={ev.venue} />
                            </td>
                            <td className="px-4 py-3 text-xs font-medium text-slate-300 align-middle">
                              {ev.assigned_engineer || ev.primary_it || '—'}
                            </td>
                            <td className="px-4 py-3 text-center align-middle">
                              <EventBadge status={ev.event_status} approval={ev.approval_status || ev.status} />
                            </td>
                          </tr>
                          {open && expanded && (
                            <tr className="bg-gradient-to-r from-indigo-950/40 to-[#0B0F19] border-b border-indigo-500/25">
                              <td colSpan={7} className="px-4 py-3">
                                <div className="rounded-xl border border-indigo-500/20 bg-[#111827]/90 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 shadow-[inset_0_1px_0_rgba(99,102,241,0.08)]">
                                  <div className="space-y-1.5 text-xs">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                                      Quick preview
                                    </p>
                                    <p className="text-sm font-bold text-white">{expanded.name}</p>
                                    <p className="text-slate-400">
                                      {eventStartDate(expanded)
                                        ? formatDateTime(eventStartDate(expanded))
                                        : expanded.event_date || '—'}
                                    </p>
                                    <p className="text-slate-400">Department: {expanded.department || '—'}</p>
                                    <p className="text-slate-400">Venue: {expanded.venue || '—'}</p>
                                    <p className="text-slate-400">
                                      Organizer: {expanded.onsite_coordinator || expanded.organizer || '—'}
                                    </p>
                                  </div>
                                  <div className="space-y-1.5 text-xs">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                      Assignment
                                    </p>
                                    <p className="text-emerald-400 font-semibold">
                                      Primary: {expanded.assigned_engineer || expanded.primary_it || '—'}
                                    </p>
                                    <p className="text-slate-400">
                                      Backup:{' '}
                                      {Array.isArray(expanded.additional_crew) && expanded.additional_crew.length
                                        ? expanded.additional_crew.join(', ')
                                        : expanded.backup_it || '—'}
                                    </p>
                                    {Array.isArray(expanded.av_manifest) && expanded.av_manifest.length > 0 && (
                                      <p className="text-slate-400">
                                        Equipment: {expanded.av_manifest.map((x) => x.label || x).join(', ')}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-2 justify-center">
                                    <Link
                                      to={eventPath(expanded.id, { action: 'view' })}
                                      className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      Full view
                                    </Link>
                                    {canManage && (
                                      <Link
                                        to={eventEditPath(expanded.id)}
                                        className="h-9 px-4 rounded-lg border border-[#374151] text-slate-300 text-xs font-bold flex items-center justify-center hover:bg-[#1F2937]"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Edit
                                      </Link>
                                    )}
                                    {canManage && isPending(expanded) && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setApproveTarget(expanded);
                                        }}
                                        className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                                      >
                                        Review & approve…
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {approveTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[#0B0F19]/85 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-[#162032] to-[#0f1624] shadow-[0_40px_100px_rgba(0,0,0,0.75)] overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-[#1F2937]/80 bg-gradient-to-r from-emerald-600/10 via-transparent to-teal-600/10">
              <div className="flex items-center justify-center mb-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-emerald-900/50 ring-4 ring-emerald-500/20">
                  ✓
                </div>
              </div>
              <h3 className="text-center text-lg font-black text-white tracking-tight">Confirm event approval</h3>
              <p className="text-center text-[11px] text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
                Verify the deployment profile. Primary and backup leads are notified only after you confirm.
              </p>
            </div>
            <div className="px-6 py-4">
              <div className="rounded-xl border border-[#1F2937] bg-[#0B0F19]/60 overflow-hidden text-xs">
                {[
                  ['Event', approveTarget.name],
                  ['When', `${approveTarget.event_date || '—'} ${approveTarget.start_time || ''}`.trim()],
                  ['Department', approveTarget.department || '—'],
                  ['Venue', approveTarget.venue || '—'],
                  ['Primary lead', approveTarget.assigned_engineer || approveTarget.primary_it || '—'],
                ].map(([k, v], i) => (
                  <div
                    key={k}
                    className={`flex justify-between gap-3 px-3.5 py-2.5 ${i ? 'border-t border-[#1F2937]/80' : ''}`}
                  >
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] shrink-0">{k}</span>
                    <span className="text-slate-100 font-semibold text-right">{v}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 mt-3 leading-relaxed">
                Approving dispatches email notifications to the primary and backup engineers immediately.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-2.5">
              <button
                type="button"
                onClick={() => setApproveTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#1f2937] border border-[#374151] text-gray-300 hover:bg-[#374151]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={approving}
                onClick={confirmApprove}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 shadow-lg shadow-emerald-900/30"
              >
                {approving ? 'Approving…' : 'Approve & notify'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
