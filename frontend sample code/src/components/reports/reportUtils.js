/** Service Analytics helpers — pure functions over real ticket rows only */

export const DESK_STATUSES = ['Open', 'In Progress', 'Waiting for Device'];
export const LAB_STATUSES = [
  'Brought to Helpdesk',
  'Sent to Lab 6004',
  'In Diagnostics',
  'Waiting for Parts',
  'In Hardware Lab',
];

export const ALL_STATUSES = [
  'Open',
  'In Progress',
  'Waiting for Device',
  'Brought to Helpdesk',
  'Sent to Lab 6004',
  'In Diagnostics',
  'Waiting for Parts',
  'In Hardware Lab',
  'Resolved',
];

export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

/** Report templates — drive defaults for groupBy / filters / columns */
export const REPORT_TYPES = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Organization-wide volume, status mix, and trends',
  },
  {
    id: 'engineer',
    label: 'Engineer performance',
    description: 'Workload, assignments, resolved, and outstanding by engineer',
  },
  {
    id: 'operations',
    label: 'Ticket operations',
    description: 'Status, priority, workspace, and creation patterns',
  },
  {
    id: 'unassigned',
    label: 'Unassigned tickets',
    description: 'Tickets with no desk or lab engineer',
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Full control over filters, grouping, and columns',
  },
];

export const PERIOD_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'last_30', label: 'Last 30 days' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom range' },
];

/** Date basis: which timestamp the period applies to */
export const DATE_BASIS = [
  {
    id: 'created',
    label: 'Created in period',
    help: 'Includes tickets whose created_at falls in the selected period.',
  },
  {
    id: 'resolved',
    label: 'Resolved in period',
    help: 'Includes tickets with resolved_at in the period, or Resolved + updated_at for legacy rows without resolved_at.',
  },
  {
    id: 'either',
    label: 'Created or resolved in period',
    help: 'Union of created-in-period and resolved-in-period tickets.',
  },
];

export const COLUMN_DEFS = [
  { key: 'id', label: 'ID', default: true },
  { key: 'user_name', label: 'Requester', default: true },
  { key: 'description', label: 'Issue', default: true },
  { key: 'engineer', label: 'Engineer', default: true },
  { key: 'workspace', label: 'Workspace', default: true },
  { key: 'status', label: 'Status', default: true },
  { key: 'priority', label: 'Priority', default: true },
  { key: 'issue_category', label: 'Category', default: false },
  { key: 'department', label: 'Department', default: false },
  { key: 'building', label: 'Building', default: false },
  { key: 'created_at', label: 'Opened', default: true },
  { key: 'resolved_at', label: 'Resolved at', default: true },
  { key: 'updated_at', label: 'Updated', default: false },
];

export const DEFAULT_CONFIG = {
  reportType: 'overview',
  period: 'month',
  customFrom: '',
  customTo: '',
  dateBasis: 'created',
  engineers: [],
  workspace: '',
  statuses: [],
  priorities: [],
  groupBy: 'none',
  sortKey: 'created_at',
  sortDir: 'desc',
  columns: COLUMN_DEFS.filter((c) => c.default).map((c) => c.key),
};

/** Apply report-type preset defaults (preserves period/dates) */
export function applyReportTypeDefaults(prev, reportTypeId) {
  const base = { ...prev, reportType: reportTypeId };
  switch (reportTypeId) {
    case 'overview':
      return {
        ...base,
        engineers: [],
        workspace: '',
        statuses: [],
        priorities: [],
        groupBy: 'none',
        dateBasis: 'created',
        sortKey: 'created_at',
        sortDir: 'desc',
        columns: COLUMN_DEFS.filter((c) => c.default).map((c) => c.key),
      };
    case 'engineer':
      return {
        ...base,
        engineers: [],
        workspace: '',
        statuses: [],
        priorities: [],
        groupBy: 'engineer',
        dateBasis: 'created',
        sortKey: 'created_at',
        sortDir: 'desc',
        columns: ['id', 'user_name', 'description', 'engineer', 'status', 'priority', 'created_at'],
      };
    case 'operations':
      return {
        ...base,
        engineers: [],
        workspace: '',
        statuses: [],
        priorities: [],
        groupBy: 'status',
        dateBasis: 'created',
        sortKey: 'created_at',
        sortDir: 'desc',
        columns: ['id', 'user_name', 'workspace', 'status', 'priority', 'issue_category', 'created_at'],
      };
    case 'unassigned':
      return {
        ...base,
        engineers: ['Unassigned'],
        workspace: '',
        statuses: [],
        priorities: [],
        groupBy: 'none',
        dateBasis: 'created',
        sortKey: 'created_at',
        sortDir: 'desc',
        columns: ['id', 'user_name', 'description', 'status', 'priority', 'workspace', 'created_at'],
      };
    case 'custom':
    default:
      return { ...base, reportType: 'custom' };
  }
}

