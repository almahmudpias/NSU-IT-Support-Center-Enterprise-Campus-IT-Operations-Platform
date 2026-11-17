import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { eventsApi } from '../lib/api';
import { resolveParamId, eventEditPath, eventPath } from '../lib/ids';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { isAdmin } from '../lib/rbac';
import {
  computeEventStatus,
  countdownLabel,
  eventEndDate,
  eventSetupDate,
  eventStartDate,
} from '../lib/eventStatus';

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function fmtTs(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function EventDetail() {
  const { id: idParam } = useParams();
  const id = resolveParamId(idParam);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [event, setEvent] = useState(null);

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate('/events');
  }
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manifest, setManifest] = useState([]);
  const [ledgerNote, setLedgerNote] = useState('');
  const [saving, setSaving] = useState(false);
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
      setManifest(
        Array.isArray(data.event?.av_manifest)
          ? data.event.av_manifest.map((item) => ({
              label: item.label || item,
              checked: !!item.checked,
              returned: !!item.returned,
              out_at: item.out_at || null,
              out_by: item.out_by || null,
              in_at: item.in_at || null,
              in_by: item.in_by || null,
            }))
          : []
      );
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

  useEffect(() => {
    if (!event || !autoStatus) return;
    if (event.event_status === autoStatus || event.event_status === 'Teardown Complete') return;
    eventsApi
      .update(id, { event_status: autoStatus, action_note: `Auto status → ${autoStatus}` })
      .then(() => setEvent((e) => (e ? { ...e, event_status: autoStatus } : e)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStatus, id]);

  const start = event ? eventStartDate(event) : null;
  const end = event ? eventEndDate(event) : null;
  const setup = event ? eventSetupDate(event) : null;
  const eventEnded = end && Date.now() > end.getTime();

  const timelinePct = useMemo(() => {
    if (!start || !end) return 0;
    const a = start.getTime();
    const b = end.getTime();
    const now = Date.now();
    if (now <= a) return 0;
    if (now >= b) return 100;
    return Math.round(((now - a) / (b - a)) * 100);
  }, [start, end, tick]);

  const supportCrew = useMemo(() => {
    if (!event) return [];
    if (Array.isArray(event.additional_crew) && event.additional_crew.length) return event.additional_crew;
    if (event.backup_it) return [event.backup_it];
    return [];
  }, [event]);

  async function saveManifest(next, note) {
    setManifest(next);
    try {
      await eventsApi.update(id, { av_manifest: next, action_note: note });
      load();
    } catch (e) {
      showToast('error', 'Save failed', e.message);
    }
  }

  function deploy(idx) {
    const who = user?.fullName || 'Engineer';
    const next = manifest.map((item, i) =>
      i === idx
        ? { ...item, checked: true, returned: false, out_at: new Date().toISOString(), out_by: who, in_at: null, in_by: null }
        : item
    );
    saveManifest(next, `${manifest[idx].label} deployed by ${who}`);
  }

  function revertDeploy(idx) {
    const who = user?.fullName || 'Engineer';
    const next = manifest.map((item, i) =>
      i === idx
        ? { ...item, checked: false, returned: false, out_at: null, out_by: null, in_at: null, in_by: null }
        : item
    );
    saveManifest(next, `${manifest[idx].label} deploy reverted by ${who}`);
  }

  function recover(idx) {
    const who = user?.fullName || 'Engineer';
    const next = manifest.map((item, i) =>
      i === idx ? { ...item, returned: true, in_at: new Date().toISOString(), in_by: who } : item
    );
    saveManifest(next, `${manifest[idx].label} recovered by ${who}`);
  }

  function revertRecover(idx) {
    const who = user?.fullName || 'Engineer';
    const next = manifest.map((item, i) =>
      i === idx ? { ...item, returned: false, in_at: null, in_by: null } : item
    );
    saveManifest(next, `${manifest[idx].label} recover reverted by ${who}`);
  }

  async function postLedger() {
    if (!ledgerNote.trim()) return;
    setSaving(true);
    try {
      await eventsApi.update(id, { action_note: ledgerNote.trim(), event_status: autoStatus });
      setLedgerNote('');
      load();
    } catch (e) {
      showToast('error', 'Failed', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#05080F]">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!event) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-[#05080F]">
        <p className="text-slate-400">Event not found</p>
        <button type="button" onClick={goBack} className="text-indigo-400 text-sm">← Back</button>
      </div>
    );
  }

  const status = autoStatus || event.event_status || 'Upcoming';
  const primary = event.assigned_engineer || event.primary_it;
  const venue = event.venue || `${event.building || ''} ${event.room || ''}`.trim() || 'Venue TBD';
  const contact = event.onsite_coordinator || event.organizer || '—';
  const nextPhase = setup && Date.now() < setup.getTime() ? setup : start && Date.now() < start.getTime() ? start : end;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#05080F] overflow-y-auto custom-scroll">
      {/* slim top nav only */}
      <div className="px-6 py-3 border-b border-slate-800/80 bg-[#05080F]/90 sticky top-0 z-20 flex items-center justify-between gap-3 backdrop-blur">
        <button type="button" onClick={goBack} className="text-[11px] font-bold text-slate-500 hover:text-white uppercase tracking-wider">
          ← Back
        </button>
        <div className="flex gap-2">
          {isAdmin(user) && (
            <Link to={eventEditPath(id)} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition hover:scale-105">
              Edit Event
            </Link>
          )}
          <button
            type="button"
            onClick={() => showToast('info', 'Alert', contact)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition hover:scale-105"
          >
            Ping Contact
          </button>
        </div>
      </div>

      {/* Module 1: Cinematic Hero */}
      <section className="px-6 pt-8 pb-6 border-b border-slate-800/50">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-amber-400/90 font-mono text-sm font-bold tracking-widest mb-2">EVT-{event.id}</p>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">{event.name}</h1>
            {event.department && (
              <p className="text-slate-400 text-sm mt-2 font-medium">{event.department}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-3 shrink-0">
            <StatusBadge status={status} large />
            {nextPhase && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Master clock</p>
                <p className="font-mono text-3xl md:text-4xl font-black text-cyan-300 tracking-tight">
                  {countdownLabel(nextPhase)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Logistics Billboard */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-4 rounded-3xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-xl overflow-hidden">
          <div className="lg:col-span-4 p-6 border-b lg:border-b-0 lg:border-r border-slate-800/80 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-2xl shadow-[0_0_24px_rgba(99,102,241,0.25)]">
              📍
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Venue</p>
              <p className="text-2xl md:text-3xl font-black text-white leading-tight">{venue}</p>
            </div>
          </div>
          <div className="lg:col-span-5 p-6 border-b lg:border-b-0 lg:border-r border-slate-800/80">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Timeline</p>
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400 mb-2">
              <span>Setup</span>
              <span className="text-cyan-400">Start</span>
              <span>Teardown</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
              <div className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 transition-all duration-1000" style={{ width: `${timelinePct}%` }} />
            </div>
            <div className="flex justify-between mt-2 font-mono text-xs text-slate-300">
              <span>{setup ? setup.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              <span className="text-cyan-300 font-bold">{start ? start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              <span>{end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
            </div>
          </div>
          <div className="lg:col-span-3 p-6 flex flex-col justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contact</p>
              <p className="text-xl font-black text-white mt-1 leading-tight">{contact}</p>
            </div>
            <button
              type="button"
              onClick={() => showToast('info', 'Alert contact', contact)}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition hover:scale-[1.02]"
            >
              Alert Contact
            </button>
          </div>
        </div>
      </section>

      {/* Module 2: Crew Gallery */}
      <section className="px-6 py-6 border-b border-slate-800/50">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">Crew roster</h2>
        <div className="flex flex-wrap gap-4">
          <CrewCard name={primary} title="Primary Lead" active />
          {supportCrew.map((n) => (
            <CrewCard key={n} name={n} title="Support" />
          ))}
          {!primary && supportCrew.length === 0 && (
            <p className="text-sm text-slate-500 italic">No crew assigned</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => showToast('info', 'Alert all crew', [primary, ...supportCrew].filter(Boolean).join(', '))}
          className="mt-4 px-4 py-2 rounded-xl border border-indigo-500/40 text-indigo-300 text-xs font-bold hover:bg-indigo-500/10"
        >
          Alert All Crew
        </button>
      </section>

      {/* Module 3: Hardware lifecycle */}
      <section className="px-6 py-6 border-b border-slate-800/50">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">Equipment manifest</h2>
        {manifest.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-500 text-sm">
            No equipment listed — presence-only support.
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-800 bg-slate-950/50">
                  <th className="px-5 py-4 font-bold">Item name</th>
                  <th className="px-5 py-4 font-bold">Phase 1: Deploy</th>
                  <th className="px-5 py-4 font-bold">Phase 2: Recover</th>
                </tr>
              </thead>
              <tbody>
                {manifest.map((item, idx) => {
                  const missing = eventEnded && item.checked && !item.returned;
                  return (
                    <tr
                      key={idx}
                      className={`border-b border-slate-800/60 ${
                        missing ? 'bg-rose-500/10 border-rose-500/40 animate-pulse' : 'hover:bg-slate-800/30'
                      }`}
                    >
                      <td className="px-5 py-5">
                        <p className="text-base font-bold text-white">{item.label}</p>
                        {missing && (
                          <p className="text-[10px] text-rose-400 font-black uppercase mt-1">Missing — not recovered</p>
                        )}
                      </td>
                      <td className="px-5 py-5">
                        {item.checked ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex flex-col px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                              Deployed
                              <span className="text-[10px] font-mono text-emerald-400/80 font-normal">
                                {fmtTs(item.out_at)} · {initials(item.out_by)}
                              </span>
                            </span>
                            <button
                              type="button"
                              title="Revert deploy"
                              onClick={() => revertDeploy(idx)}
                              className="w-8 h-8 rounded-lg border border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 text-sm"
                            >
                              ↩
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => deploy(idx)}
                            className="min-w-[120px] px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold"
                          >
                            Deploy
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-5">
                        {!item.checked ? (
                          <span className="text-slate-600 text-sm">—</span>
                        ) : item.returned ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex flex-col px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                              Recovered
                              <span className="text-[10px] font-mono text-emerald-400/80 font-normal">
                                {fmtTs(item.in_at)} · {initials(item.in_by)}
                              </span>
                            </span>
                            <button
                              type="button"
                              title="Revert recover"
                              onClick={() => revertRecover(idx)}
                              className="w-8 h-8 rounded-lg border border-slate-600 text-slate-400 hover:text-white text-sm"
                            >
                              ↩
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => recover(idx)}
                            className="min-w-[120px] px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold"
                          >
                            Recover
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Ledger */}
      <section className="px-6 py-6 pb-12">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">Live event ledger</h2>
        <div className="rounded-2xl border border-slate-800 bg-black/40 p-4 font-mono text-[12px] space-y-1 max-h-56 overflow-y-auto custom-scroll mb-3">
          {history.length === 0 && <p className="text-slate-500 italic">Awaiting activity…</p>}
          {history.map((h) => (
            <div key={h.id} className="text-slate-300">
              <span className="text-slate-500">{h.changed_at ? new Date(h.changed_at).toLocaleTimeString() : '—'}</span>{' '}
              <span className="text-cyan-400">{h.engineer_name}</span>
              <span className="text-slate-600"> · </span>
              {h.action_note}
            </div>
          ))}
        </div>
        <div className="flex gap-2 max-w-3xl">
          <textarea
            value={ledgerNote}
            onChange={(e) => setLedgerNote(e.target.value)}
            rows={2}
            placeholder="Field note…"
            className="flex-1 rounded-xl bg-slate-950 border border-slate-800 outline-none text-xs text-white p-3 resize-none"
          />
          <button
            type="button"
            onClick={postLedger}
            disabled={saving || !ledgerNote.trim()}
            className="px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold disabled:opacity-40 self-end"
          >
            Log
          </button>
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status, large }) {
  const s = status || 'Upcoming';
  const base = large
    ? 'px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider'
    : 'px-3 py-1.5 rounded-full text-[10px] font-bold uppercase';
  if (s === 'Action Required' || s === 'Setup in Progress')
    return <span className={`${base} bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse`}>{s}</span>;
  if (s === 'Ongoing')
    return <span className={`${base} bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse`}>Ongoing</span>;
  if (s === 'Ended' || s === 'Teardown Complete')
    return <span className={`${base} bg-rose-500/15 text-rose-300 border border-rose-500/30`}>{s}</span>;
  return <span className={`${base} bg-blue-500/15 text-blue-300 border border-blue-500/30`}>Upcoming</span>;
}

function CrewCard({ name, title, active }) {
  if (!name) return null;
  return (
    <div className="min-w-[160px] rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 flex flex-col items-center text-center">
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-black text-white mb-3 ${
          active
            ? 'bg-gradient-to-br from-emerald-500 to-cyan-600 shadow-[0_0_20px_rgba(16,185,129,0.45)] ring-2 ring-emerald-400/50'
            : 'bg-gradient-to-br from-indigo-500 to-purple-600 ring-2 ring-slate-600'
        }`}
      >
        {initials(name)}
      </div>
      <p className="text-sm font-bold text-white">{name}</p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mt-0.5">{title}</p>
    </div>
  );
}
