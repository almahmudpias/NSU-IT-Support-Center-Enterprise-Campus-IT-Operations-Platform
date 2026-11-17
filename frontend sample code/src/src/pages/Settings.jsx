import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { normalizeRole, isSuper } from '../lib/rbac';
import { settingsApi } from '../lib/api';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const TABS = [
  { id: 'buildings', label: 'Buildings', kind: 'buildings', nameField: 'name', hint: 'Campus buildings used on tickets and requesters' },
  { id: 'categories', label: 'Issue Categories', kind: 'issue-categories', nameField: 'name', hint: 'Problem types when logging incidents' },
  { id: 'priorities', label: 'Priority Tiers', kind: 'priority-tiers', nameField: 'name', hint: 'Severity levels for tickets' },
  {
    id: 'statuses',
    label: 'Ticket Statuses',
    kind: 'ticket-statuses',
    nameField: 'name',
    hint: 'Workflow states — use Move up/down to set sequence (what comes after what)',
  },
  {
    id: 'devices',
    label: 'Device Types',
    kind: 'device-types',
    nameField: 'name',
    hint: 'Hardware device types used on Device / Hardware Intake',
  },
  { id: 'roles', label: 'Staff Roles', kind: 'roles', nameField: 'display_name', hint: 'Roles assignable to staff accounts' },
];

const FALLBACK = {
  buildings: [
    { id: 1, name: 'NAC', is_active: true, sort_order: 10 },
    { id: 2, name: 'SAC', is_active: true, sort_order: 20 },
    { id: 3, name: 'Library', is_active: true, sort_order: 30 },
    { id: 4, name: 'Admin', is_active: true, sort_order: 40 },
  ],
  'issue-categories': [
    { id: 1, name: 'Hardware', is_active: true, sort_order: 10 },
    { id: 2, name: 'Software', is_active: true, sort_order: 20 },
    { id: 3, name: 'Network', is_active: true, sort_order: 30 },
    { id: 4, name: 'Access Control', is_active: true, sort_order: 40 },
    { id: 5, name: 'Assistant Needed', is_active: true, sort_order: 50 },
    { id: 6, name: 'Printer and Scanner', is_active: true, sort_order: 60 },
  ],
  'priority-tiers': [
    { id: 1, name: 'Critical', level: 100, color: '#f43f5e', is_active: true, sort_order: 10 },
    { id: 2, name: 'High', level: 80, color: '#fb7185', is_active: true, sort_order: 20 },
    { id: 3, name: 'Medium', level: 50, color: '#fbbf24', is_active: true, sort_order: 30 },
    { id: 4, name: 'Low', level: 20, color: '#94a3b8', is_active: true, sort_order: 40 },
  ],
  roles: [
    { id: 1, code: 'super_admin', display_name: 'Super Admin', is_system: true, is_active: true, sort_order: 10 },
    { id: 2, code: 'admin', display_name: 'Admin', is_system: true, is_active: true, sort_order: 20 },
    { id: 3, code: 'engineer', display_name: 'Engineer', is_system: true, is_active: true, sort_order: 30 },
  ],
  'ticket-statuses': [
    { id: 1, name: 'Open', sort_order: 10, is_active: true, is_system: true, is_terminal: false, color: '#60a5fa', requires_comment: false },
    { id: 2, name: 'In Progress', sort_order: 20, is_active: true, is_system: true, is_terminal: false, color: '#fbbf24', requires_comment: false },
    { id: 3, name: 'Waiting for Device', sort_order: 30, is_active: true, is_system: false, is_terminal: false, color: '#fb923c', requires_comment: false },
    { id: 4, name: 'Brought to Helpdesk', sort_order: 40, is_active: true, is_system: false, is_terminal: false, color: '#e879f9', requires_comment: false },
    { id: 5, name: 'Send to Hardware', sort_order: 50, is_active: true, is_system: false, is_terminal: false, color: '#a78bfa', requires_comment: false },
    { id: 6, name: 'Send to Support Workstation', sort_order: 55, is_active: true, is_system: false, is_terminal: false, color: '#8b5cf6', requires_comment: false },
    { id: 7, name: 'Support Workstation', sort_order: 58, is_active: true, is_system: false, is_terminal: false, color: '#7c3aed', requires_comment: false },
    { id: 8, name: 'In Diagnostics', sort_order: 60, is_active: true, is_system: false, is_terminal: false, color: '#818cf8', requires_comment: false },
    { id: 9, name: 'Waiting for Parts', sort_order: 70, is_active: true, is_system: false, is_terminal: false, color: '#fb923c', requires_comment: false },
    { id: 10, name: 'In Hardware Lab', sort_order: 80, is_active: true, is_system: false, is_terminal: false, color: '#c084fc', requires_comment: false },
    { id: 11, name: 'Ready for Return', sort_order: 85, is_active: true, is_system: false, is_terminal: false, color: '#34d399', requires_comment: false },
    { id: 12, name: 'Ready to Handover', sort_order: 88, is_active: true, is_system: false, is_terminal: false, color: '#10b981', requires_comment: false },
    { id: 13, name: 'User Not Found', sort_order: 92, is_active: true, is_system: false, is_terminal: false, color: '#f59e0b', requires_comment: true },
    { id: 14, name: 'Resolved', sort_order: 100, is_active: true, is_system: true, is_terminal: true, color: '#34d399', requires_comment: false },
    { id: 15, name: 'Canceled', sort_order: 110, is_active: true, is_system: true, is_terminal: true, color: '#94a3b8', requires_comment: false },
  ],
  'device-types': [
    { id: 1, name: 'PC', is_active: true, sort_order: 10 },
    { id: 2, name: 'Monitor', is_active: true, sort_order: 20 },
    { id: 3, name: 'Printer', is_active: true, sort_order: 30 },
    { id: 4, name: 'Scanner', is_active: true, sort_order: 40 },
    { id: 5, name: 'Smart Board', is_active: true, sort_order: 50 },
  ],
};