export function ticketWorkspace(t) {
  const s = String(t.status || '');
  if (LAB_STATUSES.includes(s) || t.lab_engineer || t.hw_type) return '6004';
  if (DESK_STATUSES.includes(s) || s === 'Resolved') return '1400';
  if (s.toLowerCase().includes('lab')) return '6004';
  return '1400';
}

export function primaryEngineer(t) {
  return t.assigned_engineer || t.lab_engineer || 'Unassigned';
}

export function isUnassigned(t) {
  return !t.assigned_engineer && !t.lab_engineer;
}

export function isOpenStatus(status) {
  return status === 'Open';
}

export function isInProgressStatus(status) {
  const s = String(status || '');
  if (s === 'Resolved' || s === 'Open') return false;
  return (
    s.includes('Progress') ||
    s.includes('Diagnostic') ||
    LAB_STATUSES.includes(s) ||
    s === 'Waiting for Device'
  );
}

export function isResolvedStatus(status) {
  return status === 'Resolved';
}

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function toDateInputValue(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function rangeForPeriod(period, customFrom, customTo) {
  const now = new Date();
  if (period === 'custom') {
    const from = customFrom ? startOfDay(customFrom) : null;
    const to = customTo ? endOfDay(customTo) : null;
    return { from, to };
  }
  if (period === 'today') {
    return { from: startOfDay(now), to: endOfDay(now) };
  }
  if (period === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: startOfDay(y), to: endOfDay(y) };
  }
  if (period === 'week') {
    const from = startOfDay(now);
    from.setDate(from.getDate() - 6);
    return { from, to: endOfDay(now) };
  }
  if (period === 'last_week') {
    // Previous Mon–Sun relative to this week (Mon start)
    const day = now.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const thisMon = startOfDay(now);
    thisMon.setDate(thisMon.getDate() + diffToMon);
    const lastMon = new Date(thisMon);
    lastMon.setDate(lastMon.getDate() - 7);
    const lastSun = endOfDay(new Date(thisMon.getTime() - 1));
    return { from: startOfDay(lastMon), to: lastSun };
  }
  if (period === 'month') {
    return {
      from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: endOfDay(now),
    };
  }
  if (period === 'last_month') {
    const from = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
    return { from, to };
  }
  if (period === 'last_30') {
    const from = startOfDay(now);
    from.setDate(from.getDate() - 29);
    return { from, to: endOfDay(now) };
  }
  return { from: null, to: null };
}

/** Returns error string or null */
export function validateConfig(config) {
  if (config.period === 'custom') {
    if (config.customFrom && config.customTo) {
      const a = startOfDay(config.customFrom);
      const b = startOfDay(config.customTo);
      if (a > b) return 'Start date must be on or before end date.';
    }
  }
  return null;
}

function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

/** Preferred resolution timestamp: resolved_at, else legacy Resolved+updated_at */
export function resolutionTimestamp(t) {
  if (t?.resolved_at) return t.resolved_at;
  if (isResolvedStatus(t?.status) && t?.updated_at) return t.updated_at;
  return null;
}

function matchesDateBasis(t, basis, from, to) {
  if (!from && !to) return true;
  if (basis === 'created') {
    return inRange(t.created_at, from, to);
  }
  if (basis === 'resolved') {
    const rt = resolutionTimestamp(t);
    if (!rt) return false;
    // Prefer true resolution event; for legacy require current Resolved status
    if (!t.resolved_at && !isResolvedStatus(t.status)) return false;
    return inRange(rt, from, to);
  }
  // either
  const createdOk = inRange(t.created_at, from, to);
  const rt = resolutionTimestamp(t);
  const resolvedOk =
    rt &&
    (t.resolved_at || isResolvedStatus(t.status)) &&
    inRange(rt, from, to);
  return createdOk || resolvedOk;
}

