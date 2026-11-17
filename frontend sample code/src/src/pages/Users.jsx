import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { staffManageApi } from '../lib/api';
import { staffPath, staffEditPath } from '../lib/ids';
import { useToast } from '../components/Toast';
import { ROLES, normalizeRole } from '../lib/rbac';

function RoleBadge({ role }) {
  const r = normalizeRole(role);
  const cls =
    r === ROLES.SUPER
      ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
      : r === ROLES.ADMIN
        ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40'
        : 'bg-slate-700/50 text-slate-300 border-slate-600';
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border ${cls}`}>{r}</span>
  );
}

export default function UsersPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [menuId, setMenuId] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await staffManageApi.list();
      setUsers(data.users || []);
    } catch (e) {
      showToast('error', 'Failed to load users', e.message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onDocClick() {
      setMenuId(null);
    }
    if (menuId != null) {
      document.addEventListener('click', onDocClick);
      return () => document.removeEventListener('click', onDocClick);
    }
  }, [menuId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) =>
      [u.full_name, u.username, u.email, u.phone, u.role].join(' ').toLowerCase().includes(s)
    );
  }, [users, q]);

  async function toggleActive(u) {
    try {
      await staffManageApi.update(u.id, { is_active: !u.is_active });
      showToast('success', 'Updated', `${u.username} ${!u.is_active ? 'activated' : 'deactivated'}`);
      setMenuId(null);
      load();
    } catch (err) {
      showToast('error', 'Update failed', err.message);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B0F19]">
      <header className="h-16 flex items-center justify-between px-6 border-b border-[#1F2937] bg-[#111827]/90 shrink-0">
        <div>
          <h2 className="text-lg font-black text-white tracking-tight">Staff Accounts</h2>
          <p className="text-[11px] text-slate-500">IT platform operators · roles & access</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/users/new')}
          className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
        >
          + Add Staff User
        </button>
      </header>

      <div className="px-6 py-4 border-b border-[#1F2937] flex items-center gap-3 shrink-0">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, phone, username…"
          className="h-9 w-full max-w-sm rounded-lg bg-[#111827] border border-[#374151] px-3 text-xs text-white outline-none focus:border-indigo-500"
        />
        <span className="text-[10px] text-slate-500 font-mono">{filtered.length} staff</span>
      </div>

      <div className="flex-1 overflow-auto custom-scroll p-4 sm:p-6">
        <div className="border border-[#1F2937] bg-[#111827]/80 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead>
              <tr className="text-[9px] uppercase tracking-widest text-slate-500 border-b border-[#1F2937] bg-[#0B0F19]/50">
                <th className="px-5 py-3 font-bold">User & contact</th>
                <th className="px-5 py-3 font-bold">Phone</th>
                <th className="px-5 py-3 font-bold">Role</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500 italic">
                    No staff found
                  </td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-[#1F2937]/50 hover:bg-[#1F2937]/30">
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => navigate(staffPath(u.id))}
                      className="text-left group"
                    >
                      <p className="font-bold text-white text-sm group-hover:text-indigo-300 transition">
                        {u.full_name}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {u.email || '—'} · @{u.username}
                      </p>
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-slate-300 font-mono text-[11px]">{u.phone || '—'}</td>
                  <td className="px-5 py-3.5">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-5 py-3.5">
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-slate-500 text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuId(menuId === u.id ? null : u.id);
                      }}
                      className="w-8 h-8 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 inline-flex items-center justify-center"
                      aria-label="Actions"
                    >
                      ⋮
                    </button>
                    {menuId === u.id && (
                      <div
                        className="absolute right-5 top-11 z-20 w-48 rounded-xl border border-[#374151] bg-[#111827] shadow-2xl py-1.5 text-left overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setMenuId(null);
                            navigate(staffPath(u.id));
                          }}
                          className="w-full px-3.5 py-2.5 text-[11px] font-semibold text-slate-200 hover:bg-indigo-500/15 hover:text-indigo-200 text-left"
                        >
                          View profile
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuId(null);
                            navigate(staffEditPath(u.id));
                          }}
                          className="w-full px-3.5 py-2.5 text-[11px] font-semibold text-slate-200 hover:bg-indigo-500/15 hover:text-indigo-200 text-left"
                        >
                          Edit profile
                        </button>
                        <div className="my-1 border-t border-[#1F2937]" />
                        <button
                          type="button"
                          onClick={() => toggleActive(u)}
                          className={`w-full px-3.5 py-2.5 text-[11px] font-semibold text-left ${
                            u.is_active
                              ? 'text-rose-400 hover:bg-rose-500/10'
                              : 'text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
