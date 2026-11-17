// --- Replaced failing import with inline functions ---
function formatDate(dateInput) {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTimeWithDay(dateInput) {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  return d.toLocaleDateString('en-US', { weekday: 'short' }) + ', ' + 
         d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateTime(dateInput) {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + 
         d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}
// -----------------------------------------------------

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function logoImgHtml() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const primary = `${origin}/image/logo.png`;
  const fallback = `${origin}/src/image/logo.png`;
  return `<img src="${primary}" alt="NSU" class="logo" onerror="this.onerror=null;this.src='${fallback}';" />`;
}

export function printViaIframe(html) {
  let frame = document.getElementById('printFrame');
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'printFrame';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    document.body.appendChild(frame);
  }
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (err) {
      console.error(err);
    }
  }, 350);
}

export function parseComments(remarksText) {
  if (!remarksText) return [];
  const text = String(remarksText).replace(/\r\n/g, '\n');
  const comments = [];
  // Primary format: === Author | timestamp === body  (optional third |tag|)
  const regex =
    /===\s*([^|\n]+?)\s*\|\s*([^|=\n]+?)(?:\s*\|\s*([^=\n]+?))?\s*===\s*([\s\S]*?)(?=\n\s*===\s*[^|\n]+\s*\||$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    comments.push({
      user: match[1].trim(),
      timestamp: match[2].trim(),
      tag: (match[3] || '').trim(),
      text: (match[4] || '').trim(),
    });
  }
  if (comments.length) return comments;

  // Fallback: split on === headers if regex missed edge whitespace
  const parts = text.split(/\n(?===\s)/);
  for (const part of parts) {
    const m = part.match(/^===\s*([^|\n]+?)\s*\|\s*([^|=\n]+?)(?:\s*\|\s*([^=\n]+?))?\s*===\s*([\s\S]*)$/);
    if (m) {
      comments.push({
        user: m[1].trim(),
        timestamp: m[2].trim(),
        tag: (m[3] || '').trim(),
        text: (m[4] || '').trim(),
      });
    }
  }
  return comments;
}

/**
 * Latest Remarks — source of truth is tickets.it_engineer_remarks.
 * Always the chronologically last non-empty parsed block (not an older HW-SEND tag).
 */
export function getLatestRemark(ticket) {
  if (!ticket) return '';
  const raw = String(ticket.it_engineer_remarks || '').trim();
  if (!raw) return '';
  const tech = parseComments(raw);
  if (tech.length) {
    for (let i = tech.length - 1; i >= 0; i--) {
      const body = String(tech[i].text || '').trim();
      if (body) return body;
    }
  }
  // Last non-empty lines if structure is non-standard
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!/^===/.test(lines[i])) return lines[i];
  }
  return '';
}

/** Optional helper for hardware-send forms only (not for Latest Remarks column) */
export function getHardwareSendRemark(ticket) {
  if (!ticket) return '';
  const tech = parseComments(ticket.it_engineer_remarks || '');
  const hwSend = [...tech].reverse().find((c) => /hw-?send/i.test(c.tag || ''));
  return hwSend?.text || getLatestRemark(ticket);
}

const sharedCss = `
  *{box-sizing:border-box}
  body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#0f172a;margin:0;padding:0;background:#fff;font-size:11px}
  .logo{height:44px;width:auto;object-fit:contain}
  @media print{
    @page{size:A4 portrait;margin:6mm}
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
`;

