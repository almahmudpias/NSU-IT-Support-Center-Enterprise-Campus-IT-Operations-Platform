import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ticketsApi, staffApi, settingsApi, usersApi } from '../lib/api';
import { useRealtimeSync, useTicketPresence } from '../lib/realtime';
import { resolveParamId } from '../lib/ids';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDateTime } from '../lib/datetime';
import { isAdmin } from '../lib/rbac';
import {
  printTicketReport,
  printReceiveForm,
  printLabHardwareForm,
  getLatestRemark,
} from '../lib/printForms';

/** Early pool statuses — engineers must not go back to these after claim / Brought to Helpdesk */
function isEarlyPoolStatus(name) {
  const k = String(name || '').toLowerCase().trim();
  return (
    k === 'open' ||
    k === 'in progress' ||
    k === 'waiting for device' ||
    k === 'pending approval' ||
    k === 'pending_approval' ||
    k === 'awaiting approval'
  );
}

/**
 * Statuses an engineer may select after they own a workstation / diagnostics ticket.
 * Names still come from Settings (DB) — this only filters which catalog rows appear.
 */
function isEngineerSelectableStatus(name) {
  const k = String(name || '').toLowerCase().trim();
  if (!k) return false;
  if (isEarlyPoolStatus(k)) return false;
  // Not for engineer workflow
  if (k === 'user not found' || k === 'rejected' || k === 'pending approval') return false;
  if (k.includes('user cancel') && !k.includes('cancel')) return false;
  // Allowed lab / hardware progression (and current claimed state)
  if (k === 'brought to helpdesk') return true;
  if (k === 'in diagnostics' || k === 'under diagnostics') return true;
  if (k.includes('send to hardware') || k.includes('sent to hardware')) return true;
  if (k === 'in hardware lab' || k === 'sent to lab 6004') return true;
  if (k === 'waiting for parts') return true;
  if (k.includes('support workstation')) return true;
  if (k.includes('ready for return') || k.includes('ready to handover') || k.includes('ready for handover'))
    return true;
  if (k === 'resolved') return true;
  if (k === 'canceled' || k === 'cancelled') return true;
  return false;
}

/**
 * Build status dropdown labels in Settings sort_order sequence.
 * catalog: [{ name, sort_order }, ...] already sorted ascending by sort_order.
 * - Hides internal "In Hardware Lab" (UI uses Send to Hardware)
 * - Engineer mode: only lab-workflow statuses from DB (Send to Hardware, Waiting for Parts,
 *   Ready to Handover / Return, Resolved, Brought to Helpdesk revert, In Diagnostics, …)
 * - Current status is always included
 */
function statusDropdownOptions(catalog, { engineer = false, currentStatus = '' } = {}) {
  const rows = Array.isArray(catalog) ? catalog : [];
  const items = [];
  const seen = new Set();

  for (const row of rows) {
    const raw = row?.name != null ? String(row.name).trim() : '';
    if (!raw) continue;
    const l = raw.toLowerCase();
    // Internal lab status — use Send to Hardware in the UI list instead
    if (l === 'in hardware lab' || l === 'sent to lab 6004') continue;
    let label = raw;
    if (l === 'sent to hardware' || l === 'send to hardware') label = SEND_TO_HARDWARE_LABEL;
    if (engineer && !isEngineerSelectableStatus(label) && !isEngineerSelectableStatus(raw)) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ label, sort_order: Number(row.sort_order) || 0 });
  }

  // If settings only has In Hardware Lab, still expose Send to Hardware at that sort position
  if (!seen.has(SEND_TO_HARDWARE_LABEL.toLowerCase())) {
    const hwRow = rows.find((r) => {
      const l = String(r?.name || '').toLowerCase();
      return l === 'in hardware lab' || isSendToHardwareStatus(r?.name);
    });
    if (hwRow && (!engineer || isEngineerSelectableStatus(SEND_TO_HARDWARE_LABEL))) {
      items.push({
        label: SEND_TO_HARDWARE_LABEL,
        sort_order: Number(hwRow.sort_order) || 50,
      });
      seen.add(SEND_TO_HARDWARE_LABEL.toLowerCase());
    }
  }

  // Current ticket status must appear (claimed In Diagnostics, etc.)
  const cur = currentStatus && String(currentStatus).trim();
  if (cur) {
    let curLabel = cur;
    const cl = cur.toLowerCase();
    if (cl === 'in hardware lab' || cl === 'sent to lab 6004' || isSendToHardwareStatus(cur)) {
      curLabel = SEND_TO_HARDWARE_LABEL;
    }
    if (!seen.has(curLabel.toLowerCase())) {
      const match = rows.find(
        (r) =>
          String(r?.name || '').toLowerCase() === cl ||
          String(r?.name || '').toLowerCase() === curLabel.toLowerCase()
      );
      items.push({
        label: curLabel,
        sort_order: Number(match?.sort_order) || 9999,
      });
      seen.add(curLabel.toLowerCase());
    }
  }

  items.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
  return items.map((i) => i.label);
}

/** @deprecated use statusDropdownOptions — kept for any residual callers */
function uiStatusOptions(list) {
  const arr = Array.isArray(list) ? list : [];
  return statusDropdownOptions(
    arr.map((name, i) => ({ name, sort_order: (i + 1) * 10 })),
    { engineer: false, currentStatus: '' }
  );
}

/** Strip role suffixes from actor labels — show person name only */
function displayPersonName(name) {
  let s = String(name || '').trim();
  if (!s) return '';
  s = s
    .replace(/\s*\(\s*super\s*admin\s*\)\s*$/i, '')
    .replace(/\s*\(\s*admin\s*\)\s*$/i, '')
    .replace(/\s*\(\s*engineer\s*\)\s*$/i, '')
    .replace(/\s*\(\s*lab\s*\)\s*$/i, '')
    .replace(/\s*[-–|]\s*(super\s*)?admin\s*$/i, '')
    .replace(/\s*[-–|]\s*engineer\s*$/i, '')
    .trim();
  return s || String(name || '').trim();
}

function displayStatus(ticket) {
  if (!ticket) return '—';
  const st = String(ticket.status || '').toLowerCase();
  const ar = String(ticket.action_required || '').toLowerCase();
  const us = String(ticket.user_status || '').toLowerCase();
  if (us === 'handed over' || (st === 'resolved' && us.includes('handed'))) return 'Handed Over';
  if (
    ar === 'ready for return' ||
    st === 'ready for return' ||
    st === 'ready to handover' ||
    st === 'ready for handover' ||
    ar.includes('ready to handover')
  ) {
    return st === 'ready to handover' || st === 'ready for handover' ? 'Ready to Handover' : 'Ready for Return';
  }
  if (st === 'support workstation' || ar === 'support workstation') return 'Support Workstation';
  if (st === 'user not found') return 'User Not Found';
  if (
    st === 'send to hardware' ||
    st === 'sent to hardware' ||
    st === 'sent to lab 6004' ||
    st === 'in hardware lab'
  ) {
    return 'In Hardware Lab';
  }
  return ticket.status || '—';
}

function isReadyForReturnTicket(ticket) {
  if (!ticket) return false;
  const st = String(ticket.status || '').toLowerCase();
  const ar = String(ticket.action_required || '').toLowerCase();
  return (
    ar === 'ready for return' ||
    st === 'ready for return' ||
    st === 'ready to handover' ||
    st === 'ready for handover' ||
    st === 'ready for pickup' ||
    st.includes('ready to handover') ||
    st.includes('ready for handover') ||
    st.includes('ready for return')
  );
}

function isPendingApprovalTicket(ticket) {
  const s = String(ticket?.status || '').toLowerCase();
  return s === 'pending approval' || s === 'pending_approval' || s === 'awaiting approval';
}

function isHandedOverTicket(ticket) {
  if (!ticket) return false;
  const st = String(ticket.status || '').toLowerCase();
  const us = String(ticket.user_status || '').toLowerCase();
  return us === 'handed over' || us.includes('handed over') || (st === 'resolved' && us.includes('handed'));
}


/** Statuses that mean "send device to hardware lab" (UI label: Send to Hardware) */
function isSendToHardwareStatus(s) {
  const v = String(s || '').toLowerCase().trim();
  // Do not treat Support Workstation as hardware lab
  if (v.includes('support workstation')) return false;
  return (
    v === 'send to hardware' ||
    v === 'sent to hardware' ||
    v === 'sent to lab 6004' ||
    v.includes('send to hardware') ||
    v.includes('sent to hardware') ||
    (v.includes('sent to lab') && !v.includes('support'))
  );
}

function isHardwareLabStatus(s) {
  const v = String(s || '').toLowerCase().trim();
  return isSendToHardwareStatus(v) || v.includes('hardware lab') || v === 'in hardware lab';
}

/** Canonical UI option label for the hardware-send action */
const SEND_TO_HARDWARE_LABEL = 'Send to Hardware';


