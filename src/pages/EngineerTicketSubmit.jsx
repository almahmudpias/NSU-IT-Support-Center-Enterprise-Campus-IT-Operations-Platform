import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ticketsApi, usersApi, settingsApi } from '../lib/api';
import { ticketPath } from '../lib/ids';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';

const FALLBACK_CATEGORIES = [
  'Hardware',
  'Software',
  'Network',
  'Access Control',
  'Assistant Needed',
  'Printer and Scanner',
];
const FALLBACK_BUILDINGS = ['NAC', 'SAC', 'Library', 'Admin'];
const FALLBACK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export default function EngineerTicketSubmitPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [buildings, setBuildings] = useState(FALLBACK_BUILDINGS);
  const [priorities, setPriorities] = useState(FALLBACK_PRIORITIES);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const searchTimer = useRef(null);
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [form, setForm] = useState({
    userName: '',
    extension: '',
    department: '',
    designation: '',
    building: '',
    roomLocation: '',
    issueCategory: '',
    priority: 'Medium',
    description: '',
    supportRemarks: '',
    preferredStatus: 'In Progress',
    workflow: 'campus', // campus | workstation
    hwType: '',
    deviceBrand: '',
    serialNumber: '',
  });

  const wantsHardware = String(form.preferredStatus || '').toLowerCase().includes('hardware');

  useEffect(() => {
    (async () => {
      try {
        const [cat, bld, pri, dev] = await Promise.all([
          settingsApi.list('issue-categories', true).catch(() => null),
          settingsApi.list('buildings', true).catch(() => null),
          settingsApi.list('priorities', true).catch(() => null),
          settingsApi.list('device-types', true).catch(() => null),
        ]);
        const cn = (cat?.data || []).map((r) => r.name).filter(Boolean);
        const bn = (bld?.data || []).map((r) => r.name).filter(Boolean);
        const pn = (pri?.data || []).map((r) => r.name).filter(Boolean);
        const dn = (dev?.data || []).map((r) => r.name).filter(Boolean);
        if (cn.length) setCategories(cn);
        if (bn.length) setBuildings(bn);
        if (dn.length) setDeviceTypes(dn);
        if (pn.length) {
          setPriorities(pn);
          setForm((f) => ({ ...f, priority: pn.includes('Medium') ? 'Medium' : pn[0] }));
        }
      } catch {
        /* fallbacks */
      }
    })();
  }, []);

  function onNameChange(v) {
    setForm((f) => ({ ...f, userName: v }));
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!v.trim()) {
      setShowSuggest(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const found = await usersApi.search(v.trim());
        const list = Array.isArray(found) ? found : [];
        setSuggestions(list.slice(0, 8));
        setShowSuggest(list.length > 0);
      } catch {
        setShowSuggest(false);
      }
    }, 280);
  }

  function fillUser(u) {
    setForm((f) => ({
      ...f,
      userName: u.name || '',
      designation: u.designation && u.designation !== 'null' ? u.designation : '',
      department: u.department && u.department !== 'null' ? u.department : '',
      extension: u.extension && u.extension !== 'null' ? u.extension : '',
      building: u.building && u.building !== 'null' ? u.building : '',
      roomLocation: u.room_location && u.room_location !== 'null' ? u.room_location : '',
    }));
    setShowSuggest(false);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.userName.trim() || !form.description.trim()) {
      showToast('warning', 'Required fields', 'Requester name and issue description are required.');
      return;
    }
    const hwPreferred = String(form.preferredStatus || '').toLowerCase().includes('hardware');
    if (hwPreferred) {
      if (!String(form.hwType || '').trim() || !String(form.deviceBrand || '').trim() || !String(form.serialNumber || '').trim()) {
        showToast(
          'warning',
          'Device details required',
          'Send to Hardware needs device type, brand, and serial / asset number (same as the hardware form).'
        );
        return;
      }
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      // Keep original issue description separate from support remarks
      const payload = {
        userName: form.userName.trim(),
        designation: form.designation,
        extension: form.extension,
        department: form.department,
        building: form.building,
        roomLocation: form.roomLocation,
        issueCategory:
          form.issueCategory ||
          (hwPreferred || form.workflow === 'workstation' ? 'Hardware' : ''),
        description: form.description.trim(),
        finalRemarks: form.supportRemarks.trim() || undefined,
        priority: form.priority,
        // Server forces Pending Approval for engineers regardless of client status
        status: 'Pending Approval',
        preferredStatus: form.preferredStatus,
        loggedByEngineer: user?.fullName || 'Engineer',
        ...(hwPreferred
          ? {
              hwType: form.hwType.trim(),
              deviceBrand: form.deviceBrand.trim(),
              serialNumber: form.serialNumber.trim(),
            }
          : {}),
      };
      const data = await ticketsApi.create(payload);
      if (!data?.success && !data?.ticketId) throw new Error(data?.message || 'Submission failed');
      const id = data.ticketId || data.ticket?.id;
      setSubmitted({
        id,
        status: data.ticket?.status || 'Pending Approval',
        pendingApproval: data.pendingApproval !== false,
        preferredStatus: form.preferredStatus,
      });
      showToast(
        'success',
        'Submitted for approval',
        `Ticket #${id} is pending Admin review — not yet operational.`
      );
      setForm((f) => ({
        ...f,
        userName: '',
        extension: '',
        department: '',
        designation: '',
        roomLocation: '',
        description: '',
        supportRemarks: '',
        hwType: '',
        deviceBrand: '',
        serialNumber: '',
      }));
    } catch (err) {
      showToast('error', 'Submission failed', err.message || 'Could not submit ticket');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#0B0F19]">
      <header className="h-20 shrink-0 flex items-center justify-between gap-3 px-6 sm:px-8 bg-[#111827] border-b border-[#1F2937]">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white tracking-tight">Submit Support Ticket</h2>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            Independent field work · requires Admin approval before becoming operational
          </p>
        </div>
        <Link
          to="/dashboard"
          className="h-9 px-3 rounded-lg border border-[#374151] text-xs font-bold text-slate-300 hover:bg-[#1F2937] inline-flex items-center"
        >
          Back
        </Link>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto custom-scroll p-6">
        {submitted && (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
            <p className="text-sm font-bold text-amber-200">Ticket #{submitted.id} submitted for Admin approval</p>
            <p className="text-xs text-amber-100/80 mt-1">
              Status: {submitted.status}. It will not appear in claim pools until an Admin approves it.
            </p>
            <Link
              to={ticketPath(submitted.id, { action: 'view' })}
              className="inline-flex mt-3 h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold items-center"
            >
              View submission
            </Link>
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="max-w-3xl rounded-2xl border border-[#1F2937] bg-[#111827]/80 p-5 sm:p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 relative">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Requester / affected person *
              </label>
              <input
                className="dark-input mt-1 w-full h-10 text-sm"
                value={form.userName}
                onChange={(e) => onNameChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                autoComplete="off"
                required
              />
              {showSuggest && suggestions.length > 0 && (
                <div className="absolute z-[100] left-0 top-full mt-1 w-[min(24rem,90vw)] bg-[#111827] border border-[#374151] shadow-2xl max-h-72 overflow-y-auto custom-scroll rounded-lg">
                  {suggestions.map((u, i) => (
                    <div
                      key={`${u.id || u.name}-${i}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        fillUser(u);
                      }}
                      className="px-4 py-2.5 cursor-pointer border-b border-[#1F2937] last:border-0 transition hover:bg-indigo-500/25"
                    >
                      <div className="font-bold text-white text-sm truncate">{u.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {[u.designation, u.department].filter((v) => v && v !== 'null').join(' · ') || 'No department'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {u.extension && u.extension !== 'null' ? `Ext ${u.extension}` : 'No extension'}
                        {(u.building || u.room_location) && u.building !== 'null'
                          ? ` · ${[u.building, u.room_location].filter((v) => v && v !== 'null').join(' ')}`
                          : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Department</label>
              <input
                className="dark-input mt-1 w-full h-10 text-sm"
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Extension</label>
              <input
                className="dark-input mt-1 w-full h-10 text-sm"
                value={form.extension}
                onChange={(e) => setForm((f) => ({ ...f, extension: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Building</label>
              <select
                className="dark-input mt-1 w-full h-10 text-sm"
                value={form.building}
                onChange={(e) => setForm((f) => ({ ...f, building: e.target.value }))}
              >
                <option value="">—</option>
                {buildings.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Room / location</label>
              <input
                className="dark-input mt-1 w-full h-10 text-sm"
                value={form.roomLocation}
                onChange={(e) => setForm((f) => ({ ...f, roomLocation: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Category</label>
              <select
                className="dark-input mt-1 w-full h-10 text-sm"
                value={form.issueCategory}
                onChange={(e) => setForm((f) => ({ ...f, issueCategory: e.target.value }))}
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Priority</label>
              <select
                className="dark-input mt-1 w-full h-10 text-sm"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Preferred status after approval *
              </label>
              <select
                className="dark-input mt-1 w-full h-10 text-sm"
                value={form.preferredStatus}
                onChange={(e) => setForm((f) => ({ ...f, preferredStatus: e.target.value }))}
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Waiting for Device">Waiting for Device</option>
                <option value="Brought to Helpdesk">Brought to Helpdesk</option>
                <option value="Send to Hardware">Send to Hardware</option>
                <option value="Resolved">Resolved</option>
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Ticket stays Pending Approval until an Admin reviews it. This is the status requested after approval.
                {wantsHardware
                  ? ' Send to Hardware will open the device in the hardware lab workflow after approval.'
                  : ''}
              </p>
            </div>
            {wantsHardware && (
              <div className="sm:col-span-2 rounded-xl border border-[#1F2937] bg-[#0B0F19]/60 p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Hardware device details * (same as hardware form)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Device type *
                    </label>
                    {deviceTypes.length ? (
                      <select
                        className="dark-input mt-1 w-full h-10 text-sm"
                        value={form.hwType}
                        onChange={(e) => setForm((f) => ({ ...f, hwType: e.target.value }))}
                        required={wantsHardware}
                      >
                        <option value="">— Select —</option>
                        {deviceTypes.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="dark-input mt-1 w-full h-10 text-sm"
                        value={form.hwType}
                        onChange={(e) => setForm((f) => ({ ...f, hwType: e.target.value }))}
                        placeholder="Laptop / Desktop / …"
                        required={wantsHardware}
                      />
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Brand *
                    </label>
                    <input
                      className="dark-input mt-1 w-full h-10 text-sm"
                      value={form.deviceBrand}
                      onChange={(e) => setForm((f) => ({ ...f, deviceBrand: e.target.value }))}
                      placeholder="e.g. Dell, HP"
                      required={wantsHardware}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Serial / asset *
                    </label>
                    <input
                      className="dark-input mt-1 w-full h-10 text-sm"
                      value={form.serialNumber}
                      onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
                      placeholder="Serial or asset tag"
                      required={wantsHardware}
                    />
                  </div>
                </div>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Issue description *
              </label>
              <textarea
                className="dark-input mt-1 w-full text-sm min-h-[100px] py-2"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Support remarks (optional)
              </label>
              <textarea
                className="dark-input mt-1 w-full text-sm min-h-[72px] py-2"
                value={form.supportRemarks}
                onChange={(e) => setForm((f) => ({ ...f, supportRemarks: e.target.value }))}
                placeholder="What work was done or is needed…"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-indigo-900/30"
            >
              {submitting ? 'Submitting…' : 'Submit for Admin approval'}
            </button>
            <p className="text-[11px] text-slate-500">
              Submitted as <span className="text-slate-300 font-semibold">{user?.fullName || 'Engineer'}</span>
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
