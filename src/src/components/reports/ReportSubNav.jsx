import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/reports', end: true, label: 'Overview' },
  { to: '/reports/engineers', end: false, label: 'Engineer Performance' },
];

/**
 * Nested navigation under Reports — matches app dark theme.
 */
export default function ReportSubNav() {
  return (
    <nav
      className="flex flex-wrap items-center gap-1 border-b border-[#1F2937] bg-[#0B0F19] px-4 sm:px-6 print:hidden"
      aria-label="Reports sections"
    >
      {LINKS.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            `px-3 py-2.5 text-[11px] font-bold border-b-2 transition ${
              isActive
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`
          }
        >
          {l.label}
        </NavLink>
      ))}
      <span className="ml-auto text-[10px] text-slate-600 hidden sm:inline">
        Individual reports open from the table or Overview filters
      </span>
    </nav>
  );
}
