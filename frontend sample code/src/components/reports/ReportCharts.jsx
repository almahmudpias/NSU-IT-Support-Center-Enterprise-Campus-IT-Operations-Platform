/**
 * Analytics charts — pure SVG/CSS to match the app dark theme.
 * No chart library is installed in this project; these components use
 * the same filtered scope as KPIs and the results table (no hardcoded series).
 */

const C = {
  indigo: '#6366f1',
  emerald: '#34d399',
  violet: '#8b5cf6',
  amber: '#fbbf24',
  rose: '#f43f5e',
  blue: '#60a5fa',
  slate: '#64748b',
  grid: '#1F2937',
  muted: '#94a3b8',
};

const STATUS_PALETTE = [
  '#6366f1',
  '#60a5fa',
  '#fbbf24',
  '#a78bfa',
  '#f472b6',
  '#34d399',
  '#fb923c',
  '#94a3b8',
  '#e2e8f0',
];

const PRIORITY_COLORS = {
  Critical: '#f43f5e',
  High: '#fb7185',
  Medium: '#fbbf24',
  Low: '#94a3b8',
};

function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <section
      className={`border border-[#1F2937] bg-[#111827] p-4 flex flex-col min-h-[220px] ${className}`}
      aria-label={title}
    >
      <div className="mb-3 shrink-0">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</h3>
        {subtitle && <p className="text-[10px] text-slate-600 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex-1 w-full min-h-[160px]">{children}</div>
    </section>
  );
}

function EmptyState({ message = 'No data in current scope' }) {
  return (
    <div className="h-full min-h-[140px] flex items-center justify-center text-xs text-slate-500 italic">
      {message}
    </div>
  );
}