function labelOf(row, nameField) {
  return row?.[nameField] || row?.name || row?.display_name || '—';
}

export default function SettingsPage() {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState('buildings');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newLevel, setNewLevel] = useState(50);
  const [newColor, setNewColor] = useState('#94a3b8');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editLevel, setEditLevel] = useState(50);
  const [editColor, setEditColor] = useState('#94a3b8');
  const [editDesc, setEditDesc] = useState('');
  const [editRequiresComment, setEditRequiresComment] = useState(false);

  const current = TABS.find((t) => t.id === tab) || TABS[0];
  const canManage = isSuper(user);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await settingsApi.list(current.kind);
      const data = res?.data || [];
      setRows(data.length ? data : FALLBACK[current.kind] || []);
    } catch {
      setRows(FALLBACK[current.kind] || []);
    } finally {
      setLoading(false);
    }
  }, [current.kind]);

  useEffect(() => {
    load();
    setNewName('');
    setNewDesc('');
    setEditId(null);
  }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const body =
        current.kind === 'roles'
          ? { display_name: name, description: newDesc.trim() || null }
          : current.kind === 'priority-tiers'
            ? { name, level: Number(newLevel) || 50, color: newColor || '#94a3b8' }
            : current.kind === 'ticket-statuses'
              ? {
                  name,
                  color: newColor || '#94a3b8',
                  sort_order: (rows.length + 1) * 10,
                  is_terminal: false,
                  is_system: false,
                }
              : { name };
      await settingsApi.create(current.kind, body);
      showToast('success', 'Added', `${name} created`);
      setNewName('');
      setNewDesc('');
      setNewLevel(50);
      setNewColor('#94a3b8');
      load();
    } catch (err) {
      showToast('error', 'Failed', err.message || 'Could not add');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row) {
    setEditId(row.id);
    setEditName(labelOf(row, current.nameField));
    setEditLevel(row.level ?? 50);
    setEditColor(row.color || '#94a3b8');
    setEditDesc(row.description || '');
    setEditRequiresComment(Boolean(row.requires_comment));
  }

  async function saveEdit(row) {
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const body =
        current.kind === 'roles'
          ? { display_name: name, description: editDesc.trim() || null }
          : current.kind === 'priority-tiers'
            ? { name, level: Number(editLevel) || 50, color: editColor || '#94a3b8' }
            : current.kind === 'ticket-statuses'
              ? { name, color: editColor || '#94a3b8', requires_comment: Boolean(editRequiresComment) }
              : { name };
      await settingsApi.update(current.kind, row.id, body);
      showToast('success', 'Updated', name);
      setEditId(null);
      load();
    } catch (err) {
      showToast('error', 'Failed', err.message || 'Could not update');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row) {
    if (row.is_system && row.is_active) {
      showToast('error', 'Protected', 'System roles cannot be deactivated');
      return;
    }
    setSaving(true);
    try {
      await settingsApi.update(current.kind, row.id, { is_active: !row.is_active });
      showToast('success', 'Updated', `${labelOf(row, current.nameField)} ${row.is_active ? 'disabled' : 'enabled'}`);
      load();
    } catch (err) {
      showToast('error', 'Failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(row) {
    if (row.is_system) {
      showToast('error', 'Protected', 'System items cannot be deleted');
      return;
    }
    setDeleteTarget(row);
  }

  async function confirmDelete() {
    const row = deleteTarget;
    if (!row) return;
    setDeleteTarget(null);
    setSaving(true);
    try {
      await settingsApi.remove(current.kind, row.id);
      showToast('success', 'Deleted', labelOf(row, current.nameField));
      load();
    } catch (err) {
      showToast('error', 'Failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  /** Reorder status (or any catalog) — swap sort_order with neighbor */
  async function moveRow(row, direction) {
    const sorted = [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = sorted.findIndex((r) => r.id === row.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    const orderA = a.sort_order ?? (idx + 1) * 10;
    const orderB = b.sort_order ?? (swapIdx + 1) * 10;
    setSaving(true);
    try {
      await Promise.all([
        settingsApi.update(current.kind, a.id, { sort_order: orderB }),
        settingsApi.update(current.kind, b.id, { sort_order: orderA }),
      ]);
      showToast('success', 'Order updated', `${labelOf(a, current.nameField)} moved ${direction}`);
      load();
    } catch (err) {
      showToast('error', 'Failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="h-16 sm:h-20 flex items-center px-6 sm:px-8 bg-[#111827] border-b border-[#1F2937] shrink-0">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">System Settings</h2>
          <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
            Super Admin only · Role: {normalizeRole(user?.role)}
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scroll p-4 sm:p-6 space-y-4">
        {/* Catalog management */}
        <div className="bg-[#111827] border border-[#1F2937] rounded-xl overflow-hidden max-w-4xl">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1 p-2 border-b border-[#1F2937] bg-[#0B0F19]/50">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={
                  tab === t.id
                    ? 'px-3.5 py-2 rounded-lg text-[11px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/25'
                    : 'px-3.5 py-2 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-gray-200 hover:bg-[#1F2937]/60 border border-transparent'
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">{current.label}</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">{current.hint}</p>
              </div>
              <span className="text-[10px] font-mono text-slate-500">{rows.length} items</span>
            </div>

            {/* Add form */}
            {canManage && (
              <form
                onSubmit={handleAdd}
                className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-end p-3 rounded-xl bg-[#0B0F19] border border-[#1F2937]"
              >
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                    {current.kind === 'roles' ? 'Role name' : 'Name'}
                  </label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full dark-input !py-2"
                    placeholder={
                      current.kind === 'roles'
                        ? 'e.g. Lab Lead'
                        : current.kind === 'priority-tiers'
                          ? 'e.g. Urgent'
                          : 'New item…'
                    }
                    maxLength={80}
                  />
                </div>
                {(current.kind === 'priority-tiers' || current.kind === 'ticket-statuses') && (
                  <>
                    {current.kind === 'priority-tiers' && (
                      <div className="w-24">
                        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                          Level
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={200}
                          value={newLevel}
                          onChange={(e) => setNewLevel(e.target.value)}
                          className="w-full dark-input !py-2"
                        />
                      </div>
                    )}
                    <div className="w-28">
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                        Color
                      </label>
                      <input
                        type="color"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        className="h-[38px] w-full rounded-lg border border-[#374151] bg-[#0B0F19] cursor-pointer"
                      />
                    </div>
                  </>
                )}
                {current.kind === 'roles' && (
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                      Description
                    </label>
                    <input
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      className="w-full dark-input !py-2"
                      placeholder="Optional note"
                      maxLength={120}
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={saving || !newName.trim()}
                  className="h-[38px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold shrink-0"
                >
                  + Add
                </button>
              </form>
            )}

            {/* Table */}
            <div className="border border-[#1F2937] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[9px] uppercase tracking-widest text-slate-500 border-b border-[#1F2937] bg-[#0B0F19]/60">
                    <th className="px-4 py-2.5 font-bold">Name</th>
                    {current.kind === 'ticket-statuses' && (
                      <th className="px-4 py-2.5 font-bold w-20">Order</th>
                    )}
                    {current.kind === 'priority-tiers' && (
                      <th className="px-4 py-2.5 font-bold w-24">Level</th>
                    )}
                    {current.kind === 'roles' && (
                      <th className="px-4 py-2.5 font-bold">Code / type</th>
                    )}
                    <th className="px-4 py-2.5 font-bold w-24">Status</th>
                    {canManage && (
                      <th className="px-4 py-2.5 font-bold text-right w-40">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500 italic">
                        No items yet
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    rows.map((row) => {
                      const editing = editId === row.id;
                      return (
                        <tr
                          key={row.id}
                          className="border-b border-[#1F2937]/50 hover:bg-[#1F2937]/25"
                        >
                          <td className="px-4 py-3">
                            {editing ? (
                              <div className="space-y-1.5">
                                <input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full dark-input !py-1.5"
                                  maxLength={80}
                                />
                                {current.kind === 'roles' && (
                                  <input
                                    value={editDesc}
                                    onChange={(e) => setEditDesc(e.target.value)}
                                    className="w-full dark-input !py-1.5"
                                    placeholder="Description"
                                    maxLength={120}
                                  />
                                )}
                                {current.kind === 'ticket-statuses' && (
                                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-400">
                                    <input
                                      type="checkbox"
                                      checked={editRequiresComment}
                                      onChange={(e) => setEditRequiresComment(e.target.checked)}
                                      className="rounded border-[#374151] bg-[#0B0F19] text-amber-500"
                                    />
                                    Require comment when selected
                                  </label>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {(current.kind === 'priority-tiers' || current.kind === 'ticket-statuses') &&
                                  row.color && (
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ background: row.color }}
                                  />
                                )}
                                <span className="font-semibold text-white">
                                  {labelOf(row, current.nameField)}
                                </span>
                                {row.is_system && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400/80 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                                    System
                                  </span>
                                )}
                                {row.is_terminal && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                    End
                                  </span>
                                )}
                                {current.kind === 'ticket-statuses' && row.requires_comment && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                    Comment
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          {current.kind === 'ticket-statuses' && (
                            <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                              #{row.sort_order ?? '—'}
                            </td>
                          )}
                          {current.kind === 'priority-tiers' && (
                            <td className="px-4 py-3 text-slate-300 font-mono">
                              {editing ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={200}
                                    value={editLevel}
                                    onChange={(e) => setEditLevel(e.target.value)}
                                    className="w-16 dark-input !py-1.5"
                                  />
                                  <input
                                    type="color"
                                    value={editColor}
                                    onChange={(e) => setEditColor(e.target.value)}
                                    className="h-8 w-10 rounded border border-[#374151] bg-transparent cursor-pointer"
                                  />
                                </div>
                              ) : (
                                row.level ?? '—'
                              )}
                            </td>
                          )}
                          {current.kind === 'roles' && (
                            <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                              {row.code || '—'}
                            </td>
                          )}
                          <td className="px-4 py-3">
                            {row.is_active !== false ? (
                              <span className="inline-flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-slate-500 text-[11px] font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" /> Off
                              </span>
                            )}
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-right">
                              {editing ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => saveEdit(row)}
                                    className="h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditId(null)}
                                    className="h-7 px-2.5 rounded-lg border border-[#374151] text-gray-400 text-[10px] font-bold hover:bg-[#1F2937]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => startEdit(row)}
                                    className="h-7 px-2 rounded-lg text-[10px] font-bold text-slate-300 hover:bg-[#1F2937] hover:text-white"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    disabled={saving || row.is_system}
                                    onClick={() => toggleActive(row)}
                                    className="h-7 px-2 rounded-lg text-[10px] font-bold text-slate-300 hover:bg-[#1F2937] hover:text-white disabled:opacity-30"
                                  >
                                    {row.is_active !== false ? 'Disable' : 'Enable'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => moveRow(row, 'up')}
                                    className="h-8 px-2 rounded-lg border border-[#374151] text-[10px] font-bold text-slate-400 hover:text-white hover:bg-[#1F2937] disabled:opacity-40"
                                    title="Move up in sequence"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => moveRow(row, 'down')}
                                    className="h-8 px-2 rounded-lg border border-[#374151] text-[10px] font-bold text-slate-400 hover:text-white hover:bg-[#1F2937] disabled:opacity-40"
                                    title="Move down in sequence"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    disabled={saving || row.is_system}
                                    onClick={() => handleDelete(row)}
                                    className="h-7 px-2 rounded-lg text-[10px] font-bold text-rose-400/90 hover:bg-rose-500/10 disabled:opacity-30"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {current.kind === 'roles' && (
              <p className="text-[11px] text-gray-500 leading-relaxed">
                System roles (Super Admin, Admin, Engineer) drive access control and cannot be deleted. Custom roles
                can be added for labeling; permission behavior follows the closest built-in role when assigning staff.
              </p>
            )}
          </div>
        </div>
      </main>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        mode="confirm"
        title="Delete catalog item"
        message={
          deleteTarget
            ? `Delete “${labelOf(deleteTarget, current.nameField)}”? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="rose"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
