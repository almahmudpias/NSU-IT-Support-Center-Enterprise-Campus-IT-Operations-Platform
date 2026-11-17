import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ticketPath } from '../../lib/ids';
import { primaryEngineer, ticketWorkspace } from './reportUtils';

function cellValue(t, key) {
  if (key === 'id') return `#${t.id}`;
  if (key === 'engineer') return primaryEngineer(t);
  if (key === 'workspace') {
    const w = ticketWorkspace(t);
    return w === '6004' ? 'Support Workstation' : 'Campus Support';
  }
  if (key === 'created_at' || key === 'updated_at' || key === 'resolved_at') {
    const raw = t[key];
    if (!raw) return '—';
    try {
      return new Date(raw).toLocaleString();
    } catch {
      return '—';
    }
  }
  if (key === 'description') return t.description || '—';
  return t[key] != null && t[key] !== '' ? String(t[key]) : '—';
}

export default function ReportTable({
  groups,
  columns,
  loading,
  error,
  page,
  pageSize,
  totalRows,
  onPageChange,
}) {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const rangeStart = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalRows);

  if (loading) {
    return (
      <div className="border border-[#1F2937] bg-[#111827] px-4 py-16 text-center text-sm text-slate-500">
        Building report…
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-[#1F2937] bg-[#111827] px-4 py-12 text-center">
        <p className="text-sm text-rose-400">{error}</p>
      </div>
    );
  }

  if (totalRows === 0) {
    return (
      <div className="border border-[#1F2937] bg-[#111827] px-4 py-16 text-center text-sm text-slate-500 italic">
        No tickets match the current filters.
      </div>
    );
  }

  return (
    <div className="border border-[#1F2937] bg-[#111827] overflow-hidden">
      <div className="overflow-x-auto custom-scroll">
        <table className="w-full text-left text-xs min-w-[720px]">
          <thead>
            <tr className="text-[9px] uppercase tracking-widest text-slate-500 border-b border-[#1F2937] bg-[#0B0F19]/80">
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-2.5 font-bold whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.key}>
                {g.label != null && (
                  <tr className="bg-[#0B0F19]/60">
                    <td
                      colSpan={columns.length}
                      className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-indigo-400 border-b border-[#1F2937]"
                    >
                      {g.label}
                      <span className="ml-2 text-slate-600 font-mono normal-case tracking-normal">
                        {g.tickets.length} ticket{g.tickets.length === 1 ? '' : 's'}
                      </span>
                    </td>
                  </tr>
                )}
                {g.tickets.map((t) => (
                  <tr key={t.id} className="border-b border-[#1F2937]/50 hover:bg-[#1F2937]/25">
                    {columns.map((c) => (
                      <td key={c.key} className="px-3 py-2.5 align-middle">
                        {c.key === 'id' ? (
                          <Link
                            to={ticketPath(t.id)}
                            className="font-mono font-bold text-indigo-400 hover:text-indigo-300"
                          >
                            {cellValue(t, c.key)}
                          </Link>
                        ) : c.key === 'description' ? (
                          <span className="text-slate-400 max-w-[220px] truncate block" title={t.description || ''}>
                            {cellValue(t, c.key)}
                          </span>
                        ) : c.key === 'status' ? (
                          <span className="text-slate-300">{cellValue(t, c.key)}</span>
                        ) : c.key === 'user_name' ? (
                          <span className="text-white font-medium">{cellValue(t, c.key)}</span>
                        ) : (
                          <span className="text-slate-400">{cellValue(t, c.key)}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1F2937] px-3 py-2.5 text-[11px] text-slate-500">
        <span>
          Showing <span className="text-slate-300">{rangeStart}–{rangeEnd}</span> of{' '}
          <span className="text-slate-300">{totalRows.toLocaleString()}</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="h-8 px-3 rounded-lg border border-[#374151] text-slate-400 hover:text-white disabled:opacity-30"
          >
            Prev
          </button>
          <span className="px-2 font-mono text-slate-400">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="h-8 px-3 rounded-lg border border-[#374151] text-slate-400 hover:text-white disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
