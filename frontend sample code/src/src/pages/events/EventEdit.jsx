import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { eventsApi, staffApi, equipmentApi, venuesApi } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { isAdmin } from '../../lib/rbac';
import { useAuth } from '../../lib/auth';
import { combineDateTime } from '../../lib/eventStatus';
import { resolveParamId, eventPath } from '../../lib/ids';

export default function EventEdit() {
  const { id: idParam } = useParams();
  const id = resolveParamId(idParam);
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [engineers, setEngineers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supportPick, setSupportPick] = useState('');
  const [supportCrew, setSupportCrew] = useState([]);
  const [equipInput, setEquipInput] = useState('');
  const [equipList, setEquipList] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [hasMeeting, setHasMeeting] = useState(false);
  const [form, setForm] = useState(null);
  const [original, setOriginal] = useState(null);
  const [confirmAssignOpen, setConfirmAssignOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [data, eng, eq, ven] = await Promise.all([
        eventsApi.get(id),
        staffApi.engineers().catch(() => []),
        equipmentApi.list().catch(() => []),
        venuesApi.list().catch(() => []),
      ]);
      setVenues(Array.isArray(ven) ? ven : []);
      setCatalog(Array.isArray(eq) ? eq.map((x) => x.label || x.name || x) : []);
      setEngineers(Array.isArray(eng) ? eng : []);
      const e = data.event;
      if (!e) throw new Error('Not found');
      setOriginal(e);
      setForm({
        name: e.name || '',
        contact_person: e.onsite_coordinator || e.organizer || '',
        department: e.department || '',
        venue: e.venue || '',
        event_date: e.event_date ? String(e.event_date).slice(0, 10) : '',
        start_time: e.start_time ? String(e.start_time).slice(0, 5) : '',
        end_time: e.end_time ? String(e.end_time).slice(0, 5) : '',
        assigned_engineer: e.assigned_engineer || e.primary_it || '',
        meeting_link: e.meeting_link || '',
        meeting_account: e.meeting_account || '',
        notes: e.notes || '',
      });
      setHasMeeting(Boolean(e.meeting_link));
      const crew = Array.isArray(e.additional_crew)
        ? e.additional_crew
        : e.backup_it
          ? [e.backup_it]
          : [];
      setSupportCrew(crew);
      setEquipList(
        Array.isArray(e.av_manifest)
          ? e.av_manifest.map((x) => x.label || x).filter(Boolean)
          : e.equipment
            ? String(e.equipment).split(',').map((s) => s.trim()).filter(Boolean)
            : []
      );
    } catch (err) {
      showToast('error', 'Load failed', err.message);
      setForm(null);
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const suggestions = useMemo(() => {
    const q = equipInput.trim().toLowerCase();
    const base = catalog.filter((s) => !equipList.includes(s));
    if (!q) return base.slice(0, 8);
    return base.filter((s) => String(s).toLowerCase().includes(q)).slice(0, 8);
  }, [equipInput, equipList, catalog]);

  if (!isAdmin(user)) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Only Admin / Super Admin can edit events.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-slate-400 text-sm">Event not found</p>
        <Link to="/events" className="text-indigo-400 text-sm font-bold hover:underline">
          ← Event Manager
        </Link>
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

  async function save(e) {
    e?.preventDefault?.();
    if (!form.name.trim()) return showToast('warning', 'Name required', '');
    if (!form.assigned_engineer) return showToast('warning', 'Primary lead required', '');

    const prevPrimary = original?.assigned_engineer || original?.primary_it || '';
    const nextPrimary = form.assigned_engineer || '';
    const approved = String(original?.approval_status || original?.status || '').toLowerCase() === 'approved';
    if (approved && prevPrimary && nextPrimary && prevPrimary !== nextPrimary && !confirmAssignOpen) {
      setConfirmAssignOpen(true);
      return;
    }
    setConfirmAssignOpen(false);
    setSaving(true);
    try {
      const startDt = combineDateTime(form.event_date, form.start_time);
      const endDt = combineDateTime(form.event_date, form.end_time);
      const items = equipList.map((label) => ({
        label,
        checked: false,
        returned: false,
        out_at: null,
        out_by: null,
        in_at: null,
        in_by: null,
      }));
      await eventsApi.update(id, {
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
        action_note: `Event profile updated by ${user?.fullName || 'Admin'}`,
      });
      showToast('success', 'Event updated', form.name);
      navigate(eventPath(Number(id) || id), { replace: true });
    } catch (err) {
      showToast('error', 'Update failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  const supportOptions = engineers.filter(
    (en) => en.full_name !== form.assigned_engineer && !supportCrew.includes(en.full_name)
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <header className="h-20 flex items-center justify-between px-8 bg-[#111827] border-b border-[#1F2937] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={eventPath(id)}
            className="w-9 h-9 rounded-lg bg-[#1F2937] border border-[#374151] text-gray-400 hover:text-white flex items-center justify-center shrink-0"
          >
            ←
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Edit event</span>
              <span className="text-sm font-mono font-bold text-indigo-400">EV-{id}</span>
            </div>
            <p className="text-xs text-gray-400 font-medium mt-0.5 truncate">
              {form.name || 'Untitled event'}
              {form.event_date ? ` · ${form.event_date}` : ''}
              {form.start_time ? ` ${form.start_time}` : ''}
              {form.venue ? ` · ${form.venue}` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="h-9 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50 shadow-lg shadow-indigo-900/30"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto custom-scroll px-6 py-5">
        <form onSubmit={save} className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4 content-start">
          <div className="space-y-4">
            <Section title="Event profile">
              <Field label="Event name *">
                <input
                  className="dark-input w-full text-sm h-10 font-semibold"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                  list="venue-list-edit"
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                />
                <datalist id="venue-list-edit">
                  {venues.map((v) => (
                    <option key={v.id || v.name || v} value={v.name || v.label || v} />
                  ))}
                </datalist>
              </Field>
            </Section>

            <Section title="Schedule">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Date">
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
                    />
                  </Field>
                  <Field label="Account for this link">
                    <input
                      className="dark-input w-full text-sm h-10"
                      value={form.meeting_account}
                      onChange={(e) => setForm({ ...form, meeting_account: e.target.value })}
                    />
                  </Field>
                </div>
              )}
            </Section>
          </div>

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
                    className="h-10 px-3 rounded-lg border border-[#374151] text-xs font-bold text-slate-300 hover:bg-[#1F2937]"
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
                          className="text-rose-400"
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
                      className="h-10 px-3 rounded-lg border border-[#374151] text-xs font-bold text-slate-300 hover:bg-[#1F2937]"
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
                <div className="flex flex-wrap gap-1.5">
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
                <p className="text-[11px] text-slate-500 italic">No equipment listed</p>
              )}
            </Section>

            <Section title="Notes">
              <textarea
                className="dark-input w-full text-sm resize-none min-h-[5.5rem]"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Section>
          </div>
        </form>
      </main>

      {confirmAssignOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[#0B0F19]/85 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/25 bg-gradient-to-b from-[#162032] to-[#0f1624] shadow-[0_40px_100px_rgba(0,0,0,0.75)] overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-[#1F2937]/80">
              <div className="flex items-center justify-center mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-lg font-black shadow-lg shadow-amber-900/40">!</div>
              </div>
              <h3 className="text-center text-base font-black text-white">Confirm assignment change</h3>
              <p className="text-center text-[11px] text-slate-400 mt-1">Engineers will be notified by email</p>
            </div>
            <div className="px-6 py-4 space-y-2 text-xs">
              <div className="flex justify-between gap-3 py-2 border-b border-[#1F2937]">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Previous lead</span>
                <span className="text-rose-300 font-semibold">{original?.assigned_engineer || original?.primary_it || '—'}</span>
              </div>
              <div className="flex justify-between gap-3 py-2 border-b border-[#1F2937]">
                <span className="text-slate-500 font-bold uppercase text-[10px]">New lead</span>
                <span className="text-emerald-300 font-semibold">{form.assigned_engineer || '—'}</span>
              </div>
              <p className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-1">
                The previous engineer receives an unassignment notice. The new engineer receives an assignment notice.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-2.5">
              <button type="button" onClick={() => setConfirmAssignOpen(false)} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#1f2937] border border-[#374151] text-gray-300 hover:bg-[#374151]">Cancel</button>
              <button type="button" disabled={saving} onClick={() => save()} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50">{saving ? 'Saving…' : 'Confirm & save'}</button>
            </div>
          </div>
        </div>
      )}
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
