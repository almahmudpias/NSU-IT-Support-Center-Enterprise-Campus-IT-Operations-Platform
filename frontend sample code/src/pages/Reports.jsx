import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ticketsApi, staffApi } from '../lib/api';
import { useToast } from '../components/Toast';
import ReportKpis from '../components/reports/ReportKpis';
import ReportCharts from '../components/reports/ReportCharts';
import ReportTable from '../components/reports/ReportTable';
import EngineerSummary from '../components/reports/EngineerSummary';
import PrintableReport from '../components/reports/PrintableReport';
import ReportFilters from '../components/reports/ReportFilters';
import ReportSubNav from '../components/reports/ReportSubNav';
import '../components/reports/reportPrint.css';
import {
  ALL_STATUSES,
  COLUMN_DEFS,
  DATE_BASIS,
  DEFAULT_CONFIG,
  PERIOD_PRESETS,
  PRIORITIES,
  REPORT_TYPES,
  applyReportTypeDefaults,
  computeKpis,
  engineerPerformance,
  engineerWorkload,
  filterTickets,
  groupTickets,
  periodComparison,
  periodLabel,
  priorityDistribution,
  sortTickets,
  statusDistribution,
  trendSeries,
  ticketsForDrillDay,
  selectedEngineerLabel,
  validateConfig,
} from '../components/reports/reportUtils';

const PAGE_SIZE = 25;

