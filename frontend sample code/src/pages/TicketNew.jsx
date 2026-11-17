import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ticketsApi, usersApi, settingsApi } from '../lib/api';
import { ticketPath } from '../lib/ids';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import IssueDescriptionCombobox from '../components/IssueDescriptionCombobox';
import { useRealtimeSync } from '../lib/realtime';
import { formatDate, formatTimeWithDay, formatDateTime } from '../lib/datetime';

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

function alertText(t) {
  if (!t) return '';
  const note = String(t.final_remarks || t.finalRemarks || '').trim();
  const lines = [
    `📢 NEW TICKET ALERT (#${t.id})`,
    `Opened      • ${formatDateTime(t.created_at || new Date())}`,
    `${t.user_name || ''}${t.department ? ` (${t.department})` : ''}`,
    `Location    • ${[t.building, t.room_location].filter(Boolean).join(' ') || '—'}`,
    `Description • ${t.description || '—'}`,
  ];
  if (note) lines.push(`Note        • ${note}`);
  return lines.join('\n');
}

function normField(v) {
  const s = String(v ?? '').trim();
  return !s || s.toLowerCase() === 'null' ? '' : s;
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

export default function TicketNewPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [createdAlert, setCreatedAlert] = useState(null);
  const [lastTicket, setLastTicket] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const [copyState, setCopyState] = useState(''); // '' | 'popup' | 'recent'
  const [editing, setEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestIndex, setSuggestIndex] = useState(-1);
  const searchTimer = useRef(null);
  const suggestListRef = useRef(null);
  const suggestItemRefs = useRef([]);
  const [deptList, setDeptList] = useState([]);
  const [deptSuggestions, setDeptSuggestions] = useState([]);
  const [showDeptSuggest, setShowDeptSuggest] = useState(false);
  const [deptSuggestIndex, setDeptSuggestIndex] = useState(-1);
  const deptListRef = useRef(null);
  const deptItemRefs = useRef([]);
  /** Profile snapshot when user was picked from search — used to detect changes */
  const [baselineProfile, setBaselineProfile] = useState(null);
  const [profileConfirm, setProfileConfirm] = useState(null); // { payload, changes }
  const [buildings, setBuildings] = useState(FALLBACK_BUILDINGS);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [priorities, setPriorities] = useState(FALLBACK_PRIORITIES);

  /**
   * Always load the globally newest ticket (any admin).
   * Never toggles a visible "Loading…" state on refresh — only on first empty paint.
   */
  async function loadRecentFromDb() {
    try {
      const all = await ticketsApi.all();
      const list = Array.isArray(all) ? all : Array.isArray(all?.data) ? all.data : [];
      if (!list.length) {
        setLastTicket((prev) => prev || null);
        setRecentLoading(false);
        return;
      }
      const sorted = [...list].sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return Number(b.id) - Number(a.id);
      });
      const recent = sorted[0];
      setLastTicket((prev) => {
        if (
          prev &&
          String(prev.id) === String(recent.id) &&
          String(prev.status || '') === String(recent.status || '') &&
          String(prev.description || '') === String(recent.description || '')
        ) {
          return prev;
        }
        return recent;
      });
      const name = String(recent.user_name || '')
        .trim()
        .toLowerCase();
      if (!name) {
        setUserHistory([]);
      } else {
        const history = sorted.filter(
          (t) =>
            String(t.user_name || '')
              .trim()
              .toLowerCase() === name && String(t.id) !== String(recent.id)
        );
        setUserHistory((prev) => {
          if (
            prev.length === history.length &&
            prev.every((t, i) => String(t.id) === String(history[i]?.id))
          ) {
            return prev;
          }
          return history;
        });
      }
    } catch {
      /* keep current panel content */
    } finally {
      setRecentLoading(false);
    }
  }

  useEffect(() => {
    loadRecentFromDb();
    const iv = setInterval(() => loadRecentFromDb(), 20000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Other admins create tickets → recent panel only; never touch the form the user is filling
  useRealtimeSync(() => loadRecentFromDb(), { enabled: true, debounceMs: 2000 });

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
    finalRemarks: '',
  });

  useEffect(() => {
    const name = searchParams.get('name');
    if (!name) return;
    setForm((f) => ({
      ...f,
      userName: name,
      department: searchParams.get('department') || f.department,
      designation: searchParams.get('designation') || f.designation,
      extension: searchParams.get('extension') || f.extension,
      building: searchParams.get('building') || f.building,
      roomLocation: searchParams.get('room') || f.roomLocation,
    }));
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      try {
        const [bRes, cRes, pRes, depts] = await Promise.all([
          settingsApi.list('buildings', true),
          settingsApi.list('issue-categories', true),
          settingsApi.list('priority-tiers', true),
          usersApi.departments().catch(() => []),
        ]);
        const bNames = (bRes?.data || []).map((r) => r.name).filter(Boolean);
        const cNames = (cRes?.data || []).map((r) => r.name).filter(Boolean);
        const pNames = (pRes?.data || []).map((r) => r.name).filter(Boolean);
        if (Array.isArray(depts) && depts.length) setDeptList(depts);
        if (bNames.length) setBuildings(bNames);
        if (cNames.length) setCategories(cNames);
        if (pNames.length) {
          setPriorities(pNames);
          setForm((f) => {
            if (pNames.includes(f.priority)) return f;
            const mid =
              pNames.find((n) => /medium/i.test(n)) ||
              pNames[Math.floor(pNames.length / 2)] ||
              f.priority;
            return { ...f, priority: mid };
          });
        }
      } catch {
        /* keep fallbacks */
      }
    })();
  }, []);

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function onUserNameInput(val) {
    setField('userName', val);
    setBaselineProfile(null);
    setSuggestIndex(-1);
    clearTimeout(searchTimer.current);
    if (!val || val.length < 1) {
      setShowSuggest(false);
      setSuggestions([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const users = await usersApi.search(val);
        const rows = Array.isArray(users) ? users : [];
        const seen = new Map();
        rows.forEach((u) => {
          const name = String(u.name || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
          if (!name) return;
          const score = [u.department, u.extension, u.designation, u.building, u.room_location]
            .filter((v) => v && String(v).toLowerCase() !== 'null')
            .length;
          const prev = seen.get(name);
          if (!prev || score >= prev._score) seen.set(name, { ...u, _score: score });
        });
        const unique = [...seen.values()].map(({ _score, ...u }) => u);
        setSuggestions(unique);
        setShowSuggest(unique.length > 0);
        setSuggestIndex(unique.length ? 0 : -1);
      } catch {
        setShowSuggest(false);
      }
    }, 250);
  }

  // Keep highlighted suggestion visible while using arrow keys
  useEffect(() => {
    if (!showSuggest || suggestIndex < 0) return;
    const el = suggestItemRefs.current[suggestIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [suggestIndex, showSuggest]);

  useEffect(() => {
    if (!showDeptSuggest || deptSuggestIndex < 0) return;
    const el = deptItemRefs.current[deptSuggestIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [deptSuggestIndex, showDeptSuggest]);

  function onUserNameKeyDown(e) {
    if (!showSuggest || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggestIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggestIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (suggestIndex >= 0 && suggestions[suggestIndex]) {
        e.preventDefault();
        fillUser(suggestions[suggestIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggest(false);
    }
  }

  function fillUser(u) {
    const profile = {
      userName: normField(u.name),
      designation: normField(u.designation),
      department: normField(u.department),
      extension: normField(u.extension),
      building: normField(u.building),
      roomLocation: normField(u.room_location),
    };
    setForm((f) => ({
      ...f,
      ...profile,
    }));
    setBaselineProfile(profile);
    setShowSuggest(false);
    setSuggestIndex(-1);
  }

  function onDepartmentInput(val) {
    setField('department', val);
    const q = String(val || '').trim().toLowerCase();
    if (!q) {
      setDeptSuggestions([]);
      setShowDeptSuggest(false);
      setDeptSuggestIndex(-1);
      return;
    }
    const matches = deptList.filter((d) => String(d).toLowerCase().includes(q)).slice(0, 40);
    setDeptSuggestions(matches);
    setShowDeptSuggest(matches.length > 0);
    setDeptSuggestIndex(matches.length ? 0 : -1);
  }

  function onDepartmentKeyDown(e) {
    if (!showDeptSuggest || deptSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDeptSuggestIndex((i) => (i + 1) % deptSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDeptSuggestIndex((i) => (i <= 0 ? deptSuggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (deptSuggestIndex >= 0 && deptSuggestions[deptSuggestIndex]) {
        e.preventDefault();
        setField('department', deptSuggestions[deptSuggestIndex]);
        setShowDeptSuggest(false);
      }
    } else if (e.key === 'Escape') {
      setShowDeptSuggest(false);
    }
  }

  function detectProfileChanges(f) {
    if (!baselineProfile) return [];
    const pairs = [
      ['Department', baselineProfile.department, f.department],
      ['Designation', baselineProfile.designation, f.designation],
      ['Extension', baselineProfile.extension, f.extension],
      ['Building', baselineProfile.building, f.building],
      ['Room / location', baselineProfile.roomLocation, f.roomLocation],
    ];
    return pairs
      .filter(([, a, b]) => normField(a) !== normField(b))
      .map(([label, from, to]) => ({ label, from: normField(from) || '—', to: normField(to) || '—' }));
  }

  function resetForm() {
    setForm({
      userName: '',
      extension: '',
      department: '',
      designation: '',
      building: '',
      roomLocation: '',
      issueCategory: '',
      priority: priorities.includes('Medium') ? 'Medium' : priorities[0] || 'Medium',
      description: '',
      finalRemarks: '',
    });
    setBaselineProfile(null);
    setShowSuggest(false);
    setShowDeptSuggest(false);
  }

  async function submitTicket(e) {
    e.preventDefault();
    if (!form.userName.trim() || !form.description.trim()) {
      showToast('warning', 'Required fields', 'User name and description are required.');
      return;
    }
    const payload = {
      userName: form.userName,
      designation: form.designation,
      extension: form.extension,
      department: form.department,
      building: form.building,
      roomLocation: form.roomLocation,
      issueCategory: form.issueCategory,
      description: form.description,
      priority: form.priority,
      finalRemarks: form.finalRemarks,
      status: 'Open',
      loggedByEngineer: user?.fullName || 'System',
      updateRequesterProfile: true,
    };
    const changes = detectProfileChanges(form);
    if (changes.length > 0) {
      setProfileConfirm({ payload, changes });
      return;
    }
    await createTicketWithPayload(payload);
  }

  async function createTicketWithPayload(payload) {
    setSubmitting(true);
    try {
      const data = await ticketsApi.create(payload);
      if (!data.success) throw new Error(data.message || 'Failed');
      const ticket = {
        id: data.ticketId || data.ticket?.id,
        user_name: form.userName,
        department: form.department,
        designation: form.designation,
        extension: form.extension,
        building: form.building,
        room_location: form.roomLocation,
        description: form.description,
        issue_category: form.issueCategory,
        priority: form.priority,
        final_remarks: form.finalRemarks,
        status: 'Open',
        created_at: data.ticket?.created_at || new Date().toISOString(),
        ...(data.ticket || {}),
      };
      setCreatedAlert(ticket);
      setEditing(false);
      setEditForm(null);
      setCopyState('');
      setProfileConfirm(null);
      setBaselineProfile(null);
      showToast('success', 'Ticket Dispatched', `Ticket #${ticket.id} logged successfully.`);
      // Optimistically show this ticket as recent, then confirm from DB quietly
      setLastTicket(ticket);
      setRecentLoading(false);
      resetForm();
      loadRecentFromDb();
    } catch (err) {
      showToast('error', 'Ticket Submission Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function closeAlert() {
    setCreatedAlert(null);
    setCopyState('');
  }

  async function handleCopy(source) {
    const t = source === 'popup' ? createdAlert : lastTicket;
    if (!t) return;
    try {
      await copyText(alertText(t));
      setCopyState(source);
      setTimeout(() => setCopyState((s) => (s === source ? '' : s)), 2000);
    } catch {
      showToast('error', 'Copy failed', 'Clipboard blocked');
    }
  }

  function startEdit() {
    if (!lastTicket) return;
    setEditForm({
      user_name: lastTicket.user_name || '',
      extension: lastTicket.extension || '',
      department: lastTicket.department || '',
      designation: lastTicket.designation || '',
      building: lastTicket.building || '',
      room_location: lastTicket.room_location || '',
      issue_category: lastTicket.issue_category || '',
      priority: lastTicket.priority || 'Medium',
      description: lastTicket.description || '',
      final_remarks: lastTicket.final_remarks || '',
    });
    setEditing(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!lastTicket?.id || !editForm) return;
    if (!editForm.user_name.trim() || !editForm.description.trim()) {
      showToast('warning', 'Required', 'Name and description are required.');
      return;
    }
    setEditSaving(true);
    try {
      await ticketsApi.update(
        lastTicket.id,
        {
          user_name: editForm.user_name.trim(),
          extension: editForm.extension || null,
          department: editForm.department || null,
          designation: editForm.designation || null,
          building: editForm.building || null,
          room_location: editForm.room_location || null,
          issue_category: editForm.issue_category || null,
          priority: editForm.priority || null,
          description: editForm.description.trim(),
          final_remarks: editForm.final_remarks || null,
        },
        {
          engineerName: user?.fullName || 'System',
          actionNote: 'Corrected ticket details after create',
        }
      );
      setEditing(false);
      setEditForm(null);
      showToast('success', 'Updated', `Ticket #${lastTicket.id} corrected`);
      loadRecentFromDb();
    } catch (err) {
      showToast('error', 'Update failed', err.message);
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <>
      <header className="h-20 flex items-center justify-between gap-3 px-6 sm:px-8 border-b border-[#1F2937] bg-[#111827] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/campus-support"
            className="h-9 px-3 shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[#374151] bg-[#0B0F19] text-xs font-semibold text-slate-300 hover:text-white hover:border-indigo-500/40 transition"
          >
            <span aria-hidden>←</span>
            <span className="hidden sm:inline">Back</span>
          </Link>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white tracking-tight truncate">Log New Helpdesk Ticket</h2>
            <p className="text-xs text-gray-400 font-medium mt-0.5 truncate">
              Create and dispatch a service request
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scroll bg-[#0B0F19] p-6 flex flex-col gap-6">
        {/* Create form — full width */}
        <div className="bg-[#111827] border border-[#1F2937] shadow-xl p-6 relative overflow-visible shrink-0 z-10 w-full">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-indigo-600" />
          <h2 className="text-sm font-black uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Log New Helpdesk Ticket
          </h2>
          <form onSubmit={submitTicket} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="relative md:col-span-1 z-20">
              <label className="block text-gray-400 font-bold uppercase tracking-wider mb-1">User Full Name</label>
              <input
                type="text"
                value={form.userName}
                onChange={(e) => onUserNameInput(e.target.value)}
                onKeyDown={onUserNameKeyDown}
                onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
                required
                autoComplete="off"
                className="w-full dark-input font-bold"
                placeholder="Name, extension, or department..."
              />
              {showSuggest && suggestions.length > 0 && (
                <div
                  ref={suggestListRef}
                  className="absolute z-[100] left-0 top-full mt-1 w-[min(24rem,90vw)] bg-[#111827] border border-[#374151] shadow-2xl max-h-72 overflow-y-auto custom-scroll"
                >
                  {suggestions.map((u, i) => (
                    <div
                      key={`${u.id || u.name}-${i}`}
                      ref={(el) => {
                        suggestItemRefs.current[i] = el;
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        fillUser(u);
                      }}
                      onMouseEnter={() => setSuggestIndex(i)}
                      className={`px-4 py-2.5 cursor-pointer border-b border-[#1F2937] last:border-0 transition ${
                        i === suggestIndex ? 'bg-indigo-500/25' : 'hover:bg-[#1F2937]'
                      }`}
                    >
                      <div className="font-bold text-white text-sm truncate">{u.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {[u.designation, u.department].filter((v) => v && v !== 'null').join(' · ') ||
                          'No department'}
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
              <label className="block text-gray-400 font-bold uppercase tracking-wider mb-1">Extension</label>
              <input
                type="text"
                value={form.extension}
                onChange={(e) => setField('extension', e.target.value)}
                className="w-full dark-input"
              />
            </div>
            <div className="relative z-20">
              <label className="block text-gray-400 font-bold uppercase tracking-wider mb-1">Department</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => onDepartmentInput(e.target.value)}
                onKeyDown={onDepartmentKeyDown}
                onBlur={() => setTimeout(() => setShowDeptSuggest(false), 200)}
                autoComplete="off"
                className="w-full dark-input"
                placeholder="Type to search departments…"
              />
              {showDeptSuggest && deptSuggestions.length > 0 && (
                <div
                  ref={deptListRef}
                  className="absolute z-[100] left-0 top-full mt-1 w-full bg-[#111827] border border-[#374151] shadow-2xl max-h-56 overflow-y-auto custom-scroll"
                >
                  {deptSuggestions.map((d, i) => (
                    <div
                      key={`${d}-${i}`}
                      ref={(el) => {
                        deptItemRefs.current[i] = el;
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setField('department', d);
                        setShowDeptSuggest(false);
                      }}
                      onMouseEnter={() => setDeptSuggestIndex(i)}
                      className={`px-3 py-2 cursor-pointer border-b border-[#1F2937] last:border-0 text-xs font-semibold transition ${
                        i === deptSuggestIndex
                          ? 'bg-indigo-500/25 text-white'
                          : 'text-slate-300 hover:bg-[#1F2937]'
                      }`}
                    >
                      {d}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-gray-400 font-bold uppercase tracking-wider mb-1">Designation</label>
              <input
                type="text"
                value={form.designation}
                onChange={(e) => setField('designation', e.target.value)}
                className="w-full dark-input"
              />
            </div>
            <div>
              <label className="block text-gray-400 font-bold uppercase tracking-wider mb-1">Building</label>
              <select
                value={form.building}
                onChange={(e) => setField('building', e.target.value)}
                className="w-full dark-input font-bold"
              >
                <option value="">— Select —</option>
                {buildings.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 font-bold uppercase tracking-wider mb-1">Room / Location</label>
              <input
                type="text"
                value={form.roomLocation}
                onChange={(e) => setField('roomLocation', e.target.value)}
                className="w-full dark-input"
              />
            </div>
            <div>
              <label className="block text-gray-400 font-bold uppercase tracking-wider mb-1">Issue Category</label>
              <select
                value={form.issueCategory}
                onChange={(e) => setField('issueCategory', e.target.value)}
                className="w-full dark-input font-bold"
              >
                <option value="">— Select —</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 font-bold uppercase tracking-wider mb-1">Priority Tier</label>
              <select
                value={form.priority}
                onChange={(e) => setField('priority', e.target.value)}
                className="w-full dark-input font-bold"
              >
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <IssueDescriptionCombobox
                value={form.description}
                onChange={(v) => setField('description', v)}
                required
                placeholder="What is the problem?"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-gray-400 font-bold uppercase tracking-wider mb-1">
                Final Remarks (Requester Note)
              </label>
              <input
                type="text"
                value={form.finalRemarks}
                onChange={(e) => setField('finalRemarks', e.target.value)}
                className="w-full dark-input"
                placeholder="Initial context for the engineer..."
              />
            </div>
            <div className="md:col-span-4 flex items-end justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="bg-[#1F2937] hover:bg-[#374151] font-bold px-5 py-2.5 rounded-lg transition text-gray-300 border border-[#374151]"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-500 font-black px-6 py-2.5 rounded-lg transition shadow-[0_0_15px_rgba(79,70,229,0.3)] text-white disabled:opacity-60"
              >
                {submitting ? 'Processing...' : 'Commit Incident'}
              </button>
            </div>
          </form>
        </div>

        {/* Recent ticket — content updates in place; no loading flash on auto-refresh */}
        {lastTicket && (
          <div className="bg-[#111827] border border-[#1F2937] shadow-xl p-6 w-full relative overflow-hidden shrink-0">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-indigo-500" />
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-400" />
                  Recent ticket · #{lastTicket.id}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Latest ticket from database · updates when a new ticket is created
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy('recent')}
                  className="h-8 px-3 rounded-lg border border-indigo-500/40 text-indigo-300 text-[11px] font-bold hover:bg-indigo-500/10"
                >
                  {copyState === 'recent' ? 'Copied' : 'Copy message'}
                </button>
                {!editing ? (
                  <button
                    type="button"
                    onClick={startEdit}
                    className="h-8 px-3 rounded-lg border border-[#374151] text-slate-300 text-[11px] font-bold hover:bg-[#1F2937]"
                  >
                    Edit details
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setEditForm(null);
                    }}
                    className="h-8 px-3 rounded-lg border border-[#374151] text-slate-400 text-[11px] font-bold hover:bg-[#1F2937]"
                  >
                    Cancel edit
                  </button>
                )}
                <Link
                  to={ticketPath(lastTicket.id, { action: 'view' })}
                  className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold inline-flex items-center"
                >
                  Full details
                </Link>
              </div>
            </div>

            {editing && editForm ? (
              <form onSubmit={saveEdit} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs border-t border-[#1F2937] pt-4">
                <EditField
                  label="Requester"
                  value={editForm.user_name}
                  onChange={(v) => setEditForm({ ...editForm, user_name: v })}
                  required
                />
                <EditField
                  label="Extension"
                  value={editForm.extension}
                  onChange={(v) => setEditForm({ ...editForm, extension: v })}
                />
                <EditField
                  label="Department"
                  value={editForm.department}
                  onChange={(v) => setEditForm({ ...editForm, department: v })}
                />
                <EditField
                  label="Designation"
                  value={editForm.designation}
                  onChange={(v) => setEditForm({ ...editForm, designation: v })}
                />
                <div>
                  <label className="block text-gray-400 font-bold uppercase tracking-wider mb-1">Building</label>
                  <select
                    value={editForm.building}
                    onChange={(e) => setEditForm({ ...editForm, building: e.target.value })}
                    className="w-full dark-input font-bold"
                  >
                    <option value="">— Select —</option>
                    {buildings.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <EditField
                  label="Room"
                  value={editForm.room_location}
                  onChange={(v) => setEditForm({ ...editForm, room_location: v })}
                />
                <div>
                  <label className="block text-gray-400 font-bold uppercase tracking-wider mb-1">Category</label>
                  <select
                    value={editForm.issue_category}
                    onChange={(e) => setEditForm({ ...editForm, issue_category: e.target.value })}
                    className="w-full dark-input font-bold"
                  >
                    <option value="">— Select —</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 font-bold uppercase tracking-wider mb-1">Priority</label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                    className="w-full dark-input font-bold"
                  >
                    {priorities.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <EditField
                    label="Description"
                    value={editForm.description}
                    onChange={(v) => setEditForm({ ...editForm, description: v })}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <EditField
                    label="Remarks"
                    value={editForm.final_remarks}
                    onChange={(v) => setEditForm({ ...editForm, final_remarks: v })}
                  />
                </div>
                <div className="md:col-span-4 flex justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="h-9 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50"
                  >
                    {editSaving ? 'Saving…' : 'Save corrections'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <Detail label="Ticket ID">
                  <span className="font-mono font-bold text-indigo-400">#{lastTicket.id}</span>
                </Detail>
                <Detail label="Opened">
                  {formatDateTime(lastTicket.created_at || new Date())}
                </Detail>
                <Detail label="Status">
                  <span className="text-emerald-400 font-bold">{lastTicket.status || 'Open'}</span>
                </Detail>
                <Detail label="Requester">
                  {lastTicket.user_name || '—'}
                  {lastTicket.department ? (
                    <span className="text-slate-500"> · {lastTicket.department}</span>
                  ) : null}
                </Detail>
                <Detail label="Location">
                  {[lastTicket.building, lastTicket.room_location].filter(Boolean).join(' / ') || '—'}
                </Detail>
                <Detail label="Priority">
                  <span className="font-bold text-white">{lastTicket.priority || '—'}</span>
                </Detail>
                <Detail label="Category">{lastTicket.issue_category || '—'}</Detail>
                <Detail label="Description" className="sm:col-span-2 lg:col-span-3">
                  <span className="text-slate-200">{lastTicket.description || '—'}</span>
                </Detail>
              </div>
            )}
          </div>
        )}

        {/* Previous tickets — show 3; expand for all */}
        {lastTicket?.user_name && userHistory.length > 0 && (
          <div className="bg-[#111827] border border-[#1F2937] shadow-xl p-6 w-full shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
                  Previous tickets · {lastTicket.user_name}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Other requests from this person (excluding the recent ticket above)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-500">{userHistory.length} total</span>
                {userHistory.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setHistoryExpanded((v) => !v)}
                    className="h-8 px-3 rounded-lg border border-[#374151] text-[11px] font-bold text-slate-300 hover:bg-[#1F2937] hover:text-white"
                  >
                    {historyExpanded ? 'Show less' : `See all (${userHistory.length})`}
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto custom-scroll border border-[#1F2937]">
              <table className="w-full text-left min-w-[1100px] border-collapse">
                <thead className="bg-[#0B0F19] border-b border-[#1F2937]">
                  <tr className="text-gray-400 text-[10px] uppercase tracking-widest font-bold bg-[#111827]">
                    <th className="p-3.5 w-14 pl-6 whitespace-nowrap">ID</th>
                    <th className="p-3.5 w-24 whitespace-nowrap">Date/Time</th>
                    <th className="p-3.5 w-52">User Profile</th>
                    <th className="p-3.5 w-28">Location</th>
                    <th className="p-3.5 w-28">Category</th>
                    <th className="p-3.5 min-w-[180px]">Issue Details</th>
                    <th className="p-3.5 w-36">Engineer</th>
                    <th className="p-3.5 w-36 text-center">Status</th>
                    <th className="p-3.5 text-center w-20 pr-6 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2937]/60 text-sm font-medium text-gray-300 bg-[#111827]">
                  {(historyExpanded ? userHistory : userHistory.slice(0, 3)).map((t) => {
                    const d = t.created_at ? new Date(t.created_at) : null;
                    return (
                      <tr key={t.id} className="table-row-hover transition border-b border-[#1F2937]/50">
                        <td className="p-3.5 font-mono font-bold text-indigo-400 align-middle pl-6 whitespace-nowrap">
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
                        <td className="p-3.5 align-middle max-w-[13.5rem]">
                          <div className="font-bold text-white text-xs whitespace-normal break-words leading-snug">
                            {t.user_name || lastTicket.user_name || '-'}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono mt-0.5 whitespace-normal break-words leading-snug">
                            Ext: {t.extension || '-'} | {t.department || lastTicket.department || '-'}
                          </div>
                        </td>
                        <td className="p-3.5 align-middle text-gray-300 text-[11px] font-medium max-w-[7rem]">
                          <div className="whitespace-normal break-words leading-snug">
                            {[t.building, t.room_location].filter(Boolean).join(' / ') || '—'}
                          </div>
                        </td>
                        <td className="p-3.5 align-middle">
                          <span
                            className="inline-flex items-center justify-center w-[7.75rem] min-h-[2rem] px-2 py-1 text-[9px] font-bold uppercase tracking-wide bg-[#0B0F19] border border-[#1F2937] text-gray-400 rounded-lg text-center whitespace-normal break-words leading-tight"
                            title={t.issue_category || 'GENERAL'}
                          >
                            {t.issue_category || 'GENERAL'}
                          </span>
                        </td>
                        <td className="p-3.5 align-middle text-[11px] max-w-[200px]">
                          <div className="text-gray-200 font-medium whitespace-normal break-words leading-snug line-clamp-3">
                            {t.description || '-'}
                          </div>
                        </td>
                        <td className="p-3.5 align-middle">
                          {t.assigned_engineer ? (
                            <span
                              className="inline-flex items-center justify-center h-7 min-w-[7.5rem] max-w-[9rem] px-2.5 text-[10px] font-bold bg-[#0B0F19] truncate rounded-lg border border-emerald-500/50 text-emerald-300"
                              title={t.assigned_engineer}
                            >
                              {t.assigned_engineer}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center h-7 min-w-[7.5rem] max-w-[9rem] px-2.5 text-[10px] font-bold bg-[#0B0F19] truncate rounded-lg border border-dashed border-slate-600 text-slate-500 italic font-medium">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 align-middle text-center">
                          <HistoryStatusPill status={t.status} action={t.action_required} lab={t.lab_engineer} />
                        </td>
                        <td className="p-3.5 text-center align-middle whitespace-nowrap pr-6">
                          <Link
                            to={ticketPath(t.id, { action: 'view' })}
                            className="bg-[#111827] hover:bg-indigo-600 text-gray-400 hover:text-white px-2.5 py-1 rounded transition border border-[#374151] hover:border-indigo-500 text-[10px] font-bold"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!historyExpanded && userHistory.length > 3 && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => setHistoryExpanded(true)}
                  className="h-9 px-4 rounded-lg border border-indigo-500/40 text-indigo-300 text-[11px] font-bold hover:bg-indigo-500/10"
                >
                  See all {userHistory.length} tickets for this user
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {createdAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeAlert}
            aria-label="Close"
          />
          <div className="relative w-full max-w-md border border-indigo-500/30 bg-[#111827] shadow-2xl shadow-indigo-900/30 overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1F2937] bg-gradient-to-r from-indigo-600/20 to-transparent flex items-center justify-between">
              <h3 className="text-sm font-black text-white tracking-tight">
                📢 NEW TICKET ALERT{' '}
                <span className="text-indigo-400 font-mono">#{createdAlert.id}</span>
              </h3>
              <button
                type="button"
                onClick={closeAlert}
                className="text-slate-400 hover:text-white text-lg font-bold leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4 space-y-2 text-xs">
              <p className="text-slate-400">
                <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">Opened</span>
                <span className="mx-2 text-slate-600">•</span>
                <span className="font-mono text-slate-300">
                  {formatDateTime(createdAlert.created_at || new Date())}
                </span>
              </p>
              <p className="text-white font-bold text-sm">
                {createdAlert.user_name}
                {createdAlert.department ? (
                  <span className="text-slate-400 font-medium"> ({createdAlert.department})</span>
                ) : null}
              </p>
              <p className="text-slate-400">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Location</span>
                <span className="mx-2 text-slate-600">•</span>
                <span className="text-slate-200">
                  {[createdAlert.building, createdAlert.room_location].filter(Boolean).join(' ') || '—'}
                </span>
              </p>
              <p className="text-slate-400">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Description</span>
                <span className="mx-2 text-slate-600">•</span>
                <span className="text-slate-200">{createdAlert.description || '—'}</span>
              </p>
              {String(createdAlert.final_remarks || '').trim() ? (
                <p className="text-slate-400">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Note</span>
                  <span className="mx-2 text-slate-600">•</span>
                  <span className="text-slate-200 whitespace-pre-wrap">
                    {String(createdAlert.final_remarks).trim()}
                  </span>
                </p>
              ) : null}
            </div>
            <div className="px-5 py-3 border-t border-[#1F2937] flex gap-2 justify-end bg-[#0B0F19]/50">
              <button
                type="button"
                onClick={() => handleCopy('popup')}
                className="px-4 py-2 rounded-xl border border-indigo-500/40 text-indigo-300 text-xs font-bold hover:bg-indigo-500/10 min-w-[5.5rem]"
              >
                {copyState === 'popup' ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={closeAlert}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(profileConfirm)}
        mode="confirm"
        tone="indigo"
        title="Update requester profile?"
        message={
          profileConfirm
            ? `You changed saved details for this requester. Update the directory record so future tickets use the new values?\n\n${profileConfirm.changes
                .map((c) => `• ${c.label}: ${c.from} → ${c.to}`)
                .join('\n')}`
            : ''
        }
        confirmLabel="Yes, update profile"
        cancelLabel="No, keep previous"
        loading={submitting}
        onConfirm={() => {
          if (!profileConfirm) return;
          createTicketWithPayload({ ...profileConfirm.payload, updateRequesterProfile: true });
        }}
        onCancel={() => {
          if (!profileConfirm) return;
          if (submitting) return;
          createTicketWithPayload({ ...profileConfirm.payload, updateRequesterProfile: false });
        }}
      />
    </>
  );
}

function Detail({ label, children, className = '' }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <div className="text-slate-200 text-sm">{children}</div>
    </div>
  );
}

function EditField({ label, value, onChange, required }) {
  return (
    <div>
      <label className="block text-gray-400 font-bold uppercase tracking-wider mb-1">
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        type="text"
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full dark-input"
      />
    </div>
  );
}

/** Same status chip design as Incident Stream */
function HistoryStatusPill({ status, action, lab }) {
  let label = status || 'Open';
  let cls = 'bg-blue-900/30 text-blue-400 border border-blue-900/50';
  const lower = (status || '').toLowerCase();

  if (action === 'Ready for Return') {
    label = 'Ready for Pickup';
    cls = 'bg-emerald-950 text-emerald-400 border border-emerald-500/60 font-black animate-pulse';
  } else if (lower === 'in diagnostics') {
    label = `Diagnosing: ${lab || 'Lab Tech'}`;
    cls = 'bg-indigo-900/40 text-indigo-300 border border-indigo-500/50';
  } else if (lower === 'waiting for parts') {
    label = 'Waiting for Parts';
    cls = 'bg-orange-900/40 text-orange-300 border border-orange-500/50';
  } else if (
    lower === 'sent to lab 6004' ||
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
    if (lower === 'sent to lab 6004') label = 'Sent to Hardware Lab';
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
