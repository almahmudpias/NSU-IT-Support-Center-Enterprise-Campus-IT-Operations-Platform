/**
 * Enterprise-style UUID resource paths (deterministic, reversible from integer PKs).
 * Still accepts legacy plain numbers and tk_/ev_ opaque refs.
 */

const XOR = 0x5a5a9c3d;

function mix(n) {
  let x = Number(n) >>> 0;
  x = (x ^ XOR) >>> 0;
  x = Math.imul(x, 0x9e3779b1) >>> 0;
  return x;
}

const KIND_CODE = { ticket: 1, event: 2, requester: 3, staff: 4 };
const CODE_KIND = { 1: 'ticket', 2: 'event', 3: 'requester', 4: 'staff' };

function decodeOpaque(ref) {
  const s = String(ref).trim();
  const m = s.match(/^(tk|ev|rq|st)_([a-z0-9]+)$/i);
  if (!m) return null;
  const kindMap = { tk: 'ticket', ev: 'event', rq: 'requester', st: 'staff' };
  const body = m[2];
  if (body.length < 2) return null;
  const check = body.slice(-1);
  const idPart = body.slice(0, -1);
  const id = parseInt(idPart, 36);
  if (!Number.isFinite(id) || id <= 0) return null;
  const expect = (mix(id) % 36).toString(36);
  if (check.toLowerCase() !== expect.toLowerCase()) {
    const alt = parseInt(body, 36);
    if (Number.isFinite(alt) && alt > 0) return { kind: kindMap[m[1].toLowerCase()], id: alt };
    return null;
  }
  return { kind: kindMap[m[1].toLowerCase()], id };
}

function decodeUuidStyle(ref) {
  const s = String(ref).trim().toLowerCase();
  const m = s.match(
    /^([0-9a-f]{8})-([0-9a-f]{4})-4([0-9a-f])([0-9a-f]{2})-8([0-9a-f]{3})-([0-9a-f]{12})$/
  );
  if (!m) return null;
  const id = parseInt(m[1], 16);
  if (!Number.isFinite(id) || id <= 0) return null;
  const kindCode = parseInt(m[2], 16);
  return { kind: CODE_KIND[kindCode] || null, id };
}

export function encodeRef(kind, id) {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return String(id);
  const idNum = Math.trunc(n) >>> 0;
  const k = KIND_CODE[kind] || 0;
  const idHex = idNum.toString(16).padStart(8, '0');
  const kHex = k.toString(16).padStart(4, '0');
  const c1 = (mix(idNum ^ (k << 16)) >>> 0).toString(16).padStart(8, '0');
  const c2 = (mix(~idNum + k) >>> 0).toString(16).padStart(8, '0');
  return `${idHex}-${kHex}-4${c1.slice(0, 3)}-8${c1.slice(3, 6)}-${c2}${c1.slice(6, 8)}0000`.slice(0, 36);
}

export function decodeRef(ref) {
  if (ref == null || ref === '') return null;
  const s = String(ref).trim();
  if (/^\d+$/.test(s)) return { kind: null, id: Number(s) };
  const uuid = decodeUuidStyle(s);
  if (uuid) return uuid;
  const opaque = decodeOpaque(s);
  if (opaque) return opaque;
  return { kind: null, id: s };
}

export function ticketPath(id, opts = {}) {
  const base = `/tickets/${encodeRef('ticket', id)}`;
  const qs = new URLSearchParams();
  if (opts.action === 'edit') qs.set('action', 'edit');
  else if (opts.action === 'view' || opts.action === 'details') qs.set('action', 'view');
  if (opts.intent) qs.set('intent', String(opts.intent));
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

export function eventPath(id, opts = {}) {
  const base = `/events/${encodeRef('event', id)}`;
  if (opts.action === 'edit') return `${base}?action=edit`;
  if (opts.action === 'view' || opts.action === 'details') return `${base}?action=view`;
  return base;
}

export function eventEditPath(id) {
  return eventPath(id, { action: 'edit' });
}

export function eventNewPath() {
  return `/events/new`;
}

export function requesterPath(id) {
  return `/requesters/${encodeRef('requester', id)}`;
}

export function staffPath(id) {
  return `/users/${encodeRef('staff', id)}`;
}

export function staffEditPath(id) {
  // Same pattern as events/tickets: resource path + ?action=edit
  return `/users/${encodeRef('staff', id)}?action=edit`;
}

export function resolveParamId(param) {
  const d = decodeRef(param);
  return d?.id ?? param;
}
