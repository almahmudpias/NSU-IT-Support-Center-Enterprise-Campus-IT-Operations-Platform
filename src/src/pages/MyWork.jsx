import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { engineerApi } from '../lib/api';
import { ticketPath } from '../lib/ids';
import { useToast } from '../components/Toast';
import { useRealtimeSync } from '../lib/realtime';

const VIEWS = [
  { id: 'all', label: 'All My Work' },
  { id: 'active', label: 'Active' },
  { id: 'campus', label: 'Campus Support' },
  { id: 'workstation', label: 'Workstation Support' },
  { id: 'pending', label: 'Pending' },
  { id: 'progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
];

function timeAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function isWs(t) {
  const st = String(t.status || '').toLowerCase();
  const ar = String(t.action_required || '').toLowerCase();
  return (
    st.includes('hardware') ||
    st.includes('diagnostic') ||
    st.includes('lab') ||
    st === 'support workstation' ||
    st === 'brought to helpdesk' ||
    st === 'ready for return' ||
    st === 'waiting for parts' ||
    ar.includes('hardware') ||
    ar === 'support workstation' ||
    ar === 'under diagnostics' ||
    ar === 'ready for return'
  );
}

export default function MyWorkPage() {
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'all';
  const [q, setQ] = useState(params.get('q') || '');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [tickets, setTickets] = useState([]);
  const [previewId, setPreviewId] = useState(null);
  const [sort, setSort] = useState('updated_desc');
  const limit = 40;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await engineerApi.myWork({ view, q: q.trim(), page, limit });
      setTickets(Array.isArray(res?.tickets) ? res.tickets : []);
      setTotal(res?.total || 0);
    } catch (e) {
      setTickets([]);
      setTotal(0);
      showToast('error', 'My Work failed', e.message || 'Could not load');
    } finally {
      setLoading(false);
    }
  }, [view, q, page, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeSync(() => { load(); }, { enabled: true, debounceMs: 900 });

  useEffect(() => {
    setPage(1);
    setPreviewId(null);
  }, [view, q, sort]);

  function setView(id) {
    const next = new URLSearchParams(params);
    next.set('view', id);
    setParams(next, { replace: true });
  }

  const sorted = useMemo(() => {
    const list = [...tickets];
    if (sort === 'updated_desc') {
      list.sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
    } else if (sort === 'created_desc') {
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sort === 'id_desc') {
      list.sort((a, b) => Number(b.id) - Number(a.id));
    } else if (sort === 'priority') {
      const rank = (p) => (String(p || '').toLowerCase() === 'high' || String(p || '').toLowerCase() === 'critical' ? 0 : 1);
      list.sort((a, b) => rank(a.priority) - rank(b.priority));
    }
    return list;
  }, [tickets, sort]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const subtitle = useMemo(() => {
    const v = VIEWS.find((x) => x.id === view);
    return v ? v.label : 'My Work';
  }, [view]);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#0B0F19]">
      {/* Top bar — aligned with Admin tickets pattern */}
      <header className="h-20 shrink-0 flex items-center justify-between gap-3 px-6 sm:px-8 bg-[#111827] border-b border-[#1F2937]">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white tracking-tight">My Work</h2>
          <p className="text-xs text-gray-400 font-medium mt-0.5 truncate">
            {subtitle} · {total} record{total === 1 ? '' : 's'} · authorized workload only
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="dark-input h-9 py-1.5 text-[11px] font-bold min-w-[7.5rem] bg-[#0B0F19]"
            title="Sort"
          >
            <option value="updated_desc">Updated</option>
            <option value="created_desc">Created</option>
            <option value="priority">Priority</option>
            <option value="id_desc">Ticket ID</option>
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ID, user, category, location…"
            className="dark-input h-9 py-1.5 w-44 sm:w-56 text-xs bg-[#0B0F19]"
          />
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="h-9 w-9 rounded-lg bg-[#1F2937] border border-[#374151] text-gray-400 hover:text-white flex items-center justify-center disabled:opacity-40"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </header>

      <div className="px-6 pt-3 pb-2 flex flex-wrap gap-2 shrink-0 border-b border-[#1F2937]/60">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${
              view === v.id
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'border-[#1F2937] text-slate-400 hover:text-white'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto custom-scroll px-6 py-4">
        <div className="rounded-2xl border border-[#1F2937] bg-[#111827]/80 overflow-hidden">
          <div className="overflow-x-auto custom-scroll">
            <table className="w-full text-left text-xs min-w-[960px]">
              <thead>
                <tr className="text-[9px] uppercase tracking-widest text-slate-500 border-b border-[#1F2937]">
                  <th className="px-4 py-3 font-bold">ID</th>
                  <th className="px-4 py-3 font-bold">Pool</th>
                  <th className="px-4 py-3 font-bold">Requester / Dept</th>
                  <th className="px-4 py-3 font-bold">Location</th>
                  <th className="px-4 py-3 font-bold">Issue</th>
                  <th className="px-4 py-3 font-bold">Priority</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Updated</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      Loading your work…
                    </td>
                  </tr>
                )}
                {!loading && sorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500 italic">
                      No tickets in this view
                    </td>
                  </tr>
                )}
                {!loading &&
                  sorted.map((t) => {
                    const open = previewId === t.id;
                    return (
                      <FragmentRow
                        key={t.id}
                        t={t}
                        open={open}
                        onToggle={() => setPreviewId(open ? null : t.id)}
                      />
                    );
                  })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-[#1F2937] flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-slate-700 text-[10px] font-bold text-slate-300 disabled:opacity-30"
              >
                Prev
              </button>
              <span className="text-[10px] text-slate-500 font-mono">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded-lg border border-slate-700 text-[10px] font-bold text-slate-300 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function FragmentRow({ t, open, onToggle }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-b border-[#1F2937]/60 transition cursor-pointer table-row-hover ${
          open ? 'bg-indigo-500/5' : 'hover:bg-[#1F2937]/30'
        }`}
      >
        <td className="px-4 py-3 font-mono font-bold text-cyan-400">#{t.id}</td>
        <td className="px-4 py-3">
          <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
            {isWs(t) ? 'Workstation' : 'Campus'}
          </span>
        </td>
        <td className="px-4 py-3">
          <p className="font-semibold text-white truncate max-w-[140px]">{t.user_name || '—'}</p>
          <p className="text-[10px] text-slate-500 truncate max-w-[140px]">
            {t.department || t.issue_category || '—'}
          </p>
        </td>
        <td className="px-4 py-3 text-slate-400">
          {[t.building, t.room_location].filter(Boolean).join(' · ') || '—'}
        </td>
        <td className="px-4 py-3">
          <p className="text-slate-200 truncate max-w-[200px]">{t.description || '—'}</p>
          <p className="text-[10px] text-slate-500">{t.issue_category || ''}</p>
        </td>
        <td className="px-4 py-3">
          <span
            className={`text-[9px] font-bold uppercase ${
              String(t.priority || '').toLowerCase() === 'high' ||
              String(t.priority || '').toLowerCase() === 'critical'
                ? 'text-rose-400'
                : 'text-slate-400'
            }`}
          >
            {t.priority || 'Normal'}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex min-w-[6.5rem] justify-center px-2 py-1 rounded-md text-[9px] font-bold uppercase border border-[#374151] text-slate-300 bg-[#0B0F19]">
            {t.action_required === 'Ready for Return' ? 'Ready return' : t.status || '—'}
          </span>
        </td>
        <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">
          {timeAgo(t.updated_at || t.created_at)}
        </td>
      </tr>
      {open && (
        <tr className="border-b border-[#1F2937] bg-[#0B0F19]/80">
          <td colSpan={8} className="p-0">
            <div className="px-5 py-4 border-l-2 border-indigo-500/50 bg-[#111827]/50">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                    Quick preview · Ticket #{t.id}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click row again to collapse · Full view opens the complete ticket workspace
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Requester</p>
                  <p className="text-white font-semibold mt-0.5">{t.user_name || '—'}</p>
                  <p className="text-slate-500 text-[10px]">{t.department || '—'} · Ext {t.extension || '—'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Assignment</p>
                  {t.assigned_engineer ? (
                    <p className="text-slate-200 mt-0.5">Support: {t.assigned_engineer}</p>
                  ) : (
                    <p className="text-slate-500 mt-0.5 text-[10px]">Support: unassigned</p>
                  )}
                  {t.lab_engineer ? (
                    <p className="text-slate-500 text-[10px]">Lab: {t.lab_engineer}</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Device</p>
                  <p className="text-slate-200 mt-0.5">
                    {[t.hw_type, t.device_brand, t.serial_number].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Timestamps</p>
                  <p className="text-slate-400 font-mono text-[10px] mt-0.5">
                    Created {timeAgo(t.created_at)} · Updated {timeAgo(t.updated_at)}
                  </p>
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Issue description</p>
                  <p className="text-slate-300 mt-1 whitespace-pre-wrap break-words">{t.description || '—'}</p>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
