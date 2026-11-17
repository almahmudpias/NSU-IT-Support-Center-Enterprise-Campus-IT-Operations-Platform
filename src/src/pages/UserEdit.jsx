import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { staffManageApi, settingsApi } from '../lib/api';
import { resolveParamId, staffPath } from '../lib/ids';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { isSuper, ROLES, normalizeRole } from '../lib/rbac';

export default function UserEditPage() {
  const { id: idParam } = useParams();
  const id = resolveParamId(idParam);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [autoPass, setAutoPass] = useState(false);
  const [username, setUsername] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    password: '',
    role: ROLES.ENGINEER,
    email: '',
    phone: '',
  });

  const [roleOptions, setRoleOptions] = useState(
    isSuper(user) ? [ROLES.SUPER, ROLES.ADMIN, ROLES.ENGINEER] : [ROLES.ENGINEER]
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await settingsApi.list('roles', true);
        const names = (res?.data || []).map((r) => r.display_name || r.name).filter(Boolean);
        if (!names.length) return;
        if (isSuper(user)) setRoleOptions(names);
        else
          setRoleOptions(
            names.filter((n) => normalizeRole(n) === ROLES.ENGINEER || n === ROLES.ENGINEER)
          );
      } catch {
        /* keep defaults */
      }
    })();
  }, [user]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await staffManageApi.get(id);
      const u = data.user || data;
      setUsername(u.username || '');
      setForm({
        fullName: u.full_name || '',
        password: '',
        role: normalizeRole(u.role) || ROLES.ENGINEER,
        email: u.email || '',
        phone: u.phone || '',
      });
    } catch (e) {
      setError(e.message || 'Could not load staff profile');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function genPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    let p = '';
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setForm((f) => ({ ...f, password: p }));
    setAutoPass(true);
  }

  async function save(e) {
    e.preventDefault();
    if (!form.fullName.trim()) {
      showToast('warning', 'Required', 'Full name is required');
      return;
    }
    setSaving(true);
    try {
      const body = {
        fullName: form.fullName.trim(),
        role: form.role,
        email: form.email || null,
        phone: form.phone || null,
      };
      if (form.password) body.password = form.password;
      await staffManageApi.update(id, body);
      showToast('success', 'Profile updated', username || form.fullName);
      navigate(staffPath(id));
    } catch (err) {
      showToast('error', 'Save failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  const initials = (form.fullName || username || 'S')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  if (loading) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 bg-[#0B0F19]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
        <p className="text-sm text-slate-500">Loading profile…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#0B0F19]">
        <header className="h-20 flex items-center justify-between px-8 bg-[#111827] border-b border-[#1F2937] shrink-0">
          <div className="flex items-center gap-3">
            <Link
              to="/users"
              className="w-9 h-9 rounded-lg bg-[#1F2937] border border-[#374151] text-gray-400 hover:text-white flex items-center justify-center"
            >
              ←
            </Link>
            <h2 className="text-xl font-bold text-white tracking-tight">Edit staff profile</h2>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
          <p className="text-sm text-slate-400">{error}</p>
          <button
            type="button"
            onClick={load}
            className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#0B0F19]">
      {/* System-standard top bar (matches Event Manager / Incident Stream) */}
      <header className="h-20 flex items-center justify-between px-8 bg-[#111827] border-b border-[#1F2937] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(staffPath(id))}
            className="w-9 h-9 rounded-lg bg-[#1F2937] border border-[#374151] text-gray-400 hover:text-white flex items-center justify-center shrink-0"
            title="Back to profile"
          >
            ←
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-white tracking-tight truncate">
                Edit staff profile
              </h2>
              {username ? (
                <span className="text-sm font-mono font-bold text-indigo-400">@{username}</span>
              ) : null}
            </div>
            <p className="text-xs text-gray-400 font-medium mt-0.5 truncate">
              {form.fullName || 'Staff account'} · {form.role || '—'}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="h-9 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50 shadow-lg shadow-indigo-900/30 shrink-0"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto custom-scroll px-6 py-5">
        <form onSubmit={save} className="w-full max-w-5xl mx-auto space-y-4">
          {/* Identity strip */}
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3.5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-indigo-500/20 shrink-0">
              {initials || 'S'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Staff account
              </p>
              <p className="text-base font-bold text-white truncate mt-0.5">
                {form.fullName || username || 'Unnamed'}
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shrink-0">
              {form.role}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Personal information */}
            <section className="lg:col-span-7 bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                Personal information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                <Field
                  label="Full name *"
                  value={form.fullName}
                  onChange={(v) => setForm({ ...form, fullName: v })}
                  placeholder="Enter full name"
                  required
                />
                <Field
                  label="Username"
                  value={username}
                  onChange={() => {}}
                  disabled
                  helper="Cannot be changed"
                />
                <Field
                  label="Email address"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                  type="email"
                  placeholder="name@example.com"
                />
                <Field
                  label="Phone number"
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                  placeholder="Extension or mobile"
                />
              </div>
            </section>

            {/* Role + security */}
            <div className="lg:col-span-5 space-y-4">
              <section className="bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                  Role configuration
                </h4>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  Assigned role
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="dark-input w-full text-sm h-10 font-bold"
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </section>

              <section className="bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Security
                  </h4>
                  <button
                    type="button"
                    onClick={genPassword}
                    className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300"
                  >
                    Auto-gen
                  </button>
                </div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  New password
                </label>
                <input
                  type={autoPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => {
                    setForm({ ...form, password: e.target.value });
                    setAutoPass(false);
                  }}
                  placeholder="Leave blank to keep current"
                  minLength={6}
                  className="dark-input w-full text-sm h-10"
                  autoComplete="new-password"
                />
                <p className="text-[11px] text-slate-500 mt-2">
                  Leave empty to keep the current password. Minimum 6 characters if changing.
                </p>
              </section>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 pb-2">
            <Link
              to={staffPath(id)}
              className="h-9 px-4 rounded-lg border border-[#374151] text-xs font-bold text-slate-300 hover:text-white hover:bg-[#1F2937] inline-flex items-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-900/30"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required, placeholder, helper, disabled }) {
  return (
    <div className="min-w-0">
      <div className="flex justify-between items-end mb-1">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {label}
        </label>
        {helper ? <span className="text-[10px] text-slate-500 font-medium">{helper}</span> : null}
      </div>
      <input
        type={type}
        value={value}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className={`dark-input w-full text-sm h-10 ${
          disabled ? 'opacity-60 cursor-not-allowed' : ''
        }`}
      />
    </div>
  );
}