export function filterTickets(tickets, config) {
  const { from, to } = rangeForPeriod(config.period, config.customFrom, config.customTo);
  const engSet = config.engineers?.length ? new Set(config.engineers) : null;
  const statusSet = config.statuses?.length ? new Set(config.statuses) : null;
  const priSet = config.priorities?.length ? new Set(config.priorities) : null;
  const basis = config.dateBasis || 'created';

  return (tickets || []).filter((t) => {
    if (!matchesDateBasis(t, basis, from, to)) return false;

    if (engSet) {
      const desk = t.assigned_engineer || '';
      const lab = t.lab_engineer || '';
      const unassigned = !desk && !lab;
      let match = false;
      if (engSet.has('Unassigned') && unassigned) match = true;
      if (desk && engSet.has(desk)) match = true;
      if (lab && engSet.has(lab)) match = true;
      if (!match) return false;
    }

    if (config.workspace === '1400' || config.workspace === '6004') {
      if (ticketWorkspace(t) !== config.workspace) return false;
    }

    if (statusSet && !statusSet.has(t.status)) return false;
    if (priSet && !priSet.has(t.priority || 'Medium')) return false;

    return true;
  });
}

/**
 * KPIs with explicit semantics.
 * - createdInPeriod: tickets with created_at in range (ignores dateBasis for this counter)
 * - resolvedInPeriod: Resolved + updated_at in range
 * - open/inProgress/resolved: current status among tickets matching the full config filter
 */
export function computeKpis(filtered, allTickets, config) {
  const { from, to } = rangeForPeriod(config.period, config.customFrom, config.customTo);

  let open = 0;
  let inProgress = 0;
  let resolved = 0;
  (filtered || []).forEach((t) => {
    if (isResolvedStatus(t.status)) resolved += 1;
    else if (isOpenStatus(t.status)) open += 1;
    else inProgress += 1;
  });

  // Volume metrics always use full ticket set + period (not engineer filters)
  // so "created in period" is honest organization volume when type is overview.
  // For scoped reports, use filtered set for consistency with the table.
  const scope = filtered || [];
  let createdInPeriod = 0;
  let resolvedInPeriod = 0;
  scope.forEach((t) => {
    if (!from && !to) {
      createdInPeriod += 1;
    } else if (inRange(t.created_at, from, to)) {
      createdInPeriod += 1;
    }
    const rt = resolutionTimestamp(t);
    if (!rt) return;
    if (!t.resolved_at && !isResolvedStatus(t.status)) return;
    if (!from && !to) {
      resolvedInPeriod += 1;
    } else if (inRange(rt, from, to)) {
      resolvedInPeriod += 1;
    }
  });

  let highPriority = 0;
  let critical = 0;
  scope.forEach((t) => {
    const p = t.priority || '';
    if (p === 'High') highPriority += 1;
    if (p === 'Critical') critical += 1;
  });

  // Mean resolution hours: created_at → resolved_at (or legacy updated_at when Resolved)
  let resHoursSum = 0;
  let resHoursN = 0;
  scope.forEach((t) => {
    const rt = resolutionTimestamp(t);
    if (!rt || !t.created_at) return;
    if (!t.resolved_at && !isResolvedStatus(t.status)) return;
    const a = new Date(t.created_at).getTime();
    const b = new Date(rt).getTime();
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) return;
    resHoursSum += (b - a) / 3600000;
    resHoursN += 1;
  });

  return {
    total: scope.length,
    open,
    inProgress,
    resolved,
    createdInPeriod,
    resolvedInPeriod,
    outstanding: open + inProgress,
    highPriority,
    critical,
    avgResolutionHours: resHoursN > 0 ? Math.round((resHoursSum / resHoursN) * 10) / 10 : null,
    avgResolutionSample: resHoursN,
  };
}

