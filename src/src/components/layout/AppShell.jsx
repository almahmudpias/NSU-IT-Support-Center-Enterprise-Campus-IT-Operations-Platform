import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { RouteErrorBoundary } from '../ErrorBoundary';
import { useAuth } from '../../lib/auth';
import { useWorkspace } from '../../context/WorkspaceContext';
import { sidebarGroups, normalizeRole, isEngineerOnly } from '../../lib/rbac';

function Icon({ name, className = 'w-4 h-4' }) {
  const paths = {
    dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    stream: 'M4 6h16M4 10h16M4 14h16M4 18h16',
    pipeline: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2h-2a2 2 0 00-2 2',
    lab: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    list: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    queue: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
    users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    events: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  };
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={paths[name] || paths.dashboard} />
    </svg>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const { workspace, setWorkspace, allowedWorkspaces } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [wsOpen, setWsOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  const groups = sidebarGroups(user, workspace);
  const allNavTos = groups.flatMap((g) => g.items.filter((i) => i.to && !i.disabled).map((i) => i.to));
  function isNavActive(to) {
    const path = location.pathname;
    if (path === to) return true;
    // longest matching prefix wins (so /6004/my-work does not highlight /6004)
    let best = '';
    for (const candidate of allNavTos) {
      if (path === candidate || (candidate !== '/dashboard' && path.startsWith(candidate + '/'))) {
        if (candidate.length > best.length) best = candidate;
      }
    }
    return best === to;
  }
  const role = normalizeRole(user?.role);
  const initials =
    user?.initials ||
    (user?.fullName || '?')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const wsLabel = {
    all: 'All Workspaces',
    '1400': 'Campus Support',
    '6004': 'Support Workstation',
  }[workspace];

  function pickWorkspace(w) {
    setWorkspace(w);
    setWsOpen(false);
    if (w === '1400') navigate('/campus-support');
    else if (w === '6004') navigate('/support-workstation');
    else navigate('/dashboard');
  }

  return (
    <div className="h-screen flex text-sm overflow-hidden bg-[#0B0F19]">
      {/* Sidebar */}
      <aside
        className={`${
          mobileNav ? 'flex' : 'hidden'
        } md:flex w-[260px] bg-[#111827] border-r border-[#1F2937] flex-col shrink-0 z-30 absolute md:relative h-full print:hidden`}
      >
        {/* Brand + workspace switcher */}
        <div className="p-4 border-b border-[#1F2937]/50 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-black text-white tracking-tight">NSU IT Support Center</div>
              <div className="text-[9px] text-indigo-400 font-mono uppercase tracking-widest">Enterprise Desk</div>
            </div>
          </div>

          {!isEngineerOnly(user) && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setWsOpen(!wsOpen)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0B0F19] border border-[#1F2937] text-xs font-semibold text-gray-200 hover:border-indigo-500/40 transition"
              >
                <span className="truncate">{wsLabel}</span>
                <span className="text-gray-500">▾</span>
              </button>
              {wsOpen && (
                <div className="absolute left-0 right-0 mt-1 rounded-xl border border-[#1F2937] bg-[#111827] shadow-2xl z-50 overflow-hidden">
                  <div className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-gray-500 border-b border-[#1F2937]">
                    Workspaces
                  </div>
                  {allowedWorkspaces.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => pickWorkspace(w)}
                      className={`w-full text-left px-3 py-2.5 text-xs font-semibold transition ${
                        workspace === w
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'text-gray-300 hover:bg-[#1F2937]'
                      }`}
                    >
                      {w === 'all'
                        ? '◉ All Workspaces'
                        : w === '1400'
                          ? '○ Campus Support'
                          : '○ Support Workstation'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {isEngineerOnly(user) && (
            <div className="px-3 py-2 rounded-xl bg-[#0B0F19] border border-cyan-500/20 text-xs font-semibold text-cyan-400">
              Field &amp; Lab Operations
            </div>
          )}
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto custom-scroll p-3 space-y-4">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="px-3 mb-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-widest">{g.title}</p>
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  if (item.disabled) {
                    return (
                      <div
                        key={item.label}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-600 cursor-not-allowed"
                      >
                        <Icon name={item.icon} />
                        {item.label}
                      </div>
                    );
                  }
                  const active = isNavActive(item.to);
                  return (
                    <Link
                      key={item.to + item.label}
                      to={item.to}
                      onClick={() => setMobileNav(false)}
                      className={
                        active
                          ? 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:bg-[#1F2937]/50 hover:text-gray-200 border border-transparent'
                      }
                    >
                      <Icon name={item.icon} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-[#1F2937]/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#1F2937] border border-[#374151] flex items-center justify-center text-[10px] font-bold text-white">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.fullName}</p>
              <p className="text-[9px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {role}
              </p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              title="Sign out"
              className="w-8 h-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 flex items-center justify-center"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden h-12 flex items-center px-4 border-b border-[#1F2937] bg-[#111827] shrink-0 print:hidden">
          <button type="button" onClick={() => setMobileNav(!mobileNav)} className="text-gray-300 text-xs font-bold">
            ☰ Menu
          </button>
          <span className="ml-3 text-xs font-bold text-white">NSU IT Support Center</span>
        </div>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </div>
        <footer className="shrink-0 border-t border-[#1F2937]/80 bg-[#0B0F19] px-4 py-2 flex items-center justify-center print:hidden">
          <p className="text-[10px] tracking-wide text-slate-600">
            Developed by <span className="text-slate-500 font-medium">A. Al Mahmud Pias</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
