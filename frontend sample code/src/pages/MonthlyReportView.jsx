import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { reportsApi } from '../lib/api';
import { ticketPath, eventPath } from '../lib/ids';
import { useAuth } from '../lib/auth';
import { isAdmin } from '../lib/rbac';
import { useToast } from '../components/Toast';
import { formatDateTime } from '../lib/datetime';
import '../components/reports/reportPrint.css';

const TICKET_PAGE = 12;

export default function MonthlyReportView() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [params] = useSearchParams();
  const now = new Date();
  const year = Number(params.get('year')) || now.getFullYear();
  const month = Number(params.get('month')) || now.getMonth() + 1;
  const engineerQ = params.get('engineer') || '';
  const autoPrint = params.get('print') === '1';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ticketPage, setTicketPage] = useState(1);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const q = { year, month };
      if (engineerQ && isAdmin(user)) q.engineer = engineerQ;
      const res = await reportsApi.monthly(q);
      if (res?.success === false) throw new Error(res.message || 'Failed');
      setData(res);
      setTicketPage(1);
    } catch (e) {
      setData(null);
      showToast('error', 'Report failed', e.message || 'Could not load monthly report');
    } finally {
      setLoading(false);
    }
  }, [year, month, engineerQ, user, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (autoPrint && !loading && data) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [autoPrint, loading, data]);

  const summary = data?.summary || {};
  const tickets = Array.isArray(data?.tickets) ? data.tickets : [];
  const events = Array.isArray(data?.events) ? data.events : [];
  const eng = data?.engineer || {
    fullName: user?.fullName,
    username: user?.username,
  };

  const statusDist = useMemo(() => {
    const map = {};
    tickets.forEach((t) => {
      const k = t.status || 'Unknown';
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [tickets]);

  const ticketPages = Math.max(1, Math.ceil(tickets.length / TICKET_PAGE));
  const pageTickets = tickets.slice((ticketPage - 1) * TICKET_PAGE, ticketPage * TICKET_PAGE);
  const generatedAt = data?.generatedAt || new Date().toISOString();
  const backTo = isAdmin(user) ? '/reports/monthly' : '/my-reports';

  const kpis = [
    ['Assigned', summary.totalAssigned, 'text-white'],
    ['Completed', summary.completed, 'text-emerald-300'],
    ['In progress', summary.inProgress, 'text-sky-300'],
    ['Pending', summary.pending, 'text-amber-300'],
    ['Cancelled', summary.cancelled, 'text-rose-300'],
    ['Events', summary.events, 'text-violet-300'],
    ['Campus', summary.campus, 'text-cyan-300'],
    ['Workstation', summary.workstation, 'text-indigo-300'],
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#0B0F19]">
      <header className="shrink-0 h-20 flex items-center justify-between px-6 md:px-8 bg-[#111827] border-b border-[#1F2937] print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={backTo}
            className="w-9 h-9 rounded-lg bg-[#1F2937] border border-[#374151] text-gray-400 hover:text-white flex items-center justify-center shrink-0"
            aria-label="Back"
          >
            ←
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Monthly work report</p>
            <p className="text-sm font-bold text-white truncate">
              {data?.monthLabel || `${month}/${year}`}
              <span className="text-slate-500 font-medium"> · {eng.fullName || 'Engineer'}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={loading || !data}
          className="h-9 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold disabled:opacity-50 shrink-0"
        >
          Download PDF / Print
        </button>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto custom-scroll print:overflow-visible">
        {loading && (
          <p className="text-xs text-slate-500 px-6 py-8 print:hidden">Loading monthly report…</p>
        )}
        {!loading && !data && (
          <p className="text-xs text-slate-500 px-6 py-8 print:hidden">No report data for this period.</p>
        )}

        {data && (
          <div id="monthly-printable" className="h-full min-h-0 p-4 md:p-5 lg:p-6 print:p-6 print:bg-white">
            <div className="h-full max-w-[1400px] mx-auto flex flex-col gap-3 print:max-w-none print:gap-4">
              <section className="shrink-0 rounded-xl border border-[#1F2937] bg-gradient-to-r from-[#111827] via-[#0f172a] to-[#111827] px-4 py-3 md:px-5 print:border-slate-300 print:bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-teal-400 print:text-teal-800">
                      NSU IT Support Center
                    </p>
                    <h1 className="text-lg md:text-xl font-black text-white tracking-tight print:text-black">
                      Monthly IT Work Report
                    </h1>
                    <p className="text-[11px] text-slate-400 mt-0.5 print:text-slate-600">
                      {data.monthLabel} · Generated {formatDateTime(generatedAt)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-slate-300 print:text-slate-700">
                    <p>
                      <span className="text-slate-500">Engineer</span>
                      <br />
                      <strong className="text-white print:text-black">{eng.fullName || '—'}</strong>
                    </p>
                    <p>
                      <span className="text-slate-500">Account</span>
                      <br />
                      <span className="font-semibold">{eng.username || eng.id || '—'}</span>
                    </p>
                  </div>
                </div>
              </section>

              <section className="shrink-0 grid grid-cols-4 md:grid-cols-8 gap-2">
                {kpis.map(([k, v, color]) => (
                  <div
                    key={k}
                    className="rounded-xl border border-[#1F2937] bg-[#111827] px-2.5 py-2.5 print:border-slate-200 print:bg-slate-50"
                  >
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500 truncate">{k}</p>
                    <p className={`text-lg md:text-xl font-black tabular-nums mt-0.5 ${color} print:text-black`}>
                      {v ?? 0}
                    </p>
                  </div>
                ))}
              </section>

              <section className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 print:block print:space-y-4">
                <div className="lg:col-span-7 xl:col-span-8 min-h-0 flex flex-col rounded-xl border border-[#1F2937] bg-[#111827] overflow-hidden print:border-slate-200 print:bg-white">
                  <div className="shrink-0 px-3.5 py-2.5 border-b border-[#1F2937] flex items-center justify-between print:border-slate-200">
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Task breakdown</h2>
                    <span className="text-[10px] font-mono text-slate-500">{tickets.length}</span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-auto custom-scroll print:overflow-visible">
                    <table className="w-full text-left text-[11px]">
                      <thead className="sticky top-0 bg-[#0B0F19] print:static print:bg-slate-100">
                        <tr className="border-b border-[#1F2937] text-[10px] uppercase tracking-wider text-slate-500 print:border-slate-200">
                          <th className="px-3 py-2 font-bold">ID</th>
                          <th className="px-3 py-2 font-bold">Requester</th>
                          <th className="px-3 py-2 font-bold">Category</th>
                          <th className="px-3 py-2 font-bold">Status</th>
                          <th className="px-3 py-2 font-bold">Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageTickets.map((t) => (
                          <tr key={t.id} className="border-b border-[#1F2937]/70 hover:bg-[#0B0F19]/80 print:border-slate-100">
                            <td className="px-3 py-2">
                              <Link
                                to={ticketPath(t.id)}
                                className="font-bold text-indigo-300 hover:text-indigo-200 print:text-indigo-800 print:no-underline"
                              >
                                #{t.id}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-slate-300 print:text-slate-800 truncate max-w-[9rem]">
                              {t.user_name || '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-400 print:text-slate-700">{t.issue_category || '—'}</td>
                            <td className="px-3 py-2 text-slate-200 font-semibold print:text-slate-900">{t.status || '—'}</td>
                            <td className="px-3 py-2 text-slate-400 print:text-slate-700">{t.priority || '—'}</td>
                          </tr>
                        ))}
                        {tickets.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                              No ticket activity recorded for this month.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {tickets.length > TICKET_PAGE && (
                    <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2 border-t border-[#1F2937] print:hidden">
                      <p className="text-[11px] text-slate-500">
                        {(ticketPage - 1) * TICKET_PAGE + 1}–{Math.min(ticketPage * TICKET_PAGE, tickets.length)} of {tickets.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={ticketPage <= 1}
                          onClick={() => setTicketPage((p) => Math.max(1, p - 1))}
                          className="h-8 px-3 rounded-lg border border-[#374151] text-[11px] font-bold text-slate-300 disabled:opacity-40"
                        >
                          Prev
                        </button>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {ticketPage}/{ticketPages}
                        </span>
                        <button
                          type="button"
                          disabled={ticketPage >= ticketPages}
                          onClick={() => setTicketPage((p) => Math.min(ticketPages, p + 1))}
                          className="h-8 px-3 rounded-lg border border-[#374151] text-[11px] font-bold text-slate-300 disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 xl:col-span-4 min-h-0 flex flex-col gap-3 print:block print:space-y-4">
                  <div className="shrink-0 rounded-xl border border-[#1F2937] bg-[#111827] p-3.5 print:border-slate-200 print:bg-white">
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">Status mix</h2>
                    {statusDist.length === 0 && <p className="text-xs text-slate-500">No status data.</p>}
                    <div className="space-y-2">
                      {statusDist.map(([label, n]) => {
                        const pct = tickets.length ? Math.round((n / tickets.length) * 100) : 0;
                        return (
                          <div key={label}>
                            <div className="flex justify-between text-[11px] text-slate-400 mb-0.5 print:text-slate-600">
                              <span className="truncate pr-2">{label}</span>
                              <span className="shrink-0 font-mono">
                                {n} · {pct}%
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[#0B0F19] overflow-hidden print:bg-slate-100">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-indigo-500 print:bg-slate-600"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 rounded-xl border border-[#1F2937] bg-[#111827] overflow-hidden flex flex-col print:border-slate-200 print:bg-white">
                    <div className="shrink-0 px-3.5 py-2.5 border-b border-[#1F2937] flex items-center justify-between print:border-slate-200">
                      <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Event support</h2>
                      <span className="text-[10px] font-mono text-slate-500">{events.length}</span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scroll p-2 space-y-1.5 print:overflow-visible">
                      {events.length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-6">No events this month.</p>
                      )}
                      {events.map((e) => (
                        <Link
                          key={e.id}
                          to={eventPath(e.id)}
                          className="block rounded-lg border border-[#1F2937] bg-[#0B0F19]/60 px-3 py-2 hover:border-teal-500/30 transition print:border-slate-200 print:bg-slate-50"
                        >
                          <p className="text-xs font-bold text-white truncate print:text-black">
                            {e.name || `Event #${e.id}`}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5 print:text-slate-600">
                            {e.event_date || '—'}
                            {e.start_time ? ` · ${String(e.start_time).slice(0, 5)}` : ''}
                            {e.venue ? ` · ${e.venue}` : ''}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
