import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ticketsApi } from '../lib/api';
import { ticketPath } from '../lib/ids';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDateTime } from '../lib/datetime';
import { getLatestRemark } from '../lib/printForms';
import { useRealtimeSync } from '../lib/realtime';

function arOf(t) {
  return String(t?.action_required || '').toLowerCase();
}
function stOf(t) {
  return String(t?.status || '').toLowerCase();
}
function isReadyReturn(t) {
  return arOf(t) === 'ready for return' || stOf(t) === 'ready for return' || stOf(t) === 'ready to handover';
}
function isHardwareLab(t) {
  const ar = arOf(t);
  const st = stOf(t);
  return (
    ar === 'in hardware lab' ||
    ar === 'waiting for parts' ||
    st === 'in hardware lab' ||
    st === 'waiting for parts' ||
    st === 'sent to hardware' ||
    st === 'send to hardware' ||
    st.includes('hardware lab')
  );
}

export default function LabPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  /** /support-workstation/my-work — only this engineer's assigned/claimed lab tickets */
  const myWorkOnly =
    /\/my-work\/?$/.test(location.pathname) ||
    location.pathname.includes('/support-workstation/my-work') ||
    location.pathname.includes('/6004/my-work');
  const [queue, setQueue] = useState([]);
  const [filter, setFilter] = useState('All Active');
  const [search, setSearch] = useState('');
  const [previewId, setPreviewId] = useState(null);
  const [prevHist, setPrevHist] = useState({}); // id → { loading, items }
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const loadSeq = useRef(0);
  const hasLoadedOnce = useRef(false);
  const toastRef = useRef(showToast);
  toastRef.current = showToast;
  const [handoverId, setHandoverId] = useState(null);

  // Background-safe load: after first paint, never blank the page or flash "Loading…"
  const load = useCallback(async (silent = true) => {
    const seq = ++loadSeq.current;
    const isInitial = !hasLoadedOnce.current;
    try {
      if (isInitial) setLoading(true);
      else if (!silent) setSyncing(true);
      const data = await ticketsApi.lab();
      if (seq !== loadSeq.current) return; // stale response
      const next = Array.isArray(data) ? data : [];
      // Avoid needless re-renders when payload is unchanged
      setQueue((prev) => {
        if (
          prev.length === next.length &&
          prev.every((t, i) => t.id === next[i]?.id && t.status === next[i]?.status &&
            t.lab_engineer === next[i]?.lab_engineer &&
            t.assigned_engineer === next[i]?.assigned_engineer &&
            t.action_required === next[i]?.action_required &&
            t.updated_at === next[i]?.updated_at)
        ) {
          return prev;
        }
        return next;
      });
      setLoadError(null);
      hasLoadedOnce.current = true;
    } catch (e) {
      if (seq !== loadSeq.current) return;
      const msg = e?.message || 'Queue sync failed';
      // Keep existing rows visible on background failure
      if (isInitial) {
        setLoadError(msg);
        toastRef.current?.('error', 'Queue sync failed', msg);
      }
    } finally {
      if (seq === loadSeq.current) {
        setLoading(false);
        setSyncing(false);
      }
    }
  }, []);

  useEffect(() => {
    load(true); // first fetch: only shows loading while queue is still empty
    const iv = setInterval(() => load(true), 60000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Soft realtime refresh — background only
  useRealtimeSync(() => load(true), { enabled: true, debounceMs: 1800 });

  useEffect(() => {
    if (myWorkOnly && filter === 'Available') setFilter('Assigned to Me');
  }, [myWorkOnly, filter]);

  const me = user?.fullName || '';
  const meNames = [user?.fullName, user?.username, user?.full_name]
    .filter(Boolean)
    .map((s) => String(s).trim().toLowerCase());
  function isMineLab(t) {
    const lab = String(t?.lab_engineer || '').trim().toLowerCase();
    const assigned = String(t?.assigned_engineer || '').trim().toLowerCase();
    if (!meNames.length) return false;
    // Lab ownership is primarily lab_engineer (claim/assign on workstation)
    if (lab && meNames.includes(lab)) return true;
    // Also show if assigned_engineer matches and ticket is workstation-class
    if (assigned && meNames.includes(assigned) && isHardwareLab(t) === false) {
      // only when it is lab/workstation workflow (not pure campus)
      const st = stOf(t);
      const ar = arOf(t);
      if (
        st.includes('support workstation') ||
        st.includes('diagnostic') ||
        st.includes('hardware') ||
        ar.includes('support workstation') ||
        ar.includes('diagnostic') ||
        ar.includes('hardware') ||
        ar === 'brought to helpdesk' ||
        st === 'brought to helpdesk'
      ) {
        return true;
      }
    }
    return false;
  }

  const scopedQueue = useMemo(() => {
    if (!myWorkOnly) return queue;
    // Deduplicate by id; only tickets owned by this engineer
    const map = new Map();
    (queue || []).forEach((t) => {
      if (isMineLab(t)) map.set(t.id, t);
    });
    return Array.from(map.values());
  }, [queue, myWorkOnly, me, user]);

  const ready = useMemo(() => scopedQueue.filter((t) => isReadyReturn(t)), [scopedQueue]);
  const hwLab = useMemo(() => scopedQueue.filter((t) => isHardwareLab(t)), [scopedQueue]);
  const active = useMemo(() => {
    let rows = scopedQueue.filter((t) => !isReadyReturn(t) && !isHardwareLab(t));
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (t) =>
          String(t.id).includes(q) ||
          (t.user_name || '').toLowerCase().includes(q) ||
          (t.hw_type || '').toLowerCase().includes(q)
      );
    }
    if (filter === 'Available') rows = rows.filter((t) => !t.lab_engineer);
    if (filter === 'Assigned to Me') rows = rows.filter((t) => t.lab_engineer === me);
    if (filter === 'High Priority') rows = rows.filter((t) => t.priority === 'High');
    return rows;
  }, [queue, search, filter, me]);

  const myTaken = useMemo(
    () => scopedQueue.filter((t) => isMineLab(t) && !isReadyReturn(t) && !isHardwareLab(t)),
    [scopedQueue, me, user]
  );

  const previewReq = useRef(0);
  const previewTarget = useRef(null);
  const histTimers = useRef({});

  function togglePreview(id) {
    const next = previewId === id ? null : id;
    // Open/close first — never wait on network for the expand animation
    setPreviewId(next);
    previewTarget.current = next;
    if (next == null) return;

    // Cached — nothing to fetch
    if (prevHist[next]?.items?.length && !prevHist[next]?.loading) return;
    if (prevHist[next]?.loading) return;

    const reqId = ++previewReq.current;
    // Mark loading after paint so the row can expand immediately
    if (histTimers.current[next]) {
      clearTimeout(histTimers.current[next]);
    }
    histTimers.current[next] = setTimeout(async () => {
      if (previewTarget.current !== next) return;
      setPrevHist((h) => ({
        ...h,
        [next]: { loading: true, items: h[next]?.items || [], error: null },
      }));
      try {
        const hist = await ticketsApi.history(next, { limit: 20 });
        if (previewTarget.current !== next || previewReq.current !== reqId) {
          // Stale — still cache under id without forcing UI if closed
        }
        const rows = Array.isArray(hist) ? hist : [];
        const support = [];
        for (let i = rows.length - 1; i >= 0 && support.length < 5; i--) {
          const h = rows[i];
          const note = String(h.action_note || '').toLowerCase();
          const eng = String(h.engineer_name || '').trim();
          if (!eng || eng.toLowerCase() === 'system') continue;
          if (
            /claim|assign|diagnostic|hardware|remark|updated by|resolved|handover|status|description/i.test(
              note
            ) ||
            Boolean(h.previous_status || h.new_status)
          ) {
            support.push(h);
          }
        }
        support.reverse();
        setPrevHist((h) => ({
          ...h,
          [next]: { loading: false, items: support, error: null },
        }));
      } catch (e) {
        if (previewTarget.current !== next) return;
        setPrevHist((h) => ({
          ...h,
          [next]: {
            loading: false,
            items: h[next]?.items || [],
            error: e?.message || 'History failed',
          },
        }));
      }
    }, 0);
  }

  useEffect(() => {
    return () => {
      Object.values(histTimers.current || {}).forEach((t) => clearTimeout(t));
    };
  }, []);

  async function claim(id) {
    if (myTaken.length >= 3) {
      showToast('error', 'Limit Reached', 'You cannot hold more than 3 active devices.');
      return;
    }
    try {
      // Server-side atomic claim (rejects if another engineer won the race)
      const res = await ticketsApi.claim(id, 'workstation');
      if (res?.success === false) throw new Error(res.message || 'Claim failed');
      // Optimistic local update — no full-page reload flash
      const updated = res?.ticket;
      if (updated && updated.id != null) {
        setQueue((prev) => {
          const idx = prev.findIndex((t) => String(t.id) === String(updated.id));
          if (idx < 0) return prev;
          const copy = prev.slice();
          copy[idx] = { ...prev[idx], ...updated };
          return copy;
        });
      }
      showToast('success', 'Device Claimed', res?.message || `Ticket #${id} assigned to you.`);
      load(true); // quiet background reconcile
    } catch (e) {
      showToast('error', 'Claim failed', e.message);
      load(true);
    }
  }

  async function claimNext() {
    if (myTaken.length >= 3) {
      showToast('error', 'Limit Reached', 'You cannot hold more than 3 active devices.');
      return;
    }
    const next = queue.find((t) => !t.lab_engineer && t.action_required !== 'Ready for Return');
    if (next) claim(next.id);
    else showToast('warning', 'Queue empty', 'No available devices in queue.');
  }

  async function handOver(id) {
    setHandoverId(id);
  }

  async function confirmHandOver() {
    const id = handoverId;
    if (id == null) return;
    setHandoverId(null);
    try {
      await ticketsApi.update(
        id,
        { status: 'Resolved', user_status: 'Handed Over' },
        { engineerName: me, actionNote: 'Device Handed Over & Resolved' }
      );
      showToast('success', 'Handed Over', `Ticket #${id} resolved.`);
      load(true);
    } catch (e) {
      showToast('error', 'Failed', e.message);
    }
  }

  return (
    <>
      <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-[#1E293B] shrink-0 bg-[#0B1221]">
        <h1 className="text-lg font-bold text-white truncate">{myWorkOnly ? 'My Lab Work' : 'Workstation'}</h1>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-600/10 via-cyan-500/10 to-purple-500/10 border border-blue-500/20">
            <span className="text-[10px] text-slate-400">Developed by</span>
            <span className="text-[11px] font-semibold bg-gradient-to-r from-blue-400 via-cyan-300 to-purple-400 bg-clip-text text-transparent">
              A. Al Mahmud Pias
            </span>
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={syncing}
            className="bg-[#1E293B] hover:bg-[#334155] text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 border border-[#334155] disabled:opacity-60"
          >
            <svg
              className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {syncing ? 'Syncing…' : 'Sync Systems'}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scroll p-4 md:p-6 space-y-4">
                  {loading && queue.length === 0 && (
            <div className="col-span-full text-xs text-slate-500 px-1 py-2">Loading workstation queue…</div>
          )}
          {!loading && loadError && (
            <div className="col-span-full rounded-xl border border-rose-500/30 bg-rose-950/20 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-rose-300">Could not load workstation queue</p>
                <p className="text-xs text-slate-500 mt-0.5">{loadError}</p>
              </div>
              <button
                type="button"
                onClick={() => load(true)}
                className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                Retry
              </button>
            </div>
          )}
<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Kpi label="Total Devices" value={queue.length} border="border-l-blue-500" />
          <Kpi label="Unassigned" value={active.filter((t) => !t.lab_engineer).length} border="border-l-purple-500" />
          <Kpi label="Under Diagnosis" value={active.filter((t) => t.action_required === 'Under Diagnostics').length} border="border-l-amber-500" />
          <Kpi label="Waiting Hardware" value={hwLab.length} border="border-l-rose-500" />
          <Kpi label="Ready for Return" value={ready.length} border="border-l-emerald-500" />
          <Kpi label="High Priority" value={active.filter((t) => t.priority === 'High').length} border="border-l-red-600" valueClass="text-red-500" />
        </div>

        {/* My Taken */}
        <div className="dark-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E293B] flex items-center justify-between gap-3 bg-gradient-to-r from-blue-600/5 to-transparent">
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">My Taken Devices</h2>
              <p className="text-[10px] text-slate-500">Devices currently assigned to you (max 3 active)</p>
            </div>
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                myTaken.length >= 3
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  : 'bg-blue-500/15 text-blue-300 border-blue-500/25'
              }`}
            >
              {myTaken.length} / 3
            </span>
          </div>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 min-h-[72px]">
            {myTaken.length === 0 && (
              <div className="col-span-full text-center text-xs text-slate-500 italic py-4">
                No lab work assigned or claimed by you right now. Claim one from the queue below.
              </div>
            )}
            {myTaken.map((t) => (
              <Link
                key={t.id}
                to={ticketPath(t.id, { action: 'view' })}
                className="text-left w-full p-3 rounded-xl border border-[#1E293B] bg-[#0F172A]/80 hover:border-blue-500/40 hover:bg-[#1E293B]/40 transition"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="font-mono font-bold text-blue-400 text-xs">#{t.id}</span>
                  {t.priority === 'High' ? (
                    <span className="text-rose-400 text-[10px] font-bold">HIGH</span>
                  ) : (
                    <span className="text-slate-500 text-[10px]">Normal</span>
                  )}
                </div>
                <div className="text-xs font-semibold text-white truncate">{t.user_name || 'Unknown'}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                  {t.hw_type || 'Device'} · {t.department || '—'}
                </div>
                <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {t.action_required || t.status || 'In Progress'}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Queue table */}
        <div className="dark-card flex flex-col" style={{ minHeight: 'calc(100vh - 380px)' }}>
          <div className="p-4 md:p-5 border-b border-[#1E293B] flex flex-col gap-3 shrink-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-sm font-bold text-white">Active Device Queue</h2>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search ticket, user, device..."
                  className="dark-input w-full sm:w-56 py-1.5 bg-[#0F172A] border-[#1E293B]"
                />
                <button
                  onClick={claimNext}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-lg shadow-blue-900/20 whitespace-nowrap"
                >
                  Take Next Available
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {['All Active', 'Available', 'Assigned to Me', 'High Priority'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`filter-btn ${filter === f ? 'active' : ''} ${
                    f === 'High Priority' ? 'text-rose-400 border-rose-500/30' : ''
                  }`}
                >
                  {f}
                  {f === 'Assigned to Me' && myTaken.length > 0 && (
                    <span className="ml-1 bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full text-[9px]">
                      {myTaken.length}
                    </span>
                  )}
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
                  <th className="px-4 py-3">Device Details</th>
                  <th className="px-4 py-3">Status & Priority</th>
                  <th className="px-4 py-3">Assigned Engineer</th>
                  <th className="px-4 py-3 text-center w-36">Action</th>
                </tr>
              </thead>
              <tbody className="text-xs font-medium text-slate-300">
                {active.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-500 italic text-xs bg-[#0F172A]/30">
                      {myWorkOnly ? "No lab work matching this filter." : "No active devices in queue matching criteria"}.
                    </td>
                  </tr>
                )}
                {active.map((t) => {
                  const isUnassigned = !t.lab_engineer;
                  const open = previewId === t.id;
                  const histState = open ? prevHist[t.id] || { loading: true, items: [], error: null } : null;
                  let previous = null;
                  if (open && histState && histState.items?.length) {
                    const items = histState.items;
                    for (let i = items.length - 1; i >= 0; i--) {
                      const h = items[i];
                      const eng = String(h.engineer_name || '').trim();
                      if (!eng) continue;
                      if (t.lab_engineer && eng.toLowerCase() === String(t.lab_engineer).toLowerCase()) continue;
                      previous = h;
                      break;
                    }
                    if (!previous) previous = items[items.length - 1] || null;
                  }
                  return (
                    <Fragment key={t.id}>
                      <tr
                        className={`data-row cursor-pointer ${open ? 'bg-indigo-500/5' : ''}`}
                        onClick={() => togglePreview(t.id)}
                      >
                        <td className="px-5 py-4 font-mono font-bold text-blue-400">#{t.id}</td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-white">{t.user_name || 'Unknown'}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {t.department || '-'} | {t.designation || '-'}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-white font-semibold">{t.hw_type || 'Unspecified Device'}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[150px]">
                            {t.issue_category || 'General'}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-slate-300 font-bold">{t.action_required || t.status || 'Waiting in Queue'}</div>
                          <div
                            className={`text-[10px] text-slate-500 font-bold mt-0.5 ${
                              t.priority === 'High' ? 'text-rose-400' : ''
                            }`}
                          >
                            PRIORITY: {t.priority || 'Normal'}
                          </div>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-300">
                          {isUnassigned ? (
                            <span className="text-amber-500/50 italic">Available</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              {t.lab_engineer}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          {isUnassigned ? (
                            <button
                              onClick={() => claim(t.id)}
                              className="bg-blue-600 hover:bg-blue-500 text-white transition px-4 py-1.5 rounded-lg text-xs font-bold w-full shadow-lg shadow-blue-900/20"
                            >
                              Take Device
                            </button>
                          ) : (
                            <Link
                              to={ticketPath(t.id, { action: 'view' })}
                              className="bg-[#1E293B] hover:bg-[#334155] text-white transition px-4 py-1.5 rounded-lg text-xs font-bold w-full border border-[#334155] inline-block"
                            >
                              View
                            </Link>
                          )}
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-[#0B0F19]/80 border-b border-[#1E293B]">
                          <td colSpan={6} className="p-0">
                            <div className="px-5 py-4 border-l-2 border-purple-500/50" style={{ contentVisibility: 'auto' }}>
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-purple-300">
                                    Quick preview · Ticket #{t.id}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    Latest remark: {getLatestRemark(t) || '—'}
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
                              <div className="rounded-lg border border-[#1E293B] bg-[#0F172A]/60 p-3">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                  Previous Workstation support
                                </p>
                                {histState.loading && (
                                  <p className="text-xs text-slate-500">Loading support history…</p>
                                )}
                                {!histState.loading && !previous && (
                                  <p className="text-xs text-slate-500 italic">
                                    No previous support history available
                                  </p>
                                )}
                                {!histState.loading && previous && (
                                  <div className="text-xs space-y-1">
                                    <p className="text-slate-200">
                                      <span className="text-slate-500">Engineer:</span>{' '}
                                      <span className="font-semibold text-white">
                                        {previous.engineer_name || '—'}
                                      </span>
                                    </p>
                                    <p className="text-slate-400 font-mono text-[10px]">
                                      {previous.changed_at
                                        ? formatDateTime(previous.changed_at)
                                        : '—'}
                                    </p>
                                    <p className="text-slate-300 whitespace-pre-wrap break-words">
                                      {previous.action_note ||
                                        (previous.previous_status
                                          ? `${previous.previous_status} → ${previous.new_status || '—'}`
                                          : '—')}
                                    </p>
                                  </div>
                                )}
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

        {/* Hardware Lab — was filtered but never rendered */}
        {hwLab.length > 0 && (
          <div className="dark-card p-4">
            <h2 className="text-sm font-bold text-white mb-3">
              Hardware Lab ({hwLab.length})
            </h2>
            <p className="text-[10px] text-slate-500 mb-3">
              Devices in hardware lab / waiting for parts / sent to hardware
            </p>
            <div className="space-y-2">
              {hwLab.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-purple-900/40 bg-purple-950/20"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-blue-400 text-xs">#{t.id}</span>
                    <span className="text-white text-xs font-semibold ml-2">{t.user_name}</span>
                    <span className="text-slate-500 text-[10px] ml-2">{t.hw_type || 'Device'}</span>
                    <div className="text-[10px] text-purple-300 mt-0.5">
                      {t.status || t.action_required}
                      {t.lab_engineer ? ` · ${t.lab_engineer}` : ''}
                    </div>
                    {getLatestRemark(t) ? (
                      <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                        Remark: {getLatestRemark(t)}
                      </div>
                    ) : null}
                  </div>
                  <Link
                    to={ticketPath(t.id, { action: 'view' })}
                    className="h-8 px-3 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-white text-[11px] font-bold border border-[#334155] inline-flex items-center"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ready for pickup strip */}
        {ready.length > 0 && (
          <div className="dark-card p-4">
            <h2 className="text-sm font-bold text-white mb-3">Ready for Pickup ({ready.length})</h2>
            <div className="space-y-2">
              {ready.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-emerald-900/40 bg-emerald-950/20"
                >
                  <div>
                    <span className="font-mono font-bold text-blue-400 text-xs">#{t.id}</span>
                    <span className="text-white text-xs font-semibold ml-2">{t.user_name}</span>
                    <span className="text-slate-500 text-[10px] ml-2">{t.hw_type}</span>
                  </div>
                  <button
                    onClick={() => handOver(t.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold"
                  >
                    Hand Over (Close)
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <ConfirmDialog
        open={handoverId != null}
        mode="confirm"
        title="Confirm handover"
        message={`Hand over device for ticket #${handoverId}? This will mark the ticket as Resolved.`}
        confirmLabel="Hand over & resolve"
        cancelLabel="Cancel"
        tone="emerald"
        onCancel={() => setHandoverId(null)}
        onConfirm={confirmHandOver}
      />
    </>
  );
}

function Kpi({ label, value, border, valueClass }) {
  return (
    <div className={`dark-card p-4 border-l-2 ${border}`}>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">{label}</p>
      <h3 className={`text-xl font-bold ${valueClass || 'text-white'}`}>{value}</h3>
    </div>
  );
}
