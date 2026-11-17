import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { navFor, normalizeRole } from '../lib/rbac';

function NavIcon({ name }) {
  if (name === 'stream') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    );
  }
  if (name === 'pipeline') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2h-2a2 2 0 00-2 2" />
      </svg>
    );
  }
  if (name === 'users') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  }
  if (name === 'settings') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    </svg>
  );
}

export default function AppSidebar({ stats }) {
  const location = useLocation();
  const pathname = location.pathname;
  const { user, logout } = useAuth();
  const nav = navFor(user);

  const initials =
    user?.initials ||
    (user?.fullName
      ? user.fullName
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : '—');

  const roleLabel = normalizeRole(user?.role);

  return (
    <aside className="w-[260px] bg-[#111827] border-r border-[#1F2937] flex flex-col justify-between hidden md:flex z-20 shrink-0 h-screen">
      <div className="flex flex-col h-full min-h-0">
        <div className="h-20 flex items-center px-6 border-b border-[#1F2937]/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="font-black text-white tracking-tight leading-tight text-sm">IT Support Center</h1>
              <p className="text-[10px] text-indigo-400 font-mono uppercase tracking-widest">Service Desk</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1.5 mt-2 shrink-0">
          <p className="px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 mt-2">Workspaces</p>
          {nav.map((item) => {
            const active =
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                to={item.href}
                className={
                  active
                    ? 'w-full text-left bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl flex items-center gap-3 px-4 py-3 text-sm font-semibold transition'
                    : 'w-full text-left text-gray-400 hover:bg-[#1F2937]/50 hover:text-gray-200 rounded-xl flex items-center gap-3 px-4 py-3 text-sm font-semibold transition'
                }
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {roleLabel !== 'Engineer' && (
          <div className="px-4 mt-auto mb-4 space-y-2.5 flex-1 flex flex-col justify-end">
            <p className="px-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Live Status</p>
            <StatCard label="Open Tickets" value={stats?.open ?? 0} tone="blue" />
            <StatCard label="In Lab 6004" value={stats?.lab ?? 0} tone="amber" />
            <StatCard label="Resolved" value={stats?.resolved ?? 0} tone="emerald" />
          </div>
        )}
        {roleLabel === 'Engineer' && <div className="flex-1" />}
      </div>

      <div className="p-6 border-t border-[#1F2937]/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1F2937] flex items-center justify-center text-xs font-bold text-white border border-[#374151]">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{user?.fullName || 'Loading...'}</p>
            <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block" />
              {roleLabel}
            </p>
          </div>
          <button
            onClick={() => logout()}
            title="Sign Out"
            className="w-8 h-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center transition border border-rose-500/20 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

function StatCard({ label, value, tone }) {
  const tones = {
    blue: 'bg-blue-500/10 text-blue-400',
    amber: 'bg-amber-500/10 text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
  };
  return (
    <div className="bg-[#0B0F19] border border-[#1F2937] p-3 rounded-xl flex items-center justify-between shadow-inner">
      <div>
        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">{label}</p>
        <h3 className="text-lg font-black text-white">{value}</h3>
      </div>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tones[tone] || tones.blue}`}>
        <span className="text-xs font-bold">{value}</span>
      </div>
    </div>
  );
}
