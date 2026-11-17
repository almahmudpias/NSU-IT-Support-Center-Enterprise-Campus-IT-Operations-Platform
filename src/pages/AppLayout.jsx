import { useEffect, useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ticketsApi } from '../lib/api';
import AppSidebar from '../components/AppSidebar';

export default function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ open: 0, lab: 0, resolved: 0 });

  const loadStats = useCallback(async () => {
    try {
      const data = await ticketsApi.all();
      const list = Array.isArray(data) ? data : [];
      setStats({
        open: list.filter((t) => t.status === 'Open' || t.status === 'In Progress').length,
        lab: list.filter(
          (t) =>
            t.status === 'Brought to Helpdesk' ||
            t.status === 'Sent to Lab 6004' ||
            t.status === 'In Diagnostics'
        ).length,
        resolved: list.filter((t) => t.status === 'Resolved').length,
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (user) {
      loadStats();
      const t = setInterval(loadStats, 15000);
      return () => clearInterval(t);
    }
  }, [user, loadStats]);

  if (loading || !user) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0B0F19]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex text-sm overflow-hidden">
      <AppSidebar stats={stats} />
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative bg-[#0B0F19] min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
