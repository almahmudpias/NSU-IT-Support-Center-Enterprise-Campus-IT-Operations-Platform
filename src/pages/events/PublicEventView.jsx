import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

/**
 * Public, tokenized event brief — opened from email "View Full Details".
 * Optimized for phone + desktop; print-friendly.
 */
export default function PublicEventView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/public/events/${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Unable to load event');
        if (!cancelled) setData(json.event || json);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500 text-sm">
        Loading event details…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <p className="text-slate-800 font-bold mb-2">Link unavailable</p>
          <p className="text-sm text-slate-500">{error || 'This notification link is invalid or expired.'}</p>
        </div>
      </div>
    );
  }

  const crew = Array.isArray(data.additional_crew)
    ? data.additional_crew
    : data.backup_it
      ? [data.backup_it]
      : [];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 py-6 px-4 print:bg-white print:py-0">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-xl overflow-hidden print:shadow-none print:rounded-none">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-widest opacity-90">
            IT Event Support Assignment
          </p>
          <h1 className="text-xl font-extrabold mt-1 leading-tight">{data.name}</h1>
          <p className="text-xs opacity-90 mt-1">EV-{data.id} · Official deployment notice</p>
        </div>

        <div className="px-6 py-5 space-y-4 text-sm">
          <p>
            You are assigned on this university event profile as part of the NSU IT deployment team.
          </p>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 grid grid-cols-2 gap-3 text-[13px]">
            <Item label="Event ID" value={`EV-${data.id}`} />
            <Item label="Event name" value={data.name} />
            <Item label="Organized by" value={data.organizer || data.onsite_coordinator} />
            <Item label="Event date" value={data.event_date} />
            <Item label="Schedule" value={[data.start_time, data.end_time].filter(Boolean).join(' – ')} />
            <Item label="Venue" value={data.venue} />
            <Item label="Primary IT lead" value={data.assigned_engineer || data.primary_it} />
            <Item label="Department" value={data.department} />
          </div>

          {data.meeting_link && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">
                Online meeting
              </p>
              <a href={data.meeting_link} className="text-indigo-700 font-semibold break-all text-xs">
                {data.meeting_link}
              </a>
              {data.meeting_account && (
                <p className="text-xs text-slate-600 mt-1">Account: {data.meeting_account}</p>
              )}
            </div>
          )}

          {crew.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                Support crew
              </p>
              <p className="text-sm">{crew.join(', ')}</p>
            </div>
          )}

          {data.notes && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-900">
              <strong>Notes:</strong> {data.notes}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 min-w-[140px] py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
            >
              Print / Save as PDF
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 text-[10px] text-slate-400">
          Automated notice from NSU IT Management System · Do not reply to this message.
        </div>
      </div>
    </div>
  );
}

function Item({ label, value }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="font-semibold text-slate-800 break-words">{value || '—'}</p>
    </div>
  );
}
