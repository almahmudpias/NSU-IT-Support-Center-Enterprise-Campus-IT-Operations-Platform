import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { engineerApi } from '../lib/api';
import { ticketPath } from '../lib/ids';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import '../components/reports/reportPrint.css';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function fmt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function EngineerReportsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const defaults = defaultRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [pool, setPool] = useState('all');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);

  const load = useCallback(async () => {
    if (from && to && from > to) {
      showToast('warning', 'Invalid range', 'Start date must be before end date');
      return;
    }
    try {
      setLoading(true);
      const res = await engineerApi.report({ from, to, pool, status: status || undefined });
      if (res?.success === false) throw new Error(res.message || 'Report failed');
      setReport(res);
    } catch (e) {
      setReport(null);
      showToast('error', 'Report failed', e.message || 'Could not generate report');
    } finally {
      setLoading(false);
    }
  }, [from, to, pool, status, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const m = report?.metrics || {};
  const tickets = Array.isArray(report?.tickets) ? report.tickets : [];
  const byStatus = report?.byStatus || {};
  const statusRows = useMemo(
    () => Object.entries(byStatus).sort((a, b) => b[1] - a[1]),
    [byStatus]
  );

  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#0B0F19]">
      <header className="h-20 shrink-0 flex items-center justify-between gap-3 px-6 sm:px-8 bg-[#111827] border-b border-[#1F2937] print:hidden">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white tracking-tight">My Reports</h2>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            Personal operational report · {user?.fullName || 'Engineer'} only
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="h-9 px-3 rounded-lg border border-[#374151] text-xs font-bold text-slate-300 hover:bg-[#1F2937] disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={loading || !report}
            className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50 shadow-lg shadow-indigo-900/30"
          >
            Print / Save PDF
          </button>
        </div>
      </header>

      {/* Filters — screen only */}
      <div className="px-6 py-3 border-b border-[#1F2937] shrink-0 print:hidden bg-[#0B0F19]"><div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="dark-input mt-1 h-9 text-xs block"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="dark-input mt-1 h-9 text-xs block"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Pool</label>
          <select
            value={pool}
            onChange={(e) => setPool(e.target.value)}
            className="dark-input mt-1 h-9 text-xs font-bold block min-w-[160px]"
          >
            <option value="all">All permitted work</option>
            <option value="campus">Campus Support</option>
            <option value="workstation">Workstation Support</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="dark-input mt-1 h-9 text-xs font-bold block min-w-[140px]"
          >
            <option value="">Any status</option>
            <option value="open">Open</option>
            <option value="in progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="in diagnostics">In Diagnostics</option>
            <option value="ready for return">Ready for Return</option>
          </select>
        </div>
        <button
          type="button"
          onClick={load}
          className="h-9 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
        >
          Generate
        </button>
        </div>
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto custom-scroll p-6 print:p-0 print:overflow-visible">
        {loading && (
          <p className="text-xs text-slate-500 print:hidden">Generating personal report…</p>
        )}
        {!loading && !report && (
          <p className="text-xs text-slate-500 italic print:hidden">No report data</p>
        )}

        {report && (
          <div id="engineer-printable-report" className="space-y-6 max-w-6xl mx-auto print:max-w-none">
            {/* Print header */}
            <div className="rounded-2xl border border-[#1F2937] bg-[#111827]/90 p-6 print:border-0 print:rounded-none print:bg-white print:text-black">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400 print:text-slate-600">
                North South University · IT Support Center
              </p>
              <h1 className="text-2xl font-black text-white mt-1 print:text-black">
                Engineer Personal Performance Report
              </h1>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300 print:text-slate-700">
                <p>
                  <span className="text-slate-500 print:text-slate-500">Engineer:</span>{' '}
                  <strong>{report.engineer?.fullName || user?.fullName}</strong>
                  {report.engineer?.username ? ` (@${report.engineer.username})` : ''}
                </p>
                <p>
                  <span className="text-slate-500">Role:</span> {report.engineer?.role || 'Engineer'}
                </p>
                <p>
                  <span className="text-slate-500">Period:</span>{' '}
                  {fmt(report.period?.from)} → {fmt(report.period?.to)}
                </p>
                <p>
                  <span className="text-slate-500">Generated:</span> {fmt(report.generatedAt)}
                </p>
                <p>
                  <span className="text-slate-500">Pool filter:</span>{' '}
                  {pool === 'campus'
                    ? 'Campus Support'
                    : pool === 'workstation'
                      ? 'Workstation Support'
                      : 'All'}
                </p>
              </div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:grid-cols-4">
              {[
                { label: 'Current assigned', value: m.currentAssigned, sub: 'Open workload' },
                { label: 'Pending now', value: m.currentPending, sub: 'Awaiting start' },
                { label: 'In progress now', value: m.currentInProgress, sub: 'Active handling' },
                { label: 'Completed in period', value: m.periodCompleted, sub: 'Resolved in range' },
                { label: 'Period tickets', value: m.periodTotal, sub: 'Touched in range' },
                { label: 'Campus (period)', value: m.periodCampus, sub: 'Field support' },
                { label: 'Workstation (period)', value: m.periodWorkstation, sub: 'Device queue' },
                {
                  label: 'Avg resolution (h)',
                  value: m.avgResolutionHours != null ? m.avgResolutionHours : '—',
                  sub:
                    m.durationsSampleSize > 0
                      ? `n=${m.durationsSampleSize} with timestamps`
                      : 'Insufficient timestamps',
                },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-xl border border-[#1F2937] bg-[#111827]/80 p-3 print:border-slate-300 print:bg-white"
                >
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{k.label}</p>
                  <p className="text-2xl font-black text-white mt-1 print:text-black">{k.value}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{k.sub}</p>
                </div>
              ))}
            </div>

            {m.handedOverInPeriod > 0 && (
              <p className="text-xs text-slate-400">
                Handed-over completions in period: <strong className="text-emerald-400">{m.handedOverInPeriod}</strong>
                {' '}(counted as Resolved when status is Resolved + user_status Handed Over)
              </p>
            )}

            {/* Status breakdown */}
            <div className="rounded-2xl border border-[#1F2937] bg-[#111827]/80 p-5 print:border-slate-300 print:bg-white">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                Workload by status (period)
              </h3>
              {statusRows.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No tickets in period</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {statusRows.map(([name, count]) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#374151] text-xs print:border-slate-300"
                    >
                      <span className="text-slate-300 print:text-slate-700 font-semibold">{name}</span>
                      <span className="font-mono font-bold text-cyan-400 print:text-black">{count}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Detail table */}
            <div className="rounded-2xl border border-[#1F2937] bg-[#111827]/80 overflow-hidden print:border-slate-300 print:bg-white">
              <div className="px-5 py-3 border-b border-[#1F2937] print:border-slate-200">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Ticket detail ({tickets.length}
                  {m.periodTotal > tickets.length ? ` of ${m.periodTotal}` : ''})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[900px]">
                  <thead>
                    <tr className="text-[9px] uppercase tracking-widest text-slate-500 border-b border-[#1F2937] print:border-slate-300">
                      <th className="px-4 py-2">ID</th>
                      <th className="px-4 py-2">Pool</th>
                      <th className="px-4 py-2">Requester</th>
                      <th className="px-4 py-2">Category</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Priority</th>
                      <th className="px-4 py-2">Created</th>
                      <th className="px-4 py-2">Resolved</th>
                      <th className="px-4 py-2 print:hidden">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-500 italic">
                          No tickets in this period / filter
                        </td>
                      </tr>
                    )}
                    {tickets.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-[#1F2937]/50 print:border-slate-200"
                      >
                        <td className="px-4 py-2 font-mono font-bold text-cyan-400 print:text-black">
                          #{t.id}
                        </td>
                        <td className="px-4 py-2 text-slate-400">
                          {t.pool === 'workstation' ? 'Workstation' : 'Campus'}
                        </td>
                        <td className="px-4 py-2 text-white print:text-black font-semibold">
                          {t.user_name || '—'}
                        </td>
                        <td className="px-4 py-2 text-slate-400">{t.issue_category || '—'}</td>
                        <td className="px-4 py-2 text-slate-300 print:text-black">{t.status}</td>
                        <td className="px-4 py-2 text-slate-400">{t.priority || 'Normal'}</td>
                        <td className="px-4 py-2 font-mono text-[10px] text-slate-500">
                          {fmt(t.created_at)}
                        </td>
                        <td className="px-4 py-2 font-mono text-[10px] text-slate-500">
                          {t.resolved_at
                            ? fmt(t.resolved_at)
                            : t.status === 'Resolved'
                              ? `${fmt(t.updated_at)} (legacy)`
                              : '—'}
                        </td>
                        <td className="px-4 py-2 print:hidden">
                          <Link
                            to={ticketPath(t.id)}
                            className="text-indigo-400 font-bold hover:underline text-[10px]"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[10px] text-slate-600 text-center print:text-slate-500 pb-4">
              NSU IT Support Center · Confidential operational report · Generated for authorized engineer use only
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