export default function TicketDetailPage() {
  const { id: idParam } = useParams();
  const id = resolveParamId(idParam);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  function goBack() {
    const idx = window.history.state?.idx;
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1);
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/dashboard');
  }
  const [ticket, setTicket] = useState(null);
  const [history, setHistory] = useState([]);
  const [engineers, setEngineers] = useState([]);
  /** Ordered catalog from Settings → ticket_statuses (preserves sort_order) */
  const [statusCatalog, setStatusCatalog] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]); // legacy name list (same order)
  const [statusMeta, setStatusMeta] = useState({}); // name(lower) → { requires_comment, ... }
  const [deviceTypes, setDeviceTypes] = useState(['PC', 'Monitor', 'Printer', 'Scanner', 'Smart Board']);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const [engineer, setEngineer] = useState('');
  const [labEngineer, setLabEngineer] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [hwType, setHwType] = useState('');
  const [brand, setBrand] = useState('');
  const [serial, setSerial] = useState('');
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [hwSendRemark, setHwSendRemark] = useState('');
  const [editingRemarkIdx, setEditingRemarkIdx] = useState(null);
  const [editingRemarkText, setEditingRemarkText] = useState('');
  const [dialog, setDialog] = useState(null); // { type, ... }
  const [loadError, setLoadError] = useState(null);
  const timelineScrollRef = useRef(null);
  const timelineStickToLatest = useRef(true);
  const timelinePrevLen = useRef(0);
  const timelineReady = useRef(false);

  // Messenger-style presence — others viewing / editing this ticket
  const presenceTicketId = ticket?.id != null ? ticket.id : id;
  const presencePeers = useTicketPresence(presenceTicketId, {
    mode: editing ? 'editing' : 'viewing',
    enabled: Boolean(presenceTicketId) && !loading,
    selfName: user?.fullName || '',
    selfUsername: user?.username || '',
  });

  function closeDialog() {
    setDialog(null);
  }

  const timelineEntries = useMemo(
    () => (ticket ? buildTimeline(ticket, history) : []),
    [ticket, history]
  );

  function onTimelineScroll() {
    const el = timelineScrollRef.current;
    if (!el) return;
    // User is "at latest" if within ~80px of the bottom
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    timelineStickToLatest.current = distanceFromBottom < 80;
  }

  // Open timeline at the latest event (bottom). Only auto-follow when user is already near latest.
  useLayoutEffect(() => {
    const el = timelineScrollRef.current;
    if (!el || !timelineEntries.length) return;

    const len = timelineEntries.length;
    const grew = len > timelinePrevLen.current;
    const firstPaint = !timelineReady.current;

    if (firstPaint || (grew && timelineStickToLatest.current)) {
      el.scrollTop = el.scrollHeight;
      timelineStickToLatest.current = true;
    }
    timelinePrevLen.current = len;
    timelineReady.current = true;
  }, [timelineEntries]);

  // Reset stick-to-latest when switching tickets
  useEffect(() => {
    timelineReady.current = false;
    timelinePrevLen.current = 0;
    timelineStickToLatest.current = true;
  }, [id]);

  // Refs so silent background refresh never clobber in-progress edits
  const editingRef = useRef(false);
  const savingRef = useRef(false);
  const dialogRef = useRef(null);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);
  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);
  useEffect(() => {
    dialogRef.current = dialog;
  }, [dialog]);

  /**
   * @param {{ silent?: boolean, preserveForm?: boolean }} opts
   * silent — no loading flash
   * preserveForm — do not overwrite status/description/device fields (user is editing)
   */
  const load = useCallback(async (opts = {}) => {
    const silent = Boolean(opts.silent);
    const preserveForm = Boolean(opts.preserveForm);
    try {
      if (!silent) {
        setLoading(true);
        setLoadError(null);
      }
      const [ticketRes, hist, eng, stRes, dtRes, catRes] = await Promise.all([
        ticketsApi.get(id),
        ticketsApi.history(id, { limit: 200 }).catch(() => []),
        staffApi.engineers().catch(() => []),
        settingsApi.list('ticket-statuses', true).catch(() => null),
        settingsApi.list('device-types', true).catch(() => null),
        settingsApi.list('issue-categories', true).catch(() => null),
      ]);
      // Prefer direct GET (works for engineers under ownership scope)
      let t =
        ticketRes && !Array.isArray(ticketRes) && ticketRes.id != null
          ? ticketRes
          : ticketRes?.ticket || null;

      // Enrich designation from users if missing on ticket
      if (t && !t.designation && t.user_name) {
        try {
          const found = await usersApi.search(t.user_name);
          const match = (Array.isArray(found) ? found : []).find(
            (u) =>
              String(u.name || '')
                .trim()
                .toLowerCase() ===
              String(t.user_name)
                .trim()
                .toLowerCase()
          );
          if (match?.designation) t = { ...t, designation: match.designation };
        } catch {
          /* ignore */
        }
      }

      setTicket(t || null);
      setHistory(Array.isArray(hist) ? hist : []);
      if (Array.isArray(eng) && eng.length) setEngineers(eng);
      {
        const rows = Array.isArray(stRes?.data) ? stRes.data : [];
        // Sequential order from Settings → ticket_statuses.sort_order (source of truth)
        const ordered = [...rows]
          .filter((r) => r?.name && r.is_active !== false)
          .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
        if (ordered.length) {
          setStatusCatalog(
            ordered.map((r) => ({
              name: r.name,
              sort_order: Number(r.sort_order) || 0,
            }))
          );
          setStatusOptions(ordered.map((r) => r.name).filter(Boolean));
          const meta = {};
          ordered.forEach((r) => {
            if (r?.name) {
              meta[String(r.name).toLowerCase()] = {
                requires_comment: Boolean(r.requires_comment),
                is_terminal: Boolean(r.is_terminal),
                color: r.color || null,
                sort_order: Number(r.sort_order) || 0,
              };
            }
          });
          setStatusMeta(meta);
        }
      }
      const dtNames = (dtRes?.data || []).map((r) => r.name).filter(Boolean);
      if (dtNames.length) setDeviceTypes(dtNames);
      const catNames = (catRes?.data || []).map((r) => r.name).filter(Boolean);
      if (catNames.length) setCategories(catNames);
      // Never overwrite form fields while user is editing or mid-save / dialog
      if (t && !preserveForm) {
        setStatus((() => {
          const s = t.status || 'Open';
          const l = s.toLowerCase();
          // Prefer actual ticket.status (Ready to Handover is distinct from Ready for Return)
          if (l === 'ready to handover' || l === 'ready for handover') return 'Ready to Handover';
          if (l === 'ready for return' || t.action_required === 'Ready for Return') return 'Ready for Return';
          // Persisted as In Hardware Lab — show selectable action label in the dropdown
          if (l === 'in hardware lab' || l === 'sent to lab 6004' || l === 'sent to hardware') {
            return SEND_TO_HARDWARE_LABEL;
          }
          if (l === 'sent to hardware' || l === 'send to hardware') return SEND_TO_HARDWARE_LABEL;
          return s;
        })());
        setEngineer(t.assigned_engineer || '');
        setLabEngineer(t.lab_engineer || '');
        setDescription(t.description || '');
        setCategory(t.issue_category || '');
        setHwType(t.hw_type || '');
        setBrand(t.device_brand || '');
        setSerial(t.serial_number || '');
      }
    } catch (e) {
      if (!silent) {
        setTicket(null);
        setLoadError({
          status: e.status || 500,
          message: e.message || 'Load failed',
          code: e.data?.code,
        });
        showToast('error', 'Load failed', e.message);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id, showToast]);

  function clearEditQueryParams() {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    ['edit', 'action', 'intent'].forEach((k) => {
      if (next.has(k)) {
        next.delete(k);
        changed = true;
      }
    });
    if (changed) setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    if (!ticket || loading) return;
    // Only enter edit mode from URL once — consume params so post-save load does not unlock again
    if (searchParams.get('edit') === '1' || searchParams.get('action') === 'edit') {
      setEditing(true);
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      next.delete('action');
      setSearchParams(next, { replace: true });
    }
    const intent = searchParams.get('intent');
    if (!intent) return;

    const clearIntent = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('intent');
      setSearchParams(next, { replace: true });
    };

    // Preserve the status selected on Dashboard / Active Work — open intake with target already set
    if (intent === 'send-hw' || intent === 'brought') {
      const isHw = intent === 'send-hw';
      const targetStatus = isHw ? 'In Hardware Lab' : 'Brought to Helpdesk';
      const uiLabel = isHw ? SEND_TO_HARDWARE_LABEL : 'Brought to Helpdesk';
      setEditing(true);
      setStatus(uiLabel);
      clearIntent();
      setDialog({
        type: 'device-intake',
        targetStatus,
        uiLabel,
        fromStatus: ticket.status || '—',
        requireRemark: false,
        draftHw: String(ticket.hw_type || hwType || '').trim(),
        draftBrand: String(ticket.device_brand || brand || '').trim(),
        draftSerial: String(ticket.serial_number || ticket.asset_tag || serial || '').trim(),
      });
      showToast(
        'info',
        'Confirm transition',
        `Complete device details to change status to ${uiLabel}.`
      );
    }
  }, [searchParams, ticket, loading]);


  useEffect(() => {
    load();
  }, [load]);

  // Background sync only — never flash loading or wipe fields while typing / editing
  useRealtimeSync(
    () => {
      if (editingRef.current || savingRef.current || dialogRef.current) {
        // Soft refresh: ticket shell + timeline only; keep form state
        load({ silent: true, preserveForm: true });
        return;
      }
      load({ silent: true, preserveForm: false });
    },
    { enabled: true, debounceMs: 1200 }
  );


  function openHardwareFormAfterSave(savedTicket, remarkText) {
    try {
      const base = savedTicket || ticket;
      if (!base) return;
      printLabHardwareForm(
        {
          ...ticket,
          ...base,
          status: base.status || 'In Hardware Lab',
          hw_type: base.hw_type || hwType || ticket.hw_type,
          device_brand: base.device_brand || brand || ticket.device_brand,
          serial_number: base.serial_number || serial || ticket.serial_number,
          asset_tag: base.asset_tag || serial || ticket.asset_tag || ticket.serial_number,
        },
        history,
        user,
        remarkText || getLatestRemark(base) || hwSendRemark || ''
      );
    } catch (e) {
      console.warn('[HW form] auto-open failed', e);
      showToast('warning', 'Form not opened', 'Status saved — use Print Hardware Form if needed.');
    }
  }

  /** Build one action note covering every field that actually changed (single history log). */
  function buildCombinedActionNote(statusVal, extraNote) {
    const parts = [];
    const fromSt = String(ticket.status || '—');
    const toSt = String(statusVal || fromSt);
    if (fromSt.toLowerCase() !== toSt.toLowerCase()) {
      parts.push(`Status: ${fromSt} → ${toSt}`);
    }
    const nextDesc = description != null && description !== '' ? description : ticket.description;
    if (String(nextDesc || '').trim() !== String(ticket.description || '').trim()) {
      parts.push('Description updated');
    }
    if (String(category || '') !== String(ticket.issue_category || '')) {
      parts.push(
        `Category: ${ticket.issue_category || '—'} → ${category || '—'}`
      );
    }
    if (isAdmin(user)) {
      const prevE = String(ticket.assigned_engineer || '').trim();
      const nextE = String(engineer || ticket.assigned_engineer || '').trim();
      if (prevE !== nextE) {
        parts.push(nextE ? `Support Engineer: ${nextE}` : 'Support Engineer cleared');
      }
      const prevLab = String(ticket.lab_engineer || '').trim();
      const nextLab = String(labEngineer || ticket.lab_engineer || '').trim();
      if (prevLab !== nextLab) {
        parts.push(nextLab ? `Lab Engineer: ${nextLab}` : 'Lab Engineer cleared');
      }
    }
    const nextHw = String(hwType || ticket.hw_type || '').trim();
    const nextBr = String(brand || ticket.device_brand || '').trim();
    const nextSn = String(serial || ticket.serial_number || ticket.asset_tag || '').trim();
    if (
      nextHw !== String(ticket.hw_type || '').trim() ||
      nextBr !== String(ticket.device_brand || '').trim() ||
      nextSn !== String(ticket.serial_number || ticket.asset_tag || '').trim()
    ) {
      parts.push(
        `Device: ${[nextHw, nextBr, nextSn].filter(Boolean).join(' · ') || 'updated'}`
      );
    }
    const note = String(extraNote || '').trim();
    if (note) parts.push(`Remark: ${note}`);
    if (!parts.length) return `Updated ticket #${ticket.id}`;
    return parts.join(' · ');
  }

  async function commitUpdates(statusVal, remarksPayload, actionNote) {
    setSaving(true);
    try {
      // Prefer form values; fall back to persisted ticket fields so empty local state
      // never wipes device intake when status changes (e.g. Brought → Sent to Hardware).
      const nextHwType = String(hwType || ticket.hw_type || '').trim();
      const nextBrand = String(brand || ticket.device_brand || '').trim();
      const nextSerial = String(serial || ticket.serial_number || ticket.asset_tag || '').trim();

      const updates = {
        status: statusVal,
        description: description != null && description !== '' ? description : ticket.description,
        issue_category: category || ticket.issue_category || null,
      };
      // Admins may set support + lab assignment; engineers must not resubmit these on ordinary saves
      if (isAdmin(user)) {
        updates.assigned_engineer = engineer || null;
        // Lab Engineer is independent of support — used for Brought to Helpdesk / workstation ownership
        if (labEngineer !== undefined) {
          updates.lab_engineer = labEngineer || null;
        }
      }
      if (nextHwType) updates.hw_type = nextHwType;
      if (nextBrand) updates.device_brand = nextBrand;
      if (nextSerial) {
        updates.serial_number = nextSerial;
        updates.asset_tag = nextSerial;
      }
      if (remarksPayload != null) updates.it_engineer_remarks = remarksPayload;

      const finalNote = actionNote || buildCombinedActionNote(statusVal);

      // Keep action_required aligned so Device Pipeline columns stay correct.
      // Ready to Handover and Ready for Return are distinct — do not collapse them.
      const lower = String(statusVal || '').toLowerCase();
      if (lower === 'ready to handover' || lower === 'ready for handover') {
        updates.status = 'Ready to Handover';
        updates.action_required = 'Ready to Handover';
      } else if (lower === 'ready for return' || lower === 'ready for pickup') {
        updates.status = 'Ready for Return';
        updates.action_required = 'Ready for Return';
      } else if (
        lower === 'support workstation' ||
        lower === 'send to support workstation' ||
        lower === 'send 6004 to support workstation'
      ) {
        updates.status = 'Support Workstation';
        updates.action_required = 'Support Workstation';
      } else if (lower === 'user not found') {
        updates.status = 'User Not Found';
        updates.action_required = 'User Not Found';
      } else if (
        lower === 'send to hardware' ||
        lower === 'sent to hardware' ||
        lower === 'sent to lab 6004' ||
        lower === 'in hardware lab' ||
        lower.includes('send to hardware') ||
        lower.includes('sent to hardware')
      ) {
        updates.status = 'In Hardware Lab';
        updates.action_required = 'In Hardware Lab';
      } else if (lower === 'brought to helpdesk') {
        updates.status = 'Brought to Helpdesk';
        updates.action_required = 'Brought to Helpdesk';
      } else if (lower === 'in diagnostics') {
        updates.status = 'In Diagnostics';
        updates.action_required = 'Under Diagnostics';
      } else if (lower === 'waiting for parts') {
        updates.status = 'Waiting for Parts';
        updates.action_required = 'Waiting for Parts';
      } else if (lower === 'resolved') {
        updates.status = 'Resolved';
        updates.action_required = 'Closed';
      } else if (
        lower === 'canceled' ||
        lower === 'cancelled' ||
        lower === 'user cancel' ||
        lower === 'user cancelled' ||
        lower === 'user canceled' ||
        lower.includes('user cancel')
      ) {
        updates.status = 'Canceled';
        updates.action_required = 'Closed';
      } else {
        // Moving away from Ready / lab statuses: keep explicit status and clear stale action_required
        updates.status = statusVal;
        if (
          updates.action_required == null &&
          /ready (for return|to handover|for handover)|handed over|closed/i.test(
            String(ticket.action_required || '')
          )
        ) {
          updates.action_required = statusVal;
        }
      }

      const result = await ticketsApi.update(ticket.id, updates, {
        engineerName: user?.fullName,
        actionNote: finalNote,
      });
      if (!result || result.success === false) {
        throw new Error(result?.message || result?.error || 'Update did not complete');
      }
      // Sync local form from what the server actually stored
      const saved = result.data || {};
      if (saved.status) {
        const l = String(saved.status).toLowerCase();
        if (l === 'in hardware lab' || l === 'sent to lab 6004' || l === 'sent to hardware') {
          setStatus(SEND_TO_HARDWARE_LABEL);
        } else if (l === 'ready to handover' || l === 'ready for handover') {
          setStatus('Ready to Handover');
        } else if (l === 'ready for return' || saved.action_required === 'Ready for Return') {
          setStatus('Ready for Return');
        } else setStatus(saved.status);
      }
      if (saved.hw_type) setHwType(saved.hw_type);
      if (saved.device_brand) setBrand(saved.device_brand);
      if (saved.serial_number || saved.asset_tag) setSerial(saved.serial_number || saved.asset_tag);
      showToast('success', 'Ticket Updated', `Ticket #${ticket.id} saved`);
      setEditing(false);
      clearEditQueryParams();
      // Auto-print hardware form once when status newly moves to In Hardware Lab
      const prevSt = String(ticket.status || '').toLowerCase();
      const savedStatus = String(saved.status || updates.status || '').toLowerCase();
      const movedToHw =
        (savedStatus === 'in hardware lab' ||
          savedStatus.includes('hardware lab') ||
          isSendToHardwareStatus(saved.status || updates.status)) &&
        prevSt !== 'in hardware lab' &&
        !prevSt.includes('hardware lab');
      await load({ silent: true });
      if (movedToHw) {
        openHardwareFormAfterSave(
          { ...ticket, ...saved },
          getLatestRemark({ ...ticket, ...saved }) || hwSendRemark
        );
      }
    } catch (e) {
      showToast('error', 'Save Failed', e.message || 'Could not save status');
    } finally {
      setSaving(false);
    }
  }

  async function saveUpdates() {
    if (!ticket) return;
    const effectiveHw = String(hwType || ticket.hw_type || '').trim();
    const effectiveBrand = String(brand || ticket.device_brand || '').trim();
    const effectiveSerial = String(serial || ticket.serial_number || ticket.asset_tag || '').trim();

    const needsDevice =
      status === 'Brought to Helpdesk' ||
      isSendToHardwareStatus(status) ||
      isHardwareLabStatus(status) ||
      status === 'Ready for Return' ||
      status === 'Ready to Handover';
    let statusVal = status;
    if (engineer && ticket.status === 'Open' && statusVal === 'Open') statusVal = 'In Progress';

    const currentLower = String(ticket.status || '').toLowerCase();

    // Transition into hardware lab (including Brought to Helpdesk → Sent to Hardware)
    const sendingToHw = isSendToHardwareStatus(statusVal) && currentLower !== 'in hardware lab';
    const goingBrought =
      statusVal === 'Brought to Helpdesk' && currentLower !== 'brought to helpdesk';

    // Collect device details only when missing — then one save applies all form fields
    if (needsDevice && (!effectiveHw || !effectiveBrand || !effectiveSerial)) {
      setDialog({
        type: 'device-intake',
        targetStatus: sendingToHw
          ? 'In Hardware Lab'
          : goingBrought
            ? 'Brought to Helpdesk'
            : statusVal,
        uiLabel: sendingToHw
          ? SEND_TO_HARDWARE_LABEL
          : goingBrought
            ? 'Brought to Helpdesk'
            : statusVal,
        fromStatus: ticket.status || '—',
        requireRemark: false,
        draftHw: effectiveHw,
        draftBrand: effectiveBrand,
        draftSerial: effectiveSerial,
      });
      return;
    }

    // Send to Support Workstation (action) → status Support Workstation (distinct from hardware lab)
    const sendingToSw =
      /send.*support workstation/i.test(statusVal) && currentLower !== 'support workstation';

    // Only force a remark dialog when Settings marks the status as requires_comment
    {
      const meta = statusMeta[String(statusVal).toLowerCase()];
      if (meta?.requires_comment || String(statusVal).toLowerCase() === 'user not found') {
        setDialog({
          type: 'status-remark',
          targetStatus: statusVal,
          uiLabel: statusVal,
          fromStatus: ticket.status || '—',
          defaultValue: '',
          required: true,
        });
        return;
      }
    }

    if (sendingToSw) {
      setDialog({
        type: 'status-remark',
        targetStatus: 'Support Workstation',
        uiLabel: 'Send to Support Workstation',
        fromStatus: ticket.status || '—',
        defaultValue: '',
        required: false,
      });
      return;
    }

    // Brought to Helpdesk — optional remarks popup (device fields already present)
    if (goingBrought) {
      setDialog({
        type: 'status-remark',
        targetStatus: 'Brought to Helpdesk',
        uiLabel: 'Brought to Helpdesk',
        fromStatus: ticket.status || '—',
        defaultValue: '',
        required: false,
      });
      return;
    }

    // Send to Hardware — optional remarks when device fields already present
    if (sendingToHw) {
      setDialog({
        type: 'status-remark',
        targetStatus: 'In Hardware Lab',
        uiLabel: SEND_TO_HARDWARE_LABEL,
        fromStatus: ticket.status || '—',
        defaultValue: hwSendRemark || '',
        required: false,
      });
      return;
    }

    // One save: status + description + category + assignment + device — single history log
    await commitUpdates(statusVal, null, buildCombinedActionNote(statusVal));
  }

  function buildStatusRemarkBlock(noteText, fromStatus, toStatus, kind) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    // Keep a light machine tag for timeline classification only — UI shows note body alone
    const tag = kind === 'hw' ? 'HW-SEND' : 'STATUS';
    const body = String(noteText || '').trim();
    if (!body) return '';
    return `=== ${user?.fullName || 'Engineer'} | ${ts} | ${tag} ===\n${body}\n`;
  }

  async function confirmDeviceIntake() {
    if (!dialog || dialog.type !== 'device-intake') return;
    const dHw = String(dialog.draftHw || '').trim();
    const dBrand = String(dialog.draftBrand || '').trim();
    const dSerial = String(dialog.draftSerial || '').trim();
    const dNote = String(dialog.draftNote || '').trim();
    if (!dHw || !dBrand || !dSerial) {
      showToast('warning', 'Device intake required', 'Device Type, Brand, and Asset Tag / Serial are required.');
      return;
    }
    // Apply device fields into form state, then one combined save with all other edits
    setHwType(dHw);
    setBrand(dBrand);
    setSerial(dSerial);
    const targetStatus = dialog.targetStatus;
    const uiLabel = dialog.uiLabel || targetStatus;
    closeDialog();

    let statusVal = targetStatus;
    const lower = String(targetStatus || '').toLowerCase();
    if (lower === 'brought to helpdesk') statusVal = 'Brought to Helpdesk';
    else if (lower === 'in hardware lab' || isSendToHardwareStatus(uiLabel)) statusVal = 'In Hardware Lab';

    let remarksPayload = null;
    if (dNote) {
      const block = buildStatusRemarkBlock(
        dNote,
        ticket.status || '—',
        statusVal,
        statusVal === 'In Hardware Lab' ? 'hw' : 'status'
      );
      const existing = ticket.it_engineer_remarks || '';
      remarksPayload = existing + (existing && !existing.endsWith('\n') ? '\n' : '') + block;
    }

    // Temporarily set local fields so commitUpdates includes them
    // (state updates are async — pass via direct commit path below)
    setSaving(true);
    try {
      const updates = {
        status: statusVal,
        action_required: statusVal,
        hw_type: dHw,
        device_brand: dBrand,
        serial_number: dSerial,
        asset_tag: dSerial,
        description: description != null && description !== '' ? description : ticket.description,
        issue_category: category || ticket.issue_category || null,
      };
      if (isAdmin(user)) {
        updates.assigned_engineer = engineer || ticket.assigned_engineer || null;
      }
      if (remarksPayload != null) updates.it_engineer_remarks = remarksPayload;

      const actionNote = buildCombinedActionNote(statusVal, dNote);
      const result = await ticketsApi.update(ticket.id, updates, {
        engineerName: user?.fullName,
        actionNote,
      });
      if (!result || result.success === false) throw new Error(result?.message || 'Save failed');
      const saved = result.data || {};
      showToast('success', 'Ticket Updated', `Ticket #${ticket.id} saved`);
      setEditing(false);
      clearEditQueryParams();
      await load({ silent: true });
      if (
        String(statusVal || '').toLowerCase() === 'in hardware lab' ||
        isSendToHardwareStatus(uiLabel)
      ) {
        openHardwareFormAfterSave(
          { ...ticket, ...updates, ...saved },
          dNote || getLatestRemark({ ...ticket, ...updates })
        );
      }
    } catch (e) {
      setHwType(dHw);
      setBrand(dBrand);
      setSerial(dSerial);
      showToast('error', 'Save Failed', e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function confirmReturnTicket() {
    if (!ticket) return;
    setSaving(true);
    closeDialog();
    try {
      const res = await ticketsApi.returnClaim(ticket.id);
      if (res?.success === false) throw new Error(res.message || 'Return failed');
      showToast('success', 'Ticket returned', res?.message || 'Released to the work pool.');
      await load({ silent: true });
    } catch (e) {
      showToast('error', 'Return failed', e.message || 'Could not return ticket');
    } finally {
      setSaving(false);
    }
  }

  function ticketMatchesSelf() {
    if (!ticket || !user) return false;
    const me = String(user.fullName || '').trim().toLowerCase();
    const un = String(user.username || '').trim().toLowerCase();
    const names = [me, un].filter(Boolean);
    if (!names.length) return false;
    const field = String(ticket.assigned_engineer || '').trim().toLowerCase();
    const lab = String(ticket.lab_engineer || '').trim().toLowerCase();
    return names.includes(field) || names.includes(lab);
  }

  function canReturnTicket() {
    if (!ticket || !user || isAdmin(user)) return false;
    if (!ticketMatchesSelf()) return false;
    if (isPendingApprovalTicket(ticket) || isHandedOverTicket(ticket)) return false;
    const st = String(ticket.status || '').toLowerCase();
    if (st === 'resolved' || st === 'canceled' || st === 'cancelled' || st === 'rejected') return false;
    return true;
  }

  /** Engineer (or direct) status change after confirmation — reuses device-intake / remark rules */
  async function confirmDirectStatusChange() {
    if (!dialog || dialog.type !== 'status-change-confirm' || !ticket) return;
    const next = dialog.targetStatus;
    const from = dialog.fromStatus || ticket.status || '—';
    closeDialog();
    setStatus(next);

    const needsDevice =
      next === 'Brought to Helpdesk' ||
      isSendToHardwareStatus(next) ||
      isHardwareLabStatus(next) ||
      next === 'Ready for Return' ||
      next === 'Ready to Handover';
    const effectiveHw = String(hwType || ticket.hw_type || '').trim();
    const effectiveBrand = String(brand || ticket.device_brand || '').trim();
    const effectiveSerial = String(serial || ticket.serial_number || ticket.asset_tag || '').trim();

    if (needsDevice && (!effectiveHw || !effectiveBrand || !effectiveSerial)) {
      setDialog({
        type: 'device-intake',
        targetStatus: isSendToHardwareStatus(next) ? 'In Hardware Lab' : next,
        uiLabel: next,
        fromStatus: from,
        // Remark field shown optional on device intake for Brought / Hardware
        requireRemark: false,
        draftHw: effectiveHw,
        draftBrand: effectiveBrand,
        draftSerial: effectiveSerial,
      });
      return;
    }

    const meta = statusMeta[String(next).toLowerCase()];
    if (meta?.requires_comment || String(next).toLowerCase() === 'user not found') {
      setDialog({
        type: 'status-remark',
        targetStatus: next,
        uiLabel: next,
        fromStatus: from,
        defaultValue: '',
        required: true,
      });
      return;
    }

    if (
      isSendToHardwareStatus(next) ||
      next === 'Brought to Helpdesk' ||
      /send.*support workstation/i.test(next)
    ) {
      setDialog({
        type: 'status-remark',
        targetStatus: isSendToHardwareStatus(next) ? 'In Hardware Lab' : next,
        uiLabel: next,
        required: false,
        fromStatus: from,
        defaultValue: '',
      });
      return;
    }

    await commitUpdates(next, null, `Status changed: ${from} → ${next}`);
  }

  async function confirmStatusRemark(noteText) {
    if (!dialog || dialog.type !== 'status-remark') return;
    const trimmed = String(noteText || '').trim();
    if (dialog.required && !trimmed) {
      showToast('warning', 'Comment required', 'Please add a comment before setting User Not Found.');
      return;
    }
    const targetStatus = dialog.targetStatus;
    const fromStatus = dialog.fromStatus || ticket.status || '—';
    const uiLabel = dialog.uiLabel || targetStatus;
    const kind = isSendToHardwareStatus(uiLabel) || targetStatus === 'In Hardware Lab' ? 'hw' : 'status';
    if (trimmed) setHwSendRemark(trimmed);
    closeDialog();

    let remarksPayload = null;
    if (trimmed) {
      const block = buildStatusRemarkBlock(trimmed, fromStatus, targetStatus, kind);
      const existing = ticket.it_engineer_remarks || '';
      remarksPayload = existing + (existing && !existing.endsWith('\n') ? '\n' : '') + block;
    }

    const actionNote = trimmed
      ? `Status changed: ${fromStatus} → ${targetStatus} · Remark: ${trimmed}`
      : buildCombinedActionNote(targetStatus);

    await commitUpdates(targetStatus, remarksPayload, actionNote);
  }

  /** Print Hardware form: popup remark → audit log + issue on both form parts */
  function buildHwSendBlock(noteText) {
    return buildStatusRemarkBlock(
      noteText,
      ticket?.status || '—',
      'In Hardware Lab',
      'hw'
    );
  }

  async function confirmHwPrint(noteText) {
    const trimmed = String(noteText || '').trim();
    if (!trimmed) {
      showToast('warning', 'Remark required', 'Enter the hardware form remark before printing.');
      return;
    }
    setHwSendRemark(trimmed);
    closeDialog();
    setSaving(true);
    try {
      const fromStatus = ticket.status || '—';
      const alreadyInHw =
        isHardwareLabStatus(ticket.status) ||
        isSendToHardwareStatus(ticket.status) ||
        isHardwareLabStatus(ticket.action_required) ||
        String(ticket.action_required || '')
          .toLowerCase()
          .includes('hardware lab');
      // Same problem text already on the ticket (latest remark) → not a real remark change
      const priorLatest = String(getLatestRemark(ticket) || '').trim();
      const remarkUnchanged = priorLatest === trimmed;

      const nextHwType = String(hwType || ticket.hw_type || '').trim();
      const nextBrand = String(brand || ticket.device_brand || '').trim();
      const nextSerial = String(serial || ticket.serial_number || ticket.asset_tag || '').trim();
      const deviceUnchanged =
        nextHwType === String(ticket.hw_type || '').trim() &&
        nextBrand === String(ticket.device_brand || '').trim() &&
        nextSerial === String(ticket.serial_number || ticket.asset_tag || '').trim();

      // Print-only path: already in Hardware Lab, same remark, same device fields
      if (alreadyInHw && remarkUnchanged && deviceUnchanged) {
        printLabHardwareForm(
          {
            ...ticket,
            status: ticket.status || 'In Hardware Lab',
            hw_type: nextHwType || ticket.hw_type,
            device_brand: nextBrand || ticket.device_brand,
            serial_number: nextSerial || ticket.serial_number,
            asset_tag: nextSerial || ticket.asset_tag || ticket.serial_number,
          },
          history,
          user,
          trimmed
        );
        showToast('success', 'Form printed', 'No ticket changes — hardware form printed only.');
        return;
      }

      const existing = ticket.it_engineer_remarks || '';
      const remarksPayload = remarkUnchanged
        ? existing
        : existing + (existing && !existing.endsWith('\n') ? '\n' : '') + buildHwSendBlock(trimmed);

      const updates = {
        status: 'In Hardware Lab',
        action_required: 'In Hardware Lab',
        hw_type: nextHwType || undefined,
        device_brand: nextBrand || undefined,
        serial_number: nextSerial || undefined,
        asset_tag: nextSerial || undefined,
      };
      // Only send remarks field when the problem text actually changed
      if (!remarkUnchanged) {
        updates.it_engineer_remarks = remarksPayload;
      }

      let actionNote = null;
      if (!alreadyInHw && !remarkUnchanged) {
        actionNote = `Status changed: ${fromStatus} → In Hardware Lab · Hardware form remark: ${trimmed}`;
      } else if (!alreadyInHw) {
        actionNote = `Status changed: ${fromStatus} → In Hardware Lab`;
      } else if (!remarkUnchanged) {
        actionNote = `Hardware form remark updated: ${trimmed}`;
      }

      const result = await ticketsApi.update(
        ticket.id,
        updates,
        actionNote
          ? { engineerName: user?.fullName, actionNote }
          : { engineerName: user?.fullName }
      );
      if (!result || result.success === false) {
        throw new Error(result?.message || 'Could not save status before print');
      }
      const saved = result.data || {};
      // Update local state once — do not reload before print (avoids second print/save cycle)
      setStatus(SEND_TO_HARDWARE_LABEL);
      if (saved.hw_type) setHwType(saved.hw_type);
      if (saved.device_brand) setBrand(saved.device_brand);
      if (saved.serial_number || saved.asset_tag) setSerial(saved.serial_number || saved.asset_tag);
      setTicket((prev) => (prev ? { ...prev, ...saved, status: saved.status || 'In Hardware Lab' } : prev));
      setEditing(false);
      clearEditQueryParams();

      printLabHardwareForm(
        {
          ...ticket,
          ...saved,
          status: saved.status || 'In Hardware Lab',
          hw_type: saved.hw_type || nextHwType || ticket.hw_type,
          device_brand: saved.device_brand || nextBrand || ticket.device_brand,
          serial_number: saved.serial_number || nextSerial || ticket.serial_number,
          asset_tag: saved.asset_tag || nextSerial || ticket.asset_tag || ticket.serial_number,
          it_engineer_remarks: remarkUnchanged ? existing : remarksPayload,
        },
        history,
        user,
        trimmed
      );
      showToast(
        'success',
        alreadyInHw ? 'Form printed' : 'Send to Hardware',
        alreadyInHw
          ? 'Ticket updated where needed and form printed.'
          : 'Status saved as In Hardware Lab and form printed.'
      );
      // Quiet background refresh after print — does not re-open print
      load({ silent: true });
    } catch (e) {
      showToast('error', 'Save / print failed', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function postRemark() {
    if (!remark.trim() || !ticket) return;
    const text = remark.trim();
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const block = `=== ${user?.fullName || 'Engineer'} | ${ts} ===\n${text}\n`;
    // Always append against the live ticket field (avoid stale form state)
    const existing = String(ticket.it_engineer_remarks || '');
    const updated = existing + (existing && !existing.endsWith('\n') ? '\n' : '') + block;
    setSaving(true);
    try {
      const result = await ticketsApi.update(
        ticket.id,
        { it_engineer_remarks: updated },
        {
          engineerName: user?.fullName,
          actionNote: `Remark added · by ${user?.fullName || 'Engineer'} · Remark: ${text}`,
        }
      );
      // PUT returns { success, data: updatedTicket } — use persisted row as source of truth
      const saved = result?.data || result?.ticket || null;
      const persistedRemarks =
        saved?.it_engineer_remarks != null ? saved.it_engineer_remarks : updated;
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              ...(saved || {}),
              it_engineer_remarks: persistedRemarks,
            }
          : prev
      );
      setRemark('');
      showToast('success', 'Remark Posted', 'Latest Remarks updated.');
      // Refresh history only — do not clobber remarks with a partial ticket payload
      try {
        const hist = await ticketsApi.history(ticket.id, { limit: 80 });
        setHistory(Array.isArray(hist) ? hist : []);
      } catch {
        /* history refresh optional */
      }
    } catch (e) {
      showToast('error', 'Failed to Post Remark', e.message);
    } finally {
      setSaving(false);
    }
  }

  function rebuildRemarks(comments) {
    return comments
      .map((c) => `=== ${c.user} | ${c.timestamp}${c.tag ? ` | ${c.tag}` : ''} ===\n${c.text}\n`)
      .join('');
  }

  async function saveEditedRemark(idx) {
    if (!ticket || editingRemarkIdx == null) return;
    const comments = parseComments(ticket.it_engineer_remarks || '');
    if (!comments[idx]) return;
    const text = editingRemarkText.trim();
    if (!text) {
      showToast('warning', 'Empty remark', 'Remark text cannot be empty. Delete it instead.');
      return;
    }
    comments[idx] = { ...comments[idx], text };
    setSaving(true);
    try {
      await ticketsApi.update(
        ticket.id,
        { it_engineer_remarks: rebuildRemarks(comments) },
        { engineerName: user?.fullName, actionNote: `Edited remark on ticket #${ticket.id}` }
      );
      setEditingRemarkIdx(null);
      setEditingRemarkText('');
      showToast('success', 'Remark updated', 'Changes saved.');
      await load({ silent: true });
    } catch (e) {
      showToast('error', 'Update failed', e.message);
    } finally {
      setSaving(false);
    }
  }

  function requestDeleteRemark(idx) {
    setDialog({ type: 'delete-remark', idx });
  }

  async function confirmDeleteRemark(idx) {
    if (!ticket) return;
    closeDialog();
    const comments = parseComments(ticket.it_engineer_remarks || '');
    if (!comments[idx]) return;
    comments.splice(idx, 1);
    setSaving(true);
    try {
      await ticketsApi.update(
        ticket.id,
        { it_engineer_remarks: rebuildRemarks(comments) },
        { engineerName: user?.fullName, actionNote: `Deleted remark on ticket #${ticket.id}` }
      );
      if (editingRemarkIdx === idx) {
        setEditingRemarkIdx(null);
        setEditingRemarkText('');
      }
      showToast('success', 'Remark deleted', 'Removed from timeline.');
      await load({ silent: true });
    } catch (e) {
      showToast('error', 'Delete failed', e.message);
    } finally {
      setSaving(false);
    }
  }

  function handOverAndClose() {
    setDialog({ type: 'hand-over' });
  }

  async function confirmHandOver() {
    if (!ticket) return;
    closeDialog();
    setSaving(true);
    try {
      const from = ticket.status || 'Ready for Return';
      const result = await ticketsApi.update(
        ticket.id,
        { status: 'Resolved', user_status: 'Handed Over', action_required: 'Closed' },
        {
          engineerName: user?.fullName,
          actionNote: `Device Handed Over · ${from} → Resolved`,
          handover: true,
        }
      );
      if (!result || result.success === false) {
        throw new Error(result?.message || 'Handover did not complete');
      }
      showToast('success', 'Device Handed Over', 'Ticket marked Resolved for reporting.');
      await load({ silent: true });
    } catch (e) {
      showToast('error', 'Hand Over Failed', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function undoHandOver() {
    if (!ticket) return;
    setSaving(true);
    try {
      const result = await ticketsApi.update(
        ticket.id,
        { status: 'Ready for Return', user_status: null, action_required: 'Ready for Return' },
        {
          engineerName: user?.fullName,
          actionNote: 'Undo Device Handed Over → Ready for Return',
          undoHandover: true,
        }
      );
      if (!result || result.success === false) {
        throw new Error(result?.message || 'Undo did not complete');
      }
      showToast('success', 'Handover undone', 'Ticket restored to Ready for Return.');
      await load({ silent: true });
    } catch (e) {
      showToast('error', 'Undo failed', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loading && !ticket) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-xs text-slate-500">Loading ticket…</p>
      </div>
    );
  }

  if (!ticket) {
    const forbidden = loadError?.status === 403 || loadError?.code === 'NOT_YOUR_TICKET';
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-bold text-white">
          {forbidden ? 'Access restricted' : 'Ticket not found'}
        </p>
        <p className="text-sm text-gray-400 max-w-md">
          {forbidden
            ? loadError?.message || 'You are not authorized to view this ticket.'
            : loadError?.message || 'This ticket does not exist or could not be loaded.'}
        </p>
        <button type="button" onClick={goBack} className="text-indigo-400 hover:underline text-sm">
          ← Go back
        </button>
      </div>
    );
  }

  async function approveSubmission() {
    if (!ticket || !isAdmin(user)) return;
    setDialog({
      type: 'approve-submission',
      ticketId: ticket.id,
    });
  }

  async function confirmApproveSubmission() {
    if (!ticket || !isAdmin(user)) return;
    setSaving(true);
    try {
      const res = await ticketsApi.approve(ticket.id);
      if (res?.success === false) throw new Error(res.message || 'Approve failed');
      closeDialog();
      showToast('success', 'Approved', `Ticket #${ticket.id} is now Open.`);
      await load({ silent: true });
    } catch (e) {
      showToast('error', 'Approve failed', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function rejectSubmission() {
    if (!ticket || !isAdmin(user)) return;
    setDialog({
      type: 'reject-submission',
      ticketId: ticket.id,
      requester: ticket.user_name || '—',
      submitter: ticket.assigned_engineer || 'Engineer',
      defaultValue: '',
    });
  }

  async function confirmRejectSubmission(reason) {
    if (!ticket || !isAdmin(user)) return;
    const text = String(reason || '').trim();
    if (text.length < 5) {
      showToast('warning', 'Reason required', 'Enter a clear dismissal reason (at least 5 characters).');
      return;
    }
    setSaving(true);
    try {
      const res = await ticketsApi.reject(ticket.id, text);
      if (res?.success === false) throw new Error(res.message || 'Dismiss failed');
      closeDialog();
      showToast('success', 'Submission dismissed', `Ticket #${ticket.id} dismissed with reason recorded.`);
      await load({ silent: true });
    } catch (e) {
      showToast('error', 'Dismiss failed', e.message);
    } finally {
      setSaving(false);
    }
  }

  const needsHw =
    status === 'Brought to Helpdesk' ||
    isSendToHardwareStatus(status) ||
    isHardwareLabStatus(status) ||
    ticket.hw_type ||
    ticket.device_brand;

  return (
    <>
      <header className="px-7 py-5 border-b border-[#1F2937] flex justify-between items-center shrink-0 bg-gradient-to-r from-[#111827] to-[#0B0F19]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={goBack}
            title="Go back"
            className="w-9 h-9 rounded-lg bg-[#1F2937] hover:bg-rose-500/20 hover:text-rose-400 text-gray-400 flex items-center justify-center transition border border-[#374151]"
          >
            ←
          </button>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 avatar-circle text-white text-sm">
            {(ticket.user_name || 'U')
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-lg font-black text-white tracking-tight">{ticket.user_name}</h3>
              <span className="status-pill-pro bg-blue-500/10 text-blue-400 border border-blue-500/30">
                {displayStatus(ticket)}
              </span>
              <span className="status-pill-pro bg-amber-500/10 text-amber-400 border border-amber-500/30">
                {ticket.priority || 'Medium'}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 flex-wrap">
              <span className="font-mono font-bold text-indigo-400">#{ticket.id}</span>
              <span className="text-gray-600">•</span>
              <span title="Created at">
                Opened {formatDateTime(ticket.created_at)}
              </span>
              <span className="text-gray-600">•</span>
              <span title="Resolved at">
                {ticket.resolved_at
                  ? `Resolved ${formatDateTime(ticket.resolved_at)}`
                  : ticket.status === 'Resolved' && ticket.updated_at
                    ? `Resolved ${formatDateTime(ticket.updated_at)} (legacy)`
                    : ticket.resolved_at == null && ticket.status !== 'Resolved'
                      ? 'Not resolved'
                      : 'Resolved —'}
              </span>
              <span className="text-gray-600">•</span>
              <span>{ticket.issue_category || 'General'}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          
          {isAdmin(user) && isPendingApprovalTicket(ticket) && (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={approveSubmission}
                className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50"
              >
                Approve submission
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={rejectSubmission}
                className="h-9 px-3 rounded-lg border border-rose-500/40 text-rose-300 text-xs font-bold hover:bg-rose-500/10 disabled:opacity-50"
              >
                Dismiss submission
              </button>
            </>
          )}
{canReturnTicket() && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setDialog({ type: 'return-ticket' })}
              className="h-9 px-3 rounded-lg border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-500/10 disabled:opacity-50"
            >
              Return Ticket
            </button>
          )}
<button
            type="button"
            onClick={() => printTicketReport(ticket, history, user)}
            className="bg-[#1F2937] border border-[#374151] text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-[#374151] transition"
          >
            Print report
          </button>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="bg-[#1F2937] border border-[#374151] text-white px-5 py-2 rounded-lg font-bold text-xs hover:bg-[#374151] transition"
            >
              Enable Editing
            </button>
          ) : (
            <button
              onClick={saveUpdates}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold text-xs shadow-[0_0_15px_rgba(79,70,229,0.3)] transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Updates'}
            </button>
          )}
        </div>
      </header>

      {presencePeers.length > 0 && (
        <div className="px-7 py-2.5 border-b border-emerald-500/25 bg-emerald-500/10 flex flex-wrap items-center gap-2.5 shrink-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
          </span>
          <p className="text-xs text-emerald-100">
            {presencePeers.map((p, i) => {
              const name = p.fullName || p.username || 'Someone';
              const action = p.mode === 'editing' ? 'editing this ticket' : 'viewing this ticket';
              return (
                <span key={`${name}-${i}`}>
                  {i > 0 ? <span className="text-emerald-700"> · </span> : null}
                  <span className="font-bold text-white">{name}</span>
                  <span className="text-emerald-200/90"> is {action}</span>
                </span>
              );
            })}
          </p>
        </div>
      )}

      {String(ticket.status || '').toLowerCase() === 'rejected' && (
        <div className="mx-6 mt-4 rounded-xl border border-rose-500/35 bg-rose-950/25 px-4 py-3 shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300">Submission dismissed</p>
          <p className="text-sm text-white mt-1 whitespace-pre-wrap break-words">
            {(() => {
              const fr = String(ticket.final_remarks || '');
              const m =
                fr.match(/Dismissal reason:\s*([\s\S]*?)(?:\nDismissed by:|$)/i) ||
                fr.match(/Rejection:\s*([\s\S]+)/i);
              if (m) return m[1].trim();
              const hist = (history || []).find((h) =>
                /dismissed by|rejected by/i.test(String(h.action_note || ''))
              );
              if (hist?.action_note) {
                return (
                  String(hist.action_note)
                    .replace(/^.*?(?:Dismissed|Rejected) by [^:]+:\s*/i, '')
                    .trim() || hist.action_note
                );
              }
              return 'No reason recorded.';
            })()}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {(() => {
              const fr = String(ticket.final_remarks || '');
              const by = fr.match(/Dismissed by:\s*([^\n]+)/i);
              const at = fr.match(/Dismissed at:\s*([^\n]+)/i);
              const parts = [];
              if (by) parts.push(`By ${by[1].trim()}`);
              if (at) parts.push(formatDateTime(at[1].trim()));
              return parts.join(' · ') || 'See activity timeline for details.';
            })()}
          </p>
        </div>
      )}

      {/* Handover / Undo — always visible on full view (top), not only while editing */}
      {isReadyForReturnTicket(ticket) && (
        <div className="bg-gradient-to-r from-emerald-950/40 to-transparent border-b border-emerald-500/30 px-7 py-3.5 flex items-center justify-between flex-wrap gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/30 shrink-0">
              ✓
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-emerald-400">Ready for Return / Handover</h4>
              <p className="text-[11px] text-emerald-500/70">Device is ready. Mark Handed Over to resolve the ticket.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handOverAndClose}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-xs font-bold transition shadow-lg shadow-emerald-900/40 disabled:opacity-50 shrink-0"
          >
            Handed Over
          </button>
        </div>
      )}
      {isHandedOverTicket(ticket) && (
        <div className="bg-gradient-to-r from-slate-900/50 to-transparent border-b border-slate-500/30 px-7 py-3.5 flex items-center justify-between flex-wrap gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-slate-500/20 text-slate-300 flex items-center justify-center font-bold border border-slate-500/30 shrink-0">
              ↩
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-200">Handed over</h4>
              <p className="text-[11px] text-slate-400">Ticket resolved. Undo restores Ready for Return if this was accidental.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={undoHandOver}
            disabled={saving}
            className="bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-white px-5 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50 shrink-0"
          >
            Undo handover
          </button>
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
        <div className="lg:col-span-4 border-r border-[#1F2937] bg-[#0B0F19]/40 p-6 space-y-5 overflow-y-auto custom-scroll min-h-0">
          <div className="rounded-xl border border-[#1F2937] overflow-hidden" style={{ background: 'linear-gradient(145deg,#141c2e 0%,#111827 100%)' }}>
            <div className="px-4 py-2.5 flex items-center gap-2 border-b border-[#1F2937]/80" style={{ background: 'rgba(99,102,241,0.07)' }}>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Requester Profile</span>
            </div>
            <div className="p-4 flex items-center gap-3.5 border-b border-[#1F2937]/60">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 avatar-circle text-white text-sm shadow-lg shadow-indigo-500/20 shrink-0">
                {(ticket.user_name || 'U')
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white leading-tight truncate">{ticket.user_name}</p>
                <p className="text-[11px] text-indigo-400 font-semibold mt-0.5 truncate">{ticket.designation || '—'}</p>
              </div>
            </div>
            <div className="p-4 space-y-2.5 text-xs">
              <Row label="Department" value={ticket.department} />
              <Row label="Extension" value={ticket.extension} mono />
              <Row label="Location" value={`${ticket.building || ''} ${ticket.room_location || ''}`.trim()} />
            </div>
          </div>

          <div className="bg-[#111827] rounded-xl border border-[#1F2937] p-4 overflow-hidden">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Issue Description</h4>
            {editing ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="dark-input w-full text-xs resize-y min-h-[80px] leading-relaxed"
                placeholder="Describe the issue…"
              />
            ) : (
              <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-w-full">
                {ticket.description || '—'}
              </p>
            )}
          </div>

          <div className="bg-[#111827] rounded-xl border border-[#1F2937] p-4">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Issue Category</h4>
            {editing ? (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="dark-input w-full text-xs font-bold"
              >
                <option value="">— Select category —</option>
                {(category && categories.length && !categories.includes(category)
                  ? [category, ...categories]
                  : categories.length
                    ? categories
                    : [category || 'General']
                ).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs font-semibold text-gray-200">{ticket.issue_category || '—'}</p>
            )}
          </div>

          <div className="bg-[#111827] rounded-xl border border-[#1F2937] p-4 space-y-3">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Assignment</h4>
            <div>
              <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Ticket State</label>
              <select
                value={status}
                disabled={
                  isAdmin(user)
                    ? !editing
                    : !(
                        canReturnTicket() ||
                        ticketMatchesSelf()
                      )
                }
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === status) return;
                  // Engineers (and Admins while editing) confirm before applying
                  if (!isAdmin(user) || !editing) {
                    setDialog({
                      type: 'status-change-confirm',
                      fromStatus: ticket.status || status || '—',
                      targetStatus: next,
                      uiLabel: next,
                    });
                    // Revert select until confirmed
                    e.target.value = status;
                    return;
                  }
                  setStatus(next);
                }}
                className="dark-input w-full font-bold text-xs"
              >
                {(() => {
                  const catalog =
                    statusCatalog.length > 0
                      ? statusCatalog
                      : (statusOptions || []).map((name, i) => ({
                          name,
                          sort_order: (i + 1) * 10,
                        }));
                  const list = statusDropdownOptions(catalog, {
                    engineer: !isAdmin(user),
                    currentStatus: status || ticket?.status || '',
                  });
                  return list.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ));
                })()}
              </select>
              {!isAdmin(user) && (
                <p className="text-[10px] text-slate-500 mt-1">
                  After claim (In Diagnostics): Send to Hardware, Waiting for Parts, Ready to
                  Handover / Return, Resolved. You may revert to Brought to Helpdesk — not Open /
                  In Progress.
                </p>
              )}
            </div>

            {/* Support Engineer + Lab Engineer (admin edits when Enable Editing) */}
            {(() => {
              const assigned = String(ticket.assigned_engineer || '').trim();
              const claimedLab = String(ticket.lab_engineer || '').trim();
              const same =
                assigned &&
                claimedLab &&
                assigned.toLowerCase() === claimedLab.toLowerCase();
              const unassigned = !assigned && !claimedLab;
              const st = String(ticket.status || status || '').toLowerCase();
              const showLabAssign =
                st === 'brought to helpdesk' ||
                st.includes('hardware') ||
                st === 'support workstation' ||
                st === 'in diagnostics' ||
                st === 'waiting for parts' ||
                st === 'ready for return' ||
                st === 'ready to handover' ||
                Boolean(claimedLab);

              // Admin editing: Support Engineer (always) + Lab Engineer (Brought to Helpdesk / lab flow)
              if (editing && isAdmin(user)) {
                return (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">
                        Support Engineer
                      </label>
                      <select
                        value={engineer}
                        onChange={(e) => setEngineer(e.target.value)}
                        className="dark-input w-full font-bold text-xs"
                      >
                        <option value="">— Unassigned —</option>
                        {engineers.map((e) => (
                          <option key={e.id || e.full_name} value={e.full_name}>
                            {e.full_name}
                          </option>
                        ))}
                        {engineer && !engineers.some((e) => e.full_name === engineer) && (
                          <option value={engineer}>{engineer}</option>
                        )}
                      </select>
                    </div>
                    {showLabAssign && (
                      <div>
                        <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">
                          Lab Engineer
                        </label>
                        <select
                          value={labEngineer}
                          onChange={(e) => setLabEngineer(e.target.value)}
                          className="dark-input w-full font-bold text-xs"
                        >
                          <option value="">— Unassigned —</option>
                          {engineers.map((e) => (
                            <option key={`lab-${e.id || e.full_name}`} value={e.full_name}>
                              {e.full_name}
                            </option>
                          ))}
                          {labEngineer &&
                            !engineers.some((e) => e.full_name === labEngineer) && (
                              <option value={labEngineer}>{labEngineer}</option>
                            )}
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1.5">
                          Assign lab ownership for Brought to Helpdesk / workstation work. Appears on that
                          engineer’s dashboard (no claim required).
                        </p>
                      </div>
                    )}
                  </div>
                );
              }

              if (unassigned) {
                return (
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Support Engineer</p>
                    <p className="text-xs font-semibold text-slate-500 italic">Unassigned</p>
                  </div>
                );
              }

              if (same) {
                return (
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">
                      Support Engineer & Lab Engineer
                    </p>
                    <p className="text-xs font-semibold text-white">{assigned}</p>
                  </div>
                );
              }

              return (
                <div className="space-y-2.5">
                  {assigned ? (
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Support Engineer</p>
                      <p className="text-xs font-semibold text-white">{assigned}</p>
                    </div>
                  ) : null}
                  {claimedLab ? (
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Lab Engineer</p>
                      <p className="text-xs font-semibold text-cyan-300">{claimedLab}</p>
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>

          {needsHw && (
            <div className="bg-[#111827] rounded-xl border border-purple-500/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Device / Hardware Intake</h4>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      printReceiveForm(
                        {
                          ...ticket,
                          status,
                          hw_type: hwType || ticket.hw_type,
                          device_brand: brand || ticket.device_brand,
                          serial_number: serial || ticket.serial_number,
                          asset_tag: serial || ticket.asset_tag || ticket.serial_number,
                        },
                        history,
                        user
                      )
                    }
                    className="h-7 px-2.5 rounded-lg border border-purple-500/40 text-purple-300 text-[10px] font-bold hover:bg-purple-500/10"
                  >
                    Receive form
                  </button>
                  {isHardwareLabStatus(status) && (
                    <button
                      type="button"
                      onClick={() =>
                        setDialog({
                          type: 'hw-print',
                          defaultValue: hwSendRemark || getLatestRemark(ticket) || '',
                        })
                      }
                      className="h-7 px-2.5 rounded-lg border border-indigo-500/40 text-indigo-300 text-[10px] font-bold hover:bg-indigo-500/10"
                    >
                      Hardware form
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-purple-300 uppercase font-bold mb-1">Device Type</label>
                <select value={hwType} disabled={!editing} onChange={(e) => setHwType(e.target.value)} className="dark-input w-full text-xs font-bold">
                  <option value="">— Select —</option>
                  {(hwType && !deviceTypes.includes(hwType) ? [hwType, ...deviceTypes] : deviceTypes).map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-purple-300 uppercase font-bold mb-1">Brand / Model</label>
                <input value={brand} disabled={!editing} onChange={(e) => setBrand(e.target.value)} className="dark-input w-full text-xs" placeholder="e.g. Dell OptiPlex" />
              </div>
              <div>
                <label className="block text-[10px] text-purple-300 uppercase font-bold mb-1">Asset Tag</label>
                <input value={serial} disabled={!editing} onChange={(e) => setSerial(e.target.value)} className="dark-input w-full text-xs font-mono" placeholder="e.g. NSU-IT-1049" />
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 flex flex-col min-h-0 h-full overflow-hidden">
          <div className="flex-1 p-6 pb-3 overflow-hidden flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Activity & Remarks Timeline
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">
                {timelineEntries.length} entries · latest at bottom
              </span>
            </div>
            <div
              ref={timelineScrollRef}
              onScroll={onTimelineScroll}
              className="flex-1 min-h-0 overflow-y-auto custom-scroll space-y-2 pr-1"
            >
              {(() => {
                const entries = timelineEntries;
                if (loading && !entries.length) {
                  return <p className="text-xs text-slate-500 italic py-6 text-center">Loading activity…</p>;
                }
                if (!entries.length) {
                  return <p className="text-xs text-slate-500 italic py-6 text-center">No activity yet</p>;
                }
                return entries.map((entry, i) => (
                  <NoteCard
                    key={entry.key || i}
                    user={entry.user}
                    label={entry.label}
                    badge={entry.badge}
                    eventType={entry.eventType}
                    stateLine={entry.stateLine}
                    byLine={entry.byLine}
                    text={
                      entry.remarkIndex != null && editingRemarkIdx === entry.remarkIndex
                        ? editingRemarkText
                        : entry.text
                    }
                    noteLabel={entry.noteLabel}
                    ts={entry.ts}
                    color={entry.color}
                    highlightRemark={entry.highlightRemark}
                    detail={entry.detail}
                    editable={
                      entry.remarkIndex != null &&
                      Boolean(entry.text) &&
                      // Only the author (or admin) may edit/delete their remark blocks
                      (isAdmin(user) ||
                        String(entry.user || '')
                          .toLowerCase()
                          .includes(String(user?.fullName || '').toLowerCase().split(' ')[0] || '___'))
                    }
                    editing={entry.remarkIndex != null && editingRemarkIdx === entry.remarkIndex}
                    onEditStart={() => {
                      setEditingRemarkIdx(entry.remarkIndex);
                      setEditingRemarkText(entry.text || '');
                    }}
                    onEditChange={setEditingRemarkText}
                    onEditSave={() => saveEditedRemark(entry.remarkIndex)}
                    onEditCancel={() => {
                      setEditingRemarkIdx(null);
                      setEditingRemarkText('');
                    }}
                    onDelete={() => requestDeleteRemark(entry.remarkIndex)}
                    saving={saving}
                  />
                ));
              })()}
            </div>
          </div>

          <div className="border-t border-[#1F2937] bg-[#0B0F19]/60 p-5 shrink-0">
            <label className="block text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-2">Add a remark</label>
            <div className="flex gap-3 items-start">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 avatar-circle text-white text-xs shrink-0">
                {user?.initials || 'ME'}
              </div>
              <div className="flex-1 space-y-2">
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  rows={2}
                  className="dark-input w-full resize-none font-medium text-xs"
                  placeholder="Write your remark..."
                />
                <div className="flex justify-end">
                  <button
                    onClick={postRemark}
                    disabled={saving || !remark.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-[#1F2937] disabled:text-gray-500 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg text-xs font-bold transition"
                  >
                    Post Remark
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <ConfirmDialog
        open={dialog?.type === 'status-remark'}
        mode="prompt"
        title={dialog?.required ? `${dialog?.uiLabel || 'Status'} · comment required` : `${dialog?.uiLabel || 'Status'} · optional remark`}
        message={dialog?.required ? 'A comment is required for User Not Found before the status can be saved.' : 'You can add a remark for this status change. Leave blank if none — remark is optional.'}
        placeholder={dialog?.required ? 'Required comment / notes…' : 'Optional remark for this status change…'}
        confirmLabel={
          isSendToHardwareStatus(dialog?.uiLabel) || dialog?.targetStatus === 'In Hardware Lab'
            ? 'Confirm send'
            : 'Confirm status'
        }
        cancelLabel="Cancel"
        tone="indigo"
        required={Boolean(dialog?.required)}
        defaultValue={dialog?.defaultValue || ''}
        onCancel={closeDialog}
        onConfirm={confirmStatusRemark}
      />

      {/* Device intake — Brought to Helpdesk / Send to Hardware (same required fields as Admin) */}
      {dialog?.type === 'device-intake' && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[#0B0F19]/85 backdrop-blur-md">
          <div
            className="w-full max-w-[440px] rounded-2xl border border-indigo-500/20 bg-gradient-to-b from-[#1a2236] to-[#121826] shadow-[0_40px_100px_rgba(0,0,0,0.75)] overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            <div className="px-6 pt-5 pb-3 border-b border-[#1F2937]">
              <h3 className="text-base font-bold text-white">Device intake · {dialog.uiLabel}</h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter device details before this status can be saved. Same requirements as Admin Campus Support.
              </p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Device type *</label>
                <select
                  className="dark-input mt-1 w-full h-10 text-sm"
                  value={dialog.draftHw || ''}
                  onChange={(e) => setDialog((d) => ({ ...d, draftHw: e.target.value }))}
                >
                  <option value="">— Select —</option>
                  {deviceTypes.map((dt) => (
                    <option key={dt} value={dt}>
                      {dt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Brand *</label>
                <input
                  className="dark-input mt-1 w-full h-10 text-sm"
                  value={dialog.draftBrand || ''}
                  onChange={(e) => setDialog((d) => ({ ...d, draftBrand: e.target.value }))}
                  placeholder="e.g. Dell, HP…"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Asset tag / serial *
                </label>
                <input
                  className="dark-input mt-1 w-full h-10 text-sm"
                  value={dialog.draftSerial || ''}
                  onChange={(e) => setDialog((d) => ({ ...d, draftSerial: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Remark {dialog.requireRemark ? '(recommended)' : '(optional)'}
                </label>
                <textarea
                  className="dark-input mt-1 w-full text-sm min-h-[72px] py-2"
                  value={dialog.draftNote || ''}
                  onChange={(e) => setDialog((d) => ({ ...d, draftNote: e.target.value }))}
                  placeholder="Notes for this status change…"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#1F2937] flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDialog}
                className="h-9 px-3 rounded-lg border border-[#374151] text-xs font-bold text-slate-300 hover:bg-[#1F2937]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={confirmDeviceIntake}
                className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50"
              >
                Save status
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={dialog?.type === 'return-ticket'}
        mode="confirm"
        title="Return this ticket?"
        message="This ticket will be released from your active workload and returned to the appropriate work pool. You may not retain ownership after returning it."
        confirmLabel="Return Ticket"
        cancelLabel="Cancel"
        tone="amber"
        onCancel={closeDialog}
        onConfirm={confirmReturnTicket}
      />

      <ConfirmDialog
        open={dialog?.type === 'status-change-confirm'}
        mode="confirm"
        title="Confirm status change"
        message={`Change this ticket from ${dialog?.fromStatus || '—'} to ${dialog?.targetStatus || '—'}?${
          dialog?.targetStatus === 'Brought to Helpdesk' ||
          isSendToHardwareStatus(dialog?.targetStatus) ||
          isHardwareLabStatus(dialog?.targetStatus)
            ? ' Device Type, Brand, and Asset Tag may be required before the change is saved.'
            : ''
        }`}
        confirmLabel="Confirm status"
        cancelLabel="Cancel"
        tone="indigo"
        onCancel={() => {
          closeDialog();
          if (ticket) setStatus(displayStatus(ticket) === 'In Hardware Lab' ? SEND_TO_HARDWARE_LABEL : ticket.status || status);
        }}
        onConfirm={confirmDirectStatusChange}
      />

      
      <ConfirmDialog
        open={dialog?.type === 'approve-submission'}
        mode="confirm"
        title={`Approve submission #${dialog?.ticketId || ticket?.id || ''}`}
        message="This engineer-submitted ticket will become an Open operational ticket after approval."
        confirmLabel="Approve"
        cancelLabel="Cancel"
        tone="emerald"
        onCancel={closeDialog}
        onConfirm={confirmApproveSubmission}
      />

<ConfirmDialog
        open={dialog?.type === 'reject-submission'}
        mode="prompt"
        title={`Dismiss submission #${dialog?.ticketId || ticket?.id || ''}`}
        message={`Requester: ${dialog?.requester || '—'} · Submitted by: ${dialog?.submitter || 'Engineer'}. A reason is required. The engineer will see this explanation in their portal.`}
        confirmLabel="Dismiss with reason"
        cancelLabel="Cancel"
        tone="rose"
        required
        placeholder="Explain why this submission is being dismissed…"
        defaultValue={dialog?.defaultValue || ''}
        onCancel={closeDialog}
        onConfirm={confirmRejectSubmission}
      />

      <ConfirmDialog
        open={dialog?.type === 'hw-print'}
        mode="prompt"
        title="Hardware form remark"
        message="This remark is saved to the ticket audit log and printed as the Problem on both the HW Part and 1400 Part of the form."
        placeholder="Hardware form problem / remark for lab…"
        confirmLabel="Save & Print"
        cancelLabel="Cancel"
        tone="indigo"
        required
        defaultValue={dialog?.defaultValue || ''}
        onCancel={closeDialog}
        onConfirm={confirmHwPrint}
      />
      <ConfirmDialog
        open={dialog?.type === 'delete-remark'}
        mode="confirm"
        title="Delete this remark?"
        message="This action is permanent and cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep"
        tone="rose"
        onCancel={closeDialog}
        onConfirm={() => confirmDeleteRemark(dialog?.idx)}
      />
      <ConfirmDialog
        open={dialog?.type === 'hand-over'}
        mode="confirm"
        title="Hand over device?"
        message="Confirm the device has been returned to the user. The ticket will be marked Resolved."
        confirmLabel="Hand Over & Resolve"
        cancelLabel="Cancel"
        tone="emerald"
        onCancel={closeDialog}
        onConfirm={confirmHandOver}
      />
    </>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 min-w-0">
        <span className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
        <span className={`block text-xs font-semibold text-gray-200 truncate mt-0.5 ${mono ? 'font-mono text-emerald-400' : ''}`}>
          {value || '—'}
        </span>
      </div>
    </div>
  );
}

function NoteCard({
  user,
  label,
  badge,
  stateLine,
  byLine,
  text,
  noteLabel,
  ts,
  color,
  highlightRemark,
  editable,
  editing,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDelete,
  saving,
  detail,
  eventType,
}) {
  const [open, setOpen] = useState(false);
  const initials = (user || '?')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const hasDetail = detail && Object.keys(detail).some((k) => detail[k]);
  return (
    <div className="flex gap-3 p-3 rounded-xl hover:bg-[#1F2937]/50 transition border border-transparent hover:border-[#1F2937]">
      <div
        className={`w-9 h-9 rounded-full bg-gradient-to-br ${color || 'from-slate-600 to-slate-700'} avatar-circle text-white text-xs shrink-0 shadow-lg`}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap mb-1">
          <span className="text-sm font-bold text-white">{user}</span>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{label}</span>
          {eventType && (
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-[#374151] text-slate-400">
              {eventType}
            </span>
          )}
          {badge && (
            <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">{badge}</span>
          )}
          {ts && <span className="text-[10px] text-gray-500 font-mono">• {ts}</span>}
          {editable && !editing && (
            <span className="ml-auto flex gap-1">
              <button
                type="button"
                onClick={onEditStart}
                className="text-[10px] font-bold text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-[#1F2937]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={saving}
                className="text-[10px] font-bold text-rose-400/80 hover:text-rose-300 px-1.5 py-0.5 rounded hover:bg-rose-500/10 disabled:opacity-40"
              >
                Delete
              </button>
            </span>
          )}
          {hasDetail && !editable && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="ml-auto text-[10px] font-bold text-cyan-400/90 hover:text-cyan-300 px-1.5 py-0.5 rounded hover:bg-cyan-500/10"
            >
              {open ? 'Hide details' : 'Details'}
            </button>
          )}
        </div>
        {stateLine && (
          <p className="text-[11px] text-slate-300 font-semibold mb-1 font-mono">{stateLine}</p>
        )}
        {byLine && (
          <p className="text-[11px] text-slate-400 mb-1.5">
            <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mr-1">By</span>
            {String(byLine).replace(/^By:\s*/i, '')}
          </p>
        )}
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={text}
              onChange={(e) => onEditChange(e.target.value)}
              rows={3}
              className="dark-input w-full text-xs resize-none"
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={onEditCancel}
                className="h-7 px-2.5 rounded-lg border border-[#374151] text-[10px] font-bold text-slate-400 hover:bg-[#1F2937]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={onEditSave}
                className="h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        ) : text ? (
          <div
            className={
              label === 'Campus Support Remark'
                ? 'rounded-lg border border-indigo-500/35 bg-indigo-950/25 p-3 text-xs text-slate-100 leading-relaxed whitespace-pre-wrap break-words'
                : label === 'Workstation Remark' || label === 'Field Tech Remark'
                  ? 'rounded-lg border border-emerald-500/35 bg-emerald-950/20 p-3 text-xs text-slate-100 leading-relaxed whitespace-pre-wrap break-words'
                  : highlightRemark
                    ? 'rounded-lg border border-purple-500/35 bg-purple-950/25 p-3 text-xs text-purple-50 leading-relaxed whitespace-pre-wrap break-words'
                    : 'rounded-lg border border-[#1F2937] bg-[#111827] p-3 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap break-words'
            }
          >
            {noteLabel || highlightRemark || label === 'Campus Support Remark' || label === 'Workstation Remark' ? (
              <p
                className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${
                  label === 'Campus Support Remark'
                    ? 'text-indigo-300/90'
                    : label === 'Workstation Remark' || label === 'Field Tech Remark'
                      ? 'text-emerald-300/90'
                      : 'text-purple-300/80'
                }`}
              >
                {noteLabel || (label && label.includes('Remark') ? 'Remark' : 'Note')}
              </p>
            ) : null}
            {text}
          </div>
        ) : null}
        {open && hasDetail && (
          <div className="mt-2 rounded-lg border border-[#1F2937] bg-[#0B0F19]/80 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            {detail.eventType && (
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">Event type</span>
                <p className="text-slate-200 font-semibold">{detail.eventType}</p>
              </div>
            )}
            {detail.actor && (
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">Actor</span>
                <p className="text-slate-200 font-semibold">{detail.actor}</p>
              </div>
            )}
            {detail.timestamp && (
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">Timestamp</span>
                <p className="text-slate-200 font-mono">{detail.timestamp}</p>
              </div>
            )}
            {detail.previousStatus && (
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">Previous status</span>
                <p className="text-slate-200 font-mono">{detail.previousStatus}</p>
              </div>
            )}
            {detail.newStatus && (
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">New status</span>
                <p className="text-slate-200 font-mono">{detail.newStatus}</p>
              </div>
            )}
            {detail.ticketId && (
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">Ticket</span>
                <p className="text-cyan-300 font-mono font-bold">#{detail.ticketId}</p>
              </div>
            )}
            {detail.note && (
              <div className="sm:col-span-2">
                <span className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">Full note</span>
                <p className="text-slate-300 whitespace-pre-wrap break-words mt-0.5">{detail.note}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


function parseComments(remarksText) {
  if (!remarksText) return [];
  const comments = [];
  // === User | time ===  or  === User | time | HW-SEND ===
  const regex =
    /===\s*([^|]+?)\s*\|\s*([^|=\n]+?)(?:\s*\|\s*([^=\n]+?))?\s*===\s*([\s\S]*?)(?=\n\s*===\s*[^|]+\s*\||$)/g;
  let match;
  while ((match = regex.exec(remarksText)) !== null) {
    comments.push({
      user: match[1].trim(),
      timestamp: match[2].trim(),
      tag: (match[3] || '').trim(),
      text: (match[4] || '').trim(),
    });
  }
  return comments;
}


/** True when the ticket is in the Support Workstation / hardware lab workflow */
function isWorkstationTicketLike(ticket) {
  if (!ticket) return false;
  const st = String(ticket.status || '').toLowerCase();
  const ar = String(ticket.action_required || '').toLowerCase();
  return (
    st.includes('hardware') ||
    st.includes('diagnostic') ||
    st.includes('lab') ||
    st === 'support workstation' ||
    st === 'brought to helpdesk' ||
    st === 'ready for return' ||
    st === 'waiting for parts' ||
    ar.includes('hardware') ||
    ar === 'support workstation' ||
    ar === 'under diagnostics' ||
    ar === 'ready for return' ||
    ar === 'brought to helpdesk' ||
    Boolean(ticket.lab_engineer)
  );
}

/** Classify history action_note into event type for the timeline */
/** Parse history timestamps for chronological ordering (aligned with formatDateTime / Admin log). */
function historyTimeMs(value, fallback = NaN) {
  if (value == null || value === '') return fallback;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? fallback : t;
  }
  let s = String(value).trim();
  // Postgres often returns "YYYY-MM-DD HH:MM:SS+00" without a T separator
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
    s = s.replace(' ', 'T');
  }
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? fallback : t;
}

function classifyHistoryEvent(note, prev, next) {
  const n = String(note || '').toLowerCase();
  const nx = String(next || '').toLowerCase();
  if (/claimed for|claimed device|claimed by/.test(n)) return { label: 'Claim', type: 'claim', color: 'from-cyan-500 to-cyan-700' };
  if (/assigned to|assigned by|unassigned by/.test(n)) return { label: 'Assignment', type: 'assignment', color: 'from-indigo-600 to-indigo-700' };
  if (/handed over|device handed over|handover/.test(n) || nx === 'device handed over')
    return { label: 'Handover', type: 'handover', color: 'from-emerald-500 to-teal-600' };
  if (/undo.*handed|undo device/.test(n)) return { label: 'Undo Handover', type: 'undo', color: 'from-amber-500 to-orange-600' };
  if (/resolved by|canceled by|cancelled by/.test(n) || nx === 'resolved')
    return { label: 'Resolution', type: 'resolution', color: 'from-emerald-600 to-emerald-700' };
  if (/send to hardware|in hardware lab|hardware form|hw-send|diagnostics/.test(n) || /hardware|diagnostic/.test(nx))
    return { label: 'Hardware / Device', type: 'hardware', color: 'from-purple-500 to-fuchsia-600' };
  if (/ticket opened|opened/.test(n) && (String(prev || '').toLowerCase() === 'none' || !prev))
    return { label: 'Created', type: 'created', color: 'from-slate-500 to-slate-700' };
  if (/description updated/.test(n))
    return { label: 'Description', type: 'description', color: 'from-amber-500 to-orange-600' };
  if (/remark|note/.test(n)) return { label: 'Remark', type: 'remark', color: 'from-violet-500 to-indigo-600' };
  if (/status\s*(correction|reversed)|reversed:/i.test(n))
    return { label: 'Status Reversed', type: 'status', color: 'from-amber-500 to-orange-600' };
  if (/device\s*:|device details/i.test(n))
    return { label: 'Device Update', type: 'device', color: 'from-purple-500 to-indigo-600' };
  if (/status|updated by/.test(n) || (prev && next && String(prev) !== String(next)))
    return { label: 'Status Change', type: 'status', color: 'from-blue-600 to-indigo-700' };
  return { label: 'Activity', type: 'system', color: 'from-slate-600 to-slate-700' };
}

/** Oldest first → newest at bottom; merge status-change + HW/status remarks into one card */
function buildTimeline(ticket, history) {
  if (!ticket) return [];
  const baseTime = ticket.created_at ? new Date(ticket.created_at).getTime() : 0;
  const entries = [];
  const skipHistKeys = new Set();

  // Prefer a single creation event from ticket_history when present (avoids "Ticket Opened" + synthetic duplicate)
  const histList = Array.isArray(history) ? history : [];
  const hasCreateHist = histList.some((h) => {
    const n = String(h.action_note || '').toLowerCase();
    const prev = String(h.previous_status || '').toLowerCase();
    return (
      prev === 'none' ||
      /ticket #\d+\s+opened|ticket opened|submitted for admin approval/.test(n)
    );
  });
  if (ticket.created_at && !hasCreateHist) {
    entries.push({
      key: 'created',
      user: 'System',
      label: 'Ticket Created',
      eventType: 'created',
      text: `Ticket #${ticket.id} opened${ticket.user_name ? ` for ${ticket.user_name}` : ''}${
        ticket.issue_category ? ` · ${ticket.issue_category}` : ''
      }`,
      ts: formatDateTime(ticket.created_at),
      color: 'from-slate-500 to-slate-700',
      rawTime: baseTime || 0,
      detail: {
        eventType: 'Ticket creation',
        actor: 'System',
        timestamp: formatDateTime(ticket.created_at),
        ticketId: ticket.id,
        newStatus: ticket.status || 'Open',
        note: ticket.description || null,
      },
    });
  }

  if (ticket.final_remarks) {
    entries.push({
      key: 'req',
      user: ticket.user_name || 'Requester',
      label: 'Requester Note',
      eventType: 'note',
      text: ticket.final_remarks,
      ts: ticket.created_at ? formatDateTime(ticket.created_at) : '',
      color: 'from-indigo-500 to-indigo-600',
      rawTime: (baseTime || 0) + 10,
      detail: {
        eventType: 'Requester note',
        actor: ticket.user_name || 'Requester',
        timestamp: ticket.created_at ? formatDateTime(ticket.created_at) : null,
        ticketId: ticket.id,
        note: ticket.final_remarks,
      },
    });
  }

  const comments = parseComments(ticket.it_engineer_remarks || '');
  comments.forEach((c, i) => {
    const parsed = Date.parse(c.timestamp);
    const tag = c.tag || '';
    const isHw = /hw-?send/i.test(tag);
    const isStatusTagged = /^status\b/i.test(tag) || /status\s*·/i.test(tag) || /→/.test(tag);
    // Note body only — never surface "HW-SEND · From → To" as the remark text
    const noteOnly = String(c.text || '')
      .replace(/^===\s*[^=]+===\s*/gm, '')
      .replace(/^\s*(HW-SEND|STATUS)\s*·[^\n]*/gim, '')
      .trim();

    if (!noteOnly) return;

    const remarkLabel = isHw
      ? 'Hardware Remark'
      : isStatusTagged
        ? 'Status Remark'
        : isWorkstationTicketLike(ticket)
          ? 'Workstation Remark'
          : 'Campus Support Remark';

    entries.push({
      key: `tech-${i}`,
      user: displayPersonName(c.user),
      label: remarkLabel,
      badge: 'Remark',
      stateLine: null,
      text: noteOnly,
      ts: c.timestamp ? formatDateTime(c.timestamp) : '—',
      color: isHw
        ? 'from-purple-500 to-indigo-600'
        : isWorkstationTicketLike(ticket)
          ? 'from-emerald-500 to-teal-600'
          : 'from-indigo-500 to-cyan-600',
      highlightRemark: true,
      rawTime: Number.isNaN(parsed) ? baseTime + (i + 1) * 1000 : parsed,
      sortKey: `remark-${i}`,
      eventType: isHw ? 'hardware' : 'remark',
      remarkIndex: i,
    });

    // Only skip pure remark-duplicate history rows — never hide status / device / reverse logs
    (Array.isArray(history) ? history : []).forEach((h, hi) => {
      const note = String(h.action_note || '');
      const isStatusLike =
        /status\s*(changed|correction|reversed)|device\s*:|assigned to|unassigned|claimed/i.test(
          note
        );
      if (isStatusLike) return;
      // Pure remark rows that only repeat this note body
      if (
        noteOnly.length >= 3 &&
        note.includes(noteOnly) &&
        /remark\s*updated|remark:/i.test(note) &&
        !/status\s*changed|→/.test(note)
      ) {
        skipHistKeys.add(String(h.id ?? hi));
      }
    });
  });

  if (ticket.diagnostic_notes) {
    String(ticket.diagnostic_notes)
      .split(/\n-{5,}\n/)
      .filter((ln) => ln.trim())
      .forEach((ln, i) => {
        entries.push({
          key: `lab-${i}`,
          user: 'Lab 6004',
          label: 'Lab Diagnosis',
          text: ln.trim(),
          ts: '',
          color: 'from-purple-500 to-fuchsia-600',
          rawTime: baseTime + 1500 + i,
        });
      });
  }

  (Array.isArray(history) ? history : []).forEach((h, i) => {
    const key = String(h.id ?? i);
    if (skipHistKeys.has(key)) return;
    const note = String(h.action_note || '');

    // Prefer authoritative changed_at; fall back by history id so order stays stable when missing
    const rt = historyTimeMs(h.changed_at, NaN);
    // Skip bare "Ticket Opened" when a richer create hist/synthetic already covers creation
    if (/^ticket opened$/i.test(note.trim()) && hasCreateHist) {
      return;
    }
    const remarkFromNote = (note.match(/(?:·\s*)?Remark:\s*([\s\S]+)$/i) ||
      note.match(/note added[:\s]+([\s\S]+?)(?:\s*·\s*by\s|$)/i) ||
      [])[1];
    const deviceFromNote = (note.match(/Device:\s*([^·]+?)(?:\s*·\s*by\s|$)/i) || [])[1];
    const prev = h.previous_status || '—';
    const next = h.new_status || '—';
    const cls = classifyHistoryEvent(note, prev, next);
    const statusActuallyChanged =
      String(prev).toLowerCase() !== String(next).toLowerCase() &&
      String(prev).toLowerCase() !== 'none';
    const isReverse =
      /status\s*(correction|reversed)|reversed:/i.test(note) ||
      (statusActuallyChanged && /correction|reversed/i.test(note));
    const actor = displayPersonName(h.engineer_name || 'System');

    // Structured lines: status transition + by + device (always visible when present)
    let stateLine = statusActuallyChanged
      ? `${isReverse ? 'Status reversed' : 'Status changed'}: ${prev} → ${next}`
      : /device\s*:/i.test(note)
        ? 'Device details updated'
        : null;
    const byLine = actor && actor !== 'System' ? `By: ${actor}` : null;
    let noteText = remarkFromNote ? remarkFromNote.trim() : '';
    if (!noteText && /remark|note added/i.test(note) && !statusActuallyChanged && !deviceFromNote) {
      noteText = note
        .replace(/^.*?remark(?:\s*added)?[:\s]*/i, '')
        .replace(/\s*·\s*by\s+[^.]+$/i, '')
        .trim();
    }
    // Body: remark and/or device details — keep status transition on stateLine only
    let displayText = '';
    const bits = [];
    if (deviceFromNote && String(deviceFromNote).trim()) {
      bits.push(`Device: ${String(deviceFromNote).trim()}`);
    }
    if (noteText) bits.push(noteText);
    if (bits.length) {
      displayText = bits.join('\n');
    } else if (
      cls.type === 'assignment' ||
      cls.type === 'claim' ||
      cls.type === 'resolution' ||
      cls.type === 'handover' ||
      cls.type === 'created'
    ) {
      displayText = note
        .replace(/^Status changed:\s*[^\n]*/i, '')
        .replace(/^Status reversed:\s*[^\n]*/i, '')
        .replace(/\s*·\s*by\s+[^.]+/i, '')
        .replace(/\s*·\s*$/, '')
        .trim();
    } else if (!statusActuallyChanged) {
      displayText = note
        .replace(/^Status changed:\s*[^\n]*/i, '')
        .replace(/\s*·\s*by\s+[^.]+/i, '')
        .trim();
    }

    entries.push({
      key: `hist-${h.id || i}`,
      user: actor,
      label: isReverse ? 'Status Reversed' : cls.label,
      eventType: isReverse ? 'status' : cls.type,
      badge: noteText
        ? 'Remark'
        : deviceFromNote
          ? 'Device'
          : isReverse
            ? 'Reverse'
            : cls.type === 'claim'
              ? 'Claim'
              : cls.type === 'assignment'
            ? 'Assign'
            : cls.type === 'resolution'
              ? 'Close'
              : cls.type === 'handover'
                ? 'Handover'
                : cls.type === 'created'
                  ? 'Created'
                  : null,
      stateLine,
      byLine,
      text: displayText,
      noteLabel: noteText ? 'Note' : null,
      ts: h.changed_at ? formatDateTime(h.changed_at) : '—',
      color: cls.color,
      highlightRemark: Boolean(noteText),
      rawTime: Number.isNaN(rt)
        ? baseTime + 1_000_000 + Number(h.id || i)
        : rt,
      sortKey: `hist-${h.id != null ? h.id : i}`,
      detail: {
        eventType: cls.label,
        actor,
        timestamp: h.changed_at ? formatDateTime(h.changed_at) : null,
        previousStatus: prev !== '—' && String(prev).toLowerCase() !== 'none' ? prev : null,
        newStatus: next !== '—' ? next : null,
        ticketId: ticket.id,
        note: noteText || note || null,
      },
    });
  });

  // Chronological (oldest → newest). On equal timestamps: assignment → claim → status → remark → other
  const TYPE_RANK = {
    created: 0,
    note: 1,
    assignment: 2,
    claim: 3,
    status: 4,
    description: 5,
    hardware: 6,
    remark: 7,
    handover: 8,
    resolution: 9,
    undo: 10,
    system: 11,
  };
  entries.sort((a, b) => {
    const d = (a.rawTime || 0) - (b.rawTime || 0);
    if (d !== 0) return d;
    const ra = TYPE_RANK[a.eventType] ?? 50;
    const rb = TYPE_RANK[b.eventType] ?? 50;
    if (ra !== rb) return ra - rb;
    return String(a.sortKey || a.key || '').localeCompare(String(b.sortKey || b.key || ''));
  });
  return entries;
}
