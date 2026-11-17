import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { engineerApi } from '../lib/api';
import { useRealtimeSync } from '../lib/realtime';
import { ticketPath } from '../lib/ids';
import { useToast } from '../components/Toast';

function timeAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

export default function CompletedWork() {
  const { showToast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 40;

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await engineerApi.myWork({
        view: 'completed',
        q: q.trim(),
        page,
        limit,
      });
      let rows = Array.isArray(res?.tickets) ? res.tickets : [];
      if (category) {
        rows = rows.filter(
          (t) => String(t.issue_category || '').toLowerCase() === category.toLowerCase()
        );
      }
      setTickets(rows);
      setTotal(res?.total || rows.length);
    } catch (e) {
      if (!silent) {
        setTickets([]);
        setTotal(0);
        showToast('error', 'Load failed', e.message || 'Could not load completed work');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [q, page, category, showToast]);

  useEffect(() => {
    load(false);
  }, [load]);

  useRealtimeSync(() => { load(true); }, { enabled: true, debounceMs: 1500 });

  useEffect(() => {
    setPage(1);
  }, [q, category]);

  const categories = Array.from(
    new Set(tickets.map((t) => t.issue_category).filter(Boolean))
  ).sort();

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      <header className="px-6 py-5 border-b border-[#1F2937] bg-[#0B0F19]/90 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">Completed Work</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Historical Campus Support and Workstation jobs you handled · {total} records
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="dark-input py-2 text-xs font-bold min-w-[140px]"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ID, user, category…"
            className="dark-input py-2 w-56 text-xs"
          />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto custom-scroll p-6">
        <div className="rounded-2xl border border-[#1F2937] bg-[#111827]/80 overflow-hidden">
          <table className="w-full text-left text-xs min-w-[860px]">
            <thead>
              <tr className="text-[9px] uppercase tracking-widest text-slate-500 border-b border-[#1F2937]">
                <th className="px-5 py-3 font-bold">ID</th>
                <th className="px-5 py-3 font-bold">Requester</th>
                <th className="px-5 py-3 font-bold">Category</th>
                <th className="px-5 py-3 font-bold">Issue / resolution notes</th>
                <th className="px-5 py-3 font-bold">Device</th>
                <th className="px-5 py-3 font-bold">Completed</th>
                <th className="px-5 py-3 font-bold text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && tickets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500 italic">
                    No completed work yet
                  </td>
                </tr>
              )}
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-[#1F2937]/50 hover:bg-[#1F2937]/30">
                  <td className="px-5 py-3 font-mono font-bold text-emerald-400">#{t.id}</td>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-white">{t.user_name}</p>
                    <p className="text-[10px] text-slate-500">{t.department || '—'}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-400">{t.issue_category || '—'}</td>
                  <td className="px-5 py-3 max-w-[240px]">
                    <p className="text-slate-200 line-clamp-2">{t.description || '—'}</p>
                    {t.it_engineer_remarks ? (
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                        {String(t.it_engineer_remarks).slice(-180)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-[10px]">
                    {t.hw_type || t.device_brand || '—'}
                    {t.serial_number ? (
                      <span className="block font-mono text-slate-500">{t.serial_number}</span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-slate-500 font-mono text-[10px]">
                    <div>{fmt(t.resolved_at || t.updated_at)}</div>
                    <div className="text-slate-600">{timeAgo(t.resolved_at || t.updated_at)}</div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={ticketPath(t.id, { action: 'view' })}
                      className="text-indigo-400 font-bold hover:underline text-[10px]"
                    >
                      View / notes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-[#1F2937] flex items-center justify-between">
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
    </>
  );
}
