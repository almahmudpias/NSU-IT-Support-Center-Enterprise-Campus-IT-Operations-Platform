import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ticketsApi, eventsApi, engineerApi } from '../../lib/api';
import { eventPath, ticketPath } from '../../lib/ids';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { isEngineerOnly, isSuper, normalizeRole } from '../../lib/rbac';
import { getLatestRemark } from '../../lib/printForms';
import { useRealtimeSync } from '../../lib/realtime';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function nowLabel() {
  return new Date().toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** value: 0–100 — drives the arc fill (load or health) */
function Gauge({ value = 0, gradId = 'gaugeGrad' }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  // pathLength=100 → dashoffset is simply 100 - pct (full arc = 100 units)
  const offset = 100 - pct;
  return (
    <svg width="96" height="58" viewBox="0 0 96 58" className="shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      {/* Track */}
      <path
        d="M 10 50 A 38 38 0 0 1 86 50"
        fill="none"
        stroke="#1F2937"
        strokeWidth="9"
        strokeLinecap="round"
        pathLength="100"
      />
      {/* Value arc */}
      <path
        d="M 10 50 A 38 38 0 0 1 86 50"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="9"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray="100"
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
      <text
        x="48"
        y="46"
        textAnchor="middle"
        className="fill-slate-300"
        style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}
      >
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

/** points: array of numbers (any scale) → sparkline */
function MiniLine({ color = '#6366f1', points = [] }) {
  const vals = points.length ? points.map((n) => Number(n) || 0) : [0];
  const max = Math.max(...vals, 1);
  const w = 120;
  const h = 36;
  const step = vals.length > 1 ? w / (vals.length - 1) : w;
  const coords = vals
    .map((v, i) => {
      const x = vals.length === 1 ? w / 2 : i * step;
      const y = h - 4 - (v / max) * (h - 10);
      return `${x},${y}`;
    })
    .join(' ');
  const fill = `0,${h} ${coords} ${w},${h}`;
  return (
    <svg width="100%" height="36" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="opacity-90">
      <polyline fill={`${color}22`} stroke="none" points={fill} />
      <polyline fill="none" stroke={color} strokeWidth="2" points={coords} />
    </svg>
  );
}

/** segments: [{ key, value, color }] */
function StackedBar({ segments = [] }) {
  const total = segments.reduce((s, x) => s + (Number(x.value) || 0), 0) || 1;
  return (
    <div className="h-2 w-full rounded-full overflow-hidden flex bg-[#0B0F19]">
      {segments.map((seg) => {
        const pct = ((Number(seg.value) || 0) / total) * 100;
        if (pct <= 0) return null;
        return (
          <div
            key={seg.key}
            className="h-full transition-all duration-500"
            style={{ width: `${pct}%`, background: seg.color }}
            title={`${seg.key}: ${seg.value}`}
          />
        );
      })}
    </div>
  );
}

/** values: last N daily counts */
function MiniBars({ values = [] }) {
  const vals = values.length ? values : [0];
  const max = Math.max(...vals, 1);
  const colors = ['#6366f1', '#8b5cf6', '#f59e0b', '#3b82f6', '#10b981', '#06b6d4', '#64748b'];
  return (
    <div className="flex items-end gap-1 h-10">
      {vals.map((v, i) => (
        <div
          key={i}
          className="w-3 rounded-t transition-all duration-500"
          style={{ height: `${Math.max(8, (v / max) * 100)}%`, background: colors[i % colors.length] }}
          title={String(v)}
        />
      ))}
    </div>
  );
}

/** Shared status sets for campus vs support-workstation queues */
const SUPPORT_WS_STATUSES = new Set([
  'brought to helpdesk',
  'sent to lab 6004',
  'sent to hardware',
  'send to hardware',
  'in diagnostics',
  'waiting for parts',
  'in hardware lab',
  'support workstation',
  'ready for return',
  'ready to handover',
]);

function isSupportWorkstationTicket(t) {
  const st = String(t?.status || '').toLowerCase();
  const ar = String(t?.action_required || '').toLowerCase();
  return SUPPORT_WS_STATUSES.has(st) || ar === 'support workstation' || ar === 'ready for return';
}

/**
 * Pure Hardware Lab queue only — NOT Support Workstation / diagnostics work.
 * In Diagnostics, Waiting for Parts, Support Workstation, Ready for Return stay in Active Work.
 */
function isHardwareLabTicket(t) {
  const st = String(t?.status || '').toLowerCase().trim();
  const ar = String(t?.action_required || '').toLowerCase().trim();
  return (
    st === 'in hardware lab' ||
    st === 'send to hardware' ||
    st === 'sent to hardware' ||
    st === 'sent to lab 6004' ||
    ar === 'in hardware lab' ||
    st.includes('hardware lab')
  );
}

function needsDeviceIntake(status) {
  const s = String(status || '').toLowerCase();
  return (
    s === 'brought to helpdesk' ||
    s === 'send to hardware' ||
    s === 'sent to hardware' ||
    s === 'in hardware lab'
  );
}

function lastNDaysResolvedCounts(tickets, days = 7) {
  const counts = Array.from({ length: days }, () => 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  tickets.forEach((t) => {
    if (String(t.status || '').toLowerCase() !== 'resolved') return;
    const d = new Date(t.resolved_at || t.updated_at || t.created_at);
    if (Number.isNaN(d.getTime())) return;
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const diff = Math.round((today - day) / 86400000);
    if (diff >= 0 && diff < days) counts[days - 1 - diff] += 1;
  });
  return counts;
}

function lastNDaysOpenCreated(tickets, days = 7) {
  const counts = Array.from({ length: days }, () => 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  tickets.forEach((t) => {
    const d = new Date(t.created_at);
    if (Number.isNaN(d.getTime())) return;
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const diff = Math.round((today - day) / 86400000);
    if (diff >= 0 && diff < days) counts[days - 1 - diff] += 1;
  });
  return counts;
}

function PriorityPill({ value }) {
  const v = (value || 'Normal').toLowerCase();
  if (v === 'high' || v === 'critical')
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-rose-500/15 text-rose-400 border border-rose-500/30">
        {value || 'High'}
      </span>
    );
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
      {value || 'Normal'}
    </span>
  );
}

function StatusPill({ status, action }) {
  const s = (status || '').toLowerCase();
  const base =
    'inline-flex items-center justify-center min-w-[6.75rem] h-6 px-2 rounded-md text-[9px] font-bold uppercase tracking-wide whitespace-nowrap';
  if (action === 'Ready for Return' || s === 'ready for return' || s === 'ready to handover')
    return (
      <span className={`${base} bg-emerald-500/10 text-emerald-400 border border-emerald-500/30`}>
        Ready return
      </span>
    );
  if (s === 'open')
    return (
      <span className={`${base} border border-blue-500/40 text-blue-400 bg-blue-500/5`}>Open</span>
    );
  if (s.includes('progress'))
    return (
      <span className={`${base} bg-amber-500/10 text-amber-400 border border-amber-500/30`}>
        In progress
      </span>
    );
  if (s.includes('diagnostic') || s === 'waiting for parts' || s.includes('hardware'))
    return (
      <span className={`${base} bg-purple-500/10 text-purple-300 border border-purple-500/30`}>
        Support WS
      </span>
    );
  if (s === 'support workstation')
    return (
      <span className={`${base} bg-violet-500/10 text-violet-300 border border-violet-500/30`}>
        Support WS
      </span>
    );
  if (s === 'resolved')
    return (
      <span className={`${base} bg-emerald-500/10 text-emerald-400 border border-emerald-500/30`}>
        Resolved
      </span>
    );
  if (s === 'user not found')
    return (
      <span className={`${base} bg-amber-500/10 text-amber-300 border border-amber-500/30`}>
        User Not Found
      </span>
    );
  // Exact cancel statuses only — do not match other phrases
  if (s === 'canceled' || s === 'cancelled')
    return (
      <span className={`${base} bg-slate-500/10 text-slate-400 border border-slate-500/30`}>
        Canceled
      </span>
    );
  return (
    <span className={`${base} bg-slate-500/10 text-slate-400 border border-slate-500/30 truncate max-w-[7.5rem]`}>
      {status || '—'}
    </span>
  );
}

function Avatar({ name, size = 'w-7 h-7' }) {
  return (
    <div
      className={`${size} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0 border border-white/10`}
    >
      {initials(name)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ENGINEER — My Workspace / Active Workbench
   ═══════════════════════════════════════════════════════════ */

/** Match ticket to engineer by full name or username */
function isMine(t, user) {
  const names = [user?.fullName, user?.username, user?.full_name]
    .filter(Boolean)
    .map((s) => String(s).trim().toLowerCase());
  const fields = [t.assigned_engineer, t.lab_engineer].filter(Boolean).map((s) => String(s).trim().toLowerCase());
  return fields.some((f) => names.includes(f));
}

function EngineerDashboard({ user }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [metrics, setMetrics] = useState({
    totalAssigned: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    campusSupport: 0,
    workstationSupport: 0,
    availableCount: 0,
    availableCampus: 0,
    availableWorkstation: 0,
  });
  const [mineOpen, setMineOpen] = useState([]);
  const [mineDone, setMineDone] = useState([]);
  const [mineRejected, setMineRejected] = useState([]);
  const [minePendingApproval, setMinePendingApproval] = useState([]);
  const [availableCampus, setAvailableCampus] = useState([]);
  const [availableWorkstation, setAvailableWorkstation] = useState([]);
  const [events, setEvents] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('In Progress');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('active');
  const [loadError, setLoadError] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [intakeDialog, setIntakeDialog] = useState(null); // { ticket, targetStatus, uiLabel }
  const [intakeHw, setIntakeHw] = useState('');
  const [intakeBrand, setIntakeBrand] = useState('');
  const [intakeSerial, setIntakeSerial] = useState('');
  const [intakeNote, setIntakeNote] = useState('');
  const [intakeSaving, setIntakeSaving] = useState(false);
  const [initialReady, setInitialReady] = useState(false);
  const initialReadyRef = useRef(false);

  const load = useCallback(
    async (silent = false) => {
      try {
        // Only show full section placeholders on the first cold load
        if (!silent && !initialReadyRef.current) setLoading(true);
        const res = await engineerApi.workspace();
        const m = res?.metrics || {};
        setMetrics({
          totalAssigned: m.totalAssigned || 0,
          pending: m.pending || 0,
          inProgress: m.inProgress || 0,
          completed: m.completed || 0,
          campusSupport: m.campusSupport || 0,
          workstationSupport: m.workstationSupport || 0,
          availableCount: m.availableCount || 0,
          availableCampus: m.availableCampus || 0,
          availableWorkstation: m.availableWorkstation || 0,
        });
        const open = Array.isArray(res?.mineOpen) ? res.mineOpen : [];
        const done = Array.isArray(res?.mineDone) ? res.mineDone : [];
        setMineOpen(open);
        setMineDone(done);
        setMineRejected(Array.isArray(res?.mineRejected) ? res.mineRejected : []);
        setMinePendingApproval(Array.isArray(res?.minePendingApproval) ? res.minePendingApproval : []);
        setAvailableCampus(Array.isArray(res?.availableCampus) ? res.availableCampus : []);
        setAvailableWorkstation(Array.isArray(res?.availableWorkstation) ? res.availableWorkstation : []);
        setEvents(Array.isArray(res?.events) ? res.events : []);
        setLoadError(null);
        setActiveId((prev) => {
          if (prev && open.some((t) => t.id === prev)) return prev;
          return open[0]?.id || null;
        });
      } catch (e) {
        if (!silent) {
          const msg = e.message || 'Could not load your work';
          setLoadError(msg);
          showToast('error', 'Workspace sync failed', msg);
          setMineOpen((prev) => (prev.length ? prev : []));
          setMineDone((prev) => (prev.length ? prev : []));
          setAvailableCampus((prev) => (prev.length ? prev : []));
          setAvailableWorkstation((prev) => (prev.length ? prev : []));
        }
      } finally {
        if (!silent) setLoading(false);
        initialReadyRef.current = true;
        setInitialReady(true);
      }
    },
    [showToast]
  );

  useEffect(() => {
    load(false);
    const t = setInterval(() => load(true), 45000);
    return () => clearInterval(t);
  }, [load]);

  useRealtimeSync(
    () => {
      load(true);
    },
    { enabled: true, debounceMs: 900 }
  );

  // Active Work excludes Hardware Lab stage tickets (they belong on Workstation / Hardware Lab)
  const assignedOpen = useMemo(
    () => mineOpen.filter((t) => !isHardwareLabTicket(t)),
    [mineOpen]
  );
  const assignedDone = mineDone;
  const fieldActive = useMemo(
    () => assignedOpen.filter((t) => !isSupportWorkstationTicket(t)),
    [assignedOpen]
  );
  const labActive = useMemo(
    () => assignedOpen.filter((t) => isSupportWorkstationTicket(t) && !isHardwareLabTicket(t)),
    [assignedOpen]
  );

  const myEvents = events;
  const upcomingEvents = myEvents.filter((e) => !['Ended', 'Teardown Complete'].includes(e.event_status || ''));
  const doneEvents = myEvents.filter((e) => ['Ended', 'Teardown Complete'].includes(e.event_status || ''));

  const active = assignedOpen.find((t) => t.id === activeId) || assignedOpen[0] || null;

  useEffect(() => {
    if (intakeDialog) return; // keep selected target status while confirming device intake
    if (active) setStatus(active.status || 'In Progress');
  }, [active?.id, intakeDialog]);

  async function claimTicket(t) {
    const pool = t._pool || (isSupportWorkstationTicket(t) ? 'workstation' : 'campus');
    setClaimingId(t.id);
    try {
      const res = await ticketsApi.claim(t.id, pool);
      if (res?.success === false) throw new Error(res.message || 'Claim failed');
      showToast('success', 'Claimed', res?.message || `Ticket #${t.id} is now yours`);
      await load(true);
      setActiveId(t.id);
      setTab('active');
      setPreviewId(null);
    } catch (e) {
      const msg = e?.message || 'Could not claim';
      showToast('error', 'Claim failed', msg);
      await load(true);
    } finally {
      setClaimingId(null);
    }
  }

  async function saveStatusAndNote() {
    if (!active) return;

    // Device-required transitions: open controlled in-dashboard intake (no full-page jump)
    if (needsDeviceIntake(status)) {
      const lower = String(status || '').toLowerCase();
      const uiLabel = status;
      const targetStatus =
        lower === 'brought to helpdesk'
          ? 'Brought to Helpdesk'
          : 'In Hardware Lab';
      setIntakeHw(String(active.hw_type || '').trim());
      setIntakeBrand(String(active.device_brand || '').trim());
      setIntakeSerial(String(active.serial_number || active.asset_tag || '').trim());
      setIntakeNote(note.trim());
      setIntakeDialog({
        ticket: active,
        targetStatus,
        uiLabel,
        fromStatus: active.status || '—',
      });
      return;
    }

    setSaving(true);
    try {
      const updates = {};
      const lower = String(status || '').toLowerCase();

      // Align with Admin / TicketDetail normalization so Hardware Lab routing matches
      if (lower === 'send to hardware' || lower === 'sent to hardware' || lower === 'in hardware lab') {
        updates.status = 'In Hardware Lab';
        updates.action_required = 'In Hardware Lab';
      } else if (lower === 'brought to helpdesk') {
        updates.status = 'Brought to Helpdesk';
        updates.action_required = 'Brought to Helpdesk';
      } else if (lower === 'support workstation') {
        updates.status = 'Support Workstation';
        updates.action_required = 'Support Workstation';
      } else if (lower === 'in diagnostics') {
        updates.status = 'In Diagnostics';
        updates.action_required = 'Under Diagnostics';
        updates.lab_engineer = active.lab_engineer || user?.fullName;
      } else if (lower === 'waiting for parts') {
        updates.status = 'Waiting for Parts';
        updates.action_required = 'Waiting for Parts';
        updates.lab_engineer = active.lab_engineer || user?.fullName;
      } else if (lower === 'ready for return' || lower === 'ready to handover') {
        updates.status = 'Ready for Return';
        updates.action_required = 'Ready for Return';
      } else if (lower === 'resolved') {
        updates.status = 'Resolved';
        updates.action_required = 'Closed';
      } else if (lower === 'user not found') {
        updates.status = 'User Not Found';
        updates.action_required = 'User Not Found';
      } else {
        updates.status = status;
      }

      // Preserve device fields already on the ticket when moving into HW stages
      if (needsDeviceIntake(status)) {
        if (active.hw_type) updates.hw_type = active.hw_type;
        if (active.device_brand) updates.device_brand = active.device_brand;
        if (active.serial_number || active.asset_tag) {
          updates.serial_number = active.serial_number || active.asset_tag;
          updates.asset_tag = active.asset_tag || active.serial_number;
        }
      }

      if (note.trim()) {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        const block = `=== ${user?.fullName || 'Engineer'} | ${ts} ===\n${note.trim()}\n`;
        const existing = active.it_engineer_remarks || '';
        updates.it_engineer_remarks = existing + (existing && !existing.endsWith('\n') ? '\n' : '') + block;
      }

      await ticketsApi.update(active.id, updates, {
        engineerName: user?.fullName,
        actionNote: note.trim()
          ? `Status changed: ${active.status || '—'} → ${updates.status || status} · Remark: ${note.trim()}`
          : `Status changed: ${active.status || '—'} → ${updates.status || status}`,
      });
      setNote('');
      showToast('success', 'Ticket updated', `#${active.id} → ${updates.status || status}`);
      await load(true);
    } catch (e) {
      showToast('error', 'Update failed', e.message);
    } finally {
      setSaving(false);
    }
  }


  async function confirmDeviceIntake() {
    if (!intakeDialog?.ticket || intakeSaving) return;
    const hw = intakeHw.trim();
    const brand = intakeBrand.trim();
    const serial = intakeSerial.trim();
    if (!hw || !brand || !serial) {
      showToast('warning', 'Device details required', 'Device Type, Brand, and Asset Tag / Serial are required.');
      return;
    }
    setIntakeSaving(true);
    try {
      const t = intakeDialog.ticket;
      const target = intakeDialog.targetStatus;
      const updates = {
        status: target,
        action_required: target === 'In Hardware Lab' ? 'In Hardware Lab' : 'Brought to Helpdesk',
        hw_type: hw,
        device_brand: brand,
        serial_number: serial,
        asset_tag: serial,
      };
      if (intakeNote.trim()) {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        const block = `=== ${user?.fullName || 'Engineer'} | ${ts} ===\n${intakeNote.trim()}\n`;
        const existing = t.it_engineer_remarks || '';
        updates.it_engineer_remarks = existing + (existing && !existing.endsWith('\n') ? '\n' : '') + block;
      }
      await ticketsApi.update(t.id, updates, {
        engineerName: user?.fullName,
        actionNote: `Status changed: ${intakeDialog.fromStatus} → ${target}${
          intakeNote.trim() ? ` · Remark: ${intakeNote.trim()}` : ''
        }`,
      });
      setIntakeDialog(null);
      setNote('');
      showToast('success', 'Status updated', `#${t.id} → ${intakeDialog.uiLabel || target}`);
      await load(true);
    } catch (e) {
      showToast('error', 'Update failed', e.message);
    } finally {
      setIntakeSaving(false);
    }
  }

  const STATUSES = [
    'Open',
    'In Progress',
    'Waiting for Device',
    'User Not Found',
    'Brought to Helpdesk',
    'Send to Hardware',
    'In Diagnostics',
    'Waiting for Parts',
    'In Hardware Lab',
    'Support Workstation',
    'Ready for Return',
    'Resolved',
    'Canceled',
  ];

  return (
    <>
      <header className="px-6 py-5 border-b border-[#1F2937] bg-[#0B0F19]/90 shrink-0 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Your assigned work and claimable Campus Support / Workstation Support tickets.
          </p>
        </div>
        <div className="text-right text-[10px] text-slate-500 font-mono">
          <div className="text-slate-300 font-semibold">{nowLabel()}</div>
          <div className="text-cyan-400 font-bold uppercase tracking-wider">{normalizeRole(user?.role)}</div>
        </div>
              <Link
          to="/submit-ticket"
          className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center shrink-0 ml-auto"
        >
          Submit Support Ticket
        </Link>
</header>

      <main className="flex-1 overflow-y-auto custom-scroll p-6 space-y-6">
        {/* Available work — Campus Support */}
        <section className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-[#111827] via-[#0B0F19] to-[#111827] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1F2937]">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400">Campus Support · Available</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Unassigned field tickets you can claim
              {!loading && !loadError ? ` · ${availableCampus.length}` : ''}
            </p>
          </div>
          <div className="max-h-[320px] overflow-y-auto custom-scroll">
            {loading && <p className="text-xs text-slate-500 px-5 py-6">Loading campus tickets…</p>}
            {!loading && loadError && (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-bold text-rose-300">Could not load Campus Support tickets</p>
                <p className="text-xs text-slate-500 mt-1">{loadError}</p>
              </div>
            )}
            {!loading && !loadError && availableCampus.length === 0 && (
              <div className="px-5 py-10 text-center">
                <div className="mx-auto w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-300 text-lg mb-3">✓</div>
                <p className="text-sm font-bold text-white">All caught up!</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  No pending Campus Support tickets right now. Everything is looking good.
                </p>
              </div>
            )}
            <ul className="divide-y divide-[#1F2937]/80">
              {!loading && !loadError && availableCampus.slice(0, 30).map((t) => {
                const open = previewId === `c-${t.id}`;
                return (
                  <li key={`campus-${t.id}`} className="hover:bg-[#1F2937]/20 transition">
                    <div className="px-5 py-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPreviewId(open ? null : `c-${t.id}`)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-indigo-400">#{t.id}</span>
                          <PriorityPill value={t.priority} />
                          <StatusPill status={t.status} action={t.action_required} />
                          <span className="text-[10px] text-slate-500">{t.issue_category || 'General'}</span>
                        </div>
                        <p className="text-xs font-semibold text-white mt-1 truncate">
                          {t.user_name || 'Requester'} · {t.description || '—'}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {[t.department, t.building, t.room_location].filter(Boolean).join(' · ') || '—'}
                          {' · '}
                          {timeAgo(t.created_at)}
                        </p>
                      </button>
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={claimingId === t.id}
                          onClick={() => claimTicket({ ...t, _pool: 'campus' })}
                          className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-900/30"
                        >
                          {claimingId === t.id ? 'Claiming…' : 'Claim'}
                        </button>
                      </div>
                    </div>
                    {open && (
                      <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs border-t border-[#1F2937]/80 bg-[#0B0F19]/40">
                        <div className="pt-3">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Requester</p>
                          <p className="text-slate-200 font-semibold">{t.user_name || '—'}</p>
                          <p className="text-slate-500 text-[10px]">{t.department || '—'} · Ext {t.extension || '—'}</p>
                        </div>
                        <div className="pt-3">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Location</p>
                          <p className="text-slate-200">{[t.building, t.room_location].filter(Boolean).join(' · ') || '—'}</p>
                        </div>
                        <div className="pt-3">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Priority / Status</p>
                          <p className="text-slate-200">{t.priority || 'Normal'} · {t.status || '—'}</p>
                        </div>
                        <div className="pt-1 sm:col-span-2 lg:col-span-3">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Issue</p>
                          <p className="text-slate-300 whitespace-pre-wrap break-words">{t.description || '—'}</p>
                        </div>
                        <div className="pt-1 sm:col-span-2 lg:col-span-3">
                          <Link
                            to={ticketPath(t.id, { action: 'view' })}
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold inline-flex items-center"
                          >
                            Full view details →
                          </Link>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Available work — Workstation Support */}
        <section className="rounded-2xl border border-purple-500/25 bg-gradient-to-br from-[#111827] via-[#0B0F19] to-[#111827] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1F2937]">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400">Workstation · Available</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Unassigned device / lab jobs you can claim
              {!loading && !loadError ? ` · ${availableWorkstation.length}` : ''}
            </p>
          </div>
          <div className="max-h-[320px] overflow-y-auto custom-scroll">
            {loading && <p className="text-xs text-slate-500 px-5 py-6">Loading workstation tickets…</p>}
            {!loading && loadError && (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-bold text-rose-300">Could not load Workstation tickets</p>
                <p className="text-xs text-slate-500 mt-1">{loadError}</p>
              </div>
            )}
            {!loading && !loadError && availableWorkstation.length === 0 && (
              <div className="px-5 py-10 text-center">
                <div className="mx-auto w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-300 text-lg mb-3">✓</div>
                <p className="text-sm font-bold text-white">All caught up!</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  No pending Workstation tickets right now. Everything is looking good.
                </p>
              </div>
            )}
            <ul className="divide-y divide-[#1F2937]/80">
              {!loading && !loadError && availableWorkstation.slice(0, 30).map((t) => {
                const open = previewId === `w-${t.id}`;
                return (
                  <li key={`ws-${t.id}`} className="hover:bg-[#1F2937]/20 transition">
                    <div className="px-5 py-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPreviewId(open ? null : `w-${t.id}`)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-purple-400">#{t.id}</span>
                          <PriorityPill value={t.priority} />
                          <StatusPill status={t.status} action={t.action_required} />
                          <span className="text-[10px] text-slate-500">{t.hw_type || t.issue_category || 'Device'}</span>
                        </div>
                        <p className="text-xs font-semibold text-white mt-1 truncate">
                          {t.user_name || 'Requester'} · {t.description || '—'}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {[t.building, t.room_location].filter(Boolean).join(' · ') || '—'}
                          {t.device_brand ? ` · ${t.device_brand}` : ''}
                          {t.serial_number ? ` · ${t.serial_number}` : ''}
                          {' · '}
                          {timeAgo(t.created_at)}
                        </p>
                      </button>
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={claimingId === t.id}
                          onClick={() => claimTicket({ ...t, _pool: 'workstation' })}
                          className="h-9 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-purple-900/30"
                        >
                          {claimingId === t.id ? 'Claiming…' : 'Claim'}
                        </button>
                      </div>
                    </div>
                    {open && (
                      <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs border-t border-[#1F2937]/80 bg-[#0B0F19]/40">
                        <div className="pt-3">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Requester</p>
                          <p className="text-slate-200 font-semibold">{t.user_name || '—'}</p>
                          <p className="text-slate-500 text-[10px]">{t.department || '—'}</p>
                        </div>
                        <div className="pt-3">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Device</p>
                          <p className="text-slate-200">
                            {[t.hw_type, t.device_brand, t.serial_number].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                        <div className="pt-3">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Status / Action</p>
                          <p className="text-slate-200">{t.status || '—'} · {t.action_required || '—'}</p>
                        </div>
                        <div className="pt-1 sm:col-span-2 lg:col-span-3">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Issue</p>
                          <p className="text-slate-300 whitespace-pre-wrap break-words">{t.description || '—'}</p>
                        </div>
                        <div className="pt-1 sm:col-span-2 lg:col-span-3">
                          <Link
                            to={ticketPath(t.id, { action: 'view' })}
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold inline-flex items-center"
                          >
                            Full view details →
                          </Link>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'active', label: `Active Work (${assignedOpen.length})` },
            { id: 'events', label: `Events (${upcomingEvents.length})` },
            { id: 'done', label: `Completed (${assignedDone.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                tab === t.id
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'border-[#1F2937] text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && <p className="text-xs text-slate-500">Loading your assignments…</p>}

        {tab === 'active' && (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <div className="xl:col-span-2 rounded-2xl border border-[#1F2937] bg-[#111827]/80 p-4 max-h-[560px] overflow-y-auto custom-scroll space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 sticky top-0 bg-[#111827] py-1 z-10">
                Assigned to me
              </h3>
              {!loading && assignedOpen.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-xs text-slate-400 font-medium">No tickets in this view</p>
                  <p className="text-[10px] text-slate-500 mt-1">Claim from Available Work above, or wait for an assignment.</p>
                </div>
              )}
              {assignedOpen.map((t) => {
                const selected = active?.id === t.id;
                const isLab = isSupportWorkstationTicket(t);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveId(t.id)}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      selected ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-[#1F2937] hover:border-slate-600 bg-[#0B0F19]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-400">#{t.id}</span>
                      <span className="text-[8px] font-bold uppercase text-slate-500">{isLab ? 'Support WS' : 'Campus'}</span>
                    </div>
                    <p className="text-xs font-semibold text-white truncate mt-1">{t.user_name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{t.description || t.issue_category}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <StatusPill status={t.status} action={t.action_required} />
                      <span className="text-[9px] text-slate-600 font-mono">{timeAgo(t.updated_at || t.created_at)}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="xl:col-span-3 rounded-2xl border border-[#1F2937] bg-[#111827]/80 p-5 min-h-[320px]">
              {!active && (
                <div className="h-full flex flex-col items-center justify-center text-center py-16">
                  <p className="text-sm font-bold text-slate-300">Select a ticket to work</p>
                  <p className="text-xs text-slate-500 mt-1">Or claim available work from the top of this page</p>
                </div>
              )}
              {active && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-cyan-400">#{active.id}</span>
                        <StatusPill status={active.status} action={active.action_required} />
                        <PriorityPill value={active.priority} />
                      </div>
                      <h3 className="text-lg font-black text-white mt-1">{active.user_name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {[active.department, active.building, active.room_location, active.extension]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </p>
                    </div>
                    <Link
                      to={ticketPath(active.id, { action: 'view' })}
                      className="h-9 px-3 rounded-lg border border-indigo-500/40 text-indigo-300 text-xs font-bold hover:bg-indigo-500/10 inline-flex items-center"
                    >
                      Full ticket
                    </Link>
                  </div>
                  <div className="rounded-xl border border-[#1F2937] bg-[#0B0F19]/50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Issue</p>
                    <p className="text-xs text-slate-200 whitespace-pre-wrap">{active.description || '—'}</p>
                    {active.hw_type && (
                      <p className="text-[11px] text-purple-300 mt-2">
                        Device: {active.hw_type}
                        {active.device_brand ? ` · ${active.device_brand}` : ''}
                        {active.serial_number ? ` · ${active.serial_number}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="dark-input w-full mt-1 text-xs h-9 font-bold"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                        {status && !STATUSES.includes(status) && <option value={status}>{status}</option>}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Add note</label>
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Optional activity note…"
                        className="dark-input w-full mt-1 text-xs h-9"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={saveStatusAndNote}
                    className="h-9 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold"
                  >
                    {saving ? 'Saving…' : 'Save update'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'events' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[#1F2937] bg-[#111827]/80 p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Upcoming / live</h3>
              {upcomingEvents.length === 0 && (
                <p className="text-xs text-slate-500 italic py-6 text-center">No events assigned to you</p>
              )}
              <div className="space-y-2">
                {upcomingEvents.slice(0, 12).map((ev) => (
                  <Link key={ev.id} to={eventPath(ev.id)} className="block p-3 rounded-xl border border-[#1F2937] hover:border-indigo-500/40">
                    <span className="text-xs font-bold text-white">{ev.name}</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {ev.event_date || '—'} · {ev.event_status || '—'}
                    </p>
                  </Link>
                ))}
              </div>
              <Link to="/events" className="inline-block mt-3 text-xs font-bold text-indigo-400 hover:underline">
                Open full itinerary →
              </Link>
            </div>
            <div className="rounded-2xl border border-[#1F2937] bg-[#111827]/80 p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Completed events</h3>
              {doneEvents.length === 0 && (
                <p className="text-xs text-slate-500 italic py-6 text-center">No completed events yet</p>
              )}
              <div className="space-y-2">
                {doneEvents.slice(0, 8).map((ev) => (
                  <Link key={ev.id} to={eventPath(ev.id)} className="block p-3 rounded-xl border border-[#1F2937] hover:border-slate-600">
                    <span className="text-xs font-bold text-slate-300">{ev.name}</span>
                    <p className="text-[10px] text-slate-500">{ev.event_status}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'done' && (
          <div className="rounded-2xl border border-[#1F2937] bg-[#111827]/80 overflow-hidden">
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead>
                <tr className="text-[9px] uppercase tracking-widest text-slate-500 border-b border-[#1F2937]">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Requester</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Closed</th>
                  <th className="px-4 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {assignedDone.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500 italic">
                      No resolved tickets yet
                    </td>
                  </tr>
                )}
                {assignedDone.slice(0, 40).map((t) => (
                  <tr key={t.id} className="border-b border-[#1F2937]/50 hover:bg-[#1F2937]/30">
                    <td className="px-4 py-3 font-mono font-bold text-emerald-400">#{t.id}</td>
                    <td className="px-4 py-3 text-white font-semibold">{t.user_name}</td>
                    <td className="px-4 py-3 text-slate-400">{t.issue_category || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">{timeAgo(t.updated_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={ticketPath(t.id)} className="text-indigo-400 font-bold text-[10px] hover:underline">
                        View / notes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      
        {/* Dismissed engineer submissions — reason visible to submitting engineer */}
        {mineRejected.length > 0 && (
          <section className="rounded-2xl border border-rose-500/25 bg-[#111827]/80 overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1F2937]">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">
                Dismissed submissions · {mineRejected.length}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Admin dismissed these requests. Open a ticket to read the full reason.
              </p>
            </div>
            <div className="divide-y divide-[#1F2937]">
              {mineRejected.slice(0, 15).map((t) => {
                const fr = String(t.final_remarks || '');
                const m = fr.match(/Dismissal reason:\s*([\s\S]*?)(?:\nDismissed by:|$)/i)
                  || fr.match(/Rejection:\s*([\s\S]+)/i);
                const reason = m ? m[1].trim() : 'See ticket for dismissal reason.';
                return (
                  <div key={t.id} className="px-5 py-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white">
                        <span className="font-mono text-rose-300">#{t.id}</span>
                        <span className="text-slate-400 font-medium"> · {t.user_name || 'Requester'}</span>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{reason}</p>
                    </div>
                    <Link
                      to={ticketPath(t.id, { action: 'view' })}
                      className="h-8 px-3 rounded-lg border border-rose-500/30 text-rose-200 text-[11px] font-bold hover:bg-rose-500/10 inline-flex items-center shrink-0"
                    >
                      View reason
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </main>

      {/* Controlled device-intake for Brought / Send to Hardware — stays on Dashboard */}
      {intakeDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity"
            onClick={() => !intakeSaving && setIntakeDialog(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-2xl border border-[#374151] bg-[#111827] shadow-2xl shadow-black/50 transition-all duration-200 ease-out scale-100 opacity-100"
          >
            <div className="px-5 py-4 border-b border-[#1F2937]">
              <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Confirm status change</p>
              <p className="text-sm text-white font-semibold mt-1">
                Ticket #{intakeDialog.ticket?.id}: {intakeDialog.fromStatus} → {intakeDialog.uiLabel}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Enter device details to complete this transition. Cancel leaves the ticket unchanged.
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Device Type *</label>
                <input
                  className="dark-input w-full mt-1 text-sm"
                  value={intakeHw}
                  onChange={(e) => setIntakeHw(e.target.value)}
                  placeholder="PC, Monitor, Printer…"
                  disabled={intakeSaving}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Brand *</label>
                <input
                  className="dark-input w-full mt-1 text-sm"
                  value={intakeBrand}
                  onChange={(e) => setIntakeBrand(e.target.value)}
                  placeholder="e.g. Dell"
                  disabled={intakeSaving}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Asset Tag / Serial *</label>
                <input
                  className="dark-input w-full mt-1 text-sm font-mono"
                  value={intakeSerial}
                  onChange={(e) => setIntakeSerial(e.target.value)}
                  placeholder="NSU-IT-…"
                  disabled={intakeSaving}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Note (optional)</label>
                <textarea
                  className="dark-input w-full mt-1 text-sm resize-none"
                  rows={2}
                  value={intakeNote}
                  onChange={(e) => setIntakeNote(e.target.value)}
                  disabled={intakeSaving}
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-[#1F2937] flex justify-end gap-2">
              <button
                type="button"
                className="h-9 px-3 rounded-lg border border-[#374151] text-xs font-bold text-slate-300 hover:bg-[#1F2937]"
                disabled={intakeSaving}
                onClick={() => setIntakeDialog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50"
                disabled={intakeSaving}
                onClick={confirmDeviceIntake}
              >
                {intakeSaving ? 'Saving…' : 'Confirm & save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function KpiCard({ label, value, tone, sub }) {
  const tones = {
    cyan: 'text-cyan-400 border-l-cyan-500',
    purple: 'text-purple-400 border-l-purple-500',
    amber: 'text-amber-400 border-l-amber-500',
    emerald: 'text-emerald-400 border-l-emerald-500',
  };
  return (
    <div className={`rounded-2xl border border-[#1F2937] bg-[#111827]/80 p-4 border-l-2 ${tones[tone]}`}>
      <p className={`text-[9px] font-bold uppercase tracking-widest ${tones[tone].split(' ')[0]}`}>{label}</p>
      <p className="text-3xl font-black text-white mt-1">{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}


function OpsDashboard({ user }) {
  const [tickets, setTickets] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [eventsPage, setEventsPage] = useState(0);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [data, ev] = await Promise.all([
        ticketsApi.all(),
        eventsApi.list().catch(() => []),
      ]);
      const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setTickets(rows);
      const evRows = Array.isArray(ev) ? ev : Array.isArray(ev?.data) ? ev.data : [];
      setEvents(evRows);
    } catch {
      if (!silent) {
        setTickets([]);
        setEvents([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const t = setInterval(() => load(true), 45000);
    return () => clearInterval(t);
  }, [load]);

  const stats = useMemo(() => {
    const active = tickets.filter(
      (t) => !['resolved', 'canceled', 'cancelled'].includes(String(t.status || '').toLowerCase())
    );
    const open = tickets.filter((t) => String(t.status || '').toLowerCase() === 'open').length;
    const progress = tickets.filter((t) => {
      const s = String(t.status || '').toLowerCase();
      return s === 'in progress' || s === 'in diagnostics' || s === 'waiting for device' || s === 'waiting for parts';
    }).length;
    const unassigned = active.filter((t) => !t.assigned_engineer && !t.lab_engineer);
    const resolvedToday = tickets.filter((t) => {
      if (String(t.status || '').toLowerCase() !== 'resolved') return false;
      const d = new Date(t.resolved_at || t.updated_at || 0);
      return !Number.isNaN(d.getTime()) && d.toDateString() === new Date().toDateString();
    }).length;
    const resolvedYesterday = tickets.filter((t) => {
      if (String(t.status || '').toLowerCase() !== 'resolved') return false;
      const d = new Date(t.resolved_at || t.updated_at || 0);
      if (Number.isNaN(d.getTime())) return false;
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return d.toDateString() === y.toDateString();
    }).length;
    const high = tickets.filter(
      (t) =>
        String(t.priority || '').toLowerCase() === 'high' &&
        !['resolved', 'canceled', 'cancelled'].includes(String(t.status || '').toLowerCase())
    );
    const lab = tickets.filter((t) => isSupportWorkstationTicket(t) && String(t.status || '').toLowerCase() !== 'resolved');
    const deskOpen = tickets.filter((t) => {
      const s = String(t.status || '').toLowerCase();
      return (s === 'open' || s === 'in progress' || s === 'waiting for device') && !isSupportWorkstationTicket(t);
    }).length;
    const ready = tickets.filter(
      (t) =>
        String(t.action_required || '').toLowerCase() === 'ready for return' ||
        String(t.status || '').toLowerCase() === 'ready for return' ||
        String(t.status || '').toLowerCase() === 'ready to handover'
    );
    const awaitingUser = tickets.filter((t) => String(t.status || '').toLowerCase() === 'waiting for device').length;
    const totalActive = active.length;
    // Load gauge: how much of the active queue is still Open (0–100). Visible even when open is low.
    const openLoadPct =
      totalActive > 0
        ? Math.min(100, Math.round((open / totalActive) * 100))
        : open > 0
          ? 100
          : 0;
    // Health = inverse of load (kept for label); gauge shows load so the arc moves with open volume
    const openHealth = Math.max(0, 100 - openLoadPct);
    const openGauge = totalActive > 0 || open > 0 ? Math.max(openLoadPct, open > 0 ? 8 : 0) : 0;
    const closureRate =
      resolvedToday + resolvedYesterday > 0
        ? Math.min(100, Math.round((resolvedToday / Math.max(resolvedToday + resolvedYesterday, 1)) * 100))
        : resolvedToday > 0
          ? 100
          : 0;
    const resolvedSeries = lastNDaysResolvedCounts(tickets, 7);
    const createdSeries = lastNDaysOpenCreated(tickets, 7);
    const stackSegments = [
      { key: 'Open', value: open, color: '#6366f1' },
      { key: 'In Progress', value: progress, color: '#f59e0b' },
      { key: 'Support WS', value: lab.length, color: '#a78bfa' },
      { key: 'Resolved today', value: resolvedToday, color: '#10b981' },
    ];
    return {
      open,
      progress,
      unassigned,
      resolvedToday,
      resolvedYesterday,
      high,
      lab,
      deskOpen,
      ready,
      awaitingUser,
      totalActive: active.length,
      openHealth,
      openGauge,
      openLoadPct,
      closureRate,
      resolvedSeries,
      createdSeries,
      stackSegments,
    };
  }, [tickets]);

  const stream = useMemo(() => {
    let list = [...tickets];
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(
        (t) =>
          String(t.id).includes(q) ||
          (t.user_name || '').toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q)
      );
    }
    return list.slice(0, 8);
  }, [tickets, filter]);

  const alerts = useMemo(() => {
    const items = [];
    stats.high.slice(0, 4).forEach((t) => {
      items.push({
        id: t.id,
        tone: 'rose',
        title: `High priority · #${t.id}`,
        sub: `${t.user_name || 'Requester'} · ${t.issue_category || 'General'}`,
        badge: 'High-priority',
        name: t.user_name,
      });
    });
    stats.unassigned.slice(0, 3).forEach((t) => {
      items.push({
        id: t.id,
        tone: 'amber',
        title: `Unassigned · #${t.id}`,
        sub: `${t.description || 'Ticket'} · ${timeAgo(t.created_at)}`,
        badge: 'Unassigned',
        name: t.user_name,
      });
    });
    stats.ready.slice(0, 2).forEach((t) => {
      items.push({
        id: t.id,
        tone: 'emerald',
        title: `Ready for return · #${t.id}`,
        sub: `${t.hw_type || 'Device'} · ${t.user_name || ''}`,
        badge: 'Ready',
        name: t.user_name,
      });
    });
    return items.slice(0, 8);
  }, [stats]);

  return (
    <>
      <header className="px-6 py-5 border-b border-[#1F2937] bg-[#0B0F19]/90 shrink-0 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Operations Hub</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Strategic Command Overview — Here&apos;s your real-time performance and critical alert center.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-300 font-semibold font-mono">{nowLabel()}</div>
          <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mt-0.5">
            {normalizeRole(user?.role)}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scroll p-6 space-y-6">
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Consolidated Metrics Hub</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 relative">
            {loading && (
              <div className="absolute inset-0 z-10 rounded-2xl bg-[#0B0F19]/40 backdrop-blur-[1px] pointer-events-none" />
            )}
            <div className="rounded-2xl border border-[#1F2937] bg-gradient-to-br from-[#111827] to-[#0B0F19] p-5 shadow-xl shadow-black/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400">Open</span>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Campus support load</p>
                  <p className="text-4xl font-black text-white mt-3 tracking-tight">{stats.open}</p>
                </div>
                <div className="text-center shrink-0">
                  <Gauge value={stats.openGauge} gradId="gaugeOpen" />
                  <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                    {stats.openLoadPct}% of active · {stats.openHealth}% clear
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1F2937] flex gap-4 text-[10px] text-slate-400">
                <span>
                  <strong className="text-slate-200">{stats.awaitingUser}</strong> awaiting user
                </span>
                <span>
                  <strong className="text-amber-400">{stats.unassigned.length}</strong> unassigned
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-[#1F2937] bg-gradient-to-br from-[#111827] to-[#0B0F19] p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400">In Progress</span>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Dispatch and response</p>
              <p className="text-4xl font-black text-white mt-3 tracking-tight">{stats.progress}</p>
              <p className="text-[10px] text-slate-500 mt-1">Created volume · last 7 days</p>
              <div className="mt-3">
                <MiniLine color="#f59e0b" points={stats.createdSeries} />
              </div>
              <div className="mt-2">
                <StackedBar segments={stats.stackSegments} />
              </div>
              <p className="text-[10px] text-slate-500 mt-3">
                Active tickets:{' '}
                <span className="text-slate-200 font-bold">{stats.totalActive}</span>
              </p>
            </div>
            <div className="rounded-2xl border border-[#1F2937] bg-gradient-to-br from-[#111827] to-[#0B0F19] p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-rose-400">Unassigned</span>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Immediate team action</p>
                  <p className="text-4xl font-black text-white mt-3 tracking-tight">{stats.unassigned.length}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 max-h-[120px] overflow-y-auto custom-scroll">
                {stats.unassigned.slice(0, 3).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-[10px]">
                    <Avatar name={t.user_name} size="w-6 h-6" />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 font-semibold truncate">
                        #{t.id} · {t.priority === 'High' ? 'Highest priority' : t.user_name}
                      </p>
                      <p className="text-slate-500">{timeAgo(t.created_at)}</p>
                    </div>
                    <Link
                      to={`/tickets/${t.id}`}
                      className="px-2 py-1 rounded-md border border-indigo-500/40 text-indigo-300 font-bold hover:bg-indigo-500/10 shrink-0"
                    >
                      Assign
                    </Link>
                  </div>
                ))}
                {stats.unassigned.length === 0 && (
                  <p className="text-[10px] text-slate-500 italic">All tickets assigned</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-[#1F2937] bg-gradient-to-br from-[#111827] to-[#0B0F19] p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">Resolved</span>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Closure metrics</p>
              <div className="flex items-end gap-2 mt-3">
                <p className="text-4xl font-black text-white tracking-tight">{stats.resolvedToday}</p>
                <span className="text-[10px] text-emerald-400 font-bold mb-1.5">today</span>
              </div>
              <p className="text-[10px] text-slate-500">
                Yesterday: <strong className="text-slate-300">{stats.resolvedYesterday}</strong>
                {' · '}
                share: <strong className="text-emerald-400">{stats.closureRate}%</strong>
              </p>
              <div className="mt-3 flex items-end justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <MiniLine color="#10b981" points={stats.resolvedSeries} />
                </div>
                <MiniBars values={stats.resolvedSeries} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-4 rounded-2xl border border-[#1F2937] bg-[#111827]/80 p-5 flex flex-col min-h-[280px]">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">Actionable Alerts</h3>
            <div className="flex-1 overflow-y-auto custom-scroll space-y-1 pr-1">
              {loading && <p className="text-xs text-slate-500">Loading…</p>}
              {!loading && alerts.length === 0 && (
                <p className="text-xs text-slate-500 italic py-8 text-center">No critical alerts right now</p>
              )}
              {alerts.map((a, i) => (
                <Link
                  key={`${a.id}-${i}`}
                  to={`/tickets/${a.id}`}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-[#1F2937]/50 transition border border-transparent hover:border-[#1F2937]"
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                      a.tone === 'rose' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : a.tone === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">{a.title}</p>
                    <p className="text-[10px] text-slate-500 truncate">{a.sub}</p>
                  </div>
                  <Avatar name={a.name} size="w-6 h-6" />
                  <span
                    className={`text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md border shrink-0 ${
                      a.tone === 'rose' ? 'border-rose-500/40 text-rose-400' : a.tone === 'emerald' ? 'border-emerald-500/40 text-emerald-400' : 'border-amber-500/40 text-amber-400'
                    }`}
                  >
                    {a.badge}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="xl:col-span-8 rounded-2xl border border-[#1F2937] bg-[#111827]/80 p-5">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">Workspace Command Center</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
              <div className="rounded-xl border border-[#1F2937] bg-[#0B0F19]/60 p-4 flex flex-col min-h-[200px] h-full">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-3 shrink-0">Campus Support</p>
                <div className="h-16 flex items-end gap-1.5 mb-2 shrink-0">
                  <div
                    className="flex-1 bg-indigo-500/80 rounded-t transition-all duration-500 min-h-[8px]"
                    style={{
                      height: `${Math.min(
                        100,
                        stats.totalActive ? (stats.open / Math.max(stats.totalActive, 1)) * 100 : stats.open ? 40 : 8
                      )}%`,
                    }}
                  />
                  <div
                    className="flex-1 bg-amber-500/70 rounded-t transition-all duration-500 min-h-[8px]"
                    style={{
                      height: `${Math.min(
                        100,
                        stats.totalActive ? (stats.progress / Math.max(stats.totalActive, 1)) * 100 : stats.progress ? 40 : 8
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex gap-3 text-[10px] text-slate-400 mb-3 shrink-0">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Open · {stats.open}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Progress · {stats.progress}</span>
                </div>
                <div className="flex-1" />
                <Link to="/campus-support" className="mt-auto block text-center text-xs font-bold py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-900/30">
                  Open Campus Support
                </Link>
              </div>
              <div className="rounded-xl border border-[#1F2937] bg-[#0B0F19]/60 p-4 flex flex-col min-h-[200px] h-full">
                <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-3 shrink-0">Support Workstation</p>
                <div className="space-y-2.5 text-[10px] text-slate-400 flex-1">
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" /> Open pipeline <span className="ml-auto text-white font-bold tabular-nums">{stats.lab.length}</span></div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" /> In Progress <span className="ml-auto text-white font-bold tabular-nums">{stats.progress}</span></div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" /> Ready to return <span className="ml-auto text-white font-bold tabular-nums">{stats.ready.length}</span></div>
                </div>
                <Link to="/support-workstation" className="mt-auto block text-center text-xs font-bold py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition shadow-lg shadow-purple-900/30">
                  Open Support Workstation
                </Link>
              </div>
              <div className="rounded-xl border border-[#1F2937] bg-[#0B0F19]/60 p-4 flex flex-col min-h-[200px] h-full">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-3 shrink-0">Events</p>
                <div className="space-y-2.5 text-[10px] text-slate-400 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" /> Live / Ongoing
                    <span className="ml-auto text-white font-bold tabular-nums">
                      {events.filter((e) => ['Ongoing', 'Standby/Monitoring'].includes(e.event_status)).length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" /> Upcoming
                    <span className="ml-auto text-white font-bold tabular-nums">{events.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" /> Unassigned
                    <span className="ml-auto text-white font-bold tabular-nums">
                      {events.filter((e) => !e.assigned_engineer && !e.primary_it).length}
                    </span>
                  </div>
                </div>
                <Link to="/events" className="mt-auto block text-center text-xs font-bold py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white transition shadow-lg shadow-amber-900/30">
                  Open Events
                </Link>
              </div>
            </div>
          </div>
        </section>

        
                <section className="rounded-2xl border border-[#1F2937] bg-[#111827]/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1F2937] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Campus Events</h3>
              <p className="text-xs text-slate-400 mt-0.5">Today, upcoming, and unassigned — card view (5 per page).</p>
            </div>
            <Link to="/events" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">
              Open Events Command
            </Link>
          </div>
          <div className="p-5">
            {(() => {
              const today0 = new Date();
              today0.setHours(0, 0, 0, 0);
              const isToday = (e) => {
                const d = e.go_live_at || e.event_date;
                if (!d) return false;
                const day = new Date(d);
                day.setHours(0, 0, 0, 0);
                return day.getTime() === today0.getTime();
              };
              const isUpcoming = (e) => {
                const d = e.go_live_at || e.event_date;
                if (!d) return true;
                return new Date(d) >= today0;
              };
              const ranked = [
                ...events.filter(isToday).map((e) => ({ e, tag: 'Today', tone: 'emerald' })),
                ...events.filter((e) => !e.assigned_engineer && !e.primary_it && !isToday(e)).map((e) => ({ e, tag: 'Unassigned', tone: 'rose' })),
                ...events.filter((e) => isUpcoming(e) && !isToday(e) && (e.assigned_engineer || e.primary_it)).map((e) => ({ e, tag: 'Upcoming', tone: 'blue' })),
              ];
              // dedupe by id
              const seen = new Set();
              const unique = ranked.filter(({ e }) => {
                if (seen.has(e.id)) return false;
                seen.add(e.id);
                return true;
              });
              const pageSize = 5;
              const totalPages = Math.max(1, Math.ceil(unique.length / pageSize));
              const page = Math.min(eventsPage, totalPages - 1);
              const slice = unique.slice(page * pageSize, page * pageSize + pageSize);
              if (unique.length === 0) {
                return <p className="text-center text-xs text-slate-500 italic py-8">No campus events scheduled</p>;
              }
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {slice.map(({ e, tag, tone }) => (
                      <Link
                        key={e.id}
                        to={eventPath(e.id)}
                        className="rounded-xl border border-[#1F2937] bg-[#0B0F19]/70 p-4 hover:border-indigo-500/40 transition group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                            tone === 'emerald' ? 'border-emerald-500/40 text-emerald-400' :
                            tone === 'rose' ? 'border-rose-500/40 text-rose-400' :
                            'border-blue-500/40 text-blue-400'
                          }`}>{tag}</span>
                          <span className="font-mono text-[10px] font-bold text-indigo-400">EVT-{e.id}</span>
                        </div>
                        <p className="text-sm font-bold text-white group-hover:text-indigo-200 line-clamp-2">{e.name}</p>
                        <p className="text-[10px] text-slate-500 mt-2 truncate">{e.venue || e.building || 'Venue TBD'}</p>
                        <div className="flex items-center justify-between mt-3 text-[10px]">
                          <span className="text-slate-400 font-mono">
                            {e.go_live_at
                              ? new Date(e.go_live_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : e.event_date || '—'}
                          </span>
                          <span className="text-slate-300 truncate max-w-[100px]">{e.assigned_engineer || e.primary_it || 'Unassigned'}</span>
                        </div>
                        {e.department && (
                          <p className="text-[9px] text-slate-600 mt-1 uppercase tracking-wider font-bold">{e.department}</p>
                        )}
                      </Link>
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-4">
                      <button
                        type="button"
                        disabled={page <= 0}
                        onClick={() => setEventsPage((p) => Math.max(0, p - 1))}
                        className="px-3 py-1 rounded-lg border border-slate-700 text-[10px] font-bold text-slate-300 disabled:opacity-30"
                      >
                        Prev
                      </button>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {page + 1} / {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={page >= totalPages - 1}
                        onClick={() => setEventsPage((p) => Math.min(totalPages - 1, p + 1))}
                        className="px-3 py-1 rounded-lg border border-slate-700 text-[10px] font-bold text-slate-300 disabled:opacity-30"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </section>


<section className="rounded-2xl border border-[#1F2937] bg-[#111827]/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1F2937] flex flex-wrap items-center gap-3 justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Master Activity Stream</h3>
            <div className="flex items-center gap-2">
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter quick-bar…" className="dark-input py-1.5 w-48 text-[11px] bg-[#0B0F19]" />
              <Link to="/campus-support" className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10">
                View Master Stream
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto custom-scroll">
            <table className="w-full text-left min-w-[900px]">
              <thead>
                <tr className="text-[9px] uppercase tracking-widest text-slate-500 border-b border-[#1F2937]">
                  <th className="px-5 py-3 font-bold">ID</th>
                  <th className="px-5 py-3 font-bold">Ticket Subject</th>
                  <th className="px-5 py-3 font-bold">Priority</th>
                  <th className="px-5 py-3 font-bold">Team</th>
                  <th className="px-5 py-3 font-bold">Engineer</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Last Updated</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {stream.map((t) => {
                  const isWs = isSupportWorkstationTicket(t);
                  const engName = t.assigned_engineer || t.lab_engineer || '';
                  return (
                    <tr key={t.id} className="border-b border-[#1F2937]/50 hover:bg-[#1F2937]/30 transition">
                      <td className="px-5 py-3">
                        <Link to={`/tickets/${t.id}`} className="font-mono font-bold text-indigo-400 hover:underline">#{t.id}</Link>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={t.user_name} />
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate max-w-[180px]">{t.user_name || '—'}</p>
                            <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{t.description || t.issue_category || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3"><PriorityPill value={t.priority} /></td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center justify-center min-w-[8.5rem] h-6 px-2 rounded-md text-[10px] font-semibold text-slate-300 bg-[#0B0F19] border border-[#1F2937] whitespace-nowrap">
                          {isWs ? 'Support Workstation' : 'Campus Support'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-block max-w-[10rem] truncate text-slate-300 font-medium"
                          title={engName || 'Unassigned'}
                        >
                          {engName || <span className="text-slate-500 italic">Unassigned</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3"><StatusPill status={t.status} action={t.action_required} /></td>
                      <td className="px-5 py-3 text-slate-500 font-mono text-[10px]">{timeAgo(t.updated_at || t.created_at)}</td>
                    </tr>
                  );
                })}
                {!loading && stream.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-500 italic">No tickets in stream</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>



    </>
  );
}


export default function Dashboard() {
  const { user } = useAuth();
  if (isEngineerOnly(user)) return <EngineerDashboard user={user} />;
  return <OpsDashboard user={user} />;
}