/** Bucket granularity from selected period span */
export function trendGranularity(config) {
  const { from, to } = rangeForPeriod(config.period, config.customFrom, config.customTo);
  if (!from || !to) {
    // all-time: prefer weekly if many months of data likely
    return 'week';
  }
  const days = Math.max(1, Math.round((to - from) / 86400000) + 1);
  if (days <= 14) return 'day';
  if (days <= 90) return 'week';
  return 'month';
}

function bucketKey(date, granularity) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  if (granularity === 'day') return toDateInputValue(d);
  if (granularity === 'month') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  // week: ISO-like Monday start label
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return `W ${toDateInputValue(mon)}`;
}

/**
 * Activity trend: created vs resolved counts per bucket.
 * Resolved uses resolved_at when present; else updated_at for currently Resolved rows.
 */
export function trendSeries(tickets, config) {
  const granularity = config ? trendGranularity(config) : 'day';
  const map = new Map();

  function bump(key, field) {
    if (!key) return;
    if (!map.has(key)) map.set(key, { date: key, created: 0, resolved: 0 });
    map.get(key)[field] += 1;
  }

  (tickets || []).forEach((t) => {
    if (t.created_at) bump(bucketKey(t.created_at, granularity), 'created');
  });
  (tickets || []).forEach((t) => {
    const raw = resolutionTimestamp(t);
    if (!raw) return;
    if (!t.resolved_at && !isResolvedStatus(t.status)) return;
    bump(bucketKey(raw, granularity), 'resolved');
  });

  const keys = [...map.keys()].sort();
  const maxBuckets = granularity === 'day' ? 31 : granularity === 'week' ? 16 : 18;
  return {
    granularity,
    points: keys.slice(-maxBuckets).map((k) => map.get(k)),
  };
}

