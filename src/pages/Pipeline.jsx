import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ticketsApi } from '../lib/api';
import { ticketPath } from '../lib/ids';

function bucketTicket(t) {
  const st = String(t.status || '').toLowerCase().trim();
  const ar = String(t.action_required || '').toLowerCase().trim();
  const us = String(t.user_status || '').toLowerCase().trim();

  // Ready for return / handover / pickup — highest priority (before lab/hw)
  const readyHit =
    ar === 'ready for return' ||
    st === 'ready for return' ||
    st === 'ready for pickup' ||
    st === 'ready to handover' ||
    st === 'ready for handover' ||
    st.includes('ready to return') ||
    st.includes('ready to handover') ||
    st.includes('ready for handover') ||
    st.includes('ready for return') ||
    ar.includes('ready to handover') ||
    ar.includes('ready for handover') ||
    ar.includes('ready for return') ||
    us === 'ready to handover' ||
    us === 'ready for return';
  if (readyHit) return 'ready';

  // Hardware lab / parts (not support workstation)
  if (
    ar === 'waiting for parts' ||
    ar === 'vendor repair' ||
    ar === 'in hardware lab' ||
    st === 'in hardware lab' ||
    st === 'waiting for parts' ||
    st === 'sent to hardware' ||
    st === 'sent to lab 6004' ||
    (st.includes('hardware') && !st.includes('support'))
  ) {
    if (ar === 'under diagnostics' || st === 'in diagnostics') return 'lab';
    return 'hw';
  }

  // Lab 6004 intake / diagnostics / Support Workstation
  if (
    st === 'brought to helpdesk' ||
    st === 'in diagnostics' ||
    st === 'support workstation' ||
    ar === 'under diagnostics' ||
    ar === 'brought to helpdesk' ||
    ar === 'support workstation' ||
    st.includes('support workstation') ||
    (st.includes('sent to lab') && !st.includes('hardware'))
  ) {
    return 'lab';
  }

  return 'field';
}

export default function PipelinePage() {
  const [tickets, setTickets] = useState([]);

  const load = useCallback(async () => {
    try {
      const data = await ticketsApi.all();
      setTickets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, [load]);

  const cols = { field: [], lab: [], hw: [], ready: [] };

  tickets.forEach((t) => {
    const st = String(t.status || '').toLowerCase().trim();
    // Closed / cancel / user-cancel statuses must not appear on the active pipeline
    if (
      st === 'resolved' ||
      st === 'rejected' ||
      st === 'dismissed' ||
      st.includes('cancel') // Canceled, Cancelled, User Cancel, Canceled by User, etc.
    ) {
      return;
    }
    const b = bucketTicket(t);
    cols[b].push(t);
  });

  return (
    <>
      <header className="h-20 flex items-center justify-between px-8 bg-[#111827] border-b border-[#1F2937] shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Device Pipeline</h2>
          <p className="text-xs text-gray-400 font-medium mt-0.5">Track device lifecycles across all labs.</p>
        </div>
        <button
          onClick={load}
          className="w-10 h-10 bg-[#1F2937] rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition border border-[#374151]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </header>

      <main className="flex-1 overflow-hidden p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-full min-h-[600px]">
          <KanbanCol
            title="Campus Support"
            sub={`${cols.field.length} Active Tickets`}
            color="bg-blue-500"
            items={cols.field}
          />
          <KanbanCol
            title="Support Workstation"
            sub={`${cols.lab.length} Diagnostics · Support Workstation`}
            color="bg-purple-500"
            items={cols.lab}
          />
          <KanbanCol
            title="Diagnostics / Lab"
            sub={`${cols.hw.length} In hardware lab / parts`}
            color="bg-amber-500"
            items={cols.hw}
          />
          <KanbanCol
            title="Ready for Return"
            sub={`${cols.ready.length} Ready to handover`}
            color="bg-emerald-500"
            items={cols.ready}
            ready
          />
        </div>
      </main>
    </>
  );
}

function KanbanCol({ title, sub, color, items, ready }) {
  return (
    <div
      className={`kanban-col flex flex-col h-full overflow-hidden ${
        ready ? 'border-emerald-900/50 bg-emerald-900/5' : ''
      }`}
    >
      <div
        className={`p-4 border-b border-[#1F2937]/50 shrink-0 rounded-t-2xl ${
          ready ? 'bg-emerald-900/20 border-emerald-900/30' : 'bg-[#111827]/50'
        }`}
      >
        <h3 className={`font-bold flex items-center gap-2 ${ready ? 'text-emerald-400' : 'text-white'}`}>
          <div className={`w-2 h-2 rounded-full ${color}`} />
          {title}
        </h3>
        <p
          className={`text-[10px] mt-1 uppercase tracking-wider ${
            ready ? 'text-emerald-500/70' : 'text-gray-400'
          }`}
        >
          {sub}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto custom-scroll p-3 space-y-3">
        {items.map((t) => (
          <Link
            key={t.id}
            to={ticketPath(t.id, { action: 'view' })}
            className={`ticket-card p-4 block transition ${
              ready
                ? 'border border-emerald-500/50 shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_8px_24px_rgba(16,185,129,0.08)] hover:border-emerald-400/70'
                : ''
            }`}
          >
            <div className="flex justify-between items-start mb-2 gap-2">
              <span className="text-[10px] font-mono font-bold bg-[#1F2937] text-gray-300 px-2 py-0.5 rounded border border-[#374151]">
                #{t.id}
              </span>
              {(() => {
                const p = String(t.priority || 'Normal').toLowerCase();
                const priorityCls =
                  p === 'critical' || p === 'high'
                    ? 'text-rose-400'
                    : p === 'medium'
                      ? 'text-amber-400'
                      : p === 'low'
                        ? 'text-sky-400'
                        : 'text-gray-500';
                return (
                  <span className={`text-[10px] font-bold shrink-0 ${priorityCls}`}>
                    {t.priority || 'Normal'}
                  </span>
                );
              })()}
            </div>
            <p className="text-sm font-bold text-white truncate mb-1">{t.user_name || 'Unknown'}</p>
            <p className="text-[11px] text-gray-400 truncate mb-1.5">
              {[t.building, t.room_location].filter(Boolean).join(' · ') || t.department || '—'}
            </p>
            {/* Fixed-height engineer slot keeps every card the same height */}
            <div className="h-4 mb-2 min-w-0">
              {String(t.assigned_engineer || '').trim() ? (
                <p className="text-[10px] text-slate-400 truncate leading-4" title={t.assigned_engineer}>
                  <span className="text-slate-500 font-medium">Eng</span>
                  <span className="text-slate-600 mx-1">·</span>
                  <span className="text-slate-300 font-medium">{t.assigned_engineer}</span>
                </p>
              ) : (
                <p className="text-[10px] text-transparent leading-4 select-none">—</p>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500 truncate">{t.hw_type || t.issue_category || '—'}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-indigo-400/80 truncate max-w-[50%]">
                {t.action_required === 'Ready for Return' ||
                String(t.status || '').toLowerCase().includes('ready')
                  ? 'Ready for Return'
                  : t.action_required === 'Support Workstation' ||
                      String(t.status || '').toLowerCase() === 'support workstation'
                    ? 'Support Workstation'
                    : t.status || '—'}
              </span>
            </div>
          </Link>
        ))}
        {!items.length && (
          <p className="text-center text-xs text-slate-600 py-8 italic">No devices in this stage</p>
        )}
      </div>
    </div>
  );
}
