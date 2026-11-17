import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { isAdmin } from '../lib/rbac';
import ConfirmDialog from '../components/ConfirmDialog';
import ReportSubNav from '../components/reports/ReportSubNav';

export default function MonthlyReportsAdmin() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    if (!isAdmin(user)) return;
    setLoading(true);
    try {
      const res = await reportsApi.monthly({ year, month });
      setRows(Array.isArray(res?.engineers) ? res.engineers : []);
    } catch (e) {
      showToast('error', 'Load failed', e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [year, month, user, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.engineer?.fullName || '').toLowerCase().includes(q) ||
        (r.engineer?.username || '').toLowerCase().includes(q) ||
        (r.engineer?.email || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  async function openDetail(eng) {
    setSelected(eng);
    try {
      const res = await reportsApi.monthly({
        year,
        month,
        engineer: eng.username || eng.fullName,
      });
      setDetail(res);
    } catch (e) {
      showToast('error', 'Detail failed', e.message);
      setDetail(null);
    }
  }

  async function sendOne(eng, force = false) {
    setSending(true);
    try {
      const res = await reportsApi.sendMonthly({
        year,
        month,
        engineerId: eng.id,
        force,
      });
      const r = res?.results?.[0];
      if (r?.skipped) showToast('warning', 'Already sent', `${eng.fullName} already received this month.`);
      else if (r?.sent) showToast('success', 'Email sent', `Report emailed to ${eng.fullName}`);
      else showToast('error', 'Send failed', r?.error || 'No email delivered');
      load();
    } catch (e) {
      showToast('error', 'Send failed', e.message);
    } finally {
      setSending(false);
      setConfirm(null);
    }
  }

  async function sendAll(force = false) {
    setSending(true);
    try {
      const res = await reportsApi.sendMonthly({ year, month, all: true, force });
      const ok = (res?.results || []).filter((r) => r.sent).length;
      const skip = (res?.results || []).filter((r) => r.skipped).length;
      showToast('success', 'Batch complete', `Sent ${ok} · Skipped ${skip}`);
      load();
    } catch (e) {
      showToast('error', 'Batch failed', e.message);
    } finally {
      setSending(false);
      setConfirm(null);
    }
  }

  if (!isAdmin(user)) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Admin access required.
      </div>
    );
  }

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="flex flex-col h-full bg-[#0B0F19] overflow-hidden">
      <ReportSubNav />
      <header className="shrink-0 px-5 md:px-8 py-4 border-b border-[#1F2937] bg-gradient-to-r from-[#111827] to-[#0B0F19]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Monthly Engineer Reports</h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Generate, preview, and email individual monthly work reports for active IT engineers. Automatic delivery
              runs on the 1st of each month.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-9 rounded-lg bg-[#0B0F19] border border-[#374151] text-white text-xs px-2"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleString('en-US', { month: 'long' })}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-9 w-24 rounded-lg bg-[#0B0F19] border border-[#374151] text-white text-xs px-2"
            />
            <button
              type="button"
              onClick={() => load()}
              className="h-9 px-3 rounded-lg border border-[#374151] text-slate-300 text-xs font-bold hover:bg-[#1F2937]"
            >
              Refresh
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => setConfirm({ type: 'all' })}
              className="h-9 px-3 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold disabled:opacity-50"
            >
              Email all engineers
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scroll p-4 md:p-6 grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 space-y-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search engineer name, username, email…"
            className="w-full h-10 rounded-xl bg-[#111827] border border-[#1F2937] px-3 text-sm text-white placeholder:text-slate-600"
          />
          {loading && <p className="text-xs text-slate-500 py-8 text-center">Loading monthly summaries…</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-xs text-slate-500 py-8 text-center">No active engineers found for this period.</p>
          )}
          <ul className="space-y-2">
            {filtered.map((r) => (
              <li
                key={r.engineer?.id || r.engineer?.username}
                className="rounded-xl border border-[#1F2937] bg-[#111827]/80 px-4 py-3 flex flex-wrap items-center gap-3"
              >
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDetail(r.engineer)}>
                  <p className="text-sm font-bold text-white">{r.engineer?.fullName}</p>
                  <p className="text-[11px] text-slate-500">
                    {r.engineer?.email || 'No email'} · Assigned {r.summary?.totalAssigned ?? 0} · Completed{' '}
                    {r.summary?.completed ?? 0} · Events {r.summary?.events ?? 0}
                  </p>
                </button>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${
                    r.emailSent
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                  }`}
                >
                  {r.emailSent ? 'Emailed' : 'Not sent'}
                </span>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => {
                    if (sending) return;
                    setConfirm({ type: 'one', eng: r.engineer, force: !!r.emailSent });
                  }}
                  className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold disabled:opacity-50"
                >
                  {sending && confirm?.eng?.id === r.engineer?.id ? 'Sending…' : r.emailSent ? 'Resend' : 'Send email'}
                </button>
                <Link
                  to={`/reports/monthly/view?month=${month}&year=${year}&engineer=${encodeURIComponent(
                    r.engineer?.username || r.engineer?.fullName || ''
                  )}`}
                  className="h-8 px-3 rounded-lg border border-[#374151] text-slate-300 text-[11px] font-bold hover:bg-[#1F2937] flex items-center"
                >
                  View
                </Link>
                <Link
                  to={`/reports/monthly/view?month=${month}&year=${year}&engineer=${encodeURIComponent(
                    r.engineer?.username || r.engineer?.fullName || ''
                  )}&print=1`}
                  className="h-8 px-3 rounded-lg border border-teal-500/40 text-teal-200 text-[11px] font-bold hover:bg-teal-500/10 flex items-center"
                >
                  PDF
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="xl:col-span-2 rounded-2xl border border-[#1F2937] bg-[#111827]/80 p-5 min-h-[280px]">
          {!selected && (
            <p className="text-xs text-slate-500 text-center py-16">Select an engineer to preview their monthly report.</p>
          )}
          {selected && !detail && (
            <p className="text-xs text-slate-500 text-center py-16">Loading preview…</p>
          )}
          {selected && detail && (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Preview</p>
                <h2 className="text-lg font-black text-white mt-1">{selected.fullName}</h2>
                <p className="text-xs text-slate-400">{detail.monthLabel}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Assigned', detail.summary?.totalAssigned],
                  ['Completed', detail.summary?.completed],
                  ['In progress', detail.summary?.inProgress],
                  ['Pending', detail.summary?.pending],
                  ['Cancelled', detail.summary?.cancelled],
                  ['Events', detail.summary?.events],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-[#1F2937] bg-[#0B0F19]/60 px-3 py-2">
                    <p className="text-[9px] font-bold uppercase text-slate-500">{k}</p>
                    <p className="text-xl font-black text-cyan-300 tabular-nums">{v ?? 0}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Tasks ({(detail.tickets || []).length})</p>
                <ul className="max-h-48 overflow-y-auto custom-scroll space-y-1">
                  {(detail.tickets || []).slice(0, 20).map((t) => (
                    <li key={t.id} className="text-[11px] text-slate-300 flex justify-between gap-2">
                      <span className="truncate">
                        #{t.id} · {t.user_name || t.issue_category || 'Ticket'}
                      </span>
                      <span className="text-slate-500 shrink-0">{t.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                className="w-full h-10 rounded-xl border border-teal-500/40 text-teal-200 text-xs font-bold hover:bg-teal-500/10"
                onClick={() => window.print()}
              >
                Print / Save PDF
              </button>
            </div>
          )}
        </div>
      </main>

      {confirm && (
        <ConfirmDialog
          open={true}
          title={confirm.type === 'all' ? 'Email all engineers?' : 'Send monthly report?'}
          message={
            sending
              ? 'Sending email… Please wait. The dialog will close when delivery finishes.'
              : confirm.type === 'all'
                ? `This will email the ${month}/${year} work report to all active engineers who have not already received it (unless forced).`
                : `Send ${month}/${year} report email to ${confirm.eng?.fullName}?${
                    confirm.force ? ' This engineer was already emailed — resend will force delivery.' : ''
                  }`
          }
          confirmLabel={confirm.type === 'all' ? 'Send to all' : 'Send email'}
          loading={sending}
          loadingLabel="Sending…"
          tone="emerald"
          onConfirm={() => {
            if (sending) return;
            if (confirm.type === 'all') sendAll(false);
            else sendOne(confirm.eng, Boolean(confirm.force));
          }}
          onCancel={() => {
            if (sending) return;
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}
