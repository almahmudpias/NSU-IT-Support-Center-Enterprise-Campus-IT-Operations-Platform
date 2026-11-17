import { Fragment } from 'react';
import {
  COLUMN_DEFS,
  DATE_BASIS,
  REPORT_TYPES,
  periodLabel,
  primaryEngineer,
  selectedEngineerLabel,
  ticketWorkspace,
} from './reportUtils';

function fmtDateTime(raw) {
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleString(undefined, {
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

function cellValue(t, key) {
  if (key === 'id') return `#${t.id}`;
  if (key === 'engineer') return primaryEngineer(t);
  if (key === 'workspace') {
    const w = ticketWorkspace(t);
    return w === '6004' ? 'Support Workstation' : 'Campus Support';
  }
  if (key === 'created_at' || key === 'updated_at' || key === 'resolved_at') {
    if (key === 'resolved_at') {
      // Prefer dedicated field; show unavailable for open tickets without stamp
      if (t.resolved_at) return fmtDateTime(t.resolved_at);
      if (String(t.status || '') === 'Resolved' && t.updated_at) return fmtDateTime(t.updated_at) + ' (legacy)';
      return '—';
    }
    return fmtDateTime(t[key]);
  }
  if (key === 'description') {
    const s = t.description || '—';
    return s.length > 90 ? `${s.slice(0, 87)}…` : s;
  }
  return t[key] != null && t[key] !== '' ? String(t[key]) : '—';
}

function workspaceLabel(config) {
  if (config.workspace === '1400') return 'Campus Support';
  if (config.workspace === '6004') return 'Support Workstation';
  return 'All Workspaces';
}

function ReportCoverHeader({ isIndividual, engineerName, when }) {
  return (
    <header className="pr-header">
      <div>
        <p className="pr-org">North South University</p>
        <p className="pr-center">IT Support Center</p>
        <h1 className="pr-title">
          {isIndividual ? (
            <>
              Engineer
              <br />
              Performance Report
            </>
          ) : (
            <>
              IT Service Operations
              <br />
              Performance Report
            </>
          )}
        </h1>
        {isIndividual ? (
          <p className="pr-subtitle">Engineer: {engineerName}</p>
        ) : (
          <p className="pr-subtitle">Scope: All Engineers / Selected Organizational Filters</p>
        )}
      </div>
      <div className="pr-header-right">
        <div>
          Generated
          <br />
          <strong>{when}</strong>
        </div>
        <div style={{ marginTop: 10 }}>Document classification</div>
        <strong>Internal operational use</strong>
      </div>
    </header>
  );
}

function ReportMetadata({ config, totalRows }) {
  const basis = DATE_BASIS.find((d) => d.id === config.dateBasis)?.label || config.dateBasis;
  const typeLabel = REPORT_TYPES.find((t) => t.id === config.reportType)?.label || config.reportType;
  return (
    <div className="pr-meta">
      <div className="pr-meta-row">
        <span className="k">Reporting period</span>
        <span className="v">{periodLabel(config)}</span>
      </div>
      <div className="pr-meta-row">
        <span className="k">Engineer scope</span>
        <span className="v">{selectedEngineerLabel(config)}</span>
      </div>
      <div className="pr-meta-row">
        <span className="k">Workspace</span>
        <span className="v">{workspaceLabel(config)}</span>
      </div>
      <div className="pr-meta-row">
        <span className="k">Date basis</span>
        <span className="v">{basis}</span>
      </div>
      <div className="pr-meta-row">
        <span className="k">Report type</span>
        <span className="v">{typeLabel}</span>
      </div>
      <div className="pr-meta-row">
        <span className="k">Tickets in scope</span>
        <span className="v">{Number(totalRows || 0).toLocaleString()}</span>
      </div>
    </div>
  );
}

function ExecutiveSummary({ config, kpis, totalRows, isIndividual, engineerName }) {
  const period = periodLabel(config);
  return (
    <section className="pr-section avoid-break">
      <h2 className="pr-h2">1. Executive summary</h2>
      <p className="pr-lead">
        {isIndividual ? (
          <>
            This report summarizes IT support activity for <strong>{engineerName}</strong> over{' '}
            <strong>{period}</strong>. Figures below reflect only tickets attributed to this
            engineer under the selected filters.
          </>
        ) : (
          <>
            This report summarizes IT Support Center operations for <strong>{period}</strong>.
            Metrics cover the filtered organizational scope shown in the report header.
          </>
        )}{' '}
        The register includes <strong>{Number(totalRows || 0).toLocaleString()}</strong> ticket
        {totalRows === 1 ? '' : 's'}. <strong>{kpis.createdInPeriod}</strong> were created in the
        period and <strong>{kpis.resolvedInPeriod}</strong> carry a Resolved status with an update
        timestamp in the period. <strong>{kpis.outstanding}</strong> remain outstanding (Open or
        in progress). Created volume and resolution volume are independent measures and are not
        assumed equal.
      </p>

      <div className="pr-kpi-strip">
        <div className="pr-kpi">
          <p className="lbl">Tickets in scope</p>
          <p className="val">{Number(kpis.total || 0).toLocaleString()}</p>
        </div>
        <div className="pr-kpi">
          <p className="lbl">Created in period</p>
          <p className="val">{Number(kpis.createdInPeriod || 0).toLocaleString()}</p>
          <p className="hint">by created_at</p>
        </div>
        <div className="pr-kpi">
          <p className="lbl">Resolved in period</p>
          <p className="val">{Number(kpis.resolvedInPeriod || 0).toLocaleString()}</p>
          <p className="hint">Resolved · updated_at</p>
        </div>
        <div className="pr-kpi">
          <p className="lbl">Outstanding</p>
          <p className="val">{Number(kpis.outstanding || 0).toLocaleString()}</p>
          <p className="hint">Open + in progress</p>
        </div>
      </div>

      <div className="pr-kpi-strip secondary">
        <div className="pr-kpi">
          <p className="lbl">Open now</p>
          <p className="val">{Number(kpis.open || 0).toLocaleString()}</p>
        </div>
        <div className="pr-kpi">
          <p className="lbl">In progress now</p>
          <p className="val">{Number(kpis.inProgress || 0).toLocaleString()}</p>
        </div>
        <div className="pr-kpi">
          <p className="lbl">High priority</p>
          <p className="val">{Number(kpis.highPriority || 0).toLocaleString()}</p>
        </div>
        <div className="pr-kpi">
          <p className="lbl">Critical</p>
          <p className="val">{Number(kpis.critical || 0).toLocaleString()}</p>
        </div>
      </div>

      {kpis.avgResolutionHours != null && (
        <p className="pr-caption">
          Approximate mean resolution time:{' '}
          <strong>{kpis.avgResolutionHours} hours</strong> across {kpis.avgResolutionSample}{' '}
          Resolved ticket{kpis.avgResolutionSample === 1 ? '' : 's'} with both created_at and
          updated_at. This is not an SLA clock; the system does not store a dedicated resolved_at
          field.
        </p>
      )}

      {totalRows === 0 && (
        <p className="pr-empty" style={{ marginTop: 12 }}>
          No tickets matched the selected configuration. Adjust filters or the reporting period
          and generate the report again.
        </p>
      )}
    </section>
  );
}

function PrintTrend({ series }) {
  const points = series?.points || [];
  if (!points.length) {
    return <p className="pr-empty">No activity trend for this period.</p>;
  }
  const w = 560;
  const h = 150;
  const padL = 32;
  const padR = 10;
  const padT = 12;
  const padB = 22;
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
    <div className="pr-figure">
      <p className="pr-figure-title">Ticket activity trend — created vs resolved</p>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Activity trend">
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={w - padR}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <text x={padL - 6} y={yAt(t) + 3} textAnchor="end" fill="#94a3b8" fontSize="9">
              {t}
            </text>
          </g>
        ))}
        <path d={path('created')} fill="none" stroke="#4338ca" strokeWidth="2" />
        <path
          d={path('resolved')}
          fill="none"
          stroke="#047857"
          strokeWidth="2"
          strokeDasharray="5 4"
        />
        <text x={padL} y={h - 4} fill="#64748b" fontSize="9">
          {points[0]?.date}
        </text>
        <text x={w - padR} y={h - 4} textAnchor="end" fill="#64748b" fontSize="9">
          {points[points.length - 1]?.date}
        </text>
      </svg>
      <div className="pr-legend">
        <span>
          <i className="pr-swatch" style={{ background: '#4338ca' }} /> Created
        </span>
        <span>
          <i className="pr-swatch" style={{ background: '#047857' }} /> Resolved
        </span>
      </div>
      <p className="pr-caption">
        Resolved series uses updated_at when status is Resolved. Aggregation follows the selected
        period length (daily, weekly, or monthly buckets).
      </p>
    </div>
  );
}

