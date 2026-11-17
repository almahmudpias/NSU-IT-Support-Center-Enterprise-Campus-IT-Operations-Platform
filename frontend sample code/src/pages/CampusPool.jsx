import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { engineerApi, ticketsApi } from '../lib/api';
import { useRealtimeSync } from '../lib/realtime';
import { ticketPath } from '../lib/ids';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { formatDateTime } from '../lib/datetime';
import { getLatestRemark } from '../lib/printForms';

function timeAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function isTerminal(t) {
  const s = String(t?.status || '').toLowerCase().trim();
  // User Not Found remains operational — not closed/cancelled
  if (s === 'user not found') return false;
  return (
    s === 'resolved' ||
    s === 'rejected' ||
    s === 'dismissed' ||
    s.includes('cancel') // Canceled, Cancelled, User Cancel, Canceled by User, etc.
  );
}

/** Support engineer finished — waiting on user device; not active claimed work */
function isSupportPhaseDone(t) {
  return String(t?.status || '').toLowerCase().trim() === 'waiting for device';
}

function isPending(t) {
  const s = String(t?.status || '').toLowerCase();
  return s === 'pending approval' || s === 'pending_approval';
}

/** Campus = not workstation workflow */
function isCampusTicket(t) {
  const st = String(t?.status || '').toLowerCase();
  const ar = String(t?.action_required || '').toLowerCase();
  if (
    st.includes('hardware') ||
    st.includes('diagnostic') ||
    st === 'support workstation' ||
    st === 'brought to helpdesk' ||
    st === 'ready for return' ||
    st === 'waiting for parts' ||
    ar.includes('hardware') ||
    ar === 'support workstation' ||
    ar === 'under diagnostics' ||
    ar === 'ready for return' ||
    ar === 'brought to helpdesk'
  ) {
    return false;
  }
  return true;
}

function Kpi({ label, value, border, valueClass }) {
  return (
    <div className={`dark-card p-4 border-l-2 ${border}`}>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">{label}</p>
      <h3 className={`text-xl font-bold ${valueClass || 'text-white'}`}>{value}</h3>
    </div>
  );
}

