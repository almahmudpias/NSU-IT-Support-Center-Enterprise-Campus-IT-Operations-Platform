import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { eventsApi, staffApi, equipmentApi, venuesApi } from '../lib/api';
import { useToast } from '../components/Toast';
import { isAdmin } from '../lib/rbac';
import { useAuth } from '../lib/auth';
import { combineDateTime } from '../lib/eventStatus';
import { eventPath } from '../lib/ids';

export default function EventNew() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [engineers, setEngineers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [saving, setSaving] = useState(false);
  const [equipInput, setEquipInput] = useState('');
  const [equipList, setEquipList] = useState([]);
  const [supportPick, setSupportPick] = useState('');
  const [supportCrew, setSupportCrew] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [form, setForm] = useState({
    name: '',
    contact_person: '',
    department: '',
    venue: '',
    event_date: '',
    start_time: '',
    end_time: '',
    assigned_engineer: '',
    notes: '',
  });
  const [venues, setVenues] = useState([]);
  const [showVenueSug, setShowVenueSug] = useState(false);

  useEffect(() => {
    if (!isAdmin(user)) return;
    Promise.all([
      staffApi.engineers().catch(() => []),
      equipmentApi.list().catch(() => []),
      venuesApi.list().catch(() => []),
    ]).then(([eng, eq, ven]) => {
      setEngineers(Array.isArray(eng) ? eng : []);
      setCatalog(Array.isArray(eq) ? eq.map((x) => x.label || x) : []);
      setVenues(Array.isArray(ven) ? ven : []);
    });
  }, [user]);

  const suggestions = useMemo(() => {
    const q = equipInput.trim().toLowerCase();
    const base = catalog.filter((s) => !equipList.includes(s));
    if (!q) return base.slice(0, 10);
    return base.filter((s) => s.toLowerCase().includes(q)).slice(0, 10);
  }, [equipInput, equipList, catalog]);

  const supportOptions = engineers.filter(
    (en) => en.full_name !== form.assigned_engineer && !supportCrew.includes(en.full_name)
  );

  if (!isAdmin(user)) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Only Admin / Super Admin can schedule events.
      </div>
    );
  }

  async function addEquip(raw) {
    const v = String(raw || equipInput).trim();
    if (!v || equipList.includes(v)) {
      setEquipInput('');
      setShowSug(false);
      return;
    }
    setEquipList((l) => [...l, v]);
    setEquipInput('');
    setShowSug(false);
    // event-only item — do not write to global equipment catalog
  }

  function addSupport() {
    if (!supportPick || supportCrew.includes(supportPick)) return;
    setSupportCrew([...supportCrew, supportPick]);
    setSupportPick('');
  }

  async function dispatch(e) {
    e?.preventDefault?.();
    if (!form.name.trim()) return showToast('warning', 'Name required', '');
    if (!form.assigned_engineer) return showToast('warning', 'Primary lead required', '');
    if (!form.event_date) return showToast('warning', 'Event date required', '');
    setSaving(true);
    try {
      const items =
        equipList.length > 0
          ? equipList.map((label) => ({
              label,
              checked: false,
              returned: false,
              out_at: null,
              out_by: null,
              in_at: null,
              in_by: null,
            }))
          : [
              {
                label: 'Standard setup',
                checked: false,
                returned: false,
                out_at: null,
                out_by: null,
                in_at: null,
                in_by: null,
              },
            ];
      const startDt = combineDateTime(form.event_date, form.start_time);
      const endDt = combineDateTime(form.event_date, form.end_time);
      const data = await eventsApi.create({
        name: form.name.trim(),
        onsite_coordinator: form.contact_person || null,
        organizer: form.contact_person || null,
        department: form.department || null,
        building: null,
        room: null,
        venue: form.venue.trim() || null,
        event_date: form.event_date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        go_live_at: startDt && !Number.isNaN(startDt.getTime()) ? startDt.toISOString() : null,
        teardown_at: form.end_time && endDt && !Number.isNaN(endDt.getTime()) ? endDt.toISOString() : null,
        assigned_engineer: form.assigned_engineer,
        primary_it: form.assigned_engineer,
        backup_it: supportCrew[0] || null,
        additional_crew: supportCrew,
        notes: form.notes || null,
        av_manifest: items,
        event_status: 'Upcoming',
        status: 'Pending',
        event_type: 'Event',
      });
      showToast('success', 'Event dispatched', form.name);
      const id = data?.data?.id;
      navigate(id ? eventPath(id) : '/events');
    } catch (err) {
      showToast('error', 'Failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B0F19]">
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
        <Link to="/events" className="text-[10px] text-slate-500 hover:text-indigo-400 font-bold uppercase tracking-wider">
          ← Event Command
        </Link>
        <h1 className="text-xl font-black text-white mt-0.5">Schedule New Event</h1>
      </header>

      <form onSubmit={dispatch} className="flex-1 overflow-y-auto custom-scroll p-6 pb-28">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* 65% Left */}
          <div className="lg:col-span-8 space-y-5">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-4">Event details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Field label="Event name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                </div>
                <Field label="Contact person" value={form.contact_person} onChange={(v) => setForm({ ...form, contact_person: v })} />
                <Field label="Department" value={form.department} onChange={(v) => setForm({ ...form, department: v })} placeholder="Arranging dept" />
                <div className="sm:col-span-2 relative">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Venue</label>
                  <input
                    value={form.venue}
                    onChange={(e) => { setForm({ ...form, venue: e.target.value }); setShowVenueSug(true); }}
                    onFocus={() => setShowVenueSug(true)}
                    onBlur={() => setTimeout(() => setShowVenueSug(false), 150)}
                    placeholder="Type venue or select previous…"
                    className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 outline-none text-sm text-white px-3 py-2"
                  />
                  {showVenueSug && venues.filter((v) => !form.venue || v.toLowerCase().includes(form.venue.toLowerCase())).length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-slate-700 bg-slate-950 shadow-xl max-h-40 overflow-y-auto">
                      {venues
                        .filter((v) => !form.venue || v.toLowerCase().includes(form.venue.toLowerCase()))
                        .slice(0, 12)
                        .map((v) => (
                          <button key={v} type="button" className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-indigo-500/20" onMouseDown={(e) => e.preventDefault()} onClick={() => { setForm({ ...form, venue: v }); setShowVenueSug(false); }}>
                            {v}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-4">Schedule pipeline</h3>
              <div className="flex flex-col sm:flex-row items-stretch gap-2 sm:gap-0">
                <div className="flex-1 rounded-xl sm:rounded-r-none border border-slate-800 bg-slate-950 p-3">
                  <p className="text-[9px] font-bold uppercase text-slate-500 mb-1">Date</p>
                  <input type="date" className="w-full bg-transparent text-white text-sm font-semibold outline-none" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
                </div>
                <div className="hidden sm:flex items-center px-1 text-slate-600">→</div>
                <div className="flex-1 rounded-xl sm:rounded-none border border-slate-800 bg-slate-950 p-3">
                  <p className="text-[9px] font-bold uppercase text-slate-500 mb-1">Start</p>
                  <input type="time" className="w-full bg-transparent text-white text-sm font-semibold outline-none" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div className="hidden sm:flex items-center px-1 text-slate-600">→</div>
                <div className="flex-1 rounded-xl sm:rounded-l-none border border-slate-800 bg-slate-950 p-3">
                  <p className="text-[9px] font-bold uppercase text-slate-500 mb-1">End / Teardown</p>
                  <input type="time" className="w-full bg-transparent text-white text-sm font-semibold outline-none" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <label className="text-[10px] font-bold uppercase text-slate-500">Notes</label>
              <textarea className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 outline-none text-xs text-white p-3 resize-none" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </section>
          </div>

          {/* 35% Right */}
          <div className="lg:col-span-4 space-y-5">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Crew assembly</h3>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Primary lead *</label>
                <select
                  required
                  className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white text-sm font-bold p-2.5 outline-none"
                  value={form.assigned_engineer}
                  onChange={(e) => setForm({ ...form, assigned_engineer: e.target.value })}
                >
                  <option value="">— Select —</option>
                  {engineers.map((en) => (
                    <option key={en.id || en.full_name} value={en.full_name}>
                      {en.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Supporting engineers</label>
                <div className="flex gap-2 mt-1">
                  <select
                    className="flex-1 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs p-2 outline-none"
                    value={supportPick}
                    onChange={(e) => setSupportPick(e.target.value)}
                  >
                    <option value="">— Add support —</option>
                    {supportOptions.map((en) => (
                      <option key={en.full_name} value={en.full_name}>
                        {en.full_name}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={addSupport} className="px-3 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white">
                    +
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2 min-h-[28px]">
                  {supportCrew.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-bold text-cyan-200">
                      {c}
                      <button type="button" onClick={() => setSupportCrew(supportCrew.filter((x) => x !== c))} className="hover:text-white">
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-2">Equipment loadout</h3>
              <div className="relative">
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 outline-none text-xs text-white px-3 py-2"
                    value={equipInput}
                    onChange={(e) => {
                      setEquipInput(e.target.value);
                      setShowSug(true);
                    }}
                    onFocus={() => setShowSug(true)}
                    onBlur={() => setTimeout(() => setShowSug(false), 150)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addEquip();
                      }
                    }}
                    placeholder="Add gear…"
                  />
                  <button type="button" onClick={() => addEquip()} className="px-3 rounded-xl bg-indigo-600 text-white text-xs font-bold">
                    +
                  </button>
                </div>
                {showSug && suggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-slate-700 bg-slate-950 shadow-xl max-h-40 overflow-y-auto">
                    {suggestions.map((s) => (
                      <button key={s} type="button" className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-indigo-500/20" onMouseDown={(e) => e.preventDefault()} onClick={() => addEquip(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <ul className="mt-3 space-y-1.5">
                {equipList.length === 0 && <li className="text-[10px] text-slate-500 italic">Default: Standard setup</li>}
                {equipList.map((c, i) => (
                  <li key={c} className="flex items-center justify-between text-xs text-slate-200 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2">
                    <span>
                      <span className="text-slate-500 mr-2">{i + 1}.</span>
                      {c}
                    </span>
                    <button type="button" onClick={() => setEquipList(equipList.filter((x) => x !== c))} className="text-rose-400 text-[10px] font-bold">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </form>

      <div className="sticky bottom-0 z-20 border-t border-slate-700/50 bg-slate-900/90 backdrop-blur-xl px-6 py-4 flex justify-end gap-3">
        <Link to="/events" className="px-5 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-xs font-bold">
          Cancel
        </Link>
        <button type="button" onClick={dispatch} disabled={saving} className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-[0_0_24px_rgba(99,102,241,0.35)] disabled:opacity-50">
          {saving ? 'Dispatching…' : 'Dispatch Event'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase text-slate-500">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 outline-none text-sm text-white px-3 py-2"
      />
    </div>
  );
}
