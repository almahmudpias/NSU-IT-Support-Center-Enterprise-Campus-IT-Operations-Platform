import { useEffect, useState } from 'react';

/**
 * Professional in-app confirm / prompt / select dialog (never uses browser alert/prompt).
 * mode: 'confirm' | 'prompt' | 'select'
 * options: [{ value, label }] for select mode
 * selectKind: 'engineer' | 'status' — label wording only
 */
export default function ConfirmDialog({
  open,
  mode = 'confirm',
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'indigo',
  defaultValue = '',
  placeholder = '',
  required = false,
  options = [],
  selectKind = 'engineer',
  emptyOptionLabel,
  onConfirm,
  onCancel,
}) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue ?? '');
  }, [open, defaultValue]);

  if (!open) return null;

  const tones = {
    indigo: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/40',
    rose: 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/40',
    emerald: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40',
    amber: 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/40',
  };

  function handleConfirm() {
    if (mode === 'prompt') {
      const v = String(value || '').trim();
      if (required && !v) return;
      onConfirm?.(v);
    } else if (mode === 'select') {
      if (required && (value === undefined || value === null || value === '')) return;
      onConfirm?.(value);
    } else {
      onConfirm?.(true);
    }
  }

  const disableConfirm =
    (mode === 'prompt' && required && !String(value || '').trim()) ||
    (mode === 'select' && required && (value === undefined || value === null || value === ''));

  const fieldLabel =
    selectKind === 'status' ? 'Select status' : selectKind === 'engineer' ? 'Select engineer' : 'Select';
  const emptyLabel =
    emptyOptionLabel ||
    (selectKind === 'status' ? '— Choose status —' : '— Unassigned —');

  const iconPath =
    mode === 'prompt'
      ? 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
      : mode === 'select'
        ? 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4'
        : 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[#0B0F19]/85 backdrop-blur-md">
      <div
        className="w-full max-w-[440px] rounded-2xl border border-indigo-500/20 bg-gradient-to-b from-[#1a2236] to-[#121826] shadow-[0_40px_100px_rgba(0,0,0,0.75),0_0_0_1px_rgba(99,102,241,0.08)] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 pt-6 pb-4 border-b border-[#1F2937]/80 bg-gradient-to-r from-indigo-600/10 via-transparent to-purple-600/10">
          <div className="flex items-center justify-center mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={iconPath} />
              </svg>
            </div>
          </div>
          <h3 className="text-center text-[15px] font-extrabold text-gray-100 tracking-tight">{title}</h3>
          {message && (
            <p className="text-center text-xs text-gray-400 leading-relaxed mt-2 whitespace-pre-wrap">{message}</p>
          )}
        </div>

        <div className="px-6 py-5">
          {mode === 'prompt' && (
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={3}
              placeholder={placeholder}
              className="dark-input w-full text-xs resize-none"
              autoFocus
            />
          )}
          {mode === 'select' && (
            <div className="space-y-3">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                {fieldLabel}
              </label>
              <select
                value={value ?? ''}
                onChange={(e) => setValue(e.target.value)}
                className="dark-input w-full text-xs font-bold"
                autoFocus
              >
                <option value="">{emptyLabel}</option>
                {(options || [])
                  .filter((o) => o.value !== '')
                  .map((o) => (
                    <option key={String(o.value)} value={o.value}>
                      {o.label}
                    </option>
                  ))}
              </select>
              <div className="flex flex-wrap gap-1.5 max-h-[150px] overflow-y-auto custom-scroll">
                {(options || [])
                  .filter((o) => o.value !== '')
                  .map((o) => (
                    <button
                      key={`chip-${o.value}`}
                      type="button"
                      onClick={() => setValue(o.value)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition ${
                        value === o.value
                          ? 'bg-indigo-600/25 border-indigo-400/50 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                          : 'bg-[#1f2937]/80 border-[#374151] text-gray-400 hover:text-white hover:border-indigo-500/40'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-2.5">
          <button
            type="button"
            onClick={() => onCancel?.()}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#1f2937] border border-[#374151] text-gray-300 hover:bg-[#374151] transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={disableConfirm}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white border-0 transition disabled:opacity-40 shadow-lg ${tones[tone] || tones.indigo}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