export function statusDistribution(tickets) {
  const map = {};
  let total = 0;
  (tickets || []).forEach((t) => {
    const s = t.status || 'Unknown';
    map[s] = (map[s] || 0) + 1;
    total += 1;
  });
  return Object.entries(map)
    .map(([label, value]) => ({
      label,
      value,
      percent: total > 0 ? Math.round((value / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export function priorityDistribution(tickets) {
  const map = {};
  let total = 0;
  (tickets || []).forEach((t) => {
    const p = t.priority || 'Medium';
    map[p] = (map[p] || 0) + 1;
    total += 1;
  });
  return PRIORITIES.filter((p) => map[p])
    .concat(Object.keys(map).filter((k) => !PRIORITIES.includes(k)))
    .map((label) => ({
      label,
      value: map[label] || 0,
      percent: total > 0 ? Math.round(((map[label] || 0) / total) * 1000) / 10 : 0,
    }))
    .filter((r) => r.value > 0);
}

/** Assigned volume only (one count per ticket per distinct engineer name) */
export function engineerWorkload(tickets) {
  return engineerPerformance(tickets).map((r) => ({
    label: r.engineer,
    value: r.assigned,
    assigned: r.assigned,
    resolved: r.resolved,
    outstanding: r.outstanding,
  }));
}

/**
 * Previous equivalent period comparison for created/resolved volume.
 * Only when current period has a bounded range (not all-time).
 */
export function periodComparison(allTickets, config) {
  const { from, to } = rangeForPeriod(config.period, config.customFrom, config.customTo);
  if (!from || !to) return null;

  const span = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - span);

  // Same non-date filters as the report scope
  const scoped = filterTickets(allTickets, {
    ...config,
    period: 'all',
    customFrom: '',
    customTo: '',
    dateBasis: 'created',
  });

  function counts(fromD, toD) {
    let created = 0;
    let resolved = 0;
    scoped.forEach((t) => {
      if (inRange(t.created_at, fromD, toD)) created += 1;
      const rt = resolutionTimestamp(t);
      if (rt && (t.resolved_at || isResolvedStatus(t.status)) && inRange(rt, fromD, toD)) {
        resolved += 1;
      }
    });
    return { created, resolved };
  }

  const current = counts(from, to);
  const previous = counts(prevFrom, prevTo);

  function delta(cur, prev) {
    if (prev === 0) return cur === 0 ? 0 : null;
    return Math.round(((cur - prev) / prev) * 1000) / 10;
  }

  return {
    current,
    previous,
    createdDeltaPct: delta(current.created, previous.created),
    resolvedDeltaPct: delta(current.resolved, previous.resolved),
    prevFrom: toDateInputValue(prevFrom),
    prevTo: toDateInputValue(prevTo),
  };
}



/** Per-engineer performance from filtered tickets (assignment ≠ resolution) */
export function engineerPerformance(tickets) {
  const map = new Map();

  function ensure(name) {
    if (!map.has(name)) {
      map.set(name, {
        engineer: name,
        assigned: 0,
        open: 0,
        inProgress: 0,
        resolved: 0,
        outstanding: 0,
        highPriority: 0,
        critical: 0,
        resHoursSum: 0,
        resHoursN: 0,
      });
    }
    return map.get(name);
  }

  (tickets || []).forEach((t) => {
    const names = [t.assigned_engineer, t.lab_engineer].filter(Boolean);
    const list = names.length ? [...new Set(names)] : ['Unassigned'];
    list.forEach((name) => {
      const row = ensure(name);
      row.assigned += 1;
      if (isResolvedStatus(t.status)) row.resolved += 1;
      else if (isOpenStatus(t.status)) row.open += 1;
      else row.inProgress += 1;
      if (t.priority === 'High') row.highPriority += 1;
      if (t.priority === 'Critical') row.critical += 1;
      const rt = resolutionTimestamp(t);
      if (rt && t.created_at && (t.resolved_at || isResolvedStatus(t.status))) {
        const a = new Date(t.created_at).getTime();
        const b = new Date(rt).getTime();
        if (!Number.isNaN(a) && !Number.isNaN(b) && b >= a) {
          row.resHoursSum += (b - a) / 3600000;
          row.resHoursN += 1;
        }
      }
    });
  });

  return [...map.values()]
    .map((r) => ({
      engineer: r.engineer,
      assigned: r.assigned,
      open: r.open,
      inProgress: r.inProgress,
      resolved: r.resolved,
      outstanding: r.open + r.inProgress,
      highPriority: r.highPriority,
      critical: r.critical,
      avgResolutionHours:
        r.resHoursN > 0 ? Math.round((r.resHoursSum / r.resHoursN) * 10) / 10 : null,
      avgResolutionSample: r.resHoursN,
    }))
    .sort((a, b) => b.assigned - a.assigned);
}

/** Ranking criteria for engineer leaderboard — explicit, not a composite "score" */
export const RANK_OPTIONS = [
  {
    id: 'resolved',
    label: 'Most resolved',
    description: 'Highest count of tickets currently Resolved in the filtered scope',
    direction: 'desc',
    field: 'resolved',
    minSample: 0,
  },
  {
    id: 'assigned',
    label: 'Highest assignment volume',
    description: 'Most tickets attributed to the engineer in scope (not a quality score)',
    direction: 'desc',
    field: 'assigned',
    minSample: 0,
  },
  {
    id: 'outstanding',
    label: 'Largest outstanding workload',
    description: 'Most open + in-progress tickets in scope',
    direction: 'desc',
    field: 'outstanding',
    minSample: 0,
  },
  {
    id: 'avg_resolution',
    label: 'Lowest average resolution time',
    description: 'Fastest mean created→resolved among engineers with enough samples',
    direction: 'asc',
    field: 'avgResolutionHours',
    minSample: 3,
  },
];

/**
 * Rank engineer rows by an explicit criterion.
 * Engineers below minSample for avg_resolution are listed after ranked rows (unranked).
 */
export function rankEngineers(rows, rankBy = 'resolved') {
  const opt = RANK_OPTIONS.find((o) => o.id === rankBy) || RANK_OPTIONS[0];
  const list = [...(rows || [])];

  if (opt.field === 'avgResolutionHours') {
    const eligible = list.filter(
      (r) => r.avgResolutionHours != null && (r.avgResolutionSample || 0) >= opt.minSample
    );
    const ineligible = list.filter(
      (r) => r.avgResolutionHours == null || (r.avgResolutionSample || 0) < opt.minSample
    );
    eligible.sort((a, b) => {
      const d = (a.avgResolutionHours || 0) - (b.avgResolutionHours || 0);
      if (d !== 0) return opt.direction === 'asc' ? d : -d;
      return a.engineer.localeCompare(b.engineer);
    });
    ineligible.sort((a, b) => a.engineer.localeCompare(b.engineer));
    let rank = 0;
    let lastVal = null;
    const ranked = eligible.map((r, i) => {
      const val = r.avgResolutionHours;
      if (lastVal === null || val !== lastVal) {
        rank = i + 1;
        lastVal = val;
      }
      return { ...r, rank, ranked: true, rankNote: null };
    });
    const rest = ineligible.map((r) => ({
      ...r,
      rank: null,
      ranked: false,
      rankNote: `Needs ≥${opt.minSample} resolution samples`,
    }));
    return { rows: [...ranked, ...rest], criterion: opt };
  }

  list.sort((a, b) => {
    const av = a[opt.field] ?? 0;
    const bv = b[opt.field] ?? 0;
    if (av !== bv) return opt.direction === 'asc' ? av - bv : bv - av;
    return a.engineer.localeCompare(b.engineer);
  });
  let rank = 0;
  let lastVal = null;
  const ranked = list.map((r, i) => {
    const val = r[opt.field] ?? 0;
    if (lastVal === null || val !== lastVal) {
      rank = i + 1;
      lastVal = val;
    }
    return { ...r, rank, ranked: true, rankNote: null };
  });
  return { rows: ranked, criterion: opt };
}

export function sortTickets(rows, sortKey, sortDir) {
  const dir = sortDir === 'asc' ? 1 : -1;
  const list = [...rows];
  list.sort((a, b) => {
    let av;
    let bv;
    if (sortKey === 'engineer') {
      av = primaryEngineer(a);
      bv = primaryEngineer(b);
    } else if (sortKey === 'workspace') {
      av = ticketWorkspace(a);
      bv = ticketWorkspace(b);
    } else {
      av = a[sortKey];
      bv = b[sortKey];
    }
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
  });
  return list;
}

export function groupTickets(rows, groupBy) {
  if (!groupBy || groupBy === 'none') {
    return [{ key: 'all', label: null, tickets: rows }];
  }
  const map = new Map();
  rows.forEach((t) => {
    let key;
    let label;
    if (groupBy === 'engineer') {
      key = primaryEngineer(t);
      label = key;
    } else if (groupBy === 'status') {
      key = t.status || 'Unknown';
      label = key;
    } else if (groupBy === 'priority') {
      key = t.priority || 'Medium';
      label = key;
    } else if (groupBy === 'workspace') {
      key = ticketWorkspace(t);
      label = key === '6004' ? 'Hardware Lab (6004)' : 'IT Support (1400)';
    } else if (groupBy === 'date') {
      key = t.created_at ? toDateInputValue(t.created_at) : 'Unknown';
      label = key;
    } else {
      key = 'all';
      label = null;
    }
    if (!map.has(key)) map.set(key, { key, label, tickets: [] });
    map.get(key).tickets.push(t);
  });
  return [...map.values()].sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')));
}

export function periodLabel(config) {
  const p = PERIOD_PRESETS.find((x) => x.id === config.period);
  if (config.period === 'custom') {
    const a = config.customFrom || '…';
    const b = config.customTo || '…';
    return `${a} → ${b}`;
  }
  return p?.label || config.period;
}

/** Tickets matching a single calendar day for drill-down */
export function ticketsForDrillDay(tickets, dayKey, mode) {
  if (!dayKey) return [];
  return (tickets || []).filter((t) => {
    if (mode === 'resolved') {
      const raw = resolutionTimestamp(t);
      if (!raw) return false;
      if (!t.resolved_at && !isResolvedStatus(t.status)) return false;
      return toDateInputValue(raw) === dayKey || String(raw).startsWith(dayKey);
    }
    if (!t.created_at) return false;
    return toDateInputValue(t.created_at) === dayKey || t.created_at.startsWith(dayKey);
  });
}

/** Single-engineer focus helper for titles */
export function selectedEngineerLabel(config) {
  if (!config.engineers || config.engineers.length === 0) return 'All engineers';
  if (config.engineers.length === 1) return config.engineers[0];
  return `${config.engineers.length} engineers`;
}