export default function CampusPoolPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [available, setAvailable] = useState([]);
  const [mineOpen, setMineOpen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All Active');
  const [previewId, setPreviewId] = useState(null);
  const [claimingId, setClaimingId] = useState(null);

  const me = user?.fullName || '';

  const load = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const res = await engineerApi.workspace();
        setAvailable(Array.isArray(res?.availableCampus) ? res.availableCampus : []);
        const open = Array.isArray(res?.mineOpen) ? res.mineOpen : [];
        setMineOpen(
          open.filter(
            (t) =>
              isCampusTicket(t) &&
              !isTerminal(t) &&
              !isPending(t) &&
              !isSupportPhaseDone(t)
          )
        );
        setLoadError(null);
      } catch (e) {
        if (!silent) {
          const msg = e.message || 'Could not load campus pool';
          setLoadError(msg);
          showToast('error', 'Campus pool failed', msg);
          setAvailable([]);
          setMineOpen([]);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    load(false);
    const t = setInterval(() => load(true), 60000);
    return () => clearInterval(t);
  }, [load]);

  useRealtimeSync(() => { load(true); }, { enabled: true, debounceMs: 1500 });

  const myTaken = useMemo(() => {
    return mineOpen.filter((t) => {
      const a = String(t.assigned_engineer || '').trim().toLowerCase();
      return a === String(me).trim().toLowerCase();
    });
  }, [mineOpen, me]);

  const highPriorityAvail = available.filter((t) => {
    const p = String(t.priority || '').toLowerCase();
    return p === 'high' || p === 'critical';
  });

  let queue = [...available];
  if (search.trim()) {
    const q = search.toLowerCase();
    queue = queue.filter(
      (t) =>
        String(t.id).includes(q) ||
        (t.user_name || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.department || '').toLowerCase().includes(q) ||
        (t.building || '').toLowerCase().includes(q) ||
        (t.issue_category || '').toLowerCase().includes(q)
    );
  }
  if (filter === 'High Priority') {
    queue = queue.filter((t) => {
      const p = String(t.priority || '').toLowerCase();
      return p === 'high' || p === 'critical';
    });
  }

  async function claim(t) {
    setClaimingId(t.id);
    try {
      const res = await ticketsApi.claim(t.id, 'campus');
      if (res?.success === false) throw new Error(res.message || 'Claim failed');
      showToast('success', 'Claimed', res?.message || `Ticket #${t.id} is now yours`);
      setPreviewId(null);
      await load(true);
    } catch (e) {
      showToast('error', 'Claim failed', e.message || 'Could not claim');
      await load(true);
    } finally {
      setClaimingId(null);
    }
  }

  async function claimNext() {
    const next = queue.find((t) => !t.assigned_engineer);
    if (next) claim(next);
    else showToast('warning', 'Queue empty', 'No available campus tickets to claim.');
  }

  return (
    <>
      <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-[#1E293B] shrink-0 bg-[#0B1221]">
        <h1 className="text-lg font-bold text-white truncate">Campus Support</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => load(false)}
            disabled={loading}
            className="bg-[#1E293B] hover:bg-[#334155] text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition border border-[#334155] disabled:opacity-40"
          >
            Sync
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scroll p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Available" value={available.length} border="border-l-indigo-500" />
          <Kpi label="My Taken" value={myTaken.length} border="border-l-cyan-500" />
          <Kpi label="High Priority" value={highPriorityAvail.length} border="border-l-rose-500" valueClass="text-rose-400" />
          <Kpi label="In My Work (Campus)" value={mineOpen.length} border="border-l-emerald-500" />
        </div>

        {loadError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            Could not load Campus Support pool: {loadError}
          </div>
        )}

        {/* My Taken */}
        <div className="dark-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E293B] flex items-center justify-between gap-3 bg-gradient-to-r from-indigo-600/5 to-transparent">
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">My Taken Tickets</h2>
              <p className="text-[10px] text-slate-500">Campus Support tickets currently claimed by you</p>
            </div>
            <span className="text-[11px] font-bold text-indigo-300 tabular-nums">{myTaken.length}</span>
          </div>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 min-h-[72px]">
            {loading && myTaken.length === 0 && (
              <div className="col-span-full text-center text-xs text-slate-500 py-4">Loading…</div>
            )}
            {!loading && myTaken.length === 0 && (
              <div className="col-span-full text-center text-xs text-slate-500 italic py-4">
                No campus tickets assigned to you yet. Claim one from the queue below.
              </div>
            )}
            {myTaken.map((t) => (
              <Link
                key={t.id}
                to={ticketPath(t.id, { action: 'view' })}
                className="text-left w-full p-3 rounded-xl border border-[#1E293B] bg-[#0F172A]/80 hover:border-indigo-500/40 hover:bg-[#1E293B]/40 transition"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="font-mono font-bold text-indigo-400 text-xs">#{t.id}</span>
                  <span
                    className={`text-[10px] font-bold ${
                      String(t.priority || '').toLowerCase() === 'high' ||
                      String(t.priority || '').toLowerCase() === 'critical'
                        ? 'text-rose-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {t.priority || 'Normal'}
                  </span>
                </div>
                <div className="text-xs font-semibold text-white truncate">{t.user_name || 'Unknown'}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 whitespace-normal break-words leading-snug">
                  <span className="inline-block max-w-full">{t.issue_category || 'General'}</span>
                  <span> · {t.department || '—'}</span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-400/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  {t.status || 'In Progress'}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Available queue */}
        <div className="dark-card flex flex-col" style={{ minHeight: 'calc(100vh - 420px)' }}>
          <div className="p-4 md:p-5 border-b border-[#1E293B] flex flex-col gap-3 shrink-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-sm font-bold text-white">Available Campus Tickets</h2>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search ticket, user, location…"
                  className="dark-input w-full sm:w-56 py-1.5 bg-[#0F172A] border-[#1E293B]"
                />
                <button
                  type="button"
                  onClick={claimNext}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-lg shadow-indigo-900/20 whitespace-nowrap"
                >
                  Take Next Available
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {['All Active', 'High Priority'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                    filter === f
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                      : 'border-[#1E293B] text-slate-400 hover:text-white'
                  } ${f === 'High Priority' ? 'text-rose-400 border-rose-500/30' : ''}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-auto custom-scroll flex-1">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="sticky top-0 bg-[#0B1221] z-10 border-b border-[#1E293B]">
                <tr className="text-slate-500 text-[10px] uppercase tracking-wider font-bold">
                  <th className="px-4 py-3 w-20">Ticket #</th>
                  <th className="px-4 py-3">Requester</th>
                  <th className="px-4 py-3">Issue</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status & Priority</th>
                  <th className="px-4 py-3 text-center w-36">Action</th>
                </tr>
              </thead>
              <tbody className="text-xs font-medium text-slate-300">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-500 italic text-xs">
                      Loading available tickets…
                    </td>
                  </tr>
                )}
                {!loading && !loadError && queue.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <p className="text-sm font-bold text-white">All caught up!</p>
                      <p className="text-xs text-slate-500 mt-1">
                        No pending Campus Support tickets right now. Everything is looking good.
                      </p>
                    </td>
                  </tr>
                )}
                {!loading &&
                  queue.map((t) => {
                    const open = previewId === t.id;
                    return (
                      <Fragment key={t.id}>
                        <tr
                          className={`data-row cursor-pointer ${open ? 'bg-indigo-500/5' : ''}`}
                          onClick={() => setPreviewId(open ? null : t.id)}
                        >
                          <td className="px-5 py-4 font-mono font-bold text-indigo-400">#{t.id}</td>
                          <td className="px-5 py-4">
                            <div className="font-bold text-white">{t.user_name || 'Unknown'}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {t.department || '—'} · Ext {t.extension || '—'}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="text-white font-semibold truncate max-w-[200px]">
                              {t.description || '—'}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 w-[7.75rem] whitespace-normal break-words leading-snug">{t.issue_category || 'General'}</div>
                          </td>
                          <td className="px-5 py-4 text-slate-400">
                            {[t.building, t.room_location].filter(Boolean).join(' · ') || '—'}
                          </td>
                          <td className="px-5 py-4">
                            <div className="text-slate-300 font-bold">{t.status || 'Open'}</div>
                            <div
                              className={`text-[10px] font-bold mt-0.5 ${
                                String(t.priority || '').toLowerCase() === 'high' ||
                                String(t.priority || '').toLowerCase() === 'critical'
                                  ? 'text-rose-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              PRIORITY: {t.priority || 'Normal'}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              disabled={claimingId === t.id}
                              onClick={() => claim(t)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white transition px-4 py-1.5 rounded-lg text-xs font-bold w-full shadow-lg shadow-indigo-900/20 disabled:opacity-50"
                            >
                              {claimingId === t.id ? 'Claiming…' : 'Take Ticket'}
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-[#0B0F19]/80 border-b border-[#1E293B]">
                            <td colSpan={6} className="p-0">
                              <div className="px-5 py-4 border-l-2 border-indigo-500/50">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                                      Quick preview · Ticket #{t.id}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      Opened {t.created_at ? formatDateTime(t.created_at) : '—'} ·{' '}
                                      {timeAgo(t.created_at)} ago
                                    </p>
                                  </div>
                                  <Link
                                    to={ticketPath(t.id, { action: 'view' })}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold inline-flex items-center shrink-0"
                                  >
                                    Full view details →
                                  </Link>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                                  <div>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                      Requester
                                    </p>
                                    <p className="text-slate-200 font-semibold">{t.user_name || '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                      Location
                                    </p>
                                    <p className="text-slate-200">
                                      {[t.building, t.room_location].filter(Boolean).join(' · ') || '—'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                      Latest remark
                                    </p>
                                    <p className="text-slate-300 line-clamp-2">{getLatestRemark(t) || '—'}</p>
                                  </div>
                                  <div className="sm:col-span-2 lg:col-span-3">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                      Issue
                                    </p>
                                    <p className="text-slate-300 whitespace-pre-wrap break-words">
                                      {t.description || '—'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
