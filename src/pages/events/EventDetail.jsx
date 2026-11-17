import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { eventsApi } from '../../lib/api';
import { resolveParamId, eventEditPath } from '../../lib/ids';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';
import { isAdmin } from '../../lib/rbac';
import {
  computeEventStatus,
  eventEndDate,
  eventStartDate,
  isEventTrulyFinished,
} from '../../lib/eventStatus';
import { formatDateTime, formatTimeString } from '../../lib/datetime';

export default function EventDetail() {
  const { id: idParam } = useParams();
  const id = resolveParamId(idParam);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [event, setEvent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await eventsApi.get(id);
      if (!data?.event) throw new Error(data?.message || 'Event not found');
      setEvent(data.event);
      setHistory(data.history || []);
    } catch (e) {
      showToast('error', 'Load failed', e.message);
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const autoStatus = useMemo(() => (event ? computeEventStatus(event) : 'Upcoming'), [event, tick]);
  const approval = event?.approval_status || event?.status || 'Pending';
  const isPending = String(approval).toLowerCase() === 'pending';

  useEffect(() => {
    if (!event || !autoStatus || isPending) return;
    if (event.event_status === autoStatus || event.event_status === 'Teardown Complete') return;
    // HARD BLOCK: never auto-save "Ended" unless the event is truly finished
    // (real end_time passed, or event calendar day is over). Stops false
    // Upcoming → Ended writes for today events with no / placeholder end time.
    if (autoStatus === 'Ended' && !isEventTrulyFinished(event)) {
      return;
    }
    eventsApi
      .update(id, { event_status: autoStatus, action_note: `Auto status → ${autoStatus}` })
      .then(() => setEvent((e) => (e ? { ...e, event_status: autoStatus } : e)))
      .catch(() => {});
  }, [autoStatus, id, event, isPending]);

  const start = event ? eventStartDate(event) : null;
  const end = event ? eventEndDate(event) : null;

  const supportCrew = useMemo(() => {
    if (!event) return [];
    if (Array.isArray(event.additional_crew) && event.additional_crew.length) return event.additional_crew;
    if (event.backup_it) return [event.backup_it];
    return [];
  }, [event]);

  const equipment = useMemo(() => {
    if (!event) return [];
    if (Array.isArray(event.av_manifest) && event.av_manifest.length) {
      return event.av_manifest.map((x) => x.label || x).filter(Boolean);
    }
    if (event.equipment) return String(event.equipment).split(',').map((s) => s.trim()).filter(Boolean);
    return [];
  }, [event]);

  async function confirmApprove() {
    setApproveOpen(false);
    setSaving(true);
    try {
      await eventsApi.approve(id);
      showToast('success', 'Event approved', 'Primary and backup engineers notified by email.');
      await load();
    } catch (e) {
      showToast('error', 'Approval failed', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-slate-400">Event not found</p>
        <button
          type="button"
          onClick={() => navigate('/events')}
          className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-xs font-bold"
        >
          ← Event Manager
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* System-standard top bar — meta strip (title lives in Deployment profile) */}
      <header className="h-20 flex items-center justify-between px-8 bg-[#111827] border-b border-[#1F2937] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/events')}
            className="w-9 h-9 rounded-lg bg-[#1F2937] border border-[#374151] text-gray-400 hover:text-white shrink-0 flex items-center justify-center"
            title="Back to Event Manager"
          >
            ←
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Event</span>
              <span className="text-sm font-mono font-bold text-indigo-400">EV-{event.id}</span>
              {isPending ? (
                <span className="text-[9px] font-bold uppercase px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/40 whitespace-nowrap">
                  Pending approval
                </span>
              ) : (
                <span className="text-[9px] font-bold uppercase px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 whitespace-nowrap">
                  {autoStatus}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 font-medium mt-0.5 truncate">
              {start ? formatDateTime(start) : event.event_date || '—'}
              {event.venue ? ` · ${event.venue}` : ''}
              {event.department ? ` · ${event.department}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin(user) && isPending && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setApproveOpen(true)}
              className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50"
            >
              Review & approve…
            </button>
          )}
          {isAdmin(user) && (
            <Link
              to={eventEditPath(id)}
              className="h-9 px-4 rounded-lg border border-indigo-500/40 text-indigo-300 text-xs font-bold hover:bg-indigo-500/10 flex items-center"
            >
              Edit
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto custom-scroll px-6 py-4">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 content-start">
          {/* Left — Event details */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-3">
            <Card title="Deployment profile">
              <div className="mb-3 pb-3 border-b border-[#1F2937]">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 leading-none">
                  Event title
                </p>
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight mt-1 leading-snug">
                  {event.name || 'Untitled event'}
                </h3>
                {event.notes ? (
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                    {event.notes}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                <Cell label="Organizer" value={event.onsite_coordinator || event.organizer} />
                <Cell label="Department" value={event.department} />
                <Cell label="Venue" value={event.venue} />
                <Cell label="Date" value={event.event_date} />
                <Cell label="Start" value={formatTimeString(event.start_time)} />
                <Cell label="End" value={event.end_time ? formatTimeString(event.end_time) : '—'} />
              </div>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card title="Primary IT lead">
                <p className="text-sm font-bold text-emerald-400">
                  {event.assigned_engineer || event.primary_it || '—'}
                </p>
              </Card>
              <Card title="Backup / support">
                {supportCrew.length ? (
                  <ul className="space-y-1">
                    {supportCrew.map((n) => (
                      <li key={n} className="text-xs text-slate-300 font-semibold">
                        {n}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic">None assigned</p>
                )}
              </Card>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card title="Approval">
                <p className="text-sm font-bold text-white">{approval}</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isPending
                    ? 'Engineers are notified only after admin approval.'
                    : 'Assignment changes after approval also trigger email notices.'}
                </p>
              </Card>
              {end && (
                <Card title="Window">
                  <p className="text-xs text-slate-400">Ends {formatDateTime(end)}</p>
                </Card>
              )}
            </div>

            {equipment.length > 0 && (
              <Card title="Equipment setup">
                <div className="flex flex-wrap gap-1.5">
                  {equipment.map((item) => (
                    <span
                      key={item}
                      className="inline-flex px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-[11px] text-indigo-200 font-semibold"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {(event.meeting_link || event.meeting_account) && (
              <Card title="Online meeting">
                {event.meeting_link && (
                  <a
                    href={event.meeting_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-indigo-300 hover:text-indigo-200 font-mono break-all"
                  >
                    {event.meeting_link}
                  </a>
                )}
                {event.meeting_account && (
                  <p className="text-xs text-slate-400 mt-2">Account: {event.meeting_account}</p>
                )}
              </Card>
            )}

            {event.notes && (
              <Card title="Notes">
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{event.notes}</p>
              </Card>
            )}
          </div>

          {/* Right — Activity ledger */}
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="bg-[#111827] border border-[#1F2937] rounded-lg overflow-hidden flex flex-col min-h-[280px] lg:min-h-[420px] lg:sticky lg:top-0">
              <div className="px-3 py-2.5 border-b border-[#1F2937] bg-[#0B0F19]/60 flex items-center justify-between shrink-0">
                <h4 className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Activity ledger</h4>
                <span className="text-[10px] text-slate-600 font-mono">{history.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scroll p-2.5 space-y-1.5">
                {!history.length ? (
                  <p className="text-xs text-slate-500 italic px-1 py-6 text-center">No history yet</p>
                ) : (
                  history.map((h, i) => (
                    <div
                      key={h.id || i}
                      className="text-xs border border-[#1F2937] rounded-lg px-3 py-2.5 bg-[#0B0F19]/40"
                    >
                      <div className="flex justify-between gap-2 items-baseline">
                        <span className="font-bold text-white truncate">{h.engineer_name || 'System'}</span>
                        <span className="text-slate-500 font-mono text-[10px] shrink-0">
                          {formatDateTime(h.changed_at)}
                        </span>
                      </div>
                      {h.new_status && (
                        <p className="text-[10px] font-semibold text-indigo-300/90 mt-1">{h.new_status}</p>
                      )}
                      <p className="text-slate-300 mt-0.5 leading-snug whitespace-pre-line">{h.action_note || '—'}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {approveOpen && event && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[#0B0F19]/85 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-[#162032] to-[#0f1624] shadow-[0_40px_100px_rgba(0,0,0,0.75)] overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-[#1F2937]/80 bg-gradient-to-r from-emerald-600/10 via-transparent to-teal-600/10">
              <div className="flex items-center justify-center mb-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-emerald-900/50 ring-4 ring-emerald-500/20">
                  ✓
                </div>
              </div>
              <h3 className="text-center text-lg font-black text-white tracking-tight">Confirm event approval</h3>
              <p className="text-center text-[11px] text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
                Please review the full deployment profile below. Email notifications are sent to the listed engineers only after you approve.
              </p>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-[55vh] overflow-y-auto custom-scroll">
              <div className="rounded-xl border border-[#1F2937] bg-[#0B0F19]/60 overflow-hidden text-xs">
                {[
                  ['Event', event.name || '—'],
                  ['Date', event.event_date || '—'],
                  ['Start', event.start_time ? formatTimeString(event.start_time) : '—'],
                  ['End', event.end_time ? formatTimeString(event.end_time) : '—'],
                  ['Venue', event.venue || '—'],
                  ['Department', event.department || '—'],
                ].map(([k, v], i) => (
                  <div
                    key={k}
                    className={`flex justify-between gap-3 px-3.5 py-2.5 ${i ? 'border-t border-[#1F2937]/80' : ''}`}
                  >
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] shrink-0">{k}</span>
                    <span className="text-slate-100 font-semibold text-right">{v}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-3.5 py-3 text-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-2">IT deployment crew</p>
                <div className="space-y-2">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">Primary / Lead</span>
                    <span className="text-white font-bold text-right">
                      {event.assigned_engineer || event.primary_it || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">Backup / Support</span>
                    <span className="text-slate-100 font-semibold text-right">
                      {(Array.isArray(event.additional_crew) && event.additional_crew.length
                        ? event.additional_crew
                        : event.backup_it
                          ? [event.backup_it]
                          : []
                      ).filter(Boolean).join(', ') || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {(() => {
                let equip = [];
                if (Array.isArray(event.av_manifest)) {
                  equip = event.av_manifest
                    .map((x) => (typeof x === 'string' ? x : x?.label || x?.name || ''))
                    .map((s) => String(s || '').trim())
                    .filter(Boolean);
                } else if (event.equipment) {
                  equip = String(event.equipment)
                    .split(/[,;\n]+/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                }
                if (!equip.length) return null;
                return (
                  <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 px-3.5 py-3 text-xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-teal-300 mb-2">
                      Equipment &amp; resources ({equip.length})
                    </p>
                    <ul className="space-y-1 text-slate-200 font-semibold">
                      {equip.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="text-teal-400 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              {event.meeting_link ? (
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3.5 py-3 text-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-300 mb-1">Online meeting</p>
                  <p className="text-slate-200 font-semibold break-all">{event.meeting_link}</p>
                </div>
              ) : null}

              <p className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 leading-relaxed">
                Approving will immediately email the primary lead and each backup/support engineer listed above with their assignment details.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-2.5">
              <button
                type="button"
                onClick={() => setApproveOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#1f2937] border border-[#374151] text-gray-300 hover:bg-[#374151]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={confirmApprove}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 shadow-lg shadow-emerald-900/30"
              >
                {saving ? 'Approving…' : 'Approve & notify'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-lg px-3 py-2.5">
      <h4 className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">{title}</h4>
      {children}
    </div>
  );
}

function Cell({ label, value }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 leading-none">{label}</p>
      <p className="text-xs font-semibold text-slate-200 mt-0.5 break-words leading-snug">{value || '—'}</p>
    </div>
  );
}
