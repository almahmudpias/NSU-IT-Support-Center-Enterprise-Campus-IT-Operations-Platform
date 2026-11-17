export default function ReportKpis({ kpis, loading, dateBasis, singleEngineer }) {
  const items = [
    {
      label: singleEngineer ? 'Tickets in scope' : 'In report scope',
      value: kpis.total,
      tone: 'text-white',
      border: 'border-l-indigo-500',
      hint: 'Tickets matching all active filters',
    },
    {
      label: 'Created in period',
      value: kpis.createdInPeriod,
      tone: 'text-indigo-300',
      border: 'border-l-indigo-400',
      hint: 'created_at inside the selected period',
    },
    {
      label: 'Resolved in period',
      value: kpis.resolvedInPeriod,
      tone: 'text-emerald-400',
      border: 'border-l-emerald-500',
      hint: 'Status Resolved; uses updated_at (no resolved_at field)',
    },
    {
      label: 'Outstanding',
      value: kpis.outstanding,
      tone: 'text-amber-400',
      border: 'border-l-amber-500',
      hint: 'Open + in-progress in current scope',
    },
    {
      label: 'Open now',
      value: kpis.open,
      tone: 'text-blue-400',
      border: 'border-l-blue-500',
      hint: 'Status = Open',
    },
    {
      label: 'In progress now',
      value: kpis.inProgress,
      tone: 'text-amber-300',
      border: 'border-l-amber-400',
      hint: 'Active / lab statuses',
    },
    {
      label: 'High priority',
      value: kpis.highPriority,
      tone: 'text-rose-300',
      border: 'border-l-rose-400',
      hint: 'priority = High in scope',
    },
    {
      label: 'Critical',
      value: kpis.critical,
      tone: 'text-rose-400',
      border: 'border-l-rose-500',
      hint: 'priority = Critical in scope',
    },
  ];

  const avgLabel =
    kpis.avgResolutionHours != null
      ? `${kpis.avgResolutionHours}h`
      : '—';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-slate-500">
          Date filter basis:{' '}
          <span className="text-slate-400 font-semibold">
            {dateBasis === 'resolved'
              ? 'Resolved in period'
              : dateBasis === 'either'
                ? 'Created or resolved in period'
                : 'Created in period'}
          </span>
          . Created and resolved counts are separate metrics.
          {singleEngineer ? (
            <span className="text-indigo-400 font-semibold"> · Scoped to {singleEngineer}</span>
          ) : null}
        </p>
        <p
          className="text-[10px] text-slate-500"
          title="Mean (updated_at − created_at) for Resolved tickets with both timestamps. Not a true SLA clock."
        >
          Approx. avg resolution:{' '}
          <span className="font-mono text-slate-300">{loading ? '—' : avgLabel}</span>
          {kpis.avgResolutionSample > 0 && (
            <span className="text-slate-600"> ({kpis.avgResolutionSample} samples)</span>
          )}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            title={item.hint}
            className={`border border-[#1F2937] bg-[#111827] border-l-4 ${item.border} px-3 py-2.5 min-h-[68px] flex flex-col justify-center`}
          >
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 leading-tight">
              {item.label}
            </p>
            <p className={`mt-1 text-xl font-black tabular-nums ${item.tone}`}>
              {loading ? '—' : Number(item.value || 0).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
