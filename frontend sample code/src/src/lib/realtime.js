import { useEffect, useRef } from 'react';

/**
 * Subscribe to server SSE bridge for cross-portal data sync.
 * onEvent receives { table, event, id, ... } — call a debounced reload.
 * Does not expose Supabase credentials to the browser.
 */
export function useRealtimeSync(onEvent, { enabled = true, debounceMs = 800 } = {}) {
  const cbRef = useRef(onEvent);
  const timerRef = useRef(null);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    let es = null;
    let closed = false;
    let retryTimer = null;

    function schedule(payload) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          cbRef.current?.(payload);
        } catch {
          /* ignore consumer errors */
        }
      }, debounceMs);
    }

    function connect() {
      if (closed) return;
      try {
        es = new EventSource('/api/realtime/stream', { withCredentials: true });
      } catch {
        retryTimer = setTimeout(connect, 5000);
        return;
      }
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data?.table === 'system') return;
          schedule(data);
        } catch {
          /* ignore malformed */
        }
      };
      es.onerror = () => {
        try {
          es.close();
        } catch {
          /* */
        }
        es = null;
        if (!closed) retryTimer = setTimeout(connect, 4000);
      };
    }

    connect();

    return () => {
      closed = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (retryTimer) clearTimeout(retryTimer);
      try {
        es?.close();
      } catch {
        /* */
      }
    };
  }, [enabled, debounceMs]);
}
