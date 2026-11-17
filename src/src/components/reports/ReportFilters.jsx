import {
  ALL_STATUSES,
  COLUMN_DEFS,
  DATE_BASIS,
  PERIOD_PRESETS,
  PRIORITIES,
  REPORT_TYPES,
  periodLabel,
} from './reportUtils';

/**
 * Primary + advanced filter panel for Service Analytics.
 * Primary: report type, period, engineer, workspace.
 * Advanced (collapsed): status, priority, date basis, group, sort, columns.
 */
export default function ReportFilters({
  config,
  configError,
  engineerNames,
  advancedOpen,
  columnsOpen,
  filtersActive,
  onSelectReportType,
  onPatch,
  onToggleEngineer,
  onSetSingleEngineer,
  onToggleList,
  onToggleColumn,
  onToggleAdvanced,
  onToggleColumns,
  onReset,
}) {
  const engMode =
    !config.engineers?.length
      ? 'all'
      : config.engineers.length === 1
        ? config.engineers[0]
        : 'multi';

  const chips = [];
  if (config.engineers?.length === 1) chips.push({ key: 'eng', label: `Engineer: ${config.engineers[0]}` });
  if (config.engineers?.length > 1) chips.push({ key: 'engs', label: `${config.engineers.length} engineers` });
  if (config.workspace) chips.push({ key: 'ws', label: `WS ${config.workspace}` });
  if (config.statuses?.length) chips.push({ key: 'st', label: `${config.statuses.length} statuses` });
  if (config.priorities?.length) chips.push({ key: 'pr', label: config.priorities.join(', ') });
  if (config.period === 'custom' && (config.customFrom || config.customTo)) {
    chips.push({ key: 'dt', label: periodLabel(config) });
  }

  return (
    <section className="border border-[#1F2937] bg-[#111827]" aria-label="Report configuration">
      {/* Report type */}
      <div className="px-4 py-3 border-b border-[#1F2937]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Report type</p>
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {REPORT_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={config.reportType === t.id}
              title={t.description}
              onClick={() => onSelectReportType(t.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                config.reportType === t.id
                  ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary controls */}
      <div className="px-4 py-3 border-b border-[#1F2937] space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 shrink-0">
            Period
          </span>
          {PERIOD_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPatch({ period: p.id })}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${
                config.period === p.id
                  ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {config.period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-14">
            <label className="sr-only" htmlFor="rf-from">Start date</label>
            <input
              id="rf-from"
              type="date"
              value={config.customFrom}
              onChange={(e) => onPatch({ customFrom: e.target.value })}
              className="dark-input py-1.5 text-[11px] w-[138px]"
            />
            <span className="text-slate-600 text-xs">→</span>
            <label className="sr-only" htmlFor="rf-to">End date</label>
            <input
              id="rf-to"
              type="date"
              value={config.customTo}
              onChange={(e) => onPatch({ customTo: e.target.value })}
              className="dark-input py-1.5 text-[11px] w-[138px]"
            />
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1 max-w-xs">
            <label htmlFor="rf-engineer" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Engineer
            </label>
            <select
              id="rf-engineer"
              value={engMode === 'multi' ? '__multi__' : engMode === 'all' ? '' : engMode}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') onSetSingleEngineer(null);
                else if (v === '__multi__') return;
                else onSetSingleEngineer(v);
              }}
              className="dark-input mt-1.5 py-2 text-[11px] w-full font-bold"
            >
              <option value="">All engineers</option>
              <option value="Unassigned">Unassigned only</option>
              {engineerNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              {engMode === 'multi' && (
                <option value="__multi__">
                  {config.engineers.length} selected (use advanced)
                </option>
              )}
            </select>
          </div>

          <div className="min-w-[160px]">
            <label htmlFor="rf-ws" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Workspace
            </label>
            <select
              id="rf-ws"
              value={config.workspace}
              onChange={(e) => onPatch({ workspace: e.target.value })}
              className="dark-input mt-1.5 py-2 text-[11px] w-full font-bold"
            >
              <option value="">All workspaces</option>
              <option value="1400">Campus Support</option>
              <option value="6004">Support Workstation</option>
            </select>
          </div>

          <div className="min-w-[180px]">
            <label htmlFor="rf-basis" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Date basis
            </label>
            <select
              id="rf-basis"
              value={config.dateBasis}
              onChange={(e) => onPatch({ dateBasis: e.target.value })}
              className="dark-input mt-1.5 py-2 text-[11px] w-full font-bold"
            >
              {DATE_BASIS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pb-0.5">
            <button
              type="button"
              onClick={onToggleAdvanced}
              className={`h-9 px-3 rounded-lg text-[11px] font-bold border ${
                advancedOpen || filtersActive
                  ? 'border-indigo-500/40 text-indigo-300 bg-indigo-500/10'
                  : 'border-slate-700 text-slate-400'
              }`}
            >
              {advancedOpen ? 'Hide advanced' : 'Advanced'}
            </button>
            {filtersActive && (
              <button
                type="button"
                onClick={onReset}
                className="h-9 px-3 rounded-lg text-[11px] font-bold text-slate-500 hover:text-white border border-transparent hover:border-slate-700"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {chips.map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-indigo-500/25 bg-indigo-500/10 text-indigo-300"
              >
                {c.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {configError && (
        <div className="px-4 py-2 text-[11px] text-rose-400 border-b border-[#1F2937] bg-rose-500/5" role="alert">
          {configError}
        </div>
      )}

      {advancedOpen && (
        <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 border-b border-[#1F2937]">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Engineers (multi-select)
            </label>
            <p className="text-[10px] text-slate-600 mb-1.5">Override single select. Empty = all.</p>
            <div className="max-h-28 overflow-y-auto custom-scroll border border-[#374151] rounded-lg bg-[#0B0F19] p-2 space-y-1">
              <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer hover:bg-[#1F2937]/50 px-1.5 py-1 rounded">
                <input
                  type="checkbox"
                  checked={config.engineers.includes('Unassigned')}
                  onChange={() => onToggleEngineer('Unassigned')}
                  className="rounded border-slate-600"
                />
                Unassigned
              </label>
              {engineerNames.map((name) => (
                <label
                  key={name}
                  className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer hover:bg-[#1F2937]/50 px-1.5 py-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={config.engineers.includes(name)}
                    onChange={() => onToggleEngineer(name)}
                    className="rounded border-slate-600"
                  />
                  {name}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</span>
              <p className="text-[10px] text-slate-600 mb-1">Empty = all</p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scroll">
                {ALL_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onToggleList('statuses', s)}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold border ${
                      config.statuses.includes(s)
                        ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                        : 'border-slate-700 text-slate-500'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Priority</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {PRIORITIES.map((pr) => (
                  <button
                    key={pr}
                    type="button"
                    onClick={() => onToggleList('priorities', pr)}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold border ${
                      config.priorities.includes(pr)
                        ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                        : 'border-slate-700 text-slate-500'
                    }`}
                  >
                    {pr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 content-start">
            <div>
              <label htmlFor="rf-group" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Group by
              </label>
              <select
                id="rf-group"
                value={config.groupBy}
                onChange={(e) => onPatch({ groupBy: e.target.value })}
                className="dark-input mt-1.5 py-2 text-[11px] w-full font-bold"
              >
                <option value="none">None</option>
                <option value="engineer">Engineer</option>
                <option value="status">Status</option>
                <option value="priority">Priority</option>
                <option value="workspace">Workspace</option>
                <option value="date">Date created</option>
              </select>
            </div>
            <div>
              <label htmlFor="rf-sort" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Sort
              </label>
              <div className="flex gap-1 mt-1.5">
                <select
                  id="rf-sort"
                  value={config.sortKey}
                  onChange={(e) => onPatch({ sortKey: e.target.value })}
                  className="dark-input py-2 text-[11px] flex-1 font-bold"
                >
                  <option value="created_at">Opened</option>
                  <option value="id">ID</option>
                  <option value="status">Status</option>
                  <option value="priority">Priority</option>
                  <option value="user_name">Requester</option>
                  <option value="engineer">Engineer</option>
                </select>
                <button
                  type="button"
                  onClick={() => onPatch({ sortDir: config.sortDir === 'asc' ? 'desc' : 'asc' })}
                  className="h-[38px] px-2 rounded-lg border border-[#374151] text-[10px] font-bold text-slate-400"
                  aria-label="Toggle sort direction"
                >
                  {config.sortDir === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleColumns}
          className="text-[11px] font-bold text-slate-500 hover:text-indigo-300"
        >
          {columnsOpen ? 'Hide columns' : 'Table columns'}
        </button>
        {columnsOpen &&
          COLUMN_DEFS.map((c) => (
            <label key={c.key} className="inline-flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={config.columns.includes(c.key)}
                onChange={() => onToggleColumn(c.key)}
                className="rounded border-slate-600"
              />
              {c.label}
            </label>
          ))}
        <span className="ml-auto text-[10px] text-slate-600 font-mono">{periodLabel(config)}</span>
      </div>
    </section>
  );
}
