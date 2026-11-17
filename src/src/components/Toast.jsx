import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext({ showToast: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type, title, msg, duration = 4500) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, type, title, msg }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div id="toastContainer">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type || 'info'}`}>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-gray-100 mb-0.5">{t.title}</div>
              {t.msg && <div className="text-[11px] text-gray-400 leading-relaxed">{t.msg}</div>}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="text-gray-500 hover:text-gray-200 text-xs px-1">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
