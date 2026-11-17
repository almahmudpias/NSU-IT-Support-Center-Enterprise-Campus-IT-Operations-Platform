import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { staffManageApi } from '../lib/api';
import { resolveParamId, staffEditPath } from '../lib/ids';
import { useToast } from '../components/Toast';
import { ROLES, normalizeRole } from '../lib/rbac';

function RoleBadge({ role }) {
  const r = normalizeRole(role);
  const cls =
    r === ROLES.SUPER
      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      : r === ROLES.ADMIN
        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
        : 'bg-[#1F2937] text-slate-300 border-[#374151]';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-sm text-[9px] uppercase tracking-widest font-bold border ${cls}`}>
      {r}
    </span>
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

function InfoCell({ label, children }) {
  return (
    <div className="min-w-0 flex flex-col">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">{label}</p>
      <div className="text-sm font-medium text-slate-200 break-words">{children}</div>
    </div>
  );
}

export default function UserDetailPage() {
  const { id: idParam } = useParams();
  const id = resolveParamId(idParam);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await staffManageApi.get(id);
      setStaff(data.user || data);
    } catch (e) {
      setError(e.message || 'Could not load staff profile');
      setStaff(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive() {
    if (!staff) return;
    setToggling(true);
    try {
      await staffManageApi.update(staff.id, { is_active: !staff.is_active });
      showToast(
        'success',
        'Updated',
        `${staff.username} ${!staff.is_active ? 'activated' : 'deactivated'}`
      );
      await load();
    } catch (err) {
      showToast('error', 'Update failed', err.message);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0B0F19] overflow-hidden">
      
      {/* EXACT ORIGINAL TOP BAR */}
      <header className="h-16 flex items-center justify-between gap-3 px-4 sm:px-6 border-b border-[#1F2937] bg-[#111827]/90 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/users')}
            className="h-9 px-3 rounded-lg border border-[#374151] bg-[#0B0F19] text-xs font-semibold text-slate-300 hover:text-white hover:border-indigo-500/40 transition shrink-0"
          >
            ← Staff Accounts
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-black text-white tracking-tight truncate">
              {staff?.full_name || (loading ? 'Loading…' : 'Staff profile')}
            </h2>
            <p className="text-[11px] text-slate-500">
              {staff?.username ? `@${staff.username}` : `Staff · ID ${id}`}
            </p>
          </div>
        </div>
        {staff && (
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={staffEditPath(staff.id)}
              className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center transition-colors"
            >
              Edit profile
            </Link>
            <button
              type="button"
              disabled={toggling}
              onClick={toggleActive}
              className={`h-9 px-4 rounded-xl border text-xs font-bold disabled:opacity-50 transition-colors ${
                staff.is_active
                  ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
                  : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              {staff.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 flex flex-col justify-start overflow-hidden bg-[#0B0F19]">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
            <p className="text-sm text-slate-500">Loading staff profile…</p>
          </div>
        ) : error ? (
          <div className="mx-auto max-w-md text-center mt-20 space-y-3">
            <p className="text-slate-400 text-sm">{error}</p>
            <button
              type="button"
              onClick={load}
              className="h-9 px-4 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : staff ? (
          
          /* INNER CONTAINER */
          <div className="flex-1 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-4 min-h-0 overflow-y-auto">
            
            {/* Profile Hero Strip */}
            <section className="border border-[#1F2937] bg-[#111827] rounded-sm px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
              <div className="flex items-center gap-5">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-sm bg-[#1F2937] border border-[#374151] text-lg font-bold text-white shadow-inner">
                  {initialsOf(staff.full_name)}
                  <span
                    className={`absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-[#111827] ${
                      staff.is_active ? 'bg-emerald-400' : 'bg-slate-500'
                    }`}
                  />
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <div className="flex flex-wrap items-center gap-3 mb-1.5">
                    <h1 className="text-lg font-bold text-white tracking-tight leading-none">{staff.full_name}</h1>
                    <RoleBadge role={staff.role} />
                  </div>
                  <p className="text-[13px] text-slate-400 font-mono leading-none">@{staff.username}</p>
                </div>
              </div>

              <div className="border border-[#374151] bg-[#0B0F19] px-4 py-2 rounded-sm flex items-center justify-center shrink-0">
                {staff.is_active ? (
                  <span className="inline-flex items-center gap-2 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" /> Active Account
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600" /> Inactive
                  </span>
                )}
              </div>
            </section>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0 items-stretch">
              
              {/* Contact & access */}
              <section className="border border-[#1F2937] bg-[#111827] rounded-sm flex flex-col">
                <div className="border-b border-[#1F2937] bg-[#1F2937]/20 px-6 py-3.5 shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                    01 · Contact & Access
                  </p>
                </div>
                {/* Removed justify-center here so items align to top naturally */}
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8">
                    <InfoCell label="Email Address">{staff.email || '—'}</InfoCell>
                    <InfoCell label="Phone Number">
                      <span className="font-mono">{staff.phone || '—'}</span>
                    </InfoCell>
                    <InfoCell label="System Role">{normalizeRole(staff.role)}</InfoCell>
                    <InfoCell label="Account Status">
                      <span className={staff.is_active ? 'text-emerald-400' : 'text-slate-400'}>
                        {staff.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </InfoCell>
                  </div>
                </div>
              </section>

              {/* Activity */}
              <section className="border border-[#1F2937] bg-[#111827] rounded-sm flex flex-col">
                <div className="border-b border-[#1F2937] bg-[#1F2937]/20 px-6 py-3.5 shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                    02 · Activity & System
                  </p>
                </div>
                {/* Removed justify-center here so items align to top naturally */}
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8">
                    <InfoCell label="Last Login">
                      {staff.last_login ? new Date(staff.last_login).toLocaleString() : 'Never'}
                    </InfoCell>
                    <InfoCell label="Account Created">
                      {staff.created_at ? new Date(staff.created_at).toLocaleString() : '—'}
                    </InfoCell>
                  </div>
                </div>
              </section>

            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}