/** Professional service ticket report */
export function printTicketReport(ticket, history, currentUser) {
  if (!ticket) return;
  const histRows = (Array.isArray(history) ? history : [])
    .slice()
    .sort((a, b) => new Date(a.changed_at || 0) - new Date(b.changed_at || 0))
    .map(
      (h) =>
        `<tr>
        <td>${escapeHtml(formatDateTime(h.changed_at))}</td>
        <td>${escapeHtml(h.engineer_name || '—')}</td>
        <td>${escapeHtml(h.previous_status || '—')} → ${escapeHtml(h.new_status || '—')}</td>
        <td>${escapeHtml(h.action_note || '')}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Ticket #${escapeHtml(ticket.id)} — Service Report</title>
<style>
${sharedCss}
body{padding:28px 32px;font-size:12px;line-height:1.45}
.banner{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:3px solid #1a1a6e;padding-bottom:14px;margin-bottom:18px}
.org{font-size:18px;font-weight:800;color:#1a1a6e}
.org-sub{font-size:10px;color:#64748b;margin-top:2px;text-transform:uppercase;letter-spacing:.08em}
.ticket-no{font-size:20px;font-weight:900;color:#1a1a6e;font-family:ui-monospace,monospace}
.pills{margin-top:6px;display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
.pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3}
.pill.status{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}
.pill.pri{background:#fffbeb;border-color:#fde68a;color:#92400e}
.sub{color:#64748b;font-size:10px;margin-top:4px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 28px}
.field label{display:block;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#64748b;margin-bottom:2px}
.field div{font-size:13px;font-weight:600;word-break:break-word;border-bottom:1px solid #e2e8f0;padding-bottom:3px;min-height:20px}
.section{margin-top:18px}
.section h2{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#1a1a6e;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:0 0 12px;font-weight:800}
.box{border:1px solid #e2e8f0;border-radius:8px;padding:14px;background:linear-gradient(180deg,#f8fafc 0%,#fff 100%);white-space:pre-wrap;word-break:break-word}
table{width:100%;border-collapse:collapse;font-size:11px}
th{text-align:left;background:#f1f5f9;padding:9px 10px;border-bottom:2px solid #e2e8f0;font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#475569}
td{padding:8px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top}
.footer{margin-top:28px;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;display:flex;justify-content:space-between}
.stamp{font-size:9px;color:#64748b;background:#f8fafc;border:1px dashed #cbd5e1;padding:8px 10px;border-radius:6px;margin-top:16px}
</style></head><body>
  <div class="banner">
    <div style="display:flex;align-items:center;gap:14px">
      ${logoImgHtml()}
      <div>
        <div class="org">North South University</div>
        <div class="org-sub">IT Support Center · Campus Service Desk</div>
      </div>
    </div>
    <div style="text-align:right">
      <div class="ticket-no">#${escapeHtml(ticket.id)}</div>
      <div class="pills">
        <span class="pill status">${escapeHtml(ticket.status || '—')}</span>
        <span class="pill pri">${escapeHtml(ticket.priority || 'Medium')}</span>
      </div>
      <div class="sub">Generated ${escapeHtml(formatDateTime(new Date()))}${
        currentUser?.fullName ? ` · ${escapeHtml(currentUser.fullName)}` : ''
      }</div>
    </div>
  </div>
  <div class="section"><h2>Requester profile</h2>
    <div class="grid">
      <div class="field"><label>Full name</label><div>${escapeHtml(ticket.user_name || '—')}</div></div>
      <div class="field"><label>Designation</label><div>${escapeHtml(ticket.designation || '—')}</div></div>
      <div class="field"><label>Department</label><div>${escapeHtml(ticket.department || '—')}</div></div>
      <div class="field"><label>Extension</label><div>${escapeHtml(ticket.extension || '—')}</div></div>
      <div class="field"><label>Location</label><div>${escapeHtml(
        [ticket.building, ticket.room_location].filter(Boolean).join(' / ') || '—'
      )}</div></div>
      <div class="field"><label>Category</label><div>${escapeHtml(ticket.issue_category || '—')}</div></div>
    </div>
  </div>
  <div class="section"><h2>Issue description</h2>
    <div class="box">${escapeHtml(ticket.description || '—')}</div>
  </div>
  <div class="section"><h2>Assignment</h2>
    <div class="grid">
      <div class="field"><label>Assigned engineer</label><div>${escapeHtml(ticket.assigned_engineer || 'Unassigned')}</div></div>
      <div class="field"><label>Lab engineer</label><div>${escapeHtml(ticket.lab_engineer || '—')}</div></div>
      <div class="field"><label>Opened</label><div>${escapeHtml(formatDateTime(ticket.created_at))}</div></div>
      <div class="field"><label>Resolved</label><div>${escapeHtml(
        ticket.resolved_at ? formatDateTime(ticket.resolved_at) : 'Not resolved'
      )}</div></div>
    </div>
  </div>
  <div class="section"><h2>Activity history</h2>
    ${
      histRows
        ? `<table><thead><tr><th>When</th><th>By</th><th>State change</th><th>Note</th></tr></thead><tbody>${histRows}</tbody></table>`
        : '<p style="color:#64748b">No history entries.</p>'
    }
  </div>
  <div class="stamp">Generated by Campus IT Support Center · Internal use only</div>
  <div class="footer"><span>North South University · IT Support Center</span><span>Ticket #${escapeHtml(
    ticket.id
  )}</span></div>
</body></html>`;
  printViaIframe(html);
}

/** Device receive / tracking form */
export function printReceiveForm(ticket, history, currentUser) {
  if (!ticket) return;
  const pe = escapeHtml;
  const t = ticket;
  const now = new Date();
  const printDate = formatDate(now);
  const printTime = formatTimeWithDay(now);
  const printedBy = currentUser?.fullName || 'Staff';
  const assetTag = t.asset_tag || t.serial_number || 'UNASSIGNED';
  const locStr = [t.building, t.room_location].filter(Boolean).join(' / ') || '—';

  const remarksBlocks = [];
  if (t.final_remarks) {
    remarksBlocks.push({
      label: 'Requester',
      user: t.user_name || 'Requester',
      ts: formatDateTime(t.created_at),
      text: t.final_remarks,
    });
  }
  parseComments(t.it_engineer_remarks || '').forEach((c) => {
    remarksBlocks.push({ label: c.tag || 'Field Tech', user: c.user, ts: c.timestamp, text: c.text });
  });

  const remarksHTML = remarksBlocks.length
    ? remarksBlocks
        .map(
          (r) => `<div class="remark-block">
        <div class="remark-header">
          <span class="remark-label">${pe(r.label)}</span>
          <span class="remark-user">${pe(r.user)}</span>
          <span class="remark-ts">${pe(r.ts || '')}</span>
        </div>
        <div class="remark-text">${pe(r.text)}</div>
      </div>`
        )
        .join('')
    : '<div class="no-remark">No remarks recorded.</div>';

 const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Receive Form · #${pe(t.id)}</title>
<style>
${sharedCss}
@media print {
  body { 
    -webkit-print-color-adjust: exact; 
    print-color-adjust: exact; 
    background: #fff;
  }
}
body { 
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; 
  color: #000; 
  margin: 0; 
  padding: 0; 
}
.sheet { 
  max-width: 210mm; 
  margin: 0 auto; 
  padding: 10mm; 
  box-sizing: border-box; 
}

/* --- HEADER AREA --- */
.page-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: stretch; 
  border: 3px solid #000; 
  margin-bottom: 12px; 
}
.header-left { 
  padding: 12px; 
  flex: 1; 
  display: flex; 
  align-items: center; 
  gap: 15px; 
  border-right: 3px solid #000; 
}
.org-name { 
  font-size: 18px; 
  font-weight: 900; 
  text-transform: uppercase; 
  letter-spacing: 0.05em; 
  margin-bottom: 2px; 
}
.org-sub { 
  font-size: 10px; 
  font-weight: bold; 
  text-transform: uppercase; 
  letter-spacing: 0.05em; 
}
.header-right { 
  padding: 12px; 
  text-align: center; 
  display: flex; 
  flex-direction: column; 
  justify-content: center; 
  background: #000; 
  color: #fff; 
  min-width: 180px; 
}
.form-title { 
  font-size: 15px; 
  font-weight: 900; 
  text-transform: uppercase; 
  letter-spacing: 0.1em; 
}
.print-meta { 
  font-size: 10px; 
  margin-top: 6px; 
  font-family: "Courier New", Courier, monospace; 
  font-weight: bold;
}

/* --- SYSTEM BANNER --- */
.sys-banner { 
  border: 1px solid #000; 
  border-left: 6px solid #000; 
  padding: 6px 10px; 
  font-size: 9px; 
  text-transform: uppercase; 
  font-weight: bold; 
  display: flex; 
  justify-content: space-between; 
  margin-bottom: 15px; 
  background: #f4f4f4; 
}

/* --- HIGH-PRIORITY HIGHLIGHT BOXES --- */
.asset-box { 
  display: flex; 
  border: 3px solid #000; 
  margin-bottom: 15px; 
}
.asset-segment { 
  flex: 1; 
  padding: 10px 15px; 
}
.asset-segment:first-child { 
  border-right: 3px solid #000; 
}
.asset-label { 
  font-size: 9px; 
  font-weight: 900; 
  text-transform: uppercase; 
  letter-spacing: 0.1em; 
  color: #444; 
  margin-bottom: 4px; 
}
.asset-tag, .ticket-no { 
  font-size: 28px; 
  font-weight: 900; 
  font-family: "Courier New", Courier, monospace; 
  letter-spacing: 2px; 
  line-height: 1; 
}

/* --- FACTORY GRID SECTIONS --- */
.section { 
  border: 2px solid #000; 
  margin-bottom: 15px; 
}
.section-title { 
  background: #000; 
  color: #fff; 
  padding: 6px 10px; 
  font-size: 11px; 
  font-weight: 900; 
  text-transform: uppercase; 
  letter-spacing: 0.15em; 
}
.row-grid { 
  display: grid; 
  grid-template-columns: repeat(3, 1fr); 
  border-top: 1px solid #000; 
}
.row-grid.two-col { 
  grid-template-columns: repeat(2, 1fr); 
}
.row-grid.one-col { 
  grid-template-columns: 1fr; 
}
.row-grid > div { 
  border-right: 1px solid #000; 
  padding: 8px 10px; 
}
.row-grid > div:last-child { 
  border-right: none; 
}
.field-label { 
  font-size: 8px; 
  font-weight: 900; 
  text-transform: uppercase; 
  color: #555; 
  margin-bottom: 4px; 
  letter-spacing: 0.05em; 
}
.field-value { 
  font-size: 12px; 
  font-weight: bold; 
  min-height: 16px; 
  word-break: break-word; 
}

/* --- REMARKS / LOGS BLOCK (Must match backend classes) --- */
.remarks-container { padding: 0; }
.remark-block { border-top: 1px solid #000; padding: 8px 10px; background: #f9f9f9; }
.remark-block:first-child { border-top: none; }
.remark-header { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
.remark-label { font-size: 8px; font-weight: 900; text-transform: uppercase; background: #000; color: #fff; padding: 2px 6px; }
.remark-user { font-size: 10px; font-weight: bold; }
.remark-ts { font-size: 9px; color: #555; font-family: "Courier New", monospace; }
.remark-text { font-size: 11px; font-family: monospace; white-space: pre-wrap; word-break: break-word; font-weight: bold; }
.no-remark { padding: 10px; font-size: 10px; font-style: italic; font-weight: bold; color: #555; text-align: center; }

/* --- SIGNATURES --- */
.sig-row { 
  display: grid; 
  grid-template-columns: repeat(3, 1fr); 
  gap: 20px; 
  margin-top: 30px; 
  margin-bottom: 20px; 
}
.sig-box { 
  border: 2px dashed #999; 
  padding: 40px 10px 10px; 
  text-align: center; 
}
.sig-label { 
  border-top: 2px solid #000; 
  padding-top: 6px; 
  font-size: 9px; 
  font-weight: 900; 
  text-transform: uppercase; 
  letter-spacing: 0.05em; 
}

/* --- FOOTER --- */
.page-footer { 
  display: flex; 
  justify-content: space-between; 
  font-size: 9px; 
  font-weight: bold; 
  border-top: 3px solid #000; 
  padding-top: 8px; 
  text-transform: uppercase; 
}

/* --- CUTOUT / HARDWARE SLIP --- */
.hw-divider { 
  text-align: center; 
  margin: 30px 0 20px; 
  font-size: 10px; 
  font-weight: 900; 
  text-transform: uppercase; 
  letter-spacing: 0.1em; 
  display: flex; 
  align-items: center; 
  gap: 10px; 
}
.hw-divider::before, .hw-divider::after { 
  content: ""; 
  flex: 1; 
  border-bottom: 2px dashed #000; 
}

.hw-part { 
  border: 3px solid #000; 
  padding: 0; 
}
.hw-header-row { 
  display: flex; 
  justify-content: space-between; 
  align-items: stretch; 
  border-bottom: 2px solid #000; 
  background: #000; 
  color: #fff; 
}
.hw-org-box { 
  padding: 10px 12px; 
}
.hw-org { 
  font-size: 15px; 
  font-weight: 900; 
  text-transform: uppercase; 
  letter-spacing: 0.05em; 
}
.hw-org-sub { 
  font-size: 9px; 
  margin-top: 2px; 
  letter-spacing: 0.05em;
}
.hw-tag-box { 
  padding: 10px 15px; 
  background: #fff; 
  color: #000; 
  text-align: right; 
  border-left: 2px solid #000; 
  min-width: 150px; 
}
.hw-tag-value { 
  font-size: 22px; 
  font-weight: 900; 
  font-family: "Courier New", Courier, monospace; 
  line-height: 1; 
}

.hw-grid { 
  display: grid; 
  grid-template-columns: repeat(3, 1fr); 
}
.hw-grid > div { 
  border-bottom: 1px solid #000; 
  border-right: 1px solid #000; 
  padding: 8px 12px; 
}
.hw-grid > div:nth-child(3n) { 
  border-right: none; 
}
.hw-flabel { 
  font-size: 8px; 
  font-weight: 900; 
  text-transform: uppercase; 
  color: #555; 
  margin-bottom: 4px; 
}
.hw-fvalue { 
  font-size: 11px; 
  font-weight: bold; 
}

.tag-section { 
  padding: 12px; 
}
.tag-section-title { 
  font-size: 9px; 
  font-weight: 900; 
  text-transform: uppercase; 
  letter-spacing: 0.1em; 
  margin-bottom: 6px; 
  border-bottom: 2px solid #000; 
  padding-bottom: 4px; 
}
.tag-section-body { 
  font-size: 12px; 
  font-family: "Courier New", monospace; 
  white-space: pre-wrap; 
  font-weight: bold; 
}
</style></head><body>
<div class="sheet">

  <!-- HEADER -->
  <div class="page-header">
    <div class="header-left">
      ${logoImgHtml()}
      <div>
        <div class="org-name">North South University</div>
        <div class="org-sub">IT Support Center — Campus Service Desk</div>
      </div>
    </div>
    <div class="header-right">
      <div class="form-title">Device Receive Form</div>
      <div class="print-meta">TICKET #${pe(t.id)}<br/>${pe(printDate)}</div>
    </div>
  </div>
  
  <!-- SYSTEM BANNER -->
  <div class="sys-banner">
    <div><strong>SYS-GEN DOC</strong> // Campus IT Support Center</div>
    <div>PRINT OP: <strong>${pe(printedBy)}</strong> // ${pe(printDate)} ${pe(printTime)}</div>
  </div>
  
  <!-- ASSET & TICKET IDENTIFIERS -->
  <div class="asset-box">
    <div class="asset-segment">
      <div class="asset-label">Asset Tag / ID</div>
      <div class="asset-tag">${pe(assetTag)}</div>
    </div>
    <div class="asset-segment" style="text-align: right; background: #f4f4f4; border-left: 3px solid #000;">
      <div class="asset-label">Ticket Record No.</div>
      <div class="ticket-no">#${pe(t.id)}</div>
    </div>
  </div>
  
  <!-- 01. DEVICE INFO -->
  <div class="section">
    <div class="section-title">01. Hardware Specifications</div>
    <div class="row-grid">
      <div><div class="field-label">Device Type</div><div class="field-value">${pe(t.hw_type || '—')}</div></div>
      <div><div class="field-label">Brand / Model</div><div class="field-value">${pe(t.device_brand || '—')}</div></div>
      <div><div class="field-label">Asset Tag</div><div class="field-value" style="font-family: monospace;">${pe(assetTag)}</div></div>
    </div>
    <div class="row-grid two-col">
      <div><div class="field-label">Received Date</div><div class="field-value">${pe(printDate)}</div></div>
      <div><div class="field-label">Condition / Status</div><div class="field-value">${pe(t.status || '—')}</div></div>
    </div>
  </div>
  
  <!-- 02. REQUESTER INFO -->
  <div class="section">
    <div class="section-title">02. Requester Information</div>
    <div class="row-grid">
      <div><div class="field-label">Full Name</div><div class="field-value">${pe(t.user_name || '—')}</div></div>
      <div><div class="field-label">Designation</div><div class="field-value">${pe(t.designation || '—')}</div></div>
      <div><div class="field-label">Ext / Phone</div><div class="field-value">${pe(t.extension || '—')}</div></div>
    </div>
    <div class="row-grid two-col">
      <div><div class="field-label">Department</div><div class="field-value">${pe(t.department || '—')}</div></div>
      <div><div class="field-label">Office / Location</div><div class="field-value">${pe(locStr)}</div></div>
    </div>
  </div>
  
  <!-- 03. ISSUE DESCRIPTION -->
  <div class="section">
    <div class="section-title">03. Diagnostic Summary</div>
    <div class="row-grid one-col">
      <div>
        <div class="field-label">Reported Problem</div>
        <div class="field-value" style="font-family: monospace;">${pe(t.description || '—')}</div>
      </div>
    </div>
  </div>
  
  <!-- 04. REMARKS -->
  <div class="section">
    <div class="section-title">04. Audit / Activity Logs</div>
    <div class="remarks-container">
      ${remarksHTML}
    </div>
  </div>
  
  <!-- SIGNATURES -->
  <div class="sig-row">
    <div class="sig-box"><div class="sig-label">Intake Agent (IT Staff)</div></div>
    <div class="sig-box"><div class="sig-label">Assigned Engineer</div></div>
    <div class="sig-box"><div class="sig-label">Relinquishing User</div></div>
  </div>
  
  <!-- FOOTER -->
  <div class="page-footer">
    <span>FRM-REC-01 // IT Support Center</span>
    <span>${pe(assetTag)} // #${pe(t.id)} // ${pe(printDate)}</span>
  </div>
  
  <!-- HARDWARE LAB SLIP (TEAR-OFF) -->
  <div class="hw-divider">✂ CUT HERE — ATTACH TO DEVICE — LAB INTAKE SLIP ✂</div>
  
  <div class="hw-part">
    <div class="hw-header-row">
      <div class="hw-org-box">
        <div class="hw-org">NSU IT — LAB INTAKE</div>
        <div class="hw-org-sub">SECURE ATTACHMENT REQUIRED</div>
      </div>
      <div class="hw-tag-box">
        <div class="hw-flabel">ASSET TAG</div>
        <div class="hw-tag-value">${pe(assetTag)}</div>
      </div>
    </div>
    
    <div class="hw-grid">
      <div><div class="hw-flabel">TICKET NO.</div><div class="hw-fvalue" style="font-family: monospace;">#${pe(t.id)}</div></div>
      <div><div class="hw-flabel">INTAKE DATE</div><div class="hw-fvalue">${pe(printDate)}</div></div>
      <div><div class="hw-flabel">HARDWARE</div><div class="hw-fvalue">${pe(t.hw_type || '—')}</div></div>
      
      <div><div class="hw-flabel">USER</div><div class="hw-fvalue">${pe(t.user_name || '—')}</div></div>
      <div><div class="hw-flabel">DEPARTMENT</div><div class="hw-fvalue">${pe(t.department || '—')}</div></div>
      <div><div class="hw-flabel">EXTENSION</div><div class="hw-fvalue">${pe(t.extension || '—')}</div></div>
    </div>
    
    <div class="tag-section">
      <div class="tag-section-title">FAULT DESCRIPTION</div>
      <div class="tag-section-body">${pe(t.description || '—')}</div>
    </div>
  </div>

</div>
</body></html>`;
printViaIframe(html);
}

/**
 * Hardware transfer form — professional tracking style
 * HW Part (top) → cut → 1400 Part (below). Workstation fields left blank for hand-write.
 */
export function printLabHardwareForm(ticket, history, currentUser, latestRemark) {
  if (!ticket) return;
  const pe = escapeHtml;
  const t = ticket;
  const now = new Date();
  const printDate = formatDate(now);
  const printTime = formatTimeWithDay(now);
  const printedBy = currentUser?.fullName || 'Staff';
  const locLine = [t.building, t.room_location].filter(Boolean).join(' / ') || t.room_location || '—';
  const assetTag = t.asset_tag || t.serial_number || '—';
  const engineer = t.assigned_engineer || printedBy || '—';
  // Popup hardware remark is the Problem on both HW and 1400 parts
  const problemHw = (latestRemark && String(latestRemark).trim()) || t.description || '—';
  const problemFull = problemHw;
  const status = t.status || '—';
  const ext = t.extension || '—';
  const dept = t.department || '—';

  const field = (label, value, opts = {}) => {
    const blank = opts.blank;
    const wide = opts.wide;
    const v = blank ? '' : value || '';
    return `<div class="f${wide ? ' wide' : ''}${blank ? ' blank' : ''}">
      <span class="l">${pe(label)}</span>
      <span class="v">${pe(v)}</span>
    </div>`;
  };
const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Hardware Form · #${pe(t.id)}</title>
<style>
${sharedCss}
/* B&W PRINTER OPTIMIZED RESET */
:root {
  --black: #000000;
  --dark-gray: #333333;
  --mid-gray: #777777;
  --light-gray: #f4f4f4;
}
body {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: var(--black);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.sheet {
  max-width: 210mm;
  margin: 0 auto;
  padding: 8mm 10mm;
  background: #ffffff;
}

/* HEADER */
.topbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  border-bottom: 3px solid var(--black);
  padding-bottom: 12px;
  margin-bottom: 12px;
}
.org-block {
  display: flex;
  align-items: center;
  gap: 16px;
}
.org {
  font-size: 20px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  line-height: 1;
}
.org-sub {
  font-size: 9px;
  font-weight: 700;
  color: var(--dark-gray);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-top: 6px;
}
.ticket-badge {
  background: var(--black);
  color: #ffffff;
  padding: 6px 12px;
  font-size: 16px;
  font-weight: 900;
  text-align: right;
  letter-spacing: 0.05em;
}
.doc-meta {
  font-size: 8px;
  font-weight: 700;
  color: var(--dark-gray);
  text-align: right;
  margin-top: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* NEW: SIMPLE & HIGHLY PROFESSIONAL USER DETAILS */
.summary-box {
  border-top: 2px solid var(--black);
  border-bottom: 2px solid var(--black);
  padding: 10px 0;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
}
.summary-item {
  flex: 1;
  padding: 0 12px;
}
.summary-item:not(:last-child) {
  border-right: 1px solid #cccccc;
}
.summary-label {
  font-size: 8px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--mid-gray);
  margin-bottom: 4px;
}
.summary-value {
  font-size: 13px;
  font-weight: 900;
  text-transform: uppercase;
  color: var(--black);
}

/* SECTIONS: Industrial Boxed Layout */
.part {
  border: 2px solid var(--black);
  margin-bottom: 8px;
  page-break-inside: avoid;
  background: #ffffff;
}
.part-h {
  background: var(--black);
  color: #ffffff;
  font-weight: 800;
  font-size: 11px;
  letter-spacing: 0.15em;
  padding: 6px 12px;
  text-transform: uppercase;
}
.part-h.ws {
  background: #ffffff;
  color: var(--black);
  border-bottom: 2px solid var(--black);
}
.part-b {
  padding: 10px;
}
.grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

/* FIELDS */
.f {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--black);
  padding: 4px 6px;
  min-width: 0;
  background: #ffffff;
}
.f.wide { grid-column: span 2; }
.l {
  font-size: 7px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--mid-gray);
  border-bottom: 1px solid #eeeeee;
  padding-bottom: 2px;
  margin-bottom: 3px;
}
.v {
  font-size: 11px;
  font-weight: 800;
  color: var(--black);
  min-height: 16px;
  word-break: break-word;
}
/* Hand-write fields */
.f.blank { background: var(--light-gray); }
.f.blank .v {
  border-bottom: 1px dotted var(--black);
  margin-top: auto;
  min-height: 14px;
}
.problem-box .v {
  min-height: 38px;
  white-space: pre-wrap;
  font-weight: 600;
}

/* SCISSOR CUTS */
.cut {
  display: flex;
  align-items: center;
  margin: 12px 0;
}
.cut::before, .cut::after {
  content: '';
  flex: 1;
  border-bottom: 1.5px dashed var(--black);
}
.cut span {
  padding: 0 12px;
  font-size: 8.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--black);
}
.footer {
  margin-top: 16px;
  font-size: 8px;
  font-weight: 700;
  color: var(--mid-gray);
  display: flex;
  justify-content: space-between;
  border-top: 2px solid var(--black);
  padding-top: 8px;
  text-transform: uppercase;
}
</style></head><body>
<div class="sheet">
  <!-- Header -->
  <div class="topbar">
    <div class="org-block">
      ${logoImgHtml()}
      <div>
        <div class="org">North South University</div>
        <div class="org-sub">IT Support Center · HW Transfer</div>
      </div>
    </div>
    <div>
      <div class="ticket-badge">TICKET #${pe(t.id)}</div>
      <div class="doc-meta">Printed: ${pe(printDate)} · ${pe(printTime)}</div>
    </div>
  </div>

  <!-- SIMPLE & PROFESSIONAL USER DETAILS -->
  <div class="summary-box">
    <div class="summary-item" style="padding-left: 0;">
      <div class="summary-label">User Name</div>
      <div class="summary-value">${pe(t.user_name || '—')}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Ext / Cell</div>
      <div class="summary-value">${pe(ext || '—')}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Device Type</div>
      <div class="summary-value">${pe(t.hw_type || '—')}</div>
    </div>
    <div class="summary-item" style="border-right: none;">
      <div class="summary-label">Asset ID</div>
      <div class="summary-value">${pe(assetTag || '—')}</div>
    </div>
  </div>

  <!-- PART 1: Hardware Lab -->
  <div class="part">
    <div class="part-h">HW Part · Hardware Lab</div>
    <div class="part-b">
      <div class="grid">
        ${field('Ref SL', '#' + (t.id || ''))}
        ${field('Date', printDate)}
        ${field('Dept.', dept)}
        ${field('Room', locLine)}
      </div>
      <div class="grid-3" style="margin-top:8px">
        ${field('IT Engineer', engineer)}
        ${field('Status', status)}
        ${field('Brand / Model', t.device_brand || '—')}
      </div>
      <div class="grid-3 problem-box" style="margin-top:8px">
        <div class="f wide"><span class="l">Problem</span><span class="v">${pe(problemHw)}</span></div>
        ${field('Received By (HW)', '', { blank: true })}
      </div>
    </div>
  </div>

  <div class="cut"><span>✂ Cut Here — Workstation Strip ✂</span></div>

  <!-- PART 2: Workstation (Middle) -->
  <div class="part">
    <div class="part-h ws">Workstation Attach Strip</div>
    <div class="part-b">
      <!-- Tag Row on one side -->
      <div class="grid-3">
        ${field('User Name', t.user_name || '—')}
        ${field('Ext / Cell', ext)}
        ${field('Device ID', assetTag)}
      </div>
      <!-- Blank Row 1 -->
      <div class="grid-3" style="margin-top:8px">
        ${field('Date', '', { blank: true })}
        ${field('Room', '', { blank: true })}
        ${field('Status', '', { blank: true })}
      </div>
      <!-- Blank Row 2 -->
      <div class="grid-3" style="margin-top:8px">
        ${field('IP Address', '', { blank: true })}
        ${field('MAC Address', '', { blank: true })}
        ${field('HW SL', '', { blank: true })}
      </div>
    </div>
  </div>

  <div class="cut"><span>✂ Cut Here — Keep 1400 Part ✂</span></div>

  <!-- PART 3: 1400 Part (Bottom) RESTORED DETAILS -->
  <div class="part">
    <div class="part-h">1400 Part · Service Desk</div>
    <div class="part-b">
      <div class="grid">
        ${field('SL / Ticket', '#' + (t.id || ''))}
        ${field('Date', printDate)}
        ${field('Dept.', dept)}
        ${field('Room', locLine)}
      </div>
      <!-- Restored User Details for Desk Records -->
      <div class="grid-3" style="margin-top:8px">
        ${field('User Name', t.user_name || '—')}
        ${field('Ext / Cell', ext)}
        ${field('IT Engineer', engineer)}
      </div>
      <div class="grid-3" style="margin-top:8px">
        ${field('Device ID / Asset', assetTag)}
        ${field('Device Type', t.hw_type || '—')}
        ${field('Brand / Model', t.device_brand || '—')}
      </div>
      <div class="grid-3 problem-box" style="margin-top:8px">
        <div class="f wide"><span class="l">Problem</span><span class="v">${pe(problemFull)}</span></div>
        <div class="f">
           ${field('Initial Action', '', { blank: true })}
           <div style="margin-top:8px"></div>
           ${field('Data Backup Req?', '', { blank: true })}
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <span>NSU IT Support Center // System Generated</span>
    <span>Printed By: ${pe(printedBy)}</span>
  </div>
</div>
</body></html>`;
  
printViaIframe(html);
}