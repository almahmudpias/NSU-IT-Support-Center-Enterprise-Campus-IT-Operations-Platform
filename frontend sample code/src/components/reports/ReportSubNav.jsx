import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/reports', end: true, label: 'Overview' },
  { to: '/reports/engineers', end: false, label: 'Engineer Performance' },
  { to: '/reports/monthly', end: false, label: 'Monthly Reports' },
];

/**
 * Reports section tabs — sits directly under the app top bar.
 */
export default function ReportSubNav() {
  return (
    <nav
      className="shrink-0 border-b border-[#1F2937] bg-[#0B0F19]/95 px-4 sm:px-6 print:hidden"
      aria-label="Reports sections"
    >
      <div className="flex items-center gap-1 py-2 overflow-x-auto custom-scroll">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `px-3.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition border ${
                isActive
                  ? 'bg-indigo-500/15 text-indigo-200 border-indigo-500/40'
                  : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300 hover:bg-[#111827]'
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
