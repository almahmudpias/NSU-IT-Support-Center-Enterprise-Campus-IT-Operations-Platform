import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { eventsApi, staffApi, equipmentApi, venuesApi } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { isAdmin } from '../../lib/rbac';
import { useAuth } from '../../lib/auth';
import { combineDateTime } from '../../lib/eventStatus';
import { eventPath } from '../../lib/ids';

export default function EventNew() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [engineers, setEngineers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [venues, setVenues] = useState([]);
  const [saving, setSaving] = useState(false);
  const [supportPick, setSupportPick] = useState('');
  const [supportCrew, setSupportCrew] = useState([]);
  const [equipInput, setEquipInput] = useState('');
  const [equipList, setEquipList] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [hasMeeting, setHasMeeting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    contact_person: '',
    department: '',
    venue: '',
    event_date: '',
    start_time: '',
    end_time: '',
    assigned_engineer: '',
    meeting_link: '',
    meeting_account: '',
    notes: '',
  });

  useEffect(() => {
    if (!isAdmin(user)) return;
    Promise.all([
      staffApi.engineers().catch(() => []),
      equipmentApi.list().catch(() => []),
      venuesApi.list().catch(() => []),
    ]).then(([eng, eq, ven]) => {
      setEngineers(Array.isArray(eng) ? eng : []);
      setCatalog(Array.isArray(eq) ? eq.map((x) => x.label || x.name || x) : []);
      setVenues(Array.isArray(ven) ? ven : []);
    });
  }, [user]);

  const suggestions = useMemo(() => {
    const q = equipInput.trim().toLowerCase();
    const base = catalog.filter((s) => !equipList.includes(s));
    if (!q) return base.slice(0, 8);
    return base.filter((s) => String(s).toLowerCase().includes(q)).slice(0, 8);
  }, [equipInput, equipList, catalog]);

  if (!isAdmin(user)) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Only Admin / Super Admin can schedule events.
      </div>
    );
  }

  function addEquip(raw) {
    const v = String(raw || equipInput).trim();
    if (!v || equipList.includes(v)) {
      setEquipInput('');
      setShowSug(false);
      return;
    }
    setEquipList((l) => [...l, v]);
    setEquipInput('');
    setShowSug(false);
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
      const items = equipList.map((label) => ({
        label,
        checked: false,
        returned: false,
        out_at: null,
        out_by: null,
        in_at: null,
        in_by: null,
      }));
      const startDt = combineDateTime(form.event_date, form.start_time);
      const endDt = combineDateTime(form.event_date, form.end_time);
      const data = await eventsApi.create({
        name: form.name.trim(),
        onsite_coordinator: form.contact_person || null,
        organizer: form.contact_person || null,
        department: form.department || null,
        venue: form.venue.trim() || null,
        event_date: form.event_date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        go_live_at: startDt && !Number.isNaN(startDt.getTime()) ? startDt.toISOString() : null,
        teardown_at: endDt && !Number.isNaN(endDt.getTime()) ? endDt.toISOString() : null,
        assigned_engineer: form.assigned_engineer,
        primary_it: form.assigned_engineer,
        backup_it: supportCrew[0] || null,
        additional_crew: supportCrew,
        notes: form.notes || null,
        meeting_link: hasMeeting ? form.meeting_link.trim() || null : null,
        meeting_account: hasMeeting ? form.meeting_account.trim() || null : null,
        av_manifest: items,
        equipment: equipList.join(', ') || null,
        event_status: 'Upcoming',
        status: 'Pending',
        approval_status: 'Pending',
        event_type: 'Event',
      });
      showToast('success', 'Event scheduled', 'Pending approval before engineer notifications.');
      const id = data?.data?.id || data?.id;
      if (id) navigate(eventPath(Number(id) || id), { replace: true });
      else navigate('/events');
    } catch (err) {
      showToast('error', 'Schedule failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  const supportOptions = engineers.filter(
    (en) => en.full_name !== form.assigned_engineer && !supportCrew.includes(en.full_name)
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* System-standard top bar (matches Event Full View / Events Command) */}
      <header className="h-20 flex items-center justify-between px-8 bg-[#111827] border-b border-[#1F2937] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/events"
            className="w-9 h-9 rounded-lg bg-[#1F2937] border border-[#374151] text-gray-400 hover:text-white flex items-center justify-center shrink-0"
          >
            ←
          </Link>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white tracking-tight">Schedule event</h2>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              Pending approval · engineers notified after approve
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={dispatch}
          className="h-9 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50 shadow-lg shadow-indigo-900/30"
        >
          {saving ? 'Saving…' : 'Dispatch event'}
        </button>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto custom-scroll px-6 py-5">
        <form onSubmit={dispatch} className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4 content-start">
          {/* Left column */}
          <div className="space-y-4">
            <Section title="Event profile">
              <Field label="Event name *">
                <input
                  className="dark-input w-full text-sm h-10 font-semibold"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Faculty senate meeting"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contact / organizer">
                  <input
                    className="dark-input w-full text-sm h-10"
                    value={form.contact_person}
                    onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                  />
                </Field>
                <Field label="Department">
                  <input
                    className="dark-input w-full text-sm h-10"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Venue">
                <input
                  className="dark-input w-full text-sm h-10"
                  list="venue-list"
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  placeholder="Building / room"
                />
                <datalist id="venue-list">
                  {venues.map((v) => (
                    <option key={v.id || v.name || v} value={v.name || v.label || v} />
                  ))}
                </datalist>
              </Field>
            </Section>

            <Section title="Schedule">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Date *">
                  <input
                    type="date"
                    className="dark-input w-full text-sm h-10"
                    value={form.event_date}
                    onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                  />
                </Field>
                <Field label="Start">
                  <input
                    type="time"
                    className="dark-input w-full text-sm h-10"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  />
                </Field>
                <Field label="End">
                  <input
                    type="time"
                    className="dark-input w-full text-sm h-10"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Online meeting">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasMeeting}
                  onChange={(e) => {
                    setHasMeeting(e.target.checked);
                    if (!e.target.checked) setForm({ ...form, meeting_link: '', meeting_account: '' });
                  }}
                  className="rounded border-[#374151] bg-[#0B0F19] text-indigo-500"
                />
                <span className="text-xs text-slate-300 font-semibold">
                  Host online meeting (Zoom / Teams / Meet)
                </span>
              </label>
              {hasMeeting && (
                <div className="space-y-2.5 mt-2">
                  <Field label="Meeting link">
                    <input
                      className="dark-input w-full text-sm h-10 font-mono"
                      value={form.meeting_link}
                      onChange={(e) => setForm({ ...form, meeting_link: e.target.value })}
                      placeholder="https://zoom.us/j/…"
                    />
                  </Field>
                  <Field label="Account for this link">
                    <input
                      className="dark-input w-full text-sm h-10"
                      value={form.meeting_account}
                      onChange={(e) => setForm({ ...form, meeting_account: e.target.value })}
                      placeholder="it.support@northsouth.edu"
                    />
                  </Field>
                </div>
              )}
            </Section>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <Section title="IT assignment">
              <Field label="Primary IT lead *">
                <select
                  className="dark-input w-full text-sm h-10 font-bold"
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
              </Field>
              <Field label="Backup / support crew">
                <div className="flex gap-2">
                  <select
                    className="dark-input flex-1 text-sm h-10"
                    value={supportPick}
                    onChange={(e) => setSupportPick(e.target.value)}
                  >
                    <option value="">— Add support —</option>
                    {supportOptions.map((en) => (
                      <option key={en.id || en.full_name} value={en.full_name}>
                        {en.full_name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addSupport}
                    className="h-9 px-3 rounded-lg border border-[#374151] text-[11px] font-bold text-slate-300 hover:bg-[#1F2937] shrink-0"
                  >
                    Add
                  </button>
                </div>
                {supportCrew.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {supportCrew.map((n) => (
                      <span
                        key={n}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0B0F19] border border-[#374151] text-[11px] text-slate-300"
                      >
                        {n}
                        <button
                          type="button"
                          className="text-rose-400 hover:text-rose-300"
                          onClick={() => setSupportCrew(supportCrew.filter((x) => x !== n))}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </Field>
            </Section>

            <Section title="Equipment setup">
              <Field label="Add equipment">
                <div className="relative">
                  <div className="flex gap-2">
                    <input
                      className="dark-input flex-1 text-sm h-10"
                      value={equipInput}
                      onChange={(e) => {
                        setEquipInput(e.target.value);
                        setShowSug(true);
                      }}
                      onFocus={() => setShowSug(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addEquip();
                        }
                      }}
                      placeholder="Projector, mic, laptop…"
                    />
                    <button
                      type="button"
                      onClick={() => addEquip()}
                      className="h-9 px-3 rounded-lg border border-[#374151] text-[11px] font-bold text-slate-300 hover:bg-[#1F2937] shrink-0"
                    >
                      Add
                    </button>
                  </div>
                  {showSug && suggestions.length > 0 && (
                    <div className="absolute z-20 left-0 right-12 mt-1 bg-[#0B0F19] border border-[#374151] rounded-lg shadow-xl max-h-36 overflow-y-auto custom-scroll">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-[#1F2937]"
                          onClick={() => addEquip(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
              {equipList.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {equipList.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-[11px] text-indigo-200 font-semibold"
                    >
                      {item}
                      <button
                        type="button"
                        className="text-indigo-300/70 hover:text-rose-300"
                        onClick={() => setEquipList(equipList.filter((x) => x !== item))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">No equipment listed yet</p>
              )}
            </Section>

            <Section title="Notes">
              <textarea
                className="dark-input w-full text-sm resize-none min-h-[5.5rem]"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Setup notes for the crew…"
              />
            </Section>
          </div>
        </form>
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">{title}</h4>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 leading-none">
        {label}
      </label>
      {children}
    </div>
  );
}
