import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { staffManageApi, settingsApi } from '../lib/api';
import { staffPath } from '../lib/ids';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { isSuper, ROLES, normalizeRole } from '../lib/rbac';

function Field({ label, value, onChange, type = 'text', required, placeholder, helper, disabled }) {
  return (
    <div className="min-w-0 flex flex-col">
      <div className="flex justify-between items-end mb-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {label}
          {required && <span className="text-indigo-500 ml-0.5">*</span>}
        </label>
        {helper && <span className="text-[9px] text-slate-500 font-medium">{helper}</span>}
      </div>
      <input
        type={type}
        value={value}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className={`w-full h-9 rounded-sm border px-3 text-xs font-medium outline-none transition-colors ${
          disabled
            ? 'bg-[#0B0F19]/40 border-[#1F2937] text-slate-500 cursor-not-allowed'
            : 'bg-[#0B0F19] border-[#374151] text-white hover:border-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 placeholder:text-slate-600'
        }`}
      />
    </div>
  );
}

export default function UserNewPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [autoPass, setAutoPass] = useState(false);
  const [form, setForm] = useState({
    username: '',
    password: '',
    fullName: '',
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

  function genPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    let p = '';
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setForm((f) => ({ ...f, password: p }));
    setAutoPass(true);
  }

  async function save(e) {
    e.preventDefault();
    if (!form.fullName.trim() || !form.username.trim() || !form.password) {
      showToast('warning', 'Required', 'Full name, username, and password are required');
      return;
    }
    setSaving(true);
    try {
      const data = await staffManageApi.create({
        username: form.username.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        role: form.role,
        email: form.email || undefined,
        phone: form.phone || undefined,
      });
      showToast('success', 'Staff created', form.username);
      const id = data?.user?.id || data?.id;
      navigate(id ? staffPath(id) : '/users');
    } catch (err) {
      const code = err?.data?.code || err?.code;
      const raw = String(err?.message || '');
      if (
        code === 'USERNAME_EXISTS' ||
        err?.status === 409 ||
        /username.*already|staff_users_username_key|duplicate key.*username/i.test(raw)
      ) {
        showToast(
          'error',
          'Username Already Exists',
          'This username is already registered. Please choose a different username.'
        );
      } else {
        showToast(
          'error',
          'Could not create staff',
          /duplicate|violates unique|23505/i.test(raw)
            ? 'This username is already registered. Please choose a different username.'
            : raw || 'Please try again.'
        );
      }
      // Form values preserved — do not reset form or navigate away
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0B0F19] overflow-hidden">
      
      {/* EXACT ORIGINAL TOP BAR */}
      <header className="h-16 flex items-center justify-between gap-3 px-4 sm:px-6 border-b border-[#1F2937] bg-[#111827]/90 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            to="/users"
            className="h-9 px-3 flex items-center justify-center rounded-lg border border-[#374151] bg-[#0B0F19] text-xs font-semibold text-slate-300 hover:text-white hover:border-indigo-500/40 transition shrink-0"
          >
            ← Staff Accounts
          </Link>
          <div className="min-w-0">
            <h2 className="text-base font-black text-white tracking-tight truncate">Add Staff User</h2>
            <p className="text-[11px] text-slate-500">Create a new platform operator account</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col justify-start overflow-hidden bg-[#0B0F19]">
        <form onSubmit={save} className="flex flex-col h-full w-full">
          
          {/* INNER FORM CONTAINER */}
          <div className="flex-1 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-4 min-h-0 overflow-y-auto custom-scroll">
            
            {/* Top Indicator Strip */}
            <div className="border border-[#1F2937] bg-[#111827] rounded-sm px-6 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-[#1F2937] border border-[#374151] text-lg font-bold text-white shadow-inner">
                  +
                </div>
                <div className="flex flex-col">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 leading-none mb-2">Account Setup</p>
                  <h3 className="truncate text-lg font-bold text-white leading-none">
                    New Staff Profile
                  </h3>
                </div>
              </div>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0 items-stretch">
              
              {/* Left Column: Identity & Contact */}
              <section className="lg:col-span-2 border border-[#1F2937] bg-[#111827] rounded-sm flex flex-col">
                <div className="border-b border-[#1F2937] bg-[#1F2937]/20 px-6 py-4 shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                    01 · Identity & Contact
                  </p>
                </div>
                {/* Removed justify-center so items align to top naturally */}
                <div className="p-6 flex flex-col">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-7">
                    <Field
                      label="Full name"
                      value={form.fullName}
                      onChange={(v) => setForm({ ...form, fullName: v })}
                      placeholder="e.g. A. Rahman"
                      required
                    />
                    <Field
                      label="Username"
                      value={form.username}
                      onChange={(v) => setForm({ ...form, username: v })}
                      required
                      placeholder="login id"
                      helper="Cannot be changed later"
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
                </div>
              </section>

              {/* Right Column: Role & Password */}
              <div className="lg:col-span-1 flex flex-col gap-4 min-h-0">
                
                {/* Role Config */}
                <section className="border border-[#1F2937] bg-[#111827] rounded-sm flex flex-col">
                  <div className="border-b border-[#1F2937] bg-[#1F2937]/20 px-6 py-4 shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                      02 · Role Configuration
                    </p>
                  </div>
                  <div className="p-6 flex flex-col">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Assigned Role
                    </label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="w-full h-9 rounded-sm bg-[#0B0F19] border border-[#374151] px-3 text-xs font-bold text-white outline-none focus:border-indigo-500 hover:border-slate-500 transition-colors cursor-pointer"
                    >
                      {roleOptions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </section>

                {/* Password Config */}
                <section className="border border-[#1F2937] bg-[#111827] rounded-sm flex flex-col flex-1">
                  <div className="border-b border-[#1F2937] bg-[#1F2937]/20 px-6 py-4 shrink-0 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                      03 · Security
                    </p>
                    <button
                      type="button"
                      onClick={genPassword}
                      className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"
                    >
                      Auto-Gen
                    </button>
                  </div>
                  <div className="p-6 flex flex-col">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Initial Password <span className="text-indigo-500 ml-0.5">*</span>
                    </label>
                    <input
                      type={autoPass ? 'text' : 'password'}
                      value={form.password}
                      required
                      onChange={(e) => {
                        setForm({ ...form, password: e.target.value });
                        setAutoPass(false);
                      }}
                      placeholder="Min 6 characters"
                      minLength={6}
                      className="w-full h-9 rounded-sm bg-[#0B0F19] border border-[#374151] px-3 text-xs font-medium text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 hover:border-slate-500 placeholder:text-slate-600 transition-colors"
                    />
                  </div>
                </section>
              </div>
            </div>
          </div>

          {/* FULL WIDTH BOTTOM BAR */}
          <div className="w-full border-t border-[#1F2937] bg-[#111827]/95 backdrop-blur px-4 sm:px-6 py-3 flex items-center justify-end gap-3 shrink-0">
            <Link
              to="/users"
              className="h-9 px-5 rounded-md border border-[#374151] text-xs font-bold text-slate-300 hover:text-white hover:bg-[#1F2937] inline-flex items-center transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-6 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-sm"
            >
              {saving ? 'Creating…' : 'Create staff user'}
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
}