export default function ReportsPage() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const [tickets, setTickets] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [generatedAt, setGeneratedAt] = useState(null);

  /** Single coherent report configuration */
  const [config, setConfig] = useState(() => {
    const next = {
      ...DEFAULT_CONFIG,
      engineers: [],
      statuses: [],
      priorities: [],
      columns: [...DEFAULT_CONFIG.columns],
    };
    try {
      const params = new URLSearchParams(window.location.search);
      const eng = params.get('engineer');
      const period = params.get('period');
      const workspace = params.get('workspace');
      const type = params.get('type');
      const from = params.get('from');
      const to = params.get('to');
      if (period) next.period = period;
      if (workspace) next.workspace = workspace;
      if (from) next.customFrom = from;
      if (to) next.customTo = to;
      if (eng) {
        next.engineers = [eng];
        next.reportType = eng === 'Unassigned' ? 'unassigned' : type || 'engineer';
      } else if (type) {
        next.reportType = type;
      }
    } catch (_) {
      /* ignore */
    }
    return next;
  });
  const [viewMode, setViewMode] = useState('editor'); // editor | preview
  const [drillDay, setDrillDay] = useState(null); // YYYY-MM-DD
  const [drillMode, setDrillMode] = useState('created'); // created | resolved
  const [printOrientation, setPrintOrientation] = useState('portrait'); // portrait | landscape
  const [printLayout, setPrintLayout] = useState('full'); // full | executive

  const patchConfig = useCallback((partial) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [all, eng] = await Promise.all([
        ticketsApi.all(),
        staffApi.engineers().catch(() => []),
      ]);
      const ticketRows = Array.isArray(all)
        ? all
        : Array.isArray(all?.tickets)
          ? all.tickets
          : Array.isArray(all?.data)
            ? all.data
            : [];
      setTickets(ticketRows);
      setEngineers(Array.isArray(eng) ? eng : Array.isArray(eng?.engineers) ? eng.engineers : []);
      setGeneratedAt(new Date().toISOString());
    } catch (e) {
      setError(e.message || 'Failed to load ticket data');
      showToast('error', 'Report failed', e.message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
    setDrillDay(null);
  }, [config]);

  const configError = useMemo(() => validateConfig(config), [config]);

  const filtered = useMemo(() => {
    if (configError) return [];
    return filterTickets(tickets, config);
  }, [tickets, config, configError]);

  const kpis = useMemo(
    () => computeKpis(filtered, tickets, config),
    [filtered, tickets, config]
  );
  const trend = useMemo(() => trendSeries(filtered, config), [filtered, config]);
  const statusDist = useMemo(() => statusDistribution(filtered), [filtered]);
  const priorityDist = useMemo(() => priorityDistribution(filtered), [filtered]);
  const workload = useMemo(() => engineerWorkload(filtered), [filtered]);
  const engPerf = useMemo(() => engineerPerformance(filtered), [filtered]);
  const comparison = useMemo(
    () => periodComparison(tickets, config),
    [tickets, config]
  );

  const drillTickets = useMemo(() => {
    if (!drillDay) return null;
    return ticketsForDrillDay(filtered, drillDay, drillMode);
  }, [filtered, drillDay, drillMode]);

  const tableSource = drillTickets || filtered;

  const sorted = useMemo(
    () => sortTickets(tableSource, config.sortKey, config.sortDir),
    [tableSource, config.sortKey, config.sortDir]
  );

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, page]);

  const groups = useMemo(
    () => groupTickets(pagedRows, config.groupBy),
    [pagedRows, config.groupBy]
  );

  const sortedFull = useMemo(
    () => sortTickets(filtered, config.sortKey, config.sortDir),
    [filtered, config.sortKey, config.sortDir]
  );

  const printGroups = useMemo(
    () => groupTickets(sortedFull, config.groupBy),
    [sortedFull, config.groupBy]
  );

  const activeColumnsKeys = useMemo(
    () => config.columns,
    [config.columns]
  );

  const landscapePrint = printOrientation === 'landscape';

  function openPreview() {
    const err = validateConfig(config);
    if (err) {
      showToast('warning', 'Invalid configuration', err);
      return;
    }
    setGeneratedAt(new Date().toISOString());
    setViewMode('preview');
  }

  function backToEditor() {
    setViewMode('editor');
  }


  const activeColumns = useMemo(
    () => COLUMN_DEFS.filter((c) => config.columns.includes(c.key)),
    [config.columns]
  );

  const engineerNames = useMemo(() => {
    const fromStaff = engineers.map((e) => e.full_name).filter(Boolean);
    const fromTickets = new Set();
    tickets.forEach((t) => {
      if (t.assigned_engineer) fromTickets.add(t.assigned_engineer);
      if (t.lab_engineer) fromTickets.add(t.lab_engineer);
    });
    return [...new Set([...fromStaff, ...fromTickets])].sort((a, b) => a.localeCompare(b));
  }, [engineers, tickets]);

  function selectReportType(id) {
    setConfig((prev) => applyReportTypeDefaults(prev, id));
    if (id === 'custom') setAdvancedOpen(true);
  }

  function resetConfig() {
    setConfig({
      ...DEFAULT_CONFIG,
      engineers: [],
      statuses: [],
      priorities: [],
      columns: [...DEFAULT_CONFIG.columns],
    });
    setAdvancedOpen(false);
    setColumnsOpen(false);
    setPage(1);
  }

  function toggleEngineer(name) {
    setConfig((prev) => {
      const has = prev.engineers.includes(name);
      return {
        ...prev,
        engineers: has ? prev.engineers.filter((x) => x !== name) : [...prev.engineers, name],
        reportType: prev.reportType === 'unassigned' ? 'custom' : prev.reportType,
      };
    });
  }

  function setSingleEngineer(name) {
    if (!name) {
      setConfig((prev) => ({ ...prev, engineers: [], reportType: prev.reportType === 'unassigned' ? 'overview' : prev.reportType }));
      return;
    }
    setConfig((prev) => ({
      ...prev,
      engineers: [name],
      reportType: name === 'Unassigned' ? 'unassigned' : prev.reportType === 'overview' ? 'engineer' : prev.reportType,
      groupBy: name === 'Unassigned' ? 'none' : prev.groupBy === 'none' ? 'none' : prev.groupBy,
    }));
  }

  function handleDrillDay(dayKey, mode) {
    // dayKey may be "W 2026-10-06" for weekly — only drill exact YYYY-MM-DD
    const pure = String(dayKey || '').replace(/^W\s+/, '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pure)) {
      showToast('info', 'Drill-down', 'Switch to a shorter period (daily buckets) to list tickets for a specific day.');
      return;
    }
    setDrillDay(pure);
    setDrillMode(mode || 'created');
    setPage(1);
  }

  function clearDrill() {
    setDrillDay(null);
  }

  function handleSelectEngineerFromChart(name) {
    setSingleEngineer(name);
    setConfig((prev) => ({ ...prev, reportType: name === 'Unassigned' ? 'unassigned' : 'engineer' }));
  }

  function toggleList(key, value) {
    setConfig((prev) => {
      const list = prev[key] || [];
      const next = list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
      return { ...prev, [key]: next };
    });
  }

  function toggleColumn(key) {
    setConfig((prev) => {
      const cols = prev.columns;
      if (cols.includes(key)) {
        if (cols.length <= 2) return prev;
        return { ...prev, columns: cols.filter((k) => k !== key) };
      }
      return { ...prev, columns: [...cols, key] };
    });
  }

  const filtersActive =
    config.engineers.length > 0 ||
    config.workspace ||
    config.statuses.length > 0 ||
    config.priorities.length > 0 ||
    config.period !== DEFAULT_CONFIG.period ||
    config.dateBasis !== DEFAULT_CONFIG.dateBasis ||
    config.reportType !== DEFAULT_CONFIG.reportType ||
    config.customFrom ||
    config.customTo;

  const showEngineerSummary =
    config.reportType === 'engineer' || config.groupBy === 'engineer';

  const singleEngineer =
    config.engineers?.length === 1 ? config.engineers[0] : null;

  const activeType = REPORT_TYPES.find((t) => t.id === config.reportType);

  if (viewMode === 'preview') {
    return (
      <div className="flex-1 flex flex-col min-h-0 report-preview-screen">
        <div className="report-preview-toolbar print-hide px-4 sm:px-6 py-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-sm font-black text-white tracking-tight">Report preview</h1>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {activeType?.label} · {selectedEngineerLabel(config)} · {periodLabel(config)} ·{' '}
                {(drillDay ? sorted.length : sortedFull.length).toLocaleString()} tickets ·{' '}
                <span className="text-indigo-300">
                  {printOrientation === 'landscape' ? 'Landscape' : 'Portrait'} ·{' '}
                  {printLayout === 'executive' ? 'One-page executive' : 'Full multi-page'} · A4
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={backToEditor}
                className="h-9 px-4 rounded-xl border border-[#374151] bg-[#0B0F19] text-xs font-bold text-slate-300 hover:text-white transition"
              >
                ← Back to configuration
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
              >
                Print / Save as PDF
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="text-slate-500 font-bold uppercase tracking-wider">Orientation</span>
            {['portrait', 'landscape'].map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setPrintOrientation(o)}
                className={`px-2.5 py-1 rounded-lg border font-bold capitalize ${
                  printOrientation === o
                    ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                    : 'border-slate-700 text-slate-400'
                }`}
              >
                {o}
              </button>
            ))}
            <span className="text-slate-700">|</span>
            <span className="text-slate-500 font-bold uppercase tracking-wider">Layout</span>
            <button
              type="button"
              onClick={() => setPrintLayout('executive')}
              className={`px-2.5 py-1 rounded-lg border font-bold ${
                printLayout === 'executive'
                  ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                  : 'border-slate-700 text-slate-400'
              }`}
            >
              One-page executive
            </button>
            <button
              type="button"
              onClick={() => setPrintLayout('full')}
              className={`px-2.5 py-1 rounded-lg border font-bold ${
                printLayout === 'full'
                  ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                  : 'border-slate-700 text-slate-400'
              }`}
            >
              Full detailed report
            </button>
            {printLayout === 'executive' && sortedFull.length > 25 && (
              <span className="text-amber-400/90 text-[10px]">
                Full register has {sortedFull.length.toLocaleString()} rows — executive mode
                omits the ticket table.
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scroll py-6 px-3 sm:px-6">
          <PrintableReport
            config={config}
            kpis={kpis}
            trend={trend}
            statusDist={statusDist}
            priorityDist={priorityDist}
            engPerf={engPerf}
            groups={printGroups}
            columns={activeColumnsKeys}
            generatedAt={generatedAt}
            totalRows={sortedFull.length}
            landscape={landscapePrint}
            layoutMode={printLayout}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B0F19]">
      <ReportSubNav />
      <header className="shrink-0 border-b border-[#1F2937] bg-[#111827]/90 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <h1 className="text-lg font-black text-white tracking-tight">Service Analytics & Reports</h1>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {activeType?.description || 'IT service metrics and ticket drill-down.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="h-9 px-4 rounded-xl border border-[#374151] bg-[#0B0F19] text-xs font-bold text-slate-300 hover:text-white hover:border-indigo-500/40 transition disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh data'}
          </button>
          <button
            type="button"
            onClick={openPreview}
            disabled={loading || !!configError}
            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition disabled:opacity-50"
          >
            Generate report
          </button>
        </div>
      </header>

      {/* Report type — horizontal slider under top bar; click to view full report type */}
      <div className="shrink-0 border-b border-[#1F2937] bg-[#0B0F19] print:hidden">
        <div className="px-4 sm:px-6 py-2 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 shrink-0">
            Report type
          </span>
          <div
            className="flex-1 min-w-0 overflow-x-auto custom-scroll"
            role="tablist"
            aria-label="Report type"
          >
            <div className="flex items-center gap-1.5 w-max pr-2">
              {REPORT_TYPES.map((t) => {
                const active = config.reportType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    title={t.description}
                    onClick={() => selectReportType(t.id)}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold border transition whitespace-nowrap ${
                      active
                        ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-200 shadow-[0_0_0_1px_rgba(99,102,241,0.25)]'
                        : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {activeType && (
          <div className="px-4 sm:px-6 pb-2.5">
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-3.5 py-2">
              <p className="text-[11px] font-bold text-indigo-200">{activeType.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{activeType.description}</p>
            </div>
          </div>
        )}
      </div>

      <main className="flex-1 overflow-y-auto custom-scroll p-4 sm:p-6 space-y-4">

        {/* Report builder */}
        <ReportFilters
          config={config}
          configError={configError}
          engineerNames={engineerNames}
          filtersOpen={filtersOpen}
          advancedOpen={advancedOpen}
          columnsOpen={columnsOpen}
          filtersActive={filtersActive}
          onSelectReportType={selectReportType}
          onPatch={patchConfig}
          onToggleEngineer={toggleEngineer}
          onSetSingleEngineer={setSingleEngineer}
          onToggleList={toggleList}
          onToggleColumn={toggleColumn}
          onToggleFilters={() => setFiltersOpen((v) => !v)}
          onToggleAdvanced={() => setAdvancedOpen((v) => !v)}
          onToggleColumns={() => setColumnsOpen((v) => !v)}
          onReset={resetConfig}
        />

        <ReportKpis kpis={kpis} loading={loading} dateBasis={config.dateBasis} singleEngineer={singleEngineer} />

        {showEngineerSummary && (
          <EngineerSummary
            rows={singleEngineer ? engPerf.filter((r) => r.engineer === singleEngineer) : engPerf}
            loading={loading}
            singleEngineer={singleEngineer}
          />
        )}

        {(config.reportType === 'overview' ||
          config.reportType === 'operations' ||
          config.reportType === 'custom' ||
          config.reportType === 'engineer') && (
          <ReportCharts
            trend={trend}
            statusDist={statusDist}
            priorityDist={priorityDist}
            workload={singleEngineer ? workload.filter((w) => w.engineer === singleEngineer || w.name === singleEngineer) : workload}
            comparison={comparison}
            loading={loading}
            singleEngineer={singleEngineer}
            onDrillDay={handleDrillDay}
            onSelectEngineer={handleSelectEngineerFromChart}
          />
        )}

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 print:hidden">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Ticket results
              {singleEngineer ? ` · ${singleEngineer}` : ''}
            </h2>
            {drillDay && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-indigo-300 font-semibold">
                  Drill-down: {drillMode === 'resolved' ? 'resolved' : 'created'} on {drillDay}
                  {' '}({sorted.length} tickets)
                </span>
                <button
                  type="button"
                  onClick={clearDrill}
                  className="px-2 py-1 rounded-md border border-slate-700 text-slate-400 hover:text-white text-[10px] font-bold"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
          <ReportTable
            groups={groups}
            columns={activeColumns}
            loading={loading}
            error={error || configError}
            page={page}
            pageSize={PAGE_SIZE}
            totalRows={sorted.length}
            onPageChange={setPage}
          />
        </div>
      </main>
    </div>
  );
}
