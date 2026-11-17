import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { requestersApi } from '../lib/api';
import { ticketPath, requesterPath, resolveParamId } from '../lib/ids';
import { useToast } from '../components/Toast';

const EMPTY_FORM = {
  name: '',
  extension: '',
  department: '',
  designation: '',
  building: '',
  room_location: '',
};

const PAGE_SIZE = 15;

const inputClass =
  'w-full h-10 rounded-lg border border-[#374151] bg-[#0B0F19] px-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

const buttonPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 h-10 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50';

const buttonSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-[#374151] bg-[#111827] px-4 h-10 text-sm font-medium text-slate-300 transition hover:bg-[#1F2937] hover:text-white disabled:opacity-40';

function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: 'shrink-0',
    'aria-hidden': true,
  };
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    close: <><path d="m18 6-12 12" /><path d="m6 6 12 12" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72l.45 3.05a2 2 0 0 1-.57 1.7L7.1 10.36a16 16 0 0 0 6 6l1.89-1.89a2 2 0 0 1 1.7-.57l3.05.45A2 2 0 0 1 22 16.92Z" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z" /></>,
    ticket: <><path d="M2 9a3 3 0 0 0 0 6v4h20v-4a3 3 0 0 1 0-6V5H2Z" /><path d="M13 5v2" /><path d="M13 11v2" /><path d="M13 17v2" /></>,
    device: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></>,
    note: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h8" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5.64 9A7 7 0 0 1 17.5 5.5L20 12M4 12l2.5 6.5A7 7 0 0 0 18.36 15" /></>,
    filter: <><path d="M4 7h16" /><path d="M7 12h10" /><path d="M10 17h4" /></>,
    arrow: <><path d="M7 17 17 7" /><path d="M7 7h10v10" /></>,
  };
  return <svg {...common}>{paths[name] || paths.users}</svg>;
}

function StatusLabel({ status }) {
  const value = status || 'Open';
  const normalized = value.toLowerCase();
  let style = 'bg-amber-500/10 text-amber-300 ring-amber-500/30';
  if (normalized === 'resolved' || normalized === 'closed') {
    style = 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30';
  } else if (normalized.includes('progress') || normalized.includes('assigned') || normalized.includes('lab')) {
    style = 'bg-blue-500/10 text-blue-300 ring-blue-500/30';
  } else if (normalized.includes('cancel')) {
    style = 'bg-slate-500/10 text-slate-400 ring-slate-500/20';
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}>
      {value}
    </span>
  );
}

