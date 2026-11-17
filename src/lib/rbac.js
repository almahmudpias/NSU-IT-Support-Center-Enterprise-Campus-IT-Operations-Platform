export const ROLES = {
  SUPER: 'Super Admin',
  ADMIN: 'Admin',
  ENGINEER: 'Engineer',
};

export function normalizeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'super admin' || r === 'superadmin' || r === 'super_admin') return ROLES.SUPER;
  if (r === 'admin') return ROLES.ADMIN;
  if (r === 'engineer' || r === 'lab' || r === 'technician' || r === 'tech') return ROLES.ENGINEER;
  return role || ROLES.ENGINEER;
}

export function isSuper(user) {
  return normalizeRole(user?.role) === ROLES.SUPER;
}
export function isAdmin(user) {
  const r = normalizeRole(user?.role);
  return r === ROLES.SUPER || r === ROLES.ADMIN;
}
export function isEngineerOnly(user) {
  return normalizeRole(user?.role) === ROLES.ENGINEER;
}

export function homePathFor() {
  return '/dashboard';
}

export function canAccess(user, path) {
  if (!user) return false;
  if (isSuper(user)) return true;
  if (isEngineerOnly(user)) {
    if (path === '/dashboard') return true;
    if (path.startsWith('/my-work')) return true;
    if (path.startsWith('/my-reports')) return true;
    if (path.startsWith('/campus-pool')) return true;
    if (path.startsWith('/submit-ticket')) return true;
    if (path.startsWith('/support-workstation') || path.startsWith('/6004')) return true;
    if (path.startsWith('/events')) return true;
    if (path.startsWith('/tickets/')) return true;
    if (path.startsWith('/completed')) return true;
    return false;
  }
  if (path.startsWith('/settings') || path.startsWith('/roles')) return isSuper(user);
  if (
    path.startsWith('/reports') ||
    path.startsWith('/users') ||
    path.startsWith('/requesters')
  ) {
    return isAdmin(user);
  }
  return true;
}

export function sidebarGroups(user, workspace = 'all') {
  const eng = isEngineerOnly(user);
  const superU = isSuper(user);
  const adminU = isAdmin(user);

  if (eng) {
    // Primary: Dashboard → Campus Support → Workstation → Events
    // Secondary: My Work (+ My Reports, Completed)
    return [
      {
        title: 'Primary',
        items: [
          { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
          { to: '/campus-pool', label: 'Campus Support', icon: 'queue' },
          { to: '/support-workstation', label: 'Workstation', icon: 'lab' },
          { to: '/events', label: 'Events', icon: 'events' },
        ],
      },
      {
        title: 'My Work',
        items: [
          { to: '/my-work', label: 'My Work', icon: 'list' },
          { to: '/my-reports', label: 'My Reports', icon: 'list' },
          { to: '/completed', label: 'Completed Work', icon: 'list' },
        ],
      },
    ];
  }

  const groups = [
    {
      title: 'Overview',
      items: [{ to: '/dashboard', label: 'Dashboard', icon: 'dashboard' }],
    },
  ];

  if (workspace === 'all' || workspace === '1400') {
    groups.push({
      title: workspace === '1400' ? 'Campus Support' : 'Workspaces · Campus Support',
      items: [
        { to: '/campus-support', label: 'Incident Stream', icon: 'stream' },
        { to: '/campus-support/pipeline', label: 'Device Pipeline', icon: 'pipeline' },
        { to: '/events', label: 'Event Manager', icon: 'events' },
      ],
    });
  } else {
    groups[0].items.push({ to: '/events', label: 'Event Manager', icon: 'events' });
  }
  if (workspace === 'all' || workspace === '6004') {
    groups.push({
      title: workspace === '6004' ? 'Support Workstation' : 'Workspaces · Support Workstation',
      items: [
        { to: '/support-workstation', label: 'Support Workstation', icon: 'lab' },
        { to: '/support-workstation/my-work', label: 'My Lab Work', icon: 'list' },
      ],
    });
  }

  if (adminU) {
    groups.push({
      title: 'Management',
      items: [
        { to: '/requesters', label: 'People', icon: 'users' },
        { to: '/users', label: 'Staff Accounts', icon: 'users' },
        { to: '/reports', label: 'Reports', icon: 'list' },
        { to: '/reports/monthly', label: 'Monthly Reports', icon: 'list' },
      ],
    });
  }
  if (superU) {
    groups.push({
      title: 'System',
      items: [{ to: '/settings', label: 'Settings', icon: 'settings' }],
    });
  }
  return groups;
}