/** Line chart: created vs resolved */
function TrendChart({ series, onDrillDay }) {
  const points = series?.points || [];
  if (!points.length) return <EmptyState message="No activity trend for this period" />;

  const w = 640;
  const h = 180;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxY = Math.max(...points.map((p) => Math.max(p.created || 0, p.resolved || 0)), 1);

  function xAt(i) {
    if (points.length === 1) return padL + innerW / 2;
    return padL + (i / (points.length - 1)) * innerW;
  }
  function yAt(v) {
    return padT + innerH - (v / maxY) * innerH;
  }

  function path(key) {
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(p[key] || 0).toFixed(1)}`)
      .join(' ');
  }

  const ticks = [0, Math.round(maxY / 2), maxY];

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-[180px]"
        role="img"
        aria-label="Tickets created and resolved over time"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={w - padR}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke={C.grid}
              strokeDasharray="3 3"
            />
            <text x={padL - 6} y={yAt(t) + 3} textAnchor="end" fill={C.slate} fontSize="10">
              {t}
            </text>
          </g>
        ))}
        <path d={path('created')} fill="none" stroke={C.indigo} strokeWidth="2" />
        <path
          d={path('resolved')}
          fill="none"
          stroke={C.emerald}
          strokeWidth="2"
          strokeDasharray="5 4"
        />
        {points.length <= 24 &&
          points.map((p, i) => (
            <g key={i} style={{ cursor: onDrillDay ? 'pointer' : 'default' }}>
              <circle
                cx={xAt(i)}
                cy={yAt(p.created || 0)}
                r="3"
                fill={C.indigo}
                onClick={() => onDrillDay && onDrillDay(p.date, 'created')}
              >
                <title>{`${p.date}: ${p.created} created — click to list`}</title>
              </circle>
              <circle
                cx={xAt(i)}
                cy={yAt(p.resolved || 0)}
                r="3"
                fill={C.emerald}
                onClick={() => onDrillDay && onDrillDay(p.date, 'resolved')}
              >
                <title>{`${p.date}: ${p.resolved} resolved — click to list`}</title>
              </circle>
            </g>
          ))}
        <text x={padL} y={h - 6} fill={C.slate} fontSize="9">
          {points[0]?.date}
        </text>
        <text x={w - padR} y={h - 6} textAnchor="end" fill={C.slate} fontSize="9">
          {points[points.length - 1]?.date}
        </text>
      </svg>
      <div className="flex gap-4 mt-1 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-indigo-500" /> Created
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-t border-dashed border-emerald-400" /> Resolved
        </span>
        <span className="text-slate-600 ml-auto">
          Click points to drill into that day · resolved uses updated_at
        </span>
      </div>
    </div>
  );
}

/** Donut: status distribution with counts + % */
function StatusDonut({ data }) {
  if (!data?.length) return <EmptyState />;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 58;
  const ir = 36;
  let angle = -Math.PI / 2;

  function arc(start, end, radius) {
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  }

  const slices = data.map((d, i) => {
    const sweep = (d.value / total) * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const mid = (start + end) / 2;
    return { ...d, start, end, mid, color: STATUS_PALETTE[i % STATUS_PALETTE.length] };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 h-full">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
        role="img"
        aria-label="Status distribution donut"
      >
        {slices.map((s) => {
          if (s.value <= 0) return null;
          // full circle special case
          if (s.value === total) {
            return (
              <circle
                key={s.label}
                cx={cx}
                cy={cy}
                r={(r + ir) / 2}
                fill="none"
                stroke={s.color}
                strokeWidth={r - ir}
              >
                <title>{`${s.label}: ${s.value} (${s.percent}%)`}</title>
              </circle>
            );
          }
          const outer = arc(s.start, s.end, r);
          const inner = arc(s.end, s.start, ir);
          const path = `${outer} L ${cx + ir * Math.cos(s.end)} ${cy + ir * Math.sin(s.end)} ${inner} Z`;
          // simpler ring segment via two arcs
          const ox1 = cx + r * Math.cos(s.start);
          const oy1 = cy + r * Math.sin(s.start);
          const ox2 = cx + r * Math.cos(s.end);
          const oy2 = cy + r * Math.sin(s.end);
          const ix1 = cx + ir * Math.cos(s.end);
          const iy1 = cy + ir * Math.sin(s.end);
          const ix2 = cx + ir * Math.cos(s.start);
          const iy2 = cy + ir * Math.sin(s.start);
          const large = s.end - s.start > Math.PI ? 1 : 0;
          const d = [
            `M ${ox1} ${oy1}`,
            `A ${r} ${r} 0 ${large} 1 ${ox2} ${oy2}`,
            `L ${ix1} ${iy1}`,
            `A ${ir} ${ir} 0 ${large} 0 ${ix2} ${iy2}`,
            'Z',
          ].join(' ');
          return (
            <path key={s.label} d={d} fill={s.color}>
              <title>{`${s.label}: ${s.value} (${s.percent}%)`}</title>
            </path>
          );
        })}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fill="#e2e8f0"
          fontSize="16"
          fontWeight="700"
        >
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill={C.slate} fontSize="9">
          tickets
        </text>
      </svg>
      <ul className="flex-1 space-y-1 max-h-[180px] overflow-y-auto custom-scroll text-[11px] w-full">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="truncate text-slate-300 flex-1" title={s.label}>
              {s.label}
            </span>
            <span className="font-mono text-slate-500 tabular-nums">
              {s.value}
              <span className="text-slate-600 ml-1">{s.percent}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars: assigned / resolved / outstanding */
function WorkloadBars({ data, limit = 8, onSelectEngineer }) {
  const rows = (data || []).slice(0, limit);
  if (!rows.length) return <EmptyState message="No engineer workload in scope" />;
  const max = Math.max(
    ...rows.map((r) => Math.max(r.assigned || 0, r.resolved || 0, r.outstanding || 0)),
    1
  );
  const metrics = [
    { key: 'assigned', label: 'Assigned (in scope)', color: '#6366f1' },
    { key: 'resolved', label: 'Resolved (current status)', color: '#34d399' },
    { key: 'outstanding', label: 'Outstanding (open + in progress)', color: '#fbbf24' },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
        {metrics.map((m) => (
          <span key={m.key} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: m.color }} />
            {m.label}
          </span>
        ))}
      </div>
      <div className="space-y-3.5 max-h-[320px] overflow-y-auto custom-scroll pr-1">
        {rows.map((r) => (
          <div key={r.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <button
                type="button"
                className="text-[12px] text-slate-200 font-semibold truncate text-left hover:text-indigo-300 transition"
                title={`Filter report to ${r.label}`}
                onClick={() => onSelectEngineer && onSelectEngineer(r.label)}
              >
                {r.label}
              </button>
              <span className="font-mono text-[10px] text-slate-500 tabular-nums shrink-0">
                {r.assigned} / {r.resolved} / {r.outstanding}
              </span>
            </div>
            <div className="space-y-1">
              {metrics.map((m) => {
                const v = r[m.key] || 0;
                return (
                  <div key={m.key} className="flex items-center gap-2">
                    <span className="w-16 text-[9px] text-slate-500 shrink-0 capitalize">{m.key}</span>
                    <div className="flex-1 h-2 rounded-sm bg-[#0B0F19] border border-[#1F2937] overflow-hidden">
                      <div
                        className="h-full rounded-sm transition-all"
                        style={{
                          width: `${Math.round((v / max) * 100)}%`,
                          background: m.color,
                          minWidth: v > 0 ? '2px' : 0,
                        }}
                        title={`${m.label}: ${v}`}
                      />
                    </div>
                    <span className="w-7 text-right font-mono text-[10px] text-slate-400 tabular-nums">
                      {v}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-600">
        Assigned / resolved / outstanding use the same filtered ticket scope. Click an engineer
        name to scope the full report to that person.
      </p>
    </div>
  );
}

/** Vertical priority bars */
function PriorityBars({ data }) {
  if (!data?.length) return <EmptyState message="No priority data" />;
  const max = Math.max(...data.map((d) => d.value), 1);
  const h = 140;
  const barW = 36;
  const gap = 28;
  const w = data.length * (barW + gap) + 40;

  return (
    <div className="w-full overflow-x-auto custom-scroll">
      <svg
        width={Math.max(w, 280)}
        height={h + 36}
        className="mx-auto"
        role="img"
        aria-label="Priority breakdown"
      >
        {data.map((d, i) => {
          const x = 24 + i * (barW + gap);
          const bh = Math.max(2, (d.value / max) * h);
          const y = h - bh + 8;
          const fill = PRIORITY_COLORS[d.label] || C.slate;
          return (
            <g key={d.label}>
              <rect x={x} y={y} width={barW} height={bh} rx="3" fill={fill}>
                <title>{`${d.label}: ${d.value} (${d.percent}%)`}</title>
              </rect>
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="10"
                fontWeight="600"
              >
                {d.value}
              </text>
              <text
                x={x + barW / 2}
                y={h + 24}
                textAnchor="middle"
                fill={C.muted}
                fontSize="10"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ComparisonStrip({ comparison }) {
  if (!comparison) return null;
  const { current, previous, createdDeltaPct, resolvedDeltaPct, prevFrom, prevTo } = comparison;

  function Delta({ value }) {
    if (value == null) return <span className="text-slate-600">n/a</span>;
    if (value === 0) return <span className="text-slate-500">0%</span>;
    const up = value > 0;
    return (
      <span className={up ? 'text-amber-400' : 'text-emerald-400'}>
        {up ? '+' : ''}
        {value}%
      </span>
    );
  }

  return (
    <div
      className="border border-[#1F2937] bg-[#111827] px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px]"
      aria-label="Period comparison"
    >
      <div>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
          vs previous period
        </span>
        <p className="text-slate-600 text-[10px] mt-0.5">
          {prevFrom} → {prevTo}
        </p>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-slate-500">Created</span>
        <span className="font-mono text-slate-200">{current.created}</span>
        <span className="text-slate-600">vs {previous.created}</span>
        <Delta value={createdDeltaPct} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-slate-500">Resolved</span>
        <span className="font-mono text-slate-200">{current.resolved}</span>
        <span className="text-slate-600">vs {previous.resolved}</span>
        <Delta value={resolvedDeltaPct} />
      </div>
      <p className="text-[9px] text-slate-600 sm:ml-auto">
        Comparison uses the equivalent prior window. Resolved timing uses updated_at.
      </p>
    </div>
  );
}

export default function ReportCharts({
  trend,
  statusDist,
  priorityDist,
  workload,
  comparison,
  loading,
  singleEngineer,
  onDrillDay,
  onSelectEngineer,
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <ChartCard key={i} title="Loading…">
            <EmptyState message="Loading analytics…" />
          </ChartCard>
        ))}
      </div>
    );
  }

  const granLabel =
    trend?.granularity === 'month' ? 'monthly' : trend?.granularity === 'week' ? 'weekly' : 'daily';

  return (
    <div className="space-y-3">
      <ComparisonStrip comparison={comparison} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard
          title="Ticket activity trend"
          subtitle={`Created vs resolved · ${granLabel} buckets`}
          className="lg:col-span-2"
        >
          <TrendChart series={trend} onDrillDay={onDrillDay} />
        </ChartCard>

        <ChartCard title="Status distribution" subtitle="Counts and share in current scope">
          <StatusDonut data={statusDist} />
        </ChartCard>

        <ChartCard title="Priority breakdown" subtitle="Counts by priority">
          <PriorityBars data={priorityDist} />
        </ChartCard>

        <ChartCard
          title={singleEngineer ? `Workload · ${singleEngineer}` : 'Engineer workload'}
          subtitle={
            singleEngineer
              ? 'Assigned · resolved · outstanding for this engineer only'
              : 'Assigned · resolved · outstanding (top 8)'
          }
          className="lg:col-span-2"
        >
          <WorkloadBars
            data={workload}
            limit={singleEngineer ? 5 : 10}
            onSelectEngineer={singleEngineer ? undefined : onSelectEngineer}
          />
        </ChartCard>
      </div>
    </div>
  );
}
