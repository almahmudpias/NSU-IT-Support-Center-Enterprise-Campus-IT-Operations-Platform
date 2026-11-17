import { useEffect, useRef, useState } from 'react';

/**
 * Shared SSE realtime bus — one EventSource per browser tab.
 * Components register listeners via useRealtimeSync; mutations can also
 * call notifyLocalDataChange() so the same tab updates without waiting
 * for the server round-trip.
 *
 * Presence (viewing/editing a ticket) uses a separate listener set so it
 * never triggers list/detail data reloads.
 */

const LOCAL_EVENT = 'nsu-data-change';
const listeners = new Set();
const presenceListeners = new Set();
let es = null;
let retryTimer = null;
let refCount = 0;
let connecting = false;

function emit(payload) {
  if (payload?.table === 'presence') {
    presenceListeners.forEach((fn) => {
      try {
        fn(payload);
      } catch {
        /* ignore */
      }
    });
    return;
  }
  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      /* ignore consumer errors */
    }
  });
}

function connectShared() {
  if (typeof window === 'undefined') return;
  if (es || connecting) return;
  connecting = true;
  try {
    const source = new EventSource('/api/realtime/stream', { withCredentials: true });
    es = source;
    source.onopen = () => {
      connecting = false;
    };
    source.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.table === 'system') return;
        emit(data);
      } catch {
        /* ignore malformed */
      }
    };
    source.onerror = () => {
      connecting = false;
      try {
        source.close();
      } catch {
        /* */
      }
      if (es === source) es = null;
      if (refCount > 0 && !retryTimer) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          connectShared();
        }, 3500);
      }
    };
  } catch {
    connecting = false;
    if (refCount > 0 && !retryTimer) {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connectShared();
      }, 5000);
    }
  }
}

function acquire() {
  refCount += 1;
  connectShared();
}

function release() {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0) {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (es) {
      try {
        es.close();
      } catch {
        /* */
      }
      es = null;
    }
    connecting = false;
  }
}

/** Same-tab instant refresh after a successful mutation */
export function notifyLocalDataChange(payload) {
  if (typeof window === 'undefined') return;
  const data = payload || { table: 'local', event: 'mutation' };
  try {
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: data }));
  } catch {
    /* ignore */
  }
  emit(data);
}

export function useRealtimeSync(onEvent, options) {
  const opts = options || {};
  const enabled = opts.enabled !== false;
  const debounceMs = opts.debounceMs != null ? opts.debounceMs : 450;
  const cbRef = useRef(onEvent);
  const timerRef = useRef(null);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    function schedule(payload) {
      if (payload?.table === 'presence' || payload?.table === 'system') return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          cbRef.current?.(payload);
        } catch {
          /* ignore */
        }
      }, debounceMs);
    }

    const listener = (payload) => schedule(payload);
    listeners.add(listener);
    acquire();

    const onLocal = (ev) => schedule(ev.detail || { table: 'local', event: 'mutation' });
    window.addEventListener(LOCAL_EVENT, onLocal);

    return () => {
      listeners.delete(listener);
      window.removeEventListener(LOCAL_EVENT, onLocal);
      if (timerRef.current) clearTimeout(timerRef.current);
      release();
    };
  }, [enabled, debounceMs]);
}

function filterSelf(peers, selfName, selfUsername) {
  const n = String(selfName || '')
    .trim()
    .toLowerCase();
  const u = String(selfUsername || '')
    .trim()
    .toLowerCase();
  return (Array.isArray(peers) ? peers : []).filter((p) => {
    const pn = String(p.fullName || '')
      .trim()
      .toLowerCase();
    const pu = String(p.username || '')
      .trim()
      .toLowerCase();
    if (n && pn === n) return false;
    if (u && pu === u) return false;
    return true;
  });
}

/**
 * Ticket presence (viewing / editing) — Messenger-style indicator.
 * Does not touch form state or trigger data reloads.
 */
export function useTicketPresence(
  ticketId,
  { mode = 'viewing', enabled = true, selfName = '', selfUsername = '' } = {}
) {
  const [peers, setPeers] = useState([]);
  const sessionIdRef = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const selfNameRef = useRef(selfName);
  const selfUserRef = useRef(selfUsername);
  selfNameRef.current = selfName;
  selfUserRef.current = selfUsername;

  useEffect(() => {
    if (!enabled || ticketId == null || ticketId === '') {
      setPeers([]);
      return undefined;
    }

    let stopped = false;
    let leaveTimer = null;
    const sid = sessionIdRef.current;
    const tid = String(ticketId);

    function applyPeers(list) {
      if (stopped) return;
      setPeers(filterSelf(list, selfNameRef.current, selfUserRef.current));
    }

    async function ping(nextMode) {
      try {
        const res = await fetch('/api/presence/ticket', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketId: tid,
            mode: nextMode || modeRef.current || 'viewing',
            sessionId: sid,
          }),
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (Array.isArray(data?.peers)) applyPeers(data.peers);
      } catch {
        /* ignore */
      }
    }

    async function pull() {
      try {
        const res = await fetch(`/api/presence/ticket/${encodeURIComponent(tid)}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (Array.isArray(data?.peers)) applyPeers(data.peers);
      } catch {
        /* ignore */
      }
    }

    function onPresence(payload) {
      if (payload?.table !== 'presence') return;
      if (String(payload.ticketId) !== tid) return;
      if (Array.isArray(payload.peers)) applyPeers(payload.peers);
    }

    presenceListeners.add(onPresence);
    acquire();

    // Join immediately + short poll backup (SSE may lag)
    ping(modeRef.current || 'viewing');
    pull();
    const iv = setInterval(() => {
      ping(modeRef.current || 'viewing');
    }, 8000);
    const pullIv = setInterval(pull, 5000);

    function onLeaveImmediate() {
      try {
        const body = JSON.stringify({
          ticketId: tid,
          mode: 'leave',
          sessionId: sid,
        });
        fetch('/api/presence/ticket', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    }

    window.addEventListener('pagehide', onLeaveImmediate);
    window.addEventListener('beforeunload', onLeaveImmediate);

    return () => {
      stopped = true;
      clearInterval(iv);
      clearInterval(pullIv);
      presenceListeners.delete(onPresence);
      window.removeEventListener('pagehide', onLeaveImmediate);
      window.removeEventListener('beforeunload', onLeaveImmediate);
      // Defer leave so React Strict Mode remount does not wipe presence
      leaveTimer = setTimeout(onLeaveImmediate, 600);
      // Store cancel on session object
      sessionIdRef._leaveTimer = leaveTimer;
      release();
    };
  }, [ticketId, enabled]);

  // Cancel deferred leave when effect re-runs (Strict Mode remount)
  useEffect(() => {
    if (sessionIdRef._leaveTimer) {
      clearTimeout(sessionIdRef._leaveTimer);
      sessionIdRef._leaveTimer = null;
    }
  }, [ticketId, enabled]);

  // Mode changes (viewing ↔ editing)
  useEffect(() => {
    if (!enabled || ticketId == null || ticketId === '') return;
    const sid = sessionIdRef.current;
    const tid = String(ticketId);
    fetch('/api/presence/ticket', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId: tid,
        mode: mode || 'viewing',
        sessionId: sid,
      }),
    })
      .then((r) => r.json().catch(() => null))
      .then((data) => {
        if (Array.isArray(data?.peers)) {
          setPeers(filterSelf(data.peers, selfName, selfUsername));
        }
      })
      .catch(() => {});
  }, [mode, ticketId, enabled, selfName, selfUsername]);

  return peers;
}
