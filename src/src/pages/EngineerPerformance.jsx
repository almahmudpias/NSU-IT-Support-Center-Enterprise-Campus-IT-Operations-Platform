import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ticketsApi, staffApi } from '../lib/api';
import { useToast } from '../components/Toast';
import ReportSubNav from '../components/reports/ReportSubNav';
import {
  DEFAULT_CONFIG,
  PERIOD_PRESETS,
  RANK_OPTIONS,
  computeKpis,
  filterTickets,
  engineerPerformance,
  periodLabel,
  rankEngineers,
  validateConfig,
} from '../components/reports/reportUtils';

/**
 * Organization-wide engineer performance comparison.
 * Drill-down opens /reports with engineer + period preserved in the query string.
 */
export default function EngineerPerformancePage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const period = searchParams.get('period') || DEFAULT_CONFIG.period;
  const workspace = searchParams.get('workspace') || '';
  const rankBy = searchParams.get('rankBy') || 'resolved';
  const customFrom = searchParams.get('from') || '';
  const customTo = searchParams.get('to') || '';

  const config = useMemo(
    () => ({
      ...DEFAULT_CONFIG,
      reportType: 'engineer',
      period,
      workspace,
      customFrom,
      customTo,
      engineers: [],
      dateBasis: 'created',
      groupBy: 'engineer',
    }),
    [period, workspace, customFrom, customTo]
  );

  const configError = useMemo(() => validateConfig(config), [config]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const all = await ticketsApi.all();
      const ticketRows = Array.isArray(all)
        ? all
        : Array.isArray(all?.tickets)
          ? all.tickets
          : [];
      setTickets(ticketRows);
    } catch (e) {
      setError(e.message || 'Failed to load tickets');
      showToast('error', 'Performance page', e.message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  function patchQuery(partial) {
    const next = new URLSearchParams(searchParams);
    Object.entries(partial).forEach(([k, v]) => {
      if (v == null || v === '') next.delete(k);
      else next.set(k, String(v));
    });
    setSearchParams(next, { replace: true });
  }

  const filtered = useMemo(() => {
    if (configError) return [];
    return filterTickets(tickets, config);
  }, [tickets, config, configError]);

  const kpis = useMemo(() => computeKpis(filtered, tickets, config), [filtered, tickets, config]);
  const rawRows = useMemo(() => engineerPerformance(filtered), [filtered]);
  const { rows, criterion } = useMemo(
    () => rankEngineers(rawRows.filter((r) => r.engineer !== 'Unassigned'), rankBy),
    [rawRows, rankBy]
  );
  const unassigned = rawRows.find((r) => r.engineer === 'Unassigned');

  function openIndividual(name) {
    const q = new URLSearchParams();
    q.set('engineer', name);
    q.set('period', period);
    if (workspace) q.set('workspace', workspace);
    if (period === 'custom') {
      if (customFrom) q.set('from', customFrom);
      if (customTo) q.set('to', customTo);
    }
    q.set('type', 'engineer');
    navigate(`/reports?${q.toString()}`);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B0F19]">
      <ReportSubNav />

      <header className="shrink-0 border-b border-[#1F2937] bg-[#111827]/90 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">Engineer Performance</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Organization-wide comparison · Ranking is explicit, not a composite score
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="h-9 px-4 rounded-xl border border-[#374151] bg-[#0B0F19] text-xs font-bold text-slate-300 hover:text-white transition disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh data'}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto custom-scroll p-4 sm:p-6 space-y-4">
        {/* Filters */}
        <section className="border border-[#1F2937] bg-[#111827] p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Period
            </span>
            {PERIOD_PRESETS.filter((p) => p.id !== 'all' || true).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => patchQuery({ period: p.id })}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${
                  period === p.id
                    ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                    : 'border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => patchQuery({ from: e.target.value })}
                className="dark-input py-1.5 text-[11px] w-[138px]"
              />
              <span className="text-slate-600">→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => patchQuery({ to: e.target.value })}
                className="dark-input py-1.5 text-[11px] w-[138px]"
              />
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="ep-ws" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Workspace
              </label>
              <select
                id="ep-ws"
                value={workspace}
                onChange={(e) => patchQuery({ workspace: e.target.value })}
                className="dark-input mt-1.5 py-2 text-[11px] font-bold min-w-[160px]"
              >
                <option value="">All workspaces</option>
                <option value="1400">Campus Support</option>
                <option value="6004">Support Workstation</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="ep-rank" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Rank by
              </label>
              <select
                id="ep-rank"
                value={rankBy}
                onChange={(e) => patchQuery({ rankBy: e.target.value })}
                className="dark-input mt-1.5 py-2 text-[11px] font-bold w-full max-w-md"
              >
                {RANK_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {criterion && (
            <p className="text-[11px] text-slate-500">
              Ranking criterion: <span className="text-indigo-300 font-semibold">{criterion.label}</span>
              {' — '}
              {criterion.description}
              {criterion.minSample > 0 && (
                <span className="text-slate-600">
                  {' '}
                  (minimum {criterion.minSample} samples for average resolution rank)
                </span>
              )}
            </p>
          )}
          {configError && (
            <p className="text-[11px] text-rose-400" role="alert">
              {configError}
            </p>
          )}
        </section>

        {/* Org KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { label: 'Engineers', value: rows.length, hint: 'Excludes Unassigned bucket' },
            { label: 'Tickets in scope', value: kpis.total },
            { label: 'Resolved in period', value: kpis.resolvedInPeriod },
            { label: 'Outstanding', value: kpis.outstanding },
            {
              label: 'Avg resolution',
              value:
                kpis.avgResolutionHours != null ? `${kpis.avgResolutionHours}h` : '—',
              hint: kpis.avgResolutionSample
                ? `${kpis.avgResolutionSample} samples`
                : 'Insufficient timestamps',
            },
          ].map((k) => (
            <div
              key={k.label}
              title={k.hint}
              className="border border-[#1F2937] bg-[#111827] border-l-4 border-l-indigo-500 px-3 py-2.5"
            >
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{k.label}</p>
              <p className="mt-1 text-xl font-black text-white tabular-nums">
                {loading ? '—' : typeof k.value === 'number' ? k.value.toLocaleString() : k.value}
              </p>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-slate-600">
          Period: <span className="text-slate-400 font-mono">{periodLabel(config)}</span>
          {' · '}
          Assignment volume is not a performance quality score. Resolved counts use current status
          within the filtered scope; average resolution uses resolved_at when available.
        </p>

        {error && (
          <div className="border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Comparison table */}
        <section className="border border-[#1F2937] bg-[#111827] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1F2937] flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Engineer comparison · ranked by {criterion?.label || '—'}
            </h2>
            <Link
              to="/reports"
              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300"
            >
              Open Overview →
            </Link>
          </div>
          <div className="overflow-x-auto custom-scroll">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-[#1F2937] text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5 font-bold">Rank</th>
                  <th className="px-3 py-2.5 font-bold">Engineer</th>
                  <th className="px-3 py-2.5 font-bold text-right">Assigned</th>
                  <th className="px-3 py-2.5 font-bold text-right">Resolved</th>
                  <th className="px-3 py-2.5 font-bold text-right">Outstanding</th>
                  <th className="px-3 py-2.5 font-bold text-right">Open</th>
                  <th className="px-3 py-2.5 font-bold text-right">In progress</th>
                  <th className="px-3 py-2.5 font-bold text-right">Avg res.</th>
                  <th className="px-3 py-2.5 font-bold text-right">High / Crit</th>
                  <th className="px-3 py-2.5 font-bold" />
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      No engineer data for this period and workspace.
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((r) => (
                    <tr
                      key={r.engineer}
                      className="border-b border-[#1F2937]/80 hover:bg-[#0B0F19]/80 transition"
                    >
                      <td className="px-3 py-2.5 font-mono text-slate-400">
                        {r.rank != null ? r.rank : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => openIndividual(r.engineer)}
                          className="font-bold text-white hover:text-indigo-300 text-left"
                        >
                          {r.engineer}
                        </button>
                        {r.rankNote && (
                          <p className="text-[9px] text-amber-500/80 mt-0.5">{r.rankNote}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-300">{r.assigned}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-400/90">{r.resolved}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-400/90">{r.outstanding}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400">{r.open}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400">{r.inProgress}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-300">
                        {r.avgResolutionHours != null ? `${r.avgResolutionHours}h` : '—'}
                        {r.avgResolutionSample > 0 && (
                          <span className="text-slate-600 text-[9px] ml-1">n={r.avgResolutionSample}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400">
                        {r.highPriority}/{r.critical}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => openIndividual(r.engineer)}
                          className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300"
                        >
                          Report →
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {unassigned && unassigned.assigned > 0 && (
            <div className="px-4 py-2.5 border-t border-[#1F2937] text-[11px] text-slate-500 flex flex-wrap gap-4">
              <span>
                Unassigned tickets in scope:{' '}
                <strong className="text-slate-300">{unassigned.assigned}</strong>
              </span>
              <span>
                Outstanding:{' '}
                <strong className="text-amber-400/80">{unassigned.outstanding}</strong>
              </span>
              <button
                type="button"
                onClick={() => openIndividual('Unassigned')}
                className="text-indigo-400 font-bold hover:text-indigo-300"
              >
                Open unassigned report →
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
