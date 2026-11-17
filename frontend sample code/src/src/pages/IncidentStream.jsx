import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate , useSearchParams} from 'react-router-dom';
import { ticketsApi, settingsApi, usersApi, staffApi, adminNotificationsApi } from '../lib/api';
import { ticketPath, resolveParamId, encodeRef } from '../lib/ids';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { isAdmin } from '../lib/rbac';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDate, formatTimeWithDay, formatDateTime } from '../lib/datetime';
import { getLatestRemark } from '../lib/printForms';
import { useRealtimeSync } from '../lib/realtime';

const FALLBACK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export default function IncidentStreamPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const canAssign = isAdmin(user);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [streamSearch, setStreamSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDatePop, setShowDatePop] = useState(false);
  const [engineerFilter, setEngineerFilter] = useState('all');
  const [priorities, setPriorities] = useState(FALLBACK_PRIORITIES);
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedId, setExpandedId] = useState(null);

  // Sync quick-preview with ?preview= UUID/id on this board (e.g. /1400?preview=…)
  useEffect(() => {
    const raw = searchParams.get('preview');
    if (!raw) {
      setExpandedId(null);
      return;
    }
    const id = resolveParamId(raw);
    setExpandedId(id != null ? Number(id) || id : null);
  }, [searchParams]);

  const [engineers, setEngineers] = useState([]);
  const [assignDialog, setAssignDialog] = useState(null); // { ticketId, current }
  const [statusDialog, setStatusDialog] = useState(null); // { ticketId, current }
  const [userNotFoundDialog, setUserNotFoundDialog] = useState(null); // { ticketId, fromStatus, statusName }
  const [statusCatalog, setStatusCatalog] = useState([]);

  const [activityNotes, setActivityNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);

  const [statusMeta, setStatusMeta] = useState({}); // name(lower) → { requires_comment }
  const [assigning, setAssigning] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const data = await ticketsApi.all();
        const rows = Array.isArray(data) ? data : [];
        // Keep cached designation from previous rows / expand enrichment (no bulk search — keeps list fast)
        setTickets((prev) => {
          const prevMap = new Map((prev || []).map((t) => [t.id, t]));
          return rows.map((t) => {
            const old = prevMap.get(t.id);
            if (old?.designation && !t.designation) return { ...t, designation: old.designation };
            return t;
          });
        });
        setLoadError(null);
      } catch (e) {
        const msg = e?.message || 'Could not load tickets';
        if (!silent) {
          setLoadError(msg);
          showToast('error', 'Sync failed', msg);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [showToast]
  );

  
  const loadNotifications = useCallback(async () => {
    if (!canAssign) return;
    try {
      setNotesLoading(true);
      const res = await adminNotificationsApi.list({ limit: 40 });
      const list = Array.isArray(res?.notifications) ? res.notifications : [];
      // Server is source of truth for global dismiss — do not filter with localStorage
      setActivityNotes(list.filter((n) => n?.eventKey));
    } catch {
      setActivityNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }, [canAssign]);

  useEffect(() => {
    if (!canAssign) return undefined;
    loadNotifications();
    // Near-realtime: short poll + refresh on focus/visibility (no separate notification bus)
    const iv = setInterval(loadNotifications, 12000);
    const onFocus = () => loadNotifications();
    const onVis = () => {
      if (document.visibilityState === 'visible') loadNotifications();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(iv);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [canAssign, loadNotifications]);

  useRealtimeSync(
    (payload) => {
      // Tickets/history change → refresh list; pending submissions → refresh notifications
      if (typeof load === 'function') {
        try {
          load(true);
        } catch {
          /* load may need silent flag */
        }
      }
      if (canAssign) loadNotifications();
    },
    { enabled: true, debounceMs: 1000 }
  );

  async function dismissNotification(eventKey) {
    if (!eventKey) return;
    // Optimistic UI — server persists GLOBAL dismiss for all admins
    setActivityNotes((prev) => prev.filter((n) => n.eventKey !== eventKey));
    try {
      const res = await adminNotificationsApi.dismiss([eventKey]);
      if (res?.persisted === false) {
        showToast(
          'warning',
          'Dismiss may not sync',
          res?.warning || 'Run the admin_notification_dismissals migration so all admins share dismissals.'
        );
      }
    } catch (e) {
      showToast('error', 'Dismiss failed', e.message || 'Could not persist dismissal');
      // Reload from server so UI matches reality
      loadNotifications();
    }
  }

useEffect(() => {
    load();
    const t = setInterval(() => load(true), 12000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const [pRes, stRes] = await Promise.all([
          settingsApi.list('priority-tiers', true).catch(() => null),
          settingsApi.list('ticket-statuses', true).catch(() => null),
        ]);
        const pNames = (pRes?.data || []).map((r) => r.name).filter(Boolean);
        if (pNames.length) setPriorities(pNames);
        // Status catalog is 100% from Settings → ticket_statuses (database). No hardcoded list.
        const rows = Array.isArray(stRes?.data) ? stRes.data : [];
        const stNames = [];
        const seen = new Set();
        for (const r of rows) {
          let n = r?.name;
          if (!n) continue;
          const l = String(n).toLowerCase();
          if (l === 'in hardware lab' || l === 'sent to lab 6004') continue;
          if (l === 'sent to hardware' || l === 'send to hardware') n = 'Send to Hardware';
          const key = String(n).toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          stNames.push(n);
        }
        setStatusCatalog(stNames);
        const meta = {};
        rows.forEach((r) => {
          if (r?.name) {
            meta[String(r.name).toLowerCase()] = {
              requires_comment: Boolean(r.requires_comment),
            };
          }
        });
        setStatusMeta(meta);
      } catch {
        setStatusCatalog([]);
        setStatusMeta({});
      }
    })();
  }, []);

  useEffect(() => {
    if (!canAssign) return;
    (async () => {
      try {
        const list = await staffApi.engineers();
        setEngineers(Array.isArray(list) ? list : []);
      } catch {
        setEngineers([]);
      }
    })();
  }, [canAssign]);

  function openAssignDialog(ticket, e) {
    e?.stopPropagation?.();
    if (!canAssign) return;
    setAssignDialog({
      ticketId: ticket.id,
      current: ticket.assigned_engineer || '',
    });
  }

  async function confirmAssign(engineerName) {
    if (!assignDialog?.ticketId) return;
    const name = engineerName || '';
    setAssigning(true);
    try {
      const ticket = tickets.find((t) => t.id === assignDialog.ticketId);
      let statusUpdate = {};
      // Auto-progress Open → In Progress when assigning
      if (name && ticket?.status === 'Open') {
        statusUpdate = { status: 'In Progress' };
      }
      await ticketsApi.update(
        assignDialog.ticketId,
        { assigned_engineer: name, ...statusUpdate },
        {
          engineerName: user?.fullName,
          actionNote: name
            ? `Assigned field tech: ${name}`
            : 'Cleared field tech assignment',
        }
      );
      showToast(
        'success',
        name ? 'Engineer assigned' : 'Assignment cleared',
        name ? `${name} is now assigned to #${assignDialog.ticketId}.` : `Ticket #${assignDialog.ticketId} is unassigned.`
      );
      setAssignDialog(null);
      await load(true);
    } catch (err) {
      showToast('error', 'Assign failed', err.message);
    } finally {
      setAssigning(false);
    }
  }


  function openStatusDialog(ticket, e) {
    e?.stopPropagation?.();
    if (!canAssign) return;
    setStatusDialog({
      ticketId: ticket.id,
      current: ticket.status || '',
    });
  }

  async function confirmStatusChange(nextStatus) {
    if (!statusDialog?.ticketId || !nextStatus) return;
    const id = statusDialog.ticketId;
    const ticket = tickets.find((x) => x.id === id);
    const lower = String(nextStatus).toLowerCase();

    // Send to Hardware / Brought to Helpdesk → open ticket for mandatory device intake (+ HW remark)
    if (lower === 'brought to helpdesk') {
      setStatusDialog(null);
      navigate(`${ticketPath(id)}?action=edit&intent=brought`);
      return;
    }
    if (
      lower === 'send to hardware' ||
      lower === 'sent to hardware' ||
      lower === 'sent to lab 6004' ||
      lower.includes('send to hardware') ||
      lower.includes('sent to hardware')
    ) {
      setStatusDialog(null);
      navigate(`${ticketPath(id)}?action=edit&intent=send-hw`);
      return;
    }

    // Statuses with requires_comment in Settings (e.g. User Not Found) need a mandatory note
    const meta = statusMeta[lower];
    if (meta?.requires_comment || lower === 'user not found') {
      setStatusDialog(null);
      setUserNotFoundDialog({
        ticketId: id,
        fromStatus: ticket?.status || '—',
        statusName: nextStatus,
      });
      return;
    }

    // Send to Support Workstation is an action → persist as Support Workstation (distinct from hardware lab)
    let statusPayload = { status: nextStatus };
    let displayLabel = nextStatus;
    if (
      lower === 'send to support workstation' ||
      lower === 'send 6004 to support workstation' ||
      lower === 'sent to support workstation'
    ) {
      statusPayload = { status: 'Support Workstation', action_required: 'Support Workstation' };
      displayLabel = 'Support Workstation';
    } else if (lower === 'support workstation') {
      statusPayload = { status: 'Support Workstation', action_required: 'Support Workstation' };
    } else if (
      lower === 'ready for return' ||
      lower === 'ready to handover' ||
      lower === 'ready for handover' ||
      lower === 'ready for pickup'
    ) {
      statusPayload = { status: 'Ready for Return', action_required: 'Ready for Return' };
      displayLabel = 'Ready for Return';
    }

    setStatusSaving(true);
    try {
      const result = await ticketsApi.update(id, statusPayload, {
        engineerName: user?.fullName,
        actionNote: `Status changed: ${ticket?.status || '—'} → ${displayLabel}`,
      });
      if (!result || result.success === false) {
        throw new Error(result?.message || result?.error || 'Status was not saved');
      }
      const saved = result.data?.status || displayLabel;
      showToast('success', 'Status updated', `Ticket #${id} → ${saved}`);
      setStatusDialog(null);
      await load(true);
    } catch (err) {
      showToast('error', 'Status change failed', err.message || 'Could not save status');
    } finally {
      setStatusSaving(false);
    }
  }

  async function confirmUserNotFound(noteText) {
    if (!userNotFoundDialog?.ticketId) return;
    const trimmed = String(noteText || '').trim();
    if (!trimmed) return;
    const id = userNotFoundDialog.ticketId;
    const fromStatus = userNotFoundDialog.fromStatus || '—';
    const statusName = userNotFoundDialog.statusName || 'User Not Found';
    setStatusSaving(true);
    try {
      const ticket = tickets.find((x) => x.id === id);
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      const block = `=== ${user?.fullName || 'Engineer'} | ${ts} | STATUS · ${fromStatus} → ${statusName} ===\n${trimmed}\n`;
      const existing = ticket?.it_engineer_remarks || '';
      const remarksPayload = existing + (existing && !existing.endsWith('\n') ? '\n' : '') + block;
      await ticketsApi.update(
        id,
        {
          status: statusName,
          action_required: statusName,
          it_engineer_remarks: remarksPayload,
        },
        {
          engineerName: user?.fullName,
          actionNote: `Status changed: ${fromStatus} → ${statusName} · Remark: ${trimmed}`,
        }
      );
      showToast('success', 'Status updated', `Ticket #${id} → ${statusName}`);
      setUserNotFoundDialog(null);
      await load(true);
    } catch (err) {
      showToast('error', 'Status change failed', err.message);
    } finally {
      setStatusSaving(false);
    }
  }

  const departments = [...new Set(tickets.map((t) => t.department).filter(Boolean))].sort();
  const statuses = [...new Set(tickets.map((t) => t.status).filter(Boolean))].sort();
  const engineersList = [...new Set(tickets.map((t) => t.assigned_engineer).filter(Boolean))].sort();

  const filtered = tickets.filter((t) => {
    const q = (streamSearch || '').toLowerCase().trim();
    if (q) {
      const hay = [
        t.id,
        t.user_name,
        t.extension,
        t.department,
        t.designation,
        t.building,
        t.room_location,
        t.description,
        t.status,
        t.priority,
        t.assigned_engineer,
        t.lab_engineer,
        t.issue_category,
        t.asset_tag,
        t.serial_number,
        t.hw_type,
        t.device_brand,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && (t.priority || '') !== priorityFilter) return false;
    if (deptFilter !== 'all' && (t.department || '') !== deptFilter) return false;
    if (engineerFilter !== 'all' && (t.assigned_engineer || '') !== engineerFilter) return false;
    if (dateFrom) {
      const d = t.created_at ? new Date(t.created_at) : null;
      if (!d || d < new Date(dateFrom + 'T00:00:00')) return false;
    }
    if (dateTo) {
      const d = t.created_at ? new Date(t.created_at) : null;
      if (!d || d > new Date(dateTo + 'T23:59:59')) return false;
    }
    return true;
  });

  const activeChips = [];
  if (statusFilter !== 'all')
    activeChips.push({ key: 'status', label: `Status: ${statusFilter}`, clear: () => setStatusFilter('all') });
  if (priorityFilter !== 'all')
    activeChips.push({
      key: 'priority',
      label: `Priority: ${priorityFilter}`,
      clear: () => setPriorityFilter('all'),
    });
  if (deptFilter !== 'all')
    activeChips.push({ key: 'dept', label: `Dept: ${deptFilter}`, clear: () => setDeptFilter('all') });
  if (engineerFilter !== 'all')
    activeChips.push({
      key: 'eng',
      label: `Engineer: ${engineerFilter}`,
      clear: () => setEngineerFilter('all'),
    });
  if (dateFrom || dateTo)
    activeChips.push({
      key: 'date',
      label: `Date: ${dateFrom || '…'} → ${dateTo || '…'}`,
      clear: () => {
        setDateFrom('');
        setDateTo('');
      },
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const slice = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  async function toggleExpand(id) {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    // Reflect quick-preview in URL: /1400?preview={uuid}
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next == null) p.delete('preview');
      else p.set('preview', encodeRef('ticket', next));
      return p;
    }, { replace: true });
    // Lazy-load designation only for the opened row (keeps list instant)
    const t = tickets.find((x) => x.id === id);
    if (!t || t.designation || !t.user_name || next == null) return;
    try {
      const found = await usersApi.search(t.user_name);
      const match = (Array.isArray(found) ? found : []).find(
        (u) =>
          String(u.name || '')
            .trim()
            .toLowerCase() === String(t.user_name).trim().toLowerCase()
      );
      if (match?.designation) {
        setTickets((prev) =>
          prev.map((row) => (row.id === id ? { ...row, designation: match.designation } : row))
        );
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <header className="h-20 flex items-center justify-between px-8 bg-[#111827] border-b border-[#1F2937] shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Incident Stream</h2>
          <p className="text-xs text-gray-400 font-medium mt-0.5">Master ledger of all active service requests.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => load()}
            className="w-10 h-10 bg-[#1F2937] rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition border border-[#374151]"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <Link
            to="/campus-support/new"
            className="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-[0_0_15px_rgba(79,70,229,0.25)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Log New Ticket
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative bg-[#0B0F19] flex flex-col min-h-0">

      {loadError && (
        <div className="mx-4 md:mx-6 mt-4 rounded-xl border border-rose-500/35 bg-rose-950/25 px-4 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div>
            <p className="text-sm font-bold text-rose-300">Could not load incident stream</p>
            <p className="text-xs text-slate-500 mt-0.5">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={() => load(false)}
            className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {canAssign && activityNotes.length > 0 && (
        <div className="mx-4 md:mx-6 mt-4 rounded-xl border border-amber-500/35 bg-gradient-to-r from-amber-950/40 via-[#111827] to-[#111827] overflow-hidden shrink-0">
          <div className="px-4 py-3 flex flex-wrap items-start justify-between gap-3 border-b border-amber-500/20">
            <div>
              <p className="text-xs font-bold text-amber-200 uppercase tracking-wider">
                Engineer submissions awaiting approval
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {activityNotes.length} ticket{activityNotes.length === 1 ? '' : 's'} need Admin review
                {notesLoading ? ' · refreshing…' : ''}
              </p>
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto custom-scroll divide-y divide-[#1F2937]">
            {activityNotes.map((n) => (
              <div key={n.eventKey} className="px-4 py-2.5 flex flex-wrap items-center gap-3 justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white leading-snug">{n.summary}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    <span className="text-slate-300 font-semibold">Requester:</span>{' '}
                    {n.requesterName || '—'}
                    {n.requesterDepartment ? ` · ${n.requesterDepartment}` : ''}
                    {n.requesterLocation ? ` · ${n.requesterLocation}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    <span className="text-slate-400">Submitted by:</span>{' '}
                    {n.submittedBy || n.actor || 'Engineer'}
                    {n.timestamp ? ` · ${formatDateTime(n.timestamp)}` : ''}
                    {n.status ? (
                      <span className="ml-2 text-[9px] uppercase tracking-wider font-bold text-amber-500/80">
                        {n.status}
                      </span>
                    ) : null}
                  </p>
                  {n.detail ? (
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.detail}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={ticketPath(n.ticketId, { action: 'view' })}
                    className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold inline-flex items-center"
                  >
                    Open #{n.ticketId}
                  </Link>
                  <button
                    type="button"
                    className="h-8 px-2 rounded-lg border border-[#374151] text-[10px] font-bold text-slate-400 hover:text-white"
                    onClick={() => dismissNotification(n.eventKey)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

        <div className="bg-[#111827] border-b border-[#1F2937] flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1F2937] bg-[#0B0F19]/80 space-y-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <svg
                  className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  value={streamSearch}
                  onChange={(e) => {
                    setStreamSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search tickets, extension, department…"
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#111827] border border-[#374151] text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 px-3 rounded-full bg-[#111827] border border-[#374151] text-[11px] font-bold text-slate-300 outline-none focus:border-indigo-500 max-w-[140px]"
              >
                <option value="all">Status</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 px-3 rounded-full bg-[#111827] border border-[#374151] text-[11px] font-bold text-slate-300 outline-none focus:border-indigo-500 max-w-[120px]"
              >
                <option value="all">Priority</option>
                {priorities.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 px-3 rounded-full bg-[#111827] border border-[#374151] text-[11px] font-bold text-slate-300 outline-none focus:border-indigo-500 max-w-[140px]"
              >
                <option value="all">Department</option>
                {departments.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={engineerFilter}
                onChange={(e) => {
                  setEngineerFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 px-3 rounded-full bg-[#111827] border border-[#374151] text-[11px] font-bold text-slate-300 outline-none focus:border-indigo-500 max-w-[150px]"
              >
                <option value="all">Engineer</option>
                {engineersList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDatePop((v) => !v)}
                  className="h-9 px-3 rounded-full bg-[#111827] border border-[#374151] text-[11px] font-bold text-slate-300 hover:border-indigo-500"
                >
                  {dateFrom || dateTo ? `${dateFrom || '…'} → ${dateTo || '…'}` : 'Date range'}
                </button>
                {showDatePop && (
                  <div className="absolute right-0 top-10 z-30 w-72 rounded-xl border border-[#374151] bg-[#111827] shadow-2xl p-3 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        {
                          label: 'Today',
                          fn: () => {
                            const d = new Date().toISOString().slice(0, 10);
                            setDateFrom(d);
                            setDateTo(d);
                          },
                        },
                        {
                          label: 'Last 7 days',
                          fn: () => {
                            const t0 = new Date();
                            const f = new Date(t0);
                            f.setDate(f.getDate() - 6);
                            setDateFrom(f.toISOString().slice(0, 10));
                            setDateTo(t0.toISOString().slice(0, 10));
                          },
                        },
                        {
                          label: 'This month',
                          fn: () => {
                            const t0 = new Date();
                            setDateFrom(
                              `${t0.getFullYear()}-${String(t0.getMonth() + 1).padStart(2, '0')}-01`
                            );
                            setDateTo(t0.toISOString().slice(0, 10));
                          },
                        },
                      ].map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => {
                            p.fn();
                            setPage(1);
                            setShowDatePop(false);
                          }}
                          className="px-2 py-1 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-300"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold uppercase text-slate-500">From</label>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => {
                            setDateFrom(e.target.value);
                            setPage(1);
                          }}
                          className="w-full h-9 mt-1 rounded-lg bg-[#0B0F19] border border-[#374151] text-xs text-white px-2 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold uppercase text-slate-500">To</label>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => {
                            setDateTo(e.target.value);
                            setPage(1);
                          }}
                          className="w-full h-9 mt-1 rounded-lg bg-[#0B0F19] border border-[#374151] text-xs text-white px-2 outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDatePop(false)}
                      className="w-full h-8 rounded-lg bg-indigo-600 text-white text-[11px] font-bold"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setStreamSearch('');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                  setDeptFilter('all');
                  setEngineerFilter('all');
                  setDateFrom('');
                  setDateTo('');
                  setPage(1);
                }}
                className="h-9 px-3 text-[11px] font-bold text-slate-400 hover:text-white"
              >
                Clear all
              </button>
              <span className="ml-auto text-[10px] text-slate-500 font-mono">{filtered.length} results</span>
            </div>
            {activeChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {activeChips.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      c.clear();
                      setPage(1);
                    }}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-bold text-indigo-300"
                  >
                    {c.label} <span className="text-indigo-400">✕</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto custom-scroll min-h-0">
            <table className="w-full text-left min-w-[1200px] border-collapse table-fixed">
              <thead className="sticky top-0 bg-[#0B0F19] z-10 border-b border-[#1F2937]">
                <tr className="text-gray-400 text-[10px] uppercase tracking-widest font-bold bg-[#111827]">
                  <th className="p-3.5 w-[4%] pl-5 whitespace-nowrap">ID</th>
                  <th className="p-3.5 w-[7%] whitespace-nowrap">Date/Time</th>
                  <th className="p-3.5 w-[16%] border-r border-[#1F2937]/80">User Profile</th>
                  <th className="p-3.5 w-[8%]">Location</th>
                  <th className="p-3.5 w-[9%]">Category</th>
                  <th className="p-3.5 w-[16%]">Issue Details</th>
                  <th className="p-3.5 w-[10%]">Engineer</th>
                  <th className="p-3.5 w-[10%] text-center">Status</th>
                  <th className="p-3.5 w-[14%]">Latest Remark</th>
                  <th className="p-3.5 w-[6%] text-center pr-5 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2937]/60 text-sm font-medium text-gray-300 bg-[#111827]">
                {loading && (
                  <tr>
                    <td colSpan={10} className="p-10 text-center text-gray-500">
                      Loading tickets…
                    </td>
                  </tr>
                )}
                {!loading && slice.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-10 text-center text-gray-500 italic">
                      No tickets found.
                    </td>
                  </tr>
                )}
                {slice.map((t) => {
                  const d = t.created_at ? new Date(t.created_at) : null;
                  const updated = t.updated_at
                    ? new Date(t.updated_at)
                    : t.resolved_at
                      ? new Date(t.resolved_at)
                      : null;
                  // Source of truth for operational remarks is it_engineer_remarks (same as ticket timeline)
                  let latest = getLatestRemark(t) || '';
                  if (!latest && t.diagnostic_notes) {
                    const parts = String(t.diagnostic_notes).split('\n-------------------------\n');
                    latest = parts[parts.length - 1].replace(/\n/g, ' ').trim();
                  }
                  if (!latest && t.final_remarks) {
                    latest = String(t.final_remarks).trim();
                  }
                  const open = expandedId === t.id;
                  return (
                    <Fragment key={t.id}>
                      <tr
                        onClick={() => toggleExpand(t.id)}
                        className={`table-row-hover transition cursor-pointer border-b border-[#1F2937]/50 ${
                          open ? 'bg-indigo-500/5' : ''
                        }`}
                      >
                        <td className="p-3.5 font-mono font-bold text-indigo-400 align-middle pl-5 whitespace-nowrap">
                          #{t.id}
                        </td>
                        <td className="p-3.5 align-middle whitespace-nowrap">
                          <div className="text-[11px] font-semibold text-gray-300">
                            {d ? formatDate(d) : '—'}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            {d ? formatTimeWithDay(d) : ''}
                          </div>
                        </td>
                        <td className="p-3.5 align-middle border-r border-[#1F2937]/80 pr-4">
                          <div className="font-bold text-white text-[13px] whitespace-normal break-words leading-snug tracking-tight">
                            {t.user_name || '-'}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono mt-1 whitespace-normal break-words leading-snug">
                            Ext: {t.extension || '-'}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 whitespace-normal break-words leading-snug">
                            {t.department || '—'}
                          </div>
                        </td>
                        <td className="p-3.5 align-middle text-gray-300 text-[11px] font-medium">
                          <div className="whitespace-normal break-words leading-snug">
                            {[t.building, t.room_location].filter(Boolean).join(' / ') || '—'}
                          </div>
                        </td>
                        <td className="p-3.5 align-middle">
                          <span className="inline-flex items-center justify-center min-h-[28px] min-w-[6.5rem] max-w-[8rem] px-2 text-[9px] font-bold uppercase tracking-wide bg-[#0B0F19] border border-[#1F2937] text-gray-400 rounded-lg">
                            <span className="truncate">{t.issue_category || 'GENERAL'}</span>
                          </span>
                        </td>
                        <td className="p-3.5 align-middle text-[11px] max-w-[200px]">
                          <div className="text-gray-200 font-medium whitespace-normal break-words leading-snug line-clamp-3">
                            {t.description || '-'}
                          </div>
                        </td>
                        <td className="p-3.5 align-middle">
                          <EngineerBadge name={t.assigned_engineer} />
                        </td>
                        <td className="p-3.5 align-middle text-center">
                          <StatusPill status={t.status} action={t.action_required} lab={t.lab_engineer} />
                        </td>
                        <td className="p-3.5 align-middle max-w-[12rem] relative min-h-[3rem]">
                          {latest ? (
                            <div className="text-xs text-gray-300 font-medium whitespace-normal break-words leading-snug line-clamp-3">
                              {latest.length > 100 ? latest.slice(0, 100) + '…' : latest}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-600/50 italic select-none pointer-events-none">
                              no remarks
                            </span>
                          )}
                        </td>
                        <td
                          className="p-3.5 text-center align-middle whitespace-nowrap pr-6"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            to={ticketPath(t.id, { action: 'view' })}
                            className="bg-[#111827] hover:bg-indigo-600 text-gray-400 hover:text-white px-2.5 py-1 rounded transition border border-[#374151] hover:border-indigo-500 text-[10px] font-bold"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-[#0B0F19]/80 border-b border-[#1F2937]">
                          <td colSpan={10} className="p-0">
                            <div className="px-5 py-4 border-l-2 border-indigo-500/50 bg-[#111827]/50">
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                                    Quick preview · Ticket #{t.id}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    Click row again to collapse · Full view opens the complete ticket workspace
                                  </p>
                                </div>
                                <Link
                                  to={ticketPath(t.id, { action: 'view' })}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold inline-flex items-center shrink-0"
                                >
                                  Full view details →
                                </Link>
                              </div>

                              <div className="flex flex-col lg:flex-row gap-0 border border-[#1F2937] overflow-hidden">
                                {/* Left — user / identity */}
                                <div className="lg:w-[240px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#1F2937] bg-[#0B0F19]/60 p-4 space-y-3">
                                  <PreviewCell label="Requester">
                                    <span className="text-white font-bold text-sm">{t.user_name || '—'}</span>
                                  </PreviewCell>
                                  <PreviewCell label="Designation">{t.designation || '—'}</PreviewCell>
                                  <PreviewCell label="Extension">{t.extension || '—'}</PreviewCell>
                                  <PreviewCell label="Department">{t.department || '—'}</PreviewCell>
                                  <PreviewCell label="Opened">
                                    <div>{d ? formatDateTime(d) : '—'}</div>
                                    {(() => {
                                      const isResolved =
                                        String(t.status || '')
                                          .toLowerCase()
                                          .includes('resolve') || !!t.resolved_at;
                                      const when = t.resolved_at
                                        ? new Date(t.resolved_at)
                                        : updated;
                                      if (!when && !isResolved) return null;
                                      return (
                                        <div className="mt-1.5">
                                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
                                            {isResolved ? 'Resolved at' : 'Last update'}
                                          </p>
                                          <div className="text-slate-200 text-[12px]">
                                            {when
                                              ? formatDateTime(when)
                                              : d
                                                ? formatDateTime(d)
                                                : '—'}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </PreviewCell>
                                </div>

                                {/* Right — ticket ops */}
                                <div className="flex-1 p-4 space-y-4 min-w-0">
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-xs">
                                    <PreviewCell label="Building">{t.building || '—'}</PreviewCell>
                                    <PreviewCell label="Room">{t.room_location || '—'}</PreviewCell>
                                    <PreviewCell label="Category">{t.issue_category || '—'}</PreviewCell>
                                    <PreviewCell label="Priority">
                                      <span className="font-bold text-white">{t.priority || '—'}</span>
                                    </PreviewCell>
                                    <PreviewCell label="Status">
                                      {canAssign ? (
                                        <button
                                          type="button"
                                          onClick={(e) => openStatusDialog(t, e)}
                                          className="group inline-flex items-center gap-1.5 max-w-full text-left rounded-lg px-2 py-1 -mx-2 border border-transparent hover:border-indigo-500/40 hover:bg-indigo-500/10 transition text-slate-200 font-semibold"
                                          title="Click to change status"
                                        >
                                          <span className="truncate">
                                            {String(t.status || '').toLowerCase() === 'sent to hardware' ||
                                            String(t.status || '').toLowerCase() === 'sent to lab 6004'
                                              ? 'In Hardware Lab'
                                              : t.action_required === 'Ready for Return'
                                                ? 'Ready for Return'
                                                : t.status || '—'}
                                          </span>
                                          <svg className="w-3 h-3 text-indigo-400 opacity-70 group-hover:opacity-100 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                          </svg>
                                        </button>
                                      ) : (
                                        <span className="font-semibold">
                                          {String(t.status || '').toLowerCase() === 'sent to hardware' ||
                                          String(t.status || '').toLowerCase() === 'sent to lab 6004'
                                            ? 'In Hardware Lab'
                                            : t.action_required === 'Ready for Return'
                                              ? 'Ready for Return'
                                              : t.status || '—'}
                                        </span>
                                      )}
                                    </PreviewCell>
                                  </div>
                                  {/* Assignment — lab engineer only when device is in helpdesk/lab flow */}
                                  {(() => {
                                    const st = String(t.status || '').toLowerCase();
                                    const showLab =
                                      !!t.lab_engineer &&
                                      (st.includes('helpdesk') ||
                                        st.includes('lab') ||
                                        st.includes('diagnostic') ||
                                        st.includes('parts') ||
                                        st.includes('brought') ||
                                        st.includes('sent to lab') ||
                                        t.action_required === 'Under Diagnostics' ||
                                        t.action_required === 'In Hardware Lab' ||
                                        t.action_required === 'Waiting for Parts' ||
                                        t.action_required === 'Ready for Return');
                                    return (
                                      <div
                                        className={`grid gap-3 text-xs border border-[#1F2937] bg-[#0B0F19]/40 p-3 ${
                                          showLab ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                                        }`}
                                      >
                                        <PreviewCell label="Assigned field tech">
                                          {canAssign ? (
                                            <button
                                              type="button"
                                              onClick={(e) => openAssignDialog(t, e)}
                                              className={`group inline-flex items-center gap-1.5 max-w-full text-left rounded-lg px-2 py-1 -mx-2 border border-transparent hover:border-indigo-500/40 hover:bg-indigo-500/10 transition ${
                                                t.assigned_engineer
                                                  ? 'text-emerald-300 font-bold'
                                                  : 'text-slate-500 italic'
                                              }`}
                                              title="Click to assign engineer"
                                            >
                                              <span className="truncate">{t.assigned_engineer || 'Unassigned'}</span>
                                              <svg
                                                className="w-3 h-3 text-indigo-400 opacity-70 group-hover:opacity-100 shrink-0"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth="2"
                                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                                />
                                              </svg>
                                            </button>
                                          ) : (
                                            <span
                                              className={
                                                t.assigned_engineer
                                                  ? 'text-emerald-300 font-bold'
                                                  : 'text-slate-500 italic'
                                              }
                                            >
                                              {t.assigned_engineer || 'Unassigned'}
                                            </span>
                                          )}
                                        </PreviewCell>
                                        {showLab ? (
                                          <PreviewCell label="Lab engineer">
                                            <span className="text-purple-300 font-bold">{t.lab_engineer}</span>
                                          </PreviewCell>
                                        ) : null}
                                      </div>
                                    );
                                  })()}
                                  <div className="border-t border-[#1F2937] pt-3 space-y-3">
                                    <PreviewCell label="Description">
                                      <span className="text-slate-200 whitespace-normal break-words [overflow-wrap:anywhere] leading-relaxed">
                                        {t.description || '—'}
                                      </span>
                                    </PreviewCell>
                                    <PreviewCell label="Latest remark">
                                      {latest ? (
                                        <span className="text-slate-300 whitespace-normal break-words leading-relaxed">
                                          {latest}
                                        </span>
                                      ) : (
                                        <span className="text-slate-600 italic text-[11px]">No remarks yet</span>
                                      )}
                                    </PreviewCell>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#1F2937] px-4 py-3 sm:px-6 bg-[#111827]">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Showing{' '}
              <span className="text-slate-300">
                {filtered.length === 0 ? 0 : (page - 1) * rowsPerPage + 1}–
                {Math.min(page * rowsPerPage, filtered.length)}
              </span>{' '}
              of <span className="text-slate-300">{filtered.length}</span> tickets
            </span>
            <select
              aria-label="Rows per page"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="h-8 border border-[#374151] bg-[#0B0F19] px-2 text-xs text-slate-300 outline-none rounded-md"
            >
              <option value={15}>15 / page</option>
              <option value={30}>30 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#374151] text-slate-400 disabled:opacity-30 hover:bg-[#1F2937]"
            >
              ‹
            </button>
            <span className="text-xs text-slate-400 font-bold px-3">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#374151] text-slate-400 disabled:opacity-30 hover:bg-[#1F2937]"
            >
              ›
            </button>
          </div>
        </footer>
      </main>

      <ConfirmDialog
        open={!!assignDialog}
        mode="select"
        selectKind="engineer"
        title={`Assign field tech · #${assignDialog?.ticketId || ''}`}
        message="Choose an engineer for this ticket. Assignment is saved immediately and recorded in the audit log."
        confirmLabel={assigning ? 'Saving…' : 'Assign'}
        cancelLabel="Cancel"
        tone="indigo"
        defaultValue={assignDialog?.current || ''}
        options={engineers.map((e) => ({
          value: e.full_name,
          label: e.full_name,
        }))}
        onCancel={() => !assigning && setAssignDialog(null)}
        onConfirm={(val) => {
          if (!assigning) confirmAssign(val);
        }}
      />
      <ConfirmDialog
        open={!!statusDialog}
        mode="select"
        selectKind="status"
        title={`Change status · #${statusDialog?.ticketId || ''}`}
        message="Select the new ticket status. Brought to Helpdesk and Sent to Hardware open the ticket for device intake. User Not Found requires a mandatory comment."
        confirmLabel={statusSaving ? 'Saving…' : 'Update status'}
        cancelLabel="Cancel"
        tone="indigo"
        required
        defaultValue={statusDialog?.current || ''}
        options={statusCatalog.map((s) => ({ value: s, label: s }))}
        onCancel={() => !statusSaving && setStatusDialog(null)}
        onConfirm={(val) => {
          if (!statusSaving) confirmStatusChange(val);
        }}
      />
      <ConfirmDialog
        open={!!userNotFoundDialog}
        mode="prompt"
        title={`${userNotFoundDialog?.statusName || 'Status'} · #${userNotFoundDialog?.ticketId || ''}`}
        message="A comment is required for this status (configured in Settings). Add a note before saving."
        placeholder="Required comment / notes…"
        confirmLabel={statusSaving ? 'Saving…' : `Set ${userNotFoundDialog?.statusName || 'status'}`}
        cancelLabel="Cancel"
        tone="amber"
        required
        defaultValue=""
        onCancel={() => !statusSaving && setUserNotFoundDialog(null)}
        onConfirm={(val) => {
          if (!statusSaving) confirmUserNotFound(val);
        }}
      />
    </>
  );
}

function PreviewCell({ label, children, className = '' }) {
  return (
    <div className={className}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">{label}</p>
      <div className="text-slate-200 text-[12px]">{children}</div>
    </div>
  );
}

/** Original 1400 status chip design */
function StatusPill({ status, action, lab }) {
  let label = status || 'Open';
  let cls = 'bg-blue-900/30 text-blue-400 border border-blue-900/50';

  if (
    action === 'Ready for Return' ||
    String(status || '').toLowerCase() === 'ready for return' ||
    String(status || '').toLowerCase() === 'ready to handover' ||
    String(status || '').toLowerCase() === 'ready for handover'
  ) {
    return (
      <div className="w-full min-w-[120px] max-w-[140px] text-[10px] font-bold px-2 py-1.5 rounded-lg uppercase tracking-wider bg-emerald-900/40 text-emerald-300 border border-emerald-500/50 inline-flex items-center justify-center whitespace-normal text-center leading-tight">
        Ready for Return
      </div>
    );
  }
  const lower = (status || '').toLowerCase();

  if (lower === 'user not found' || action === 'User Not Found') {
    return (
      <div className="w-full min-w-[120px] max-w-[140px] text-[10px] font-bold px-2 py-1.5 rounded-lg uppercase tracking-wider bg-amber-900/40 text-amber-300 border border-amber-500/50 inline-flex items-center justify-center whitespace-normal text-center leading-tight">
        User Not Found
      </div>
    );
  }
  if (lower === 'support workstation' || action === 'Support Workstation') {
    return (
      <div className="w-full min-w-[120px] max-w-[140px] text-[10px] font-bold px-2 py-1.5 rounded-lg uppercase tracking-wider bg-violet-900/40 text-violet-300 border border-violet-500/50 inline-flex items-center justify-center whitespace-normal text-center leading-tight">
        Support Workstation
      </div>
    );
  }

  if (action === 'Ready for Return') {
    label = 'Ready for Return';
    cls = 'bg-emerald-950 text-emerald-400 border border-emerald-500/60 font-black animate-pulse';
  } else if (lower === 'in diagnostics') {
    label = `Diagnosing: ${lab || 'Lab Tech'}`;
    cls = 'bg-indigo-900/40 text-indigo-300 border border-indigo-500/50';
  } else if (lower === 'waiting for parts') {
    label = 'Waiting for Parts';
    cls = 'bg-orange-900/40 text-orange-300 border border-orange-500/50';
  } else if (
    lower === 'sent to lab 6004' ||
    lower === 'sent to hardware' ||
    lower === 'in hardware lab' ||
    lower.includes('lab 6004') ||
    action === 'Under Diagnostics' ||
    action === 'In Hardware Lab' ||
    (lab &&
      lower !== 'resolved' &&
      lower !== 'open' &&
      lower !== 'in progress' &&
      lower !== 'waiting for device')
  ) {
    label = lab ? `Lab: ${lab}` : 'In Hardware Lab';
    if (lower === 'in diagnostics' || action === 'Under Diagnostics') label = `Diagnosing: ${lab || 'Lab'}`;
    if (lower === 'waiting for parts' || action === 'Waiting for Parts') label = 'Waiting for Parts';
    if (lower === 'sent to lab 6004' || lower === 'sent to hardware') { /* system: show In Hardware Lab */ }
    if (lower === 'brought to helpdesk') label = 'Brought to Helpdesk';
    cls = 'bg-purple-900/40 text-purple-300 border border-purple-500/50';
  } else if (lower === 'brought to helpdesk') {
    label = 'Brought to Helpdesk';
    cls = 'bg-fuchsia-900/30 text-fuchsia-400 border border-fuchsia-900/50';
  } else if (lower === 'open') {
    cls = 'bg-blue-900/30 text-blue-400 border border-blue-900/50';
  } else if (lower === 'in progress') {
    cls = 'bg-amber-900/30 text-amber-400 border border-amber-900/50';
  } else if (lower === 'resolved') {
    cls = 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50';
  } else if (lower.includes('cancel')) {
    cls = 'bg-[#1F2937] text-gray-400 border border-[#374151]';
  }

  return (
    <div
      className={`w-full min-w-[120px] max-w-[140px] text-[10px] font-bold px-2 py-1.5 rounded-lg uppercase tracking-wider ${cls} inline-flex items-center justify-center whitespace-normal text-center leading-tight`}
    >
      {label}
    </div>
  );
}

function EngineerBadge({ name }) {
  // Fixed width so short and long names occupy the same footprint in the table
  const base =
    'inline-flex items-center justify-center h-7 w-[9.25rem] max-w-[9.25rem] px-2.5 text-[10px] font-bold tracking-wide rounded-lg truncate';
  if (!name) {
    return (
      <span
        className={`${base} border border-dashed border-slate-600/80 bg-[#0B0F19]/60 text-slate-500 italic font-medium`}
      >
        Unassigned
      </span>
    );
  }
  return (
    <span
      className={`${base} border border-cyan-400/45 bg-gradient-to-r from-cyan-500/15 via-indigo-500/10 to-violet-500/15 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.12)]`}
      title={name}
    >
      {name}
    </span>
  );
}