function PrintBars({ title, items, caption }) {
  if (!items?.length) return null;
  const max = Math.max(...items.map((i) => i.value), 1);
  const rows = items.slice(0, 8);
  return (
    <div className="pr-figure">
      <p className="pr-figure-title">{title}</p>
      {rows.map((item) => (
        <div key={item.label} style={{ marginBottom: 7 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '8.5pt',
              marginBottom: 2,
            }}
          >
            <span style={{ color: '#1e293b', fontWeight: 500 }}>{item.label}</span>
            <span className="num" style={{ color: '#64748b' }}>
              {item.value}
              {item.percent != null ? ` · ${item.percent}%` : ''}
            </span>
          </div>
          <div
            style={{
              height: 7,
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.round((item.value / max) * 100)}%`,
                height: '100%',
                background: '#4338ca',
              }}
            />
          </div>
        </div>
      ))}
      {caption && <p className="pr-caption">{caption}</p>}
    </div>
  );
}

function EngineerPerformanceTable({ rows }) {
  if (!rows?.length) return null;
  return (
    <section className="pr-section">
      <h2 className="pr-h2">3. Engineer performance summary</h2>
      <p className="pr-caption" style={{ marginBottom: 8 }}>
        Assigned counts tickets attributed to each engineer in scope. Resolved and outstanding
        reflect current status within that same set. Assigned is not assumed equal to resolved.
      </p>
      <table className="pr-table">
        <thead>
          <tr>
            <th>Engineer</th>
            <th className="right">Assigned</th>
            <th className="right">Open</th>
            <th className="right">In progress</th>
            <th className="right">Resolved</th>
            <th className="right">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.engineer}>
              <td>{r.engineer}</td>
              <td className="right num">{r.assigned}</td>
              <td className="right num">{r.open}</td>
              <td className="right num">{r.inProgress}</td>
              <td className="right num">{r.resolved}</td>
              <td className="right num">
                <strong>{r.outstanding}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DetailedTicketRegister({ groups, columns, totalRows }) {
  const colDefs = COLUMN_DEFS.filter((c) => columns.includes(c.key));
  return (
    <section className="pr-section">
      <h2 className="pr-h2">4. Detailed ticket register</h2>
      <p className="pr-caption" style={{ marginBottom: 8 }}>
        Complete list of tickets included in this report scope. Status and engineer fields reflect
        current system values at generation time.
      </p>
      {totalRows === 0 ? (
        <p className="pr-empty">No rows to display.</p>
      ) : (
        <table className="pr-table">
          <thead>
            <tr>
              {colDefs.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(groups || []).map((g) => (
              <Fragment key={g.key}>
                {g.label != null && (
                  <tr className="group">
                    <td colSpan={colDefs.length}>
                      {g.label} · {g.tickets.length} ticket{g.tickets.length === 1 ? '' : 's'}
                    </td>
                  </tr>
                )}
                {g.tickets.map((t) => (
                  <tr key={t.id}>
                    {colDefs.map((c) => (
                      <td key={c.key} className={c.key === 'id' || c.key === 'created_at' ? 'num' : ''}>
                        {cellValue(t, c.key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
      {totalRows > 0 && (
        <p className="pr-caption" style={{ marginTop: 8 }}>
          End of register · {Number(totalRows).toLocaleString()} ticket
          {totalRows === 1 ? '' : 's'}
        </p>
      )}
    </section>
  );
}

function PrintableReportFooter({ when, period }) {
  return (
    <footer className="pr-footer">
      <div className="pr-footer-main">
        <span>
          Report generated by <strong>NSU IT Support Center</strong>
        </span>
        <span className="pr-footer-meta">
          Period: {period} · Generated {when} · Internal use only
        </span>
      </div>
      <div className="pr-footer-credit">
        Developed by A. Al Mahmud Pias
        <span className="pr-page-num" />
      </div>
    </footer>
  );
}

/**
 * Professional printable / preview document.
 * Same metrics as the interactive dashboard — separate white-paper presentation.
 */
export default function PrintableReport({
  config,
  kpis,
  trend,
  statusDist,
  priorityDist,
  engPerf,
  groups,
  columns,
  generatedAt,
  totalRows,
  landscape = false,
  layoutMode = 'full', // full | executive
}) {
  const isIndividual = config.engineers?.length === 1;
  const engineerName = isIndividual ? config.engineers[0] : null;
  const when = generatedAt
    ? new Date(generatedAt).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString();
  const period = periodLabel(config);
  const showEngTable =
    engPerf?.length > 0 &&
    (config.reportType === 'engineer' || config.groupBy === 'engineer') &&
    !isIndividual;

  return (
    <>
      <article
        className={`printable-report${landscape ? ' landscape-doc' : ''}${layoutMode === 'executive' ? ' executive-mode' : ''}`}
        id="printable-report"
        aria-label="IT service operations performance report"
      >
        <ReportCoverHeader isIndividual={isIndividual} engineerName={engineerName} when={when} />
        <ReportMetadata config={config} totalRows={totalRows} />

        <ExecutiveSummary
          config={config}
          kpis={kpis}
          totalRows={totalRows}
          isIndividual={isIndividual}
          engineerName={engineerName}
        />

        {totalRows > 0 && (
          <section className="pr-section avoid-break">
            <h2 className="pr-h2">2. Workload and activity analysis</h2>
            <PrintTrend series={trend} />
            <div className="pr-figures" style={{ marginTop: 16 }}>
              <PrintBars
                title="Status distribution"
                items={statusDist}
                caption="Share of tickets by current status within report scope."
              />
              <PrintBars
                title="Priority breakdown"
                items={priorityDist}
                caption="Counts by priority field on tickets in scope."
              />
            </div>
          </section>
        )}

        {showEngTable && <EngineerPerformanceTable rows={engPerf} />}

        {layoutMode === 'executive' ? (
          <section className="pr-section avoid-break">
            <h2 className="pr-h2">4. Detail register</h2>
            <p className="pr-lead">
              Executive one-page mode omits the full ticket register
              ({Number(totalRows || 0).toLocaleString()} matching ticket
              {totalRows === 1 ? '' : 's'}). Choose <strong>Full detailed report</strong> in
              print options to include every row across multiple pages.
            </p>
          </section>
        ) : (
          <DetailedTicketRegister groups={groups} columns={columns} totalRows={totalRows} />
        )}

        <PrintableReportFooter when={when} period={period} />
      </article>
      <p className="pr-screen-note print-hide">
        Preview of the printable document · Use Print / Save as PDF from the toolbar above
      </p>
    </>
  );
}
