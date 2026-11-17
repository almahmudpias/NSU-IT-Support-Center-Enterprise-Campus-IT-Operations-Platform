import { useCallback, useEffect, useState } from 'react';
import { auditApi } from '../lib/api';
import { useToast } from '../components/Toast';
import { formatDateTime } from '../lib/datetime';

export default function AuditLogsPage() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await auditApi.list({
        limit,
        offset,
        q: q.trim() || undefined,
        action: action.trim() || undefined,
        entity_type: entityType.trim() || undefined,
      });
      setLogs(Array.isArray(res?.logs) ? res.logs : []);
    } catch (e) {
      showToast('error', 'Audit log failed', e.message || 'Could not load logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [offset, q, action, entityType, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  function onSearch(e) {
    e.preventDefault();
    setOffset(0);
    load();
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="px-6 py-5 border-b border-[#1F2937] shrink-0">
        <h1 className="text-lg font-bold text-white tracking-tight">Audit Log</h1>
        <p className="text-[11px] text-slate-500 mt-0.5">
          System activity — logins, ticket changes, claims, approvals
        </p>
      </header>

      <div className="px-6 py-4 border-b border-[#1F2937]/80 shrink-0">
        <form onSubmit={onSearch} className="flex flex-wrap gap-2 items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actor, action, entity…"
            className="dark-input text-xs w-full sm:w-64"
          />
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Action (e.g. ticket.update)"
            className="dark-input text-xs w-full sm:w-44"
          />
          <select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setOffset(0);
            }}
            className="dark-input text-xs w-full sm:w-36"
          >
            <option value="">All entities</option>
            <option value="ticket">Ticket</option>
            <option value="staff_user">Staff user</option>
            <option value="event">Event</option>
          </select>
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
          >
            Filter
          </button>
          <button
            type="button"
            onClick={() => {
              setQ('');
              setAction('');
              setEntityType('');
              setOffset(0);
            }}
            className="px-3 py-2 rounded-lg bg-[#1F2937] text-slate-300 text-xs font-semibold border border-[#374151]"
          >
            Reset
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-auto custom-scroll">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead className="sticky top-0 bg-[#0B0F19] z-10 border-b border-[#1F2937]">
            <tr className="text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2.5 font-bold">When</th>
              <th className="px-4 py-2.5 font-bold">Actor</th>
              <th className="px-4 py-2.5 font-bold">Action</th>
              <th className="px-4 py-2.5 font-bold">Entity</th>
              <th className="px-4 py-2.5 font-bold">Details</th>
              <th className="px-4 py-2.5 font-bold">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F2937]/60">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-slate-500 text-sm italic">
                  Loading…
                </td>
              </tr>
            ) : !logs.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-slate-500 text-sm italic">
                  No audit entries yet
                </td>
              </tr>
            ) : (
              logs.map((row) => (
                <tr key={row.id} className="hover:bg-indigo-500/[0.05] even:bg-[#0B0F19]/35">
                  <td className="px-4 py-2.5 text-[11px] text-slate-400 whitespace-nowrap align-top">
                    {formatDateTime(row.created_at)}
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <div className="text-xs font-semibold text-slate-200">{row.actor_name || '—'}</div>
                    <div className="text-[10px] text-slate-500">{row.actor_role || ''}</div>
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0B0F19] border border-[#1F2937] text-slate-300">
                      {row.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-300 align-top whitespace-nowrap">
                    {row.entity_type || '—'}
                    {row.entity_id != null ? (
                      <span className="text-indigo-400 font-mono font-bold ml-1">#{row.entity_id}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-slate-400 align-top max-w-[280px]">
                    <pre className="whitespace-pre-wrap break-words font-sans leading-snug">
                      {row.details
                        ? typeof row.details === 'string'
                          ? row.details
                          : row.details.summary ||
                            row.details.note ||
                            row.details.message ||
                            JSON.stringify(row.details)
                        : '—'}
                    </pre>
                  </td>
                  <td className="px-4 py-2.5 text-[10px] text-slate-500 font-mono align-top">
                    {row.ip || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 border-t border-[#1F2937] flex items-center justify-between shrink-0">
        <button
          type="button"
          disabled={offset <= 0 || loading}
          onClick={() => setOffset((o) => Math.max(0, o - limit))}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1F2937] text-slate-300 border border-[#374151] disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-[10px] text-slate-500">Offset {offset}</span>
        <button
          type="button"
          disabled={logs.length < limit || loading}
          onClick={() => setOffset((o) => o + limit)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1F2937] text-slate-300 border border-[#374151] disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
