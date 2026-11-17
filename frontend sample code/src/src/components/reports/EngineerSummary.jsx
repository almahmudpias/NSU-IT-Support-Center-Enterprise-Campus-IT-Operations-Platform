/** Engineer performance summary table — assignment counts ≠ resolution counts */

export default function EngineerSummary({ rows, loading }) {
  if (loading) {
    return (
      <div className="border border-[#1F2937] bg-[#111827] px-4 py-8 text-center text-xs text-slate-500">
        Calculating engineer metrics…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="border border-[#1F2937] bg-[#111827] px-4 py-8 text-center text-xs text-slate-500 italic">
        No engineer activity in this scope.
      </div>
    );
  }

  return (
    <div className="border border-[#1F2937] bg-[#111827] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#1F2937] flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Engineer performance
        </h3>
        <p className="text-[9px] text-slate-600">
          Assigned ≠ resolved. Outstanding = open + in progress.
        </p>
      </div>
      <div className="overflow-x-auto custom-scroll">
        <table className="w-full text-left text-xs min-w-[560px]">
          <thead>
            <tr className="text-[9px] uppercase tracking-widest text-slate-500 border-b border-[#1F2937] bg-[#0B0F19]/80">
              <th className="px-3 py-2.5 font-bold">Engineer</th>
              <th className="px-3 py-2.5 font-bold text-right">Assigned</th>
              <th className="px-3 py-2.5 font-bold text-right">Open</th>
              <th className="px-3 py-2.5 font-bold text-right">In progress</th>
              <th className="px-3 py-2.5 font-bold text-right">Resolved</th>
              <th className="px-3 py-2.5 font-bold text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.engineer} className="border-b border-[#1F2937]/50 hover:bg-[#1F2937]/25">
                <td className="px-3 py-2.5 text-white font-medium">{r.engineer}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-300">{r.assigned}</td>
                <td className="px-3 py-2.5 text-right font-mono text-blue-400">{r.open}</td>
                <td className="px-3 py-2.5 text-right font-mono text-amber-400">{r.inProgress}</td>
                <td className="px-3 py-2.5 text-right font-mono text-emerald-400">{r.resolved}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-200 font-bold">
                  {r.outstanding}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
