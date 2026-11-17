import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { engineerApi, ticketsApi } from '../lib/api';
import { ticketPath } from '../lib/ids';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { formatDateTime } from '../lib/datetime';
import { useRealtimeSync } from '../lib/realtime';

function timeAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (Number.isNaN(s) || s < 0) return '—';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function statusTone(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('resolved') || s.includes('ready')) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (s.includes('waiting') || s.includes('parts')) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (s.includes('hardware') || s.includes('diagnostic')) return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
  if (s.includes('progress') || s.includes('support')) return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
  return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
}

export default function MyLabWorkPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [previewId, setPreviewId] = useState(null);
  const hasLoadedOnce = useRef(false);
  const loadSeq = useRef(0);

  const meNames = useMemo(
    () =>
      [user?.fullName, user?.username, user?.full_name]
        .filter(Boolean)
        .map((s) => String(s).trim().toLowerCase()),
    [user]
  );

  // Background refresh: never flash full-page loading after the first successful load
  const load = useCallback(
    async (silent = true) => {
      const seq = ++loadSeq.current;
      const isInitial = !hasLoadedOnce.current;
      try {
        if (isInitial) setLoading(true);
        else if (!silent) setSyncing(true);
        const res = await engineerApi.myLabWork();
        if (seq !== loadSeq.current) return;
        const list = Array.isArray(res?.tickets) ? res.tickets : [];
        setTickets((prev) => {
          if (
            prev.length === list.length &&
            prev.every(
              (t, i) =>
                t.id === list[i]?.id &&
                t.status === list[i]?.status &&
                t.lab_engineer === list[i]?.lab_engineer &&
                t.assigned_engineer === list[i]?.assigned_engineer &&
                t.action_required === list[i]?.action_required &&
                t.updated_at === list[i]?.updated_at
            )
          ) {
            return prev;
          }
          return list;
        });
        setSummary(res?.summary || null);
        setLoadError(null);
        hasLoadedOnce.current = true;
      } catch (e) {
        if (seq !== loadSeq.current) return;
        const msg = e?.message || 'Could not load lab work';
        if (isInitial) {
          setLoadError(msg);
          showToast('error', 'My Lab Work', msg);
        }
      } finally {
        if (seq === loadSeq.current) {
          setLoading(false);
          setSyncing(false);
        }
      }
    },
    [showToast]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  useRealtimeSync(() => load(true), { enabled: true, debounceMs: 1800 });

  function ownership(t) {
    const lab = String(t.lab_engineer || '').trim().toLowerCase();
    const asg = String(t.assigned_engineer || '').trim().toLowerCase();
    const claimed = lab && meNames.includes(lab);
    const assigned = asg && meNames.includes(asg);
    if (claimed && assigned) return 'Assigned & claimed';
    if (claimed) return 'Claimed';
    if (assigned) return 'Assigned';
    return 'Mine';
  }

  const filtered = useMemo(() => {
    let rows = tickets.filter((t) => String(t.status || '').toLowerCase() !== 'resolved');
    if (filter === 'claimed') {
      rows = rows.filter((t) => meNames.includes(String(t.lab_engineer || '').trim().toLowerCase()));
    } else if (filter === 'assigned') {
      rows = rows.filter((t) => meNames.includes(String(t.assigned_engineer || '').trim().toLowerCase()));
    } else if (filter === 'progress') {
      rows = rows.filter((t) => {
        const s = String(t.status || '').toLowerCase();
        return s.includes('progress') || s.includes('diagnostic') || s === 'support workstation';
      });
    } else if (filter === 'waiting') {
      rows = rows.filter((t) => {
        const s = String(t.status || '').toLowerCase();
        return s.includes('waiting') || s.includes('parts');
      });
    } else if (filter === 'ready') {
      rows = rows.filter((t) => {
        const s = String(t.status || '').toLowerCase();
        const ar = String(t.action_required || '').toLowerCase();
        return ar.includes('ready') || s.includes('ready');
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (t) =>
          String(t.id).includes(q) ||
          (t.user_name || '').toLowerCase().includes(q) ||
          (t.department || '').toLowerCase().includes(q) ||
          (t.hw_type || '').toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [tickets, filter, search, meNames]);

  const kpis = summary || {
    total: filtered.length,
    assigned: 0,
    claimed: 0,
    inProgress: 0,
    waiting: 0,
    readyReturn: 0,
  };

  return (
    <div className="flex flex-col h-full bg-[#0B0F19] overflow-hidden">
      <header className="shrink-0 px-5 md:px-8 py-5 border-b border-[#1F2937] bg-gradient-to-r from-[#111827] to-[#0B0F19]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">My Lab Work</h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Lab and workstation tasks assigned to you or claimed by you. This is your personal workload — not the
              shared Support Workstation queue.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/support-workstation"
              className="h-9 px-3 rounded-lg border border-[#374151] text-slate-300 text-xs font-bold hover:bg-[#1F2937] flex items-center"
            >
              Open Workstation pool
            </Link>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={syncing}
              className="h-9 px-3 rounded-lg bg-[#1F2937] border border-[#374151] text-white text-xs font-bold hover:bg-[#374151] disabled:opacity-60"
            >
              {syncing ? 'Syncing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scroll p-4 md:p-6 space-y-5">
        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'My lab work', value: kpis.total, tone: 'text-cyan-300' },
            { label: 'Assigned', value: kpis.assigned, tone: 'text-indigo-300' },
            { label: 'Claimed', value: kpis.claimed, tone: 'text-violet-300' },
            { label: 'In progress', value: kpis.inProgress, tone: 'text-amber-300' },
            { label: 'Waiting', value: kpis.waiting, tone: 'text-rose-300' },
            { label: 'Ready return', value: kpis.readyReturn, tone: 'text-emerald-300' },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-xl border border-[#1F2937] bg-[#111827]/90 px-3 py-3 border-l-2 border-l-cyan-500/50"
            >
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{k.label}</p>
              <p className={`text-2xl font-black tabular-nums mt-1 ${k.tone}`}>{loading ? '—' : k.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'assigned', label: 'Assigned to me' },
            { id: 'claimed', label: 'Claimed by me' },
            { id: 'progress', label: 'In progress' },
            { id: 'waiting', label: 'Waiting' },
            { id: 'ready', label: 'Ready for return' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`h-8 px-3 rounded-lg text-[11px] font-bold border transition ${
                filter === f.id
                  ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-200'
                  : 'border-[#374151] text-slate-400 hover:bg-[#1F2937]'
              }`}
            >
              {f.label}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search id, requester, device…"
            className="ml-auto h-8 min-w-[180px] flex-1 max-w-xs rounded-lg bg-[#0B0F19] border border-[#374151] px-3 text-xs text-white placeholder:text-slate-600"
          />
        </div>

        {loadError && (
          <div className="rounded-xl border border-rose-500/35 bg-rose-950/25 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-rose-300">Could not load My Lab Work</p>
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

        {loading && !loadError && (
          <p className="text-xs text-slate-500 py-8 text-center">Loading your lab tasks…</p>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <div className="rounded-2xl border border-[#1F2937] bg-[#111827]/60 py-16 text-center px-6">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-300 text-xl mb-4">
              ✓
            </div>
            <p className="text-sm font-bold text-white">No lab tasks right now</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Nothing is currently assigned to you or claimed by you in the lab / workstation workflow. Claim work from
              the Support Workstation pool when items are available.
            </p>
            <Link
              to="/support-workstation"
              className="inline-flex mt-4 h-9 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold items-center"
            >
              Browse Workstation pool
            </Link>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <ul className="space-y-2">
            {filtered.map((t) => {
              const open = previewId === t.id;
              const own = ownership(t);
              return (
                <li
                  key={t.id}
                  className="rounded-xl border border-[#1F2937] bg-[#111827]/80 hover:border-cyan-500/30 transition overflow-hidden"
                >
                  <div className="px-4 py-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setPreviewId(open ? null : t.id)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-cyan-400">#{t.id}</span>
                        <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${statusTone(t.status)}`}>
                          {t.status || t.action_required || '—'}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-300 border border-slate-500/30">
                          {own}
                        </span>
                        {t.priority && (
                          <span className="text-[10px] text-slate-500">{t.priority}</span>
                        )}
                        {t.issue_category && (
                          <span className="text-[10px] text-slate-500">{t.issue_category}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white mt-1 truncate">
                        {t.user_name || 'Requester'}
                        {t.department ? ` · ${t.department}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {[t.hw_type, t.device_brand, t.serial_number || t.asset_tag].filter(Boolean).join(' · ') ||
                          t.description ||
                          'Lab / workstation task'}
                        {' · '}
                        {timeAgo(t.updated_at || t.created_at)}
                      </p>
                    </button>
                    <Link
                      to={ticketPath(t.id, { action: 'view' })}
                      className="h-9 px-3 rounded-lg border border-cyan-500/35 text-cyan-200 text-xs font-bold hover:bg-cyan-500/10 shrink-0 flex items-center"
                    >
                      Open
                    </Link>
                  </div>
                  {open && (
                    <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-[#1F2937] bg-[#0B0F19]/50 text-xs">
                      <div className="pt-3">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Location</p>
                        <p className="text-slate-200">
                          {[t.building, t.room_location, t.extension].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      <div className="pt-3">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Device</p>
                        <p className="text-slate-200">
                          {[t.hw_type, t.device_brand, t.serial_number || t.asset_tag].filter(Boolean).join(' · ') ||
                            '—'}
                        </p>
                      </div>
                      <div className="pt-3">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Ownership</p>
                        <p className="text-slate-200">
                          Lab: {t.lab_engineer || '—'} · Assigned: {t.assigned_engineer || '—'}
                        </p>
                        <p className="text-slate-500 text-[10px] mt-0.5">
                          Updated {t.updated_at ? formatDateTime(t.updated_at) : '—'}
                        </p>
                      </div>
                      {t.description && (
                        <div className="pt-1 sm:col-span-3">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Description</p>
                          <p className="text-slate-300 whitespace-pre-wrap">{t.description}</p>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