function EmptyState({ icon = 'search', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#374151] bg-[#0B0F19]/50 px-5 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-[#1F2937] text-slate-500">
        <Icon name={icon} size={18} />
      </div>
      <h4 className="text-sm font-semibold text-slate-200">{title}</h4>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function initialsOf(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  return parts
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function Avatar({ name }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600/80 to-violet-600/70 text-xs font-bold text-white shadow-sm shadow-indigo-500/20">
      {initialsOf(name)}
    </div>
  );
}

function PersonForm({ form, setForm, onSubmit, onCancel, saving, editing }) {
  const fields = [
    { key: 'name', label: 'Full name', required: true, placeholder: 'Enter full name' },
    { key: 'department', label: 'Department', placeholder: 'e.g. Computer Science' },
    { key: 'designation', label: 'Designation', placeholder: 'e.g. Lecturer' },
    { key: 'extension', label: 'Extension', placeholder: 'e.g. 1234' },
    { key: 'building', label: 'Building', placeholder: 'Building name' },
    { key: 'room_location', label: 'Room', placeholder: 'Room number' },
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className={field.key === 'name' ? 'sm:col-span-2' : ''}>
            <span className="mb-1.5 block text-sm font-medium text-slate-300">
              {field.label}
              {field.required && <span className="ml-1 text-rose-400">*</span>}
            </span>
            <input
              required={field.required}
              autoComplete="off"
              maxLength={field.key === 'name' ? 150 : 120}
              value={form[field.key]}
              onChange={(e) =>
                setForm((previous) => ({ ...previous, [field.key]: e.target.value }))
              }
              placeholder={field.placeholder}
              className={inputClass}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-[#1F2937] pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className={buttonSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={buttonPrimary}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Add person'}
        </button>
      </div>
    </form>
  );
}

function supportRequestHref(person) {
  const params = new URLSearchParams();
  if (person?.name) params.set('name', person.name);
  if (person?.department) params.set('department', person.department);
  if (person?.designation) params.set('designation', person.designation);
  if (person?.extension) params.set('extension', person.extension);
  if (person?.building) params.set('building', person.building);
  if (person?.room_location) params.set('room', person.room_location);
  const qs = params.toString();
  return qs ? `/campus-support/new?${qs}` : '/campus-support/new';
}

export default function RequestersPage() {
  const { id: idParam } = useParams();
  const selectedId = idParam ? resolveParamId(idParam) : null;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  // List filters driven by URL: /requesters?page=1&limit=25&search=rahman&department=&building=&sort=name
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10) || 25));
  const search = (searchParams.get('search') || '').trim();
  const department = searchParams.get('department') || '';
  const building = searchParams.get('building') || '';
  const sort = searchParams.get('sort') || 'name';

  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState(search);
  const [departments, setDepartments] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  function patchListParams(patch, { replace = true } = {}) {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '' || (k === 'page' && Number(v) === 1) || (k === 'limit' && Number(v) === 25) || (k === 'sort' && v === 'name')) {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    });
    // Always keep page/limit explicit when not defaults for professional URLs
    if (patch.page != null && Number(patch.page) > 1) next.set('page', String(patch.page));
    if (patch.limit != null && Number(patch.limit) !== 25) next.set('limit', String(patch.limit));
    setSearchParams(next, { replace });
  }

  function goBackToList() {
    if (window.history.length > 1) navigate(-1);
    else navigate('/requesters');
  }

  const [detail, setDetail] = useState(null);
  const [counts, setCounts] = useState({ open: 0, resolved: 0, devices: 0, total: 0 });
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailRetry, setDetailRetry] = useState(0);

  const [tab, setTab] = useState('history');
  const [tickets, setTickets] = useState([]);
  const [ticketTotal, setTicketTotal] = useState(0);
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketSearchInput, setTicketSearchInput] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatus, setTicketStatus] = useState('');
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketError, setTicketError] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [scratchNote, setScratchNote] = useState('');

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const ticketPages = Math.max(1, Math.ceil(ticketTotal / PAGE_SIZE));

  const filtersActive = Boolean(searchInput || department || building || sort !== 'name');

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditing(false);
    setShowAdd(false);
  }, []);

  // Keep input in sync when URL search changes (e.g. browser back)
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const q = searchInput.trim();
      if (q === search) return;
      patchListParams({ search: q, page: 1 });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTicketSearch(ticketSearchInput.trim());
      setTicketPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [ticketSearchInput]);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      setListError('');
      const response = await requestersApi.list({ page, limit, search, department, building, sort });
      const raw = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : [];
      // Safety dedupe by normalized name (one row per person)
      const seen = new Map();
      raw.forEach((u) => {
        const key = String(u.name || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!key) {
          seen.set(`id:${u.id}`, u);
          return;
        }
        const score = [u.building, u.room_location, u.department, u.extension, u.designation]
          .filter((v) => v && String(v).toLowerCase() !== 'null')
          .length;
        const prev = seen.get(key);
        if (!prev || score >= (prev._score || 0)) seen.set(key, { ...u, _score: score });
      });
      const unique = [...seen.values()].map(({ _score, ...u }) => u);
      setList(unique);
      if (Array.isArray(response)) {
        setTotal(unique.length);
      } else {
        setTotal(Number(response?.total) || unique.length);
        if (Array.isArray(response?.departments)) setDepartments(response.departments);
        if (Array.isArray(response?.buildings)) setBuildings(response.buildings);
      }
    } catch (error) {
      setListError(error.message || 'Could not load the directory.');
      setList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, department, building, sort]);

  useEffect(() => {
    if (!selectedId) loadList();
  }, [selectedId, loadList]);

  const refreshDetail = useCallback(async () => {
    if (!selectedId) return null;
    const response = await requestersApi.get(selectedId);
    const person = response?.user || response;
    setDetail(person);
    setCounts({
      open: Number(response?.counts?.open) || 0,
      resolved: Number(response?.counts?.resolved) || 0,
      devices: Number(response?.counts?.devices) || 0,
      total: Number(response?.counts?.total) || 0,
    });
    return person;
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError('');
      setDetailLoading(false);
      return undefined;
    }
    let active = true;
    setTab('history');
    setTicketPage(1);
    setTicketSearchInput('');
    setTicketSearch('');
    setTicketStatus('');
    setEditing(false);
    (async () => {
      try {
        setDetailLoading(true);
        setDetailError('');
        const response = await requestersApi.get(selectedId);
        if (!active) return;
        setDetail(response?.user || response);
        setCounts({
          open: Number(response?.counts?.open) || 0,
          resolved: Number(response?.counts?.resolved) || 0,
          devices: Number(response?.counts?.devices) || 0,
          total: Number(response?.counts?.total) || 0,
        });
      } catch (error) {
        if (active) {
          setDetailError(error.message || 'Could not load this person.');
          setDetail(null);
        }
      } finally {
        if (active) setDetailLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedId, detailRetry]);

  const loadTickets = useCallback(async () => {
    if (!selectedId) return;
    try {
      setTicketsLoading(true);
      setTicketError('');
      const response = await requestersApi.tickets(selectedId, {
        page: ticketPage,
        limit: PAGE_SIZE,
        search: tab === 'devices' ? '' : ticketSearch,
        status: tab === 'devices' ? '' : ticketStatus,
      });
      if (Array.isArray(response)) {
        setTickets(response);
        setTicketTotal(response.length);
      } else {
        setTickets(Array.isArray(response?.data) ? response.data : []);
        setTicketTotal(Number(response?.total) || 0);
      }
    } catch (error) {
      setTicketError(error.message || 'Could not load support requests.');
      setTickets([]);
      setTicketTotal(0);
    } finally {
      setTicketsLoading(false);
    }
  }, [selectedId, ticketPage, ticketSearch, ticketStatus, tab]);

  useEffect(() => {
    if (selectedId && (tab === 'history' || tab === 'devices')) loadTickets();
  }, [selectedId, tab, loadTickets]);

  const devices = useMemo(
    () => tickets.filter((ticket) => ticket.hw_type || ticket.asset_tag || ticket.serial_number),
    [tickets]
  );

  async function savePerson(event) {
    event.preventDefault();
    const cleanName = form.name.trim();
    if (!cleanName) {
      showToast('warning', 'Name required', "Enter the person's full name.");
      return;
    }
    const payload = {
      ...form,
      name: cleanName,
      extension: form.extension.trim(),
      department: form.department.trim(),
      designation: form.designation.trim(),
      building: form.building.trim(),
      room_location: form.room_location.trim(),
    };
    try {
      setSaving(true);
      if (editing && detail?.id) {
        await requestersApi.update(detail.id, payload);
        showToast('success', 'Details updated', cleanName);
        setEditing(false);
        await refreshDetail();
      } else {
        const response = await requestersApi.create(payload);
        showToast('success', 'Person added', cleanName);
        resetForm();
        const createdId = response?.user?.id ?? response?.id;
        if (createdId != null) navigate(requesterPath(createdId));
        else await loadList();
      }
    } catch (error) {
      showToast('error', 'Could not save', error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    if (!detail) return;
    setForm({
      name: detail.name || '',
      extension: detail.extension || '',
      department: detail.department || '',
      designation: detail.designation || '',
      building: detail.building || '',
      room_location: detail.room_location || '',
    });
    setEditing(true);
    setShowAdd(false);
  }

  function resetFilters() {
    setSearchInput('');
    setSearchParams({}, { replace: true });
  }

  const pageWindow = useMemo(() => {
    const pages = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = Math.max(1, end - 4); i <= end; i += 1) pages.push(i);
    return pages;
  }, [page, totalPages]);

  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);

  if (selectedId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0B0F19] text-slate-200">
        <header className="shrink-0 border-b border-[#1F2937] bg-[#111827] px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={goBackToList}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#374151] bg-[#0B0F19] px-3 text-xs font-semibold text-slate-300 transition hover:border-indigo-500/40 hover:text-white"
              >
                <Icon name="chevronLeft" size={16} />
                People
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold tracking-tight text-white">
                  {detail?.name || (detailLoading ? 'Loading…' : 'Person details')}
                </h1>
                <p className="text-[11px] text-slate-500">Requester profile · support history</p>
              </div>
            </div>
            {detail && !editing && (
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link to={supportRequestHref(detail)} className={buttonPrimary}>
                  New support request
                </Link>
                <button type="button" onClick={startEdit} className={buttonSecondary}>
                  Edit details
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scroll">
          {detailLoading ? (
            <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500">
              Loading person details…
            </div>
          ) : detailError ? (
            <div className="mx-auto max-w-xl px-5 py-16">
              <EmptyState
                icon="refresh"
                title="Could not load person details"
                description={detailError}
                action={
                  <button type="button" onClick={() => setDetailRetry((n) => n + 1)} className={buttonPrimary}>
                    Try again
                  </button>
                }
              />
            </div>
          ) : detail ? (
            <div className="w-full px-3 py-3 sm:px-4 sm:py-4">

              {!editing ? (
                <header className="border border-[#1F2937] bg-[#111827] px-4 py-4 sm:px-5">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-lg font-bold text-white shadow-lg shadow-indigo-500/25">
                      {initialsOf(detail.name)}
                    </div>
                    <div className="min-w-0">
                      <h2 className="break-words text-xl font-semibold tracking-tight text-white">
                        {detail.name || 'Unnamed person'}
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        {[detail.designation, detail.department].filter(Boolean).join(' · ') ||
                          'No department or designation added'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
                        {(detail.building || detail.room_location) && (
                          <span className="inline-flex items-center gap-1.5">
                            <Icon name="pin" size={15} />
                            {[detail.building, detail.room_location].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        {detail.extension && (
                          <span className="inline-flex items-center gap-1.5">
                            <Icon name="phone" size={14} />
                            Extension {detail.extension}
                          </span>
                        )}
                        {counts.total > 0 && (
                          <span className="inline-flex items-center gap-1.5">
                            <Icon name="ticket" size={14} />
                            {counts.total} request{counts.total === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </header>
              ) : (
                <section className="rounded-xl border border-[#1F2937] bg-[#111827] px-5 py-5 sm:px-6">
                  <h2 className="mb-1 text-base font-semibold text-white">Edit details</h2>
                  <p className="mb-4 text-sm text-slate-500">Update this person's workplace information.</p>
                  <PersonForm
                    form={form}
                    setForm={setForm}
                    onSubmit={savePerson}
                    onCancel={() => setEditing(false)}
                    saving={saving}
                    editing
                  />
                </section>
              )}

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: 'Open requests', value: counts.open },
                  { label: 'Resolved requests', value: counts.resolved },
                  { label: 'Devices', value: counts.devices },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-xl border border-[#1F2937] bg-[#111827] px-4 py-4">
                    <p className="text-sm text-slate-400">{metric.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{metric.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <section className="mt-4 overflow-hidden rounded-xl border border-[#1F2937] bg-[#111827]">
                <div className="flex gap-1 overflow-x-auto border-b border-[#1F2937] px-3 pt-2">
                  {[
                    { id: 'history', label: 'Support history' },
                    { id: 'devices', label: 'Devices' },
                    { id: 'notes', label: 'Notes' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTab(item.id)}
                      className={`shrink-0 border-b-2 px-3 pb-2.5 pt-2 text-sm font-medium transition ${
                        tab === item.id
                          ? 'border-indigo-500 text-indigo-300'
                          : 'border-transparent text-slate-500 hover:text-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="p-4 sm:p-5">
                  {tab === 'history' && (
                    <>
                      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                        <div className="relative min-w-0 flex-1">
                          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
                            <Icon name="search" size={16} />
                          </span>
                          <input
                            value={ticketSearchInput}
                            onChange={(event) => setTicketSearchInput(event.target.value)}
                            placeholder="Search by request or description…"
                            aria-label="Search support requests"
                            className={`${inputClass} pl-9`}
                          />
                        </div>
                        <select
                          aria-label="Filter requests by status"
                          value={ticketStatus}
                          onChange={(event) => {
                            setTicketStatus(event.target.value);
                            setTicketPage(1);
                          }}
                          className={`${inputClass} sm:w-44`}
                        >
                          <option value="">All statuses</option>
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      </div>

                      {ticketsLoading ? (
                        <p className="py-12 text-center text-sm text-slate-500">Loading support requests…</p>
                      ) : ticketError ? (
                        <EmptyState
                          icon="refresh"
                          title="Couldn't load support requests"
                          description={ticketError}
                          action={
                            <button type="button" onClick={loadTickets} className={buttonSecondary}>
                              Try again
                            </button>
                          }
                        />
                      ) : tickets.length === 0 ? (
                        <EmptyState
                          icon="ticket"
                          title="No support requests found"
                          description={
                            ticketSearch || ticketStatus
                              ? 'Try another search or change the status filter.'
                              : 'There are no support requests to show for this person yet.'
                          }
                        />
                      ) : (
                        <>
                          <ul className="divide-y divide-[#1F2937]">
                            {tickets.map((ticket) => (
                              <li key={ticket.id}>
                                <Link
                                  to={ticketPath(ticket.id, { action: 'view' })}
                                  className="group flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-slate-100 group-hover:text-indigo-300">
                                      {ticket.description || ticket.issue_category || 'Support request'}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      Request #{ticket.id}
                                      {ticket.issue_category ? ` · ${ticket.issue_category}` : ''}
                                      {ticket.updated_at || ticket.created_at
                                        ? ` · ${new Date(ticket.updated_at || ticket.created_at).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                          })}`
                                        : ''}
                                    </p>
                                  </div>
                                  <StatusLabel status={ticket.status} />
                                </Link>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-3 flex flex-col justify-between gap-3 border-t border-[#1F2937] pt-4 sm:flex-row sm:items-center">
                            <p className="text-xs text-slate-500">
                              Showing {(ticketPage - 1) * PAGE_SIZE + 1}–
                              {Math.min(ticketPage * PAGE_SIZE, ticketTotal)} of {ticketTotal.toLocaleString()} requests
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={ticketPage <= 1}
                                onClick={() => setTicketPage((value) => Math.max(1, value - 1))}
                                className={buttonSecondary}
                              >
                                Previous
                              </button>
                              <button
                                type="button"
                                disabled={ticketPage >= ticketPages}
                                onClick={() => setTicketPage((value) => Math.min(ticketPages, value + 1))}
                                className={buttonSecondary}
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {tab === 'devices' && (
                    <>
                      {ticketsLoading ? (
                        <p className="py-12 text-center text-sm text-slate-500">Loading device records…</p>
                      ) : ticketError ? (
                        <EmptyState
                          icon="refresh"
                          title="Couldn't load devices"
                          description={ticketError}
                          action={
                            <button type="button" onClick={loadTickets} className={buttonSecondary}>
                              Try again
                            </button>
                          }
                        />
                      ) : devices.length === 0 ? (
                        <EmptyState
                          icon="device"
                          title={counts.devices ? 'No devices on this page' : 'No devices recorded'}
                          description={
                            counts.devices
                              ? 'Browse other pages of support history, or clear filters, to find recorded hardware.'
                              : 'Devices appear here when hardware details have been recorded on a support request.'
                          }
                        />
                      ) : (
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                          {devices.map((device) => (
                            <div key={device.id} className="rounded-lg border border-[#1F2937] bg-[#0B0F19] p-4">
                              <h4 className="text-sm font-semibold text-white">{device.hw_type || 'Device'}</h4>
                              <p className="mt-1 text-xs text-slate-500">
                                {device.device_brand || device.brand || 'Brand not recorded'}
                              </p>
                              <p className="mt-3 text-xs text-slate-500">Serial / asset</p>
                              <p className="mt-0.5 break-all text-sm text-slate-200">
                                {device.serial_number || device.asset_tag || 'Not recorded'}
                              </p>
                              <Link
                                to={ticketPath(device.id, { action: 'view' })}
                                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                              >
                                View support request
                                <Icon name="arrow" size={13} />
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                      {!ticketsLoading && ticketTotal > PAGE_SIZE && (
                        <div className="mt-4 flex items-center justify-end gap-2 border-t border-[#1F2937] pt-4">
                          <button
                            type="button"
                            disabled={ticketPage <= 1}
                            onClick={() => setTicketPage((value) => Math.max(1, value - 1))}
                            className={buttonSecondary}
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            disabled={ticketPage >= ticketPages}
                            onClick={() => setTicketPage((value) => Math.min(ticketPages, value + 1))}
                            className={buttonSecondary}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {tab === 'notes' && (
                    <div className="max-w-2xl">
                      <p className="text-sm leading-6 text-slate-400">
                        These notes stay on this screen only. They are not saved. For a record that must be kept, add
                        it to a support request.
                      </p>
                      <textarea
                        value={scratchNote}
                        onChange={(event) => setScratchNote(event.target.value)}
                        rows={6}
                        placeholder="Write a reminder for this session…"
                        className={`${inputClass} mt-4 h-auto resize-y py-3 leading-6`}
                      />
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setScratchNote('')}
                          disabled={!scratchNote}
                          className={buttonSecondary}
                        >
                          Clear notes
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0B0F19] text-slate-200">
      <header className="shrink-0 border-b border-[#1F2937] bg-[#111827] px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">People</h1>
            <p className="mt-1 text-sm text-slate-400">
              Campus directory — search by name, extension, department, or room. One profile per person.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setForm(EMPTY_FORM);
              setShowAdd(true);
            }}
            className={buttonPrimary}
          >
            <Icon name="plus" size={16} />
            Add person
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
              <Icon name="search" size={16} />
            </span>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name, department, designation, extension, or room…"
              aria-label="Search people"
              className={`${inputClass} pl-9`}
            />
          </div>
          <select
            aria-label="Filter by department"
            value={department}
            onChange={(event) => {
              patchListParams({ department: event.target.value, page: 1 });
            }}
            className={`${inputClass} lg:w-48`}
          >
            <option value="">All departments</option>
            {departments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by building"
            value={building}
            onChange={(event) => {
              patchListParams({ building: event.target.value, page: 1 });
            }}
            className={`${inputClass} lg:w-40`}
          >
            <option value="">All buildings</option>
            {buildings.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort people"
            value={sort}
            onChange={(event) => {
              patchListParams({ sort: event.target.value, page: 1 });
            }}
            className={`${inputClass} lg:w-44`}
          >
            <option value="name">Name</option>
            <option value="department">Department</option>
            <option value="recent">Recently added</option>
          </select>
          {filtersActive && (
            <button type="button" onClick={resetFilters} className="h-10 shrink-0 text-sm text-indigo-400 hover:text-indigo-300">
              Clear filters
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto custom-scroll px-2 py-2 sm:px-3 sm:py-2">
        {listError ? (
          <EmptyState
            icon="refresh"
            title="Could not load people"
            description={listError}
            action={
              <button type="button" onClick={loadList} className={buttonPrimary}>
                Try again
              </button>
            }
          />
        ) : loading && list.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">Loading people…</p>
        ) : list.length === 0 ? (
          <EmptyState
            icon="users"
            title="No people found"
            description="Try a different name or clear the filters."
            action={
              filtersActive ? (
                <button type="button" onClick={resetFilters} className={buttonSecondary}>
                  Clear filters
                </button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="hidden md:block h-full min-h-0 border border-[#1F2937] bg-[#111827] overflow-auto custom-scroll">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="sticky top-0 z-10 border-b border-[#1F2937] bg-[#111827] text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold bg-[#111827]">Person</th>
                    <th className="px-3 py-2.5 font-semibold bg-[#111827]">Department</th>
                    <th className="px-3 py-2.5 font-semibold bg-[#111827]">Designation</th>
                    <th className="px-3 py-2.5 font-semibold bg-[#111827]">Extension</th>
                    <th className="px-3 py-2.5 font-semibold bg-[#111827]">Location</th>
                    <th className="w-8 px-2 py-2.5 bg-[#111827]" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2937]">
                  {list.map((person) => (
                    <tr
                      key={person.id}
                      onClick={() => navigate(requesterPath(person.id))}
                      className="cursor-pointer bg-[#0B0F19]/30 transition hover:bg-indigo-500/5"
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={person.name} />
                          <span className="font-semibold text-white">{person.name || 'Unnamed person'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">{person.department || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-400">{person.designation || '—'}</td>
                      <td className="px-3 py-2.5">
                        {person.extension ? (
                          <span className="inline-flex items-center rounded-md bg-[#1F2937] px-2 py-0.5 font-mono text-xs text-slate-300">
                            {person.extension}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">
                        {[person.building, person.room_location].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-2 py-2.5 text-slate-500">
                        <Icon name="chevronRight" size={16} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-1.5 md:hidden">
              {list.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => navigate(requesterPath(person.id))}
                    className="flex w-full items-start gap-3 border border-[#1F2937] bg-[#111827] px-3 py-2.5 text-left transition hover:border-indigo-500/40"
                  >
                    <Avatar name={person.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-white">{person.name || 'Unnamed person'}</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {[person.department, person.designation].filter(Boolean).join(' · ') || 'No department'}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {[person.building, person.room_location].filter(Boolean).join(' · ') || 'No location'}
                        {person.extension ? ` · Ext. ${person.extension}` : ''}
                      </span>
                    </span>
                    <span className="mt-1 text-slate-500">
                      <Icon name="chevronRight" size={16} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {!listError && (
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#1F2937] px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Showing <span className="text-slate-300">{rangeStart}–{rangeEnd}</span> of{' '}
              <span className="text-slate-300">{total.toLocaleString()}</span> people
            </span>
            <select
              aria-label="Rows per page"
              value={limit}
              onChange={(e) => {
                patchListParams({ limit: Number(e.target.value), page: 1 });
              }}
              className="h-8 rounded-md border border-[#374151] bg-[#111827] px-2 text-xs text-slate-300 outline-none"
            >
              <option value={15}>15 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => patchListParams({ page: Math.max(1, page - 1) })}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#374151] text-slate-400 disabled:opacity-30"
            >
              <Icon name="chevronLeft" size={16} />
            </button>
            {pageWindow.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => patchListParams({ page: n })}
                className={`h-8 min-w-8 rounded-md px-2 text-xs font-medium ${
                  n === page ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-[#1F2937]'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              aria-label="Next page"
              disabled={page >= totalPages}
              onClick={() => patchListParams({ page: Math.min(totalPages, page + 1) })}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#374151] text-slate-400 disabled:opacity-30"
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
        </footer>
      )}

      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) resetForm();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-person-title"
            className="my-auto w-full max-w-xl overflow-hidden rounded-xl border border-[#1F2937] bg-[#111827] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#1F2937] px-5 py-4">
              <div>
                <h2 id="add-person-title" className="text-lg font-semibold text-white">
                  Add a person
                </h2>
                <p className="mt-1 text-sm text-slate-500">Add their name and workplace details.</p>
              </div>
              <button
                type="button"
                aria-label="Close form"
                disabled={saving}
                onClick={resetForm}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-[#1F2937] hover:text-white"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="p-5">
              <PersonForm
                form={form}
                setForm={setForm}
                onSubmit={savePerson}
                onCancel={resetForm}
                saving={saving}
                editing={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
